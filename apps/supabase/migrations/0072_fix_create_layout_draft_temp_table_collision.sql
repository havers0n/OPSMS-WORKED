-- 0072_fix_create_layout_draft_temp_table_collision.sql
--
-- Bug: create_layout_draft creates temp tables _draft_rack_map, _draft_face_map,
-- _draft_section_map with ON COMMIT DROP. When called more than once within the same
-- outer transaction (e.g. in a test's begin/rollback block), the second call that
-- reaches the copy path fails with "relation already exists" because ON COMMIT DROP
-- only fires at transaction commit/rollback, not function exit.
--
-- Fix: DROP TABLE IF EXISTS before each CREATE TEMP TABLE so subsequent calls
-- within the same transaction start with clean mapping tables.

create or replace function public.create_layout_draft(
  floor_uuid uuid,
  actor_uuid uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  existing_draft_uuid uuid;
  published_version   record;
  new_version_uuid    uuid;
  new_version_no      integer;
begin
  -- Auth guard: keep INVOKER-level permission check before we bypass RLS.
  if auth.uid() is not null and not public.can_manage_floor(floor_uuid) then
    raise exception 'Forbidden';
  end if;

  -- Return existing draft if one already exists (idempotent).
  select id
  into existing_draft_uuid
  from public.layout_versions
  where floor_id = floor_uuid
    and state = 'draft'
  limit 1;

  if existing_draft_uuid is not null then
    return existing_draft_uuid;
  end if;

  -- Find the latest published version to copy from.
  select *
  into published_version
  from public.layout_versions
  where floor_id = floor_uuid
    and state = 'published'
  order by version_no desc
  limit 1;

  -- Allocate the next version number.
  select coalesce(max(version_no), 0) + 1
  into new_version_no
  from public.layout_versions
  where floor_id = floor_uuid;

  -- Create the new draft version row.
  insert into public.layout_versions (
    floor_id,
    version_no,
    state,
    parent_published_version_id,
    created_by
  ) values (
    floor_uuid,
    new_version_no,
    'draft',
    published_version.id,
    actor_uuid
  )
  returning id into new_version_uuid;

  -- No published baseline to copy from → empty draft, we're done.
  if published_version.id is null then
    perform public.write_layout_event(
      'layout_draft_created', 'succeeded',
      new_version_uuid, 'layout_version', new_version_uuid,
      actor_uuid, jsonb_build_object('mode', 'empty')
    );
    return new_version_uuid;
  end if;

  -- ── set-based copy (replaces triple-nested cursor loops) ─────────────────
  --
  -- Temp tables store old→new UUID mappings so every entity layer can be
  -- copied in a single INSERT … SELECT rather than row-by-row.
  -- DROP IF EXISTS guards against re-entry within the same outer transaction
  -- (ON COMMIT DROP only fires at transaction end, not function exit).

  drop table if exists _draft_rack_map;
  create temp table _draft_rack_map(
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  drop table if exists _draft_face_map;
  create temp table _draft_face_map(
    old_id                  uuid primary key,
    new_id                  uuid not null,
    -- cached so step 5 never needs to self-join back to rack_faces
    old_mirror_source_face_id uuid
  ) on commit drop;

  drop table if exists _draft_section_map;
  create temp table _draft_section_map(
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  -- 1. Pre-generate new rack UUIDs.
  insert into _draft_rack_map (old_id, new_id)
  select id, gen_random_uuid()
  from public.racks
  where layout_version_id = published_version.id;

  -- 2. Bulk-insert draft racks.
  insert into public.racks (
    id, layout_version_id,
    display_code, kind, axis,
    x, y, total_length, depth, rotation_deg,
    state
  )
  select
    m.new_id, new_version_uuid,
    r.display_code, r.kind, r.axis,
    r.x, r.y, r.total_length, r.depth, r.rotation_deg,
    'draft'
  from public.racks r
  join _draft_rack_map m on m.old_id = r.id;

  -- 3. Pre-generate new rack_face UUIDs; cache mirror relationship for step 5.
  insert into _draft_face_map (old_id, new_id, old_mirror_source_face_id)
  select rf.id, gen_random_uuid(), rf.mirror_source_face_id
  from public.rack_faces rf
  join _draft_rack_map m on m.old_id = rf.rack_id;

  -- 4. Bulk-insert draft rack_faces.
  --    Faces that were mirrored are inserted with is_mirrored=false initially
  --    so the mirror-consistency trigger (DEFERRABLE INITIALLY DEFERRED) never
  --    sees (is_mirrored=true, mirror_source_face_id=null) — both fields are
  --    set atomically in step 5.
  insert into public.rack_faces (
    id, rack_id, side,
    enabled,
    slot_numbering_direction,
    is_mirrored, mirror_source_face_id,
    face_length
  )
  select
    fm.new_id, rm.new_id, rf.side,
    rf.enabled,
    rf.slot_numbering_direction,
    false, null,   -- safe starting state; step 5 restores mirrored faces
    rf.face_length
  from public.rack_faces rf
  join _draft_rack_map rm on rm.old_id = rf.rack_id
  join _draft_face_map fm on fm.old_id = rf.id;

  -- 5. Restore mirrored faces: set both is_mirrored and mirror_source_face_id
  --    atomically from _draft_face_map alone (no self-join on rack_faces).
  update public.rack_faces
  set
    is_mirrored           = true,
    mirror_source_face_id = fm_src.new_id
  from _draft_face_map fm
  join _draft_face_map fm_src on fm_src.old_id = fm.old_mirror_source_face_id
  where public.rack_faces.id = fm.new_id
    and fm.old_mirror_source_face_id is not null;

  -- 6. Pre-generate new rack_section UUIDs.
  insert into _draft_section_map (old_id, new_id)
  select rs.id, gen_random_uuid()
  from public.rack_sections rs
  join _draft_face_map fm on fm.old_id = rs.rack_face_id;

  -- 7. Bulk-insert draft rack_sections.
  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  select sm.new_id, fm.new_id, rs.ordinal, rs.length
  from public.rack_sections rs
  join _draft_face_map    fm on fm.old_id = rs.rack_face_id
  join _draft_section_map sm on sm.old_id = rs.id;

  -- 8. Bulk-insert rack_levels (no stable ID needed — auto-generated).
  insert into public.rack_levels (rack_section_id, ordinal, slot_count)
  select sm.new_id, rl.ordinal, rl.slot_count
  from public.rack_levels rl
  join _draft_section_map sm on sm.old_id = rl.rack_section_id;

  perform public.write_layout_event(
    'layout_draft_created', 'succeeded',
    new_version_uuid, 'layout_version', new_version_uuid,
    actor_uuid, jsonb_build_object('mode', 'cloned', 'parentPublishedVersionId', published_version.id)
  );

  return new_version_uuid;
end;
$$;
