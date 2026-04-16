-- 0083_order_reservations.sql
--
-- Order reservation / ATP layer. This is intentionally separate from
-- allocation/picking and from inventory_unit.status = 'reserved'.

create table if not exists public.order_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric not null check (quantity > 0),
  status text not null default 'active'
    check (status in ('active', 'released', 'rolled_back', 'closed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  released_at timestamptz null,
  rolled_back_at timestamptz null,
  closed_at timestamptz null,
  cancelled_at timestamptz null,
  created_by uuid null references public.profiles(id),
  released_by uuid null references public.profiles(id),
  rolled_back_by uuid null references public.profiles(id),
  closed_by uuid null references public.profiles(id),
  cancelled_by uuid null references public.profiles(id),
  rollback_reason text null,
  cancel_reason text null
);

create index if not exists order_reservations_tenant_product_status_idx
  on public.order_reservations(tenant_id, product_id, status);

create index if not exists order_reservations_tenant_order_idx
  on public.order_reservations(tenant_id, order_id);

create index if not exists order_reservations_tenant_order_line_idx
  on public.order_reservations(tenant_id, order_line_id);

create unique index if not exists order_reservations_active_line_unique
  on public.order_reservations(order_line_id)
  where status in ('active', 'released');

drop trigger if exists set_order_reservations_updated_at on public.order_reservations;
create trigger set_order_reservations_updated_at
before update on public.order_reservations
for each row execute function public.set_updated_at();

grant select, insert, update on public.order_reservations to authenticated;

alter table public.order_reservations enable row level security;

drop policy if exists order_reservations_select_scoped on public.order_reservations;
create policy order_reservations_select_scoped
on public.order_reservations
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists order_reservations_insert_scoped on public.order_reservations;
create policy order_reservations_insert_scoped
on public.order_reservations
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists order_reservations_update_scoped on public.order_reservations;
create policy order_reservations_update_scoped
on public.order_reservations
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

create or replace function public.validate_order_reservation_row()
returns trigger
language plpgsql
as $$
declare
  order_tenant_uuid uuid;
  line_row record;
begin
  select o.tenant_id
  into order_tenant_uuid
  from public.orders o
  where o.id = new.order_id;

  if order_tenant_uuid is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if order_tenant_uuid <> new.tenant_id then
    raise exception 'TENANT_MISMATCH';
  end if;

  select ol.tenant_id, ol.order_id, ol.product_id
  into line_row
  from public.order_lines ol
  where ol.id = new.order_line_id;

  if line_row.order_id is null then
    raise exception 'ORDER_LINE_NOT_FOUND';
  end if;

  if line_row.tenant_id <> new.tenant_id
    or line_row.order_id <> new.order_id
    or line_row.product_id is distinct from new.product_id then
    raise exception 'RESERVATION_MISMATCH';
  end if;

  return new;
end
$$;

drop trigger if exists validate_order_reservation_row on public.order_reservations;
create trigger validate_order_reservation_row
before insert or update on public.order_reservations
for each row execute function public.validate_order_reservation_row();

create or replace function public.order_physical_available_qty(
  tenant_uuid uuid,
  product_uuid uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(iu.quantity), 0)
  from public.inventory_unit iu
  where iu.tenant_id = tenant_uuid
    and iu.product_id = product_uuid
    and iu.status = 'available'
$$;

create or replace function public.order_reserved_qty(
  tenant_uuid uuid,
  product_uuid uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(orv.quantity), 0)
  from public.order_reservations orv
  where orv.tenant_id = tenant_uuid
    and orv.product_id = product_uuid
    and orv.status in ('active', 'released')
$$;

create or replace function public.order_available_to_promise_qty(
  tenant_uuid uuid,
  product_uuid uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  select public.order_physical_available_qty(tenant_uuid, product_uuid)
       - public.order_reserved_qty(tenant_uuid, product_uuid)
$$;

grant execute on function public.order_physical_available_qty(uuid, uuid) to authenticated;
grant execute on function public.order_reserved_qty(uuid, uuid) to authenticated;
grant execute on function public.order_available_to_promise_qty(uuid, uuid) to authenticated;

create or replace function public.lock_order_reservation_products(
  tenant_uuid uuid,
  product_uuids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  product_uuid uuid;
begin
  foreach product_uuid in array product_uuids
  loop
    perform pg_advisory_xact_lock(hashtextextended(tenant_uuid::text || ':' || product_uuid::text, 0));
  end loop;
end
$$;

create or replace function public.validate_order_row()
returns trigger
language plpgsql
as $$
declare
  wave_tenant_uuid uuid;
  target_wave_status text;
  previous_wave_status text;
  reservation_status_update_allowed boolean;
begin
  new.external_number := trim(new.external_number);
  reservation_status_update_allowed :=
    coalesce(current_setting('wos.allow_order_reservation_status_update', true), '') = 'on';

  if new.wave_id is not null then
    select w.tenant_id, w.status
    into wave_tenant_uuid, target_wave_status
    from public.waves w
    where w.id = new.wave_id;

    if wave_tenant_uuid is null then
      raise exception 'Wave % was not found for order.', new.wave_id;
    end if;

    if wave_tenant_uuid <> new.tenant_id then
      raise exception 'Order tenant % does not match wave tenant %.', new.tenant_id, wave_tenant_uuid;
    end if;

    if target_wave_status in ('released', 'closed') and (tg_op = 'INSERT' or new.wave_id is distinct from old.wave_id) then
      raise exception 'Cannot add orders to a released wave.';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.wave_id is distinct from old.wave_id and old.wave_id is not null then
    select w.status
    into previous_wave_status
    from public.waves w
    where w.id = old.wave_id;

    if previous_wave_status in ('released', 'closed') then
      raise exception 'Cannot remove orders from a released wave.';
    end if;
  end if;

  if new.status in ('ready', 'released') and not exists (
    select 1
    from public.order_lines ol
    where ol.order_id = new.id
  ) then
    raise exception 'Order % must contain at least one line before status %.', new.id, new.status;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'ready' and not reservation_status_update_allowed then
      raise exception 'ORDER_RESERVATION_REQUIRED';
    end if;

    if old.status = 'ready' and new.status = 'draft' and not reservation_status_update_allowed then
      raise exception 'ROLLBACK_TO_DRAFT_REQUIRED';
    end if;

    if old.status = 'ready' and new.status = 'released' and not reservation_status_update_allowed then
      raise exception 'RESERVATION_MISMATCH';
    end if;

    if new.status = 'closed' and not reservation_status_update_allowed then
      raise exception 'ORDER_UNRESERVE_REQUIRED';
    end if;

    if new.status = 'cancelled'
      and old.status <> 'draft'
      and not reservation_status_update_allowed then
      raise exception 'ORDER_UNRESERVE_REQUIRED';
    end if;
  end if;

  return new;
end
$$;

create or replace function public.validate_order_line_row()
returns trigger
language plpgsql
as $$
declare
  order_tenant_uuid uuid;
  order_status text;
  committed_line_update_allowed boolean;
begin
  select o.tenant_id, o.status
  into order_tenant_uuid, order_status
  from public.orders o
  where o.id = new.order_id;

  if order_tenant_uuid is null then
    raise exception 'Order % was not found for order line.', new.order_id;
  end if;

  if order_tenant_uuid <> new.tenant_id then
    raise exception 'Order line tenant % does not match order tenant %.', new.tenant_id, order_tenant_uuid;
  end if;

  committed_line_update_allowed :=
    coalesce(current_setting('wos.allow_committed_order_line_system_update', true), '') = 'on';

  if order_status <> 'draft' and not committed_line_update_allowed then
    raise exception 'ORDER_NOT_EDITABLE_IN_READY';
  end if;

  new.sku := trim(new.sku);
  new.name := trim(new.name);

  return new;
end
$$;

create or replace function public.prevent_committed_order_line_delete()
returns trigger
language plpgsql
as $$
declare
  order_status text;
  committed_line_update_allowed boolean;
begin
  select o.status
  into order_status
  from public.orders o
  where o.id = old.order_id;

  committed_line_update_allowed :=
    coalesce(current_setting('wos.allow_committed_order_line_system_update', true), '') = 'on';

  if order_status <> 'draft' and not committed_line_update_allowed then
    raise exception 'ORDER_NOT_EDITABLE_IN_READY';
  end if;

  return old;
end
$$;

drop trigger if exists prevent_committed_order_line_delete on public.order_lines;
create trigger prevent_committed_order_line_delete
before delete on public.order_lines
for each row execute function public.prevent_committed_order_line_delete();

create or replace function public.commit_order_reservations(order_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  actor_uuid uuid := auth.uid();
  line_count integer;
  product_uuid uuid;
  required_qty numeric;
  physical_qty numeric;
  reserved_qty numeric;
  atp_qty numeric;
  shortage_sku text;
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status <> 'draft' then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  perform 1
  from public.order_lines ol
  where ol.order_id = order_uuid
  for update;
  get diagnostics line_count = row_count;

  if line_count = 0 then
    raise exception 'ORDER_HAS_NO_LINES';
  end if;

  if exists (
    select 1
    from public.order_lines ol
    where ol.order_id = order_uuid
      and ol.product_id is null
  ) then
    raise exception 'ORDER_LINE_PRODUCT_REQUIRED';
  end if;

  perform public.lock_order_reservation_products(
    order_row.tenant_id,
    array(
      select distinct ol.product_id
      from public.order_lines ol
      where ol.order_id = order_uuid
        and ol.product_id is not null
      order by ol.product_id
    )
  );

  for product_uuid, required_qty, shortage_sku in
    select ol.product_id, sum(ol.qty_required)::numeric, min(ol.sku)
    from public.order_lines ol
    where ol.order_id = order_uuid
    group by ol.product_id
    order by ol.product_id
  loop
    physical_qty := public.order_physical_available_qty(order_row.tenant_id, product_uuid);
    reserved_qty := public.order_reserved_qty(order_row.tenant_id, product_uuid);
    atp_qty := physical_qty - reserved_qty;

    if required_qty > atp_qty then
      raise exception 'INSUFFICIENT_STOCK'
        using detail = json_build_object(
          'shortage',
          json_build_object(
            'sku', shortage_sku,
            'required', required_qty,
            'physical', physical_qty,
            'reserved', reserved_qty,
            'atp', atp_qty
          )
        )::text;
    end if;
  end loop;

  insert into public.order_reservations (
    tenant_id,
    order_id,
    order_line_id,
    product_id,
    quantity,
    status,
    created_by
  )
  select
    ol.tenant_id,
    ol.order_id,
    ol.id,
    ol.product_id,
    ol.qty_required,
    'active',
    actor_uuid
  from public.order_lines ol
  where ol.order_id = order_uuid;

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.orders
  set status = 'ready'
  where id = order_uuid;

  return order_uuid;
end
$$;

create or replace function public.rollback_ready_order_to_draft(
  order_uuid uuid,
  reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  actor_uuid uuid := auth.uid();
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status <> 'ready' then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  update public.order_reservations
  set status = 'rolled_back',
      rolled_back_at = timezone('utc', now()),
      rolled_back_by = actor_uuid,
      rollback_reason = nullif(trim(coalesce(reason, '')), '')
  where order_id = order_uuid
    and status in ('active', 'released');

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.orders
  set status = 'draft'
  where id = order_uuid;

  return order_uuid;
end
$$;

create or replace function public.cancel_order_with_unreserve(
  order_uuid uuid,
  reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  actor_uuid uuid := auth.uid();
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status in ('closed', 'cancelled') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  update public.order_reservations
  set status = 'cancelled',
      cancelled_at = timezone('utc', now()),
      cancelled_by = actor_uuid,
      cancel_reason = nullif(trim(coalesce(reason, '')), '')
  where order_id = order_uuid
    and status in ('active', 'released');

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.orders
  set status = 'cancelled'
  where id = order_uuid;

  return order_uuid;
end
$$;

create or replace function public.close_order_with_unreserve(order_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  actor_uuid uuid := auth.uid();
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status not in ('picked', 'partial') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  update public.order_reservations
  set status = 'closed',
      closed_at = timezone('utc', now()),
      closed_by = actor_uuid
  where order_id = order_uuid
    and status in ('active', 'released');

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.orders
  set status = 'closed',
      closed_at = coalesce(closed_at, timezone('utc', now()))
  where id = order_uuid;

  return order_uuid;
end
$$;

create or replace function public.release_order(order_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  line_count integer;
  reservation_mismatch_count integer;
  task_uuid uuid;
  actor_uuid uuid := auth.uid();
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status <> 'ready' then
    raise exception 'ORDER_NOT_READY';
  end if;

  select count(*)
  into line_count
  from public.order_lines
  where order_id = order_uuid;

  if line_count = 0 then
    raise exception 'ORDER_HAS_NO_LINES';
  end if;

  select count(*)
  into reservation_mismatch_count
  from public.order_lines ol
  left join public.order_reservations orv
    on orv.order_line_id = ol.id
   and orv.status = 'active'
  where ol.order_id = order_uuid
    and (
      orv.id is null
      or orv.tenant_id <> ol.tenant_id
      or orv.order_id <> ol.order_id
      or orv.product_id is distinct from ol.product_id
      or orv.quantity <> ol.qty_required
    );

  if reservation_mismatch_count > 0 then
    raise exception 'RESERVATION_MISMATCH';
  end if;

  if exists (
    select 1
    from public.pick_tasks pt
    where pt.source_type = 'order'
      and pt.source_id = order_uuid
  ) then
    raise exception 'ORDER_ALREADY_RELEASED';
  end if;

  update public.order_reservations
  set status = 'released',
      released_at = coalesce(released_at, timezone('utc', now())),
      released_by = coalesce(released_by, actor_uuid)
  where order_id = order_uuid
    and status = 'active';

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (order_row.tenant_id, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps (
    task_id,
    tenant_id,
    order_id,
    order_line_id,
    sequence_no,
    sku,
    item_name,
    qty_required,
    status
  )
  select
    task_uuid,
    ol.tenant_id,
    ol.order_id,
    ol.id,
    row_number() over (order by ol.id),
    ol.sku,
    ol.name,
    ol.qty_required,
    'pending'
  from public.order_lines ol
  where ol.order_id = order_uuid
  order by ol.id;

  perform set_config('wos.allow_committed_order_line_system_update', 'on', true);
  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.order_lines
  set status = 'released'
  where order_id = order_uuid;

  update public.orders
  set status = 'released',
      released_at = coalesce(released_at, timezone('utc', now()))
  where id = order_uuid;

  return task_uuid;
end
$$;

grant execute on function public.lock_order_reservation_products(uuid, uuid[]) to authenticated;
grant execute on function public.commit_order_reservations(uuid) to authenticated;
grant execute on function public.rollback_ready_order_to_draft(uuid, text) to authenticated;
grant execute on function public.cancel_order_with_unreserve(uuid, text) to authenticated;
grant execute on function public.close_order_with_unreserve(uuid) to authenticated;
grant execute on function public.release_order(uuid) to authenticated;
