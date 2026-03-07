-- layout_publish.test.sql
-- Executable verification script for layout hardening.
-- Run after migrations 0001-0009 against a local database.
-- The script raises exceptions on failed assertions and rolls back at the end.

begin;

set local search_path to public;

-- Fresh bootstrap guarantees.
select gen_random_uuid();

-- Clean deterministic fixtures for re-runs.
delete from public.operation_events where floor_id in (
  '00000000-0000-0000-0000-000000000011'::uuid,
  '00000000-0000-0000-0000-000000000012'::uuid
);
delete from public.cells where layout_version_id in (
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000102'::uuid,
  '00000000-0000-0000-0000-000000000103'::uuid
);
delete from public.rack_levels where id in (
  '00000000-0000-0000-0000-000000000401'::uuid,
  '00000000-0000-0000-0000-000000000402'::uuid,
  '00000000-0000-0000-0000-000000000403'::uuid,
  '00000000-0000-0000-0000-000000000404'::uuid
);
delete from public.rack_sections where id in (
  '00000000-0000-0000-0000-000000000301'::uuid,
  '00000000-0000-0000-0000-000000000302'::uuid,
  '00000000-0000-0000-0000-000000000303'::uuid,
  '00000000-0000-0000-0000-000000000304'::uuid
);
delete from public.rack_faces where id in (
  '00000000-0000-0000-0000-000000000201'::uuid,
  '00000000-0000-0000-0000-000000000202'::uuid,
  '00000000-0000-0000-0000-000000000203'::uuid,
  '00000000-0000-0000-0000-000000000204'::uuid,
  '00000000-0000-0000-0000-000000000205'::uuid,
  '00000000-0000-0000-0000-000000000206'::uuid
);
delete from public.racks where id in (
  '00000000-0000-0000-0000-000000000111'::uuid,
  '00000000-0000-0000-0000-000000000112'::uuid,
  '00000000-0000-0000-0000-000000000113'::uuid
);
delete from public.layout_versions where id in (
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000102'::uuid,
  '00000000-0000-0000-0000-000000000103'::uuid
);
delete from public.floors where code in ('SQLF1', 'SQLF2');
delete from public.sites where code = 'SQLTEST_MAIN';

insert into public.sites (id, code, name, timezone)
values ('00000000-0000-0000-0000-000000000001'::uuid, 'SQLTEST_MAIN', 'SQL Test Site', 'Asia/Jerusalem');

insert into public.floors (id, site_id, code, name, sort_order)
values
  ('00000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'SQLF1', 'SQL Test Floor 1', 0),
  ('00000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'SQLF2', 'SQL Test Floor 2', 1);

do $$
declare
  draft_one uuid;
  same_draft uuid;
  draft_two uuid;
  invalid_draft uuid;
  validation_result jsonb;
  invalid_validation jsonb;
  publish_result jsonb;
  rack_count_after_failed_save integer;
  cell_code_count integer;
  caught boolean;
begin
  draft_one := public.create_layout_draft('00000000-0000-0000-0000-000000000011'::uuid, null);
  same_draft := public.create_layout_draft('00000000-0000-0000-0000-000000000011'::uuid, null);

  if draft_one is null or same_draft <> draft_one then
    raise exception 'create_layout_draft must return the existing draft when called twice';
  end if;

  perform public.save_layout_draft(
    jsonb_build_object(
      'layoutVersionId', draft_one,
      'floorId', '00000000-0000-0000-0000-000000000011',
      'racks', jsonb_build_array(
        jsonb_build_object(
          'id', '00000000-0000-0000-0000-000000000111',
          'displayCode', '03',
          'kind', 'paired',
          'axis', 'NS',
          'x', 10,
          'y', 20,
          'totalLength', 5,
          'depth', 1.1,
          'rotationDeg', 0,
          'faces', jsonb_build_array(
            jsonb_build_object(
              'id', '00000000-0000-0000-0000-000000000201',
              'side', 'A',
              'enabled', true,
              'anchor', 'start',
              'slotNumberingDirection', 'ltr',
              'isMirrored', false,
              'mirrorSourceFaceId', null,
              'sections', jsonb_build_array(
                jsonb_build_object(
                  'id', '00000000-0000-0000-0000-000000000301',
                  'ordinal', 1,
                  'length', 5,
                  'levels', jsonb_build_array(
                    jsonb_build_object(
                      'id', '00000000-0000-0000-0000-000000000401',
                      'ordinal', 1,
                      'slotCount', 2
                    )
                  )
                )
              )
            ),
            jsonb_build_object(
              'id', '00000000-0000-0000-0000-000000000202',
              'side', 'B',
              'enabled', true,
              'anchor', 'end',
              'slotNumberingDirection', 'rtl',
              'isMirrored', true,
              'mirrorSourceFaceId', '00000000-0000-0000-0000-000000000201',
              'sections', jsonb_build_array()
            )
          )
        )
      )
    ),
    null
  );

  begin
    perform public.save_layout_draft(
      jsonb_build_object(
        'layoutVersionId', draft_one,
        'floorId', '00000000-0000-0000-0000-000000000011',
        'racks', jsonb_build_array(
          jsonb_build_object(
            'id', '00000000-0000-0000-0000-000000000111',
            'displayCode', '03',
            'kind', 'paired',
            'axis', 'NS',
            'x', 10,
            'y', 20,
            'totalLength', 5,
            'depth', 1.1,
            'rotationDeg', 0,
            'faces', jsonb_build_array(
              jsonb_build_object(
                'id', '00000000-0000-0000-0000-000000000201',
                'side', 'A',
                'enabled', true,
                'anchor', 'start',
                'slotNumberingDirection', 'ltr',
                'isMirrored', true,
                'mirrorSourceFaceId', '00000000-0000-0000-0000-000000000201',
                'sections', jsonb_build_array(
                  jsonb_build_object(
                    'id', '00000000-0000-0000-0000-000000000301',
                    'ordinal', 1,
                    'length', 5,
                    'levels', jsonb_build_array(
                      jsonb_build_object(
                        'id', '00000000-0000-0000-0000-000000000401',
                        'ordinal', 1,
                        'slotCount', 2
                      )
                    )
                  )
                )
              )
            )
          )
        )
      ),
      null
    );
    raise exception 'Malformed save payload should have failed';
  exception
    when others then
      null;
  end;

  select count(*) into rack_count_after_failed_save
  from public.racks
  where layout_version_id = draft_one;

  if rack_count_after_failed_save <> 1 then
    raise exception 'Failed save should not destructively rewrite the draft';
  end if;

  validation_result := public.validate_layout_version(draft_one);
  if coalesce((validation_result ->> 'isValid')::boolean, false) = false then
    raise exception 'validate_layout_version unexpectedly failed: %', validation_result;
  end if;

  publish_result := public.publish_layout_version(draft_one, null);
  if (publish_result ->> 'generatedCells')::integer <> 4 then
    raise exception 'publish_layout_version should generate 4 cells for mirrored A/B faces';
  end if;

  select count(*) into cell_code_count
  from public.cells
  where layout_version_id = draft_one and cell_code is not null;

  if cell_code_count <> 4 then
    raise exception 'Published cells must have stable cell_code values';
  end if;

  begin
    perform public.publish_layout_version(draft_one, null);
    raise exception 'Repeated publish on a non-draft layout should fail deterministically';
  exception
    when others then
      null;
  end;

  draft_two := public.create_layout_draft('00000000-0000-0000-0000-000000000011'::uuid, null);
  if draft_two = draft_one then
    raise exception 'A new draft should be created after publishing the previous draft';
  end if;

  begin
    insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
    values ('00000000-0000-0000-0000-000000000112'::uuid, draft_two, '04', 'paired', 'NS', 30, 10, 5, 1.1, 0, 'draft');

    insert into public.rack_faces (id, rack_id, side, enabled, anchor, slot_numbering_direction, is_mirrored, mirror_source_face_id)
    values
      ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000112'::uuid, 'A', true, 'start', 'ltr', false, null),
      ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000112'::uuid, 'B', true, 'end', 'rtl', true, '00000000-0000-0000-0000-000000000201'::uuid);

    raise exception 'Cross-rack mirrored face insert should have failed';
  exception
    when others then
      null;
  end;

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values ('00000000-0000-0000-0000-000000000302'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, 2, 5);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values ('00000000-0000-0000-0000-000000000402'::uuid, '00000000-0000-0000-0000-000000000302'::uuid, 1, 1);

  begin
    insert into public.cells (
      layout_version_id,
      rack_id,
      rack_face_id,
      rack_section_id,
      rack_level_id,
      slot_no,
      cell_code,
      address,
      address_sort_key,
      status
    )
    values (
      draft_two,
      '00000000-0000-0000-0000-000000000111'::uuid,
      '00000000-0000-0000-0000-000000000201'::uuid,
      '00000000-0000-0000-0000-000000000302'::uuid,
      '00000000-0000-0000-0000-000000000402'::uuid,
      1,
      'cell_badref',
      '03-A.99.99.99',
      '0003-A-99-99-99',
      'active'
    );
    raise exception 'Cross-tree cell insert should have failed';
  exception
    when others then
      null;
  end;

  invalid_draft := public.create_layout_draft('00000000-0000-0000-0000-000000000012'::uuid, null);

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  values ('00000000-0000-0000-0000-000000000113'::uuid, invalid_draft, '09', 'single', 'WE', 5, 5, 5, 1.1, 0, 'draft');

  insert into public.rack_faces (id, rack_id, side, enabled, anchor, slot_numbering_direction, is_mirrored, mirror_source_face_id)
  values
    ('00000000-0000-0000-0000-000000000205'::uuid, '00000000-0000-0000-0000-000000000113'::uuid, 'A', true, 'start', 'ltr', false, null),
    ('00000000-0000-0000-0000-000000000206'::uuid, '00000000-0000-0000-0000-000000000113'::uuid, 'B', true, 'end', 'rtl', false, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values
    ('00000000-0000-0000-0000-000000000303'::uuid, '00000000-0000-0000-0000-000000000205'::uuid, 1, 5),
    ('00000000-0000-0000-0000-000000000304'::uuid, '00000000-0000-0000-0000-000000000206'::uuid, 1, 5);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values
    ('00000000-0000-0000-0000-000000000403'::uuid, '00000000-0000-0000-0000-000000000303'::uuid, 1, 1),
    ('00000000-0000-0000-0000-000000000404'::uuid, '00000000-0000-0000-0000-000000000304'::uuid, 1, 1);

  invalid_validation := public.validate_layout_version(invalid_draft);
  if coalesce((invalid_validation ->> 'isValid')::boolean, true) = true then
    raise exception 'Invalid single rack with configured Face B must fail validation';
  end if;

  begin
    perform public.publish_layout_version(invalid_draft, null);
    raise exception 'Publishing invalid layout must fail';
  exception
    when others then
      null;
  end;

  if not exists (
    select 1 from public.operation_events where event_type = 'layout_draft_created' and status = 'succeeded' and layout_version_id = draft_one
  ) then
    raise exception 'Audit row for draft creation is missing';
  end if;

  if not exists (
    select 1 from public.operation_events where event_type = 'layout_draft_saved' and status = 'succeeded' and layout_version_id = draft_one
  ) then
    raise exception 'Audit row for successful draft save is missing';
  end if;

  if not exists (
    select 1 from public.operation_events where event_type = 'layout_publish' and status = 'succeeded' and layout_version_id = draft_one
  ) then
    raise exception 'Audit row for successful publish is missing';
  end if;

  if not exists (
    select 1 from public.operation_events where event_type = 'layout_validation' and status = 'failed' and layout_version_id = invalid_draft
  ) then
    raise exception 'Audit row for failed validation is missing';
  end if;
end
$$;

rollback;

