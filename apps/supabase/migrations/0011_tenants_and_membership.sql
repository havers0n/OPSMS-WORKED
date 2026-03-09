-- 0011_tenants_and_membership.sql

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_tenants_updated_at on public.tenants;
create trigger set_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('platform_admin', 'tenant_admin', 'operator')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, profile_id)
);

create index if not exists tenant_members_profile_idx
  on public.tenant_members(profile_id);

alter table public.sites
  add column if not exists tenant_id uuid references public.tenants(id);

insert into public.tenants (code, name)
values ('default', 'Default Tenant')
on conflict (code) do nothing;

update public.sites
set tenant_id = (select id from public.tenants where code = 'default')
where tenant_id is null;

alter table public.sites
  alter column tenant_id set not null;

insert into public.tenant_members (tenant_id, profile_id, role)
select
  (select id from public.tenants where code = 'default'),
  p.id,
  'platform_admin'
from public.profiles p
on conflict do nothing;
