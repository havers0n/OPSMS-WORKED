begin;

do $$
declare
  default_tenant_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;

  product_uuid uuid := gen_random_uuid();
  other_product_uuid uuid := gen_random_uuid();

  base_level_uuid uuid := gen_random_uuid();
  carton_level_uuid uuid := gen_random_uuid();
  case_level_uuid uuid := gen_random_uuid();
  inactive_level_uuid uuid := gen_random_uuid();
  not_storable_level_uuid uuid := gen_random_uuid();
  foreign_level_uuid uuid := gen_random_uuid();

  single_profile_uuid uuid;
  single_profile_level_uuid uuid;
  single_container_uuid uuid := gen_random_uuid();

  multi_profile_uuid uuid;
  multi_profile_level_uuid uuid;
  multi_container_uuid uuid := gen_random_uuid();

  case_profile_uuid uuid;
  case_container_uuid uuid := gen_random_uuid();

  non_divisible_profile_uuid uuid;
  non_divisible_container_uuid uuid := gen_random_uuid();

  inactive_profile_uuid uuid;
  inactive_container_uuid uuid := gen_random_uuid();

  not_storable_profile_uuid uuid;
  not_storable_container_uuid uuid := gen_random_uuid();

  foreign_profile_uuid uuid;
  foreign_container_uuid uuid := gen_random_uuid();

  materialized_result jsonb;
  stored_quantity numeric;
  stored_pack_count integer;
  stored_packaging_level_uuid uuid;
  stored_line_profile_uuid uuid;
  stored_line_level_uuid uuid;
  stored_source_type text;
begin
  select id
  into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR111: expected default tenant to exist.';
  end if;

  select id
  into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'PR111: expected pallet container type to exist.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr111-actor@wos.test', now(), now(), now(),
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
    (product_uuid, 'test-suite', 'pr111-product', 'SKU-PR111', 'PR111 Product', true),
    (other_product_uuid, 'test-suite', 'pr111-other-product', 'SKU-PR111-OTHER', 'PR111 Other Product', true);

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty,
    is_base, can_pick, can_store, is_default_pick_uom,
    sort_order, is_active
  )
  values
    (base_level_uuid, product_uuid, 'EA', 'Each', 1, true, true, true, true, 0, true),
    (carton_level_uuid, product_uuid, 'CTN', 'Carton', 8, false, true, true, false, 1, true),
    (case_level_uuid, product_uuid, 'CASE', 'Case', 24, false, true, true, false, 2, true),
    (inactive_level_uuid, product_uuid, 'OLDCTN', 'Inactive Carton', 8, false, true, true, false, 3, false),
    (not_storable_level_uuid, product_uuid, 'DISPLAY', 'Display Pack', 8, false, true, false, false, 4, true),
    (foreign_level_uuid, other_product_uuid, 'CTN', 'Other Carton', 8, false, true, true, false, 0, true);

  insert into public.packaging_profiles (
    tenant_id, product_id, code, name, profile_type, scope_type, scope_id,
    priority, is_default, status
  )
  values
    (default_tenant_uuid, product_uuid, 'PR111-SINGLE', 'PR111 Single Carton', 'storage', 'tenant', default_tenant_uuid, 10, false, 'active'),
    (default_tenant_uuid, product_uuid, 'PR111-MULTI', 'PR111 Three Cartons', 'storage', 'tenant', default_tenant_uuid, 11, false, 'active'),
    (default_tenant_uuid, product_uuid, 'PR111-CASE', 'PR111 Two Cases', 'storage', 'tenant', default_tenant_uuid, 12, false, 'active'),
    (default_tenant_uuid, product_uuid, 'PR111-NONDIV', 'PR111 Non Divisible', 'storage', 'tenant', default_tenant_uuid, 13, false, 'active'),
    (default_tenant_uuid, product_uuid, 'PR111-INACTIVE', 'PR111 Inactive Level', 'storage', 'tenant', default_tenant_uuid, 14, false, 'active'),
    (default_tenant_uuid, product_uuid, 'PR111-NOSTORE', 'PR111 Not Storable Level', 'storage', 'tenant', default_tenant_uuid, 15, false, 'active'),
    (default_tenant_uuid, product_uuid, 'PR111-FOREIGN', 'PR111 Foreign Level', 'storage', 'tenant', default_tenant_uuid, 16, false, 'active');

  select id into single_profile_uuid from public.packaging_profiles where code = 'PR111-SINGLE';
  select id into multi_profile_uuid from public.packaging_profiles where code = 'PR111-MULTI';
  select id into case_profile_uuid from public.packaging_profiles where code = 'PR111-CASE';
  select id into non_divisible_profile_uuid from public.packaging_profiles where code = 'PR111-NONDIV';
  select id into inactive_profile_uuid from public.packaging_profiles where code = 'PR111-INACTIVE';
  select id into not_storable_profile_uuid from public.packaging_profiles where code = 'PR111-NOSTORE';
  select id into foreign_profile_uuid from public.packaging_profiles where code = 'PR111-FOREIGN';

  insert into public.packaging_profile_levels (
    profile_id, level_type, qty_each, container_type, legacy_product_packaging_level_id
  )
  values
    (single_profile_uuid, 'CTN', 8, 'pallet', carton_level_uuid),
    (multi_profile_uuid, 'CTN', 24, 'pallet', carton_level_uuid),
    (case_profile_uuid, 'CASE', 48, 'pallet', case_level_uuid),
    (non_divisible_profile_uuid, 'CTN', 10, 'pallet', carton_level_uuid),
    (inactive_profile_uuid, 'OLDCTN', 8, 'pallet', inactive_level_uuid),
    (not_storable_profile_uuid, 'DISPLAY', 8, 'pallet', not_storable_level_uuid),
    (foreign_profile_uuid, 'CTN', 8, 'pallet', foreign_level_uuid);

  select id into single_profile_level_uuid
  from public.packaging_profile_levels
  where profile_id = single_profile_uuid
    and legacy_product_packaging_level_id = carton_level_uuid;

  select id into multi_profile_level_uuid
  from public.packaging_profile_levels
  where profile_id = multi_profile_uuid
    and legacy_product_packaging_level_id = carton_level_uuid;

  insert into public.packaging_profile_levels (
    profile_id, level_type, qty_each, container_type
  )
  values (multi_profile_uuid, 'UNLINKED-DISPLAY', 1, 'pallet');

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status,
    operational_role, packaging_profile_id, is_standard_pack
  )
  values
    (single_container_uuid, default_tenant_uuid, 'PR111-SINGLE-C', pallet_type_uuid, 'active', 'storage', single_profile_uuid, true),
    (multi_container_uuid, default_tenant_uuid, 'PR111-MULTI-C', pallet_type_uuid, 'active', 'storage', multi_profile_uuid, true),
    (case_container_uuid, default_tenant_uuid, 'PR111-CASE-C', pallet_type_uuid, 'active', 'storage', case_profile_uuid, true),
    (non_divisible_container_uuid, default_tenant_uuid, 'PR111-NONDIV-C', pallet_type_uuid, 'active', 'storage', non_divisible_profile_uuid, true),
    (inactive_container_uuid, default_tenant_uuid, 'PR111-INACTIVE-C', pallet_type_uuid, 'active', 'storage', inactive_profile_uuid, true),
    (not_storable_container_uuid, default_tenant_uuid, 'PR111-NOSTORE-C', pallet_type_uuid, 'active', 'storage', not_storable_profile_uuid, true),
    (foreign_container_uuid, default_tenant_uuid, 'PR111-FOREIGN-C', pallet_type_uuid, 'active', 'storage', foreign_profile_uuid, true);

  materialized_result := public.materialize_storage_preset_container_contents(
    single_profile_uuid,
    single_container_uuid,
    actor_uuid
  );

  select iu.quantity, iu.pack_count, iu.product_packaging_level_id
  into stored_quantity, stored_pack_count, stored_packaging_level_uuid
  from public.inventory_unit iu
  where iu.id = (materialized_result #>> '{inventoryUnit,id}')::uuid;

  if stored_quantity <> 8
    or stored_pack_count <> 1
    or stored_packaging_level_uuid <> carton_level_uuid then
    raise exception 'PR111: expected single carton to materialize as 8 EA, pack_count 1, carton level.';
  end if;

  materialized_result := public.materialize_storage_preset_container_contents(
    multi_profile_uuid,
    multi_container_uuid,
    actor_uuid
  );

  select
    iu.quantity,
    iu.pack_count,
    iu.product_packaging_level_id,
    cl.packaging_profile_id_at_receipt,
    cl.packaging_profile_level_id_at_receipt,
    c.source_document_type
  into
    stored_quantity,
    stored_pack_count,
    stored_packaging_level_uuid,
    stored_line_profile_uuid,
    stored_line_level_uuid,
    stored_source_type
  from public.inventory_unit iu
  join public.container_lines cl on cl.id = iu.container_line_id
  join public.containers c on c.id = iu.container_id
  where iu.id = (materialized_result #>> '{inventoryUnit,id}')::uuid;

  if stored_quantity <> 24
    or stored_pack_count <> 3
    or stored_packaging_level_uuid <> carton_level_uuid then
    raise exception 'PR111: expected three cartons to materialize as 24 EA, pack_count 3, carton level.';
  end if;

  if stored_line_profile_uuid <> multi_profile_uuid
    or stored_line_level_uuid <> multi_profile_level_uuid
    or stored_source_type <> 'storage_preset' then
    raise exception 'PR111: expected multi-pack materialization to preserve storage preset receipt metadata.';
  end if;

  if exists (
    select 1
    from public.product_packaging_levels ppl
    join public.inventory_unit iu on iu.product_packaging_level_id = ppl.id
    where iu.container_id = multi_container_uuid
      and ppl.base_unit_qty = iu.quantity
  ) then
    raise exception 'PR111: regression failed; multi-pack should not require selected base qty to equal total quantity.';
  end if;

  materialized_result := public.materialize_storage_preset_container_contents(
    case_profile_uuid,
    case_container_uuid,
    actor_uuid
  );

  select iu.quantity, iu.pack_count, iu.product_packaging_level_id
  into stored_quantity, stored_pack_count, stored_packaging_level_uuid
  from public.inventory_unit iu
  where iu.id = (materialized_result #>> '{inventoryUnit,id}')::uuid;

  if stored_quantity <> 48
    or stored_pack_count <> 2
    or stored_packaging_level_uuid <> case_level_uuid then
    raise exception 'PR111: expected two cumulative cases to materialize as 48 EA, pack_count 2, case level.';
  end if;

  begin
    perform public.materialize_storage_preset_container_contents(
      non_divisible_profile_uuid,
      non_divisible_container_uuid,
      actor_uuid
    );
    raise exception 'PR111: expected non-divisible storage preset to fail.';
  exception
    when others then
      if sqlerrm <> 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED' then
        raise exception 'PR111: expected unresolved error for non-divisible preset, got %.', sqlerrm;
      end if;
  end;

  begin
    perform public.materialize_storage_preset_container_contents(
      inactive_profile_uuid,
      inactive_container_uuid,
      actor_uuid
    );
    raise exception 'PR111: expected inactive selected level to fail.';
  exception
    when others then
      if sqlerrm <> 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED' then
        raise exception 'PR111: expected unresolved error for inactive level, got %.', sqlerrm;
      end if;
  end;

  begin
    perform public.materialize_storage_preset_container_contents(
      not_storable_profile_uuid,
      not_storable_container_uuid,
      actor_uuid
    );
    raise exception 'PR111: expected not-storable selected level to fail.';
  exception
    when others then
      if sqlerrm <> 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED' then
        raise exception 'PR111: expected unresolved error for not-storable level, got %.', sqlerrm;
      end if;
  end;

  begin
    perform public.materialize_storage_preset_container_contents(
      foreign_profile_uuid,
      foreign_container_uuid,
      actor_uuid
    );
    raise exception 'PR111: expected foreign selected level to fail.';
  exception
    when others then
      if sqlerrm <> 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED' then
        raise exception 'PR111: expected unresolved error for foreign level, got %.', sqlerrm;
      end if;
  end;

  if exists (
    select 1
    from public.inventory_unit iu
    where iu.container_id in (
      non_divisible_container_uuid,
      inactive_container_uuid,
      not_storable_container_uuid,
      foreign_container_uuid
    )
  ) then
    raise exception 'PR111: failed storage presets must not create inventory units.';
  end if;

  if exists (
    select 1
    from public.container_lines cl
    where cl.container_id in (
      non_divisible_container_uuid,
      inactive_container_uuid,
      not_storable_container_uuid,
      foreign_container_uuid
    )
  ) then
    raise exception 'PR111: failed storage presets must not create container lines.';
  end if;
end
$$;

rollback;
