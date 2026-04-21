-- PR3: packaging-aware canonical inventory execution truth.
-- Scope:
--   - additive packaging metadata on public.inventory_unit
--   - packaging-aware receive_inventory_unit(...)
--   - packaging-aware split/merge semantics
--   - additive exposure through canonical storage views

create unique index if not exists product_packaging_levels_id_product_id_uidx
  on public.product_packaging_levels (id, product_id);

alter table public.inventory_unit
  add column if not exists packaging_state text not null default 'loose',
  add column if not exists product_packaging_level_id uuid null,
  add column if not exists pack_count integer null;

create index if not exists inventory_unit_packaging_level_idx
  on public.inventory_unit(product_packaging_level_id)
  where product_packaging_level_id is not null;

alter table public.inventory_unit
  drop constraint if exists inventory_unit_packaging_state_check;

alter table public.inventory_unit
  add constraint inventory_unit_packaging_state_check
  check (packaging_state in ('sealed', 'opened', 'loose'));

alter table public.inventory_unit
  drop constraint if exists inventory_unit_pack_count_check;

alter table public.inventory_unit
  add constraint inventory_unit_pack_count_check
  check (pack_count is null or pack_count > 0);

alter table public.inventory_unit
  drop constraint if exists inventory_unit_packaging_level_product_fkey;

alter table public.inventory_unit
  add constraint inventory_unit_packaging_level_product_fkey
  foreign key (product_packaging_level_id, product_id)
  references public.product_packaging_levels(id, product_id)
  on delete restrict;

create or replace function public.validate_inventory_unit_row()
returns trigger
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  source_inventory_unit_tenant_uuid uuid;
  packaging_level_row record;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = new.container_id;

  if container_tenant_uuid is null then
    raise exception 'Container % was not found for inventory unit.', new.container_id;
  end if;

  if container_tenant_uuid <> new.tenant_id then
    raise exception 'Inventory unit tenant % does not match container tenant %.', new.tenant_id, container_tenant_uuid;
  end if;

  new.uom := trim(new.uom);
  new.lot_code := nullif(trim(coalesce(new.lot_code, '')), '');
  new.serial_no := nullif(trim(coalesce(new.serial_no, '')), '');
  new.packaging_state := lower(trim(coalesce(new.packaging_state, 'loose')));

  if new.serial_no is not null and new.quantity <> 1 then
    raise exception 'Serial-tracked inventory units must have quantity 1.';
  end if;

  if new.packaging_state not in ('sealed', 'opened', 'loose') then
    raise exception 'INVALID_PACKAGING_STATE';
  end if;

  if new.packaging_state = 'loose' then
    if new.product_packaging_level_id is not null or new.pack_count is not null then
      raise exception 'LOOSE_PACKAGING_METADATA_FORBIDDEN';
    end if;
  else
    if new.product_packaging_level_id is null then
      raise exception 'PACKAGING_LEVEL_REQUIRED';
    end if;

    if new.pack_count is null then
      raise exception 'PACK_COUNT_REQUIRED';
    end if;

    if new.pack_count <= 0 then
      raise exception 'INVALID_PACK_COUNT';
    end if;

    select
      ppl.id,
      ppl.product_id,
      ppl.base_unit_qty,
      ppl.is_active,
      ppl.can_store
    into packaging_level_row
    from public.product_packaging_levels ppl
    where ppl.id = new.product_packaging_level_id;

    if packaging_level_row.id is null then
      raise exception 'PACKAGING_LEVEL_NOT_FOUND';
    end if;

    if packaging_level_row.product_id <> new.product_id then
      raise exception 'PACKAGING_LEVEL_PRODUCT_MISMATCH';
    end if;

    if not packaging_level_row.is_active then
      raise exception 'PACKAGING_LEVEL_INACTIVE';
    end if;

    if not packaging_level_row.can_store then
      raise exception 'PACKAGING_LEVEL_NOT_STORABLE';
    end if;

    if new.packaging_state = 'sealed'
      and new.quantity <> (new.pack_count * packaging_level_row.base_unit_qty) then
      raise exception 'SEALED_PACK_COUNT_QUANTITY_MISMATCH';
    end if;

    if new.packaging_state = 'opened'
      and new.quantity > (new.pack_count * packaging_level_row.base_unit_qty) then
      raise exception 'OPENED_PACK_COUNT_QUANTITY_EXCEEDED';
    end if;
  end if;

  if new.source_inventory_unit_id is not null then
    select iu.tenant_id
    into source_inventory_unit_tenant_uuid
    from public.inventory_unit iu
    where iu.id = new.source_inventory_unit_id;

    if source_inventory_unit_tenant_uuid is null then
      raise exception 'Source inventory unit % was not found.', new.source_inventory_unit_id;
    end if;

    if source_inventory_unit_tenant_uuid <> new.tenant_id then
      raise exception 'Source inventory unit tenant % does not match inventory unit tenant %.', source_inventory_unit_tenant_uuid, new.tenant_id;
    end if;
  end if;

  return new;
end
$$;

drop function if exists public.receive_inventory_unit(uuid, uuid, uuid, numeric, text, uuid);
create or replace function public.receive_inventory_unit(
  tenant_uuid uuid,
  container_uuid uuid,
  product_uuid uuid,
  quantity numeric,
  uom text,
  actor_uuid uuid default null,
  packaging_state text default 'loose',
  product_packaging_level_uuid uuid default null,
  pack_count integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  container_row record;
  product_row record;
  inserted_row public.inventory_unit%rowtype;
begin
  actor_uuid := auth.uid();

  select c.id, c.tenant_id, c.status
  into container_row
  from public.containers c
  where c.id = container_uuid
    and c.tenant_id = tenant_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.status <> 'active' then
    raise exception 'CONTAINER_NOT_RECEIVABLE';
  end if;

  select
    p.id,
    p.source,
    p.external_product_id,
    p.sku,
    p.name,
    p.permalink,
    p.image_urls,
    p.image_files,
    p.is_active,
    p.created_at,
    p.updated_at
  into product_row
  from public.products p
  where p.id = product_uuid
  for update;

  if product_row.id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if not product_row.is_active then
    raise exception 'PRODUCT_INACTIVE';
  end if;

  insert into public.inventory_unit (
    tenant_id,
    container_id,
    product_id,
    quantity,
    uom,
    status,
    created_by,
    packaging_state,
    product_packaging_level_id,
    pack_count
  )
  values (
    container_row.tenant_id,
    container_row.id,
    product_row.id,
    quantity,
    uom,
    'available',
    actor_uuid,
    packaging_state,
    product_packaging_level_uuid,
    pack_count
  )
  returning *
  into inserted_row;

  return jsonb_build_object(
    'inventoryUnit',
    jsonb_build_object(
      'id', inserted_row.id,
      'tenant_id', inserted_row.tenant_id,
      'container_id', inserted_row.container_id,
      'product_id', inserted_row.product_id,
      'quantity', inserted_row.quantity,
      'uom', inserted_row.uom,
      'lot_code', inserted_row.lot_code,
      'serial_no', inserted_row.serial_no,
      'expiry_date', inserted_row.expiry_date,
      'status', inserted_row.status,
      'packaging_state', inserted_row.packaging_state,
      'product_packaging_level_id', inserted_row.product_packaging_level_id,
      'pack_count', inserted_row.pack_count,
      'created_at', inserted_row.created_at,
      'updated_at', inserted_row.updated_at,
      'created_by', inserted_row.created_by
    ),
    'product',
    jsonb_build_object(
      'id', product_row.id,
      'source', product_row.source,
      'external_product_id', product_row.external_product_id,
      'sku', product_row.sku,
      'name', product_row.name,
      'permalink', product_row.permalink,
      'image_urls', product_row.image_urls,
      'image_files', product_row.image_files,
      'is_active', product_row.is_active,
      'created_at', product_row.created_at,
      'updated_at', product_row.updated_at
    )
  );
end
$$;

revoke execute on function public.receive_inventory_unit(uuid, uuid, uuid, numeric, text, uuid, text, uuid, integer) from public;
grant execute on function public.receive_inventory_unit(uuid, uuid, uuid, numeric, text, uuid, text, uuid, integer) to authenticated;

create or replace function public.split_inventory_unit(
  source_inventory_unit_uuid uuid,
  split_quantity numeric,
  target_container_uuid uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row record;
  target_container_row record;
  source_location_row record;
  target_location_row record;
  merge_candidate_row record;
  source_packaging_level_row record;
  target_inventory_unit_uuid uuid;
  source_quantity_after numeric;
  target_quantity_after numeric;
  target_pack_count_after integer;
  split_pack_count integer := null;
  source_pack_count_after integer := null;
  merge_applied boolean := false;
  occurred_at_utc timestamptz := timezone('utc', now());
  split_movement_uuid uuid;
begin
  actor_uuid := auth.uid();

  select
    iu.id,
    iu.tenant_id,
    iu.container_id,
    iu.product_id,
    iu.quantity,
    iu.uom,
    iu.lot_code,
    iu.serial_no,
    iu.expiry_date,
    iu.status,
    iu.packaging_state,
    iu.product_packaging_level_id,
    iu.pack_count
  into source_row
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid
    and public.can_manage_tenant(iu.tenant_id)
  for update;

  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  if split_quantity <= 0 or split_quantity >= source_row.quantity then
    raise exception 'INVALID_SPLIT_QUANTITY';
  end if;

  if source_row.serial_no is not null then
    raise exception 'SERIAL_SPLIT_NOT_ALLOWED';
  end if;

  if source_row.packaging_state = 'opened' then
    raise exception 'OPENED_PACKAGING_SPLIT_NOT_ALLOWED';
  end if;

  if source_row.packaging_state = 'sealed' then
    select
      ppl.id,
      ppl.base_unit_qty
    into source_packaging_level_row
    from public.product_packaging_levels ppl
    where ppl.id = source_row.product_packaging_level_id;

    if source_packaging_level_row.id is null then
      raise exception 'PACKAGING_LEVEL_NOT_FOUND';
    end if;

    if mod(split_quantity, source_packaging_level_row.base_unit_qty) <> 0 then
      raise exception 'SEALED_SPLIT_REQUIRES_WHOLE_PACKS';
    end if;

    split_pack_count := (split_quantity / source_packaging_level_row.base_unit_qty)::integer;
    source_pack_count_after := source_row.pack_count - split_pack_count;
  end if;

  select c.id, c.tenant_id
  into target_container_row
  from public.containers c
  where c.id = target_container_uuid
  for update;

  if target_container_row.id is null then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  if target_container_row.tenant_id <> source_row.tenant_id then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  if target_container_row.id = source_row.container_id then
    raise exception 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(source_row.container_id);

  select *
  into target_location_row
  from public.resolve_active_location_for_container(target_container_row.id);

  update public.inventory_unit iu
  set quantity = iu.quantity - split_quantity,
      pack_count = case
        when source_row.packaging_state = 'sealed' then source_pack_count_after
        else iu.pack_count
      end,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where iu.id = source_row.id
  returning iu.quantity into source_quantity_after;

  select
    iu.id,
    iu.quantity,
    iu.pack_count
  into merge_candidate_row
  from public.inventory_unit iu
  where iu.tenant_id = source_row.tenant_id
    and iu.container_id = target_container_row.id
    and iu.product_id = source_row.product_id
    and iu.uom = source_row.uom
    and iu.status = source_row.status
    and iu.packaging_state = source_row.packaging_state
    and iu.product_packaging_level_id is not distinct from source_row.product_packaging_level_id
    and iu.serial_no is null
    and iu.lot_code is not distinct from source_row.lot_code
    and iu.expiry_date is not distinct from source_row.expiry_date
  order by iu.created_at, iu.id
  limit 1
  for update;

  if merge_candidate_row.id is not null then
    merge_applied := true;
    target_inventory_unit_uuid := merge_candidate_row.id;

    update public.inventory_unit iu
    set quantity = iu.quantity + split_quantity,
        pack_count = case
          when source_row.packaging_state = 'loose' then null
          else coalesce(iu.pack_count, 0) + coalesce(split_pack_count, 0)
        end,
        updated_at = occurred_at_utc,
        updated_by = actor_uuid
    where iu.id = merge_candidate_row.id
    returning iu.quantity, iu.pack_count
    into target_quantity_after, target_pack_count_after;
  else
    insert into public.inventory_unit (
      tenant_id,
      container_id,
      product_id,
      quantity,
      uom,
      lot_code,
      serial_no,
      expiry_date,
      status,
      packaging_state,
      product_packaging_level_id,
      pack_count,
      created_at,
      updated_at,
      created_by,
      updated_by,
      source_inventory_unit_id
    )
    values (
      source_row.tenant_id,
      target_container_row.id,
      source_row.product_id,
      split_quantity,
      source_row.uom,
      source_row.lot_code,
      source_row.serial_no,
      source_row.expiry_date,
      source_row.status,
      source_row.packaging_state,
      source_row.product_packaging_level_id,
      split_pack_count,
      occurred_at_utc,
      occurred_at_utc,
      actor_uuid,
      actor_uuid,
      source_row.id
    )
    returning id, quantity, pack_count
    into target_inventory_unit_uuid, target_quantity_after, target_pack_count_after;
  end if;

  split_movement_uuid := public.insert_stock_movement(
    source_row.tenant_id,
    'split_stock',
    source_location_row.location_id,
    target_location_row.location_id,
    source_row.container_id,
    target_container_row.id,
    source_row.id,
    target_inventory_unit_uuid,
    split_quantity,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'sourceInventoryUnitId', source_row.id,
    'targetInventoryUnitId', target_inventory_unit_uuid,
    'sourceContainerId', source_row.container_id,
    'targetContainerId', target_container_row.id,
    'sourceLocationId', source_location_row.location_id,
    'targetLocationId', target_location_row.location_id,
    'quantity', split_quantity,
    'uom', source_row.uom,
    'mergeApplied', merge_applied,
    'sourceQuantity', source_quantity_after,
    'targetQuantity', target_quantity_after,
    'movementId', split_movement_uuid,
    'occurredAt', occurred_at_utc
  );
end
$$;

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
  iu.pack_count
from public.containers c
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_unit iu on iu.container_id = c.id;

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
  iu.pack_count
from public.active_container_locations_v acl
left join public.inventory_unit iu on iu.container_id = acl.container_id;
