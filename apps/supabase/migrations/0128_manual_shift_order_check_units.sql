-- 0128_manual_shift_order_check_units.sql
-- Description: Add manual check units under manual_shift_orders with tenant-safe scope checks and audit-compatible events.

create table if not exists public.manual_shift_order_check_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  line_id uuid not null references public.manual_shift_lines(id) on delete cascade,
  order_id uuid not null references public.manual_shift_orders(id) on delete cascade,
  unit_number integer not null check (unit_number > 0),
  status text not null default 'open'
    check (status in ('open', 'checked', 'returned', 'voided')),
  note text null,
  reason text null,
  checked_at timestamptz null,
  returned_at timestamptz null,
  voided_at timestamptz null,
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  created_by_name text null,
  updated_by_profile_id uuid null references public.profiles(id) on delete set null,
  updated_by_name text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (order_id, unit_number)
);

create index if not exists manual_shift_order_check_units_order_idx
  on public.manual_shift_order_check_units(tenant_id, order_id, created_at desc);

create index if not exists manual_shift_order_check_units_shift_status_idx
  on public.manual_shift_order_check_units(tenant_id, shift_id, status, created_at desc);

drop trigger if exists set_manual_shift_order_check_units_updated_at on public.manual_shift_order_check_units;
create trigger set_manual_shift_order_check_units_updated_at
before update on public.manual_shift_order_check_units
for each row execute function public.set_updated_at();

create or replace function public.validate_manual_shift_order_check_unit_row()
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
    raise exception 'MANUAL_SHIFT_CHECK_UNIT_TENANT_MISMATCH';
  end if;

  if order_row.shift_id <> new.shift_id or order_row.line_id <> new.line_id then
    raise exception 'MANUAL_SHIFT_CHECK_UNIT_SCOPE_MISMATCH';
  end if;

  new.note := nullif(trim(coalesce(new.note, '')), '');
  new.reason := nullif(trim(coalesce(new.reason, '')), '');
  new.created_by_name := nullif(trim(coalesce(new.created_by_name, '')), '');
  new.updated_by_name := nullif(trim(coalesce(new.updated_by_name, '')), '');

  return new;
end;
$$;

drop trigger if exists validate_manual_shift_order_check_unit_row on public.manual_shift_order_check_units;
create trigger validate_manual_shift_order_check_unit_row
before insert or update on public.manual_shift_order_check_units
for each row execute function public.validate_manual_shift_order_check_unit_row();

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
      'point_restored',
      'check_unit_created',
      'check_unit_status_changed',
      'check_unit_note_changed'
    )
  );

grant select, insert, update on public.manual_shift_order_check_units to authenticated;

alter table public.manual_shift_order_check_units enable row level security;

drop policy if exists manual_shift_order_check_units_select_scoped on public.manual_shift_order_check_units;
create policy manual_shift_order_check_units_select_scoped
on public.manual_shift_order_check_units
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_order_check_units_insert_scoped on public.manual_shift_order_check_units;
create policy manual_shift_order_check_units_insert_scoped
on public.manual_shift_order_check_units
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_order_check_units_update_scoped on public.manual_shift_order_check_units;
create policy manual_shift_order_check_units_update_scoped
on public.manual_shift_order_check_units
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));
