begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid uuid;
  published_site_uuid uuid := gen_random_uuid();
  published_floor_uuid uuid := gen_random_uuid();
  published_layout_uuid uuid := gen_random_uuid();
  draft_site_uuid uuid := gen_random_uuid();
  draft_floor_uuid uuid := gen_random_uuid();
  draft_layout_uuid uuid := gen_random_uuid();
  rack_uuid uuid := gen_random_uuid();
  rack_face_uuid uuid := gen_random_uuid();
  rack_section_uuid uuid := gen_random_uuid();
  rack_level_uuid uuid := gen_random_uuid();
  published_cell_uuid uuid := gen_random_uuid();
  draft_rack_uuid uuid := gen_random_uuid();
  draft_rack_face_uuid uuid := gen_random_uuid();
  draft_rack_section_uuid uuid := gen_random_uuid();
  draft_rack_level_uuid uuid := gen_random_uuid();
  draft_cell_uuid uuid := gen_random_uuid();
  first_container_uuid uuid;
  second_container_uuid uuid;
  first_placement_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (published_site_uuid, default_tenant_uuid, 'E1PUB', 'Epic 1 Published', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (published_floor_uuid, published_site_uuid, 'F1', 'Published Floor', 1);

  insert into public.layout_versions (id, floor_id, version_no, state)
  values (published_layout_uuid, published_floor_uuid, 1, 'published');

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  values (rack_uuid, published_layout_uuid, 'R1', 'single', 'NS', 0, 0, 1000, 800, 0, 'published');

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
  values (rack_face_uuid, rack_uuid, 'A', true, 'ltr', false, null, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values (rack_section_uuid, rack_face_uuid, 1, 1000);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values (rack_level_uuid, rack_section_uuid, 1, 1);

  insert into public.cells (id, layout_version_id, rack_id, rack_face_id, rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code)
  values (published_cell_uuid, published_layout_uuid, rack_uuid, rack_face_uuid, rack_section_uuid, rack_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'pub-cell-001');

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (draft_site_uuid, default_tenant_uuid, 'E1DRF', 'Epic 1 Draft', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (draft_floor_uuid, draft_site_uuid, 'F1', 'Draft Floor', 1);

  insert into public.layout_versions (id, floor_id, version_no, state)
  values (draft_layout_uuid, draft_floor_uuid, 1, 'draft');

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  values (draft_rack_uuid, draft_layout_uuid, 'R1', 'single', 'NS', 0, 0, 1000, 800, 0, 'draft');

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
  values (draft_rack_face_uuid, draft_rack_uuid, 'A', true, 'ltr', false, null, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values (draft_rack_section_uuid, draft_rack_face_uuid, 1, 1000);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values (draft_rack_level_uuid, draft_rack_section_uuid, 1, 1);

  insert into public.cells (id, layout_version_id, rack_id, rack_face_id, rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code)
  values (draft_cell_uuid, draft_layout_uuid, draft_rack_uuid, draft_rack_face_uuid, draft_rack_section_uuid, draft_rack_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'draft-cell-001');

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'PLACE-001', pallet_type_uuid, 'active')
  returning id into first_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'PLACE-002', pallet_type_uuid, 'active')
  returning id into second_container_uuid;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at)
  values (default_tenant_uuid, first_container_uuid, published_cell_uuid, timezone('utc', now()))
  returning id into first_placement_uuid;

  if first_placement_uuid is null then
    raise exception 'Expected first active placement to be created.';
  end if;

  begin
    insert into public.container_placements (tenant_id, container_id, cell_id, placed_at)
    values (default_tenant_uuid, first_container_uuid, published_cell_uuid, timezone('utc', now()));
    raise exception 'Expected second active placement for same container to fail.';
  exception
    when unique_violation then
      null;
  end;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at)
  values (default_tenant_uuid, second_container_uuid, published_cell_uuid, timezone('utc', now()));

  if (
    select count(*)
    from public.container_placements
    where cell_id = published_cell_uuid
      and removed_at is null
  ) <> 2 then
    raise exception 'Expected multiple active containers in the same cell to be allowed.';
  end if;

  begin
    insert into public.container_placements (tenant_id, container_id, cell_id, placed_at)
    values (default_tenant_uuid, first_container_uuid, draft_cell_uuid, timezone('utc', now()));
    raise exception 'Expected placement into draft cell to fail.';
  exception
    when others then
      if position('published cells' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  update public.container_placements
  set removed_at = timezone('utc', now())
  where id = first_placement_uuid;

  if not exists (
    select 1
    from public.container_placements
    where id = first_placement_uuid
      and removed_at is not null
  ) then
    raise exception 'Expected placement removal to close the row instead of deleting history.';
  end if;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at)
  values (default_tenant_uuid, first_container_uuid, published_cell_uuid, timezone('utc', now()));
end
$$;

rollback;
