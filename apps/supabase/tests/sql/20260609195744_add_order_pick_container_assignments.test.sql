begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  order_a uuid := gen_random_uuid();
  order_b uuid := gen_random_uuid();
  order_c uuid := gen_random_uuid();
  container_a uuid := gen_random_uuid();
  container_b uuid := gen_random_uuid();
  container_c uuid := gen_random_uuid();
  container_d uuid := gen_random_uuid();
  pick_type_uuid uuid;
  non_pick_type_uuid uuid := gen_random_uuid();
  base_order_count bigint;
  base_container_count bigint;
  base_pick_step_count bigint;
  base_stock_movement_count bigint;
  assignment_active uuid;
  assignment_sealed uuid;
  assignment_sealed_without_actor uuid;
  assignment_cancelled uuid;
  assignment_cancelled_without_actor uuid;
  visible_count integer;
begin
  select count(*) into base_order_count from public.orders;
  select count(*) into base_container_count from public.containers;
  select count(*) into base_pick_step_count from public.pick_steps;
  select count(*) into base_stock_movement_count from public.stock_movements;

  select id into pick_type_uuid
  from public.container_types
  where code = 'pallet';

  if pick_type_uuid is null then
    raise exception 'Expected seeded pallet container type to exist.';
  end if;

  insert into public.container_types (id, code, description, supports_storage, supports_picking)
  values (
    non_pick_type_uuid,
    'test-non-pick-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
    'Non-picking test type',
    false,
    false
  );

  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'PICK-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Picking Tenant A'),
    (tenant_b, 'PICK-B-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Picking Tenant B');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values
    (user_a, 'pick-a@wos.test', now(), now(), now(), false, '{}', '{}'),
    (user_b, 'pick-b@wos.test', now(), now(), now(), false, '{}', '{}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values
    (tenant_a, user_a, 'tenant_admin'),
    (tenant_b, user_b, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  insert into public.orders (id, tenant_id, external_number, status)
  values
    (order_a, tenant_a, 'PICK-ORDER-A', 'draft'),
    (order_b, tenant_a, 'PICK-ORDER-B', 'draft'),
    (order_c, tenant_b, 'PICK-ORDER-C', 'draft');

  insert into public.containers (id, tenant_id, external_code, container_type_id, status)
  values
    (container_a, tenant_a, 'PICK-CONT-A', pick_type_uuid, 'active'),
    (container_b, tenant_a, 'PICK-CONT-B', pick_type_uuid, 'active'),
    (container_c, tenant_a, 'PICK-CONT-C', pick_type_uuid, 'active'),
    (container_d, tenant_b, 'PICK-CONT-D', pick_type_uuid, 'active');

  -- 1. valid active assignment succeeds.
  insert into public.order_pick_containers (
    id, tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
  ) values (
    gen_random_uuid(), tenant_a, order_a, container_a, 1, 'active', timezone('utc', now()), user_a
  ) returning id into assignment_active;

  if assignment_active is null then
    raise exception 'Test 1 failed: expected active assignment to insert.';
  end if;

  if exists (
    select 1
    from public.order_pick_containers
    where id = assignment_active
      and (sealed_at is not null or sealed_by is not null or cancelled_at is not null or cancelled_by is not null)
  ) then
    raise exception 'Test 1 failed: active assignment must not carry seal/cancel metadata.';
  end if;

  -- 2. valid sealed assignment succeeds.
  insert into public.order_pick_containers (
    id, tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by, sealed_at, sealed_by
  ) values (
    gen_random_uuid(), tenant_a, order_a, container_b, 2, 'sealed', timezone('utc', now()), user_a, timezone('utc', now()), user_a
  ) returning id into assignment_sealed;

  if assignment_sealed is null then
    raise exception 'Test 2 failed: expected sealed assignment to insert.';
  end if;

  if exists (
    select 1
    from public.order_pick_containers
    where id = assignment_sealed
      and (sealed_at is null or cancelled_at is not null or cancelled_by is not null)
  ) then
    raise exception 'Test 2 failed: sealed assignment must keep cancellation metadata null and sealed_at populated.';
  end if;

  -- 2a. valid sealed assignment without actor succeeds.
  insert into public.order_pick_containers (
    id, tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by, sealed_at
  ) values (
    gen_random_uuid(), tenant_a, order_b, container_c, 8, 'sealed', timezone('utc', now()), user_a, timezone('utc', now())
  ) returning id into assignment_sealed_without_actor;

  if assignment_sealed_without_actor is null then
    raise exception 'Test 2a failed: expected sealed assignment without actor to insert.';
  end if;

  if exists (
    select 1
    from public.order_pick_containers
    where id = assignment_sealed_without_actor
      and (sealed_at is null or sealed_by is not null or cancelled_at is not null or cancelled_by is not null)
  ) then
    raise exception 'Test 2a failed: sealed assignment without actor must keep cancellation metadata null and sealed_by null.';
  end if;

  -- 3. valid cancelled assignment succeeds.
  insert into public.order_pick_containers (
    id, tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by, cancelled_at, cancelled_by
  ) values (
    gen_random_uuid(), tenant_b, order_c, container_d, 1, 'cancelled', timezone('utc', now()), user_b, timezone('utc', now()), user_b
  ) returning id into assignment_cancelled;

  if assignment_cancelled is null then
    raise exception 'Test 3 failed: expected cancelled assignment to insert.';
  end if;

  if exists (
    select 1
    from public.order_pick_containers
    where id = assignment_cancelled
      and (cancelled_at is null or sealed_at is not null or sealed_by is not null)
  ) then
    raise exception 'Test 3 failed: cancelled assignment must keep seal metadata null and cancelled_at populated.';
  end if;

  -- 3a. valid cancelled assignment without actor succeeds.
  insert into public.order_pick_containers (
    id, tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by, cancelled_at
  ) values (
    gen_random_uuid(), tenant_b, order_c, container_d, 2, 'cancelled', timezone('utc', now()), user_b, timezone('utc', now())
  ) returning id into assignment_cancelled_without_actor;

  if assignment_cancelled_without_actor is null then
    raise exception 'Test 3a failed: expected cancelled assignment without actor to insert.';
  end if;

  if exists (
    select 1
    from public.order_pick_containers
    where id = assignment_cancelled_without_actor
      and (cancelled_at is null or cancelled_by is not null or sealed_at is not null or sealed_by is not null)
  ) then
    raise exception 'Test 3a failed: cancelled assignment without actor must keep seal metadata null and cancelled_by null.';
  end if;

  -- 4. active assignment with sealed_at fails.
  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by, sealed_at
    ) values (
      tenant_a, order_b, container_c, 1, 'active', timezone('utc', now()), user_a, timezone('utc', now())
    );
    raise exception 'Test 4 failed: expected active assignment with sealed_at to fail.';
  exception
    when check_violation then
      null;
  end;

  -- 5. active assignment with cancelled_at fails.
  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by, cancelled_at
    ) values (
      tenant_a, order_b, container_c, 2, 'active', timezone('utc', now()), user_a, timezone('utc', now())
    );
    raise exception 'Test 5 failed: expected active assignment with cancelled_at to fail.';
  exception
    when check_violation then
      null;
  end;

  -- 6. sealed assignment with null sealed_at fails.
  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
    ) values (
      tenant_a, order_b, container_b, 3, 'sealed', timezone('utc', now()), user_a
    );
    raise exception 'Test 6 failed: expected sealed assignment without sealed_at to fail.';
  exception
    when check_violation then
      null;
  end;

  -- 7. sealed assignment with cancellation metadata fails.
  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by, sealed_at, cancelled_at
    ) values (
      tenant_a, order_b, container_b, 4, 'sealed', timezone('utc', now()), user_a, timezone('utc', now()), timezone('utc', now())
    );
    raise exception 'Test 7 failed: expected sealed assignment with cancellation metadata to fail.';
  exception
    when check_violation then
      null;
  end;

  -- 8. cancelled assignment with null cancelled_at fails.
  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
    ) values (
      tenant_a, order_b, container_b, 5, 'cancelled', timezone('utc', now()), user_a
    );
    raise exception 'Test 8 failed: expected cancelled assignment without cancelled_at to fail.';
  exception
    when check_violation then
      null;
  end;

  -- 9. cancelled assignment with seal metadata fails.
  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by, sealed_at, cancelled_at
    ) values (
      tenant_a, order_b, container_b, 6, 'cancelled', timezone('utc', now()), user_a, timezone('utc', now()), timezone('utc', now())
    );
    raise exception 'Test 9 failed: expected cancelled assignment with seal metadata to fail.';
  exception
    when check_violation then
      null;
  end;

  -- Preserve original invariants.
  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
    ) values (
      tenant_a, order_a, container_c, 1, 'active', timezone('utc', now()), user_a
    );
    raise exception 'Expected second active assignment for same order to fail.';
  exception
    when unique_violation then
      null;
  end;

  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
    ) values (
      tenant_a, order_b, container_a, 1, 'active', timezone('utc', now()), user_a
    );
    raise exception 'Expected second active assignment for same container to fail.';
  exception
    when unique_violation then
      null;
  end;

  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
    ) values (
      tenant_a, order_b, container_b, 0, 'active', timezone('utc', now()), user_a
    );
    raise exception 'Expected sequence_number <= 0 to fail.';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
    ) values (
      tenant_a, order_b, container_b, 7, 'open', timezone('utc', now()), user_a
    );
    raise exception 'Expected invalid status to fail.';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
    ) values (
      tenant_a, order_c, container_c, 1, 'active', timezone('utc', now()), user_a
    );
    raise exception 'Expected cross-tenant order assignment to fail.';
  exception
    when foreign_key_violation then
      null;
  end;

  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
    ) values (
      tenant_a, order_b, container_d, 1, 'active', timezone('utc', now()), user_a
    );
    raise exception 'Expected cross-tenant container assignment to fail.';
  exception
    when foreign_key_violation then
      null;
  end;

  -- 10. valid sealed history remains queryable.
  select count(*) into visible_count
  from public.order_pick_containers
  where id = assignment_sealed
    and tenant_id = tenant_a
    and status = 'sealed'
    and sequence_number = 2
    and sealed_at is not null
    and cancelled_at is null;

  if visible_count <> 1 then
    raise exception 'Test 10 failed: expected sealed history row to remain queryable.';
  end if;

  -- 11. valid picking-capable default container type succeeds.
  insert into public.tenant_picking_settings (
    tenant_id, default_pick_container_type_id
  ) values (
    tenant_a, pick_type_uuid
  );

  if not exists (
    select 1
    from public.tenant_picking_settings
    where tenant_id = tenant_a
      and default_pick_container_type_id = pick_type_uuid
  ) then
    raise exception 'Test 11 failed: expected picking-capable default type to be stored.';
  end if;

  -- 12. non-picking-capable default container type fails.
  begin
    insert into public.tenant_picking_settings (
      tenant_id, default_pick_container_type_id
    ) values (
      tenant_b, non_pick_type_uuid
    );
    raise exception 'Test 12 failed: expected non-picking-capable default type to be rejected.';
  exception
    when others then
      if sqlerrm <> 'DEFAULT_PICK_CONTAINER_TYPE_MUST_SUPPORT_PICKING' then
        raise;
      end if;
  end;

  -- 13. null default type is allowed if manual fallback is intended.
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_b::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  insert into public.tenant_picking_settings (
    tenant_id, default_pick_container_type_id
  ) values (
    tenant_b, null
  );

  if not exists (
    select 1
    from public.tenant_picking_settings
    where tenant_id = tenant_b
      and default_pick_container_type_id is null
  ) then
    raise exception 'Test 13 failed: expected null default type to be allowed.';
  end if;

  update public.tenant_picking_settings
  set default_pick_container_type_id = pick_type_uuid
  where tenant_id = tenant_b;

  if not exists (
    select 1
    from public.tenant_picking_settings
    where tenant_id = tenant_b
      and default_pick_container_type_id = pick_type_uuid
  ) then
    raise exception 'Test 13 failed: expected authenticated manager to update own settings.';
  end if;

  -- 14. authenticated tenant manager can read own-tenant assignment rows.
  select count(*) into visible_count
  from public.order_pick_containers
  where id = assignment_cancelled_without_actor
    and tenant_id = tenant_b
    and status = 'cancelled';

  if visible_count <> 1 then
    raise exception 'Test 14 failed: tenant B should read own assignment rows.';
  end if;

  -- 15. authenticated tenant manager cannot directly mutate assignment rows.
  begin
    insert into public.order_pick_containers (
      tenant_id, order_id, container_id, sequence_number, status, opened_at, opened_by
    ) values (
      tenant_b, order_c, container_b, 2, 'active', timezone('utc', now()), user_b
    );
    raise exception 'Test 15 failed: tenant B should not insert order_pick_containers rows directly.';
  exception
    when others then
      null;
  end;

  begin
    update public.order_pick_containers
    set status = 'sealed',
        sealed_at = timezone('utc', now()),
        sealed_by = user_b
    where id = assignment_cancelled;
    raise exception 'Test 15 failed: tenant B should not update order_pick_containers rows directly.';
  exception
    when others then
      null;
  end;

  begin
    delete from public.order_pick_containers
    where id = assignment_cancelled;
    raise exception 'Test 15 failed: tenant B should not delete order_pick_containers rows directly.';
  exception
    when others then
      null;
  end;

  select count(*) into visible_count
  from public.order_pick_containers
  where tenant_id = tenant_a;

  if visible_count <> 0 then
    raise exception 'Test 15 failed: tenant B should not read tenant A assignments.';
  end if;

  -- 16. existing container statuses remain unchanged.
  execute 'reset role';

  begin
    insert into public.containers (tenant_id, external_code, container_type_id, status)
    values (tenant_a, 'BAD-SEALED', pick_type_uuid, 'sealed');
    raise exception 'Test 16 failed: expected sealed container status to remain invalid.';
  exception
    when check_violation then
      null;
  end;

  -- 17. no existing containers, orders, pick_steps, or stock_movements rows are
  -- mutated by the migration. The test rows are deleted before the final check.
  delete from public.order_pick_containers where tenant_id in (tenant_a, tenant_b);
  delete from public.tenant_picking_settings where tenant_id in (tenant_a, tenant_b);
  delete from public.containers where id in (container_a, container_b, container_c, container_d);
  delete from public.orders where id in (order_a, order_b, order_c);

  select count(*) into visible_count from public.orders;
  if visible_count <> base_order_count then
    raise exception 'Test 17 failed: orders row count changed unexpectedly.';
  end if;

  select count(*) into visible_count from public.containers;
  if visible_count <> base_container_count then
    raise exception 'Test 17 failed: containers row count changed unexpectedly.';
  end if;

  select count(*) into visible_count from public.pick_steps;
  if visible_count <> base_pick_step_count then
    raise exception 'Test 17 failed: pick_steps row count changed unexpectedly.';
  end if;

  select count(*) into visible_count from public.stock_movements;
  if visible_count <> base_stock_movement_count then
    raise exception 'Test 17 failed: stock_movements row count changed unexpectedly.';
  end if;

  execute 'reset role';
  raise notice '20260609195744 add_order_pick_container_assignments tests passed.';
end
$$;

rollback;
