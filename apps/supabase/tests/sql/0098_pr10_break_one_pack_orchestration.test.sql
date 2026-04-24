begin;

do $$
declare
  default_tenant_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  unauthorized_actor_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;
  product_uuid uuid := gen_random_uuid();
  packaging_level_uuid uuid := gen_random_uuid();
  each_packaging_level_uuid uuid := gen_random_uuid();
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  source_location_uuid uuid := gen_random_uuid();

  multi_pack_container_uuid uuid := gen_random_uuid();
  manual_container_uuid uuid := gen_random_uuid();
  single_container_uuid uuid := gen_random_uuid();
  opened_container_uuid uuid := gen_random_uuid();
  loose_container_uuid uuid := gen_random_uuid();
  serial_container_uuid uuid := gen_random_uuid();
  status_container_uuid uuid := gen_random_uuid();
  atomic_container_uuid uuid := gen_random_uuid();

  receive_result jsonb;
  pr10_result jsonb;
  manual_isolate_result jsonb;
  manual_break_result jsonb;
  normalize_result jsonb;

  multi_pack_iu_uuid uuid;
  multi_pack_line_uuid uuid;
  target_iu_uuid uuid;
  target_line_uuid uuid;
  manual_multi_pack_iu_uuid uuid;
  manual_target_iu_uuid uuid;
  single_iu_uuid uuid;
  opened_iu_uuid uuid;
  loose_iu_uuid uuid;
  serial_iu_uuid uuid;
  status_iu_uuid uuid;
  status_line_uuid uuid;
  atomic_iu_uuid uuid;
  atomic_line_uuid uuid;

  receipt_qty_before numeric;
  receipt_profile_level_before uuid;
  receipt_snapshot_before jsonb;
  receipt_correlation_before text;
  source_qty_before numeric;
  source_pack_count_before integer;
  inventory_count_before integer;
  line_count_before integer;
  movement_count_before integer;
  rejected_movement_count_before integer;
  atomic_inventory_count_before integer;
  atomic_line_count_before integer;
  atomic_movement_count_before integer;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR10: expected default tenant to exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'PR10: expected pallet container type to exist.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values
    (
      actor_uuid, 'pr98-actor@wos.test', now(), now(), now(),
      false, '{}', '{}'
    ),
    (
      unauthorized_actor_uuid, 'pr98-unauthorized@wos.test', now(), now(), now(),
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
  values (product_uuid, 'test-suite', 'pr98-product', 'SKU-PR98', 'PR98 Product', true);

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty, is_base, can_pick, can_store,
    is_default_pick_uom, is_active
  )
  values
    (
      packaging_level_uuid, product_uuid, 'CTN', 'Carton', 12, false, true, true,
      false, true
    ),
    (
      each_packaging_level_uuid, product_uuid, 'EACH-PACK', 'Each Pack', 1, false, true, true,
      false, true
    );

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PR98-SITE', 'PR98 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'PR98-FLOOR', 'PR98 Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  )
  values (
    source_location_uuid, default_tenant_uuid, floor_uuid,
    'PR98-SOURCE', 'staging', 'multi_container', 'active'
  );

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status,
    current_location_id, current_location_entered_at
  )
  values
    (multi_pack_container_uuid, default_tenant_uuid, 'PR98-MULTI-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (manual_container_uuid, default_tenant_uuid, 'PR98-MANUAL-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (single_container_uuid, default_tenant_uuid, 'PR98-SINGLE-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (opened_container_uuid, default_tenant_uuid, 'PR98-OPENED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (loose_container_uuid, default_tenant_uuid, 'PR98-LOOSE-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (serial_container_uuid, default_tenant_uuid, 'PR98-SERIAL-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (status_container_uuid, default_tenant_uuid, 'PR98-STATUS-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (atomic_container_uuid, default_tenant_uuid, 'PR98-ATOMIC-C', pallet_type_uuid, 'active', source_location_uuid, now());

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => multi_pack_container_uuid,
    product_uuid => product_uuid,
    quantity => 36,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 3,
    receipt_correlation_key => 'PR98-MULTI-001'
  );
  multi_pack_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  multi_pack_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;

  perform public.ensure_inventory_unit_current_container_line(multi_pack_iu_uuid, actor_uuid);

  select
    cl.qty_each,
    cl.packaging_profile_level_id_at_receipt,
    cl.pack_level_snapshot_jsonb,
    cl.receipt_correlation_key,
    cl.current_qty_each,
    cl.current_pack_count
  into
    receipt_qty_before,
    receipt_profile_level_before,
    receipt_snapshot_before,
    receipt_correlation_before,
    source_qty_before,
    source_pack_count_before
  from public.container_lines cl
  where cl.id = multi_pack_line_uuid;

  select count(*) into inventory_count_before from public.inventory_unit;
  select count(*) into line_count_before from public.container_lines;
  select count(*) into movement_count_before from public.stock_movements;

  pr10_result := public.break_one_pack_from_multipack_to_opened(
    multi_pack_iu_uuid,
    'OPEN_ONE_CARTON',
    'isolate and open one carton'
  );

  target_iu_uuid := (pr10_result ->> 'targetInventoryUnitId')::uuid;
  target_line_uuid := (pr10_result ->> 'targetContainerLineId')::uuid;

  if target_iu_uuid is null or target_line_uuid is null then
    raise exception 'PR10: result must include target projection and canonical ids: %', pr10_result;
  end if;

  if (select count(*) from public.inventory_unit) <> inventory_count_before + 1 then
    raise exception 'PR10: orchestration must create exactly one target inventory_unit projection.';
  end if;

  if (select count(*) from public.container_lines) <> line_count_before + 1 then
    raise exception 'PR10: orchestration must create exactly one target current_fragment line.';
  end if;

  if (select count(*) from public.stock_movements) <> movement_count_before + 2 then
    raise exception 'PR10: orchestration must write exactly isolate_pack and break_pack movement rows.';
  end if;

  if (pr10_result ->> 'sourceInventoryUnitId')::uuid <> multi_pack_iu_uuid
     or (pr10_result ->> 'sourceContainerLineId')::uuid <> multi_pack_line_uuid
     or (pr10_result ->> 'containerId')::uuid <> multi_pack_container_uuid
     or (pr10_result ->> 'sourceContainerId')::uuid <> multi_pack_container_uuid
     or (pr10_result ->> 'targetContainerId')::uuid <> multi_pack_container_uuid
     or (pr10_result ->> 'locationId')::uuid <> source_location_uuid
     or (pr10_result ->> 'sourceQuantityBefore')::numeric <> source_qty_before
     or (pr10_result ->> 'sourceQuantityAfter')::numeric <> source_qty_before - 12
     or (pr10_result ->> 'sourcePackCountBefore')::integer <> source_pack_count_before
     or (pr10_result ->> 'sourcePackCountAfter')::integer <> source_pack_count_before - 1
     or (pr10_result ->> 'targetQuantityEach')::numeric <> 12
     or (pr10_result ->> 'targetPackCount')::integer <> 1
     or pr10_result ->> 'targetPackagingStateBefore' <> 'sealed'
     or pr10_result ->> 'targetPackagingStateAfter' <> 'opened'
     or (pr10_result ->> 'packagingProfileLevelId')::uuid is distinct from receipt_profile_level_before
     or pr10_result ->> 'reasonCode' <> 'OPEN_ONE_CARTON'
     or pr10_result ->> 'note' <> 'isolate and open one carton'
     or (pr10_result ->> 'isolateMovementId')::uuid is null
     or (pr10_result ->> 'breakPackMovementId')::uuid is null then
    raise exception 'PR10: orchestration returned unexpected payload: %', pr10_result;
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = multi_pack_line_uuid
      and cl.qty_each = receipt_qty_before
      and cl.packaging_profile_level_id_at_receipt = receipt_profile_level_before
      and cl.pack_level_snapshot_jsonb = receipt_snapshot_before
      and cl.receipt_correlation_key = receipt_correlation_before
      and cl.current_container_id = multi_pack_container_uuid
      and cl.current_qty_each = source_qty_before - 12
      and cl.current_packaging_state = 'sealed'
      and cl.current_packaging_profile_level_id = receipt_profile_level_before
      and cl.current_pack_count = source_pack_count_before - 1
      and cl.current_inventory_status = 'available'
  ) then
    raise exception 'PR10: source canonical row must preserve receipt truth and decrement one sealed pack.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = target_line_uuid
      and cl.line_kind = 'current_fragment'
      and cl.current_container_id = multi_pack_container_uuid
      and cl.current_qty_each = 12
      and cl.current_packaging_state = 'opened'
      and cl.current_packaging_profile_level_id = receipt_profile_level_before
      and cl.current_pack_count = 1
      and cl.current_inventory_status = 'available'
      and cl.parent_container_line_id = multi_pack_line_uuid
      and cl.root_receipt_line_id = multi_pack_line_uuid
      and cl.product_id = product_uuid
  ) then
    raise exception 'PR10: target canonical fragment must be opened same-container packaged stock.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    join public.container_lines cl on cl.id = iu.container_line_id
    where iu.id = multi_pack_iu_uuid
      and iu.container_id = cl.current_container_id
      and iu.product_id = product_uuid
      and iu.quantity = cl.current_qty_each
      and iu.status = cl.current_inventory_status
      and iu.packaging_state = cl.current_packaging_state
      and iu.product_packaging_level_id = packaging_level_uuid
      and iu.pack_count = cl.current_pack_count
      and iu.container_line_id = multi_pack_line_uuid
  ) then
    raise exception 'PR10: source inventory_unit projection must align with source canonical row.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    join public.container_lines cl on cl.id = iu.container_line_id
    where iu.id = target_iu_uuid
      and iu.source_inventory_unit_id = multi_pack_iu_uuid
      and iu.container_id = multi_pack_container_uuid
      and iu.product_id = product_uuid
      and iu.quantity = 12
      and iu.status = 'available'
      and iu.packaging_state = 'opened'
      and iu.product_packaging_level_id = packaging_level_uuid
      and iu.pack_count = 1
      and iu.container_line_id = target_line_uuid
      and cl.current_qty_each = iu.quantity
      and cl.current_packaging_state = iu.packaging_state
      and cl.current_pack_count = iu.pack_count
  ) then
    raise exception 'PR10: target inventory_unit projection must align with opened target canonical row.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (pr10_result ->> 'isolateMovementId')::uuid
      and sm.movement_type = 'isolate_pack'
      and sm.source_location_id = source_location_uuid
      and sm.target_location_id = source_location_uuid
      and sm.source_container_id = multi_pack_container_uuid
      and sm.target_container_id = multi_pack_container_uuid
      and sm.source_inventory_unit_id = multi_pack_iu_uuid
      and sm.target_inventory_unit_id is null
      and sm.quantity = 12
      and sm.reason_code = 'OPEN_ONE_CARTON'
      and sm.packaging_state_before = 'sealed'
      and sm.packaging_state_after = 'sealed'
      and sm.pack_count_before = 3
      and sm.pack_count_after = 2
  ) then
    raise exception 'PR10: isolate_pack movement must remain truthful.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (pr10_result ->> 'breakPackMovementId')::uuid
      and sm.movement_type = 'break_pack'
      and sm.source_location_id = source_location_uuid
      and sm.target_location_id is null
      and sm.source_container_id = multi_pack_container_uuid
      and sm.target_container_id is null
      and sm.source_inventory_unit_id = target_iu_uuid
      and sm.target_inventory_unit_id is null
      and sm.quantity = 12
      and sm.reason_code = 'OPEN_ONE_CARTON'
      and sm.packaging_state_before = 'sealed'
      and sm.packaging_state_after = 'opened'
      and sm.pack_count_before = 1
      and sm.pack_count_after = 1
  ) then
    raise exception 'PR10: break_pack movement must remain truthful for the isolated target.';
  end if;

  normalize_result := public.normalize_opened_packaging_to_loose(
    target_iu_uuid,
    'OPENED_FOR_PICK',
    actor_uuid,
    'normalize PR10 target'
  );

  if normalize_result ->> 'packagingStateBefore' <> 'opened'
     or normalize_result ->> 'packagingStateAfter' <> 'loose'
     or normalize_result ->> 'packCountAfter' is not null then
    raise exception 'PR10: opened target must compose with PR7 normalization: %', normalize_result;
  end if;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => manual_container_uuid,
    product_uuid => product_uuid,
    quantity => 24,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 2,
    receipt_correlation_key => 'PR98-MANUAL-001'
  );
  manual_multi_pack_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  manual_isolate_result := public.isolate_sealed_pack_from_multipack(
    manual_multi_pack_iu_uuid,
    'MANUAL_OPEN_ONE',
    'manual comparison'
  );
  manual_target_iu_uuid := (manual_isolate_result ->> 'targetInventoryUnitId')::uuid;

  manual_break_result := public.break_sealed_packaging_to_opened(
    manual_target_iu_uuid,
    'MANUAL_OPEN_ONE',
    'manual comparison'
  );

  if (manual_isolate_result ->> 'sourceQuantityAfter')::numeric <> 12
     or (manual_isolate_result ->> 'sourcePackCountAfter')::integer <> 1
     or manual_break_result ->> 'packagingStateAfter' <> 'opened'
     or (manual_break_result ->> 'quantityEach')::numeric <> 12
     or (manual_break_result ->> 'packCountAfter')::integer <> 1 then
    raise exception 'PR10: manual PR9 then PR8 composition produced unexpected logical state.';
  end if;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => single_container_uuid,
    product_uuid => product_uuid,
    quantity => 12,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR98-SINGLE-001'
  );
  single_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => opened_container_uuid,
    product_uuid => product_uuid,
    quantity => 12,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'opened',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR98-OPENED-001'
  );
  opened_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => loose_container_uuid,
    product_uuid => product_uuid,
    quantity => 5,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR98-LOOSE-001'
  );
  loose_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => serial_container_uuid,
    product_uuid => product_uuid,
    quantity => 1,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => each_packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR98-SERIAL-001',
    serial_no => 'PR98-SERIAL'
  );
  serial_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => status_container_uuid,
    product_uuid => product_uuid,
    quantity => 24,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 2,
    receipt_correlation_key => 'PR98-STATUS-001'
  );
  status_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  status_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(status_iu_uuid, actor_uuid);

  select count(*) into rejected_movement_count_before
  from public.stock_movements
  where source_inventory_unit_id in (
    single_iu_uuid,
    opened_iu_uuid,
    loose_iu_uuid,
    serial_iu_uuid,
    status_iu_uuid
  );

  begin
    perform public.break_one_pack_from_multipack_to_opened(single_iu_uuid, 'SINGLE_TEST', null);
    raise exception 'PR10: expected single-pack source to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ISOLATE_PACK_REQUIRES_MULTI_PACK' then
        raise;
      end if;
  end;

  begin
    perform public.break_one_pack_from_multipack_to_opened(opened_iu_uuid, 'OPENED_TEST', null);
    raise exception 'PR10: expected opened source to be rejected.';
  exception
    when others then
      if sqlerrm <> 'OPENED_PACKAGING_ISOLATE_NOT_ALLOWED' then
        raise;
      end if;
  end;

  begin
    perform public.break_one_pack_from_multipack_to_opened(loose_iu_uuid, 'LOOSE_TEST', null);
    raise exception 'PR10: expected loose source to be rejected.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_ALREADY_LOOSE' then
        raise;
      end if;
  end;

  begin
    perform public.break_one_pack_from_multipack_to_opened(serial_iu_uuid, 'SERIAL_TEST', null);
    raise exception 'PR10: expected serial source to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SERIAL_ISOLATE_PACK_NOT_ALLOWED' then
        raise;
      end if;
  end;

  update public.container_lines
  set current_inventory_status = 'reserved'
  where id = status_line_uuid;

  update public.inventory_unit
  set status = 'reserved'
  where id = status_iu_uuid;

  begin
    perform public.break_one_pack_from_multipack_to_opened(status_iu_uuid, 'RESERVED_TEST', null);
    raise exception 'PR10: expected reserved source to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE' then
        raise;
      end if;
  end;

  update public.container_lines
  set current_inventory_status = 'hold'
  where id = status_line_uuid;

  update public.inventory_unit
  set status = 'hold'
  where id = status_iu_uuid;

  begin
    perform public.break_one_pack_from_multipack_to_opened(status_iu_uuid, 'HOLD_TEST', null);
    raise exception 'PR10: expected hold source to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE' then
        raise;
      end if;
  end;

  update public.container_lines
  set current_inventory_status = 'damaged'
  where id = status_line_uuid;

  update public.inventory_unit
  set status = 'damaged'
  where id = status_iu_uuid;

  begin
    perform public.break_one_pack_from_multipack_to_opened(status_iu_uuid, 'DAMAGED_TEST', null);
    raise exception 'PR10: expected damaged source to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE' then
        raise;
      end if;
  end;

  begin
    perform public.break_one_pack_from_multipack_to_opened(single_iu_uuid, '   ', null);
    raise exception 'PR10: expected blank reason to be rejected.';
  exception
    when others then
      if sqlerrm <> 'BREAK_ONE_PACK_REASON_REQUIRED' then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claims', '{}'::text, true);

  begin
    perform public.break_one_pack_from_multipack_to_opened(single_iu_uuid, 'NO_ACTOR', null);
    raise exception 'PR10: expected missing actor to be rejected.';
  exception
    when others then
      if sqlerrm <> 'BREAK_ONE_PACK_ACTOR_REQUIRED' then
        raise;
      end if;
  end;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', unauthorized_actor_uuid::text)::text,
    true
  );

  begin
    perform public.break_one_pack_from_multipack_to_opened(single_iu_uuid, 'UNAUTHORIZED', null);
    raise exception 'PR10: expected unauthorized actor to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SOURCE_INVENTORY_UNIT_NOT_FOUND' then
        raise;
      end if;
  end;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  if (
    select count(*)
    from public.stock_movements
    where source_inventory_unit_id in (
      single_iu_uuid,
      opened_iu_uuid,
      loose_iu_uuid,
      serial_iu_uuid,
      status_iu_uuid
    )
  ) <> rejected_movement_count_before then
    raise exception 'PR10: rejected orchestration attempts must not write movement rows.';
  end if;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => atomic_container_uuid,
    product_uuid => product_uuid,
    quantity => 24,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 2,
    receipt_correlation_key => 'PR98-ATOMIC-001'
  );
  atomic_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  atomic_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(atomic_iu_uuid, actor_uuid);

  select count(*) into atomic_inventory_count_before from public.inventory_unit;
  select count(*) into atomic_line_count_before from public.container_lines;
  select count(*) into atomic_movement_count_before from public.stock_movements;

  execute $ddl$
    create or replace function public.break_sealed_packaging_to_opened(
      source_inventory_unit_uuid uuid,
      reason_code text,
      note text default null
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $stub$
    begin
      raise exception 'PR10_FORCED_BREAK_FAILURE';
    end
    $stub$;
  $ddl$;

  begin
    perform public.break_one_pack_from_multipack_to_opened(
      atomic_iu_uuid,
      'FORCED_FAILURE',
      'force second step failure'
    );
    raise exception 'PR10: expected forced PR8 failure.';
  exception
    when others then
      if sqlerrm <> 'PR10_FORCED_BREAK_FAILURE' then
        raise;
      end if;
  end;

  if (select count(*) from public.inventory_unit) <> atomic_inventory_count_before then
    raise exception 'PR10: failed orchestration must not leave target inventory_unit projection.';
  end if;

  if (select count(*) from public.container_lines) <> atomic_line_count_before then
    raise exception 'PR10: failed orchestration must not leave target canonical fragment.';
  end if;

  if (select count(*) from public.stock_movements) <> atomic_movement_count_before then
    raise exception 'PR10: failed orchestration must not leave isolate_pack movement.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    join public.inventory_unit iu on iu.container_line_id = cl.id
    where cl.id = atomic_line_uuid
      and iu.id = atomic_iu_uuid
      and cl.current_qty_each = 24
      and cl.current_pack_count = 2
      and cl.current_packaging_state = 'sealed'
      and iu.quantity = cl.current_qty_each
      and iu.pack_count = cl.current_pack_count
      and iu.packaging_state = cl.current_packaging_state
  ) then
    raise exception 'PR10: failed orchestration must not decrement source current row or projection.';
  end if;

  raise notice 'All 0098 PR10 break-one-pack orchestration tests passed.';
end
$$;

rollback;
