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

  source_container_uuid uuid := gen_random_uuid();
  serial_container_uuid uuid := gen_random_uuid();
  packaged_container_uuid uuid := gen_random_uuid();
  reserved_container_uuid uuid := gen_random_uuid();
  zero_container_uuid uuid := gen_random_uuid();

  receive_result jsonb;
  result jsonb;

  iu_uuid uuid;
  line_uuid uuid;
  serial_iu_uuid uuid;
  packaged_iu_uuid uuid;
  reserved_iu_uuid uuid;
  reserved_line_uuid uuid;
  zero_iu_uuid uuid;
  zero_line_uuid uuid;

  inventory_count_before integer;
  line_count_before integer;
  movement_count_before integer;
  invalid_movement_count_before integer;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR6: expected default tenant to exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'PR6: expected pallet container type to exist.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr94-actor@wos.test', now(), now(), now(),
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
  values (product_uuid, 'test-suite', 'pr94-product', 'SKU-PR94', 'PR94 Product', true);

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty, is_base, can_pick, can_store,
    is_default_pick_uom, is_active
  )
  values (
    packaging_level_uuid, product_uuid, 'CTN', 'Carton', 12, false, true, true,
    false, true
  );

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PR94-SITE', 'PR94 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'PR94-FLOOR', 'PR94 Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  )
  values (
    source_location_uuid, default_tenant_uuid, floor_uuid,
    'PR94-SOURCE', 'staging', 'multi_container', 'active'
  );

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status,
    current_location_id, current_location_entered_at
  )
  values
    (source_container_uuid, default_tenant_uuid, 'PR94-SOURCE-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (serial_container_uuid, default_tenant_uuid, 'PR94-SERIAL-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (packaged_container_uuid, default_tenant_uuid, 'PR94-PACKAGED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (reserved_container_uuid, default_tenant_uuid, 'PR94-RESERVED-C', pallet_type_uuid, 'active', source_location_uuid, now()),
    (zero_container_uuid, default_tenant_uuid, 'PR94-ZERO-C', pallet_type_uuid, 'active', source_location_uuid, now());

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => source_container_uuid,
    product_uuid => product_uuid,
    quantity => 10,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR94-ADJUST-001'
  );

  iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;

  if iu_uuid is null or line_uuid is null then
    raise exception 'PR6: receive_inventory_unit must create projection and canonical receipt line.';
  end if;

  select count(*) into inventory_count_before from public.inventory_unit;
  select count(*) into line_count_before from public.container_lines;
  select count(*) into movement_count_before from public.stock_movements;

  execute 'set local role authenticated';

  begin
    update public.inventory_unit
    set quantity = 999
    where id = iu_uuid;
    raise exception 'PR6: expected direct inventory_unit update to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.container_lines
    set current_qty_each = 999
    where id = line_uuid;
    raise exception 'PR6: expected direct container_lines update to be denied.';
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
      quantity_delta,
      quantity_after,
      created_by
    )
    values (
      default_tenant_uuid,
      'adjust',
      source_container_uuid,
      iu_uuid,
      1,
      'pcs',
      'done',
      'BYPASS',
      1,
      11,
      actor_uuid
    );
    raise exception 'PR6: expected direct stock_movements adjust insert to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  result := public.adjust_inventory_unit_canonical(
    iu_uuid,
    5,
    'FOUND_STOCK',
    gen_random_uuid(),
    'found during bin check'
  );

  execute 'reset role';

  if (result ->> 'inventoryUnitId')::uuid <> iu_uuid
     or (result ->> 'containerLineId')::uuid <> line_uuid
     or (result ->> 'deltaEach')::integer <> 5
     or (result ->> 'quantityBefore')::numeric <> 10
     or (result ->> 'quantityAfter')::numeric <> 15
     or result ->> 'reasonCode' <> 'FOUND_STOCK'
     or result ->> 'note' <> 'found during bin check' then
    raise exception 'PR6: positive adjustment returned unexpected payload: %', result;
  end if;

  if (select count(*) from public.inventory_unit) <> inventory_count_before then
    raise exception 'PR6: positive adjustment must not create inventory_unit rows.';
  end if;

  if (select count(*) from public.container_lines) <> line_count_before then
    raise exception 'PR6: positive adjustment must not create container_lines rows.';
  end if;

  if (select count(*) from public.stock_movements) <> movement_count_before + 1 then
    raise exception 'PR6: positive adjustment must write exactly one movement row.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = line_uuid
      and cl.line_kind = 'receipt'
      and cl.container_id = source_container_uuid
      and cl.qty_each = 10
      and cl.receipt_correlation_key = 'PR94-ADJUST-001'
      and cl.current_container_id = source_container_uuid
      and cl.current_qty_each = 15
      and cl.current_inventory_status = 'available'
      and cl.root_receipt_line_id = cl.id
      and cl.parent_container_line_id is null
  ) then
    raise exception 'PR6: positive adjustment must mutate only canonical current fields and preserve receipt facts.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    join public.container_lines cl on cl.id = iu.container_line_id
    where iu.id = iu_uuid
      and iu.container_id = cl.current_container_id
      and iu.quantity = cl.current_qty_each
      and iu.status = cl.current_inventory_status
      and iu.container_line_id = cl.id
      and iu.quantity = 15
  ) then
    raise exception 'PR6: positive adjustment must sync inventory_unit projection to canonical current row.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (result ->> 'movementId')::uuid
      and sm.movement_type = 'adjust'
      and sm.source_location_id = source_location_uuid
      and sm.source_container_id = source_container_uuid
      and sm.target_container_id is null
      and sm.source_inventory_unit_id = iu_uuid
      and sm.target_inventory_unit_id is null
      and sm.quantity = 5
      and sm.quantity_delta = 5
      and sm.quantity_after = 15
      and sm.reason_code = 'FOUND_STOCK'
      and sm.note = 'found during bin check'
      and sm.uom = 'pcs'
      and sm.created_by = actor_uuid
  ) then
    raise exception 'PR6: positive adjustment movement did not record truthful audit fields.';
  end if;

  result := public.adjust_inventory_unit_canonical(
    iu_uuid,
    -3,
    'DAMAGE_LOSS',
    gen_random_uuid(),
    null
  );

  if (result ->> 'quantityBefore')::numeric <> 15
     or (result ->> 'quantityAfter')::numeric <> 12 then
    raise exception 'PR6: negative adjustment returned unexpected payload: %', result;
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    join public.inventory_unit iu on iu.container_line_id = cl.id
    where cl.id = line_uuid
      and cl.current_qty_each = 12
      and iu.id = iu_uuid
      and iu.quantity = 12
      and cl.qty_each = 10
      and cl.container_id = source_container_uuid
  ) then
    raise exception 'PR6: negative adjustment must decrease current qty, sync projection, and preserve receipt facts.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (result ->> 'movementId')::uuid
      and sm.movement_type = 'adjust'
      and sm.quantity = 3
      and sm.quantity_delta = -3
      and sm.quantity_after = 12
      and sm.reason_code = 'DAMAGE_LOSS'
      and sm.note is null
  ) then
    raise exception 'PR6: negative adjustment movement did not record truthful audit fields.';
  end if;

  if (
    select coalesce(sum(cl.qty_each), 0)
    from public.container_lines cl
    where cl.container_id = source_container_uuid
      and cl.line_kind = 'receipt'
  ) <> 10 then
    raise exception 'PR6: receipt fill semantics must continue to use immutable receipt qty_each.';
  end if;

  if exists (
    select 1
    from public.container_lines cl
    where cl.container_id = source_container_uuid
      and cl.line_kind = 'current_fragment'
  ) then
    raise exception 'PR6: adjustment must not create current_fragment rows or pollute receipt/history reads.';
  end if;

  select count(*) into invalid_movement_count_before
  from public.stock_movements
  where source_inventory_unit_id = iu_uuid;

  begin
    perform public.adjust_inventory_unit_canonical(iu_uuid, 0, 'NOOP', actor_uuid, null);
    raise exception 'PR6: expected zero delta to be rejected.';
  exception
    when others then
      if sqlerrm <> 'INVALID_ADJUSTMENT_DELTA' then
        raise;
      end if;
  end;

  begin
    perform public.adjust_inventory_unit_canonical(iu_uuid, -99, 'OVER_DECREMENT', actor_uuid, null);
    raise exception 'PR6: expected over-decrement to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ADJUSTMENT_QUANTITY_NEGATIVE' then
        raise;
      end if;
  end;

  begin
    perform public.adjust_inventory_unit_canonical(iu_uuid, 1, '   ', actor_uuid, null);
    raise exception 'PR6: expected blank reason to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ADJUSTMENT_REASON_REQUIRED' then
        raise;
      end if;
  end;

  if (
    select count(*)
    from public.stock_movements
    where source_inventory_unit_id = iu_uuid
  ) <> invalid_movement_count_before then
    raise exception 'PR6: rejected adjustments must not write movement rows.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    join public.inventory_unit iu on iu.container_line_id = cl.id
    where cl.id = line_uuid
      and cl.current_qty_each = 12
      and iu.id = iu_uuid
      and iu.quantity = 12
  ) then
    raise exception 'PR6: rejected adjustments must leave canonical current and projection unchanged.';
  end if;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => serial_container_uuid,
    product_uuid => product_uuid,
    quantity => 1,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR94-SERIAL-001',
    serial_no => 'PR94-SERIAL'
  );
  serial_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  begin
    perform public.adjust_inventory_unit_canonical(serial_iu_uuid, 1, 'SERIAL_TEST', actor_uuid, null);
    raise exception 'PR6: expected serial adjustment to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SERIAL_ADJUSTMENT_NOT_ALLOWED' then
        raise;
      end if;
  end;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => packaged_container_uuid,
    product_uuid => product_uuid,
    quantity => 12,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    packaging_state => 'sealed',
    product_packaging_level_uuid => packaging_level_uuid,
    pack_count => 1,
    receipt_correlation_key => 'PR94-PACKAGED-001'
  );
  packaged_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;

  begin
    perform public.adjust_inventory_unit_canonical(packaged_iu_uuid, 1, 'PACKAGED_TEST', actor_uuid, null);
    raise exception 'PR6: expected packaged adjustment to be rejected.';
  exception
    when others then
      if sqlerrm <> 'PACKAGED_ADJUSTMENT_NOT_SUPPORTED' then
        raise;
      end if;
  end;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => reserved_container_uuid,
    product_uuid => product_uuid,
    quantity => 4,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR94-RESERVED-001'
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
    perform public.adjust_inventory_unit_canonical(reserved_iu_uuid, 1, 'RESERVED_TEST', actor_uuid, null);
    raise exception 'PR6: expected reserved adjustment to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE' then
        raise;
      end if;
  end;

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => zero_container_uuid,
    product_uuid => product_uuid,
    quantity => 3,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR94-ZERO-001'
  );
  zero_iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  zero_line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;
  perform public.ensure_inventory_unit_current_container_line(zero_iu_uuid, actor_uuid);

  update public.container_lines
  set current_qty_each = 0
  where id = zero_line_uuid;

  update public.inventory_unit
  set quantity = 0
  where id = zero_iu_uuid;

  begin
    perform public.adjust_inventory_unit_canonical(zero_iu_uuid, 1, 'ZERO_TEST', actor_uuid, null);
    raise exception 'PR6: expected zero-current row adjustment to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ADJUSTMENT_ROW_NOT_CURRENT' then
        raise;
      end if;
  end;

  raise notice 'All 0094 PR6 canonical inventory adjustment tests passed.';
end
$$;

rollback;
