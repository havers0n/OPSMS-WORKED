begin;

set local search_path to public;

create or replace function pg_temp.rename_code(old_code text, new_display_code text)
returns text
language sql
as $$
  select new_display_code || substring(old_code from position('-' in old_code))
$$;

create or replace function pg_temp.create_publish_rename_fixture(label text, slot_count integer default 1)
returns table (
  tenant_id uuid,
  floor_id uuid,
  published_layout_id uuid,
  first_location_id uuid,
  first_location_code text,
  first_slot_id uuid,
  second_location_id uuid,
  second_location_code text,
  second_slot_id uuid
)
language plpgsql
as $$
declare
  tenant_uuid uuid;
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  draft_uuid uuid;
  rack_uuid uuid := gen_random_uuid();
  face_uuid uuid := gen_random_uuid();
  section_uuid uuid := gen_random_uuid();
  level_uuid uuid := gen_random_uuid();
  first_cell record;
  second_cell record;
begin
  select id
  into tenant_uuid
  from public.tenants
  where code = 'default';

  if tenant_uuid is null then
    raise exception 'Expected default tenant to exist.';
  end if;

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (
    site_uuid,
    tenant_uuid,
    'P3B-' || upper(substring(replace(site_uuid::text, '-', '') from 1 for 10)),
    'Phase 3B Rename ' || label,
    'UTC'
  );

  insert into public.floors (id, site_id, code, name, sort_order)
  values (
    floor_uuid,
    site_uuid,
    'P3B-' || upper(substring(replace(floor_uuid::text, '-', '') from 1 for 10)),
    'Phase 3B Rename ' || label,
    1
  );

  draft_uuid := public.create_layout_draft(floor_uuid, null);

  perform public.save_layout_draft(
    jsonb_build_object(
      'layoutVersionId', draft_uuid,
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
              'id', face_uuid,
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
                      'slotCount', slot_count
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

  perform public.publish_layout_version(draft_uuid, null);

  select c.id, coalesce(c.address, c.cell_code) as code
  into first_cell
  from public.cells c
  where c.layout_version_id = draft_uuid
  order by c.slot_no
  limit 1;

  select c.id, coalesce(c.address, c.cell_code) as code
  into second_cell
  from public.cells c
  where c.layout_version_id = draft_uuid
  order by c.slot_no
  offset 1
  limit 1;

  if first_cell.id is null then
    raise exception 'Expected at least one published cell for fixture %.', label;
  end if;

  if slot_count > 1 and second_cell.id is null then
    raise exception 'Expected two published cells for fixture %.', label;
  end if;

  return query
  select
    tenant_uuid,
    floor_uuid,
    draft_uuid,
    l1.id,
    first_cell.code,
    first_cell.id,
    l2.id,
    second_cell.code,
    second_cell.id
  from public.locations l1
  left join public.locations l2
    on l2.floor_id = floor_uuid
   and l2.code = second_cell.code
  where l1.floor_id = floor_uuid
    and l1.code = first_cell.code;
end
$$;

create or replace function pg_temp.create_rename_draft(floor_uuid uuid, new_display_code text, new_slot_count integer default 1)
returns uuid
language plpgsql
as $$
declare
  draft_uuid uuid;
begin
  draft_uuid := public.create_layout_draft(floor_uuid, null);

  update public.racks
  set display_code = new_display_code
  where layout_version_id = draft_uuid;

  update public.rack_levels rl
  set slot_count = new_slot_count
  from public.rack_sections rs
  join public.rack_faces rf on rf.id = rs.rack_face_id
  join public.racks r on r.id = rf.rack_id
  where rl.rack_section_id = rs.id
    and r.layout_version_id = draft_uuid;

  return draft_uuid;
end
$$;

create or replace function pg_temp.create_rename_product()
returns uuid
language plpgsql
as $$
declare
  product_uuid uuid := gen_random_uuid();
begin
  insert into public.products (id, source, external_product_id, sku, name)
  values (
    product_uuid,
    'phase3b-rename',
    product_uuid::text,
    'P3B-' || upper(substring(replace(product_uuid::text, '-', '') from 1 for 10)),
    'Phase 3B Rename Product ' || product_uuid::text
  );

  return product_uuid;
end
$$;

create or replace function pg_temp.expect_rename_publish_error(draft_uuid uuid, payload jsonb, expected_fragment text)
returns void
language plpgsql
as $$
begin
  perform public.publish_layout_version_with_renames(draft_uuid, null, payload);
  raise exception 'Expected rename publish to fail.';
exception
  when others then
    if position(expected_fragment in sqlerrm) = 0 then
      raise;
    end if;
end
$$;

create or replace function pg_temp.expect_publish_blocked(draft_uuid uuid, expected_fragment text)
returns void
language plpgsql
as $$
begin
  perform public.publish_layout_version(draft_uuid, null);
  raise exception 'Expected publish to be blocked.';
exception
  when others then
    if position('PUBLISH_LAYOUT_DESTRUCTIVE_LOCATION_BLOCKED' in sqlerrm) = 0
      or position(expected_fragment in sqlerrm) = 0 then
      raise;
    end if;
end
$$;

do $$
declare
  actor_uuid uuid := gen_random_uuid();
  fixture record;
  draft_uuid uuid;
  new_code text;
  second_new_code text;
  new_slot_id uuid;
  second_new_slot_id uuid;
  location_id_after uuid;
  location_code_after text;
  location_status_after text;
  slot_id_after uuid;
  location_count_after integer;
  container_type_uuid uuid;
  container_uuid uuid;
  product_uuid uuid;
  policy_location_id uuid;
  previous_slot_id uuid;
  publish_result jsonb;
begin
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'phase3b-rename@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  select t.id, actor_uuid, 'tenant_admin'
  from public.tenants t
  where t.code = 'default'
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  select id
  into container_type_uuid
  from public.container_types
  where code = 'bin';

  if container_type_uuid is null then
    raise exception 'Expected bin container type to exist.';
  end if;

  -- 1, 6, 7, 8, 9, 10. Empty A -> B rename preserves id, updates code/slot/status, creates no duplicate, and is not disabled.
  select * into fixture from pg_temp.create_publish_rename_fixture('empty rename', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');

  perform public.publish_layout_version_with_renames(
    draft_uuid,
    null,
    jsonb_build_array(jsonb_build_object('old_code', '  ' || fixture.first_location_code || '  ', 'new_code', '  ' || new_code || '  '))
  );

  select c.id
  into new_slot_id
  from public.cells c
  where c.layout_version_id = draft_uuid
    and coalesce(c.address, c.cell_code) = new_code;

  select l.id, l.code, l.geometry_slot_id, l.status
  into location_id_after, location_code_after, slot_id_after, location_status_after
  from public.locations l
  where l.id = fixture.first_location_id;

  if location_id_after is distinct from fixture.first_location_id then
    raise exception 'Rename empty location must preserve locations.id.';
  end if;

  if location_code_after <> new_code then
    raise exception 'Rename must update locations.code to %, found %.', new_code, location_code_after;
  end if;

  if slot_id_after is distinct from new_slot_id or slot_id_after = fixture.first_slot_id then
    raise exception 'Rename must update geometry_slot_id to the new published cell.';
  end if;

  if location_status_after <> 'active' then
    raise exception 'Rename must set status active, found %.', location_status_after;
  end if;

  select count(*)
  into location_count_after
  from public.locations l
  where l.floor_id = fixture.floor_id
    and l.code = new_code;

  if location_count_after <> 1 then
    raise exception 'Rename must create no duplicate target rows, found %.', location_count_after;
  end if;

  if exists (
    select 1
    from public.locations l
    where l.id = fixture.first_location_id
      and l.status = 'disabled'
  ) then
    raise exception 'Mapped old code must not be disabled by Phase 2 cleanup.';
  end if;

  -- 2, 3. Occupied A -> B rename preserves id and keeps container attached through location_id.
  select * into fixture from pg_temp.create_publish_rename_fixture('occupied rename', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');

  insert into public.containers (tenant_id, external_code, container_type_id, status, current_location_id)
  values (
    fixture.tenant_id,
    'P3B-OCC-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10)),
    container_type_uuid,
    'active',
    fixture.first_location_id
  )
  returning id into container_uuid;

  perform public.publish_layout_version_with_renames(
    draft_uuid,
    null,
    jsonb_build_array(jsonb_build_object('old_code', fixture.first_location_code, 'new_code', new_code))
  );

  if (select current_location_id from public.containers where id = container_uuid) is distinct from fixture.first_location_id then
    raise exception 'Renamed occupied location must keep containers.current_location_id attached to the same location id.';
  end if;

  if (select code from public.locations where id = fixture.first_location_id) <> new_code then
    raise exception 'Renamed occupied location must update code to the new code.';
  end if;

  -- 4, 5. Policy-bound A -> B rename preserves id and keeps policy attached through location_id.
  select * into fixture from pg_temp.create_publish_rename_fixture('policy rename', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');
  product_uuid := pg_temp.create_rename_product();

  insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
  values (fixture.tenant_id, product_uuid, fixture.first_location_id, 'primary_pick', 'published')
  returning location_id into policy_location_id;

  perform public.publish_layout_version_with_renames(
    draft_uuid,
    null,
    jsonb_build_array(jsonb_build_object('old_code', fixture.first_location_code, 'new_code', new_code))
  );

  if policy_location_id is distinct from fixture.first_location_id then
    raise exception 'Policy fixture should attach to the original location id.';
  end if;

  if not exists (
    select 1
    from public.product_location_roles plr
    where plr.product_id = product_uuid
      and plr.location_id = fixture.first_location_id
  ) then
    raise exception 'Renamed policy-bound location must keep policy attached through location_id.';
  end if;

  if (select code from public.locations where id = fixture.first_location_id) <> new_code then
    raise exception 'Renamed policy-bound location must update code to the new code.';
  end if;

  -- 11. Multiple independent renames in one publish work.
  select * into fixture from pg_temp.create_publish_rename_fixture('multiple rename', 2);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 2);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');
  second_new_code := pg_temp.rename_code(fixture.second_location_code, '02');

  perform public.publish_layout_version_with_renames(
    draft_uuid,
    null,
    jsonb_build_array(
      jsonb_build_object('old_code', fixture.first_location_code, 'new_code', new_code),
      jsonb_build_object('old_code', fixture.second_location_code, 'new_code', second_new_code)
    )
  );

  select c.id
  into new_slot_id
  from public.cells c
  where c.layout_version_id = draft_uuid
    and coalesce(c.address, c.cell_code) = new_code;

  select c.id
  into second_new_slot_id
  from public.cells c
  where c.layout_version_id = draft_uuid
    and coalesce(c.address, c.cell_code) = second_new_code;

  if (select id from public.locations where code = new_code and floor_id = fixture.floor_id) is distinct from fixture.first_location_id then
    raise exception 'First independent rename must preserve locations.id.';
  end if;

  if (select id from public.locations where code = second_new_code and floor_id = fixture.floor_id) is distinct from fixture.second_location_id then
    raise exception 'Second independent rename must preserve locations.id.';
  end if;

  if (select geometry_slot_id from public.locations where id = fixture.first_location_id) is distinct from new_slot_id then
    raise exception 'First independent rename must update geometry_slot_id.';
  end if;

  if (select geometry_slot_id from public.locations where id = fixture.second_location_id) is distinct from second_new_slot_id then
    raise exception 'Second independent rename must update geometry_slot_id.';
  end if;

  -- 12. Unmapped removed occupied location still blocks.
  select * into fixture from pg_temp.create_publish_rename_fixture('unmapped occupied removal', 2);
  insert into public.containers (tenant_id, external_code, container_type_id, status, current_location_id)
  values (
    fixture.tenant_id,
    'P3B-BLK-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10)),
    container_type_uuid,
    'active',
    fixture.second_location_id
  );
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '01', 1);
  perform pg_temp.expect_publish_blocked(draft_uuid, 'containers.current_location_id');

  -- 13, 16. Unmapped removed empty location disables, then reintroduced disabled code reactivates without mappings.
  select * into fixture from pg_temp.create_publish_rename_fixture('empty removal reintroduce', 2);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '01', 1);
  perform public.publish_layout_version(draft_uuid, null);

  if (select status from public.locations where id = fixture.second_location_id) <> 'disabled' then
    raise exception 'Unmapped removed empty location must be disabled.';
  end if;

  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '01', 2);
  perform public.publish_layout_version(draft_uuid, null);

  if (select id from public.locations where floor_id = fixture.floor_id and code = fixture.second_location_code) is distinct from fixture.second_location_id then
    raise exception 'Reintroduced disabled code must reuse the existing row.';
  end if;

  if (select status from public.locations where id = fixture.second_location_id) <> 'active' then
    raise exception 'Reintroduced disabled code must reactivate the existing row.';
  end if;

  -- 14, 17. Same-code republish still works through the compatibility wrapper.
  select * into fixture from pg_temp.create_publish_rename_fixture('same code wrapper', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '01', 1);
  publish_result := public.publish_layout_version(draft_uuid, null);

  if (publish_result ->> 'layoutVersionId')::uuid is distinct from draft_uuid then
    raise exception 'publish_layout_version wrapper must return the published layout id.';
  end if;

  if (select id from public.locations where floor_id = fixture.floor_id and code = fixture.first_location_code) is distinct from fixture.first_location_id then
    raise exception 'Same-code wrapper publish must preserve locations.id.';
  end if;

  -- 15. Moved same-code republish still works without mappings.
  select * into fixture from pg_temp.create_publish_rename_fixture('moved same code wrapper', 1);
  previous_slot_id := fixture.first_slot_id;
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '01', 1);

  update public.racks
  set x = x + 25,
      y = y + 15
  where layout_version_id = draft_uuid;

  perform public.publish_layout_version(draft_uuid, null);

  if (select id from public.locations where floor_id = fixture.floor_id and code = fixture.first_location_code) is distinct from fixture.first_location_id then
    raise exception 'Moved same-code wrapper publish must preserve locations.id.';
  end if;

  if (select geometry_slot_id from public.locations where id = fixture.first_location_id) = previous_slot_id then
    raise exception 'Moved same-code wrapper publish must update geometry_slot_id.';
  end if;

  -- 18. Invalid payload rejects: not an array and array item not an object.
  select * into fixture from pg_temp.create_publish_rename_fixture('invalid payload not array', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  perform pg_temp.expect_rename_publish_error(draft_uuid, '{}'::jsonb, 'PUBLISH_LAYOUT_RENAME_INVALID_PAYLOAD');

  select * into fixture from pg_temp.create_publish_rename_fixture('invalid payload item', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  perform pg_temp.expect_rename_publish_error(draft_uuid, jsonb_build_array(to_jsonb('not-an-object'::text)), 'PUBLISH_LAYOUT_RENAME_INVALID_PAYLOAD');

  -- 19. Blank old code rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('blank old', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(jsonb_build_object('old_code', '  ', 'new_code', new_code)),
    'PUBLISH_LAYOUT_RENAME_BLANK_CODE'
  );

  -- 20. Blank new code rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('blank new', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(jsonb_build_object('old_code', fixture.first_location_code, 'new_code', null)),
    'PUBLISH_LAYOUT_RENAME_BLANK_CODE'
  );

  -- 21. Same old/new code rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('same old new', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '01', 1);
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(jsonb_build_object('old_code', fixture.first_location_code, 'new_code', fixture.first_location_code)),
    'PUBLISH_LAYOUT_RENAME_SAME_CODE'
  );

  -- 22. Duplicate old code rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('duplicate old', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(
      jsonb_build_object('old_code', fixture.first_location_code, 'new_code', 'X-01'),
      jsonb_build_object('old_code', fixture.first_location_code, 'new_code', 'X-02')
    ),
    'PUBLISH_LAYOUT_RENAME_DUPLICATE_OLD_CODE'
  );

  -- 23. Duplicate new code rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('duplicate new', 2);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 2);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(
      jsonb_build_object('old_code', fixture.first_location_code, 'new_code', new_code),
      jsonb_build_object('old_code', fixture.second_location_code, 'new_code', new_code)
    ),
    'PUBLISH_LAYOUT_RENAME_DUPLICATE_NEW_CODE'
  );

  -- 24. Old code not in current published layout rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('old not published', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(jsonb_build_object('old_code', 'NOT-PUBLISHED', 'new_code', new_code)),
    'PUBLISH_LAYOUT_RENAME_OLD_CODE_NOT_PUBLISHED'
  );

  -- 25. Old location row not found rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('old location disabled', 1);
  update public.locations
  set status = 'disabled'
  where id = fixture.first_location_id;
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(jsonb_build_object('old_code', fixture.first_location_code, 'new_code', new_code)),
    'PUBLISH_LAYOUT_RENAME_OLD_LOCATION_NOT_FOUND'
  );

  -- 26. New code not in regenerated draft cells rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('new not in draft', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(jsonb_build_object('old_code', fixture.first_location_code, 'new_code', 'NOT-IN-DRAFT')),
    'PUBLISH_LAYOUT_RENAME_NEW_CODE_NOT_IN_DRAFT'
  );

  -- 27. Old code still exists unchanged in draft rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('old still draft', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '01', 2);
  second_new_code := left(fixture.first_location_code, length(fixture.first_location_code) - 2) || '02';
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(jsonb_build_object('old_code', fixture.first_location_code, 'new_code', second_new_code)),
    'PUBLISH_LAYOUT_RENAME_OLD_CODE_STILL_IN_DRAFT'
  );

  -- 28. Target active location exists rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('target active exists', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');
  insert into public.locations (tenant_id, floor_id, code, location_type, capacity_mode, status)
  values (fixture.tenant_id, fixture.floor_id, new_code, 'floor', 'single_container', 'active');
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(jsonb_build_object('old_code', fixture.first_location_code, 'new_code', new_code)),
    'PUBLISH_LAYOUT_RENAME_TARGET_LOCATION_EXISTS'
  );

  -- 29. Target disabled location exists rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('target disabled exists', 1);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 1);
  new_code := pg_temp.rename_code(fixture.first_location_code, '02');
  insert into public.locations (tenant_id, floor_id, code, location_type, capacity_mode, status)
  values (fixture.tenant_id, fixture.floor_id, new_code, 'floor', 'single_container', 'disabled');
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(jsonb_build_object('old_code', fixture.first_location_code, 'new_code', new_code)),
    'PUBLISH_LAYOUT_RENAME_TARGET_LOCATION_EXISTS'
  );

  -- 30. Chain/cycle mapping rejects.
  select * into fixture from pg_temp.create_publish_rename_fixture('chain unsupported', 2);
  draft_uuid := pg_temp.create_rename_draft(fixture.floor_id, '02', 2);
  second_new_code := pg_temp.rename_code(fixture.second_location_code, '02');
  perform pg_temp.expect_rename_publish_error(
    draft_uuid,
    jsonb_build_array(
      jsonb_build_object('old_code', fixture.first_location_code, 'new_code', fixture.second_location_code),
      jsonb_build_object('old_code', fixture.second_location_code, 'new_code', second_new_code)
    ),
    'PUBLISH_LAYOUT_RENAME_CHAIN_OR_CYCLE_UNSUPPORTED'
  );
end
$$;

rollback;
