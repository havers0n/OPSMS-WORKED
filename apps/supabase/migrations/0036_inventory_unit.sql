create table if not exists public.inventory_unit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  product_id uuid not null references public.products(id),
  legacy_inventory_item_id uuid null references public.inventory_items(id) on delete set null,
  quantity numeric not null check (quantity >= 0),
  uom text not null check (char_length(trim(uom)) > 0),
  lot_code text null,
  serial_no text null,
  expiry_date date null,
  status text not null default 'available' check (status in ('available', 'reserved', 'damaged', 'hold')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid null references public.profiles(id)
);

create index if not exists inventory_unit_tenant_container_idx
  on public.inventory_unit(tenant_id, container_id);

create index if not exists inventory_unit_product_idx
  on public.inventory_unit(product_id);

create index if not exists inventory_unit_lot_code_idx
  on public.inventory_unit(lot_code)
  where lot_code is not null;

create index if not exists inventory_unit_expiry_date_idx
  on public.inventory_unit(expiry_date)
  where expiry_date is not null;

create unique index if not exists inventory_unit_serial_unique
  on public.inventory_unit(tenant_id, serial_no)
  where serial_no is not null;

create unique index if not exists inventory_unit_legacy_item_unique
  on public.inventory_unit(legacy_inventory_item_id)
  where legacy_inventory_item_id is not null;

drop trigger if exists set_inventory_unit_updated_at on public.inventory_unit;
create trigger set_inventory_unit_updated_at
before update on public.inventory_unit
for each row execute function public.set_updated_at();

grant select, insert, update on public.inventory_unit to authenticated;

alter table public.inventory_unit enable row level security;

create or replace function public.can_access_inventory_unit(inventory_unit_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.inventory_unit iu
    where iu.id = inventory_unit_uuid
      and public.can_access_tenant(iu.tenant_id)
  )
$$;

create or replace function public.can_manage_inventory_unit(inventory_unit_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.inventory_unit iu
    where iu.id = inventory_unit_uuid
      and public.can_manage_tenant(iu.tenant_id)
  )
$$;

create or replace function public.validate_inventory_unit_row()
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
    raise exception 'Container % was not found for inventory unit.', new.container_id;
  end if;

  if container_tenant_uuid <> new.tenant_id then
    raise exception 'Inventory unit tenant % does not match container tenant %.', new.tenant_id, container_tenant_uuid;
  end if;

  new.uom := trim(new.uom);
  new.lot_code := nullif(trim(coalesce(new.lot_code, '')), '');
  new.serial_no := nullif(trim(coalesce(new.serial_no, '')), '');

  if new.serial_no is not null and new.quantity <> 1 then
    raise exception 'Serial-tracked inventory units must have quantity 1.';
  end if;

  return new;
end
$$;

drop trigger if exists validate_inventory_unit_row on public.inventory_unit;
create trigger validate_inventory_unit_row
before insert or update on public.inventory_unit
for each row execute function public.validate_inventory_unit_row();

drop policy if exists inventory_unit_select_scoped on public.inventory_unit;
create policy inventory_unit_select_scoped
on public.inventory_unit
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists inventory_unit_insert_scoped on public.inventory_unit;
create policy inventory_unit_insert_scoped
on public.inventory_unit
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists inventory_unit_update_scoped on public.inventory_unit;
create policy inventory_unit_update_scoped
on public.inventory_unit
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

create or replace function public.backfill_inventory_unit_from_inventory_items()
returns integer
language plpgsql
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.inventory_unit (
    tenant_id,
    container_id,
    product_id,
    legacy_inventory_item_id,
    quantity,
    uom,
    lot_code,
    serial_no,
    expiry_date,
    status,
    created_at,
    created_by
  )
  select
    ii.tenant_id,
    ii.container_id,
    ii.product_id,
    ii.id,
    ii.quantity,
    ii.uom,
    null,
    null,
    null,
    'available',
    ii.created_at,
    ii.created_by
  from public.inventory_items ii
  where ii.product_id is not null
    and not exists (
      select 1
      from public.inventory_unit iu
      where iu.legacy_inventory_item_id = ii.id
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end
$$;

create or replace function public.sync_inventory_item_to_inventory_unit()
returns trigger
language plpgsql
as $$
begin
  if new.product_id is null then
    delete from public.inventory_unit
    where legacy_inventory_item_id = new.id;

    return new;
  end if;

  update public.inventory_unit
  set tenant_id = new.tenant_id,
      container_id = new.container_id,
      product_id = new.product_id,
      quantity = new.quantity,
      uom = new.uom,
      status = 'available',
      created_at = new.created_at,
      created_by = new.created_by
  where legacy_inventory_item_id = new.id;

  if not found then
    insert into public.inventory_unit (
      tenant_id,
      container_id,
      product_id,
      legacy_inventory_item_id,
      quantity,
      uom,
      status,
      created_at,
      created_by
    )
    values (
      new.tenant_id,
      new.container_id,
      new.product_id,
      new.id,
      new.quantity,
      new.uom,
      'available',
      new.created_at,
      new.created_by
    );
  end if;

  return new;
end
$$;

drop trigger if exists sync_inventory_item_to_inventory_unit on public.inventory_items;
create trigger sync_inventory_item_to_inventory_unit
after insert or update on public.inventory_items
for each row execute function public.sync_inventory_item_to_inventory_unit();

select public.backfill_inventory_unit_from_inventory_items();

create or replace view public.inventory_items_legacy_v as
select
  ii.id,
  ii.tenant_id,
  ii.container_id,
  ii.item_ref,
  ii.product_id,
  ii.quantity,
  ii.uom,
  ii.created_at,
  ii.created_by
from public.inventory_items ii
where ii.product_id is null;

create or replace view public.inventory_item_compat_v as
select
  iu.id,
  iu.tenant_id,
  iu.container_id,
  'product:' || iu.product_id::text as item_ref,
  iu.product_id,
  iu.quantity,
  iu.uom,
  iu.created_at,
  iu.created_by
from public.inventory_unit iu

union all

select
  il.id,
  il.tenant_id,
  il.container_id,
  il.item_ref,
  il.product_id,
  il.quantity,
  il.uom,
  il.created_at,
  il.created_by
from public.inventory_items_legacy_v il;

grant select on public.inventory_items_legacy_v to authenticated;
grant select on public.inventory_item_compat_v to authenticated;

create or replace view public.container_storage_snapshot_v as
select
  c.tenant_id,
  c.id as container_id,
  c.external_code,
  ct.code as container_type,
  c.status as container_status,
  ic.item_ref,
  ic.product_id,
  ic.quantity,
  ic.uom
from public.containers c
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_item_compat_v ic on ic.container_id = c.id;

create or replace view public.location_storage_snapshot_v as
select
  acl.tenant_id,
  acl.floor_id,
  acl.location_id,
  acl.location_code,
  acl.location_type,
  acl.capacity_mode,
  acl.location_status,
  acl.cell_id,
  acl.container_id,
  acl.external_code,
  acl.container_type,
  acl.container_status,
  acl.placed_at,
  ic.item_ref,
  ic.product_id,
  ic.quantity,
  ic.uom
from public.active_container_locations_v acl
left join public.inventory_item_compat_v ic on ic.container_id = acl.container_id;

grant select on public.container_storage_snapshot_v to authenticated;
grant select on public.location_storage_snapshot_v to authenticated;
