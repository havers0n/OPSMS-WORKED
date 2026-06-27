-- Global Demand Backlog: canonical operational demand items.
-- Phase 1: merge new imports into backlog, read-only query endpoint.
-- raw_demand_rows remain immutable import facts.
-- demand_backlog_items is the canonical planning entity
--   with supersede semantics (latest upload quantity wins).
-- demand_backlog_item_sources links backlog items to source rows
--   preserving full audit traceability.

-- demand_backlog_items: one row per unique identity key per tenant
create table public.demand_backlog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  identity_key text not null,
  status text not null default 'open'
    check (status in ('open', 'special_flow', 'requires_review')),
  total_quantity numeric not null default 0
    check (total_quantity >= 0),

  -- Denormalized latest values from most recent merge
  order_number text,
  customer_name text,
  sku text,
  description text,
  category text,
  distribution_area text,
  product_handling_flow text not null default 'unknown'
    check (product_handling_flow in ('regular', 'cigarette', 'e_cigarette', 'booster',
           'cooler', 'grill', 'pool', 'bed', 'chair', 'bulky', 'unknown')),
  route_flow text not null default 'unassigned'
    check (route_flow in ('unassigned', 'pickup', 'return', 'credit',
           'ashlama', 'chita', 'unknown')),

  -- First seen / last updated
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  last_quantity_changed_at timestamptz,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  unique (tenant_id, identity_key)
);

create index dbi_tenant_status_idx
  on public.demand_backlog_items (tenant_id, status);
create index dbi_tenant_distribution_area_idx
  on public.demand_backlog_items (tenant_id, distribution_area);
create index dbi_tenant_sku_idx
  on public.demand_backlog_items (tenant_id, sku);
create index dbi_tenant_order_number_idx
  on public.demand_backlog_items (tenant_id, order_number);
create index dbi_tenant_first_seen_idx
  on public.demand_backlog_items (tenant_id, first_seen_at desc);

create trigger set_demand_backlog_items_updated_at
  before update on public.demand_backlog_items
  for each row execute function public.set_updated_at();

alter table public.demand_backlog_items enable row level security;

create policy demand_backlog_items_select_scoped on public.demand_backlog_items
  for select to authenticated using (public.can_access_tenant(tenant_id));
create policy demand_backlog_items_insert_scoped on public.demand_backlog_items
  for insert to authenticated with check (public.can_manage_tenant(tenant_id));
create policy demand_backlog_items_update_scoped on public.demand_backlog_items
  for update to authenticated using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

grant select, insert, update on public.demand_backlog_items to authenticated;

-- demand_backlog_item_sources: links backlog items to raw rows/batches
create table public.demand_backlog_item_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  backlog_item_id uuid not null references public.demand_backlog_items(id) on delete cascade,
  raw_demand_row_id uuid not null references public.raw_demand_rows(id) on delete cascade,
  batch_id uuid not null references public.demand_import_batches(id) on delete cascade,

  merge_action text not null
    check (merge_action in ('new', 'matched', 'quantity_changed', 'duplicate', 'special_flow')),

  -- Quantity change audit (meaningful only when merge_action = 'quantity_changed')
  previous_quantity numeric,
  new_quantity numeric,
  quantity_delta numeric,

  created_at timestamptz not null default timezone('utc', now()),

  -- Each raw row links to exactly one backlog item
  unique (tenant_id, raw_demand_row_id)
);

create index dbis_backlog_item_idx on public.demand_backlog_item_sources (backlog_item_id);
create index dbis_batch_idx on public.demand_backlog_item_sources (batch_id);
create index dbis_raw_demand_row_idx on public.demand_backlog_item_sources (raw_demand_row_id);

alter table public.demand_backlog_item_sources enable row level security;

create policy demand_backlog_item_sources_select_scoped on public.demand_backlog_item_sources
  for select to authenticated using (public.can_access_tenant(tenant_id));
create policy demand_backlog_item_sources_insert_scoped on public.demand_backlog_item_sources
  for insert to authenticated with check (public.can_manage_tenant(tenant_id));

grant select, insert on public.demand_backlog_item_sources to authenticated;
