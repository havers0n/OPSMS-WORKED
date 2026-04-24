-- 0096_pr8_sealed_break_pack.sql
--
-- PR8: bounded canonical sealed break-pack flow.
--
-- Scope is intentionally limited to one current-packaging mutation:
--   - break one sealed single-pack current row to opened stock
--   - keep quantity, product, container, inventory status, packaging level,
--     pack count, and receipt facts unchanged
--   - mutate container_lines.current_* first
--   - write truthful stock_movements break-pack history directly in the RPC
--   - synchronize inventory_unit afterward as projection
--
-- Out of scope:
--   - multi-pack break-pack
--   - sealed-to-loose conversion
--   - quantity changes or partial extraction
--   - packaging-level changes
--   - loose-to-packaged packing
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
      'break_pack'
    )
  );

alter table public.stock_movements
  drop constraint if exists stock_movements_break_pack_audit_check;

alter table public.stock_movements
  add constraint stock_movements_break_pack_audit_check
  check (
    movement_type <> 'break_pack'
    or (
      reason_code is not null
      and char_length(trim(reason_code)) > 0
      and quantity is not null
      and quantity > 0
      and uom is not null
      and packaging_state_before = 'sealed'
      and packaging_state_after = 'opened'
      and packaging_profile_level_id_before is not null
      and packaging_profile_level_id_after = packaging_profile_level_id_before
      and pack_count_before = 1
      and pack_count_after = 1
    )
  ) not valid;

create or replace function public.break_sealed_packaging_to_opened(
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
  movement_uuid uuid;
  occurred_at_utc timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();
  normalized_reason_code := nullif(trim(coalesce(reason_code, '')), '');
  normalized_note := nullif(trim(coalesce(note, '')), '');

  if actor_uuid is null then
    raise exception 'BREAK_PACK_ACTOR_REQUIRED';
  end if;

  if normalized_reason_code is null then
    raise exception 'BREAK_PACK_REASON_REQUIRED';
  end if;

  -- Lock order is deliberate: source inventory projection first, ensure and
  -- lock the owning canonical line second, then validate before mutation.
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
    raise exception 'BREAK_PACK_ROW_NOT_CURRENT';
  end if;

  if source_row.serial_no is not null or source_line_row.serial_no is not null then
    raise exception 'SERIAL_BREAK_PACK_NOT_ALLOWED';
  end if;

  if coalesce(source_line_row.current_inventory_status, source_row.status) <> 'available' then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE';
  end if;

  if coalesce(source_line_row.current_packaging_state, source_row.packaging_state, 'loose') = 'loose' then
    raise exception 'PACKAGING_ALREADY_LOOSE';
  end if;

  if coalesce(source_line_row.current_packaging_state, source_row.packaging_state, 'loose') = 'opened' then
    raise exception 'PACKAGING_ALREADY_OPENED';
  end if;

  if coalesce(source_line_row.current_packaging_state, source_row.packaging_state, 'loose') <> 'sealed' then
    raise exception 'BREAK_PACK_ONLY_SEALED_SUPPORTED';
  end if;

  if source_line_row.current_packaging_profile_level_id is null
     or source_line_row.current_pack_count is null then
    raise exception 'BREAK_PACK_METADATA_REQUIRED';
  end if;

  if source_line_row.current_pack_count <> 1 then
    raise exception 'BREAK_PACK_ONLY_SINGLE_PACK_SUPPORTED';
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

  update public.container_lines
  set current_packaging_state = 'opened',
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
    'break_pack',
    source_location_row.location_id,
    null,
    source_line_row.current_container_id,
    null,
    source_row.id,
    null,
    source_line_row.current_qty_each,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid,
    normalized_reason_code,
    normalized_note,
    'sealed',
    'opened',
    source_line_row.current_packaging_profile_level_id,
    source_line_row.current_packaging_profile_level_id,
    source_line_row.current_pack_count,
    source_line_row.current_pack_count
  )
  returning id into movement_uuid;

  update public.inventory_unit
  set container_id = source_line_row.current_container_id,
      quantity = source_line_row.current_qty_each,
      status = source_line_row.current_inventory_status,
      packaging_state = 'opened',
      pack_count = source_line_row.current_pack_count,
      container_line_id = source_line_row.id,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where id = source_row.id;

  return jsonb_build_object(
    'inventoryUnitId', source_row.id,
    'containerLineId', source_line_row.id,
    'containerId', source_line_row.current_container_id,
    'locationId', source_location_row.location_id,
    'quantityEach', source_line_row.current_qty_each,
    'uom', source_row.uom,
    'packagingStateBefore', 'sealed',
    'packagingStateAfter', 'opened',
    'packagingProfileLevelIdBefore', source_line_row.current_packaging_profile_level_id,
    'packagingProfileLevelIdAfter', source_line_row.current_packaging_profile_level_id,
    'packCountBefore', source_line_row.current_pack_count,
    'packCountAfter', source_line_row.current_pack_count,
    'reasonCode', normalized_reason_code,
    'note', normalized_note,
    'movementId', movement_uuid,
    'occurredAt', occurred_at_utc
  );
end
$$;

revoke execute on function public.break_sealed_packaging_to_opened(uuid, text, text)
from public, anon;

grant execute on function public.break_sealed_packaging_to_opened(uuid, text, text)
to authenticated;

comment on function public.break_sealed_packaging_to_opened(uuid, text, text) is
  'PR8 canonical sealed break-pack RPC. Converts one available single-pack sealed current row to opened stock in place, mutates container_lines.current_* first, writes direct break_pack stock_movements audit history, and syncs inventory_unit projection afterward.';
