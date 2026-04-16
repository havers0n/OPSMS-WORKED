-- 0022_inventory_items.sql

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  item_ref text not null check (char_length(trim(item_ref)) > 0),
  quantity numeric not null check (quantity >= 0),
  uom text not null check (char_length(trim(uom)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null references public.profiles(id)
);

create unique index if not exists inventory_items_one_current_row_per_item
  on public.inventory_items(container_id, item_ref, uom);

create index if not exists inventory_items_container_idx
  on public.inventory_items(container_id, created_at desc);

create index if not exists inventory_items_tenant_idx
  on public.inventory_items(tenant_id);

grant select, insert on public.inventory_items to authenticated;

alter table public.inventory_items enable row level security;

create or replace function public.can_access_inventory_item(inventory_item_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.inventory_items ii
    where ii.id = inventory_item_uuid
      and public.can_access_tenant(ii.tenant_id)
  )
$$;

create or replace function public.can_manage_inventory_item(inventory_item_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.inventory_items ii
    where ii.id = inventory_item_uuid
      and public.can_manage_tenant(ii.tenant_id)
  )
$$;

create or replace function public.validate_inventory_item_row()
returns trigger
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = new.container_id;

  if container_tenant_uuid is null then
    raise exception 'Container % was not found for inventory item.', new.container_id;
  end if;

  if container_tenant_uuid <> new.tenant_id then
    raise exception 'Inventory item tenant % does not match container tenant %.', new.tenant_id, container_tenant_uuid;
  end if;

  new.item_ref := trim(new.item_ref);
  new.uom := trim(new.uom);

  return new;
end
$$;

drop trigger if exists validate_inventory_item_row on public.inventory_items;
create trigger validate_inventory_item_row
before insert or update on public.inventory_items
for each row execute function public.validate_inventory_item_row();

drop policy if exists inventory_items_select_scoped on public.inventory_items;
create policy inventory_items_select_scoped
on public.inventory_items
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists inventory_items_insert_scoped on public.inventory_items;
create policy inventory_items_insert_scoped
on public.inventory_items
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));
