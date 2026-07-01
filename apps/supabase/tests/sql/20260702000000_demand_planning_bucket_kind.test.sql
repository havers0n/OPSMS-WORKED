-- PR-1.1: Test bucket_kind migration behavior

do $$
declare
  v_tenant_id uuid := '00000000-0000-4000-8000-000000000001';
  v_user_id uuid := '00000000-0000-4000-8000-000000000002';
  v_draft_id uuid;
  v_batch_id uuid;
  v_bucket_id uuid;
  v_bucket_kind text;
  v_shift_id uuid;
  v_pub_result jsonb;
begin
  -- ============================================================
  -- Setup: tenant, auth user, profile, tenant_members
  -- ============================================================
  insert into public.tenants (id, code, name)
  values (v_tenant_id, 'PR11-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'PR-1.1 test tenant')
  on conflict (id) do nothing;

  insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, is_sso_user, raw_app_meta_data, raw_user_meta_data)
  values (v_user_id, 'pr11@wos.test', now(), now(), now(), false, '{}', '{}')
  on conflict (id) do nothing;

  insert into public.profiles (id, email, role)
  values (v_user_id, 'pr11@wos.test', 'admin')
  on conflict (id) do nothing;

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (v_tenant_id, v_user_id, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_id::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- ============================================================
  -- Test objects: batch, draft, raw rows, shift
  -- ============================================================
  insert into public.demand_import_batches (tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count, distribution_areas_count, distinct_orders_count, distinct_sku_count)
  values (v_tenant_id, 'pr11.xlsx', 'Sheet1', 'ready', 1, 1, 1, 1, 1)
  returning id into v_batch_id;

  insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
  values (v_tenant_id, v_batch_id, 'draft', 'batch')
  returning id into v_draft_id;

  insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
  values (v_tenant_id, v_batch_id, 'Sheet1', 1, 'Cust', 'ORD-1', 'SKU-1', 100, 'North', date '2026-07-15', 'unplanned', 'pickup', 'regular');

  insert into public.manual_shift_sessions (tenant_id, date, name, status, created_by_profile_id, created_by_name)
  values (v_tenant_id, date '2026-07-15', 'PR-1.1 Shift', 'active', v_user_id, 'PR-1.1 Tester')
  returning id into v_shift_id;

  -- ============================================================
  -- Test 1: technical_unassigned and work_group are valid bucket_kind values
  -- ============================================================
  insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, planning_line_name, bucket_name, bucket_kind, sort_order)
  values (v_tenant_id, v_draft_id, v_batch_id, 'default', 'unassigned', 'technical_unassigned', 1)
  returning id into v_bucket_id;

  select bucket_kind into v_bucket_kind
  from public.demand_planning_buckets
  where id = v_bucket_id;

  if v_bucket_kind <> 'technical_unassigned' then
    raise exception 'BK-10 FAIL: expected technical_unassigned, got %', v_bucket_kind;
  end if;

  -- ============================================================
  -- Test 2: work_group value is stored and readable
  -- ============================================================
  insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, planning_line_name, bucket_name, bucket_kind, sort_order)
  values (v_tenant_id, v_draft_id, v_batch_id, 'Line A', 'Group 1', 'work_group', 2)
  returning id into v_bucket_id;

  select bucket_kind into v_bucket_kind
  from public.demand_planning_buckets
  where id = v_bucket_id;

  if v_bucket_kind <> 'work_group' then
    raise exception 'BK-20 FAIL: expected work_group, got %', v_bucket_kind;
  end if;

  -- ============================================================
  -- Test 3: CHECK constraint rejects invalid bucket_kind
  -- ============================================================
  begin
    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, planning_line_name, bucket_name, bucket_kind, sort_order)
    values (v_tenant_id, v_draft_id, v_batch_id, 'Line B', 'Group 2', 'invalid_kind', 3);
    raise exception 'BK-30 FAIL: CHECK constraint should reject invalid bucket_kind';
  exception
    when check_violation then
      -- expected
  end;

  -- ============================================================
  -- Test 4: NOT NULL constraint is enforced
  -- ============================================================
  begin
    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, planning_line_name, bucket_name, sort_order)
    values (v_tenant_id, v_draft_id, v_batch_id, 'Line C', 'Group 3', 4);
    raise exception 'BK-40 FAIL: NOT NULL constraint should reject missing bucket_kind';
  exception
    when not_null_violation then
      -- expected
  end;

  -- ============================================================
  -- Test 5: Default/unassigned uses technical_unassigned
  -- ============================================================
  insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, planning_line_name, bucket_name, bucket_kind, sort_order)
  values (v_tenant_id, v_draft_id, null, 'default', 'unassigned', 'technical_unassigned', 5)
  returning id into v_bucket_id;

  select bucket_kind into v_bucket_kind
  from public.demand_planning_buckets
  where id = v_bucket_id;

  if v_bucket_kind <> 'technical_unassigned' then
    raise exception 'BK-50 FAIL: expected technical_unassigned, got %', v_bucket_kind;
  end if;

  -- ============================================================
  -- Test 6: Technical bucket with zero allocations does NOT block publish
  --          Only buckets with allocated_quantity > 0 are rejected.
  -- ============================================================
  declare
    v_ok_draft uuid;
    v_ok_bucket uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
    values (v_tenant_id, v_batch_id, 'draft', 'batch')
    returning id into v_ok_draft;

    -- technical_unassigned bucket (no allocation assigned to it)
    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, planning_line_name, bucket_name, bucket_kind, sort_order)
    values (v_tenant_id, v_ok_draft, v_batch_id, 'default', 'unassigned', 'technical_unassigned', 1)
    returning id into v_ok_bucket;

    -- Work-group bucket with allocation
    declare
      v_wg_bucket uuid;
      v_row_id uuid;
    begin
      insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
      values (v_tenant_id, v_batch_id, 'Sheet1', 2, 'Cust OK', 'ORD-OK', 'SKU-OK', 10, 'North', date '2026-07-15', 'unplanned', 'pickup', 'regular')
      returning id into v_row_id;

      insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, planning_line_name, bucket_name, bucket_kind, sort_order)
      values (v_tenant_id, v_ok_draft, v_batch_id, 'Line OK', 'Group OK', 'work_group', 2)
      returning id into v_wg_bucket;

      insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
      values (v_tenant_id, v_ok_draft, v_batch_id, v_row_id, v_wg_bucket, 5);

      -- This should succeed: the technical_unassigned bucket exists but has zero allocations.
      v_pub_result := public.manual_shift_publish_demand_planning_draft(
        v_tenant_id, v_ok_draft, v_shift_id
      );

      if v_pub_result->>'publicationId' is null then
        raise exception 'BK-60 FAIL: publish with zero-allocation technical bucket should succeed';
      end if;
    end;
  end;

  -- ============================================================
  -- Test 7: Technical bucket with positive allocation BLOCKS publish
  -- ============================================================
  declare
    v_block_draft uuid;
    v_block_bucket uuid;
    v_block_row_id uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
    values (v_tenant_id, v_batch_id, 'draft', 'batch')
    returning id into v_block_draft;

    -- technical_unassigned bucket that WILL receive a positive allocation
    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, planning_line_name, bucket_name, bucket_kind, sort_order)
    values (v_tenant_id, v_block_draft, v_batch_id, 'default', 'unassigned', 'technical_unassigned', 1)
    returning id into v_block_bucket;

    insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
    values (v_tenant_id, v_batch_id, 'Sheet1', 3, 'Cust Block', 'ORD-BLOCK', 'SKU-BLOCK', 10, 'North', date '2026-07-15', 'unplanned', 'pickup', 'regular')
    returning id into v_block_row_id;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (v_tenant_id, v_block_draft, v_batch_id, v_block_row_id, v_block_bucket, 5);

    -- This should fail: the technical_unassigned bucket has a positive allocation
    begin
      v_pub_result := public.manual_shift_publish_demand_planning_draft(
        v_tenant_id, v_block_draft, v_shift_id
      );
      raise exception 'BK-70 FAIL: publish with positive technical allocation should be blocked';
    exception
      when raise_exception then
        if sqlerrm <> 'DRAFT_HAS_UNASSIGNED_ALLOCATIONS' then
          raise;
        end if;
    end;
  end;

  raise notice 'PR-1.1 bucket_kind tests passed.';
end;
$$;
