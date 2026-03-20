-- 0044_security_hardening.test.sql
--
-- Negative tests for the 0044 security hardening patch.
-- Covers:
--   CT   cross-tenant UUID attacks
--   SP   actor_uuid spoof prevention
--   DH   revoked direct helper call denial
--   NF   not-found vs unauthorized indistinguishability
--   LC   legitimate same-tenant calls continue to work
--   CR   canonical remove_container truth (current_location_id, not placements)
--   TS   occurredAt timestamp reuse in transfer/pick

begin;

do $$
declare
  -- tenants
  default_tenant_uuid uuid;
  other_tenant_uuid   uuid := gen_random_uuid();

  -- actors
  actor_a_uuid        uuid := gen_random_uuid();   -- tenant_admin of default_tenant
  actor_b_uuid        uuid := gen_random_uuid();   -- tenant_admin of other_tenant
  actor_spoof_uuid    uuid := gen_random_uuid();   -- arbitrary uuid never given any membership

  -- shared
  pallet_type_uuid    uuid;

  -- default_tenant fixtures (rack-backed)
  site_uuid           uuid := gen_random_uuid();
  floor_uuid          uuid := gen_random_uuid();
  layout_uuid         uuid := gen_random_uuid();
  rack_uuid           uuid := gen_random_uuid();
  rack_face_uuid      uuid := gen_random_uuid();
  rack_section_uuid   uuid := gen_random_uuid();
  rack_level_uuid     uuid := gen_random_uuid();
  cell_a_uuid         uuid := gen_random_uuid();
  cell_b_uuid         uuid := gen_random_uuid();
  cell_c_uuid         uuid := gen_random_uuid();
  cell_d_uuid         uuid := gen_random_uuid();   -- dedicated rack cell for CR-1
  location_a_uuid     uuid;
  location_b_uuid     uuid;
  location_c_uuid     uuid;
  location_d_uuid     uuid;
  staging_loc_uuid    uuid := gen_random_uuid();

  -- default_tenant containers and inventory
  src_container_uuid    uuid;
  tgt_container_uuid    uuid;
  spoof_container_uuid  uuid;
  remove_container_uuid uuid;
  cr1_container_uuid    uuid;   -- rack-backed container for CR-1 canonical remove test
  nonrack_container_uuid uuid;
  product_uuid        uuid := gen_random_uuid();
  src_iu_uuid         uuid;

  -- other_tenant fixtures (non-rack, minimal)
  oth_site_uuid       uuid := gen_random_uuid();
  oth_floor_uuid      uuid := gen_random_uuid();
  oth_loc_uuid        uuid := gen_random_uuid();
  oth_container_uuid  uuid;

  -- results
  result              jsonb;
  split_movement_id   uuid;
  transfer_movement_id uuid;
  pick_movement_id    uuid;
  split_created_at    timestamptz;
  transfer_created_at timestamptz;

  -- scratch
  recorded_created_by uuid;
begin

  -- ══════════════════════════════════════════════════════════════════════
  -- FIXTURE SETUP
  -- ══════════════════════════════════════════════════════════════════════

  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception '0044-TEST: default tenant must exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  -- ── actor_a: tenant_admin of default_tenant only ──────────────────────
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_a_uuid, 'actor-a@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );
  -- handle_auth_user_profile() trigger creates profiles row automatically.
  -- provision_default_tenant_membership trigger may insert 'operator' into
  -- tenant_members for default_tenant; upsert to the intended role.
  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, actor_a_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  -- ── actor_b: tenant_admin of other_tenant only ────────────────────────
  insert into public.tenants (id, code, name)
  values (other_tenant_uuid, 'sec-other', 'Security Test Other Tenant');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_b_uuid, 'actor-b@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );
  -- No membership for default_tenant — actor_b is isolated to other_tenant.
  insert into public.tenant_members (tenant_id, profile_id, role)
  values (other_tenant_uuid, actor_b_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  -- ── default_tenant: site → floor → layout → rack → cells → locations ─
  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'SEC-DEF', 'Security Test Default Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'Security Test Floor', 1);

  insert into public.layout_versions (id, floor_id, version_no, state)
  values (layout_uuid, floor_uuid, 1, 'published');

  insert into public.racks (
    id, layout_version_id, display_code, kind, axis,
    x, y, total_length, depth, rotation_deg, state
  )
  values (rack_uuid, layout_uuid, 'R1', 'single', 'NS', 0, 0, 1000, 800, 0, 'published');

  insert into public.rack_faces (
    id, rack_id, side, enabled, slot_numbering_direction,
    is_mirrored, mirror_source_face_id, face_length
  )
  values (rack_face_uuid, rack_uuid, 'A', true, 'ltr', false, null, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values (rack_section_uuid, rack_face_uuid, 1, 1000);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values (rack_level_uuid, rack_section_uuid, 1, 4);

  insert into public.cells (
    id, layout_version_id, rack_id, rack_face_id,
    rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code
  )
  values
    (cell_a_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'sec-cell-a'),
    (cell_b_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'sec-cell-b'),
    (cell_c_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     3, 'R1-A.01.01.03', 'R1-A-01-01-03', 'sec-cell-c'),
    (cell_d_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     4, 'R1-A.01.01.04', 'R1-A-01-01-04', 'sec-cell-d');

  perform public.backfill_locations_from_published_cells();

  select id into location_a_uuid from public.locations where geometry_slot_id = cell_a_uuid;
  select id into location_b_uuid from public.locations where geometry_slot_id = cell_b_uuid;
  select id into location_c_uuid from public.locations where geometry_slot_id = cell_c_uuid;
  select id into location_d_uuid from public.locations where geometry_slot_id = cell_d_uuid;

  -- Non-rack staging location for canonical remove test
  insert into public.locations (
    id, tenant_id, floor_id, code, location_type,
    geometry_slot_id, capacity_mode, status
  )
  values (
    staging_loc_uuid, default_tenant_uuid, floor_uuid,
    'SEC-STAGE-01', 'staging', null, 'multi_container', 'active'
  );

  -- default_tenant containers
  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SEC-SRC', pallet_type_uuid, 'active')
  returning id into src_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SEC-TGT', pallet_type_uuid, 'active')
  returning id into tgt_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SEC-SPOOF', pallet_type_uuid, 'active')
  returning id into spoof_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SEC-REM', pallet_type_uuid, 'active')
  returning id into remove_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SEC-CR1', pallet_type_uuid, 'active')
  returning id into cr1_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SEC-NONRACK', pallet_type_uuid, 'active')
  returning id into nonrack_container_uuid;

  -- default_tenant inventory
  insert into public.products (id, source, external_product_id, sku, name)
  values (product_uuid, 'test-suite', 'sec-product-001', 'SKU-SEC-001', 'Security Test Product');

  insert into public.inventory_unit (
    tenant_id, container_id, product_id, quantity, uom, status
  )
  values (default_tenant_uuid, src_container_uuid, product_uuid, 20, 'pcs', 'available')
  returning id into src_iu_uuid;

  -- place_container is now SECURITY DEFINER (migration 0047): auth.uid() must
  -- return a valid tenant_admin UUID for can_manage_tenant() to pass.
  -- Set actor_a as the JWT subject before the fixture placements.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_a_uuid::text)::text,
    true
  );

  -- Place containers for tests that need a placed container.
  -- cell_a: src (LC-1 source), cell_b: spoof (SP-1 source),
  -- cell_c: remove (SP-3 source), cell_d: cr1 (CR-1 dedicated rack remove test)
  perform public.place_container(src_container_uuid,    cell_a_uuid, null);
  perform public.place_container(spoof_container_uuid,  cell_b_uuid, null);
  perform public.place_container(remove_container_uuid, cell_c_uuid, null);
  perform public.place_container(cr1_container_uuid,    cell_d_uuid, null);

  -- other_tenant: minimal non-rack fixtures
  insert into public.sites (id, tenant_id, code, name, timezone)
  values (oth_site_uuid, other_tenant_uuid, 'SEC-OTH', 'Security Test Other Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (oth_floor_uuid, oth_site_uuid, 'F1', 'Other Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type,
    geometry_slot_id, capacity_mode, status
  )
  values (
    oth_loc_uuid, other_tenant_uuid, oth_floor_uuid,
    'OTH-LOC-01', 'staging', null, 'multi_container', 'active'
  );

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (other_tenant_uuid, 'SEC-OTH-CONT', pallet_type_uuid, 'active')
  returning id into oth_container_uuid;

  -- Place oth_container directly (no place_container — non-rack has no cell)
  update public.containers
  set current_location_id         = oth_loc_uuid,
      current_location_entered_at = now()
  where id = oth_container_uuid;

  -- Place nonrack_container directly in the staging location
  -- (bypasses place_container so no container_placements row is created)
  update public.containers
  set current_location_id         = staging_loc_uuid,
      current_location_entered_at = now()
  where id = nonrack_container_uuid;


  -- ══════════════════════════════════════════════════════════════════════
  -- LC-1  Legitimate move — actor_a moves own container
  -- ══════════════════════════════════════════════════════════════════════

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_a_uuid::text)::text,
    true
  );

  -- staging_loc_uuid is multi_container and empty — no rack cell conflicts.
  result := public.move_container_canonical(src_container_uuid, staging_loc_uuid, null);

  if result ->> 'targetLocationId' <> staging_loc_uuid::text then
    raise exception 'LC-1 FAIL: move_container_canonical did not return target location id.';
  end if;

  if not exists (
    select 1 from public.stock_movements
    where id = (result ->> 'movementId')::uuid
      and movement_type = 'move_container'
      and target_location_id = staging_loc_uuid
  ) then
    raise exception 'LC-1 FAIL: expected stock_movement row for canonical move.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════
  -- LC-2  Legitimate split — actor_a splits own IU into own container
  -- ══════════════════════════════════════════════════════════════════════

  result := public.split_inventory_unit(src_iu_uuid, 3, tgt_container_uuid, null);

  if (result ->> 'sourceQuantity')::numeric <> 17 then
    raise exception 'LC-2 FAIL: expected source quantity 17 after split of 3 from 20.';
  end if;

  if not exists (
    select 1 from public.stock_movements
    where id = (result ->> 'movementId')::uuid
      and movement_type = 'split_stock'
  ) then
    raise exception 'LC-2 FAIL: expected split_stock movement.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════
  -- TS-1  Timestamp reuse — transfer_inventory_unit carries split timestamp
  -- ══════════════════════════════════════════════════════════════════════

  -- Reset src_iu to 20 for a clean transfer test
  update public.inventory_unit set quantity = 20 where id = src_iu_uuid;
  -- Clear tgt_container of any IU rows that would merge.
  -- Must remove referencing stock_movements first (ON DELETE RESTRICT FK).
  delete from public.stock_movements
  where target_inventory_unit_id in (
    select id from public.inventory_unit where container_id = tgt_container_uuid
  )
     or source_inventory_unit_id in (
    select id from public.inventory_unit where container_id = tgt_container_uuid
  );
  delete from public.inventory_unit where container_id = tgt_container_uuid;

  result := public.transfer_inventory_unit(src_iu_uuid, 2, tgt_container_uuid, null);

  split_movement_id    := (result ->> 'splitMovementId')::uuid;
  transfer_movement_id := (result ->> 'transferMovementId')::uuid;

  select sm.created_at into split_created_at
  from public.stock_movements sm
  where sm.id = split_movement_id;

  select sm.created_at into transfer_created_at
  from public.stock_movements sm
  where sm.id = transfer_movement_id;

  if split_created_at is distinct from transfer_created_at then
    raise exception
      'TS-1 FAIL: split and transfer movements have different created_at. '
      'split=% transfer=%', split_created_at, transfer_created_at;
  end if;


  -- ══════════════════════════════════════════════════════════════════════
  -- TS-2  Timestamp reuse — pick_partial_inventory_unit carries split timestamp
  -- ══════════════════════════════════════════════════════════════════════

  update public.inventory_unit set quantity = 20 where id = src_iu_uuid;
  -- Must remove referencing stock_movements first (ON DELETE RESTRICT FK).
  delete from public.stock_movements
  where target_inventory_unit_id in (
    select id from public.inventory_unit where container_id = tgt_container_uuid
  )
     or source_inventory_unit_id in (
    select id from public.inventory_unit where container_id = tgt_container_uuid
  );
  delete from public.inventory_unit where container_id = tgt_container_uuid;

  result := public.pick_partial_inventory_unit(src_iu_uuid, 2, tgt_container_uuid, null);

  split_movement_id := (result ->> 'splitMovementId')::uuid;
  pick_movement_id  := (result ->> 'transferMovementId')::uuid;

  select sm.created_at into split_created_at
  from public.stock_movements sm where sm.id = split_movement_id;

  select sm.created_at into transfer_created_at
  from public.stock_movements sm where sm.id = pick_movement_id;

  if split_created_at is distinct from transfer_created_at then
    raise exception
      'TS-2 FAIL: split and pick movements have different created_at. '
      'split=% pick=%', split_created_at, transfer_created_at;
  end if;


  -- ══════════════════════════════════════════════════════════════════════
  -- SP-1  Actor spoof — move_container_canonical ignores caller actor_uuid
  -- ══════════════════════════════════════════════════════════════════════

  -- Move spoof_container; pass actor_spoof_uuid as parameter.
  -- JWT is still actor_a. Function must record actor_a, not actor_spoof.
  -- Use staging_loc_uuid (multi_container): all rack cells are already occupied.
  result := public.move_container_canonical(
    spoof_container_uuid, staging_loc_uuid, actor_spoof_uuid
  );

  select sm.created_by into recorded_created_by
  from public.stock_movements sm
  where sm.id = (result ->> 'movementId')::uuid;

  if recorded_created_by is distinct from actor_a_uuid then
    raise exception
      'SP-1 FAIL: stock_movement.created_by = % but expected actor_a = %.',
      recorded_created_by, actor_a_uuid;
  end if;

  if recorded_created_by = actor_spoof_uuid then
    raise exception
      'SP-1 FAIL: actor_uuid spoof succeeded — stock_movement.created_by = spoofed UUID.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════
  -- SP-2  Actor spoof — split_inventory_unit ignores caller actor_uuid
  -- ══════════════════════════════════════════════════════════════════════

  update public.inventory_unit set quantity = 20 where id = src_iu_uuid;
  -- Must remove referencing stock_movements first (ON DELETE RESTRICT FK).
  delete from public.stock_movements
  where target_inventory_unit_id in (
    select id from public.inventory_unit where container_id = tgt_container_uuid
  )
     or source_inventory_unit_id in (
    select id from public.inventory_unit where container_id = tgt_container_uuid
  );
  delete from public.inventory_unit where container_id = tgt_container_uuid;

  result := public.split_inventory_unit(src_iu_uuid, 1, tgt_container_uuid, actor_spoof_uuid);

  -- Check source IU updated_by
  select iu.updated_by into recorded_created_by
  from public.inventory_unit iu
  where iu.id = src_iu_uuid;

  if recorded_created_by is distinct from actor_a_uuid then
    raise exception
      'SP-2 FAIL: inventory_unit.updated_by = % but expected actor_a = %.',
      recorded_created_by, actor_a_uuid;
  end if;

  -- Check stock_movement created_by
  select sm.created_by into recorded_created_by
  from public.stock_movements sm
  where sm.id = (result ->> 'movementId')::uuid;

  if recorded_created_by is distinct from actor_a_uuid then
    raise exception
      'SP-2 FAIL: stock_movement.created_by = % but expected actor_a = %.',
      recorded_created_by, actor_a_uuid;
  end if;


  -- ══════════════════════════════════════════════════════════════════════
  -- SP-3  Actor spoof — remove_container ignores caller actor_uuid
  -- ══════════════════════════════════════════════════════════════════════

  result := public.remove_container(remove_container_uuid, actor_spoof_uuid);

  select c.updated_by into recorded_created_by
  from public.containers c
  where c.id = remove_container_uuid;

  if recorded_created_by is distinct from actor_a_uuid then
    raise exception
      'SP-3 FAIL: containers.updated_by = % but expected actor_a = %.',
      recorded_created_by, actor_a_uuid;
  end if;


  -- ══════════════════════════════════════════════════════════════════════
  -- CT-1  Cross-tenant container UUID to move_container_canonical
  --       actor_b tries to move a default_tenant container
  -- ══════════════════════════════════════════════════════════════════════

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_b_uuid::text)::text,
    true
  );

  begin
    perform public.move_container_canonical(src_container_uuid, oth_loc_uuid, null);
    raise exception 'CT-1 FAIL: expected CONTAINER_NOT_FOUND but call succeeded.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_FOUND' then
        raise exception 'CT-1 FAIL: expected CONTAINER_NOT_FOUND, got: %', sqlerrm;
      end if;
  end;


  -- ══════════════════════════════════════════════════════════════════════
  -- CT-2  Cross-tenant source IU UUID to split_inventory_unit
  --       actor_b tries to split a default_tenant inventory unit
  -- ══════════════════════════════════════════════════════════════════════

  begin
    perform public.split_inventory_unit(src_iu_uuid, 1, oth_container_uuid, null);
    raise exception 'CT-2 FAIL: expected SOURCE_INVENTORY_UNIT_NOT_FOUND but call succeeded.';
  exception
    when others then
      if sqlerrm <> 'SOURCE_INVENTORY_UNIT_NOT_FOUND' then
        raise exception 'CT-2 FAIL: expected SOURCE_INVENTORY_UNIT_NOT_FOUND, got: %', sqlerrm;
      end if;
  end;


  -- ══════════════════════════════════════════════════════════════════════
  -- CT-3  Own-tenant source IU + cross-tenant target container
  --       actor_a (default_tenant) splits own IU into other_tenant container
  --       Must return TARGET_CONTAINER_NOT_FOUND, not TARGET_CONTAINER_TENANT_MISMATCH
  -- ══════════════════════════════════════════════════════════════════════

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_a_uuid::text)::text,
    true
  );

  update public.inventory_unit set quantity = 20 where id = src_iu_uuid;

  begin
    perform public.split_inventory_unit(src_iu_uuid, 1, oth_container_uuid, null);
    raise exception 'CT-3 FAIL: expected TARGET_CONTAINER_NOT_FOUND but call succeeded.';
  exception
    when others then
      if sqlerrm <> 'TARGET_CONTAINER_NOT_FOUND' then
        raise exception
          'CT-3 FAIL: expected TARGET_CONTAINER_NOT_FOUND (oracle masking), got: %', sqlerrm;
      end if;
  end;


  -- ══════════════════════════════════════════════════════════════════════
  -- CT-4  Own-tenant placed container + cross-tenant target location
  --       actor_a moves own container to other_tenant's location
  --       Must return TARGET_LOCATION_NOT_FOUND, not TENANT_MISMATCH
  -- ══════════════════════════════════════════════════════════════════════

  begin
    perform public.move_container_canonical(src_container_uuid, oth_loc_uuid, null);
    raise exception 'CT-4 FAIL: expected TARGET_LOCATION_NOT_FOUND but call succeeded.';
  exception
    when others then
      if sqlerrm <> 'TARGET_LOCATION_NOT_FOUND' then
        raise exception
          'CT-4 FAIL: expected TARGET_LOCATION_NOT_FOUND (oracle masking), got: %', sqlerrm;
      end if;
  end;


  -- ══════════════════════════════════════════════════════════════════════
  -- CT-5  Cross-tenant container UUID to remove_container
  --       actor_b tries to remove a default_tenant container
  -- ══════════════════════════════════════════════════════════════════════

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_b_uuid::text)::text,
    true
  );

  begin
    perform public.remove_container(src_container_uuid, null);
    raise exception 'CT-5 FAIL: expected CONTAINER_NOT_FOUND but call succeeded.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_FOUND' then
        raise exception 'CT-5 FAIL: expected CONTAINER_NOT_FOUND, got: %', sqlerrm;
      end if;
  end;


  -- ══════════════════════════════════════════════════════════════════════
  -- NF-1  Not-found vs unauthorized are indistinguishable
  --       Both a non-existent UUID and a cross-tenant UUID return the same
  --       error string from move_container_canonical.
  -- ══════════════════════════════════════════════════════════════════════

  declare
    err_nonexistent text;
    err_cross_tenant text;
  begin
    begin
      perform public.move_container_canonical(gen_random_uuid(), location_a_uuid, null);
    exception
      when others then err_nonexistent := sqlerrm;
    end;

    begin
      perform public.move_container_canonical(src_container_uuid, location_a_uuid, null);
    exception
      when others then err_cross_tenant := sqlerrm;
    end;

    if err_nonexistent is distinct from err_cross_tenant then
      raise exception
        'NF-1 FAIL: non-existent UUID returned "%" but cross-tenant UUID returned "%". '
        'These must be identical to prevent UUID existence oracle.',
        err_nonexistent, err_cross_tenant;
    end if;

    if err_nonexistent <> 'CONTAINER_NOT_FOUND' then
      raise exception
        'NF-1 FAIL: expected CONTAINER_NOT_FOUND for both cases, got: %', err_nonexistent;
    end if;
  end;


  -- ══════════════════════════════════════════════════════════════════════
  -- DH-1  Direct call to insert_stock_movement as authenticated → denied
  -- DH-2  Direct call to sync_container_placement_projection as authenticated → denied
  --
  -- SET LOCAL ROLE switches the effective role within this transaction.
  -- Subsequent PERFORM statements execute with authenticated's privileges.
  -- RESET ROLE restores postgres for the rest of the test.
  -- ══════════════════════════════════════════════════════════════════════

  -- actor_a JWT is still set from CT-3 restore above; actor doesn't matter
  -- for EXECUTE permission checks — what matters is the PostgreSQL role.

  -- SET ROLE is a utility statement; EXECUTE is required inside PL/pgSQL.
  execute 'set local role authenticated';

  begin
    perform public.insert_stock_movement(
      default_tenant_uuid, 'move_container',
      null, null, null, null, null, null,
      null, null, 'done', now(), now(), null
    );
    raise exception 'DH-1 FAIL: expected permission denied for insert_stock_movement.';
  exception
    when insufficient_privilege then
      null; -- expected — test passes
    when others then
      raise exception 'DH-1 FAIL: expected insufficient_privilege, got: %', sqlerrm;
  end;

  begin
    perform public.sync_container_placement_projection(src_container_uuid, null);
    raise exception 'DH-2 FAIL: expected permission denied for sync_container_placement_projection.';
  exception
    when insufficient_privilege then
      null; -- expected — test passes
    when others then
      raise exception 'DH-2 FAIL: expected insufficient_privilege, got: %', sqlerrm;
  end;

  execute 'reset role';


  -- ══════════════════════════════════════════════════════════════════════
  -- CR-1  Canonical remove — rack-backed location
  --       The new remove_container derives placement from
  --       containers.current_location_id, closes container_placements row.
  -- ══════════════════════════════════════════════════════════════════════

  -- Restore actor_a JWT (reset role above cleared it for DH tests context)
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_a_uuid::text)::text,
    true
  );

  -- cr1_container_uuid was placed at cell_d during fixture setup and has not
  -- been touched since. It is rack-backed with an active container_placements row.
  result := public.remove_container(cr1_container_uuid, null);

  if result ->> 'action' <> 'removed' then
    raise exception 'CR-1 FAIL: expected action=removed, got: %', result ->> 'action';
  end if;

  if (result ->> 'cellId')::uuid is distinct from cell_d_uuid then
    raise exception
      'CR-1 FAIL: expected cellId=cell_d (geometry_slot_id of location_d), got: %',
      result ->> 'cellId';
  end if;

  if exists (
    select 1 from public.containers c
    where c.id = cr1_container_uuid
      and c.current_location_id is not null
  ) then
    raise exception 'CR-1 FAIL: containers.current_location_id was not cleared by remove_container.';
  end if;

  if not exists (
    select 1 from public.container_placements cp
    where cp.container_id = cr1_container_uuid
      and cp.removed_at is not null
  ) then
    raise exception 'CR-1 FAIL: container_placements row was not closed by remove_container.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════
  -- CR-2  Canonical remove — non-rack location (no container_placements row)
  --       containers.current_location_id is set, no container_placements row.
  --       remove_container must succeed and emit movement event.
  -- ══════════════════════════════════════════════════════════════════════

  if exists (
    select 1 from public.container_placements cp
    where cp.container_id = nonrack_container_uuid
      and cp.removed_at is null
  ) then
    raise exception
      'CR-2 setup FAIL: nonrack_container unexpectedly has an active placement row.';
  end if;

  result := public.remove_container(nonrack_container_uuid, null);

  if result ->> 'action' <> 'removed' then
    raise exception 'CR-2 FAIL: expected action=removed for non-rack container, got: %',
      result ->> 'action';
  end if;

  if result ->> 'cellId' is not null then
    raise exception
      'CR-2 FAIL: expected cellId=null for non-rack location, got: %', result ->> 'cellId';
  end if;

  if result ->> 'placementId' is not null then
    raise exception
      'CR-2 FAIL: expected placementId=null (no projection row existed), got: %',
      result ->> 'placementId';
  end if;

  if exists (
    select 1 from public.containers c
    where c.id = nonrack_container_uuid
      and c.current_location_id is not null
  ) then
    raise exception 'CR-2 FAIL: containers.current_location_id was not cleared.';
  end if;

  if not exists (
    select 1 from public.movement_events me
    where me.container_id = nonrack_container_uuid
      and me.event_type = 'removed'
      and me.from_cell_id is null
      and me.floor_id = floor_uuid
  ) then
    raise exception
      'CR-2 FAIL: expected movement_event with event_type=removed, from_cell_id=null, '
      'floor_id=floor_uuid for non-rack remove.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════
  -- CR-3  Canonical remove — CONTAINER_NOT_PLACED when current_location_id
  --       is null (even if a stale container_placements row existed)
  -- ══════════════════════════════════════════════════════════════════════

  -- nonrack_container was just removed. current_location_id is null.
  -- Verify that calling remove_container again raises CONTAINER_NOT_PLACED.
  begin
    perform public.remove_container(nonrack_container_uuid, null);
    raise exception 'CR-3 FAIL: expected CONTAINER_NOT_PLACED, call succeeded.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_PLACED' then
        raise exception 'CR-3 FAIL: expected CONTAINER_NOT_PLACED, got: %', sqlerrm;
      end if;
  end;

end
$$;

rollback;
