-- 0027_products_catalog.sql

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_product_id text not null,
  sku text null,
  name text not null,
  permalink text null,
  image_urls jsonb not null default '[]'::jsonb,
  image_files jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists products_source_external_product_id_key
  on public.products(source, external_product_id);

create index if not exists products_active_name_idx
  on public.products(is_active, name);

create index if not exists products_sku_idx
  on public.products(sku);

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

grant select on public.products to authenticated;

alter table public.products enable row level security;

drop policy if exists products_select_all on public.products;
create policy products_select_all
on public.products
for select
to authenticated
using (true);
