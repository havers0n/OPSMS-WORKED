begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  shift_a uuid;
  batch_a uuid;

  draft_one uuid;
  draft_two uuid;
  draft_three uuid;
  draft_four uuid;

  bucket_one uuid;
  bucket_two uuid;
  bucket_three uuid;
  bucket_four uuid;

  row_one uuid;
  row_two uuid;
  row_three uuid;

  result jsonb;
  pub_one_id uuid;
  pub_two_id uuid;
  pub_three_id uuid;

  order_one_id uuid;
  order_two_id uuid;
  order_three_id uuid;

  v_status text;
  v_order_status text;
  v_pub_status text;
  v_draft_status text;
  v_pub_count integer;
  v_order_count integer;
  v_order_ids uuid[];
  v_line_id uuid;
  v_publication_id uuid;
  worker_a uuid;
begin
  -- ============================================================
  -- Phase 0: Setup
  -- ============================================================
  insert into public.tenants (id, code, name)
  values (tenant_a, 'DP-APND-' || left(replace(gen_random_uuid()::text, '-', ''), 8), 'Demand Planning Append');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  ) values (
    user_a, 'dp-append@wos.test', now(), now(), now(), false, '{}', '{"display_name":"DP Append Tester"}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, user_a, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update
  set role = excluded.role;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- Shift (active)
  insert into public.manual_shift_sessions (
    tenant_id, date, name, status, created_by_profile_id, created_by_name
  ) values (
    tenant_a, date '2026-06-25', 'Append Shift', 'active', user_a, 'DP Append Tester'
  ) returning id into shift_a;

  -- Worker (needed for picking FK)
  insert into public.manual_shift_workers (tenant_id, shift_id, name, role)
  values (tenant_a, shift_a, 'Picker A', 'picker')
  returning id into worker_a;

  -- Batch
  insert into public.demand_import_batches (
    tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count,
    warning_rows_count, error_rows_count, special_flow_rows_count,
    distribution_areas_count, distinct_orders_count, distinct_sku_count
  ) values (
    tenant_a, 'append-demand.xlsx', 'DataSheet', 'ready',
    3, 3, 0, 0, 0, 1, 3, 3
  ) returning id into batch_a;

  -- Raw demand rows (3 distinct orders, all unplanned, date matching shift)
  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  ) values (
    tenant_a, batch_a, 'DataSheet', 2, 'לקוח א', 'SO-1', 'SKU-1', 'Product 1', 'cat-a', 10, null,
    'דרום', date '2026-06-25', 'unplanned', 'pickup', 'regular'
  ) returning id into row_one;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  ) values (
    tenant_a, batch_a, 'DataSheet', 3, 'לקוח ב', 'SO-2', 'SKU-2', 'Product 2', 'cat-b', 5, null,
    'דרום', date '2026-06-25', 'unplanned', 'pickup', 'regular'
  ) returning id into row_two;

  insert into public.raw_demand_rows (
    tenant_id, batch_id, source_sheet, source_row_number,
    customer_name, order_number, sku, description, category, quantity, notes,
    distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow
  ) values (
    tenant_a, batch_a, 'DataSheet', 4, 'לקוח ג', 'SO-3', 'SKU-3', 'Product 3', 'cat-c', 8, null,
    'דרום', date '2026-06-25', 'unplanned', 'pickup', 'regular'
  ) returning id into row_three;

  -- ============================================================
  -- Draft 1: first publication (will become the "old order" in picking)
  -- ============================================================
  insert into public.demand_planning_drafts (tenant_id, batch_id, status)
  values (tenant_a, batch_a, 'draft') returning id into draft_one;

  insert into public.demand_planning_buckets (
    tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, bucket_kind, sort_order
  ) values (
    tenant_a, draft_one, batch_a, 'דרום', 'קו א', 'סיגריות', 'work_group', 1
  ) returning id into bucket_one;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  ) values (
    tenant_a, draft_one, batch_a, row_one, bucket_one, 10
  );

  -- ============================================================
  -- Draft 2: second publication (append — new demand into same shift)
  -- ============================================================
  insert into public.demand_planning_drafts (tenant_id, batch_id, status)
  values (tenant_a, batch_a, 'draft') returning id into draft_two;

  insert into public.demand_planning_buckets (
    tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, bucket_kind, sort_order
  ) values (
    tenant_a, draft_two, batch_a, 'דרום', 'קו א', 'סיגריות', 'work_group', 1
  ) returning id into bucket_two;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  ) values (
    tenant_a, draft_two, batch_a, row_two, bucket_two, 5
  );

  -- ============================================================
  -- Draft 3: third publication (for blocked-revert-after-work test)
  -- ============================================================
  insert into public.demand_planning_drafts (tenant_id, batch_id, status)
  values (tenant_a, batch_a, 'draft') returning id into draft_three;

  insert into public.demand_planning_buckets (
    tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, bucket_kind, sort_order
  ) values (
    tenant_a, draft_three, batch_a, 'דרום', 'קו א', 'סיגריות', 'work_group', 1
  ) returning id into bucket_three;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  ) values (
    tenant_a, draft_three, batch_a, row_three, bucket_three, 8
  );

  -- ============================================================
  -- Draft 4: duplicate/over-publish test (same row_one already consumed)
  -- ============================================================
  insert into public.demand_planning_drafts (tenant_id, batch_id, status)
  values (tenant_a, batch_a, 'draft') returning id into draft_four;

  insert into public.demand_planning_buckets (
    tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, bucket_kind, sort_order
  ) values (
    tenant_a, draft_four, batch_a, 'דרום', 'קו א', 'סיגריות', 'work_group', 1
  ) returning id into bucket_four;

  insert into public.demand_planning_allocations (
    tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity
  ) values (
    tenant_a, draft_four, batch_a, row_one, bucket_four, 5
  );

  -- ============================================================
  -- Phase 1: Publish first draft (creates the "old" order)
  -- ============================================================
  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_one, p_target_shift_id := shift_a
  );

  pub_one_id := result->>'publicationId';

  if pub_one_id is null then
    raise exception 'DP-APND-01 FAIL: first publish must return publicationId.';
  end if;

  if (result->>'createdOrders')::integer <> 1 then
    raise exception 'DP-APND-02 FAIL: first publish expected 1 order, got %.', result->>'createdOrders';
  end if;

  if (result->>'createdLines')::integer <> 1 then
    raise exception 'DP-APND-03 FAIL: first publish expected 1 line, got %.', result->>'createdLines';
  end if;

  -- Capture the order ID
  select id into order_one_id
  from public.manual_shift_orders
  where shift_id = shift_a and deleted_at is null
  limit 1;

  if order_one_id is null then
    raise exception 'DP-APND-04 FAIL: first publish must create an order.';
  end if;

  -- Verify order_one is queued initially
  select status into v_order_status
  from public.manual_shift_orders
  where id = order_one_id;

  if v_order_status <> 'queued' then
    raise exception 'DP-APND-05 FAIL: first order must start as queued, got %.', v_order_status;
  end if;

  -- ============================================================
  -- Phase 1b: Simulate work — mark order_one as picking
  -- ============================================================
  update public.manual_shift_orders
  set status = 'picking',
      picker_name = 'Picker A',
      picker_worker_id = worker_a,
      started_at = timezone('utc', now())
  where id = order_one_id;

  -- Verify order_one is now picking
  select status into v_order_status
  from public.manual_shift_orders
  where id = order_one_id;

  if v_order_status <> 'picking' then
    raise exception 'DP-APND-06 FAIL: order_one must be picking after update, got %.', v_order_status;
  end if;

  -- ============================================================
  -- Phase 1c: Publish second draft into same shift (APPEND)
  -- ============================================================
  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_two, p_target_shift_id := shift_a
  );

  pub_two_id := result->>'publicationId';

  if pub_two_id is null then
    raise exception 'DP-APND-07 FAIL: append publish must return publicationId.';
  end if;

  -- Assert new publication has its own publication_id (different from first)
  if pub_two_id = pub_one_id then
    raise exception 'DP-APND-08 FAIL: append publication must have different publicationId from first.';
  end if;

  if (result->>'createdOrders')::integer <> 1 then
    raise exception 'DP-APND-09 FAIL: append publish expected 1 order, got %.', result->>'createdOrders';
  end if;

  if (result->>'reusedLines')::integer <> 1 then
    raise exception 'DP-APND-10 FAIL: append publish must reuse existing line, got createdLines=%.', result->>'createdLines';
  end if;

  -- Capture the new order
  select id into order_two_id
  from public.manual_shift_orders
  where shift_id = shift_a
    and id <> order_one_id
    and deleted_at is null
  limit 1;

  if order_two_id is null then
    raise exception 'DP-APND-11 FAIL: append publish must create a second order.';
  end if;

  -- ============================================================
  -- Phase 1d: Verify old order unchanged + new order queued
  -- ============================================================
  -- Old order must still be picking
  select status into v_order_status
  from public.manual_shift_orders
  where id = order_one_id;

  if v_order_status <> 'picking' then
    raise exception 'DP-APND-12 FAIL: old order must remain picking after append, got %.', v_order_status;
  end if;

  -- Old order must have picker assigned
  select picker_name into v_order_status
  from public.manual_shift_orders
  where id = order_one_id;

  if v_order_status is null then
    raise exception 'DP-APND-13 FAIL: old order must retain picker after append.';
  end if;

  -- New order must be queued
  select status into v_order_status
  from public.manual_shift_orders
  where id = order_two_id;

  if v_order_status <> 'queued' then
    raise exception 'DP-APND-14 FAIL: new order must be queued after append, got %.', v_order_status;
  end if;

  -- Verify ledger rows exist for both publications
  select count(*) into v_pub_count
  from public.demand_planning_published_allocations
  where target_shift_id = shift_a
    and tenant_id = tenant_a;

  if v_pub_count <> 2 then
    raise exception 'DP-APND-15 FAIL: expected 2 ledger rows (one per publication), got %.', v_pub_count;
  end if;

  -- Verify both publications exist with 'applied' status
  select count(*) into v_pub_count
  from public.demand_planning_publications
  where target_shift_id = shift_a
    and status = 'applied';

  if v_pub_count <> 2 then
    raise exception 'DP-APND-16 FAIL: expected 2 applied publications, got %.', v_pub_count;
  end if;

  -- ============================================================
  -- Phase 2: Revert second publication while old order is picking
  -- ============================================================
  result := public.demand_planning_revert_publication(
    tenant_a, pub_two_id
  );

  if (result->>'revertedOrders')::integer <> 1 then
    raise exception 'DP-APND-17 FAIL: revert must clean 1 order, got %.', result->>'revertedOrders';
  end if;

  -- Old order must still exist and be picking
  select status into v_order_status
  from public.manual_shift_orders
  where id = order_one_id and deleted_at is null;

  if v_order_status <> 'picking' then
    raise exception 'DP-APND-18 FAIL: old order must remain picking after revert, got %.', v_order_status;
  end if;

  -- New order must be soft-deleted
  select count(*) into v_pub_count
  from public.manual_shift_orders
  where id = order_two_id and deleted_at is not null;

  if v_pub_count <> 1 then
    raise exception 'DP-APND-19 FAIL: reverted order must be soft-deleted.';
  end if;

  -- Second publication must be marked reverted
  select status into v_pub_status
  from public.demand_planning_publications
  where id = pub_two_id;

  if v_pub_status <> 'reverted' then
    raise exception 'DP-APND-20 FAIL: second publication must be reverted, got %.', v_pub_status;
  end if;

  -- Draft two must be reopened
  select status into v_draft_status
  from public.demand_planning_drafts
  where id = draft_two;

  if v_draft_status <> 'draft' then
    raise exception 'DP-APND-21 FAIL: reverted draft must be reopened, got %.', v_draft_status;
  end if;

  -- ============================================================
  -- Phase 3: Verify revert blocked after new publication's own order starts work
  -- ============================================================
  -- Publish draft three (fresh demand)
  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_three, p_target_shift_id := shift_a
  );

  pub_three_id := result->>'publicationId';

  if pub_three_id is null then
    raise exception 'DP-APND-22 FAIL: third publish must return publicationId.';
  end if;

  -- Capture the order created by draft three
  select id into order_three_id
  from public.manual_shift_orders
  where shift_id = shift_a
    and id not in (order_one_id, order_two_id)
    and deleted_at is null
  limit 1;

  if order_three_id is null then
    raise exception 'DP-APND-23 FAIL: third publish must create an order.';
  end if;

  -- Mark order_three as picking (simulating work on the NEW publication's order)
  update public.manual_shift_orders
  set status = 'picking',
      picker_name = 'Picker A',
      picker_worker_id = worker_a,
      started_at = timezone('utc', now())
  where id = order_three_id;

  -- Verify revert of third publication is blocked
  begin
    result := public.demand_planning_revert_publication(
      tenant_a, pub_three_id
    );
    raise exception 'DP-APND-24 FAIL: revert should be blocked when publication orders have activity.';
  exception
    when raise_exception then
      if sqlerrm = 'DEMAND_PLANNING_PUBLISHED_SHIFT_HAS_ACTIVITY' then
        null;
      else
        raise;
      end if;
  end;

  -- Verify publication still applied
  select status into v_pub_status
  from public.demand_planning_publications
  where id = pub_three_id;

  if v_pub_status <> 'applied' then
    raise exception 'DP-APND-25 FAIL: publication must remain applied after blocked revert, got %.', v_pub_status;
  end if;

  -- Verify third draft still applied
  select status into v_draft_status
  from public.demand_planning_drafts
  where id = draft_three;

  if v_draft_status <> 'applied' then
    raise exception 'DP-APND-26 FAIL: draft must remain applied after blocked revert, got %.', v_draft_status;
  end if;

  -- ============================================================
  -- Phase 4: Duplicate/over-publish of already consumed raw demand is blocked
  -- ============================================================
  begin
    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_four, p_target_shift_id := shift_a
    );
    raise exception 'DP-APND-27 FAIL: over-publish of consumed demand should be blocked.';
  exception
    when raise_exception then
      if sqlerrm = 'DEMAND_PLANNING_DEMAND_ALREADY_CONSUMED' then
        null;
      else
        raise;
      end if;
  end;

  -- Verify draft_four still mutable (not applied)
  select status into v_draft_status
  from public.demand_planning_drafts
  where id = draft_four;

  if v_draft_status <> 'draft' then
    raise exception 'DP-APND-28 FAIL: blocked draft must remain draft, got %.', v_draft_status;
  end if;

  -- ============================================================
  -- All assertions passed
  -- ============================================================
end
$$;

rollback;
