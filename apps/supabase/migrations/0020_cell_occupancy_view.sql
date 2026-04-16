-- 0020_cell_occupancy_view.sql

create or replace view public.cell_occupancy_v as
select
  cp.tenant_id,
  cp.cell_id,
  cp.container_id,
  c.external_code,
  ct.code as container_type,
  c.status as container_status,
  cp.placed_at
from public.container_placements cp
join public.containers c on c.id = cp.container_id
join public.container_types ct on ct.id = c.container_type_id
where cp.removed_at is null;

grant select on public.cell_occupancy_v to authenticated;

create or replace function public.can_access_cell(cell_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.cells c
    join public.layout_versions lv on lv.id = c.layout_version_id
    where c.id = cell_uuid
      and public.can_access_floor(lv.floor_id)
  )
$$;

