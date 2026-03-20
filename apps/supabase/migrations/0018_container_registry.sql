-- 0018_container_registry.sql

create table if not exists public.container_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null
);

insert into public.container_types (code, description)
values
  ('pallet', 'Standard pallet'),
  ('carton', 'Carton or case'),
  ('tote', 'Reusable tote'),
  ('bin', 'Storage bin')
on conflict (code) do update
set description = excluded.description;

create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_code text null,
  container_type_id uuid not null references public.container_types(id),
  status text not null default 'active' check (status in ('active', 'quarantined', 'closed', 'lost', 'damaged')),
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id)
);

create unique index if not exists containers_tenant_external_code_unique
  on public.containers(tenant_id, external_code)
  where external_code is not null;

create index if not exists containers_tenant_idx
  on public.containers(tenant_id);

create index if not exists containers_container_type_idx
  on public.containers(container_type_id);

grant select on public.container_types to authenticated;
grant select, insert, update on public.containers to authenticated;

alter table public.container_types enable row level security;
alter table public.containers enable row level security;

create or replace function public.can_access_container(container_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.containers c
    where c.id = container_uuid
      and public.can_access_tenant(c.tenant_id)
  )
$$;

create or replace function public.can_manage_container(container_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.containers c
    where c.id = container_uuid
      and public.can_manage_tenant(c.tenant_id)
  )
$$;

drop policy if exists container_types_select_all on public.container_types;
create policy container_types_select_all
on public.container_types
for select
to authenticated
using (true);

drop policy if exists containers_select_scoped on public.containers;
create policy containers_select_scoped
on public.containers
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists containers_insert_scoped on public.containers;
create policy containers_insert_scoped
on public.containers
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists containers_update_scoped on public.containers;
create policy containers_update_scoped
on public.containers
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));
