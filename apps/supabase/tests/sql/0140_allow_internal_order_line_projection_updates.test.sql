-- 0140_allow_internal_order_line_projection_updates.test.sql
--
-- Verifies that internal order-line projection reconciliation can update
-- qty_picked/status on committed orders without weakening the committed
-- order-line guard for ordinary demand edits.

begin;

do $$
declare
  default_tenant_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  other_tenant_uuid uuid := gen_random_uuid();
  other_actor_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;
  source_site_uuid uuid := gen_random_uuid();
  source_floor_uuid uuid := gen_random_uuid();
  source_location_uuid uuid := gen_random_uuid();
  pick_location_uuid uuid := gen_random_uuid();
  source_container_uuid uuid := gen_random_uuid();
  pick_container_uuid uuid := gen_random_uuid();
  product_uuid uuid := gen_random_uuid();
  other_product_uuid uuid := gen_random_uuid();
  shortage_product_uuid uuid := gen_random_uuid();
  recovery_product_uuid uuid := gen_random_uuid();
  receive_result jsonb;
  source_inventory_unit_uuid uuid;
  other_inventory_unit_uuid uuid;
  order_uuid uuid := gen_random_uuid();
  order_line_uuid uuid := gen_random_uuid();
  task_uuid uuid;
  step_uuid uuid;
  step_two_uuid uuid;
  allocate_result jsonb;
  execute_result jsonb;
  skip_result jsonb;
  line_status text;
  line_qty integer;
  step_status text;
  step_inventory_unit_uuid uuid;
  step_source_container_uuid uuid;
  step_source_location_uuid uuid;
  task_status text;
  order_status text;
  order_short_uuid uuid := gen_random_uuid();
  line_short_uuid uuid := gen_random_uuid();
  task_short_uuid uuid;
  step_short_uuid uuid;
  order_recovery_uuid uuid := gen_random_uuid();
  line_recovery_uuid uuid := gen_random_uuid();
  task_recovery_uuid uuid;
  step_recovery_uuid uuid;
  recovery_inventory_unit_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';
  if default_tenant_uuid is null then
    raise exception 'Test precondition failed: default tenant not found.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';
  if pallet_type_uuid is null then
    raise exception 'Test precondition failed: pallet container type not found.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  ) values (
    actor_uuid, 'pr140-actor@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  insert into public.tenants (id, code, name)
  values (other_tenant_uuid, 'PR140-OTHER-TENANT', 'PR140 Other Tenant');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  ) values (
    other_actor_uuid, 'pr140-other@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (other_tenant_uuid, other_actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );
  perform set_config('request.jwt.claim.sub', actor_uuid::text, true);

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (source_site_uuid, default_tenant_uuid, 'PR140-SITE', 'PR140 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (source_floor_uuid, source_site_uuid, 'PR140-FLOOR', 'PR140 Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  ) values
    (source_location_uuid, default_tenant_uuid, source_floor_uuid, 'PR140-SOURCE', 'staging', 'single_container', 'active'),
    (pick_location_uuid, default_tenant_uuid, source_floor_uuid, 'PR140-PICK', 'staging', 'single_container', 'active');

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at
  ) values (
    source_container_uuid, default_tenant_uuid, 'PR140-SRC', pallet_type_uuid, 'active', source_location_uuid, now()
  );

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status
  ) values (
    pick_container_uuid, default_tenant_uuid, 'PR140-PICK', pallet_type_uuid, 'active'
  );

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values
    (product_uuid, 'test-suite', 'pr140-product', 'SKU-PR140', 'PR140 Product', true),
    (other_product_uuid, 'test-suite', 'pr140-product-2', 'SKU-PR140-2', 'PR140 Product 2', true),
    (shortage_product_uuid, 'test-suite', 'pr140-product-short', 'SKU-PR140-SHORT', 'PR140 Short Product', true),
    (recovery_product_uuid, 'test-suite', 'pr140-product-recovery', 'SKU-PR140-RECOVERY', 'PR140 Recovery Product', true);

  insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
  values
    (default_tenant_uuid, product_uuid, source_location_uuid, 'primary_pick', 'published'),
    (default_tenant_uuid, other_product_uuid, source_location_uuid, 'primary_pick', 'published');

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => source_container_uuid,
    product_uuid => product_uuid,
    quantity => 10,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR140-ALLOC-001'
  );
  source_inventory_unit_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(source_inventory_unit_uuid, actor_uuid);

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => source_container_uuid,
    product_uuid => other_product_uuid,
    quantity => 10,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR140-ALLOC-002'
  );
  other_inventory_unit_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(other_inventory_unit_uuid, actor_uuid);

  -- Test 1-3: released order allocation succeeds, binds source inventory/container/location,
  -- and projection reconciliation no longer throws ORDER_NOT_EDITABLE_IN_READY.
  insert into public.orders (id, tenant_id, external_number, status)
  values (order_uuid, default_tenant_uuid, 'PR140-ALLOC', 'draft');

  insert into public.order_lines (
    id, order_id, tenant_id, sku, name, qty_required, product_id, status
  ) values (
    order_line_uuid, order_uuid, default_tenant_uuid, 'SKU-PR140', 'PR140 Product', 5, product_uuid, 'pending'
  );

  perform public.commit_order_reservations(order_uuid);
  task_uuid := public.release_order(order_uuid);
  perform set_config('wos.allow_committed_order_line_system_update', 'off', true);

  select id into step_uuid
  from public.pick_steps
  where task_id = task_uuid
  order by sequence_no
  limit 1;

  allocate_result := public.allocate_pick_steps(task_uuid);

  if (allocate_result ->> 'allocated')::int <> 1 then
    raise exception 'Test 1 failed: expected allocated=1, got %', allocate_result ->> 'allocated';
  end if;
  if (allocate_result ->> 'needsReplenishment')::int <> 0 then
    raise exception 'Test 1 failed: expected needsReplenishment=0, got %', allocate_result ->> 'needsReplenishment';
  end if;

  select
    ps.status,
    ps.inventory_unit_id,
    ps.source_container_id,
    ps.source_location_id,
    ol.status,
    ol.qty_picked,
    pt.status,
    o.status
  into
    step_status,
    step_inventory_unit_uuid,
    step_source_container_uuid,
    step_source_location_uuid,
    line_status,
    line_qty,
    task_status,
    order_status
  from public.pick_steps ps
  join public.order_lines ol on ol.id = ps.order_line_id
  join public.pick_tasks pt on pt.id = ps.task_id
  join public.orders o on o.id = ol.order_id
  where ps.id = step_uuid;

  if step_inventory_unit_uuid is null then
    raise exception 'Test 2 failed: expected inventory_unit_id to be bound.';
  end if;
  if step_source_container_uuid is null then
    raise exception 'Test 2 failed: expected source_container_id to be bound.';
  end if;
  if step_source_location_uuid is null then
    raise exception 'Test 2 failed: expected source_location_id to be bound.';
  end if;
  if step_status <> 'pending' then
    raise exception 'Test 3 failed: allocation should keep step pending, got %', step_status;
  end if;
  if line_status <> 'released' or line_qty <> 0 then
    raise exception 'Test 3 failed: expected released line projection qty=0 after successful allocation, got status=% qty=%', line_status, line_qty;
  end if;
  if task_status <> 'ready' or order_status <> 'released' then
    raise exception 'Test 3 failed: expected task ready and order released after allocation, got task=% order=%', task_status, order_status;
  end if;

  -- Test 9: helper bypass does not leak beyond its own update within the same transaction.
  begin
    update public.order_lines
    set qty_required = qty_required + 1
    where id = order_line_uuid;
    raise exception 'Test 9 failed: expected committed order-line demand edit to be rejected after helper execution.';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_EDITABLE_IN_READY' then
        raise;
      end if;
  end;

  -- Test 6: execute still updates truthful qty_picked/status.
  execute_result := public.execute_pick_step(step_uuid, 3, pick_container_uuid, actor_uuid);

  if execute_result ->> 'status' <> 'partial' then
    raise exception 'Test 6 failed: expected execute result status partial, got %', execute_result ->> 'status';
  end if;

  select status, qty_picked into line_status, line_qty
  from public.order_lines
  where id = order_line_uuid;

  if line_status <> 'partial' or line_qty <> 3 then
    raise exception 'Test 6 failed: expected line status partial qty=3, got status=% qty=%', line_status, line_qty;
  end if;

  -- Test 7: skip still updates truthful projection.
  insert into public.orders (id, tenant_id, external_number, status)
  values (gen_random_uuid(), default_tenant_uuid, 'PR140-SKIP-ORDER', 'draft')
  returning id into order_short_uuid;

  line_short_uuid := gen_random_uuid();

  insert into public.order_lines (
    id, order_id, tenant_id, sku, name, qty_required, product_id, status
  ) values (
    line_short_uuid, order_short_uuid, default_tenant_uuid, 'SKU-PR140-SKIP', 'PR140 Skip Product', 4, other_product_uuid, 'pending'
  );

  perform public.commit_order_reservations(order_short_uuid);
  task_short_uuid := public.release_order(order_short_uuid);
  perform set_config('wos.allow_committed_order_line_system_update', 'off', true);

  select id into step_short_uuid
  from public.pick_steps
  where task_id = task_short_uuid
  order by sequence_no
  limit 1;

  select inventory_unit_id into step_inventory_unit_uuid
  from public.pick_steps
  where id = step_short_uuid;

  if step_inventory_unit_uuid is not null then
    raise exception 'Test 7 precondition failed: skip scenario should start unallocated.';
  end if;

  update public.pick_steps
  set inventory_unit_id = other_inventory_unit_uuid,
      source_container_id = source_container_uuid,
      source_location_id = source_location_uuid
  where id = step_short_uuid;

  skip_result := public.skip_pick_step(step_short_uuid, actor_uuid);

  if skip_result ->> 'status' <> 'skipped' then
    raise exception 'Test 7 failed: expected skip result status skipped, got %', skip_result ->> 'status';
  end if;

  select status, qty_picked into line_status, line_qty
  from public.order_lines
  where id = line_short_uuid;

  if line_status <> 'skipped' or line_qty <> 0 then
    raise exception 'Test 7 failed: expected line status skipped qty=0, got status=% qty=%', line_status, line_qty;
  end if;

  -- Test 4: shortage still sets line status to exception.
  insert into public.orders (id, tenant_id, external_number, status)
  values (gen_random_uuid(), default_tenant_uuid, 'PR140-SHORT', 'draft')
  returning id into order_short_uuid;

  line_short_uuid := gen_random_uuid();
  insert into public.order_lines (
    id, order_id, tenant_id, sku, name, qty_required, product_id, status
  ) values (
    line_short_uuid, order_short_uuid, default_tenant_uuid, 'SKU-PR140-SHORT', 'PR140 Short Product', 2, shortage_product_uuid, 'released'
  );

  update public.orders
  set status = 'released'
  where id = order_short_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_short_uuid, 'ready')
  returning id into task_short_uuid;

  insert into public.pick_steps (
    id, task_id, tenant_id, order_id, order_line_id, sequence_no,
    sku, item_name, qty_required, status
  ) values (
    gen_random_uuid(), task_short_uuid, default_tenant_uuid, order_short_uuid, line_short_uuid, 1,
    'SKU-PR140-SHORT', 'PR140 Short Product', 2, 'pending'
  ) returning id into step_short_uuid;

  allocate_result := public.allocate_pick_steps(task_short_uuid);

  if (allocate_result ->> 'needsReplenishment')::int <> 1 then
    raise exception 'Test 4 failed: expected needsReplenishment=1, got %', allocate_result ->> 'needsReplenishment';
  end if;

  select status, qty_picked into line_status, line_qty
  from public.order_lines
  where id = line_short_uuid;

  if line_status <> 'exception' or line_qty <> 0 then
    raise exception 'Test 4 failed: expected line status exception qty=0, got status=% qty=%', line_status, line_qty;
  end if;

  -- Test 5: replenishment recovery still clears stale exception.
  insert into public.orders (id, tenant_id, external_number, status)
  values (order_recovery_uuid, default_tenant_uuid, 'PR140-RECOVERY', 'draft');

  insert into public.order_lines (
    id, order_id, tenant_id, sku, name, qty_required, product_id, status
  ) values (
    line_recovery_uuid, order_recovery_uuid, default_tenant_uuid, 'SKU-PR140-RECOVERY', 'PR140 Recovery Product', 5, recovery_product_uuid, 'released'
  );

  update public.orders
  set status = 'released'
  where id = order_recovery_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_recovery_uuid, 'ready')
  returning id into task_recovery_uuid;

  insert into public.pick_steps (
    id, task_id, tenant_id, order_id, order_line_id, sequence_no,
    sku, item_name, qty_required, status
  ) values (
    gen_random_uuid(), task_recovery_uuid, default_tenant_uuid, order_recovery_uuid, line_recovery_uuid, 1,
    'SKU-PR140-RECOVERY', 'PR140 Recovery Product', 5, 'pending'
  ) returning id into step_recovery_uuid;

  allocate_result := public.allocate_pick_steps(task_recovery_uuid);

  if (allocate_result ->> 'needsReplenishment')::int <> 1 then
    raise exception 'Test 5a failed: expected needsReplenishment=1, got %', allocate_result ->> 'needsReplenishment';
  end if;

  update public.pick_steps
  set status = 'pending'
  where id = step_recovery_uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => source_container_uuid,
    product_uuid => recovery_product_uuid,
    quantity => 5,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR140-RECOVERY-001'
  );
  recovery_inventory_unit_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(recovery_inventory_unit_uuid, actor_uuid);

  insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
  values (default_tenant_uuid, recovery_product_uuid, source_location_uuid, 'primary_pick', 'published');

  allocate_result := public.allocate_pick_steps(task_recovery_uuid);

  if (allocate_result ->> 'allocated')::int <> 1 then
    raise exception 'Test 5b failed: expected allocated=1, got %', allocate_result ->> 'allocated';
  end if;

  select status into line_status
  from public.order_lines
  where id = line_recovery_uuid;

  if line_status = 'exception' then
    raise exception 'Test 5 failed: expected stale exception to clear after successful re-allocation.';
  end if;
  if line_status <> 'released' then
    raise exception 'Test 5 failed: expected recovered line status released, got %', line_status;
  end if;

  -- Test 8: ordinary post-ready demand edit still fails.
  begin
    update public.order_lines
    set qty_required = qty_required + 1
    where id = line_recovery_uuid;
    raise exception 'Test 8 failed: expected committed order-line demand edit to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_EDITABLE_IN_READY' then
        raise;
      end if;
  end;

  -- Test 10: cross-tenant allocation and execution remain rejected.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', other_actor_uuid::text)::text,
    true
  );
  perform set_config('request.jwt.claim.sub', other_actor_uuid::text, true);

  begin
    perform public.allocate_pick_steps(task_uuid);
    raise exception 'Test 10 failed: expected PICK_TASK_NOT_FOUND for cross-tenant allocation.';
  exception
    when others then
      if sqlerrm <> 'PICK_TASK_NOT_FOUND' then
        raise;
      end if;
  end;

  begin
    perform public.execute_pick_step(step_uuid, 1, pick_container_uuid, other_actor_uuid);
    raise exception 'Test 10 failed: expected PICK_TASK_NOT_FOUND for cross-tenant execution.';
  exception
    when others then
      if sqlerrm <> 'PICK_TASK_NOT_FOUND' then
        raise;
      end if;
  end;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );
  perform set_config('request.jwt.claim.sub', actor_uuid::text, true);

  raise notice 'All 0140 internal order-line projection update tests passed.';
end
$$;

rollback;
