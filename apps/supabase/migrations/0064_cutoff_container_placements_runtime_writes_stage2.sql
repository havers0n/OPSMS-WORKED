-- 0064_cutoff_container_placements_runtime_writes_stage2.sql
--
-- Stage 2 runtime write cutoff for container_placements.
--
-- Scope intentionally limited to the first-party move path:
--   - move_container_canonical
--
-- This migration removes the runtime projection sync call so first-party
-- canonical moves no longer write to public.container_placements.
--
-- This migration does NOT:
--   - drop public.container_placements
--   - modify public.sync_container_placement_projection
--   - modify compatibility wrapper functions

create or replace function public.move_container_canonical(
  container_uuid       uuid,
  target_location_uuid uuid,
  actor_uuid           uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  container_row       record;
  source_location_row record;
  validation_result   jsonb;
  validation_reason   text;
  movement_uuid       uuid;
  occurred_at_utc     timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();

  select
    c.id,
    c.tenant_id,
    c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.current_location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(container_uuid);

  validation_result := public.location_can_accept_container(
    target_location_uuid,
    container_uuid
  );
  validation_reason := validation_result ->> 'reason';

  if coalesce((validation_result ->> 'ok')::boolean, false) = false then
    if validation_reason in ('TENANT_MISMATCH', 'LOCATION_NOT_FOUND') then
      raise exception 'TARGET_LOCATION_NOT_FOUND';
    end if;
    raise exception '%', validation_reason;
  end if;

  update public.containers
  set current_location_id         = target_location_uuid,
      current_location_entered_at = occurred_at_utc,
      updated_at                  = occurred_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  movement_uuid := public.insert_stock_movement(
    container_row.tenant_id,
    'move_container',
    source_location_row.location_id,
    target_location_uuid,
    container_uuid,
    container_uuid,
    null,
    null,
    null,
    null,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'containerId',      container_uuid,
    'sourceLocationId', source_location_row.location_id,
    'targetLocationId', target_location_uuid,
    'movementId',       movement_uuid,
    'occurredAt',       occurred_at_utc
  );
end
$$;
