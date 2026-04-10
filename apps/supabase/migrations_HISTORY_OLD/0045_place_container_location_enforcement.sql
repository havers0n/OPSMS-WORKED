-- 0045_place_container_location_enforcement.sql
--
-- Adds canonical location constraint enforcement to place_container().
--
-- Before writing any row, place_container now calls
-- public.location_can_accept_container(target_location_uuid, container_uuid)
-- and raises the returned reason code if the call rejects.
--
-- This enforces:
--   LOCATION_NOT_ACTIVE    — location is disabled or draft
--   LOCATION_OCCUPIED      — single_container location already has an active container
--   LOCATION_DIMENSION_*   — container type exceeds location dimension constraints
--   LOCATION_WEIGHT_*      — container gross weight exceeds location weight limit
--   SAME_LOCATION          — container already at this location
--
-- No other behavioural changes. Movement semantics, output shape, and
-- existing error codes (CONTAINER_NOT_FOUND, CONTAINER_ALREADY_PLACED,
-- TARGET_CELL_NOT_FOUND, TARGET_CELL_NOT_PUBLISHED,
-- TARGET_CELL_LOCATION_NOT_FOUND) are unchanged.

create or replace function public.place_container(
  container_uuid uuid,
  cell_uuid      uuid,
  actor_uuid     uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  container_tenant_uuid      uuid;
  target_cell_tenant_uuid    uuid;
  target_floor_uuid          uuid;
  target_cell_layout_state   text;
  target_location_uuid       uuid;
  active_placement           record;
  accept_result              jsonb;
  placed_at_utc              timestamptz := timezone('utc', now());
  new_placement_uuid         uuid;
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

  select s.tenant_id, f.id, lv.state
  into target_cell_tenant_uuid, target_floor_uuid, target_cell_layout_state
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

  select l.id
  into target_location_uuid
  from public.locations l
  where l.geometry_slot_id = cell_uuid
    and l.tenant_id = container_tenant_uuid
  limit 1;

  if target_location_uuid is null then
    raise exception 'TARGET_CELL_LOCATION_NOT_FOUND';
  end if;

  -- Enforce canonical location constraints before writing any rows.
  -- Raises the reason code directly so callers receive a single unambiguous error.
  accept_result := public.location_can_accept_container(target_location_uuid, container_uuid);
  if not coalesce((accept_result ->> 'ok')::boolean, false) then
    raise exception '%', (accept_result ->> 'reason');
  end if;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
  values (container_tenant_uuid, container_uuid, cell_uuid, placed_at_utc, actor_uuid)
  returning id into new_placement_uuid;

  update public.containers
  set current_location_id         = target_location_uuid,
      current_location_entered_at = placed_at_utc,
      updated_at                  = placed_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  perform public.insert_movement_event(
    container_tenant_uuid,
    target_floor_uuid,
    container_uuid,
    null,
    cell_uuid,
    'placed',
    actor_uuid,
    placed_at_utc
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
