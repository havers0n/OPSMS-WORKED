-- 0110_preserve_product_packaging_level_ids.sql
--
-- Replaces the original delete-all/reinsert-all implementation of
-- replace_product_packaging_levels() with an identity-preserving reconcile.

create or replace function public.replace_product_packaging_levels(
  product_uuid uuid,
  levels_json jsonb
)
returns setof public.product_packaging_levels
language plpgsql
security definer
set search_path = public
as $$
declare
  base_count integer;
  default_pick_count integer;
  base_qty_invalid integer;
  inactive_pick integer;
  dup_codes integer;
  dup_ids integer;
  bad_qty integer;
  bad_dims integer;
  unknown_ids integer;
  referenced_removed integer;
  now_utc timestamptz := timezone('utc', now());
begin
  if not exists (
    select 1
    from public.products
    where id = product_uuid
    for update
  ) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  perform 1
  from public.product_packaging_levels
  where product_id = product_uuid
  order by id
  for update;

  drop table if exists pg_temp.replace_product_packaging_levels_input;

  create temporary table replace_product_packaging_levels_input
  on commit drop
  as
  select
    row_number() over ()::integer as input_index,
    nullif(el ->> 'id', '')::uuid as id,
    trim(el ->> 'code') as code,
    trim(el ->> 'name') as name,
    (el ->> 'base_unit_qty')::integer as base_unit_qty,
    (el ->> 'is_base')::boolean as is_base,
    (el ->> 'can_pick')::boolean as can_pick,
    (el ->> 'can_store')::boolean as can_store,
    (el ->> 'is_default_pick_uom')::boolean as is_default_pick_uom,
    nullif(trim(el ->> 'barcode'), '') as barcode,
    (el ->> 'pack_weight_g')::integer as pack_weight_g,
    (el ->> 'pack_width_mm')::integer as pack_width_mm,
    (el ->> 'pack_height_mm')::integer as pack_height_mm,
    (el ->> 'pack_depth_mm')::integer as pack_depth_mm,
    (el ->> 'sort_order')::integer as sort_order,
    (el ->> 'is_active')::boolean as is_active
  from jsonb_array_elements(levels_json) as el;

  select count(*) into base_count
  from pg_temp.replace_product_packaging_levels_input
  where is_base = true;

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

  select count(*) into base_qty_invalid
  from pg_temp.replace_product_packaging_levels_input
  where is_base = true
    and base_unit_qty <> 1;

  if base_qty_invalid > 0 then
    raise exception 'BASE_UNIT_QTY_INVALID'
      using detail = 'The base row must have base_unit_qty = 1.';
  end if;

  select count(*) into default_pick_count
  from pg_temp.replace_product_packaging_levels_input
  where is_default_pick_uom = true;

  if default_pick_count > 1 then
    raise exception 'MULTIPLE_DEFAULT_PICK_ROWS'
      using detail = format(
        'At most one default pick UOM is allowed; the supplied set contains %s.', default_pick_count
      );
  end if;

  select count(*) into inactive_pick
  from pg_temp.replace_product_packaging_levels_input
  where is_default_pick_uom = true
    and is_active = false;

  if inactive_pick > 0 then
    raise exception 'INACTIVE_DEFAULT_PICK'
      using detail = 'An inactive packaging level cannot be the default pick UOM.';
  end if;

  select count(*) - count(distinct code) into dup_codes
  from pg_temp.replace_product_packaging_levels_input;

  if dup_codes > 0 then
    raise exception 'DUPLICATE_CODE'
      using detail = 'Two or more rows in the supplied set share the same code.';
  end if;

  select count(*) - count(distinct id) into dup_ids
  from pg_temp.replace_product_packaging_levels_input
  where id is not null;

  if dup_ids > 0 then
    raise exception 'DUPLICATE_ID'
      using detail = 'Two or more rows in the supplied set share the same id.';
  end if;

  select count(*) into bad_qty
  from pg_temp.replace_product_packaging_levels_input
  where base_unit_qty < 1;

  if bad_qty > 0 then
    raise exception 'BASE_UNIT_QTY_BELOW_ONE'
      using detail = 'base_unit_qty must be >= 1 for every row.';
  end if;

  select count(*) into bad_dims
  from pg_temp.replace_product_packaging_levels_input
  where
    (pack_weight_g is not null and pack_weight_g <= 0)
    or (pack_width_mm is not null and pack_width_mm <= 0)
    or (pack_height_mm is not null and pack_height_mm <= 0)
    or (pack_depth_mm is not null and pack_depth_mm <= 0);

  if bad_dims > 0 then
    raise exception 'NON_POSITIVE_DIMENSION'
      using detail = 'Pack dimensions must be positive (> 0) when provided.';
  end if;

  select count(*) into unknown_ids
  from pg_temp.replace_product_packaging_levels_input input
  where input.id is not null
    and not exists (
      select 1
      from public.product_packaging_levels existing
      where existing.id = input.id
        and existing.product_id = product_uuid
    );

  if unknown_ids > 0 then
    raise exception 'PACKAGING_LEVEL_ID_NOT_FOUND'
      using detail = 'One or more supplied packaging level ids do not belong to the target product.';
  end if;

  with removed as (
    select existing.id
    from public.product_packaging_levels existing
    where existing.product_id = product_uuid
      and not exists (
        select 1
        from pg_temp.replace_product_packaging_levels_input input
        where input.id = existing.id
      )
  )
  select count(*) into referenced_removed
  from removed
  where exists (
      select 1
      from public.inventory_unit iu
      where iu.product_packaging_level_id = removed.id
    )
    or exists (
      select 1
      from public.packaging_profile_levels ppl
      where ppl.legacy_product_packaging_level_id = removed.id
    );

  if referenced_removed > 0 then
    raise exception 'PACKAGING_LEVEL_REFERENCED'
      using detail = 'One or more removed packaging levels are still referenced.';
  end if;

  delete from public.product_packaging_levels existing
  where existing.product_id = product_uuid
    and not exists (
      select 1
      from pg_temp.replace_product_packaging_levels_input input
      where input.id = existing.id
    );

  update public.product_packaging_levels existing
  set code = '__rppl_pending__' || replace(existing.id::text, '-', ''),
      is_base = false,
      is_default_pick_uom = false,
      updated_at = now_utc
  where existing.product_id = product_uuid
    and exists (
      select 1
      from pg_temp.replace_product_packaging_levels_input input
      where input.id = existing.id
    );

  update public.product_packaging_levels existing
  set code = input.code,
      name = input.name,
      base_unit_qty = input.base_unit_qty,
      is_base = input.is_base,
      can_pick = input.can_pick,
      can_store = input.can_store,
      is_default_pick_uom = input.is_default_pick_uom,
      barcode = input.barcode,
      pack_weight_g = input.pack_weight_g,
      pack_width_mm = input.pack_width_mm,
      pack_height_mm = input.pack_height_mm,
      pack_depth_mm = input.pack_depth_mm,
      sort_order = input.sort_order,
      is_active = input.is_active,
      updated_at = now_utc
  from pg_temp.replace_product_packaging_levels_input input
  where input.id is not null
    and existing.id = input.id
    and existing.product_id = product_uuid;

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
    input.code,
    input.name,
    input.base_unit_qty,
    input.is_base,
    input.can_pick,
    input.can_store,
    input.is_default_pick_uom,
    input.barcode,
    input.pack_weight_g,
    input.pack_width_mm,
    input.pack_height_mm,
    input.pack_depth_mm,
    input.sort_order,
    input.is_active
  from pg_temp.replace_product_packaging_levels_input input
  where input.id is null
  order by input.input_index;

  return query
  select *
  from public.product_packaging_levels
  where product_id = product_uuid
  order by sort_order, created_at, id;
end
$$;

revoke execute
  on function public.replace_product_packaging_levels(uuid, jsonb)
  from public;

grant execute
  on function public.replace_product_packaging_levels(uuid, jsonb)
  to authenticated;
