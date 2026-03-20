-- 0032_order_lines_product_id.sql

alter table public.order_lines
  add column if not exists product_id uuid null references public.products(id);

create index if not exists order_lines_product_id_idx
  on public.order_lines(product_id);

create or replace function public.validate_order_line_row()
returns trigger
language plpgsql
as $$
declare
  order_tenant_uuid uuid;
begin
  select o.tenant_id
  into order_tenant_uuid
  from public.orders o
  where o.id = new.order_id;

  if order_tenant_uuid is null then
    raise exception 'Order % was not found for order line.', new.order_id;
  end if;

  if order_tenant_uuid <> new.tenant_id then
    raise exception 'Order line tenant % does not match order tenant %.', new.tenant_id, order_tenant_uuid;
  end if;

  new.sku := trim(new.sku);
  new.name := trim(new.name);

  return new;
end
$$;
