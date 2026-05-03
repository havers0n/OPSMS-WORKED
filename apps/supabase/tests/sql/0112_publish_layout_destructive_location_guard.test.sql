begin;

create or replace function pg_temp.create_publish_guard_fixture(label text)
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
  cell_one record;
  cell_two record;
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
    'P1G-' || upper(substring(replace(site_uuid::text, '-', '') from 1 for 10)),
    'Phase 1 Guard ' || label,
    'UTC'
  );

  insert into public.floors (id, site_id, code, name, sort_order)
  values (
    floor_uuid,
    site_uuid,
    'P1G-' || upper(substring(replace(floor_uuid::text, '-', '') from 1 for 10)),
    'Phase 1 Guard ' || label,
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

  perform public.publish_layout_version(draft_uuid, null);

  select c.id, coalesce(c.address, c.cell_code) as code
  into cell_one
  from public.cells c
  where c.layout_version_id = draft_uuid
  order by c.slot_no
  limit 1;

  select c.id, coalesce(c.address, c.cell_code) as code
  into cell_two
  from public.cells c
  where c.layout_version_id = draft_uuid
  order by c.slot_no
  offset 1
  limit 1;

  if cell_one.id is null or cell_two.id is null then
    raise exception 'Expected two published cells for fixture %.', label;
  end if;

  return query
  select
    tenant_uuid,
    floor_uuid,
    draft_uuid,
    l1.id,
    cell_one.code,
    cell_one.id,
    l2.id,
    cell_two.code,
    cell_two.id
  from public.locations l1
  join public.locations l2
    on l2.floor_id = floor_uuid
   and l2.code = cell_two.code
  where l1.floor_id = floor_uuid
    and l1.code = cell_one.code;
end
$$;

create or replace function pg_temp.delete_second_slot_from_draft(draft_uuid uuid)
returns void
language sql
as $$
  update public.rack_levels rl
  set slot_count = 1
  from public.rack_sections rs
  join public.rack_faces rf on rf.id = rs.rack_face_id
  join public.racks r on r.id = rf.rack_id
  where rl.rack_section_id = rs.id
    and r.layout_version_id = draft_uuid;
$$;

create or replace function pg_temp.create_guard_product()
returns uuid
language plpgsql
as $$
declare
  product_uuid uuid := gen_random_uuid();
begin
  insert into public.products (id, source, external_product_id, sku, name)
  values (
    product_uuid,
    'phase1-guard',
    product_uuid::text,
    'P1G-' || upper(substring(replace(product_uuid::text, '-', '') from 1 for 10)),
    'Phase 1 Guard Product ' || product_uuid::text
  );

  return product_uuid;
end
$$;

create or replace function pg_temp.create_guard_pick_step(
  tenant_uuid uuid,
  source_location_uuid uuid,
  step_status text
)
returns void
language plpgsql
as $$
declare
  task_uuid uuid;
begin
  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (tenant_uuid, 'wave', gen_random_uuid(), 'ready')
  returning id into task_uuid;

  insert into public.pick_steps (
    task_id, tenant_id, sequence_no, sku, item_name, qty_required, status, source_location_id
  )
  values (
    task_uuid, tenant_uuid, 1, 'P1G-PICK', 'Phase 1 Guard Pick Item', 1, step_status, source_location_uuid
  );
end
$$;

create or replace function pg_temp.expect_destructive_publish_blocked(draft_uuid uuid, expected_fragment text)
returns void
language plpgsql
as $$
begin
  perform public.publish_layout_version(draft_uuid, null);
  raise exception 'Expected publish % to be blocked.', draft_uuid;
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
  status_text text;
  location_status_after text;
  location_id_after uuid;
  slot_id_after uuid;
  previous_slot_id uuid;
  reintroduced_slot_id uuid;
  location_count_after integer;
  active_location_count_after integer;
  published_count integer;
  product_role_count integer;
  sku_policy_count integer;
  location_policy_count integer;
  container_type_uuid uuid;
  product_uuid uuid;
begin
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'phase1-publish-guard@wos.test', now(), now(), now(),
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

  -- 1. Republish unchanged address preserves location.id and remaps geometry_slot_id.
  select * into fixture from pg_temp.create_publish_guard_fixture('unchanged');
  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform public.publish_layout_version(draft_uuid, null);

  select l.id, l.geometry_slot_id, l.status
  into location_id_after, slot_id_after, location_status_after
  from public.locations l
  where l.floor_id = fixture.floor_id
    and l.code = fixture.first_location_code;

  if location_id_after is distinct from fixture.first_location_id then
    raise exception 'Unchanged republish must preserve locations.id.';
  end if;

  if slot_id_after is null or slot_id_after = fixture.first_slot_id then
    raise exception 'Unchanged republish must update geometry_slot_id to the new cell.';
  end if;

  if location_status_after <> 'active' then
    raise exception 'Unchanged republish must keep the location active.';
  end if;

  -- 2. Republish moved same-code slot succeeds.
  previous_slot_id := slot_id_after;
  draft_uuid := public.create_layout_draft(fixture.floor_id, null);

  update public.racks
  set x = x + 100,
      y = y + 50
  where layout_version_id = draft_uuid;

  perform public.publish_layout_version(draft_uuid, null);

  select l.id, l.geometry_slot_id, l.status
  into location_id_after, slot_id_after, location_status_after
  from public.locations l
  where l.floor_id = fixture.floor_id
    and l.code = fixture.first_location_code;

  if location_id_after is distinct from fixture.first_location_id then
    raise exception 'Moved same-code slot must keep the canonical location row.';
  end if;

  if slot_id_after is null or slot_id_after = previous_slot_id then
    raise exception 'Moved same-code slot must update geometry_slot_id to the moved cell.';
  end if;

  if location_status_after <> 'active' then
    raise exception 'Moved same-code slot must keep the location active.';
  end if;

  -- 2a. Republish moved same-code slot preserves location-owned assortment and policies.
  select * into fixture from pg_temp.create_publish_guard_fixture('same code assortment');
  product_uuid := pg_temp.create_guard_product();

  insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
  values (fixture.tenant_id, product_uuid, fixture.first_location_id, 'primary_pick', 'published');

  insert into public.sku_location_policies (tenant_id, location_id, product_id, min_qty_each, max_qty_each, status)
  values (fixture.tenant_id, fixture.first_location_id, product_uuid, 1, 10, 'active');

  insert into public.location_policies (tenant_id, location_id, status)
  values (fixture.tenant_id, fixture.first_location_id, 'active');

  previous_slot_id := fixture.first_slot_id;
  draft_uuid := public.create_layout_draft(fixture.floor_id, null);

  update public.racks
  set x = x + 75,
      y = y + 25
  where layout_version_id = draft_uuid;

  perform public.publish_layout_version(draft_uuid, null);

  select l.id, l.geometry_slot_id, l.status
  into location_id_after, slot_id_after, location_status_after
  from public.locations l
  where l.floor_id = fixture.floor_id
    and l.code = fixture.first_location_code;

  if location_id_after is distinct from fixture.first_location_id then
    raise exception 'Same-code assortment publish must preserve locations.id.';
  end if;

  if slot_id_after is null or slot_id_after = previous_slot_id then
    raise exception 'Same-code assortment publish must remap geometry_slot_id to the new cell.';
  end if;

  if location_status_after <> 'active' then
    raise exception 'Same-code assortment publish must keep the location active.';
  end if;

  select count(*)
  into product_role_count
  from public.product_location_roles
  where tenant_id = fixture.tenant_id
    and product_id = product_uuid
    and location_id = fixture.first_location_id
    and state = 'published';

  if product_role_count <> 1 then
    raise exception 'Same-code publish must preserve product_location_roles by location_id.';
  end if;

  select count(*)
  into sku_policy_count
  from public.sku_location_policies
  where tenant_id = fixture.tenant_id
    and product_id = product_uuid
    and location_id = fixture.first_location_id
    and status = 'active';

  if sku_policy_count <> 1 then
    raise exception 'Same-code publish must preserve sku_location_policies by location_id.';
  end if;

  select count(*)
  into location_policy_count
  from public.location_policies
  where tenant_id = fixture.tenant_id
    and location_id = fixture.first_location_id
    and status = 'active';

  if location_policy_count <> 1 then
    raise exception 'Same-code publish must preserve location_policies by location_id.';
  end if;

  if exists (
    select 1
    from public.locations
    where geometry_slot_id = previous_slot_id
      and status = 'active'
  ) then
    raise exception 'Old cell id must not resolve an active location after same-code publish.';
  end if;

  -- 3. Republish deleted occupied slot is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('deleted occupied');

  insert into public.containers (tenant_id, external_code, container_type_id, status, current_location_id)
  values (fixture.tenant_id, 'P1G-OCC-' || substring(fixture.floor_id::text from 1 for 8), container_type_uuid, 'active', fixture.second_location_id);

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'containers.current_location_id');

  if (select state from public.layout_versions where id = fixture.published_layout_id) <> 'published' then
    raise exception 'Blocked occupied deletion must leave the previous layout published.';
  end if;

  -- 4. Republish renamed occupied slot is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('renamed occupied');

  insert into public.containers (tenant_id, external_code, container_type_id, status, current_location_id)
  values (fixture.tenant_id, 'P1G-REN-' || substring(fixture.floor_id::text from 1 for 8), container_type_uuid, 'active', fixture.first_location_id);

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);

  update public.racks
  set display_code = '77'
  where layout_version_id = draft_uuid;

  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'containers.current_location_id');

  -- 5. Republish deleted referenced stale location is blocked by floor/code, not geometry_slot_id.
  select * into fixture from pg_temp.create_publish_guard_fixture('stale geometry');

  alter table public.locations disable trigger validate_location_row;
  update public.locations
  set geometry_slot_id = null
  where id = fixture.second_location_id;
  alter table public.locations enable trigger validate_location_row;

  insert into public.containers (tenant_id, external_code, container_type_id, status, current_location_id)
  values (fixture.tenant_id, 'P1G-STL-' || substring(fixture.floor_id::text from 1 for 8), container_type_uuid, 'active', fixture.second_location_id);

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'containers.current_location_id');

  -- 6. Republish deleted location with product_location_roles is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('product role');
  product_uuid := pg_temp.create_guard_product();

  insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
  values (fixture.tenant_id, product_uuid, fixture.second_location_id, 'primary_pick', 'published');

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'product_location_roles.location_id');

  -- 7. Republish deleted location with sku_location_policies is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('sku policy');
  product_uuid := pg_temp.create_guard_product();

  insert into public.sku_location_policies (tenant_id, location_id, product_id, min_qty_each, max_qty_each, status)
  values (fixture.tenant_id, fixture.second_location_id, product_uuid, 1, 10, 'active');

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'sku_location_policies.location_id');

  -- 8. Republish deleted location with active location_policies is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('location policy');

  insert into public.location_policies (tenant_id, location_id, status)
  values (fixture.tenant_id, fixture.second_location_id, 'active');

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'location_policies.location_id');

  -- 9. Republish deleted location with active pick_steps statuses is blocked.
  foreach status_text in array array['pending', 'partial', 'needs_replenishment'] loop
    select * into fixture from pg_temp.create_publish_guard_fixture('pick step ' || status_text);

    perform pg_temp.create_guard_pick_step(fixture.tenant_id, fixture.second_location_id, status_text);

    draft_uuid := public.create_layout_draft(fixture.floor_id, null);
    perform pg_temp.delete_second_slot_from_draft(draft_uuid);
    perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'pick_steps.source_location_id');
  end loop;

  -- 10. Republish deleted location with pending stock movement source/target is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('stock movement source');

  insert into public.stock_movements (tenant_id, movement_type, source_location_id, status)
  values (fixture.tenant_id, 'receive', fixture.second_location_id, 'pending');

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'stock_movements.source_location_id');

  select * into fixture from pg_temp.create_publish_guard_fixture('stock movement target');

  insert into public.stock_movements (tenant_id, movement_type, target_location_id, status)
  values (fixture.tenant_id, 'receive', fixture.second_location_id, 'pending');

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'stock_movements.target_location_id');

  -- 11. Republish deleted location with active location-scoped packaging_profiles is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('packaging profile');
  product_uuid := pg_temp.create_guard_product();

  insert into public.packaging_profiles (
    tenant_id, product_id, code, name, profile_type, scope_type, scope_id, status
  )
  values (
    fixture.tenant_id,
    product_uuid,
    'P1G-PP-' || upper(substring(replace(product_uuid::text, '-', '') from 1 for 8)),
    'Phase 1 Guard Packaging Profile',
    'storage',
    'location',
    fixture.second_location_id,
    'active'
  );

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'packaging_profiles.scope_id');

  -- 12. Inactive or completed references on a deleted location do not block.
  select * into fixture from pg_temp.create_publish_guard_fixture('inactive references');
  product_uuid := pg_temp.create_guard_product();

  insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
  values (fixture.tenant_id, product_uuid, fixture.second_location_id, 'primary_pick', 'inactive');

  insert into public.sku_location_policies (tenant_id, location_id, product_id, min_qty_each, max_qty_each, status)
  values (fixture.tenant_id, fixture.second_location_id, product_uuid, 1, 10, 'inactive');

  insert into public.location_policies (tenant_id, location_id, status)
  values (fixture.tenant_id, fixture.second_location_id, 'inactive');

  foreach status_text in array array['picked', 'skipped', 'exception'] loop
    perform pg_temp.create_guard_pick_step(fixture.tenant_id, fixture.second_location_id, status_text);
  end loop;

  insert into public.stock_movements (tenant_id, movement_type, source_location_id, status)
  values (fixture.tenant_id, 'receive', fixture.second_location_id, 'done');

  insert into public.stock_movements (tenant_id, movement_type, target_location_id, status)
  values (fixture.tenant_id, 'receive', fixture.second_location_id, 'cancelled');

  insert into public.packaging_profiles (
    tenant_id, product_id, code, name, profile_type, scope_type, scope_id, status
  )
  values (
    fixture.tenant_id,
    product_uuid,
    'P1G-IN-' || upper(substring(replace(product_uuid::text, '-', '') from 1 for 8)),
    'Phase 1 Guard Inactive Packaging Profile',
    'storage',
    'location',
    fixture.second_location_id,
    'inactive'
  );

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform public.publish_layout_version(draft_uuid, null);

  if (select status from public.locations where id = fixture.second_location_id) <> 'disabled' then
    raise exception 'Deleted location with only inactive/completed references should be disabled after publish.';
  end if;

  -- 13. Republish deleted empty slot does not block.
  select * into fixture from pg_temp.create_publish_guard_fixture('deleted empty');
  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform public.publish_layout_version(draft_uuid, null);

  select count(*)
  into published_count
  from public.layout_versions
  where floor_id = fixture.floor_id
    and state = 'published';

  if published_count <> 1 then
    raise exception 'Deleted empty slot publish should leave exactly one published layout.';
  end if;

  if (select state from public.layout_versions where id = draft_uuid) <> 'published' then
    raise exception 'Deleted empty slot draft should publish successfully.';
  end if;

  select count(*)
  into location_count_after
  from public.locations l
  where l.floor_id = fixture.floor_id
    and l.code = fixture.second_location_code;

  if location_count_after <> 1 then
    raise exception 'Deleted empty slot must keep exactly one historical location row, found %.', location_count_after;
  end if;

  select l.status
  into location_status_after
  from public.locations l
  where l.id = fixture.second_location_id;

  if location_status_after <> 'disabled' then
    raise exception 'Deleted empty slot must disable the old location row, found status %.', location_status_after;
  end if;

  select count(*)
  into active_location_count_after
  from public.locations l
  where l.floor_id = fixture.floor_id
    and l.code = fixture.second_location_code
    and l.status = 'active';

  if active_location_count_after <> 0 then
    raise exception 'Deleted empty slot must not leave an active location for the removed code.';
  end if;

  if not exists (select 1 from public.locations l where l.id = fixture.second_location_id) then
    raise exception 'Deleted empty slot must not delete the historical location row.';
  end if;

  -- 14. Reintroducing a disabled removed code reuses and reactivates the location row.
  draft_uuid := public.create_layout_draft(fixture.floor_id, null);

  update public.rack_levels rl
  set slot_count = 2
  from public.rack_sections rs
  join public.rack_faces rf on rf.id = rs.rack_face_id
  join public.racks r on r.id = rf.rack_id
  where rl.rack_section_id = rs.id
    and r.layout_version_id = draft_uuid;

  perform public.publish_layout_version(draft_uuid, null);

  select c.id
  into reintroduced_slot_id
  from public.cells c
  where c.layout_version_id = draft_uuid
    and coalesce(c.address, c.cell_code) = fixture.second_location_code;

  if reintroduced_slot_id is null then
    raise exception 'Reintroduced draft must publish a cell for the removed code %.', fixture.second_location_code;
  end if;

  select l.id, l.geometry_slot_id, l.status
  into location_id_after, slot_id_after, location_status_after
  from public.locations l
  where l.floor_id = fixture.floor_id
    and l.code = fixture.second_location_code;

  if location_id_after is distinct from fixture.second_location_id then
    raise exception 'Reintroduced code must reuse the original locations.id.';
  end if;

  if location_status_after <> 'active' then
    raise exception 'Reintroduced code must reactivate the original location row, found status %.', location_status_after;
  end if;

  if slot_id_after is distinct from reintroduced_slot_id then
    raise exception 'Reintroduced code must remap geometry_slot_id to the newly published cell.';
  end if;

  if slot_id_after = fixture.second_slot_id then
    raise exception 'Reintroduced code must not keep the original archived geometry slot.';
  end if;

  select count(*)
  into location_count_after
  from public.locations l
  where l.floor_id = fixture.floor_id
    and l.code = fixture.second_location_code;

  if location_count_after <> 1 then
    raise exception 'Reintroduced code must still have exactly one location row, found %.', location_count_after;
  end if;
end
$$;

rollback;
