begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  shift_a uuid;
  line_a uuid;
  order_a uuid;
  event_count integer;
  summary_count integer;
begin
  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'MSC-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Manual Shift Control A'),
    (tenant_b, 'MSC-B-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Manual Shift Control B');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values
    (user_a, 'manual-shift-a@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Manual Shift A"}'),
    (user_b, 'manual-shift-b@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Manual Shift B"}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values
    (tenant_a, user_a, 'tenant_admin'),
    (tenant_b, user_b, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  insert into public.manual_shift_sessions (
    tenant_id, date, name, status, created_by_profile_id, created_by_name
  )
  values (
    tenant_a, date '2026-05-26', 'Morning Shift', 'active', user_a, 'Manual Shift A'
  )
  returning id into shift_a;

  begin
    insert into public.manual_shift_sessions (
      tenant_id, date, name, status, created_by_profile_id, created_by_name
    )
    values (
      tenant_a, date '2026-05-26', 'Duplicate Shift', 'active', user_a, 'Manual Shift A'
    );
    raise exception 'MSC-1 FAIL: duplicate active shift per tenant/date should be rejected.';
  exception
    when unique_violation then
      null;
  end;

  insert into public.manual_shift_lines (
    tenant_id, shift_id, name, sort_order
  )
  values (
    tenant_a, shift_a, 'שרון דרומי', 1
  )
  returning id into line_a;

  begin
    insert into public.manual_shift_lines (
      tenant_id, shift_id, name, sort_order
    )
    values (
      tenant_b, shift_a, 'Mismatched line', 2
    );
    raise exception 'MSC-2 FAIL: tenant-mismatched line should be rejected.';
  exception
    when others then
      if sqlerrm <> 'MANUAL_SHIFT_LINE_TENANT_MISMATCH' then
        raise;
      end if;
  end;

  insert into public.manual_shift_orders (
    tenant_id, shift_id, line_id, order_number, picker_name, line_count, size, status
  )
  values (
    tenant_a, shift_a, line_a, '502481', 'יהודה', 12, 'L', 'queued'
  )
  returning id into order_a;

  begin
    insert into public.manual_shift_orders (
      tenant_id, shift_id, line_id, order_number, status
    )
    values (
      tenant_b, shift_a, line_a, '502482', 'queued'
    );
    raise exception 'MSC-3 FAIL: tenant-mismatched order should be rejected.';
  exception
    when others then
      if sqlerrm <> 'MANUAL_SHIFT_ORDER_TENANT_MISMATCH' then
        raise;
      end if;
  end;

  insert into public.manual_shift_order_events (
    tenant_id, shift_id, line_id, order_id, event_type, actor_profile_id, actor_name, from_status, to_status, payload
  )
  values (
    tenant_a,
    shift_a,
    line_a,
    order_a,
    'status_changed',
    user_a,
    'Manual Shift A',
    'queued',
    'picking',
    '{"source":"sql-test"}'::jsonb
  );

  insert into public.manual_shift_order_errors (
    tenant_id, shift_id, line_id, order_id, type, comment, created_by_profile_id, created_by_name
  )
  values (
    tenant_a,
    shift_a,
    line_a,
    order_a,
    'missing_item',
    'Missing product',
    user_a,
    'Manual Shift A'
  );

  select count(*) into event_count
  from public.manual_shift_order_events
  where order_id = order_a;

  if event_count <> 1 then
    raise exception 'MSC-4 FAIL: expected one event row, got %.', event_count;
  end if;

  select count(*) into summary_count
  from public.manual_shift_order_errors
  where order_id = order_a;

  if summary_count <> 1 then
    raise exception 'MSC-5 FAIL: expected one error row, got %.', summary_count;
  end if;

  execute 'reset role';

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_b::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into summary_count
  from public.manual_shift_sessions
  where id = shift_a;

  if summary_count <> 0 then
    raise exception 'MSC-6 FAIL: tenant B must not read tenant A shift rows via RLS.';
  end if;

  update public.manual_shift_orders
  set status = 'done'
  where id = order_a;

  if exists (
    select 1
    from public.manual_shift_orders
    where id = order_a
  ) then
    raise exception 'MSC-7 FAIL: tenant B must not be able to read tenant A order rows after attempted update.';
  end if;

  execute 'reset role';

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  if exists (
    select 1
    from public.manual_shift_orders
    where id = order_a
      and status = 'done'
  ) then
    raise exception 'MSC-8 FAIL: tenant B update attempt must not change tenant A order status.';
  end if;
end
$$;

rollback;
