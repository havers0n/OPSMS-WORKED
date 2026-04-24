begin;

do $$
declare
  default_tenant_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;
  product_uuid uuid := gen_random_uuid();
  packaging_level_uuid uuid := gen_random_uuid();
  each_packaging_level_uuid uuid := gen_random_uuid();
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  source_location_uuid uuid := gen_random_uuid();

  multi_pack_container_uuid uuid := gen_random_uuid();
  opened_container_uuid uuid := gen_random_uuid();
  loose_container_uuid uuid := gen_random_uuid();
  serial_container_uuid uuid := gen_random_uuid();
  reserved_container_uuid uuid := gen_random_uuid();
  mismatch_container_uuid uuid := gen_random_uuid();

  receive_result jsonb;
  isolate_result jsonb;
  break_result jsonb;
  normalize_result jsonb;

  existing_single_iu_uuid uuid;
  multi_pack_iu_uuid uuid;
  multi_pack_line_uuid uuid;
  target_iu_uuid uuid;
  target_line_uuid uuid;
  opened_iu_uuid uuid;
  loose_iu_uuid uuid;
  serial_iu_uuid uuid;
  reserved_iu_uuid uuid;
  reserved_line_uuid uuid;
  mismatch_iu_uuid uuid;
  mismatch_line_uuid uuid;

  receipt_qty_before numeric;
  receipt_profile_level_before uuid;
  receipt_snapshot_before jsonb;
  source_qty_before numeric;
  source_pack_count_before integer;
  inventory_count_before integer;
  line_count_before integer;
  movement_count_before integer;
  rejected_movement_count_before integer;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR9: expected default tenant to exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'PR9: expected pallet container type to exist.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr97-actor@wos.test', now(), now(), now(),
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
  values (product_uuid, 'test-suite', 'pr97-product', 'SKU-PR97', 'PR97 Product', true);

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
  values (site_uuid, default_tenant_uuid, 'PR97-SITE', 'PR97 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'PR97-FLOOR', 'PR97 Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  )
  values (
    source_location_uuid, default_tenant_uuid, floor_uuid,
    'PR97-SOURCE', 'staging', 'multi_container', 'active'
  );

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status,
    current_location_id, current_location_entered_at
  )
  values
    (multi_pack_container_uuid, default_tenant_uuid, 'PR97-MULTI-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (opened_container_uuid, default_tenant_uuid, 'PR97-OPENED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (loose_container_uuid, default_tenant_uuid, 'PR97-LOOSE-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (serial_container_uuid, default_tenant_uuid, 'PR97-SERIAL-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (reserved_container_uuid, default_tenant_uuid, 'PR97-RESERVED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (mismatch_container_uuid, default_tenant_uuid, 'PR97-MISMATCH-C', pallet_type_uuid, 'active', source_location_uuid, now());

  -- Existing compatible same-container row proves PR9 does not merge.
  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => multi_pack_container_uuid,
    product_uuid => product_uuid,
    quantity => 12,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR97-EXISTING-001'
  );
  existing_single_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

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
    receipt_correlation_key => 'PR97-MULTI-001'
  );
  multi_pack_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  multi_pack_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;

  perform public.ensure_inventory_unit_current_container_line(multi_pack_iu_uuid, actor_uuid);

  begin
    perform public.break_sealed_packaging_to_opened(multi_pack_iu_uuid, 'MULTI_DIRECT', null);
    raise exception 'PR9: expected direct multi-pack break-pack to stay rejected.';
  exception
    when others then
      if sqlerrm <> 'BREAK_PACK_ONLY_SINGLE_PACK_SUPPORTED' then
        raise;
      end if;
  end;

  select
    cl.qty_each,
    cl.packaging_profile_level_id_at_receipt,
    cl.pack_level_snapshot_jsonb,
    cl.current_qty_each,
    cl.current_pack_count
  into
    receipt_qty_before,
    receipt_profile_level_before,
    receipt_snapshot_before,
    source_qty_before,
    source_pack_count_before
  from public.container_lines cl
  where cl.id = multi_pack_line_uuid;

  select count(*) into inventory_count_before from public.inventory_unit;
  select count(*) into line_count_before from public.container_lines;
  select count(*) into movement_count_before from public.stock_movements;

  isolate_result := public.isolate_sealed_pack_from_multipack(
    multi_pack_iu_uuid,
    'OPEN_ONE_CARTON',
    'isolate carton at pick face'
  );

  target_iu_uuid := (isolate_result ->> 'targetInventoryUnitId')::uuid;
  target_line_uuid := (isolate_result ->> 'targetContainerLineId')::uuid;

  if target_iu_uuid is null or target_line_uuid is null then
    raise exception 'PR9: isolate result must include target projection and canonical line ids: %', isolate_result;
  end if;

  if target_iu_uuid = existing_single_iu_uuid then
    raise exception 'PR9: isolation must not merge into an existing same-container compatible projection row.';
  end if;

  if (select count(*) from public.inventory_unit) <> inventory_count_before + 1 then
    raise exception 'PR9: isolation must create exactly one target inventory_unit projection.';
  end if;

  if (select count(*) from public.container_lines) <> line_count_before + 1 then
    raise exception 'PR9: isolation must create exactly one target current_fragment line.';
  end if;

  if (select count(*) from public.stock_movements) <> movement_count_before + 1 then
    raise exception 'PR9: isolation must write exactly one stock movement.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = multi_pack_line_uuid
      and cl.qty_each = receipt_qty_before
      and cl.packaging_profile_level_id_at_receipt = receipt_profile_level_before
      and cl.pack_level_snapshot_jsonb = receipt_snapshot_before
      and cl.current_container_id = multi_pack_container_uuid
      and cl.current_qty_each = source_qty_before - 12
      and cl.current_packaging_state = 'sealed'
      and cl.current_packaging_profile_level_id = receipt_profile_level_before
      and cl.current_pack_count = source_pack_count_before - 1
      and cl.current_inventory_status = 'available'
  ) then
    raise exception 'PR9: source canonical row did not preserve receipt truth and decrement one sealed pack.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = target_line_uuid
      and cl.line_kind = 'current_fragment'
      and cl.current_container_id = multi_pack_container_uuid
      and cl.current_qty_each = 12
      and cl.current_packaging_state = 'sealed'
      and cl.current_packaging_profile_level_id = receipt_profile_level_before
      and cl.current_pack_count = 1
      and cl.current_inventory_status = 'available'
      and cl.parent_container_line_id = multi_pack_line_uuid
      and cl.root_receipt_line_id = multi_pack_line_uuid
  ) then
    raise exception 'PR9: target canonical fragment did not preserve sealed same-container lineage.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    join public.container_lines cl on cl.id = iu.container_line_id
    where iu.id = multi_pack_iu_uuid
      and iu.container_id = cl.current_container_id
      and iu.quantity = cl.current_qty_each
      and iu.status = cl.current_inventory_status
      and iu.packaging_state = cl.current_packaging_state
      and iu.pack_count = cl.current_pack_count
  ) then
    raise exception 'PR9: source inventory_unit projection must align with source canonical row.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    join public.container_lines cl on cl.id = iu.container_line_id
    where iu.id = target_iu_uuid
      and iu.source_inventory_unit_id = multi_pack_iu_uuid
      and iu.container_id = multi_pack_container_uuid
      and iu.quantity = 12
      and iu.status = 'available'
      and iu.packaging_state = 'sealed'
      and iu.product_packaging_level_id = packaging_level_uuid
      and iu.pack_count = 1
      and cl.id = target_line_uuid
      and cl.current_qty_each = iu.quantity
      and cl.current_pack_count = iu.pack_count
  ) then
    raise exception 'PR9: target inventory_unit projection must be newly created and aligned.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (isolate_result ->> 'movementId')::uuid
      and sm.movement_type = 'isolate_pack'
      and sm.source_location_id = source_location_uuid
      and sm.target_location_id = source_location_uuid
      and sm.source_container_id = multi_pack_container_uuid
      and sm.target_container_id = multi_pack_container_uuid
      and sm.source_inventory_unit_id = multi_pack_iu_uuid
      and sm.target_inventory_unit_id is null
      and sm.quantity = 12
      and sm.uom = 'pcs'
      and sm.reason_code = 'OPEN_ONE_CARTON'
      and sm.note = 'isolate carton at pick face'
      and sm.packaging_state_before = 'sealed'
      and sm.packaging_state_after = 'sealed'
      and sm.packaging_profile_level_id_before = receipt_profile_level_before
      and sm.packaging_profile_level_id_after = receipt_profile_level_before
      and sm.pack_count_before = 3
      and sm.pack_count_after = 2
      and sm.created_by = actor_uuid
  ) then
    raise exception 'PR9: isolate_pack movement did not record same-container audit semantics.';
  end if;

  break_result := public.break_sealed_packaging_to_opened(
    target_iu_uuid,
    'OPERATOR_OPENED_CASE',
    'opened isolated carton'
  );

  if break_result ->> 'packagingStateBefore' <> 'sealed'
     or break_result ->> 'packagingStateAfter' <> 'opened'
     or (break_result ->> 'packCountAfter')::integer <> 1 then
    raise exception 'PR9: isolated target must compose with PR8 break-pack: %', break_result;
  end if;

  normalize_result := public.normalize_opened_packaging_to_loose(
    target_iu_uuid,
    'OPENED_FOR_PICK',
    actor_uuid,
    'normalize isolated carton'
  );

  if normalize_result ->> 'packagingStateBefore' <> 'opened'
     or normalize_result ->> 'packagingStateAfter' <> 'loose'
     or normalize_result ->> 'packCountAfter' is not null then
    raise exception 'PR9: isolated target must compose with PR7 normalization: %', normalize_result;
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = multi_pack_line_uuid
      and cl.current_packaging_state = 'sealed'
      and cl.current_pack_count = 2
      and cl.current_qty_each = 24
  ) then
    raise exception 'PR9: source row must remain sealed and truthful after target PR8/PR7 composition.';
  end if;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => opened_container_uuid,
    product_uuid => product_uuid,
    quantity => 6,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'opened',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR97-OPENED-001'
  );
  opened_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => loose_container_uuid,
    product_uuid => product_uuid,
    quantity => 5,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR97-LOOSE-001'
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
    receipt_correlation_key => 'PR97-SERIAL-001',
    serial_no => 'PR97-SERIAL'
  );
  serial_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => reserved_container_uuid,
    product_uuid => product_uuid,
    quantity => 24,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 2,
    receipt_correlation_key => 'PR97-RESERVED-001'
  );
  reserved_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  reserved_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(reserved_iu_uuid, actor_uuid);

  update public.container_lines
  set current_inventory_status = 'reserved'
  where id = reserved_line_uuid;

  update public.inventory_unit
  set status = 'reserved'
  where id = reserved_iu_uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => mismatch_container_uuid,
    product_uuid => product_uuid,
    quantity => 24,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 2,
    receipt_correlation_key => 'PR97-MISMATCH-001'
  );
  mismatch_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  mismatch_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(mismatch_iu_uuid, actor_uuid);

  update public.container_lines
  set current_qty_each = 23
  where id = mismatch_line_uuid;

  select count(*) into rejected_movement_count_before
  from public.stock_movements
  where movement_type = 'isolate_pack';

  begin
    perform public.isolate_sealed_pack_from_multipack(existing_single_iu_uuid, 'SINGLE_TEST', null);
    raise exception 'PR9: expected single-pack sealed isolation to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ISOLATE_PACK_REQUIRES_MULTI_PACK' then
        raise;
      end if;
  end;

  begin
    perform public.isolate_sealed_pack_from_multipack(opened_iu_uuid, 'OPENED_TEST', null);
    raise exception 'PR9: expected opened isolation to be rejected.';
  exception
    when others then
      if sqlerrm <> 'OPENED_PACKAGING_ISOLATE_NOT_ALLOWED' then
        raise;
      end if;
  end;

  begin
    perform public.isolate_sealed_pack_from_multipack(loose_iu_uuid, 'LOOSE_TEST', null);
    raise exception 'PR9: expected loose isolation to be rejected.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_ALREADY_LOOSE' then
        raise;
      end if;
  end;

  begin
    perform public.isolate_sealed_pack_from_multipack(serial_iu_uuid, 'SERIAL_TEST', null);
    raise exception 'PR9: expected serial isolation to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SERIAL_ISOLATE_PACK_NOT_ALLOWED' then
        raise;
      end if;
  end;

  begin
    perform public.isolate_sealed_pack_from_multipack(reserved_iu_uuid, 'RESERVED_TEST', null);
    raise exception 'PR9: expected reserved isolation to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE' then
        raise;
      end if;
  end;

  begin
    perform public.isolate_sealed_pack_from_multipack(mismatch_iu_uuid, 'MISMATCH_TEST', null);
    raise exception 'PR9: expected quantity/count mismatch to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SEALED_PACK_COUNT_QUANTITY_MISMATCH' then
        raise;
      end if;
  end;

  begin
    perform public.isolate_sealed_pack_from_multipack(multi_pack_iu_uuid, '   ', null);
    raise exception 'PR9: expected blank reason to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ISOLATE_PACK_REASON_REQUIRED' then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claims', '{}'::text, true);

  begin
    perform public.isolate_sealed_pack_from_multipack(multi_pack_iu_uuid, 'NO_ACTOR', null);
    raise exception 'PR9: expected missing auth actor to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ISOLATE_PACK_ACTOR_REQUIRED' then
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
    where movement_type = 'isolate_pack'
  ) <> rejected_movement_count_before then
    raise exception 'PR9: rejected isolation paths must not write stock movements.';
  end if;

  raise notice 'All 0097 PR9 sealed pack isolation tests passed.';
end
$$;

rollback;
