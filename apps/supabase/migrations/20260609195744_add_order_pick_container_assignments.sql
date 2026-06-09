-- 20260609195744_add_order_pick_container_assignments.sql
--
-- PR1 foundation for canonical order-bound multi-pallet picking.
-- This migration adds only additive schema, constraints, indexes, RLS, and
-- validation for tenant picking policy defaults.
--
-- Repository evidence:
--   - public.container_types is global, not tenant-scoped.
--   - orders/containers already use tenant_id and are the correct anchors for
--     composite FK enforcement of assignment tenant consistency.

-- Make orders/containers eligible for composite FK references that include
-- tenant_id.  These are additive constraints; the existing id primary keys stay
-- in place.
alter table public.orders
  add constraint orders_tenant_id_id_key unique (tenant_id, id);

alter table public.containers
  add constraint containers_tenant_id_id_key unique (tenant_id, id);

-- ------------------------------------------------------------
-- order_pick_containers
-- ------------------------------------------------------------

create table if not exists public.order_pick_containers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  container_id uuid not null,
  sequence_number integer not null,
  status text not null check (status in ('active', 'sealed', 'cancelled')),
  opened_at timestamptz not null default timezone('utc', now()),
  sealed_at timestamptz null,
  opened_by uuid null references public.profiles(id) on delete set null,
  sealed_by uuid null references public.profiles(id) on delete set null,
  cancelled_at timestamptz null,
  cancelled_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint order_pick_containers_sequence_positive check (sequence_number > 0),
  constraint order_pick_containers_lifecycle_coherent_check check (
    (
      status = 'active'
      and sealed_at is null
      and sealed_by is null
      and cancelled_at is null
      and cancelled_by is null
    ) or (
      status = 'sealed'
      and sealed_at is not null
      and cancelled_at is null
      and cancelled_by is null
    ) or (
      status = 'cancelled'
      and cancelled_at is not null
      and sealed_at is null
      and sealed_by is null
    )
  ),
  constraint order_pick_containers_tenant_order_fk
    foreign key (tenant_id, order_id)
    references public.orders (tenant_id, id)
    on delete restrict,
  constraint order_pick_containers_tenant_container_fk
    foreign key (tenant_id, container_id)
    references public.containers (tenant_id, id)
    on delete restrict
);

create unique index if not exists order_pick_containers_tenant_order_sequence_unique
  on public.order_pick_containers(tenant_id, order_id, sequence_number);

create unique index if not exists order_pick_containers_active_order_unique
  on public.order_pick_containers(tenant_id, order_id)
  where status = 'active';

create unique index if not exists order_pick_containers_active_container_unique
  on public.order_pick_containers(tenant_id, container_id)
  where status = 'active';

create index if not exists order_pick_containers_tenant_order_created_idx
  on public.order_pick_containers(tenant_id, order_id, created_at desc);

create index if not exists order_pick_containers_tenant_container_created_idx
  on public.order_pick_containers(tenant_id, container_id, created_at desc);

drop trigger if exists set_order_pick_containers_updated_at on public.order_pick_containers;
create trigger set_order_pick_containers_updated_at
before update on public.order_pick_containers
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.order_pick_containers to authenticated;

alter table public.order_pick_containers enable row level security;

drop policy if exists order_pick_containers_select_scoped on public.order_pick_containers;
create policy order_pick_containers_select_scoped
on public.order_pick_containers
for select
to authenticated
using (public.can_access_tenant(tenant_id));

-- ------------------------------------------------------------
-- tenant_picking_settings
-- ------------------------------------------------------------
--
-- container_types is global in this repository, so tenant matching is not
-- required here.  The policy table only validates that the configured type
-- supports picking.

create table if not exists public.tenant_picking_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  default_pick_container_type_id uuid null references public.container_types(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tenant_picking_settings_default_pick_container_type_idx
  on public.tenant_picking_settings(default_pick_container_type_id)
  where default_pick_container_type_id is not null;

drop trigger if exists set_tenant_picking_settings_updated_at on public.tenant_picking_settings;
create trigger set_tenant_picking_settings_updated_at
before update on public.tenant_picking_settings
for each row execute function public.set_updated_at();

create or replace function public.validate_tenant_picking_settings_row()
returns trigger
language plpgsql
as $$
declare
  container_type_row record;
begin
  if new.default_pick_container_type_id is not null then
    select id, supports_picking
    into container_type_row
    from public.container_types
    where id = new.default_pick_container_type_id;

    if container_type_row.id is null then
      raise exception 'DEFAULT_PICK_CONTAINER_TYPE_NOT_FOUND';
    end if;

    if not container_type_row.supports_picking then
      raise exception 'DEFAULT_PICK_CONTAINER_TYPE_MUST_SUPPORT_PICKING';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_tenant_picking_settings_row on public.tenant_picking_settings;
create trigger validate_tenant_picking_settings_row
before insert or update on public.tenant_picking_settings
for each row execute function public.validate_tenant_picking_settings_row();

grant select, insert, update, delete on public.tenant_picking_settings to authenticated;

alter table public.tenant_picking_settings enable row level security;

drop policy if exists tenant_picking_settings_select_scoped on public.tenant_picking_settings;
create policy tenant_picking_settings_select_scoped
on public.tenant_picking_settings
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists tenant_picking_settings_insert_scoped on public.tenant_picking_settings;
create policy tenant_picking_settings_insert_scoped
on public.tenant_picking_settings
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists tenant_picking_settings_update_scoped on public.tenant_picking_settings;
create policy tenant_picking_settings_update_scoped
on public.tenant_picking_settings
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists tenant_picking_settings_delete_scoped on public.tenant_picking_settings;
create policy tenant_picking_settings_delete_scoped
on public.tenant_picking_settings
for delete
to authenticated
using (public.can_manage_tenant(tenant_id));
