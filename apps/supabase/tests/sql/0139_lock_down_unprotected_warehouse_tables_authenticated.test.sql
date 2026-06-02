begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  product_a uuid := gen_random_uuid();
  product_b uuid := gen_random_uuid();
  product_c uuid := gen_random_uuid();
  site_a uuid := gen_random_uuid();
  site_b uuid := gen_random_uuid();
  floor_a uuid := gen_random_uuid();
  floor_b uuid := gen_random_uuid();
  layout_a uuid := gen_random_uuid();
  layout_b uuid := gen_random_uuid();
  rack_a uuid := gen_random_uuid();
  face_a uuid := gen_random_uuid();
  aisle_a uuid := gen_random_uuid();
  location_a uuid := gen_random_uuid();
  location_b uuid := gen_random_uuid();
  face_access_a uuid := gen_random_uuid();
  location_policy_a uuid := gen_random_uuid();
  sku_policy_a uuid := gen_random_uuid();
  profile_a uuid := gen_random_uuid();
  profile_b uuid := gen_random_uuid();
  packaging_level_a uuid := gen_random_uuid();
  visible_count integer;
  affected integer;
begin
  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'RLS2-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'RLS2 Tenant A'),
    (tenant_b, 'RLS2-B-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'RLS2 Tenant B');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values
    (user_a, 'rls2-a@wos.test', now(), now(), now(), false, '{}', '{}'),
    (user_b, 'rls2-b@wos.test', now(), now(), now(), false, '{}', '{}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values
    (tenant_a, user_a, 'tenant_admin'),
    (tenant_b, user_b, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values
    (product_a, 'test-suite', 'rls2-product-a', 'RLS2-SKU-A', 'RLS2 Product A', true),
    (product_b, 'test-suite', 'rls2-product-b', 'RLS2-SKU-B', 'RLS2 Product B', true),
    (product_c, 'test-suite', 'rls2-product-c', 'RLS2-SKU-C', 'RLS2 Product C', true);

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
    (site_a, tenant_a, 'RLS2-SA', 'RLS2 Site A', 'UTC'),
    (site_b, tenant_b, 'RLS2-SB', 'RLS2 Site B', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values
    (floor_a, site_a, 'RLS2-FA', 'RLS2 Floor A', 1),
    (floor_b, site_b, 'RLS2-FB', 'RLS2 Floor B', 1);

  insert into public.layout_versions (id, floor_id, version_no, state, created_by)
  values
    (layout_a, floor_a, 1, 'published', user_a),
    (layout_b, floor_b, 1, 'published', user_b);

  insert into public.racks (
    id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state
  )
  values (
    rack_a, layout_a, 'RLS2-RA', 'single', 'NS', 0, 0, 100, 10, 0, 'published'
  );

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction)
  values (face_a, rack_a, 'A', true, 'ltr');

  insert into public.pick_aisles (
    id, tenant_id, floor_id, code, name, route_sequence, status
  )
  values (
    aisle_a, tenant_a, floor_a, 'A-1', 'Aisle A', 1, 'active'
  );

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
    (profile_a, tenant_a, product_a, 'RLS2-STORAGE-A', 'RLS2 Storage A', 'receiving', 'tenant', tenant_a, 0, true, 'active'),
    (profile_b, tenant_b, product_a, 'RLS2-STORAGE-B', 'RLS2 Storage B', 'receiving', 'tenant', tenant_b, 0, true, 'active');

  insert into public.sku_location_policies (
    id, tenant_id, location_id, product_id, min_qty_each, max_qty_each, preferred_packaging_profile_id, status
  )
  values (
    sku_policy_a, tenant_a, location_a, product_a, 1, 10, profile_a, 'active'
  );

  -- Cross-tenant and own-tenant access checks.
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count from public.face_access where id = face_access_a;
  if visible_count <> 1 then
    raise exception 'RLS0139-1 FAIL: tenant A should read own face_access row.';
  end if;

  select count(*) into visible_count from public.location_policies where id = location_policy_a;
  if visible_count <> 1 then
    raise exception 'RLS0139-2 FAIL: tenant A should read own location_policies row.';
  end if;

  select count(*) into visible_count from public.pick_aisles where id = aisle_a;
  if visible_count <> 1 then
    raise exception 'RLS0139-3 FAIL: tenant A should read own pick_aisles row.';
  end if;

  select count(*) into visible_count from public.sku_location_policies where id = sku_policy_a;
  if visible_count <> 1 then
    raise exception 'RLS0139-4 FAIL: tenant A should read own sku_location_policies row.';
  end if;

  execute 'reset role';

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_b::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count from public.face_access where id = face_access_a;
  if visible_count <> 0 then
    raise exception 'RLS0139-5 FAIL: tenant B must not read tenant A face_access.';
  end if;

  begin
    insert into public.face_access (tenant_id, rack_id, face_id, aisle_id)
    values (tenant_a, rack_a, face_a, aisle_a);
    raise exception 'RLS0139-6 FAIL: tenant B face_access insert for tenant A rack should be rejected.';
  exception
    when others then null;
  end;

  select count(*) into visible_count from public.location_policies where id = location_policy_a;
  if visible_count <> 0 then
    raise exception 'RLS0139-7 FAIL: tenant B must not read tenant A location_policies.';
  end if;

  begin
    insert into public.location_policies (tenant_id, location_id, status)
    values (tenant_b, location_a, 'active');
    raise exception 'RLS0139-8 FAIL: mismatched location_policies insert should be rejected.';
  exception
    when others then null;
  end;

  select count(*) into visible_count from public.pick_aisles where id = aisle_a;
  if visible_count <> 0 then
    raise exception 'RLS0139-9 FAIL: tenant B must not read tenant A pick_aisles.';
  end if;

  begin
    insert into public.pick_aisles (tenant_id, floor_id, code, status)
    values (tenant_b, floor_a, 'B-INVALID', 'active');
    raise exception 'RLS0139-10 FAIL: mismatched pick_aisles insert should be rejected.';
  exception
    when others then null;
  end;

  select count(*) into visible_count from public.sku_location_policies where id = sku_policy_a;
  if visible_count <> 0 then
    raise exception 'RLS0139-11 FAIL: tenant B must not read tenant A sku_location_policies.';
  end if;

  begin
    insert into public.sku_location_policies (
      tenant_id, location_id, product_id, preferred_packaging_profile_id, status
    )
    values (tenant_b, location_a, product_a, profile_b, 'active');
    raise exception 'RLS0139-12 FAIL: mismatched sku_location_policies location insert should be rejected.';
  exception
    when others then null;
  end;

  begin
    insert into public.sku_location_policies (
      tenant_id, location_id, product_id, preferred_packaging_profile_id, status
    )
    values (tenant_a, location_a, product_a, profile_b, 'active');
    raise exception 'RLS0139-13 FAIL: cross-tenant preferred packaging profile insert should be rejected.';
  exception
    when others then null;
  end;

  execute 'reset role';

  -- Shared catalog.
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into visible_count from public.product_packaging_levels where id = packaging_level_a;
  if visible_count <> 1 then
    raise exception 'RLS0139-14 FAIL: authenticated non-admin must read product_packaging_levels.';
  end if;

  select count(*) into visible_count from public.product_unit_profiles where product_id = product_b;
  if visible_count <> 1 then
    raise exception 'RLS0139-15 FAIL: authenticated non-admin must read product_unit_profiles.';
  end if;

  begin
    insert into public.product_packaging_levels (
      product_id, code, name, base_unit_qty, is_base, can_pick, can_store, is_default_pick_uom, sort_order, is_active
    )
    values (product_b, 'EA-NONADMIN', 'Non Admin Insert', 1, true, true, true, true, 0, true);
    raise exception 'RLS0139-16 FAIL: authenticated non-admin packaging insert should be rejected.';
  exception
    when others then null;
  end;

  update public.product_packaging_levels set name = 'non-admin change' where id = packaging_level_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0139-17 FAIL: authenticated non-admin packaging update should affect 0 rows.';
  end if;

  delete from public.product_packaging_levels where id = packaging_level_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0139-18 FAIL: authenticated non-admin packaging delete should affect 0 rows.';
  end if;

  begin
    insert into public.product_unit_profiles (
      product_id, unit_weight_g, unit_width_mm, unit_height_mm, unit_depth_mm, weight_class, size_class
    )
    values (product_c, 15, 15, 15, 15, 'light', 'small');
    raise exception 'RLS0139-19 FAIL: authenticated non-admin unit-profile insert should be rejected.';
  exception
    when others then null;
  end;

  update public.product_unit_profiles set unit_weight_g = 777 where product_id = product_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0139-20 FAIL: authenticated non-admin unit-profile update should affect 0 rows.';
  end if;

  delete from public.product_unit_profiles where product_id = product_b;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS0139-21 FAIL: authenticated non-admin unit-profile delete should affect 0 rows.';
  end if;

  raise notice '0139 authenticated warehouse table lock-down tests passed.';
end
$$;

rollback;
