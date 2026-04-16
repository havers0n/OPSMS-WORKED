-- 0033_waves.sql

create table if not exists public.waves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'released', 'in_progress', 'completed', 'partial', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  released_at timestamptz null,
  closed_at timestamptz null
);

create index if not exists waves_tenant_status_idx
  on public.waves(tenant_id, status);

create index if not exists waves_tenant_created_idx
  on public.waves(tenant_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_wave_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_wave_id_fkey
      foreign key (wave_id) references public.waves(id) on delete set null;
  end if;
end
$$;

grant select, insert, update on public.waves to authenticated;

alter table public.waves enable row level security;

create or replace function public.can_access_wave(wave_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.waves w
    where w.id = wave_uuid
      and public.can_access_tenant(w.tenant_id)
  )
$$;

create or replace function public.can_manage_wave(wave_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.waves w
    where w.id = wave_uuid
      and public.can_manage_tenant(w.tenant_id)
  )
$$;

create or replace function public.validate_wave_row()
returns trigger
language plpgsql
as $$
begin
  new.name := trim(new.name);

  if new.status in ('ready', 'released') and not exists (
    select 1
    from public.orders o
    where o.wave_id = new.id
  ) then
    raise exception 'Wave % must contain at least one order before status %.', new.id, new.status;
  end if;

  return new;
end
$$;

drop trigger if exists validate_wave_row on public.waves;
create trigger validate_wave_row
before insert or update on public.waves
for each row execute function public.validate_wave_row();

create or replace function public.validate_order_row()
returns trigger
language plpgsql
as $$
declare
  wave_tenant_uuid uuid;
  target_wave_status text;
  previous_wave_status text;
begin
  new.external_number := trim(new.external_number);

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

  return new;
end
$$;

drop trigger if exists validate_order_row on public.orders;
create trigger validate_order_row
before insert or update on public.orders
for each row execute function public.validate_order_row();

drop policy if exists waves_select_scoped on public.waves;
create policy waves_select_scoped
on public.waves
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists waves_insert_scoped on public.waves;
create policy waves_insert_scoped
on public.waves
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists waves_update_scoped on public.waves;
create policy waves_update_scoped
on public.waves
for update
to authenticated
using (public.can_manage_tenant(tenant_id));

create or replace function public.release_order(order_uuid uuid)
returns uuid
language plpgsql
as $$
declare
  order_row public.orders%rowtype;
  line_count integer;
  task_uuid uuid;
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

  if exists (
    select 1
    from public.pick_tasks pt
    where pt.source_type = 'order'
      and pt.source_id = order_uuid
  ) then
    raise exception 'ORDER_ALREADY_RELEASED';
  end if;

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

create or replace function public.release_wave(wave_uuid uuid)
returns integer
language plpgsql
as $$
declare
  wave_row public.waves%rowtype;
  attached_order_count integer;
  blocking_order_count integer;
  order_row record;
  released_count integer := 0;
begin
  select *
  into wave_row
  from public.waves
  where id = wave_uuid
  for update;

  if wave_row.id is null then
    raise exception 'WAVE_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(wave_row.tenant_id) then
    raise exception 'WAVE_NOT_MANAGEABLE';
  end if;

  if wave_row.status <> 'ready' then
    raise exception 'WAVE_NOT_READY';
  end if;

  select count(*)
  into attached_order_count
  from public.orders
  where wave_id = wave_uuid;

  if attached_order_count = 0 then
    raise exception 'WAVE_HAS_NO_ORDERS';
  end if;

  select count(*)
  into blocking_order_count
  from public.orders
  where wave_id = wave_uuid
    and status <> 'ready';

  if blocking_order_count > 0 then
    raise exception 'WAVE_HAS_BLOCKING_ORDERS';
  end if;

  for order_row in
    select o.id
    from public.orders o
    where o.wave_id = wave_uuid
    order by o.created_at, o.id
  loop
    perform public.release_order(order_row.id);
    released_count := released_count + 1;
  end loop;

  update public.waves
  set status = 'released',
      released_at = coalesce(released_at, timezone('utc', now()))
  where id = wave_uuid;

  return released_count;
end
$$;

grant execute on function public.release_order(uuid) to authenticated;
grant execute on function public.release_wave(uuid) to authenticated;
