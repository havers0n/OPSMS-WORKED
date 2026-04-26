-- PR 3 foundation for location-first routing/access projection.
--
-- Additive only:
-- - keep locations.id as executable identity
-- - keep sort_order intact
-- - introduce nullable route/access metadata for future sequencing

alter table public.locations
  add column if not exists route_sequence integer null,
  add column if not exists pick_sequence integer null,
  add column if not exists zone_id uuid null,
  add column if not exists pick_zone_id uuid null,
  add column if not exists task_zone_id uuid null,
  add column if not exists allocation_zone_id uuid null,
  add column if not exists access_aisle_id uuid null,
  add column if not exists side_of_aisle text null,
  add column if not exists position_along_aisle numeric null,
  add column if not exists travel_node_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'locations_side_of_aisle_check'
  ) then
    alter table public.locations
      add constraint locations_side_of_aisle_check
      check (side_of_aisle is null or side_of_aisle in ('left', 'right'));
  end if;
end
$$;

update public.locations
set route_sequence = sort_order
where route_sequence is null
  and sort_order is not null;
