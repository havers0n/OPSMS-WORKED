-- Demand Backlog Items and Source Links
-- PR-4B: Persistent backlog for aggregate demand tracking.

create table public.demand_backlog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  identity_key text not null,
  status text not null
    check (status in ('open', 'special_flow', 'requires_review')),
  total_quantity numeric not null default 0,
  order_number text null,
  customer_name text null,
  sku text null,
  description text null,
  category text null,
  distribution_area text null,
  product_handling_flow text null,
  route_flow text null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  last_quantity_changed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.demand_backlog_item_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  backlog_item_id uuid not null references public.demand_backlog_items(id) on delete cascade,
  raw_demand_row_id uuid not null references public.raw_demand_rows(id) on delete cascade,
  batch_id uuid not null references public.demand_import_batches(id) on delete cascade,
  merge_action text not null,
  previous_quantity numeric null,
  new_quantity numeric null,
  quantity_delta numeric null,
  created_at timestamptz not null default timezone('utc', now())
);

create index demand_backlog_items_tenant_identity_key_idx
  on public.demand_backlog_items (tenant_id, identity_key);

create index demand_backlog_items_tenant_status_idx
  on public.demand_backlog_items (tenant_id, status);

create index demand_backlog_items_tenant_distribution_area_idx
  on public.demand_backlog_items (tenant_id, distribution_area);

create index demand_backlog_items_tenant_last_seen_at_idx
  on public.demand_backlog_items (tenant_id, last_seen_at desc);

create index demand_backlog_item_sources_tenant_batch_idx
  on public.demand_backlog_item_sources (tenant_id, batch_id);

create index demand_backlog_item_sources_tenant_backlog_item_idx
  on public.demand_backlog_item_sources (tenant_id, backlog_item_id);

create index demand_backlog_item_sources_tenant_raw_row_idx
  on public.demand_backlog_item_sources (tenant_id, raw_demand_row_id);

drop trigger if exists set_demand_backlog_items_updated_at on public.demand_backlog_items;
create trigger set_demand_backlog_items_updated_at
before update on public.demand_backlog_items
for each row execute function public.set_updated_at();

alter table public.demand_backlog_items enable row level security;
alter table public.demand_backlog_item_sources enable row level security;

drop policy if exists demand_backlog_items_select_scoped on public.demand_backlog_items;
create policy demand_backlog_items_select_scoped
on public.demand_backlog_items
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists demand_backlog_items_insert_scoped on public.demand_backlog_items;
create policy demand_backlog_items_insert_scoped
on public.demand_backlog_items
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists demand_backlog_items_update_scoped on public.demand_backlog_items;
create policy demand_backlog_items_update_scoped
on public.demand_backlog_items
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists demand_backlog_item_sources_select_scoped on public.demand_backlog_item_sources;
create policy demand_backlog_item_sources_select_scoped
on public.demand_backlog_item_sources
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists demand_backlog_item_sources_insert_scoped on public.demand_backlog_item_sources;
create policy demand_backlog_item_sources_insert_scoped
on public.demand_backlog_item_sources
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists demand_backlog_item_sources_delete_scoped on public.demand_backlog_item_sources;
create policy demand_backlog_item_sources_delete_scoped
on public.demand_backlog_item_sources
for delete
to authenticated
using (public.can_manage_tenant(tenant_id));

grant select, insert, update, delete on public.demand_backlog_items to authenticated;
grant select, insert, delete on public.demand_backlog_item_sources to authenticated;
