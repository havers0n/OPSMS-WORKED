begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  shift_a uuid;
  batch_a uuid;
  draft_a uuid;
  bucket_a uuid;
  bucket_b uuid;
  bucket_c uuid;
  row_a uuid;
  row_b uuid;
  row_c uuid;
  row_d uuid;
  row_e uuid;
  row_f uuid;
  row_g uuid;
  row_h uuid;
  row_i uuid;
  row_j uuid;
  row_k uuid;
  result jsonb;
  v_created_lines integer;
  v_created_orders integer;
  v_created_items integer;
  v_skipped_rows integer;
  v_warnings jsonb;
  v_line_count integer;
  v_order_count integer;
  v_item_count integer;
  v_status text;
  v_order_ids uuid[];
begin
  insert into public.tenants (id, code, name)
  values (
    tenant_a,
    'DP-PUB-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
    'Demand Planning Publish To Shift'
  );

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    user_a, 'dp-publish@wos.test', now(), now(), now(), false, '{}', '{"display_name":"DP Publish Tester"}'
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
    tenant_a, date '2026-06-25', 'Publish Shift', 'active', user_a, 'DP Publish Tester'
  )
  returning id into shift_a;

  insert into public.demand_import_batches (
    tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count,
    warning_rows_count, error_rows_count, special_flow_rows_count,
    distribution_areas_count, distinct_orders_count, distinct_sku_count
  )
  values (
    tenant_a, 'test-demand.xlsx', 'DataSheet', 'ready',
    11, 11, 0, 1, 1, 2, 2, 5
  )
  returning id into batch_a;

  insert into public.demand_planning_drafts (
    tenant_id, batch_id, status
  )
  values (
    tenant_a, batch_a, 'draft'
  )
  returning id into draft_a;

  insert into public.demand_planning_buckets (
    tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order
  )
  values
    (tenant_a, draft_a, batch_a, 'דרום',  'קו א',  'דלי',        1),
    (tenant_a, draft_a, batch_a, 'דרום',  'קו א',  'סיגריות',   2),
    (tenant_a, draft_a, batch_a, 'צפון',  'קו ב',  'כללי',       3)
  returning id into bucket_a;

  select id into bucket_b from public.demand_planning_buckets
  where draft_id = draft_a and bucket_name = 'סיגריות';

  select id into bucket_c from public.demand_planning_buckets
  where draft_id = draft_a and bucket_name = 'כללי';

  -- Rows for testing
  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_a: happy path, customer + order
    (tenant_a, batch_a, 'DataSheet', 2, 'לקוח א', 'SO-1', 'SKU-1', 'Product 1', 'cat-a', 10, 'note 1',
     'דרום', date '2026-06-25', 'unplanned', 'pickup', 'regular')
    returning id into row_a;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_b: same customer/order as row_a, same bucket => should merge into same order
    (tenant_a, batch_a, 'DataSheet', 3, 'לקוח א', 'SO-1', 'SKU-2', 'Product 2', 'cat-b', 5, 'note 2',
     'דרום', date '2026-06-25', 'unplanned', 'pickup', 'regular')
    returning id into row_b;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_c: error row (will be skipped)
    (tenant_a, batch_a, 'DataSheet', 4, null, null, 'SKU-3', 'Product 3', 'cat-c', 7, 'note 3',
     'דרום', date '2026-06-25', 'error', 'unassigned', 'regular')
    returning id into row_c;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_d: special_flow row (will be skipped with warning)
    (tenant_a, batch_a, 'DataSheet', 5, 'לקוח ב', 'SO-3', 'SKU-4', 'Product 4', 'cat-d', 3, null,
     'דרום', date '2026-06-25', 'special_flow', 'pickup', 'regular')
    returning id into row_d;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_e: different date (will cause DATE_MISMATCH)
    (tenant_a, batch_a, 'DataSheet', 6, 'לקוח ג', 'SO-4', 'SKU-5', 'Product 5', 'cat-e', 2, null,
     'צפון', date '2026-06-26', 'unplanned', 'pickup', 'regular')
    returning id into row_e;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_f: different date 2 (for DATE_AMBIGUOUS test)
    (tenant_a, batch_a, 'DataSheet', 7, 'לקוח ד', 'SO-5', 'SKU-6', 'Product 6', 'cat-f', 1, null,
     'צפון', date '2026-06-27', 'unplanned', 'pickup', 'regular')
    returning id into row_f;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_g: null planned date with valid row (for mixed null/non-null test)
    (tenant_a, batch_a, 'DataSheet', 8, 'לקוח ה', 'SO-6', 'SKU-7', 'Product 7', 'cat-g', 4, null,
     'דרום', null, 'unplanned', 'pickup', 'regular')
    returning id into row_g;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_h: missing customerName and orderNumber, has SKU
    (tenant_a, batch_a, 'DataSheet', 9, null, null, 'SKU-A', 'Product A', 'cat-h', 3, null,
     'דרום', date '2026-06-25', 'unplanned', 'pickup', 'regular')
    returning id into row_h;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_i: missing customerName and orderNumber, different SKU from row_h
    (tenant_a, batch_a, 'DataSheet', 10, null, null, 'SKU-B', 'Product B', 'cat-i', 2, null,
     'דרום', date '2026-06-25', 'unplanned', 'pickup', 'regular')
    returning id into row_i;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_j: null SKU (will be skipped)
    (tenant_a, batch_a, 'DataSheet', 11, 'לקוח ו', 'SO-7', null, 'Product 9', 'cat-j', 5, null,
     'דרום', date '2026-06-25', 'unplanned', 'pickup', 'regular')
    returning id into row_j;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  )
  values
    -- row_k: zero/negative quantity allocation test aide
    (tenant_a, batch_a, 'DataSheet', 12, 'לקוח ז', 'SO-8', 'SKU-8', 'Product 8', 'cat-k', 8, null,
     'דרום', date '2026-06-25', 'unplanned', 'pickup', 'regular')
    returning id into row_k;

  -- ============================================================
  -- Test 1: Happy path — publish creates operational rows
  -- ============================================================
  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_a, bucket_a, 10);

  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_a, p_target_shift_id := shift_a
  );

  if result->>'draftId' <> draft_a::text then
    raise exception 'DP-PUB-1 FAIL: expected draft id in result.';
  end if;

  if (result->>'createdOrders')::integer <> 1 then
    raise exception 'DP-PUB-2 FAIL: expected 1 created order, got %.', result->>'createdOrders';
  end if;

  if (result->>'createdItems')::integer <> 1 then
    raise exception 'DP-PUB-3 FAIL: expected 1 created item, got %.', result->>'createdItems';
  end if;

  if (result->>'skippedRows')::integer <> 0 then
    raise exception 'DP-PUB-4 FAIL: expected 0 skipped rows, got %.', result->>'skippedRows';
  end if;

  select status into v_status from public.demand_planning_drafts where id = draft_a;
  if v_status <> 'applied' then
    raise exception 'DP-PUB-5 FAIL: draft should be applied, got %.', v_status;
  end if;

  -- verify source tracking on item
  select count(*) into v_item_count
  from public.manual_shift_order_items
  where shift_id = shift_a
    and source_rows = array[2]
    and source_sheet = 'DataSheet';

  if v_item_count <> 1 then
    raise exception 'DP-PUB-6 FAIL: item source tracking incorrect.';
  end if;

  -- Clean up for next tests
  delete from public.manual_shift_order_items where shift_id = shift_a;
  delete from public.manual_shift_order_events where shift_id = shift_a;
  delete from public.manual_shift_orders where shift_id = shift_a;
  delete from public.manual_shift_lines where shift_id = shift_a;
  update public.demand_planning_drafts set status = 'draft' where id = draft_a;

  -- ============================================================
  -- Test 2: Repeat publish blocked after applied
  -- ============================================================
  update public.demand_planning_drafts set status = 'applied' where id = draft_a;

  begin
    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_a, p_target_shift_id := shift_a
    );
    raise exception 'DP-PUB-7 FAIL: repeat publish should be blocked.';
  exception
    when raise_exception then
      if sqlerrm = 'DEMAND_PLANNING_DRAFT_NOT_MUTABLE' then
        null;
      else
        raise;
      end if;
  end;

  -- Reset draft for further tests
  update public.demand_planning_drafts set status = 'draft' where id = draft_a;

  -- ============================================================
  -- Test 3: Error rows are skipped
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_a, bucket_a, 10),
    (tenant_a, draft_a, batch_a, row_c, bucket_a, 7);

  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_a, p_target_shift_id := shift_a
  );

  if (result->>'skippedRows')::integer < 1 then
    raise exception 'DP-PUB-8 FAIL: error rows should be counted as skipped.';
  end if;

  select count(*) into v_order_count
  from public.manual_shift_orders where shift_id = shift_a;
  if v_order_count <> 1 then
    raise exception 'DP-PUB-9 FAIL: error row should not create an order.';
  end if;

  -- Verify row_c (error) data is NOT in any manual_shift_order_items
  if exists (
    select 1 from public.manual_shift_order_items
    where shift_id = shift_a and sku = 'SKU-3'
  ) then
    raise exception 'DP-PUB-10 FAIL: error row SKU leaked into operational items.';
  end if;

  -- Clean up
  delete from public.manual_shift_order_items where shift_id = shift_a;
  delete from public.manual_shift_order_events where shift_id = shift_a;
  delete from public.manual_shift_orders where shift_id = shift_a;
  delete from public.manual_shift_lines where shift_id = shift_a;
  update public.demand_planning_drafts set status = 'draft' where id = draft_a;

  -- ============================================================
  -- Test 4: Special flow rows skipped with warning
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_a, bucket_a, 10),
    (tenant_a, draft_a, batch_a, row_d, bucket_a, 3);

  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_a, p_target_shift_id := shift_a
  );

  select jsonb_array_length(result->'warnings') into v_created_items;
  if v_created_items < 1 then
    raise exception 'DP-PUB-11 FAIL: expected warnings for special_flow rows.';
  end if;

  if (result->>'skippedRows')::integer < 1 then
    raise exception 'DP-PUB-12 FAIL: special_flow rows should be counted as skipped.';
  end if;

  -- Verify row_d is NOT in manual_shift_order_items
  if exists (
    select 1 from public.manual_shift_order_items
    where shift_id = shift_a and sku = 'SKU-4'
  ) then
    raise exception 'DP-PUB-13 FAIL: special_flow row leaked into operational items.';
  end if;

  -- Clean up
  delete from public.manual_shift_order_items where shift_id = shift_a;
  delete from public.manual_shift_order_events where shift_id = shift_a;
  delete from public.manual_shift_orders where shift_id = shift_a;
  delete from public.manual_shift_lines where shift_id = shift_a;
  update public.demand_planning_drafts set status = 'draft' where id = draft_a;

  -- ============================================================
  -- Test 5: Date mismatch blocked
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_e, bucket_c, 2);

  begin
    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_a, p_target_shift_id := shift_a
    );
    raise exception 'DP-PUB-14 FAIL: date mismatch should be blocked.';
  exception
    when raise_exception then
      if sqlerrm = 'DATE_MISMATCH' then
        null;
      else
        raise;
      end if;
  end;

  -- Verify draft NOT applied
  select status into v_status from public.demand_planning_drafts where id = draft_a;
  if v_status <> 'draft' then
    raise exception 'DP-PUB-15 FAIL: draft should not be applied after DATE_MISMATCH.';
  end if;

  -- Verify no operational rows created
  select count(*) into v_order_count from public.manual_shift_orders where shift_id = shift_a;
  if v_order_count > 0 then
    raise exception 'DP-PUB-16 FAIL: no orders should be created after DATE_MISMATCH.';
  end if;

  -- ============================================================
  -- Test 6: Multiple dates blocked (DATE_AMBIGUOUS)
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_a, bucket_a, 10),   -- date 2026-06-25 (matches shift)
    (tenant_a, draft_a, batch_a, row_e, bucket_c, 2),    -- date 2026-06-26 (mismatch)
    (tenant_a, draft_a, batch_a, row_f, bucket_c, 1);    -- date 2026-06-27 (mismatch)

  begin
    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_a, p_target_shift_id := shift_a
    );
    raise exception 'DP-PUB-17 FAIL: DATE_AMBIGUOUS should block publish.';
  exception
    when raise_exception then
      if sqlerrm = 'DATE_AMBIGUOUS' then
        null;
      else
        raise;
      end if;
  end;

  select status into v_status from public.demand_planning_drafts where id = draft_a;
  if v_status <> 'draft' then
    raise exception 'DP-PUB-18 FAIL: draft should not be applied after DATE_AMBIGUOUS.';
  end if;

  -- ============================================================
  -- Test 7: Mixed null/non-null dates — success with warning
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_a, bucket_a, 10),   -- date 2026-06-25 (matches shift)
    (tenant_a, draft_a, batch_a, row_g, bucket_a, 4);    -- null date

  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_a, p_target_shift_id := shift_a
  );

  -- Should have succeeded
  if result->>'createdOrders' is null then
    raise exception 'DP-PUB-19 FAIL: publish with mixed dates should succeed.';
  end if;

  -- Should have a warning about mixed null dates
  if (result->'warnings')::text not like '%null%' then
    raise exception 'DP-PUB-20 FAIL: expected warning about null planned delivery dates, got %.', result->'warnings';
  end if;

  select status into v_status from public.demand_planning_drafts where id = draft_a;
  if v_status <> 'applied' then
    raise exception 'DP-PUB-21 FAIL: draft should be applied after mixed-date publish.';
  end if;

  -- Clean up
  delete from public.manual_shift_order_items where shift_id = shift_a;
  delete from public.manual_shift_order_events where shift_id = shift_a;
  delete from public.manual_shift_orders where shift_id = shift_a;
  delete from public.manual_shift_lines where shift_id = shift_a;
  update public.demand_planning_drafts set status = 'draft' where id = draft_a;

  -- ============================================================
  -- Test 8: Missing customerName/orderNumber — rows do not merge incorrectly
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_h, bucket_a, 3),   -- null customer, null order, SKU-A
    (tenant_a, draft_a, batch_a, row_i, bucket_a, 2);   -- null customer, null order, SKU-B

  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_a, p_target_shift_id := shift_a
  );

  -- Should create TWO separate orders, not merge them into one
  if (result->>'createdOrders')::integer <> 2 then
    raise exception 'DP-PUB-22 FAIL: expected 2 separate orders for rows without customer/order, got %.', result->>'createdOrders';
  end if;

  select status into v_status from public.demand_planning_drafts where id = draft_a;
  if v_status <> 'applied' then
    raise exception 'DP-PUB-23 FAIL: draft should be applied.';
  end if;

  -- Clean up
  delete from public.manual_shift_order_items where shift_id = shift_a;
  delete from public.manual_shift_order_events where shift_id = shift_a;
  delete from public.manual_shift_orders where shift_id = shift_a;
  delete from public.manual_shift_lines where shift_id = shift_a;
  update public.demand_planning_drafts set status = 'draft' where id = draft_a;

  -- ============================================================
  -- Test 9: Raw rows remain immutable after publish
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_a, bucket_a, 10);

  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_a, p_target_shift_id := shift_a
  );

  -- Verify raw demand row data unchanged
  if not exists (
    select 1 from public.raw_demand_rows
    where id = row_a
      and sku = 'SKU-1'
      and customer_name = 'לקוח א'
      and order_number = 'SO-1'
      and quantity = 10
      and planning_status = 'unplanned'
  ) then
    raise exception 'DP-PUB-24 FAIL: raw demand row mutated after publish.';
  end if;

  -- Clean up
  delete from public.manual_shift_order_items where shift_id = shift_a;
  delete from public.manual_shift_order_events where shift_id = shift_a;
  delete from public.manual_shift_orders where shift_id = shift_a;
  delete from public.manual_shift_lines where shift_id = shift_a;
  update public.demand_planning_drafts set status = 'draft' where id = draft_a;

  -- ============================================================
  -- Test 10: NO_PUBLISHABLE_ROWS when all rows are filtered out
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  -- Only allocate the error row (row_c) — nothing publishable
  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_c, bucket_a, 7);

  begin
    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_a, p_target_shift_id := shift_a
    );
    raise exception 'DP-PUB-25 FAIL: NO_PUBLISHABLE_ROWS should block publish.';
  exception
    when raise_exception then
      if sqlerrm = 'NO_PUBLISHABLE_ROWS' then
        null;
      else
        raise;
      end if;
  end;

  -- Verify draft NOT applied
  select status into v_status from public.demand_planning_drafts where id = draft_a;
  if v_status <> 'draft' then
    raise exception 'DP-PUB-26 FAIL: draft should not be applied when no publishable rows.';
  end if;

  -- ============================================================
  -- Test 11: Direct RPC cannot inject arbitrary data (no allocations scenario)
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  -- Call RPC with a draft that has NO allocations at all
  begin
    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_a, p_target_shift_id := shift_a
    );
    raise exception 'DP-PUB-27 FAIL: publish without allocations should raise NO_PUBLISHABLE_ROWS.';
  exception
    when raise_exception then
      if sqlerrm = 'NO_PUBLISHABLE_ROWS' then
        null;
      else
        raise;
      end if;
  end;

  -- No operational rows should exist
  select count(*) into v_order_count from public.manual_shift_orders where shift_id = shift_a;
  if v_order_count > 0 then
    raise exception 'DP-PUB-28 FAIL: no operational rows should exist when RPC has no allocations.';
  end if;

  -- Draft unchanged
  select status into v_status from public.demand_planning_drafts where id = draft_a;
  if v_status <> 'draft' then
    raise exception 'DP-PUB-29 FAIL: draft should remain unchanged.';
  end if;

  -- ============================================================
  -- Test 12: Null SKU rows skipped
  -- ============================================================
  delete from public.demand_planning_allocations where draft_id = draft_a;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  )
  values
    (tenant_a, draft_a, batch_a, row_j, bucket_a, 5);

  begin
    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_a, p_target_shift_id := shift_a
    );
    raise exception 'DP-PUB-30 FAIL: null SKU rows should cause NO_PUBLISHABLE_ROWS.';
  exception
    when raise_exception then
      if sqlerrm = 'NO_PUBLISHABLE_ROWS' then
        null;
      else
        raise;
      end if;
  end;

end
$$;

rollback;
