begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid uuid;
  tote_type_uuid uuid;
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  layout_uuid uuid := gen_random_uuid();
  rack_uuid uuid := gen_random_uuid();
  rack_face_uuid uuid := gen_random_uuid();
  rack_section_uuid uuid := gen_random_uuid();
  rack_level_uuid uuid := gen_random_uuid();
  cell_uuid uuid := gen_random_uuid();
  second_cell_uuid uuid := gen_random_uuid();
  first_container_uuid uuid;
  second_container_uuid uuid;
  third_container_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  select id into tote_type_uuid
  from public.container_types
  where code = 'tote';

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'E1VIEW', 'Epic 1 View', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'View Floor', 1);

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
    (cell_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'view-cell-001'),
    (second_cell_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'view-cell-002');

  perform public.backfill_locations_from_published_cells();

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'PALLET-101', pallet_type_uuid, 'active')
  returning id into first_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, null, tote_type_uuid, 'quarantined')
  returning id into second_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'PALLET-OLD', pallet_type_uuid, 'active')
  returning id into third_container_uuid;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at)
  values
    (default_tenant_uuid, first_container_uuid, cell_uuid, '2026-03-13T10:00:00.000Z'),
    (default_tenant_uuid, second_container_uuid, cell_uuid, '2026-03-13T11:00:00.000Z');

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, removed_at)
  values (default_tenant_uuid, third_container_uuid, second_cell_uuid, '2026-03-13T09:00:00.000Z', '2026-03-13T09:30:00.000Z');

  perform public.backfill_container_current_locations();

  if (
    select count(*)
    from public.cell_occupancy_v
    where cell_id = cell_uuid
  ) <> 2 then
    raise exception 'Expected two active occupancy rows for the same cell.';
  end if;

  if exists (
    select 1
    from public.cell_occupancy_v
    where container_id = third_container_uuid
  ) then
    raise exception 'Expected removed placements to be excluded from occupancy view.';
  end if;

  if not exists (
    select 1
    from public.cell_occupancy_v
    where cell_id = cell_uuid
      and container_id = first_container_uuid
      and external_code = 'PALLET-101'
      and container_type = 'pallet'
      and container_status = 'active'
      and placed_at = '2026-03-13 10:00:00+00'
  ) then
    raise exception 'Expected pallet occupancy row to expose placement/container metadata only.';
  end if;

  if not exists (
    select 1
    from public.cell_occupancy_v
    where cell_id = cell_uuid
      and container_id = second_container_uuid
      and external_code is null
      and container_type = 'tote'
      and container_status = 'quarantined'
  ) then
    raise exception 'Expected occupancy view to support containers without external code.';
  end if;
end
$$;

rollback;
