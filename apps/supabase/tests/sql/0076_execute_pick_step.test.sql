-- 0076_execute_pick_step.test.sql
--
-- Integration tests for execute_pick_step() and pick_full_inventory_unit().
--
-- Test matrix
-- ─────────────
--  1. Full-pick path: qty_actual == iu.quantity → unit moved to pick container,
--                     step = 'picked', movement written, task = 'completed'
--  2. Partial-pick path: qty_actual < qty_required → split applied, step = 'partial',
--                        task = 'in_progress' (second step still pending)
--  3. Split-pick-sufficient: qty_actual == qty_required < iu.quantity → split used,
--                            step = 'picked'
--  4. Task rollup: last step terminal → task transitions to 'completed'
--  5. Task rollup with exceptions: pre-existing exception step → 'completed_with_exceptions'
--  6. Order rollup: task completes cleanly → order.status = 'picked'
--  7. Guard: needs_replenishment step → PICK_STEP_NOT_EXECUTABLE
--  8. Guard: already terminal step → PICK_STEP_NOT_EXECUTABLE
--  9. Guard: qty_actual = 0 → INVALID_PICK_QUANTITY
-- 10. Guard: qty_actual > iu.quantity → PICK_QUANTITY_EXCEEDS_AVAILABLE
--
-- State management note
-- ─────────────────────
-- Tests 1, 3, 4, 5 bring the single-step task to completion which triggers the
-- order rollup on order_uuid.  Each of those tests explicitly resets order.status
-- back to 'picking' in its cleanup block so subsequent tests start with a clean slate.
--
-- All mutations are rolled back at the end.

begin;

do $$
declare
  -- Identity
  default_tenant_uuid  uuid;
  actor_uuid           uuid := gen_random_uuid();
  pallet_type_uuid     uuid;

  -- Warehouse topology
  site_uuid            uuid := gen_random_uuid();
  floor_uuid           uuid := gen_random_uuid();
  source_location_uuid uuid;

  -- Containers
  source_container_uuid uuid;   -- holds allocated stock
  pick_container_uuid   uuid;   -- picker's tote (unplaced)

  -- Product
  product_uuid         uuid := gen_random_uuid();

  -- Shared order + line (reused across tests; status reset in cleanup)
  order_uuid           uuid := gen_random_uuid();
  order_line_uuid      uuid := gen_random_uuid();

  -- Per-test variables
  iu_uuid              uuid;
  task_uuid            uuid;
  step_uuid            uuid;
  result               jsonb;
  iu_qty_after         numeric;
  iu_container_after   uuid;
  pick_iu_qty          numeric;
begin
  -- ── Resolve anchors ─────────────────────────────────────────────────────────
  select id into default_tenant_uuid from public.tenants where code = 'default';
  if default_tenant_uuid is null then
    raise exception 'Test precondition failed: default tenant not found.';
  end if;

  select id into pallet_type_uuid from public.container_types where code = 'pallet';
  if pallet_type_uuid is null then
    raise exception 'Test precondition failed: pallet container type not found.';
  end if;

  -- ── Auth context ─────────────────────────────────────────────────────────────
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  ) values (
    actor_uuid, 'pr10-actor@wos.test', now(), now(), now(),
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

  -- ── Product ──────────────────────────────────────────────────────────────────
  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values (product_uuid, 'test-suite', 'pr10-p', 'SKU-PR10', 'PR-10 Product', true);

  -- ── Warehouse topology ───────────────────────────────────────────────────────
  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PR10-SITE', 'PR-10 Site', 'UTC');

  insert into public.floors (id, tenant_id, site_id, name, ordinal)
  values (floor_uuid, default_tenant_uuid, site_uuid, 'PR-10 Floor', 1);

  insert into public.locations
    (tenant_id, floor_id, code, location_type, capacity_mode, status)
  values
    (default_tenant_uuid, floor_uuid, 'PR10-SRC', 'floor', 'single_container', 'active');

  select id into source_location_uuid from public.locations where code = 'PR10-SRC';

  -- ── Containers ───────────────────────────────────────────────────────────────
  -- Source container is placed at source_location
  insert into public.containers
    (tenant_id, external_code, container_type_id, status,
     current_location_id, current_location_entered_at)
  values
    (default_tenant_uuid, 'PR10-SRC-CONT', pallet_type_uuid, 'active',
     source_location_uuid, now());

  -- Pick container (picker's tote) is unplaced — no current_location_id
  insert into public.containers
    (tenant_id, external_code, container_type_id, status)
  values
    (default_tenant_uuid, 'PR10-PICK-TOTE', pallet_type_uuid, 'active');

  select id into source_container_uuid
  from public.containers where external_code = 'PR10-SRC-CONT';

  select id into pick_container_uuid
  from public.containers where external_code = 'PR10-PICK-TOTE';

  -- ── Shared order + line ──────────────────────────────────────────────────────
  insert into public.orders (id, tenant_id, status)
  values (order_uuid, default_tenant_uuid, 'picking');

  insert into public.order_lines
    (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
  values
    (order_line_uuid, order_uuid, default_tenant_uuid,
     'SKU-PR10', 'PR-10 Product', 3, product_uuid, 'released');

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 1: full-pick path — qty_actual == iu.quantity
  --
  --   Expected:
  --   • IU moved wholesale to pick container (container_id reassigned)
  --   • IU quantity unchanged
  --   • pick_partial stock movement written
  --   • Step: status='picked', qty_picked=5, executed_at set
  --   • Task: single step terminal → 'completed'
  -- ════════════════════════════════════════════════════════════════════════════

  insert into public.inventory_unit
    (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, source_container_uuid, product_uuid, 5, 'pcs', 'available')
  returning id into iu_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
     'SKU-PR10', 'PR-10 Product', 3, iu_uuid, source_container_uuid, 'pending')
  returning id into step_uuid;

  result := public.execute_pick_step(step_uuid, 5, pick_container_uuid, actor_uuid);

  if (result ->> 'stepId')::uuid <> step_uuid then
    raise exception 'Test 1 failed: wrong stepId. Got: %', result;
  end if;
  if result ->> 'status' <> 'picked' then
    raise exception 'Test 1 failed: expected step status=picked, got %', result ->> 'status';
  end if;
  if (result ->> 'qtyPicked')::int <> 5 then
    raise exception 'Test 1 failed: expected qtyPicked=5, got %', result ->> 'qtyPicked';
  end if;
  if result ->> 'taskStatus' <> 'completed' then
    raise exception 'Test 1 failed: expected taskStatus=completed, got %', result ->> 'taskStatus';
  end if;

  -- IU must now live in pick container
  select container_id into iu_container_after from public.inventory_unit where id = iu_uuid;
  if iu_container_after <> pick_container_uuid then
    raise exception 'Test 1 failed: IU should be in pick_container, found %', iu_container_after;
  end if;

  -- IU quantity unchanged (unit was moved, not split)
  select quantity into iu_qty_after from public.inventory_unit where id = iu_uuid;
  if iu_qty_after <> 5 then
    raise exception 'Test 1 failed: IU quantity should be 5, got %', iu_qty_after;
  end if;

  -- Step row updated with audit fields
  if not exists (
    select 1 from public.pick_steps
    where id               = step_uuid
      and status           = 'picked'
      and qty_picked       = 5
      and pick_container_id = pick_container_uuid
      and executed_at is not null
      and executed_by      = actor_uuid
  ) then
    raise exception 'Test 1 failed: pick_steps row not updated correctly.';
  end if;

  -- pick_partial stock movement created before container_id was changed
  if not exists (
    select 1 from public.stock_movements
    where movement_type            = 'pick_partial'
      and source_container_id      = source_container_uuid
      and target_container_id      = pick_container_uuid
      and source_inventory_unit_id = iu_uuid
      and quantity                 = 5
  ) then
    raise exception 'Test 1 failed: expected pick_partial movement not found.';
  end if;

  -- Cleanup
  delete from public.pick_steps  where task_id = task_uuid;
  delete from public.pick_tasks  where id      = task_uuid;
  delete from public.inventory_unit where id   = iu_uuid;
  delete from public.stock_movements
  where source_container_id = source_container_uuid
     or target_container_id = pick_container_uuid;
  -- Restore order to 'picking' (rollup set it to 'picked')
  update public.orders set status = 'picking' where id = order_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 2: partial-pick path — qty_actual < qty_required
  --
  --   Expected:
  --   • Source IU quantity reduced by qty_actual (split applied)
  --   • New/merged IU appears in pick container
  --   • Step: status='partial'
  --   • Task: 2 steps, 1 partial + 1 pending → 'in_progress'
  -- ════════════════════════════════════════════════════════════════════════════

  insert into public.inventory_unit
    (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, source_container_uuid, product_uuid, 10, 'pcs', 'available')
  returning id into iu_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  -- Step 1: allocated and to be executed
  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
     'SKU-PR10', 'PR-10 Product', 3, iu_uuid, source_container_uuid, 'pending')
  returning id into step_uuid;

  -- Step 2: still pending (not yet allocated)
  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 2,
     'SKU-PR10', 'PR-10 Product', 1, 'pending');

  -- Take only 1 of 3 required
  result := public.execute_pick_step(step_uuid, 1, pick_container_uuid, actor_uuid);

  if result ->> 'status' <> 'partial' then
    raise exception 'Test 2 failed: expected status=partial, got %', result ->> 'status';
  end if;

  -- Source IU reduced by 1 (split)
  select quantity into iu_qty_after from public.inventory_unit where id = iu_uuid;
  if iu_qty_after <> 9 then
    raise exception 'Test 2 failed: source IU should be 9, got %', iu_qty_after;
  end if;

  -- New IU in pick container with qty=1
  select quantity into pick_iu_qty
  from public.inventory_unit
  where container_id = pick_container_uuid and product_id = product_uuid;
  if pick_iu_qty <> 1 then
    raise exception 'Test 2 failed: expected qty=1 in pick container, got %', pick_iu_qty;
  end if;

  -- Task still in_progress (step 2 is pending)
  if result ->> 'taskStatus' <> 'in_progress' then
    raise exception 'Test 2 failed: expected taskStatus=in_progress, got %',
      result ->> 'taskStatus';
  end if;

  -- Cleanup (no order rollup occurred, no order reset needed)
  delete from public.pick_steps  where task_id = task_uuid;
  delete from public.pick_tasks  where id      = task_uuid;
  delete from public.inventory_unit where id   = iu_uuid;
  delete from public.inventory_unit
  where container_id = pick_container_uuid and product_id = product_uuid;
  delete from public.stock_movements
  where source_container_id = source_container_uuid
     or target_container_id = pick_container_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 3: qty_actual == qty_required < iu.quantity
  --         Split path used, but step outcome = 'picked' (order qty satisfied)
  -- ════════════════════════════════════════════════════════════════════════════

  insert into public.inventory_unit
    (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, source_container_uuid, product_uuid, 10, 'pcs', 'available')
  returning id into iu_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
     'SKU-PR10', 'PR-10 Product', 3, iu_uuid, source_container_uuid, 'pending')
  returning id into step_uuid;

  -- qty_actual=3 == qty_required=3, but iu.quantity=10 → split path
  result := public.execute_pick_step(step_uuid, 3, pick_container_uuid, actor_uuid);

  if result ->> 'status' <> 'picked' then
    raise exception 'Test 3 failed: expected status=picked, got %', result ->> 'status';
  end if;

  -- Source IU reduced to 7
  select quantity into iu_qty_after from public.inventory_unit where id = iu_uuid;
  if iu_qty_after <> 7 then
    raise exception 'Test 3 failed: source IU should be 7, got %', iu_qty_after;
  end if;

  -- Cleanup
  delete from public.pick_steps  where task_id = task_uuid;
  delete from public.pick_tasks  where id      = task_uuid;
  delete from public.inventory_unit where id   = iu_uuid;
  delete from public.inventory_unit
  where container_id = pick_container_uuid and product_id = product_uuid;
  delete from public.stock_movements
  where source_container_id = source_container_uuid
     or target_container_id = pick_container_uuid;
  update public.orders set status = 'picking' where id = order_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 4: task rollup — both steps executed cleanly → task = 'completed'
  -- ════════════════════════════════════════════════════════════════════════════

  declare
    iu_b_uuid   uuid;
    step_b_uuid uuid;
    result2     jsonb;
  begin
    insert into public.inventory_unit
      (tenant_id, container_id, product_id, quantity, uom, status)
    values
      (default_tenant_uuid, source_container_uuid, product_uuid, 5, 'pcs', 'available'),
      (default_tenant_uuid, source_container_uuid, product_uuid, 4, 'pcs', 'available');

    -- Identify the two IUs by ascending created_at
    select id into iu_uuid
    from public.inventory_unit
    where container_id = source_container_uuid and product_id = product_uuid
    order by created_at, id
    limit 1;

    select id into iu_b_uuid
    from public.inventory_unit
    where container_id = source_container_uuid and product_id = product_uuid
    order by created_at, id
    offset 1 limit 1;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', order_uuid, 'ready')
    returning id into task_uuid;

    insert into public.pick_steps
      (task_id, tenant_id, order_id, order_line_id, sequence_no,
       sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
    values
      (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
       'SKU-PR10', 'PR-10 Product', 3, iu_uuid, source_container_uuid, 'pending')
    returning id into step_uuid;

    insert into public.pick_steps
      (task_id, tenant_id, order_id, order_line_id, sequence_no,
       sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
    values
      (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 2,
       'SKU-PR10', 'PR-10 Product', 2, iu_b_uuid, source_container_uuid, 'pending')
    returning id into step_b_uuid;

    -- Full-pick both steps
    result  := public.execute_pick_step(step_uuid,  5, pick_container_uuid, actor_uuid);
    result2 := public.execute_pick_step(step_b_uuid, 4, pick_container_uuid, actor_uuid);

    if result2 ->> 'taskStatus' <> 'completed' then
      raise exception 'Test 4 failed: expected taskStatus=completed, got %',
        result2 ->> 'taskStatus';
    end if;

    if not exists (
      select 1 from public.pick_tasks
      where id = task_uuid and status = 'completed' and completed_at is not null
    ) then
      raise exception 'Test 4 failed: pick_tasks row not marked completed.';
    end if;

    -- Cleanup
    delete from public.pick_steps  where task_id = task_uuid;
    delete from public.pick_tasks  where id      = task_uuid;
    delete from public.inventory_unit
    where container_id = source_container_uuid and product_id = product_uuid;
    delete from public.inventory_unit
    where container_id = pick_container_uuid and product_id = product_uuid;
    delete from public.stock_movements
    where source_container_id = source_container_uuid
       or target_container_id = pick_container_uuid;
    update public.orders set status = 'picking' where id = order_uuid;
  end;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 5: task rollup with exceptions → 'completed_with_exceptions'
  --         One executed step ('picked') + one pre-existing 'exception' step.
  -- ════════════════════════════════════════════════════════════════════════════

  insert into public.inventory_unit
    (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, source_container_uuid, product_uuid, 5, 'pcs', 'available')
  returning id into iu_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
     'SKU-PR10', 'PR-10 Product', 3, iu_uuid, source_container_uuid, 'pending')
  returning id into step_uuid;

  -- A second step already in exception state (e.g., scanner error recorded earlier)
  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 2,
     'SKU-PR10', 'PR-10 Product', 1, 'exception');

  result := public.execute_pick_step(step_uuid, 5, pick_container_uuid, actor_uuid);

  if result ->> 'taskStatus' <> 'completed_with_exceptions' then
    raise exception 'Test 5 failed: expected completed_with_exceptions, got %',
      result ->> 'taskStatus';
  end if;

  -- Cleanup
  delete from public.pick_steps  where task_id = task_uuid;
  delete from public.pick_tasks  where id      = task_uuid;
  delete from public.inventory_unit where id   = iu_uuid;
  delete from public.inventory_unit
  where container_id = pick_container_uuid and product_id = product_uuid;
  delete from public.stock_movements
  where source_container_id = source_container_uuid
     or target_container_id = pick_container_uuid;
  -- Order received 'partial' rollup from completed_with_exceptions; restore
  update public.orders set status = 'picking' where id = order_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 6: order rollup — single task completes cleanly → order = 'picked'
  -- ════════════════════════════════════════════════════════════════════════════

  insert into public.inventory_unit
    (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, source_container_uuid, product_uuid, 5, 'pcs', 'available')
  returning id into iu_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
     'SKU-PR10', 'PR-10 Product', 5, iu_uuid, source_container_uuid, 'pending')
  returning id into step_uuid;

  result := public.execute_pick_step(step_uuid, 5, pick_container_uuid, actor_uuid);

  if result ->> 'orderStatus' <> 'picked' then
    raise exception 'Test 6 failed: expected orderStatus=picked in result, got %',
      result ->> 'orderStatus';
  end if;

  if not exists (
    select 1 from public.orders where id = order_uuid and status = 'picked'
  ) then
    raise exception 'Test 6 failed: order.status should be picked.';
  end if;

  -- Cleanup
  delete from public.pick_steps  where task_id = task_uuid;
  delete from public.pick_tasks  where id      = task_uuid;
  delete from public.inventory_unit where id   = iu_uuid;
  delete from public.inventory_unit
  where container_id = pick_container_uuid and product_id = product_uuid;
  delete from public.stock_movements
  where source_container_id = source_container_uuid
     or target_container_id = pick_container_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 7: needs_replenishment step raises PICK_STEP_NOT_EXECUTABLE
  -- ════════════════════════════════════════════════════════════════════════════

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
     'SKU-PR10', 'PR-10 Product', 3, 'needs_replenishment')
  returning id into step_uuid;

  begin
    perform public.execute_pick_step(step_uuid, 3, pick_container_uuid, actor_uuid);
    raise exception 'Test 7 failed: expected PICK_STEP_NOT_EXECUTABLE but no error raised.';
  exception
    when others then
      if sqlerrm <> 'PICK_STEP_NOT_EXECUTABLE' then
        raise exception 'Test 7 failed: wrong error. Expected PICK_STEP_NOT_EXECUTABLE, got: %',
          sqlerrm;
      end if;
  end;

  delete from public.pick_steps where task_id = task_uuid;
  delete from public.pick_tasks where id      = task_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 8: already terminal step raises PICK_STEP_NOT_EXECUTABLE
  -- ════════════════════════════════════════════════════════════════════════════

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, qty_picked, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
     'SKU-PR10', 'PR-10 Product', 3, 3, 'picked')
  returning id into step_uuid;

  begin
    perform public.execute_pick_step(step_uuid, 3, pick_container_uuid, actor_uuid);
    raise exception 'Test 8 failed: expected PICK_STEP_NOT_EXECUTABLE but no error raised.';
  exception
    when others then
      if sqlerrm <> 'PICK_STEP_NOT_EXECUTABLE' then
        raise exception 'Test 8 failed: wrong error. Expected PICK_STEP_NOT_EXECUTABLE, got: %',
          sqlerrm;
      end if;
  end;

  delete from public.pick_steps where task_id = task_uuid;
  delete from public.pick_tasks where id      = task_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 9: qty_actual = 0 raises INVALID_PICK_QUANTITY
  -- ════════════════════════════════════════════════════════════════════════════

  insert into public.inventory_unit
    (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, source_container_uuid, product_uuid, 5, 'pcs', 'available')
  returning id into iu_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
     'SKU-PR10', 'PR-10 Product', 3, iu_uuid, source_container_uuid, 'pending')
  returning id into step_uuid;

  begin
    perform public.execute_pick_step(step_uuid, 0, pick_container_uuid, actor_uuid);
    raise exception 'Test 9 failed: expected INVALID_PICK_QUANTITY but no error raised.';
  exception
    when others then
      if sqlerrm <> 'INVALID_PICK_QUANTITY' then
        raise exception 'Test 9 failed: wrong error. Expected INVALID_PICK_QUANTITY, got: %',
          sqlerrm;
      end if;
  end;

  delete from public.pick_steps where task_id = task_uuid;
  delete from public.pick_tasks where id      = task_uuid;
  delete from public.inventory_unit where id  = iu_uuid;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Test 10: qty_actual > iu.quantity raises PICK_QUANTITY_EXCEEDS_AVAILABLE
  -- ════════════════════════════════════════════════════════════════════════════

  insert into public.inventory_unit
    (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, source_container_uuid, product_uuid, 2, 'pcs', 'available')
  returning id into iu_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps
    (task_id, tenant_id, order_id, order_line_id, sequence_no,
     sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
  values
    (task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
     'SKU-PR10', 'PR-10 Product', 3, iu_uuid, source_container_uuid, 'pending')
  returning id into step_uuid;

  begin
    perform public.execute_pick_step(step_uuid, 99, pick_container_uuid, actor_uuid);
    raise exception 'Test 10 failed: expected PICK_QUANTITY_EXCEEDS_AVAILABLE but no error raised.';
  exception
    when others then
      if sqlerrm <> 'PICK_QUANTITY_EXCEEDS_AVAILABLE' then
        raise exception
          'Test 10 failed: wrong error. Expected PICK_QUANTITY_EXCEEDS_AVAILABLE, got: %',
          sqlerrm;
      end if;
  end;

  delete from public.pick_steps where task_id = task_uuid;
  delete from public.pick_tasks where id      = task_uuid;
  delete from public.inventory_unit where id  = iu_uuid;

  -- ─────────────────────────────────────────────────────────────────────────────
  raise notice 'All 0076 execute_pick_step tests passed.';
end
$$;

rollback;
