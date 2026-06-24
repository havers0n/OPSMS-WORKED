-- Demand Planning Drafts, Buckets, and Allocations
-- PR-4A: Support item-row-level assignment with split-order architecture

-- demand_planning_drafts: one per batch, created when entering planning
create table public.demand_planning_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  batch_id uuid not null references public.demand_import_batches(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'ready', 'cancelled', 'applied')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index demand_planning_drafts_tenant_batch_idx on public.demand_planning_drafts(tenant_id, batch_id);

create trigger set_demand_planning_drafts_updated_at before update on public.demand_planning_drafts
  for each row execute function public.set_updated_at();

alter table public.demand_planning_drafts enable row level security;

create policy demand_planning_drafts_select_scoped on public.demand_planning_drafts
  for select to authenticated using (public.can_access_tenant(tenant_id));

create policy demand_planning_drafts_insert_scoped on public.demand_planning_drafts
  for insert to authenticated with check (public.can_manage_tenant(tenant_id));

create policy demand_planning_drafts_update_scoped on public.demand_planning_drafts
  for update to authenticated using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

-- demand_planning_buckets: persisted WorkGroups under planning lines
create table public.demand_planning_buckets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  draft_id uuid not null references public.demand_planning_drafts(id) on delete cascade,
  batch_id uuid not null references public.demand_import_batches(id) on delete cascade,
  distribution_area text,
  planning_line_name text not null,
  bucket_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index dp_buckets_draft_idx on public.demand_planning_buckets(draft_id);
create unique index dp_buckets_draft_area_line_name_idx
  on public.demand_planning_buckets(draft_id, distribution_area, planning_line_name, bucket_name);

create trigger set_demand_planning_buckets_updated_at before update on public.demand_planning_buckets
  for each row execute function public.set_updated_at();

alter table public.demand_planning_buckets enable row level security;

create policy demand_planning_buckets_select_scoped on public.demand_planning_buckets
  for select to authenticated using (public.can_access_tenant(tenant_id));

create policy demand_planning_buckets_insert_scoped on public.demand_planning_buckets
  for insert to authenticated with check (public.can_manage_tenant(tenant_id));

create policy demand_planning_buckets_update_scoped on public.demand_planning_buckets
  for update to authenticated using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy demand_planning_buckets_delete_scoped on public.demand_planning_buckets
  for delete to authenticated using (public.can_manage_tenant(tenant_id));

-- demand_planning_allocations: maps rawDemandRow → bucket with allocated quantity
create table public.demand_planning_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  draft_id uuid not null references public.demand_planning_drafts(id) on delete cascade,
  batch_id uuid not null references public.demand_import_batches(id) on delete cascade,
  raw_demand_row_id uuid not null references public.raw_demand_rows(id) on delete cascade,
  bucket_id uuid not null references public.demand_planning_buckets(id) on delete cascade,
  allocated_quantity numeric not null default 0 check (allocated_quantity >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index dp_allocations_draft_idx on public.demand_planning_allocations(draft_id);
create index dp_allocations_bucket_idx on public.demand_planning_allocations(bucket_id);
create index dp_allocations_row_idx on public.demand_planning_allocations(raw_demand_row_id);
create unique index dp_allocations_row_bucket_idx
  on public.demand_planning_allocations(raw_demand_row_id, bucket_id);

create trigger set_demand_planning_allocations_updated_at before update on public.demand_planning_allocations
  for each row execute function public.set_updated_at();

alter table public.demand_planning_allocations enable row level security;

create policy demand_planning_allocations_select_scoped on public.demand_planning_allocations
  for select to authenticated using (public.can_access_tenant(tenant_id));

create policy demand_planning_allocations_insert_scoped on public.demand_planning_allocations
  for insert to authenticated with check (public.can_manage_tenant(tenant_id));

create policy demand_planning_allocations_update_scoped on public.demand_planning_allocations
  for update to authenticated using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy demand_planning_allocations_delete_scoped on public.demand_planning_allocations
  for delete to authenticated using (public.can_manage_tenant(tenant_id));
