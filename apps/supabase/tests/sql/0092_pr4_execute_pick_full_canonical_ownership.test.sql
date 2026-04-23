begin;

do $$
declare
  default_tenant_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  source_location_uuid uuid := gen_random_uuid();

  product_uuid uuid := gen_random_uuid();

  source_container_uuid uuid := gen_random_uuid();
  pick_container_uuid uuid := gen_random_uuid();
  guard_source_container_uuid uuid := gen_random_uuid();
  guard_pick_container_uuid uuid := gen_random_uuid();
  partial_source_container_uuid uuid := gen_random_uuid();
  partial_pick_container_uuid uuid := gen_random_uuid();

  wave_uuid uuid := gen_random_uuid();
  order_uuid uuid := gen_random_uuid();
  order_line_uuid uuid := gen_random_uuid();
  task_uuid uuid;
  step_uuid uuid;

  receive_result jsonb;
  result jsonb;
  iu_uuid uuid;
  line_uuid uuid;
  movement_uuid uuid;
  movement_count_before integer;
  movement_count_after integer;

  guard_order_uuid uuid := gen_random_uuid();
  guard_order_line_uuid uuid := gen_random_uuid();
  guard_task_uuid uuid;
  guard_step_uuid uuid;
  guard_iu_uuid uuid;
  guard_line_uuid uuid;

  partial_order_uuid uuid := gen_random_uuid();
  partial_order_line_uuid uuid := gen_random_uuid();
  partial_task_uuid uuid;
  partial_step_uuid uuid;
  partial_iu_uuid uuid;
  partial_line_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for PR4 full-pick tests.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'Expected pallet container type to exist for PR4 full-pick tests.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr92-actor@wos.test', now(), now(), now(),
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

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values (product_uuid, 'test-suite', 'pr92-product', 'SKU-PR92', 'PR92 Product', true);

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PR92-SITE', 'PR92 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'PR92-FLOOR', 'PR92 Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  )
  values (
    source_location_uuid, default_tenant_uuid, floor_uuid,
    'PR92-SOURCE', 'staging', 'single_container', 'active'
  );

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status,
    current_location_id, current_location_entered_at
  )
  values (
    source_container_uuid, default_tenant_uuid, 'PR92-SOURCE-C',
    pallet_type_uuid, 'active', source_location_uuid, now()
  );

  insert into public.containers (id, tenant_id, external_code, container_type_id, status)
  values
    (pick_container_uuid, default_tenant_uuid, 'PR92-PICK-C', pallet_type_uuid, 'active'),
    (guard_source_container_uuid, default_tenant_uuid, 'PR92-GUARD-SOURCE-C', pallet_type_uuid, 'active'),
    (guard_pick_container_uuid, default_tenant_uuid, 'PR92-GUARD-PICK-C', pallet_type_uuid, 'active'),
    (partial_source_container_uuid, default_tenant_uuid, 'PR92-PARTIAL-SOURCE-C', pallet_type_uuid, 'active'),
    (partial_pick_container_uuid, default_tenant_uuid, 'PR92-PARTIAL-PICK-C', pallet_type_uuid, 'active');

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);
  perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

  insert into public.waves (id, tenant_id, name, status)
  values (wave_uuid, default_tenant_uuid, 'PR92 Wave', 'draft');

  insert into public.orders (id, tenant_id, external_number, status, wave_id)
  values (order_uuid, default_tenant_uuid, 'PR92-FULL', 'draft', wave_uuid);

  insert into public.order_lines (
    id, order_id, tenant_id, sku, name, qty_required, product_id, status
  )
  values (
    order_line_uuid, order_uuid, default_tenant_uuid,
    'SKU-PR92', 'PR92 Product', 5, product_uuid, 'released'
  );

  update public.orders
  set status = 'picking'
  where id = order_uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => source_container_uuid,
    product_uuid => product_uuid,
    quantity => 5,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR92-FULL-001'
  );

  iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;

  perform public.ensure_inventory_unit_current_container_line(iu_uuid, actor_uuid);

  -- Deliberately drift the projection quantity. Branch selection and full-pick
  -- quantity must use container_lines.current_qty_each, not inventory_unit.
  update public.inventory_unit
  set quantity = 999
  where id = iu_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps (
    task_id, tenant_id, order_id, order_line_id, sequence_no,
    sku, item_name, qty_required, inventory_unit_id, source_container_id, status
  )
  values (
    task_uuid, default_tenant_uuid, order_uuid, order_line_uuid, 1,
    'SKU-PR92', 'PR92 Product', 5, iu_uuid, source_container_uuid, 'pending'
  )
  returning id into step_uuid;

  result := public.execute_pick_step(step_uuid, 5, pick_container_uuid, actor_uuid);
  movement_uuid := (result ->> 'movementId')::uuid;

  if result ->> 'status' <> 'picked'
     or result ->> 'taskStatus' <> 'completed'
     or result ->> 'orderStatus' <> 'picked'
     or result ->> 'waveStatus' <> 'completed' then
    raise exception 'Expected full-pick execution side effects to remain intact, got %.', result;
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = line_uuid
      and cl.line_kind = 'receipt'
      and cl.container_id = source_container_uuid
      and cl.qty_each = 5
      and cl.receipt_correlation_key = 'PR92-FULL-001'
      and cl.current_container_id = pick_container_uuid
      and cl.current_qty_each = 5
      and cl.current_inventory_status = 'available'
      and cl.root_receipt_line_id = cl.id
      and cl.parent_container_line_id is null
  ) then
    raise exception 'Expected full pick to move canonical current ownership while preserving receipt snapshot fields.';
  end if;

  if exists (
    select 1
    from public.container_lines cl
    where cl.id = line_uuid
      and cl.current_container_id = source_container_uuid
      and cl.current_qty_each > 0
  ) then
    raise exception 'Expected source container to have no active canonical current stock for the picked line.';
  end if;

  if exists (
    select 1
    from public.inventory_unit iu
    join public.container_lines cl on cl.id = iu.container_line_id
    where iu.id = iu_uuid
      and (
        iu.container_id is distinct from cl.current_container_id
        or iu.quantity is distinct from cl.current_qty_each
        or iu.status is distinct from cl.current_inventory_status
        or iu.container_line_id is distinct from cl.id
      )
  ) then
    raise exception 'Expected no post-commit drift between canonical current row and inventory_unit projection.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = movement_uuid
      and sm.movement_type = 'pick_partial'
      and sm.source_container_id = source_container_uuid
      and sm.target_container_id = pick_container_uuid
      and sm.source_inventory_unit_id = iu_uuid
      and sm.target_inventory_unit_id is null
      and sm.quantity = 5
      and sm.uom = 'pcs'
  ) then
    raise exception 'Expected full-pick movement to preserve pick_partial compatibility semantics.';
  end if;

  if (
    select coalesce(sum(cl.qty_each), 0)
    from public.container_lines cl
    where cl.container_id = source_container_uuid
      and cl.line_kind = 'receipt'
  ) <> 5 then
    raise exception 'Expected receipt-origin fill reads to retain immutable source receipt quantity.';
  end if;

  if exists (
    select 1
    from public.container_lines cl
    where cl.container_id = pick_container_uuid
      and cl.line_kind = 'receipt'
  ) then
    raise exception 'Expected full-pick current mutation not to create receipt rows in the pick container.';
  end if;

  if not exists (
    select 1 from public.pick_tasks
    where id = task_uuid and status = 'completed' and completed_at is not null
  ) then
    raise exception 'Expected pick task to complete after full pick.';
  end if;

  if not exists (
    select 1 from public.orders
    where id = order_uuid and status = 'picked'
  ) then
    raise exception 'Expected order to roll up to picked after full pick.';
  end if;

  if not exists (
    select 1 from public.waves
    where id = wave_uuid and status = 'completed'
  ) then
    raise exception 'Expected wave to roll up to completed after full pick.';
  end if;

  select count(*)
  into movement_count_before
  from public.stock_movements
  where source_inventory_unit_id = iu_uuid
    and target_container_id = pick_container_uuid;

  begin
    perform public.execute_pick_step(step_uuid, 5, pick_container_uuid, actor_uuid);
    raise exception 'Expected retry of executed full-pick step to fail.';
  exception
    when others then
      if sqlerrm <> 'PICK_STEP_NOT_EXECUTABLE' then
        raise;
      end if;
  end;

  select count(*)
  into movement_count_after
  from public.stock_movements
  where source_inventory_unit_id = iu_uuid
    and target_container_id = pick_container_uuid;

  if movement_count_after <> movement_count_before then
    raise exception 'Expected retry failure not to duplicate full-pick movement rows.';
  end if;

  insert into public.orders (id, tenant_id, external_number, status)
  values (guard_order_uuid, default_tenant_uuid, 'PR92-GUARD', 'draft');

  insert into public.order_lines (
    id, order_id, tenant_id, sku, name, qty_required, product_id, status
  )
  values (
    guard_order_line_uuid, guard_order_uuid, default_tenant_uuid,
    'SKU-PR92', 'PR92 Product', 4, product_uuid, 'released'
  );

  update public.orders
  set status = 'picking'
  where id = guard_order_uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => guard_source_container_uuid,
    product_uuid => product_uuid,
    quantity => 4,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR92-GUARD-001'
  );

  guard_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  guard_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;

  perform public.ensure_inventory_unit_current_container_line(guard_iu_uuid, actor_uuid);

  update public.inventory_unit
  set quantity = 99
  where id = guard_iu_uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', guard_order_uuid, 'ready')
  returning id into guard_task_uuid;

  insert into public.pick_steps (
    task_id, tenant_id, order_id, order_line_id, sequence_no,
    sku, item_name, qty_required, inventory_unit_id, source_container_id, status
  )
  values (
    guard_task_uuid, default_tenant_uuid, guard_order_uuid, guard_order_line_uuid, 1,
    'SKU-PR92', 'PR92 Product', 4, guard_iu_uuid, guard_source_container_uuid, 'pending'
  )
  returning id into guard_step_uuid;

  begin
    perform public.execute_pick_step(guard_step_uuid, 5, guard_pick_container_uuid, actor_uuid);
    raise exception 'Expected canonical over-pick to fail.';
  exception
    when others then
      if sqlerrm <> 'PICK_QUANTITY_EXCEEDS_AVAILABLE' then
        raise;
      end if;
  end;

  begin
    perform public.execute_pick_step(guard_step_uuid, 0, guard_pick_container_uuid, actor_uuid);
    raise exception 'Expected zero-quantity pick to fail.';
  exception
    when others then
      if sqlerrm <> 'INVALID_PICK_QUANTITY' then
        raise;
      end if;
  end;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = guard_line_uuid
      and cl.current_container_id = guard_source_container_uuid
      and cl.current_qty_each = 4
  ) then
    raise exception 'Expected rejected picks to leave canonical current row unchanged.';
  end if;

  if exists (
    select 1
    from public.stock_movements sm
    where sm.source_inventory_unit_id = guard_iu_uuid
      and sm.target_container_id = guard_pick_container_uuid
  ) then
    raise exception 'Expected rejected picks not to write movement rows.';
  end if;

  insert into public.orders (id, tenant_id, external_number, status)
  values (partial_order_uuid, default_tenant_uuid, 'PR92-PARTIAL', 'draft');

  insert into public.order_lines (
    id, order_id, tenant_id, sku, name, qty_required, product_id, status
  )
  values (
    partial_order_line_uuid, partial_order_uuid, default_tenant_uuid,
    'SKU-PR92', 'PR92 Product', 6, product_uuid, 'released'
  );

  update public.orders
  set status = 'picking'
  where id = partial_order_uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => partial_source_container_uuid,
    product_uuid => product_uuid,
    quantity => 6,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR92-PARTIAL-001'
  );

  partial_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  partial_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (default_tenant_uuid, 'order', partial_order_uuid, 'ready')
  returning id into partial_task_uuid;

  insert into public.pick_steps (
    task_id, tenant_id, order_id, order_line_id, sequence_no,
    sku, item_name, qty_required, inventory_unit_id, source_container_id, status
  )
  values (
    partial_task_uuid, default_tenant_uuid, partial_order_uuid, partial_order_line_uuid, 1,
    'SKU-PR92', 'PR92 Product', 6, partial_iu_uuid, partial_source_container_uuid, 'pending'
  )
  returning id into partial_step_uuid;

  result := public.execute_pick_step(partial_step_uuid, 2, partial_pick_container_uuid, actor_uuid);

  if result ->> 'status' <> 'partial' then
    raise exception 'Expected qty_actual < canonical current quantity to keep using partial path, got %.', result;
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = partial_line_uuid
      and cl.current_container_id = partial_source_container_uuid
      and cl.current_qty_each = 4
  ) then
    raise exception 'Expected partial path to decrement the source canonical current row.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.line_kind = 'current_fragment'
      and cl.current_container_id = partial_pick_container_uuid
      and cl.current_qty_each = 2
      and cl.root_receipt_line_id = partial_line_uuid
      and cl.parent_container_line_id = partial_line_uuid
  ) then
    raise exception 'Expected partial path to remain on PR3 current_fragment ownership.';
  end if;

  raise notice 'All 0092 PR4 full-pick canonical ownership tests passed.';
end
$$;

rollback;
