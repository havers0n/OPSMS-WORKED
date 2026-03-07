-- 0003_layout_versions.sql

create table if not exists public.layout_versions (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  version_no integer not null,
  state text not null check (state in ('draft', 'published', 'archived')),
  parent_published_version_id uuid references public.layout_versions(id),
  created_by uuid references public.profiles(id),
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint layout_versions_floor_version_unique unique (floor_id, version_no)
);

create unique index if not exists layout_versions_one_published_per_floor_idx
  on public.layout_versions (floor_id)
  where state = 'published';

create unique index if not exists layout_versions_one_draft_per_floor_idx
  on public.layout_versions (floor_id)
  where state = 'draft';

create trigger set_layout_versions_updated_at
before update on public.layout_versions
for each row execute function public.set_updated_at();
