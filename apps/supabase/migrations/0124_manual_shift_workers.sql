-- 0124_manual_shift_workers.sql
-- Description: Add manual_shift_workers roster table and picker_worker_id FK on orders.

create table if not exists public.manual_shift_workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  role text not null default 'picker'
    check (role in ('picker', 'checker', 'packer', 'other')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists manual_shift_workers_shift_idx
  on public.manual_shift_workers(shift_id, sort_order, created_at);

create index if not exists manual_shift_workers_tenant_idx
  on public.manual_shift_workers(tenant_id, active);

-- updated_at trigger
drop trigger if exists set_manual_shift_workers_updated_at on public.manual_shift_workers;
create trigger set_manual_shift_workers_updated_at
before update on public.manual_shift_workers
for each row execute function public.set_updated_at();

-- Row validation trigger: verify tenant/shift coherence and trim name
create or replace function public.validate_manual_shift_worker_row()
returns trigger
language plpgsql
as $$
declare
  session_tenant_uuid uuid;
begin
  select tenant_id
  into session_tenant_uuid
  from public.manual_shift_sessions
  where id = new.shift_id;

  if session_tenant_uuid is null then
    raise exception 'MANUAL_SHIFT_SESSION_NOT_FOUND';
  end if;

  if session_tenant_uuid <> new.tenant_id then
    raise exception 'MANUAL_SHIFT_WORKER_TENANT_MISMATCH';
  end if;

  new.name := trim(new.name);
  if char_length(new.name) = 0 then
    raise exception 'MANUAL_SHIFT_WORKER_NAME_EMPTY';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_manual_shift_worker_row on public.manual_shift_workers;
create trigger validate_manual_shift_worker_row
before insert or update on public.manual_shift_workers
for each row execute function public.validate_manual_shift_worker_row();

-- RLS
alter table public.manual_shift_workers enable row level security;

grant select, insert, update on public.manual_shift_workers to authenticated;

drop policy if exists manual_shift_workers_select_scoped on public.manual_shift_workers;
create policy manual_shift_workers_select_scoped
on public.manual_shift_workers
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_workers_insert_scoped on public.manual_shift_workers;
create policy manual_shift_workers_insert_scoped
on public.manual_shift_workers
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_workers_update_scoped on public.manual_shift_workers;
create policy manual_shift_workers_update_scoped
on public.manual_shift_workers
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

-- Add picker_worker_id nullable FK to manual_shift_orders
alter table public.manual_shift_orders
  add column if not exists picker_worker_id uuid null
    references public.manual_shift_workers(id) on delete set null;

create index if not exists manual_shift_orders_picker_worker_idx
  on public.manual_shift_orders(picker_worker_id)
  where picker_worker_id is not null;
