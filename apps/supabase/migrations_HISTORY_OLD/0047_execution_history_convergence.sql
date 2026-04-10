-- 0047_execution_history_convergence.sql
--
-- Stage 8B: Execution History Convergence.
--
-- Makes the full container lifecycle readable through a single canonical
-- history system (stock_movements) instead of two half-overlapping sources.
--
-- Before this migration:
--   place_container / place_container_at_location → movement_events only
--   remove_container                              → movement_events only
--   move_container_canonical / split / transfer / pick → stock_movements only
--
-- After this migration:
--   ALL execution RPCs → stock_movements (canonical)
--   ALL execution RPCs → movement_events (legacy compatibility, dual-write)
--
-- Changes:
--   1. Extend stock_movements.movement_type CHECK to include
--      'place_container' and 'remove_container'.
--   2. Promote place_container       → SECURITY DEFINER + stock_movement write.
--   3. Promote place_container_at_location → SECURITY DEFINER + stock_movement write.
--   4. Promote remove_container      → SECURITY DEFINER + stock_movement write.
--
-- The SECURITY DEFINER promotion is required because insert_stock_movement
-- is REVOKED from the authenticated role (migration 0044). INVOKER functions
-- called by authenticated cannot call insert_stock_movement. SECURITY DEFINER
-- executes with the function owner's privileges and bypasses that restriction.
--
-- Behavioural changes per function:
--   place_container:
--     - CONTAINER_ALREADY_PLACED now derived from containers.current_location_id
--       (canonical truth), not container_placements.removed_at (projection).
--       Fixes a bug where a container placed via place_container_at_location
--       into a non-rack location could be double-placed via place_container.
--     - actor_uuid override (auth.uid()) is now the first executable statement.
--     - inline can_manage_tenant gate on container SELECT ... FOR UPDATE.
--
--   place_container_at_location:
--     - No behavioural change beyond adding stock_movement write.
--     - SECURITY DEFINER promotion removes RLS from internal reads; the
--       existing explicit tenant check is the oracle-masking guard.
--
--   remove_container:
--     - No behavioural change beyond adding stock_movement write.
--     - SECURITY DEFINER promotion removes RLS from internal DML; inline
--       can_manage_tenant gate (already present in 0044) remains the auth guard.
--
-- Return shapes are unchanged for all three functions.

-- ============================================================
-- 1. Extend movement_type CHECK constraint
-- ============================================================

alter table public.stock_movements
  drop constraint if exists stock_movements_movement_type_check;

alter table public.stock_movements
  add constraint stock_movements_movement_type_check
  check (movement_type in (
    'receive', 'putaway',
    'move_container',
    'place_container', 'remove_container',
    'split_stock', 'transfer_stock', 'pick_partial',
    'ship', 'adjust'
  ));

-- ============================================================
-- 2. place_container
--    SECURITY DEFINER + actor override + inline auth gate
--    + stock_movement canonical write (dual-write with movement_events)
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
  -- Step 1: Override actor attribution unconditionally.
  actor_uuid := auth.uid();

  -- Step 2: Lock container with inline tenant authorization.
  -- AND can_manage_tenant(...) inside WHERE prevents FOR UPDATE from
  -- acquiring a lock on unauthorized rows. Cross-tenant and non-existent
  -- UUIDs both return null — oracle-masked as CONTAINER_NOT_FOUND.
  select c.id, c.tenant_id, c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  -- Canonical placement truth: containers.current_location_id.
  -- Replaced the old container_placements.removed_at IS NULL check.
  -- Fixes: a container placed into a non-rack location via
  -- place_container_at_location (no container_placements row) could
  -- otherwise be double-placed via place_container.
  if container_row.current_location_id is not null then
    raise exception 'CONTAINER_ALREADY_PLACED';
  end if;

  -- Under SECURITY DEFINER these reads bypass RLS.
  -- The cross-tenant cell check below masks TENANT_MISMATCH.
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

  -- Enforce canonical location constraints before writing any row.
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

  -- Canonical history write (Stage 8B).
  -- source_location = null (container was not placed before).
  -- source and target container are the same (whole-container placement).
  perform public.insert_stock_movement(
    container_row.tenant_id,
    'place_container',
    null,                  -- source_location_uuid: not previously placed
    target_location_uuid,  -- target_location_uuid: destination
    container_uuid,        -- source_container_uuid
    container_uuid,        -- target_container_uuid
    null,                  -- source_inventory_unit_uuid
    null,                  -- target_inventory_unit_uuid
    null,                  -- quantity_value
    null,                  -- uom_value
    'done',
    placed_at_utc,
    placed_at_utc,
    actor_uuid
  );

  -- Legacy compatibility write (movement_events).
  perform public.insert_movement_event(
    container_row.tenant_id,
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

-- ============================================================
-- 3. place_container_at_location
--    SECURITY DEFINER promotion + stock_movement canonical write
--    Security pattern is already correct; adding definer + history.
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
  -- Step 1: Override actor attribution unconditionally.
  actor_uuid := auth.uid();

  -- Step 2: Lock container with inline tenant authorization.
  -- Under SECURITY DEFINER this reads without RLS; the inline
  -- can_manage_tenant gate is the explicit auth boundary.
  select c.id, c.tenant_id, c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  -- Canonical placement truth.
  if container_row.current_location_id is not null then
    raise exception 'CONTAINER_ALREADY_PLACED';
  end if;

  -- Resolve target location.
  -- Under SECURITY DEFINER, RLS doesn't apply; the explicit tenant check
  -- below masks cross-tenant location UUIDs as LOCATION_NOT_FOUND.
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
  if location_row.geometry_slot_id is not null then
    insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
    values (container_row.tenant_id, container_uuid, location_row.geometry_slot_id, placed_at_utc, actor_uuid)
    returning id into new_placement_id;
  end if;

  -- Canonical history write (Stage 8B).
  perform public.insert_stock_movement(
    container_row.tenant_id,
    'place_container',
    null,          -- source_location_uuid: not previously placed
    location_uuid, -- target_location_uuid: destination
    container_uuid,
    container_uuid,
    null, null, null, null,
    'done',
    placed_at_utc,
    placed_at_utc,
    actor_uuid
  );

  -- Legacy compatibility write.
  -- to_cell_id = geometry_slot_id: null for non-rack locations.
  perform public.insert_movement_event(
    container_row.tenant_id,
    location_row.floor_id,
    container_uuid,
    null,
    location_row.geometry_slot_id,
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

-- ============================================================
-- 4. remove_container
--    SECURITY DEFINER promotion + stock_movement canonical write
--    All other behaviour unchanged from migration 0044.
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
  -- Step 1: Override actor attribution unconditionally.
  actor_uuid := auth.uid();

  -- Step 2: Lock container with inline tenant authorization.
  -- Under SECURITY DEFINER this reads without RLS; the inline
  -- can_manage_tenant gate is the explicit auth boundary.
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
  if container_row.current_location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  -- Read floor_id and geometry_slot_id from the canonical location.
  -- locations.floor_id is NOT NULL (0034), so floor_id is always present.
  -- geometry_slot_id is null for non-rack locations.
  select l.floor_id, l.geometry_slot_id
  into location_row
  from public.locations l
  where l.id = container_row.current_location_id;

  -- Hard guard: current_location_id references locations via FK ON DELETE
  -- RESTRICT (0040), so a missing location row indicates data drift.
  if location_row.floor_id is null then
    raise exception 'CURRENT_LOCATION_NOT_FOUND';
  end if;

  -- Close any active container_placements record (projection sync).
  -- For non-rack locations no active placement row will exist; the
  -- UPDATE affects zero rows, which is correct and not an error.
  update public.container_placements
  set removed_at = removed_at_utc,
      removed_by = actor_uuid
  where container_id = container_uuid
    and removed_at is null
  returning id into active_placement_id;

  -- Clear canonical placement state.
  update public.containers
  set current_location_id         = null,
      current_location_entered_at = null,
      updated_at                  = removed_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  -- Canonical history write (Stage 8B).
  -- source_location = where the container was before removal.
  -- container_row.current_location_id is read before the UPDATE above,
  -- so it still holds the pre-removal value here.
  perform public.insert_stock_movement(
    container_row.tenant_id,
    'remove_container',
    container_row.current_location_id,  -- source_location_uuid: was here
    null,                               -- target_location_uuid: removed to nowhere
    container_uuid,
    container_uuid,
    null, null, null, null,
    'done',
    removed_at_utc,
    removed_at_utc,
    actor_uuid
  );

  -- Legacy compatibility write.
  -- from_cell_id = geometry_slot_id: non-null for rack_slot, null otherwise.
  perform public.insert_movement_event(
    container_row.tenant_id,
    location_row.floor_id,
    container_uuid,
    location_row.geometry_slot_id,
    null,
    'removed',
    actor_uuid,
    removed_at_utc
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
