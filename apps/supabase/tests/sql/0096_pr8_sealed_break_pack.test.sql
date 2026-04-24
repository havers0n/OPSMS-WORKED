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
  target_location_uuid uuid := gen_random_uuid();

  sealed_container_uuid uuid := gen_random_uuid();
  multi_pack_container_uuid uuid := gen_random_uuid();
  opened_container_uuid uuid := gen_random_uuid();
  loose_container_uuid uuid := gen_random_uuid();
  serial_container_uuid uuid := gen_random_uuid();
  reserved_container_uuid uuid := gen_random_uuid();
  mismatch_container_uuid uuid := gen_random_uuid();
  target_container_uuid uuid := gen_random_uuid();

  receive_result jsonb;
  break_result jsonb;
  split_result jsonb;
  normalize_result jsonb;

  sealed_iu_uuid uuid;
  sealed_line_uuid uuid;
  multi_pack_iu_uuid uuid;
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
  receipt_is_non_standard_before boolean;
  current_qty_before numeric;
  current_status_before text;
  inventory_count_before integer;
  line_count_before integer;
  movement_count_before integer;
  rejected_movement_count_before integer;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR8: expected default tenant to exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'PR8: expected pallet container type to exist.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr96-actor@wos.test', now(), now(), now(),
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
  values (product_uuid, 'test-suite', 'pr96-product', 'SKU-PR96', 'PR96 Product', true);

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
  values (site_uuid, default_tenant_uuid, 'PR96-SITE', 'PR96 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'PR96-FLOOR', 'PR96 Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  )
  values
    (source_location_uuid, default_tenant_uuid, floor_uuid, 'PR96-SOURCE', 'staging', 'multi_container', 'active'),
    (target_location_uuid, default_tenant_uuid, floor_uuid, 'PR96-TARGET', 'staging', 'multi_container', 'active');

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status,
    current_location_id, current_location_entered_at
  )
  values
    (sealed_container_uuid, default_tenant_uuid, 'PR96-SEALED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (multi_pack_container_uuid, default_tenant_uuid, 'PR96-MULTI-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (opened_container_uuid, default_tenant_uuid, 'PR96-OPENED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (loose_container_uuid, default_tenant_uuid, 'PR96-LOOSE-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (serial_container_uuid, default_tenant_uuid, 'PR96-SERIAL-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (reserved_container_uuid, default_tenant_uuid, 'PR96-RESERVED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (mismatch_container_uuid, default_tenant_uuid, 'PR96-MISMATCH-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (target_container_uuid, default_tenant_uuid, 'PR96-TARGET-C', pallet_type_uuid, 'active', target_location_uuid, now());

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
    receipt_correlation_key => 'PR96-SEALED-001'
  );
  sealed_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  sealed_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;

  if sealed_iu_uuid is null or sealed_line_uuid is null then
    raise exception 'PR8: receive_inventory_unit must create sealed projection and canonical receipt line.';
  end if;

  perform public.ensure_inventory_unit_current_container_line(sealed_iu_uuid, actor_uuid);

  begin
    perform public.split_inventory_unit(sealed_iu_uuid, 1, target_container_uuid, actor_uuid);
    raise exception 'PR8: expected non-whole-pack sealed split characterization to fail.';
  exception
    when others then
      if sqlerrm <> 'SEALED_SPLIT_REQUIRES_WHOLE_PACKS' then
        raise;
      end if;
  end;

  select
    cl.qty_each,
    cl.packaging_profile_level_id_at_receipt,
    cl.pack_level_snapshot_jsonb,
    cl.is_non_standard_pack,
    cl.current_qty_each,
    cl.current_inventory_status
  into
    receipt_qty_before,
    receipt_profile_level_before,
    receipt_snapshot_before,
    receipt_is_non_standard_before,
    current_qty_before,
    current_status_before
  from public.container_lines cl
  where cl.id = sealed_line_uuid;

  select count(*) into inventory_count_before from public.inventory_unit;
  select count(*) into line_count_before from public.container_lines;
  select count(*) into movement_count_before from public.stock_movements;

  execute 'set local role authenticated';

  begin
    update public.container_lines
    set current_packaging_state = 'opened'
    where id = sealed_line_uuid;
    raise exception 'PR8: expected direct container_lines packaging update to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.inventory_unit
    set packaging_state = 'opened'
    where id = sealed_iu_uuid;
    raise exception 'PR8: expected direct inventory_unit packaging update to be denied.';
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
      packaging_profile_level_id_after,
      pack_count_before,
      pack_count_after,
      created_by
    )
    values (
      default_tenant_uuid,
      'break_pack',
      sealed_container_uuid,
      sealed_iu_uuid,
      12,
      'pcs',
      'done',
      'BYPASS',
      'sealed',
      'opened',
      receipt_profile_level_before,
      receipt_profile_level_before,
      1,
      1,
      actor_uuid
    );
    raise exception 'PR8: expected direct stock_movements break_pack insert to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  break_result := public.break_sealed_packaging_to_opened(
    sealed_iu_uuid,
    'OPERATOR_OPENED_CASE',
    'opened at pick face'
  );

  execute 'reset role';

  if (break_result ->> 'inventoryUnitId')::uuid <> sealed_iu_uuid
     or (break_result ->> 'containerLineId')::uuid <> sealed_line_uuid
     or (break_result ->> 'containerId')::uuid <> sealed_container_uuid
     or (break_result ->> 'locationId')::uuid <> source_location_uuid
     or (break_result ->> 'quantityEach')::numeric <> current_qty_before
     or break_result ->> 'packagingStateBefore' <> 'sealed'
     or break_result ->> 'packagingStateAfter' <> 'opened'
     or (break_result ->> 'packagingProfileLevelIdBefore')::uuid is distinct from receipt_profile_level_before
     or (break_result ->> 'packagingProfileLevelIdAfter')::uuid is distinct from receipt_profile_level_before
     or (break_result ->> 'packCountBefore')::integer <> 1
     or (break_result ->> 'packCountAfter')::integer <> 1
     or break_result ->> 'reasonCode' <> 'OPERATOR_OPENED_CASE'
     or break_result ->> 'note' <> 'opened at pick face' then
    raise exception 'PR8: break-pack returned unexpected payload: %', break_result;
  end if;

  if (select count(*) from public.inventory_unit) <> inventory_count_before then
    raise exception 'PR8: break-pack must not create inventory_unit rows.';
  end if;

  if (select count(*) from public.container_lines) <> line_count_before then
    raise exception 'PR8: break-pack must not create container_lines rows.';
  end if;

  if (select count(*) from public.stock_movements) <> movement_count_before + 1 then
    raise exception 'PR8: break-pack must write exactly one movement row.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = sealed_line_uuid
      and cl.line_kind = 'receipt'
      and cl.container_id = sealed_container_uuid
      and cl.qty_each = receipt_qty_before
      and cl.packaging_profile_level_id_at_receipt = receipt_profile_level_before
      and cl.pack_level_snapshot_jsonb = receipt_snapshot_before
      and cl.is_non_standard_pack = receipt_is_non_standard_before
      and cl.receipt_correlation_key = 'PR96-SEALED-001'
      and cl.current_container_id = sealed_container_uuid
      and cl.current_qty_each = current_qty_before
      and cl.current_inventory_status = current_status_before
      and cl.current_packaging_state = 'opened'
      and cl.current_packaging_profile_level_id = receipt_profile_level_before
      and cl.current_pack_count = 1
      and cl.root_receipt_line_id = cl.id
      and cl.parent_container_line_id is null
  ) then
    raise exception 'PR8: break-pack must mutate only canonical current packaging state and preserve receipt/current facts.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    join public.container_lines cl on cl.id = iu.container_line_id
    where iu.id = sealed_iu_uuid
      and iu.container_id = cl.current_container_id
      and iu.quantity = cl.current_qty_each
      and iu.status = cl.current_inventory_status
      and iu.packaging_state = cl.current_packaging_state
      and iu.product_packaging_level_id = packaging_level_uuid
      and iu.pack_count = 1
      and iu.container_line_id = cl.id
  ) then
    raise exception 'PR8: break-pack must sync inventory_unit projection to canonical current row.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (break_result ->> 'movementId')::uuid
      and sm.movement_type = 'break_pack'
      and sm.source_location_id = source_location_uuid
      and sm.target_location_id is null
      and sm.source_container_id = sealed_container_uuid
      and sm.target_container_id is null
      and sm.source_inventory_unit_id = sealed_iu_uuid
      and sm.target_inventory_unit_id is null
      and sm.quantity = current_qty_before
      and sm.uom = 'pcs'
      and sm.reason_code = 'OPERATOR_OPENED_CASE'
      and sm.note = 'opened at pick face'
      and sm.packaging_state_before = 'sealed'
      and sm.packaging_state_after = 'opened'
      and sm.packaging_profile_level_id_before = receipt_profile_level_before
      and sm.packaging_profile_level_id_after = receipt_profile_level_before
      and sm.pack_count_before = 1
      and sm.pack_count_after = 1
      and sm.created_by = actor_uuid
  ) then
    raise exception 'PR8: break-pack movement did not record truthful audit fields.';
  end if;

  normalize_result := public.normalize_opened_packaging_to_loose(
    sealed_iu_uuid,
    'OPENED_FOR_PICK',
    actor_uuid,
    'normalize after break-pack'
  );

  if normalize_result ->> 'packagingStateBefore' <> 'opened'
     or normalize_result ->> 'packagingStateAfter' <> 'loose'
     or normalize_result ->> 'packCountAfter' is not null then
    raise exception 'PR8: break-pack result must compose with PR7 opened-to-loose normalization: %', normalize_result;
  end if;

  split_result := public.split_inventory_unit(sealed_iu_uuid, 2, target_container_uuid, actor_uuid);

  if (split_result ->> 'sourceQuantity')::numeric <> current_qty_before - 2 then
    raise exception 'PR8: normalized loose stock should remain splittable by existing split flow: %', split_result;
  end if;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => multi_pack_container_uuid,
    product_uuid => product_uuid,
    quantity => 24,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 2,
    receipt_correlation_key => 'PR96-MULTI-001'
  );
  multi_pack_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

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
    receipt_correlation_key => 'PR96-OPENED-001'
  );
  opened_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => loose_container_uuid,
    product_uuid => product_uuid,
    quantity => 5,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR96-LOOSE-001'
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
    receipt_correlation_key => 'PR96-SERIAL-001',
    serial_no => 'PR96-SERIAL'
  );
  serial_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => reserved_container_uuid,
    product_uuid => product_uuid,
    quantity => 12,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR96-RESERVED-001'
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
    quantity => 12,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR96-MISMATCH-001'
  );
  mismatch_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  mismatch_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(mismatch_iu_uuid, actor_uuid);

  update public.container_lines
  set current_qty_each = 11
  where id = mismatch_line_uuid;

  select count(*) into rejected_movement_count_before
  from public.stock_movements
  where source_inventory_unit_id in (
    multi_pack_iu_uuid,
    opened_iu_uuid,
    loose_iu_uuid,
    serial_iu_uuid,
    reserved_iu_uuid,
    mismatch_iu_uuid
  );

  begin
    perform public.break_sealed_packaging_to_opened(multi_pack_iu_uuid, 'MULTI_TEST', null);
    raise exception 'PR8: expected multi-pack break-pack to be rejected.';
  exception
    when others then
      if sqlerrm <> 'BREAK_PACK_ONLY_SINGLE_PACK_SUPPORTED' then
        raise;
      end if;
  end;

  begin
    perform public.break_sealed_packaging_to_opened(opened_iu_uuid, 'OPENED_TEST', null);
    raise exception 'PR8: expected opened break-pack to be rejected.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_ALREADY_OPENED' then
        raise;
      end if;
  end;

  begin
    perform public.break_sealed_packaging_to_opened(loose_iu_uuid, 'LOOSE_TEST', null);
    raise exception 'PR8: expected loose break-pack to be rejected.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_ALREADY_LOOSE' then
        raise;
      end if;
  end;

  begin
    perform public.break_sealed_packaging_to_opened(serial_iu_uuid, 'SERIAL_TEST', null);
    raise exception 'PR8: expected serial break-pack to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SERIAL_BREAK_PACK_NOT_ALLOWED' then
        raise;
      end if;
  end;

  begin
    perform public.break_sealed_packaging_to_opened(reserved_iu_uuid, 'RESERVED_TEST', null);
    raise exception 'PR8: expected reserved break-pack to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE' then
        raise;
      end if;
  end;

  begin
    perform public.break_sealed_packaging_to_opened(mismatch_iu_uuid, 'MISMATCH_TEST', null);
    raise exception 'PR8: expected sealed quantity mismatch to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SEALED_PACK_COUNT_QUANTITY_MISMATCH' then
        raise;
      end if;
  end;

  begin
    perform public.break_sealed_packaging_to_opened(multi_pack_iu_uuid, '   ', null);
    raise exception 'PR8: expected blank reason to be rejected.';
  exception
    when others then
      if sqlerrm <> 'BREAK_PACK_REASON_REQUIRED' then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claims', '{}'::text, true);

  begin
    perform public.break_sealed_packaging_to_opened(multi_pack_iu_uuid, 'NO_ACTOR', null);
    raise exception 'PR8: expected missing auth actor to be rejected.';
  exception
    when others then
      if sqlerrm <> 'BREAK_PACK_ACTOR_REQUIRED' then
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
      multi_pack_iu_uuid,
      opened_iu_uuid,
      loose_iu_uuid,
      serial_iu_uuid,
      reserved_iu_uuid,
      mismatch_iu_uuid
    )
  ) <> rejected_movement_count_before then
    raise exception 'PR8: rejected break-pack attempts must not write movement rows.';
  end if;

  raise notice 'All 0096 PR8 sealed break-pack tests passed.';
end
$$;

rollback;
