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
  pallet_type_uuid uuid;
  container_uuid uuid := gen_random_uuid();
  empty_wave_uuid uuid;
  blocked_wave_uuid uuid;
  releasable_wave_uuid uuid;
  blocked_ready_order_uuid uuid;
  blocked_draft_order_uuid uuid;
  releasable_order_a_uuid uuid;
  releasable_order_b_uuid uuid;
begin
  select id
  into default_tenant_uuid
  from public.tenants
  where code = 'default';

  select id
  into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  insert into public.products (id, source, external_product_id, sku, name)
  values (product_uuid, 'test-suite', 'wave-product-001', 'WAVE-SKU-001', 'Wave Product');

  insert into public.containers (id, tenant_id, external_code, container_type_id, status)
  values (container_uuid, default_tenant_uuid, 'WAVE-STOCK-CONT', pallet_type_uuid, 'active');

  insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, container_uuid, product_uuid, 10, 'pcs', 'available');

  insert into public.waves (tenant_id, name, status)
  values (default_tenant_uuid, 'Empty Wave', 'draft')
  returning id into empty_wave_uuid;

  begin
    update public.waves
    set status = 'ready'
    where id = empty_wave_uuid;
    raise exception 'Expected empty waves to be blocked from ready.';
  exception
    when others then
      if position('must contain at least one order' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    update public.waves
    set status = 'released'
    where id = empty_wave_uuid;
    raise exception 'Expected empty waves to be blocked from released.';
  exception
    when others then
      if position('must contain at least one order' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  insert into public.waves (tenant_id, name, status)
  values (default_tenant_uuid, 'Blocked Wave', 'draft')
  returning id into blocked_wave_uuid;

  insert into public.orders (tenant_id, external_number, status, wave_id)
  values (default_tenant_uuid, 'ORD-W-BLOCK-1', 'draft', blocked_wave_uuid)
  returning id into blocked_ready_order_uuid;

  insert into public.order_lines (order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (blocked_ready_order_uuid, default_tenant_uuid, product_uuid, 'WAVE-SKU-001', 'Wave Product', 1, 'pending');

  perform public.commit_order_reservations(blocked_ready_order_uuid);

  insert into public.orders (tenant_id, external_number, status, wave_id)
  values (default_tenant_uuid, 'ORD-W-BLOCK-2', 'draft', blocked_wave_uuid)
  returning id into blocked_draft_order_uuid;

  insert into public.order_lines (order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (blocked_draft_order_uuid, default_tenant_uuid, product_uuid, 'WAVE-SKU-001', 'Wave Product', 1, 'pending');

  update public.waves
  set status = 'ready'
  where id = blocked_wave_uuid;

  begin
    perform public.release_wave(blocked_wave_uuid);
    raise exception 'Expected blocked waves to reject release.';
  exception
    when others then
      if sqlerrm <> 'WAVE_HAS_BLOCKING_ORDERS' then
        raise;
      end if;
  end;

  insert into public.waves (tenant_id, name, status)
  values (default_tenant_uuid, 'Releasable Wave', 'draft')
  returning id into releasable_wave_uuid;

  insert into public.orders (tenant_id, external_number, status, wave_id)
  values (default_tenant_uuid, 'ORD-W-REL-1', 'draft', releasable_wave_uuid)
  returning id into releasable_order_a_uuid;

  insert into public.order_lines (order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (releasable_order_a_uuid, default_tenant_uuid, product_uuid, 'WAVE-SKU-001', 'Wave Product', 2, 'pending');

  perform public.commit_order_reservations(releasable_order_a_uuid);

  insert into public.orders (tenant_id, external_number, status, wave_id)
  values (default_tenant_uuid, 'ORD-W-REL-2', 'draft', releasable_wave_uuid)
  returning id into releasable_order_b_uuid;

  insert into public.order_lines (order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (releasable_order_b_uuid, default_tenant_uuid, product_uuid, 'WAVE-SKU-001', 'Wave Product', 1, 'pending');

  perform public.commit_order_reservations(releasable_order_b_uuid);

  update public.waves
  set status = 'ready'
  where id = releasable_wave_uuid;

  perform public.release_wave(releasable_wave_uuid);

  if not exists (
    select 1
    from public.waves
    where id = releasable_wave_uuid
      and status = 'released'
      and released_at is not null
  ) then
    raise exception 'Expected release_wave to mark the wave released.';
  end if;

  if (select count(*) from public.orders where wave_id = releasable_wave_uuid and status = 'released') <> 2 then
    raise exception 'Expected release_wave to release every attached order.';
  end if;

  if (select count(*) from public.pick_tasks where source_type = 'order' and source_id in (releasable_order_a_uuid, releasable_order_b_uuid)) <> 2 then
    raise exception 'Expected release_wave to create one pick task per attached order.';
  end if;

  if exists (
    select 1
    from public.pick_tasks
    where source_type = 'wave'
      and source_id = releasable_wave_uuid
  ) then
    raise exception 'Did not expect wave release to create a wave-level pick task in the MVP.';
  end if;

  begin
    insert into public.orders (tenant_id, external_number, status, wave_id)
    values (default_tenant_uuid, 'ORD-W-LOCK-NEW', 'draft', releasable_wave_uuid);
    raise exception 'Expected released waves to reject new attached orders.';
  exception
    when others then
      if position('Cannot add orders to a released wave' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  update public.waves
  set status = 'closed'
  where id = releasable_wave_uuid;

  begin
    update public.orders
    set wave_id = null
    where id = releasable_order_a_uuid;
    raise exception 'Expected released wave membership to remain immutable after close.';
  exception
    when others then
      if position('Cannot remove orders from a released wave' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end
$$;

rollback;
