-- 0063_cutoff_container_placements_runtime_writes_stage1.sql
--
-- Stage 1 runtime write cutoff for container_placements.
--
-- Scope intentionally limited to first-party runtime execution paths:
--   - place_container_at_location
--   - remove_container
--
-- This migration does NOT:
--   - drop public.container_placements
--   - change move_container_canonical / sync_container_placement_projection
--   - change compatibility wrapper public.place_container

-- ============================================================
-- 1. place_container_at_location
--    Keep canonical container/location and stock_movement writes.
--    Stop projection write to container_placements.
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
-- 2. remove_container
--    Keep canonical container/location and stock_movement writes.
--    Stop projection update to container_placements.
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
