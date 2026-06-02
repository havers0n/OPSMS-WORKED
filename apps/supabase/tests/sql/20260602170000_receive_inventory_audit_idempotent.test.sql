begin;

create extension if not exists dblink;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  correlation_key_1 text := '11111111-1111-4111-8111-111111111111';
  correlation_key_2 text := '22222222-2222-4222-8222-222222222222';
  correlation_key_3 text := '33333333-3333-4333-8333-333333333333';
  container_uuid uuid;
  placed_container_uuid uuid;
  unplaced_container_uuid uuid;
  active_product_uuid uuid := gen_random_uuid();
  location_uuid uuid;
  receive_result jsonb;
  iu_id uuid;
  placed_iu_id uuid;
  sm_count integer;
  iu_count integer;
  cl_count integer;
begin
  select id into default_tenant_uuid from public.tenants where code = 'default';
  if default_tenant_uuid is null then
    raise exception 'Test precondition failed: default tenant is missing.';
  end if;

  select id into pallet_type_uuid from public.container_types where code = 'pallet' limit 1;
  if pallet_type_uuid is null then
    raise exception 'Test precondition failed: pallet container type is missing.';
  end if;

  insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, is_sso_user, raw_app_meta_data, raw_user_meta_data)
  values (actor_uuid, 'pr-p0b-actor@wos.test', now(), now(), now(), false, '{}', '{}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config('request.jwt.claims', json_build_object('sub', actor_uuid::text)::text, true);

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values (active_product_uuid, 'test-suite-p0b', 'pr-p0b-active', 'SKU-P0B-ACT', 'PR-P0B Active Product', true);

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values
    (default_tenant_uuid, 'PR-P0B-PLACED', pallet_type_uuid, 'active'),
    (default_tenant_uuid, 'PR-P0B-UNPLACED', pallet_type_uuid, 'active');

  select id into placed_container_uuid from public.containers where external_code = 'PR-P0B-PLACED';
  select id into unplaced_container_uuid from public.containers where external_code = 'PR-P0B-UNPLACED';

  insert into public.floors (site_id, code, name)
  select s.id, 'P0B-FLOOR', 'P0B Floor'
  from public.sites s
  limit 1;

  insert into public.locations (tenant_id, floor_id, code, location_type, capacity_mode, status)
  select default_tenant_uuid, f.id, 'P0B-LOC', 'floor', 'single_container', 'active'
  from public.floors f
  where f.code = 'P0B-FLOOR'
  limit 1;

  select id into location_uuid from public.locations where code = 'P0B-LOC';

  update public.containers set current_location_id = location_uuid
  where id = placed_container_uuid;

  -- ============================================================
  -- Test 1: receive creates one inventory_unit
  -- ============================================================
  receive_result := public.receive_inventory_unit(
    default_tenant_uuid, placed_container_uuid, active_product_uuid,
    10, 'pcs', null, 'loose', null, null,
    correlation_key_1
  );

  iu_id := (receive_result -> 'inventoryUnit' ->> 'id')::uuid;

  if iu_id is null then
    raise exception 'Test 1 FAIL: receive did not return an inventory unit id.';
  end if;

  if not exists (select 1 from public.inventory_unit where id = iu_id) then
    raise exception 'Test 1 FAIL: inventory_unit row not found after receive.';
  end if;

  raise notice 'Test 1 OK: receive creates one inventory_unit';

  -- ============================================================
  -- Test 2: receive creates one container_lines row
  -- ============================================================
  select count(*) into cl_count
  from public.container_lines
  where container_id = placed_container_uuid
    and receipt_correlation_key = correlation_key_1;

  if cl_count <> 1 then
    raise exception 'Test 2 FAIL: expected 1 container_lines row, got %', cl_count;
  end if;

  raise notice 'Test 2 OK: receive creates one container_lines row';

  -- ============================================================
  -- Test 3: receive creates one stock_movements row with movement_type='receive'
  -- ============================================================
  select count(*) into sm_count
  from public.stock_movements
  where target_inventory_unit_id = iu_id
    and movement_type = 'receive';

  if sm_count <> 1 then
    raise exception 'Test 3 FAIL: expected 1 stock_movements row, got %', sm_count;
  end if;

  raise notice 'Test 3 OK: receive creates one stock_movements row with movement_type=receive';

  -- ============================================================
  -- Test 4: movement references the created inventory unit
  -- ============================================================
  if not exists (
    select 1 from public.stock_movements
    where target_inventory_unit_id = iu_id
      and movement_type = 'receive'
  ) then
    raise exception 'Test 4 FAIL: stock_movement does not reference the inventory unit.';
  end if;

  raise notice 'Test 4 OK: movement references the created inventory unit';

  -- ============================================================
  -- Test 5: movement references the target container
  -- ============================================================
  if not exists (
    select 1 from public.stock_movements
    where target_container_id = placed_container_uuid
      and target_inventory_unit_id = iu_id
      and movement_type = 'receive'
  ) then
    raise exception 'Test 5 FAIL: stock_movement does not reference the target container.';
  end if;

  raise notice 'Test 5 OK: movement references the target container';

  -- ============================================================
  -- Test 6: receive into placed container stores target location correctly
  -- ============================================================
  if not exists (
    select 1 from public.stock_movements
    where target_inventory_unit_id = iu_id
      and target_location_id = location_uuid
      and movement_type = 'receive'
  ) then
    raise exception 'Test 6 FAIL: stock_movement target_location_id does not match container location.';
  end if;

  raise notice 'Test 6 OK: receive into placed container stores target location correctly';

  placed_iu_id := iu_id;

  -- ============================================================
  -- Test 7: receive into unplaced container — nullable target_location
  -- ============================================================
  receive_result := public.receive_inventory_unit(
    default_tenant_uuid, unplaced_container_uuid, active_product_uuid,
    5, 'pcs', null, 'loose', null, null,
    correlation_key_2
  );

  iu_id := (receive_result -> 'inventoryUnit' ->> 'id')::uuid;

  if not exists (
    select 1 from public.stock_movements
    where target_inventory_unit_id = iu_id
      and target_location_id is null
      and movement_type = 'receive'
  ) then
    raise exception 'Test 7 FAIL: unplaced container movement should have null target_location_id.';
  end if;

  raise notice 'Test 7 OK: receive into unplaced container has nullable target_location';

  -- ============================================================
  -- Test 8: retry with same correlation key returns the existing result
  -- ============================================================
  receive_result := public.receive_inventory_unit(
    default_tenant_uuid, placed_container_uuid, active_product_uuid,
    10, 'pcs', null, 'loose', null, null,
    correlation_key_1
  );

  if (receive_result -> 'inventoryUnit' ->> 'id')::uuid <> placed_iu_id then
    raise exception 'Test 8 FAIL: retry returned different inventory unit id.';
  end if;

  raise notice 'Test 8 OK: retry with same correlation key returns existing result';

  -- ============================================================
  -- Test 9: retry with same correlation key keeps inventory_unit count unchanged
  -- ============================================================
  select count(*) into iu_count
  from public.inventory_unit
  where container_id = placed_container_uuid
    and product_id = active_product_uuid;

  if iu_count <> 1 then
    raise exception 'Test 9 FAIL: retry should not create additional inventory_unit. Count: %', iu_count;
  end if;

  raise notice 'Test 9 OK: retry keeps inventory_unit count unchanged';

  -- ============================================================
  -- Test 10: retry with same correlation key keeps container_lines count unchanged
  -- ============================================================
  select count(*) into cl_count
  from public.container_lines
  where container_id = placed_container_uuid
    and receipt_correlation_key = correlation_key_1;

  if cl_count <> 1 then
    raise exception 'Test 10 FAIL: retry should not create additional container_lines. Count: %', cl_count;
  end if;

  raise notice 'Test 10 OK: retry keeps container_lines count unchanged';

  -- ============================================================
  -- Test 11: retry with same correlation key keeps stock_movements count unchanged
  -- ============================================================
  select count(*) into sm_count
  from public.stock_movements
  where target_container_id = placed_container_uuid
    and movement_type = 'receive';

  if sm_count <> 1 then
    raise exception 'Test 11 FAIL: retry should not create additional stock_movements. Count: %', sm_count;
  end if;

  raise notice 'Test 11 OK: retry keeps stock_movements count unchanged';

  -- ============================================================
  -- Test 12: different correlation key creates a new legitimate receive
  -- ============================================================
  receive_result := public.receive_inventory_unit(
    default_tenant_uuid, placed_container_uuid, active_product_uuid,
    3, 'pcs', null, 'loose', null, null,
    correlation_key_3
  );

  iu_id := (receive_result -> 'inventoryUnit' ->> 'id')::uuid;

  select count(*) into sm_count
  from public.stock_movements
  where target_container_id = placed_container_uuid
    and movement_type = 'receive';

  if sm_count <> 2 then
    raise exception 'Test 12 FAIL: new correlation key should create another receive movement. Count: %', sm_count;
  end if;

  raise notice 'Test 12 OK: different correlation key creates a new legitimate receive';

  -- ============================================================
  -- Test 13: cross-tenant container rejected
  -- ============================================================
  declare
    other_tenant_uuid uuid := gen_random_uuid();
    other_tenant_code text := 'p0b-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    other_container_uuid uuid;
  begin
    insert into public.tenants (id, code, name)
    values (other_tenant_uuid, other_tenant_code, 'PR-P0B Other Tenant');

    insert into public.containers (tenant_id, external_code, container_type_id, status)
    values (other_tenant_uuid, 'PR-P0B-OTHER', pallet_type_uuid, 'active');

    select id into other_container_uuid from public.containers where external_code = 'PR-P0B-OTHER';

    begin
      perform public.receive_inventory_unit(
        default_tenant_uuid, other_container_uuid, active_product_uuid,
        1, 'pcs', null, 'loose', null, null,
        gen_random_uuid()::text
      );
      raise exception 'Test 13 FAIL: cross-tenant receive should have been rejected.';
    exception
      when others then
        if sqlerrm <> 'CONTAINER_NOT_FOUND' then
          raise;
        end if;
    end;
  end;

  raise notice 'Test 13 OK: cross-tenant container rejected';

  -- cleanup dblink resources (none used in this test, but leaving hook for future)
  raise notice 'All PR-P0B SQL tests passed.';
end
$$;

rollback;
