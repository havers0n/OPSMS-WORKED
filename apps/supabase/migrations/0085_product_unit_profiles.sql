-- Product unit profiles: physical properties of one base unit of a product.
-- Exact measurements and fallback classes are separate nullable fields —
-- they may coexist but are never treated as the same concept.

create table public.product_unit_profiles (
  product_id    uuid        primary key references public.products(id) on delete cascade,
  unit_weight_g integer     null check (unit_weight_g is null or unit_weight_g > 0),
  unit_width_mm integer     null check (unit_width_mm is null or unit_width_mm > 0),
  unit_height_mm integer    null check (unit_height_mm is null or unit_height_mm > 0),
  unit_depth_mm integer     null check (unit_depth_mm is null or unit_depth_mm > 0),
  weight_class  text        null check (weight_class in ('light', 'medium', 'heavy', 'very_heavy')),
  size_class    text        null check (size_class   in ('small', 'medium', 'large', 'oversized')),
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

comment on table public.product_unit_profiles is
  'Physical properties of one base unit of a product. One row per product.';

comment on column public.product_unit_profiles.weight_class is
  'Fallback weight classification used when exact weight_g is not available.';

comment on column public.product_unit_profiles.size_class is
  'Fallback size classification used when exact dimensions are not available.';
