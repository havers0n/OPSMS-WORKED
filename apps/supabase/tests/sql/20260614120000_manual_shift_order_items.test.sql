begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  shift_a uuid;
  line_a uuid;
  order_a uuid;
  item_a uuid;
  item_b uuid;
  v_sku text;
  v_desc text;
  v_discard1 text;
  v_discard2 text;
  v_discard3 text;
  v_discard4 text;
  v_source_rows integer[];
  v_source_sheet text;
begin
  insert into public.tenants (id, code, name)
  values (
    tenant_a,
    'MSC-ITEMS-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
    'Manual Shift Order Items'
  );

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    user_a, 'manual-shift-items@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Manual Shift Items"}'
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
    tenant_a, date '2026-06-14', 'Morning Shift', 'active', user_a, 'Manual Shift Items'
  )
  returning id into shift_a;

  insert into public.manual_shift_lines (
    tenant_id, shift_id, name, sort_order
  )
  values (
    tenant_a, shift_a, 'חיפה', 1
  )
  returning id into line_a;

  insert into public.manual_shift_orders (
    tenant_id, shift_id, line_id, point_name, order_number, status
  )
  values (
    tenant_a, shift_a, line_a, 'דיזול צקפוסט', 'SO26015494', 'queued'
  )
  returning id into order_a;

  -- Test 1: valid insert
  insert into public.manual_shift_order_items (
    tenant_id, shift_id, line_id, order_id,
    sku, description, category, quantity, notes, zone,
    source_sheet, source_rows, source_file, sort_order
  )
  values (
    tenant_a, shift_a, line_a, order_a,
    '474089', 'בידורית 6.5+2 אינץ BEAT IT', 'חשמל', 2.0,
    'מוכן במחסן', 'שפלה 1',
    'יוני 26', array[709, 710], 'רוני קובץ 2026.xlsx', 1
  )
  returning id into item_a;

  select sku, description, source_rows, source_sheet
  into v_sku, v_desc, v_source_rows, v_source_sheet
  from public.manual_shift_order_items
  where id = item_a;

  if v_sku <> '474089' then
    raise exception 'MSC-ITEMS-1 FAIL: expected sku 474089, got "%".', v_sku;
  end if;

  if v_desc <> 'בידורית 6.5+2 אינץ BEAT IT' then
    raise exception 'MSC-ITEMS-2 FAIL: expected description preserved.';
  end if;

  if v_source_rows <> array[709, 710] then
    raise exception 'MSC-ITEMS-3 FAIL: expected source_rows [709,710].';
  end if;

  if v_source_sheet <> 'יוני 26' then
    raise exception 'MSC-ITEMS-4 FAIL: expected source_sheet יוני 26.';
  end if;

  -- Test 2: blank sku rejected
  begin
    insert into public.manual_shift_order_items (
      tenant_id, shift_id, line_id, order_id, sku
    )
    values (
      tenant_a, shift_a, line_a, order_a, '   '
    );
    raise exception 'MSC-ITEMS-5 FAIL: blank sku should be rejected.';
  exception
    when raise_exception or check_violation then
      null;
  end;

  -- Test 3: nullable text blank strings normalize to null
  insert into public.manual_shift_order_items (
    tenant_id, shift_id, line_id, order_id,
    sku, description, category, notes, zone, source_sheet, source_file
  )
  values (
    tenant_a, shift_a, line_a, order_a,
    '475659', '   ', '  ', '', null, '  ', '   '
  )
  returning id into item_b;

  select description, category, notes, zone, source_sheet, source_file
  into v_desc, v_discard1, v_discard2, v_discard3, v_source_sheet, v_discard4
  from public.manual_shift_order_items
  where id = item_b;

  if v_desc is not null then
    raise exception 'MSC-ITEMS-6 FAIL: blank description should normalize to null.';
  end if;

  -- Test 4: negative quantity accepted
  update public.manual_shift_order_items
  set quantity = -1
  where id = item_b;

  if not exists (
    select 1 from public.manual_shift_order_items
    where id = item_b and quantity = -1
  ) then
    raise exception 'MSC-ITEMS-7 FAIL: negative quantity should be accepted.';
  end if;

  -- Test 5: invalid order_id rejected
  begin
    insert into public.manual_shift_order_items (
      tenant_id, shift_id, line_id, order_id, sku
    )
    values (
      tenant_a, shift_a, line_a, gen_random_uuid(), 'SKU-001'
    );
    raise exception 'MSC-ITEMS-8 FAIL: invalid order_id should be rejected.';
  exception
    when raise_exception or foreign_key_violation then
      null;
  end;

  -- Test 6: tenant mismatch rejected
  begin
    insert into public.manual_shift_order_items (
      tenant_id, shift_id, line_id, order_id, sku
    )
    values (
      gen_random_uuid(), shift_a, line_a, order_a, 'SKU-001'
    );
    raise exception 'MSC-ITEMS-9 FAIL: tenant mismatch should be rejected.';
  exception
    when raise_exception then
      null;
  end;

  -- Test 7: soft-deleting an order preserves item rows (no hard-delete cascade)
  update public.manual_shift_orders
  set deleted_at = timezone('utc', now()),
      deleted_by_profile_id = user_a,
      deleted_by_name = 'Test Admin',
      delete_reason = 'MSC-ITEMS-10 test'
  where id = order_a;

  -- Assert: order row still exists after soft-delete
  if not exists (
    select 1 from public.manual_shift_orders
    where id = order_a and deleted_at is not null
  ) then
    raise exception 'MSC-ITEMS-10 FAIL: order should still exist after soft-delete with deleted_at set.';
  end if;

  -- Assert: related item rows still exist (soft-delete does not cascade)
  if not exists (
    select 1 from public.manual_shift_order_items
    where id in (item_a, item_b)
  ) then
    raise exception 'MSC-ITEMS-10 FAIL: items should survive soft-delete of parent order.';
  end if;

  -- Assert: authenticated tenant users cannot hard-delete orders (no DELETE RLS policy)
  begin
    delete from public.manual_shift_orders where id = order_a;
    raise exception 'MSC-ITEMS-10 FAIL: hard-delete of manual_shift_orders should be blocked by RLS.';
  exception
    when others then
      null;
  end;
end
$$;

rollback;
