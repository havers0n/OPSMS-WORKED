-- 20260623000000_bonded_coverage_requests.sql
-- Bonded coverage requests for operational workflow.

-- ── bonded_coverage_requests ─────────────────────────────────────────────────

create table if not exists public.bonded_coverage_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  planning_date date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  title text,
  notes text,
  bonded_snapshot_id uuid references public.bonded_snapshots(id) on delete set null,
  warehouse_stock_snapshot_id uuid references public.warehouse_stock_snapshots(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_by_profile_id uuid references public.profiles(id) on delete set null,
  closed_by_name text,
  closed_at timestamptz,
  cancelled_by_profile_id uuid references public.profiles(id) on delete set null,
  cancelled_by_name text,
  cancelled_at timestamptz
);

-- ── bonded_coverage_request_items ────────────────────────────────────────────

create table if not exists public.bonded_coverage_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.bonded_coverage_requests(id) on delete cascade,
  sku text not null,
  description text,
  category text,
  requested_qty numeric not null check (requested_qty > 0),
  fulfilled_qty numeric not null default 0 check (fulfilled_qty >= 0),
  demand_qty_at_create numeric,
  warehouse_qty_at_create numeric,
  shortage_qty_at_create numeric,
  bonded_available_qty_at_create numeric,
  bonded_cover_qty_at_create numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_bonded_coverage_requests_tenant_shift_status
  on public.bonded_coverage_requests(tenant_id, shift_id, status, created_at desc);

create index if not exists idx_bonded_coverage_requests_tenant_planning
  on public.bonded_coverage_requests(tenant_id, planning_date, created_at desc);

create index if not exists idx_bonded_coverage_request_items_request
  on public.bonded_coverage_request_items(request_id);

create index if not exists idx_bonded_coverage_request_items_sku
  on public.bonded_coverage_request_items(sku);

-- ── updated_at triggers ──────────────────────────────────────────────────────

drop trigger if exists set_bonded_coverage_requests_updated_at on public.bonded_coverage_requests;
create trigger set_bonded_coverage_requests_updated_at
  before update on public.bonded_coverage_requests
  for each row execute function public.set_updated_at();

drop trigger if exists set_bonded_coverage_request_items_updated_at on public.bonded_coverage_request_items;
create trigger set_bonded_coverage_request_items_updated_at
  before update on public.bonded_coverage_request_items
  for each row execute function public.set_updated_at();

-- ── Row-level security ──────────────────────────────────────────────────────

alter table public.bonded_coverage_requests enable row level security;
alter table public.bonded_coverage_request_items enable row level security;

drop policy if exists bonded_coverage_requests_select on public.bonded_coverage_requests;
create policy bonded_coverage_requests_select
on public.bonded_coverage_requests
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists bonded_coverage_requests_insert on public.bonded_coverage_requests;
create policy bonded_coverage_requests_insert
on public.bonded_coverage_requests
for insert
to authenticated
with check (public.can_access_tenant(tenant_id));

drop policy if exists bonded_coverage_requests_update on public.bonded_coverage_requests;
create policy bonded_coverage_requests_update
on public.bonded_coverage_requests
for update
to authenticated
using (public.can_access_tenant(tenant_id))
with check (public.can_access_tenant(tenant_id));

drop policy if exists bonded_coverage_requests_delete on public.bonded_coverage_requests;
create policy bonded_coverage_requests_delete
on public.bonded_coverage_requests
for delete
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists bonded_coverage_request_items_select on public.bonded_coverage_request_items;
create policy bonded_coverage_request_items_select
on public.bonded_coverage_request_items
for select
to authenticated
using (
  exists (
    select 1 from public.bonded_coverage_requests bcr
    where bcr.id = request_id
      and public.can_access_tenant(bcr.tenant_id)
  )
);

drop policy if exists bonded_coverage_request_items_insert on public.bonded_coverage_request_items;
create policy bonded_coverage_request_items_insert
on public.bonded_coverage_request_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.bonded_coverage_requests bcr
    where bcr.id = request_id
      and public.can_access_tenant(bcr.tenant_id)
  )
);

drop policy if exists bonded_coverage_request_items_update on public.bonded_coverage_request_items;
create policy bonded_coverage_request_items_update
on public.bonded_coverage_request_items
for update
to authenticated
using (
  exists (
    select 1 from public.bonded_coverage_requests bcr
    where bcr.id = request_id
      and public.can_access_tenant(bcr.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.bonded_coverage_requests bcr
    where bcr.id = request_id
      and public.can_access_tenant(bcr.tenant_id)
  )
);

drop policy if exists bonded_coverage_request_items_delete on public.bonded_coverage_request_items;
create policy bonded_coverage_request_items_delete
on public.bonded_coverage_request_items
for delete
to authenticated
using (
  exists (
    select 1 from public.bonded_coverage_requests bcr
    where bcr.id = request_id
      and public.can_access_tenant(bcr.tenant_id)
  )
);

grant select, insert, update, delete on public.bonded_coverage_requests to authenticated;
grant select, insert, update, delete on public.bonded_coverage_request_items to authenticated;
