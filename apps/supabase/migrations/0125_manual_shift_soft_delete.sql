-- manual_shift_soft_delete
-- Description: Add soft-delete lifecycle for manual shift points/lines and line audit events.

alter table public.manual_shift_lines
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by_profile_id uuid null references public.profiles(id) on delete set null,
  add column if not exists deleted_by_name text null,
  add column if not exists delete_reason text null;

alter table public.manual_shift_orders
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by_profile_id uuid null references public.profiles(id) on delete set null,
  add column if not exists deleted_by_name text null,
  add column if not exists delete_reason text null;

create table if not exists public.manual_shift_line_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  line_id uuid not null references public.manual_shift_lines(id) on delete cascade,
  event_type text not null
    check (event_type in ('line_deleted', 'line_restored')),
  actor_profile_id uuid null references public.profiles(id) on delete set null,
  actor_name text null,
  payload jsonb null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists manual_shift_orders_shift_line_deleted_idx
  on public.manual_shift_orders(tenant_id, shift_id, line_id, deleted_at, created_at desc);

create index if not exists manual_shift_orders_shift_deleted_status_idx
  on public.manual_shift_orders(tenant_id, shift_id, deleted_at, status, created_at desc);

create index if not exists manual_shift_lines_shift_deleted_idx
  on public.manual_shift_lines(tenant_id, shift_id, deleted_at, sort_order, created_at);

create index if not exists manual_shift_line_events_line_idx
  on public.manual_shift_line_events(line_id, created_at desc);

alter table public.manual_shift_order_events
  drop constraint if exists manual_shift_order_events_event_type_check;

alter table public.manual_shift_order_events
  add constraint manual_shift_order_events_event_type_check
  check (
    event_type in (
      'created',
      'updated',
      'status_changed',
      'error_reported',
      'error_fixed',
      'comment_updated',
      'picker_changed',
      'checker_changed',
      'bulk_imported',
      'point_deleted',
      'point_restored'
    )
  );

create or replace function public.validate_manual_shift_line_row()
returns trigger
language plpgsql
as $$
declare
  shift_tenant_uuid uuid;
begin
  select ms.tenant_id
  into shift_tenant_uuid
  from public.manual_shift_sessions ms
  where ms.id = new.shift_id;

  if shift_tenant_uuid is null then
    raise exception 'MANUAL_SHIFT_SESSION_NOT_FOUND';
  end if;

  if shift_tenant_uuid <> new.tenant_id then
    raise exception 'MANUAL_SHIFT_LINE_TENANT_MISMATCH';
  end if;

  new.name := trim(new.name);
  new.deleted_by_name := nullif(trim(coalesce(new.deleted_by_name, '')), '');
  new.delete_reason := nullif(trim(coalesce(new.delete_reason, '')), '');

  return new;
end;
$$;

create or replace function public.validate_manual_shift_order_row()
returns trigger
language plpgsql
as $$
declare
  session_row public.manual_shift_sessions%rowtype;
  line_row public.manual_shift_lines%rowtype;
begin
  select *
  into session_row
  from public.manual_shift_sessions
  where id = new.shift_id;

  if session_row.id is null then
    raise exception 'MANUAL_SHIFT_SESSION_NOT_FOUND';
  end if;

  select *
  into line_row
  from public.manual_shift_lines
  where id = new.line_id;

  if line_row.id is null then
    raise exception 'MANUAL_SHIFT_LINE_NOT_FOUND';
  end if;

  if session_row.tenant_id <> new.tenant_id or line_row.tenant_id <> new.tenant_id then
    raise exception 'MANUAL_SHIFT_ORDER_TENANT_MISMATCH';
  end if;

  if line_row.shift_id <> new.shift_id then
    raise exception 'MANUAL_SHIFT_ORDER_LINE_SHIFT_MISMATCH';
  end if;

  new.order_number := nullif(trim(coalesce(new.order_number, '')), '');
  new.customer_name := nullif(trim(coalesce(new.customer_name, '')), '');
  new.point_name := nullif(trim(coalesce(new.point_name, '')), '');
  new.picker_name := nullif(trim(coalesce(new.picker_name, '')), '');
  new.checker_name := nullif(trim(coalesce(new.checker_name, '')), '');
  new.comment := nullif(trim(coalesce(new.comment, '')), '');
  new.deleted_by_name := nullif(trim(coalesce(new.deleted_by_name, '')), '');
  new.delete_reason := nullif(trim(coalesce(new.delete_reason, '')), '');

  return new;
end;
$$;

create or replace function public.validate_manual_shift_line_event_row()
returns trigger
language plpgsql
as $$
declare
  line_row public.manual_shift_lines%rowtype;
begin
  select *
  into line_row
  from public.manual_shift_lines
  where id = new.line_id;

  if line_row.id is null then
    raise exception 'MANUAL_SHIFT_LINE_NOT_FOUND';
  end if;

  if line_row.tenant_id <> new.tenant_id then
    raise exception 'MANUAL_SHIFT_LINE_EVENT_TENANT_MISMATCH';
  end if;

  if line_row.shift_id <> new.shift_id then
    raise exception 'MANUAL_SHIFT_LINE_EVENT_SCOPE_MISMATCH';
  end if;

  new.actor_name := nullif(trim(coalesce(new.actor_name, '')), '');

  return new;
end;
$$;

drop trigger if exists validate_manual_shift_line_event_row on public.manual_shift_line_events;
create trigger validate_manual_shift_line_event_row
before insert or update on public.manual_shift_line_events
for each row execute function public.validate_manual_shift_line_event_row();

grant select, insert on public.manual_shift_line_events to authenticated;

alter table public.manual_shift_line_events enable row level security;

drop policy if exists manual_shift_line_events_select_scoped on public.manual_shift_line_events;
create policy manual_shift_line_events_select_scoped
on public.manual_shift_line_events
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_line_events_insert_scoped on public.manual_shift_line_events;
create policy manual_shift_line_events_insert_scoped
on public.manual_shift_line_events
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop function if exists public.manual_shift_list_line_summaries(uuid, uuid);

create or replace function public.manual_shift_list_line_summaries(p_shift_id uuid, p_tenant_id uuid)
returns table (
  line_id uuid,
  tenant_id uuid,
  shift_id uuid,
  name text,
  sort_order integer,
  status text,
  created_at timestamptz,
  deleted_at timestamptz,
  deleted_by_profile_id uuid,
  deleted_by_name text,
  delete_reason text,
  total_orders integer,
  queued_orders integer,
  picking_orders integer,
  waiting_check_orders integer,
  returned_orders integer,
  done_orders integer,
  error_count integer
)
language sql
stable
security invoker
as $$
with active_orders as (
  select *
  from public.manual_shift_orders o
  where o.shift_id = p_shift_id
    and o.tenant_id = p_tenant_id
    and o.deleted_at is null
),
orders_agg as (
  select
    o.line_id,
    count(*)::int as total_orders,
    count(*) filter (where o.status = 'queued')::int as queued_orders,
    count(*) filter (where o.status = 'picking')::int as picking_orders,
    count(*) filter (where o.status = 'waiting_check')::int as waiting_check_orders,
    count(*) filter (where o.status = 'returned')::int as returned_orders,
    count(*) filter (where o.status = 'done')::int as done_orders
  from active_orders o
  group by o.line_id
),
errors_agg as (
  select
    e.line_id,
    count(*)::int as error_count
  from public.manual_shift_order_errors e
  join active_orders o on o.id = e.order_id
  where e.shift_id = p_shift_id
    and e.tenant_id = p_tenant_id
  group by e.line_id
)
select
  l.id as line_id,
  l.tenant_id,
  l.shift_id,
  l.name,
  l.sort_order,
  case
    when coalesce(o.total_orders, 0) = 0 then 'open'
    when coalesce(o.queued_orders, 0) = coalesce(o.total_orders, 0) then 'open'
    when coalesce(o.done_orders, 0) = coalesce(o.total_orders, 0) then 'done'
    else 'in_progress'
  end as status,
  l.created_at,
  l.deleted_at,
  l.deleted_by_profile_id,
  l.deleted_by_name,
  l.delete_reason,
  coalesce(o.total_orders, 0) as total_orders,
  coalesce(o.queued_orders, 0) as queued_orders,
  coalesce(o.picking_orders, 0) as picking_orders,
  coalesce(o.waiting_check_orders, 0) as waiting_check_orders,
  coalesce(o.returned_orders, 0) as returned_orders,
  coalesce(o.done_orders, 0) as done_orders,
  coalesce(e.error_count, 0) as error_count
from public.manual_shift_lines l
left join orders_agg o on o.line_id = l.id
left join errors_agg e on e.line_id = l.id
where l.shift_id = p_shift_id
  and l.tenant_id = p_tenant_id
  and l.deleted_at is null
order by l.sort_order asc, l.created_at asc;
$$;

grant execute on function public.manual_shift_list_line_summaries(uuid, uuid) to authenticated;
