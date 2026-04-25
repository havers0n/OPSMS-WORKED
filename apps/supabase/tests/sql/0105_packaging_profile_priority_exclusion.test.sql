begin;

do $$
declare
  default_tenant_uuid uuid;
  product_uuid uuid := gen_random_uuid();
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR105: expected default tenant to exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'packaging_profiles_active_priority_no_overlap'
      and contype = 'x'
  ) then
    raise exception 'PR105: expected active priority exclusion constraint to exist.';
  end if;

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values (product_uuid, 'test-suite', 'pr105-product', 'SKU-PR105', 'PR105 Product', true);

  insert into public.packaging_profiles (
    tenant_id, product_id, code, name, profile_type, scope_type, scope_id,
    priority, is_default, status
  )
  values (
    default_tenant_uuid, product_uuid, 'PR105-A', 'PR105 A',
    'storage', 'tenant', default_tenant_uuid, 0, false, 'active'
  );

  begin
    insert into public.packaging_profiles (
      tenant_id, product_id, code, name, profile_type, scope_type, scope_id,
      priority, is_default, status
    )
    values (
      default_tenant_uuid, product_uuid, 'PR105-B', 'PR105 B',
      'storage', 'tenant', default_tenant_uuid, 0, false, 'active'
    );

    raise exception 'PR105: expected duplicate active priority to be rejected.';
  exception
    when raise_exception or exclusion_violation then
      if sqlerrm <> 'PACKAGING_PROFILE_PRIORITY_OVERLAP'
        and sqlerrm not like '%packaging_profiles_active_priority_no_overlap%' then
        raise;
      end if;
  end;
end
$$;

rollback;
