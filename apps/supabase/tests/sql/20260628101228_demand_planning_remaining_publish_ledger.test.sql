begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  batch_a uuid;
  row_a uuid;
  shift_one uuid;
  shift_two uuid;
  draft_one uuid;
  draft_two uuid;
  draft_three uuid;
  bucket_one uuid;
  bucket_two uuid;
  bucket_three uuid;
  published_total numeric;
  result jsonb;
begin
  insert into public.tenants (id, code, name)
  values (tenant_a, 'DP-REM-' || left(replace(gen_random_uuid()::text, '-', ''), 8), 'Demand remaining ledger');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (user_a, 'dp-remaining@wos.test', now(), now(), now(), false, '{}', '{}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, user_a, 'tenant_admin');

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  insert into public.manual_shift_sessions (
    tenant_id, date, name, status, created_by_profile_id, created_by_name
  ) values
    (tenant_a, date '2026-07-01', 'First target', 'active', user_a, 'tester')
  returning id into shift_one;

  insert into public.manual_shift_sessions (
    tenant_id, date, name, status, created_by_profile_id, created_by_name
  ) values
    (tenant_a, date '2026-07-02', 'Second target', 'active', user_a, 'tester')
  returning id into shift_two;

  insert into public.demand_import_batches (
    tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count,
    distribution_areas_count, distinct_orders_count, distinct_sku_count
  ) values (tenant_a, 'remaining.xlsx', 'DataSheet', 'ready', 1, 1, 1, 1, 1)
  returning id into batch_a;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number, customer_name,
    order_number, sku, quantity, distribution_area, planned_delivery_date,
    planning_status, route_flow, product_handling_flow
  ) values (
    tenant_a, batch_a, 'DataSheet', 2, 'Customer', 'ORDER-1', 'SKU-1', 10,
    'south', null, 'unplanned', 'unassigned', 'regular'
  ) returning id into row_a;

  insert into public.demand_planning_drafts (tenant_id, batch_id, source_scope)
  values (tenant_a, batch_a, 'all') returning id into draft_one;
  insert into public.demand_planning_buckets (
    tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name
  ) values (tenant_a, draft_one, batch_a, 'south', 'line-1', 'group-1')
  returning id into bucket_one;
  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  ) values (tenant_a, draft_one, batch_a, row_a, bucket_one, 4);

  result := public.manual_shift_publish_demand_planning_draft(tenant_a, draft_one, shift_one);
  if result->>'createdItems' <> '1' then
    raise exception 'DP-REM-1 FAIL: first partial publish did not create one item.';
  end if;

  select sum(published_quantity) into published_total
  from public.demand_planning_published_allocations
  where raw_demand_row_id = row_a;
  if published_total <> 4 then
    raise exception 'DP-REM-2 FAIL: expected 4 published, got %.', published_total;
  end if;

  insert into public.demand_planning_drafts (tenant_id, batch_id, source_scope)
  values (tenant_a, batch_a, 'remaining') returning id into draft_two;
  insert into public.demand_planning_buckets (
    tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name
  ) values (tenant_a, draft_two, batch_a, 'south', 'line-2', 'group-2')
  returning id into bucket_two;
  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  ) values (tenant_a, draft_two, batch_a, row_a, bucket_two, 6);

  result := public.manual_shift_publish_demand_planning_draft(tenant_a, draft_two, shift_two);
  select sum(published_quantity) into published_total
  from public.demand_planning_published_allocations
  where raw_demand_row_id = row_a;
  if published_total <> 10 then
    raise exception 'DP-REM-3 FAIL: expected full quantity 10 after second shift, got %.', published_total;
  end if;

  insert into public.demand_planning_drafts (tenant_id, batch_id, source_scope)
  values (tenant_a, batch_a, 'remaining') returning id into draft_three;
  insert into public.demand_planning_buckets (
    tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name
  ) values (tenant_a, draft_three, batch_a, 'south', 'line-3', 'group-3')
  returning id into bucket_three;
  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  ) values (tenant_a, draft_three, batch_a, row_a, bucket_three, 1);

  begin
    result := public.manual_shift_publish_demand_planning_draft(tenant_a, draft_three, shift_two);
    raise exception 'DP-REM-4 FAIL: over-publish should have been blocked.';
  exception
    when raise_exception then
      if sqlerrm <> 'DEMAND_PLANNING_DEMAND_ALREADY_CONSUMED' then
        raise;
      end if;
  end;

  if (select status from public.demand_planning_drafts where id = draft_three) <> 'draft' then
    raise exception 'DP-REM-5 FAIL: blocked draft must remain mutable.';
  end if;

  begin
    result := public.manual_shift_publish_demand_planning_draft(tenant_a, draft_one, shift_two);
    raise exception 'DP-REM-6 FAIL: applied draft should remain immutable.';
  exception
    when raise_exception then
      if sqlerrm <> 'DEMAND_PLANNING_DRAFT_NOT_MUTABLE' then
        raise;
      end if;
  end;
end
$$;

rollback;
