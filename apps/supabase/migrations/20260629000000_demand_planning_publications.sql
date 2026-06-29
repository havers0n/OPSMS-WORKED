-- Durable publication lineage for demand planning drafts.
-- Allows safe revert-and-edit of published drafts before operational work.

create table public.demand_planning_publications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  batch_id uuid not null references public.demand_import_batches(id) on delete restrict,
  draft_id uuid not null references public.demand_planning_drafts(id) on delete restrict,
  target_shift_id uuid not null references public.manual_shift_sessions(id) on delete restrict,
  status text not null default 'applied' check (status in ('applied', 'reverted')),
  created_at timestamptz not null default timezone('utc', now()),
  reverted_at timestamptz,
  reverted_by uuid references public.profiles(id)
);

create index idx_demand_planning_publications_draft
  on public.demand_planning_publications (tenant_id, draft_id);

create index idx_demand_planning_publications_shift
  on public.demand_planning_publications (tenant_id, target_shift_id);

create index idx_demand_planning_publications_status
  on public.demand_planning_publications (status);

alter table public.demand_planning_publications enable row level security;

create policy demand_planning_publications_select_tenant
on public.demand_planning_publications
for select
to authenticated
using (public.can_access_tenant(tenant_id));

grant select on public.demand_planning_publications to authenticated;

-- Extend the consumption ledger with lineage FKs so revert can identify
-- exactly which operational rows belong to a given publication.
alter table public.demand_planning_published_allocations
  add column publication_id uuid
    references public.demand_planning_publications(id)
    on delete restrict,
  add column manual_shift_line_id uuid
    references public.manual_shift_lines(id)
    on delete set null,
  add column manual_shift_order_id uuid
    references public.manual_shift_orders(id)
    on delete set null,
  add column manual_shift_order_item_id uuid
    references public.manual_shift_order_items(id)
    on delete set null,
  add column line_created_by_publication boolean
    not null default false;

create index idx_dppa_publication
  on public.demand_planning_published_allocations (publication_id);
