-- 0028_pick_tasks.sql

create table if not exists public.pick_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_type text not null check (source_type in ('order', 'wave')),
  source_id uuid not null,
  status text not null default 'ready'
    check (status in ('ready', 'assigned', 'in_progress', 'completed', 'completed_with_exceptions')),
  assigned_to uuid null references public.profiles(id),
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pick_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.pick_tasks(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid null references public.orders(id),
  order_line_id uuid null references public.order_lines(id),
  sequence_no int not null,
  sku text not null check (char_length(trim(sku)) > 0),
  item_name text not null check (char_length(trim(item_name)) > 0),
  qty_required int not null check (qty_required > 0),
  qty_picked int not null default 0 check (qty_picked >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'picked', 'partial', 'skipped', 'exception')),
  source_cell_id uuid null,
  source_container_id uuid null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists pick_tasks_tenant_idx
  on public.pick_tasks(tenant_id);

create index if not exists pick_tasks_source_idx
  on public.pick_tasks(source_type, source_id);

create index if not exists pick_steps_task_idx
  on public.pick_steps(task_id, sequence_no);

create index if not exists pick_steps_order_idx
  on public.pick_steps(order_id);

create index if not exists pick_steps_tenant_idx
  on public.pick_steps(tenant_id);

grant select, insert, update on public.pick_tasks to authenticated;
grant select, insert, update on public.pick_steps to authenticated;

alter table public.pick_tasks enable row level security;
alter table public.pick_steps enable row level security;

-- RLS helpers

create or replace function public.can_access_pick_task(pick_task_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pick_tasks pt
    where pt.id = pick_task_uuid
      and public.can_access_tenant(pt.tenant_id)
  )
$$;

create or replace function public.can_manage_pick_task(pick_task_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pick_tasks pt
    where pt.id = pick_task_uuid
      and public.can_manage_tenant(pt.tenant_id)
  )
$$;

-- Pick tasks policies

drop policy if exists pick_tasks_select_scoped on public.pick_tasks;
create policy pick_tasks_select_scoped
on public.pick_tasks
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists pick_tasks_insert_scoped on public.pick_tasks;
create policy pick_tasks_insert_scoped
on public.pick_tasks
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists pick_tasks_update_scoped on public.pick_tasks;
create policy pick_tasks_update_scoped
on public.pick_tasks
for update
to authenticated
using (public.can_manage_tenant(tenant_id));

-- Pick steps policies

drop policy if exists pick_steps_select_scoped on public.pick_steps;
create policy pick_steps_select_scoped
on public.pick_steps
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists pick_steps_insert_scoped on public.pick_steps;
create policy pick_steps_insert_scoped
on public.pick_steps
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists pick_steps_update_scoped on public.pick_steps;
create policy pick_steps_update_scoped
on public.pick_steps
for update
to authenticated
using (public.can_manage_tenant(tenant_id));
