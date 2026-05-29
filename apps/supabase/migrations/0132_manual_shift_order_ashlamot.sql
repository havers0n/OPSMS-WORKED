-- 0132_manual_shift_order_ashlamot.sql
-- Minimal Ashlama workflow for returned check units.

create table if not exists public.manual_shift_order_ashlamot (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  line_id uuid not null references public.manual_shift_lines(id) on delete cascade,
  order_id uuid not null references public.manual_shift_orders(id) on delete cascade,
  check_unit_id uuid not null references public.manual_shift_order_check_units(id) on delete cascade,
  status text not null check (status in ('open', 'done', 'cancelled')),
  text text not null check (length(btrim(text)) > 0),
  created_by_profile_id uuid null references auth.users(id),
  created_by_name text null,
  updated_by_profile_id uuid null references auth.users(id),
  updated_by_name text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists manual_shift_order_ashlamot_order_idx
  on public.manual_shift_order_ashlamot(tenant_id, order_id, created_at desc);

create index if not exists manual_shift_order_ashlamot_check_unit_idx
  on public.manual_shift_order_ashlamot(tenant_id, check_unit_id, created_at desc);

drop trigger if exists set_manual_shift_order_ashlamot_updated_at on public.manual_shift_order_ashlamot;
create trigger set_manual_shift_order_ashlamot_updated_at
before update on public.manual_shift_order_ashlamot
for each row execute function public.set_updated_at();

create or replace function public.validate_manual_shift_order_ashlama_row()
returns trigger
language plpgsql
as $$
declare
  parent_order record;
  parent_check_unit record;
begin
  select id, tenant_id, shift_id, line_id
  into parent_order
  from public.manual_shift_orders
  where id = new.order_id;

  if parent_order.id is null then
    raise exception 'manual_shift_order_ashlamot.order_id % not found', new.order_id;
  end if;

  select id, tenant_id, shift_id, line_id, order_id
  into parent_check_unit
  from public.manual_shift_order_check_units
  where id = new.check_unit_id;

  if parent_check_unit.id is null then
    raise exception 'manual_shift_order_ashlamot.check_unit_id % not found', new.check_unit_id;
  end if;

  if new.order_id <> parent_check_unit.order_id then
    raise exception 'manual_shift_order_ashlamot.check_unit_id % does not belong to order_id %', new.check_unit_id, new.order_id;
  end if;

  if new.tenant_id <> parent_order.tenant_id or new.tenant_id <> parent_check_unit.tenant_id then
    raise exception 'manual_shift_order_ashlamot tenant mismatch';
  end if;

  if new.shift_id <> parent_order.shift_id or new.shift_id <> parent_check_unit.shift_id then
    raise exception 'manual_shift_order_ashlamot shift mismatch';
  end if;

  if new.line_id <> parent_order.line_id or new.line_id <> parent_check_unit.line_id then
    raise exception 'manual_shift_order_ashlamot line mismatch';
  end if;

  new.text := btrim(new.text);
  return new;
end;
$$;

drop trigger if exists validate_manual_shift_order_ashlama_row on public.manual_shift_order_ashlamot;
create trigger validate_manual_shift_order_ashlama_row
before insert or update on public.manual_shift_order_ashlamot
for each row execute function public.validate_manual_shift_order_ashlama_row();

grant select, insert, update on public.manual_shift_order_ashlamot to authenticated;

alter table public.manual_shift_order_ashlamot enable row level security;

drop policy if exists manual_shift_order_ashlamot_select_scoped on public.manual_shift_order_ashlamot;
create policy manual_shift_order_ashlamot_select_scoped
on public.manual_shift_order_ashlamot
for select
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_order_ashlamot_insert_scoped on public.manual_shift_order_ashlamot;
create policy manual_shift_order_ashlamot_insert_scoped
on public.manual_shift_order_ashlamot
for insert
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_order_ashlamot_update_scoped on public.manual_shift_order_ashlamot;
create policy manual_shift_order_ashlamot_update_scoped
on public.manual_shift_order_ashlamot
for update
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));
