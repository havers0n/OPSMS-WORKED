-- 0074_pick_execution_schema.sql
-- PR1: Schema foundations for step-based picking execution.
--
-- Three changes in one migration because they are tightly coupled:
-- removing any one of them leaves the allocation/execution RPCs
-- (PRs 2 and 3) in an unrunnable state.
--
-- 1. product_location_roles  — operational SKU-to-location policy table
-- 2. pick_steps new columns  — inventory_unit_id, pick_container_id
-- 3. pick_steps.status       — extend CHECK to include needs_replenishment

-- ============================================================
-- 1. product_location_roles
--
-- This is NOT a physical property of a location.
-- It is the operational policy: "for product P, location L is
-- the primary pick cell (or a reserve cell)".
--
-- Allocation RPC (PR2) queries this table to find where to
-- pull inventory from for a given pick step.
-- ============================================================

create table if not exists public.product_location_roles (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null references public.tenants(id) on delete cascade,
  product_id        uuid        not null references public.products(id) on delete cascade,
  location_id       uuid        not null references public.locations(id) on delete cascade,
  role              text        not null check (role in ('primary_pick', 'reserve')),
  state             text        not null default 'published'
                                  check (state in ('draft', 'published', 'inactive')),
  layout_version_id uuid        null references public.layout_versions(id) on delete set null,
  effective_from    timestamptz null,
  effective_to      timestamptz null,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

-- Prevent two published assignments for the same product + location + role.
-- A product can have primary_pick AND reserve on the same location in theory
-- (edge case), but in practice the unique index prevents duplicates that
-- would make allocation non-deterministic.
create unique index product_location_roles_unique_active
  on public.product_location_roles(tenant_id, product_id, location_id, role)
  where state = 'published';

-- Hot path for allocation RPC: given a product_id, find its primary_pick locations.
create index product_location_roles_product_idx
  on public.product_location_roles(tenant_id, product_id, role, state);

-- Reverse lookup: which products are assigned to a given location.
create index product_location_roles_location_idx
  on public.product_location_roles(tenant_id, location_id);

drop trigger if exists set_product_location_roles_updated_at on public.product_location_roles;
create trigger set_product_location_roles_updated_at
  before update on public.product_location_roles
  for each row execute function public.set_updated_at();

grant select, insert, update on public.product_location_roles to authenticated;

alter table public.product_location_roles enable row level security;

create or replace function public.can_access_product_location_role(plr_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.product_location_roles plr
    where plr.id = plr_uuid
      and public.can_access_tenant(plr.tenant_id)
  )
$$;

create or replace function public.can_manage_product_location_role(plr_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.product_location_roles plr
    where plr.id = plr_uuid
      and public.can_manage_tenant(plr.tenant_id)
  )
$$;

drop policy if exists product_location_roles_select_scoped on public.product_location_roles;
create policy product_location_roles_select_scoped
  on public.product_location_roles
  for select
  to authenticated
  using (public.can_access_tenant(tenant_id));

drop policy if exists product_location_roles_insert_scoped on public.product_location_roles;
create policy product_location_roles_insert_scoped
  on public.product_location_roles
  for insert
  to authenticated
  with check (public.can_manage_tenant(tenant_id));

drop policy if exists product_location_roles_update_scoped on public.product_location_roles;
create policy product_location_roles_update_scoped
  on public.product_location_roles
  for update
  to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

-- ============================================================
-- 2. pick_steps — add execution-time columns
--
-- inventory_unit_id: written by the allocation RPC (PR2).
--   Identifies the exact inventory_unit the picker should pull
--   from. NULL until the task is allocated.
--
-- pick_container_id: written by the execution RPC (PR3).
--   The tote/cart the picker picks into. NULL until the step
--   is executed.
-- ============================================================

alter table public.pick_steps
  add column if not exists inventory_unit_id uuid null
    references public.inventory_unit(id) on delete set null;

alter table public.pick_steps
  add column if not exists pick_container_id uuid null
    references public.containers(id) on delete set null;

-- Supports the execution RPC looking up which steps reference
-- a specific inventory unit (e.g. to guard double-allocation).
create index if not exists pick_steps_inventory_unit_idx
  on public.pick_steps(inventory_unit_id)
  where inventory_unit_id is not null;

-- ============================================================
-- 3. pick_steps.status — extend CHECK constraint
--
-- needs_replenishment: set by the allocation RPC when the
--   product has a primary_pick location assigned but no
--   available stock was found there. The step is blocked
--   until stock is replenished. Replenishment itself is a
--   separate workflow (out of scope for this milestone).
--
-- The constraint was defined inline on table creation in
-- 0031_pick_tasks.sql. PostgreSQL auto-names it
-- pick_steps_status_check.
-- ============================================================

alter table public.pick_steps
  drop constraint if exists pick_steps_status_check;

alter table public.pick_steps
  add constraint pick_steps_status_check
  check (status in (
    'pending',
    'picked',
    'partial',
    'skipped',
    'exception',
    'needs_replenishment'
  ));
