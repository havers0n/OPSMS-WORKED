-- 0006_layout_validation_and_publish.sql

create or replace function public.regenerate_layout_cells(layout_version_uuid uuid)
returns integer
language plpgsql
as $$
declare
  inserted_count integer := 0;
begin
  delete from public.cells where layout_version_id = layout_version_uuid;

  insert into public.cells (
    layout_version_id,
    rack_id,
    rack_face_id,
    rack_section_id,
    rack_level_id,
    slot_no,
    address,
    address_sort_key,
    status
  )
  select
    lv.id as layout_version_id,
    r.id as rack_id,
    rf.id as rack_face_id,
    rs.id as rack_section_id,
    rl.id as rack_level_id,
    gs.slot_no,
    public.build_cell_address(r.display_code, rf.side, rs.ordinal, rl.ordinal, gs.slot_no) as address,
    public.pad_4(r.display_code) || '-' || rf.side || '-' || public.pad_2(rs.ordinal::text) || '-' || public.pad_2(rl.ordinal::text) || '-' || public.pad_2(gs.slot_no::text) as address_sort_key,
    'active' as status
  from public.layout_versions lv
  join public.racks r on r.layout_version_id = lv.id
  join public.rack_faces rf on rf.rack_id = r.id and rf.enabled = true
  join public.rack_sections rs on rs.rack_face_id = coalesce(rf.mirror_source_face_id, rf.id)
  join public.rack_levels rl on rl.rack_section_id = rs.id
  join lateral generate_series(1, rl.slot_count) as gs(slot_no) on true
  where lv.id = layout_version_uuid;

  get diagnostics inserted_count = row_count;
  return inserted_count;
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
begin
  for rack_record in
    select r.id, r.display_code, r.total_length
    from public.racks r
    where r.layout_version_id = layout_version_uuid
  loop
    if not exists (
      select 1
      from public.rack_faces rf
      where rf.rack_id = rack_record.id
        and rf.side = 'A'
        and rf.enabled = true
    ) then
      issues := issues || jsonb_build_object(
        'code', 'rack.face_a_required',
        'severity', 'error',
        'entityId', rack_record.id,
        'message', format('Rack %s must have an enabled Face A.', rack_record.display_code)
      );
      issue_count := issue_count + 1;
    end if;

    if not exists (
      select 1
      from public.rack_faces rf
      where rf.rack_id = rack_record.id
        and rf.enabled = true
    ) then
      issues := issues || jsonb_build_object(
        'code', 'rack.enabled_face_required',
        'severity', 'error',
        'entityId', rack_record.id,
        'message', format('Rack %s must have at least one enabled face.', rack_record.display_code)
      );
      issue_count := issue_count + 1;
    end if;

    for face_record in
      select rf.id, rf.side
      from public.rack_faces rf
      where rf.rack_id = rack_record.id
        and rf.enabled = true
    loop
      select coalesce(sum(rs.length), 0)
      into section_length_sum
      from public.rack_sections rs
      where rs.rack_face_id = coalesce(
        (select mirror_source_face_id from public.rack_faces where id = face_record.id and is_mirrored = true),
        face_record.id
      );

      if not exists (
        select 1
        from public.rack_sections rs
        where rs.rack_face_id = coalesce(
          (select mirror_source_face_id from public.rack_faces where id = face_record.id and is_mirrored = true),
          face_record.id
        )
      ) then
        issues := issues || jsonb_build_object(
          'code', 'rack_face.sections_required',
          'severity', case when face_record.side = 'B' then 'warning' else 'error' end,
          'entityId', face_record.id,
          'message', format('Face %s on rack %s has no configured sections.', face_record.side, rack_record.display_code)
        );
        issue_count := issue_count + case when face_record.side = 'B' then 0 else 1 end;
      elsif abs(section_length_sum - rack_record.total_length) > 0.001 then
        issues := issues || jsonb_build_object(
          'code', 'rack_face.section_length_mismatch',
          'severity', 'error',
          'entityId', face_record.id,
          'message', format('Face %s section length sum (%s) does not match rack total length (%s).', face_record.side, section_length_sum, rack_record.total_length)
        );
        issue_count := issue_count + 1;
      end if;
    end loop;
  end loop;

  with generated_addresses as (
    select
      public.build_cell_address(r.display_code, rf.side, rs.ordinal, rl.ordinal, gs.slot_no) as address
    from public.racks r
    join public.rack_faces rf on rf.rack_id = r.id and rf.enabled = true
    join public.rack_sections rs on rs.rack_face_id = coalesce(rf.mirror_source_face_id, rf.id)
    join public.rack_levels rl on rl.rack_section_id = rs.id
    join lateral generate_series(1, rl.slot_count) as gs(slot_no) on true
    where r.layout_version_id = layout_version_uuid
  )
  select count(*)
  into duplicate_count
  from (
    select address
    from generated_addresses
    group by address
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    issues := issues || jsonb_build_object(
      'code', 'layout.address_duplicate',
      'severity', 'error',
      'message', format('Generated duplicate addresses detected (%s).', duplicate_count)
    );
    issue_count := issue_count + 1;
  end if;

  return jsonb_build_object(
    'isValid', issue_count = 0,
    'issues', issues
  );
end;
$$;

create or replace function public.publish_layout_version(layout_version_uuid uuid, actor_uuid uuid default null)
returns jsonb
language plpgsql
as $$
declare
  validation_result jsonb;
  inserted_cells integer := 0;
  floor_uuid uuid;
begin
  select floor_id into floor_uuid
  from public.layout_versions
  where id = layout_version_uuid;

  if floor_uuid is null then
    raise exception 'Layout version % not found.', layout_version_uuid;
  end if;

  validation_result := public.validate_layout_version(layout_version_uuid);

  if coalesce((validation_result ->> 'isValid')::boolean, false) = false then
    raise exception 'Layout version % failed validation.', layout_version_uuid;
  end if;

  inserted_cells := public.regenerate_layout_cells(layout_version_uuid);

  update public.layout_versions
  set state = 'archived',
      archived_at = timezone('utc', now())
  where floor_id = floor_uuid
    and state = 'published'
    and id <> layout_version_uuid;

  update public.layout_versions
  set state = 'published',
      published_at = timezone('utc', now()),
      published_by = actor_uuid
  where id = layout_version_uuid;

  update public.racks
  set state = 'published'
  where layout_version_id = layout_version_uuid;

  return jsonb_build_object(
    'layoutVersionId', layout_version_uuid,
    'publishedAt', timezone('utc', now()),
    'generatedCells', inserted_cells,
    'validation', validation_result
  );
end;
$$;
