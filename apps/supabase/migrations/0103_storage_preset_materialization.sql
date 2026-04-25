-- 0103_storage_preset_materialization.sql
--
-- Adds constrained backend-authoritative storage preset materialization.
-- The BFF uses shell creation first, then materialization, so a receipt
-- failure can leave the honest shell/place state visible instead of faking
-- a frontend rollback.

drop function if exists public.create_container_from_storage_preset(uuid, uuid, text, uuid);

create or replace function public.create_container_from_storage_preset(
  packaging_profile_uuid uuid,
  location_uuid uuid default null,
  external_code_input text default null,
  actor_uuid uuid default null,
  materialize_contents_input boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.packaging_profiles%rowtype;
  resolved_container_type_code text;
  resolved_container_type_count integer;
  resolved_container_type public.container_types%rowtype;
  location_row public.locations%rowtype;
  new_container public.containers%rowtype;
  materialization_result jsonb := null;
begin
  actor_uuid := auth.uid();

  select pp.*
  into profile_row
  from public.packaging_profiles pp
  where pp.id = packaging_profile_uuid
    and pp.profile_type = 'storage'
    and pp.status = 'active'
    and public.can_manage_tenant(pp.tenant_id)
  for update;

  if profile_row.id is null then
    raise exception 'STORAGE_PRESET_NOT_FOUND';
  end if;

  select count(distinct trim(ppl.container_type)), min(trim(ppl.container_type))
  into resolved_container_type_count, resolved_container_type_code
  from public.packaging_profile_levels ppl
  where ppl.profile_id = profile_row.id
    and ppl.container_type is not null
    and trim(ppl.container_type) <> '';

  if resolved_container_type_count is null or resolved_container_type_count <> 1 then
    raise exception 'STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED';
  end if;

  select ct.*
  into resolved_container_type
  from public.container_types ct
  where lower(ct.code) = lower(resolved_container_type_code)
    and ct.supports_storage = true;

  if resolved_container_type.id is null then
    raise exception 'STORAGE_PRESET_CONTAINER_TYPE_INVALID';
  end if;

  if location_uuid is not null then
    select l.*
    into location_row
    from public.locations l
    where l.id = location_uuid
      and l.tenant_id = profile_row.tenant_id
      and public.can_manage_tenant(l.tenant_id)
    for update;

    if location_row.id is null then
      raise exception 'LOCATION_NOT_FOUND';
    end if;
  end if;

  insert into public.containers (
    tenant_id,
    external_code,
    container_type_id,
    status,
    operational_role,
    packaging_profile_id,
    is_standard_pack,
    created_by,
    updated_by
  )
  values (
    profile_row.tenant_id,
    nullif(trim(coalesce(external_code_input, '')), ''),
    resolved_container_type.id,
    'active',
    'storage',
    profile_row.id,
    true,
    actor_uuid,
    actor_uuid
  )
  returning *
  into new_container;

  if location_uuid is not null then
    perform public.place_container_at_location(new_container.id, location_uuid, actor_uuid);
  end if;

  if materialize_contents_input then
    materialization_result := public.materialize_storage_preset_container_contents(
      profile_row.id,
      new_container.id,
      actor_uuid
    );
  end if;

  return jsonb_build_object(
    'containerId', new_container.id,
    'systemCode', new_container.system_code,
    'externalCode', new_container.external_code,
    'containerTypeId', new_container.container_type_id,
    'packagingProfileId', new_container.packaging_profile_id,
    'isStandardPack', new_container.is_standard_pack,
    'placedLocationId', location_uuid,
    'materializationMode', case when materialization_result is null then 'shell' else 'materialized' end,
    'materializedInventoryUnitId', materialization_result #>> '{inventoryUnit,id}',
    'materializedContainerLineId', materialization_result #>> '{inventoryUnit,container_line_id}',
    'materializedQuantity', case
      when materialization_result is null then null
      else (materialization_result #>> '{inventoryUnit,quantity}')::numeric
    end
  );
end
$$;

create or replace function public.materialize_storage_preset_container_contents(
  packaging_profile_uuid uuid,
  container_uuid uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.packaging_profiles%rowtype;
  container_row public.containers%rowtype;
  materializable_level_count integer := 0;
  materializable_level public.packaging_profile_levels%rowtype;
begin
  actor_uuid := auth.uid();

  select pp.*
  into profile_row
  from public.packaging_profiles pp
  where pp.id = packaging_profile_uuid
    and pp.profile_type = 'storage'
    and pp.status = 'active'
    and public.can_manage_tenant(pp.tenant_id)
  for update;

  if profile_row.id is null then
    raise exception 'STORAGE_PRESET_NOT_FOUND';
  end if;

  select c.*
  into container_row
  from public.containers c
  where c.id = container_uuid
    and c.tenant_id = profile_row.tenant_id
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.packaging_profile_id is distinct from profile_row.id
    or container_row.is_standard_pack is distinct from true then
    raise exception 'STORAGE_PRESET_CONTAINER_MISMATCH';
  end if;

  if exists (
    select 1
    from public.inventory_unit iu
    where iu.container_id = container_row.id
  ) then
    raise exception 'STORAGE_PRESET_CONTAINER_NOT_EMPTY';
  end if;

  select count(*)
  into materializable_level_count
  from public.packaging_profile_levels ppl
  join public.product_packaging_levels legacy_level
    on legacy_level.id = ppl.legacy_product_packaging_level_id
  where ppl.profile_id = profile_row.id
    and ppl.legacy_product_packaging_level_id is not null
    and legacy_level.product_id = profile_row.product_id
    and legacy_level.is_active = true
    and legacy_level.can_store = true
    and legacy_level.base_unit_qty = ppl.qty_each;

  if materializable_level_count <> 1 then
    raise exception 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED';
  end if;

  select ppl.*
  into materializable_level
  from public.packaging_profile_levels ppl
  join public.product_packaging_levels legacy_level
    on legacy_level.id = ppl.legacy_product_packaging_level_id
  where ppl.profile_id = profile_row.id
    and ppl.legacy_product_packaging_level_id is not null
    and legacy_level.product_id = profile_row.product_id
    and legacy_level.is_active = true
    and legacy_level.can_store = true
    and legacy_level.base_unit_qty = ppl.qty_each
  limit 1
  for update;

  -- Storage preset materialization uses EA as the current canonical base UOM
  -- fallback. A future product-level base UOM model should replace this literal.
  return public.receive_inventory_unit(
    profile_row.tenant_id,
    container_row.id,
    profile_row.product_id,
    materializable_level.qty_each,
    'EA',
    actor_uuid,
    'sealed',
    null,
    1,
    'storage-preset:' || container_row.id::text || ':' || profile_row.id::text,
    null,
    null,
    null,
    profile_row.id,
    materializable_level.id,
    'storage_preset',
    profile_row.id::text
  );
end
$$;

grant execute on function public.create_container_from_storage_preset(uuid, uuid, text, uuid, boolean) to authenticated;
grant execute on function public.materialize_storage_preset_container_contents(uuid, uuid, uuid) to authenticated;

create or replace view public.container_storage_canonical_v as
select
  c.tenant_id,
  c.id                                                  as container_id,
  c.external_code,
  ct.code                                               as container_type,
  c.status                                              as container_status,
  case
    when iu.product_id is not null
    then 'product:' || iu.product_id::text
    else null
  end                                                   as item_ref,
  iu.product_id,
  iu.quantity,
  iu.uom,
  iu.lot_code,
  iu.serial_no,
  iu.expiry_date,
  iu.status                                             as inventory_status,
  c.system_code,
  iu.packaging_state,
  iu.product_packaging_level_id,
  iu.pack_count,
  iu.id                                                 as inventory_unit_id,
  c.packaging_profile_id                                as container_packaging_profile_id,
  c.is_standard_pack                                    as container_is_standard_pack,
  slp.preferred_packaging_profile_id                    as preferred_packaging_profile_id,
  case
    when c.packaging_profile_id is null or c.is_standard_pack is distinct from true then 'manual'
    when iu.product_id is null then 'unknown'
    when slp.preferred_packaging_profile_id is null then 'standard_non_preferred'
    when slp.preferred_packaging_profile_id = c.packaging_profile_id then 'preferred_match'
    else 'standard_non_preferred'
  end                                                   as preset_usage_status,
  case
    when c.packaging_profile_id is null or c.is_standard_pack is distinct from true then 'manual'
    when iu.id is null then 'shell'
    else 'materialized'
  end                                                   as preset_materialization_status
from public.containers c
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_unit iu on iu.container_id = c.id
left join public.sku_location_policies slp
  on slp.tenant_id = c.tenant_id
  and slp.location_id = c.current_location_id
  and slp.product_id = iu.product_id
  and slp.status = 'active';

create or replace view public.location_storage_canonical_v as
select
  acl.tenant_id,
  acl.floor_id,
  acl.location_id,
  acl.location_code,
  acl.location_type,
  acl.capacity_mode,
  acl.location_status,
  acl.cell_id,
  acl.container_id,
  acl.external_code,
  acl.container_type,
  acl.container_status,
  acl.placed_at,
  case
    when iu.product_id is not null
    then 'product:' || iu.product_id::text
    else null
  end                                                   as item_ref,
  iu.product_id,
  iu.quantity,
  iu.uom,
  iu.lot_code,
  iu.serial_no,
  iu.expiry_date,
  iu.status                                             as inventory_status,
  acl.system_code,
  iu.packaging_state,
  iu.product_packaging_level_id,
  iu.pack_count,
  iu.id                                                 as inventory_unit_id,
  c.packaging_profile_id                                as container_packaging_profile_id,
  c.is_standard_pack                                    as container_is_standard_pack,
  slp.preferred_packaging_profile_id                    as preferred_packaging_profile_id,
  case
    when c.packaging_profile_id is null or c.is_standard_pack is distinct from true then 'manual'
    when iu.product_id is null then 'unknown'
    when slp.preferred_packaging_profile_id is null then 'standard_non_preferred'
    when slp.preferred_packaging_profile_id = c.packaging_profile_id then 'preferred_match'
    else 'standard_non_preferred'
  end                                                   as preset_usage_status,
  case
    when c.packaging_profile_id is null or c.is_standard_pack is distinct from true then 'manual'
    when iu.id is null then 'shell'
    else 'materialized'
  end                                                   as preset_materialization_status
from public.active_container_locations_v acl
join public.containers c on c.id = acl.container_id
left join public.inventory_unit iu on iu.container_id = acl.container_id
left join public.sku_location_policies slp
  on slp.tenant_id = acl.tenant_id
  and slp.location_id = acl.location_id
  and slp.product_id = iu.product_id
  and slp.status = 'active';

grant select on public.container_storage_canonical_v to authenticated;
grant select on public.location_storage_canonical_v to authenticated;
