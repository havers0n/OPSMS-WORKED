begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  shift_a uuid;
  line_a uuid;
  order_a uuid;
  normalized_point text;
  normalized_pallet numeric(6,2);
begin
  insert into public.tenants (id, code, name)
  values (
    tenant_a,
    'MSC-0121-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
    'Manual Shift Control 0121'
  );

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    user_a, 'manual-shift-0121@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Manual Shift 0121"}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, user_a, 'tenant_admin')
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
    tenant_a, date '2026-05-26', 'Morning Shift', 'active', user_a, 'Manual Shift 0121'
  )
  returning id into shift_a;

  insert into public.manual_shift_lines (
    tenant_id, shift_id, name, sort_order
  )
  values (
    tenant_a, shift_a, 'ירושלים', 1
  )
  returning id into line_a;

  insert into public.manual_shift_orders (
    tenant_id, shift_id, line_id, point_name, order_number, pallet_count, status
  )
  values (
    tenant_a, shift_a, line_a, '  סופר ספיר קרית יובל / ירושלים  ', null, 2.5, 'queued'
  )
  returning id into order_a;

  select point_name, pallet_count
  into normalized_point, normalized_pallet
  from public.manual_shift_orders
  where id = order_a;

  if normalized_point <> 'סופר ספיר קרית יובל / ירושלים' then
    raise exception 'MSC-0121-1 FAIL: expected trimmed point_name, got "%".', normalized_point;
  end if;

  if normalized_pallet <> 2.5 then
    raise exception 'MSC-0121-2 FAIL: expected pallet_count 2.5, got "%".', normalized_pallet;
  end if;

  update public.manual_shift_orders
  set point_name = '   ', pallet_count = null
  where id = order_a;

  select point_name, pallet_count
  into normalized_point, normalized_pallet
  from public.manual_shift_orders
  where id = order_a;

  if normalized_point is not null then
    raise exception 'MSC-0121-3 FAIL: blank point_name must normalize to null.';
  end if;

  if normalized_pallet is not null then
    raise exception 'MSC-0121-4 FAIL: pallet_count should remain null.';
  end if;

  begin
    insert into public.manual_shift_orders (
      tenant_id, shift_id, line_id, point_name, pallet_count, status
    )
    values (
      tenant_a, shift_a, line_a, 'ירושלים / רמי לוי רב-חן', -1, 'queued'
    );
    raise exception 'MSC-0121-5 FAIL: negative pallet_count should be rejected.';
  exception
    when check_violation then
      null;
  end;
end
$$;

rollback;
