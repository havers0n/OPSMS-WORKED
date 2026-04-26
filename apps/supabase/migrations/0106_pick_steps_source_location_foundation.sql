-- PR2 foundation: make pick step source identity location-first.

alter table public.pick_steps
  add column if not exists source_location_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pick_steps_source_location_id_fkey'
      and conrelid = 'public.pick_steps'::regclass
  ) then
    alter table public.pick_steps
      add constraint pick_steps_source_location_id_fkey
      foreign key (source_location_id)
      references public.locations(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_pick_steps_source_location_id
  on public.pick_steps(source_location_id);

-- Backfill when legacy source_cell_id points to a rack-slot location geometry.
update public.pick_steps ps
set source_location_id = l.id
from public.locations l
where ps.source_location_id is null
  and ps.source_cell_id is not null
  and l.geometry_slot_id = ps.source_cell_id;

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

      replenishment_count := replenishment_count + 1;
    else
      update public.pick_steps
      set
        inventory_unit_id   = iu_row.inventory_unit_id,
        source_container_id = iu_row.source_container_id,
        source_location_id  = iu_row.source_location_id,
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
