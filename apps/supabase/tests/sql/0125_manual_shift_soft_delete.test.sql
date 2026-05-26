begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  shift_a uuid;
  active_line uuid;
  deleted_line uuid;
  active_order uuid;
  deleted_order uuid;
  line_event_count integer;
  summary_row record;
begin
  insert into public.tenants (id, code, name)
  values (
    tenant_a,
    'MSC-0125-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
    'Manual Shift Control 0125'
  );

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    user_a, 'manual-shift-0125@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Manual Shift 0125"}'
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
    tenant_a, date '2026-05-27', 'Soft Delete Shift', 'active', user_a, 'Manual Shift 0125'
  )
  returning id into shift_a;

  insert into public.manual_shift_lines (
    tenant_id, shift_id, name, sort_order
  )
  values (tenant_a, shift_a, 'Active Line', 1)
  returning id into active_line;

  insert into public.manual_shift_lines (
    tenant_id, shift_id, name, sort_order
  )
  values (tenant_a, shift_a, 'Deleted Line', 2)
  returning id into deleted_line;

  select id
  into deleted_line
  from public.manual_shift_lines
  where shift_id = shift_a
    and name = 'Deleted Line';

  insert into public.manual_shift_orders (
    tenant_id, shift_id, line_id, point_name, picker_name, size, status
  )
  values (tenant_a, shift_a, active_line, 'Point A', 'Picker A', 'M', 'queued')
  returning id into active_order;

  insert into public.manual_shift_orders (
    tenant_id, shift_id, line_id, point_name, picker_name, size, status
  )
  values (tenant_a, shift_a, active_line, 'Point Deleted', 'Picker A', 'M', 'waiting_check')
  returning id into deleted_order;

  insert into public.manual_shift_order_errors (
    tenant_id, shift_id, line_id, order_id, type, comment, created_by_profile_id, created_by_name
  )
  values (
    tenant_a, shift_a, active_line, deleted_order, 'missing_item', 'Deleted order error', user_a, 'Manual Shift 0125'
  );

  update public.manual_shift_orders
  set
    deleted_at = timezone('utc', now()),
    deleted_by_profile_id = user_a,
    deleted_by_name = '  Manual Shift 0125  ',
    delete_reason = '  Duplicate point  '
  where id = deleted_order;

  update public.manual_shift_lines
  set
    deleted_at = timezone('utc', now()),
    deleted_by_profile_id = user_a,
    deleted_by_name = '  Manual Shift 0125  ',
    delete_reason = '  Empty line  '
  where id = deleted_line;

  insert into public.manual_shift_order_events (
    tenant_id, shift_id, line_id, order_id, event_type, actor_profile_id, actor_name, from_status, to_status, payload
  )
  values (
    tenant_a,
    shift_a,
    active_line,
    deleted_order,
    'point_deleted',
    user_a,
    'Manual Shift 0125',
    'waiting_check',
    null,
    '{"reason":"Duplicate point"}'::jsonb
  );

  insert into public.manual_shift_line_events (
    tenant_id, shift_id, line_id, event_type, actor_profile_id, actor_name, payload
  )
  values (
    tenant_a,
    shift_a,
    deleted_line,
    'line_deleted',
    user_a,
    '  Manual Shift 0125  ',
    '{"reason":"Empty line"}'::jsonb
  );

  select count(*)
  into line_event_count
  from public.manual_shift_line_events
  where line_id = deleted_line
    and event_type = 'line_deleted';

  if line_event_count <> 1 then
    raise exception 'MSC-0125-1 FAIL: expected one line_deleted event, got %.', line_event_count;
  end if;

  if exists (
    select 1
    from public.manual_shift_orders
    where id = deleted_order
      and (deleted_by_name <> 'Manual Shift 0125' or delete_reason <> 'Duplicate point')
  ) then
    raise exception 'MSC-0125-2 FAIL: deleted order metadata should be trimmed.';
  end if;

  if exists (
    select 1
    from public.manual_shift_lines
    where id = deleted_line
      and (deleted_by_name <> 'Manual Shift 0125' or delete_reason <> 'Empty line')
  ) then
    raise exception 'MSC-0125-3 FAIL: deleted line metadata should be trimmed.';
  end if;

  if exists (
    select 1
    from public.manual_shift_list_line_summaries(shift_a, tenant_a)
    where line_id = deleted_line
  ) then
    raise exception 'MSC-0125-4 FAIL: deleted lines must be excluded from active line summaries.';
  end if;

  select *
  into summary_row
  from public.manual_shift_list_line_summaries(shift_a, tenant_a)
  where line_id = active_line;

  if summary_row.total_orders <> 1 then
    raise exception 'MSC-0125-5 FAIL: deleted orders must be excluded from active line counts, got %.', summary_row.total_orders;
  end if;

  if summary_row.waiting_check_orders <> 0 then
    raise exception 'MSC-0125-6 FAIL: deleted waiting_check point must not count in active summaries.';
  end if;

  if summary_row.error_count <> 0 then
    raise exception 'MSC-0125-7 FAIL: errors attached to deleted orders must be excluded from active summaries.';
  end if;
end
$$;

rollback;
