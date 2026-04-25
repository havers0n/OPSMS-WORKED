-- 0101_swap_containers_canonical.sql
--
-- Atomic cell-to-cell container swap for Storage Mode.

create or replace function public.location_can_accept_container_for_swap(
  target_location_uuid uuid,
  container_uuid uuid,
  allowed_occupant_uuid uuid
)
returns jsonb
language plpgsql
stable
as $$
declare
  container_row record;
  target_location_row record;
  occupying_container_uuid uuid;
  gross_weight_g bigint;
begin
  select
    c.id,
    c.tenant_id,
    c.current_location_id,
    ct.width_mm,
    ct.height_mm,
    ct.depth_mm
  into container_row
  from public.containers c
  join public.container_types ct on ct.id = c.container_type_id
  where c.id = container_uuid;

  if container_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'CONTAINER_NOT_FOUND');
  end if;

  select
    l.id,
    l.tenant_id,
    l.status,
    l.capacity_mode,
    l.width_mm,
    l.height_mm,
    l.depth_mm,
    l.max_weight_g
  into target_location_row
  from public.locations l
  where l.id = target_location_uuid;

  if target_location_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'LOCATION_NOT_FOUND');
  end if;

  if target_location_row.tenant_id <> container_row.tenant_id then
    return jsonb_build_object('ok', false, 'reason', 'TENANT_MISMATCH');
  end if;

  if target_location_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'LOCATION_NOT_ACTIVE');
  end if;

  if container_row.current_location_id = target_location_row.id then
    return jsonb_build_object('ok', false, 'reason', 'SAME_LOCATION');
  end if;

  if target_location_row.capacity_mode = 'single_container' then
    select c.id
    into occupying_container_uuid
    from public.containers c
    where c.current_location_id = target_location_row.id
      and c.id <> container_uuid
      and c.id <> allowed_occupant_uuid
      and c.status not in ('closed', 'lost')
    limit 1;

    if occupying_container_uuid is not null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_OCCUPIED');
    end if;
  end if;

  if target_location_row.width_mm is not null then
    if container_row.width_mm is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_UNKNOWN');
    end if;
    if container_row.width_mm > target_location_row.width_mm then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_OVERFLOW');
    end if;
  end if;

  if target_location_row.height_mm is not null then
    if container_row.height_mm is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_UNKNOWN');
    end if;
    if container_row.height_mm > target_location_row.height_mm then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_OVERFLOW');
    end if;
  end if;

  if target_location_row.depth_mm is not null then
    if container_row.depth_mm is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_UNKNOWN');
    end if;
    if container_row.depth_mm > target_location_row.depth_mm then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_OVERFLOW');
    end if;
  end if;

  if target_location_row.max_weight_g is not null then
    gross_weight_g := public.get_container_gross_weight(container_uuid);

    if gross_weight_g is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_WEIGHT_UNKNOWN');
    end if;

    if gross_weight_g > target_location_row.max_weight_g then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_WEIGHT_OVERFLOW');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'reason', null);
end
$$;

create or replace function public.swap_containers_canonical(
  source_container_uuid uuid,
  target_container_uuid uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  source_container_row record;
  target_container_row record;
  source_location_row record;
  target_location_row record;
  source_location_container_count integer;
  target_location_container_count integer;
  target_location_container_uuid uuid;
  validation_result jsonb;
  validation_reason text;
  source_movement_uuid uuid;
  target_movement_uuid uuid;
  occurred_at_utc timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();

  if source_container_uuid = target_container_uuid then
    raise exception 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER';
  end if;

  perform 1
  from public.containers c
  where c.id in (source_container_uuid, target_container_uuid)
  order by c.id
  for update;

  select
    c.id,
    c.tenant_id,
    c.current_location_id
  into source_container_row
  from public.containers c
  where c.id = source_container_uuid
    and public.can_manage_tenant(c.tenant_id);

  if source_container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  select
    c.id,
    c.tenant_id,
    c.current_location_id
  into target_container_row
  from public.containers c
  where c.id = target_container_uuid
    and public.can_manage_tenant(c.tenant_id);

  if target_container_row.id is null then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  if source_container_row.tenant_id <> target_container_row.tenant_id then
    raise exception 'TARGET_CONTAINER_TENANT_MISMATCH';
  end if;

  if source_container_row.current_location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  if target_container_row.current_location_id is null then
    raise exception 'TARGET_CONTAINER_NOT_PLACED';
  end if;

  if source_container_row.current_location_id = target_container_row.current_location_id then
    raise exception 'SAME_LOCATION';
  end if;

  perform 1
  from public.locations l
  where l.id in (source_container_row.current_location_id, target_container_row.current_location_id)
  order by l.id
  for update;

  select *
  into source_location_row
  from public.locations l
  where l.id = source_container_row.current_location_id
    and l.tenant_id = source_container_row.tenant_id;

  if source_location_row.id is null then
    raise exception 'LOCATION_NOT_FOUND';
  end if;

  select *
  into target_location_row
  from public.locations l
  where l.id = target_container_row.current_location_id
    and l.tenant_id = target_container_row.tenant_id;

  if target_location_row.id is null then
    raise exception 'TARGET_LOCATION_NOT_FOUND';
  end if;

  select count(*)
  into source_location_container_count
  from public.containers c
  where c.current_location_id = source_location_row.id
    and c.status not in ('closed', 'lost');

  if source_location_container_count <> 1 then
    raise exception 'SOURCE_LOCATION_NOT_EXACTLY_ONE_CONTAINER';
  end if;

  select count(*)
  into target_location_container_count
  from public.containers c
  where c.current_location_id = target_location_row.id
    and c.status not in ('closed', 'lost');

  if target_location_container_count = 0 then
    raise exception 'TARGET_LOCATION_EMPTY';
  end if;

  if target_location_container_count <> 1 then
    raise exception 'TARGET_LOCATION_NOT_EXACTLY_ONE_CONTAINER';
  end if;

  select c.id
  into target_location_container_uuid
  from public.containers c
  where c.current_location_id = target_location_row.id
    and c.status not in ('closed', 'lost')
  limit 1;

  if target_location_container_uuid <> target_container_uuid then
    raise exception 'TARGET_LOCATION_OCCUPANT_MISMATCH';
  end if;

  validation_result := public.location_can_accept_container_for_swap(
    target_location_row.id,
    source_container_uuid,
    target_container_uuid
  );
  validation_reason := validation_result ->> 'reason';

  if coalesce((validation_result ->> 'ok')::boolean, false) = false then
    if validation_reason in ('TENANT_MISMATCH', 'LOCATION_NOT_FOUND') then
      raise exception 'TARGET_LOCATION_NOT_FOUND';
    end if;
    raise exception '%', validation_reason;
  end if;

  validation_result := public.location_can_accept_container_for_swap(
    source_location_row.id,
    target_container_uuid,
    source_container_uuid
  );
  validation_reason := validation_result ->> 'reason';

  if coalesce((validation_result ->> 'ok')::boolean, false) = false then
    if validation_reason in ('TENANT_MISMATCH', 'LOCATION_NOT_FOUND') then
      raise exception 'LOCATION_NOT_FOUND';
    end if;
    raise exception '%', validation_reason;
  end if;

  update public.containers
  set current_location_id         = target_location_row.id,
      current_location_entered_at = occurred_at_utc,
      updated_at                  = occurred_at_utc,
      updated_by                  = actor_uuid
  where id = source_container_uuid;

  update public.containers
  set current_location_id         = source_location_row.id,
      current_location_entered_at = occurred_at_utc,
      updated_at                  = occurred_at_utc,
      updated_by                  = actor_uuid
  where id = target_container_uuid;

  source_movement_uuid := public.insert_stock_movement(
    source_container_row.tenant_id,
    'move_container',
    source_location_row.id,
    target_location_row.id,
    source_container_uuid,
    source_container_uuid,
    null,
    null,
    null,
    null,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  target_movement_uuid := public.insert_stock_movement(
    target_container_row.tenant_id,
    'move_container',
    target_location_row.id,
    source_location_row.id,
    target_container_uuid,
    target_container_uuid,
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
    'sourceContainerId',            source_container_uuid,
    'targetContainerId',            target_container_uuid,
    'sourceContainerNewLocationId', target_location_row.id,
    'targetContainerNewLocationId', source_location_row.id,
    'sourceMovementId',             source_movement_uuid,
    'targetMovementId',             target_movement_uuid,
    'occurredAt',                   occurred_at_utc
  );
end
$$;

grant execute on function public.location_can_accept_container_for_swap(uuid, uuid, uuid) to authenticated;
grant execute on function public.swap_containers_canonical(uuid, uuid, uuid) to authenticated;
