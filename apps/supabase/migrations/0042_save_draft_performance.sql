-- Migration 0042: rewrite save_layout_draft as set-based bulk INSERT
--
-- Problem 1 (loops): the original function in 0009_layout_hardening.sql
-- used four nested PL/pgSQL FOR-LOOP cursors (racks → faces → sections →
-- levels), executing one INSERT per row.  On large layouts this times out.
--
-- Problem 2 (RLS per-row): even after converting to bulk INSERT…SELECT,
-- every inserted row triggers the WITH CHECK policy:
--   rack_levels  → can_manage_rack → can_manage_layout_version → can_manage_floor
-- That is 5-6 DB round-trips per row.  With 100 racks × 2 faces × 5 sections
-- × 5 levels = 5 000 levels → ~30 000 extra lookups just for levels.
--
-- Problem 3 (anchor): the old function referenced the `anchor` column in
-- rack_faces which was dropped in a later migration.
--
-- Fix:
--   • SECURITY DEFINER skips per-row RLS checks entirely.
--   • Explicit can_manage_layout_version() guard at entry preserves authz.
--   • Four flat INSERT…SELECT replace the nested cursor loops.
--   • Mirror consistency: insert all faces flat first, then one bulk UPDATE.

create or replace function public.save_layout_draft(
  layout_payload jsonb,
  actor_uuid     uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  layout_version_uuid uuid := (layout_payload ->> 'layoutVersionId')::uuid;
begin
  if layout_version_uuid is null then
    raise exception 'layoutVersionId is required in save_layout_draft payload';
  end if;

  if not exists (
    select 1
    from public.layout_versions
    where id = layout_version_uuid and state = 'draft'
  ) then
    raise exception 'Layout version % is not an active draft.', layout_version_uuid;
  end if;

  -- Explicit authz check (replaces per-row RLS since we run SECURITY DEFINER)
  if not public.can_manage_layout_version(layout_version_uuid) then
    raise exception 'Permission denied for layout version %', layout_version_uuid;
  end if;

  perform public.validate_layout_payload(layout_payload);

  -- ── 1. Destructive wipe (already set-based) ───────────────────────────────
  delete from public.cells
  where layout_version_id = layout_version_uuid;

  delete from public.rack_levels
  where rack_section_id in (
    select rs.id
    from public.rack_sections rs
    join public.rack_faces  rf on rf.id = rs.rack_face_id
    join public.racks        r on r.id  = rf.rack_id
    where r.layout_version_id = layout_version_uuid
  );

  delete from public.rack_sections
  where rack_face_id in (
    select rf.id
    from public.rack_faces rf
    join public.racks       r on r.id = rf.rack_id
    where r.layout_version_id = layout_version_uuid
  );

  -- Temporarily disable mirror-consistency trigger so we can wipe faces
  -- without FK / mirror-source violations during the delete phase.
  set constraints rack_faces_mirror_consistency_trigger deferred;

  delete from public.rack_faces
  where rack_id in (
    select id from public.racks where layout_version_id = layout_version_uuid
  );

  delete from public.racks
  where layout_version_id = layout_version_uuid;

  -- ── 2. Bulk insert racks ──────────────────────────────────────────────────
  insert into public.racks (
    id, layout_version_id, display_code, kind, axis,
    x, y, total_length, depth, rotation_deg, state
  )
  select
    (r ->> 'id')::uuid,
    layout_version_uuid,
    r ->> 'displayCode',
    r ->> 'kind',
    r ->> 'axis',
    (r ->> 'x')::numeric,
    (r ->> 'y')::numeric,
    (r ->> 'totalLength')::numeric,
    (r ->> 'depth')::numeric,
    (r ->> 'rotationDeg')::integer,
    'draft'
  from jsonb_array_elements(layout_payload -> 'racks') as r;

  -- ── 3. Bulk insert rack_faces (mirroring stripped, restored in step 3b) ───
  insert into public.rack_faces (
    id, rack_id, side, enabled,
    slot_numbering_direction, face_length,
    is_mirrored, mirror_source_face_id
  )
  select
    (f ->> 'id')::uuid,
    (r ->> 'id')::uuid,
    f ->> 'side',
    coalesce((f ->> 'enabled')::boolean, true),
    f ->> 'slotNumberingDirection',
    nullif(f ->> 'faceLength', '')::numeric,
    false,   -- insert flat first; trigger fires here (no mirror yet)
    null
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces')              as f;

  -- 3b. Restore mirror relationships now that all face rows exist
  update public.rack_faces rf
  set
    is_mirrored          = true,
    mirror_source_face_id = (f ->> 'mirrorSourceFaceId')::uuid
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces')              as f
  where rf.id = (f ->> 'id')::uuid
    and coalesce((f ->> 'isMirrored')::boolean, false) = true
    and nullif(f ->> 'mirrorSourceFaceId', '') is not null;

  -- ── 4. Bulk insert rack_sections ─────────────────────────────────────────
  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  select
    (s ->> 'id')::uuid,
    (f ->> 'id')::uuid,
    (s ->> 'ordinal')::integer,
    (s ->> 'length')::numeric
  from jsonb_array_elements(layout_payload -> 'racks')    as r,
       jsonb_array_elements(r -> 'faces')                 as f,
       jsonb_array_elements(f -> 'sections')              as s;

  -- ── 5. Bulk insert rack_levels ────────────────────────────────────────────
  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  select
    (l ->> 'id')::uuid,
    (s ->> 'id')::uuid,
    (l ->> 'ordinal')::integer,
    (l ->> 'slotCount')::integer
  from jsonb_array_elements(layout_payload -> 'racks')    as r,
       jsonb_array_elements(r -> 'faces')                 as f,
       jsonb_array_elements(f -> 'sections')              as s,
       jsonb_array_elements(s -> 'levels')                as l;

  -- ── 6. Audit event ────────────────────────────────────────────────────────
  perform public.write_layout_event(
    'layout_draft_saved', 'succeeded',
    layout_version_uuid, 'layout_version', layout_version_uuid,
    actor_uuid,
    jsonb_build_object('rackCount', jsonb_array_length(layout_payload -> 'racks'))
  );

  return layout_version_uuid;

exception
  when others then
    if layout_version_uuid is not null then
      perform public.write_layout_event(
        'layout_draft_saved', 'failed',
        layout_version_uuid, 'layout_version', layout_version_uuid,
        actor_uuid,
        jsonb_build_object('error', sqlerrm)
      );
    end if;
    raise;
end;
$$;

comment on function public.save_layout_draft(jsonb, uuid) is
  'Transitional editor-persistence RPC only. Do not attach new downstream '
  'business logic or dependencies to this destructive rewrite path.';
