begin;

do $$
declare
  has_column boolean;
  has_check boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sku_location_policies'
      and column_name = 'target_pick_qty_each'
      and is_nullable = 'YES'
  )
  into has_column;

  if not has_column then
    raise exception 'Expected nullable sku_location_policies.target_pick_qty_each for PR2 read denominators.';
  end if;

  select exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'sku_location_policies'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%target_pick_qty_each%'
  )
  into has_check;

  if not has_check then
    raise exception 'Expected positive-value check for sku_location_policies.target_pick_qty_each.';
  end if;
end
$$;

rollback;
