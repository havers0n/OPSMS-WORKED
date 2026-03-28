-- 0077_container_capability_and_role.test.sql
-- Verifies that migration 0077 applied the correct capability values to the
-- four seeded container types and added the operational_role column with the
-- expected default.  Runs in a transaction so the DB is not mutated.

begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_row  record;
  carton_row  record;
  tote_row    record;
  bin_row     record;
  test_container_uuid uuid;
begin

  -- ──────────────────────────────────────────────────────────────
  -- 1. capability columns exist on container_types
  -- ──────────────────────────────────────────────────────────────

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'container_types'
      and column_name  = 'supports_storage'
  ) then
    raise exception 'Expected column container_types.supports_storage to exist.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'container_types'
      and column_name  = 'supports_picking'
  ) then
    raise exception 'Expected column container_types.supports_picking to exist.';
  end if;

  -- ──────────────────────────────────────────────────────────────
  -- 2. agreed capability mapping for all four known types
  -- ──────────────────────────────────────────────────────────────

  select * into pallet_row from public.container_types where code = 'pallet';
  select * into carton_row from public.container_types where code = 'carton';
  select * into tote_row   from public.container_types where code = 'tote';
  select * into bin_row    from public.container_types where code = 'bin';

  if pallet_row is null then
    raise exception 'Expected container type pallet to exist.';
  end if;
  if carton_row is null then
    raise exception 'Expected container type carton to exist.';
  end if;
  if tote_row is null then
    raise exception 'Expected container type tote to exist.';
  end if;
  if bin_row is null then
    raise exception 'Expected container type bin to exist.';
  end if;

  -- pallet: storage=true, picking=true
  if not pallet_row.supports_storage then
    raise exception 'pallet should have supports_storage = true.';
  end if;
  if not pallet_row.supports_picking then
    raise exception 'pallet should have supports_picking = true.';
  end if;

  -- carton: storage=true, picking=true
  if not carton_row.supports_storage then
    raise exception 'carton should have supports_storage = true.';
  end if;
  if not carton_row.supports_picking then
    raise exception 'carton should have supports_picking = true.';
  end if;

  -- tote: storage=false, picking=true
  if tote_row.supports_storage then
    raise exception 'tote should have supports_storage = false.';
  end if;
  if not tote_row.supports_picking then
    raise exception 'tote should have supports_picking = true.';
  end if;

  -- bin: storage=true, picking=true
  if not bin_row.supports_storage then
    raise exception 'bin should have supports_storage = true.';
  end if;
  if not bin_row.supports_picking then
    raise exception 'bin should have supports_picking = true.';
  end if;

  -- ──────────────────────────────────────────────────────────────
  -- 3. operational_role column exists on containers
  -- ──────────────────────────────────────────────────────────────

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'containers'
      and column_name  = 'operational_role'
  ) then
    raise exception 'Expected column containers.operational_role to exist.';
  end if;

  -- ──────────────────────────────────────────────────────────────
  -- 4. default value for operational_role is 'storage'
  -- ──────────────────────────────────────────────────────────────

  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist.';
  end if;

  insert into public.containers (tenant_id, external_code, container_type_id)
  values (default_tenant_uuid, 'TEST-ROLE-DEFAULT', pallet_row.id)
  returning id into test_container_uuid;

  if not exists (
    select 1
    from public.containers
    where id = test_container_uuid
      and operational_role = 'storage'
  ) then
    raise exception 'Expected new container inserted without explicit operational_role to default to storage.';
  end if;

  -- ──────────────────────────────────────────────────────────────
  -- 5. operational_role check constraint rejects unknown values
  -- ──────────────────────────────────────────────────────────────

  begin
    insert into public.containers (tenant_id, external_code, container_type_id, operational_role)
    values (default_tenant_uuid, 'TEST-ROLE-INVALID', pallet_row.id, 'transport');
    raise exception 'Expected operational_role = transport to violate check constraint.';
  exception
    when check_violation then
      null; -- expected
  end;

  -- ──────────────────────────────────────────────────────────────
  -- 6. explicit 'pick' role is accepted
  -- ──────────────────────────────────────────────────────────────

  insert into public.containers (tenant_id, external_code, container_type_id, operational_role)
  values (default_tenant_uuid, 'TEST-ROLE-PICK', tote_row.id, 'pick');

  if not exists (
    select 1
    from public.containers
    where external_code = 'TEST-ROLE-PICK'
      and tenant_id = default_tenant_uuid
      and operational_role = 'pick'
  ) then
    raise exception 'Expected container with operational_role = pick to be stored correctly.';
  end if;

  -- ──────────────────────────────────────────────────────────────
  -- 7. index exists
  -- ──────────────────────────────────────────────────────────────

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename  = 'containers'
      and indexname  = 'containers_role_status_idx'
  ) then
    raise exception 'Expected index containers_role_status_idx to exist.';
  end if;

end
$$;

rollback;
