-- 0058_cutoff_movement_events_dual_write.sql
--
-- Stops legacy movement_events dual-write from live execution functions.
-- Canonical execution history remains stock_movements.
--
-- Scope intentionally limited to:
--   - place_container
--   - place_container_at_location
--   - remove_container
--   - execute permission on insert_movement_event helper

-- ============================================================
-- 1. place_container
--    Keep canonical stock_movement write; remove movement_events write.
-- ============================================================

create or replace function public.place_container(
  container_uuid uuid,
  cell_uuid      uuid,
  actor_uuid     uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  container_row            record;
  target_cell_tenant_uuid  uuid;
  target_floor_uuid        uuid;
  target_cell_layout_state text;
  target_location_uuid     uuid;
  accept_result            jsonb;
  placed_at_utc            timestamptz := timezone('utc', now());
  new_placement_uuid       uuid;
begin
  actor_uuid := auth.uid();

  select c.id, c.tenant_id, c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.current_location_id is not null then
    raise exception 'CONTAINER_ALREADY_PLACED';
  end if;

  select s.tenant_id, f.id, lv.state
  into target_cell_tenant_uuid, target_floor_uuid, target_cell_layout_state
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f          on f.id = lv.floor_id
  join public.sites s           on s.id = f.site_id
  where c.id = cell_uuid;

  if target_cell_tenant_uuid is null then
    raise exception 'TARGET_CELL_NOT_FOUND';
  end if;

  if target_cell_tenant_uuid <> container_row.tenant_id then
    raise exception 'TARGET_CELL_TENANT_MISMATCH';
  end if;

  if target_cell_layout_state <> 'published' then
    raise exception 'TARGET_CELL_NOT_PUBLISHED';
  end if;

  select l.id
  into target_location_uuid
  from public.locations l
  where l.geometry_slot_id = cell_uuid
    and l.tenant_id = container_row.tenant_id
  limit 1;

  if target_location_uuid is null then
    raise exception 'TARGET_CELL_LOCATION_NOT_FOUND';
  end if;

  accept_result := public.location_can_accept_container(target_location_uuid, container_uuid);
  if not coalesce((accept_result ->> 'ok')::boolean, false) then
    raise exception '%', (accept_result ->> 'reason');
  end if;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
  values (container_row.tenant_id, container_uuid, cell_uuid, placed_at_utc, actor_uuid)
  returning id into new_placement_uuid;

  update public.containers
  set current_location_id         = target_location_uuid,
      current_location_entered_at = placed_at_utc,
      updated_at                  = placed_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  perform public.insert_stock_movement(
    container_row.tenant_id,
    'place_container',
    null,
    target_location_uuid,
    container_uuid,
    container_uuid,
    null,
    null,
    null,
    null,
    'done',
    placed_at_utc,
    placed_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'action',      'placed',
    'containerId', container_uuid,
    'cellId',      cell_uuid,
    'placementId', new_placement_uuid,
    'occurredAt',  placed_at_utc
  );
exception
  when unique_violation then
    raise exception 'CONTAINER_ALREADY_PLACED';
end
$$;

-- ============================================================
-- 2. place_container_at_location
--    Keep canonical stock_movement write; remove movement_events write.
-- ============================================================

create or replace function public.place_container_at_location(
  container_uuid uuid,
  location_uuid  uuid,
  actor_uuid     uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  container_row    record;
  location_row     record;
  accept_result    jsonb;
  new_placement_id uuid;
  placed_at_utc    timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();

  select c.id, c.tenant_id, c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.current_location_id is not null then
    raise exception 'CONTAINER_ALREADY_PLACED';
  end if;

  select l.id, l.tenant_id, l.floor_id, l.geometry_slot_id
  into location_row
  from public.locations l
  where l.id = location_uuid;

  if location_row.id is null then
    raise exception 'LOCATION_NOT_FOUND';
  end if;

  if location_row.tenant_id <> container_row.tenant_id then
    raise exception 'LOCATION_NOT_FOUND';
  end if;

  accept_result := public.location_can_accept_container(location_uuid, container_uuid);
  if not coalesce((accept_result ->> 'ok')::boolean, false) then
    raise exception '%', (accept_result ->> 'reason');
  end if;

  update public.containers
  set current_location_id         = location_uuid,
      current_location_entered_at = placed_at_utc,
      updated_at                  = placed_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  if location_row.geometry_slot_id is not null then
    insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
    values (container_row.tenant_id, container_uuid, location_row.geometry_slot_id, placed_at_utc, actor_uuid)
    returning id into new_placement_id;
  end if;

  perform public.insert_stock_movement(
    container_row.tenant_id,
    'place_container',
    null,
    location_uuid,
    container_uuid,
    container_uuid,
    null,
    null,
    null,
    null,
    'done',
    placed_at_utc,
    placed_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'action',      'placed',
    'containerId', container_uuid,
    'locationId',  location_uuid,
    'cellId',      location_row.geometry_slot_id,
    'placementId', new_placement_id,
    'occurredAt',  placed_at_utc
  );
exception
  when unique_violation then
    raise exception 'CONTAINER_ALREADY_PLACED';
end
$$;

-- ============================================================
-- 3. remove_container
--    Keep canonical stock_movement write; remove movement_events write.
-- ============================================================

create or replace function public.remove_container(
  container_uuid uuid,
  actor_uuid     uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  container_row        record;
  location_row         record;
  active_placement_id  uuid;
  removed_at_utc       timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();

  select c.id, c.tenant_id, c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.current_location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  select l.floor_id, l.geometry_slot_id
  into location_row
  from public.locations l
  where l.id = container_row.current_location_id;

  if location_row.floor_id is null then
    raise exception 'CURRENT_LOCATION_NOT_FOUND';
  end if;

  update public.container_placements
  set removed_at = removed_at_utc,
      removed_by = actor_uuid
  where container_id = container_uuid
    and removed_at is null
  returning id into active_placement_id;

  update public.containers
  set current_location_id         = null,
      current_location_entered_at = null,
      updated_at                  = removed_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  perform public.insert_stock_movement(
    container_row.tenant_id,
    'remove_container',
    container_row.current_location_id,
    null,
    container_uuid,
    container_uuid,
    null,
    null,
    null,
    null,
    'done',
    removed_at_utc,
    removed_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'action',      'removed',
    'containerId', container_uuid,
    'cellId',      location_row.geometry_slot_id,
    'placementId', active_placement_id,
    'occurredAt',  removed_at_utc
  );
end
$$;

-- ============================================================
-- 4. Prevent direct legacy writes through helper RPC
-- ============================================================

revoke execute on function public.insert_movement_event(
  uuid, uuid, uuid, uuid, uuid, text, uuid, timestamptz
) from public, authenticated;
