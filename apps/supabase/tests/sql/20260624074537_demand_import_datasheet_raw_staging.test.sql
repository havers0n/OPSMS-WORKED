begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  admin_a uuid := gen_random_uuid();
  batch_a uuid;
  raw_count integer;
  manual_shift_count integer;
begin
  insert into public.tenants (id, code, name)
  values (
    tenant_a,
    'DIR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
    'Demand Import Raw'
  );

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    admin_a, 'demand-import-raw@wos.test', now(), now(), now(), false, '{}', '{"display_name":"Demand Import Raw"}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, admin_a, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  perform set_config('request.jwt.claim.sub', admin_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  insert into public.demand_import_batches (
    tenant_id,
    source_file,
    source_sheet,
    uploaded_by,
    status,
    rows_count,
    raw_rows_count,
    warning_rows_count,
    error_rows_count,
    special_flow_rows_count,
    distribution_areas_count,
    distinct_orders_count,
    distinct_sku_count
  )
  values (
    tenant_a,
    'datasheet.xlsx',
    'DataSheet',
    admin_a,
    'ready',
    2,
    1,
    1,
    0,
    1,
    1,
    2,
    2
  )
  returning id into batch_a;

  insert into public.raw_demand_rows (
    tenant_id,
    batch_id,
    source_sheet,
    source_row_number,
    agent,
    order_date,
    customer_name,
    order_number,
    sku,
    description,
    category,
    quantity,
    cost,
    notes,
    distribution_area,
    raw_route_line,
    planned_delivery_date,
    planned_route_line,
    planned_work_bucket,
    planning_status,
    route_flow,
    product_handling_flow,
    note_date_hints,
    issues
  )
  values
    (
      tenant_a,
      batch_a,
      'DataSheet',
      2,
      'agent',
      date '2026-06-24',
      'לקוח א',
      'SO-1',
      'SKU-1',
      'מוצר רגיל',
      'cat',
      3,
      10,
      null,
      'דרום',
      null,
      null,
      null,
      null,
      'unplanned',
      'unassigned',
      'regular',
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      tenant_a,
      batch_a,
      'DataSheet',
      3,
      'agent',
      date '2026-06-24',
      'לקוח ב',
      'SO-2',
      'SKU-2',
      'איסוף',
      'cat',
      1,
      5,
      'איסוף',
      'דרום',
      null,
      null,
      null,
      null,
      'special_flow',
      'pickup',
      'regular',
      '[{"raw":"25.06.26","normalized":"2026-06-25"}]'::jsonb,
      '[]'::jsonb
    );

  select count(*) into raw_count
  from public.raw_demand_rows
  where tenant_id = tenant_a
    and batch_id = batch_a
    and planned_delivery_date is null
    and planned_route_line is null
    and planned_work_bucket is null;

  if raw_count <> 2 then
    raise exception 'expected 2 staged raw demand rows, got %', raw_count;
  end if;

  select count(*) into manual_shift_count
  from public.manual_shift_orders
  where tenant_id = tenant_a;

  if manual_shift_count <> 0 then
    raise exception 'expected no manual_shift_orders rows from DataSheet staging, got %', manual_shift_count;
  end if;

  raise notice 'DIR: DataSheet raw staging tables accept rows and do not write manual_shift_orders.';
end;
$$;

rollback;
