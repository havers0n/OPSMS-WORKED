-- 0097_pr9_sealed_pack_isolation.sql
--
-- PR9: bounded canonical same-container sealed pack isolation.
--
-- Scope is intentionally limited to one current-packaging primitive:
--   - isolate exactly one sealed pack from a multi-pack sealed current row
--   - keep source/target in the same container and location
--   - preserve sealed state, packaging level, product, lot/expiry, uom, and status
--   - mutate/create container_lines.current_* as canonical truth
--   - write truthful same-container isolate_pack stock_movements history
--   - synchronize/create inventory_unit projection afterward
--
-- Out of scope:
--   - direct multi-pack break-pack
--   - automatic PR8/PR7 calls
--   - generic same-container split
--   - opened-pack split
--   - packaging-level changes
--   - generic repack engine

alter table public.stock_movements
  drop constraint if exists stock_movements_movement_type_check;

alter table public.stock_movements
  add constraint stock_movements_movement_type_check
  check (
    movement_type in (
      'receive',
      'putaway',
      'place_container',
      'remove_container',
      'move_container',
      'split_stock',
      'transfer_stock',
      'pick_partial',
      'ship',
      'adjust',
      'normalize_packaging',
      'break_pack',
      'isolate_pack'
    )
  );

alter table public.stock_movements
  drop constraint if exists stock_movements_isolate_pack_audit_check;

alter table public.stock_movements
  add constraint stock_movements_isolate_pack_audit_check
  check (
    movement_type <> 'isolate_pack'
    or (
      reason_code is not null
      and char_length(trim(reason_code)) > 0
      and quantity is not null
      and quantity > 0
      and uom is not null
      and source_location_id is not null
      and target_location_id = source_location_id
      and source_container_id is not null
      and target_container_id = source_container_id
      and source_inventory_unit_id is not null
      and target_inventory_unit_id is null
      and packaging_state_before = 'sealed'
      and packaging_state_after = 'sealed'
      and packaging_profile_level_id_before is not null
      and packaging_profile_level_id_after = packaging_profile_level_id_before
      and pack_count_before > 1
      and pack_count_after = pack_count_before - 1
    )
  ) not valid;

create or replace function public.isolate_sealed_pack_from_multipack(
  source_inventory_unit_uuid uuid,
  reason_code text,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid;
  source_row record;
  source_line_row public.container_lines%rowtype;
  source_location_row record;
  packaging_level_qty_each numeric;
  normalized_reason_code text;
  normalized_note text;
  source_quantity_before numeric;
  source_quantity_after numeric;
  source_pack_count_before integer;
  source_pack_count_after integer;
  target_container_line_uuid uuid;
  target_inventory_unit_uuid uuid;
  movement_uuid uuid;
  occurred_at_utc timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();
  normalized_reason_code := nullif(trim(coalesce(reason_code, '')), '');
  normalized_note := nullif(trim(coalesce(note, '')), '');

  if actor_uuid is null then
    raise exception 'ISOLATE_PACK_ACTOR_REQUIRED';
  end if;

  if normalized_reason_code is null then
    raise exception 'ISOLATE_PACK_REASON_REQUIRED';
  end if;

  -- Lock order is part of the contract for this primitive:
  -- source projection first, owning canonical line second, validate, then
  -- create/update canonical rows before projection synchronization.
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
    iu.pack_count,
    iu.container_line_id
  into source_row
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid
    and public.can_manage_tenant(iu.tenant_id)
  for update;

  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  perform public.ensure_inventory_unit_current_container_line(
    source_inventory_unit_uuid,
    actor_uuid
  );

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
    iu.pack_count,
    iu.container_line_id
  into source_row
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid
    and public.can_manage_tenant(iu.tenant_id)
  for update;

  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  select *
  into source_line_row
  from public.container_lines cl
  where cl.id = source_row.container_line_id
  for update;

  if source_line_row.id is null then
    raise exception 'CONTAINER_LINE_NOT_FOUND';
  end if;

  if source_line_row.current_container_id is null
     or source_line_row.current_qty_each is null
     or source_line_row.current_qty_each <= 0 then
    raise exception 'ISOLATE_PACK_ROW_NOT_CURRENT';
  end if;

  if source_row.serial_no is not null or source_line_row.serial_no is not null then
    raise exception 'SERIAL_ISOLATE_PACK_NOT_ALLOWED';
  end if;

  if coalesce(source_line_row.current_inventory_status, source_row.status) <> 'available' then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE';
  end if;

  if coalesce(source_line_row.current_packaging_state, source_row.packaging_state, 'loose') = 'loose' then
    raise exception 'PACKAGING_ALREADY_LOOSE';
  end if;

  if coalesce(source_line_row.current_packaging_state, source_row.packaging_state, 'loose') = 'opened' then
    raise exception 'OPENED_PACKAGING_ISOLATE_NOT_ALLOWED';
  end if;

  if coalesce(source_line_row.current_packaging_state, source_row.packaging_state, 'loose') <> 'sealed' then
    raise exception 'ISOLATE_PACK_ONLY_SEALED_SUPPORTED';
  end if;

  if source_line_row.current_packaging_profile_level_id is null
     or source_line_row.current_pack_count is null then
    raise exception 'ISOLATE_PACK_METADATA_REQUIRED';
  end if;

  if source_line_row.current_pack_count <= 1 then
    raise exception 'ISOLATE_PACK_REQUIRES_MULTI_PACK';
  end if;

  select ppl.qty_each
  into packaging_level_qty_each
  from public.packaging_profile_levels ppl
  where ppl.id = source_line_row.current_packaging_profile_level_id;

  if packaging_level_qty_each is null then
    raise exception 'PACKAGING_LEVEL_NOT_FOUND';
  end if;

  if source_line_row.current_qty_each <> (source_line_row.current_pack_count * packaging_level_qty_each) then
    raise exception 'SEALED_PACK_COUNT_QUANTITY_MISMATCH';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(source_line_row.current_container_id);

  source_quantity_before := source_line_row.current_qty_each;
  source_pack_count_before := source_line_row.current_pack_count;
  source_quantity_after := source_quantity_before - packaging_level_qty_each;
  source_pack_count_after := source_pack_count_before - 1;

  insert into public.container_lines (
    tenant_id,
    container_id,
    product_id,
    qty_each,
    lot_code,
    expiry_date,
    serial_no,
    packaging_profile_id_at_receipt,
    packaging_profile_level_id_at_receipt,
    level_type_at_receipt,
    design_qty_each_at_receipt,
    container_type_at_receipt,
    is_non_standard_pack,
    inventory_status,
    pack_level_snapshot_jsonb,
    created_by,
    line_kind,
    current_container_id,
    current_qty_each,
    current_inventory_status,
    current_packaging_state,
    current_packaging_profile_level_id,
    current_pack_count,
    root_receipt_line_id,
    parent_container_line_id,
    current_updated_at,
    current_updated_by
  )
  values (
    source_line_row.tenant_id,
    source_line_row.container_id,
    source_line_row.product_id,
    packaging_level_qty_each,
    source_line_row.lot_code,
    source_line_row.expiry_date,
    null,
    source_line_row.packaging_profile_id_at_receipt,
    source_line_row.packaging_profile_level_id_at_receipt,
    source_line_row.level_type_at_receipt,
    source_line_row.design_qty_each_at_receipt,
    source_line_row.container_type_at_receipt,
    source_line_row.is_non_standard_pack,
    source_line_row.inventory_status,
    source_line_row.pack_level_snapshot_jsonb,
    actor_uuid,
    'current_fragment',
    source_line_row.current_container_id,
    packaging_level_qty_each,
    source_line_row.current_inventory_status,
    'sealed',
    source_line_row.current_packaging_profile_level_id,
    1,
    coalesce(source_line_row.root_receipt_line_id, source_line_row.id),
    source_line_row.id,
    occurred_at_utc,
    actor_uuid
  )
  returning id into target_container_line_uuid;

  update public.container_lines
  set current_qty_each = source_quantity_after,
      current_pack_count = source_pack_count_after,
      current_updated_at = occurred_at_utc,
      current_updated_by = actor_uuid
  where id = source_line_row.id;

  insert into public.stock_movements (
    tenant_id,
    movement_type,
    source_location_id,
    target_location_id,
    source_container_id,
    target_container_id,
    source_inventory_unit_id,
    target_inventory_unit_id,
    quantity,
    uom,
    status,
    created_at,
    completed_at,
    created_by,
    reason_code,
    note,
    packaging_state_before,
    packaging_state_after,
    packaging_profile_level_id_before,
    packaging_profile_level_id_after,
    pack_count_before,
    pack_count_after
  )
  values (
    source_row.tenant_id,
    'isolate_pack',
    source_location_row.location_id,
    source_location_row.location_id,
    source_line_row.current_container_id,
    source_line_row.current_container_id,
    source_row.id,
    null,
    packaging_level_qty_each,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid,
    normalized_reason_code,
    normalized_note,
    'sealed',
    'sealed',
    source_line_row.current_packaging_profile_level_id,
    source_line_row.current_packaging_profile_level_id,
    source_pack_count_before,
    source_pack_count_after
  )
  returning id into movement_uuid;

  update public.inventory_unit
  set container_id = source_line_row.current_container_id,
      quantity = source_quantity_after,
      status = source_line_row.current_inventory_status,
      packaging_state = 'sealed',
      pack_count = source_pack_count_after,
      container_line_id = source_line_row.id,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where id = source_row.id;

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
    source_inventory_unit_id,
    container_line_id
  )
  values (
    source_row.tenant_id,
    source_line_row.current_container_id,
    source_row.product_id,
    packaging_level_qty_each,
    source_row.uom,
    source_row.lot_code,
    null,
    source_row.expiry_date,
    source_line_row.current_inventory_status,
    'sealed',
    source_row.product_packaging_level_id,
    1,
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid,
    actor_uuid,
    source_row.id,
    target_container_line_uuid
  )
  returning id into target_inventory_unit_uuid;

  return jsonb_build_object(
    'sourceInventoryUnitId', source_row.id,
    'targetInventoryUnitId', target_inventory_unit_uuid,
    'sourceContainerLineId', source_line_row.id,
    'targetContainerLineId', target_container_line_uuid,
    'containerId', source_line_row.current_container_id,
    'sourceContainerId', source_line_row.current_container_id,
    'targetContainerId', source_line_row.current_container_id,
    'locationId', source_location_row.location_id,
    'sourceLocationId', source_location_row.location_id,
    'targetLocationId', source_location_row.location_id,
    'isolatedQuantityEach', packaging_level_qty_each,
    'uom', source_row.uom,
    'packagingStateBefore', 'sealed',
    'packagingStateAfter', 'sealed',
    'packagingProfileLevelIdBefore', source_line_row.current_packaging_profile_level_id,
    'packagingProfileLevelIdAfter', source_line_row.current_packaging_profile_level_id,
    'sourceQuantityBefore', source_quantity_before,
    'sourceQuantityAfter', source_quantity_after,
    'sourcePackCountBefore', source_pack_count_before,
    'sourcePackCountAfter', source_pack_count_after,
    'targetQuantityEach', packaging_level_qty_each,
    'targetPackCount', 1,
    'reasonCode', normalized_reason_code,
    'note', normalized_note,
    'movementId', movement_uuid,
    'occurredAt', occurred_at_utc
  );
end
$$;

revoke execute on function public.isolate_sealed_pack_from_multipack(uuid, text, text)
from public, anon;

grant execute on function public.isolate_sealed_pack_from_multipack(uuid, text, text)
to authenticated;

comment on function public.isolate_sealed_pack_from_multipack(uuid, text, text) is
  'PR9 canonical same-container sealed pack isolation RPC. Isolates one sealed pack from a multi-pack sealed current row into a new same-container current_fragment, records isolate_pack audit history, and synchronizes inventory_unit projections afterward.';
