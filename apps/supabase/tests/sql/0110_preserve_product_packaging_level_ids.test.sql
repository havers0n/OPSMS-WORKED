begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid uuid;
  product_a_uuid uuid := gen_random_uuid();
  product_b_uuid uuid := gen_random_uuid();
  base_level_uuid uuid := gen_random_uuid();
  carton_level_uuid uuid := gen_random_uuid();
  pallet_level_uuid uuid := gen_random_uuid();
  other_product_level_uuid uuid := gen_random_uuid();
  storage_profile_uuid uuid;
  storage_profile_level_uuid uuid;
  container_uuid uuid := gen_random_uuid();
  box_level_uuid uuid;
  result_rows integer;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR110: expected default tenant to exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'PR110: expected pallet container type to exist.';
  end if;

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values
    (product_a_uuid, 'test-suite', 'pr110-product-a', 'SKU-PR110-A', 'PR110 Product A', true),
    (product_b_uuid, 'test-suite', 'pr110-product-b', 'SKU-PR110-B', 'PR110 Product B', true);

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty,
    is_base, can_pick, can_store, is_default_pick_uom,
    sort_order, is_active
  )
  values
    (base_level_uuid, product_a_uuid, 'EACH', 'Each', 1, true, true, true, true, 0, true),
    (carton_level_uuid, product_a_uuid, 'CTN', 'Carton', 12, false, true, true, false, 1, true),
    (pallet_level_uuid, product_a_uuid, 'PAL', 'Pallet', 120, false, false, true, false, 2, true),
    (other_product_level_uuid, product_b_uuid, 'EACH', 'Each', 1, true, true, true, true, 0, true);

  insert into public.packaging_profiles (
    tenant_id, product_id, code, name, profile_type, scope_type, scope_id,
    priority, is_default, status
  )
  values (
    default_tenant_uuid, product_a_uuid, 'PR110-STORAGE', 'PR110 Storage',
    'storage', 'tenant', default_tenant_uuid, 0, false, 'active'
  )
  returning id into storage_profile_uuid;

  insert into public.packaging_profile_levels (
    profile_id, level_type, qty_each, container_type, legacy_product_packaging_level_id
  )
  values (
    storage_profile_uuid, 'ctn', 12, 'carton', carton_level_uuid
  )
  returning id into storage_profile_level_uuid;

  select count(*) into result_rows
  from public.replace_product_packaging_levels(
    product_a_uuid,
    jsonb_build_array(
      jsonb_build_object(
        'id', carton_level_uuid,
        'code', 'CTN',
        'name', 'Carton Updated',
        'base_unit_qty', 12,
        'is_base', false,
        'can_pick', true,
        'can_store', true,
        'is_default_pick_uom', false,
        'sort_order', 0,
        'is_active', true
      ),
      jsonb_build_object(
        'id', base_level_uuid,
        'code', 'EACH',
        'name', 'Each',
        'base_unit_qty', 1,
        'is_base', true,
        'can_pick', true,
        'can_store', true,
        'is_default_pick_uom', true,
        'sort_order', 1,
        'is_active', true
      ),
      jsonb_build_object(
        'code', 'BOX',
        'name', 'Box',
        'base_unit_qty', 6,
        'is_base', false,
        'can_pick', true,
        'can_store', true,
        'is_default_pick_uom', false,
        'sort_order', 2,
        'is_active', true
      )
    )
  );

  if result_rows <> 3 then
    raise exception 'PR110: expected replace to return 3 rows, got %.', result_rows;
  end if;

  if not exists (
    select 1
    from public.product_packaging_levels
    where id = carton_level_uuid
      and product_id = product_a_uuid
      and code = 'CTN'
      and name = 'Carton Updated'
      and sort_order = 0
  ) then
    raise exception 'PR110: expected existing carton id to be preserved and updated.';
  end if;

  if not exists (
    select 1
    from public.product_packaging_levels
    where id = base_level_uuid
      and product_id = product_a_uuid
      and code = 'EACH'
      and sort_order = 1
  ) then
    raise exception 'PR110: expected existing base id to be preserved while reordered.';
  end if;

  if exists (
    select 1
    from public.product_packaging_levels
    where id = pallet_level_uuid
  ) then
    raise exception 'PR110: expected unreferenced removed level to be deleted.';
  end if;

  select id into box_level_uuid
  from public.product_packaging_levels
  where product_id = product_a_uuid
    and code = 'BOX';

  if box_level_uuid is null then
    raise exception 'PR110: expected new level without incoming id to be inserted.';
  end if;

  if exists (
    select 1
    from public.product_packaging_levels
    where id = box_level_uuid
      and id in (base_level_uuid, carton_level_uuid, pallet_level_uuid)
  ) then
    raise exception 'PR110: expected inserted level to receive a generated id.';
  end if;

  if not exists (
    select 1
    from public.packaging_profile_levels
    where id = storage_profile_level_uuid
      and legacy_product_packaging_level_id = carton_level_uuid
  ) then
    raise exception 'PR110: expected storage preset legacy link to survive save.';
  end if;

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'id', base_level_uuid,
          'code', 'EACH',
          'name', 'Each',
          'base_unit_qty', 1,
          'is_base', true,
          'can_pick', true,
          'can_store', true,
          'is_default_pick_uom', true,
          'sort_order', 0,
          'is_active', true
        ),
        jsonb_build_object(
          'id', box_level_uuid,
          'code', 'BOX',
          'name', 'Box',
          'base_unit_qty', 6,
          'is_base', false,
          'can_pick', true,
          'can_store', true,
          'is_default_pick_uom', false,
          'sort_order', 1,
          'is_active', true
        )
      )
    );
    raise exception 'PR110: expected storage-referenced removal to reject.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_LEVEL_REFERENCED' then
        raise exception 'PR110: expected PACKAGING_LEVEL_REFERENCED for storage link, got %.', sqlerrm;
      end if;
  end;

  if not exists (
    select 1
    from public.product_packaging_levels
    where id = carton_level_uuid
      and name = 'Carton Updated'
  ) then
    raise exception 'PR110: expected referenced storage-removal rejection to preserve rows.';
  end if;

  if not exists (
    select 1
    from public.packaging_profile_levels
    where id = storage_profile_level_uuid
      and legacy_product_packaging_level_id = carton_level_uuid
  ) then
    raise exception 'PR110: expected referenced storage-removal rejection to preserve links.';
  end if;

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status
  )
  values (
    container_uuid, default_tenant_uuid, 'PR110-INV', pallet_type_uuid, 'active'
  );

  insert into public.inventory_unit (
    tenant_id,
    container_id,
    product_id,
    quantity,
    uom,
    status,
    packaging_state,
    product_packaging_level_id,
    pack_count
  )
  values (
    default_tenant_uuid,
    container_uuid,
    product_a_uuid,
    6,
    'pcs',
    'available',
    'sealed',
    box_level_uuid,
    1
  );

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'id', carton_level_uuid,
          'code', 'CTN',
          'name', 'Carton Updated',
          'base_unit_qty', 12,
          'is_base', false,
          'can_pick', true,
          'can_store', true,
          'is_default_pick_uom', false,
          'sort_order', 0,
          'is_active', true
        ),
        jsonb_build_object(
          'id', base_level_uuid,
          'code', 'EACH',
          'name', 'Each',
          'base_unit_qty', 1,
          'is_base', true,
          'can_pick', true,
          'can_store', true,
          'is_default_pick_uom', true,
          'sort_order', 1,
          'is_active', true
        )
      )
    );
    raise exception 'PR110: expected inventory-referenced removal to reject.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_LEVEL_REFERENCED' then
        raise exception 'PR110: expected PACKAGING_LEVEL_REFERENCED for inventory link, got %.', sqlerrm;
      end if;
  end;

  if not exists (
    select 1
    from public.product_packaging_levels
    where id = box_level_uuid
      and code = 'BOX'
  ) then
    raise exception 'PR110: expected referenced inventory-removal rejection to preserve rows.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit
    where product_packaging_level_id = box_level_uuid
  ) then
    raise exception 'PR110: expected referenced inventory-removal rejection to preserve inventory link.';
  end if;

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'id', base_level_uuid,
          'code', 'EACH',
          'name', 'Each',
          'base_unit_qty', 1,
          'is_base', true,
          'can_pick', true,
          'can_store', true,
          'is_default_pick_uom', true,
          'sort_order', 0,
          'is_active', true
        ),
        jsonb_build_object(
          'id', base_level_uuid,
          'code', 'DUP',
          'name', 'Duplicate',
          'base_unit_qty', 2,
          'is_base', false,
          'can_pick', true,
          'can_store', true,
          'is_default_pick_uom', false,
          'sort_order', 1,
          'is_active', true
        )
      )
    );
    raise exception 'PR110: expected duplicate incoming ids to reject.';
  exception
    when others then
      if sqlerrm <> 'DUPLICATE_ID' then
        raise exception 'PR110: expected DUPLICATE_ID, got %.', sqlerrm;
      end if;
  end;

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'id', other_product_level_uuid,
          'code', 'EACH',
          'name', 'Each',
          'base_unit_qty', 1,
          'is_base', true,
          'can_pick', true,
          'can_store', true,
          'is_default_pick_uom', true,
          'sort_order', 0,
          'is_active', true
        )
      )
    );
    raise exception 'PR110: expected foreign product id to reject.';
  exception
    when others then
      if sqlerrm <> 'PACKAGING_LEVEL_ID_NOT_FOUND' then
        raise exception 'PR110: expected PACKAGING_LEVEL_ID_NOT_FOUND, got %.', sqlerrm;
      end if;
  end;
end
$$;

rollback;
