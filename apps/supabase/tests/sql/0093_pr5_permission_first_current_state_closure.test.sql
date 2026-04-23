begin;

do $$
declare
  default_tenant_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;
  product_uuid uuid := gen_random_uuid();
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  source_location_uuid uuid := gen_random_uuid();
  source_container_uuid uuid := gen_random_uuid();
  target_container_uuid uuid := gen_random_uuid();
  pick_container_uuid uuid := gen_random_uuid();
  receive_result jsonb;
  split_result jsonb;
  iu_uuid uuid;
  line_uuid uuid;
  inventory_count_before integer;
  line_count_before integer;
  movement_count_before integer;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'PR5: expected default tenant to exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'PR5: expected pallet container type to exist.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'pr93-actor@wos.test', now(), now(), now(),
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
  values (product_uuid, 'test-suite', 'pr93-product', 'SKU-PR93', 'PR93 Product', true);

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PR93-SITE', 'PR93 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'PR93-FLOOR', 'PR93 Floor', 1);

  insert into public.locations (
    id, tenant_id, floor_id, code, location_type, capacity_mode, status
  )
  values (
    source_location_uuid, default_tenant_uuid, floor_uuid,
    'PR93-SOURCE', 'staging', 'multi_container', 'active'
  );

  insert into public.containers (
    id, tenant_id, external_code, container_type_id, status,
    current_location_id, current_location_entered_at
  )
  values (
    source_container_uuid, default_tenant_uuid, 'PR93-SOURCE-C',
    pallet_type_uuid, 'active', source_location_uuid, now()
  );

  insert into public.containers (id, tenant_id, external_code, container_type_id, status)
  values
    (target_container_uuid, default_tenant_uuid, 'PR93-TARGET-C', pallet_type_uuid, 'active'),
    (pick_container_uuid, default_tenant_uuid, 'PR93-PICK-C', pallet_type_uuid, 'active');

  receive_result := public.receive_inventory_unit(
    tenant_uuid => default_tenant_uuid,
    container_uuid => source_container_uuid,
    product_uuid => product_uuid,
    quantity => 10,
    uom => 'pcs',
    actor_uuid => actor_uuid,
    receipt_correlation_key => 'PR93-RECEIVE-001'
  );

  iu_uuid := (receive_result #>> '{inventoryUnit,id}')::uuid;
  line_uuid := (receive_result #>> '{inventoryUnit,container_line_id}')::uuid;

  if iu_uuid is null or line_uuid is null then
    raise exception 'PR5: receive_inventory_unit must still create projection and canonical receipt line.';
  end if;

  select count(*) into inventory_count_before from public.inventory_unit;
  select count(*) into line_count_before from public.container_lines;
  select count(*) into movement_count_before from public.stock_movements;

  execute 'set local role authenticated';

  begin
    insert into public.inventory_unit (
      tenant_id, container_id, product_id, quantity, uom, status
    )
    values (
      default_tenant_uuid, target_container_uuid, product_uuid, 1, 'pcs', 'available'
    );
    raise exception 'PR5: expected direct inventory_unit insert to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.inventory_unit
    set quantity = 999
    where id = iu_uuid;
    raise exception 'PR5: expected direct inventory_unit update to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    delete from public.inventory_unit
    where id = iu_uuid;
    raise exception 'PR5: expected direct inventory_unit delete to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.stock_movements (
      tenant_id,
      movement_type,
      source_container_id,
      target_container_id,
      source_inventory_unit_id,
      quantity,
      uom,
      status,
      created_by
    )
    values (
      default_tenant_uuid,
      'adjust',
      source_container_uuid,
      source_container_uuid,
      iu_uuid,
      1,
      'pcs',
      'done',
      actor_uuid
    );
    raise exception 'PR5: expected direct stock_movements adjust insert to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.ensure_inventory_unit_current_container_line(iu_uuid, actor_uuid);
    raise exception 'PR5: expected direct ensure_inventory_unit_current_container_line call to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.pick_full_inventory_unit(iu_uuid, pick_container_uuid, actor_uuid);
    raise exception 'PR5: expected direct pick_full_inventory_unit call to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  if not exists (
    select 1
    from public.container_lines
    where id = line_uuid
  ) then
    raise exception 'PR5: authenticated read-only access to container_lines should remain available.';
  end if;

  if not exists (
    select 1
    from public.inventory_unit
    where id = iu_uuid
  ) then
    raise exception 'PR5: authenticated read-only access to inventory_unit projection should remain available.';
  end if;

  execute 'reset role';

  if (select count(*) from public.inventory_unit) <> inventory_count_before then
    raise exception 'PR5: denied direct inventory_unit DML must leave inventory_unit count unchanged.';
  end if;

  if (select count(*) from public.container_lines) <> line_count_before then
    raise exception 'PR5: denied direct bypasses must leave container_lines count unchanged.';
  end if;

  if (select count(*) from public.stock_movements) <> movement_count_before then
    raise exception 'PR5: denied direct stock_movements insert must leave stock_movements count unchanged.';
  end if;

  split_result := public.split_inventory_unit(
    iu_uuid,
    4,
    target_container_uuid,
    actor_uuid
  );

  if (split_result ->> 'sourceInventoryUnitId')::uuid <> iu_uuid
     or (split_result ->> 'targetInventoryUnitId')::uuid is null
     or (split_result ->> 'movementId')::uuid is null then
    raise exception 'PR5: split_inventory_unit must still work after direct DML closure: %', split_result;
  end if;

  if not exists (
    select 1
    from public.inventory_unit iu
    join public.container_lines cl on cl.id = iu.container_line_id
    where iu.id = iu_uuid
      and iu.quantity = cl.current_qty_each
      and iu.container_id = cl.current_container_id
      and cl.current_qty_each = 6
  ) then
    raise exception 'PR5: supported split must keep source projection synchronized to canonical current line.';
  end if;

  if not exists (
    select 1
    from public.stock_movements
    where id = (split_result ->> 'movementId')::uuid
      and movement_type = 'split_stock'
      and quantity = 4
  ) then
    raise exception 'PR5: supported split must still write stock movement history.';
  end if;
end
$$;

rollback;
