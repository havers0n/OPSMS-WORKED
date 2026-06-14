-- 20260614120000_manual_shift_order_items.sql
-- Description: Add product-level order items table under manual_shift_orders.

create table if not exists public.manual_shift_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.manual_shift_sessions(id) on delete cascade,
  line_id uuid not null references public.manual_shift_lines(id) on delete cascade,
  order_id uuid not null references public.manual_shift_orders(id) on delete cascade,
  sku text not null check (char_length(trim(sku)) > 0),
  description text null,
  category text null,
  quantity numeric not null default 0,
  notes text null,
  zone text null,
  source_sheet text null,
  source_rows integer[] null,
  source_file text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists manual_shift_order_items_order_idx
  on public.manual_shift_order_items(tenant_id, order_id, created_at desc);

create or replace function public.validate_manual_shift_order_item_row()
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
    raise exception 'MANUAL_SHIFT_ORDER_ITEM_TENANT_MISMATCH';
  end if;

  if order_row.shift_id <> new.shift_id or order_row.line_id <> new.line_id then
    raise exception 'MANUAL_SHIFT_ORDER_ITEM_SCOPE_MISMATCH';
  end if;

  new.sku := trim(new.sku);
  if new.sku = '' then
    raise exception 'MANUAL_SHIFT_ORDER_ITEM_BLANK_SKU';
  end if;

  new.description := nullif(trim(coalesce(new.description, '')), '');
  new.category := nullif(trim(coalesce(new.category, '')), '');
  new.notes := nullif(trim(coalesce(new.notes, '')), '');
  new.zone := nullif(trim(coalesce(new.zone, '')), '');
  new.source_sheet := nullif(trim(coalesce(new.source_sheet, '')), '');
  new.source_file := nullif(trim(coalesce(new.source_file, '')), '');

  return new;
end;
$$;

drop trigger if exists validate_manual_shift_order_item_row on public.manual_shift_order_items;
create trigger validate_manual_shift_order_item_row
before insert or update on public.manual_shift_order_items
for each row execute function public.validate_manual_shift_order_item_row();

grant select, insert, update on public.manual_shift_order_items to authenticated;

alter table public.manual_shift_order_items enable row level security;

drop policy if exists manual_shift_order_items_select_scoped on public.manual_shift_order_items;
create policy manual_shift_order_items_select_scoped
on public.manual_shift_order_items
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists manual_shift_order_items_insert_scoped on public.manual_shift_order_items;
create policy manual_shift_order_items_insert_scoped
on public.manual_shift_order_items
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists manual_shift_order_items_update_scoped on public.manual_shift_order_items;
create policy manual_shift_order_items_update_scoped
on public.manual_shift_order_items
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));
