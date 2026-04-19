-- 0087_replace_product_packaging_levels_rpc.sql
--
-- Atomic replace of the entire packaging-level set for one product.
-- Scope:
--   - add public.replace_product_packaging_levels(product_uuid, levels_json)
--
-- Atomicity guarantee:
--   All validation, DELETE of old rows, and INSERT of new rows run inside
--   the caller's single transaction boundary.  Any validation failure or
--   constraint violation leaves the prior set untouched.
--
-- Validation (raised before any destructive write):
--   ZERO_BASE_ROWS          – input contains no row with is_base = true
--   MULTIPLE_BASE_ROWS      – input contains more than one is_base row
--   BASE_UNIT_QTY_INVALID   – is_base row has base_unit_qty <> 1
--   MULTIPLE_DEFAULT_PICK_ROWS – input contains more than one is_default_pick_uom row
--   INACTIVE_DEFAULT_PICK   – is_default_pick_uom row has is_active = false
--   DUPLICATE_CODE          – two or more rows share the same code (trimmed)
--   BASE_UNIT_QTY_BELOW_ONE – any row has base_unit_qty < 1
--   NON_POSITIVE_DIMENSION  – any non-null pack dimension is <= 0
--
-- Security model: SECURITY DEFINER so the function can delete + insert
--   product_packaging_levels rows on behalf of the caller; the caller must
--   be authenticated (grant below).  Product-level access is not tenant-
--   scoped here (packaging levels are product master-data, not tenant-data).

create or replace function public.replace_product_packaging_levels(
  product_uuid  uuid,
  levels_json   jsonb
)
returns setof public.product_packaging_levels
language plpgsql
security definer
set search_path = public
as $$
declare
  base_count         integer;
  default_pick_count integer;
  base_qty_invalid   integer;
  inactive_pick      integer;
  dup_codes          integer;
  bad_qty            integer;
  bad_dims           integer;
begin
  -- ── 1. Product must exist ───────────────────────────────────────────────
  if not exists (
    select 1 from public.products where id = product_uuid for update
  ) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  -- ── 2. Validate final set before any destructive write ──────────────────

  -- Exactly one base row
  select count(*) into base_count
  from jsonb_array_elements(levels_json) as el
  where (el ->> 'is_base')::boolean = true;

  if base_count = 0 then
    raise exception 'ZERO_BASE_ROWS'
      using detail = 'Exactly one base row is required; the supplied set contains none.';
  end if;

  if base_count > 1 then
    raise exception 'MULTIPLE_BASE_ROWS'
      using detail = format(
        'Exactly one base row is required; the supplied set contains %s.', base_count
      );
  end if;

  -- Base row must have base_unit_qty = 1
  select count(*) into base_qty_invalid
  from jsonb_array_elements(levels_json) as el
  where (el ->> 'is_base')::boolean = true
    and (el ->> 'base_unit_qty')::integer <> 1;

  if base_qty_invalid > 0 then
    raise exception 'BASE_UNIT_QTY_INVALID'
      using detail = 'The base row must have base_unit_qty = 1.';
  end if;

  -- At most one default pick row
  select count(*) into default_pick_count
  from jsonb_array_elements(levels_json) as el
  where (el ->> 'is_default_pick_uom')::boolean = true;

  if default_pick_count > 1 then
    raise exception 'MULTIPLE_DEFAULT_PICK_ROWS'
      using detail = format(
        'At most one default pick UOM is allowed; the supplied set contains %s.', default_pick_count
      );
  end if;

  -- Inactive row cannot be default pick
  select count(*) into inactive_pick
  from jsonb_array_elements(levels_json) as el
  where (el ->> 'is_default_pick_uom')::boolean = true
    and (el ->> 'is_active')::boolean = false;

  if inactive_pick > 0 then
    raise exception 'INACTIVE_DEFAULT_PICK'
      using detail = 'An inactive packaging level cannot be the default pick UOM.';
  end if;

  -- No duplicate codes (trimmed, case-sensitive)
  select
    count(*) - count(distinct trim(el ->> 'code'))
  into dup_codes
  from jsonb_array_elements(levels_json) as el;

  if dup_codes > 0 then
    raise exception 'DUPLICATE_CODE'
      using detail = 'Two or more rows in the supplied set share the same code.';
  end if;

  -- All base_unit_qty >= 1
  select count(*) into bad_qty
  from jsonb_array_elements(levels_json) as el
  where (el ->> 'base_unit_qty')::integer < 1;

  if bad_qty > 0 then
    raise exception 'BASE_UNIT_QTY_BELOW_ONE'
      using detail = 'base_unit_qty must be >= 1 for every row.';
  end if;

  -- Non-null pack dimensions must be positive
  select count(*) into bad_dims
  from jsonb_array_elements(levels_json) as el
  where
    (el ->> 'pack_weight_g'  is not null and (el ->> 'pack_weight_g')::integer  <= 0)
    or (el ->> 'pack_width_mm'  is not null and (el ->> 'pack_width_mm')::integer  <= 0)
    or (el ->> 'pack_height_mm' is not null and (el ->> 'pack_height_mm')::integer <= 0)
    or (el ->> 'pack_depth_mm'  is not null and (el ->> 'pack_depth_mm')::integer  <= 0);

  if bad_dims > 0 then
    raise exception 'NON_POSITIVE_DIMENSION'
      using detail = 'Pack dimensions must be positive (> 0) when provided.';
  end if;

  -- ── 3. Replace: delete old rows then insert new set ─────────────────────
  --    Both happen inside this single function call / transaction.
  --    If insert fails (constraint, etc.), delete is rolled back.

  delete from public.product_packaging_levels
  where product_id = product_uuid;

  return query
  insert into public.product_packaging_levels (
    product_id,
    code,
    name,
    base_unit_qty,
    is_base,
    can_pick,
    can_store,
    is_default_pick_uom,
    barcode,
    pack_weight_g,
    pack_width_mm,
    pack_height_mm,
    pack_depth_mm,
    sort_order,
    is_active
  )
  select
    product_uuid,
    trim(el ->> 'code'),
    trim(el ->> 'name'),
    (el ->> 'base_unit_qty')::integer,
    (el ->> 'is_base')::boolean,
    (el ->> 'can_pick')::boolean,
    (el ->> 'can_store')::boolean,
    (el ->> 'is_default_pick_uom')::boolean,
    nullif(trim(el ->> 'barcode'), ''),
    (el ->> 'pack_weight_g')::integer,
    (el ->> 'pack_width_mm')::integer,
    (el ->> 'pack_height_mm')::integer,
    (el ->> 'pack_depth_mm')::integer,
    (el ->> 'sort_order')::integer,
    (el ->> 'is_active')::boolean
  from jsonb_array_elements(levels_json) as el
  returning *;
end
$$;

revoke execute
  on function public.replace_product_packaging_levels(uuid, jsonb)
  from public;

grant execute
  on function public.replace_product_packaging_levels(uuid, jsonb)
  to authenticated;
