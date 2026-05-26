begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  shift_a uuid;
  shift_b uuid;
  line_a uuid;
  worker_a uuid;
  order_a uuid;
begin
  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'MSW-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Manual Shift Workers A'),
    (tenant_b, 'MSW-B-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Manual Shift Workers B');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values
    (user_a, 'msw-a@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Worker Test A"}'),
    (user_b, 'msw-b@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Worker Test B"}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values
    (tenant_a, user_a, 'tenant_admin'),
    (tenant_b, user_b, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  -- Create sessions for each tenant (as service role before switching to authenticated)
  insert into public.manual_shift_sessions (
    tenant_id, date, name, status, created_by_profile_id, created_by_name
  ) values (
    tenant_a, date '2026-05-27', 'Worker Test Shift A', 'active', user_a, 'Worker Test A'
  ) returning id into shift_a;

  insert into public.manual_shift_sessions (
    tenant_id, date, name, status, created_by_profile_id, created_by_name
  ) values (
    tenant_b, date '2026-05-27', 'Worker Test Shift B', 'active', user_b, 'Worker Test B'
  ) returning id into shift_b;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- MSW-1: Create a worker for tenant_a shift_a
  insert into public.manual_shift_workers (
    tenant_id, shift_id, name, role, sort_order
  ) values (
    tenant_a, shift_a, 'יהודה', 'picker', 1
  ) returning id into worker_a;

  if worker_a is null then
    raise exception 'MSW-1 FAIL: worker should be created.';
  end if;

  -- MSW-2: Tenant mismatch should fail
  begin
    insert into public.manual_shift_workers (
      tenant_id, shift_id, name, role, sort_order
    ) values (
      tenant_b, shift_a, 'Mismatched Worker', 'picker', 2
    );
    raise exception 'MSW-2 FAIL: tenant mismatch should be rejected.';
  exception
    when others then
      if sqlerrm <> 'MANUAL_SHIFT_WORKER_TENANT_MISMATCH' then
        raise;
      end if;
  end;

  -- MSW-3: Name is trimmed (trailing spaces should be stripped)
  declare
    trimmed_name text;
  begin
    insert into public.manual_shift_workers (
      tenant_id, shift_id, name, role, sort_order
    ) values (
      tenant_a, shift_a, '  שלמה  ', 'checker', 2
    ) returning name into trimmed_name;

    if trimmed_name <> 'שלמה' then
      raise exception 'MSW-3 FAIL: name should be trimmed, got %', trimmed_name;
    end if;
  end;

  -- MSW-4: Empty name after trim should fail
  begin
    insert into public.manual_shift_workers (
      tenant_id, shift_id, name, role, sort_order
    ) values (
      tenant_a, shift_a, '   ', 'picker', 3
    );
    raise exception 'MSW-4 FAIL: empty name should be rejected.';
  exception
    when others then
      if sqlerrm not like '%MANUAL_SHIFT_WORKER_NAME_EMPTY%' and sqlerrm not like '%check%' then
        raise;
      end if;
  end;

  -- MSW-5: Deactivate worker (update active = false)
  update public.manual_shift_workers
  set active = false
  where id = worker_a;

  declare
    active_val boolean;
  begin
    select active into active_val
    from public.manual_shift_workers
    where id = worker_a;

    if active_val <> false then
      raise exception 'MSW-5 FAIL: worker should be inactive.';
    end if;
  end;

  -- MSW-6: Create a line and order, link worker via picker_worker_id
  insert into public.manual_shift_lines (
    tenant_id, shift_id, name, sort_order
  ) values (
    tenant_a, shift_a, 'Test Line', 1
  ) returning id into line_a;

  insert into public.manual_shift_orders (
    tenant_id, shift_id, line_id, point_name, picker_name, picker_worker_id, size, status
  ) values (
    tenant_a, shift_a, line_a, 'Point A', 'יהודה', worker_a, 'M', 'queued'
  ) returning id into order_a;

  if order_a is null then
    raise exception 'MSW-6 FAIL: order with picker_worker_id should be created.';
  end if;

  -- MSW-7: picker_worker_id can be null (backward compat)
  declare
    order_b uuid;
  begin
    insert into public.manual_shift_orders (
      tenant_id, shift_id, line_id, point_name, picker_name, picker_worker_id, size, status
    ) values (
      tenant_a, shift_a, line_a, 'Point B', 'חופשי', null, 'S', 'queued'
    ) returning id into order_b;

    if order_b is null then
      raise exception 'MSW-7 FAIL: order with null picker_worker_id should be allowed.';
    end if;
  end;

  -- MSW-8: RLS tenant isolation — user_a cannot read tenant_b workers
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);

  declare
    visible_count integer;
  begin
    -- Insert a worker for tenant_b as service role first
    execute 'set local role postgres';
    insert into public.manual_shift_workers (
      tenant_id, shift_id, name, role, sort_order
    ) values (
      tenant_b, shift_b, 'Worker B', 'picker', 1
    );

    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', user_a::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);

    select count(*) into visible_count
    from public.manual_shift_workers
    where shift_id = shift_b;

    if visible_count <> 0 then
      raise exception 'MSW-8 FAIL: user_a should not see tenant_b workers, saw %', visible_count;
    end if;
  end;

  raise notice 'MSW: all manual_shift_workers tests passed.';
end;
$$;

rollback;
