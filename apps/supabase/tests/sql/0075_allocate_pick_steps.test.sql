-- 0075_allocate_pick_steps.test.sql
--
-- Verifies the allocation policy enforced by allocate_pick_steps():
--   1. allocates step when primary_pick assignment + stock exist
--   2. marks needs_replenishment when no primary_pick assignment exists
--   3. marks needs_replenishment when assignment exists but stock is insufficient
--   4. does NOT allocate from a reserve role row
--   5. skips already-allocated steps (idempotency)
--   6. raises PICK_TASK_NOT_FOUND for unknown task id
--
-- Infrastructure note
-- ───────────────────
-- Uses location_type = 'floor' for all locations so that no geometry slot
-- or published layout is required.  geometry_slot_id is NULL for floor
-- locations, so source_cell_id will be NULL on allocated steps — this is
-- correct behaviour for non-rack-slot location types.
--
-- All mutations are wrapped in a transaction that is rolled back at the end,
-- leaving the database clean.

begin;

do $$
declare
  -- Identity
  default_tenant_uuid  uuid;
  actor_uuid           uuid := gen_random_uuid();

  -- Warehouse topology
  site_uuid            uuid := gen_random_uuid();
  floor_uuid           uuid := gen_random_uuid();
  location_a_uuid      uuid;   -- primary_pick location for product_a
  location_b_uuid      uuid;   -- reserve-only location for product_a
  location_c_uuid      uuid;   -- primary_pick for product_c (no stock)

  -- Containers
  container_a_uuid     uuid;   -- placed at location_a, holds product_a stock
  container_b_uuid     uuid;   -- placed at location_b (reserve), holds product_a stock

  -- Products
  product_a_uuid       uuid := gen_random_uuid();
  product_b_uuid       uuid := gen_random_uuid();   -- no primary_pick assignment
  product_c_uuid       uuid := gen_random_uuid();   -- assigned to location_c but no stock

  -- Inventory
  iu_a_uuid            uuid;   -- product_a, qty=10, available, in container_a (primary_pick)
  iu_b_uuid            uuid;   -- product_a, qty=5,  available, in container_b (reserve only)

  -- Orders / tasks
  order_uuid           uuid := gen_random_uuid();
  line_a_uuid          uuid := gen_random_uuid();   -- product_a, qty=3
  line_b_uuid          uuid := gen_random_uuid();   -- product_b (no assignment)
  line_c_uuid          uuid := gen_random_uuid();   -- product_c (assignment, no stock)
  task_uuid            uuid;
  step_a_uuid          uuid;   -- pending, for line_a
  step_b_uuid          uuid;   -- pending, for line_b
  step_c_uuid          uuid;   -- pending, for line_c

  -- Allocation results
  result               jsonb;
  pallet_type_uuid     uuid;
begin
  -- ── Resolve default tenant ─────────────────────────────────────────────────
  select id into default_tenant_uuid from public.tenants where code = 'default';
  if default_tenant_uuid is null then
    raise exception 'Test precondition failed: default tenant not found.';
  end if;

  select id into pallet_type_uuid from public.container_types where code = 'pallet';
  if pallet_type_uuid is null then
    raise exception 'Test precondition failed: pallet container type not found.';
  end if;

  -- ── Actor + auth context ───────────────────────────────────────────────────
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  ) values (
    actor_uuid, 'pr09-actor@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  -- ── Products ───────────────────────────────────────────────────────────────
  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values
    (product_a_uuid, 'test-suite', 'pr09-a', 'SKU-PR09-A', 'PR-09 Product A', true),
    (product_b_uuid, 'test-suite', 'pr09-b', 'SKU-PR09-B', 'PR-09 Product B', true),
    (product_c_uuid, 'test-suite', 'pr09-c', 'SKU-PR09-C', 'PR-09 Product C', true);

  -- ── Warehouse topology ─────────────────────────────────────────────────────
  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PR09-SITE', 'PR-09 Site', 'UTC');

  insert into public.floors (id, tenant_id, site_id, name, ordinal)
  values (floor_uuid, default_tenant_uuid, site_uuid, 'PR-09 Floor', 1);

  -- location_type = 'floor': no geometry_slot_id required, no published layout
  -- needed.  source_cell_id will be NULL on allocated steps — valid.
  insert into public.locations
    (tenant_id, floor_id, code, location_type, capacity_mode, status)
  values
    (default_tenant_uuid, floor_uuid, 'PR09-L-A', 'floor', 'single_container', 'active'),
    (default_tenant_uuid, floor_uuid, 'PR09-L-B', 'floor', 'single_container', 'active'),
    (default_tenant_uuid, floor_uuid, 'PR09-L-C', 'floor', 'single_container', 'active');

  select id into location_a_uuid from public.locations where code = 'PR09-L-A';
  select id into location_b_uuid from public.locations where code = 'PR09-L-B';
  select id into location_c_uuid from public.locations where code = 'PR09-L-C';

  -- ── Containers at locations ────────────────────────────────────────────────
  -- Insert directly with current_location_id set; bypasses RLS (test runner
  -- is superuser) and is equivalent to a post-placement state.
  insert into public.containers
    (tenant_id, external_code, container_type_id, status,
     current_location_id, current_location_entered_at)
  values
    (default_tenant_uuid, 'PR09-CONT-A', pallet_type_uuid, 'active',
     location_a_uuid, now()),
    (default_tenant_uuid, 'PR09-CONT-B', pallet_type_uuid, 'active',
     location_b_uuid, now());

  select id into container_a_uuid from public.containers where external_code = 'PR09-CONT-A';
  select id into container_b_uuid from public.containers where external_code = 'PR09-CONT-B';

  -- ── Inventory units ────────────────────────────────────────────────────────
  insert into public.inventory_unit
    (tenant_id, container_id, product_id, quantity, uom, status)
  values
    (default_tenant_uuid, container_a_uuid, product_a_uuid, 10, 'pcs', 'available'),
    (default_tenant_uuid, container_b_uuid, product_a_uuid,  5, 'pcs', 'available');

  select id into iu_a_uuid
  from public.inventory_unit
  where container_id = container_a_uuid and product_id = product_a_uuid;

  select id into iu_b_uuid
  from public.inventory_unit
  where container_id = container_b_uuid and product_id = product_a_uuid;

  -- ── Product-location role assignments ──────────────────────────────────────
  -- product_a → location_a: primary_pick  (eligible for allocation)
  -- product_a → location_b: reserve       (must NOT be used for allocation)
  -- product_c → location_c: primary_pick  (assigned, but no stock in location_c)
  insert into public.product_location_roles
    (tenant_id, product_id, location_id, role, state)
  values
    (default_tenant_uuid, product_a_uuid, location_a_uuid, 'primary_pick', 'published'),
    (default_tenant_uuid, product_a_uuid, location_b_uuid, 'reserve',      'published'),
    (default_tenant_uuid, product_c_uuid, location_c_uuid, 'primary_pick', 'published');
  -- product_b has no assignment at all.

  -- ── Order + lines ──────────────────────────────────────────────────────────
  insert into public.orders (id, tenant_id, status)
  values (order_uuid, default_tenant_uuid, 'released');

  insert into public.order_lines
    (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
  values
    (line_a_uuid, order_uuid, default_tenant_uuid,
     'SKU-PR09-A', 'PR-09 Product A', 3, product_a_uuid, 'released'),
    (line_b_uuid, order_uuid, default_tenant_uuid,
     'SKU-PR09-B', 'PR-09 Product B', 1, product_b_uuid, 'released'),
    (line_c_uuid, order_uuid, default_tenant_uuid,
     'SKU-PR09-C', 'PR-09 Product C', 2, product_c_uuid, 'released');

  -- ── Pick task + steps ──────────────────────────────────────────────────────
  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps
    (id, task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, status)
  values
    (gen_random_uuid(), task_uuid, default_tenant_uuid, order_uuid, line_a_uuid, 1,
     'SKU-PR09-A', 'PR-09 Product A', 3, 'pending'),
    (gen_random_uuid(), task_uuid, default_tenant_uuid, order_uuid, line_b_uuid, 2,
     'SKU-PR09-B', 'PR-09 Product B', 1, 'pending'),
    (gen_random_uuid(), task_uuid, default_tenant_uuid, order_uuid, line_c_uuid, 3,
     'SKU-PR09-C', 'PR-09 Product C', 2, 'pending');

  select id into step_a_uuid
  from public.pick_steps where task_id = task_uuid and order_line_id = line_a_uuid;

  select id into step_b_uuid
  from public.pick_steps where task_id = task_uuid and order_line_id = line_b_uuid;

  select id into step_c_uuid
  from public.pick_steps where task_id = task_uuid and order_line_id = line_c_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 1: happy path — allocate three pending steps in one call
  -- ════════════════════════════════════════════════════════════════════════════
  result := public.allocate_pick_steps(task_uuid);

  if (result ->> 'taskId')::uuid <> task_uuid then
    raise exception 'Test 1 failed: expected taskId = % in result, got %',
      task_uuid, result ->> 'taskId';
  end if;

  if (result ->> 'allocated')::int <> 1 then
    raise exception 'Test 1 failed: expected allocated = 1 (only product_a has eligible stock), got %',
      result ->> 'allocated';
  end if;

  if (result ->> 'needsReplenishment')::int <> 2 then
    raise exception 'Test 1 failed: expected needsReplenishment = 2, got %',
      result ->> 'needsReplenishment';
  end if;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 2: step_a is now allocated with the correct source fields
  -- ════════════════════════════════════════════════════════════════════════════
  if not exists (
    select 1
    from public.pick_steps
    where id                 = step_a_uuid
      and status             = 'pending'
      and inventory_unit_id  = iu_a_uuid
      and source_container_id = container_a_uuid
  ) then
    raise exception 'Test 2 failed: step_a must be pending with iu_a and container_a set as source.';
  end if;

  -- source_cell_id must be NULL for floor-type location (geometry_slot_id is NULL)
  if exists (
    select 1
    from public.pick_steps
    where id = step_a_uuid and source_cell_id is not null
  ) then
    raise exception 'Test 2 failed: source_cell_id must be null for floor-type location.';
  end if;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 3: step_b (product_b — no primary_pick assignment) → needs_replenishment
  -- ════════════════════════════════════════════════════════════════════════════
  if not exists (
    select 1
    from public.pick_steps
    where id     = step_b_uuid
      and status = 'needs_replenishment'
  ) then
    raise exception 'Test 3 failed: step_b must become needs_replenishment when no primary_pick exists.';
  end if;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 4: step_c (product_c — assignment exists but no stock) → needs_replenishment
  -- ════════════════════════════════════════════════════════════════════════════
  if not exists (
    select 1
    from public.pick_steps
    where id     = step_c_uuid
      and status = 'needs_replenishment'
  ) then
    raise exception 'Test 4 failed: step_c must become needs_replenishment when no available stock in assigned location.';
  end if;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 5: reserve role row for product_a (location_b) must not be used
  --         iu_b (container_b at location_b) must NOT appear on any step
  -- ════════════════════════════════════════════════════════════════════════════
  if exists (
    select 1
    from public.pick_steps
    where task_id           = task_uuid
      and inventory_unit_id = iu_b_uuid
  ) then
    raise exception 'Test 5 failed: reserve-role location must not be used for allocation.';
  end if;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 6: idempotency — re-running allocation must not change already-resolved steps
  -- ════════════════════════════════════════════════════════════════════════════
  result := public.allocate_pick_steps(task_uuid);

  -- step_a already has inventory_unit_id set → skipped → allocated = 0
  if (result ->> 'allocated')::int <> 0 then
    raise exception 'Test 6 failed: re-running allocation must not re-allocate already-allocated steps; got allocated = %',
      result ->> 'allocated';
  end if;

  -- needs_replenishment steps are skipped too (status != pending)
  if (result ->> 'needsReplenishment')::int <> 0 then
    raise exception 'Test 6 failed: re-running must not re-process needs_replenishment steps; got needsReplenishment = %',
      result ->> 'needsReplenishment';
  end if;

  -- step_a must still point to iu_a (not re-allocated to something else)
  if not exists (
    select 1
    from public.pick_steps
    where id = step_a_uuid and inventory_unit_id = iu_a_uuid
  ) then
    raise exception 'Test 6 failed: step_a inventory_unit_id must remain iu_a after re-run.';
  end if;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 7: PICK_TASK_NOT_FOUND for unknown task uuid
  -- ════════════════════════════════════════════════════════════════════════════
  begin
    perform public.allocate_pick_steps(gen_random_uuid());
    raise exception 'Test 7 failed: expected PICK_TASK_NOT_FOUND for unknown task.';
  exception
    when others then
      if sqlerrm <> 'PICK_TASK_NOT_FOUND' then
        raise;
      end if;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 8: PICK_TASK_NOT_FOUND when caller is not a tenant manager
  -- ════════════════════════════════════════════════════════════════════════════
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text)::text,
    true
  );

  begin
    perform public.allocate_pick_steps(task_uuid);
    raise exception 'Test 8 failed: expected PICK_TASK_NOT_FOUND for unauthorized caller.';
  exception
    when others then
      if sqlerrm <> 'PICK_TASK_NOT_FOUND' then
        raise;
      end if;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 9: insufficient quantity — step requires more than available in a single unit
  -- ════════════════════════════════════════════════════════════════════════════
  -- Restore actor context
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  declare
    order2_uuid     uuid := gen_random_uuid();
    line_big_uuid   uuid := gen_random_uuid();
    task2_uuid      uuid;
    step_big_uuid   uuid;
    result2         jsonb;
  begin
    insert into public.orders (id, tenant_id, status)
    values (order2_uuid, default_tenant_uuid, 'released');

    -- qty_required = 50 > iu_a.quantity (10), so no single unit satisfies it
    insert into public.order_lines
      (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values
      (line_big_uuid, order2_uuid, default_tenant_uuid,
       'SKU-PR09-A', 'PR-09 Product A', 50, product_a_uuid, 'released');

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', order2_uuid, 'ready')
    returning id into task2_uuid;

    insert into public.pick_steps
      (task_id, tenant_id, order_id, order_line_id, sequence_no,
       sku, item_name, qty_required, status)
    values
      (task2_uuid, default_tenant_uuid, order2_uuid, line_big_uuid, 1,
       'SKU-PR09-A', 'PR-09 Product A', 50, 'pending');

    select id into step_big_uuid
    from public.pick_steps where task_id = task2_uuid;

    result2 := public.allocate_pick_steps(task2_uuid);

    if (result2 ->> 'needsReplenishment')::int <> 1 then
      raise exception 'Test 9 failed: step requiring qty > single unit must become needs_replenishment; got %',
        result2 ->> 'needsReplenishment';
    end if;

    if not exists (
      select 1
      from public.pick_steps
      where id = step_big_uuid and status = 'needs_replenishment'
    ) then
      raise exception 'Test 9 failed: step_big must be needs_replenishment.';
    end if;
  end;

end
$$;

rollback;
