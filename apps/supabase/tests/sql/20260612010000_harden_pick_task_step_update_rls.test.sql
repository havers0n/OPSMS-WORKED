begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  operator_user uuid := gen_random_uuid();
  task_a uuid := gen_random_uuid();
  step_a uuid := gen_random_uuid();
  affected integer;
  vtid uuid;
  vstatus text;
  with_check_count integer;
begin
  -- Fixtures ----------------------------------------------------------------

  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'THPTS-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'THPTS Tenant A'),
    (tenant_b, 'THPTS-B-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'THPTS Tenant B');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values
    (admin_user,    'thpts-admin@wos.test',    now(), now(), now(), false, '{}', '{}'),
    (operator_user, 'thpts-operator@wos.test', now(), now(), now(), false, '{}', '{}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values
    (tenant_a, admin_user,    'tenant_admin'),
    (tenant_a, operator_user, 'operator')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  -- Insert using service_role (bypass RLS for fixture creation)
  execute 'set local role service_role';

  insert into public.pick_tasks (id, tenant_id, source_type, source_id, status)
  values (task_a, tenant_a, 'order', gen_random_uuid(), 'ready');

  insert into public.pick_steps (id, task_id, tenant_id, sequence_no, sku, item_name, qty_required, status)
  values (step_a, task_a, tenant_a, 1, 'THPTS-SKU', 'THPTS Item', 5, 'pending');

  execute 'reset role';

  -- Auth setup --------------------------------------------------------------

  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_user::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- Assertion 1: admin can update a normal mutable field on tenant A pick_task

  update public.pick_tasks
  set status = 'assigned'
  where id = task_a;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'THPTS-1 FAIL: admin should update own tenant pick_task (status).';
  end if;

  -- Verify the update landed
  select status into vstatus
  from public.pick_tasks
  where id = task_a;
  if vstatus <> 'assigned' then
    raise exception 'THPTS-1b FAIL: pick_task status not updated to assigned.';
  end if;

  -- Assertion 2: admin cannot change pick_task.tenant_id to tenant B

  begin
    update public.pick_tasks
    set tenant_id = tenant_b
    where id = task_a;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'THPTS-2 FAIL: admin should NOT be able to move pick_task to tenant B (affected=%).', affected;
    end if;
  exception
    when others then
      null; -- expected: WITH CHECK rejects the cross-tenant move
  end;

  -- Assertion 3: admin can update a normal mutable field on tenant A pick_step

  update public.pick_steps
  set status = 'picked'
  where id = step_a;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'THPTS-3 FAIL: admin should update own tenant pick_step (status).';
  end if;

  select status into vstatus
  from public.pick_steps
  where id = step_a;
  if vstatus <> 'picked' then
    raise exception 'THPTS-3b FAIL: pick_step status not updated to picked.';
  end if;

  -- Assertion 4: admin cannot change pick_step.tenant_id to tenant B

  begin
    update public.pick_steps
    set tenant_id = tenant_b
    where id = step_a;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'THPTS-4 FAIL: admin should NOT be able to move pick_step to tenant B (affected=%).', affected;
    end if;
  exception
    when others then
      null; -- expected: WITH CHECK rejects the cross-tenant move
  end;

  -- Assertion 7: rows still in tenant A after rejected cross-tenant updates

  select tenant_id into vtid
  from public.pick_tasks
  where id = task_a;
  if vtid <> tenant_a then
    raise exception 'THPTS-7a FAIL: pick_task tenant_id changed after rejected update.';
  end if;

  select tenant_id into vtid
  from public.pick_steps
  where id = step_a;
  if vtid <> tenant_a then
    raise exception 'THPTS-7b FAIL: pick_step tenant_id changed after rejected update.';
  end if;

  -- Switch to operator ------------------------------------------------------

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', operator_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', operator_user::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- Assertion 5: non-admin cannot update tenant A pick_task

  begin
    update public.pick_tasks
    set status = 'in_progress'
    where id = task_a;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'THPTS-5 FAIL: operator should NOT be able to update pick_task (affected=%).', affected;
    end if;
  exception
    when others then
      null; -- expected: operator role cannot manage tenant
  end;

  -- Assertion 6: non-admin cannot update tenant A pick_step

  begin
    update public.pick_steps
    set status = 'partial'
    where id = step_a;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'THPTS-6 FAIL: operator should NOT be able to update pick_step (affected=%).', affected;
    end if;
  exception
    when others then
      null; -- expected: operator role cannot manage tenant
  end;

  -- Assertion 8: policies contain WITH CHECK in pg_policies -----------------

  execute 'reset role';

  select count(*) into with_check_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('pick_tasks', 'pick_steps')
    and policyname in ('pick_tasks_update_scoped', 'pick_steps_update_scoped')
    and cmd in ('UPDATE')
    and qual is not null
    and with_check is not null;

  if with_check_count <> 2 then
    raise exception 'THPTS-8 FAIL: expected 2 UPDATE policies with WITH CHECK, found %.', with_check_count;
  end if;

  raise notice 'THPTS: all pick_task / pick_step WITH CHECK enforcement tests passed.';
end
$$;

rollback;
