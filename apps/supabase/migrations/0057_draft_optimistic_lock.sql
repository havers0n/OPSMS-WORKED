-- 0057_draft_optimistic_lock.sql
--
-- DEF-6: Multi-user silent overwrite.
-- save_layout_draft does DELETE+INSERT with no concurrency guard → second
-- writer silently destroys first writer's work.
--
-- Fix: optimistic locking via draft_version integer counter.
--   - layout_versions gets draft_version column (starts at 1).
--   - save_layout_draft accepts client_draft_version from the payload.
--   - If client_draft_version != current draft_version → raise DRAFT_CONFLICT.
--   - On success → increment draft_version and return new value.
--   - get_layout_bundle exposes draft_version so clients always have current value.
--
-- Backward compat: if payload contains no draftVersion key the check is skipped
-- (null-safe), so old clients continue to work until updated.

-- ─── 1. Add column ────────────────────────────────────────────────────────────

alter table public.layout_versions
  add column if not exists draft_version integer not null default 1;

-- ─── 2. Update get_layout_bundle to expose draft_version ─────────────────────

create or replace function public.get_layout_bundle(layout_version_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if layout_version_uuid is null then
    raise exception 'layout_version_uuid is required';
  end if;

  if not exists (
    select 1 from public.layout_versions where id = layout_version_uuid
  ) then
    raise exception 'Layout version % not found', layout_version_uuid;
  end if;

  if not public.can_access_layout_version(layout_version_uuid) then
    raise exception 'Permission denied for layout version %', layout_version_uuid;
  end if;

  return (
    select jsonb_build_object(
      'layoutVersionId', lv.id,
      'floorId',         lv.floor_id,
      'state',           lv.state,
      'versionNo',       lv.version_no,
      'draftVersion',    lv.draft_version,
      'publishedAt',     lv.published_at,
      'racks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',           r.id,
          'displayCode',  r.display_code,
          'kind',         r.kind,
          'axis',         r.axis,
          'x',            r.x,
          'y',            r.y,
          'totalLength',  r.total_length,
          'depth',        r.depth,
          'rotationDeg',  r.rotation_deg,
          'faces', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',                     rf.id,
              'side',                   rf.side,
              'enabled',                rf.enabled,
              'slotNumberingDirection', rf.slot_numbering_direction,
              'faceLength',             rf.face_length,
              'isMirrored',             rf.is_mirrored,
              'mirrorSourceFaceId',     rf.mirror_source_face_id,
              'sections', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'id',      rs.id,
                  'ordinal', rs.ordinal,
                  'length',  rs.length,
                  'levels', coalesce((
                    select jsonb_agg(jsonb_build_object(
                      'id',        rl.id,
                      'ordinal',   rl.ordinal,
                      'slotCount', rl.slot_count
                    ) order by rl.ordinal)
                    from public.rack_levels rl
                    where rl.rack_section_id = rs.id
                  ), '[]'::jsonb)
                ) order by rs.ordinal)
                from public.rack_sections rs
                where rs.rack_face_id = rf.id
              ), '[]'::jsonb)
            ) order by rf.side)
            from public.rack_faces rf
            where rf.rack_id = r.id
          ), '[]'::jsonb)
        ) order by r.display_code)
        from public.racks r
        where r.layout_version_id = lv.id
      ), '[]'::jsonb)
    )
    from public.layout_versions lv
    where lv.id = layout_version_uuid
  );
end;
$$;

-- ─── 3. Update save_layout_draft: check + increment draft_version ─────────────
-- Must DROP first: return type changes from uuid → jsonb.

drop function if exists public.save_layout_draft(jsonb, uuid);

create or replace function public.save_layout_draft(
  layout_payload jsonb,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  layout_version_uuid  uuid    := (layout_payload ->> 'layoutVersionId')::uuid;
  client_draft_version integer := (layout_payload ->> 'draftVersion')::integer;
  current_draft_version integer;
  new_draft_version     integer;
begin
  if layout_version_uuid is null then
    raise exception 'layoutVersionId is required in save_layout_draft payload';
  end if;

  -- Lock the row to serialize concurrent saves for the same draft.
  select draft_version
    into current_draft_version
  from public.layout_versions
  where id = layout_version_uuid and state = 'draft'
  for update;

  if not found then
    raise exception 'Layout version % is not an active draft.', layout_version_uuid;
  end if;

  -- Optimistic lock check. Skipped if client sends no draftVersion (null).
  if client_draft_version is not null
    and current_draft_version is distinct from client_draft_version
  then
    raise exception 'DRAFT_CONFLICT';
  end if;

  -- Explicit authz check (replaces per-row RLS since we run SECURITY DEFINER)
  if not public.can_manage_layout_version(layout_version_uuid) then
    raise exception 'Permission denied for layout version %', layout_version_uuid;
  end if;

  perform public.validate_layout_payload(layout_payload);

  -- ── 1. Destructive wipe ──────────────────────────────────────────────────────
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

  set constraints rack_faces_mirror_consistency_trigger deferred;

  delete from public.rack_faces
  where rack_id in (
    select id from public.racks where layout_version_id = layout_version_uuid
  );

  delete from public.racks
  where layout_version_id = layout_version_uuid;

  -- ── 2. Bulk insert racks ─────────────────────────────────────────────────────
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

  -- ── 3. Bulk insert rack_faces ────────────────────────────────────────────────
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
    false,
    null
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces')              as f;

  -- 3b. Restore mirror relationships
  update public.rack_faces rf
  set
    is_mirrored           = true,
    mirror_source_face_id = (f ->> 'mirrorSourceFaceId')::uuid
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces')              as f
  where rf.id = (f ->> 'id')::uuid
    and coalesce((f ->> 'isMirrored')::boolean, false) = true
    and nullif(f ->> 'mirrorSourceFaceId', '') is not null;

  -- ── 4. Bulk insert rack_sections ─────────────────────────────────────────────
  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  select
    (s ->> 'id')::uuid,
    (f ->> 'id')::uuid,
    (s ->> 'ordinal')::integer,
    (s ->> 'length')::numeric
  from jsonb_array_elements(layout_payload -> 'racks')    as r,
       jsonb_array_elements(r -> 'faces')                 as f,
       jsonb_array_elements(f -> 'sections')              as s;

  -- ── 5. Bulk insert rack_levels ───────────────────────────────────────────────
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

  -- ── 6. Increment draft_version + touch updated_at ───────────────────────────
  update public.layout_versions
  set draft_version = draft_version + 1,
      updated_at    = timezone('utc', now())
  where id = layout_version_uuid
  returning draft_version into new_draft_version;

  -- ── 7. Audit event ───────────────────────────────────────────────────────────
  perform public.write_layout_event(
    'layout_draft_saved', 'succeeded',
    layout_version_uuid, 'layout_version', layout_version_uuid,
    actor_uuid,
    jsonb_build_object(
      'rackCount',      jsonb_array_length(layout_payload -> 'racks'),
      'draftVersion',   new_draft_version
    )
  );

  return jsonb_build_object(
    'layoutVersionId', layout_version_uuid,
    'draftVersion',    new_draft_version
  );

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
