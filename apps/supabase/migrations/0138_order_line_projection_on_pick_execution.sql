-- 0138_order_line_projection_on_pick_execution.sql
--
-- After execute_pick_step, skip_pick_step, and allocate_pick_steps
-- (needs_replenishment branch), recalculate order_lines.qty_picked
-- and order_lines.status by aggregating across all linked pick_steps.
--
-- Design:
--   - Internal helper _recalculate_order_line_projection locks the
--     order_line (FOR UPDATE) to serialize concurrent projection writes
--     when multiple steps belong to the same line.
--   - execute_pick_step, skip_pick_step, and allocate_pick_steps call
--     the helper after mutating step status.
--   - Status precedence:
--       1. SUM(qty_picked) >= qty_required  →  picked
--       2. any step has 'exception'          →  exception
--       3. any step has 'needs_replenishment' → exception
--       4. SUM(qty_picked) > 0               →  partial
--       5. all steps are 'skipped'           →  skipped
--       6. no terminal statuses exist yet    →  released
--       7. otherwise                         →  preserve current

-- ── Internal helper ─────────────────────────────────────────────────────────

create or replace function public._recalculate_order_line_projection(
  line_uuid uuid
)
returns void
language plpgsql
as $$
declare
  new_qty_picked int;
  new_status     text;
  current_status     text;
  line_qty_required  int;
begin
  select ol.status, ol.qty_required
  into   current_status, line_qty_required
  from   public.order_lines ol
  where  ol.id = line_uuid
  for    update;

  if current_status is null then
    return;
  end if;

  select
    coalesce(sum(ps.qty_picked), 0),
    case
      when coalesce(sum(ps.qty_picked), 0) >= line_qty_required
        then 'picked'
      when bool_or(ps.status = 'exception')
        then 'exception'
      when bool_or(ps.status = 'needs_replenishment')
        then 'exception'
      when coalesce(sum(ps.qty_picked), 0) > 0
        then 'partial'
      when count(*) > 0 and bool_and(ps.status = 'skipped')
        then 'skipped'
      when count(*) > 0 and not bool_or(ps.status in ('picked', 'partial', 'skipped', 'exception', 'needs_replenishment'))
        then 'released'
      else current_status
    end
  into new_qty_picked, new_status
  from public.pick_steps ps
  where ps.order_line_id = line_uuid;

  update public.order_lines
  set    qty_picked = new_qty_picked,
         status     = new_status
  where  id = line_uuid;
end;
$$;

-- Not callable from client roles — internal helper only.
revoke execute on function public._recalculate_order_line_projection(uuid)
  from public, anon, authenticated;

-- ── execute_pick_step ───────────────────────────────────────────────────────

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

  if step_row.order_line_id is not null then
    perform public._recalculate_order_line_projection(step_row.order_line_id);
  end if;

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

grant execute on function public.execute_pick_step(uuid, int, uuid, uuid)
  to authenticated;

-- ── skip_pick_step ──────────────────────────────────────────────────────────

create or replace function public.skip_pick_step(
  step_uuid  uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  step_row                    record;
  task_row                    record;
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
    ps.status
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

  update public.pick_steps
  set
    status      = 'skipped',
    qty_picked  = 0,
    executed_at = now_utc,
    executed_by = coalesce(actor_uuid, auth.uid())
  where id = step_uuid;

  if step_row.order_line_id is not null then
    perform public._recalculate_order_line_projection(step_row.order_line_id);
  end if;

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
  set
    status       = new_task_status,
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
      where id        = task_row.source_id
        and tenant_id = task_row.tenant_id;
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
    'stepId',      step_uuid,
    'status',      'skipped',
    'qtyPicked',   0,
    'taskId',      task_row.id,
    'taskStatus',  new_task_status,
    'orderStatus', new_order_status,
    'waveStatus',  new_wave_status,
    'movementId',  null
  );
end;
$$;

grant execute on function public.skip_pick_step(uuid, uuid)
  to authenticated;

-- ── allocate_pick_steps ─────────────────────────────────────────────────────
-- Only the needs_replenishment branch is extended — allocation logic is unchanged.

create or replace function public.allocate_pick_steps(task_uuid uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  task_row            record;
  step_row            record;
  iu_row              record;
  allocated_count     int := 0;
  replenishment_count int := 0;
begin
  select pt.id, pt.tenant_id
  into   task_row
  from   public.pick_tasks pt
  where  pt.id = task_uuid
    and  public.can_manage_tenant(pt.tenant_id);

  if task_row.id is null then
    raise exception 'PICK_TASK_NOT_FOUND';
  end if;

  for step_row in
    select
      ps.id             as step_id,
      ps.order_line_id,
      ps.qty_required,
      ol.product_id
    from  public.pick_steps  ps
    join  public.order_lines ol on ol.id = ps.order_line_id
    where ps.task_id            = task_uuid
      and ps.status             = 'pending'
      and ps.inventory_unit_id  is null
      and ol.product_id         is not null
    order by ps.sequence_no
  loop
    select
      iu.id              as inventory_unit_id,
      iu.container_id    as source_container_id,
      l.id               as source_location_id,
      l.geometry_slot_id as source_cell_id
    into iu_row
    from  public.inventory_unit           iu
    join  public.containers               c
      on  c.id                  = iu.container_id
     and  c.tenant_id           = task_row.tenant_id
     and  c.current_location_id is not null
    join  public.locations                l
      on  l.id                  = c.current_location_id
     and  l.tenant_id           = task_row.tenant_id
     and  l.status              = 'active'
    join  public.product_location_roles   plr
      on  plr.location_id       = l.id
     and  plr.product_id        = step_row.product_id
     and  plr.role              = 'primary_pick'
     and  plr.state             = 'published'
     and  plr.tenant_id         = task_row.tenant_id
    where iu.product_id         = step_row.product_id
      and iu.status             = 'available'
      and iu.quantity           >= step_row.qty_required
      and iu.tenant_id          = task_row.tenant_id
    order by iu.created_at asc
    limit 1
    for update of iu skip locked;

    if iu_row.inventory_unit_id is null then
      update public.pick_steps
      set    status = 'needs_replenishment'
      where  id     = step_row.step_id;

      if step_row.order_line_id is not null then
        perform public._recalculate_order_line_projection(step_row.order_line_id);
      end if;

      replenishment_count := replenishment_count + 1;
    else
      update public.pick_steps
      set
        inventory_unit_id   = iu_row.inventory_unit_id,
        source_container_id = iu_row.source_container_id,
        source_location_id  = iu_row.source_location_id,
        source_cell_id      = iu_row.source_cell_id
      where id = step_row.step_id;

      if step_row.order_line_id is not null then
        perform public._recalculate_order_line_projection(step_row.order_line_id);
      end if;

      allocated_count := allocated_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'taskId',             task_uuid,
    'allocated',          allocated_count,
    'needsReplenishment', replenishment_count
  );
end
$$;

grant execute on function public.allocate_pick_steps(uuid)
  to authenticated;
