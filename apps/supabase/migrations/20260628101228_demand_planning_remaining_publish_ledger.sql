-- Durable consumption ledger for publishing raw DataSheet demand across drafts.
-- Existing drafts remain full-batch drafts; new drafts can persist remaining scope.

alter table public.demand_planning_drafts
  add column source_scope text not null default 'all'
  check (source_scope in ('all', 'remaining'));

create table public.demand_planning_published_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  batch_id uuid not null references public.demand_import_batches(id) on delete restrict,
  draft_id uuid not null references public.demand_planning_drafts(id) on delete restrict,
  target_shift_id uuid not null references public.manual_shift_sessions(id) on delete restrict,
  raw_demand_row_id uuid not null references public.raw_demand_rows(id) on delete restrict,
  allocation_id uuid not null references public.demand_planning_allocations(id) on delete restrict,
  published_quantity numeric not null check (published_quantity > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (allocation_id)
);

create index demand_planning_published_allocations_batch_lookup_idx
  on public.demand_planning_published_allocations (tenant_id, batch_id, raw_demand_row_id);

create index demand_planning_published_allocations_draft_idx
  on public.demand_planning_published_allocations (tenant_id, draft_id);

alter table public.demand_planning_published_allocations enable row level security;

create policy demand_planning_published_allocations_select_scoped
on public.demand_planning_published_allocations
for select
to authenticated
using (public.can_access_tenant(tenant_id));

grant select on public.demand_planning_published_allocations to authenticated;

-- Keep the already-deployed implementation as an internal write primitive. The
-- wrapper below adds row locking, cross-draft quantity validation, and ledger
-- persistence in the same transaction as the operational writes.
alter function public.manual_shift_publish_demand_planning_draft(uuid, uuid, uuid)
  rename to manual_shift_publish_demand_planning_draft_legacy_20260628;

revoke all on function public.manual_shift_publish_demand_planning_draft_legacy_20260628(uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function public.manual_shift_publish_demand_planning_draft(
  p_tenant_id uuid,
  p_draft_id uuid,
  p_target_shift_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_draft public.demand_planning_drafts%rowtype;
  v_result jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null or not public.can_manage_tenant(p_tenant_id) then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  select *
  into v_draft
  from public.demand_planning_drafts
  where id = p_draft_id
    and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_FOUND';
  end if;

  if v_draft.status not in ('draft', 'ready') then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_MUTABLE';
  end if;

  if exists (
    select 1
    from public.demand_planning_allocations a
    join public.raw_demand_rows r on r.id = a.raw_demand_row_id
    where a.tenant_id = p_tenant_id
      and a.draft_id = p_draft_id
      and (a.batch_id <> v_draft.batch_id or r.batch_id <> v_draft.batch_id or r.tenant_id <> p_tenant_id)
  ) then
    raise exception 'DEMAND_PLANNING_DRAFT_SOURCE_MISMATCH';
  end if;

  -- Serialize consumption checks per raw row so concurrent drafts cannot both
  -- pass validation and over-publish the same source quantity.
  perform 1
  from public.raw_demand_rows r
  where r.tenant_id = p_tenant_id
    and r.id in (
      select a.raw_demand_row_id
      from public.demand_planning_allocations a
      where a.tenant_id = p_tenant_id
        and a.draft_id = p_draft_id
        and a.batch_id = v_draft.batch_id
        and a.allocated_quantity > 0
    )
  order by r.id
  for update;

  if exists (
    select 1
    from (
      select
        r.id,
        coalesce(r.quantity, 0) as source_quantity,
        coalesce(existing.published_quantity, 0) as already_published_quantity,
        sum(a.allocated_quantity) as requested_quantity
      from public.demand_planning_allocations a
      join public.raw_demand_rows r
        on r.id = a.raw_demand_row_id
       and r.tenant_id = p_tenant_id
      left join lateral (
        select sum(pa.published_quantity) as published_quantity
        from public.demand_planning_published_allocations pa
        where pa.tenant_id = p_tenant_id
          and pa.raw_demand_row_id = r.id
      ) existing on true
      where a.tenant_id = p_tenant_id
        and a.draft_id = p_draft_id
        and a.batch_id = v_draft.batch_id
        and a.allocated_quantity > 0
        and r.planning_status not in ('error', 'special_flow')
        and nullif(btrim(r.sku), '') is not null
      group by r.id, r.quantity, existing.published_quantity
    ) consumption
    where consumption.already_published_quantity + consumption.requested_quantity
      > consumption.source_quantity
  ) then
    raise exception 'DEMAND_PLANNING_DEMAND_ALREADY_CONSUMED';
  end if;

  v_result := public.manual_shift_publish_demand_planning_draft_legacy_20260628(
    p_tenant_id,
    p_draft_id,
    p_target_shift_id
  );

  insert into public.demand_planning_published_allocations (
    tenant_id,
    batch_id,
    draft_id,
    target_shift_id,
    raw_demand_row_id,
    allocation_id,
    published_quantity
  )
  select
    p_tenant_id,
    v_draft.batch_id,
    p_draft_id,
    p_target_shift_id,
    a.raw_demand_row_id,
    a.id,
    a.allocated_quantity
  from public.demand_planning_allocations a
  join public.raw_demand_rows r
    on r.id = a.raw_demand_row_id
   and r.tenant_id = p_tenant_id
  where a.tenant_id = p_tenant_id
    and a.draft_id = p_draft_id
    and a.batch_id = v_draft.batch_id
    and a.allocated_quantity > 0
    and r.planning_status not in ('error', 'special_flow')
    and nullif(btrim(r.sku), '') is not null;

  return v_result;
end;
$$;

revoke all on function public.manual_shift_publish_demand_planning_draft(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.manual_shift_publish_demand_planning_draft(uuid, uuid, uuid)
  to authenticated;
