-- 0067_order_wave_membership_rpcs.sql
--
-- Atomic order-wave membership commands for PR-05.
-- Scope:
--   - add attach_order_to_wave(wave_uuid, order_uuid)
--   - add detach_order_from_wave(wave_uuid, order_uuid)
--   - keep route HTTP contract untouched (rewire is PR-06)

create or replace function public.attach_order_to_wave(
  wave_uuid uuid,
  order_uuid uuid
)
returns uuid
language plpgsql
as $$
declare
  wave_row public.waves%rowtype;
  order_row public.orders%rowtype;
begin
  -- Lock wave first, then order.
  -- This ordering is intentional and matches existing release_wave flow
  -- (wave -> orders) to reduce deadlock risk across concurrent wave ops.
  select *
  into wave_row
  from public.waves
  where id = wave_uuid
  for update;

  if wave_row.id is null then
    raise exception 'WAVE_NOT_FOUND';
  end if;

  if wave_row.status not in ('draft', 'ready') then
    raise exception 'WAVE_MEMBERSHIP_LOCKED';
  end if;

  -- Lock the order row in the same transaction so attachability checks and
  -- membership write are evaluated against a single, race-safe snapshot.
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if order_row.wave_id = wave_uuid then
    raise exception 'ORDER_ALREADY_IN_WAVE';
  end if;

  if order_row.wave_id is not null then
    raise exception 'ORDER_ALREADY_IN_WAVE';
  end if;

  if order_row.status not in ('draft', 'ready') then
    raise exception 'ORDER_NOT_ATTACHABLE';
  end if;

  if order_row.tenant_id <> wave_row.tenant_id then
    raise exception 'TENANT_MISMATCH';
  end if;

  update public.orders
  set wave_id = wave_uuid
  where id = order_row.id;

  return order_row.id;
end
$$;

create or replace function public.detach_order_from_wave(
  wave_uuid uuid,
  order_uuid uuid
)
returns uuid
language plpgsql
as $$
declare
  wave_row public.waves%rowtype;
  order_row public.orders%rowtype;
begin
  -- Lock wave first, then order (same reasoning as attach_order_to_wave).
  select *
  into wave_row
  from public.waves
  where id = wave_uuid
  for update;

  if wave_row.id is null then
    raise exception 'WAVE_NOT_FOUND';
  end if;

  if wave_row.status not in ('draft', 'ready') then
    raise exception 'WAVE_MEMBERSHIP_LOCKED';
  end if;

  -- Order lock is required so in-wave validation and detach write are atomic
  -- under concurrent attach/detach attempts for the same order.
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if order_row.wave_id is distinct from wave_uuid then
    raise exception 'ORDER_NOT_IN_WAVE';
  end if;

  if order_row.status not in ('draft', 'ready') then
    raise exception 'ORDER_NOT_DETACHABLE';
  end if;

  if order_row.tenant_id <> wave_row.tenant_id then
    raise exception 'TENANT_MISMATCH';
  end if;

  update public.orders
  set wave_id = null
  where id = order_row.id;

  return order_row.id;
end
$$;

grant execute on function public.attach_order_to_wave(uuid, uuid) to authenticated;
grant execute on function public.detach_order_from_wave(uuid, uuid) to authenticated;
