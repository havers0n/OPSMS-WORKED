-- PR-1: DataSheet raw demand staging as area-scoped unplanned demand.
-- This is a staging flow only. It does not write into manual_shift_* tables
-- and does not require final delivery date or final route line.

create table public.demand_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_file text not null,
  source_sheet text not null default 'DataSheet',
  uploaded_by uuid null references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default timezone('utc', now()),
  status text not null
    check (status in ('draft', 'ready', 'archived', 'failed')),
  rows_count integer not null default 0,
  raw_rows_count integer not null default 0,
  warning_rows_count integer not null default 0,
  error_rows_count integer not null default 0,
  special_flow_rows_count integer not null default 0,
  distribution_areas_count integer not null default 0,
  distinct_orders_count integer not null default 0,
  distinct_sku_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.raw_demand_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  batch_id uuid not null references public.demand_import_batches(id) on delete cascade,
  source_sheet text not null,
  source_row_number integer not null,
  agent text null,
  order_date date null,
  customer_name text null,
  order_number text null,
  sku text null,
  description text null,
  category text null,
  quantity numeric null,
  cost numeric null,
  notes text null,
  distribution_area text null,
  raw_route_line text null,
  planned_delivery_date date null,
  planned_route_line text null,
  planned_work_bucket text null,
  planning_status text not null
    check (planning_status in ('unplanned', 'planned', 'excluded', 'special_flow', 'error')),
  route_flow text not null
    check (route_flow in ('unassigned', 'pickup', 'return', 'credit', 'ashlama', 'chita', 'unknown')),
  product_handling_flow text not null
    check (product_handling_flow in ('regular', 'cigarette', 'e_cigarette', 'booster', 'cooler', 'grill', 'pool', 'bed', 'chair', 'bulky', 'unknown')),
  note_date_hints jsonb not null default '[]'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index demand_import_batches_tenant_uploaded_at_idx
  on public.demand_import_batches (tenant_id, uploaded_at desc);

create index raw_demand_rows_tenant_batch_idx
  on public.raw_demand_rows (tenant_id, batch_id);

create index raw_demand_rows_tenant_distribution_area_idx
  on public.raw_demand_rows (tenant_id, distribution_area);

create index raw_demand_rows_tenant_planning_status_idx
  on public.raw_demand_rows (tenant_id, planning_status);

create index raw_demand_rows_tenant_order_number_idx
  on public.raw_demand_rows (tenant_id, order_number);

create index raw_demand_rows_tenant_sku_idx
  on public.raw_demand_rows (tenant_id, sku);

drop trigger if exists set_demand_import_batches_updated_at on public.demand_import_batches;
create trigger set_demand_import_batches_updated_at
before update on public.demand_import_batches
for each row execute function public.set_updated_at();

alter table public.demand_import_batches enable row level security;
alter table public.raw_demand_rows enable row level security;

drop policy if exists demand_import_batches_select_scoped on public.demand_import_batches;
create policy demand_import_batches_select_scoped
on public.demand_import_batches
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists demand_import_batches_insert_scoped on public.demand_import_batches;
create policy demand_import_batches_insert_scoped
on public.demand_import_batches
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists demand_import_batches_update_scoped on public.demand_import_batches;
create policy demand_import_batches_update_scoped
on public.demand_import_batches
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists raw_demand_rows_select_scoped on public.raw_demand_rows;
create policy raw_demand_rows_select_scoped
on public.raw_demand_rows
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists raw_demand_rows_insert_scoped on public.raw_demand_rows;
create policy raw_demand_rows_insert_scoped
on public.raw_demand_rows
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists raw_demand_rows_update_scoped on public.raw_demand_rows;
create policy raw_demand_rows_update_scoped
on public.raw_demand_rows
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

grant select, insert, update on public.demand_import_batches to authenticated;
grant select, insert, update on public.raw_demand_rows to authenticated;
