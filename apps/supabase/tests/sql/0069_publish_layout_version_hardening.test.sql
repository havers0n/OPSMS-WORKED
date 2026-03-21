begin;

create extension if not exists dblink;

do $$
declare
  default_tenant_uuid uuid;

  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  invalid_floor_uuid uuid := gen_random_uuid();

  site_code text := 'PR09-S-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10);
  floor_code text := 'PR09-F-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);
  invalid_floor_code text := 'PR09-I-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);

  -- Valid draft payload ids
  rack_uuid uuid := gen_random_uuid();
  face_a_uuid uuid := gen_random_uuid();
  section_uuid uuid := gen_random_uuid();
  level_uuid uuid := gen_random_uuid();

  -- Invalid draft fixture ids
  invalid_rack_uuid uuid := gen_random_uuid();
  invalid_face_a_uuid uuid := gen_random_uuid();
  invalid_face_b_uuid uuid := gen_random_uuid();
  invalid_section_a_uuid uuid := gen_random_uuid();
  invalid_section_b_uuid uuid := gen_random_uuid();
  invalid_level_a_uuid uuid := gen_random_uuid();
  invalid_level_b_uuid uuid := gen_random_uuid();

  draft_one uuid;
  draft_two uuid;
  invalid_draft uuid;
  rollback_draft uuid;
  race_draft uuid;
  same_draft_a uuid;
  same_draft_b uuid;

  publish_one jsonb;
  publish_two jsonb;

  first_cell_uuid uuid;
  second_cell_uuid uuid;
  first_location_id uuid;
  first_location_code text;
  rollback_code text;

  published_count integer;
  archived_count integer;

  conn_a text := 'pr09_pub_a';
  conn_b text := 'pr09_pub_b';
begin
  select id
  into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for PR-09 publish hardening test.';
  end if;

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, site_code, 'PR-09 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values
    (floor_uuid, site_uuid, floor_code, 'PR-09 Floor', 1),
    (invalid_floor_uuid, site_uuid, invalid_floor_code, 'PR-09 Invalid Floor', 2);

  -- 1) publish success for valid draft
  draft_one := public.create_layout_draft(floor_uuid, null);

  perform public.save_layout_draft(
    jsonb_build_object(
      'layoutVersionId', draft_one,
      'floorId', floor_uuid::text,
      'racks', jsonb_build_array(
        jsonb_build_object(
          'id', rack_uuid,
          'displayCode', '01',
          'kind', 'single',
          'axis', 'NS',
          'x', 10,
          'y', 20,
          'totalLength', 5,
          'depth', 1.1,
          'rotationDeg', 0,
          'faces', jsonb_build_array(
            jsonb_build_object(
              'id', face_a_uuid,
              'side', 'A',
              'enabled', true,
              'slotNumberingDirection', 'ltr',
              'isMirrored', false,
              'mirrorSourceFaceId', null,
              'sections', jsonb_build_array(
                jsonb_build_object(
                  'id', section_uuid,
                  'ordinal', 1,
                  'length', 5,
                  'levels', jsonb_build_array(
                    jsonb_build_object(
                      'id', level_uuid,
                      'ordinal', 1,
                      'slotCount', 1
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

  publish_one := public.publish_layout_version(draft_one, null);

  if coalesce((publish_one ->> 'generatedCells')::integer, 0) <> 1 then
    raise exception 'Expected first publish to generate exactly one cell, got %', publish_one;
  end if;

  if (select state from public.layout_versions where id = draft_one) <> 'published' then
    raise exception 'Expected draft_one to be published after successful publish.';
  end if;

  select c.id, c.address
  into first_cell_uuid, first_location_code
  from public.cells c
  where c.layout_version_id = draft_one
  limit 1;

  if first_cell_uuid is null or first_location_code is null then
    raise exception 'Expected published layout to have at least one generated cell/address.';
  end if;

  select l.id
  into first_location_id
  from public.locations l
  where l.floor_id = floor_uuid
    and l.code = first_location_code
    and l.geometry_slot_id = first_cell_uuid
  limit 1;

  if first_location_id is null then
    raise exception 'Expected location sync to create/update a rack_slot row for first publish.';
  end if;

  -- 2) missing version -> correct error
  begin
    perform public.publish_layout_version(gen_random_uuid(), null);
    raise exception 'Expected missing layout version publish to fail.';
  exception
    when others then
      if position('not found' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- 3) already published / not active draft -> correct error
  begin
    perform public.publish_layout_version(draft_one, null);
    raise exception 'Expected repeated publish of already published version to fail.';
  exception
    when others then
      if position('not an active draft' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- invalid draft fixture (single rack with configured Face B) -> validation fail
  invalid_draft := public.create_layout_draft(invalid_floor_uuid, null);

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  values (invalid_rack_uuid, invalid_draft, '09', 'single', 'WE', 0, 0, 5, 1.1, 0, 'draft');

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id)
  values
    (invalid_face_a_uuid, invalid_rack_uuid, 'A', true, 'ltr', false, null),
    (invalid_face_b_uuid, invalid_rack_uuid, 'B', true, 'rtl', false, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values
    (invalid_section_a_uuid, invalid_face_a_uuid, 1, 5),
    (invalid_section_b_uuid, invalid_face_b_uuid, 1, 5);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values
    (invalid_level_a_uuid, invalid_section_a_uuid, 1, 1),
    (invalid_level_b_uuid, invalid_section_b_uuid, 1, 1);

  begin
    perform public.publish_layout_version(invalid_draft, null);
    raise exception 'Expected invalid draft publish to fail validation.';
  exception
    when others then
      if position('failed validation' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  if (select state from public.layout_versions where id = invalid_draft) <> 'draft' then
    raise exception 'Expected invalid draft to remain draft after failed publish.';
  end if;

  if exists (
    select 1
    from public.layout_versions lv
    where lv.floor_id = invalid_floor_uuid
      and lv.state = 'published'
  ) then
    raise exception 'Expected no published version for invalid floor after failed publish.';
  end if;

  -- 5 + regression: second successful publish archives previous one and remaps locations
  draft_two := public.create_layout_draft(floor_uuid, null);
  if draft_two = draft_one then
    raise exception 'Expected create_layout_draft to create a new draft after publish.';
  end if;

  publish_two := public.publish_layout_version(draft_two, null);
  if coalesce((publish_two ->> 'generatedCells')::integer, 0) <> 1 then
    raise exception 'Expected second publish to generate exactly one cell, got %', publish_two;
  end if;

  select c.id
  into second_cell_uuid
  from public.cells c
  where c.layout_version_id = draft_two
  limit 1;

  if second_cell_uuid is null then
    raise exception 'Expected second publish to generate at least one cell.';
  end if;

  select count(*)
  into published_count
  from public.layout_versions
  where floor_id = floor_uuid
    and state = 'published';

  if published_count <> 1 then
    raise exception 'Expected exactly one published version after second publish, found %.', published_count;
  end if;

  select count(*)
  into archived_count
  from public.layout_versions
  where floor_id = floor_uuid
    and state = 'archived'
    and id = draft_one;

  if archived_count <> 1 then
    raise exception 'Expected first published version to be archived after second publish.';
  end if;

  if (
    select l.geometry_slot_id
    from public.locations l
    where l.id = first_location_id
  ) is distinct from second_cell_uuid then
    raise exception 'Expected preserved 0053 behavior: location geometry_slot_id remapped to second publish cell.';
  end if;

  if (
    select count(*)
    from public.locations l
    where l.floor_id = floor_uuid
      and l.code = first_location_code
  ) <> 1 then
    raise exception 'Expected exactly one location row per (floor_id, code) after re-publish remap.';
  end if;

  -- 4) rollback correctness on publish path failure (all-or-nothing)
  rollback_draft := public.create_layout_draft(floor_uuid, null);

  select public.build_cell_address(r.display_code, rf.side, rs.ordinal, rl.ordinal, 1)
  into rollback_code
  from public.racks r
  join public.rack_faces rf on rf.rack_id = r.id and rf.enabled = true
  join public.rack_sections rs on rs.rack_face_id = coalesce(rf.mirror_source_face_id, rf.id)
  join public.rack_levels rl on rl.rack_section_id = rs.id
  where r.layout_version_id = rollback_draft
  order by r.display_code, rf.side, rs.ordinal, rl.ordinal
  limit 1;

  if rollback_code is null then
    raise exception 'Expected rollback_draft topology to contain at least one publishable address.';
  end if;

  -- This row forces post-publish location upsert to fail the row validator on UPDATE.
  insert into public.locations (
    tenant_id,
    floor_id,
    code,
    location_type,
    geometry_slot_id,
    capacity_mode,
    status
  ) values (
    default_tenant_uuid,
    floor_uuid,
    rollback_code,
    'staging',
    null,
    'multi_container',
    'active'
  );

  begin
    perform public.publish_layout_version(rollback_draft, null);
    raise exception 'Expected publish to fail due to conflicting non-rack_slot location row.';
  exception
    when others then
      if position('Only rack_slot locations may reference a geometry slot' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  if (select state from public.layout_versions where id = rollback_draft) <> 'draft' then
    raise exception 'Expected failed publish rollback to keep target layout as draft.';
  end if;

  if (
    select count(*)
    from public.cells c
    where c.layout_version_id = rollback_draft
  ) <> 0 then
    raise exception 'Expected failed publish rollback to leave no regenerated cells persisted for rollback_draft.';
  end if;

  if (
    select id
    from public.layout_versions
    where floor_id = floor_uuid
      and state = 'published'
    limit 1
  ) is distinct from draft_two then
    raise exception 'Expected failed publish rollback to keep previously published version unchanged.';
  end if;

  if (
    select l.geometry_slot_id
    from public.locations l
    where l.floor_id = floor_uuid
      and l.code = rollback_code
      and l.location_type = 'staging'
    limit 1
  ) is not null then
    raise exception 'Expected failed publish rollback to keep conflicting staging location unchanged.';
  end if;

  -- 6.1) invariant: second draft per floor impossible
  same_draft_a := public.create_layout_draft(floor_uuid, null);
  same_draft_b := public.create_layout_draft(floor_uuid, null);

  if same_draft_a is distinct from same_draft_b then
    raise exception 'Expected repeated create_layout_draft on same floor to return the existing draft.';
  end if;

  if (
    select count(*)
    from public.layout_versions lv
    where lv.floor_id = floor_uuid
      and lv.state = 'draft'
  ) <> 1 then
    raise exception 'Expected schema/domain invariant: at most one draft per floor.';
  end if;

  -- 6.2 + 7) concurrent publish same floor serializes + double publish same draft
  race_draft := same_draft_a;

  perform dblink_connect(conn_a, 'dbname=postgres');
  perform dblink_connect(conn_b, 'dbname=postgres');

  perform dblink_exec(conn_a, 'begin');
  perform dblink_exec(conn_b, 'begin');

  perform dblink_exec(
    conn_a,
    format(
      'select public.publish_layout_version(%L::uuid, null)',
      race_draft::text
    )
  );

  perform dblink_send_query(
    conn_b,
    format(
      'select public.publish_layout_version(%L::uuid, null)',
      race_draft::text
    )
  );

  perform pg_sleep(0.2);

  if dblink_is_busy(conn_b) = 0 then
    raise exception 'Expected second concurrent publish to wait on floor-scoped advisory lock.';
  end if;

  -- Winner transaction is still uncommitted; this session should still see draft.
  if (select state from public.layout_versions where id = race_draft) <> 'draft' then
    raise exception 'Expected winner publish state to remain invisible before commit.';
  end if;

  perform dblink_exec(conn_a, 'commit');

  begin
    perform *
    from dblink_get_result(conn_b) as r(result jsonb);
    raise exception 'Expected second concurrent publish attempt to fail deterministically.';
  exception
    when others then
      if position('not an active draft' in sqlerrm) = 0 and position('no longer draft' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  perform dblink_exec(conn_b, 'rollback');
  perform dblink_disconnect(conn_a);
  perform dblink_disconnect(conn_b);

  if (select state from public.layout_versions where id = race_draft) <> 'published' then
    raise exception 'Expected winning publish in race scenario to be committed as published.';
  end if;

  if (
    select count(*)
    from public.layout_versions
    where floor_id = floor_uuid
      and state = 'published'
  ) <> 1 then
    raise exception 'Expected one published version after concurrent publish race resolution.';
  end if;

  -- 9) no duplicate/partial location side effects after concurrency
  if exists (
    select 1
    from public.locations l
    where l.floor_id = floor_uuid
    group by l.code
    having count(*) > 1
  ) then
    raise exception 'Expected no duplicate location codes after concurrent publish attempts.';
  end if;

  if exists (
    select 1
    from public.locations l
    join public.cells c on c.id = l.geometry_slot_id
    join public.layout_versions lv on lv.id = c.layout_version_id
    where l.floor_id = floor_uuid
      and l.geometry_slot_id is not null
      and lv.state <> 'published'
  ) then
    raise exception 'Expected all geometry_slot-linked locations to reference published layout cells only.';
  end if;

  -- 8) save-vs-publish race coverage limitation
  raise notice 'PR-09 limitation: deterministic save-vs-publish race is not reliably reproducible in current SQL harness without intrusive instrumentation; scenario explicitly documented.';
end
$$;

rollback;
