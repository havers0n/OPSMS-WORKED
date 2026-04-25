begin;

do $$
declare
  default_tenant_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  product_uuid uuid := gen_random_uuid();
  profile_uuid uuid;
  level_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR104: expected default tenant to exist.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr104-actor@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values (product_uuid, 'test-suite', 'pr104-product', 'SKU-PR104', 'PR104 Product', true);

  execute 'set local role authenticated';

  insert into public.packaging_profiles (
    tenant_id, product_id, code, name, profile_type, scope_type, scope_id,
    priority, is_default, status
  )
  values (
    default_tenant_uuid, product_uuid, 'PR104-STORAGE', 'PR104 Storage',
    'storage', 'tenant', default_tenant_uuid, 0, false, 'active'
  )
  returning id into profile_uuid;

  insert into public.packaging_profile_levels (
    profile_id, level_type, qty_each, container_type
  )
  values (profile_uuid, 'EA', 1, 'pallet')
  returning id into level_uuid;

  update public.packaging_profiles
  set name = 'PR104 Storage Updated'
  where id = profile_uuid;

  update public.packaging_profile_levels
  set qty_each = 2
  where id = level_uuid;

  if not exists (
    select 1
    from public.packaging_profiles pp
    join public.packaging_profile_levels ppl on ppl.profile_id = pp.id
    where pp.id = profile_uuid
      and pp.name = 'PR104 Storage Updated'
      and ppl.id = level_uuid
      and ppl.qty_each = 2
  ) then
    raise exception 'PR104: expected authenticated tenant admin to write storage preset profile and level rows.';
  end if;
end
$$;

rollback;
