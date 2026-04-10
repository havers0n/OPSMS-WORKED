-- 0076_execute_pick_step.sql
-- PR3: execute_pick_step RPC + supporting schema and helper
--
-- Overview
-- ────────
-- This migration ships the canonical execution path for step-based picking:
--
--   allocated step  →  execute_pick_step()  →  terminal step + rollup
--
-- Three things land here:
--   1. Audit columns on pick_steps:   executed_at, executed_by
--   2. pick_full_inventory_unit():    handles the full-depletion case that
--                                     split_inventory_unit() intentionally blocks
--   3. execute_pick_step():           orchestration RPC that a BFF picker route
--                                     calls once per physical pick action
--
-- Status rollup (MVP, all terminal-for-rollup)
-- ─────────────────────────────────────────────
-- Terminal step states: picked | partial | skipped | exception | needs_replenishment
-- Task:   all terminal → completed (all picked) or completed_with_exceptions
-- Order:  all tasks terminal → picked (all completed) or partial
-- Wave:   all order tasks terminal → completed (all completed) or partial
--
-- What this migration does NOT do
-- ────────────────────────────────
-- • No retry/reopen/top-up semantics
-- • No replenishment workflow
-- • No QR/session claim
-- • No UI changes

-- ── 1. Schema additions ───────────────────────────────────────────────────────

alter table public.pick_steps
  add column if not exists executed_at timestamptz null;

alter table public.pick_steps
  add column if not exists executed_by uuid null
    references public.profiles(id) on delete set null;

create index if not exists pick_steps_executed_at_idx
  on public.pick_steps(task_id, executed_at)
  where executed_at is not null;

-- ── 2. pick_full_inventory_unit ───────────────────────────────────────────────
--
-- Handles the full-depletion case where qty_to_pick equals the source unit's
-- entire quantity.  split_inventory_unit() rejects split_quantity >= quantity,
-- so we cannot use it here.
--
-- Approach: move the inventory_unit wholesale into the pick container by
-- updating its container_id, then record a pick_partial stock movement.
--
-- Movement ordering: the pick_partial movement is inserted BEFORE the
-- container_id update so that the stock_movements row-trigger can verify that
-- source_inventory_unit.container_id == source_container_id (which is only
-- true while the IU still lives in its original container).

create or replace function public.pick_full_inventory_unit(
  source_inventory_unit_uuid uuid,
  pick_container_uuid        uuid,
  actor_uuid                 uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  source_row          record;
  pick_container_row  record;
  source_location_row record;
  pick_location_row   record;
  pick_movement_uuid  uuid;
  occurred_at_utc     timestamptz := timezone('utc', now());
begin
  -- Lock the source inventory unit
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
  for update;

  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  if source_row.quantity <= 0 then
    raise exception 'INVALID_SPLIT_QUANTITY';
  end if;

  -- Lock pick container and validate
  select c.id, c.tenant_id
  into pick_container_row
  from public.containers c
  where c.id = pick_container_uuid
  for update;

  if pick_container_row.id is null then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  if pick_container_row.tenant_id <> source_row.tenant_id then
    raise exception 'TARGET_CONTAINER_TENANT_MISMATCH';
  end if;

  if pick_container_row.id = source_row.container_id then
    raise exception 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER';
  end if;

  -- Resolve locations for the movement record
  select * into source_location_row
  from public.resolve_active_location_for_container(source_row.container_id);

  select * into pick_location_row
  from public.resolve_active_location_for_container(pick_container_row.id);

  -- Insert pick_partial movement BEFORE updating container_id.
  -- The stock_movements trigger validates that source_inventory_unit.container_id
  -- matches source_container_id.  This is only true while the IU is still in
  -- its original container, so the movement must be written first.
  pick_movement_uuid := public.insert_stock_movement(
    source_row.tenant_id,
    'pick_partial',
    source_location_row.location_id,   -- source location (may be null if unplaced)
    pick_location_row.location_id,     -- target location (may be null if unplaced)
    source_row.container_id,           -- source container (current home of the IU)
    pick_container_uuid,               -- pick container (destination)
    source_row.id,                     -- source IU (still at source_container at this point)
    null,                              -- no separate target IU; same row is being moved
    source_row.quantity,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  -- Now reassign the inventory unit to the pick container
  update public.inventory_unit
  set container_id = pick_container_uuid,
      updated_at   = occurred_at_utc,
      updated_by   = actor_uuid
  where id = source_row.id;

  return jsonb_build_object(
    'sourceInventoryUnitId', source_row.id,
    'targetInventoryUnitId', source_row.id,   -- same row; now lives in pick container
    'sourceContainerId',     source_row.container_id,
    'targetContainerId',     pick_container_uuid,
    'sourceLocationId',      source_location_row.location_id,
    'targetLocationId',      pick_location_row.location_id,
    'quantity',              source_row.quantity,
    'uom',                   source_row.uom,
    'mergeApplied',          false,
    'transferMovementId',    pick_movement_uuid,
    'occurredAt',            occurred_at_utc
  );
end
$$;

grant execute on function public.pick_full_inventory_unit(uuid, uuid, uuid) to authenticated;

-- ── 3. execute_pick_step ──────────────────────────────────────────────────────
--
-- Signature:
--   execute_pick_step(step_uuid, qty_actual, pick_container_uuid, actor_uuid)
--
-- Parameters:
--   step_uuid          – the pick_step to execute
--   qty_actual         – physical quantity the picker is actually taking
--   pick_container_uuid – the picker's tote/cart container (destination)
--   actor_uuid         – profile id of the picker (nullable, used for audit)
--
-- Guards (explicit errors):
--   PICK_STEP_NOT_FOUND              – step does not exist / wrong tenant
--   PICK_STEP_NOT_EXECUTABLE         – step is not in 'pending' status
--   PICK_STEP_NOT_ALLOCATED          – step has no inventory_unit_id
--   INVALID_PICK_QUANTITY            – qty_actual <= 0
--   PICK_QUANTITY_EXCEEDS_AVAILABLE  – qty_actual > source unit quantity
--   SOURCE_INVENTORY_UNIT_NOT_FOUND  – IU missing or wrong tenant
--   SOURCE_INVENTORY_UNIT_NOT_AVAILABLE – IU is not in 'available' status
--
-- Inventory path:
--   qty_actual < source_unit.quantity  →  pick_partial_inventory_unit()
--   qty_actual = source_unit.quantity  →  pick_full_inventory_unit()
--
-- Returns JSONB:
--   { stepId, status, qtyPicked, taskId, taskStatus,
--     orderStatus (if changed), waveStatus (if changed), movementId }

create or replace function public.execute_pick_step(
  step_uuid           uuid,
  qty_actual          int,
  pick_container_uuid uuid,
  actor_uuid          uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  step_row                    record;
  task_row                    record;
  iu_row                      record;
  pick_result                 jsonb;
  new_step_status             text;
  new_task_status             text;
  new_order_status            text := null;
  new_wave_status             text := null;
  total_steps                 int;
  terminal_steps              int;
  exception_steps             int;
  order_task_count            int;
  order_terminal_task_count   int;
  order_exception_task_count  int;
  wave_id_val                 uuid := null;
  wave_task_count             int;
  wave_terminal_task_count    int;
  wave_exception_task_count   int;
  now_utc                     timestamptz := timezone('utc', now());
begin
  -- ── Step 1: lock and load the step ─────────────────────────────────────────
  select
    ps.id,
    ps.task_id,
    ps.tenant_id,
    ps.order_id,
    ps.order_line_id,
    ps.inventory_unit_id,
    ps.pick_container_id,
    ps.qty_required,
    ps.qty_picked,
    ps.status,
    ps.source_container_id,
    ps.source_cell_id,
    ps.sequence_no
  into step_row
  from public.pick_steps ps
  where ps.id = step_uuid
  for update;

  if step_row.id is null then
    raise exception 'PICK_STEP_NOT_FOUND';
  end if;

  -- ── Step 2: tenant auth via task ────────────────────────────────────────────
  select
    pt.id,
    pt.tenant_id,
    pt.source_type,
    pt.source_id,
    pt.status
  into task_row
  from public.pick_tasks pt
  where pt.id = step_row.task_id
    and public.can_manage_tenant(pt.tenant_id);

  if task_row.id is null then
    raise exception 'PICK_TASK_NOT_FOUND';
  end if;

  -- ── Step 3: executability guards ───────────────────────────────────────────
  if step_row.status <> 'pending' then
    raise exception 'PICK_STEP_NOT_EXECUTABLE';
  end if;

  if step_row.inventory_unit_id is null then
    raise exception 'PICK_STEP_NOT_ALLOCATED';
  end if;

  if qty_actual <= 0 then
    raise exception 'INVALID_PICK_QUANTITY';
  end if;

  -- ── Step 4: validate source inventory unit ─────────────────────────────────
  select iu.id, iu.quantity, iu.status, iu.tenant_id
  into iu_row
  from public.inventory_unit iu
  where iu.id    = step_row.inventory_unit_id
    and iu.tenant_id = task_row.tenant_id;

  if iu_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  if iu_row.status <> 'available' then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE';
  end if;

  if qty_actual > iu_row.quantity then
    raise exception 'PICK_QUANTITY_EXCEEDS_AVAILABLE';
  end if;

  -- ── Step 5: determine step outcome ─────────────────────────────────────────
  if qty_actual >= step_row.qty_required then
    new_step_status := 'picked';
  else
    new_step_status := 'partial';
  end if;

  -- ── Step 6: execute inventory movement ─────────────────────────────────────
  if qty_actual < iu_row.quantity then
    -- Partial depletion: split quantity into pick container
    pick_result := public.pick_partial_inventory_unit(
      step_row.inventory_unit_id,
      qty_actual::numeric,
      pick_container_uuid,
      actor_uuid
    );
  else
    -- Full depletion: move entire unit to pick container
    pick_result := public.pick_full_inventory_unit(
      step_row.inventory_unit_id,
      pick_container_uuid,
      actor_uuid
    );
  end if;

  -- ── Step 7: update the step ─────────────────────────────────────────────────
  update public.pick_steps
  set status            = new_step_status,
      qty_picked        = qty_actual,
      pick_container_id = pick_container_uuid,
      executed_at       = now_utc,
      executed_by       = actor_uuid
  where id = step_uuid;

  -- ── Step 8: task rollup ─────────────────────────────────────────────────────
  -- Reading step counts AFTER the update above — PostgreSQL read-your-own-writes
  -- guarantees the new status is visible within this transaction.
  select
    count(*)                                                        as total,
    count(*) filter (where status in (
      'picked', 'partial', 'skipped', 'exception', 'needs_replenishment'
    ))                                                              as terminal,
    count(*) filter (where status in (
      'partial', 'skipped', 'exception', 'needs_replenishment'
    ))                                                              as exceptions
  into total_steps, terminal_steps, exception_steps
  from public.pick_steps
  where task_id = task_row.id;

  if terminal_steps = total_steps then
    if exception_steps > 0 then
      new_task_status := 'completed_with_exceptions';
    else
      new_task_status := 'completed';
    end if;
  else
    new_task_status := 'in_progress';
  end if;

  update public.pick_tasks
  set status       = new_task_status,
      started_at   = coalesce(started_at, now_utc),
      completed_at = case
        when new_task_status in ('completed', 'completed_with_exceptions')
        then now_utc
        else completed_at
      end
  where id = task_row.id;

  -- ── Step 9: order rollup ────────────────────────────────────────────────────
  -- Only attempt when the task just became terminal AND it belongs to an order.
  if new_task_status in ('completed', 'completed_with_exceptions')
     and task_row.source_type = 'order'
  then
    select
      count(*),
      count(*) filter (where status in ('completed', 'completed_with_exceptions')),
      count(*) filter (where status = 'completed_with_exceptions')
    into order_task_count, order_terminal_task_count, order_exception_task_count
    from public.pick_tasks
    where source_type = 'order'
      and source_id   = task_row.source_id
      and tenant_id   = task_row.tenant_id;

    if order_terminal_task_count = order_task_count then
      if order_exception_task_count > 0 then
        new_order_status := 'partial';
      else
        new_order_status := 'picked';
      end if;

      update public.orders
      set status = new_order_status
      where id         = task_row.source_id
        and tenant_id  = task_row.tenant_id;
    end if;
  end if;

  -- ── Step 10: wave rollup ────────────────────────────────────────────────────
  -- Only attempt when the order just transitioned to a terminal state.
  if new_order_status is not null then
    select o.wave_id
    into wave_id_val
    from public.orders o
    where o.id        = task_row.source_id
      and o.tenant_id = task_row.tenant_id;

    if wave_id_val is not null then
      -- Count all pick tasks whose source order belongs to this wave.
      select
        count(pt.id),
        count(pt.id) filter (where pt.status in ('completed', 'completed_with_exceptions')),
        count(pt.id) filter (where pt.status = 'completed_with_exceptions')
      into wave_task_count, wave_terminal_task_count, wave_exception_task_count
      from public.pick_tasks pt
      join public.orders o
        on  pt.source_type = 'order'
        and pt.source_id   = o.id
        and o.wave_id      = wave_id_val
      where pt.tenant_id = task_row.tenant_id;

      if wave_task_count > 0 and wave_terminal_task_count = wave_task_count then
        if wave_exception_task_count > 0 then
          new_wave_status := 'partial';
        else
          new_wave_status := 'completed';
        end if;

        update public.waves
        set status = new_wave_status
        where id        = wave_id_val
          and tenant_id = task_row.tenant_id;
      end if;
    end if;
  end if;

  -- ── Return ─────────────────────────────────────────────────────────────────
  return jsonb_build_object(
    'stepId',       step_uuid,
    'status',       new_step_status,
    'qtyPicked',    qty_actual,
    'taskId',       task_row.id,
    'taskStatus',   new_task_status,
    'orderStatus',  new_order_status,
    'waveStatus',   new_wave_status,
    'movementId',   pick_result ->> 'transferMovementId'
  );
end
$$;

grant execute on function public.execute_pick_step(uuid, int, uuid, uuid) to authenticated;
