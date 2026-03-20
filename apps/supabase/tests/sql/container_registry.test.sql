begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid uuid;
  first_container_uuid uuid;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist for container registry test.';
  end if;

  if (select count(*) from public.container_types where code in ('pallet', 'carton', 'tote', 'bin')) <> 4 then
    raise exception 'Expected seeded container types pallet/carton/tote/bin to exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'PALLET-001', pallet_type_uuid, 'quarantined')
  returning id into first_container_uuid;

  if first_container_uuid is null then
    raise exception 'Expected container insert to return an id.';
  end if;

  if not exists (
    select 1
    from public.containers
    where id = first_container_uuid
      and status = 'quarantined'
  ) then
    raise exception 'Expected inserted container to persist the requested status.';
  end if;

  begin
    insert into public.containers (tenant_id, external_code, container_type_id)
    values (default_tenant_uuid, 'PALLET-001', pallet_type_uuid);
    raise exception 'Expected duplicate tenant/external_code insert to fail.';
  exception
    when unique_violation then
      null;
  end;
end
$$;

rollback;
