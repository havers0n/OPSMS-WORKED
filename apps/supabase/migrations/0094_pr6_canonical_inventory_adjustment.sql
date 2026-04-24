-- 0094_pr6_canonical_inventory_adjustment.sql
--
-- PR6: bounded canonical inventory adjustment flow.
--
-- Scope is intentionally limited to one current-stock correction path:
--   - add minimal adjustment audit columns to stock_movements
--   - expose adjust_inventory_unit_canonical(...) as the only sanctioned
--     application adjustment mutation surface
--   - mutate container_lines.current_* first
--   - synchronize inventory_unit afterward as projection
--   - write truthful stock_movements history
--
-- Out of scope:
--   - set-to adjustments
--   - serial adjustments
--   - packaged/repack/normalize adjustments
--   - cycle count workflow redesign
--   - read-model/UI changes

alter table public.stock_movements
  add column if not exists reason_code text null,
  add column if not exists note text null,
  add column if not exists quantity_delta numeric null,
  add column if not exists quantity_after numeric null;

-- PR5 made container_lines readable but documented it as function-only for
-- current-state mutation. Make that boundary explicit before adding the first
-- supported adjustment writer.
revoke insert, update, delete on table public.container_lines
from authenticated, anon, public;

alter table public.stock_movements
  drop constraint if exists stock_movements_adjust_audit_check;

alter table public.stock_movements
  add constraint stock_movements_adjust_audit_check
  check (
    movement_type <> 'adjust'
    or (
      reason_code is not null
      and char_length(trim(reason_code)) > 0
      and quantity_delta is not null
      and quantity_delta <> 0
      and quantity_after is not null
      and quantity_after >= 0
      and quantity is not null
      and quantity = abs(quantity_delta)
      and uom is not null
    )
  ) not valid;

comment on column public.stock_movements.reason_code is
  'Required reason code for canonical adjustment movements.';

comment on column public.stock_movements.note is
  'Optional operator note for canonical adjustment movements.';

comment on column public.stock_movements.quantity_delta is
  'Signed each-quantity delta for canonical adjustment movements.';

comment on column public.stock_movements.quantity_after is
  'Canonical current each-quantity after the adjustment movement commits.';

create or replace function public.adjust_inventory_unit_canonical(
  source_inventory_unit_uuid uuid,
  delta_each integer,
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
  quantity_before numeric;
  quantity_after numeric;
  movement_uuid uuid;
  occurred_at_utc timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();
  normalized_reason_code := nullif(trim(coalesce(reason_code, '')), '');
  normalized_note := nullif(trim(coalesce(note, '')), '');

  if normalized_reason_code is null then
    raise exception 'ADJUSTMENT_REASON_REQUIRED';
  end if;

  if delta_each = 0 then
    raise exception 'INVALID_ADJUSTMENT_DELTA';
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
    raise exception 'ADJUSTMENT_ROW_NOT_CURRENT';
  end if;

  if source_row.serial_no is not null or source_line_row.serial_no is not null then
    raise exception 'SERIAL_ADJUSTMENT_NOT_ALLOWED';
  end if;

  if coalesce(source_line_row.current_inventory_status, source_row.status) <> 'available' then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE';
  end if;

  if coalesce(source_line_row.current_packaging_state, source_row.packaging_state, 'loose') <> 'loose'
     or source_line_row.current_packaging_profile_level_id is not null
     or source_line_row.current_pack_count is not null
     or source_row.product_packaging_level_id is not null
     or source_row.pack_count is not null then
    raise exception 'PACKAGED_ADJUSTMENT_NOT_SUPPORTED';
  end if;

  quantity_before := source_line_row.current_qty_each;
  quantity_after := quantity_before + delta_each;

  if quantity_after < 0 then
    raise exception 'ADJUSTMENT_QUANTITY_NEGATIVE';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(source_line_row.current_container_id);

  update public.container_lines
  set current_qty_each = quantity_after,
      current_updated_at = occurred_at_utc,
      current_updated_by = actor_uuid
  where id = source_line_row.id;

  update public.inventory_unit
  set container_id = source_line_row.current_container_id,
      quantity = quantity_after,
      status = source_line_row.current_inventory_status,
      packaging_state = source_line_row.current_packaging_state,
      pack_count = source_line_row.current_pack_count,
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
    quantity_delta,
    quantity_after
  )
  values (
    source_row.tenant_id,
    'adjust',
    source_location_row.location_id,
    null,
    source_line_row.current_container_id,
    null,
    source_row.id,
    null,
    abs(delta_each),
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid,
    normalized_reason_code,
    normalized_note,
    delta_each,
    quantity_after
  )
  returning id into movement_uuid;

  return jsonb_build_object(
    'inventoryUnitId', source_row.id,
    'containerLineId', source_line_row.id,
    'containerId', source_line_row.current_container_id,
    'locationId', source_location_row.location_id,
    'deltaEach', delta_each,
    'quantityBefore', quantity_before,
    'quantityAfter', quantity_after,
    'uom', source_row.uom,
    'reasonCode', normalized_reason_code,
    'note', normalized_note,
    'movementId', movement_uuid,
    'occurredAt', occurred_at_utc
  );
end
$$;

revoke execute on function public.adjust_inventory_unit_canonical(uuid, integer, text, uuid, text)
from public, anon;

grant execute on function public.adjust_inventory_unit_canonical(uuid, integer, text, uuid, text)
to authenticated;

comment on function public.adjust_inventory_unit_canonical(uuid, integer, text, uuid, text) is
  'PR6 canonical current-stock adjustment RPC. Mutates container_lines.current_* first, syncs inventory_unit projection afterward, and writes adjust stock_movements history.';
