begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  product_a uuid := gen_random_uuid();
  product_b uuid := gen_random_uuid();
  packaging_level_a uuid := gen_random_uuid();
  affected integer;
begin
  insert into public.tenants (id, code, name)
  values (tenant_a, 'RLS3-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'RLS3 Tenant A');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    admin_user, 'rls3-admin@wos.test', now(), now(), now(), false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, admin_user, 'platform_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values
    (product_a, 'test-suite', 'rls3-product-a', 'RLS3-SKU-A', 'RLS3 Product A', true),
    (product_b, 'test-suite', 'rls3-product-b', 'RLS3-SKU-B', 'RLS3 Product B', true);

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty, is_base, can_pick, can_store, is_default_pick_uom, sort_order, is_active
  )
  values (
    packaging_level_a, product_a, 'EA', 'Each', 1, true, true, true, true, 0, true
  );

  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_user::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  insert into public.product_packaging_levels (
    product_id, code, name, base_unit_qty, is_base, can_pick, can_store, is_default_pick_uom, sort_order, is_active
  )
  values (product_b, 'BOX', 'Box', 2, false, true, true, false, 1, true);

  update public.product_packaging_levels
  set name = 'Box Updated'
  where product_id = product_b
    and code = 'BOX';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'RLS0140-1 FAIL: platform admin packaging update should affect 1 row.';
  end if;

  delete from public.product_packaging_levels
  where product_id = product_b
    and code = 'BOX';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'RLS0140-2 FAIL: platform admin packaging delete should affect 1 row.';
  end if;

  insert into public.product_unit_profiles (
    product_id, unit_weight_g, unit_width_mm, unit_height_mm, unit_depth_mm, weight_class, size_class
  )
  values (product_b, 25, 25, 25, 25, 'medium', 'medium');

  update public.product_unit_profiles
  set unit_weight_g = 26
  where product_id = product_b;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'RLS0140-3 FAIL: platform admin unit-profile update should affect 1 row.';
  end if;

  delete from public.product_unit_profiles
  where product_id = product_b;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'RLS0140-4 FAIL: platform admin unit-profile delete should affect 1 row.';
  end if;

  execute 'reset role';
  execute 'set local role service_role';

  insert into public.product_packaging_levels (
    product_id, code, name, base_unit_qty, is_base, can_pick, can_store, is_default_pick_uom, sort_order, is_active
  )
  values (product_b, 'PAL', 'Pallet', 4, false, true, true, false, 2, true);

  delete from public.product_packaging_levels
  where product_id = product_b
    and code = 'PAL';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'RLS0140-5 FAIL: service_role packaging delete should affect 1 row.';
  end if;

  insert into public.product_unit_profiles (
    product_id, unit_weight_g, unit_width_mm, unit_height_mm, unit_depth_mm, weight_class, size_class
  )
  values (product_b, 30, 30, 30, 30, 'heavy', 'large');

  delete from public.product_unit_profiles
  where product_id = product_b;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'RLS0140-6 FAIL: service_role unit-profile delete should affect 1 row.';
  end if;

  execute 'reset role';
  raise notice '0140 shared catalog admin role tests passed.';
end
$$;

rollback;
