-- 0075_allocate_pick_steps.sql
-- PR2: allocate_pick_steps RPC
--
-- Resolves every unallocated pending pick step in a released task into a
-- concrete source: the exact inventory_unit, container, and cell from which
-- the picker should pull the item.
--
-- Allocation policy (v1)
-- ──────────────────────
-- • Only rows in product_location_roles with role = 'primary_pick' and
--   state = 'published' are eligible sources.
-- • A single inventory_unit must have quantity >= qty_required.
--   Multi-source allocation across multiple units is not supported in v1.
-- • No reserve fallback.  No "pick from anywhere" fallback.
-- • FIFO: inventory_unit with the oldest created_at wins.
-- • If no eligible unit is found, the step becomes needs_replenishment.
--
-- Join path (base tables only, no views)
-- ──────────────────────────────────────
-- The query joins through base tables rather than active_container_locations_v
-- because FOR UPDATE must target a base table alias.  The join path mirrors
-- the view definition:
--   inventory_unit
--   → containers.current_location_id   (canonical placement truth, 0046/0054)
--   → locations
--   → product_location_roles (primary_pick, published)
-- Source cell is read from locations.geometry_slot_id (NULL for non-rack-slot
-- location types such as floor/staging, which is valid and expected).
--
-- Locking / concurrency
-- ─────────────────────
-- FOR UPDATE OF iu SKIP LOCKED is placed on inventory_unit rows only.
-- When two concurrent calls to allocate_pick_steps race for the same unit,
-- the second call skips that row and moves to the next FIFO candidate.
-- This prevents double-allocation without causing deadlocks or blocking waits.
-- The trade-off: if SKIP LOCKED exhausts all candidates, the step becomes
-- needs_replenishment even if stock exists (it is momentarily locked).
-- In practice this window is sub-millisecond; at that point re-running
-- allocation will succeed.
--
-- Idempotency
-- ───────────
-- Steps where inventory_unit_id IS NOT NULL are skipped — safe to re-run.
-- Steps already at needs_replenishment are also skipped.
--
-- Security
-- ────────
-- SECURITY DEFINER: RLS is bypassed internally; tenant isolation is enforced
-- manually via can_manage_tenant() on the task row.  The caller must be a
-- tenant manager for the mutation to proceed.

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
  -- Validate: task must exist and caller must be a tenant manager.
  select pt.id, pt.tenant_id
  into   task_row
  from   public.pick_tasks pt
  where  pt.id = task_uuid
    and  public.can_manage_tenant(pt.tenant_id);

  if task_row.id is null then
    raise exception 'PICK_TASK_NOT_FOUND';
  end if;

  -- Process each pending, unallocated step in sequence_no order.
  -- Steps without a resolvable product_id (null on the order_line) are
  -- excluded from this loop; they remain pending until product resolution
  -- is corrected upstream.
  for step_row in
    select
      ps.id          as step_id,
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

    -- Find the best available inventory_unit for this product in a
    -- published primary_pick location.
    --
    -- SKIP LOCKED: if a concurrent allocate_pick_steps call for another task
    -- has already locked this inventory_unit row, skip it and try the next
    -- FIFO candidate instead of blocking.
    select
      iu.id              as inventory_unit_id,
      iu.container_id    as source_container_id,
      l.geometry_slot_id as source_cell_id
    into iu_row
    from  public.inventory_unit           iu
    join  public.containers               c
      on  c.id                 = iu.container_id
     and  c.tenant_id          = task_row.tenant_id
     and  c.current_location_id is not null
    join  public.locations                l
      on  l.id                 = c.current_location_id
     and  l.tenant_id          = task_row.tenant_id
     and  l.status             = 'active'
    join  public.product_location_roles   plr
      on  plr.location_id      = l.id
     and  plr.product_id       = step_row.product_id
     and  plr.role             = 'primary_pick'
     and  plr.state            = 'published'
     and  plr.tenant_id        = task_row.tenant_id
    where iu.product_id        = step_row.product_id
      and iu.status            = 'available'
      and iu.quantity          >= step_row.qty_required
      and iu.tenant_id         = task_row.tenant_id
    order by iu.created_at asc
    limit 1
    for update of iu skip locked;

    if iu_row.inventory_unit_id is null then
      -- No eligible stock in any primary_pick location for this product.
      update public.pick_steps
      set    status = 'needs_replenishment'
      where  id     = step_row.step_id;

      replenishment_count := replenishment_count + 1;
    else
      -- Write source truth onto the step.
      -- inventory_unit_id links execution (PR3) to the exact unit to pick.
      update public.pick_steps
      set
        inventory_unit_id   = iu_row.inventory_unit_id,
        source_container_id = iu_row.source_container_id,
        source_cell_id      = iu_row.source_cell_id
      where id = step_row.step_id;

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

grant execute on function public.allocate_pick_steps(uuid) to authenticated;
