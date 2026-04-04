-- 0081_layout_walls.sql
--
-- Narrow first slice for floor-level walls:
-- straight axis-aligned divider/barrier segments with optional semantic type
-- and a blocksRackPlacement flag. Walls are standalone layout entities and
-- are not owned by racks or rack sides.

create table if not exists public.layout_walls (
  id uuid primary key default gen_random_uuid(),
  layout_version_id uuid not null references public.layout_versions(id) on delete cascade,
  code text not null,
  name text,
  wall_type text check (
    wall_type is null or wall_type in ('generic', 'partition', 'safety', 'perimeter', 'custom')
  ),
  x1 numeric(12,3) not null,
  y1 numeric(12,3) not null,
  x2 numeric(12,3) not null,
  y2 numeric(12,3) not null,
  blocks_rack_placement boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint layout_walls_code_unique_per_version unique (layout_version_id, code),
  constraint layout_walls_code_present check (btrim(code) <> ''),
  constraint layout_walls_name_present check (name is null or btrim(name) <> ''),
  constraint layout_walls_axis_aligned check (x1 = x2 or y1 = y2),
  constraint layout_walls_nonzero_length check (x1 <> x2 or y1 <> y2)
);

create index if not exists layout_walls_layout_version_idx
  on public.layout_walls(layout_version_id);

drop trigger if exists layout_walls_set_updated_at on public.layout_walls;
create trigger layout_walls_set_updated_at
before update on public.layout_walls
for each row execute function public.set_updated_at();

alter table public.layout_walls enable row level security;

grant select, insert, update, delete on public.layout_walls to authenticated;

drop policy if exists layout_walls_select_scoped on public.layout_walls;
create policy layout_walls_select_scoped
on public.layout_walls
for select
to authenticated
using (public.can_access_layout_version(layout_version_id));

drop policy if exists layout_walls_insert_scoped on public.layout_walls;
create policy layout_walls_insert_scoped
on public.layout_walls
for insert
to authenticated
with check (public.can_manage_layout_version(layout_version_id));

drop policy if exists layout_walls_update_scoped on public.layout_walls;
create policy layout_walls_update_scoped
on public.layout_walls
for update
to authenticated
using (public.can_manage_layout_version(layout_version_id))
with check (public.can_manage_layout_version(layout_version_id));

drop policy if exists layout_walls_delete_scoped on public.layout_walls;
create policy layout_walls_delete_scoped
on public.layout_walls
for delete
to authenticated
using (public.can_manage_layout_version(layout_version_id));

create or replace function public.validate_layout_payload(layout_payload jsonb)
returns void
language plpgsql
as $$
declare
  rack_record jsonb;
  face_record jsonb;
  source_face jsonb;
  section_record jsonb;
  level_record jsonb;
  zone_record jsonb;
  wall_record jsonb;
  rack_ids text[];
  rack_display_codes text[];
  face_ids text[];
  face_sides text[];
  zone_ids text[];
  zone_codes text[];
  wall_ids text[];
  wall_codes text[];
begin
  if layout_payload is null or jsonb_typeof(layout_payload) <> 'object' then
    raise exception 'layout_payload must be a json object';
  end if;

  if nullif(layout_payload ->> 'layoutVersionId', '') is null then
    raise exception 'layoutVersionId is required in save_layout_draft payload';
  end if;

  if jsonb_typeof(layout_payload -> 'racks') <> 'array' then
    raise exception 'layout_payload.racks must be an array';
  end if;

  if layout_payload ? 'zones' and jsonb_typeof(layout_payload -> 'zones') <> 'array' then
    raise exception 'layout_payload.zones must be an array';
  end if;

  if layout_payload ? 'walls' and jsonb_typeof(layout_payload -> 'walls') <> 'array' then
    raise exception 'layout_payload.walls must be an array';
  end if;

  select array_agg(rack_item ->> 'id'), array_agg(rack_item ->> 'displayCode')
  into rack_ids, rack_display_codes
  from jsonb_array_elements(layout_payload -> 'racks') rack_item;

  if array_length(rack_ids, 1) is not null and array_length(rack_ids, 1) <> (
    select count(distinct rack_id) from unnest(rack_ids) rack_id
  ) then
    raise exception 'layout_payload contains duplicate rack ids';
  end if;

  if array_length(rack_display_codes, 1) is not null and array_length(rack_display_codes, 1) <> (
    select count(distinct rack_code) from unnest(rack_display_codes) rack_code
  ) then
    raise exception 'layout_payload contains duplicate rack display codes';
  end if;

  for rack_record in
    select value
    from jsonb_array_elements(layout_payload -> 'racks')
  loop
    if nullif(rack_record ->> 'id', '') is null then
      raise exception 'Each rack requires an id';
    end if;

    if jsonb_typeof(rack_record -> 'faces') <> 'array' then
      raise exception 'Rack % requires a faces array', rack_record ->> 'id';
    end if;

    select array_agg(face_item ->> 'id'), array_agg(face_item ->> 'side')
    into face_ids, face_sides
    from jsonb_array_elements(rack_record -> 'faces') face_item;

    if array_length(face_ids, 1) is not null and array_length(face_ids, 1) <> (
      select count(distinct face_id) from unnest(face_ids) face_id
    ) then
      raise exception 'Rack % contains duplicate face ids', rack_record ->> 'id';
    end if;

    if array_length(face_sides, 1) is not null and array_length(face_sides, 1) <> (
      select count(distinct face_side) from unnest(face_sides) face_side
    ) then
      raise exception 'Rack % contains duplicate face sides', rack_record ->> 'id';
    end if;

    for face_record in
      select value
      from jsonb_array_elements(rack_record -> 'faces')
    loop
      if nullif(face_record ->> 'faceLength', '') is not null and coalesce((face_record ->> 'faceLength')::numeric, 0) <= 0 then
        raise exception 'Face % requires positive faceLength when provided', face_record ->> 'id';
      end if;

      if coalesce((face_record ->> 'isMirrored')::boolean, false) then
        if face_record ->> 'side' <> 'B' then
          raise exception 'Mirrored face % must be side B', face_record ->> 'id';
        end if;

        if nullif(face_record ->> 'mirrorSourceFaceId', '') is null then
          raise exception 'Mirrored face % requires mirrorSourceFaceId', face_record ->> 'id';
        end if;

        select value
        into source_face
        from jsonb_array_elements(rack_record -> 'faces') value
        where value ->> 'id' = face_record ->> 'mirrorSourceFaceId'
        limit 1;

        if source_face is null then
          raise exception 'Mirrored face % references missing source face %', face_record ->> 'id', face_record ->> 'mirrorSourceFaceId';
        end if;

        if source_face ->> 'side' <> 'A' then
          raise exception 'Mirrored face % must reference side A source face', face_record ->> 'id';
        end if;

        if source_face ->> 'id' = face_record ->> 'id' then
          raise exception 'Face % cannot mirror itself', face_record ->> 'id';
        end if;
      elsif nullif(face_record ->> 'mirrorSourceFaceId', '') is not null then
        raise exception 'Face % has mirrorSourceFaceId while isMirrored is false', face_record ->> 'id';
      end if;

      if jsonb_typeof(face_record -> 'sections') <> 'array' then
        raise exception 'Face % requires a sections array', face_record ->> 'id';
      end if;

      for section_record in
        select value
        from jsonb_array_elements(face_record -> 'sections')
      loop
        if nullif(section_record ->> 'id', '') is null then
          raise exception 'Each section requires an id';
        end if;

        if coalesce((section_record ->> 'length')::numeric, 0) <= 0 then
          raise exception 'Section % requires positive length', section_record ->> 'id';
        end if;

        if jsonb_typeof(section_record -> 'levels') <> 'array' then
          raise exception 'Section % requires a levels array', section_record ->> 'id';
        end if;

        for level_record in
          select value
          from jsonb_array_elements(section_record -> 'levels')
        loop
          if nullif(level_record ->> 'id', '') is null then
            raise exception 'Each level requires an id';
          end if;

          if coalesce((level_record ->> 'slotCount')::integer, 0) < 1 then
            raise exception 'Level % requires slotCount >= 1', level_record ->> 'id';
          end if;
        end loop;
      end loop;
    end loop;
  end loop;

  select array_agg(zone_item ->> 'id'), array_agg(zone_item ->> 'code')
  into zone_ids, zone_codes
  from jsonb_array_elements(coalesce(layout_payload -> 'zones', '[]'::jsonb)) zone_item;

  if array_length(zone_ids, 1) is not null and array_length(zone_ids, 1) <> (
    select count(distinct zone_id) from unnest(zone_ids) zone_id
  ) then
    raise exception 'layout_payload contains duplicate zone ids';
  end if;

  if array_length(zone_codes, 1) is not null and array_length(zone_codes, 1) <> (
    select count(distinct zone_code) from unnest(zone_codes) zone_code
  ) then
    raise exception 'layout_payload contains duplicate zone codes';
  end if;

  for zone_record in
    select value
    from jsonb_array_elements(coalesce(layout_payload -> 'zones', '[]'::jsonb))
  loop
    if nullif(zone_record ->> 'id', '') is null then
      raise exception 'Each zone requires an id';
    end if;

    if nullif(zone_record ->> 'code', '') is null then
      raise exception 'Zone % requires a code', zone_record ->> 'id';
    end if;

    if nullif(zone_record ->> 'name', '') is null then
      raise exception 'Zone % requires a name', zone_record ->> 'id';
    end if;

    if nullif(zone_record ->> 'color', '') is null then
      raise exception 'Zone % requires a color', zone_record ->> 'id';
    end if;

    if nullif(zone_record ->> 'category', '') is not null
      and zone_record ->> 'category' not in ('generic', 'storage', 'staging', 'packing', 'receiving', 'custom')
    then
      raise exception 'Zone % has unsupported category %', zone_record ->> 'id', zone_record ->> 'category';
    end if;

    if coalesce((zone_record ->> 'width')::numeric, 0) <= 0 then
      raise exception 'Zone % requires positive width', zone_record ->> 'id';
    end if;

    if coalesce((zone_record ->> 'height')::numeric, 0) <= 0 then
      raise exception 'Zone % requires positive height', zone_record ->> 'id';
    end if;
  end loop;

  select array_agg(wall_item ->> 'id'), array_agg(wall_item ->> 'code')
  into wall_ids, wall_codes
  from jsonb_array_elements(coalesce(layout_payload -> 'walls', '[]'::jsonb)) wall_item;

  if array_length(wall_ids, 1) is not null and array_length(wall_ids, 1) <> (
    select count(distinct wall_id) from unnest(wall_ids) wall_id
  ) then
    raise exception 'layout_payload contains duplicate wall ids';
  end if;

  if array_length(wall_codes, 1) is not null and array_length(wall_codes, 1) <> (
    select count(distinct wall_code) from unnest(wall_codes) wall_code
  ) then
    raise exception 'layout_payload contains duplicate wall codes';
  end if;

  for wall_record in
    select value
    from jsonb_array_elements(coalesce(layout_payload -> 'walls', '[]'::jsonb))
  loop
    if nullif(wall_record ->> 'id', '') is null then
      raise exception 'Each wall requires an id';
    end if;

    if nullif(wall_record ->> 'code', '') is null then
      raise exception 'Wall % requires a code', wall_record ->> 'id';
    end if;

    if wall_record ? 'name'
      and wall_record ->> 'name' is not null
      and nullif(wall_record ->> 'name', '') is null
    then
      raise exception 'Wall % name must be non-empty when provided', wall_record ->> 'id';
    end if;

    if nullif(wall_record ->> 'wallType', '') is not null
      and wall_record ->> 'wallType' not in ('generic', 'partition', 'safety', 'perimeter', 'custom')
    then
      raise exception 'Wall % has unsupported wallType %', wall_record ->> 'id', wall_record ->> 'wallType';
    end if;

    if coalesce((wall_record ->> 'blocksRackPlacement')::boolean, false) not in (true, false) then
      raise exception 'Wall % requires blocksRackPlacement boolean', wall_record ->> 'id';
    end if;

    if (wall_record ->> 'x1')::numeric <> (wall_record ->> 'x2')::numeric
      and (wall_record ->> 'y1')::numeric <> (wall_record ->> 'y2')::numeric
    then
      raise exception 'Wall % must be axis-aligned', wall_record ->> 'id';
    end if;

    if (wall_record ->> 'x1')::numeric = (wall_record ->> 'x2')::numeric
      and (wall_record ->> 'y1')::numeric = (wall_record ->> 'y2')::numeric
    then
      raise exception 'Wall % must have non-zero length', wall_record ->> 'id';
    end if;
  end loop;
end;
$$;

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
       jsonb_array_elements(r -> 'faces') as f;

  update public.rack_faces rf
  set
    is_mirrored = true,
    mirror_source_face_id = (f ->> 'mirrorSourceFaceId')::uuid
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces') as f
  where rf.id = (f ->> 'id')::uuid
    and coalesce((f ->> 'isMirrored')::boolean, false) = true
    and nullif(f ->> 'mirrorSourceFaceId', '') is not null;

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  select
    (s ->> 'id')::uuid,
    (f ->> 'id')::uuid,
    (s ->> 'ordinal')::integer,
    (s ->> 'length')::numeric
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces') as f,
       jsonb_array_elements(f -> 'sections') as s;

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  select
    (l ->> 'id')::uuid,
    (s ->> 'id')::uuid,
    (l ->> 'ordinal')::integer,
    (l ->> 'slotCount')::integer
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

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
  select fm.new_id, rm.new_id, rf.side, rf.enabled, rf.slot_numbering_direction, false, null, rf.face_length
  from public.rack_faces rf
  join _draft_rack_map rm on rm.old_id = rf.rack_id
  join _draft_face_map fm on fm.old_id = rf.id;

  update public.rack_faces
  set is_mirrored = true, mirror_source_face_id = fm_src.new_id
  from _draft_face_map fm join _draft_face_map fm_src on fm_src.old_id = fm.old_mirror_source_face_id
  where public.rack_faces.id = fm.new_id and fm.old_mirror_source_face_id is not null;

  insert into _draft_section_map (old_id, new_id)
  select rs.id, gen_random_uuid() from public.rack_sections rs join _draft_face_map fm on fm.old_id = rs.rack_face_id;

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  select sm.new_id, fm.new_id, rs.ordinal, rs.length
  from public.rack_sections rs
  join _draft_face_map fm on fm.old_id = rs.rack_face_id
  join _draft_section_map sm on sm.old_id = rs.id;

  insert into public.rack_levels (rack_section_id, ordinal, slot_count)
  select sm.new_id, rl.ordinal, rl.slot_count
  from public.rack_levels rl join _draft_section_map sm on sm.old_id = rl.rack_section_id;

  perform public.write_layout_event(
    'layout_draft_created', 'succeeded',
    new_version_uuid, 'layout_version', new_version_uuid,
    actor_uuid, jsonb_build_object('mode', 'cloned', 'parentPublishedVersionId', published_version.id)
  );

  return new_version_uuid;
end;
$$;
