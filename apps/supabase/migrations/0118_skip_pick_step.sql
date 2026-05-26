-- 0118_skip_pick_step.sql
-- PR: picking screens — exception handling
--
-- Adds skip_pick_step() RPC that marks a pending pick step as 'skipped'
-- and propagates the same task / order / wave rollup as execute_pick_step().
--
-- Key differences from execute_pick_step():
--   • No qty_actual or pick_container_uuid — skip is unconditional
--   • No inventory operations — the allocated IU is not moved
--   • Step status is always 'skipped', qty_picked stays 0
--   • movementId in the return object is always null
--
-- Steps in needs_replenishment are already terminal and cannot be skipped.
-- Completed / partial / exception steps also cannot be skipped.

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
  -- 1. Lock and validate step
  select
    ps.id,
    ps.task_id,
    ps.tenant_id,
    ps.order_id,
    ps.status
  into step_row
  from public.pick_steps ps
  where ps.id = step_uuid
  for update;

  if step_row.id is null then
    raise exception 'PICK_STEP_NOT_FOUND';
  end if;

  -- 2. Load task (validates tenant access)
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

  -- 3. Only pending steps can be skipped
  if step_row.status <> 'pending' then
    raise exception 'PICK_STEP_NOT_EXECUTABLE';
  end if;

  -- 4. Mark step as skipped
  update public.pick_steps
  set
    status      = 'skipped',
    qty_picked  = 0,
    executed_at = now_utc,
    executed_by = coalesce(actor_uuid, auth.uid())
  where id = step_uuid;

  -- 5. Task rollup (identical to execute_pick_step)
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

  -- 6. Order rollup (identical to execute_pick_step)
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

  -- 7. Wave rollup (identical to execute_pick_step)
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

grant execute on function public.skip_pick_step(uuid, uuid) to authenticated;
