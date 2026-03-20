-- 0027_orders.sql

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_number text not null check (char_length(trim(external_number)) > 0),
  status text not null default 'draft'
    check (status in ('draft','ready','released','picking','picked','partial','closed','cancelled')),
  priority int not null default 0,
  wave_id uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  released_at timestamptz null,
  closed_at timestamptz null
);

create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sku text not null check (char_length(trim(sku)) > 0),
  name text not null check (char_length(trim(name)) > 0),
  qty_required int not null check (qty_required > 0),
  qty_picked int not null default 0 check (qty_picked >= 0),
  status text not null default 'pending'
    check (status in ('pending','released','picking','picked','partial','skipped','exception'))
);

create index if not exists orders_tenant_status_idx
  on public.orders(tenant_id, status);

create index if not exists orders_tenant_created_idx
  on public.orders(tenant_id, created_at desc);

create index if not exists order_lines_order_idx
  on public.order_lines(order_id);

create index if not exists order_lines_tenant_idx
  on public.order_lines(tenant_id);

grant select, insert, update on public.orders to authenticated;
grant select, insert, update, delete on public.order_lines to authenticated;

alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

-- RLS helpers

create or replace function public.can_access_order(order_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = order_uuid
      and public.can_access_tenant(o.tenant_id)
  )
$$;

create or replace function public.can_manage_order(order_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = order_uuid
      and public.can_manage_tenant(o.tenant_id)
  )
$$;

-- Validation trigger for orders

create or replace function public.validate_order_row()
returns trigger
language plpgsql
as $$
begin
  new.external_number := trim(new.external_number);
  return new;
end
$$;

drop trigger if exists validate_order_row on public.orders;
create trigger validate_order_row
before insert or update on public.orders
for each row execute function public.validate_order_row();

-- Validation trigger for order_lines: ensure tenant consistency

create or replace function public.validate_order_line_row()
returns trigger
language plpgsql
as $$
declare
  order_tenant_uuid uuid;
begin
  select o.tenant_id
  into order_tenant_uuid
  from public.orders o
  where o.id = new.order_id;

  if order_tenant_uuid is null then
    raise exception 'Order % was not found for order line.', new.order_id;
  end if;

  if order_tenant_uuid <> new.tenant_id then
    raise exception 'Order line tenant % does not match order tenant %.', new.tenant_id, order_tenant_uuid;
  end if;

  new.sku := trim(new.sku);
  new.name := trim(new.name);

  return new;
end
$$;

drop trigger if exists validate_order_line_row on public.order_lines;
create trigger validate_order_line_row
before insert or update on public.order_lines
for each row execute function public.validate_order_line_row();

-- Orders policies

drop policy if exists orders_select_scoped on public.orders;
create policy orders_select_scoped
on public.orders
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists orders_insert_scoped on public.orders;
create policy orders_insert_scoped
on public.orders
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists orders_update_scoped on public.orders;
create policy orders_update_scoped
on public.orders
for update
to authenticated
using (public.can_manage_tenant(tenant_id));

-- Order lines policies

drop policy if exists order_lines_select_scoped on public.order_lines;
create policy order_lines_select_scoped
on public.order_lines
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists order_lines_insert_scoped on public.order_lines;
create policy order_lines_insert_scoped
on public.order_lines
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists order_lines_update_scoped on public.order_lines;
create policy order_lines_update_scoped
on public.order_lines
for update
to authenticated
using (public.can_manage_tenant(tenant_id));

drop policy if exists order_lines_delete_scoped on public.order_lines;
create policy order_lines_delete_scoped
on public.order_lines
for delete
to authenticated
using (public.can_manage_order(order_id));
