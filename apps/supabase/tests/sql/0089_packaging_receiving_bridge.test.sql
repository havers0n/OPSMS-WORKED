begin;

do $$
declare
  default_tenant_uuid uuid;
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid;
  pallet_type_uuid uuid;

  actor_uuid uuid := gen_random_uuid();

  product_a_uuid uuid := gen_random_uuid();
  product_b_uuid uuid := gen_random_uuid();
  product_c_uuid uuid := gen_random_uuid();

  packaging_level_a_uuid uuid := gen_random_uuid();
  packaging_level_b_uuid uuid := gen_random_uuid();
  packaging_level_c_uuid uuid := gen_random_uuid();

  parent_container_uuid uuid := gen_random_uuid();
  child_container_uuid uuid := gen_random_uuid();
  mixed_container_uuid uuid := gen_random_uuid();
  strict_container_uuid uuid := gen_random_uuid();
  lot_container_uuid uuid := gen_random_uuid();
  failed_projection_container_uuid uuid := gen_random_uuid();

  mixed_location_uuid uuid := gen_random_uuid();
  strict_location_uuid uuid := gen_random_uuid();
  lot_location_uuid uuid := gen_random_uuid();
  failed_projection_location_uuid uuid := gen_random_uuid();

  product_a_profile_uuid uuid;
  product_c_profile_uuid uuid;
  product_c_manual_profile_uuid uuid := gen_random_uuid();

  receive_result jsonb;
  duplicate_result jsonb;
  first_line_uuid uuid;
  first_projection_uuid uuid;
  product_c_manual_level_uuid uuid;
begin
  select t.id
  into default_tenant_uuid
  from public.tenants t
  where t.code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for PR1 receive bridge tests.';
  end if;

  select f.id
  into floor_uuid
  from public.floors f
  join public.sites s on s.id = f.site_id
  where s.tenant_id = default_tenant_uuid
  order by f.created_at, f.id
  limit 1;

  if floor_uuid is null then
    insert into public.sites (id, tenant_id, code, name)
    values (site_uuid, default_tenant_uuid, 'PR89-SITE', 'PR89 Site');

    insert into public.floors (id, site_id, code, name)
    values (gen_random_uuid(), site_uuid, 'PR89-FLOOR', 'PR89 Floor')
    returning id into floor_uuid;
  end if;

  select ct.id
  into pallet_type_uuid
  from public.container_types ct
  where ct.code = 'pallet';

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr89-actor@wos.test', now(), now(), now(),
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
  values
    (product_a_uuid, 'test-suite', 'pr89-a', 'SKU-PR89-A', 'PR89 Product A', true),
    (product_b_uuid, 'test-suite', 'pr89-b', 'SKU-PR89-B', 'PR89 Product B', true),
    (product_c_uuid, 'test-suite', 'pr89-c', 'SKU-PR89-C', 'PR89 Product C', true);

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty, is_base, can_pick, can_store, is_default_pick_uom, is_active
  )
  values
    (packaging_level_a_uuid, product_a_uuid, 'CTN', 'Carton', 12, false, true, true, false, true),
    (packaging_level_b_uuid, product_b_uuid, 'CTN', 'Carton', 8, false, true, true, false, true),
    (packaging_level_c_uuid, product_c_uuid, 'CTN', 'Carton', 6, false, true, true, false, true);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  )
  values
    (mixed_location_uuid, default_tenant_uuid, floor_uuid, 'PR89-MIXED', 'staging', 'multi_container', 'active'),
    (strict_location_uuid, default_tenant_uuid, floor_uuid, 'PR89-STRICT', 'staging', 'multi_container', 'active'),
    (lot_location_uuid, default_tenant_uuid, floor_uuid, 'PR89-LOT', 'staging', 'multi_container', 'active'),
    (failed_projection_location_uuid, default_tenant_uuid, floor_uuid, 'PR89-FAIL', 'staging', 'multi_container', 'active');

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status, current_location_id
  )
  values
    (parent_container_uuid, default_tenant_uuid, 'PR89-PARENT', pallet_type_uuid, 'active', mixed_location_uuid),
    (child_container_uuid, default_tenant_uuid, 'PR89-CHILD', pallet_type_uuid, 'active', mixed_location_uuid),
    (mixed_container_uuid, default_tenant_uuid, 'PR89-MIXED-C', pallet_type_uuid, 'active', mixed_location_uuid),
    (strict_container_uuid, default_tenant_uuid, 'PR89-STRICT-C', pallet_type_uuid, 'active', strict_location_uuid),
    (lot_container_uuid, default_tenant_uuid, 'PR89-LOT-C', pallet_type_uuid, 'active', lot_location_uuid),
    (failed_projection_container_uuid, default_tenant_uuid, 'PR89-FAIL-C', pallet_type_uuid, 'active', failed_projection_location_uuid);

  update public.containers
  set parent_container_id = parent_container_uuid
  where id = child_container_uuid;

  begin
    update public.containers
    set parent_container_id = child_container_uuid
    where id = parent_container_uuid;
    raise exception 'Expected container parent cycle to be rejected.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_PARENT_CYCLE' then
        raise;
      end if;
  end;

  perform public.sync_default_packaging_profile_from_legacy(default_tenant_uuid, product_a_uuid);
  perform public.sync_default_packaging_profile_from_legacy(default_tenant_uuid, product_c_uuid);

  if not exists (
    select 1
    from public.packaging_profiles pp
    where pp.tenant_id = default_tenant_uuid
      and pp.product_id = product_a_uuid
      and pp.code = 'LEGACY-BRIDGE'
      and pp.scope_type = 'tenant'
      and pp.scope_id = default_tenant_uuid
      and pp.is_default = true
  ) then
    raise exception 'Expected legacy bridge default profile to be backfilled for product A.';
  end if;

  select pp.id
  into product_a_profile_uuid
  from public.packaging_profiles pp
  where pp.tenant_id = default_tenant_uuid
    and pp.product_id = product_a_uuid
    and pp.code = 'LEGACY-BRIDGE'
    and pp.scope_type = 'tenant'
    and pp.scope_id = default_tenant_uuid
  limit 1;

  select pp.id
  into product_c_profile_uuid
  from public.packaging_profiles pp
  where pp.tenant_id = default_tenant_uuid
    and pp.product_id = product_c_uuid
    and pp.code = 'LEGACY-BRIDGE'
    and pp.scope_type = 'tenant'
    and pp.scope_id = default_tenant_uuid
  limit 1;

  insert into public.packaging_profiles (
    id, tenant_id, product_id, code, name, profile_type, scope_type, scope_id,
    priority, is_default, status
  )
  values (
    product_c_manual_profile_uuid, default_tenant_uuid, product_c_uuid, 'MANUAL-C', 'Manual C',
    'receiving', 'tenant', default_tenant_uuid, 10, false, 'active'
  );

  insert into public.packaging_profile_levels (
    profile_id, level_type, qty_each, parent_level_type, qty_per_parent, container_type, legacy_product_packaging_level_id
  )
  values (
    product_c_manual_profile_uuid, 'manual-ctn', 5, 'each', 5, 'carton', packaging_level_c_uuid
  )
  returning id into product_c_manual_level_uuid;

  begin
    insert into public.packaging_profiles (
      tenant_id, product_id, code, name, profile_type, scope_type, scope_id,
      valid_from, valid_to, priority, is_default, status
    )
    values (
      default_tenant_uuid, product_a_uuid, 'MANUAL-A', 'Manual A', 'receiving', 'tenant', default_tenant_uuid,
      timezone('utc', now()), timezone('utc', now()) + interval '1 day', 99, true, 'active'
    );
    raise exception 'Expected overlapping active default profile to be rejected.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_PROFILE_DEFAULT_OVERLAP' then
        raise;
      end if;
  end;

  begin
    insert into public.packaging_profiles (
      tenant_id, product_id, code, name, profile_type, scope_type, scope_id,
      valid_from, valid_to, priority, is_default, status
    )
    values (
      default_tenant_uuid, product_a_uuid, 'MANUAL-B', 'Manual B', 'receiving', 'tenant', default_tenant_uuid,
      timezone('utc', now()), timezone('utc', now()) + interval '1 day', 0, false, 'active'
    );
    raise exception 'Expected overlapping active profile priority to be rejected.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_PROFILE_PRIORITY_OVERLAP' then
        raise;
      end if;
  end;

  insert into public.location_policies (
    tenant_id, location_id, receiving_enabled, allow_mixed_skus, default_inventory_status, status
  )
  values
    (default_tenant_uuid, mixed_location_uuid, true, true, 'available', 'active'),
    (default_tenant_uuid, strict_location_uuid, true, false, 'available', 'active'),
    (default_tenant_uuid, lot_location_uuid, true, true, 'available', 'active'),
    (default_tenant_uuid, failed_projection_location_uuid, true, true, 'available', 'active');

  begin
    insert into public.sku_location_policies (
      tenant_id, location_id, product_id, min_qty_each, max_qty_each, status
    )
    values (default_tenant_uuid, mixed_location_uuid, product_a_uuid, 10, 5, 'active');
    raise exception 'Expected invalid min/max qty policy to be rejected.';
  exception
    when others then
      if position('sku_location_policies' in sqlerrm) = 0
        and position('check constraint' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    insert into public.sku_location_policies (
      tenant_id, location_id, product_id, preferred_packaging_profile_id, status
    )
    values (default_tenant_uuid, mixed_location_uuid, product_a_uuid, product_c_profile_uuid, 'active');
    raise exception 'Expected preferred packaging profile product mismatch to be rejected.';
  exception
    when others then
      if sqlerrm <> 'SKU_LOCATION_POLICY_PREFERRED_PROFILE_PRODUCT_MISMATCH' then
        raise;
      end if;
  end;

  insert into public.sku_location_policies (
    tenant_id, location_id, product_id, min_qty_each, max_qty_each, preferred_packaging_profile_id, status
  )
  values (
    default_tenant_uuid, mixed_location_uuid, product_a_uuid, 12, 240, product_a_profile_uuid, 'active'
  );

  receive_result := public.receive_inventory_unit(
    default_tenant_uuid,
    mixed_container_uuid,
    product_a_uuid,
    24,
    'pcs',
    null,
    'sealed',
    packaging_level_a_uuid,
    2,
    'PR89-STD-001'
  );

  first_projection_uuid := (receive_result -> 'inventoryUnit' ->> 'id')::uuid;

  select cl.id
  into first_line_uuid
  from public.container_lines cl
  where cl.receipt_correlation_key = 'PR89-STD-001';

  if first_line_uuid is null then
    raise exception 'Expected canonical container_line to be written for standard receipt.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = first_line_uuid
      and cl.container_id = mixed_container_uuid
      and cl.product_id = product_a_uuid
      and cl.qty_each = 24
      and cl.design_qty_each_at_receipt = 12
      and cl.is_non_standard_pack = false
      and cl.packaging_profile_id_at_receipt is not null
      and cl.packaging_profile_level_id_at_receipt is not null
  ) then
    raise exception 'Expected standard receipt snapshot facts on container_lines.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    where iu.id = first_projection_uuid
      and iu.container_line_id = first_line_uuid
      and iu.product_packaging_level_id = packaging_level_a_uuid
      and iu.packaging_state = 'sealed'
      and iu.pack_count = 2
  ) then
    raise exception 'Expected receipt-stage compatibility projection linked to the canonical line.';
  end if;

  duplicate_result := public.receive_inventory_unit(
    default_tenant_uuid,
    mixed_container_uuid,
    product_a_uuid,
    24,
    'pcs',
    null,
    'sealed',
    packaging_level_a_uuid,
    2,
    'PR89-STD-001'
  );

  if (duplicate_result -> 'inventoryUnit' ->> 'id')::uuid <> first_projection_uuid then
    raise exception 'Expected duplicate receipt correlation to return the existing projection row.';
  end if;

  if (select count(*) from public.container_lines where receipt_correlation_key = 'PR89-STD-001') <> 1 then
    raise exception 'Expected receipt correlation duplicate protection to avoid duplicate canonical lines.';
  end if;

  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      mixed_container_uuid,
      product_a_uuid,
      12,
      'pcs',
      null,
      'sealed',
      packaging_level_a_uuid,
      1,
      'PR89-STD-001'
    );
    raise exception 'Expected conflicting duplicate correlation replay to be rejected.';
  exception
    when others then
      if sqlerrm <> 'RECEIPT_CORRELATION_CONFLICT' then
        raise;
      end if;
  end;

  if (select count(*) from public.container_lines where receipt_correlation_key = 'PR89-STD-001') <> 1 then
    raise exception 'Expected conflicting duplicate replay to leave the original canonical line untouched.';
  end if;

  receive_result := public.receive_inventory_unit(
    default_tenant_uuid,
    mixed_container_uuid,
    product_b_uuid,
    8,
    'pcs',
    null,
    'sealed',
    packaging_level_b_uuid,
    1,
    'PR89-MIX-002'
  );

  if not exists (
    select 1
    from public.container_lines cl
    where cl.container_id = mixed_container_uuid
      and cl.product_id = product_b_uuid
      and cl.receipt_correlation_key = 'PR89-MIX-002'
  ) then
    raise exception 'Expected mixed SKU receive to be allowed where the location policy allows it.';
  end if;

  if exists (
    select 1
    from public.containers c
    where c.id = mixed_container_uuid
      and c.is_standard_pack is not null
  ) then
    raise exception 'Expected mixed-content container header standard-pack flag to remain null.';
  end if;

  perform public.receive_inventory_unit(
    default_tenant_uuid,
    strict_container_uuid,
    product_a_uuid,
    12,
    'pcs',
    null,
    'sealed',
    packaging_level_a_uuid,
    1,
    'PR89-STRICT-001'
  );

  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      strict_container_uuid,
      product_b_uuid,
      8,
      'pcs',
      null,
      'sealed',
      packaging_level_b_uuid,
      1,
      'PR89-STRICT-002'
    );
    raise exception 'Expected strict location policy to reject mixed SKU receiving.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_MIXED_SKUS_FORBIDDEN' then
        raise;
      end if;
  end;

  perform public.receive_inventory_unit(
    default_tenant_uuid,
    lot_container_uuid,
    product_a_uuid,
    12,
    'pcs',
    null,
    'sealed',
    packaging_level_a_uuid,
    1,
    'PR89-LOT-001',
    'LOT-A',
    null,
    date '2027-01-01'
  );

  perform public.receive_inventory_unit(
    default_tenant_uuid,
    lot_container_uuid,
    product_a_uuid,
    12,
    'pcs',
    null,
    'sealed',
    packaging_level_a_uuid,
    1,
    'PR89-LOT-002',
    'LOT-B',
    null,
    date '2027-02-01'
  );

  if (
    select count(*)
    from public.container_lines cl
    where cl.container_id = lot_container_uuid
      and cl.product_id = product_a_uuid
  ) <> 2 then
    raise exception 'Expected distinct canonical content rows for same SKU with different lot/expiry.';
  end if;

  update public.product_packaging_levels
  set base_unit_qty = 10
  where id = packaging_level_a_uuid;

  perform public.sync_default_packaging_profile_from_legacy(default_tenant_uuid, product_a_uuid);

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = first_line_uuid
      and cl.design_qty_each_at_receipt = 12
  ) then
    raise exception 'Expected historical receipt snapshot to remain immutable after packaging master changes.';
  end if;

  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      failed_projection_container_uuid,
      product_c_uuid,
      10,
      'pcs',
      null,
      'sealed',
      packaging_level_c_uuid,
      2,
      'PR89-CANON-VALIDATION-001'
    );
    raise exception 'Expected canonical receive-time compatibility validation to reject a mismatched projection bridge.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_LEVEL_PROJECTION_MISMATCH' then
        raise;
      end if;
  end;

  if exists (
    select 1
    from public.container_lines cl
    where cl.receipt_correlation_key = 'PR89-CANON-VALIDATION-001'
  ) then
    raise exception 'Expected canonical packaging validation failure before writing container_lines.';
  end if;

  if exists (
    select 1
    from public.inventory_unit iu
    where iu.container_line_id is not null
      and iu.container_id = failed_projection_container_uuid
      and iu.product_id = product_c_uuid
  ) then
    raise exception 'Expected canonical packaging validation failure before writing inventory_unit projection.';
  end if;

  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      failed_projection_container_uuid,
      product_a_uuid,
      23,
      'pcs',
      null,
      'sealed',
      packaging_level_a_uuid,
      2,
      'PR89-FAIL-001'
    );
    raise exception 'Expected projection validation failure for mismatched sealed pack quantity.';
  exception
    when others then
      if sqlerrm <> 'SEALED_PACK_COUNT_QUANTITY_MISMATCH' then
        raise;
      end if;
  end;

  if exists (
    select 1
    from public.container_lines cl
    where cl.receipt_correlation_key = 'PR89-FAIL-001'
  ) then
    raise exception 'Expected no partial canonical line after projection validation failure.';
  end if;

  if exists (
    select 1
    from public.inventory_unit iu
    where iu.container_line_id is not null
      and iu.container_id = failed_projection_container_uuid
  ) then
    raise exception 'Expected no partial inventory_unit projection after receive failure.';
  end if;
end
$$;

rollback;
