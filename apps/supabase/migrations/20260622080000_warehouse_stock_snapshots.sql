-- 20260622080000_warehouse_stock_snapshots.sql
-- Warehouse stock snapshots for tracking inventory from the מלאי sheet.

-- ── warehouse_stock_snapshots ───────────────────────────────────────────────

create table if not exists public.warehouse_stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid references public.manual_shift_sessions(id) on delete set null,
  planning_date date not null,
  file_name text,
  file_hash text,
  source_sheet_name text not null default 'מלאי',
  imported_at timestamptz not null default now(),
  imported_by uuid references public.profiles(id) on delete set null,
  source_row_count integer not null,
  unique_sku_count integer not null,
  diagnostics jsonb not null default '[]'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

-- ── warehouse_stock_snapshot_rows ────────────────────────────────────────────

create table if not exists public.warehouse_stock_snapshot_rows (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.warehouse_stock_snapshots(id) on delete cascade,
  sku text not null,
  description text,
  category text,
  warehouse_qty_raw numeric not null,
  available_qty numeric not null,
  source_demand_qty numeric,
  source_row_count integer not null,
  diagnostics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_warehouse_stock_snapshots_tenant_date
  on public.warehouse_stock_snapshots(tenant_id, planning_date, imported_at desc);

create index if not exists idx_warehouse_stock_snapshot_rows_snapshot_sku
  on public.warehouse_stock_snapshot_rows(snapshot_id, sku);

create unique index if not exists idx_warehouse_stock_snapshot_rows_unique
  on public.warehouse_stock_snapshot_rows(snapshot_id, sku);

-- ── Row-level security ──────────────────────────────────────────────────────

alter table public.warehouse_stock_snapshots enable row level security;
alter table public.warehouse_stock_snapshot_rows enable row level security;

drop policy if exists warehouse_stock_snapshots_select on public.warehouse_stock_snapshots;
create policy warehouse_stock_snapshots_select
on public.warehouse_stock_snapshots
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists warehouse_stock_snapshots_insert on public.warehouse_stock_snapshots;
create policy warehouse_stock_snapshots_insert
on public.warehouse_stock_snapshots
for insert
to authenticated
with check (public.can_access_tenant(tenant_id));

drop policy if exists warehouse_stock_snapshots_update on public.warehouse_stock_snapshots;
create policy warehouse_stock_snapshots_update
on public.warehouse_stock_snapshots
for update
to authenticated
using (public.can_access_tenant(tenant_id))
with check (public.can_access_tenant(tenant_id));

drop policy if exists warehouse_stock_snapshots_delete on public.warehouse_stock_snapshots;
create policy warehouse_stock_snapshots_delete
on public.warehouse_stock_snapshots
for delete
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists warehouse_stock_snapshot_rows_select on public.warehouse_stock_snapshot_rows;
create policy warehouse_stock_snapshot_rows_select
on public.warehouse_stock_snapshot_rows
for select
to authenticated
using (
  exists (
    select 1 from public.warehouse_stock_snapshots ws
    where ws.id = snapshot_id
      and public.can_access_tenant(ws.tenant_id)
  )
);

drop policy if exists warehouse_stock_snapshot_rows_insert on public.warehouse_stock_snapshot_rows;
create policy warehouse_stock_snapshot_rows_insert
on public.warehouse_stock_snapshot_rows
for insert
to authenticated
with check (
  exists (
    select 1 from public.warehouse_stock_snapshots ws
    where ws.id = snapshot_id
      and public.can_access_tenant(ws.tenant_id)
  )
);

drop policy if exists warehouse_stock_snapshot_rows_update on public.warehouse_stock_snapshot_rows;
create policy warehouse_stock_snapshot_rows_update
on public.warehouse_stock_snapshot_rows
for update
to authenticated
using (
  exists (
    select 1 from public.warehouse_stock_snapshots ws
    where ws.id = snapshot_id
      and public.can_access_tenant(ws.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.warehouse_stock_snapshots ws
    where ws.id = snapshot_id
      and public.can_access_tenant(ws.tenant_id)
  )
);

drop policy if exists warehouse_stock_snapshot_rows_delete on public.warehouse_stock_snapshot_rows;
create policy warehouse_stock_snapshot_rows_delete
on public.warehouse_stock_snapshot_rows
for delete
to authenticated
using (
  exists (
    select 1 from public.warehouse_stock_snapshots ws
    where ws.id = snapshot_id
      and public.can_access_tenant(ws.tenant_id)
  )
);

grant select, insert, update, delete on public.warehouse_stock_snapshots to authenticated;
grant select, insert, update, delete on public.warehouse_stock_snapshot_rows to authenticated;
