create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  code text not null check (char_length(trim(code)) > 0),
  location_type text not null check (location_type in ('rack_slot', 'floor', 'staging', 'dock', 'buffer')),
  geometry_slot_id uuid null references public.cells(id) on delete restrict,
  capacity_mode text not null check (capacity_mode in ('single_container', 'multi_container')),
  status text not null default 'active' check (status in ('active', 'disabled', 'draft')),
  width_mm int null,
  height_mm int null,
  depth_mm int null,
  max_weight_g bigint null,
  sort_order int null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (floor_id, code)
);

create unique index if not exists locations_geometry_slot_unique
  on public.locations(geometry_slot_id)
  where geometry_slot_id is not null;

create index if not exists locations_tenant_floor_idx
  on public.locations(tenant_id, floor_id);

create index if not exists locations_type_status_idx
  on public.locations(location_type, status);

drop trigger if exists set_locations_updated_at on public.locations;
create trigger set_locations_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

grant select, insert, update on public.locations to authenticated;

alter table public.locations enable row level security;

create or replace function public.can_access_location(location_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.locations l
    where l.id = location_uuid
      and public.can_access_tenant(l.tenant_id)
  )
$$;

create or replace function public.can_manage_location(location_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.locations l
    where l.id = location_uuid
      and public.can_manage_tenant(l.tenant_id)
  )
$$;

create or replace function public.validate_location_row()
returns trigger
language plpgsql
as $$
declare
  floor_tenant_uuid uuid;
  geometry_slot_tenant_uuid uuid;
  geometry_slot_floor_uuid uuid;
  geometry_slot_layout_state text;
begin
  new.code := trim(new.code);

  select s.tenant_id
  into floor_tenant_uuid
  from public.floors f
  join public.sites s on s.id = f.site_id
  where f.id = new.floor_id;

  if floor_tenant_uuid is null then
    raise exception 'Floor % was not found for location.', new.floor_id;
  end if;

  if floor_tenant_uuid <> new.tenant_id then
    raise exception 'Location tenant % does not match floor tenant %.', new.tenant_id, floor_tenant_uuid;
  end if;

  if new.location_type = 'rack_slot' and new.geometry_slot_id is null then
    raise exception 'rack_slot locations must reference a published geometry slot.';
  end if;

  if new.location_type <> 'rack_slot' and new.geometry_slot_id is not null then
    raise exception 'Only rack_slot locations may reference a geometry slot.';
  end if;

  if new.geometry_slot_id is not null then
    select s.tenant_id, f.id, lv.state
    into geometry_slot_tenant_uuid, geometry_slot_floor_uuid, geometry_slot_layout_state
    from public.cells c
    join public.layout_versions lv on lv.id = c.layout_version_id
    join public.floors f on f.id = lv.floor_id
    join public.sites s on s.id = f.site_id
    where c.id = new.geometry_slot_id;

    if geometry_slot_tenant_uuid is null then
      raise exception 'Geometry slot % was not found for location.', new.geometry_slot_id;
    end if;

    if geometry_slot_tenant_uuid <> new.tenant_id then
      raise exception 'Location tenant % does not match geometry slot tenant %.', new.tenant_id, geometry_slot_tenant_uuid;
    end if;

    if geometry_slot_layout_state <> 'published' then
      raise exception 'Geometry slot % must belong to a published layout.', new.geometry_slot_id;
    end if;

    if geometry_slot_floor_uuid <> new.floor_id then
      raise exception 'Location floor % does not match geometry slot floor %.', new.floor_id, geometry_slot_floor_uuid;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists validate_location_row on public.locations;
create trigger validate_location_row
before insert or update on public.locations
for each row execute function public.validate_location_row();

drop policy if exists locations_select_scoped on public.locations;
create policy locations_select_scoped
on public.locations
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists locations_insert_scoped on public.locations;
create policy locations_insert_scoped
on public.locations
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists locations_update_scoped on public.locations;
create policy locations_update_scoped
on public.locations
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

create or replace function public.backfill_locations_from_published_cells()
returns integer
language plpgsql
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.locations (
    tenant_id,
    floor_id,
    code,
    location_type,
    geometry_slot_id,
    capacity_mode,
    status,
    sort_order
  )
  select
    s.tenant_id,
    f.id,
    c.address,
    'rack_slot',
    c.id,
    'single_container',
    'active',
    null
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  left join public.locations l on l.geometry_slot_id = c.id
  where lv.state = 'published'
    and l.id is null;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end
$$;

select public.backfill_locations_from_published_cells();

