-- 0095_pr7_canonical_packaging_normalization.sql
--
-- PR7: bounded canonical packaging normalization flow.
--
-- Scope is intentionally limited to one current-packaging mutation:
--   - normalize one opened packaged current row to loose stock
--   - keep quantity, product, container, status, and receipt facts unchanged
--   - mutate container_lines.current_* first
--   - synchronize inventory_unit afterward as projection
--   - write truthful stock_movements packaging-normalization history
--
-- Out of scope:
--   - sealed break-pack
--   - loose-to-packaged packing
--   - packaging-level changes
--   - pack-count edits while remaining packaged
--   - split/merge/repack across multiple rows
--   - read-model repointing

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
      'normalize_packaging'
    )
  );

alter table public.stock_movements
  add column if not exists packaging_state_before text null,
  add column if not exists packaging_state_after text null,
  add column if not exists packaging_profile_level_id_before uuid null references public.packaging_profile_levels(id) on delete restrict,
  add column if not exists packaging_profile_level_id_after uuid null references public.packaging_profile_levels(id) on delete restrict,
  add column if not exists pack_count_before integer null,
  add column if not exists pack_count_after integer null;

alter table public.stock_movements
  drop constraint if exists stock_movements_normalize_packaging_audit_check;

alter table public.stock_movements
  add constraint stock_movements_normalize_packaging_audit_check
  check (
    movement_type <> 'normalize_packaging'
    or (
      reason_code is not null
      and char_length(trim(reason_code)) > 0
      and quantity is not null
      and quantity > 0
      and uom is not null
      and packaging_state_before = 'opened'
      and packaging_state_after = 'loose'
      and packaging_profile_level_id_before is not null
      and packaging_profile_level_id_after is null
      and pack_count_before is not null
      and pack_count_before > 0
      and pack_count_after is null
    )
  ) not valid;

comment on column public.stock_movements.packaging_state_before is
  'Packaging state before a canonical packaging-normalization movement.';

comment on column public.stock_movements.packaging_state_after is
  'Packaging state after a canonical packaging-normalization movement.';

comment on column public.stock_movements.packaging_profile_level_id_before is
  'Canonical packaging profile level before a packaging-normalization movement.';

comment on column public.stock_movements.packaging_profile_level_id_after is
  'Canonical packaging profile level after a packaging-normalization movement.';

comment on column public.stock_movements.pack_count_before is
  'Pack count before a packaging-normalization movement.';

comment on column public.stock_movements.pack_count_after is
  'Pack count after a packaging-normalization movement.';

create or replace function public.normalize_opened_packaging_to_loose(
  source_inventory_unit_uuid uuid,
  reason_code text,
  actor_uuid uuid default null,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row record;
  source_line_row public.container_lines%rowtype;
  source_location_row record;
  normalized_reason_code text;
  normalized_note text;
  quantity_each numeric;
  movement_uuid uuid;
  occurred_at_utc timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();
  normalized_reason_code := nullif(trim(coalesce(reason_code, '')), '');
  normalized_note := nullif(trim(coalesce(note, '')), '');

  if normalized_reason_code is null then
    raise exception 'NORMALIZE_PACKAGING_REASON_REQUIRED';
  end if;

  select iu.id
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
    raise exception 'NORMALIZE_PACKAGING_ROW_NOT_CURRENT';
  end if;

  if source_row.serial_no is not null or source_line_row.serial_no is not null then
    raise exception 'SERIAL_NORMALIZE_PACKAGING_NOT_ALLOWED';
  end if;

  if coalesce(source_line_row.current_inventory_status, source_row.status) <> 'available' then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE';
  end if;

  if coalesce(source_line_row.current_packaging_state, source_row.packaging_state, 'loose') = 'loose' then
    raise exception 'PACKAGING_ALREADY_LOOSE';
  end if;

  if coalesce(source_line_row.current_packaging_state, source_row.packaging_state, 'loose') <> 'opened' then
    raise exception 'NORMALIZE_PACKAGING_ONLY_OPENED_SUPPORTED';
  end if;

  if source_line_row.current_packaging_profile_level_id is null
     or source_line_row.current_pack_count is null then
    raise exception 'NORMALIZE_PACKAGING_METADATA_REQUIRED';
  end if;

  quantity_each := source_line_row.current_qty_each;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(source_line_row.current_container_id);

  update public.container_lines
  set current_packaging_state = 'loose',
      current_packaging_profile_level_id = null,
      current_pack_count = null,
      current_updated_at = occurred_at_utc,
      current_updated_by = actor_uuid
  where id = source_line_row.id;

  update public.inventory_unit
  set container_id = source_line_row.current_container_id,
      quantity = quantity_each,
      status = source_line_row.current_inventory_status,
      packaging_state = 'loose',
      product_packaging_level_id = null,
      pack_count = null,
      container_line_id = source_line_row.id,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where id = source_row.id;

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
    'normalize_packaging',
    source_location_row.location_id,
    null,
    source_line_row.current_container_id,
    null,
    source_row.id,
    null,
    quantity_each,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid,
    normalized_reason_code,
    normalized_note,
    source_line_row.current_packaging_state,
    'loose',
    source_line_row.current_packaging_profile_level_id,
    null,
    source_line_row.current_pack_count,
    null
  )
  returning id into movement_uuid;

  return jsonb_build_object(
    'inventoryUnitId', source_row.id,
    'containerLineId', source_line_row.id,
    'containerId', source_line_row.current_container_id,
    'locationId', source_location_row.location_id,
    'quantityEach', quantity_each,
    'uom', source_row.uom,
    'packagingStateBefore', source_line_row.current_packaging_state,
    'packagingStateAfter', 'loose',
    'packagingProfileLevelIdBefore', source_line_row.current_packaging_profile_level_id,
    'packagingProfileLevelIdAfter', null,
    'packCountBefore', source_line_row.current_pack_count,
    'packCountAfter', null,
    'reasonCode', normalized_reason_code,
    'note', normalized_note,
    'movementId', movement_uuid,
    'occurredAt', occurred_at_utc
  );
end
$$;

revoke execute on function public.normalize_opened_packaging_to_loose(uuid, text, uuid, text)
from public, anon;

grant execute on function public.normalize_opened_packaging_to_loose(uuid, text, uuid, text)
to authenticated;

comment on function public.normalize_opened_packaging_to_loose(uuid, text, uuid, text) is
  'PR7 canonical packaging-normalization RPC. Converts one opened packaged current row to loose stock in place, mutates container_lines.current_* first, syncs inventory_unit projection afterward, and writes normalize_packaging stock_movements history.';
