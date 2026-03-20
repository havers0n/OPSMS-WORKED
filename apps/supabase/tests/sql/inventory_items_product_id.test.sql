begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid uuid;
  container_uuid uuid;
  product_uuid uuid := gen_random_uuid();
  catalog_item_uuid uuid;
  legacy_item_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  insert into public.products (id, source, external_product_id, sku, name)
  values (product_uuid, 'test-suite', 'product-001', 'SKU-001', 'Inventory Product');

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'INV-PRODUCT-ID-001', pallet_type_uuid, 'active')
  returning id into container_uuid;

  insert into public.inventory_items (tenant_id, container_id, item_ref, quantity, uom)
  values (default_tenant_uuid, container_uuid, upper('product:' || product_uuid::text), 4, 'pcs')
  returning id into catalog_item_uuid;

  insert into public.inventory_items (tenant_id, container_id, item_ref, quantity, uom)
  values (default_tenant_uuid, container_uuid, 'LEGACY-REF-42', 2, 'pcs')
  returning id into legacy_item_uuid;

  if not exists (
    select 1
    from public.inventory_items
    where id = catalog_item_uuid
      and product_id = product_uuid
      and item_ref = 'product:' || product_uuid::text
  ) then
    raise exception 'Expected catalog-backed inventory inserts to populate product_id and canonical item_ref.';
  end if;

  if not exists (
    select 1
    from public.inventory_items
    where id = legacy_item_uuid
      and product_id is null
      and item_ref = 'LEGACY-REF-42'
  ) then
    raise exception 'Expected legacy inventory refs to remain untouched.';
  end if;

  if not exists (
    select 1
    from public.container_storage_snapshot_v
    where container_id = container_uuid
      and product_id = product_uuid
      and item_ref = 'product:' || product_uuid::text
  ) then
    raise exception 'Expected container snapshot rows to expose product_id for catalog-backed inventory.';
  end if;

  if not exists (
    select 1
    from public.container_storage_snapshot_v
    where container_id = container_uuid
      and item_ref = 'LEGACY-REF-42'
      and product_id is null
  ) then
    raise exception 'Expected container snapshot rows to preserve legacy refs.';
  end if;
end
$$;

rollback;
