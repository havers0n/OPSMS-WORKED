begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid uuid;
  test_actor_uuid uuid;
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  layout_uuid uuid := gen_random_uuid();
  rack_uuid uuid := gen_random_uuid();
  rack_face_uuid uuid := gen_random_uuid();
  rack_section_uuid uuid := gen_random_uuid();
  rack_level_uuid uuid := gen_random_uuid();
  source_cell_uuid uuid := gen_random_uuid();
  occupied_cell_uuid uuid := gen_random_uuid();
  rack_target_cell_uuid uuid := gen_random_uuid();
  source_location_uuid uuid;
  occupied_location_uuid uuid;
  rack_target_location_uuid uuid;
  disabled_location_uuid uuid := gen_random_uuid();
  draft_location_uuid uuid := gen_random_uuid();
  non_rack_location_uuid uuid := gen_random_uuid();
  dimension_location_uuid uuid := gen_random_uuid();
  weight_location_uuid uuid := gen_random_uuid();
  source_container_uuid uuid;
  occupying_container_uuid uuid;
  product_uuid uuid := gen_random_uuid();
  move_result jsonb;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for current-location pivot test.';
  end if;

  -- 0044: move_container_canonical is now SECURITY DEFINER with inline
  -- can_manage_tenant() gate. Set up a platform_admin test actor and JWT
  -- so auth.uid() resolves correctly for the duration of this transaction.
  test_actor_uuid := gen_random_uuid();
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    test_actor_uuid, 'test-actor-s5@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );
  -- handle_auth_user_profile() trigger creates the profiles row automatically.
  -- provision_default_tenant_membership trigger may have already inserted
  -- 'operator'; upsert to platform_admin so can_manage_tenant() returns true.
  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, test_actor_uuid, 'platform_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', test_actor_uuid::text)::text,
    true
  );

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  update public.container_types
  set width_mm = 1000,
      height_mm = 1200,
      depth_mm = 800,
      tare_weight_g = 200
  where id = pallet_type_uuid;

  insert into public.products (id, source, external_product_id, sku, name, unit_weight_g)
  values (product_uuid, 'test-suite', 'stage5-product-001', 'SKU-S5-001', 'Stage 5 Product', 100);

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'S5CUR', 'Stage 5 Current Location Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'Stage 5 Floor', 1);

  insert into public.layout_versions (id, floor_id, version_no, state)
  values (layout_uuid, floor_uuid, 1, 'published');

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  values (rack_uuid, layout_uuid, 'R1', 'single', 'NS', 0, 0, 1000, 800, 0, 'published');

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
  values (rack_face_uuid, rack_uuid, 'A', true, 'ltr', false, null, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values (rack_section_uuid, rack_face_uuid, 1, 1000);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values (rack_level_uuid, rack_section_uuid, 1, 3);

  insert into public.cells (
    id,
    layout_version_id,
    rack_id,
    rack_face_id,
    rack_section_id,
    rack_level_id,
    slot_no,
    address,
    address_sort_key,
    cell_code
  )
  values
    (source_cell_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'stage5-cell-001'),
    (occupied_cell_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'stage5-cell-002'),
    (rack_target_cell_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 3, 'R1-A.01.01.03', 'R1-A-01-01-03', 'stage5-cell-003');

  perform public.backfill_locations_from_published_cells();

  select id into source_location_uuid
  from public.locations
  where geometry_slot_id = source_cell_uuid;

  select id into occupied_location_uuid
  from public.locations
  where geometry_slot_id = occupied_cell_uuid;

  select id into rack_target_location_uuid
  from public.locations
  where geometry_slot_id = rack_target_cell_uuid;

  insert into public.locations (
    id,
    tenant_id,
    floor_id,
    code,
    location_type,
    geometry_slot_id,
    capacity_mode,
    status
  )
  values
    (disabled_location_uuid, default_tenant_uuid, floor_uuid, 'DISABLED-01', 'buffer', null, 'single_container', 'disabled'),
    (draft_location_uuid, default_tenant_uuid, floor_uuid, 'DRAFT-01', 'buffer', null, 'single_container', 'draft'),
    (non_rack_location_uuid, default_tenant_uuid, floor_uuid, 'STAGE-01', 'staging', null, 'multi_container', 'active'),
    (dimension_location_uuid, default_tenant_uuid, floor_uuid, 'DIM-01', 'buffer', null, 'single_container', 'active'),
    (weight_location_uuid, default_tenant_uuid, floor_uuid, 'WEIGHT-01', 'buffer', null, 'single_container', 'active');

  update public.locations
  set width_mm = 900
  where id = dimension_location_uuid;

  update public.locations
  set max_weight_g = 400
  where id = weight_location_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values
    (default_tenant_uuid, 'S5-SOURCE', pallet_type_uuid, 'active'),
    (default_tenant_uuid, 'S5-OCCUPIED', pallet_type_uuid, 'active');

  select id into source_container_uuid from public.containers where external_code = 'S5-SOURCE';
  select id into occupying_container_uuid from public.containers where external_code = 'S5-OCCUPIED';

  perform public.place_container(source_container_uuid, source_cell_uuid, null);
  perform public.place_container(occupying_container_uuid, occupied_cell_uuid, null);

  if public.backfill_container_current_locations() <> 0 then
    raise exception 'Expected current-location backfill to be idempotent once canonical current locations are already set.';
  end if;

  insert into public.inventory_unit (
    tenant_id,
    container_id,
    product_id,
    quantity,
    uom,
    status
  )
  values (
    default_tenant_uuid,
    source_container_uuid,
    product_uuid,
    3,
    'pcs',
    'available'
  );

  update public.container_placements
  set removed_at = timezone('utc', now())
  where container_id = source_container_uuid
    and removed_at is null;

  if not exists (
    select 1
    from public.active_container_locations_v acl
    where acl.container_id = source_container_uuid
      and acl.location_id = source_location_uuid
      and acl.cell_id = source_cell_uuid
  ) then
    raise exception 'Expected active_container_locations_v to derive current state from containers.current_location_id even without an active placement row.';
  end if;

  if not exists (
    select 1
    from public.cell_occupancy_v cov
    where cov.container_id = source_container_uuid
      and cov.cell_id = source_cell_uuid
  ) then
    raise exception 'Expected geometry-backed compatibility views to rebuild rows from canonical current location truth.';
  end if;

  begin
    perform public.move_container_canonical(source_container_uuid, source_location_uuid, null);
    raise exception 'Expected same-location move to fail.';
  exception
    when others then
      if sqlerrm <> 'SAME_LOCATION' then
        raise;
      end if;
  end;

  begin
    perform public.move_container_canonical(source_container_uuid, occupied_location_uuid, null);
    raise exception 'Expected occupied single-container location to fail.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_OCCUPIED' then
        raise;
      end if;
  end;

  begin
    perform public.move_container_canonical(source_container_uuid, disabled_location_uuid, null);
    raise exception 'Expected disabled target location to fail.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_NOT_ACTIVE' then
        raise;
      end if;
  end;

  begin
    perform public.move_container_canonical(source_container_uuid, draft_location_uuid, null);
    raise exception 'Expected draft target location to fail.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_NOT_ACTIVE' then
        raise;
      end if;
  end;

  begin
    perform public.move_container_canonical(source_container_uuid, dimension_location_uuid, null);
    raise exception 'Expected oversized container to fail dimension constraint.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_DIMENSION_OVERFLOW' then
        raise;
      end if;
  end;

  update public.container_types
  set width_mm = null
  where id = pallet_type_uuid;

  begin
    perform public.move_container_canonical(source_container_uuid, dimension_location_uuid, null);
    raise exception 'Expected unknown enforced dimension to fail.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_DIMENSION_UNKNOWN' then
        raise;
      end if;
  end;

  update public.container_types
  set width_mm = 1000
  where id = pallet_type_uuid;

  begin
    perform public.move_container_canonical(source_container_uuid, weight_location_uuid, null);
    raise exception 'Expected overweight container to fail weight constraint.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_WEIGHT_OVERFLOW' then
        raise;
      end if;
  end;

  update public.products
  set unit_weight_g = null
  where id = product_uuid;

  begin
    perform public.move_container_canonical(source_container_uuid, weight_location_uuid, null);
    raise exception 'Expected unknown gross weight to fail when location enforces max weight.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_WEIGHT_UNKNOWN' then
        raise;
      end if;
  end;

  update public.products
  set unit_weight_g = 100
  where id = product_uuid;

  update public.locations
  set capacity_mode = 'multi_container'
  where id = occupied_location_uuid;

  move_result := public.move_container_canonical(source_container_uuid, occupied_location_uuid, null);

  if move_result ->> 'targetLocationId' <> occupied_location_uuid::text then
    raise exception 'Expected canonical move to succeed into a multi-container rack location.';
  end if;

  if (
    select count(*)
    from public.active_container_locations_v acl
    where acl.location_id = occupied_location_uuid
  ) <> 2 then
    raise exception 'Expected multi-container location occupancy to derive from canonical current location truth.';
  end if;

  move_result := public.move_container_canonical(source_container_uuid, non_rack_location_uuid, null);

  if move_result ->> 'targetLocationId' <> non_rack_location_uuid::text then
    raise exception 'Expected canonical move to support non-rack locations.';
  end if;

  if exists (
    select 1
    from public.container_placements cp
    where cp.container_id = source_container_uuid
      and cp.removed_at is null
  ) then
    raise exception 'Expected non-rack canonical move to close rack placement projection.';
  end if;

  if exists (
    select 1
    from public.cell_occupancy_v cov
    where cov.container_id = source_container_uuid
  ) then
    raise exception 'Expected cell compatibility views to hide non-rack current locations.';
  end if;

  move_result := public.move_container_canonical(source_container_uuid, rack_target_location_uuid, null);

  if move_result ->> 'targetLocationId' <> rack_target_location_uuid::text then
    raise exception 'Expected canonical move to return rack-backed target location id.';
  end if;

  if not exists (
    select 1
    from public.container_placements cp
    where cp.container_id = source_container_uuid
      and cp.cell_id = rack_target_cell_uuid
      and cp.removed_at is null
  ) then
    raise exception 'Expected canonical move back into a rack location to recreate placement projection.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.movement_type = 'move_container'
      and sm.source_location_id = non_rack_location_uuid
      and sm.target_location_id = rack_target_location_uuid
      and sm.source_container_id = source_container_uuid
      and sm.target_container_id = source_container_uuid
  ) then
    raise exception 'Expected canonical move to continue writing stock_movements after the current-location pivot.';
  end if;
end
$$;

rollback;
