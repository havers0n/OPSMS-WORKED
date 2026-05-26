-- 0120_manual_shift_control.sql

create table if not exists public.manual_shift_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date date not null,
  name text not null check (char_length(trim(name)) > 0),
  status text not null default 'active'
    check (status in ('active', 'closed')),
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  created_by_name text null,
  created_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz null
);

create table if not exists public.manual_shift_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.manual_shift_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  line_id uuid not null references public.manual_shift_lines(id) on delete cascade,
  order_number text null,
  customer_name text null,
  picker_name text null,
  checker_name text null,
  line_count integer null check (line_count is null or line_count > 0),
  size text not null default 'unknown'
    check (size in ('S', 'M', 'L', 'XL', 'unknown')),
  status text not null default 'queued'
    check (status in ('queued', 'picking', 'waiting_check', 'returned', 'done')),
  started_at timestamptz null,
  waiting_check_at timestamptz null,
  checked_at timestamptz null,
  finished_at timestamptz null,
  comment text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.manual_shift_order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  line_id uuid not null references public.manual_shift_lines(id) on delete cascade,
  order_id uuid not null references public.manual_shift_orders(id) on delete cascade,
  event_type text not null
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
        'bulk_imported'
      )
    ),
  actor_profile_id uuid null references public.profiles(id) on delete set null,
  actor_name text null,
  from_status text null
    check (from_status is null or from_status in ('queued', 'picking', 'waiting_check', 'returned', 'done')),
  to_status text null
    check (to_status is null or to_status in ('queued', 'picking', 'waiting_check', 'returned', 'done')),
  payload jsonb null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.manual_shift_order_errors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  line_id uuid not null references public.manual_shift_lines(id) on delete cascade,
  order_id uuid not null references public.manual_shift_orders(id) on delete cascade,
  type text not null
    check (
      type in (
        'wrong_quantity',
        'wrong_item',
        'missing_item',
        'bad_packing',
        'small_items_loose',
        'damaged',
        'other'
      )
    ),
  comment text null,
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  created_by_name text null,
  created_at timestamptz not null default timezone('utc', now()),
  fixed_at timestamptz null
);

create unique index if not exists manual_shift_sessions_one_active_per_tenant_date_idx
  on public.manual_shift_sessions(tenant_id, date)
  where status = 'active';

create index if not exists manual_shift_sessions_tenant_date_idx
  on public.manual_shift_sessions(tenant_id, date desc);

create index if not exists manual_shift_lines_shift_idx
  on public.manual_shift_lines(shift_id, sort_order, created_at);

create index if not exists manual_shift_orders_shift_idx
  on public.manual_shift_orders(shift_id, created_at desc);

create index if not exists manual_shift_orders_line_idx
  on public.manual_shift_orders(line_id, created_at desc);

create index if not exists manual_shift_orders_status_idx
  on public.manual_shift_orders(tenant_id, status, created_at desc);

create index if not exists manual_shift_orders_picker_name_idx
  on public.manual_shift_orders(tenant_id, picker_name);

create index if not exists manual_shift_order_events_order_idx
  on public.manual_shift_order_events(order_id, created_at desc);

create index if not exists manual_shift_order_errors_order_idx
  on public.manual_shift_order_errors(order_id, created_at desc);

drop trigger if exists set_manual_shift_lines_updated_at on public.manual_shift_lines;
create trigger set_manual_shift_lines_updated_at
before update on public.manual_shift_lines
for each row execute function public.set_updated_at();

drop trigger if exists set_manual_shift_orders_updated_at on public.manual_shift_orders;
create trigger set_manual_shift_orders_updated_at
before update on public.manual_shift_orders
for each row execute function public.set_updated_at();

create or replace function public.validate_manual_shift_session_row()
returns trigger
language plpgsql
as $$
begin
  new.name := trim(new.name);
  new.created_by_name := nullif(trim(coalesce(new.created_by_name, '')), '');

  if new.status = 'active' then
    new.closed_at := null;
  end if;

  return new;
end;
$$;

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
  new.picker_name := nullif(trim(coalesce(new.picker_name, '')), '');
  new.checker_name := nullif(trim(coalesce(new.checker_name, '')), '');
  new.comment := nullif(trim(coalesce(new.comment, '')), '');

  return new;
end;
$$;

create or replace function public.validate_manual_shift_order_event_row()
returns trigger
language plpgsql
as $$
declare
  order_row public.manual_shift_orders%rowtype;
begin
  select *
  into order_row
  from public.manual_shift_orders
  where id = new.order_id;

  if order_row.id is null then
    raise exception 'MANUAL_SHIFT_ORDER_NOT_FOUND';
  end if;

  if order_row.tenant_id <> new.tenant_id then
    raise exception 'MANUAL_SHIFT_EVENT_TENANT_MISMATCH';
  end if;

  if order_row.shift_id <> new.shift_id or order_row.line_id <> new.line_id then
    raise exception 'MANUAL_SHIFT_EVENT_SCOPE_MISMATCH';
  end if;

  new.actor_name := nullif(trim(coalesce(new.actor_name, '')), '');

  return new;
end;
$$;

create or replace function public.validate_manual_shift_order_error_row()
returns trigger
language plpgsql
as $$
declare
  order_row public.manual_shift_orders%rowtype;
begin
  select *
  into order_row
  from public.manual_shift_orders
  where id = new.order_id;

  if order_row.id is null then
    raise exception 'MANUAL_SHIFT_ORDER_NOT_FOUND';
  end if;

  if order_row.tenant_id <> new.tenant_id then
    raise exception 'MANUAL_SHIFT_ERROR_TENANT_MISMATCH';
  end if;

  if order_row.shift_id <> new.shift_id or order_row.line_id <> new.line_id then
    raise exception 'MANUAL_SHIFT_ERROR_SCOPE_MISMATCH';
  end if;

  new.comment := nullif(trim(coalesce(new.comment, '')), '');
  new.created_by_name := nullif(trim(coalesce(new.created_by_name, '')), '');

  return new;
end;
$$;

drop trigger if exists validate_manual_shift_session_row on public.manual_shift_sessions;
create trigger validate_manual_shift_session_row
before insert or update on public.manual_shift_sessions
for each row execute function public.validate_manual_shift_session_row();

drop trigger if exists validate_manual_shift_line_row on public.manual_shift_lines;
create trigger validate_manual_shift_line_row
before insert or update on public.manual_shift_lines
for each row execute function public.validate_manual_shift_line_row();

drop trigger if exists validate_manual_shift_order_row on public.manual_shift_orders;
create trigger validate_manual_shift_order_row
before insert or update on public.manual_shift_orders
for each row execute function public.validate_manual_shift_order_row();

drop trigger if exists validate_manual_shift_order_event_row on public.manual_shift_order_events;
create trigger validate_manual_shift_order_event_row
before insert or update on public.manual_shift_order_events
for each row execute function public.validate_manual_shift_order_event_row();

drop trigger if exists validate_manual_shift_order_error_row on public.manual_shift_order_errors;
create trigger validate_manual_shift_order_error_row
before insert or update on public.manual_shift_order_errors
for each row execute function public.validate_manual_shift_order_error_row();

grant select, insert, update on public.manual_shift_sessions to authenticated;
grant select, insert, update on public.manual_shift_lines to authenticated;
grant select, insert, update on public.manual_shift_orders to authenticated;
grant select, insert on public.manual_shift_order_events to authenticated;
grant select, insert, update on public.manual_shift_order_errors to authenticated;

alter table public.manual_shift_sessions enable row level security;
alter table public.manual_shift_lines enable row level security;
alter table public.manual_shift_orders enable row level security;
alter table public.manual_shift_order_events enable row level security;
alter table public.manual_shift_order_errors enable row level security;

drop policy if exists manual_shift_sessions_select_scoped on public.manual_shift_sessions;
create policy manual_shift_sessions_select_scoped
on public.manual_shift_sessions
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_sessions_insert_scoped on public.manual_shift_sessions;
create policy manual_shift_sessions_insert_scoped
on public.manual_shift_sessions
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_sessions_update_scoped on public.manual_shift_sessions;
create policy manual_shift_sessions_update_scoped
on public.manual_shift_sessions
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_lines_select_scoped on public.manual_shift_lines;
create policy manual_shift_lines_select_scoped
on public.manual_shift_lines
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_lines_insert_scoped on public.manual_shift_lines;
create policy manual_shift_lines_insert_scoped
on public.manual_shift_lines
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_lines_update_scoped on public.manual_shift_lines;
create policy manual_shift_lines_update_scoped
on public.manual_shift_lines
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_orders_select_scoped on public.manual_shift_orders;
create policy manual_shift_orders_select_scoped
on public.manual_shift_orders
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_orders_insert_scoped on public.manual_shift_orders;
create policy manual_shift_orders_insert_scoped
on public.manual_shift_orders
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_orders_update_scoped on public.manual_shift_orders;
create policy manual_shift_orders_update_scoped
on public.manual_shift_orders
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_order_events_select_scoped on public.manual_shift_order_events;
create policy manual_shift_order_events_select_scoped
on public.manual_shift_order_events
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_order_events_insert_scoped on public.manual_shift_order_events;
create policy manual_shift_order_events_insert_scoped
on public.manual_shift_order_events
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_order_errors_select_scoped on public.manual_shift_order_errors;
create policy manual_shift_order_errors_select_scoped
on public.manual_shift_order_errors
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_order_errors_insert_scoped on public.manual_shift_order_errors;
create policy manual_shift_order_errors_insert_scoped
on public.manual_shift_order_errors
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_order_errors_update_scoped on public.manual_shift_order_errors;
create policy manual_shift_order_errors_update_scoped
on public.manual_shift_order_errors
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));
