create or replace function public.sync_published_cell_to_location()
returns trigger
language plpgsql
as $$
declare
  location_tenant_uuid uuid;
  location_floor_uuid uuid;
  layout_state text;
begin
  select
    s.tenant_id,
    f.id,
    lv.state
  into location_tenant_uuid, location_floor_uuid, layout_state
  from public.layout_versions lv
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  where lv.id = new.layout_version_id;

  if layout_state is distinct from 'published' then
    return new;
  end if;

  update public.locations
  set tenant_id = location_tenant_uuid,
      floor_id = location_floor_uuid,
      code = coalesce(new.address, new.cell_code),
      location_type = 'rack_slot',
      capacity_mode = 'single_container',
      status = 'active',
      updated_at = timezone('utc', now())
  where geometry_slot_id = new.id;

  if not found then
    insert into public.locations (
      tenant_id,
      floor_id,
      code,
      location_type,
      geometry_slot_id,
      capacity_mode,
      status
    )
    values (
      location_tenant_uuid,
      location_floor_uuid,
      coalesce(new.address, new.cell_code),
      'rack_slot',
      new.id,
      'single_container',
      'active'
    );
  end if;

  return new;
end
$$;

drop trigger if exists sync_published_cell_to_location on public.cells;
create trigger sync_published_cell_to_location
after insert or update of address, cell_code, layout_version_id on public.cells
for each row execute function public.sync_published_cell_to_location();
