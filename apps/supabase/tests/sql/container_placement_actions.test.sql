begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid uuid;
  actor_uuid uuid := null;
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  layout_uuid uuid := gen_random_uuid();
  draft_site_uuid uuid := gen_random_uuid();
  draft_floor_uuid uuid := gen_random_uuid();
  draft_layout_uuid uuid := gen_random_uuid();
  rack_uuid uuid := gen_random_uuid();
  rack_face_uuid uuid := gen_random_uuid();
  rack_section_uuid uuid := gen_random_uuid();
  rack_level_uuid uuid := gen_random_uuid();
  cell_a_uuid uuid := gen_random_uuid();
  cell_b_uuid uuid := gen_random_uuid();
  draft_rack_uuid uuid := gen_random_uuid();
  draft_rack_face_uuid uuid := gen_random_uuid();
  draft_rack_section_uuid uuid := gen_random_uuid();
  draft_rack_level_uuid uuid := gen_random_uuid();
  draft_cell_uuid uuid := gen_random_uuid();
  place_container_uuid uuid;
  move_container_uuid uuid;
  idle_container_uuid uuid;
  invalid_target_container_uuid uuid;
  same_cell_container_uuid uuid;
  place_result jsonb;
  remove_result jsonb;
  move_result jsonb;
  previous_placement_id uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

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

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (draft_site_uuid, default_tenant_uuid, 'E1ACD', 'Epic 1 Action Draft', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (draft_floor_uuid, draft_site_uuid, 'F1', 'Action Draft Floor', 1);

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
  values (draft_cell_uuid, draft_layout_uuid, draft_rack_uuid, draft_rack_face_uuid, draft_rack_section_uuid, draft_rack_level_uuid, 1, 'R1-A.01.01.01', 'R1-A-01-01-01', 'act-draft-cell-001');

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'ACT-PLACE', pallet_type_uuid, 'active')
  returning id into place_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'ACT-MOVE', pallet_type_uuid, 'active')
  returning id into move_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'ACT-IDLE', pallet_type_uuid, 'active')
  returning id into idle_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'ACT-BAD', pallet_type_uuid, 'active')
  returning id into invalid_target_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'ACT-SAME', pallet_type_uuid, 'active')
  returning id into same_cell_container_uuid;

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
    from public.movement_events
    where container_id = place_container_uuid
      and event_type = 'placed'
      and from_cell_id is null
      and to_cell_id = cell_a_uuid
  ) then
    raise exception 'Expected place_container to write a placed movement event.';
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
    from public.movement_events
    where container_id = place_container_uuid
      and event_type = 'removed'
      and from_cell_id = cell_a_uuid
      and to_cell_id is null
  ) then
    raise exception 'Expected remove_container to write a removed movement event.';
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

  perform public.place_container(move_container_uuid, cell_a_uuid, actor_uuid);

  select id into previous_placement_id
  from public.container_placements
  where container_id = move_container_uuid
    and removed_at is null;

  move_result := public.move_container(move_container_uuid, cell_b_uuid, actor_uuid);

  if move_result ->> 'action' <> 'moved' then
    raise exception 'Expected move_container action=moved.';
  end if;

  if move_result ->> 'fromCellId' <> cell_a_uuid::text or move_result ->> 'toCellId' <> cell_b_uuid::text then
    raise exception 'Expected move_container to return from/to cell ids.';
  end if;

  if not exists (
    select 1
    from public.container_placements
    where id = previous_placement_id
      and removed_at is not null
  ) then
    raise exception 'Expected move_container to close the previous active placement.';
  end if;

  if not exists (
    select 1
    from public.container_placements
    where container_id = move_container_uuid
      and cell_id = cell_b_uuid
      and removed_at is null
  ) then
    raise exception 'Expected move_container to create a new active placement in the target cell.';
  end if;

  if not exists (
    select 1
    from public.movement_events
    where container_id = move_container_uuid
      and event_type = 'moved'
      and from_cell_id = cell_a_uuid
      and to_cell_id = cell_b_uuid
  ) then
    raise exception 'Expected move_container to write a moved movement event.';
  end if;

  begin
    perform public.move_container(idle_container_uuid, cell_b_uuid, actor_uuid);
    raise exception 'Expected move_container to fail when container is not placed.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_PLACED' then
        raise;
      end if;
  end;

  perform public.place_container(invalid_target_container_uuid, cell_a_uuid, actor_uuid);

  begin
    perform public.move_container(invalid_target_container_uuid, draft_cell_uuid, actor_uuid);
    raise exception 'Expected move_container to fail for draft target cell.';
  exception
    when others then
      if sqlerrm <> 'TARGET_CELL_NOT_PUBLISHED' then
        raise;
      end if;
  end;

  perform public.place_container(same_cell_container_uuid, cell_a_uuid, actor_uuid);

  begin
    perform public.move_container(same_cell_container_uuid, cell_a_uuid, actor_uuid);
    raise exception 'Expected move_container to fail when target cell matches current cell.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_ALREADY_IN_TARGET_CELL' then
        raise;
      end if;
  end;
end
$$;

rollback;
