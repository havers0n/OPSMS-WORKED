begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  product_a uuid := gen_random_uuid();
  product_b uuid := gen_random_uuid();
  site_a uuid := gen_random_uuid();
  site_b uuid := gen_random_uuid();
  floor_a uuid := gen_random_uuid();
  floor_b uuid := gen_random_uuid();
  layout_a uuid := gen_random_uuid();
  layout_b uuid := gen_random_uuid();
  rack_a uuid := gen_random_uuid();
  rack_b uuid := gen_random_uuid();
  face_a uuid := gen_random_uuid();
  aisle_a uuid := gen_random_uuid();
  aisle_b uuid := gen_random_uuid();
  location_a uuid := gen_random_uuid();
  location_b uuid := gen_random_uuid();
  face_access_a uuid := gen_random_uuid();
  location_policy_a uuid := gen_random_uuid();
  sku_policy_a uuid := gen_random_uuid();
  profile_a uuid := gen_random_uuid();
  profile_b uuid := gen_random_uuid();
  packaging_level_a uuid := gen_random_uuid();
  unit_profile_b_product uuid := gen_random_uuid();
  affected integer;
  visible_count integer;
begin
  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'RLS-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'RLS Tenant A'),
    (tenant_b, 'RLS-B-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'RLS Tenant B');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values
    (user_a, 'rls-a@wos.test', now(), now(), now(), false, '{}', '{}'),
    (user_b, 'rls-b@wos.test', now(), now(), now(), false, '{}', '{}'),
    (admin_user, 'rls-admin@wos.test', now(), now(), now(), false, '{}', '{}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values
    (tenant_a, user_a, 'tenant_admin'),
    (tenant_b, user_b, 'tenant_admin'),
    (tenant_a, admin_user, 'platform_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values
    (product_a, 'test-suite', 'rls-product-a', 'RLS-SKU-A', 'RLS Product A', true),
    (product_b, 'test-suite', 'rls-product-b', 'RLS-SKU-B', 'RLS Product B', true),
    (unit_profile_b_product, 'test-suite', 'rls-product-c', 'RLS-SKU-C', 'RLS Product C', true);

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty, is_base, can_pick, can_store, is_default_pick_uom, sort_order, is_active
  )
  values (
    packaging_level_a, product_a, 'EA', 'Each', 1, true, true, true, true, 0, true
  );

  insert into public.product_unit_profiles (
    product_id, unit_weight_g, unit_width_mm, unit_height_mm, unit_depth_mm, weight_class, size_class
  )
  values (
    product_b, 100, 10, 20, 30, 'light', 'small'
  );

  insert into public.sites (id, tenant_id, code, name, timezone)
  values
    (site_a, tenant_a, 'RLS-SA', 'RLS Site A', 'UTC'),
    (site_b, tenant_b, 'RLS-SB', 'RLS Site B', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values
    (floor_a, site_a, 'RLS-FA', 'RLS Floor A', 1),
    (floor_b, site_b, 'RLS-FB', 'RLS Floor B', 1);

  insert into public.layout_versions (id, floor_id, version_no, state, created_by)
  values
    (layout_a, floor_a, 1, 'published', user_a),
    (layout_b, floor_b, 1, 'published', user_b);

  insert into public.racks (
    id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state
  )
  values
    (rack_a, layout_a, 'RLS-RA', 'single', 'NS', 0, 0, 100, 10, 0, 'published'),
    (rack_b, layout_b, 'RLS-RB', 'single', 'NS', 0, 0, 100, 10, 0, 'published');

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction)
  values
    (face_a, rack_a, 'A', true, 'ltr');

  insert into public.pick_aisles (
    id, tenant_id, floor_id, code, name, route_sequence, status
  )
  values
    (aisle_a, tenant_a, floor_a, 'A-1', 'Aisle A', 1, 'active'),
    (aisle_b, tenant_b, floor_b, 'B-1', 'Aisle B', 1, 'active');

  insert into public.face_access (
    id, tenant_id, rack_id, face_id, aisle_id, side_of_aisle, position_along_aisle, normal_x, normal_y
  )
  values (
    face_access_a, tenant_a, rack_a, face_a, aisle_a, 'left', 1, 0, 1
  );

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  )
  values
    (location_a, tenant_a, floor_a, 'LOC-A', 'staging', 'single_container', 'active'),
    (location_b, tenant_b, floor_b, 'LOC-B', 'staging', 'single_container', 'active');

  insert into public.location_policies (
    id, tenant_id, location_id, receiving_enabled, allow_mixed_skus, default_inventory_status, status
  )
  values (
    location_policy_a, tenant_a, location_a, true, true, 'available', 'active'
  );

  insert into public.packaging_profiles (
    id, tenant_id, product_id, code, name, profile_type, scope_type, scope_id, priority, is_default, status
  )
  values
    (profile_a, tenant_a, product_a, 'RLS-STORAGE-A', 'RLS Storage A', 'receiving', 'tenant', tenant_a, 0, true, 'active'),
    (profile_b, tenant_b, product_a, 'RLS-STORAGE-B', 'RLS Storage B', 'receiving', 'tenant', tenant_b, 0, true, 'active');

  insert into public.sku_location_policies (
    id, tenant_id, location_id, product_id, min_qty_each, max_qty_each, preferred_packaging_profile_id, status
  )
  values (
    sku_policy_a, tenant_a, location_a, product_a, 1, 10, profile_a, 'active'
  );

  -- Anonymous callers cannot read or mutate protected rows.
  execute 'set local role anon';

  select count(*) into visible_count from public.face_access;
  if visible_count <> 0 then
    raise exception 'RLS0138-1 FAIL: anon must not read face_access.';
  end if;

  select count(*) into visible_count from public.location_policies;
  if visible_count <> 0 then
    raise exception 'RLS0138-2 FAIL: anon must not read location_policies.';
  end if;

  select count(*) into visible_count from public.pick_aisles;
  if visible_count <> 0 then
    raise exception 'RLS0138-3 FAIL: anon must not read pick_aisles.';
  end if;

  select count(*) into visible_count from public.sku_location_policies;
  if visible_count <> 0 then
    raise exception 'RLS0138-4 FAIL: anon must not read sku_location_policies.';
  end if;

  select count(*) into visible_count from public.product_packaging_levels;
  if visible_count <> 0 then
    raise exception 'RLS0138-5 FAIL: anon must not read product_packaging_levels.';
  end if;

  select count(*) into visible_count from public.product_unit_profiles;
  if visible_count <> 0 then
    raise exception 'RLS0138-6 FAIL: anon must not read product_unit_profiles.';
  end if;

  begin
    insert into public.face_access (rack_id, face_id, aisle_id)
    values (rack_a, face_a, aisle_a);
    raise exception 'RLS0138-7 FAIL: anon face_access insert should be rejected.';
  exception
    when others then null;
  end;

  update public.face_access set position_along_aisle = 9 where id = face_access_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-8 FAIL: anon face_access update should affect 0 rows.';
  end if;

  delete from public.face_access where id = face_access_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-9 FAIL: anon face_access delete should affect 0 rows.';
  end if;

  begin
    insert into public.location_policies (tenant_id, location_id, status)
    values (tenant_a, location_a, 'active');
    raise exception 'RLS0138-10 FAIL: anon location_policies insert should be rejected.';
  exception
    when others then null;
  end;

  update public.location_policies set allow_mixed_skus = false where id = location_policy_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-11 FAIL: anon location_policies update should affect 0 rows.';
  end if;

  delete from public.location_policies where id = location_policy_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-12 FAIL: anon location_policies delete should affect 0 rows.';
  end if;

  begin
    insert into public.pick_aisles (tenant_id, floor_id, code, status)
    values (tenant_a, floor_a, 'A-NEW', 'active');
    raise exception 'RLS0138-13 FAIL: anon pick_aisles insert should be rejected.';
  exception
    when others then null;
  end;

  update public.pick_aisles set name = 'changed' where id = aisle_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-14 FAIL: anon pick_aisles update should affect 0 rows.';
  end if;

  delete from public.pick_aisles where id = aisle_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-15 FAIL: anon pick_aisles delete should affect 0 rows.';
  end if;

  begin
    insert into public.sku_location_policies (tenant_id, location_id, product_id, status)
    values (tenant_a, location_a, product_a, 'active');
    raise exception 'RLS0138-16 FAIL: anon sku_location_policies insert should be rejected.';
  exception
    when others then null;
  end;

  update public.sku_location_policies set min_qty_each = 2 where id = sku_policy_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-17 FAIL: anon sku_location_policies update should affect 0 rows.';
  end if;

  delete from public.sku_location_policies where id = sku_policy_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-18 FAIL: anon sku_location_policies delete should affect 0 rows.';
  end if;

  begin
    insert into public.product_packaging_levels (
      product_id, code, name, base_unit_qty, is_base, can_pick, can_store, is_default_pick_uom, sort_order, is_active
    )
    values (product_b, 'EA-ANON', 'Anon Insert', 1, true, true, true, true, 0, true);
    raise exception 'RLS0138-19 FAIL: anon product_packaging_levels insert should be rejected.';
  exception
    when others then null;
  end;

  update public.product_packaging_levels set name = 'changed' where id = packaging_level_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-20 FAIL: anon product_packaging_levels update should affect 0 rows.';
  end if;

  delete from public.product_packaging_levels where id = packaging_level_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-21 FAIL: anon product_packaging_levels delete should affect 0 rows.';
  end if;

  begin
    insert into public.product_unit_profiles (
      product_id, unit_weight_g, unit_width_mm, unit_height_mm, unit_depth_mm, weight_class, size_class
    )
    values (unit_profile_b_product, 10, 10, 10, 10, 'light', 'small');
    raise exception 'RLS0138-22 FAIL: anon product_unit_profiles insert should be rejected.';
  exception
    when others then null;
  end;

  update public.product_unit_profiles set unit_weight_g = 999 where product_id = product_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-23 FAIL: anon product_unit_profiles update should affect 0 rows.';
  end if;

  delete from public.product_unit_profiles where product_id = product_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0138-24 FAIL: anon product_unit_profiles delete should affect 0 rows.';
  end if;

  execute 'reset role';
  raise notice '0138 anonymous warehouse table lock-down tests passed.';
end
$$;

rollback;
