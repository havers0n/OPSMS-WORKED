-- 0045_place_container_location_enforcement.test.sql
--
-- Verifies that place_container() enforces canonical location constraints.
--
-- OC-1  Empty published cell         → success (regression)
-- OC-2  Occupied single_container    → LOCATION_OCCUPIED, no side effects
-- OC-3  Disabled location            → LOCATION_NOT_ACTIVE, no side effects
--
-- The sync_published_cell_to_location trigger (migration 0037/0038) creates
-- location rows automatically when cells are inserted into a published layout,
-- so backfill_locations_from_published_cells() is not needed here.

begin;

do $$
declare
  default_tenant_uuid    uuid;
  pallet_type_uuid       uuid;
  test_actor_uuid        uuid;

  site_uuid              uuid := gen_random_uuid();
  floor_uuid             uuid := gen_random_uuid();
  layout_uuid            uuid := gen_random_uuid();
  rack_uuid              uuid := gen_random_uuid();
  rack_face_uuid         uuid := gen_random_uuid();
  rack_section_uuid      uuid := gen_random_uuid();
  rack_level_uuid        uuid := gen_random_uuid();

  cell_a_uuid            uuid := gen_random_uuid();   -- occupied test
  cell_b_uuid            uuid := gen_random_uuid();   -- disabled test

  location_a_uuid        uuid;
  location_b_uuid        uuid;

  container_a_uuid       uuid;   -- occupies cell_a
  container_b_uuid       uuid;   -- blocked: LOCATION_OCCUPIED
  container_c_uuid       uuid;   -- blocked: LOCATION_NOT_ACTIVE

  result                 jsonb;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  -- ── Published rack with two cells ─────────────────────────────────────────

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'OC45-SITE', 'OC45 Test Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'OC45 Floor', 1);

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
     1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'oc45-cell-a'),
    (cell_b_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid,
     2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'oc45-cell-b');

  select id into location_a_uuid from public.locations where geometry_slot_id = cell_a_uuid;
  select id into location_b_uuid from public.locations where geometry_slot_id = cell_b_uuid;

  if location_a_uuid is null or location_b_uuid is null then
    raise exception
      'OC45 setup FAIL: sync_published_cell_to_location trigger did not create location rows.';
  end if;

  -- ── Containers ────────────────────────────────────────────────────────────

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'OC45-A', pallet_type_uuid, 'active')
  returning id into container_a_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'OC45-B', pallet_type_uuid, 'active')
  returning id into container_b_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'OC45-C', pallet_type_uuid, 'active')
  returning id into container_c_uuid;

  -- ── Auth setup ─────────────────────────────────────────────────────────────
  -- place_container is SECURITY DEFINER (migration 0047): auth.uid() must
  -- return a valid tenant_admin UUID for can_manage_tenant() to pass.
  test_actor_uuid := gen_random_uuid();
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    test_actor_uuid, 'test-45-actor@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );
  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, test_actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', test_actor_uuid::text)::text,
    true
  );

  -- ══════════════════════════════════════════════════════════════════════════
  -- OC-1  Empty published cell → success (regression)
  -- ══════════════════════════════════════════════════════════════════════════

  result := public.place_container(container_a_uuid, cell_a_uuid, null);

  if result ->> 'action' <> 'placed' then
    raise exception 'OC-1 FAIL: expected action=placed, got: %', result ->> 'action';
  end if;

  if not exists (
    select 1 from public.container_placements
    where container_id = container_a_uuid
      and cell_id = cell_a_uuid
      and removed_at is null
  ) then
    raise exception 'OC-1 FAIL: expected active container_placements row after placement.';
  end if;

  if not exists (
    select 1 from public.containers
    where id = container_a_uuid
      and current_location_id = location_a_uuid
  ) then
    raise exception 'OC-1 FAIL: expected containers.current_location_id to point to location_a.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- OC-2  Occupied single_container cell → LOCATION_OCCUPIED, no side effects
  --       location_a has capacity_mode='single_container' (default from trigger).
  --       container_a is already there. container_b must be rejected.
  -- ══════════════════════════════════════════════════════════════════════════

  begin
    perform public.place_container(container_b_uuid, cell_a_uuid, null);
    raise exception 'OC-2 FAIL: expected LOCATION_OCCUPIED but placement succeeded.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_OCCUPIED' then
        raise exception 'OC-2 FAIL: expected LOCATION_OCCUPIED, got: %', sqlerrm;
      end if;
  end;

  -- No container_placements row must exist for container_b.
  if exists (
    select 1 from public.container_placements
    where container_id = container_b_uuid
  ) then
    raise exception 'OC-2 FAIL: failed placement wrote a container_placements row.';
  end if;

  -- containers.current_location_id must still be null for container_b.
  if exists (
    select 1 from public.containers
    where id = container_b_uuid
      and current_location_id is not null
  ) then
    raise exception 'OC-2 FAIL: failed placement mutated containers.current_location_id.';
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- OC-3  Disabled location → LOCATION_NOT_ACTIVE, no side effects
  --       Disable location_b directly (postgres superuser bypasses RLS).
  --       container_c must be rejected before any row is written.
  -- ══════════════════════════════════════════════════════════════════════════

  update public.locations
  set status = 'disabled'
  where id = location_b_uuid;

  begin
    perform public.place_container(container_c_uuid, cell_b_uuid, null);
    raise exception 'OC-3 FAIL: expected LOCATION_NOT_ACTIVE but placement succeeded.';
  exception
    when others then
      if sqlerrm <> 'LOCATION_NOT_ACTIVE' then
        raise exception 'OC-3 FAIL: expected LOCATION_NOT_ACTIVE, got: %', sqlerrm;
      end if;
  end;

  if exists (
    select 1 from public.container_placements
    where container_id = container_c_uuid
  ) then
    raise exception 'OC-3 FAIL: failed placement wrote a container_placements row.';
  end if;

  if exists (
    select 1 from public.containers
    where id = container_c_uuid
      and current_location_id is not null
  ) then
    raise exception 'OC-3 FAIL: failed placement mutated containers.current_location_id.';
  end if;

end
$$;

rollback;
