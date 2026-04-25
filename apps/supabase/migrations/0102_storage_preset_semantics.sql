-- 0102_storage_preset_semantics.sql
--
-- Storage presets are canonical packaging_profiles with profile_type = 'storage'.
-- No parallel storage_preset table is introduced.

do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'packaging_profiles'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%profile_type%';

  if constraint_name is not null then
    execute format('alter table public.packaging_profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.packaging_profiles
  add constraint packaging_profiles_profile_type_check
  check (profile_type in ('legacy_bridge', 'receiving', 'storage'));

create index if not exists packaging_profiles_storage_lookup_idx
  on public.packaging_profiles (tenant_id, product_id, status, priority desc)
  where profile_type = 'storage';

create or replace function public.create_container_from_storage_preset(
  packaging_profile_uuid uuid,
  location_uuid uuid default null,
  external_code_input text default null,
  actor_uuid uuid default null
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

  return jsonb_build_object(
    'containerId', new_container.id,
    'systemCode', new_container.system_code,
    'externalCode', new_container.external_code,
    'containerTypeId', new_container.container_type_id,
    'packagingProfileId', new_container.packaging_profile_id,
    'isStandardPack', new_container.is_standard_pack,
    'placedLocationId', location_uuid
  );
end
$$;

grant execute on function public.create_container_from_storage_preset(uuid, uuid, text, uuid) to authenticated;

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
  end                                                   as preset_usage_status
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
  end                                                   as preset_usage_status
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
