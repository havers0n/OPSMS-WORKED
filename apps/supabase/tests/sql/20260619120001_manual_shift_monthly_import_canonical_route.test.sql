-- SQL persistence tests for canonical route/work-bucket fields.
-- Verifies manual_shift_apply_monthly_import persists raw_route_line,
-- route_base, work_bucket_name, work_bucket_type from the apply plan.
--
-- Required assertions:
--   RT-1  slash route: raw_route_line = full route
--   RT-2  slash route: route_base = prefix
--   RT-3  slash route: work_bucket_name = suffix
--   RT-4  slash route: work_bucket_type = 'unknown'
--   RT-5  slash route: point_name legacy unchanged
--   RT-6  no-slash route: raw_route_line = full route
--   RT-7  no-slash route: route_base = full route
--   RT-8  no-slash route: work_bucket_name is null
--   RT-9  no-slash route: work_bucket_type is null
--   RT-10 no-slash route: point_name legacy unchanged
--   RT-11 split SO: two order rows exist
--   RT-12 split SO: distinct work_bucket_name
--   RT-13 split SO: same order_number
--   RT-14 split SO: point_name legacy values unchanged

begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  admin_a  uuid := gen_random_uuid();
  shift_1  uuid;
  shift_2  uuid;
  shift_3  uuid;
  plan     jsonb;
  result   record;
  ord      record;
  ord_count integer;
begin
  -- ══════════════════════════════════════════════════════════════════════
  -- FIXTURE SETUP
  -- ══════════════════════════════════════════════════════════════════════

  insert into public.tenants (id, code, name)
  values (tenant_a, 'RT-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Route Test');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (admin_a, 'route-admin@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Route Admin"}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, admin_a, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  insert into public.manual_shift_sessions (tenant_id, date, name, status, created_by_profile_id, created_by_name)
  values (tenant_a, date '2026-06-19', 'Route Shift 1', 'active', admin_a, 'Route Admin')
  returning id into shift_1;

  insert into public.manual_shift_sessions (tenant_id, date, name, status, created_by_profile_id, created_by_name)
  values (tenant_a, date '2026-06-20', 'Route Shift 2', 'active', admin_a, 'Route Admin')
  returning id into shift_2;

  insert into public.manual_shift_sessions (tenant_id, date, name, status, created_by_profile_id, created_by_name)
  values (tenant_a, date '2026-06-21', 'Route Shift 3', 'active', admin_a, 'Route Admin')
  returning id into shift_3;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a::text)::text, true);

  -- ══════════════════════════════════════════════════════════════════════
  -- SCENE 1 — Slash route: דרום/סלולר
  -- ══════════════════════════════════════════════════════════════════════

  plan := jsonb_build_object(
    'preview', jsonb_build_object(
      'source', jsonb_build_object('sheetName', null, 'fileName', null)
    ),
    'lines', jsonb_build_array(
      jsonb_build_object(
        'lineName', 'דרום',
        'sortOrder', 1,
        'distributionArea', 'south',
        'orders', jsonb_build_array(
          jsonb_build_object(
            'pointName', 'סלולר',
            'customerName', 'לקוח א',
            'orderNumber', 'SO-1',
            'totalQuantity', 5,
            'sourceRows', jsonb_build_array(1),
            'sortOrder', 1,
            'items', jsonb_build_array(
              jsonb_build_object(
                'sku', '1001',
                'description', null,
                'category', null,
                'quantity', 5,
                'notes', null,
                'sourceRows', jsonb_build_array(1),
                'sortOrder', 1,
                'zone', null
              )
            ),
            'rawRouteLine', 'דרום/סלולר',
            'routeBase', 'דרום',
            'workBucketName', 'סלולר',
            'workBucketType', 'unknown'
          )
        )
      )
    ),
    'appliedGroups', 1,
    'skippedGroups', 0,
    'skippedNegativeQuantityRows', 0,
    'skippedZeroQuantityRows', 0,
    'warningSummary', jsonb_build_object('info', 0, 'warning', 0, 'blocking', 0),
    'blockingWarnings', jsonb_build_array()
  );

  select * from public.manual_shift_apply_monthly_import(
    tenant_a, shift_1, date '2026-06-19', plan, 'initial'
  ) into result;

  assert result.orders_created = 1,
    'RT-S1: expected 1 order created, got ' || result.orders_created;

  ord_count := 0;
  for ord in
    select o.raw_route_line, o.route_base, o.work_bucket_name,
           o.work_bucket_type, o.point_name, o.order_number
    from public.manual_shift_orders o
    where o.shift_id = shift_1 and o.deleted_at is null
  loop
    ord_count := ord_count + 1;
    assert ord.raw_route_line = 'דרום/סלולר',
      'RT-1: expected raw_route_line = דרום/סלולר, got ' || coalesce(ord.raw_route_line, 'NULL');
    assert ord.route_base = 'דרום',
      'RT-2: expected route_base = דרום, got ' || coalesce(ord.route_base, 'NULL');
    assert ord.work_bucket_name = 'סלולר',
      'RT-3: expected work_bucket_name = סלולר, got ' || coalesce(ord.work_bucket_name, 'NULL');
    assert ord.work_bucket_type = 'unknown',
      'RT-4: expected work_bucket_type = unknown, got ' || coalesce(ord.work_bucket_type, 'NULL');
    assert ord.point_name = 'סלולר',
      'RT-5: expected point_name = סלולר, got ' || coalesce(ord.point_name, 'NULL');
  end loop;
  assert ord_count = 1, 'RT-S1: expected 1 order row, got ' || ord_count;

  -- ══════════════════════════════════════════════════════════════════════
  -- SCENE 2 — No-slash route: חיפה
  -- ══════════════════════════════════════════════════════════════════════

  plan := jsonb_build_object(
    'preview', jsonb_build_object(
      'source', jsonb_build_object('sheetName', null, 'fileName', null)
    ),
    'lines', jsonb_build_array(
      jsonb_build_object(
        'lineName', 'חיפה',
        'sortOrder', 2,
        'distributionArea', null,
        'orders', jsonb_build_array(
          jsonb_build_object(
            'pointName', 'חיפה',
            'customerName', null,
            'orderNumber', 'SO-2',
            'totalQuantity', 10,
            'sourceRows', jsonb_build_array(2),
            'sortOrder', 1,
            'items', jsonb_build_array(
              jsonb_build_object(
                'sku', '2001',
                'description', null,
                'category', null,
                'quantity', 10,
                'notes', null,
                'sourceRows', jsonb_build_array(2),
                'sortOrder', 1,
                'zone', null
              )
            ),
            'rawRouteLine', 'חיפה',
            'routeBase', 'חיפה',
            'workBucketName', null,
            'workBucketType', null
          )
        )
      )
    ),
    'appliedGroups', 1,
    'skippedGroups', 0,
    'skippedNegativeQuantityRows', 0,
    'skippedZeroQuantityRows', 0,
    'warningSummary', jsonb_build_object('info', 0, 'warning', 0, 'blocking', 0),
    'blockingWarnings', jsonb_build_array()
  );

  select * from public.manual_shift_apply_monthly_import(
    tenant_a, shift_2, date '2026-06-20', plan, 'initial'
  ) into result;

  assert result.orders_created = 1,
    'RT-S2: expected 1 order created, got ' || result.orders_created;

  ord_count := 0;
  for ord in
    select o.raw_route_line, o.route_base, o.work_bucket_name,
           o.work_bucket_type, o.point_name, l.name as line_name
    from public.manual_shift_orders o
    join public.manual_shift_lines l on o.line_id = l.id
    where o.shift_id = shift_2 and o.deleted_at is null
      and l.name = 'חיפה'
  loop
    ord_count := ord_count + 1;
    assert ord.raw_route_line = 'חיפה',
      'RT-6: expected raw_route_line = חיפה, got ' || coalesce(ord.raw_route_line, 'NULL');
    assert ord.route_base = 'חיפה',
      'RT-7: expected route_base = חיפה, got ' || coalesce(ord.route_base, 'NULL');
    assert ord.work_bucket_name is null,
      'RT-8: expected work_bucket_name is null, got ' || coalesce(ord.work_bucket_name, 'NULL');
    assert ord.work_bucket_type is null,
      'RT-9: expected work_bucket_type is null, got ' || coalesce(ord.work_bucket_type, 'NULL');
    assert ord.point_name = 'חיפה',
      'RT-10: expected point_name = חיפה, got ' || coalesce(ord.point_name, 'NULL');
  end loop;
  assert ord_count = 1, 'RT-S2: expected 1 order row for חיפה, got ' || ord_count;

  -- ══════════════════════════════════════════════════════════════════════
  -- SCENE 3 — Same SO split across two work buckets
  -- ══════════════════════════════════════════════════════════════════════

  plan := jsonb_build_object(
    'preview', jsonb_build_object(
      'source', jsonb_build_object('sheetName', null, 'fileName', null)
    ),
    'lines', jsonb_build_array(
      jsonb_build_object(
        'lineName', 'דרום',
        'sortOrder', 3,
        'distributionArea', null,
        'orders', jsonb_build_array(
          jsonb_build_object(
            'pointName', 'סלולר',
            'customerName', 'לקוח א',
            'orderNumber', 'SO-3',
            'totalQuantity', 3,
            'sourceRows', jsonb_build_array(3),
            'sortOrder', 1,
            'items', jsonb_build_array(
              jsonb_build_object(
                'sku', '3001',
                'description', null,
                'category', null,
                'quantity', 3,
                'notes', null,
                'sourceRows', jsonb_build_array(3),
                'sortOrder', 1,
                'zone', null
              )
            ),
            'rawRouteLine', 'דרום/סלולר',
            'routeBase', 'דרום',
            'workBucketName', 'סלולר',
            'workBucketType', 'unknown'
          ),
          jsonb_build_object(
            'pointName', 'פז השקמה',
            'customerName', 'לקוח א',
            'orderNumber', 'SO-3',
            'totalQuantity', 2,
            'sourceRows', jsonb_build_array(4),
            'sortOrder', 2,
            'items', jsonb_build_array(
              jsonb_build_object(
                'sku', '3002',
                'description', null,
                'category', null,
                'quantity', 2,
                'notes', null,
                'sourceRows', jsonb_build_array(4),
                'sortOrder', 1,
                'zone', null
              )
            ),
            'rawRouteLine', 'דרום/פז השקמה',
            'routeBase', 'דרום',
            'workBucketName', 'פז השקמה',
            'workBucketType', 'unknown'
          )
        )
      )
    ),
    'appliedGroups', 2,
    'skippedGroups', 0,
    'skippedNegativeQuantityRows', 0,
    'skippedZeroQuantityRows', 0,
    'warningSummary', jsonb_build_object('info', 0, 'warning', 0, 'blocking', 0),
    'blockingWarnings', jsonb_build_array()
  );

  select * from public.manual_shift_apply_monthly_import(
    tenant_a, shift_3, date '2026-06-21', plan, 'initial'
  ) into result;

  assert result.orders_created = 2,
    'RT-S3: expected 2 orders created, got ' || result.orders_created;

  ord_count := 0;
  for ord in
    select o.work_bucket_name, o.point_name, o.order_number, l.name as line_name
    from public.manual_shift_orders o
    join public.manual_shift_lines l on o.line_id = l.id
    where o.shift_id = shift_3 and o.deleted_at is null
      and l.name = 'דרום'
      and o.order_number = 'SO-3'
    order by o.sort_order asc
  loop
    ord_count := ord_count + 1;
    assert ord.order_number = 'SO-3',
      'RT-13: expected order_number = SO-3, got ' || coalesce(ord.order_number, 'NULL');
  end loop;

  assert ord_count = 2,
    'RT-11: expected 2 order rows for SO-3, got ' || ord_count;

  -- Verify distinct work_bucket_name values
  perform 1
  from (
    select distinct o.work_bucket_name
    from public.manual_shift_orders o
    join public.manual_shift_lines l on o.line_id = l.id
    where o.shift_id = shift_3 and o.deleted_at is null
      and l.name = 'דרום'
      and o.order_number = 'SO-3'
  ) buckets
  having count(*) <> 2;
  assert not found,
    'RT-12: expected 2 distinct work_bucket_name values for SO-3';

  -- Verify legacy point_name values remain unchanged
  perform 1
  from public.manual_shift_orders o
  join public.manual_shift_lines l on o.line_id = l.id
  where o.shift_id = shift_3 and o.deleted_at is null
    and l.name = 'דרום'
    and o.order_number = 'SO-3'
    and o.point_name not in ('סלולר', 'פז השקמה');
  assert not found,
    'RT-14: expected point_name values סלולר and פז השקמה';

  raise notice '━━━ All canonical route persistence tests passed ━━━';
end;
$$;

rollback;
