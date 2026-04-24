-- 0098_pr10_break_one_pack_orchestration.sql
--
-- PR10: bounded orchestration for breaking one sealed pack out of a
-- sealed multi-pack row into opened packaged stock.
--
-- Scope is intentionally limited to one composition:
--   - call PR9 same-container sealed pack isolation
--   - call PR8 sealed single-pack break-pack on the isolated target
--   - stop at opened packaged stock
--
-- Out of scope:
--   - generic repack engine
--   - automatic opened-to-loose normalization
--   - packaging-level changes
--   - multi-container behavior
--   - loose-to-packaged packing
--   - direct table DML reopening

create or replace function public.break_one_pack_from_multipack_to_opened(
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
  normalized_reason_code text;
  normalized_note text;
  isolate_result jsonb;
  break_result jsonb;
  target_inventory_unit_uuid uuid;
begin
  actor_uuid := auth.uid();
  normalized_reason_code := nullif(trim(coalesce(reason_code, '')), '');
  normalized_note := nullif(trim(coalesce(note, '')), '');

  if actor_uuid is null then
    raise exception 'BREAK_ONE_PACK_ACTOR_REQUIRED';
  end if;

  if normalized_reason_code is null then
    raise exception 'BREAK_ONE_PACK_REASON_REQUIRED';
  end if;

  isolate_result := public.isolate_sealed_pack_from_multipack(
    source_inventory_unit_uuid,
    normalized_reason_code,
    normalized_note
  );

  target_inventory_unit_uuid := (isolate_result ->> 'targetInventoryUnitId')::uuid;

  if target_inventory_unit_uuid is null then
    raise exception 'BREAK_ONE_PACK_TARGET_REQUIRED';
  end if;

  break_result := public.break_sealed_packaging_to_opened(
    target_inventory_unit_uuid,
    normalized_reason_code,
    normalized_note
  );

  return jsonb_build_object(
    'sourceInventoryUnitId', (isolate_result ->> 'sourceInventoryUnitId')::uuid,
    'targetInventoryUnitId', target_inventory_unit_uuid,
    'sourceContainerLineId', (isolate_result ->> 'sourceContainerLineId')::uuid,
    'targetContainerLineId', (isolate_result ->> 'targetContainerLineId')::uuid,
    'containerId', (isolate_result ->> 'containerId')::uuid,
    'sourceContainerId', (isolate_result ->> 'sourceContainerId')::uuid,
    'targetContainerId', (isolate_result ->> 'targetContainerId')::uuid,
    'locationId', (isolate_result ->> 'locationId')::uuid,
    'sourceQuantityBefore', (isolate_result ->> 'sourceQuantityBefore')::numeric,
    'sourceQuantityAfter', (isolate_result ->> 'sourceQuantityAfter')::numeric,
    'sourcePackCountBefore', (isolate_result ->> 'sourcePackCountBefore')::integer,
    'sourcePackCountAfter', (isolate_result ->> 'sourcePackCountAfter')::integer,
    'targetQuantityEach', (break_result ->> 'quantityEach')::numeric,
    'targetPackCount', (break_result ->> 'packCountAfter')::integer,
    'targetPackagingStateBefore', break_result ->> 'packagingStateBefore',
    'targetPackagingStateAfter', break_result ->> 'packagingStateAfter',
    'packagingProfileLevelId', (break_result ->> 'packagingProfileLevelIdAfter')::uuid,
    'isolateMovementId', (isolate_result ->> 'movementId')::uuid,
    'breakPackMovementId', (break_result ->> 'movementId')::uuid,
    'reasonCode', normalized_reason_code,
    'note', normalized_note,
    'occurredAt', break_result ->> 'occurredAt',
    'isolateResult', isolate_result,
    'breakPackResult', break_result
  );
end
$$;

revoke execute on function public.break_one_pack_from_multipack_to_opened(uuid, text, text)
from public, anon;

grant execute on function public.break_one_pack_from_multipack_to_opened(uuid, text, text)
to authenticated;

comment on function public.break_one_pack_from_multipack_to_opened(uuid, text, text) is
  'PR10 bounded packaging orchestration RPC. Isolates exactly one sealed pack from a sealed multi-pack current row via PR9, breaks the isolated single-pack target to opened via PR8, and leaves canonical truth in container_lines with inventory_unit as projection.';
