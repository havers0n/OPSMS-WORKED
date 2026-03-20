-- 0044_security_definer_hardening.sql
--
-- Security hardening patch for canonical execution functions.
-- Converts four public entrypoints to SECURITY DEFINER with explicit
-- inline tenant authorization. Adds inline auth to remove_container
-- (stays INVOKER). Revokes direct helper access from authenticated.
--
-- Order matters: split_inventory_unit must be replaced before transfer
-- and pick, which call it. REVOKEs are applied last so the window
-- where helpers are inaccessible but callers are not yet SECURITY DEFINER
-- is zero within this transaction.

-- ============================================================
-- 1. split_inventory_unit
--    SECURITY DEFINER + inline auth gate + oracle masking
-- ============================================================

create or replace function public.split_inventory_unit(
  source_inventory_unit_uuid uuid,
  split_quantity              numeric,
  target_container_uuid       uuid,
  actor_uuid                  uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row                 record;
  target_container_row       record;
  source_location_row        record;
  target_location_row        record;
  merge_candidate_row        record;
  target_inventory_unit_uuid uuid;
  source_quantity_after      numeric;
  target_quantity_after      numeric;
  merge_applied              boolean := false;
  occurred_at_utc            timestamptz := timezone('utc', now());
  split_movement_uuid        uuid;
begin
  -- Step 1: Override actor attribution unconditionally.
  -- Caller-supplied actor_uuid is discarded.
  actor_uuid := auth.uid();

  -- Step 2: Lock primary resource with inline tenant authorization.
  -- AND can_manage_tenant(...) inside the WHERE clause prevents
  -- FOR UPDATE from acquiring a lock on unauthorized rows.
  -- A cross-tenant UUID returns no row; id is null → same error as missing.
  select
    iu.id,
    iu.tenant_id,
    iu.container_id,
    iu.product_id,
    iu.quantity,
    iu.uom,
    iu.lot_code,
    iu.serial_no,
    iu.expiry_date,
    iu.status
  into source_row
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid
    and public.can_manage_tenant(iu.tenant_id)
  for update;

  -- Step 3: Single indistinct check — not-found and unauthorized
  -- raise the same error. Cross-tenant IU UUID is indistinguishable
  -- from a nonexistent UUID to the caller.
  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  if split_quantity <= 0 or split_quantity >= source_row.quantity then
    raise exception 'INVALID_SPLIT_QUANTITY';
  end if;

  if source_row.serial_no is not null then
    raise exception 'SERIAL_SPLIT_NOT_ALLOWED';
  end if;

  -- Lock target container.
  -- Under SECURITY DEFINER, this reads without RLS.
  -- Tenant mismatch is masked as NOT_FOUND to prevent
  -- cross-tenant container existence oracle.
  select c.id, c.tenant_id
  into target_container_row
  from public.containers c
  where c.id = target_container_uuid
  for update;

  if target_container_row.id is null then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  -- Mask: returning TARGET_CONTAINER_TENANT_MISMATCH would confirm
  -- to the caller that the UUID is a valid container in another tenant.
  if target_container_row.tenant_id <> source_row.tenant_id then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  if target_container_row.id = source_row.container_id then
    raise exception 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(source_row.container_id);

  select *
  into target_location_row
  from public.resolve_active_location_for_container(target_container_row.id);

  update public.inventory_unit iu
  set quantity   = iu.quantity - split_quantity,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where iu.id = source_row.id
  returning iu.quantity into source_quantity_after;

  select iu.id, iu.quantity
  into merge_candidate_row
  from public.inventory_unit iu
  where iu.tenant_id    = source_row.tenant_id
    and iu.container_id = target_container_row.id
    and iu.product_id   = source_row.product_id
    and iu.uom          = source_row.uom
    and iu.status       = source_row.status
    and iu.serial_no    is null
    and iu.lot_code     is not distinct from source_row.lot_code
    and iu.expiry_date  is not distinct from source_row.expiry_date
  order by iu.created_at, iu.id
  limit 1
  for update;

  if merge_candidate_row.id is not null then
    merge_applied              := true;
    target_inventory_unit_uuid := merge_candidate_row.id;

    update public.inventory_unit iu
    set quantity   = iu.quantity + split_quantity,
        updated_at = occurred_at_utc,
        updated_by = actor_uuid
    where iu.id = merge_candidate_row.id
    returning iu.quantity into target_quantity_after;
  else
    insert into public.inventory_unit (
      tenant_id,
      container_id,
      product_id,
      quantity,
      uom,
      lot_code,
      serial_no,
      expiry_date,
      status,
      created_at,
      updated_at,
      created_by,
      updated_by,
      source_inventory_unit_id
    )
    values (
      source_row.tenant_id,
      target_container_row.id,
      source_row.product_id,
      split_quantity,
      source_row.uom,
      source_row.lot_code,
      source_row.serial_no,
      source_row.expiry_date,
      source_row.status,
      occurred_at_utc,
      occurred_at_utc,
      actor_uuid,
      actor_uuid,
      source_row.id
    )
    returning id, quantity
    into target_inventory_unit_uuid, target_quantity_after;
  end if;

  -- Uses source_row.tenant_id from the authorized row, not a raw param.
  split_movement_uuid := public.insert_stock_movement(
    source_row.tenant_id,
    'split_stock',
    source_location_row.location_id,
    target_location_row.location_id,
    source_row.container_id,
    target_container_row.id,
    source_row.id,
    target_inventory_unit_uuid,
    split_quantity,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'sourceInventoryUnitId', source_row.id,
    'targetInventoryUnitId', target_inventory_unit_uuid,
    'sourceContainerId',     source_row.container_id,
    'targetContainerId',     target_container_row.id,
    'sourceLocationId',      source_location_row.location_id,
    'targetLocationId',      target_location_row.location_id,
    'quantity',              split_quantity,
    'uom',                   source_row.uom,
    'mergeApplied',          merge_applied,
    'sourceQuantity',        source_quantity_after,
    'targetQuantity',        target_quantity_after,
    'movementId',            split_movement_uuid,
    'occurredAt',            occurred_at_utc
  );
end
$$;

-- ============================================================
-- 2. move_container_canonical
--    SECURITY DEFINER + inline auth gate + oracle masking
-- ============================================================

create or replace function public.move_container_canonical(
  container_uuid       uuid,
  target_location_uuid uuid,
  actor_uuid           uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  container_row       record;
  source_location_row record;
  validation_result   jsonb;
  validation_reason   text;
  movement_uuid       uuid;
  occurred_at_utc     timestamptz := timezone('utc', now());
begin
  -- Step 1: Override actor attribution unconditionally.
  actor_uuid := auth.uid();

  -- Step 2: Lock primary resource with inline tenant authorization.
  -- AND can_manage_tenant(...) inside WHERE prevents lock acquisition
  -- on rows the caller is not authorized to access.
  select
    c.id,
    c.tenant_id,
    c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  -- Step 3: Indistinct not-found / unauthorized.
  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.current_location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(container_uuid);

  -- location_can_accept_container runs under SECURITY DEFINER rights,
  -- meaning it reads locations without RLS. The function returns
  -- TENANT_MISMATCH for cross-tenant target locations, which would
  -- confirm to the caller that the UUID is a valid location in another
  -- tenant. Mask TENANT_MISMATCH and LOCATION_NOT_FOUND into a single
  -- indistinct error so cross-tenant location existence cannot be probed.
  validation_result := public.location_can_accept_container(
    target_location_uuid,
    container_uuid
  );
  validation_reason := validation_result ->> 'reason';

  if coalesce((validation_result ->> 'ok')::boolean, false) = false then
    if validation_reason in ('TENANT_MISMATCH', 'LOCATION_NOT_FOUND') then
      raise exception 'TARGET_LOCATION_NOT_FOUND';
    end if;
    raise exception '%', validation_reason;
  end if;

  -- DML uses container_row.tenant_id from the authorized row.
  update public.containers
  set current_location_id         = target_location_uuid,
      current_location_entered_at = occurred_at_utc,
      updated_at                  = occurred_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  perform public.sync_container_placement_projection(container_uuid, actor_uuid);

  movement_uuid := public.insert_stock_movement(
    container_row.tenant_id,
    'move_container',
    source_location_row.location_id,
    target_location_uuid,
    container_uuid,
    container_uuid,
    null,
    null,
    null,
    null,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'containerId',      container_uuid,
    'sourceLocationId', source_location_row.location_id,
    'targetLocationId', target_location_uuid,
    'movementId',       movement_uuid,
    'occurredAt',       occurred_at_utc
  );
end
$$;

-- ============================================================
-- 3. transfer_inventory_unit
--    SECURITY DEFINER + actor override
--    Authorization delegated to hardened split_inventory_unit
--    occurredAt reused from split result, not a fresh now()
-- ============================================================

create or replace function public.transfer_inventory_unit(
  source_inventory_unit_uuid uuid,
  quantity                   numeric,
  target_container_uuid      uuid,
  actor_uuid                 uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  split_result           jsonb;
  transfer_movement_uuid uuid;
  split_movement_uuid    uuid;
  source_tenant_uuid     uuid;
  occurred_at_utc        timestamptz;
begin
  -- Step 1: Override actor attribution unconditionally.
  actor_uuid := auth.uid();

  -- Authorization is handled inside the hardened split_inventory_unit.
  -- split_inventory_unit is the unconditional first operation; any auth
  -- failure raises an exception and aborts here with no DML executed.
  split_result := public.split_inventory_unit(
    source_inventory_unit_uuid,
    quantity,
    target_container_uuid,
    actor_uuid
  );

  -- Reuse the timestamp from the split so both movement records
  -- share the same occurredAt rather than drifting to a later now().
  occurred_at_utc := (split_result ->> 'occurredAt')::timestamptz;

  select iu.tenant_id
  into source_tenant_uuid
  from public.inventory_unit iu
  where iu.id = (split_result ->> 'sourceInventoryUnitId')::uuid;

  split_movement_uuid := (split_result ->> 'movementId')::uuid;

  transfer_movement_uuid := public.insert_stock_movement(
    source_tenant_uuid,
    'transfer_stock',
    (split_result ->> 'sourceLocationId')::uuid,
    (split_result ->> 'targetLocationId')::uuid,
    (split_result ->> 'sourceContainerId')::uuid,
    (split_result ->> 'targetContainerId')::uuid,
    (split_result ->> 'sourceInventoryUnitId')::uuid,
    (split_result ->> 'targetInventoryUnitId')::uuid,
    (split_result ->> 'quantity')::numeric,
    split_result ->> 'uom',
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return split_result || jsonb_build_object(
    'splitMovementId',    split_movement_uuid,
    'transferMovementId', transfer_movement_uuid
  );
end
$$;

-- ============================================================
-- 4. pick_partial_inventory_unit
--    SECURITY DEFINER + actor override
--    Authorization delegated to hardened split_inventory_unit
--    occurredAt reused from split result, not a fresh now()
-- ============================================================

create or replace function public.pick_partial_inventory_unit(
  source_inventory_unit_uuid uuid,
  quantity                   numeric,
  pick_container_uuid        uuid,
  actor_uuid                 uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  split_result        jsonb;
  pick_movement_uuid  uuid;
  split_movement_uuid uuid;
  source_tenant_uuid  uuid;
  occurred_at_utc     timestamptz;
begin
  -- Step 1: Override actor attribution unconditionally.
  actor_uuid := auth.uid();

  -- Authorization is handled inside the hardened split_inventory_unit.
  split_result := public.split_inventory_unit(
    source_inventory_unit_uuid,
    quantity,
    pick_container_uuid,
    actor_uuid
  );

  -- Reuse the timestamp from the split so both movement records
  -- share the same occurredAt rather than drifting to a later now().
  occurred_at_utc := (split_result ->> 'occurredAt')::timestamptz;

  select iu.tenant_id
  into source_tenant_uuid
  from public.inventory_unit iu
  where iu.id = (split_result ->> 'sourceInventoryUnitId')::uuid;

  split_movement_uuid := (split_result ->> 'movementId')::uuid;

  pick_movement_uuid := public.insert_stock_movement(
    source_tenant_uuid,
    'pick_partial',
    (split_result ->> 'sourceLocationId')::uuid,
    (split_result ->> 'targetLocationId')::uuid,
    (split_result ->> 'sourceContainerId')::uuid,
    (split_result ->> 'targetContainerId')::uuid,
    (split_result ->> 'sourceInventoryUnitId')::uuid,
    (split_result ->> 'targetInventoryUnitId')::uuid,
    (split_result ->> 'quantity')::numeric,
    split_result ->> 'uom',
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return split_result || jsonb_build_object(
    'splitMovementId',    split_movement_uuid,
    'transferMovementId', pick_movement_uuid
  );
end
$$;

-- ============================================================
-- 5. remove_container
--    REMAINS INVOKER — do not add security definer
--    Canonical placement truth: containers.current_location_id
--    Works for both rack-backed and non-rack current locations
-- ============================================================

create or replace function public.remove_container(
  container_uuid uuid,
  actor_uuid     uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  container_row        record;
  location_row         record;
  active_placement_id  uuid;
  removed_at_utc       timestamptz := timezone('utc', now());
begin
  -- Step 1: Override actor attribution unconditionally.
  actor_uuid := auth.uid();

  -- Step 2: Lock primary resource with inline tenant authorization.
  -- Under INVOKER the UPDATE is also protected by containers_update_scoped
  -- RLS. The inline can_manage_tenant here makes the auth boundary explicit
  -- and safe if this function is ever reviewed for SECURITY DEFINER promotion.
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
  -- Do not consult container_placements to determine whether the
  -- container is placed — that is the projection, not the truth.
  if container_row.current_location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  -- Read floor_id and geometry_slot_id from the canonical location.
  -- locations.floor_id is NOT NULL (0034), so floor_id is always present.
  -- geometry_slot_id is null for non-rack locations (floor, staging, dock,
  -- buffer) and non-null for rack_slot locations.
  select l.floor_id, l.geometry_slot_id
  into location_row
  from public.locations l
  where l.id = container_row.current_location_id;

  -- Hard guard: current_location_id references locations via FK ON DELETE
  -- RESTRICT (0040), so a missing location row indicates data drift.
  -- Fail explicitly rather than proceeding with nulls and producing a
  -- partially-valid remove or a cryptic NOT NULL violation downstream.
  if location_row.floor_id is null then
    raise exception 'CURRENT_LOCATION_NOT_FOUND';
  end if;

  -- Close any active container_placements record.
  -- This syncs the projection for rack-backed locations.
  -- For non-rack locations no active placement row will exist; the
  -- UPDATE affects zero rows, which is correct and not an error.
  update public.container_placements
  set removed_at = removed_at_utc,
      removed_by = actor_uuid
  where container_id = container_uuid
    and removed_at is null
  returning id into active_placement_id;

  -- Clear canonical placement state on the container.
  update public.containers
  set current_location_id         = null,
      current_location_entered_at = null,
      updated_at                  = removed_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  -- Emit movement event.
  -- floor_id comes from the location directly, so this works for both
  -- rack-backed and non-rack current locations.
  -- from_cell_id is location_row.geometry_slot_id: non-null for rack_slot,
  -- null for all other location types. movement_events.from_cell_id is
  -- nullable so both cases are valid.
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

-- ============================================================
-- 6. Revoke direct helper access from authenticated and PUBLIC
--    Applied last so no window exists where helpers are revoked
--    but their SECURITY DEFINER callers are not yet in place.
--
--    Revoke from PUBLIC (not just authenticated) because a REVOKE
--    from a specific role does not override an inherited PUBLIC grant.
--    Without revoking PUBLIC, authenticated still has EXECUTE via
--    the implicit PUBLIC role membership.
-- ============================================================

revoke execute on function public.insert_stock_movement(
  uuid, text, uuid, uuid, uuid, uuid, uuid, uuid,
  numeric, text, text, timestamptz, timestamptz, uuid
) from public, authenticated;

revoke execute on function public.sync_container_placement_projection(uuid, uuid)
from public, authenticated;
