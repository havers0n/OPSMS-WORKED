begin;

do $$
declare
  default_tenant_uuid uuid;
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
  cell_a_uuid uuid := gen_random_uuid();
  cell_b_uuid uuid := gen_random_uuid();
  place_container_uuid uuid;
  place_result jsonb;
  remove_result jsonb;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  -- 0044: remove_container now has inline can_manage_tenant() gate.
  -- Set up a platform_admin test actor so auth.uid() resolves correctly.
  test_actor_uuid := gen_random_uuid();
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    test_actor_uuid, 'test-actor-act@wos.test', now(), now(), now(),
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

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'E1ACT', 'Epic 1 Actions', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'Action Floor', 1);

  insert into public.layout_versions (id, floor_id, version_no, state)
  values (layout_uuid, floor_uuid, 1, 'published');

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  values (rack_uuid, layout_uuid, 'R1', 'single', 'NS', 0, 0, 1000, 800, 0, 'published');

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
  values (rack_face_uuid, rack_uuid, 'A', true, 'ltr', false, null, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values (rack_section_uuid, rack_face_uuid, 1, 1000);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values (rack_level_uuid, rack_section_uuid, 1, 2);

  insert into public.cells (id, layout_version_id, rack_id, rack_face_id, rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code)
  values
    (cell_a_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'act-cell-001'),
    (cell_b_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'act-cell-002');

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'ACT-PLACE', pallet_type_uuid, 'active')
  returning id into place_container_uuid;

  place_result := public.place_container(place_container_uuid, cell_a_uuid, actor_uuid);

  if place_result ->> 'action' <> 'placed' then
    raise exception 'Expected place_container action=placed.';
  end if;

  if not exists (
    select 1
    from public.container_placements
    where container_id = place_container_uuid
      and cell_id = cell_a_uuid
      and removed_at is null
  ) then
    raise exception 'Expected place_container to create an active placement.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    join public.locations l on l.id = sm.target_location_id
    where sm.source_container_id = place_container_uuid
      and sm.target_container_id = place_container_uuid
      and sm.movement_type = 'place_container'
      and sm.source_location_id is null
      and l.geometry_slot_id = cell_a_uuid
      and sm.status = 'done'
  ) then
    raise exception 'Expected place_container to write a canonical place_container stock movement.';
  end if;

  begin
    perform public.place_container(place_container_uuid, cell_b_uuid, actor_uuid);
    raise exception 'Expected place_container to fail when container is already placed.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_ALREADY_PLACED' then
        raise;
      end if;
  end;

  remove_result := public.remove_container(place_container_uuid, actor_uuid);

  if remove_result ->> 'action' <> 'removed' then
    raise exception 'Expected remove_container action=removed.';
  end if;

  if not exists (
    select 1
    from public.container_placements
    where container_id = place_container_uuid
      and removed_at is not null
  ) then
    raise exception 'Expected remove_container to close placement history rather than delete it.';
  end if;

  if not exists (
    select 1
    from public.stock_movements sm
    join public.locations l on l.id = sm.source_location_id
    where sm.source_container_id = place_container_uuid
      and sm.target_container_id = place_container_uuid
      and sm.movement_type = 'remove_container'
      and l.geometry_slot_id = cell_a_uuid
      and sm.target_location_id is null
      and sm.status = 'done'
  ) then
    raise exception 'Expected remove_container to write a canonical remove_container stock movement.';
  end if;

  begin
    perform public.remove_container(place_container_uuid, actor_uuid);
    raise exception 'Expected remove_container to fail when container is not placed.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_PLACED' then
        raise;
      end if;
  end;

  -- move_container(uuid, uuid, uuid) and move_container_from_cell(uuid, uuid, uuid, uuid)
  -- were dropped in Stage 10 PR3 (migration 0052). The cell-based move test cases that
  -- previously appeared here have been removed along with the functions they tested.
  -- Canonical replacement for container moves: move_container_canonical(container_uuid,
  -- location_uuid, actor_uuid) — covered by apps/supabase/tests/sql/0044_security_hardening.test.sql.
end
$$;

rollback;
