-- 0021_container_placement_actions.sql

create or replace function public.place_container(container_uuid uuid, cell_uuid uuid, actor_uuid uuid default null)
returns jsonb
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  target_cell_tenant_uuid uuid;
  target_cell_layout_state text;
  active_placement record;
  placed_at_utc timestamptz := timezone('utc', now());
  new_placement_uuid uuid;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = container_uuid
  for update;

  if container_tenant_uuid is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  select cp.id, cp.cell_id
  into active_placement
  from public.container_placements cp
  where cp.container_id = container_uuid
    and cp.removed_at is null
  for update;

  if active_placement.id is not null then
    raise exception 'CONTAINER_ALREADY_PLACED';
  end if;

  select s.tenant_id, lv.state
  into target_cell_tenant_uuid, target_cell_layout_state
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  where c.id = cell_uuid;

  if target_cell_tenant_uuid is null then
    raise exception 'TARGET_CELL_NOT_FOUND';
  end if;

  if target_cell_tenant_uuid <> container_tenant_uuid then
    raise exception 'TARGET_CELL_TENANT_MISMATCH';
  end if;

  if target_cell_layout_state <> 'published' then
    raise exception 'TARGET_CELL_NOT_PUBLISHED';
  end if;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
  values (container_tenant_uuid, container_uuid, cell_uuid, placed_at_utc, actor_uuid)
  returning id into new_placement_uuid;

  return jsonb_build_object(
    'action', 'placed',
    'containerId', container_uuid,
    'cellId', cell_uuid,
    'placementId', new_placement_uuid,
    'occurredAt', placed_at_utc
  );
exception
  when unique_violation then
    raise exception 'CONTAINER_ALREADY_PLACED';
end
$$;

create or replace function public.remove_container(container_uuid uuid, actor_uuid uuid default null)
returns jsonb
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  active_placement record;
  removed_at_utc timestamptz := timezone('utc', now());
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = container_uuid
  for update;

  if container_tenant_uuid is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  select cp.id, cp.cell_id
  into active_placement
  from public.container_placements cp
  where cp.container_id = container_uuid
    and cp.removed_at is null
  for update;

  if active_placement.id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  update public.container_placements
  set removed_at = removed_at_utc,
      removed_by = actor_uuid
  where id = active_placement.id;

  return jsonb_build_object(
    'action', 'removed',
    'containerId', container_uuid,
    'cellId', active_placement.cell_id,
    'placementId', active_placement.id,
    'occurredAt', removed_at_utc
  );
end
$$;

create or replace function public.move_container(container_uuid uuid, target_cell_uuid uuid, actor_uuid uuid default null)
returns jsonb
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  target_cell_tenant_uuid uuid;
  target_cell_layout_state text;
  active_placement record;
  moved_at_utc timestamptz := timezone('utc', now());
  new_placement_uuid uuid;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = container_uuid
  for update;

  if container_tenant_uuid is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  select cp.id, cp.cell_id
  into active_placement
  from public.container_placements cp
  where cp.container_id = container_uuid
    and cp.removed_at is null
  for update;

  if active_placement.id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  if active_placement.cell_id = target_cell_uuid then
    raise exception 'CONTAINER_ALREADY_IN_TARGET_CELL';
  end if;

  select s.tenant_id, lv.state
  into target_cell_tenant_uuid, target_cell_layout_state
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  where c.id = target_cell_uuid;

  if target_cell_tenant_uuid is null then
    raise exception 'TARGET_CELL_NOT_FOUND';
  end if;

  if target_cell_tenant_uuid <> container_tenant_uuid then
    raise exception 'TARGET_CELL_TENANT_MISMATCH';
  end if;

  if target_cell_layout_state <> 'published' then
    raise exception 'TARGET_CELL_NOT_PUBLISHED';
  end if;

  update public.container_placements
  set removed_at = moved_at_utc,
      removed_by = actor_uuid
  where id = active_placement.id;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
  values (container_tenant_uuid, container_uuid, target_cell_uuid, moved_at_utc, actor_uuid)
  returning id into new_placement_uuid;

  return jsonb_build_object(
    'action', 'moved',
    'containerId', container_uuid,
    'fromCellId', active_placement.cell_id,
    'toCellId', target_cell_uuid,
    'previousPlacementId', active_placement.id,
    'placementId', new_placement_uuid,
    'occurredAt', moved_at_utc
  );
exception
  when unique_violation then
    raise exception 'CONTAINER_ALREADY_PLACED';
end
$$;

grant execute on function public.place_container(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_container(uuid, uuid) to authenticated;
grant execute on function public.move_container(uuid, uuid, uuid) to authenticated;
