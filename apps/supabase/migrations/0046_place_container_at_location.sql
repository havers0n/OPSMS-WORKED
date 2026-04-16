-- 0046_place_container_at_location.sql
--
-- Adds place_container_at_location(container_uuid, location_uuid, actor_uuid).
--
-- Accepts a first-class location UUID as the placement target, enabling
-- initial placement into non-rack operational locations (staging, dock,
-- buffer, floor) as well as rack-backed rack_slot locations.
--
-- Security model: INVOKER — same pattern as remove_container (migration 0044).
--   actor_uuid := auth.uid() override is the first executable statement.
--   Inline can_manage_tenant gate is inside the SELECT ... FOR UPDATE clause.
--   Explicit tenant check on the target location masks TENANT_MISMATCH as
--   LOCATION_NOT_FOUND to close the cross-tenant location oracle.
--
-- For rack-backed locations (geometry_slot_id IS NOT NULL):
--   writes containers.current_location_id, a container_placements projection
--   row, and a movement_events legacy record with to_cell_id set.
--
-- For non-rack locations (geometry_slot_id IS NULL):
--   writes only containers.current_location_id and a movement_events legacy
--   record with to_cell_id null. No container_placements row is written.
--
-- In both cases: raises if the location is occupied (LOCATION_OCCUPIED) or
-- inactive (LOCATION_NOT_ACTIVE) via location_can_accept_container.
--
-- Returns JSON:
--   { action, containerId, locationId, cellId, placementId, occurredAt }
--   cellId and placementId are null for non-rack locations.

create or replace function public.place_container_at_location(
  container_uuid uuid,
  location_uuid  uuid,
  actor_uuid     uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  container_row    record;
  location_row     record;
  accept_result    jsonb;
  new_placement_id uuid;
  placed_at_utc    timestamptz := timezone('utc', now());
begin
  -- Step 1: Override actor attribution unconditionally.
  -- Caller-supplied actor_uuid is discarded; auth.uid() is the only
  -- valid identity source inside this function.
  actor_uuid := auth.uid();

  -- Step 2: Lock primary resource with inline tenant authorization.
  -- AND can_manage_tenant(...) inside the WHERE clause prevents
  -- FOR UPDATE from acquiring a lock on unauthorized rows.
  -- A cross-tenant or non-existent container UUID returns no row;
  -- both cases surface as CONTAINER_NOT_FOUND (oracle-masked).
  select c.id, c.tenant_id, c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  -- Canonical placement truth is containers.current_location_id.
  -- Do not consult container_placements — that is the projection, not truth.
  if container_row.current_location_id is not null then
    raise exception 'CONTAINER_ALREADY_PLACED';
  end if;

  -- Resolve target location.
  -- Under INVOKER + RLS, cross-tenant location UUIDs return null rows,
  -- which is indistinguishable from a non-existent UUID — oracle-masked
  -- by RLS naturally. The explicit tenant check below is defense-in-depth
  -- for scenarios where this function runs outside an RLS context (e.g.,
  -- superuser test harnesses) or is later promoted to SECURITY DEFINER.
  select l.id, l.tenant_id, l.floor_id, l.geometry_slot_id
  into location_row
  from public.locations l
  where l.id = location_uuid;

  if location_row.id is null then
    raise exception 'LOCATION_NOT_FOUND';
  end if;

  -- Mask TENANT_MISMATCH: returning a distinct error would confirm to the
  -- caller that the UUID is a valid location in another tenant.
  if location_row.tenant_id <> container_row.tenant_id then
    raise exception 'LOCATION_NOT_FOUND';
  end if;

  -- Enforce canonical location constraints before writing any row.
  -- Raises the reason code directly so callers receive a single error.
  accept_result := public.location_can_accept_container(location_uuid, container_uuid);
  if not coalesce((accept_result ->> 'ok')::boolean, false) then
    raise exception '%', (accept_result ->> 'reason');
  end if;

  -- Write canonical placement state.
  update public.containers
  set current_location_id         = location_uuid,
      current_location_entered_at = placed_at_utc,
      updated_at                  = placed_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  -- For rack-backed locations: write the container_placements projection row.
  -- Non-rack locations (floor, staging, dock, buffer) have no geometry slot;
  -- skip the projection insert for those.
  if location_row.geometry_slot_id is not null then
    insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
    values (container_row.tenant_id, container_uuid, location_row.geometry_slot_id, placed_at_utc, actor_uuid)
    returning id into new_placement_id;
  end if;

  -- Emit legacy movement event for backward compatibility.
  -- to_cell_id = geometry_slot_id: non-null for rack_slot, null for all other
  -- location types. movement_events.to_cell_id is nullable; both cases valid.
  perform public.insert_movement_event(
    container_row.tenant_id,
    location_row.floor_id,
    container_uuid,
    null,                              -- from_cell_id: null (was not placed)
    location_row.geometry_slot_id,     -- to_cell_id: null for non-rack
    'placed',
    actor_uuid,
    placed_at_utc
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
