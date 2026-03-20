begin;

do $$
declare
  seeded_count integer;
begin
  select count(*) into seeded_count
  from public.products
  where source = 'artos.co.il';

  if seeded_count < 400 then
    raise exception 'Expected artos.co.il catalog seed to load into products, found % rows.', seeded_count;
  end if;

  if not exists (
    select 1
    from public.products
    where source = 'artos.co.il'
      and sku is null
  ) then
    raise exception 'Expected seeded catalog to preserve null SKU rows.';
  end if;

  begin
    insert into public.products (source, external_product_id, name)
    values ('artos.co.il', '19917', 'Duplicate external id');
    raise exception 'Expected duplicate source/external_product_id insert to fail.';
  exception
    when unique_violation then
      null;
  end;
end
$$;

rollback;
