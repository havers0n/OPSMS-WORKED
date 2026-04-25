-- 0100_expose_inventory_unit_id_in_storage_snapshots.sql
--
-- Minimal read-surface gap for Storage Mode contents actions.
-- Transfer/extract endpoints operate on inventory_unit.id, while existing
-- storage snapshots only exposed product-derived item_ref values.

create or replace view public.container_storage_canonical_v as
select
  c.tenant_id,
  c.id                                                  as container_id,
  c.external_code,
  ct.code                                               as container_type,
  c.status                                              as container_status,
  case
    when iu.product_id is not null
    then 'product:' || iu.product_id::text
    else null
  end                                                   as item_ref,
  iu.product_id,
  iu.quantity,
  iu.uom,
  iu.lot_code,
  iu.serial_no,
  iu.expiry_date,
  iu.status                                             as inventory_status,
  c.system_code,
  iu.packaging_state,
  iu.product_packaging_level_id,
  iu.pack_count,
  iu.id                                                 as inventory_unit_id
from public.containers c
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_unit iu on iu.container_id = c.id;

create or replace view public.location_storage_canonical_v as
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
  end                                                   as item_ref,
  iu.product_id,
  iu.quantity,
  iu.uom,
  iu.lot_code,
  iu.serial_no,
  iu.expiry_date,
  iu.status                                             as inventory_status,
  acl.system_code,
  iu.packaging_state,
  iu.product_packaging_level_id,
  iu.pack_count,
  iu.id                                                 as inventory_unit_id
from public.active_container_locations_v acl
left join public.inventory_unit iu on iu.container_id = acl.container_id;

grant select on public.container_storage_canonical_v to authenticated;
grant select on public.location_storage_canonical_v to authenticated;
