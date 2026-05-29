-- Create product_categories lookup table
create table if not exists public.product_categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists product_categories_name_key
  on public.product_categories(name);

create index if not exists product_categories_sort_idx
  on public.product_categories(sort_order, name);

-- Drop hardcoded CHECK constraint added in migration 0129
alter table public.products
  drop constraint if exists products_category_check;

-- Seed initial categories
insert into public.product_categories (name, sort_order) values
  ('Палатки',    1),
  ('Стулья',     2),
  ('Мангалы',    3),
  ('Столы',      4),
  ('Бустеры',    5),
  ('Контейнеры', 6)
on conflict (name) do nothing;

grant select on public.product_categories to authenticated;

alter table public.product_categories enable row level security;

drop policy if exists product_categories_select_all on public.product_categories;
create policy product_categories_select_all
  on public.product_categories
  for select
  to authenticated
  using (true);
