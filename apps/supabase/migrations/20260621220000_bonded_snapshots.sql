-- 20260621220000_bonded_snapshots.sql
-- Bonded warehouse snapshots for tracking bonded goods inventory.

-- ── bonded_snapshots ────────────────────────────────────────────────────────

create table if not exists public.bonded_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid references public.manual_shift_sessions(id) on delete set null,
  planning_date date,
  file_name text not null,
  file_hash text,
  source_sheet_name text not null,
  imported_at timestamptz not null default now(),
  imported_by uuid references public.profiles(id) on delete set null,
  row_count integer not null default 0,
  diagnostics jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

-- ── bonded_snapshot_rows ────────────────────────────────────────────────────

create table if not exists public.bonded_snapshot_rows (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.bonded_snapshots(id) on delete cascade,
  row_number integer not null,
  source_label text,
  block text,
  sku text,
  description text,
  released_qty numeric not null,
  pack_factor numeric,
  cartons_per_pallet numeric,
  units_per_pallet numeric,
  pull_columns jsonb not null default '[]'::jsonb,
  total_pulled_qty numeric not null,
  released_balance_qty numeric not null,
  available_qty numeric not null,
  notes text,
  remaining_bonded_raw text,
  diagnostics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_bonded_snapshots_tenant_id
  on public.bonded_snapshots(tenant_id);

create index if not exists idx_bonded_snapshots_planning_date
  on public.bonded_snapshots(planning_date);

create index if not exists idx_bonded_snapshots_imported_at
  on public.bonded_snapshots(imported_at);

create index if not exists idx_bonded_snapshots_tenant_status
  on public.bonded_snapshots(tenant_id, status);

create index if not exists idx_bonded_snapshot_rows_snapshot_id
  on public.bonded_snapshot_rows(snapshot_id);

create index if not exists idx_bonded_snapshot_rows_sku
  on public.bonded_snapshot_rows(sku);

create index if not exists idx_bonded_snapshot_rows_block
  on public.bonded_snapshot_rows(block);

-- ── Row-level security ──────────────────────────────────────────────────────

alter table public.bonded_snapshots enable row level security;
alter table public.bonded_snapshot_rows enable row level security;

drop policy if exists bonded_snapshots_select on public.bonded_snapshots;
create policy bonded_snapshots_select
on public.bonded_snapshots
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists bonded_snapshots_insert on public.bonded_snapshots;
create policy bonded_snapshots_insert
on public.bonded_snapshots
for insert
to authenticated
with check (public.can_access_tenant(tenant_id));

drop policy if exists bonded_snapshots_update on public.bonded_snapshots;
create policy bonded_snapshots_update
on public.bonded_snapshots
for update
to authenticated
using (public.can_access_tenant(tenant_id))
with check (public.can_access_tenant(tenant_id));

drop policy if exists bonded_snapshots_delete on public.bonded_snapshots;
create policy bonded_snapshots_delete
on public.bonded_snapshots
for delete
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists bonded_snapshot_rows_select on public.bonded_snapshot_rows;
create policy bonded_snapshot_rows_select
on public.bonded_snapshot_rows
for select
to authenticated
using (
  exists (
    select 1 from public.bonded_snapshots bs
    where bs.id = snapshot_id
      and public.can_access_tenant(bs.tenant_id)
  )
);

drop policy if exists bonded_snapshot_rows_insert on public.bonded_snapshot_rows;
create policy bonded_snapshot_rows_insert
on public.bonded_snapshot_rows
for insert
to authenticated
with check (
  exists (
    select 1 from public.bonded_snapshots bs
    where bs.id = snapshot_id
      and public.can_access_tenant(bs.tenant_id)
  )
);

drop policy if exists bonded_snapshot_rows_update on public.bonded_snapshot_rows;
create policy bonded_snapshot_rows_update
on public.bonded_snapshot_rows
for update
to authenticated
using (
  exists (
    select 1 from public.bonded_snapshots bs
    where bs.id = snapshot_id
      and public.can_access_tenant(bs.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.bonded_snapshots bs
    where bs.id = snapshot_id
      and public.can_access_tenant(bs.tenant_id)
  )
);

drop policy if exists bonded_snapshot_rows_delete on public.bonded_snapshot_rows;
create policy bonded_snapshot_rows_delete
on public.bonded_snapshot_rows
for delete
to authenticated
using (
  exists (
    select 1 from public.bonded_snapshots bs
    where bs.id = snapshot_id
      and public.can_access_tenant(bs.tenant_id)
  )
);

grant select, insert, update, delete on public.bonded_snapshots to authenticated;
grant select, insert, update, delete on public.bonded_snapshot_rows to authenticated;
