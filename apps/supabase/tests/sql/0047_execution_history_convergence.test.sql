-- 0047_execution_history_convergence.test.sql
--
-- Verifies that place_container, place_container_at_location, and
-- remove_container now write canonical stock_movements records, enabling
-- the full container lifecycle to be read from a single history table.
--
-- EH-1  place_container (rack-backed)
--         → stock_movements row: movement_type='place_container',
--           source_location=null, target_location=location_a
--         → movement_events compat row still written (dual-write)
--
-- EH-2  place_container_at_location (rack-backed)
--         → stock_movements row: movement_type='place_container',
--           source_location=null, target_location=location_b
--
-- EH-3  place_container_at_location (non-rack staging)
--         → stock_movements row: movement_type='place_container',
--           source_location=null, target_location=staging_location
--
-- EH-4  remove_container (removes the container placed in EH-1)
--         → stock_movements row: movement_type='remove_container',
--           source_location=location_a, target_location=null
--         → movement_events compat row still written (dual-write)
--
-- EH-5  Full lifecycle readable from stock_movements alone
--         place_container → move_container_canonical → remove_container
--         Yields three consecutive stock_movements rows for the container.

begin;

do $$
declare
  default_tenant_uuid   uuid;
  pallet_type_uuid      uuid;
  test_actor_uuid       uuid;

  site_uuid             uuid := gen_random_uuid();
  floor_uuid            uuid := gen_random_uuid();
  layout_uuid           uuid := gen_random_uuid();
  rack_uuid             uuid := gen_random_uuid();
  rack_face_uuid        uuid := gen_random_uuid();
  rack_section_uuid     uuid := gen_random_uuid();
  rack_level_uuid       uuid := gen_random_uuid();

  cell_a_uuid           uuid := gen_random_uuid();   -- EH-1 + EH-4
  cell_b_uuid           uuid := gen_random_uuid();   -- EH-2
  cell_c_uuid           uuid := gen_random_uuid();   -- EH-5 start
  cell_d_uuid           uuid := gen_random_uuid();   -- EH-5 move target

  location_a_uuid       uuid;
  location_b_uuid       uuid;
  location_c_uuid       uuid;
  location_d_uuid       uuid;
  staging_location_uuid uuid := gen_random_uuid();

  container_a_uuid      uuid;   -- EH-1 + EH-4
  container_b_uuid      uuid;   -- EH-2
  container_c_uuid      uuid;   -- EH-3
  container_lc_uuid     uuid;   -- EH-5 lifecycle

  result                jsonb;
  sm_count              int;
  ts_place              timestamptz;
  ts_move               timestamptz;
  ts_remove             timestamptz;
begin
  select id into default_tenant_uuid from public.tenants where code = 'default';
  select id into pallet_type_uuid    from public.container_types where code = 'pallet';

  -- ── Auth setup ─────────────────────────────────────────────────────────────
  test_actor_uuid := gen_random_uuid();
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    test_actor_uuid, 'test-47-actor@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );
  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, test_actor_uuid, 'platform_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', test_actor_uuid::text)::text,
    true
  );

  -- ── Published rack with four cells ────────────────────────────────────────
  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'EH47-SITE', 'EH47 Test Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'EH47 Floor', 1);

  insert into public.layout_versions (id, floor_id, version_no, state)
  values (layout_uuid, floor_uuid, 1, 'published');

  insert into public.racks (
    id, layout_version_id, display_code, kind, axis,
    x, y, total_length, depth, rotation_deg, state
  )
  values (rack_uuid, layout_uuid, 'R1', 'single', 'NS', 0, 0, 2000, 800, 0, 'published');

  insert into public.rack_faces (
    id, rack_id, side, enabled, slot_numbering_direction,
    is_mirrored, mirror_source_face_id, face_length
  )
  values (rack_face_uuid, rack_uuid, 'A', true, 'ltr', false, null, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values (rack_section_uuid, rack_face_uuid, 1, 2000);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values (rack_level_uuid, rack_section_uuid, 1, 4);

  -- sync_published_cell_to_location trigger creates location rows automatically.
  insert into public.cells (
    id, layout_version_id, rack_id, rack_face_id,
    rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code
  )
  values
    (cell_a_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'eh47-cell-a'),
    (cell_b_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'eh47-cell-b'),
    (cell_c_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     3, 'R1-A.01.01.03', 'R1-A-01-01-03', 'eh47-cell-c'),
    (cell_d_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     4, 'R1-A.01.01.04', 'R1-A-01-01-04', 'eh47-cell-d');

  select id into location_a_uuid from public.locations where geometry_slot_id = cell_a_uuid;
  select id into location_b_uuid from public.locations where geometry_slot_id = cell_b_uuid;
  select id into location_c_uuid from public.locations where geometry_slot_id = cell_c_uuid;
  select id into location_d_uuid from public.locations where geometry_slot_id = cell_d_uuid;

  if location_a_uuid is null or location_b_uuid is null
     or location_c_uuid is null or location_d_uuid is null then
    raise exception 'EH47 setup FAIL: trigger did not create location rows.';
  end if;

  -- Non-rack staging location for EH-3.
  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, geometry_slot_id, capacity_mode, status
  )
  values (
    staging_location_uuid, default_tenant_uuid, floor_uuid,
    'STAGING-47', 'staging', null, 'multi_container', 'active'
  );

  -- ── Containers ────────────────────────────────────────────────────────────
  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'EH47-A', pallet_type_uuid, 'active')
  returning id into container_a_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'EH47-B', pallet_type_uuid, 'active')
  returning id into container_b_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'EH47-C', pallet_type_uuid, 'active')
  returning id into container_c_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'EH47-LC', pallet_type_uuid, 'active')
  returning id into container_lc_uuid;


  -- ══════════════════════════════════════════════════════════════════════════
  -- EH-1  place_container writes stock_movements (canonical) + movement_events (compat)
  -- ══════════════════════════════════════════════════════════════════════════

  result := public.place_container(container_a_uuid, cell_a_uuid, null);

  if result ->> 'action' <> 'placed' then
    raise exception 'EH-1 FAIL: expected action=placed, got: %', result ->> 'action';
  end if;

  if not exists (
    select 1 from public.stock_movements
    where source_container_id = container_a_uuid
      and movement_type = 'place_container'
      and source_location_id is null
      and target_location_id = location_a_uuid
      and status = 'done'
  ) then
    raise exception 'EH-1 FAIL: expected stock_movements row with movement_type=place_container.';
  end if;

  -- Verify compat dual-write: movement_events still written.
  if not exists (
    select 1 from public.movement_events
    where container_id = container_a_uuid
      and event_type = 'placed'
      and from_cell_id is null
      and to_cell_id = cell_a_uuid
  ) then
    raise exception 'EH-1 FAIL: movement_events compat row missing after place_container.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- EH-2  place_container_at_location (rack-backed) writes stock_movements
  -- ══════════════════════════════════════════════════════════════════════════

  result := public.place_container_at_location(container_b_uuid, location_b_uuid, null);

  if result ->> 'action' <> 'placed' then
    raise exception 'EH-2 FAIL: expected action=placed, got: %', result ->> 'action';
  end if;

  if not exists (
    select 1 from public.stock_movements
    where source_container_id = container_b_uuid
      and movement_type = 'place_container'
      and source_location_id is null
      and target_location_id = location_b_uuid
      and status = 'done'
  ) then
    raise exception 'EH-2 FAIL: expected stock_movements row for rack-backed place_container_at_location.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- EH-3  place_container_at_location (non-rack) writes stock_movements
  -- ══════════════════════════════════════════════════════════════════════════

  result := public.place_container_at_location(container_c_uuid, staging_location_uuid, null);

  if result ->> 'action' <> 'placed' then
    raise exception 'EH-3 FAIL: expected action=placed, got: %', result ->> 'action';
  end if;

  if not exists (
    select 1 from public.stock_movements
    where source_container_id = container_c_uuid
      and movement_type = 'place_container'
      and source_location_id is null
      and target_location_id = staging_location_uuid
      and status = 'done'
  ) then
    raise exception 'EH-3 FAIL: expected stock_movements row for non-rack place_container_at_location.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- EH-4  remove_container writes stock_movements (canonical) + movement_events (compat)
  --       Uses container_a placed in EH-1.
  -- ══════════════════════════════════════════════════════════════════════════

  result := public.remove_container(container_a_uuid, null);

  if result ->> 'action' <> 'removed' then
    raise exception 'EH-4 FAIL: expected action=removed, got: %', result ->> 'action';
  end if;

  if not exists (
    select 1 from public.stock_movements
    where source_container_id = container_a_uuid
      and movement_type = 'remove_container'
      and source_location_id = location_a_uuid
      and target_location_id is null
      and status = 'done'
  ) then
    raise exception 'EH-4 FAIL: expected stock_movements row with movement_type=remove_container.';
  end if;

  -- Verify compat dual-write: movement_events still written.
  if not exists (
    select 1 from public.movement_events
    where container_id = container_a_uuid
      and event_type = 'removed'
      and from_cell_id = cell_a_uuid
      and to_cell_id is null
  ) then
    raise exception 'EH-4 FAIL: movement_events compat row missing after remove_container.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- EH-5  Full lifecycle from stock_movements alone
  --
  --   place_container(container_lc, cell_c)
  --     → stock_movements: place_container, source=null, target=location_c
  --
  --   move_container_canonical(container_lc, location_d)
  --     → stock_movements: move_container, source=location_c, target=location_d
  --
  --   remove_container(container_lc)
  --     → stock_movements: remove_container, source=location_d, target=null
  --
  -- All three rows must be readable from stock_movements for container_lc.
  -- ══════════════════════════════════════════════════════════════════════════

  perform public.place_container(container_lc_uuid, cell_c_uuid, null);

  perform public.move_container_canonical(container_lc_uuid, location_d_uuid, null);

  perform public.remove_container(container_lc_uuid, null);

  -- Verify exactly 3 stock_movements rows for the lifecycle container.
  select count(*)
  into sm_count
  from public.stock_movements
  where source_container_id = container_lc_uuid
     or target_container_id = container_lc_uuid;

  if sm_count <> 3 then
    raise exception 'EH-5 FAIL: expected 3 stock_movements rows for lifecycle container, got: %', sm_count;
  end if;

  -- Verify the place row.
  if not exists (
    select 1 from public.stock_movements
    where source_container_id = container_lc_uuid
      and movement_type = 'place_container'
      and source_location_id is null
      and target_location_id = location_c_uuid
  ) then
    raise exception 'EH-5 FAIL: place_container stock_movement missing for lifecycle container.';
  end if;

  -- Verify the move row.
  if not exists (
    select 1 from public.stock_movements
    where source_container_id = container_lc_uuid
      and movement_type = 'move_container'
      and source_location_id = location_c_uuid
      and target_location_id = location_d_uuid
  ) then
    raise exception 'EH-5 FAIL: move_container stock_movement missing for lifecycle container.';
  end if;

  -- Verify the remove row.
  if not exists (
    select 1 from public.stock_movements
    where source_container_id = container_lc_uuid
      and movement_type = 'remove_container'
      and source_location_id = location_d_uuid
      and target_location_id is null
  ) then
    raise exception 'EH-5 FAIL: remove_container stock_movement missing for lifecycle container.';
  end if;

  -- Verify ordering: place before move before remove.
  select created_at into ts_place
  from public.stock_movements
  where source_container_id = container_lc_uuid and movement_type = 'place_container';

  select created_at into ts_move
  from public.stock_movements
  where source_container_id = container_lc_uuid and movement_type = 'move_container';

  select created_at into ts_remove
  from public.stock_movements
  where source_container_id = container_lc_uuid and movement_type = 'remove_container';

  if ts_place > ts_remove or ts_move > ts_remove then
    raise exception 'EH-5 FAIL: stock_movements ordering inconsistent (place/move must precede remove).';
  end if;

end
$$;

rollback;
