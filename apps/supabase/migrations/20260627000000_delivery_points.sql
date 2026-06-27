-- 20260627000000_delivery_points.sql
-- DeliveryPoint master data and aliases.

-- ── delivery_points ──────────────────────────────────────────────────────────

create table if not exists public.delivery_points (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_external_id text not null,
  official_fuel_admin_id text,
  display_name text not null,
  company_name text,
  site_name text,
  address text,
  municipality text,
  latitude double precision,
  longitude double precision,
  status text not null default 'active' check (status in ('active', 'inactive', 'needs_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_delivery_points_source
  on public.delivery_points(source_type, source_external_id);

create index if not exists idx_delivery_points_official_fuel_admin_id
  on public.delivery_points(official_fuel_admin_id);

create index if not exists idx_delivery_points_status
  on public.delivery_points(status);

create index if not exists idx_delivery_points_company_name
  on public.delivery_points(company_name);

create index if not exists idx_delivery_points_site_name
  on public.delivery_points(site_name);

drop trigger if exists set_delivery_points_updated_at on public.delivery_points;
create trigger set_delivery_points_updated_at
  before update on public.delivery_points
  for each row execute function public.set_updated_at();

grant select, insert, update on public.delivery_points to authenticated;
grant select, insert, update on public.delivery_points to service_role;

alter table public.delivery_points enable row level security;

drop policy if exists delivery_points_select on public.delivery_points;
create policy delivery_points_select
  on public.delivery_points
  for select
  to authenticated
  using (true);

-- ── delivery_point_aliases ────────────────────────────────────────────────────

create table if not exists public.delivery_point_aliases (
  id uuid primary key default gen_random_uuid(),
  delivery_point_id uuid not null references public.delivery_points(id) on delete cascade,
  alias_text text not null,
  normalized_alias_text text not null,
  alias_source text not null,
  confidence text not null default 'confirmed' check (confidence in ('confirmed', 'review', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_dp_aliases_unique
  on public.delivery_point_aliases(delivery_point_id, normalized_alias_text, alias_source);

create index if not exists idx_dp_aliases_normalized_text
  on public.delivery_point_aliases(normalized_alias_text);

create index if not exists idx_dp_aliases_normalized_text_confidence
  on public.delivery_point_aliases(normalized_alias_text, confidence);

create index if not exists idx_dp_aliases_point_id
  on public.delivery_point_aliases(delivery_point_id);

create index if not exists idx_dp_aliases_source
  on public.delivery_point_aliases(alias_source);

create index if not exists idx_dp_aliases_confidence
  on public.delivery_point_aliases(confidence);

drop trigger if exists set_delivery_point_aliases_updated_at on public.delivery_point_aliases;
create trigger set_delivery_point_aliases_updated_at
  before update on public.delivery_point_aliases
  for each row execute function public.set_updated_at();

grant select, insert, update on public.delivery_point_aliases to authenticated;
grant select, insert, update on public.delivery_point_aliases to service_role;

alter table public.delivery_point_aliases enable row level security;

drop policy if exists delivery_point_aliases_select on public.delivery_point_aliases;
create policy delivery_point_aliases_select
  on public.delivery_point_aliases
  for select
  to authenticated
  using (true);
