begin;

create extension if not exists dblink;

do $$
declare
  default_tenant_uuid uuid;
  other_tenant_uuid uuid := gen_random_uuid();
  other_tenant_code text := 'pr07-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);

  pallet_type_uuid uuid;

  actor_uuid uuid := gen_random_uuid();
  spoof_actor_uuid uuid := gen_random_uuid();
  concurrent_actor_uuid uuid := gen_random_uuid();

  success_container_uuid uuid;
  inactive_container_uuid uuid;
  race_status_container_uuid uuid := gen_random_uuid();
  race_product_container_uuid uuid := gen_random_uuid();
  other_tenant_container_uuid uuid;

  active_product_uuid uuid := gen_random_uuid();
  inactive_product_uuid uuid := gen_random_uuid();
  race_status_product_uuid uuid := gen_random_uuid();
  race_product_uuid uuid := gen_random_uuid();

  receive_result jsonb;
  baseline_count integer;
begin
  select id
  into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Test precondition failed: default tenant is missing.';
  end if;

  insert into public.tenants (id, code, name)
  values (other_tenant_uuid, other_tenant_code, 'PR-07 Other Tenant');

  select id
  into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr07-actor@wos.test', now(), now(), now(),
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
  values
    (active_product_uuid, 'test-suite', 'pr07-active', 'SKU-PR07-ACT', 'PR-07 Active Product', true),
    (inactive_product_uuid, 'test-suite', 'pr07-inactive', 'SKU-PR07-INACT', 'PR-07 Inactive Product', false);

  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values
    (default_tenant_uuid, 'PR07-SUCCESS', pallet_type_uuid, 'active'),
    (default_tenant_uuid, 'PR07-INACTIVE', pallet_type_uuid, 'quarantined'),
    (other_tenant_uuid, 'PR07-OTHER', pallet_type_uuid, 'active');

  select id into success_container_uuid from public.containers where external_code = 'PR07-SUCCESS';
  select id into inactive_container_uuid from public.containers where external_code = 'PR07-INACTIVE';
  select id into other_tenant_container_uuid from public.containers where external_code = 'PR07-OTHER';

  -- receive success
  receive_result := public.receive_inventory_unit(
    default_tenant_uuid,
    success_container_uuid,
    active_product_uuid,
    5,
    'pcs',
    null
  );

  if (receive_result -> 'inventoryUnit' ->> 'container_id')::uuid <> success_container_uuid then
    raise exception 'Expected receive_inventory_unit to return inserted container id.';
  end if;

  if (receive_result -> 'inventoryUnit' ->> 'tenant_id')::uuid <> default_tenant_uuid then
    raise exception 'Expected receive_inventory_unit to return inserted tenant id.';
  end if;

  if (receive_result -> 'inventoryUnit' ->> 'product_id')::uuid <> active_product_uuid then
    raise exception 'Expected receive_inventory_unit to return inserted product id.';
  end if;

  if (receive_result -> 'inventoryUnit' ->> 'quantity')::numeric <> 5 then
    raise exception 'Expected receive_inventory_unit to return inserted quantity.';
  end if;

  if receive_result -> 'product' ->> 'id' <> active_product_uuid::text then
    raise exception 'Expected receive_inventory_unit to return product payload.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    where iu.id = (receive_result -> 'inventoryUnit' ->> 'id')::uuid
      and iu.container_id = success_container_uuid
      and iu.product_id = active_product_uuid
      and iu.quantity = 5
      and iu.uom = 'pcs'
  ) then
    raise exception 'Expected receive_inventory_unit success to persist canonical inventory row.';
  end if;

  -- actor spoofing is ignored: auth.uid() is the source of truth.
  receive_result := public.receive_inventory_unit(
    default_tenant_uuid,
    success_container_uuid,
    active_product_uuid,
    2,
    'pcs',
    spoof_actor_uuid
  );

  if (receive_result -> 'inventoryUnit' ->> 'created_by')::uuid <> actor_uuid then
    raise exception 'Expected receive_inventory_unit to ignore caller-supplied actor_uuid.';
  end if;

  -- container not found
  baseline_count := (
    select count(*)
    from public.inventory_unit
    where container_id = success_container_uuid
      and product_id = active_product_uuid
  );

  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      gen_random_uuid(),
      active_product_uuid,
      1,
      'pcs',
      null
    );
    raise exception 'Expected missing container to fail.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_FOUND' then
        raise;
      end if;
  end;

  if (
    select count(*)
    from public.inventory_unit
    where container_id = success_container_uuid
      and product_id = active_product_uuid
  ) <> baseline_count then
    raise exception 'Expected failed missing-container receive to leave inventory rows unchanged.';
  end if;

  -- non-receivable container
  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      inactive_container_uuid,
      active_product_uuid,
      1,
      'pcs',
      null
    );
    raise exception 'Expected non-receivable container to fail.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_RECEIVABLE' then
        raise;
      end if;
  end;

  if exists (
    select 1
    from public.inventory_unit
    where container_id = inactive_container_uuid
      and product_id = active_product_uuid
  ) then
    raise exception 'Expected non-receivable container failure to avoid inserts.';
  end if;

  -- product not found
  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      success_container_uuid,
      gen_random_uuid(),
      1,
      'pcs',
      null
    );
    raise exception 'Expected missing product to fail.';
  exception
    when others then
      if sqlerrm <> 'PRODUCT_NOT_FOUND' then
        raise;
      end if;
  end;

  -- inactive product
  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      success_container_uuid,
      inactive_product_uuid,
      1,
      'pcs',
      null
    );
    raise exception 'Expected inactive product to fail.';
  exception
    when others then
      if sqlerrm <> 'PRODUCT_INACTIVE' then
        raise;
      end if;
  end;

  if exists (
    select 1
    from public.inventory_unit
    where container_id = success_container_uuid
      and product_id = inactive_product_uuid
  ) then
    raise exception 'Expected inactive product failure to avoid inserts.';
  end if;

  -- tenant mismatch / unauthorized masking behavior
  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      other_tenant_container_uuid,
      active_product_uuid,
      1,
      'pcs',
      null
    );
    raise exception 'Expected cross-tenant container to be masked as not found.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_FOUND' then
        raise;
      end if;
  end;

  -- Simulate authenticated user with no tenant membership by setting an unknown sub.
  -- receive_inventory_unit is SECURITY DEFINER: auth.uid() drives can_manage_tenant().
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text)::text, true);
  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      success_container_uuid,
      active_product_uuid,
      1,
      'pcs',
      null
    );
    raise exception 'Expected unauthorized receive call to be masked as not found.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_FOUND' then
        raise;
      end if;
  end;
  -- Restore actor JWT claims for subsequent tests
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  -- rollback correctness / no partial insert after failure
  baseline_count := (
    select count(*)
    from public.inventory_unit
    where container_id = success_container_uuid
      and product_id = active_product_uuid
  );

  begin
    perform public.receive_inventory_unit(
      default_tenant_uuid,
      inactive_container_uuid,
      active_product_uuid,
      9,
      'pcs',
      null
    );
    raise exception 'Expected rollback probe call to fail for inactive container.';
  exception
    when others then
      if sqlerrm <> 'CONTAINER_NOT_RECEIVABLE' then
        raise;
      end if;
  end;

  if (
    select count(*)
    from public.inventory_unit
    where container_id = success_container_uuid
      and product_id = active_product_uuid
  ) <> baseline_count then
    raise exception 'Expected rollback correctness: no partial insert after failure.';
  end if;

  -- commit race fixtures for concurrent tests (MVCC: outer tx data invisible to parallel connections)
  perform dblink_connect('pr07_setup', 'host=127.0.0.1 dbname=postgres');

  perform dblink_exec('pr07_setup', format(
    'insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, is_sso_user, raw_app_meta_data, raw_user_meta_data) '
    'values (%L::uuid, %L, now(), now(), now(), false, %L::jsonb, %L::jsonb)',
    concurrent_actor_uuid::text, 'pr07-concurrent@wos.test', '{}', '{}'
  ));

  perform dblink_exec('pr07_setup', format(
    'insert into public.tenant_members (tenant_id, profile_id, role) '
    'values (%L::uuid, %L::uuid, ''tenant_admin'') '
    'on conflict (tenant_id, profile_id) do update set role = excluded.role',
    default_tenant_uuid::text, concurrent_actor_uuid::text
  ));

  perform dblink_exec('pr07_setup', format(
    'insert into public.products (id, source, external_product_id, sku, name, is_active) values '
    '(%L::uuid, ''test-suite'', ''pr07-race-status-prod'', ''SKU-PR07-RS'', ''PR-07 Race Status Product'', true), '
    '(%L::uuid, ''test-suite'', ''pr07-race-product-prod'', ''SKU-PR07-RP'', ''PR-07 Race Product'', true)',
    race_status_product_uuid::text, race_product_uuid::text
  ));

  perform dblink_exec('pr07_setup', format(
    'insert into public.containers (id, tenant_id, external_code, container_type_id, status) values '
    '(%L::uuid, %L::uuid, ''PR07-RACE-STATUS'', %L::uuid, ''active''), '
    '(%L::uuid, %L::uuid, ''PR07-RACE-PRODUCT'', %L::uuid, ''active'')',
    race_status_container_uuid::text, default_tenant_uuid::text, pallet_type_uuid::text,
    race_product_container_uuid::text, default_tenant_uuid::text, pallet_type_uuid::text
  ));

  perform dblink_disconnect('pr07_setup');

  -- race: receive concurrent with container status flip
  perform dblink_connect('pr07_race_status_a', 'host=127.0.0.1 dbname=postgres');
  perform dblink_connect('pr07_race_status_b', 'host=127.0.0.1 dbname=postgres');

  perform dblink_exec('pr07_race_status_a', 'begin');
  perform * from dblink(
    'pr07_race_status_a',
    format('select set_config(''request.jwt.claims'', %L, true)',
      json_build_object('sub', concurrent_actor_uuid::text)::text)
  ) as r(val text);

  perform dblink_exec('pr07_race_status_b', 'begin');
  perform * from dblink(
    'pr07_race_status_b',
    format('select set_config(''request.jwt.claims'', %L, true)',
      json_build_object('sub', concurrent_actor_uuid::text)::text)
  ) as r(val text);

  perform dblink_exec(
    'pr07_race_status_a',
    format(
      'update public.containers set status = ''quarantined'' where id = %L::uuid',
      race_status_container_uuid::text
    )
  );

  perform dblink_send_query(
    'pr07_race_status_b',
    format(
      'select public.receive_inventory_unit(%L::uuid, %L::uuid, %L::uuid, 1, %L, null)',
      default_tenant_uuid::text,
      race_status_container_uuid::text,
      race_status_product_uuid::text,
      'pcs'
    )
  );

  perform pg_sleep(0.2);

  if exists (
    select 1
    from public.inventory_unit
    where container_id = race_status_container_uuid
      and product_id = race_status_product_uuid
  ) then
    raise exception 'Expected no early insert while receive call waits on container status lock.';
  end if;

  perform dblink_exec('pr07_race_status_a', 'commit');

  begin
    perform *
    from dblink_get_result('pr07_race_status_b') as r(result jsonb);
    raise exception 'Expected receive blocked by status race to fail after status flip.';
  exception
    when others then
      if position('CONTAINER_NOT_RECEIVABLE' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- drain remaining result state before rollback
  while (select count(*) from dblink_get_result('pr07_race_status_b') as r(s text)) > 0 loop
    null;
  end loop;

  perform dblink_exec('pr07_race_status_b', 'rollback');
  perform dblink_disconnect('pr07_race_status_a');
  perform dblink_disconnect('pr07_race_status_b');

  if exists (
    select 1
    from public.inventory_unit
    where container_id = race_status_container_uuid
      and product_id = race_status_product_uuid
  ) then
    raise exception 'Expected no partial insert after container status race failure.';
  end if;

  -- race: receive concurrent with product deactivation
  perform dblink_connect('pr07_race_product_a', 'host=127.0.0.1 dbname=postgres');
  perform dblink_connect('pr07_race_product_b', 'host=127.0.0.1 dbname=postgres');

  perform dblink_exec('pr07_race_product_a', 'begin');
  perform * from dblink(
    'pr07_race_product_a',
    format('select set_config(''request.jwt.claims'', %L, true)',
      json_build_object('sub', concurrent_actor_uuid::text)::text)
  ) as r(val text);

  perform dblink_exec('pr07_race_product_b', 'begin');
  perform * from dblink(
    'pr07_race_product_b',
    format('select set_config(''request.jwt.claims'', %L, true)',
      json_build_object('sub', concurrent_actor_uuid::text)::text)
  ) as r(val text);

  perform dblink_exec(
    'pr07_race_product_a',
    format(
      'update public.products set is_active = false where id = %L::uuid',
      race_product_uuid::text
    )
  );

  perform dblink_send_query(
    'pr07_race_product_b',
    format(
      'select public.receive_inventory_unit(%L::uuid, %L::uuid, %L::uuid, 1, %L, null)',
      default_tenant_uuid::text,
      race_product_container_uuid::text,
      race_product_uuid::text,
      'pcs'
    )
  );

  perform pg_sleep(0.2);

  if exists (
    select 1
    from public.inventory_unit
    where container_id = race_product_container_uuid
      and product_id = race_product_uuid
  ) then
    raise exception 'Expected no early insert while receive call waits on product lock.';
  end if;

  perform dblink_exec('pr07_race_product_a', 'commit');

  begin
    perform *
    from dblink_get_result('pr07_race_product_b') as r(result jsonb);
    raise exception 'Expected receive blocked by product race to fail after deactivation.';
  exception
    when others then
      if position('PRODUCT_INACTIVE' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- drain remaining result state before rollback
  while (select count(*) from dblink_get_result('pr07_race_product_b') as r(s text)) > 0 loop
    null;
  end loop;

  perform dblink_exec('pr07_race_product_b', 'rollback');
  perform dblink_disconnect('pr07_race_product_a');
  perform dblink_disconnect('pr07_race_product_b');

  if exists (
    select 1
    from public.inventory_unit
    where container_id = race_product_container_uuid
      and product_id = race_product_uuid
  ) then
    raise exception 'Expected no partial insert after product deactivation race failure.';
  end if;

  -- cleanup committed concurrent fixtures (committed outside outer rollback scope)
  perform dblink_connect('pr07_cleanup', 'host=127.0.0.1 dbname=postgres');
  perform dblink_exec('pr07_cleanup', format(
    'delete from public.inventory_unit where container_id in (%L::uuid, %L::uuid)',
    race_status_container_uuid::text, race_product_container_uuid::text
  ));
  perform dblink_exec('pr07_cleanup', format(
    'delete from public.containers where id in (%L::uuid, %L::uuid)',
    race_status_container_uuid::text, race_product_container_uuid::text
  ));
  perform dblink_exec('pr07_cleanup', format(
    'delete from public.products where id in (%L::uuid, %L::uuid)',
    race_status_product_uuid::text, race_product_uuid::text
  ));
  perform dblink_exec('pr07_cleanup', format(
    'delete from public.tenant_members where profile_id = %L::uuid',
    concurrent_actor_uuid::text
  ));
  perform dblink_exec('pr07_cleanup', format(
    'delete from auth.users where id = %L::uuid',
    concurrent_actor_uuid::text
  ));
  perform dblink_disconnect('pr07_cleanup');
end
$$;

rollback;
