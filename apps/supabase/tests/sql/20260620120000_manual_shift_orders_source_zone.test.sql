begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  admin_a uuid := gen_random_uuid();
  shift_a uuid;
  shift_b uuid;
  line_a uuid;
  line_b uuid;
  order_zero uuid;
  order_single uuid;
  order_mixed uuid;
  order_persisted_1 uuid;
  order_persisted_2 uuid;
  item_zone text;
  zone_count int;
  plan jsonb;
  result record;
begin
  insert into public.tenants (id, code, name)
  values (
    tenant_a,
    'MSC-SZ-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
    'Manual Shift Source Zone'
  );

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    admin_a, 'manual-shift-source-zone@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Manual Shift SZ"}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, admin_a, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  perform set_config('request.jwt.claim.sub', admin_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  insert into public.manual_shift_sessions (
    tenant_id, date, name, status, created_by_profile_id, created_by_name
  )
  values (
    tenant_a, date '2026-06-20', 'Source Zone Shift', 'active', admin_a, 'Manual Shift SZ'
  )
  returning id into shift_a;

  insert into public.manual_shift_lines (
    tenant_id, shift_id, name, sort_order, distribution_area
  )
  values (
    tenant_a, shift_a, 'שפלה 2', 1, 'שפלה אמצעי'
  )
  returning id into line_a;

  -- Backfill policy: zero item zones -> null.
  insert into public.manual_shift_orders (
    tenant_id, shift_id, line_id, point_name, order_number, status
  )
  values (
    tenant_a, shift_a, line_a, 'סלולר', 'SO-ZERO', 'queued'
  )
  returning id into order_zero;

  -- Backfill policy: one item zone -> that zone.
  insert into public.manual_shift_orders (
    tenant_id, shift_id, line_id, point_name, order_number, status
  )
  values (
    tenant_a, shift_a, line_a, 'סלולר', 'SO-SINGLE', 'queued'
  )
  returning id into order_single;

  insert into public.manual_shift_order_items (
    tenant_id, shift_id, line_id, order_id, sku, quantity, zone, sort_order
  )
  values (
    tenant_a, shift_a, line_a, order_single, 'SKU-1', 1, 'שפלה 2', 1
  );

  -- Backfill policy: multiple item zones -> null.
  insert into public.manual_shift_orders (
    tenant_id, shift_id, line_id, point_name, order_number, status
  )
  values (
    tenant_a, shift_a, line_a, 'סלולר', 'SO-MIXED', 'queued'
  )
  returning id into order_mixed;

  insert into public.manual_shift_order_items (
    tenant_id, shift_id, line_id, order_id, sku, quantity, zone, sort_order
  )
  values
    (tenant_a, shift_a, line_a, order_mixed, 'SKU-1', 1, 'שפלה 2', 1),
    (tenant_a, shift_a, line_a, order_mixed, 'SKU-2', 1, 'שפלה אמצעי', 2);

  with item_zone_stats as (
    select
      i.order_id,
      count(distinct nullif(btrim(i.zone), '')) as distinct_zone_count,
      min(nullif(btrim(i.zone), '')) as single_zone
    from public.manual_shift_order_items i
    join public.manual_shift_orders o
      on o.id = i.order_id
    group by i.order_id
  )
  update public.manual_shift_orders o
  set source_zone = case
    when stats.distinct_zone_count = 1 then stats.single_zone
    else null
  end
  from item_zone_stats stats
  where o.id = stats.order_id;

  select source_zone into item_zone
  from public.manual_shift_orders
  where id = order_zero;
  assert item_zone is null, 'SZ-1: expected zero-zone order to remain null';

  select source_zone into item_zone
  from public.manual_shift_orders
  where id = order_single;
  assert item_zone = 'שפלה 2', 'SZ-2: expected single-zone order to backfill שפלה 2';

  select source_zone into item_zone
  from public.manual_shift_orders
  where id = order_mixed;
  assert item_zone is null, 'SZ-3: expected mixed-zone order to remain null';

  -- Monthly apply: same point/order/sku across different source zones must not merge.
  insert into public.manual_shift_sessions (
    tenant_id, date, name, status, created_by_profile_id, created_by_name
  )
  values (
    tenant_a, date '2026-06-20', 'Source Zone Apply Shift', 'active', admin_a, 'Manual Shift SZ'
  )
  returning id into shift_b;

  insert into public.manual_shift_lines (
    tenant_id, shift_id, name, sort_order, distribution_area
  )
  values (
    tenant_a, shift_b, 'שפלה 2', 1, 'שפלה אמצעי'
  )
  returning id into line_b;

  plan := jsonb_build_object(
    'preview', jsonb_build_object(
      'source', jsonb_build_object('sheetName', 'יוני 26', 'fileName', 'source-zone.xlsx')
    ),
    'lines', jsonb_build_array(
      jsonb_build_object(
        'lineName', 'שפלה 2',
        'sortOrder', 1,
        'distributionArea', 'שפלה אמצעי',
        'orders', jsonb_build_array(
          jsonb_build_object(
            'pointName', 'סלולר',
            'customerName', 'לקוח א',
            'orderNumber', 'SO-1',
            'sourceZone', 'שפלה 2',
            'totalQuantity', 5,
            'sourceRows', jsonb_build_array(2),
            'sortOrder', 1,
            'items', jsonb_build_array(
              jsonb_build_object(
                'sku', '1001',
                'description', null,
                'category', null,
                'quantity', 5,
                'notes', null,
                'sourceRows', jsonb_build_array(2),
                'sortOrder', 1,
                'zone', 'שפלה 2'
              )
            ),
            'rawRouteLine', 'שפלה 2/סלולר',
            'routeBase', 'שפלה 2',
            'workBucketName', 'סלולר',
            'workBucketType', 'unknown'
          ),
          jsonb_build_object(
            'pointName', 'סלולר',
            'customerName', 'לקוח א',
            'orderNumber', 'SO-1',
            'sourceZone', 'שפלה אמצעי',
            'totalQuantity', 4,
            'sourceRows', jsonb_build_array(3),
            'sortOrder', 2,
            'items', jsonb_build_array(
              jsonb_build_object(
                'sku', '1001',
                'description', null,
                'category', null,
                'quantity', 4,
                'notes', null,
                'sourceRows', jsonb_build_array(3),
                'sortOrder', 1,
                'zone', 'שפלה אמצעי'
              )
            ),
            'rawRouteLine', 'שפלה 2/סלולר',
            'routeBase', 'שפלה 2',
            'workBucketName', 'סלולר',
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
    tenant_a, shift_b, date '2026-06-20', plan, 'initial'
  ) into result;

  assert result.orders_created = 2,
    'SZ-4: expected two orders created for distinct source zones, got ' || result.orders_created;

  select count(*)::int into zone_count
  from public.manual_shift_orders
  where shift_id = shift_b
    and deleted_at is null
    and source_zone in ('שפלה 2', 'שפלה אמצעי');

  assert zone_count = 2,
    'SZ-5: expected two persisted order rows with distinct source_zone values, got ' || zone_count;

  for zone_value in
    select o.source_zone
    from public.manual_shift_orders o
    where o.shift_id = shift_b
      and o.deleted_at is null
      and o.order_number = 'SO-1'
    order by o.source_zone
  loop
    assert zone_value in ('שפלה 2', 'שפלה אמצעי'),
      'SZ-6: unexpected persisted order source_zone value ' || coalesce(zone_value, 'NULL');
  end loop;

  select count(*)::int into zone_count
  from public.manual_shift_order_items i
  join public.manual_shift_orders o on o.id = i.order_id
  where o.shift_id = shift_b
    and o.deleted_at is null
    and o.order_number = 'SO-1'
    and i.zone in ('שפלה 2', 'שפלה אמצעי');

  assert zone_count = 2,
    'SZ-7: expected item zone to stay aligned with source zone on both rows, got ' || zone_count;
end
$$;

rollback;
