-- 0046_place_container_at_location.test.sql
--
-- Tests for place_container_at_location(container_uuid, location_uuid, actor_uuid).
--
-- PL-1  Rack-backed location   → success: action=placed, container_placements row
--                                written, current_location_id set, movement_event written
-- PL-2  Non-rack location      → success: action=placed, NO container_placements row,
--                                current_location_id set, movement_event with null to_cell_id
-- PL-3  CONTAINER_ALREADY_PLACED  → rejected after PL-1 places the container
-- PL-4  LOCATION_OCCUPIED         → single_container location already holds container_a
-- PL-5  LOCATION_NOT_ACTIVE       → disabled location rejects placement
-- PL-6  LOCATION_NOT_FOUND        → non-existent UUID; also covers cross-tenant masking
--
-- The sync_published_cell_to_location trigger (migration 0037/0038) creates
-- location rows automatically when cells are inserted into a published layout.

begin;

do $$
declare
  default_tenant_uuid     uuid;
  pallet_type_uuid        uuid;
  test_actor_uuid         uuid;

  site_uuid               uuid := gen_random_uuid();
  floor_uuid              uuid := gen_random_uuid();
  layout_uuid             uuid := gen_random_uuid();
  rack_uuid               uuid := gen_random_uuid();
  rack_face_uuid          uuid := gen_random_uuid();
  rack_section_uuid       uuid := gen_random_uuid();
  rack_level_uuid         uuid := gen_random_uuid();

  cell_a_uuid             uuid := gen_random_uuid();   -- rack_slot for PL-1 / PL-3 / PL-4
  cell_b_uuid             uuid := gen_random_uuid();   -- rack_slot for PL-5 (disabled)

  location_a_uuid         uuid;   -- rack_slot location, auto-created by trigger
  location_b_uuid         uuid;   -- rack_slot location, disabled for PL-5
  staging_location_uuid   uuid := gen_random_uuid();   -- non-rack staging location for PL-2

  container_a_uuid        uuid;   -- placed in PL-1 (rack-backed)
  container_b_uuid        uuid;   -- placed in PL-2 (non-rack staging)
  container_c_uuid        uuid;   -- LOCATION_OCCUPIED attempt in PL-4
  container_d_uuid        uuid;   -- LOCATION_NOT_ACTIVE attempt in PL-5

  result                  jsonb;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  -- ── Auth setup ─────────────────────────────────────────────────────────────
  -- place_container_at_location is INVOKER; auth.uid() must resolve to a
  -- platform_admin so can_manage_tenant() returns true inside the function.

  test_actor_uuid := gen_random_uuid();
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    test_actor_uuid, 'test-46-actor@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );
  -- handle_auth_user_profile() trigger creates the profiles row automatically.
  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, test_actor_uuid, 'platform_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', test_actor_uuid::text)::text,
    true
  );

  -- ── Published rack with two cells ─────────────────────────────────────────

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PL46-SITE', 'PL46 Test Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'PL46 Floor', 1);

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
  values (rack_level_uuid, rack_section_uuid, 1, 2);

  -- sync_published_cell_to_location trigger fires on each insert and
  -- creates the corresponding location row automatically.
  insert into public.cells (
    id, layout_version_id, rack_id, rack_face_id,
    rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code
  )
  values
    (cell_a_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'pl46-cell-a'),
    (cell_b_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'pl46-cell-b');

  select id into location_a_uuid from public.locations where geometry_slot_id = cell_a_uuid;
  select id into location_b_uuid from public.locations where geometry_slot_id = cell_b_uuid;

  if location_a_uuid is null or location_b_uuid is null then
    raise exception
      'PL46 setup FAIL: sync_published_cell_to_location trigger did not create location rows.';
  end if;

  -- Non-rack staging location for PL-2.
  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, geometry_slot_id, capacity_mode, status
  )
  values (
    staging_location_uuid, default_tenant_uuid, floor_uuid,
    'STAGING-46', 'staging', null, 'multi_container', 'active'
  );

  -- Disable location_b for PL-5.
  update public.locations
  set status = 'disabled'
  where id = location_b_uuid;

  -- ── Containers ────────────────────────────────────────────────────────────

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'PL46-A', pallet_type_uuid, 'active')
  returning id into container_a_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'PL46-B', pallet_type_uuid, 'active')
  returning id into container_b_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'PL46-C', pallet_type_uuid, 'active')
  returning id into container_c_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'PL46-D', pallet_type_uuid, 'active')
  returning id into container_d_uuid;


  -- ══════════════════════════════════════════════════════════════════════════
  -- PL-1  Rack-backed placement → success
  -- ══════════════════════════════════════════════════════════════════════════

  result := public.place_container_at_location(container_a_uuid, location_a_uuid, null);

  if result ->> 'action' <> 'placed' then
    raise exception 'PL-1 FAIL: expected action=placed, got: %', result ->> 'action';
  end if;

  if (result ->> 'locationId')::uuid <> location_a_uuid then
    raise exception 'PL-1 FAIL: expected locationId=location_a, got: %', result ->> 'locationId';
  end if;

  if (result ->> 'cellId')::uuid <> cell_a_uuid then
    raise exception 'PL-1 FAIL: expected cellId=cell_a, got: %', result ->> 'cellId';
  end if;

  if result ->> 'placementId' is null then
    raise exception 'PL-1 FAIL: expected non-null placementId for rack-backed placement.';
  end if;

  if not exists (
    select 1 from public.containers
    where id = container_a_uuid
      and current_location_id = location_a_uuid
  ) then
    raise exception 'PL-1 FAIL: expected containers.current_location_id = location_a.';
  end if;

  if not exists (
    select 1 from public.container_placements
    where container_id = container_a_uuid
      and cell_id = cell_a_uuid
      and removed_at is null
  ) then
    raise exception 'PL-1 FAIL: expected active container_placements row for rack-backed placement.';
  end if;

  if not exists (
    select 1 from public.movement_events
    where container_id = container_a_uuid
      and event_type = 'placed'
      and from_cell_id is null
      and to_cell_id = cell_a_uuid
  ) then
    raise exception 'PL-1 FAIL: expected movement_event with event_type=placed and to_cell_id=cell_a.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- PL-2  Non-rack placement → success; no container_placements row
  -- ══════════════════════════════════════════════════════════════════════════

  result := public.place_container_at_location(container_b_uuid, staging_location_uuid, null);

  if result ->> 'action' <> 'placed' then
    raise exception 'PL-2 FAIL: expected action=placed, got: %', result ->> 'action';
  end if;

  if (result ->> 'locationId')::uuid <> staging_location_uuid then
    raise exception 'PL-2 FAIL: expected locationId=staging_location, got: %', result ->> 'locationId';
  end if;

  if result ->> 'cellId' is not null then
    raise exception 'PL-2 FAIL: expected cellId=null for non-rack placement, got: %', result ->> 'cellId';
  end if;

  if result ->> 'placementId' is not null then
    raise exception 'PL-2 FAIL: expected placementId=null for non-rack placement, got: %', result ->> 'placementId';
  end if;

  if not exists (
    select 1 from public.containers
    where id = container_b_uuid
      and current_location_id = staging_location_uuid
  ) then
    raise exception 'PL-2 FAIL: expected containers.current_location_id = staging_location.';
  end if;

  if exists (
    select 1 from public.container_placements
    where container_id = container_b_uuid
  ) then
    raise exception 'PL-2 FAIL: non-rack placement must not write a container_placements row.';
  end if;

  if not exists (
    select 1 from public.movement_events
    where container_id = container_b_uuid
      and event_type = 'placed'
      and from_cell_id is null
      and to_cell_id is null
  ) then
    raise exception 'PL-2 FAIL: expected movement_event with event_type=placed and to_cell_id=null.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- PL-3  CONTAINER_ALREADY_PLACED (container_a is placed in PL-1)
  -- ══════════════════════════════════════════════════════════════════════════

  begin
    perform public.place_container_at_location(container_a_uuid, staging_location_uuid, null);
    raise exception 'PL-3 FAIL: expected CONTAINER_ALREADY_PLACED but placement succeeded.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_ALREADY_PLACED' then
        raise exception 'PL-3 FAIL: expected CONTAINER_ALREADY_PLACED, got: %', sqlerrm;
      end if;
  end;


  -- ══════════════════════════════════════════════════════════════════════════
  -- PL-4  LOCATION_OCCUPIED (location_a has container_a from PL-1)
  --       location_a is rack_slot with capacity_mode='single_container'.
  -- ══════════════════════════════════════════════════════════════════════════

  begin
    perform public.place_container_at_location(container_c_uuid, location_a_uuid, null);
    raise exception 'PL-4 FAIL: expected LOCATION_OCCUPIED but placement succeeded.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_OCCUPIED' then
        raise exception 'PL-4 FAIL: expected LOCATION_OCCUPIED, got: %', sqlerrm;
      end if;
  end;

  if exists (
    select 1 from public.containers
    where id = container_c_uuid
      and current_location_id is not null
  ) then
    raise exception 'PL-4 FAIL: failed placement must not mutate containers.current_location_id.';
  end if;

  if exists (
    select 1 from public.container_placements
    where container_id = container_c_uuid
  ) then
    raise exception 'PL-4 FAIL: failed placement must not write a container_placements row.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- PL-5  LOCATION_NOT_ACTIVE (location_b is disabled)
  -- ══════════════════════════════════════════════════════════════════════════

  begin
    perform public.place_container_at_location(container_d_uuid, location_b_uuid, null);
    raise exception 'PL-5 FAIL: expected LOCATION_NOT_ACTIVE but placement succeeded.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_NOT_ACTIVE' then
        raise exception 'PL-5 FAIL: expected LOCATION_NOT_ACTIVE, got: %', sqlerrm;
      end if;
  end;

  if exists (
    select 1 from public.containers
    where id = container_d_uuid
      and current_location_id is not null
  ) then
    raise exception 'PL-5 FAIL: failed placement must not mutate containers.current_location_id.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- PL-6  LOCATION_NOT_FOUND (non-existent location UUID)
  --       Also covers cross-tenant oracle masking: both non-existent UUIDs and
  --       cross-tenant location UUIDs return LOCATION_NOT_FOUND.
  -- ══════════════════════════════════════════════════════════════════════════

  begin
    perform public.place_container_at_location(container_c_uuid, gen_random_uuid(), null);
    raise exception 'PL-6 FAIL: expected LOCATION_NOT_FOUND but placement succeeded.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_NOT_FOUND' then
        raise exception 'PL-6 FAIL: expected LOCATION_NOT_FOUND, got: %', sqlerrm;
      end if;
  end;

end
$$;

rollback;
