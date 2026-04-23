-- 0092_pr4_execute_pick_full_canonical_ownership.sql
--
-- PR4: bounded full-pick execution ownership.
--
-- Scope is intentionally limited to execute_pick_step's full-pick branch.
-- Canonical current-state ownership is moved first in container_lines; the
-- inventory_unit row is synchronized afterward as the execution projection in
-- the same PostgreSQL transaction. The existing pick_partial movement type is
-- preserved for full-pick history as transitional compatibility debt.

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
  source_line_row     public.container_lines%rowtype;
  pick_container_row  record;
  source_location_row record;
  pick_location_row   record;
  source_container_uuid uuid;
  pick_movement_uuid  uuid;
  occurred_at_utc     timestamptz := timezone('utc', now());
begin
  perform public.ensure_inventory_unit_current_container_line(
    source_inventory_unit_uuid,
    actor_uuid
  );

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
    iu.status,
    iu.packaging_state,
    iu.product_packaging_level_id,
    iu.pack_count,
    iu.container_line_id
  into source_row
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid
  for update;

  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  select *
  into source_line_row
  from public.container_lines cl
  where cl.id = source_row.container_line_id
  for update;

  if source_line_row.id is null then
    raise exception 'CONTAINER_LINE_NOT_FOUND';
  end if;

  if source_line_row.current_qty_each is null or source_line_row.current_qty_each <= 0 then
    raise exception 'INVALID_SPLIT_QUANTITY';
  end if;

  if source_line_row.current_inventory_status <> 'available' then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE';
  end if;

  if source_line_row.current_container_id is null then
    raise exception 'CONTAINER_LINE_NOT_FOUND';
  end if;

  source_container_uuid := source_line_row.current_container_id;

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

  if pick_container_row.id = source_container_uuid then
    raise exception 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(source_container_uuid);

  select *
  into pick_location_row
  from public.resolve_active_location_for_container(pick_container_row.id);

  -- Canonical current-state mutation happens first. The row remains active;
  -- full pick transfers its current ownership to the pick container.
  update public.container_lines
  set current_container_id = pick_container_uuid,
      current_qty_each = source_line_row.current_qty_each,
      current_inventory_status = source_line_row.current_inventory_status,
      current_packaging_state = source_line_row.current_packaging_state,
      current_packaging_profile_level_id = source_line_row.current_packaging_profile_level_id,
      current_pack_count = source_line_row.current_pack_count,
      current_updated_at = occurred_at_utc,
      current_updated_by = actor_uuid
  where id = source_line_row.id;

  -- Transitional compatibility debt: full-pick execution continues to write
  -- movement_type='pick_partial' until the movement vocabulary grows a
  -- truthful full-pick type. Keep this before projection sync so the existing
  -- stock_movements trigger can still validate source_inventory_unit.container_id
  -- against the source container.
  pick_movement_uuid := public.insert_stock_movement(
    source_row.tenant_id,
    'pick_partial',
    source_location_row.location_id,
    pick_location_row.location_id,
    source_container_uuid,
    pick_container_uuid,
    source_row.id,
    null,
    source_line_row.current_qty_each,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  -- Projection sync: inventory_unit reflects the canonical current row after
  -- successful completion, but no longer owns physical-content truth here.
  update public.inventory_unit
  set container_id = pick_container_uuid,
      quantity = source_line_row.current_qty_each,
      status = source_line_row.current_inventory_status,
      packaging_state = source_line_row.current_packaging_state,
      pack_count = source_line_row.current_pack_count,
      container_line_id = source_line_row.id,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where id = source_row.id;

  return jsonb_build_object(
    'sourceInventoryUnitId', source_row.id,
    'targetInventoryUnitId', source_row.id,
    'sourceContainerId',     source_container_uuid,
    'targetContainerId',     pick_container_uuid,
    'sourceLocationId',      source_location_row.location_id,
    'targetLocationId',      pick_location_row.location_id,
    'quantity',              source_line_row.current_qty_each,
    'uom',                   source_row.uom,
    'mergeApplied',          false,
    'transferMovementId',    pick_movement_uuid,
    'occurredAt',            occurred_at_utc
  );
end
$$;

grant execute on function public.pick_full_inventory_unit(uuid, uuid, uuid) to authenticated;

create or replace function public.execute_pick_step(
  step_uuid           uuid,
  qty_actual          int,
  pick_container_uuid uuid,
  actor_uuid          uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  if step_row.status <> 'pending' then
    raise exception 'PICK_STEP_NOT_EXECUTABLE';
  end if;

  if step_row.inventory_unit_id is null then
    raise exception 'PICK_STEP_NOT_ALLOCATED';
  end if;

  if qty_actual <= 0 then
    raise exception 'INVALID_PICK_QUANTITY';
  end if;

  perform public.ensure_inventory_unit_current_container_line(
    step_row.inventory_unit_id,
    actor_uuid
  );

  select
    iu.id,
    iu.tenant_id,
    iu.container_line_id,
    cl.current_qty_each as current_qty_each,
    cl.current_inventory_status as current_inventory_status
  into iu_row
  from public.inventory_unit iu
  join public.container_lines cl on cl.id = iu.container_line_id
  where iu.id = step_row.inventory_unit_id
    and iu.tenant_id = task_row.tenant_id
  for update of iu, cl;

  if iu_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  if iu_row.current_inventory_status <> 'available' then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE';
  end if;

  if iu_row.current_qty_each is null or qty_actual > iu_row.current_qty_each then
    raise exception 'PICK_QUANTITY_EXCEEDS_AVAILABLE';
  end if;

  if qty_actual >= step_row.qty_required then
    new_step_status := 'picked';
  else
    new_step_status := 'partial';
  end if;

  if qty_actual < iu_row.current_qty_each then
    pick_result := public.pick_partial_inventory_unit(
      step_row.inventory_unit_id,
      qty_actual::numeric,
      pick_container_uuid,
      actor_uuid
    );
  else
    pick_result := public.pick_full_inventory_unit(
      step_row.inventory_unit_id,
      pick_container_uuid,
      actor_uuid
    );
  end if;

  update public.pick_steps
  set status            = new_step_status,
      qty_picked        = qty_actual,
      pick_container_id = pick_container_uuid,
      executed_at       = now_utc,
      executed_by       = actor_uuid
  where id = step_uuid;

  select
    count(*) as total,
    count(*) filter (where status in (
      'picked', 'partial', 'skipped', 'exception', 'needs_replenishment'
    )) as terminal,
    count(*) filter (where status in (
      'partial', 'skipped', 'exception', 'needs_replenishment'
    )) as exceptions
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

  if new_order_status is not null then
    select o.wave_id
    into wave_id_val
    from public.orders o
    where o.id        = task_row.source_id
      and o.tenant_id = task_row.tenant_id;

    if wave_id_val is not null then
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
