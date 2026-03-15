-- 0029_inventory_item_product_id.sql

alter table public.inventory_items
  add column if not exists product_id uuid null;

create or replace function public.inventory_item_ref_product_uuid(item_ref text)
returns uuid
language sql
immutable
as $$
  select case
    when item_ref is null then null
    when lower(trim(item_ref)) ~ '^product:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then substring(
        lower(trim(item_ref))
        from '^product:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
      )::uuid
    else null
  end
$$;

update public.inventory_items
set product_id = public.inventory_item_ref_product_uuid(item_ref)
where product_id is null
  and public.inventory_item_ref_product_uuid(item_ref) is not null;

create index if not exists inventory_items_product_id_idx
  on public.inventory_items(product_id)
  where product_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_product_id_fkey'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_product_id_fkey
      foreign key (product_id) references public.products(id);
  end if;
end
$$;

create or replace function public.validate_inventory_item_row()
returns trigger
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  parsed_product_uuid uuid;
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
  parsed_product_uuid := public.inventory_item_ref_product_uuid(new.item_ref);

  if new.product_id is not null then
    new.item_ref := 'product:' || new.product_id::text;
  elsif parsed_product_uuid is not null then
    new.product_id := parsed_product_uuid;

    if tg_op = 'INSERT' then
      new.item_ref := 'product:' || parsed_product_uuid::text;
    end if;
  else
    new.product_id := null;
  end if;

  return new;
end
$$;

drop view if exists public.container_storage_snapshot_v;
create view public.container_storage_snapshot_v as
select
  c.tenant_id,
  c.id as container_id,
  c.external_code,
  ct.code as container_type,
  c.status as container_status,
  ii.item_ref,
  ii.product_id,
  ii.quantity,
  ii.uom
from public.containers c
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_items ii on ii.container_id = c.id;

drop view if exists public.cell_storage_snapshot_v;
create view public.cell_storage_snapshot_v as
select
  cp.tenant_id,
  cp.cell_id,
  cp.container_id,
  c.external_code,
  ct.code as container_type,
  c.status as container_status,
  cp.placed_at,
  ii.item_ref,
  ii.product_id,
  ii.quantity,
  ii.uom
from public.container_placements cp
join public.containers c on c.id = cp.container_id
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_items ii on ii.container_id = c.id
where cp.removed_at is null;

grant select on public.container_storage_snapshot_v to authenticated;
grant select on public.cell_storage_snapshot_v to authenticated;
