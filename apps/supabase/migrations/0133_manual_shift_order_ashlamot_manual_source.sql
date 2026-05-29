-- 0133_manual_shift_order_ashlamot_manual_source.sql
-- Add manual order-level ashlama support.

alter table public.manual_shift_order_ashlamot
  alter column check_unit_id drop not null;

alter table public.manual_shift_order_ashlamot
  add column if not exists source text;

update public.manual_shift_order_ashlamot
set source = case when check_unit_id is null then 'manual' else 'check_unit' end
where source is null;

alter table public.manual_shift_order_ashlamot
  alter column source set not null;

alter table public.manual_shift_order_ashlamot
  alter column source set default 'check_unit';

alter table public.manual_shift_order_ashlamot
  drop constraint if exists manual_shift_order_ashlamot_source_check;

alter table public.manual_shift_order_ashlamot
  add constraint manual_shift_order_ashlamot_source_check
  check (source in ('manual', 'check_unit'));

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

  if new.source = 'manual' and new.check_unit_id is not null then
    raise exception 'manual_shift_order_ashlamot.check_unit_id must be null when source is manual';
  end if;

  if new.source = 'check_unit' and new.check_unit_id is null then
    raise exception 'manual_shift_order_ashlamot.check_unit_id is required when source is check_unit';
  end if;

  if new.check_unit_id is not null then
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
  else
    if new.tenant_id <> parent_order.tenant_id then
      raise exception 'manual_shift_order_ashlamot tenant mismatch';
    end if;

    if new.shift_id <> parent_order.shift_id then
      raise exception 'manual_shift_order_ashlamot shift mismatch';
    end if;

    if new.line_id <> parent_order.line_id then
      raise exception 'manual_shift_order_ashlamot line mismatch';
    end if;
  end if;

  new.text := btrim(new.text);
  return new;
end;
$$;
