-- 20260609231314_add_order_pick_container_lifecycle_rpcs.sql
--
-- PR2: Transactional order-bound multi-pallet lifecycle RPCs and the
-- canonical execute_pick_step destination guard.
--
-- This migration is purely DB-level (no BFF, TypeScript, or frontend).
--
-- Four RPCs:
--   A. resolve_or_create_order_pick_container
--   B. bind_manual_order_pick_container
--   C. seal_and_rotate_order_pick_container
--   D. finalize_order_pick_container
--
-- Plus: updated execute_pick_step with destination-container guard.
--
-- Wave-origin gate: all four lifecycle RPCs reject orders whose
-- wave_id IS NOT NULL.  execute_pick_step preserves existing wave
-- behaviour by only applying the guard to standalone orders.

-- ============================================================
-- Internal helper: resolve tenant default pick container type
-- ============================================================

create or replace function public._resolve_tenant_default_pick_container_type(
  p_tenant_id uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_default_type_id uuid;
  v_type_row record;
begin
  select tps.default_pick_container_type_id
  into v_default_type_id
  from public.tenant_picking_settings tps
  where tps.tenant_id = p_tenant_id;

  if v_default_type_id is null then
    raise exception 'DEFAULT_PICK_CONTAINER_TYPE_NOT_CONFIGURED';
  end if;

  select id, supports_picking
  into v_type_row
  from public.container_types
  where id = v_default_type_id;

  if v_type_row.id is null then
    raise exception 'DEFAULT_PICK_CONTAINER_TYPE_NOT_FOUND';
  end if;

  if not v_type_row.supports_picking then
    raise exception 'DEFAULT_PICK_CONTAINER_TYPE_MUST_SUPPORT_PICKING';
  end if;

  return v_default_type_id;
end;
$$;

revoke execute on function public._resolve_tenant_default_pick_container_type(uuid)
  from public, anon, authenticated;

-- ============================================================
-- RPC A: resolve_or_create_order_pick_container
-- ============================================================
--
-- Purpose: standalone order  →  return current active pallet
--                               or create and bind one from tenant default policy
--
-- Idempotency: two simultaneous resolve calls → one physical pallet created
--   → both callers receive the same active assignment.
--   The order-row FOR UPDATE lock serialises concurrent callers; the
--   order_pick_containers_active_order_unique partial index is the final
--   protection layer.
--
-- Rejects: wave-origin orders, terminal statuses, pre-released statuses.

create or replace function public.resolve_or_create_order_pick_container(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_uuid        uuid := auth.uid();
  v_order_row         record;
  v_active_assignment record;
  v_default_type_id   uuid;
  v_container_id      uuid;
  v_sequence_number   int;
  v_assignment_id     uuid;
begin
  select o.id, o.tenant_id, o.status, o.wave_id
  into v_order_row
  from public.orders o
  where o.id = p_order_id
    and public.can_manage_tenant(o.tenant_id)
  for update;

  if v_order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order_row.wave_id is not null then
    raise exception 'ORDER_BELONGS_TO_WAVE';
  end if;

  if v_order_row.status not in ('released', 'picking') then
    raise exception 'ORDER_NOT_ELIGIBLE_FOR_PICK_CONTAINER';
  end if;

  select opc.id, opc.container_id, opc.sequence_number, opc.status
  into v_active_assignment
  from public.order_pick_containers opc
  where opc.tenant_id = v_order_row.tenant_id
    and opc.order_id  = v_order_row.id
    and opc.status    = 'active'
  for update of opc;

  if v_active_assignment.id is not null then
    return jsonb_build_object(
      'assignmentId',   v_active_assignment.id,
      'containerId',    v_active_assignment.container_id,
      'sequenceNumber', v_active_assignment.sequence_number,
      'status',         v_active_assignment.status,
      'created',        false
    );
  end if;

  v_default_type_id := public._resolve_tenant_default_pick_container_type(v_order_row.tenant_id);

  insert into public.containers (
    tenant_id, container_type_id, status, operational_role, created_by, updated_by
  ) values (
    v_order_row.tenant_id, v_default_type_id, 'active', 'pick', v_actor_uuid, v_actor_uuid
  ) returning id into v_container_id;

  select coalesce(max(opc.sequence_number), 0) + 1
  into v_sequence_number
  from public.order_pick_containers opc
  where opc.tenant_id = v_order_row.tenant_id
    and opc.order_id  = v_order_row.id;

  insert into public.order_pick_containers (
    tenant_id, order_id, container_id, sequence_number, status, opened_by
  ) values (
    v_order_row.tenant_id, v_order_row.id, v_container_id, v_sequence_number, 'active', v_actor_uuid
  ) returning id into v_assignment_id;

  return jsonb_build_object(
    'assignmentId',   v_assignment_id,
    'containerId',    v_container_id,
    'sequenceNumber', v_sequence_number,
    'status',         'active',
    'created',        true
  );
end;
$$;

-- ============================================================
-- RPC B: bind_manual_order_pick_container
-- ============================================================
--
-- Purpose: manual fallback when no default policy exists
--          → canonically bind a worker-selected or newly-created pallet
--
-- If current order already has an active pallet:
--   - return existing active assignment if candidate matches;
--   - otherwise reject with ORDER_ALREADY_HAS_ACTIVE_ASSIGNMENT.
--
-- No silent replacement.  Replacement after picks belongs to rotate flow.

create or replace function public.bind_manual_order_pick_container(
  p_order_id      uuid,
  p_container_id  uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_uuid        uuid := auth.uid();
  v_order_row         record;
  v_container_row     record;
  v_existing_active   record;
  v_assignment_id     uuid;
  v_sequence_number   int;
  v_has_inventory     boolean;
begin
  select o.id, o.tenant_id, o.status, o.wave_id
  into v_order_row
  from public.orders o
  where o.id = p_order_id
    and public.can_manage_tenant(o.tenant_id)
  for update;

  if v_order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order_row.wave_id is not null then
    raise exception 'ORDER_BELONGS_TO_WAVE';
  end if;

  if v_order_row.status not in ('released', 'picking') then
    raise exception 'ORDER_NOT_ELIGIBLE_FOR_PICK_CONTAINER';
  end if;

  select c.id, c.tenant_id, c.status, c.operational_role, c.container_type_id
  into v_container_row
  from public.containers c
  where c.id = p_container_id;

  if v_container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if v_container_row.tenant_id <> v_order_row.tenant_id then
    raise exception 'CONTAINER_TENANT_MISMATCH';
  end if;

  if v_container_row.status <> 'active' then
    raise exception 'CONTAINER_NOT_ACTIVE';
  end if;

  if v_container_row.operational_role <> 'pick' then
    raise exception 'CONTAINER_NOT_PICK_ROLE';
  end if;

  if not exists (
    select 1 from public.container_types ct
    where ct.id = v_container_row.container_type_id
      and ct.supports_picking = true
  ) then
    raise exception 'CONTAINER_TYPE_DOES_NOT_SUPPORT_PICKING';
  end if;

  if exists (
    select 1 from public.order_pick_containers opc
    where opc.tenant_id     = v_order_row.tenant_id
      and opc.container_id  = p_container_id
      and opc.status        = 'active'
      and opc.order_id     <> v_order_row.id
  ) then
    raise exception 'CONTAINER_ALREADY_ASSIGNED_TO_ANOTHER_ORDER';
  end if;

  select exists (
    select 1
    from public.container_lines cl
    where cl.current_container_id = p_container_id
      and cl.tenant_id            = v_order_row.tenant_id
      and cl.current_qty_each     > 0
    limit 1
  ) into v_has_inventory;

  if v_has_inventory then
    raise exception 'CONTAINER_NOT_EMPTY';
  end if;

  select opc.id, opc.container_id
  into v_existing_active
  from public.order_pick_containers opc
  where opc.tenant_id = v_order_row.tenant_id
    and opc.order_id  = v_order_row.id
    and opc.status    = 'active'
  for update of opc;

  if v_existing_active.id is not null then
    if v_existing_active.container_id = p_container_id then
      return jsonb_build_object(
        'assignmentId', v_existing_active.id,
        'containerId',  p_container_id,
        'status',       'active',
        'matched',      true
      );
    end if;

    raise exception 'ORDER_ALREADY_HAS_ACTIVE_ASSIGNMENT';
  end if;

  select coalesce(max(opc.sequence_number), 0) + 1
  into v_sequence_number
  from public.order_pick_containers opc
  where opc.tenant_id = v_order_row.tenant_id
    and opc.order_id  = v_order_row.id;

  insert into public.order_pick_containers (
    tenant_id, order_id, container_id, sequence_number, status, opened_by
  ) values (
    v_order_row.tenant_id, v_order_row.id, p_container_id, v_sequence_number, 'active', v_actor_uuid
  ) returning id into v_assignment_id;

  return jsonb_build_object(
    'assignmentId',   v_assignment_id,
    'containerId',    p_container_id,
    'sequenceNumber', v_sequence_number,
    'status',         'active',
    'matched',        false
  );
end;
$$;

-- ============================================================
-- RPC C: seal_and_rotate_order_pick_container
-- ============================================================
--
-- Purpose: worker taps Pallet full
--          → seal current pallet
--          → close physical container
--          → create and bind next pallet
--          → continue same order
--
-- Retry: same request retried after timeout → must not rotate the
--   newly-created pallet again → STALE_EXPECTED_CONTAINER.
--   Frontend will refetch canonical active pallet.
--
-- No fake stock movements for sealing.

create or replace function public.seal_and_rotate_order_pick_container(
  p_order_id                     uuid,
  p_expected_active_container_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_uuid             uuid := auth.uid();
  v_order_row              record;
  v_current_assignment     record;
  v_new_container_id       uuid;
  v_new_assignment_id      uuid;
  v_new_sequence_number    int;
  v_default_type_id        uuid;
  v_now                    timestamptz := timezone('utc', now());
begin
  select o.id, o.tenant_id, o.status, o.wave_id
  into v_order_row
  from public.orders o
  where o.id = p_order_id
    and public.can_manage_tenant(o.tenant_id)
  for update;

  if v_order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order_row.wave_id is not null then
    raise exception 'ORDER_BELONGS_TO_WAVE';
  end if;

  if v_order_row.status not in ('released', 'picking') then
    raise exception 'ORDER_NOT_ELIGIBLE_FOR_PICK_CONTAINER';
  end if;

  select opc.id, opc.container_id, opc.sequence_number, opc.status
  into v_current_assignment
  from public.order_pick_containers opc
  where opc.tenant_id = v_order_row.tenant_id
    and opc.order_id  = v_order_row.id
    and opc.status    = 'active'
  for update of opc;

  if v_current_assignment.id is null then
    raise exception 'NO_ACTIVE_ASSIGNMENT';
  end if;

  if v_current_assignment.container_id <> p_expected_active_container_id then
    raise exception 'STALE_EXPECTED_CONTAINER';
  end if;

  update public.order_pick_containers
  set status     = 'sealed',
      sealed_at  = v_now,
      sealed_by  = v_actor_uuid
  where id = v_current_assignment.id;

  update public.containers
  set status      = 'closed',
      updated_at  = v_now,
      updated_by  = v_actor_uuid
  where id        = v_current_assignment.container_id
    and tenant_id = v_order_row.tenant_id;

  v_default_type_id := public._resolve_tenant_default_pick_container_type(v_order_row.tenant_id);

  insert into public.containers (
    tenant_id, container_type_id, status, operational_role, created_by, updated_by
  ) values (
    v_order_row.tenant_id, v_default_type_id, 'active', 'pick', v_actor_uuid, v_actor_uuid
  ) returning id into v_new_container_id;

  v_new_sequence_number := v_current_assignment.sequence_number + 1;

  insert into public.order_pick_containers (
    tenant_id, order_id, container_id, sequence_number, status, opened_by
  ) values (
    v_order_row.tenant_id, v_order_row.id, v_new_container_id, v_new_sequence_number, 'active', v_actor_uuid
  ) returning id into v_new_assignment_id;

  return jsonb_build_object(
    'sealedAssignmentId', v_current_assignment.id,
    'sealedContainerId',  v_current_assignment.container_id,
    'newAssignmentId',    v_new_assignment_id,
    'newContainerId',     v_new_container_id,
    'newSequenceNumber',  v_new_sequence_number
  );
end;
$$;

-- ============================================================
-- RPC D: finalize_order_pick_container
-- ============================================================
--
-- Purpose: order picking finished
--          → close final active pallet
--          → do not create another pallet
--
-- Eligibility is determined from repository truth:
--   all pick_tasks for the order must be in a terminal status
--   (completed or completed_with_exceptions).

create or replace function public.finalize_order_pick_container(
  p_order_id                     uuid,
  p_expected_active_container_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_uuid             uuid := auth.uid();
  v_order_row              record;
  v_current_assignment     record;
  v_now                    timestamptz := timezone('utc', now());
  v_task_count             int;
  v_terminal_task_count    int;
begin
  select o.id, o.tenant_id, o.status, o.wave_id
  into v_order_row
  from public.orders o
  where o.id = p_order_id
    and public.can_manage_tenant(o.tenant_id)
  for update;

  if v_order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order_row.wave_id is not null then
    raise exception 'ORDER_BELONGS_TO_WAVE';
  end if;

  select
    count(*),
    count(*) filter (where status in ('completed', 'completed_with_exceptions'))
  into v_task_count, v_terminal_task_count
  from public.pick_tasks
  where source_type = 'order'
    and source_id   = v_order_row.id
    and tenant_id   = v_order_row.tenant_id;

  if v_task_count = 0 then
    raise exception 'ORDER_HAS_NO_PICK_TASKS';
  end if;

  if v_terminal_task_count < v_task_count then
    raise exception 'ORDER_PICKING_NOT_COMPLETE';
  end if;

  select opc.id, opc.container_id, opc.sequence_number, opc.status
  into v_current_assignment
  from public.order_pick_containers opc
  where opc.tenant_id = v_order_row.tenant_id
    and opc.order_id  = v_order_row.id
    and opc.status    = 'active'
  for update of opc;

  if v_current_assignment.id is null then
    raise exception 'NO_ACTIVE_ASSIGNMENT';
  end if;

  if v_current_assignment.container_id <> p_expected_active_container_id then
    raise exception 'STALE_EXPECTED_CONTAINER';
  end if;

  update public.order_pick_containers
  set status     = 'sealed',
      sealed_at  = v_now,
      sealed_by  = v_actor_uuid
  where id = v_current_assignment.id;

  update public.containers
  set status      = 'closed',
      updated_at  = v_now,
      updated_by  = v_actor_uuid
  where id        = v_current_assignment.container_id
    and tenant_id = v_order_row.tenant_id;

  return jsonb_build_object(
    'assignmentId',   v_current_assignment.id,
    'containerId',    v_current_assignment.container_id,
    'sequenceNumber', v_current_assignment.sequence_number,
    'status',         'sealed'
  );
end;
$$;

-- ============================================================
-- Updated execute_pick_step with destination container guard
-- ============================================================
--
-- Before destination movement is accepted, require for standalone orders:
--
--   active assignment exists
--   assignment.tenant_id    = step.tenant_id
--   assignment.order_id     = step.order_id
--   assignment.container_id = requested pick container
--   assignment.status       = active
--   physical container: tenant matches, status = active, operational_role = pick
--
-- Wave-origin orders are not affected — existing wave behaviour is preserved.
-- Stale tab after rotate → ORDER_PICK_CONTAINER_NOT_ACCEPTABLE.

drop function if exists public.execute_pick_step(uuid, int, uuid, uuid);

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

  -- ── Destination container guard (standalone orders only) ──────────────
  if pick_container_uuid is not null and step_row.order_id is not null then
    if exists (
      select 1
      from public.orders o
      where o.id        = step_row.order_id
        and o.tenant_id = task_row.tenant_id
        and o.wave_id   is null
    ) then
      -- Reject if this container has a non-active record for this order (sealed/finalized)
      if exists (
        select 1
        from public.order_pick_containers opc
        where opc.tenant_id    = task_row.tenant_id
          and opc.order_id     = step_row.order_id
          and opc.container_id = pick_container_uuid
          and opc.status      <> 'active'
      ) then
        raise exception 'ORDER_PICK_CONTAINER_NOT_ACCEPTABLE';
      end if;

      -- Reject if the order has an active assignment but this container is not it
      if not exists (
        select 1
        from public.order_pick_containers opc
        join public.containers c
          on  c.id        = opc.container_id
          and c.tenant_id = opc.tenant_id
        where opc.tenant_id     = task_row.tenant_id
          and opc.order_id      = step_row.order_id
          and opc.container_id  = pick_container_uuid
          and opc.status        = 'active'
          and c.status          = 'active'
          and c.operational_role = 'pick'
      ) and exists (
        select 1
        from public.order_pick_containers opc
        where opc.tenant_id = task_row.tenant_id
          and opc.order_id  = step_row.order_id
          and opc.status    = 'active'
      ) then
        raise exception 'ORDER_PICK_CONTAINER_NOT_ACCEPTABLE';
      end if;
    end if;
  end if;

  -- ── Temporary compatibility bridge ─────────────────────────
  -- If execution reaches this point for a standalone order with
  -- zero order_pick_containers history (no active, sealed, nor
  -- cancelled assignment), the legacy execute path is preserved.
  -- Remove or gate after canonical picker auto-resolve rollout.
  -- Do not treat as final ownership enforcement.
  -- ────────────────────────────────────────────────────────────

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

-- ============================================================
-- Grants for new RPCs
-- ============================================================

grant execute on function public.resolve_or_create_order_pick_container(uuid)
  to authenticated;

grant execute on function public.bind_manual_order_pick_container(uuid, uuid)
  to authenticated;

grant execute on function public.seal_and_rotate_order_pick_container(uuid, uuid)
  to authenticated;

grant execute on function public.finalize_order_pick_container(uuid, uuid)
  to authenticated;
