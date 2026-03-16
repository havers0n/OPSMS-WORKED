begin;

do $$
declare
  default_tenant_uuid uuid;
  other_tenant_uuid uuid := gen_random_uuid();
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
  other_site_uuid uuid := gen_random_uuid();
  other_floor_uuid uuid := gen_random_uuid();
  other_layout_uuid uuid := gen_random_uuid();
  other_rack_uuid uuid := gen_random_uuid();
  other_face_uuid uuid := gen_random_uuid();
  other_section_uuid uuid := gen_random_uuid();
  other_level_uuid uuid := gen_random_uuid();
  other_cell_uuid uuid := gen_random_uuid();
  pallet_uuid uuid;
  tote_uuid uuid;
  empty_uuid uuid;
  removed_uuid uuid;
  other_tenant_container_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for resolved storage snapshot test.';
  end if;

  insert into public.tenants (id, code, name)
  values (other_tenant_uuid, 'snapshot-other', 'Snapshot Other Tenant');

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  select id into tote_type_uuid
  from public.container_types
  where code = 'tote';

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'E1SNAP', 'Epic 1 Snapshots', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'Snapshot Floor', 1);

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
    (cell_a_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'snap-cell-001'),
    (cell_b_uuid, layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 2, 'R1-A.01.01.02', 'R1-A-01-01-02', 'snap-cell-002');

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (other_site_uuid, other_tenant_uuid, 'E1SNO', 'Epic 1 Snapshot Other', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (other_floor_uuid, other_site_uuid, 'F1', 'Other Floor', 1);

  insert into public.layout_versions (id, floor_id, version_no, state)
  values (other_layout_uuid, other_floor_uuid, 1, 'published');

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  values (other_rack_uuid, other_layout_uuid, 'R1', 'single', 'NS', 0, 0, 1000, 800, 0, 'published');

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
  values (other_face_uuid, other_rack_uuid, 'A', true, 'ltr', false, null, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values (other_section_uuid, other_face_uuid, 1, 1000);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values (other_level_uuid, other_section_uuid, 1, 1);

  insert into public.cells (id, layout_version_id, rack_id, rack_face_id, rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code)
  values (other_cell_uuid, other_layout_uuid, other_rack_uuid, other_face_uuid, other_section_uuid, other_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'snap-other-cell-001');

  perform public.backfill_locations_from_published_cells();

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SNAP-PALLET', pallet_type_uuid, 'active')
  returning id into pallet_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SNAP-TOTE', tote_type_uuid, 'quarantined')
  returning id into tote_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SNAP-EMPTY', pallet_type_uuid, 'active')
  returning id into empty_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'SNAP-REMOVED', pallet_type_uuid, 'active')
  returning id into removed_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (other_tenant_uuid, 'SNAP-OTHER', pallet_type_uuid, 'active')
  returning id into other_tenant_container_uuid;

  insert into public.inventory_items (tenant_id, container_id, item_ref, quantity, uom)
  values
    (default_tenant_uuid, pallet_uuid, 'ITEM-001', 5, 'pcs'),
    (default_tenant_uuid, pallet_uuid, 'ITEM-002', 2, 'pcs'),
    (default_tenant_uuid, tote_uuid, 'ITEM-003', 1, 'box'),
    (other_tenant_uuid, other_tenant_container_uuid, 'ITEM-900', 9, 'pcs');

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at)
  values
    (default_tenant_uuid, pallet_uuid, cell_a_uuid, '2026-03-13T10:00:00.000Z'),
    (default_tenant_uuid, tote_uuid, cell_a_uuid, '2026-03-13T11:00:00.000Z'),
    (default_tenant_uuid, empty_uuid, cell_b_uuid, '2026-03-13T12:00:00.000Z'),
    (other_tenant_uuid, other_tenant_container_uuid, other_cell_uuid, '2026-03-13T13:00:00.000Z');

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, removed_at)
  values (default_tenant_uuid, removed_uuid, cell_a_uuid, '2026-03-13T08:00:00.000Z', '2026-03-13T09:00:00.000Z');

  perform public.backfill_container_current_locations();

  if (
    select count(*)
    from public.container_storage_snapshot_v
    where container_id = pallet_uuid
  ) <> 2 then
    raise exception 'Expected pallet container snapshot to expose multiple current content rows.';
  end if;

  if not exists (
    select 1
    from public.container_storage_snapshot_v
    where container_id = empty_uuid
      and item_ref is null
      and quantity is null
      and uom is null
  ) then
    raise exception 'Expected empty container snapshot to remain representable with null content columns.';
  end if;

  if (
    select count(*)
    from public.cell_storage_snapshot_v
    where cell_id = cell_a_uuid
  ) <> 3 then
    raise exception 'Expected cell A storage snapshot to expose pallet+tote contents only.';
  end if;

  if not exists (
    select 1
    from public.cell_storage_snapshot_v
    where cell_id = cell_b_uuid
      and container_id = empty_uuid
      and item_ref is null
  ) then
    raise exception 'Expected empty placed container to appear in cell storage snapshot with null content.';
  end if;

  if exists (
    select 1
    from public.cell_storage_snapshot_v
    where container_id = removed_uuid
  ) then
    raise exception 'Expected removed placement to be excluded from cell storage snapshot.';
  end if;

  if (
    select count(*)
    from public.cell_storage_snapshot_v
    where tenant_id = other_tenant_uuid
  ) <> 1 then
    raise exception 'Expected tenant_id to keep other-tenant snapshot rows isolated.';
  end if;
end
$$;

rollback;
