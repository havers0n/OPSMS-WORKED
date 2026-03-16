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
  cell_a_uuid uuid := gen_random_uuid();
  cell_b_uuid uuid := gen_random_uuid();
  pallet_uuid uuid;
  tote_uuid uuid;
  removed_uuid uuid;
  location_a_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for location bridge test.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  select id into tote_type_uuid
  from public.container_types
  where code = 'tote';

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'E1LBR', 'Location Bridge Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'Location Bridge Floor', 1);

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
    (cell_a_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'bridge-cell-001'),
    (cell_b_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'bridge-cell-002');

  perform public.backfill_locations_from_published_cells();

  select id into location_a_uuid
  from public.locations
  where geometry_slot_id = cell_a_uuid;

  if location_a_uuid is null then
    raise exception 'Expected published cell to receive a backfilled location.';
  end if;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'BRIDGE-PALLET', pallet_type_uuid, 'active')
  returning id into pallet_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'BRIDGE-TOTE', tote_type_uuid, 'quarantined')
  returning id into tote_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'BRIDGE-REMOVED', pallet_type_uuid, 'active')
  returning id into removed_uuid;

  insert into public.inventory_items (tenant_id, container_id, item_ref, quantity, uom)
  values
    (default_tenant_uuid, pallet_uuid, 'ITEM-001', 5, 'pcs'),
    (default_tenant_uuid, pallet_uuid, 'ITEM-002', 2, 'pcs');

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at)
  values
    (default_tenant_uuid, pallet_uuid, cell_a_uuid, '2026-03-14T10:00:00.000Z'),
    (default_tenant_uuid, tote_uuid, cell_a_uuid, '2026-03-14T11:00:00.000Z');

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, removed_at)
  values (default_tenant_uuid, removed_uuid, cell_a_uuid, '2026-03-14T08:00:00.000Z', '2026-03-14T09:00:00.000Z');

  if (
    select count(*)
    from public.active_container_locations_v
    where cell_id = cell_a_uuid
  ) <> 2 then
    raise exception 'Expected active_container_locations_v to expose exactly active placements.';
  end if;

  if not exists (
    select 1
    from public.location_occupancy_v
    where location_id = location_a_uuid
      and cell_id = cell_a_uuid
      and container_id = pallet_uuid
  ) then
    raise exception 'Expected location_occupancy_v to resolve cell-backed occupancy through location identity.';
  end if;

  if (
    select count(*)
    from public.location_storage_snapshot_v
    where cell_id = cell_a_uuid
  ) <> 3 then
    raise exception 'Expected location_storage_snapshot_v to expose pallet contents plus empty tote row.';
  end if;

  if (
    select count(*)
    from public.cell_occupancy_v
    where cell_id = cell_a_uuid
  ) <> (
    select count(*)
    from public.location_occupancy_v
    where cell_id = cell_a_uuid
  ) then
    raise exception 'Expected cell_occupancy_v to remain a parity projection of location_occupancy_v.';
  end if;

  if (
    select count(*)
    from public.cell_storage_snapshot_v
    where cell_id = cell_a_uuid
  ) <> (
    select count(*)
    from public.location_storage_snapshot_v
    where cell_id = cell_a_uuid
  ) then
    raise exception 'Expected cell_storage_snapshot_v to remain a parity projection of location_storage_snapshot_v.';
  end if;

  delete from public.locations
  where id = location_a_uuid;

  if exists (
    select 1
    from public.location_occupancy_v
    where cell_id = cell_a_uuid
  ) then
    raise exception 'Expected location views to hide placements that lost their executable location mapping.';
  end if;

  if exists (
    select 1
    from public.cell_storage_snapshot_v
    where cell_id = cell_a_uuid
  ) then
    raise exception 'Expected compatibility cell views to hide placements without a location bridge row.';
  end if;
end
$$;

rollback;
