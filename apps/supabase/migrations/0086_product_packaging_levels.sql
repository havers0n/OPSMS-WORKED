-- Product packaging levels: allowed packaging forms for a product SKU.
-- Each row expresses quantity in base units (not recursive parent rows).
--
-- SCHEMA-ENFORCED INVARIANTS (via partial unique indexes and trigger):
--   • at most one is_base row per product (prevents duplicates)
--   • base row must have base_unit_qty = 1
--   • at most one is_default_pick_uom row per product (prevents duplicates)
--   • inactive rows may not be is_default_pick_uom
--
-- INTENTIONAL GAP (closed by PR2 application/validation layer):
--   • exactly one is_base row per product is enforced in the editor save flow.

create table public.product_packaging_levels (
  id                  uuid        primary key default gen_random_uuid(),
  product_id          uuid        not null references public.products(id) on delete cascade,
  code                text        not null,
  name                text        not null,
  base_unit_qty       integer     not null check (base_unit_qty > 0),
  is_base             boolean     not null default false,
  can_pick            boolean     not null default true,
  can_store           boolean     not null default true,
  is_default_pick_uom boolean     not null default false,
  barcode             text        null,
  pack_weight_g       integer     null check (pack_weight_g  is null or pack_weight_g  > 0),
  pack_width_mm       integer     null check (pack_width_mm  is null or pack_width_mm  > 0),
  pack_height_mm      integer     null check (pack_height_mm is null or pack_height_mm > 0),
  pack_depth_mm       integer     null check (pack_depth_mm  is null or pack_depth_mm  > 0),
  sort_order          integer     not null default 0,
  is_active           boolean     not null default true,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),
  unique (product_id, code)
);

comment on table public.product_packaging_levels is
'Allowed packaging forms for a product SKU. Quantities are relative to base units. Application layer must validate that exactly one base row exists before product use.';

-- Enforce: at most one base row per product
create unique index product_packaging_levels_one_base_per_product
  on public.product_packaging_levels (product_id)
  where is_base = true;

-- Enforce: at most one default pick UOM per product
create unique index product_packaging_levels_one_default_pick_per_product
  on public.product_packaging_levels (product_id)
  where is_default_pick_uom = true;

-- Enforce: base row must have base_unit_qty = 1; inactive rows cannot be default pick UOM.
create or replace function public.check_product_packaging_level_invariants()
returns trigger
language plpgsql
as $$
begin
  if new.is_base and new.base_unit_qty <> 1 then
    raise exception
      'Base packaging level must have base_unit_qty = 1 (got %). product_id=%',
      new.base_unit_qty, new.product_id;
  end if;

  if new.is_default_pick_uom and not new.is_active then
    raise exception
      'Inactive packaging level cannot be the default pick UOM. id=%', new.id;
  end if;

  return new;
end;
$$;

create trigger product_packaging_level_invariants
  before insert or update on public.product_packaging_levels
  for each row execute function public.check_product_packaging_level_invariants();
