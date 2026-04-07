create extension if not exists dblink;

begin;

do $$
declare
  default_tenant_uuid uuid;
  actor_uuid uuid := gen_random_uuid();
  pallet_type_uuid uuid;

  product_a_uuid uuid := gen_random_uuid();
  product_b_uuid uuid := gen_random_uuid();
  container_uuid uuid := gen_random_uuid();

  order_uuid uuid := gen_random_uuid();
  line_a_uuid uuid := gen_random_uuid();
  line_b_uuid uuid := gen_random_uuid();
  competing_order_uuid uuid := gen_random_uuid();
  competing_line_uuid uuid := gen_random_uuid();
  legacy_order_uuid uuid := gen_random_uuid();
  legacy_line_uuid uuid := gen_random_uuid();
  missing_reservation_order_uuid uuid := gen_random_uuid();
  missing_reservation_line_uuid uuid := gen_random_uuid();
  mismatched_reservation_order_uuid uuid := gen_random_uuid();
  mismatched_reservation_line_uuid uuid := gen_random_uuid();
  draft_cancel_order_uuid uuid := gen_random_uuid();
  committed_cancel_order_uuid uuid := gen_random_uuid();
  committed_cancel_line_uuid uuid := gen_random_uuid();
  race_actor_uuid uuid := gen_random_uuid();
  race_product_uuid uuid := gen_random_uuid();
  race_container_uuid uuid := gen_random_uuid();
  race_order_a_uuid uuid := gen_random_uuid();
  race_order_b_uuid uuid := gen_random_uuid();
  race_line_a_uuid uuid := gen_random_uuid();
  race_line_b_uuid uuid := gen_random_uuid();

  task_uuid uuid;
  atp_before numeric;
  atp_after numeric;
begin
  select id into default_tenant_uuid from public.tenants where code = 'default';
  if default_tenant_uuid is null then
    raise exception 'Test precondition failed: default tenant not found.';
  end if;

  select id into pallet_type_uuid from public.container_types where code = 'pallet';
  if pallet_type_uuid is null then
    raise exception 'Test precondition failed: pallet container type not found.';
  end if;

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  ) values (
    actor_uuid, 'pr13-actor@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  insert into public.products (id, source, external_product_id, sku, name, is_active)
  values
    (product_a_uuid, 'test-suite', 'pr13-a', 'SKU-PR13-A', 'PR-13 Product A', true),
    (product_b_uuid, 'test-suite', 'pr13-b', 'SKU-PR13-B', 'PR-13 Product B', true);

  insert into public.containers (id, tenant_id, external_code, container_type_id, status)
  values (container_uuid, default_tenant_uuid, 'PR13-CONT-A', pallet_type_uuid, 'active');

  insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
  values
    (default_tenant_uuid, container_uuid, product_a_uuid, 10, 'pcs', 'available'),
    (default_tenant_uuid, container_uuid, product_b_uuid, 1, 'pcs', 'available');

  insert into public.orders (id, tenant_id, external_number, status)
  values (order_uuid, default_tenant_uuid, 'PR13-LIFECYCLE', 'draft');

  insert into public.order_lines (id, order_id, tenant_id, product_id, sku, name, qty_required, status)
  values
    (line_a_uuid, order_uuid, default_tenant_uuid, product_a_uuid, 'SKU-PR13-A', 'PR-13 Product A', 6, 'pending'),
    (line_b_uuid, order_uuid, default_tenant_uuid, product_b_uuid, 'SKU-PR13-B', 'PR-13 Product B', 1, 'pending');

  if exists (select 1 from public.order_reservations where order_id = order_uuid) then
    raise exception 'Expected draft order lines to create no reservations.';
  end if;

  atp_before := public.order_available_to_promise_qty(default_tenant_uuid, product_a_uuid);

  perform public.commit_order_reservations(order_uuid);

  if (select status from public.orders where id = order_uuid) <> 'ready' then
    raise exception 'Expected commit_order_reservations to mark the order ready.';
  end if;

  if (
    select count(*)
    from public.order_reservations
    where order_id = order_uuid
      and status = 'active'
  ) <> 2 then
    raise exception 'Expected commit_order_reservations to create one active reservation per line.';
  end if;

  begin
    insert into public.order_lines (order_id, tenant_id, product_id, sku, name, qty_required, status)
    values (order_uuid, default_tenant_uuid, product_a_uuid, 'SKU-PR13-A', 'PR-13 Product A', 1, 'pending');
    raise exception 'Expected ready order line insert to fail.';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_EDITABLE_IN_READY' then
        raise;
      end if;
  end;

  begin
    update public.order_lines
    set qty_required = 7
    where id = line_a_uuid;
    raise exception 'Expected ready order line update to fail.';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_EDITABLE_IN_READY' then
        raise;
      end if;
  end;

  begin
    delete from public.order_lines
    where id = line_a_uuid;
    raise exception 'Expected ready order line delete to fail.';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_EDITABLE_IN_READY' then
        raise;
      end if;
  end;

  perform public.rollback_ready_order_to_draft(order_uuid, 'change requested');

  if (select status from public.orders where id = order_uuid) <> 'draft' then
    raise exception 'Expected rollback to move order back to draft.';
  end if;

  if (
    select count(*)
    from public.order_reservations
    where order_id = order_uuid
      and status = 'rolled_back'
      and rolled_back_at is not null
      and rolled_back_by = actor_uuid
      and rollback_reason = 'change requested'
  ) <> 2 then
    raise exception 'Expected rollback to mark reservations rolled_back with audit fields.';
  end if;

  atp_after := public.order_available_to_promise_qty(default_tenant_uuid, product_a_uuid);
  if atp_after <> atp_before then
    raise exception 'Expected rolled_back reservations not to participate in ATP. before %, after %.', atp_before, atp_after;
  end if;

  -- The same line can be committed again because rolled_back reservations are not active-like.
  perform public.commit_order_reservations(order_uuid);

  if (
    select count(*)
    from public.order_reservations
    where order_line_id = line_a_uuid
      and status in ('active', 'released')
  ) <> 1 then
    raise exception 'Expected recommit to create exactly one active-like reservation for the rolled-back line.';
  end if;

  insert into public.orders (id, tenant_id, external_number, status)
  values (competing_order_uuid, default_tenant_uuid, 'PR13-SHORTAGE', 'draft');

  insert into public.order_lines (id, order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (competing_line_uuid, competing_order_uuid, default_tenant_uuid, product_a_uuid, 'SKU-PR13-A', 'PR-13 Product A', 5, 'pending');

  begin
    perform public.commit_order_reservations(competing_order_uuid);
    raise exception 'Expected insufficient ATP to fail.';
  exception
    when others then
      if position('INSUFFICIENT_STOCK' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  if (select status from public.orders where id = competing_order_uuid) <> 'draft' then
    raise exception 'Expected insufficient ATP failure to keep competing order draft.';
  end if;

  if exists (
    select 1
    from public.order_reservations
    where order_id = competing_order_uuid
  ) then
    raise exception 'Expected insufficient ATP failure to leave no partial reservations.';
  end if;

  insert into public.orders (id, tenant_id, external_number, status)
  values (legacy_order_uuid, default_tenant_uuid, 'PR13-LEGACY', 'draft');

  insert into public.order_lines (id, order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (legacy_line_uuid, legacy_order_uuid, default_tenant_uuid, null, 'LEGACY-PR13', 'Legacy Product', 1, 'pending');

  begin
    perform public.commit_order_reservations(legacy_order_uuid);
    raise exception 'Expected null product_id line to fail commit.';
  exception
    when others then
      if sqlerrm <> 'ORDER_LINE_PRODUCT_REQUIRED' then
        raise;
      end if;
  end;

  insert into public.orders (id, tenant_id, external_number, status)
  values (draft_cancel_order_uuid, default_tenant_uuid, 'PR13-DRAFT-CANCEL', 'draft');

  perform public.cancel_order_with_unreserve(draft_cancel_order_uuid, 'customer cancelled before commit');

  if exists (
    select 1
    from public.orders
    where id = draft_cancel_order_uuid
      and status = 'cancelled'
      and closed_at is null
  ) = false then
    raise exception 'Expected draft cancel to mark order cancelled without writing closed_at.';
  end if;

  insert into public.orders (id, tenant_id, external_number, status)
  values (committed_cancel_order_uuid, default_tenant_uuid, 'PR13-COMMITTED-CANCEL', 'draft');

  insert into public.order_lines (id, order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (
    committed_cancel_line_uuid,
    committed_cancel_order_uuid,
    default_tenant_uuid,
    product_a_uuid,
    'SKU-PR13-A',
    'PR-13 Product A',
    1,
    'pending'
  );

  perform public.commit_order_reservations(committed_cancel_order_uuid);
  perform public.cancel_order_with_unreserve(committed_cancel_order_uuid, 'cancel after commit');

  if exists (
    select 1
    from public.orders
    where id = committed_cancel_order_uuid
      and status = 'cancelled'
      and closed_at is null
  ) = false then
    raise exception 'Expected committed cancel to mark order cancelled without writing closed_at.';
  end if;

  if exists (
    select 1
    from public.order_reservations
    where order_id = committed_cancel_order_uuid
      and status = 'cancelled'
      and cancelled_at is not null
      and cancelled_by = actor_uuid
      and cancel_reason = 'cancel after commit'
  ) = false then
    raise exception 'Expected committed cancel to mark reservations cancelled with audit fields.';
  end if;

  insert into public.orders (id, tenant_id, external_number, status)
  values (missing_reservation_order_uuid, default_tenant_uuid, 'PR13-MISSING-RES', 'draft');

  insert into public.order_lines (id, order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (
    missing_reservation_line_uuid,
    missing_reservation_order_uuid,
    default_tenant_uuid,
    product_a_uuid,
    'SKU-PR13-A',
    'PR-13 Product A',
    1,
    'pending'
  );

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);
  update public.orders
  set status = 'ready'
  where id = missing_reservation_order_uuid;

  begin
    perform public.release_order(missing_reservation_order_uuid);
    raise exception 'Expected release_order without reservations to fail.';
  exception
    when others then
      if sqlerrm <> 'RESERVATION_MISMATCH' then
        raise;
      end if;
  end;

  insert into public.orders (id, tenant_id, external_number, status)
  values (mismatched_reservation_order_uuid, default_tenant_uuid, 'PR13-MISMATCH-RES', 'draft');

  insert into public.order_lines (id, order_id, tenant_id, product_id, sku, name, qty_required, status)
  values (
    mismatched_reservation_line_uuid,
    mismatched_reservation_order_uuid,
    default_tenant_uuid,
    product_a_uuid,
    'SKU-PR13-A',
    'PR-13 Product A',
    2,
    'pending'
  );

  insert into public.order_reservations (
    tenant_id,
    order_id,
    order_line_id,
    product_id,
    quantity,
    status,
    created_by
  ) values (
    default_tenant_uuid,
    mismatched_reservation_order_uuid,
    mismatched_reservation_line_uuid,
    product_a_uuid,
    1,
    'active',
    actor_uuid
  );

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);
  update public.orders
  set status = 'ready'
  where id = mismatched_reservation_order_uuid;

  begin
    perform public.release_order(mismatched_reservation_order_uuid);
    raise exception 'Expected release_order with mismatched reservations to fail.';
  exception
    when others then
      if sqlerrm <> 'RESERVATION_MISMATCH' then
        raise;
      end if;
  end;

  -- MVCC: committed dblink fixtures are required for true concurrent sessions.
  perform dblink_connect('pr13_reserve_setup', 'host=127.0.0.1 dbname=postgres');
  perform dblink_exec('pr13_reserve_setup', format(
    $sql$
      select set_config('wos.allow_committed_order_line_system_update', 'on', true);
      select set_config('wos.allow_order_reservation_status_update', 'on', true);

      delete from public.order_reservations
      where order_id in (
        select id
        from public.orders
        where external_number in ('PR13-RACE-A', 'PR13-RACE-B')
      );
      delete from public.order_lines
      where order_id in (
        select id
        from public.orders
        where external_number in ('PR13-RACE-A', 'PR13-RACE-B')
      );
      delete from public.orders
      where external_number in ('PR13-RACE-A', 'PR13-RACE-B');
      delete from public.inventory_unit
      where product_id in (
        select id
        from public.products
        where external_product_id = 'pr13-race'
      );
      delete from public.containers
      where external_code = 'PR13-RACE-CONT';
      delete from public.products
      where external_product_id = 'pr13-race';
      delete from public.tenant_members
      where profile_id in (
        select id
        from auth.users
        where email = 'pr13-race@wos.test'
      );
      delete from public.profiles
      where id in (
        select id
        from auth.users
        where email = 'pr13-race@wos.test'
      );
      delete from auth.users
      where email = 'pr13-race@wos.test';

      insert into auth.users (
        id, email, email_confirmed_at, created_at, updated_at,
        is_sso_user, raw_app_meta_data, raw_user_meta_data
      ) values (
        %L::uuid, 'pr13-race@wos.test', now(), now(), now(),
        false, '{}', '{}'
      );

      insert into public.tenant_members (tenant_id, profile_id, role)
      values (%L::uuid, %L::uuid, 'tenant_admin')
      on conflict (tenant_id, profile_id) do update set role = excluded.role;

      insert into public.products (id, source, external_product_id, sku, name, is_active)
      values (%L::uuid, 'test-suite', 'pr13-race', 'SKU-PR13-RACE', 'PR-13 Race Product', true);

      insert into public.containers (id, tenant_id, external_code, container_type_id, status)
      values (%L::uuid, %L::uuid, 'PR13-RACE-CONT', %L::uuid, 'active');

      insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
      values (%L::uuid, %L::uuid, %L::uuid, 5, 'pcs', 'available');

      insert into public.orders (id, tenant_id, external_number, status)
      values
        (%L::uuid, %L::uuid, 'PR13-RACE-A', 'draft'),
        (%L::uuid, %L::uuid, 'PR13-RACE-B', 'draft');

      insert into public.order_lines (id, order_id, tenant_id, product_id, sku, name, qty_required, status)
      values
        (%L::uuid, %L::uuid, %L::uuid, %L::uuid, 'SKU-PR13-RACE', 'PR-13 Race Product', 4, 'pending'),
        (%L::uuid, %L::uuid, %L::uuid, %L::uuid, 'SKU-PR13-RACE', 'PR-13 Race Product', 4, 'pending');
    $sql$,
    race_actor_uuid::text,
    default_tenant_uuid::text, race_actor_uuid::text,
    race_product_uuid::text,
    race_container_uuid::text, default_tenant_uuid::text, pallet_type_uuid::text,
    default_tenant_uuid::text, race_container_uuid::text, race_product_uuid::text,
    race_order_a_uuid::text, default_tenant_uuid::text,
    race_order_b_uuid::text, default_tenant_uuid::text,
    race_line_a_uuid::text, race_order_a_uuid::text, default_tenant_uuid::text, race_product_uuid::text,
    race_line_b_uuid::text, race_order_b_uuid::text, default_tenant_uuid::text, race_product_uuid::text
  ));
  perform dblink_disconnect('pr13_reserve_setup');

  perform dblink_connect('pr13_reserve_race_a', 'host=127.0.0.1 dbname=postgres');
  perform dblink_connect('pr13_reserve_race_b', 'host=127.0.0.1 dbname=postgres');

  perform dblink_exec('pr13_reserve_race_a', 'begin');
  perform * from dblink(
    'pr13_reserve_race_a',
    format('select set_config(''request.jwt.claims'', %L, true)',
      json_build_object('sub', race_actor_uuid::text)::text)
  ) as r(val text);

  perform dblink_exec('pr13_reserve_race_b', 'begin');
  perform * from dblink(
    'pr13_reserve_race_b',
    format('select set_config(''request.jwt.claims'', %L, true)',
      json_build_object('sub', race_actor_uuid::text)::text)
  ) as r(val text);

  perform *
  from dblink(
    'pr13_reserve_race_a',
    format('select public.commit_order_reservations(%L::uuid)', race_order_a_uuid::text)
  ) as r(order_id uuid);

  perform dblink_send_query(
    'pr13_reserve_race_b',
    format('select public.commit_order_reservations(%L::uuid)', race_order_b_uuid::text)
  );
  perform pg_sleep(0.2);

  if dblink_is_busy('pr13_reserve_race_b') = 0 then
    raise exception 'Expected concurrent reservation commit to wait on the tenant/product advisory lock.';
  end if;

  perform dblink_exec('pr13_reserve_race_a', 'commit');

  begin
    perform *
    from dblink_get_result('pr13_reserve_race_b') as r(order_id uuid);
    raise exception 'Expected concurrent reservation overcommit to fail after the first commit.';
  exception
    when others then
      if position('INSUFFICIENT_STOCK' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  while (select count(*) from dblink_get_result('pr13_reserve_race_b') as r(s text)) > 0 loop
    null;
  end loop;

  perform dblink_exec('pr13_reserve_race_b', 'rollback');
  perform dblink_disconnect('pr13_reserve_race_a');
  perform dblink_disconnect('pr13_reserve_race_b');

  perform dblink_connect('pr13_reserve_cleanup', 'host=127.0.0.1 dbname=postgres');
  perform dblink_exec('pr13_reserve_cleanup', format(
    $sql$
      select set_config('wos.allow_committed_order_line_system_update', 'on', true);
      select set_config('wos.allow_order_reservation_status_update', 'on', true);

      delete from public.order_reservations where order_id in (%L::uuid, %L::uuid);
      delete from public.order_lines where order_id in (%L::uuid, %L::uuid);
      delete from public.orders where id in (%L::uuid, %L::uuid);
      delete from public.inventory_unit where container_id = %L::uuid;
      delete from public.containers where id = %L::uuid;
      delete from public.products where id = %L::uuid;
      delete from public.tenant_members where profile_id = %L::uuid;
      delete from public.profiles where id = %L::uuid;
      delete from auth.users where id = %L::uuid;
    $sql$,
    race_order_a_uuid::text, race_order_b_uuid::text,
    race_order_a_uuid::text, race_order_b_uuid::text,
    race_order_a_uuid::text, race_order_b_uuid::text,
    race_container_uuid::text,
    race_container_uuid::text,
    race_product_uuid::text,
    race_actor_uuid::text,
    race_actor_uuid::text,
    race_actor_uuid::text
  ));
  perform dblink_disconnect('pr13_reserve_cleanup');

  task_uuid := public.release_order(order_uuid);
  if task_uuid is null then
    raise exception 'Expected release_order to return a task id.';
  end if;

  if (
    select count(*)
    from public.order_reservations
    where order_id = order_uuid
      and status = 'released'
  ) <> 2 then
    raise exception 'Expected release_order to mark reservations released.';
  end if;

  update public.orders
  set status = 'picked'
  where id = order_uuid;

  perform public.close_order_with_unreserve(order_uuid);

  if (select status from public.orders where id = order_uuid) <> 'closed' then
    raise exception 'Expected close_order_with_unreserve to close the order.';
  end if;

  if (
    select count(*)
    from public.order_reservations
    where order_id = order_uuid
      and status = 'closed'
      and closed_at is not null
      and closed_by = actor_uuid
  ) <> 2 then
    raise exception 'Expected close_order_with_unreserve to close reservations with audit fields.';
  end if;
end
$$;

rollback;
