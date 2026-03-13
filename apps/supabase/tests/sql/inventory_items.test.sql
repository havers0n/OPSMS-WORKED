begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid uuid;
  first_container_uuid uuid;
  second_container_uuid uuid;
  inventory_item_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'INV-CONT-001', pallet_type_uuid, 'active')
  returning id into first_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'INV-CONT-002', pallet_type_uuid, 'active')
  returning id into second_container_uuid;

  insert into public.inventory_items (tenant_id, container_id, item_ref, quantity, uom)
  values (default_tenant_uuid, first_container_uuid, 'ITEM-001', 5, 'pcs')
  returning id into inventory_item_uuid;

  if inventory_item_uuid is null then
    raise exception 'Expected inventory item insert to return an id.';
  end if;

  if not exists (
    select 1
    from public.inventory_items
    where id = inventory_item_uuid
      and item_ref = 'ITEM-001'
      and quantity = 5
      and uom = 'pcs'
  ) then
    raise exception 'Expected inventory item row to persist current container content.';
  end if;

  begin
    insert into public.inventory_items (tenant_id, container_id, item_ref, quantity, uom)
    values (default_tenant_uuid, first_container_uuid, 'ITEM-001', 2, 'pcs');
    raise exception 'Expected duplicate container/item_ref/uom insert to fail.';
  exception
    when unique_violation then
      null;
  end;

  insert into public.inventory_items (tenant_id, container_id, item_ref, quantity, uom)
  values (default_tenant_uuid, second_container_uuid, 'ITEM-001', 2, 'pcs');

  if (
    select count(*)
    from public.inventory_items
    where item_ref = 'ITEM-001'
      and uom = 'pcs'
  ) <> 2 then
    raise exception 'Expected the same item_ref/uom to be allowed across multiple containers.';
  end if;

  begin
    insert into public.inventory_items (tenant_id, container_id, item_ref, quantity, uom)
    values (default_tenant_uuid, first_container_uuid, 'ITEM-NEG', -1, 'pcs');
    raise exception 'Expected negative quantity insert to fail.';
  exception
    when check_violation then
      null;
  end;
end
$$;

rollback;
