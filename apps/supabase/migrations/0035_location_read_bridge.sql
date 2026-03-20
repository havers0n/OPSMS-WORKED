create or replace view public.active_container_locations_v as
select
  cp.tenant_id,
  l.floor_id,
  l.id as location_id,
  l.code as location_code,
  l.location_type,
  l.capacity_mode,
  l.status as location_status,
  l.geometry_slot_id as cell_id,
  cp.container_id,
  c.external_code,
  ct.code as container_type,
  c.status as container_status,
  cp.placed_at
from public.container_placements cp
join public.locations l
  on l.geometry_slot_id = cp.cell_id
 and l.tenant_id = cp.tenant_id
join public.containers c on c.id = cp.container_id
join public.container_types ct on ct.id = c.container_type_id
where cp.removed_at is null;

create or replace view public.location_occupancy_v as
select
  tenant_id,
  floor_id,
  location_id,
  location_code,
  location_type,
  capacity_mode,
  location_status,
  cell_id,
  container_id,
  external_code,
  container_type,
  container_status,
  placed_at
from public.active_container_locations_v;

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
  ii.item_ref,
  ii.product_id,
  ii.quantity,
  ii.uom
from public.active_container_locations_v acl
left join public.inventory_items ii on ii.container_id = acl.container_id;

grant select on public.active_container_locations_v to authenticated;
grant select on public.location_occupancy_v to authenticated;
grant select on public.location_storage_snapshot_v to authenticated;

drop view if exists public.cell_occupancy_v;
create view public.cell_occupancy_v as
select
  tenant_id,
  cell_id,
  container_id,
  external_code,
  container_type,
  container_status,
  placed_at
from public.location_occupancy_v;

drop view if exists public.cell_storage_snapshot_v;
create view public.cell_storage_snapshot_v as
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
from public.location_storage_snapshot_v;

grant select on public.cell_occupancy_v to authenticated;
grant select on public.cell_storage_snapshot_v to authenticated;
