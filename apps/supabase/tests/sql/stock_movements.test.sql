begin;

do $$
declare
  default_tenant_uuid uuid;
  other_tenant_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;
  actor_uuid uuid := null;
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
  empty_cell_uuid uuid := gen_random_uuid();
  source_location_uuid uuid;
  occupied_location_uuid uuid;
  empty_location_uuid uuid;
  staging_location_uuid uuid := gen_random_uuid();
  source_container_uuid uuid;
  occupied_container_uuid uuid;
  split_target_container_uuid uuid;
  merge_target_container_uuid uuid;
  transfer_target_container_uuid uuid;
  pick_container_uuid uuid;
  cross_tenant_container_uuid uuid;
  product_uuid uuid := gen_random_uuid();
  serial_product_uuid uuid := gen_random_uuid();
  packaging_level_uuid uuid := gen_random_uuid();
  other_packaging_level_uuid uuid := gen_random_uuid();
  source_inventory_unit_uuid uuid;
  serial_inventory_unit_uuid uuid;
  sealed_inventory_unit_uuid uuid;
  opened_inventory_unit_uuid uuid;
  split_result jsonb;
  merge_result jsonb;
  transfer_result jsonb;
  pick_result jsonb;
  move_result jsonb;
  source_line_uuid uuid;
  target_line_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for stock movement test.';
  end if;

  -- 0044: functions now require can_manage_tenant() to return true.
  -- can_manage_tenant() reads auth.uid() from request.jwt.claims.
  -- Insert a minimal test actor and set JWT claims for this transaction.
  test_actor_uuid := gen_random_uuid();
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    test_actor_uuid, 'test-actor-s4@wos.test', now(), now(), now(),
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

  insert into public.tenants (id, code, name)
  values (other_tenant_uuid, 'stage4-other', 'Stage 4 Other Tenant');

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  insert into public.products (id, source, external_product_id, sku, name)
  values
    (product_uuid, 'test-suite', 'stage4-product-001', 'SKU-S4-001', 'Stage 4 Product'),
    (serial_product_uuid, 'test-suite', 'stage4-product-serial', 'SKU-S4-SERIAL', 'Stage 4 Serial Product');

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty, is_base, can_pick, can_store, is_default_pick_uom, is_active
  )
  values
    (packaging_level_uuid, product_uuid, 'CTN', 'Carton', 12, false, true, true, false, true),
    (other_packaging_level_uuid, product_uuid, 'INNER', 'Inner Pack', 6, false, true, true, false, true);

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'S4MOV', 'Stage 4 Movement Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'Stage 4 Movement Floor', 1);

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

  insert into public.cells (id, layout_version_id, rack_id, rack_face_id, rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code)
  values
    (source_cell_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'stage4-cell-001'),
    (occupied_cell_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'stage4-cell-002'),
    (empty_cell_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 3, 'R1-A.01.01.03', 'R1-A-01-01-03', 'stage4-cell-003');

  perform public.backfill_locations_from_published_cells();

  select id into source_location_uuid
  from public.locations
  where geometry_slot_id = source_cell_uuid;

  select id into occupied_location_uuid
  from public.locations
  where geometry_slot_id = occupied_cell_uuid;

  select id into empty_location_uuid
  from public.locations
  where geometry_slot_id = empty_cell_uuid;

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
  values (
    staging_location_uuid,
    default_tenant_uuid,
    floor_uuid,
    'STAGE-01',
    'staging',
    null,
    'multi_container',
    'active'
  );

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values
    (default_tenant_uuid, 'S4-SOURCE', pallet_type_uuid, 'active'),
    (default_tenant_uuid, 'S4-OCCUPIED', pallet_type_uuid, 'active'),
    (default_tenant_uuid, 'S4-SPLIT', pallet_type_uuid, 'active'),
    (default_tenant_uuid, 'S4-MERGE', pallet_type_uuid, 'active'),
    (default_tenant_uuid, 'S4-TRANSFER', pallet_type_uuid, 'active'),
    (default_tenant_uuid, 'S4-PICK', pallet_type_uuid, 'active'),
    (other_tenant_uuid, 'S4-OTH', pallet_type_uuid, 'active');

  select id into source_container_uuid from public.containers where external_code = 'S4-SOURCE';
  select id into occupied_container_uuid from public.containers where external_code = 'S4-OCCUPIED';
  select id into split_target_container_uuid from public.containers where external_code = 'S4-SPLIT';
  select id into merge_target_container_uuid from public.containers where external_code = 'S4-MERGE';
  select id into transfer_target_container_uuid from public.containers where external_code = 'S4-TRANSFER';
  select id into pick_container_uuid from public.containers where external_code = 'S4-PICK';
  select id into cross_tenant_container_uuid from public.containers where external_code = 'S4-OTH';

  perform public.place_container_at_location(source_container_uuid, source_location_uuid, actor_uuid);
  perform public.place_container_at_location(occupied_container_uuid, occupied_location_uuid, actor_uuid);

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
    10,
    'pcs',
    'available'
  )
  returning id into source_inventory_unit_uuid;

  insert into public.inventory_unit (
    tenant_id,
    container_id,
    product_id,
    quantity,
    uom,
    serial_no,
    status
  )
  values (
    default_tenant_uuid,
    source_container_uuid,
    serial_product_uuid,
    1,
    'pcs',
    'SER-001',
    'available'
  )
  returning id into serial_inventory_unit_uuid;

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
    source_container_uuid,
    product_uuid,
    48,
    'pcs',
    'available',
    'sealed',
    packaging_level_uuid,
    4
  )
  returning id into sealed_inventory_unit_uuid;

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
    source_container_uuid,
    product_uuid,
    6,
    'pcs',
    'available',
    'opened',
    packaging_level_uuid,
    1
  )
  returning id into opened_inventory_unit_uuid;

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
    merge_target_container_uuid,
    product_uuid,
    4,
    'pcs',
    'available'
  );

  move_result := public.move_container_canonical(source_container_uuid, empty_location_uuid, actor_uuid);

  if move_result ->> 'targetLocationId' <> empty_location_uuid::text then
    raise exception 'Expected move_container_canonical to return target location id.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (move_result ->> 'movementId')::uuid
      and sm.movement_type = 'move_container'
      and sm.source_location_id = source_location_uuid
      and sm.target_location_id = empty_location_uuid
      and sm.source_container_id = source_container_uuid
      and sm.target_container_id = source_container_uuid
  ) then
    raise exception 'Expected canonical move_container to write stock_movements row.';
  end if;

  begin
    perform public.move_container_canonical(source_container_uuid, occupied_location_uuid, actor_uuid);
    raise exception 'Expected move_container_canonical to reject occupied target location.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_OCCUPIED' then
        raise;
      end if;
  end;

  move_result := public.move_container_canonical(source_container_uuid, staging_location_uuid, actor_uuid);

  if move_result ->> 'targetLocationId' <> staging_location_uuid::text then
    raise exception 'Expected move_container_canonical to support non-rack target locations in Stage 5.';
  end if;

  split_result := public.split_inventory_unit(source_inventory_unit_uuid, 2, split_target_container_uuid, actor_uuid);

  if (split_result ->> 'mergeApplied')::boolean then
    raise exception 'Expected split_inventory_unit to create a child row when no merge candidate exists.';
  end if;

  if (split_result ->> 'sourceQuantity')::numeric <> 8 then
    raise exception 'Expected split_inventory_unit to decrement source quantity to 8.';
  end if;

  select iu.container_line_id
  into source_line_uuid
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid;

  select iu.container_line_id
  into target_line_uuid
  from public.inventory_unit iu
  where iu.id = (split_result ->> 'targetInventoryUnitId')::uuid;

  if source_line_uuid is null or target_line_uuid is null then
    raise exception 'Expected split_inventory_unit projections to point at canonical current container_lines.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = source_line_uuid
      and cl.line_kind = 'receipt'
      and cl.qty_each = 10
      and cl.current_qty_each = 8
      and cl.current_container_id = source_container_uuid
      and cl.root_receipt_line_id = cl.id
      and cl.parent_container_line_id is null
  ) then
    raise exception 'Expected source receipt line to keep immutable qty_each=10 while current_qty_each=8.';
  end if;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = target_line_uuid
      and cl.line_kind = 'current_fragment'
      and cl.qty_each = 2
      and cl.current_qty_each = 2
      and cl.current_container_id = split_target_container_uuid
      and cl.root_receipt_line_id = source_line_uuid
      and cl.parent_container_line_id = source_line_uuid
  ) then
    raise exception 'Expected split target projection to point at a current_fragment line with source lineage.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    where iu.id = (split_result ->> 'targetInventoryUnitId')::uuid
      and iu.container_id = split_target_container_uuid
      and iu.quantity = 2
      and iu.source_inventory_unit_id = source_inventory_unit_uuid
  ) then
    raise exception 'Expected split_inventory_unit to create child inventory row with lineage.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (split_result ->> 'movementId')::uuid
      and sm.movement_type = 'split_stock'
      and sm.source_inventory_unit_id = source_inventory_unit_uuid
      and sm.target_inventory_unit_id = (split_result ->> 'targetInventoryUnitId')::uuid
  ) then
    raise exception 'Expected split_inventory_unit to write split_stock movement.';
  end if;

  merge_result := public.split_inventory_unit(source_inventory_unit_uuid, 3, merge_target_container_uuid, actor_uuid);

  if not (merge_result ->> 'mergeApplied')::boolean then
    raise exception 'Expected split_inventory_unit to merge into exact-match target row.';
  end if;

  if (merge_result ->> 'targetQuantity')::numeric <> 7 then
    raise exception 'Expected exact-match merge target quantity to become 7.';
  end if;

  select iu.container_line_id
  into target_line_uuid
  from public.inventory_unit iu
  where iu.id = (merge_result ->> 'targetInventoryUnitId')::uuid;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = target_line_uuid
      and cl.line_kind = 'receipt'
      and cl.current_qty_each = 7
      and cl.current_container_id = merge_target_container_uuid
  ) then
    raise exception 'Expected exact-match merge to update the existing target current canonical row.';
  end if;

  if (
    select count(*)
    from public.inventory_unit
    where container_id = merge_target_container_uuid
      and product_id = product_uuid
      and status = 'available'
  ) <> 1 then
    raise exception 'Expected merge target container to keep a single exact-match row.';
  end if;

  merge_result := public.split_inventory_unit(sealed_inventory_unit_uuid, 12, merge_target_container_uuid, actor_uuid);

  if (merge_result ->> 'mergeApplied')::boolean then
    raise exception 'Expected packaging mismatch to prevent merge into loose stock.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    where iu.id = (merge_result ->> 'targetInventoryUnitId')::uuid
      and iu.packaging_state = 'sealed'
      and iu.product_packaging_level_id = packaging_level_uuid
      and iu.pack_count = 1
  ) then
    raise exception 'Expected packaged split child row to preserve packaging metadata.';
  end if;

  select iu.container_line_id
  into target_line_uuid
  from public.inventory_unit iu
  where iu.id = (merge_result ->> 'targetInventoryUnitId')::uuid;

  if not exists (
    select 1
    from public.container_lines cl
    where cl.id = target_line_uuid
      and cl.line_kind = 'current_fragment'
      and cl.current_packaging_state = 'sealed'
      and cl.current_pack_count = 1
      and cl.current_qty_each = 12
  ) then
    raise exception 'Expected packaged current_fragment to preserve current packaging state and pack count.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    where iu.id = sealed_inventory_unit_uuid
      and iu.quantity = 36
      and iu.pack_count = 3
  ) then
    raise exception 'Expected packaged source row to recompute remaining pack_count after split.';
  end if;

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
    transfer_target_container_uuid,
    product_uuid,
    24,
    'pcs',
    'available',
    'sealed',
    packaging_level_uuid,
    2
  );

  split_result := public.split_inventory_unit(sealed_inventory_unit_uuid, 12, transfer_target_container_uuid, actor_uuid);

  if not (split_result ->> 'mergeApplied')::boolean then
    raise exception 'Expected packaged rows with same state and level to merge even when pack_count differs.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    where iu.id = (split_result ->> 'targetInventoryUnitId')::uuid
      and iu.quantity = 36
      and iu.pack_count = 3
      and iu.packaging_state = 'sealed'
      and iu.product_packaging_level_id = packaging_level_uuid
  ) then
    raise exception 'Expected packaged merge to sum pack_count instead of treating it as merge identity.';
  end if;

  begin
    perform public.split_inventory_unit(opened_inventory_unit_uuid, 1, split_target_container_uuid, actor_uuid);
    raise exception 'Expected opened packaged stock split to fail explicitly.';
  exception
    when others then
      if sqlerrm <> 'OPENED_PACKAGING_SPLIT_NOT_ALLOWED' then
        raise;
      end if;
  end;

  begin
    perform public.split_inventory_unit(source_inventory_unit_uuid, 5, split_target_container_uuid, actor_uuid);
    raise exception 'Expected full-row split quantity to fail.';
  exception
    when others then
      if sqlerrm <> 'INVALID_SPLIT_QUANTITY' then
        raise;
      end if;
  end;

  begin
    perform public.split_inventory_unit(serial_inventory_unit_uuid, 0.5, split_target_container_uuid, actor_uuid);
    raise exception 'Expected serial-tracked inventory split to fail.';
  exception
    when others then
      if sqlerrm <> 'SERIAL_SPLIT_NOT_ALLOWED' then
        raise;
      end if;
  end;

  begin
    perform public.split_inventory_unit(source_inventory_unit_uuid, 1, cross_tenant_container_uuid, actor_uuid);
    raise exception 'Expected cross-tenant split to fail.';
  exception
    when others then
      -- 0044: TARGET_CONTAINER_TENANT_MISMATCH is now masked as
      -- TARGET_CONTAINER_NOT_FOUND to prevent cross-tenant existence oracle.
      if sqlerrm <> 'TARGET_CONTAINER_NOT_FOUND' then
        raise;
      end if;
  end;

  transfer_result := public.transfer_inventory_unit(source_inventory_unit_uuid, 1, transfer_target_container_uuid, actor_uuid);

  if transfer_result ->> 'targetLocationId' is not null then
    raise exception 'Expected transfer to allow null target location only for unplaced target container.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (transfer_result ->> 'splitMovementId')::uuid
      and sm.movement_type = 'split_stock'
  ) then
    raise exception 'Expected transfer_inventory_unit to preserve split movement id.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (transfer_result ->> 'transferMovementId')::uuid
      and sm.movement_type = 'transfer_stock'
      and sm.target_location_id is null
      and sm.target_container_id = transfer_target_container_uuid
  ) then
    raise exception 'Expected transfer_inventory_unit to write transfer_stock movement with null target location for unplaced target container.';
  end if;

  pick_result := public.pick_partial_inventory_unit(source_inventory_unit_uuid, 1, pick_container_uuid, actor_uuid);

  if not exists (
    select 1
    from public.stock_movements sm
    where sm.id = (pick_result ->> 'transferMovementId')::uuid
      and sm.movement_type = 'pick_partial'
      and sm.target_container_id = pick_container_uuid
  ) then
    raise exception 'Expected pick_partial_inventory_unit to write pick_partial movement.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_movements'
      and column_name = 'product_id'
  ) then
    raise exception 'Did not expect stock_movements to duplicate product_id.';
  end if;
end
$$;

rollback;
