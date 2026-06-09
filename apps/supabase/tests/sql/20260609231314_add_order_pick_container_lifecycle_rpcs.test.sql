begin;

do $$
declare
  -- Identity
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  user_a   uuid := gen_random_uuid();
  user_b   uuid := gen_random_uuid();

  -- Container types
  pick_type_uuid     uuid;
  non_pick_type_uuid uuid := gen_random_uuid();

  -- Resolve / manual-bind / rotate / finalize orders
  order_r1 uuid := gen_random_uuid();
  order_r2 uuid := gen_random_uuid();
  order_r3 uuid := gen_random_uuid();
  order_m1 uuid := gen_random_uuid();
  order_ro uuid := gen_random_uuid();
  order_fi uuid := gen_random_uuid();
  order_wa uuid := gen_random_uuid();

  -- Wave entity
  wave_uuid uuid := gen_random_uuid();

  -- Container UUIDs
  cont_bind_ok        uuid := gen_random_uuid();
  cont_other_tenant   uuid := gen_random_uuid();
  cont_non_pick       uuid := gen_random_uuid();
  cont_closed         uuid := gen_random_uuid();
  cont_bound_other    uuid := gen_random_uuid();
  cont_non_empty      uuid := gen_random_uuid();
  cont_conflict       uuid := gen_random_uuid();
  another_order_pick  uuid := gen_random_uuid();

  -- Warehouse topology for execute guard test
  site_uuid              uuid := gen_random_uuid();
  floor_uuid             uuid := gen_random_uuid();
  source_location_uuid   uuid;
  source_container_uuid  uuid;
  product_uuid           uuid := gen_random_uuid();

  -- Execute guard orders
  order_exec_uuid     uuid := gen_random_uuid();
  order_exec_alt_uuid uuid := gen_random_uuid();

  -- Per-test helpers
  result              jsonb;
  v_cnt               int;
begin
  -- ═════════════════════════════════════════════════════════════════════════════
  -- 1. GLOBAL FIXTURES
  -- ═════════════════════════════════════════════════════════════════════════════

  select id into pick_type_uuid from public.container_types where code = 'pallet';
  if pick_type_uuid is null then
    raise exception 'Precondition failed: pallet type not found.';
  end if;

  insert into public.container_types (id, code, description, supports_storage, supports_picking)
  values (non_pick_type_uuid, 'test-np-' || substring(gen_random_uuid()::text, 1, 8), 'Non-pick type', false, false);

  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'LIFE-A-' || substring(gen_random_uuid()::text, 1, 8), 'Lifecycle Tenant A'),
    (tenant_b, 'LIFE-B-' || substring(gen_random_uuid()::text, 1, 8), 'Lifecycle Tenant B');

  insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, is_sso_user, raw_app_meta_data, raw_user_meta_data)
  values
    (user_a, 'life-a@wos.test', now(), now(), now(), false, '{}', '{}'),
    (user_b, 'life-b@wos.test', now(), now(), now(), false, '{}', '{}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values
    (tenant_a, user_a, 'tenant_admin'),
    (tenant_b, user_b, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);

  -- Enable reservation bypass for test
  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  -- ── Product ────────────────────────────────────────────────────────────
  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values (product_uuid, 'lifecycle-test', 'LIFE-PROD', 'SKU-LIFE', 'Lifecycle Product', true);

  -- ── Tenant A picking settings ─────────────────────────────────────────
  insert into public.tenant_picking_settings (tenant_id, default_pick_container_type_id)
  values (tenant_a, pick_type_uuid);

  -- ── Orders for resolve / manual-bind / rotate / finalize ───────────────
  insert into public.orders (id, tenant_id, external_number, status)
  values
    (order_r1, tenant_a, 'RESOLVE-1', 'draft'),
    (order_r2, tenant_a, 'RESOLVE-2', 'draft'),
    (order_r3, tenant_a, 'RESOLVE-TERM', 'closed'),
    (order_m1, tenant_a, 'MANUAL-1', 'draft'),
    (order_ro, tenant_a, 'ROTATE-1', 'draft'),
    (order_fi, tenant_a, 'FINALIZE-1', 'draft'),
    (order_exec_uuid, tenant_a, 'EXEC-GUARD', 'draft'),
    (order_exec_alt_uuid, tenant_a, 'EXEC-GUARD-ALT', 'draft');

  -- Add order lines for orders that need 'released'/'picking' status
  insert into public.order_lines (order_id, tenant_id, sku, name, qty_required, product_id, status)
  select id, tenant_a, 'SKU-LIFE', 'Lifecycle Product', 3, product_uuid, 'released'
  from public.orders
  where tenant_id = tenant_a
    and id in (order_r1, order_r2, order_m1, order_ro, order_fi, order_exec_uuid, order_exec_alt_uuid);

  -- Promote draft orders to released/picking for tests
  update public.orders set status = 'released' where id in (order_r1, order_m1, order_ro, order_fi);
  update public.orders set status = 'picking'  where id in (order_r2, order_exec_uuid, order_exec_alt_uuid);

  -- ── Containers for manual-bind tests ───────────────────────────────────
  insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
  values
    (cont_bind_ok,       tenant_a, pick_type_uuid,     'active', 'pick'),
    (cont_non_pick,      tenant_a, non_pick_type_uuid, 'active', 'pick'),
    (cont_closed,        tenant_a, pick_type_uuid,     'closed', 'pick'),
    (cont_bound_other,   tenant_a, pick_type_uuid,     'active', 'pick'),
    (cont_non_empty,     tenant_a, pick_type_uuid,     'active', 'pick'),
    (cont_conflict,      tenant_a, pick_type_uuid,     'active', 'pick'),
    (another_order_pick, tenant_a, pick_type_uuid,     'active', 'pick');

  insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
  values (cont_other_tenant, tenant_b, pick_type_uuid, 'active', 'pick');

  -- Bind cont_bound_other to a dummy order
  declare
    dummy_order_id uuid := gen_random_uuid();
  begin
    insert into public.orders (id, tenant_id, external_number, status)
    values (dummy_order_id, tenant_a, 'BOUND-OTHER', 'draft');

    insert into public.order_pick_containers (tenant_id, order_id, container_id, sequence_number, status, opened_by)
    values (tenant_a, dummy_order_id, cont_bound_other, 1, 'active', user_a);
  end;

  -- Make cont_non_empty appear non-empty
  insert into public.container_lines (tenant_id, container_id, current_container_id, product_id, line_kind, qty_each, current_qty_each, inventory_status, current_inventory_status)
  values (tenant_a, cont_non_empty, cont_non_empty, product_uuid, 'receipt', 10, 10, 'available', 'available');

  -- ── Wave + wave order ──────────────────────────────────────────────────
  insert into public.waves (id, tenant_id, name, status)
  values (wave_uuid, tenant_a, 'WAVE-TEST', 'draft');

  insert into public.orders (id, tenant_id, external_number, status, wave_id)
  values (order_wa, tenant_a, 'WAVE-ORDER', 'draft', wave_uuid);

  insert into public.order_lines (order_id, tenant_id, sku, name, qty_required, product_id, status)
  values (order_wa, tenant_a, 'SKU-LIFE', 'Lifecycle Product', 3, product_uuid, 'released');

  update public.orders set status = 'released' where id = order_wa;

  -- ═════════════════════════════════════════════════════════════════════════════
  -- 2. RESOLVE TESTS
  -- ═════════════════════════════════════════════════════════════════════════════

  -- Test 1: first resolve creates one active pallet
  result := public.resolve_or_create_order_pick_container(order_r1);
  if (result ->> 'created')::boolean <> true then
    raise exception 'Test 1 FAIL: expected created=true, got %', result;
  end if;
  if result ->> 'status' <> 'active' then
    raise exception 'Test 1 FAIL: expected status=active, got %', result;
  end if;

  select count(*) into v_cnt
  from public.order_pick_containers
  where tenant_id = tenant_a and order_id = order_r1 and status = 'active';
  if v_cnt <> 1 then
    raise exception 'Test 1 FAIL: expected exactly 1 active assignment, got %', v_cnt;
  end if;

  -- Test 2: second resolve returns same active pallet
  result := public.resolve_or_create_order_pick_container(order_r1);
  if (result ->> 'created')::boolean <> false then
    raise exception 'Test 2 FAIL: expected created=false, got %', result;
  end if;

  select count(*) into v_cnt
  from public.order_pick_containers
  where tenant_id = tenant_a and order_id = order_r1 and status = 'active';
  if v_cnt <> 1 then
    raise exception 'Test 2 FAIL: expected still 1 active assignment, got %', v_cnt;
  end if;

  -- Test 3: default type missing fails safely (using tenant_b which has no settings)
  begin
    -- Switch to user_b's context for tenant_b
    perform set_config('request.jwt.claims', json_build_object('sub', user_b::text)::text, true);

    declare
      order_no_settings uuid := gen_random_uuid();
    begin
      insert into public.orders (id, tenant_id, external_number, status)
      values (order_no_settings, tenant_b, 'NO-SETTINGS', 'draft');
      insert into public.order_lines (order_id, tenant_id, sku, name, qty_required, product_id, status)
      values (order_no_settings, tenant_b, 'SKU-LIFE', 'No Settings', 3, product_uuid, 'released');
      update public.orders set status = 'released' where id = order_no_settings;

      result := public.resolve_or_create_order_pick_container(order_no_settings);
      raise exception 'Test 3 FAIL: expected DEFAULT_PICK_CONTAINER_TYPE_NOT_CONFIGURED';
    exception
      when others then
        if sqlerrm <> 'DEFAULT_PICK_CONTAINER_TYPE_NOT_CONFIGURED' then raise; end if;
    end;

    -- Switch back to user_a
    perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  end;

  -- Test 4: non-picking default type cannot be configured (trigger)
  begin
    update public.tenant_picking_settings
    set default_pick_container_type_id = non_pick_type_uuid
    where tenant_id = tenant_a;
    raise exception 'Test 4 FAIL: expected DEFAULT_PICK_CONTAINER_TYPE_MUST_SUPPORT_PICKING';
  exception
    when others then
      if sqlerrm <> 'DEFAULT_PICK_CONTAINER_TYPE_MUST_SUPPORT_PICKING' then raise; end if;
  end;

  -- Restore picking type
  update public.tenant_picking_settings
  set default_pick_container_type_id = pick_type_uuid
  where tenant_id = tenant_a;

  -- Test 5: terminal order status rejected
  begin
    result := public.resolve_or_create_order_pick_container(order_r3);
    raise exception 'Test 5 FAIL: expected ORDER_NOT_ELIGIBLE_FOR_PICK_CONTAINER';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_ELIGIBLE_FOR_PICK_CONTAINER' then raise; end if;
  end;

  -- ═════════════════════════════════════════════════════════════════════════════
  -- 3. MANUAL BIND TESTS
  -- ═════════════════════════════════════════════════════════════════════════════

  -- Test 6: valid empty active pick pallet binds
  result := public.bind_manual_order_pick_container(order_m1, cont_bind_ok);
  if (result ->> 'matched')::boolean <> false then
    raise exception 'Test 6 FAIL: expected matched=false, got %', result;
  end if;
  if result ->> 'status' <> 'active' then
    raise exception 'Test 6 FAIL: expected status=active, got %', result;
  end if;

  delete from public.order_pick_containers
  where tenant_id = tenant_a and order_id = order_m1;

  -- Test 7: cross-tenant rejected
  begin
    result := public.bind_manual_order_pick_container(order_m1, cont_other_tenant);
    raise exception 'Test 7 FAIL: expected CONTAINER_TENANT_MISMATCH';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_TENANT_MISMATCH' then raise; end if;
  end;

  -- Test 8: non-picking type rejected
  begin
    result := public.bind_manual_order_pick_container(order_m1, cont_non_pick);
    raise exception 'Test 8 FAIL: expected CONTAINER_TYPE_DOES_NOT_SUPPORT_PICKING';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_TYPE_DOES_NOT_SUPPORT_PICKING' then raise; end if;
  end;

  -- Test 8b: storage role container rejected
  declare
    cont_storage_role uuid := gen_random_uuid();
  begin
    insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
    values (cont_storage_role, tenant_a, pick_type_uuid, 'active', 'storage');

    begin
      result := public.bind_manual_order_pick_container(order_m1, cont_storage_role);
      raise exception 'Test 8b FAIL: expected CONTAINER_NOT_PICK_ROLE';
    exception
      when others then
        if sqlerrm <> 'CONTAINER_NOT_PICK_ROLE' then raise; end if;
    end;
  end;

  -- Test 9: closed pallet rejected
  begin
    result := public.bind_manual_order_pick_container(order_m1, cont_closed);
    raise exception 'Test 9 FAIL: expected CONTAINER_NOT_ACTIVE';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_ACTIVE' then raise; end if;
  end;

  -- Test 10: already bound to another order rejected
  begin
    result := public.bind_manual_order_pick_container(order_m1, cont_bound_other);
    raise exception 'Test 10 FAIL: expected CONTAINER_ALREADY_ASSIGNED_TO_ANOTHER_ORDER';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_ALREADY_ASSIGNED_TO_ANOTHER_ORDER' then raise; end if;
  end;

  -- Test 11: non-empty pallet rejected
  begin
    result := public.bind_manual_order_pick_container(order_m1, cont_non_empty);
    raise exception 'Test 11 FAIL: expected CONTAINER_NOT_EMPTY';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_EMPTY' then raise; end if;
  end;

  -- Test 12: conflicting active assignment rejected
  result := public.bind_manual_order_pick_container(order_m1, cont_bind_ok);
  if (result ->> 'status') <> 'active' then
    raise exception 'Test 12 FAIL: initial bind failed: %', result;
  end if;

  begin
    result := public.bind_manual_order_pick_container(order_m1, cont_conflict);
    raise exception 'Test 12 FAIL: expected ORDER_ALREADY_HAS_ACTIVE_ASSIGNMENT';
  exception
    when others then
      if sqlerrm <> 'ORDER_ALREADY_HAS_ACTIVE_ASSIGNMENT' then raise; end if;
  end;

  -- Matching container returns existing
  result := public.bind_manual_order_pick_container(order_m1, cont_bind_ok);
  if (result ->> 'matched')::boolean <> true then
    raise exception 'Test 12b FAIL: expected matched=true, got %', result;
  end if;

  delete from public.order_pick_containers
  where tenant_id = tenant_a and order_id = order_m1;

  -- ═════════════════════════════════════════════════════════════════════════════
  -- 4. ROTATE TESTS
  -- ═════════════════════════════════════════════════════════════════════════════

  declare
    rot_first_container  uuid := gen_random_uuid();
    rot_first_assignment_id uuid;
    rot_result           jsonb;
    rot_sealed_id        uuid;
    rot_new_id           uuid;
  begin
    insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
    values (rot_first_container, tenant_a, pick_type_uuid, 'active', 'pick');

    insert into public.order_pick_containers (tenant_id, order_id, container_id, sequence_number, status, opened_by)
    values (tenant_a, order_ro, rot_first_container, 1, 'active', user_a)
    returning id into rot_first_assignment_id;

    -- Test 13: active pallet seals and closes physically
    rot_result := public.seal_and_rotate_order_pick_container(order_ro, rot_first_container);

    rot_sealed_id := (rot_result ->> 'sealedAssignmentId')::uuid;
    if rot_sealed_id is null then
      raise exception 'Test 13 FAIL: sealedAssignmentId missing, result: %', rot_result;
    end if;

    if not exists (
      select 1 from public.order_pick_containers
      where id = rot_sealed_id and status = 'sealed' and sealed_at is not null
    ) then
      raise exception 'Test 13 FAIL: original assignment not sealed.';
    end if;

    if not exists (
      select 1 from public.containers
      where id = rot_first_container and status = 'closed'
    ) then
      raise exception 'Test 13 FAIL: physical container not closed.';
    end if;

    -- Test 14: next sequence pallet created active
    rot_new_id := (rot_result ->> 'newAssignmentId')::uuid;
    if rot_new_id is null then
      raise exception 'Test 14 FAIL: newAssignmentId missing.';
    end if;

    if not exists (
      select 1 from public.order_pick_containers
      where id = rot_new_id and status = 'active' and sequence_number = 2
    ) then
      raise exception 'Test 14 FAIL: new assignment not active with seq=2.';
    end if;

    -- Test 15: previous pick history remains unchanged
    if not exists (
      select 1 from public.order_pick_containers where id = rot_sealed_id
    ) then
      raise exception 'Test 15 FAIL: sealed assignment disappeared.';
    end if;

    -- Test 16: stale expected container fails
    begin
      rot_result := public.seal_and_rotate_order_pick_container(order_ro, rot_first_container);
      raise exception 'Test 16 FAIL: expected STALE_EXPECTED_CONTAINER';
    exception
      when others then
        if sqlerrm <> 'STALE_EXPECTED_CONTAINER' then raise; end if;
    end;

    -- Test 17: retry cannot rotate the replacement pallet again
    declare
      new_container_id uuid;
    begin
      select container_id into new_container_id
      from public.order_pick_containers where id = rot_new_id;

      rot_result := public.seal_and_rotate_order_pick_container(order_ro, new_container_id);
      if (rot_result ->> 'sealedAssignmentId') is null then
        raise exception 'Test 17 FAIL: valid rotate should succeed.';
      end if;

      begin
        rot_result := public.seal_and_rotate_order_pick_container(order_ro, new_container_id);
        raise exception 'Test 17 FAIL: expected STALE_EXPECTED_CONTAINER on retry';
      exception
        when others then
          if sqlerrm <> 'STALE_EXPECTED_CONTAINER' then raise; end if;
      end;
    end;

    -- Test 18: concurrent uniqueness invariant
    begin
      insert into public.order_pick_containers (tenant_id, order_id, container_id, sequence_number, status, opened_by)
      values (tenant_a, order_ro, gen_random_uuid(), 99, 'active', user_a);
      raise exception 'Test 18 FAIL: expected unique violation';
    exception
      when unique_violation then
        null;
    end;

    delete from public.order_pick_containers
    where tenant_id = tenant_a and order_id = order_ro;
    delete from public.containers where id = rot_first_container and tenant_id = tenant_a;
  end;

  -- ═════════════════════════════════════════════════════════════════════════════
  -- 5. FINALIZE TESTS
  -- ═════════════════════════════════════════════════════════════════════════════

  declare
    fin_container    uuid := gen_random_uuid();
    fin_assignment_id uuid;
    fin_result       jsonb;
    fin_task_uuid    uuid;
  begin
    insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
    values (fin_container, tenant_a, pick_type_uuid, 'active', 'pick');

    insert into public.order_pick_containers (tenant_id, order_id, container_id, sequence_number, status, opened_by)
    values (tenant_a, order_fi, fin_container, 1, 'active', user_a)
    returning id into fin_assignment_id;

    -- Create tasks (incomplete first, then complete)
    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (tenant_a, 'order', order_fi, 'in_progress')
    returning id into fin_task_uuid;

    insert into public.pick_steps (task_id, tenant_id, order_id, sequence_no, sku, item_name, qty_required, qty_picked, status)
    values (fin_task_uuid, tenant_a, order_fi, 1, 'FIN-SKU', 'Finalize SKU', 2, 1, 'partial');

    -- Test 21: finalize before eligible completion rejected
    begin
      fin_result := public.finalize_order_pick_container(order_fi, fin_container);
      raise exception 'Test 21 FAIL: expected ORDER_PICKING_NOT_COMPLETE';
    exception
      when others then
        if sqlerrm <> 'ORDER_PICKING_NOT_COMPLETE' then raise; end if;
    end;

    -- Now complete the task
    update public.pick_tasks set status = 'completed', completed_at = now() where id = fin_task_uuid;
    update public.pick_steps set status = 'picked', qty_picked = 2 where task_id = fin_task_uuid;

    -- Test 19: final active pallet seals and closes
    fin_result := public.finalize_order_pick_container(order_fi, fin_container);
    if (fin_result ->> 'assignmentId') is null then
      raise exception 'Test 19 FAIL: assignmentId missing.';
    end if;
    if (fin_result ->> 'status') <> 'sealed' then
      raise exception 'Test 19 FAIL: expected status=sealed, got %', fin_result ->> 'status';
    end if;

    if not exists (
      select 1 from public.containers where id = fin_container and status = 'closed'
    ) then
      raise exception 'Test 19 FAIL: physical container not closed.';
    end if;

    -- Test 20: no next pallet created
    select count(*) into v_cnt
    from public.order_pick_containers
    where tenant_id = tenant_a and order_id = order_fi;
    if v_cnt <> 1 then
      raise exception 'Test 20 FAIL: expected exactly 1 sealed assignment, got %', v_cnt;
    end if;

    -- Test 22: stale expected container rejected
    begin
      fin_result := public.finalize_order_pick_container(order_fi, gen_random_uuid());
      raise exception 'Test 22 FAIL: expected NO_ACTIVE_ASSIGNMENT';
    exception
      when others then
        if sqlerrm <> 'NO_ACTIVE_ASSIGNMENT' then raise; end if;
    end;

    delete from public.pick_steps where task_id = fin_task_uuid;
    delete from public.pick_tasks where id = fin_task_uuid;
    delete from public.order_pick_containers
    where tenant_id = tenant_a and order_id = order_fi;
    delete from public.containers where id = fin_container and tenant_id = tenant_a;
  end;

  -- ═════════════════════════════════════════════════════════════════════════════
  -- 6. EXECUTE GUARD TESTS
  -- ═════════════════════════════════════════════════════════════════════════════

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, tenant_a, 'EGUARD-SITE', 'Eguard Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'EGUARD-FLOOR', 'Eguard Floor', 1);

  insert into public.locations (tenant_id, floor_id, code, location_type, capacity_mode, status)
  values (tenant_a, floor_uuid, 'EGUARD-SRC', 'floor', 'single_container', 'active');

  select id into source_location_uuid
  from public.locations where code = 'EGUARD-SRC' and tenant_id = tenant_a;

  insert into public.containers (tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
  values (tenant_a, 'EGUARD-SRC-CONT', pick_type_uuid, 'active', source_location_uuid, now());

  select id into source_container_uuid
  from public.containers where external_code = 'EGUARD-SRC-CONT' and tenant_id = tenant_a;

  -- Active assignment: order_exec_uuid → cont_bind_ok
  perform public.bind_manual_order_pick_container(order_exec_uuid, cont_bind_ok);
  -- Active assignment: order_exec_alt_uuid → another_order_pick
  perform public.bind_manual_order_pick_container(order_exec_alt_uuid, another_order_pick);

  -- Restore order status after bind (bind doesn't change order status)
  update public.orders set status = 'picking' where id in (order_exec_uuid, order_exec_alt_uuid);

  -- Test 23: correct active order pallet succeeds
  declare
    eg_iu_id   uuid;
    eg_task    uuid;
    eg_step    uuid;
    eg_result  jsonb;
  begin
    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (tenant_a, source_container_uuid, product_uuid, 10, 'pcs', 'available')
    returning id into eg_iu_id;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (tenant_a, 'order', order_exec_uuid, 'ready')
    returning id into eg_task;

    insert into public.pick_steps (task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
    values (eg_task, tenant_a, order_exec_uuid,
      (select id from public.order_lines where order_id = order_exec_uuid limit 1),
      1, 'SKU-LIFE', 'Lifecycle Product', 3, eg_iu_id, source_container_uuid, 'pending')
    returning id into eg_step;

    eg_result := public.execute_pick_step(eg_step, 3, cont_bind_ok, user_a);
    if (eg_result ->> 'status') <> 'picked' then
      raise exception 'Test 23 FAIL: expected status=picked, got %', eg_result ->> 'status';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = eg_step and pick_container_id = cont_bind_ok
    ) then
      raise exception 'Test 23 FAIL: pick_container_id not recorded.';
    end if;

    if not exists (
      select 1 from public.stock_movements
      where movement_type = 'pick_partial'
        and target_container_id = cont_bind_ok
        and source_inventory_unit_id = eg_iu_id
    ) then
      raise exception 'Test 23 FAIL: stock movement target wrong.';
    end if;

    delete from public.pick_steps where task_id = eg_task;
    delete from public.pick_tasks where id = eg_task;
    delete from public.stock_movements where source_inventory_unit_id = eg_iu_id;
    delete from public.inventory_unit where id = eg_iu_id;
    update public.orders set status = 'picking' where id = order_exec_uuid;
  end;

  -- Test 24: sealed pallet rejected
  declare
    eg_iu_id  uuid;
    eg_task   uuid;
    eg_step   uuid;
  begin
    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (tenant_a, source_container_uuid, product_uuid, 10, 'pcs', 'available')
    returning id into eg_iu_id;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (tenant_a, 'order', order_exec_uuid, 'ready')
    returning id into eg_task;

    insert into public.pick_steps (task_id, tenant_id, order_id, sequence_no, sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
    values (eg_task, tenant_a, order_exec_uuid, 2, 'SKU-LIFE', 'Lifecycle Product', 3, eg_iu_id, source_container_uuid, 'pending')
    returning id into eg_step;

    update public.order_pick_containers
    set status = 'sealed', sealed_at = now(), sealed_by = user_a
    where tenant_id = tenant_a and order_id = order_exec_uuid and status = 'active';

    begin
      perform public.execute_pick_step(eg_step, 3, cont_bind_ok, user_a);
      raise exception 'Test 24 FAIL: expected ORDER_PICK_CONTAINER_NOT_ACCEPTABLE';
    exception
      when others then
        if sqlerrm <> 'ORDER_PICK_CONTAINER_NOT_ACCEPTABLE' then raise; end if;
    end;

    update public.order_pick_containers
    set status = 'active', sealed_at = null, sealed_by = null
    where tenant_id = tenant_a and order_id = order_exec_uuid and status = 'sealed';

    delete from public.pick_steps where task_id = eg_task;
    delete from public.pick_tasks where id = eg_task;
    delete from public.stock_movements where source_inventory_unit_id = eg_iu_id;
    delete from public.inventory_unit where id = eg_iu_id;
  end;

  -- Test 25: closed pallet rejected
  declare
    eg_iu_id  uuid;
    eg_task   uuid;
    eg_step   uuid;
  begin
    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (tenant_a, source_container_uuid, product_uuid, 10, 'pcs', 'available')
    returning id into eg_iu_id;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (tenant_a, 'order', order_exec_uuid, 'ready')
    returning id into eg_task;

    insert into public.pick_steps (task_id, tenant_id, order_id, sequence_no, sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
    values (eg_task, tenant_a, order_exec_uuid, 3, 'SKU-LIFE', 'Lifecycle Product', 3, eg_iu_id, source_container_uuid, 'pending')
    returning id into eg_step;

    update public.containers set status = 'closed' where id = cont_bind_ok;

    begin
      perform public.execute_pick_step(eg_step, 3, cont_bind_ok, user_a);
      raise exception 'Test 25 FAIL: expected ORDER_PICK_CONTAINER_NOT_ACCEPTABLE';
    exception
      when others then
        if sqlerrm <> 'ORDER_PICK_CONTAINER_NOT_ACCEPTABLE' then raise; end if;
    end;

    update public.containers set status = 'active' where id = cont_bind_ok;

    delete from public.pick_steps where task_id = eg_task;
    delete from public.pick_tasks where id = eg_task;
    delete from public.stock_movements where source_inventory_unit_id = eg_iu_id;
    delete from public.inventory_unit where id = eg_iu_id;
  end;

  -- Test 26: arbitrary active pallet from another order rejected
  declare
    eg_iu_id  uuid;
    eg_task   uuid;
    eg_step   uuid;
  begin
    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (tenant_a, source_container_uuid, product_uuid, 10, 'pcs', 'available')
    returning id into eg_iu_id;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (tenant_a, 'order', order_exec_uuid, 'ready')
    returning id into eg_task;

    insert into public.pick_steps (task_id, tenant_id, order_id, sequence_no, sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
    values (eg_task, tenant_a, order_exec_uuid, 4, 'SKU-LIFE', 'Lifecycle Product', 3, eg_iu_id, source_container_uuid, 'pending')
    returning id into eg_step;

    begin
      perform public.execute_pick_step(eg_step, 3, another_order_pick, user_a);
      raise exception 'Test 26 FAIL: expected ORDER_PICK_CONTAINER_NOT_ACCEPTABLE';
    exception
      when others then
        if sqlerrm <> 'ORDER_PICK_CONTAINER_NOT_ACCEPTABLE' then raise; end if;
    end;

    delete from public.pick_steps where task_id = eg_task;
    delete from public.pick_tasks where id = eg_task;
    delete from public.stock_movements where source_inventory_unit_id = eg_iu_id;
    delete from public.inventory_unit where id = eg_iu_id;
  end;

  -- Test 27: stale old pallet after rotate rejected
  declare
    eg_iu_id          uuid;
    eg_task           uuid;
    eg_step           uuid;
    rot_container     uuid := gen_random_uuid();
    rotate_result     jsonb;
    new_active_cont   uuid;
  begin
    -- Cleanup existing assignment first
    delete from public.order_pick_containers
    where tenant_id = tenant_a and order_id = order_exec_uuid;

    insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
    values (rot_container, tenant_a, pick_type_uuid, 'active', 'pick');

    perform public.bind_manual_order_pick_container(order_exec_uuid, rot_container);
    update public.orders set status = 'picking' where id = order_exec_uuid;

    rotate_result := public.seal_and_rotate_order_pick_container(order_exec_uuid, rot_container);
    new_active_cont := (rotate_result ->> 'newContainerId')::uuid;

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (tenant_a, source_container_uuid, product_uuid, 10, 'pcs', 'available')
    returning id into eg_iu_id;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (tenant_a, 'order', order_exec_uuid, 'ready')
    returning id into eg_task;

    insert into public.pick_steps (task_id, tenant_id, order_id, sequence_no, sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
    values (eg_task, tenant_a, order_exec_uuid, 5, 'SKU-LIFE', 'Lifecycle Product', 3, eg_iu_id, source_container_uuid, 'pending')
    returning id into eg_step;

    begin
      perform public.execute_pick_step(eg_step, 3, rot_container, user_a);
      raise exception 'Test 27 FAIL: expected ORDER_PICK_CONTAINER_NOT_ACCEPTABLE';
    exception
      when others then
        if sqlerrm <> 'ORDER_PICK_CONTAINER_NOT_ACCEPTABLE' then raise; end if;
    end;

    delete from public.pick_steps where task_id = eg_task;
    delete from public.pick_tasks where id = eg_task;
    delete from public.stock_movements where source_inventory_unit_id = eg_iu_id;
    delete from public.inventory_unit where id = eg_iu_id;
  end;

  -- Bind a fresh container for Test 29 (Test 27 deleted cont_bind_ok's assignment
  -- and cont_bind_ok now has picks in it, so a fresh container is needed)
  declare
    fresh_cont uuid := gen_random_uuid();
  begin
    insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
    values (fresh_cont, tenant_a, pick_type_uuid, 'active', 'pick');

    delete from public.order_pick_containers
    where tenant_id = tenant_a and order_id = order_exec_uuid;

    perform public.bind_manual_order_pick_container(order_exec_uuid, fresh_cont);
    update public.orders set status = 'picking' where id = order_exec_uuid;
  end;

  -- Test 28: stock movement history still records correct target container
  -- (Verified in Test 23 above)

  -- Test 29: partial execution remains correct
  declare
    eg_iu_id          uuid;
    eg_task           uuid;
    eg_step           uuid;
    eg_result         jsonb;
    test29_container  uuid;
  begin
    select opc.container_id into test29_container
    from public.order_pick_containers opc
    where opc.tenant_id = tenant_a
      and opc.order_id  = order_exec_uuid
      and opc.status    = 'active';

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (tenant_a, source_container_uuid, product_uuid, 10, 'pcs', 'available')
    returning id into eg_iu_id;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (tenant_a, 'order', order_exec_uuid, 'ready')
    returning id into eg_task;

    insert into public.pick_steps (task_id, tenant_id, order_id, sequence_no, sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
    values (eg_task, tenant_a, order_exec_uuid, 6, 'SKU-LIFE', 'Lifecycle Product', 10, eg_iu_id, source_container_uuid, 'pending')
    returning id into eg_step;

    eg_result := public.execute_pick_step(eg_step, 3, test29_container, user_a);
    if (eg_result ->> 'status') <> 'partial' then
      raise exception 'Test 29 FAIL: expected status=partial, got %', eg_result ->> 'status';
    end if;

    delete from public.pick_steps where task_id = eg_task;
    delete from public.pick_tasks where id = eg_task;
    delete from public.stock_movements where source_inventory_unit_id = eg_iu_id;
    delete from public.inventory_unit where id = eg_iu_id;
    update public.orders set status = 'picking' where id = order_exec_uuid;
  end;

  delete from public.order_pick_containers
  where tenant_id = tenant_a and order_id in (order_exec_uuid, order_exec_alt_uuid);

  -- ═════════════════════════════════════════════════════════════════════════════
  -- 7. WAVE GATE TESTS
  -- ═════════════════════════════════════════════════════════════════════════════

  -- Test 30: wave-origin resolve rejected
  begin
    result := public.resolve_or_create_order_pick_container(order_wa);
    raise exception 'Test 30 FAIL: expected ORDER_BELONGS_TO_WAVE';
  exception
    when others then
      if sqlerrm <> 'ORDER_BELONGS_TO_WAVE' then raise; end if;
  end;

  -- Test 31: wave-origin rotate rejected
  declare
    wave_container uuid := gen_random_uuid();
  begin
    insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
    values (wave_container, tenant_a, pick_type_uuid, 'active', 'pick');

    insert into public.order_pick_containers (tenant_id, order_id, container_id, sequence_number, status, opened_by)
    values (tenant_a, order_wa, wave_container, 1, 'active', user_a);

    begin
      result := public.seal_and_rotate_order_pick_container(order_wa, wave_container);
      raise exception 'Test 31 FAIL: expected ORDER_BELONGS_TO_WAVE';
    exception
      when others then
        if sqlerrm <> 'ORDER_BELONGS_TO_WAVE' then raise; end if;
    end;

    delete from public.order_pick_containers
    where tenant_id = tenant_a and order_id = order_wa;
    delete from public.containers where id = wave_container and tenant_id = tenant_a;
  end;

  -- Test 32: existing wave execute unchanged
  declare
    wv_iu_id   uuid;
    wv_task    uuid;
    wv_step    uuid;
    wv_pick    uuid := gen_random_uuid();
    wv_result  jsonb;
  begin
    insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
    values (wv_pick, tenant_a, pick_type_uuid, 'active', 'pick');

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (tenant_a, source_container_uuid, product_uuid, 5, 'pcs', 'available')
    returning id into wv_iu_id;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (tenant_a, 'order', order_wa, 'ready')
    returning id into wv_task;

    insert into public.pick_steps (task_id, tenant_id, order_id, sequence_no, sku, item_name, qty_required, inventory_unit_id, source_container_id, status)
    values (wv_task, tenant_a, order_wa, 1, 'SKU-LIFE', 'Wave Product', 3, wv_iu_id, source_container_uuid, 'pending')
    returning id into wv_step;

    wv_result := public.execute_pick_step(wv_step, 3, wv_pick, user_a);
    if (wv_result ->> 'stepId') is null then
      raise exception 'Test 32 FAIL: wave execute should succeed, got %', wv_result;
    end if;

    delete from public.pick_steps where task_id = wv_task;
    delete from public.pick_tasks where id = wv_task;
    delete from public.stock_movements where source_inventory_unit_id = wv_iu_id;
    delete from public.inventory_unit where id = wv_iu_id;
    delete from public.container_lines where current_container_id = wv_pick and tenant_id = tenant_a;
    delete from public.containers where id = wv_pick and tenant_id = tenant_a;
  end;

  -- ═════════════════════════════════════════════════════════════════════════════
  -- 8. SECURITY / TENANT ISOLATION TESTS
  -- ═════════════════════════════════════════════════════════════════════════════

  -- Test 33: cross-tenant lifecycle mutation rejected
  perform set_config('request.jwt.claims', json_build_object('sub', user_b::text)::text, true);

  insert into public.tenant_picking_settings (tenant_id, default_pick_container_type_id)
  values (tenant_b, pick_type_uuid);

  begin
    result := public.resolve_or_create_order_pick_container(order_r1);
    raise exception 'Test 33 FAIL: expected ORDER_NOT_FOUND';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_FOUND' then raise; end if;
  end;

  -- Test 34: authenticated direct table writes denied by RLS
  declare
    test34_container uuid := gen_random_uuid();
  begin
    insert into public.containers (id, tenant_id, container_type_id, status, operational_role)
    values (test34_container, tenant_a, pick_type_uuid, 'active', 'pick');

    -- Switch to authenticated role so RLS policies are enforced
    perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
    set local role authenticated;

    -- Non-conflicting insert: order_r2 has no existing assignment,
    -- test34_container has zero assignment history
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_by
    ) values (
      tenant_a, order_r2, test34_container, 1, 'active', user_a
    );

    raise exception 'Test 34 FAIL: expected RLS to block direct insert';
  exception
    when insufficient_privilege then
      null;
    when others then
      raise exception 'Test 34 FAIL: expected RLS denial, got: % (SQLSTATE %)', sqlerrm, sqlstate;
  end;

  -- Test 35: RPC path succeeds only through validated flow
  select count(*) into v_cnt
  from public.order_pick_containers
  where tenant_id = tenant_a and order_id = order_r1;
  if v_cnt < 1 then
    raise exception 'Test 35 FAIL: expected RPC-created assignment';
  end if;

end
$$;

rollback;
