create or replace view public.active_container_locations_v as
select
  c.tenant_id,
  l.floor_id,
  l.id                              as location_id,
  l.code                            as location_code,
  l.location_type,
  l.capacity_mode,
  l.status                          as location_status,
  l.geometry_slot_id                as cell_id,
  c.id                              as container_id,
  c.external_code,
  ct.code                           as container_type,
  c.status                          as container_status,
  c.current_location_entered_at     as placed_at,
  c.system_code
from public.containers c
join public.locations l
  on l.id = c.current_location_id
join public.container_types ct
  on ct.id = c.container_type_id
where c.current_location_id is not null;

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
  c.system_code
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
  acl.system_code
from public.active_container_locations_v acl
left join public.inventory_unit iu on iu.container_id = acl.container_id;
