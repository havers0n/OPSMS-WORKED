-- 0059_cutoff_inventory_items_runtime_reads.sql
--
-- Cuts live runtime reads from public.inventory_items for:
--   - get_container_gross_weight(uuid)
--   - container_storage_snapshot_v
--   - location_storage_snapshot_v
--   - cell_storage_snapshot_v
--
-- Legacy compatibility objects remain in place; this migration only repoints
-- runtime execution surfaces to canonical inventory_unit reads.

create or replace function public.get_container_gross_weight(container_uuid uuid)
returns bigint
language plpgsql
stable
as $$
declare
  container_row record;
  missing_product_weight_exists boolean := false;
  inventory_weight numeric := 0;
begin
  select
    c.id,
    c.tenant_id,
    ct.tare_weight_g
  into container_row
  from public.containers c
  join public.container_types ct on ct.id = c.container_type_id
  where c.id = container_uuid;

  if container_row.id is null then
    return null;
  end if;

  if container_row.tare_weight_g is null then
    return null;
  end if;

  select exists (
    select 1
    from public.inventory_unit iu
    left join public.products p on p.id = iu.product_id
    where iu.container_id = container_uuid
      and p.unit_weight_g is null
  )
  into missing_product_weight_exists;

  if missing_product_weight_exists then
    return null;
  end if;

  select coalesce(sum(iu.quantity * p.unit_weight_g), 0)
  into inventory_weight
  from public.inventory_unit iu
  join public.products p on p.id = iu.product_id
  where iu.container_id = container_uuid;

  return container_row.tare_weight_g + inventory_weight::bigint;
end
$$;

grant execute on function public.get_container_gross_weight(uuid) to authenticated;

create or replace view public.container_storage_snapshot_v as
select
  c.tenant_id,
  c.id as container_id,
  c.external_code,
  ct.code as container_type,
  c.status as container_status,
  case
    when iu.product_id is not null
    then 'product:' || iu.product_id::text
    else null
  end as item_ref,
  iu.product_id,
  iu.quantity,
  iu.uom
from public.containers c
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_unit iu on iu.container_id = c.id;

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
  case
    when iu.product_id is not null
    then 'product:' || iu.product_id::text
    else null
  end as item_ref,
  iu.product_id,
  iu.quantity,
  iu.uom
from public.active_container_locations_v acl
left join public.inventory_unit iu on iu.container_id = acl.container_id;

create or replace view public.cell_storage_snapshot_v as
select
  tenant_id,
  cell_id,
  container_id,
  external_code,
  container_type,
  container_status,
  placed_at,
  item_ref,
  product_id,
  quantity,
  uom
from public.location_storage_snapshot_v
where cell_id is not null;

grant select on public.container_storage_snapshot_v to authenticated;
grant select on public.location_storage_snapshot_v to authenticated;
grant select on public.cell_storage_snapshot_v to authenticated;
