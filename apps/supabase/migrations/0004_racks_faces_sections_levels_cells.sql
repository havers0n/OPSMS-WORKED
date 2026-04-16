-- 0004_racks_faces_sections_levels_cells.sql

create table if not exists public.racks (
  id uuid primary key default gen_random_uuid(),
  layout_version_id uuid not null references public.layout_versions(id) on delete cascade,
  display_code text not null,
  kind text not null check (kind in ('single', 'paired')),
  axis text not null check (axis in ('NS', 'WE')),
  x numeric(12,3) not null,
  y numeric(12,3) not null,
  total_length numeric(12,3) not null check (total_length > 0),
  depth numeric(12,3) not null check (depth > 0),
  rotation_deg integer not null check (rotation_deg in (0, 90, 180, 270)),
  state text not null default 'draft' check (state in ('draft', 'configured', 'published')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint racks_layout_display_code_unique unique (layout_version_id, display_code)
);

create table if not exists public.rack_faces (
  id uuid primary key default gen_random_uuid(),
  rack_id uuid not null references public.racks(id) on delete cascade,
  side text not null check (side in ('A', 'B')),
  enabled boolean not null default true,
  anchor text not null check (anchor in ('start', 'end')),
  slot_numbering_direction text not null check (slot_numbering_direction in ('ltr', 'rtl')),
  is_mirrored boolean not null default false,
  mirror_source_face_id uuid references public.rack_faces(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rack_faces_rack_side_unique unique (rack_id, side)
);

create table if not exists public.rack_sections (
  id uuid primary key default gen_random_uuid(),
  rack_face_id uuid not null references public.rack_faces(id) on delete cascade,
  ordinal integer not null check (ordinal >= 1),
  length numeric(12,3) not null check (length > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rack_sections_face_ordinal_unique unique (rack_face_id, ordinal)
);

create table if not exists public.rack_levels (
  id uuid primary key default gen_random_uuid(),
  rack_section_id uuid not null references public.rack_sections(id) on delete cascade,
  ordinal integer not null check (ordinal >= 1),
  slot_count integer not null check (slot_count >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rack_levels_section_ordinal_unique unique (rack_section_id, ordinal)
);

create table if not exists public.cells (
  id uuid primary key default gen_random_uuid(),
  layout_version_id uuid not null references public.layout_versions(id) on delete cascade,
  rack_id uuid not null references public.racks(id) on delete cascade,
  rack_face_id uuid not null references public.rack_faces(id) on delete cascade,
  rack_section_id uuid not null references public.rack_sections(id) on delete cascade,
  rack_level_id uuid not null references public.rack_levels(id) on delete cascade,
  slot_no integer not null check (slot_no >= 1),
  address text not null,
  address_sort_key text not null,
  x numeric(12,3),
  y numeric(12,3),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cells_layout_address_unique unique (layout_version_id, address),
  constraint cells_level_slot_unique unique (rack_level_id, slot_no)
);

create trigger set_racks_updated_at
before update on public.racks
for each row execute function public.set_updated_at();

create trigger set_rack_faces_updated_at
before update on public.rack_faces
for each row execute function public.set_updated_at();

create trigger set_rack_sections_updated_at
before update on public.rack_sections
for each row execute function public.set_updated_at();

create trigger set_rack_levels_updated_at
before update on public.rack_levels
for each row execute function public.set_updated_at();

create trigger set_cells_updated_at
before update on public.cells
for each row execute function public.set_updated_at();
