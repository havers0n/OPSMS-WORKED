-- 0017_promote_rack_face_length.sql

alter table public.rack_faces
  add column if not exists face_length numeric(12,3);

alter table public.rack_faces
  drop constraint if exists rack_faces_face_length_positive;

alter table public.rack_faces
  add constraint rack_faces_face_length_positive
  check (face_length is null or face_length > 0);

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
  rack_ids text[];
  rack_display_codes text[];
  face_ids text[];
  face_sides text[];
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
end;
$$;

create or replace function public.validate_layout_version(layout_version_uuid uuid)
returns jsonb
language plpgsql
as $$
declare
  issue_count integer := 0;
  issues jsonb := '[]'::jsonb;
  duplicate_count integer := 0;
  rack_record record;
  face_record record;
  section_length_sum numeric;
  expected_face_length numeric;
  source_face record;
  rack_kind text;
begin
  for rack_record in
    select r.id, r.display_code, r.total_length, r.kind
    from public.racks r
    where r.layout_version_id = layout_version_uuid
  loop
    rack_kind := rack_record.kind;

    if not exists (
      select 1
      from public.rack_faces rf
      where rf.rack_id = rack_record.id
        and rf.side = 'A'
        and rf.enabled = true
    ) then
      issues := issues || jsonb_build_object('code', 'rack.face_a_required', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s must have an enabled Face A.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    if not exists (
      select 1 from public.rack_faces rf where rf.rack_id = rack_record.id and rf.enabled = true
    ) then
      issues := issues || jsonb_build_object('code', 'rack.enabled_face_required', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s must have at least one enabled face.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    if rack_kind = 'single' and exists (
      select 1 from public.rack_faces rf
      where rf.rack_id = rack_record.id and rf.side = 'B' and rf.enabled = true
        and (rf.is_mirrored = true or exists (select 1 from public.rack_sections rs where rs.rack_face_id = rf.id))
    ) then
      issues := issues || jsonb_build_object('code', 'rack.single_face_b_forbidden', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s is single but Face B is configured.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    if rack_kind = 'paired' and not exists (
      select 1 from public.rack_faces rf where rf.rack_id = rack_record.id and rf.side = 'B'
    ) then
      issues := issues || jsonb_build_object('code', 'rack.paired_face_b_required', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s is paired but Face B is missing.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    for face_record in
      select rf.* from public.rack_faces rf where rf.rack_id = rack_record.id
    loop
      if face_record.is_mirrored = true then
        if face_record.mirror_source_face_id is null then
          issues := issues || jsonb_build_object('code', 'rack_face.mirror_source_required', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s is mirrored but has no source face.', face_record.side, rack_record.display_code));
          issue_count := issue_count + 1;
        elsif face_record.mirror_source_face_id = face_record.id then
          issues := issues || jsonb_build_object('code', 'rack_face.mirror_self_reference', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s cannot mirror itself.', face_record.side, rack_record.display_code));
          issue_count := issue_count + 1;
        else
          select rf.* into source_face from public.rack_faces rf where rf.id = face_record.mirror_source_face_id;

          if source_face.id is null then
            issues := issues || jsonb_build_object('code', 'rack_face.mirror_source_missing', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s references a missing mirror source.', face_record.side, rack_record.display_code));
            issue_count := issue_count + 1;
          elsif source_face.rack_id <> rack_record.id then
            issues := issues || jsonb_build_object('code', 'rack_face.mirror_cross_rack', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s cannot mirror a face from another rack.', face_record.side, rack_record.display_code));
            issue_count := issue_count + 1;
          elsif source_face.side <> 'A' or face_record.side <> 'B' then
            issues := issues || jsonb_build_object('code', 'rack_face.mirror_side_invalid', 'severity', 'error', 'entityId', face_record.id, 'message', format('Mirrored face configuration on rack %s must be B -> A.', rack_record.display_code));
            issue_count := issue_count + 1;
          end if;
        end if;
      elsif face_record.mirror_source_face_id is not null then
        issues := issues || jsonb_build_object('code', 'rack_face.mirror_source_without_flag', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s has a mirror source but isMirrored is false.', face_record.side, rack_record.display_code));
        issue_count := issue_count + 1;
      end if;

      if face_record.enabled = false and (face_record.is_mirrored = true or exists (select 1 from public.rack_sections rs where rs.rack_face_id = face_record.id)) then
        issues := issues || jsonb_build_object('code', 'rack_face.disabled_configured', 'severity', 'warning', 'entityId', face_record.id, 'message', format('Disabled face %s on rack %s still contains configured structure.', face_record.side, rack_record.display_code));
      end if;

      if face_record.enabled = false then
        continue;
      end if;

      select coalesce(sum(rs.length), 0)
      into section_length_sum
      from public.rack_sections rs
      where rs.rack_face_id = coalesce(face_record.mirror_source_face_id, face_record.id);

      expected_face_length := coalesce(face_record.face_length, rack_record.total_length);

      if not exists (
        select 1 from public.rack_sections rs where rs.rack_face_id = coalesce(face_record.mirror_source_face_id, face_record.id)
      ) then
        issues := issues || jsonb_build_object('code', 'rack_face.sections_required', 'severity', case when face_record.side = 'B' then 'warning' else 'error' end, 'entityId', face_record.id, 'message', format('Face %s on rack %s has no configured sections.', face_record.side, rack_record.display_code));
        issue_count := issue_count + case when face_record.side = 'B' then 0 else 1 end;
      elsif abs(section_length_sum - expected_face_length) > 0.001 then
        issues := issues || jsonb_build_object('code', 'rack_face.section_length_mismatch', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s section length sum (%s) does not match face length (%s).', face_record.side, section_length_sum, expected_face_length));
        issue_count := issue_count + 1;
      end if;

      if exists (
        select 1
        from public.rack_sections rs
        left join public.rack_levels rl on rl.rack_section_id = rs.id
        where rs.rack_face_id = coalesce(face_record.mirror_source_face_id, face_record.id)
        group by rs.id
        having count(rl.id) = 0
      ) then
        issues := issues || jsonb_build_object('code', 'rack_face.levels_required', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s has a section without levels.', face_record.side, rack_record.display_code));
        issue_count := issue_count + 1;
      end if;
    end loop;
  end loop;

  with generated_addresses as (
    select public.build_cell_address(r.display_code, rf.side, rs.ordinal, rl.ordinal, gs.slot_no) as address
    from public.racks r
    join public.rack_faces rf on rf.rack_id = r.id and rf.enabled = true
    join public.rack_sections rs on rs.rack_face_id = coalesce(rf.mirror_source_face_id, rf.id)
    join public.rack_levels rl on rl.rack_section_id = rs.id
    join lateral generate_series(1, rl.slot_count) as gs(slot_no) on true
    where r.layout_version_id = layout_version_uuid
  )
  select count(*)
  into duplicate_count
  from (select address from generated_addresses group by address having count(*) > 1) duplicates;

  if duplicate_count > 0 then
    issues := issues || jsonb_build_object('code', 'layout.address_duplicate', 'severity', 'error', 'message', format('Generated duplicate addresses detected (%s).', duplicate_count));
    issue_count := issue_count + 1;
  end if;

  if issue_count > 0 then
    perform public.write_layout_event('layout_validation', 'failed', layout_version_uuid, 'layout_version', layout_version_uuid, null, jsonb_build_object('issues', issues));
  end if;

  return jsonb_build_object('isValid', issue_count = 0, 'issues', issues);
end;
$$;

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
      insert into public.rack_faces (rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
      select rack_row.id, rf.side, rf.enabled, rf.slot_numbering_direction, rf.is_mirrored, null, rf.face_length
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
      insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
      values (
        (face_record ->> 'id')::uuid,
        rack_uuid,
        face_record ->> 'side',
        coalesce((face_record ->> 'enabled')::boolean, true),
        face_record ->> 'slotNumberingDirection',
        coalesce((face_record ->> 'isMirrored')::boolean, false),
        nullif(face_record ->> 'mirrorSourceFaceId', '')::uuid,
        nullif(face_record ->> 'faceLength', '')::numeric
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
