begin;

do $$
declare
  default_tenant_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;
  product_uuid uuid := gen_random_uuid();
  packaging_level_uuid uuid := gen_random_uuid();
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  source_location_uuid uuid := gen_random_uuid();
  target_location_uuid uuid := gen_random_uuid();

  opened_container_uuid uuid := gen_random_uuid();
  sealed_container_uuid uuid := gen_random_uuid();
  loose_container_uuid uuid := gen_random_uuid();
  serial_container_uuid uuid := gen_random_uuid();
  reserved_container_uuid uuid := gen_random_uuid();
  target_container_uuid uuid := gen_random_uuid();

  receive_result jsonb;
  normalize_result jsonb;
  split_result jsonb;

  opened_iu_uuid uuid;
  opened_line_uuid uuid;
  sealed_iu_uuid uuid;
  loose_iu_uuid uuid;
  serial_iu_uuid uuid;
  reserved_iu_uuid uuid;
  reserved_line_uuid uuid;

  receipt_qty_before numeric;
  receipt_profile_level_before uuid;
  receipt_snapshot_before jsonb;
  receipt_is_non_standard_before boolean;
  current_qty_before numeric;
  inventory_count_before integer;
  line_count_before integer;
  movement_count_before integer;
  rejected_movement_count_before integer;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR7: expected default tenant to exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'PR7: expected pallet container type to exist.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr95-actor@wos.test', now(), now(), now(),
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
  values (product_uuid, 'test-suite', 'pr95-product', 'SKU-PR95', 'PR95 Product', true);

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty, is_base, can_pick, can_store,
    is_default_pick_uom, is_active
  )
  values (
    packaging_level_uuid, product_uuid, 'CTN', 'Carton', 12, false, true, true,
    false, true
  );

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PR95-SITE', 'PR95 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'PR95-FLOOR', 'PR95 Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  )
  values
    (source_location_uuid, default_tenant_uuid, floor_uuid, 'PR95-SOURCE', 'staging', 'multi_container', 'active'),
    (target_location_uuid, default_tenant_uuid, floor_uuid, 'PR95-TARGET', 'staging', 'multi_container', 'active');

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status,
    current_location_id, current_location_entered_at
  )
  values
    (opened_container_uuid, default_tenant_uuid, 'PR95-OPENED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (sealed_container_uuid, default_tenant_uuid, 'PR95-SEALED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (loose_container_uuid, default_tenant_uuid, 'PR95-LOOSE-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (serial_container_uuid, default_tenant_uuid, 'PR95-SERIAL-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (reserved_container_uuid, default_tenant_uuid, 'PR95-RESERVED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (target_container_uuid, default_tenant_uuid, 'PR95-TARGET-C', pallet_type_uuid, 'active', target_location_uuid, now());

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
    receipt_correlation_key => 'PR95-OPENED-001'
  );
  opened_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  opened_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;

  if opened_iu_uuid is null or opened_line_uuid is null then
    raise exception 'PR7: receive_inventory_unit must create opened projection and canonical receipt line.';
  end if;

  perform public.ensure_inventory_unit_current_container_line(opened_iu_uuid, actor_uuid);

  begin
    perform public.split_inventory_unit(opened_iu_uuid, 1, target_container_uuid, actor_uuid);
    raise exception 'PR7: expected opened packaged stock split characterization to fail.';
  exception
    when others then
      if sqlerrm <> 'OPENED_PACKAGING_SPLIT_NOT_ALLOWED' then
        raise;
      end if;
  end;

  begin
    perform public.adjust_inventory_unit_canonical(opened_iu_uuid, 1, 'PACKAGED_TEST', actor_uuid, null);
    raise exception 'PR7: expected packaged adjustment characterization to fail.';
  exception
    when others then
      if sqlerrm <> 'PACKAGED_ADJUSTMENT_NOT_SUPPORTED' then
        raise;
      end if;
  end;

  select
    cl.qty_each,
    cl.packaging_profile_level_id_at_receipt,
    cl.pack_level_snapshot_jsonb,
    cl.is_non_standard_pack,
    cl.current_qty_each
  into
    receipt_qty_before,
    receipt_profile_level_before,
    receipt_snapshot_before,
    receipt_is_non_standard_before,
    current_qty_before
  from public.container_lines cl
  where cl.id = opened_line_uuid;

  select count(*) into inventory_count_before from public.inventory_unit;
  select count(*) into line_count_before from public.container_lines;
  select count(*) into movement_count_before from public.stock_movements;

  execute 'set local role authenticated';

  begin
    update public.container_lines
    set current_packaging_state = 'loose'
    where id = opened_line_uuid;
    raise exception 'PR7: expected direct container_lines packaging update to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.inventory_unit
    set packaging_state = 'loose'
    where id = opened_iu_uuid;
    raise exception 'PR7: expected direct inventory_unit packaging update to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.stock_movements (
      tenant_id,
      movement_type,
      source_container_id,
      source_inventory_unit_id,
      quantity,
      uom,
      status,
      reason_code,
      packaging_state_before,
      packaging_state_after,
      packaging_profile_level_id_before,
      pack_count_before,
      created_by
    )
    values (
      default_tenant_uuid,
      'normalize_packaging',
      opened_container_uuid,
      opened_iu_uuid,
      6,
      'pcs',
      'done',
      'BYPASS',
      'opened',
      'loose',
      receipt_profile_level_before,
      1,
      actor_uuid
    );
    raise exception 'PR7: expected direct stock_movements normalize insert to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  normalize_result := public.normalize_opened_packaging_to_loose(
    opened_iu_uuid,
    'OPENED_FOR_PICK',
    gen_random_uuid(),
    'operator opened carton'
  );

  execute 'reset role';

  if (normalize_result ->> 'inventoryUnitId')::uuid <> opened_iu_uuid
     or (normalize_result ->> 'containerLineId')::uuid <> opened_line_uuid
     or (normalize_result ->> 'containerId')::uuid <> opened_container_uuid
     or (normalize_result ->> 'locationId')::uuid <> source_location_uuid
     or (normalize_result ->> 'quantityEach')::numeric <> current_qty_before
     or normalize_result ->> 'packagingStateBefore' <> 'opened'
     or normalize_result ->> 'packagingStateAfter' <> 'loose'
     or (normalize_result ->> 'packagingProfileLevelIdBefore')::uuid is distinct from receipt_profile_level_before
     or normalize_result ->> 'packagingProfileLevelIdAfter' is not null
     or (normalize_result ->> 'packCountBefore')::integer <> 1
     or normalize_result ->> 'packCountAfter' is not null
     or normalize_result ->> 'reasonCode' <> 'OPENED_FOR_PICK'
     or normalize_result ->> 'note' <> 'operator opened carton' then
    raise exception 'PR7: normalization returned unexpected payload: %', normalize_result;
  end if;

  if (select count(*) from public.inventory_unit) <> inventory_count_before then
    raise exception 'PR7: normalization must not create inventory_unit rows.';
  end if;

  if (select count(*) from public.container_lines) <> line_count_before then
    raise exception 'PR7: normalization must not create container_lines rows.';
  end if;

  if (select count(*) from public.stock_movements) <> movement_count_before + 1 then
    raise exception 'PR7: normalization must write exactly one movement row.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = opened_line_uuid
      and cl.line_kind = 'receipt'
      and cl.container_id = opened_container_uuid
      and cl.qty_each = receipt_qty_before
      and cl.packaging_profile_level_id_at_receipt = receipt_profile_level_before
      and cl.pack_level_snapshot_jsonb = receipt_snapshot_before
      and cl.is_non_standard_pack = receipt_is_non_standard_before
      and cl.receipt_correlation_key = 'PR95-OPENED-001'
      and cl.current_container_id = opened_container_uuid
      and cl.current_qty_each = current_qty_before
      and cl.current_inventory_status = 'available'
      and cl.current_packaging_state = 'loose'
      and cl.current_packaging_profile_level_id is null
      and cl.current_pack_count is null
      and cl.root_receipt_line_id = cl.id
      and cl.parent_container_line_id is null
  ) then
    raise exception 'PR7: normalization must mutate only canonical current packaging fields and preserve receipt facts.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    join public.container_lines cl on cl.id = iu.container_line_id
    where iu.id = opened_iu_uuid
      and iu.container_id = cl.current_container_id
      and iu.quantity = cl.current_qty_each
      and iu.status = cl.current_inventory_status
      and iu.packaging_state = cl.current_packaging_state
      and iu.product_packaging_level_id is null
      and iu.pack_count is null
      and iu.container_line_id = cl.id
  ) then
    raise exception 'PR7: normalization must sync inventory_unit projection to canonical current row.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (normalize_result ->> 'movementId')::uuid
      and sm.movement_type = 'normalize_packaging'
      and sm.source_location_id = source_location_uuid
      and sm.target_location_id is null
      and sm.source_container_id = opened_container_uuid
      and sm.target_container_id is null
      and sm.source_inventory_unit_id = opened_iu_uuid
      and sm.target_inventory_unit_id is null
      and sm.quantity = current_qty_before
      and sm.uom = 'pcs'
      and sm.reason_code = 'OPENED_FOR_PICK'
      and sm.note = 'operator opened carton'
      and sm.packaging_state_before = 'opened'
      and sm.packaging_state_after = 'loose'
      and sm.packaging_profile_level_id_before = receipt_profile_level_before
      and sm.packaging_profile_level_id_after is null
      and sm.pack_count_before = 1
      and sm.pack_count_after is null
      and sm.created_by = actor_uuid
  ) then
    raise exception 'PR7: normalization movement did not record truthful audit fields.';
  end if;

  split_result := public.split_inventory_unit(opened_iu_uuid, 2, target_container_uuid, actor_uuid);

  if (split_result ->> 'sourceQuantity')::numeric <> current_qty_before - 2 then
    raise exception 'PR7: normalized loose stock should be splittable by existing split flow: %', split_result;
  end if;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => sealed_container_uuid,
    product_uuid => product_uuid,
    quantity => 12,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR95-SEALED-001'
  );
  sealed_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  begin
    perform public.normalize_opened_packaging_to_loose(sealed_iu_uuid, 'SEALED_TEST', actor_uuid, null);
    raise exception 'PR7: expected sealed normalization to be rejected.';
  exception
    when others then
      if sqlerrm <> 'NORMALIZE_PACKAGING_ONLY_OPENED_SUPPORTED' then
        raise;
      end if;
  end;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => loose_container_uuid,
    product_uuid => product_uuid,
    quantity => 5,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR95-LOOSE-001'
  );
  loose_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  begin
    perform public.normalize_opened_packaging_to_loose(loose_iu_uuid, 'LOOSE_TEST', actor_uuid, null);
    raise exception 'PR7: expected loose normalization to be rejected.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_ALREADY_LOOSE' then
        raise;
      end if;
  end;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => serial_container_uuid,
    product_uuid => product_uuid,
    quantity => 1,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR95-SERIAL-001',
    serial_no => 'PR95-SERIAL'
  );
  serial_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  begin
    perform public.normalize_opened_packaging_to_loose(serial_iu_uuid, 'SERIAL_TEST', actor_uuid, null);
    raise exception 'PR7: expected serial normalization to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SERIAL_NORMALIZE_PACKAGING_NOT_ALLOWED' then
        raise;
      end if;
  end;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => reserved_container_uuid,
    product_uuid => product_uuid,
    quantity => 6,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'opened',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR95-RESERVED-001'
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

  begin
    perform public.normalize_opened_packaging_to_loose(reserved_iu_uuid, 'RESERVED_TEST', actor_uuid, null);
    raise exception 'PR7: expected reserved normalization to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE' then
        raise;
      end if;
  end;

  select count(*) into rejected_movement_count_before
  from public.stock_movements
  where source_inventory_unit_id in (sealed_iu_uuid, loose_iu_uuid, serial_iu_uuid, reserved_iu_uuid);

  begin
    perform public.normalize_opened_packaging_to_loose(sealed_iu_uuid, '   ', actor_uuid, null);
    raise exception 'PR7: expected blank reason to be rejected.';
  exception
    when others then
      if sqlerrm <> 'NORMALIZE_PACKAGING_REASON_REQUIRED' then
        raise;
      end if;
  end;

  if (
    select count(*)
    from public.stock_movements
    where source_inventory_unit_id in (sealed_iu_uuid, loose_iu_uuid, serial_iu_uuid, reserved_iu_uuid)
  ) <> rejected_movement_count_before then
    raise exception 'PR7: rejected normalization attempts must not write movement rows.';
  end if;

  raise notice 'All 0095 PR7 canonical packaging normalization tests passed.';
end
$$;

rollback;
