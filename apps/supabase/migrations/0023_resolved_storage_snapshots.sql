-- 0023_resolved_storage_snapshots.sql

create or replace view public.container_storage_snapshot_v as
select
  c.tenant_id,
  c.id as container_id,
  c.external_code,
  ct.code as container_type,
  c.status as container_status,
  ii.item_ref,
  ii.quantity,
  ii.uom
from public.containers c
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_items ii on ii.container_id = c.id;

create or replace view public.cell_storage_snapshot_v as
select
  cp.tenant_id,
  cp.cell_id,
  cp.container_id,
  c.external_code,
  ct.code as container_type,
  c.status as container_status,
  cp.placed_at,
  ii.item_ref,
  ii.quantity,
  ii.uom
from public.container_placements cp
join public.containers c on c.id = cp.container_id
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_items ii on ii.container_id = c.id
where cp.removed_at is null;

grant select on public.container_storage_snapshot_v to authenticated;
grant select on public.cell_storage_snapshot_v to authenticated;
