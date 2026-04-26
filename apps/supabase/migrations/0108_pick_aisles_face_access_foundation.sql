-- PR 4 foundation for explicit aisle/face-access topology.
--
-- Additive only:
-- - keep locations.id as executable identity
-- - introduce explicit walkable aisle entities
-- - map rack faces to aisles without inferring from face labels

create table if not exists public.pick_aisles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  code text not null,
  name text null,
  start_x numeric null,
  start_y numeric null,
  end_x numeric null,
  end_y numeric null,
  width_mm numeric null,
  route_sequence integer null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pick_aisles_code_check check (char_length(trim(code)) > 0),
  constraint pick_aisles_status_check check (status in ('active', 'inactive')),
  constraint pick_aisles_tenant_floor_code_unique unique (tenant_id, floor_id, code)
);

create index if not exists idx_pick_aisles_floor_id
  on public.pick_aisles(floor_id);

create index if not exists idx_pick_aisles_route_sequence
  on public.pick_aisles(route_sequence);

create table if not exists public.face_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants(id) on delete cascade,
  rack_id uuid not null references public.racks(id) on delete cascade,
  face_id uuid not null references public.rack_faces(id) on delete cascade,
  aisle_id uuid not null references public.pick_aisles(id) on delete cascade,
  side_of_aisle text null,
  position_along_aisle numeric null,
  normal_x numeric null,
  normal_y numeric null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint face_access_side_of_aisle_check check (side_of_aisle is null or side_of_aisle in ('left', 'right')),
  constraint face_access_rack_face_aisle_unique unique (rack_id, face_id, aisle_id)
);

create index if not exists idx_face_access_aisle_id
  on public.face_access(aisle_id);

create index if not exists idx_face_access_rack_face
  on public.face_access(rack_id, face_id);

drop trigger if exists set_pick_aisles_updated_at on public.pick_aisles;
create trigger set_pick_aisles_updated_at
before update on public.pick_aisles
for each row execute function public.set_updated_at();

drop trigger if exists set_face_access_updated_at on public.face_access;
create trigger set_face_access_updated_at
before update on public.face_access
for each row execute function public.set_updated_at();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'locations'
      and column_name = 'access_aisle_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'locations_access_aisle_id_fkey'
  ) then
    alter table public.locations
      add constraint locations_access_aisle_id_fkey
      foreign key (access_aisle_id)
      references public.pick_aisles(id)
      on delete set null;
  end if;
end
$$;
