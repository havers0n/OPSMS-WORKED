-- 0138_order_line_projection_on_pick_execution.test.sql
--
-- Verifies that execute_pick_step, skip_pick_step, and allocate_pick_steps
-- recalculate order_lines.qty_picked and order_lines.status truthfully.
--
-- Test matrix
-- ─────────────
--  1. Single-step full pick   → line qty_picked = required, status = 'picked'
--  2. Single-step partial pick → line qty_picked = actual,  status = 'partial'
--  3. Skipped step             → line qty_picked = 0,       status = 'skipped'
--  4. Multi-step same line     → sum aggregated, status = 'picked' at full
--  5. Exception status precedence → exception > partial
--  6. Replenishment status precedence → exception > partial
--  7. Skipped + pending        → status is NOT 'skipped'
--  8. All steps skipped        → status is 'skipped'
--  9. Allocation shortage      → order_line recalculated on needs_replenishment
-- 10. Tenant isolation         → cross-tenant fails
-- 11. End-to-end vertical slice → two lines, full + partial, all invariants
-- 12. Replenishment recovery → re-allocation clears exception status

begin;

do $$
declare
  default_tenant_uuid  uuid;
  actor_uuid           uuid := gen_random_uuid();
  other_tenant_uuid    uuid;
  other_actor_uuid     uuid := gen_random_uuid();
  pallet_type_uuid     uuid;
  site_uuid            uuid := gen_random_uuid();
  floor_uuid           uuid := gen_random_uuid();
  source_location_uuid uuid;
  pick_location_uuid   uuid;

  product_uuid         uuid := gen_random_uuid();

  source_container_uuid uuid;
  pick_container_uuid   uuid;

  order_uuid           uuid := gen_random_uuid();
  order_line_uuid      uuid := gen_random_uuid();

  receive_result       jsonb;
  iu_uuid              uuid;
  task_uuid            uuid;
  step_uuid            uuid;
  result               jsonb;
  line_status          text;
  line_qty             int;
begin
  select id into default_tenant_uuid
  from public.tenants where code = 'default';
  if default_tenant_uuid is null then
    raise exception 'Test precondition failed: default tenant not found.';
  end if;

  select id into pallet_type_uuid
  from public.container_types where code = 'pallet';
  if pallet_type_uuid is null then
    raise exception 'Test precondition failed: pallet container type not found.';
  end if;

  -- Create a second tenant for isolation tests
  insert into public.tenants (id, code, name)
  values (gen_random_uuid(), 'ISOLATION-TENANT', 'Isolation Tenant')
  returning id into other_tenant_uuid;

  -- 🎭 Auth context
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  ) values (
    actor_uuid, 'pr138-actor@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  -- Other-tenant actor
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  ) values (
    other_actor_uuid, 'pr138-other@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (other_tenant_uuid, other_actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  -- 📦 Product
  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values (product_uuid, 'test-suite', 'pr138-p', 'SKU-PR138', 'PR-138 Product', true);

  -- 🏗 Warehouse topology
  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PR138-SITE', 'PR-138 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'PR138-FLOOR', 'PR-138 Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  ) values (
    gen_random_uuid(), default_tenant_uuid, floor_uuid,
    'PR138-SOURCE', 'staging', 'single_container', 'active'
  );

  select id into source_location_uuid
  from public.locations where code = 'PR138-SOURCE';

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  ) values (
    gen_random_uuid(), default_tenant_uuid, floor_uuid,
    'PR138-PICK', 'staging', 'single_container', 'active'
  );

  select id into pick_location_uuid
  from public.locations where code = 'PR138-PICK';

  -- 🥫 Containers
  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status,
    current_location_id, current_location_entered_at
  ) values (
    gen_random_uuid(), default_tenant_uuid, 'PR138-SRC',
    pallet_type_uuid, 'active', source_location_uuid, now()
  );

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status
  ) values (
    gen_random_uuid(), default_tenant_uuid, 'PR138-PICK',
    pallet_type_uuid, 'active'
  );

  select id into source_container_uuid
  from public.containers where external_code = 'PR138-SRC';

  select id into pick_container_uuid
  from public.containers where external_code = 'PR138-PICK';

  -- 📋 Base order + line (reused; each test cleans up steps/tasks)
  insert into public.orders (id, tenant_id, external_number, status)
  values (order_uuid, default_tenant_uuid, 'PR138-ORDER', 'draft');

  insert into public.order_lines (
    id, order_id, tenant_id, sku, name, qty_required, product_id, status
  ) values (
    order_line_uuid, order_uuid, default_tenant_uuid,
    'SKU-PR138', 'PR-138 Product', 10, product_uuid, 'released'
  );

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);
  perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

  update public.orders
  set status = 'picking'
  where id = order_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 1: Single-step full pick
  --   Execute step with qty_actual = qty_required.
  --   Expected: order_line.qty_picked=10, order_line.status='picked'
  -- ════════════════════════════════════════════════════════════════════════════

  receive_result := public.receive_inventory_unit(
    tenant_uuid  => default_tenant_uuid,
    container_uuid  => source_container_uuid,
    product_uuid    => product_uuid,
    quantity     => 10,
    uom          => 'pcs',
    actor_uuid   => actor_uuid,
    receipt_correlation_key => 'PR138-T1-001'
  );

  iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(iu_uuid, actor_uuid);

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps (
    task_id, tenant_id, order_id, order_line_id, sequence_no,
    sku, item_name, qty_required, inventory_unit_id, source_container_id, status
  ) values (
    task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
    'SKU-PR138', 'PR-138 Product', 10, iu_uuid, source_container_uuid, 'pending'
  ) returning id into step_uuid;

  result := public.execute_pick_step(step_uuid, 10, pick_container_uuid, actor_uuid);

  select status, qty_picked into line_status, line_qty
  from public.order_lines where id = order_line_uuid;

  if line_qty <> 10 then
    raise exception 'Test 1 failed: expected qty_picked=10, got %', line_qty;
  end if;
  if line_status <> 'picked' then
    raise exception 'Test 1 failed: expected status=picked, got %', line_status;
  end if;

  -- Reset for next tests
  delete from public.pick_steps where task_id = task_uuid;
  delete from public.pick_tasks where id = task_uuid;
  delete from public.stock_movements;
  delete from public.inventory_unit where container_line_id in (
    select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
  );
  delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
  update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;
  update public.orders set status = 'picking' where id = order_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 2: Single-step partial pick
  --   Execute step with qty_actual=3 < qty_required=10.
  --   Expected: order_line.qty_picked=3, order_line.status='partial'
  -- ════════════════════════════════════════════════════════════════════════════

  receive_result := public.receive_inventory_unit(
    tenant_uuid  => default_tenant_uuid,
    container_uuid  => source_container_uuid,
    product_uuid    => product_uuid,
    quantity     => 10,
    uom          => 'pcs',
    actor_uuid   => actor_uuid,
    receipt_correlation_key => 'PR138-T2-001'
  );

  iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(iu_uuid, actor_uuid);

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps (
    task_id, tenant_id, order_id, order_line_id, sequence_no,
    sku, item_name, qty_required, inventory_unit_id, source_container_id, status
  ) values (
    task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
    'SKU-PR138', 'PR-138 Product', 10, iu_uuid, source_container_uuid, 'pending'
  ) returning id into step_uuid;

  result := public.execute_pick_step(step_uuid, 3, pick_container_uuid, actor_uuid);

  select status, qty_picked into line_status, line_qty
  from public.order_lines where id = order_line_uuid;

  if line_qty <> 3 then
    raise exception 'Test 2 failed: expected qty_picked=3, got %', line_qty;
  end if;
  if line_status <> 'partial' then
    raise exception 'Test 2 failed: expected status=partial, got %', line_status;
  end if;

  delete from public.pick_steps where task_id = task_uuid;
  delete from public.pick_tasks where id = task_uuid;
  delete from public.stock_movements;
  delete from public.inventory_unit where container_line_id in (
    select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
  );
  delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
  update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 3: Skipped step
  --   Skip a pending step.
  --   Expected: order_line.qty_picked=0, order_line.status='skipped'
  -- ════════════════════════════════════════════════════════════════════════════

  receive_result := public.receive_inventory_unit(
    tenant_uuid  => default_tenant_uuid,
    container_uuid  => source_container_uuid,
    product_uuid    => product_uuid,
    quantity     => 10,
    uom          => 'pcs',
    actor_uuid   => actor_uuid,
    receipt_correlation_key => 'PR138-T3-001'
  );

  iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(iu_uuid, actor_uuid);

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps (
    task_id, tenant_id, order_id, order_line_id, sequence_no,
    sku, item_name, qty_required, inventory_unit_id, source_container_id, status
  ) values (
    task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
    'SKU-PR138', 'PR-138 Product', 10, iu_uuid, source_container_uuid, 'pending'
  ) returning id into step_uuid;

  result := public.skip_pick_step(step_uuid, actor_uuid);

  select status, qty_picked into line_status, line_qty
  from public.order_lines where id = order_line_uuid;

  if line_qty <> 0 then
    raise exception 'Test 3 failed: expected qty_picked=0, got %', line_qty;
  end if;
  if line_status <> 'skipped' then
    raise exception 'Test 3 failed: expected status=skipped, got %', line_status;
  end if;

  delete from public.pick_steps where task_id = task_uuid;
  delete from public.pick_tasks where id = task_uuid;
  delete from public.stock_movements;
  delete from public.inventory_unit where container_line_id in (
    select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
  );
  delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
  update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 4: Multi-step same order_line — aggregation
  --   Two steps: step1 picks 3 (partial), step2 picks 7 (full) = 10 total.
  --   Expected after step1: qty_picked=3, status='partial'
  --   Expected after step2: qty_picked=10, status='picked'
  -- ════════════════════════════════════════════════════════════════════════════

  declare
    iu1_uuid  uuid;
    iu2_uuid  uuid;
    step2_uuid uuid;
  begin
    receive_result := public.receive_inventory_unit(
      tenant_uuid  => default_tenant_uuid,
      container_uuid  => source_container_uuid,
      product_uuid    => product_uuid,
      quantity     => 10,
      uom          => 'pcs',
      actor_uuid   => actor_uuid,
      receipt_correlation_key => 'PR138-T4-001'
    );
    iu1_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(iu1_uuid, actor_uuid);

    receive_result := public.receive_inventory_unit(
      tenant_uuid  => default_tenant_uuid,
      container_uuid  => source_container_uuid,
      product_uuid    => product_uuid,
      quantity     => 10,
      uom          => 'pcs',
      actor_uuid   => actor_uuid,
      receipt_correlation_key => 'PR138-T4-002'
    );
    iu2_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(iu2_uuid, actor_uuid);

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', order_uuid, 'ready')
    returning id into task_uuid;

    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, inventory_unit_id, source_container_id, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
      'SKU-PR138', 'PR-138 Product', 10, iu1_uuid, source_container_uuid, 'pending'
    ) returning id into step_uuid;

    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, inventory_unit_id, source_container_id, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 2,
      'SKU-PR138', 'PR-138 Product', 10, iu2_uuid, source_container_uuid, 'pending'
    ) returning id into step2_uuid;

    -- Step 1: pick 3 → expected partial
    result := public.execute_pick_step(step_uuid, 3, pick_container_uuid, actor_uuid);

    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = order_line_uuid;

    if line_qty <> 3 then
      raise exception 'Test 4a failed: expected qty_picked=3 after step1, got %', line_qty;
    end if;
    if line_status <> 'partial' then
      raise exception 'Test 4a failed: expected status=partial after step1, got %', line_status;
    end if;

    -- Step 2: pick 7 → total 10, expected picked
    result := public.execute_pick_step(step2_uuid, 7, pick_container_uuid, actor_uuid);

    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = order_line_uuid;

    if line_qty <> 10 then
      raise exception 'Test 4b failed: expected qty_picked=10 after step2, got %', line_qty;
    end if;
    if line_status <> 'picked' then
      raise exception 'Test 4b failed: expected status=picked after step2, got %', line_status;
    end if;

    delete from public.pick_steps where task_id = task_uuid;
    delete from public.pick_tasks where id = task_uuid;
    delete from public.stock_movements;
    delete from public.inventory_unit where container_line_id in (
      select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
    );
    delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
    update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;
    update public.orders set status = 'picking' where id = order_uuid;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 5: Exception status precedence
  --   Execute partial pick, then pre-mark another step as 'exception'.
  --   Expected: order_line.status = 'exception', qty_picked = partial sum
  -- ════════════════════════════════════════════════════════════════════════════

  declare
    iu5_uuid uuid;
  begin
    receive_result := public.receive_inventory_unit(
      tenant_uuid  => default_tenant_uuid,
      container_uuid  => source_container_uuid,
      product_uuid    => product_uuid,
      quantity     => 10,
      uom          => 'pcs',
      actor_uuid   => actor_uuid,
      receipt_correlation_key => 'PR138-T5-001'
    );
    iu5_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(iu5_uuid, actor_uuid);

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', order_uuid, 'ready')
    returning id into task_uuid;

    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, inventory_unit_id, source_container_id, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
      'SKU-PR138', 'PR-138 Product', 10, iu5_uuid, source_container_uuid, 'pending'
    ) returning id into step_uuid;

    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 2,
      'SKU-PR138', 'PR-138 Product', 5, 'exception'
    );

    -- Pick 3 of 10 required
    result := public.execute_pick_step(step_uuid, 3, pick_container_uuid, actor_uuid);

    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = order_line_uuid;

    if line_qty <> 3 then
      raise exception 'Test 5 failed: expected qty_picked=3, got %', line_qty;
    end if;
    if line_status <> 'exception' then
      raise exception 'Test 5 failed: expected status=exception, got %', line_status;
    end if;

    delete from public.pick_steps where task_id = task_uuid;
    delete from public.pick_tasks where id = task_uuid;
    delete from public.stock_movements;
    delete from public.inventory_unit where container_line_id in (
      select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
    );
    delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
    update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 6: Replenishment status precedence
  --   Execute partial pick, then allocate so a step becomes needs_replenishment.
  --   Expected: order_line.status = 'exception', qty_picked = partial sum
  -- ════════════════════════════════════════════════════════════════════════════

  declare
    iu6_uuid        uuid;
    repl_step_uuid  uuid;
    task2_uuid      uuid;
    loc_b_uuid      uuid;
    cont_b_uuid     uuid;
  begin
    receive_result := public.receive_inventory_unit(
      tenant_uuid  => default_tenant_uuid,
      container_uuid  => source_container_uuid,
      product_uuid    => product_uuid,
      quantity     => 10,
      uom          => 'pcs',
      actor_uuid   => actor_uuid,
      receipt_correlation_key => 'PR138-T6-001'
    );
    iu6_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(iu6_uuid, actor_uuid);

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', order_uuid, 'ready')
    returning id into task_uuid;

    -- Step 1: allocated and executable
    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, inventory_unit_id, source_container_id, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
      'SKU-PR138', 'PR-138 Product', 5, iu6_uuid, source_container_uuid, 'pending'
    ) returning id into step_uuid;

    -- Step 2: unallocated, will become needs_replenishment
    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 2,
      'SKU-PR138', 'PR-138 Product', 5, 'pending'
    ) returning id into repl_step_uuid;

    -- Step 2 has no product_id → cannot be allocated; but actually allocate_pick_steps
    -- filters on ol.product_id is not null. So step 2 won't match. We need a product
    -- that has NO primary_pick assignment.
    -- Let's instead directly set step 2 to needs_replenishment via allocate.
    -- For that, we need to set product_id on the order_line (it's already set) and
    -- ensure there's no eligible stock. We'll use the same product but a location
    -- without primary_pick role.

    -- Step 1: pick 3 → partial
    result := public.execute_pick_step(step_uuid, 3, pick_container_uuid, actor_uuid);

    -- Now manually set step 2 to needs_replenishment (simulating allocation shortage)
    update public.pick_steps
    set status = 'needs_replenishment'
    where id = repl_step_uuid;

    perform public._recalculate_order_line_projection(order_line_uuid);

    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = order_line_uuid;

    if line_qty <> 3 then
      raise exception 'Test 6 failed: expected qty_picked=3, got %', line_qty;
    end if;
    if line_status <> 'exception' then
      raise exception 'Test 6 failed: expected status=exception, got %', line_status;
    end if;

    delete from public.pick_steps where task_id = task_uuid;
    delete from public.pick_tasks where id = task_uuid;
    delete from public.stock_movements;
    delete from public.inventory_unit where container_line_id in (
      select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
    );
    delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
    update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 7: Skipped + pending → status is NOT 'skipped'
  --   Skip one step, leave another pending.
  --   Expected: order_line.status is preserved ('released'), not 'skipped'
  -- ════════════════════════════════════════════════════════════════════════════

  declare
    iu7_uuid  uuid;
    step7b_uuid uuid;
  begin
    receive_result := public.receive_inventory_unit(
      tenant_uuid  => default_tenant_uuid,
      container_uuid  => source_container_uuid,
      product_uuid    => product_uuid,
      quantity     => 10,
      uom          => 'pcs',
      actor_uuid   => actor_uuid,
      receipt_correlation_key => 'PR138-T7-001'
    );
    iu7_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(iu7_uuid, actor_uuid);

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', order_uuid, 'ready')
    returning id into task_uuid;

    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, inventory_unit_id, source_container_id, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
      'SKU-PR138', 'PR-138 Product', 5, iu7_uuid, source_container_uuid, 'pending'
    ) returning id into step_uuid;

    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 2,
      'SKU-PR138', 'PR-138 Product', 5, 'pending'
    ) returning id into step7b_uuid;

    -- Skip step 1, step 2 stays pending
    result := public.skip_pick_step(step_uuid, actor_uuid);

    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = order_line_uuid;

    if line_status = 'skipped' then
      raise exception 'Test 7 failed: status must NOT be skipped when pending steps remain, got %', line_status;
    end if;
    if line_qty <> 0 then
      raise exception 'Test 7 failed: expected qty_picked=0, got %', line_qty;
    end if;

    delete from public.pick_steps where task_id = task_uuid;
    delete from public.pick_tasks where id = task_uuid;
    delete from public.stock_movements;
    delete from public.inventory_unit where container_line_id in (
      select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
    );
    delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
    update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 8: All steps skipped → status = 'skipped'
  --   Create two steps, skip both.
  --   Expected: order_line.status = 'skipped', qty_picked = 0
  -- ════════════════════════════════════════════════════════════════════════════

  declare
    iu8_uuid  uuid;
    step8b_uuid uuid;
  begin
    receive_result := public.receive_inventory_unit(
      tenant_uuid  => default_tenant_uuid,
      container_uuid  => source_container_uuid,
      product_uuid    => product_uuid,
      quantity     => 10,
      uom          => 'pcs',
      actor_uuid   => actor_uuid,
      receipt_correlation_key => 'PR138-T8-001'
    );
    iu8_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(iu8_uuid, actor_uuid);

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', order_uuid, 'ready')
    returning id into task_uuid;

    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, inventory_unit_id, source_container_id, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
      'SKU-PR138', 'PR-138 Product', 5, iu8_uuid, source_container_uuid, 'pending'
    ) returning id into step_uuid;

    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 2,
      'SKU-PR138', 'PR-138 Product', 5, 'pending'
    ) returning id into step8b_uuid;

    -- Both steps skipped
    result := public.skip_pick_step(step_uuid, actor_uuid);
    result := public.skip_pick_step(step8b_uuid, actor_uuid);

    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = order_line_uuid;

    if line_status <> 'skipped' then
      raise exception 'Test 8 failed: expected status=skipped, got %', line_status;
    end if;
    if line_qty <> 0 then
      raise exception 'Test 8 failed: expected qty_picked=0, got %', line_qty;
    end if;

    delete from public.pick_steps where task_id = task_uuid;
    delete from public.pick_tasks where id = task_uuid;
    delete from public.stock_movements;
    delete from public.inventory_unit where container_line_id in (
      select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
    );
    delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
    update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 9: needs_replenishment → order_line recalculated
  --   Two pending steps, one simulated as needs_replenishment to verify
  --   that the projection helper correctly sets status to 'exception'.
  --   Verify the integration: allocate_pick_steps invokes the helper
  --   when it marks a step needs_replenishment.
  -- ════════════════════════════════════════════════════════════════════════════

  declare
    iu9_uuid  uuid;
  begin
    receive_result := public.receive_inventory_unit(
      tenant_uuid  => default_tenant_uuid,
      container_uuid  => source_container_uuid,
      product_uuid    => product_uuid,
      quantity     => 10,
      uom          => 'pcs',
      actor_uuid   => actor_uuid,
      receipt_correlation_key => 'PR138-T9-001'
    );
    iu9_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(iu9_uuid, actor_uuid);

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', order_uuid, 'ready')
    returning id into task_uuid;

    insert into public.pick_steps (
      task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, inventory_unit_id, source_container_id, status
    ) values (
      task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
      'SKU-PR138', 'PR-138 Product', 5, iu9_uuid, source_container_uuid, 'pending'
    ) returning id into step_uuid;

    -- Second step: simulate allocation shortage (directly set needs_replenishment
    -- as allocate_pick_steps would do, then call helper to verify).
    declare
      step9b_uuid uuid;
    begin
      insert into public.pick_steps (
        task_id, tenant_id, order_id, order_line_id, sequence_no,
        sku, item_name, qty_required, status
      ) values (
        task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 2,
        'SKU-PR138', 'PR-138 Product', 5, 'pending'
      ) returning id into step9b_uuid;

      update public.pick_steps
      set status = 'needs_replenishment'
      where id = step9b_uuid;

      perform public._recalculate_order_line_projection(order_line_uuid);

      select status, qty_picked into line_status, line_qty
      from public.order_lines where id = order_line_uuid;

      if line_qty <> 0 then
        raise exception 'Test 9a failed: expected qty_picked=0, got %', line_qty;
      end if;
      if line_status <> 'exception' then
        raise exception 'Test 9a failed: expected status=exception, got %', line_status;
      end if;
    end;

    -- Now test allocate_pick_steps integration:
    -- create a clean scenario where no stock exists for a product
    declare
      prod_b_uuid      uuid := gen_random_uuid();
      order_b_uuid     uuid := gen_random_uuid();
      line_b_uuid      uuid := gen_random_uuid();
      task_b_uuid      uuid;
      step_b_uuid      uuid;
      alloc_result     jsonb;
    begin
      insert into public.products (id, source, external_product_id, sku, name, is_active)
      values (prod_b_uuid, 'test-suite', 'pr138-9b', 'SKU-PR138-B', 'PR-138 Product B', true);

      insert into public.orders (id, tenant_id, external_number, status)
      values (order_b_uuid, default_tenant_uuid, 'PR138-T9B', 'draft');

      insert into public.order_lines (
        id, order_id, tenant_id, sku, name, qty_required, product_id, status
      ) values (
        line_b_uuid, order_b_uuid, default_tenant_uuid,
        'SKU-PR138-B', 'PR-138 Product B', 5, prod_b_uuid, 'released'
      );

      update public.orders set status = 'released' where id = order_b_uuid;

      insert into public.pick_tasks (tenant_id, source_type, source_id, status)
      values (default_tenant_uuid, 'order', order_b_uuid, 'ready')
      returning id into task_b_uuid;

      insert into public.pick_steps (
        id, task_id, tenant_id, order_id, order_line_id, sequence_no,
        sku, item_name, qty_required, status
      ) values (
        gen_random_uuid(), task_b_uuid, default_tenant_uuid, order_b_uuid, line_b_uuid, 1,
        'SKU-PR138-B', 'PR-138 Product B', 5, 'pending'
      ) returning id into step_b_uuid;

      -- No primary_pick for prod_b → allocate marks it needs_replenishment
      alloc_result := public.allocate_pick_steps(task_b_uuid);

      if (alloc_result ->> 'needsReplenishment')::int <> 1 then
        raise exception 'Test 9b failed: expected 1 needsReplenishment, got %',
          alloc_result ->> 'needsReplenishment';
      end if;

      select status, qty_picked into line_status, line_qty
      from public.order_lines where id = line_b_uuid;

      if line_qty <> 0 then
        raise exception 'Test 9b failed: expected qty_picked=0, got %', line_qty;
      end if;
      if line_status <> 'exception' then
        raise exception 'Test 9b failed: expected status=exception (from allocation shortage), got %', line_status;
      end if;

      delete from public.pick_steps where task_id = task_b_uuid;
      delete from public.pick_tasks where id = task_b_uuid;
    end;

    delete from public.pick_steps where task_id = task_uuid;
    delete from public.pick_tasks where id = task_uuid;
    delete from public.stock_movements;
    delete from public.inventory_unit where container_line_id in (
      select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
    );
    delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
    update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 10: Tenant isolation
  --   Cross-tenant actor cannot execute or skip steps.
  -- ════════════════════════════════════════════════════════════════════════════

  receive_result := public.receive_inventory_unit(
    tenant_uuid  => default_tenant_uuid,
    container_uuid  => source_container_uuid,
    product_uuid    => product_uuid,
    quantity     => 10,
    uom          => 'pcs',
    actor_uuid   => actor_uuid,
    receipt_correlation_key => 'PR138-T10-001'
  );

  iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(iu_uuid, actor_uuid);

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps (
    task_id, tenant_id, order_id, order_line_id, sequence_no,
    sku, item_name, qty_required, inventory_unit_id, source_container_id, status
  ) values (
    task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
    'SKU-PR138', 'PR-138 Product', 10, iu_uuid, source_container_uuid, 'pending'
  ) returning id into step_uuid;

  -- Switch to other-tenant actor
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', other_actor_uuid::text)::text,
    true
  );

  begin
    perform public.execute_pick_step(step_uuid, 10, pick_container_uuid, other_actor_uuid);
    raise exception 'Test 10 failed: expected PICK_TASK_NOT_FOUND for cross-tenant execute.';
  exception
    when others then
      if sqlerrm <> 'PICK_TASK_NOT_FOUND' then
        raise;
      end if;
  end;

  begin
    perform public.skip_pick_step(step_uuid, other_actor_uuid);
    raise exception 'Test 10 failed: expected PICK_TASK_NOT_FOUND for cross-tenant skip.';
  exception
    when others then
      if sqlerrm <> 'PICK_TASK_NOT_FOUND' then
        raise;
      end if;
  end;

  -- Restore actor context
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  delete from public.pick_steps where task_id = task_uuid;
  delete from public.pick_tasks where id = task_uuid;
  delete from public.stock_movements;
  delete from public.inventory_unit where container_line_id in (
    select id from public.container_lines where container_id in (source_container_uuid, pick_container_uuid)
  );
  delete from public.container_lines where container_id in (source_container_uuid, pick_container_uuid);
  update public.order_lines set qty_picked = 0, status = 'released' where id = order_line_uuid;
  update public.orders set status = 'picking' where id = order_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 11: End-to-end vertical slice
  --   Two order lines, release order, allocate, execute (full + partial).
  --   Verify: stock movements, inventory mutation, pick_task status,
  --   order status, order_lines.qty_picked, order_lines.status.
  -- ════════════════════════════════════════════════════════════════════════════

  declare
    e2e_product_b_uuid  uuid := gen_random_uuid();
    e2e_src_container   uuid;
    e2e_pick_container  uuid;
    e2e_order_uuid      uuid := gen_random_uuid();
    e2e_line_a_uuid     uuid := gen_random_uuid();
    e2e_line_b_uuid     uuid := gen_random_uuid();
    e2e_task_uuid       uuid;
    e2e_step_a_uuid     uuid;
    e2e_step_b_uuid     uuid;
    e2e_iu_a_uuid       uuid;
    e2e_iu_b_uuid       uuid;
    e2e_result          jsonb;
    sm_count            int;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (e2e_product_b_uuid, 'test-suite', 'pr138-e2e-b', 'SKU-PR138-B', 'PR-138 Product B', true);

    insert into public.containers (
      id, tenant_id, external_code, container_type_id, status,
      current_location_id, current_location_entered_at
    ) values (
      gen_random_uuid(), default_tenant_uuid, 'PR138-E2E-SRC',
      pallet_type_uuid, 'active', source_location_uuid, now()
    );

    insert into public.containers (
      id, tenant_id, external_code, container_type_id, status
    ) values (
      gen_random_uuid(), default_tenant_uuid, 'PR138-E2E-PICK',
      pallet_type_uuid, 'active'
    );

    select id into e2e_src_container
    from public.containers where external_code = 'PR138-E2E-SRC';

    select id into e2e_pick_container
    from public.containers where external_code = 'PR138-E2E-PICK';

    insert into public.orders (id, tenant_id, external_number, status)
    values (e2e_order_uuid, default_tenant_uuid, 'PR138-E2E', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values
      (e2e_line_a_uuid, e2e_order_uuid, default_tenant_uuid,
       'SKU-PR138', 'PR-138 Product', 10, product_uuid, 'pending'),
      (e2e_line_b_uuid, e2e_order_uuid, default_tenant_uuid,
       'SKU-PR138-B', 'PR-138 Product B', 5, e2e_product_b_uuid, 'pending');

    -- Receive inventory BEFORE commit_order_reservations (ATP check requires stock)
    receive_result := public.receive_inventory_unit(
      tenant_uuid  => default_tenant_uuid,
      container_uuid  => e2e_src_container,
      product_uuid    => product_uuid,
      quantity     => 20,
      uom          => 'pcs',
      actor_uuid   => actor_uuid,
      receipt_correlation_key => 'PR138-E2E-A-001'
    );
    e2e_iu_a_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(e2e_iu_a_uuid, actor_uuid);

    receive_result := public.receive_inventory_unit(
      tenant_uuid  => default_tenant_uuid,
      container_uuid  => e2e_src_container,
      product_uuid    => e2e_product_b_uuid,
      quantity     => 10,
      uom          => 'pcs',
      actor_uuid   => actor_uuid,
      receipt_correlation_key => 'PR138-E2E-B-001'
    );
    e2e_iu_b_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(e2e_iu_b_uuid, actor_uuid);

    perform public.commit_order_reservations(e2e_order_uuid);

    perform public.release_order(e2e_order_uuid);

    -- release_order already created a pick_task and pick_steps for this order
    select id into e2e_task_uuid
    from public.pick_tasks
    where source_type = 'order' and source_id = e2e_order_uuid;

    -- Set up product_location_roles for both products
    insert into public.product_location_roles
      (tenant_id, product_id, location_id, role, state)
    values
      (default_tenant_uuid, product_uuid, source_location_uuid, 'primary_pick', 'published'),
      (default_tenant_uuid, e2e_product_b_uuid, source_location_uuid, 'primary_pick', 'published');

    -- Allocate
    result := public.allocate_pick_steps(e2e_task_uuid);

    if (result ->> 'allocated')::int <> 2 then
      raise exception 'Test 11 failed: expected 2 allocated steps, got %', result ->> 'allocated';
    end if;

    -- Find step IDs
    select id into e2e_step_a_uuid
    from public.pick_steps
    where task_id = e2e_task_uuid and order_line_id = e2e_line_a_uuid;

    select id into e2e_step_b_uuid
    from public.pick_steps
    where task_id = e2e_task_uuid and order_line_id = e2e_line_b_uuid;

    -- Execute step A (full pick, 10 of 10)
    e2e_result := public.execute_pick_step(e2e_step_a_uuid, 10, e2e_pick_container, actor_uuid);

    if e2e_result ->> 'status' <> 'picked' then
      raise exception 'Test 11 failed: step A expected picked, got %', e2e_result ->> 'status';
    end if;

    -- Verify line A projection
    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = e2e_line_a_uuid;

    if line_qty <> 10 then
      raise exception 'Test 11 failed: line A expected qty_picked=10, got %', line_qty;
    end if;
    if line_status <> 'picked' then
      raise exception 'Test 11 failed: line A expected status=picked, got %', line_status;
    end if;

    -- Execute step B (partial pick, 3 of 5)
    e2e_result := public.execute_pick_step(e2e_step_b_uuid, 3, e2e_pick_container, actor_uuid);

    if e2e_result ->> 'status' <> 'partial' then
      raise exception 'Test 11 failed: step B expected partial, got %', e2e_result ->> 'status';
    end if;

    -- Verify line B projection
    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = e2e_line_b_uuid;

    if line_qty <> 3 then
      raise exception 'Test 11 failed: line B expected qty_picked=3, got %', line_qty;
    end if;
    if line_status <> 'partial' then
      raise exception 'Test 11 failed: line B expected status=partial, got %', line_status;
    end if;

    -- Stock movements exist for both picks
    select count(*) into sm_count
    from public.stock_movements
    where target_container_id = e2e_pick_container
      and movement_type = 'pick_partial';

    if sm_count <> 2 then
      raise exception 'Test 11 failed: expected 2 stock movements, got %', sm_count;
    end if;

    -- Pick task status (partial pick → completed_with_exceptions)
    if not exists (
      select 1 from public.pick_tasks
      where id = e2e_task_uuid and status = 'completed_with_exceptions'
    ) then
      raise exception 'Test 11 failed: pick_task should be completed_with_exceptions, got %',
        (select status from public.pick_tasks where id = e2e_task_uuid);
    end if;

    -- Order status (one full + one partial = 'partial')
    if not exists (
      select 1 from public.orders
      where id = e2e_order_uuid and status = 'partial'
    ) then
      raise exception 'Test 11 failed: order should be partial, got %',
        (select status from public.orders where id = e2e_order_uuid);
    end if;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 12: Replenishment recovery — re-allocation clears exception status
  --   Step flow:
  --     1. Create order_line with product, create pick_task + pending step
  --     2. Allocate → no stock/primary_pick → needs_replenishment → line='exception'
  --     3. Reset step to 'pending'
  --     4. Add stock + product_location_role
  --     5. Re-allocate → step allocated
  --     6. Verify: order_line status ≠ 'exception' (should be 'released')
  -- ════════════════════════════════════════════════════════════════════════════

  declare
    t12_prod_uuid      uuid := gen_random_uuid();
    t12_order_uuid     uuid := gen_random_uuid();
    t12_line_uuid      uuid := gen_random_uuid();
    t12_task_uuid      uuid;
    t12_step_uuid      uuid;
    t12_result         jsonb;
    t12_iu_uuid        uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (t12_prod_uuid, 'test-suite', 'pr138-t12', 'SKU-PR138-T12', 'PR-138 T12 Product', true);

    insert into public.orders (id, tenant_id, external_number, status)
    values (t12_order_uuid, default_tenant_uuid, 'PR138-T12', 'draft');

    insert into public.order_lines (
      id, order_id, tenant_id, sku, name, qty_required, product_id, status
    ) values (
      t12_line_uuid, t12_order_uuid, default_tenant_uuid,
      'SKU-PR138-T12', 'PR-138 T12 Product', 5, t12_prod_uuid, 'released'
    );

    update public.orders set status = 'released' where id = t12_order_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', t12_order_uuid, 'ready')
    returning id into t12_task_uuid;

    insert into public.pick_steps (
      id, task_id, tenant_id, order_id, order_line_id, sequence_no,
      sku, item_name, qty_required, status
    ) values (
      gen_random_uuid(), t12_task_uuid, default_tenant_uuid,
      t12_order_uuid, t12_line_uuid, 1,
      'SKU-PR138-T12', 'PR-138 T12 Product', 5, 'pending'
    ) returning id into t12_step_uuid;

    -- Step 2: Allocate → needs_replenishment (no stock + no primary_pick)
    t12_result := public.allocate_pick_steps(t12_task_uuid);

    if (t12_result ->> 'needsReplenishment')::int <> 1 then
      raise exception 'Test 12a failed: expected 1 needsReplenishment, got %',
        t12_result ->> 'needsReplenishment';
    end if;

    select status into line_status
    from public.order_lines where id = t12_line_uuid;

    if line_status <> 'exception' then
      raise exception 'Test 12a failed: expected status=exception after shortage, got %', line_status;
    end if;

    -- Step 3: Reset step to pending for re-allocation
    update public.pick_steps
    set status = 'pending'
    where id = t12_step_uuid;

    -- Step 4: Add stock + product_location_role
    receive_result := public.receive_inventory_unit(
      tenant_uuid     => default_tenant_uuid,
      container_uuid  => source_container_uuid,
      product_uuid    => t12_prod_uuid,
      quantity        => 10,
      uom             => 'pcs',
      actor_uuid      => actor_uuid,
      receipt_correlation_key => 'PR138-T12-001'
    );
    t12_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
    perform public.ensure_inventory_unit_current_container_line(t12_iu_uuid, actor_uuid);

    insert into public.product_location_roles
      (tenant_id, product_id, location_id, role, state)
    values
      (default_tenant_uuid, t12_prod_uuid, source_location_uuid, 'primary_pick', 'published')
    on conflict (tenant_id, product_id, location_id, role) where state = 'published'
    do nothing;

    -- Step 5: Re-allocate → should succeed
    t12_result := public.allocate_pick_steps(t12_task_uuid);

    if (t12_result ->> 'allocated')::int <> 1 then
      raise exception 'Test 12b failed: expected 1 allocated on re-allocate, got %',
        t12_result ->> 'allocated';
    end if;

    -- Step 6: Verify line is no longer 'exception'
    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = t12_line_uuid;

    if line_status = 'exception' then
      raise exception 'Test 12c failed: status should not be exception after recovery, got %', line_status;
    end if;

    delete from public.pick_steps where task_id = t12_task_uuid;
    delete from public.pick_tasks where id = t12_task_uuid;
  end;

  -- ─────────────────────────────────────────────────────────────────────────────
  raise notice 'All 0138 order-line projection tests passed.';
end
$$;

rollback;
