-- 0016_remove_rack_face_anchor.sql

alter table public.rack_faces
  drop column if exists anchor;

create or replace function public.create_layout_draft(floor_uuid uuid, actor_uuid uuid default null)
returns uuid
language plpgsql
as $$
declare
  existing_draft_uuid uuid;
  published_version record;
  new_version_uuid uuid;
  new_version_no integer;
  rack_row record;
  old_face_id uuid;
  new_face_id uuid;
  section_row record;
  old_section_id uuid;
  new_section_id uuid;
  face_id_map jsonb := '{}'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(floor_uuid::text, 17));

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
  order by version_no desc
  limit 1;

  select coalesce(max(version_no), 0) + 1
  into new_version_no
  from public.layout_versions
  where floor_id = floor_uuid;

  insert into public.layout_versions (floor_id, version_no, state, parent_published_version_id, created_by)
  values (floor_uuid, new_version_no, 'draft', published_version.id, actor_uuid)
  returning id into new_version_uuid;

  if published_version.id is null then
    perform public.write_layout_event('layout_draft_created', 'succeeded', new_version_uuid, 'layout_version', new_version_uuid, actor_uuid, jsonb_build_object('mode', 'empty'));
    return new_version_uuid;
  end if;

  for rack_row in
    select * from public.racks where layout_version_id = published_version.id order by display_code
  loop
    insert into public.racks (layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
    values (new_version_uuid, rack_row.display_code, rack_row.kind, rack_row.axis, rack_row.x, rack_row.y, rack_row.total_length, rack_row.depth, rack_row.rotation_deg, 'draft')
    returning id into rack_row.id;

    for old_face_id in
      select rf.id
      from public.rack_faces rf
      where rf.rack_id = (
        select id
        from public.racks
        where layout_version_id = published_version.id and display_code = rack_row.display_code
        limit 1
      )
      order by rf.side
    loop
      insert into public.rack_faces (rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id)
      select rack_row.id, rf.side, rf.enabled, rf.slot_numbering_direction, rf.is_mirrored, null
      from public.rack_faces rf
      where rf.id = old_face_id
      returning id into new_face_id;

      face_id_map := jsonb_set(face_id_map, array[old_face_id::text], to_jsonb(new_face_id::text));

      for section_row in
        select * from public.rack_sections rs where rs.rack_face_id = old_face_id order by rs.ordinal
      loop
        old_section_id := section_row.id;

        insert into public.rack_sections (rack_face_id, ordinal, length)
        values (new_face_id, section_row.ordinal, section_row.length)
        returning id into new_section_id;

        insert into public.rack_levels (rack_section_id, ordinal, slot_count)
        select new_section_id, rl.ordinal, rl.slot_count
        from public.rack_levels rl
        where rl.rack_section_id = old_section_id
        order by rl.ordinal;
      end loop;
    end loop;
  end loop;

  update public.rack_faces rf
  set mirror_source_face_id = (face_id_map ->> old_rf.mirror_source_face_id::text)::uuid
  from public.rack_faces old_rf
  where rf.id = (face_id_map ->> old_rf.id::text)::uuid
    and old_rf.mirror_source_face_id is not null;

  perform public.write_layout_event('layout_draft_created', 'succeeded', new_version_uuid, 'layout_version', new_version_uuid, actor_uuid, jsonb_build_object('mode', 'cloned', 'parentPublishedVersionId', published_version.id));

  return new_version_uuid;
end;
$$;

create or replace function public.save_layout_draft(layout_payload jsonb, actor_uuid uuid default null)
returns uuid
language plpgsql
as $$
declare
  layout_version_uuid uuid := (layout_payload ->> 'layoutVersionId')::uuid;
  rack_record jsonb;
  face_record jsonb;
  section_record jsonb;
  level_record jsonb;
  rack_uuid uuid;
  face_uuid uuid;
  section_uuid uuid;
begin
  if layout_version_uuid is null then
    raise exception 'layoutVersionId is required in save_layout_draft payload';
  end if;

  if not exists (
    select 1 from public.layout_versions where id = layout_version_uuid and state = 'draft'
  ) then
    raise exception 'Layout version % is not an active draft.', layout_version_uuid;
  end if;

  perform public.validate_layout_payload(layout_payload);

  delete from public.cells where layout_version_id = layout_version_uuid;

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

  delete from public.rack_faces
  where rack_id in (
    select id from public.racks where layout_version_id = layout_version_uuid
  );

  delete from public.racks
  where layout_version_id = layout_version_uuid;

  for rack_record in
    select value from jsonb_array_elements(layout_payload -> 'racks')
  loop
    insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
    values (
      (rack_record ->> 'id')::uuid,
      layout_version_uuid,
      rack_record ->> 'displayCode',
      rack_record ->> 'kind',
      rack_record ->> 'axis',
      (rack_record ->> 'x')::numeric,
      (rack_record ->> 'y')::numeric,
      (rack_record ->> 'totalLength')::numeric,
      (rack_record ->> 'depth')::numeric,
      (rack_record ->> 'rotationDeg')::integer,
      'draft'
    )
    returning id into rack_uuid;

    for face_record in
      select value from jsonb_array_elements(rack_record -> 'faces')
    loop
      insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id)
      values (
        (face_record ->> 'id')::uuid,
        rack_uuid,
        face_record ->> 'side',
        coalesce((face_record ->> 'enabled')::boolean, true),
        face_record ->> 'slotNumberingDirection',
        coalesce((face_record ->> 'isMirrored')::boolean, false),
        nullif(face_record ->> 'mirrorSourceFaceId', '')::uuid
      )
      returning id into face_uuid;

      for section_record in
        select value from jsonb_array_elements(face_record -> 'sections')
      loop
        insert into public.rack_sections (id, rack_face_id, ordinal, length)
        values (
          (section_record ->> 'id')::uuid,
          face_uuid,
          (section_record ->> 'ordinal')::integer,
          (section_record ->> 'length')::numeric
        )
        returning id into section_uuid;

        for level_record in
          select value from jsonb_array_elements(section_record -> 'levels')
        loop
          insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
          values (
            (level_record ->> 'id')::uuid,
            section_uuid,
            (level_record ->> 'ordinal')::integer,
            (level_record ->> 'slotCount')::integer
          );
        end loop;
      end loop;
    end loop;
  end loop;

  perform public.write_layout_event('layout_draft_saved', 'succeeded', layout_version_uuid, 'layout_version', layout_version_uuid, actor_uuid, jsonb_build_object('rackCount', jsonb_array_length(layout_payload -> 'racks')));

  return layout_version_uuid;
exception
  when others then
    if layout_version_uuid is not null then
      perform public.write_layout_event('layout_draft_saved', 'failed', layout_version_uuid, 'layout_version', layout_version_uuid, actor_uuid, jsonb_build_object('error', sqlerrm));
    end if;
    raise;
end;
$$;
