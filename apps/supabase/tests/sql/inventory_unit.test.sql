begin;

do $$
declare
  default_tenant_uuid uuid;
  other_tenant_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;
  first_container_uuid uuid;
  second_container_uuid uuid;
  product_uuid uuid := gen_random_uuid();
  second_product_uuid uuid := gen_random_uuid();
  first_unit_uuid uuid;
  second_unit_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for inventory unit test.';
  end if;

  insert into public.tenants (id, code, name)
  values (other_tenant_uuid, 'inventory-unit-other', 'Inventory Unit Other Tenant');

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  insert into public.products (id, source, external_product_id, sku, name)
  values
    (product_uuid, 'test-suite', 'inventory-unit-001', 'SKU-IU-001', 'Inventory Unit Product'),
    (second_product_uuid, 'test-suite', 'inventory-unit-002', 'SKU-IU-002', 'Inventory Unit Product 2');

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'IU-CONT-001', pallet_type_uuid, 'active')
  returning id into first_container_uuid;

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (other_tenant_uuid, 'IU-CONT-OTH', pallet_type_uuid, 'active')
  returning id into second_container_uuid;

  if exists (
    select 1
    from public.inventory_unit
    where container_id = first_container_uuid
      and product_id in (product_uuid, second_product_uuid)
  ) then
    raise exception 'Did not expect canonical rows to exist before direct insert.';
  end if;

  insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, first_container_uuid, product_uuid, 4, 'pcs', 'available')
  returning id into first_unit_uuid;

  if first_unit_uuid is null then
    raise exception 'Expected direct inventory_unit insert for first product to return an id.';
  end if;

  insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
  values (default_tenant_uuid, first_container_uuid, second_product_uuid, 3, 'pcs', 'available')
  returning id into second_unit_uuid;

  if second_unit_uuid is null then
    raise exception 'Expected direct inventory_unit insert for second product to return an id.';
  end if;

  insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, lot_code, status)
  values (default_tenant_uuid, first_container_uuid, second_product_uuid, 2, 'pcs', 'LOT-42', 'available');

  if (
    select count(*)
    from public.inventory_unit
    where container_id = first_container_uuid
      and product_id = second_product_uuid
  ) <> 2 then
    raise exception 'Expected multiple canonical stock rows per product/container to be allowed.';
  end if;

  begin
    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, serial_no, status)
    values (default_tenant_uuid, first_container_uuid, second_product_uuid, 2, 'pcs', 'SER-001', 'available');
    raise exception 'Expected serial-tracked quantity other than 1 to fail.';
  exception
    when others then
      if position('Serial-tracked inventory units must have quantity 1' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, second_container_uuid, second_product_uuid, 1, 'pcs', 'available');
    raise exception 'Expected inventory_unit tenant mismatch to fail.';
  exception
    when others then
      if position('Inventory unit tenant' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  if not exists (
    select 1
    from public.container_storage_snapshot_v
    where container_id = first_container_uuid
      and product_id = second_product_uuid
      and item_ref = 'product:' || second_product_uuid::text
  ) then
    raise exception 'Expected canonical inventory_unit rows to appear in container storage snapshot.';
  end if;

  if not exists (
    select 1
    from public.container_storage_snapshot_v
    where container_id = first_container_uuid
      and item_ref = 'product:' || product_uuid::text
      and product_id = product_uuid
      and quantity = 4
      and uom = 'pcs'
  ) then
    raise exception 'Expected canonical product-backed rows to appear in container storage snapshot.';
  end if;
end
$$;

rollback;
