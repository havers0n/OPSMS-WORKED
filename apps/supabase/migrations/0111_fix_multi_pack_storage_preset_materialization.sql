-- 0111_fix_multi_pack_storage_preset_materialization.sql
--
-- Storage preset levels store qty_each as the total base-unit quantity for
-- the preset. Materialization must resolve the selected packaging level from
-- legacy_product_packaging_level_id and derive pack_count from that level's
-- per-pack base quantity.

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
  selected_level public.product_packaging_levels%rowtype;
  receipt_profile public.packaging_profiles%rowtype;
  receipt_level public.packaging_profile_levels%rowtype;
  materialized_result jsonb;
  materialized_line_uuid uuid;
  derived_pack_count integer;
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
  where ppl.profile_id = profile_row.id
    and ppl.legacy_product_packaging_level_id is not null;

  if materializable_level_count <> 1 then
    raise exception 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED'
      using detail = 'Storage preset materialization requires exactly one linked packaging level.';
  end if;

  select ppl.*
  into materializable_level
  from public.packaging_profile_levels ppl
  where ppl.profile_id = profile_row.id
    and ppl.legacy_product_packaging_level_id is not null
  limit 1
  for update;

  select ppl.*
  into selected_level
  from public.product_packaging_levels ppl
  where ppl.id = materializable_level.legacy_product_packaging_level_id
  for update;

  if selected_level.id is null
    or selected_level.product_id <> profile_row.product_id
    or selected_level.is_active is distinct from true
    or selected_level.can_store is distinct from true then
    raise exception 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED'
      using detail = 'The linked packaging level is missing, inactive, not storable, or belongs to another product.';
  end if;

  if materializable_level.qty_each % selected_level.base_unit_qty <> 0 then
    raise exception 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED'
      using detail = 'Storage preset total quantity must divide evenly by the selected packaging level base quantity.';
  end if;

  derived_pack_count := (materializable_level.qty_each / selected_level.base_unit_qty)::integer;

  perform public.sync_default_packaging_profile_from_legacy(profile_row.tenant_id, profile_row.product_id);

  select bridge_profile.*
  into receipt_profile
  from public.packaging_profiles bridge_profile
  where bridge_profile.tenant_id = profile_row.tenant_id
    and bridge_profile.product_id = profile_row.product_id
    and bridge_profile.profile_type = 'legacy_bridge'
    and bridge_profile.status = 'active'
  order by bridge_profile.is_default desc, bridge_profile.priority desc, bridge_profile.id
  limit 1
  for update;

  if receipt_profile.id is null then
    raise exception 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED'
      using detail = 'No active legacy bridge profile exists for canonical receipt.';
  end if;

  select bridge_level.*
  into receipt_level
  from public.packaging_profile_levels bridge_level
  where bridge_level.profile_id = receipt_profile.id
    and bridge_level.legacy_product_packaging_level_id = selected_level.id
    and bridge_level.qty_each = selected_level.base_unit_qty
  limit 1
  for update;

  if receipt_level.id is null then
    raise exception 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED'
      using detail = 'No canonical receipt level exists for the selected packaging level.';
  end if;

  -- Storage preset materialization uses EA as the current canonical base UOM
  -- fallback. A future product-level base UOM model should replace this literal.
  materialized_result := public.receive_inventory_unit(
    profile_row.tenant_id,
    container_row.id,
    profile_row.product_id,
    materializable_level.qty_each,
    'EA',
    actor_uuid,
    'sealed',
    null,
    derived_pack_count,
    'storage-preset:' || container_row.id::text || ':' || profile_row.id::text,
    null,
    null,
    null,
    receipt_profile.id,
    receipt_level.id,
    'storage_preset',
    profile_row.id::text
  );

  materialized_line_uuid := nullif(materialized_result #>> '{inventoryUnit,container_line_id}', '')::uuid;

  if materialized_line_uuid is null then
    raise exception 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED'
      using detail = 'Canonical receipt did not return a materialized container line.';
  end if;

  update public.container_lines
  set packaging_profile_id_at_receipt = profile_row.id,
      packaging_profile_level_id_at_receipt = materializable_level.id,
      level_type_at_receipt = materializable_level.level_type,
      design_qty_each_at_receipt = materializable_level.qty_each,
      container_type_at_receipt = materializable_level.container_type,
      pack_level_snapshot_jsonb = jsonb_build_object(
        'packaging_profile_id', profile_row.id,
        'packaging_profile_level_id', materializable_level.id,
        'legacy_product_packaging_level_id', materializable_level.legacy_product_packaging_level_id,
        'level_type', materializable_level.level_type,
        'design_qty_each', materializable_level.qty_each,
        'container_type', materializable_level.container_type
      )
  where id = materialized_line_uuid
    and tenant_id = profile_row.tenant_id
    and container_id = container_row.id;

  update public.containers
  set packaging_profile_id = profile_row.id,
      is_standard_pack = true,
      source_document_type = 'storage_preset',
      source_document_id = profile_row.id::text,
      updated_at = timezone('utc', now()),
      updated_by = actor_uuid
  where id = container_row.id;

  return materialized_result;
end
$$;

grant execute on function public.materialize_storage_preset_container_contents(uuid, uuid, uuid) to authenticated;
