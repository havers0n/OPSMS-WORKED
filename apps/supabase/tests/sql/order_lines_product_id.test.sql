begin;

create or replace function public.can_manage_tenant(tenant_uuid uuid)
returns boolean
language sql
stable
as $$
  select true
$$;

do $$
declare
  default_tenant_uuid uuid;
  product_uuid uuid := gen_random_uuid();
  order_uuid uuid;
  task_uuid uuid;
  legacy_line_uuid uuid;
  product_line_uuid uuid;
begin
  select id
  into default_tenant_uuid
  from public.tenants
  where code = 'default';

  insert into public.products (id, source, external_product_id, sku, name)
  values (product_uuid, 'test-suite', 'order-product-001', 'SKU-001', 'Inventory Product');

  insert into public.orders (tenant_id, external_number, status)
  values (default_tenant_uuid, 'ORD-OL-001', 'draft')
  returning id into order_uuid;

  begin
    update public.orders
    set status = 'ready'
    where id = order_uuid;
    raise exception 'Expected empty orders to be blocked from ready.';
  exception
    when others then
      if position('must contain at least one line' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  insert into public.order_lines (order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (order_uuid, default_tenant_uuid, product_uuid, 'SKU-001', 'Inventory Product', 3, 'pending')
  returning id into product_line_uuid;

  insert into public.order_lines (order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (order_uuid, default_tenant_uuid, null, 'LEGACY-001', 'Legacy Snapshot', 1, 'pending')
  returning id into legacy_line_uuid;

  update public.products
  set sku = 'SKU-UPDATED',
      name = 'Renamed Product'
  where id = product_uuid;

  if not exists (
    select 1
    from public.order_lines
    where id = product_line_uuid
      and product_id = product_uuid
      and sku = 'SKU-001'
      and name = 'Inventory Product'
  ) then
    raise exception 'Expected product-backed order lines to preserve sku/name snapshots.';
  end if;

  if not exists (
    select 1
    from public.order_lines
    where id = legacy_line_uuid
      and product_id is null
      and sku = 'LEGACY-001'
      and name = 'Legacy Snapshot'
  ) then
    raise exception 'Expected legacy order lines with null product_id to remain valid.';
  end if;

  update public.orders
  set status = 'ready'
  where id = order_uuid;

  select public.release_order(order_uuid)
  into task_uuid;

  if task_uuid is null then
    raise exception 'Expected release_order to return a pick task id.';
  end if;

  if not exists (
    select 1
    from public.orders
    where id = order_uuid
      and status = 'released'
      and released_at is not null
  ) then
    raise exception 'Expected release_order to mark the order released.';
  end if;

  if (select count(*) from public.order_lines where order_id = order_uuid and status = 'released') <> 2 then
    raise exception 'Expected release_order to mark every order line released.';
  end if;

  if (select count(*) from public.pick_tasks where id = task_uuid and source_type = 'order' and source_id = order_uuid) <> 1 then
    raise exception 'Expected release_order to create exactly one pick task for the order.';
  end if;

  if (select count(*) from public.pick_steps where task_id = task_uuid) <> 2 then
    raise exception 'Expected release_order to create one pick step per order line.';
  end if;
end
$$;

rollback;
