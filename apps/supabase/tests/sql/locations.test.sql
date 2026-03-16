begin;

do $$
declare
  default_tenant_uuid uuid;
  published_site_uuid uuid := gen_random_uuid();
  published_floor_uuid uuid := gen_random_uuid();
  other_site_uuid uuid := gen_random_uuid();
  other_floor_uuid uuid := gen_random_uuid();
  published_layout_uuid uuid := gen_random_uuid();
  draft_layout_uuid uuid := gen_random_uuid();
  published_rack_uuid uuid := gen_random_uuid();
  published_rack_face_uuid uuid := gen_random_uuid();
  published_rack_section_uuid uuid := gen_random_uuid();
  published_rack_level_uuid uuid := gen_random_uuid();
  draft_rack_uuid uuid := gen_random_uuid();
  draft_rack_face_uuid uuid := gen_random_uuid();
  draft_rack_section_uuid uuid := gen_random_uuid();
  draft_rack_level_uuid uuid := gen_random_uuid();
  published_cell_uuid uuid := gen_random_uuid();
  draft_cell_uuid uuid := gen_random_uuid();
  inserted_before integer;
  inserted_after integer;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for locations test.';
  end if;

  insert into public.sites (id, tenant_id, code, name, timezone)
  values
    (published_site_uuid, default_tenant_uuid, 'LOC-PUB', 'Locations Published Site', 'UTC'),
    (other_site_uuid, default_tenant_uuid, 'LOC-OTH', 'Locations Other Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values
    (published_floor_uuid, published_site_uuid, 'F1', 'Locations Floor', 1),
    (other_floor_uuid, other_site_uuid, 'F2', 'Locations Other Floor', 1);

  insert into public.layout_versions (id, floor_id, version_no, state)
  values
    (published_layout_uuid, published_floor_uuid, 1, 'published'),
    (draft_layout_uuid, published_floor_uuid, 2, 'draft');

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  values
    (published_rack_uuid, published_layout_uuid, 'LR1', 'single', 'NS', 0, 0, 1000, 800, 0, 'published'),
    (draft_rack_uuid, draft_layout_uuid, 'LR1-DRAFT', 'single', 'NS', 0, 0, 1000, 800, 0, 'draft');

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
  values
    (published_rack_face_uuid, published_rack_uuid, 'A', true, 'ltr', false, null, null),
    (draft_rack_face_uuid, draft_rack_uuid, 'A', true, 'ltr', false, null, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values
    (published_rack_section_uuid, published_rack_face_uuid, 1, 1000),
    (draft_rack_section_uuid, draft_rack_face_uuid, 1, 1000);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values
    (published_rack_level_uuid, published_rack_section_uuid, 1, 2),
    (draft_rack_level_uuid, draft_rack_section_uuid, 1, 2);

  insert into public.cells (id, layout_version_id, rack_id, rack_face_id, rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code)
  values
    (published_cell_uuid, published_layout_uuid, published_rack_uuid, published_rack_face_uuid, published_rack_section_uuid, published_rack_level_uuid, 1, 'LR1-A.01.01.01', 'LR1-A-01-01-01', 'loc-pub-001'),
    (draft_cell_uuid, draft_layout_uuid, draft_rack_uuid, draft_rack_face_uuid, draft_rack_section_uuid, draft_rack_level_uuid, 2, 'LR1-A.01.01.02', 'LR1-A-01-01-02', 'loc-draft-002');

  select count(*) into inserted_before
  from public.locations
  where geometry_slot_id = published_cell_uuid;

  if inserted_before <> 1 then
    raise exception 'Expected published cell to be backfilled into exactly one location row, found %.', inserted_before;
  end if;

  if exists (
    select 1
    from public.locations
    where geometry_slot_id = draft_cell_uuid
  ) then
    raise exception 'Draft cells must not be backfilled into executable locations.';
  end if;

  perform public.backfill_locations_from_published_cells();

  select count(*) into inserted_after
  from public.locations
  where geometry_slot_id = published_cell_uuid;

  if inserted_after <> 1 then
    raise exception 'Expected published-cell backfill to be idempotent, found % location rows.', inserted_after;
  end if;

  if not exists (
    select 1
    from public.locations
    where geometry_slot_id = published_cell_uuid
      and code = 'LR1-A.01.01.01'
      and location_type = 'rack_slot'
      and capacity_mode = 'single_container'
      and status = 'active'
  ) then
    raise exception 'Expected backfilled location row to carry canonical rack-slot defaults.';
  end if;

  begin
    insert into public.locations (tenant_id, floor_id, code, location_type, geometry_slot_id, capacity_mode, status)
    values (default_tenant_uuid, published_floor_uuid, 'BAD-RACK-NO-SLOT', 'rack_slot', null, 'single_container', 'active');
    raise exception 'Expected rack_slot without geometry_slot_id to fail.';
  exception
    when others then
      if position('rack_slot locations must reference a published geometry slot' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    insert into public.locations (tenant_id, floor_id, code, location_type, geometry_slot_id, capacity_mode, status)
    values (default_tenant_uuid, published_floor_uuid, 'BAD-STAGING-WITH-SLOT', 'staging', published_cell_uuid, 'multi_container', 'active');
    raise exception 'Expected non-rack location with geometry slot to fail.';
  exception
    when others then
      if position('Only rack_slot locations may reference a geometry slot' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    insert into public.locations (tenant_id, floor_id, code, location_type, geometry_slot_id, capacity_mode, status)
    values (default_tenant_uuid, other_floor_uuid, 'BAD-CROSS-FLOOR', 'rack_slot', published_cell_uuid, 'single_container', 'active');
    raise exception 'Expected floor mismatch between location and geometry slot to fail.';
  exception
    when others then
      if position('does not match geometry slot floor' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    insert into public.locations (tenant_id, floor_id, code, location_type, geometry_slot_id, capacity_mode, status)
    values (default_tenant_uuid, published_floor_uuid, 'BAD-DRAFT-SLOT', 'rack_slot', draft_cell_uuid, 'single_container', 'active');
    raise exception 'Expected draft geometry slot to fail.';
  exception
    when others then
      if position('must belong to a published layout' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    insert into public.locations (tenant_id, floor_id, code, location_type, geometry_slot_id, capacity_mode, status)
    values (default_tenant_uuid, published_floor_uuid, 'BAD-DUPLICATE-SLOT', 'rack_slot', published_cell_uuid, 'single_container', 'active');
    raise exception 'Expected duplicate geometry slot reference to fail.';
  exception
    when unique_violation then
      null;
  end;
end
$$;

rollback;
