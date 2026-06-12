-- Behavioral tests for worker account binding SECURITY DEFINER RPCs.
-- Simulates authenticated callers via request.jwt.claims.
--
-- Required SQL assertions:
--   BND-1   tenant A admin can list bindable users for tenant A
--   BND-2   tenant A admin cannot list tenant B users
--   BND-3   tenant A picker cannot call list_manual_shift_bindable_users
--   BND-4   tenant A admin can bind tenant A profile to tenant A worker
--   BND-5   tenant A admin cannot bind tenant B profile
--   BND-6   tenant A picker cannot bind or unbind accounts
--   BND-7   duplicate binding to a second worker is rejected
--   BND-8   null clears binding
--   BND-9   list RPC returns correct bound_worker_id after binding
--   BND-10  list RPC returns null bound_worker_id after clearing
--   BND-11  stable exception identifiers: FORBIDDEN, WORKER_NOT_FOUND,
--           WORKER_AUTH_USER_FORBIDDEN, WORKER_AUTH_USER_ALREADY_BOUND

begin;

do $$
declare
  -- tenants
  tenant_a         uuid := gen_random_uuid();
  tenant_b         uuid := gen_random_uuid();

  -- auth users (will auto-create profiles via on_auth_user_created trigger)
  admin_a          uuid := gen_random_uuid();
  operator_a       uuid := gen_random_uuid();   -- regular operator (not admin)
  admin_b          uuid := gen_random_uuid();

  -- shifts
  shift_a          uuid;
  shift_a2         uuid;

  -- workers
  worker_1          uuid;
  worker_2          uuid;

  -- RPC results
  rpc_result       record;
  rpc_count        int;
  bind_err          text;
begin
  -- ══════════════════════════════════════════════════════════════════════
  -- FIXTURE SETUP
  -- ══════════════════════════════════════════════════════════════════════

  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'BND-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Bindable Tenant A'),
    (tenant_b, 'BND-B-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Bindable Tenant B');

  -- Create auth users (profiles auto-created by on_auth_user_created trigger)
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values
    (admin_a,    'bind-admin-a@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Admin A"}'),
    (operator_a, 'bind-operator-a@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Operator A"}'),
    (admin_b,    'bind-admin-b@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Admin B"}');

  -- Tenant memberships
  insert into public.tenant_members (tenant_id, profile_id, role)
  values
    (tenant_a, admin_a,    'tenant_admin'),
    (tenant_a, operator_a, 'operator'),
    (tenant_b, admin_b,    'tenant_admin')
  on conflict (tenant_id, profile_id) do nothing;

  -- Shifts in tenant A
  insert into public.manual_shift_sessions (tenant_id, date, name, status, created_by_profile_id, created_by_name)
  values (tenant_a, date '2026-06-12', 'Shift A-1', 'active', admin_a, 'Admin A')
  returning id into shift_a;

  insert into public.manual_shift_sessions (tenant_id, date, name, status, created_by_profile_id, created_by_name)
  values (tenant_a, date '2026-06-13', 'Shift A-2', 'active', admin_a, 'Admin A')
  returning id into shift_a2;

  -- Workers in tenant A
  insert into public.manual_shift_workers (tenant_id, shift_id, name, role, active, auth_user_id)
  values (tenant_a, shift_a, 'Worker 1', 'picker', true, null)
  returning id into worker_1;

  insert into public.manual_shift_workers (tenant_id, shift_id, name, role, active, auth_user_id)
  values (tenant_a, shift_a2, 'Worker 2', 'picker', true, null)
  returning id into worker_2;

  -- ══════════════════════════════════════════════════════════════════════
  -- AUTH SIMULATION HELPERS
  -- ══════════════════════════════════════════════════════════════════════

  -- Switch to authenticated role so RLS policies apply
  execute 'set local role authenticated';

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-1: tenant A admin lists users for tenant A
  -- ══════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a::text)::text, true);

  rpc_count := 0;
  for rpc_result in
    select * from public.list_manual_shift_bindable_users(tenant_a)
  loop
    rpc_count := rpc_count + 1;
  end loop;

  assert rpc_count >= 2,
    'BND-1: tenant A admin should see at least admin_a + operator_a, got ' || rpc_count;

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-2: tenant A admin cannot list tenant B users
  -- ══════════════════════════════════════════════════════════════════════
  begin
    perform public.list_manual_shift_bindable_users(tenant_b);
    raise exception 'BND-2: expected FORBIDDEN for cross-tenant list';
  exception
    when others then
      assert sqlerrm = 'FORBIDDEN',
        'BND-2: expected FORBIDDEN, got ' || sqlerrm;
  end;

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-3: tenant A picker cannot call list RPC
  -- ══════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', operator_a::text)::text, true);

  begin
    perform public.list_manual_shift_bindable_users(tenant_a);
    raise exception 'BND-3: expected FORBIDDEN for picker';
  exception
    when others then
      assert sqlerrm = 'FORBIDDEN',
        'BND-3: expected FORBIDDEN, got ' || sqlerrm;
  end;

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-4: tenant A admin can bind tenant A profile to worker 1
  -- ══════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a::text)::text, true);

  -- restart clean: ensure worker_1 has no binding
  update public.manual_shift_workers set auth_user_id = null where id = worker_1;

  perform public.set_manual_shift_worker_auth_user(worker_1, operator_a);

  -- Verify binding was applied
  assert exists (
    select 1 from public.manual_shift_workers
    where id = worker_1 and auth_user_id = operator_a
  ), 'BND-4: worker_1 should be bound to operator_a';

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-5: tenant A admin cannot bind tenant B profile
  -- ══════════════════════════════════════════════════════════════════════
  begin
    perform public.set_manual_shift_worker_auth_user(worker_1, admin_b);
    raise exception 'BND-5: expected WORKER_AUTH_USER_FORBIDDEN for cross-tenant profile';
  exception
    when others then
      assert sqlerrm = 'WORKER_AUTH_USER_FORBIDDEN',
        'BND-5: expected WORKER_AUTH_USER_FORBIDDEN, got ' || sqlerrm;
  end;

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-6: tenant A picker cannot bind accounts
  -- ══════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', operator_a::text)::text, true);

  begin
    perform public.set_manual_shift_worker_auth_user(worker_2, admin_a);
    raise exception 'BND-6: expected FORBIDDEN for picker bind';
  exception
    when others then
      assert sqlerrm = 'FORBIDDEN',
        'BND-6: expected FORBIDDEN, got ' || sqlerrm;
  end;

  -- Picker cannot unbind either
  begin
    perform public.set_manual_shift_worker_auth_user(worker_1, null);
    raise exception 'BND-6b: expected FORBIDDEN for picker unbind';
  exception
    when others then
      assert sqlerrm = 'FORBIDDEN',
        'BND-6b: expected FORBIDDEN, got ' || sqlerrm;
  end;

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-7: duplicate binding to a second worker is rejected
  -- ══════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a::text)::text, true);

  -- worker_1 is already bound to operator_a. Try to bind operator_a to worker_2
  begin
    perform public.set_manual_shift_worker_auth_user(worker_2, operator_a);
    raise exception 'BND-7: expected WORKER_AUTH_USER_ALREADY_BOUND for duplicate';
  exception
    when others then
      assert sqlerrm = 'WORKER_AUTH_USER_ALREADY_BOUND',
        'BND-7: expected WORKER_AUTH_USER_ALREADY_BOUND, got ' || sqlerrm;
  end;

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-8: null clears binding
  -- ══════════════════════════════════════════════════════════════════════
  perform public.set_manual_shift_worker_auth_user(worker_1, null);

  assert not exists (
    select 1 from public.manual_shift_workers
    where id = worker_1 and auth_user_id is not null
  ), 'BND-8: worker_1 should have null auth_user_id after clearing';

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-9: list RPC returns correct bound_worker_id after binding
  -- ══════════════════════════════════════════════════════════════════════

  -- Bind operator_a to worker_1 again
  perform public.set_manual_shift_worker_auth_user(worker_1, operator_a);

  -- Now list and verify bound_worker_id
  for rpc_result in
    select * from public.list_manual_shift_bindable_users(tenant_a)
    where user_id = operator_a
  loop
    assert rpc_result.bound_worker_id = worker_1,
      'BND-9: operator_a should have bound_worker_id = worker_1, got ' || rpc_result.bound_worker_id::text;
  end loop;

  -- Also verify admin_a is unbound
  for rpc_result in
    select * from public.list_manual_shift_bindable_users(tenant_a)
    where user_id = admin_a
  loop
    assert rpc_result.bound_worker_id is null,
      'BND-9b: admin_a should have null bound_worker_id';
  end loop;

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-10: list RPC returns null bound_worker_id after clearing
  -- ══════════════════════════════════════════════════════════════════════
  perform public.set_manual_shift_worker_auth_user(worker_1, null);

  for rpc_result in
    select * from public.list_manual_shift_bindable_users(tenant_a)
    where user_id = operator_a
  loop
    assert rpc_result.bound_worker_id is null,
      'BND-10: operator_a should have null bound_worker_id after unbind';
  end loop;

  -- ══════════════════════════════════════════════════════════════════════
  -- BND-11: WORKER_NOT_FOUND exception
  -- ══════════════════════════════════════════════════════════════════════
  begin
    perform public.set_manual_shift_worker_auth_user(gen_random_uuid(), operator_a);
    raise exception 'BND-11: expected WORKER_NOT_FOUND';
  exception
    when others then
      assert sqlerrm = 'WORKER_NOT_FOUND',
        'BND-11: expected WORKER_NOT_FOUND, got ' || sqlerrm;
  end;

  raise notice '━━━ All BND behavioral tests passed ━━━';
end;
$$;

rollback;
