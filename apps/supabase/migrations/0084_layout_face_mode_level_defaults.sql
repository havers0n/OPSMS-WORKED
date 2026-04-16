begin;

alter table public.rack_faces
  add column if not exists face_mode text;

alter table public.rack_levels
  add column if not exists structural_default_role text;

update public.rack_faces
set face_mode = case when is_mirrored then 'mirrored' else 'independent' end
where face_mode is null;

update public.rack_levels
set structural_default_role = 'none'
where structural_default_role is null;

alter table public.rack_faces
  alter column face_mode set default 'independent',
  alter column face_mode set not null;

alter table public.rack_levels
  alter column structural_default_role set default 'none',
  alter column structural_default_role set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rack_faces_face_mode_check'
      and conrelid = 'public.rack_faces'::regclass
  ) then
    alter table public.rack_faces
      add constraint rack_faces_face_mode_check
      check (face_mode = any (array['mirrored'::text, 'independent'::text]));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rack_levels_structural_default_role_check'
      and conrelid = 'public.rack_levels'::regclass
  ) then
    alter table public.rack_levels
      add constraint rack_levels_structural_default_role_check
      check (structural_default_role = any (array['primary_pick'::text, 'reserve'::text, 'none'::text]));
  end if;
end
$$;

create or replace function public.sync_rack_face_mode_compat() returns trigger
    language plpgsql
as $$
begin
  -- Backward-compat path: legacy writers may omit face_mode and rely on mirror fields.
  -- Since face_mode has a DB default, infer mirrored mode from a coherent legacy tuple.
  if new.face_mode is null
     or (
       tg_op = 'INSERT'
       and
       new.face_mode = 'independent'
       and coalesce(new.is_mirrored, false)
       and new.mirror_source_face_id is not null
     ) then
    new.face_mode := case when coalesce(new.is_mirrored, false) then 'mirrored' else 'independent' end;
  end if;

  if new.face_mode = 'mirrored' then
    new.is_mirrored := true;
  elsif new.face_mode = 'independent' then
    new.is_mirrored := false;
    new.mirror_source_face_id := null;
  else
    raise exception 'Face % has unsupported face_mode %.', new.id, new.face_mode;
  end if;

  return new;
end;
$$;

drop trigger if exists rack_faces_sync_face_mode_compat on public.rack_faces;

create trigger rack_faces_sync_face_mode_compat
before insert or update of face_mode, is_mirrored, mirror_source_face_id
on public.rack_faces
for each row
execute function public.sync_rack_face_mode_compat();

create or replace function public.validate_rack_face_mirror_consistency() returns trigger
    language plpgsql
as $$
declare
  source_face record;
begin
  if new.face_mode = 'independent' then
    if new.mirror_source_face_id is not null then
      raise exception 'Face % has mirror_source_face_id but face_mode is independent.', new.id;
    end if;

    if new.is_mirrored is true then
      raise exception 'Face % has is_mirrored=true but face_mode is independent.', new.id;
    end if;

    return new;
  end if;

  if new.face_mode <> 'mirrored' then
    raise exception 'Face % has unsupported face_mode %.', new.id, new.face_mode;
  end if;

  if new.mirror_source_face_id is null then
    raise exception 'Face % is mirrored but mirror_source_face_id is null.', new.id;
  end if;

  if new.side <> 'B' then
    raise exception 'Only side B may be mirrored. Face % has side %.', new.id, new.side;
  end if;

  if new.mirror_source_face_id = new.id then
    raise exception 'Face % cannot mirror itself.', new.id;
  end if;

  select rf.id, rf.rack_id, rf.side
  into source_face
  from public.rack_faces rf
  where rf.id = new.mirror_source_face_id;

  if source_face.id is null then
    raise exception 'Face % references missing mirror source %.', new.id, new.mirror_source_face_id;
  end if;

  if source_face.rack_id <> new.rack_id then
    raise exception 'Face % references mirror source % from another rack.', new.id, new.mirror_source_face_id;
  end if;

  if source_face.side <> 'A' then
    raise exception 'Mirrored face % must reference side A source, got side %.', new.id, source_face.side;
  end if;

  if new.is_mirrored is distinct from true then
    raise exception 'Face % must keep legacy is_mirrored=true for mirrored mode.', new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists rack_faces_mirror_consistency_trigger on public.rack_faces;

create constraint trigger rack_faces_mirror_consistency_trigger
after insert or update of rack_id, side, face_mode, is_mirrored, mirror_source_face_id
on public.rack_faces
deferrable initially deferred
for each row
execute function public.validate_rack_face_mirror_consistency();

create or replace function public.create_layout_draft(floor_uuid uuid, actor_uuid uuid default null::uuid) returns uuid
    language plpgsql security definer
    set search_path to 'public', 'auth'
as $$
declare
  existing_draft_uuid uuid;
  published_version   record;
  new_version_uuid    uuid;
  new_version_no      integer;
begin
  if auth.uid() is not null and not public.can_manage_floor(floor_uuid) then
    raise exception 'Forbidden';
  end if;

  select id into existing_draft_uuid
  from public.layout_versions
  where floor_id = floor_uuid and state = 'draft'
  limit 1;

  if existing_draft_uuid is not null then
    return existing_draft_uuid;
  end if;

  select * into published_version
  from public.layout_versions
  where floor_id = floor_uuid and state = 'published'
  order by version_no desc limit 1;

  select coalesce(max(version_no), 0) + 1 into new_version_no
  from public.layout_versions where floor_id = floor_uuid;

  insert into public.layout_versions (floor_id, version_no, state, parent_published_version_id, created_by)
  values (floor_uuid, new_version_no, 'draft', published_version.id, actor_uuid)
  returning id into new_version_uuid;

  if published_version.id is null then
    perform public.write_layout_event(
      'layout_draft_created', 'succeeded',
      new_version_uuid, 'layout_version', new_version_uuid,
      actor_uuid, jsonb_build_object('mode', 'empty')
    );
    return new_version_uuid;
  end if;

  insert into public.layout_zones (
    id, layout_version_id, code, name, category, color, x, y, width, height
  )
  select
    gen_random_uuid(),
    new_version_uuid,
    z.code,
    z.name,
    z.category,
    z.color,
    z.x,
    z.y,
    z.width,
    z.height
  from public.layout_zones z
  where z.layout_version_id = published_version.id;

  insert into public.layout_walls (
    id, layout_version_id, code, name, wall_type,
    x1, y1, x2, y2, blocks_rack_placement
  )
  select
    gen_random_uuid(),
    new_version_uuid,
    w.code,
    w.name,
    w.wall_type,
    w.x1,
    w.y1,
    w.x2,
    w.y2,
    w.blocks_rack_placement
  from public.layout_walls w
  where w.layout_version_id = published_version.id;

  drop table if exists _draft_rack_map;
  create temp table _draft_rack_map(old_id uuid primary key, new_id uuid not null) on commit drop;
  drop table if exists _draft_face_map;
  create temp table _draft_face_map(old_id uuid primary key, new_id uuid not null, old_mirror_source_face_id uuid) on commit drop;
  drop table if exists _draft_section_map;
  create temp table _draft_section_map(old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _draft_rack_map (old_id, new_id)
  select id, gen_random_uuid() from public.racks where layout_version_id = published_version.id;

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  select m.new_id, new_version_uuid, r.display_code, r.kind, r.axis, r.x, r.y, r.total_length, r.depth, r.rotation_deg, 'draft'
  from public.racks r join _draft_rack_map m on m.old_id = r.id;

  insert into _draft_face_map (old_id, new_id, old_mirror_source_face_id)
  select rf.id, gen_random_uuid(), rf.mirror_source_face_id
  from public.rack_faces rf join _draft_rack_map m on m.old_id = rf.rack_id;

  insert into public.rack_faces (
    id, rack_id, side, enabled, slot_numbering_direction,
    face_mode, is_mirrored, mirror_source_face_id, face_length
  )
  select
    fm.new_id,
    rm.new_id,
    rf.side,
    rf.enabled,
    rf.slot_numbering_direction,
    coalesce(rf.face_mode, case when rf.is_mirrored then 'mirrored' else 'independent' end),
    false,
    null,
    rf.face_length
  from public.rack_faces rf
  join _draft_rack_map rm on rm.old_id = rf.rack_id
  join _draft_face_map fm on fm.old_id = rf.id;

  update public.rack_faces
  set
    face_mode = 'mirrored',
    is_mirrored = true,
    mirror_source_face_id = fm_src.new_id
  from _draft_face_map fm join _draft_face_map fm_src on fm_src.old_id = fm.old_mirror_source_face_id
  where public.rack_faces.id = fm.new_id and fm.old_mirror_source_face_id is not null;

  insert into _draft_section_map (old_id, new_id)
  select rs.id, gen_random_uuid() from public.rack_sections rs join _draft_face_map fm on fm.old_id = rs.rack_face_id;

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  select sm.new_id, fm.new_id, rs.ordinal, rs.length
  from public.rack_sections rs
  join _draft_face_map fm on fm.old_id = rs.rack_face_id
  join _draft_section_map sm on sm.old_id = rs.id;

  insert into public.rack_levels (rack_section_id, ordinal, slot_count, structural_default_role)
  select sm.new_id, rl.ordinal, rl.slot_count, coalesce(rl.structural_default_role, 'none')
  from public.rack_levels rl join _draft_section_map sm on sm.old_id = rl.rack_section_id;

  perform public.write_layout_event(
    'layout_draft_created', 'succeeded',
    new_version_uuid, 'layout_version', new_version_uuid,
    actor_uuid, jsonb_build_object('mode', 'cloned', 'parentPublishedVersionId', published_version.id)
  );

  return new_version_uuid;
end;
$$;

create or replace function public.get_layout_bundle(layout_version_uuid uuid) returns jsonb
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
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
      'zones', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',       z.id,
          'code',     z.code,
          'name',     z.name,
          'category', z.category,
          'color',    z.color,
          'x',        z.x,
          'y',        z.y,
          'width',    z.width,
          'height',   z.height
        ) order by z.code)
        from public.layout_zones z
        where z.layout_version_id = lv.id
      ), '[]'::jsonb),
      'walls', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',                  w.id,
          'code',                w.code,
          'name',                w.name,
          'wallType',            w.wall_type,
          'x1',                  w.x1,
          'y1',                  w.y1,
          'x2',                  w.x2,
          'y2',                  w.y2,
          'blocksRackPlacement', w.blocks_rack_placement
        ) order by w.code)
        from public.layout_walls w
        where w.layout_version_id = lv.id
      ), '[]'::jsonb),
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
              'relationshipMode',       coalesce(rf.face_mode, case when rf.is_mirrored then 'mirrored' else 'independent' end),
              'isMirrored',             rf.is_mirrored,
              'mirrorSourceFaceId',     rf.mirror_source_face_id,
              'sections', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'id',      rs.id,
                  'ordinal', rs.ordinal,
                  'length',  rs.length,
                  'levels', coalesce((
                    select jsonb_agg(jsonb_build_object(
                      'id',                  rl.id,
                      'ordinal',             rl.ordinal,
                      'slotCount',           rl.slot_count,
                      'structuralDefaultRole', coalesce(rl.structural_default_role, 'none')
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

create or replace function public.save_layout_draft(layout_payload jsonb, actor_uuid uuid default null::uuid) returns jsonb
    language plpgsql security definer
    set search_path to 'public', 'pg_temp'
as $$
declare
  layout_version_uuid   uuid    := (layout_payload ->> 'layoutVersionId')::uuid;
  client_draft_version  integer := (layout_payload ->> 'draftVersion')::integer;
  current_draft_version integer;
  new_draft_version     integer;
begin
  if layout_version_uuid is null then
    raise exception 'layoutVersionId is required in save_layout_draft payload';
  end if;

  select draft_version
    into current_draft_version
  from public.layout_versions
  where id = layout_version_uuid and state = 'draft'
  for update;

  if not found then
    raise exception 'Layout version % is not an active draft.', layout_version_uuid;
  end if;

  if client_draft_version is not null
    and current_draft_version is distinct from client_draft_version
  then
    raise exception 'DRAFT_CONFLICT';
  end if;

  if not public.can_manage_layout_version(layout_version_uuid) then
    raise exception 'Permission denied for layout version %', layout_version_uuid;
  end if;

  perform public.validate_layout_payload(layout_payload);

  delete from public.layout_walls
  where layout_version_id = layout_version_uuid;

  delete from public.layout_zones
  where layout_version_id = layout_version_uuid;

  delete from public.cells
  where layout_version_id = layout_version_uuid;

  delete from public.rack_levels
  where rack_section_id in (
    select rs.id
    from public.rack_sections rs
    join public.rack_faces rf on rf.id = rs.rack_face_id
    join public.racks r on r.id = rf.rack_id
    where r.layout_version_id = layout_version_uuid
  );

  delete from public.rack_sections
  where rack_face_id in (
    select rf.id
    from public.rack_faces rf
    join public.racks r on r.id = rf.rack_id
    where r.layout_version_id = layout_version_uuid
  );

  set constraints rack_faces_mirror_consistency_trigger deferred;

  delete from public.rack_faces
  where rack_id in (
    select id from public.racks where layout_version_id = layout_version_uuid
  );

  delete from public.racks
  where layout_version_id = layout_version_uuid;

  insert into public.layout_zones (
    id, layout_version_id, code, name, category,
    color, x, y, width, height
  )
  select
    (z ->> 'id')::uuid,
    layout_version_uuid,
    z ->> 'code',
    z ->> 'name',
    nullif(z ->> 'category', ''),
    z ->> 'color',
    (z ->> 'x')::numeric,
    (z ->> 'y')::numeric,
    (z ->> 'width')::numeric,
    (z ->> 'height')::numeric
  from jsonb_array_elements(coalesce(layout_payload -> 'zones', '[]'::jsonb)) as z;

  insert into public.layout_walls (
    id, layout_version_id, code, name, wall_type,
    x1, y1, x2, y2, blocks_rack_placement
  )
  select
    (w ->> 'id')::uuid,
    layout_version_uuid,
    w ->> 'code',
    nullif(w ->> 'name', ''),
    nullif(w ->> 'wallType', ''),
    (w ->> 'x1')::numeric,
    (w ->> 'y1')::numeric,
    (w ->> 'x2')::numeric,
    (w ->> 'y2')::numeric,
    coalesce((w ->> 'blocksRackPlacement')::boolean, true)
  from jsonb_array_elements(coalesce(layout_payload -> 'walls', '[]'::jsonb)) as w;

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

  insert into public.rack_faces (
    id, rack_id, side, enabled,
    slot_numbering_direction, face_length,
    face_mode, is_mirrored, mirror_source_face_id
  )
  select
    (f ->> 'id')::uuid,
    (r ->> 'id')::uuid,
    f ->> 'side',
    coalesce((f ->> 'enabled')::boolean, true),
    f ->> 'slotNumberingDirection',
    nullif(f ->> 'faceLength', '')::numeric,
    case
      when coalesce(nullif(f ->> 'relationshipMode', ''), case when coalesce((f ->> 'isMirrored')::boolean, false) then 'mirrored' else 'independent' end) = 'mirrored'
      then 'mirrored'
      else 'independent'
    end,
    case
      when coalesce(nullif(f ->> 'relationshipMode', ''), case when coalesce((f ->> 'isMirrored')::boolean, false) then 'mirrored' else 'independent' end) = 'mirrored'
      then true
      else false
    end,
    case
      when coalesce(nullif(f ->> 'relationshipMode', ''), case when coalesce((f ->> 'isMirrored')::boolean, false) then 'mirrored' else 'independent' end) = 'mirrored'
      then (f ->> 'mirrorSourceFaceId')::uuid
      else null
    end
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces') as f;

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  select
    (s ->> 'id')::uuid,
    (f ->> 'id')::uuid,
    (s ->> 'ordinal')::integer,
    (s ->> 'length')::numeric
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces') as f,
       jsonb_array_elements(f -> 'sections') as s;

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count, structural_default_role)
  select
    (l ->> 'id')::uuid,
    (s ->> 'id')::uuid,
    (l ->> 'ordinal')::integer,
    (l ->> 'slotCount')::integer,
    coalesce(nullif(l ->> 'structuralDefaultRole', ''), 'none')
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces') as f,
       jsonb_array_elements(f -> 'sections') as s,
       jsonb_array_elements(s -> 'levels') as l;

  update public.layout_versions
  set draft_version = draft_version + 1,
      updated_at = timezone('utc', now())
  where id = layout_version_uuid
  returning draft_version into new_draft_version;

  perform public.write_layout_event(
    'layout_draft_saved', 'succeeded',
    layout_version_uuid, 'layout_version', layout_version_uuid,
    actor_uuid,
    jsonb_build_object(
      'rackCount', jsonb_array_length(layout_payload -> 'racks'),
      'zoneCount', jsonb_array_length(coalesce(layout_payload -> 'zones', '[]'::jsonb)),
      'wallCount', jsonb_array_length(coalesce(layout_payload -> 'walls', '[]'::jsonb)),
      'draftVersion', new_draft_version
    )
  );

  return jsonb_build_object(
    'layoutVersionId', layout_version_uuid,
    'draftVersion', new_draft_version
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

commit;
