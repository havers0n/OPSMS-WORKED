-- 0141_allocate_pick_steps_structural_roles.sql
--
-- Fix canonical allocate_pick_steps role resolution to match Picking Planning
-- effective-role semantics.
--
-- Problem
-- -------
-- The allocator used an INNER JOIN on product_location_roles with
-- role = 'primary_pick' AND state = 'published'.  Locations whose only
-- claim to primary_pick was the rack_levels.structural_default_role were
-- invisible, causing valid inventory to be marked needs_replenishment.
--
-- Fix
-- ---
-- Replace the strict explicit-role-only filter with effective-role resolution
-- matching Picking Planning (input-builder.ts:resolveEffectivePickRole):
--
--   For each candidate (product_id, location_id):
--     1. If an explicit published product_location_roles row exists, use its
--        role (overrides structural).
--     2. Otherwise fall back to:
--          locations.geometry_slot_id → cells.id → cells.rack_level_id
--          → rack_levels.structural_default_role
--     3. Effective role must be 'primary_pick'.
--
-- Precedence proof (resolved by COALESCE order):
--   explicit primary_pick + structural reserve → primary_pick → eligible
--   explicit reserve      + structural primary_pick → reserve → NOT eligible
--   absent                + structural primary_pick → primary_pick → eligible
--   absent                + structural reserve      → reserve → NOT eligible
--   absent                + structural none         → none → NOT eligible
--
-- All other existing filters, locking, ordering, and projection helpers are
-- preserved unchanged.

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
      on  c.id                 = iu.container_id
     and  c.tenant_id          = task_row.tenant_id
     and  c.current_location_id is not null
    join  public.locations                l
      on  l.id                 = c.current_location_id
     and  l.tenant_id          = task_row.tenant_id
     and  l.status             = 'active'
    left join  public.cells                  cl
      on  cl.id                 = l.geometry_slot_id
    left join  public.rack_levels            rl
      on  rl.id                 = cl.rack_level_id
    where iu.product_id        = step_row.product_id
      and iu.status            = 'available'
      and iu.quantity          >= step_row.qty_required
      and iu.tenant_id         = task_row.tenant_id
      and coalesce(
            (select plr.role
             from public.product_location_roles plr
             where plr.location_id = l.id
               and plr.product_id = step_row.product_id
               and plr.state = 'published'
               and plr.tenant_id = task_row.tenant_id
             order by plr.role
             limit 1
            ),
            rl.structural_default_role,
            'none'
          ) = 'primary_pick'
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

grant execute on function public.allocate_pick_steps(uuid) to authenticated;
