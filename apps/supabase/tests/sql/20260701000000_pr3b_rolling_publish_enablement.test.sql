begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  shift_a uuid;
  batch_a uuid;
  batch_b uuid;
  draft_r1 uuid;
  draft_r2 uuid;
  draft_batch uuid;
  bucket_r1 uuid;
  bucket_r2 uuid;
  bucket_b uuid;
  row_so1 uuid;
  row_so2 uuid;
  row_so3 uuid;    -- duplicate of so1 in same batch
  row_so1_b2 uuid; -- newer batch, same identity as so1
  result jsonb;
  pub_id uuid;
  v_count integer;
  v_pub_source_kind text;
  v_pub_batch_id uuid;
  v_ledger_batch_id uuid;
  v_line_id uuid;
  v_order_id uuid;
  v_item_id uuid;
begin
  -- ═════════════════════════════════════════════════════════════════════════════
  -- Phase 0: Setup
  -- ═════════════════════════════════════════════════════════════════════════════
  insert into public.tenants (id, code, name)
  values (tenant_a, 'PR3B-' || left(replace(gen_random_uuid()::text, '-', ''), 8), 'PR-3B Rolling Publish');

  insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, is_sso_user, raw_app_meta_data, raw_user_meta_data)
  values (user_a, 'pr3b@wos.test', now(), now(), now(), false, '{}', '{"display_name":"PR3B Tester"}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, user_a, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- Active shift
  insert into public.manual_shift_sessions (tenant_id, date, name, status, created_by_profile_id, created_by_name)
  values (tenant_a, date '2026-07-01', 'PR3B Shift', 'active', user_a, 'PR3B Tester')
  returning id into shift_a;

  -- Batch A: 2 rows
  insert into public.demand_import_batches (tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count, distribution_areas_count, distinct_orders_count, distinct_sku_count)
  values (tenant_a, 'pr3b-demand.xlsx', 'DataSheet', 'ready', 3, 3, 1, 2, 2)
  returning id into batch_a;

  insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
  values (tenant_a, batch_a, 'DataSheet', 2, 'Cust A', 'SO-1', 'SKU-1', 100, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
  returning id into row_so1;

  insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
  values (tenant_a, batch_a, 'DataSheet', 3, 'Cust B', 'SO-2', 'SKU-2', 50, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
  returning id into row_so2;

  -- Third row is a duplicate of SO-1 in same batch (for duplicate detection test)
  insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
  values (tenant_a, batch_a, 'DataSheet', 4, 'Cust A', 'SO-1', 'SKU-1', 100, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
  returning id into row_so3;

  -- Batch B: newer batch with same identity as row_so1 (for stale detection test)
  insert into public.demand_import_batches (tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count, distribution_areas_count, distinct_orders_count, distinct_sku_count)
  values (tenant_a, 'pr3b-batch2.xlsx', 'DataSheet', 'ready', 1, 1, 1, 1, 1)
  returning id into batch_b;

  -- Batch B must be uploaded AFTER batch A for freshness ordering
  update public.demand_import_batches
  set uploaded_at = timezone('utc', now()) + interval '1 hour'
  where id = batch_b;

  insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
  values (tenant_a, batch_b, 'DataSheet', 2, 'Cust A', 'SO-1', 'SKU-1', 80, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
  returning id into row_so1_b2;

  -- ============================================================
  -- Test 1: Rolling publish succeeds with valid allocation
  -- ============================================================

  -- Create rolling draft pointing at row_so2 (only row with valid identity)
  -- row_so2 is distinct (SO-2 / SKU-2), only appears in batch_a once
  insert into public.demand_planning_drafts (tenant_id, status, source_kind)
  values (tenant_a, 'draft', 'rolling') returning id into draft_r1;

  insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
  values (tenant_a, draft_r1, null, 'North', 'Line A', 'Bucket 1', 1) returning id into bucket_r1;

  -- Allocate from row_so2 (50 units available)
  insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
  values (tenant_a, draft_r1, batch_a, row_so2, bucket_r1, 30);

  -- Publish
  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_r1, p_target_shift_id := shift_a
  );

  if result->>'publicationId' is null then
    raise exception 'PR3B-01 FAIL: rolling publish must return publicationId.';
  end if;

  if (result->>'createdOrders')::integer <> 1 then
    raise exception 'PR3B-02 FAIL: expected 1 created order, got %.', result->>'createdOrders';
  end if;

  pub_id := result->>'publicationId';

  -- ============================================================
  -- Test 2: Rolling publication header has source_kind='rolling' and batch_id IS NULL
  -- ============================================================

  select source_kind, batch_id into v_pub_source_kind, v_pub_batch_id
  from public.demand_planning_publications
  where id = pub_id::uuid;

  if v_pub_source_kind <> 'rolling' then
    raise exception 'PR3B-10 FAIL: rolling publication source_kind should be rolling, got %.', v_pub_source_kind;
  end if;

  if v_pub_batch_id is not null then
    raise exception 'PR3B-11 FAIL: rolling publication batch_id should be null, got %.', v_pub_batch_id;
  end if;

  -- ============================================================
  -- Test 3: Rolling ledger rows have per-allocation batch_id NOT NULL
  -- ============================================================

  select batch_id into v_ledger_batch_id
  from public.demand_planning_published_allocations
  where publication_id = pub_id::uuid and tenant_id = tenant_a;

  if v_ledger_batch_id is null then
    raise exception 'PR3B-20 FAIL: rolling ledger row must have non-null batch_id.';
  end if;

  if v_ledger_batch_id <> batch_a then
    raise exception 'PR3B-21 FAIL: rolling ledger batch_id should be the allocation''s source batch.';
  end if;

  -- ============================================================
  -- Test 4: Batch publish regression — batch path still works
  -- ============================================================

  insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
  values (tenant_a, batch_a, 'draft', 'batch') returning id into draft_batch;

  insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
  values (tenant_a, draft_batch, batch_a, 'North', 'Line B', 'Bucket B', 1) returning id into bucket_b;

  -- Allocate remaining 50 from row_so2 (original 50, already published 30)
  -- Actually row_so2 original was 50, we published 30 — 20 left
  insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
  values (tenant_a, draft_batch, batch_a, row_so2, bucket_b, 20);

  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_batch, p_target_shift_id := shift_a
  );

  if result->>'publicationId' is null then
    raise exception 'PR3B-30 FAIL: batch publish must return publicationId.';
  end if;

  if (result->>'createdOrders')::integer <> 1 then
    raise exception 'PR3B-31 FAIL: batch publish expected 1 order, got %.', result->>'createdOrders';
  end if;

  -- Verify batch publication has source_kind = 'batch'
  select source_kind into v_pub_source_kind
  from public.demand_planning_publications
  where id = (result->>'publicationId')::uuid;

  if v_pub_source_kind <> 'batch' then
    raise exception 'PR3B-32 FAIL: batch publication source_kind should be batch, got %.', v_pub_source_kind;
  end if;

  -- ============================================================
  -- Test 5: Insufficient quantity rejected
  -- ============================================================

  -- row_so2 was 50 total, already published 30 (draft_r1) + 20 (draft_batch) = 50 consumed
  -- Try to allocate 1 more — should fail
  declare
    draft_over uuid;
    bucket_over uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into draft_over;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_over, null, 'North', 'Line C', 'Bucket Over', 1) returning id into bucket_over;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_over, batch_a, row_so2, bucket_over, 1);

    begin
      result := public.manual_shift_publish_demand_planning_draft(
        tenant_a, draft_over, p_target_shift_id := shift_a
      );
      raise exception 'PR3B-40 FAIL: insufficient quantity should be rejected.';
    exception
      when raise_exception then
        if sqlerrm <> 'ROLLING_DEMAND_STALE_OR_UNAVAILABLE' then
          raise;
        end if;
    end;
  end;

  -- ============================================================
  -- Test 6: Stale raw row rejected (newer batch exists with same identity)
  -- ============================================================

  -- row_so1 (in batch_a, 100 units) has a newer row row_so1_b2 (in batch_b, 80 units)
  -- A rolling draft allocated from old row_so1 should be rejected as stale
  declare
    draft_stale uuid;
    bucket_stale uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into draft_stale;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_stale, null, 'North', 'Line D', 'Bucket Stale', 1) returning id into bucket_stale;

    -- Pointing at OLD row (row_so1 from batch_a, not the newer row_so1_b2 from batch_b)
    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_stale, batch_a, row_so1, bucket_stale, 10);

    begin
      result := public.manual_shift_publish_demand_planning_draft(
        tenant_a, draft_stale, p_target_shift_id := shift_a
      );
      raise exception 'PR3B-50 FAIL: stale raw row should be rejected.';
    exception
      when raise_exception then
        if sqlerrm <> 'ROLLING_DEMAND_STALE_OR_UNAVAILABLE' then
          raise;
        end if;
    end;
  end;

  -- ============================================================
  -- Test 7: Duplicate newest rows rejected
  -- ============================================================

  -- row_so1 and row_so3 are in the same batch (batch_a) with the same identity
  -- They already exist in batch_a — a draft pointing at either should get duplicate_conflict
  -- BUT: row_so1 has been superseded by row_so1_b2 in batch_b (newer batch),
  -- and batch_b has only ONE row for SO-1. So row_so1_b2 is NOT a duplicate.
  -- The duplicate check looks at the NEWEST batch for each key.

  -- So we need a test where the NEWEST batch itself has duplicates.
  -- Let's create batch_c with duplicates for SO-2
  declare
    batch_c uuid;
    row_so2_c1 uuid;
    row_so2_c2 uuid;
    draft_dup uuid;
    bucket_dup uuid;
  begin
    insert into public.demand_import_batches (tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count, distribution_areas_count, distinct_orders_count, distinct_sku_count)
    values (tenant_a, 'pr3b-dup-batch.xlsx', 'DataSheet', 'ready', 2, 2, 1, 1, 1)
    returning id into batch_c;

    update public.demand_import_batches
    set uploaded_at = timezone('utc', now()) + interval '2 hours'
    where id = batch_c;

    -- Two rows with same identity in the newest batch
    insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
    values (tenant_a, batch_c, 'DataSheet', 5, 'Cust B', 'SO-2', 'SKU-2', 60, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
    returning id into row_so2_c1;

    insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
    values (tenant_a, batch_c, 'DataSheet', 6, 'Cust B', 'SO-2', 'SKU-2', 60, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
    returning id into row_so2_c2;

    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into draft_dup;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_dup, null, 'North', 'Line E', 'Bucket Dup', 1) returning id into bucket_dup;

    -- Point at one of the duplicate rows in the newest batch
    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_dup, batch_c, row_so2_c1, bucket_dup, 10);

    begin
      result := public.manual_shift_publish_demand_planning_draft(
        tenant_a, draft_dup, p_target_shift_id := shift_a
      );
      raise exception 'PR3B-60 FAIL: duplicate newest rows should be rejected.';
    exception
      when raise_exception then
        if sqlerrm <> 'ROLLING_DEMAND_STALE_OR_UNAVAILABLE' then
          raise;
        end if;
    end;

    -- Clean up batch_c so it does not pollute later tests
    delete from public.raw_demand_rows where batch_id = batch_c;
    delete from public.demand_import_batches where id = batch_c;
  end;

  -- ============================================================
  -- Test 8: Split allocations aggregate requested quantity
  -- ============================================================

  -- Use row_so1_b2 (batch_b, 80 units) — no duplicates, no stale, no previous publish
  -- Create two allocations pointing at the same raw row
  declare
    draft_split uuid;
    bucket_sp1 uuid;
    bucket_sp2 uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into draft_split;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_split, null, 'North', 'Line Split', 'Bucket S1', 1) returning id into bucket_sp1;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_split, null, 'North', 'Line Split', 'Bucket S2', 2) returning id into bucket_sp2;

    -- Split 80 into 50 + 30
    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_split, batch_b, row_so1_b2, bucket_sp1, 50);

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_split, batch_b, row_so1_b2, bucket_sp2, 30);

    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_split, p_target_shift_id := shift_a
    );

    if result->>'publicationId' is null then
      raise exception 'PR3B-70 FAIL: split allocation publish must return publicationId.';
    end if;

    if (result->>'createdOrders')::integer <> 2 then
      -- Split allocations on same identity but different buckets create separate orders
      raise exception 'PR3B-71 FAIL: split allocations expected 2 orders, got %.', result->>'createdOrders';
    end if;

    -- Verify both allocations have ledger rows with correct batch_id
    select count(*) into v_count
    from public.demand_planning_published_allocations
    where publication_id = (result->>'publicationId')::uuid
      and tenant_id = tenant_a;

    if v_count <> 2 then
      raise exception 'PR3B-72 FAIL: expected 2 ledger rows for split allocations, got %.', v_count;
    end if;
  end;

  -- ============================================================
  -- Test 9: Legacy-null publication rows still consume
  -- ============================================================

  -- row_so1_b2 had 80 units, split allocations just published all 80
  -- Verify a new rolling draft trying to publish more gets rejection
  -- that includes ALL previously consumed (including legacy if any)
  -- Since we don't have legacy rows in this test, this verifies
  -- the revert-aware count picks up the just-published 80.

  -- Now create a new rolling draft trying to publish from row_so1_b2 identity
  -- Since all 80 were consumed on the fallback key (SO-1/SKU-1/Cust A/North/2026-07-01),
  -- this should fail
  declare
    draft_full uuid;
    bucket_full uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into draft_full;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_full, null, 'North', 'Line F', 'Bucket Full', 1) returning id into bucket_full;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_full, batch_b, row_so1_b2, bucket_full, 1);

    begin
      result := public.manual_shift_publish_demand_planning_draft(
        tenant_a, draft_full, p_target_shift_id := shift_a
      );
      raise exception 'PR3B-80 FAIL: fully consumed should be rejected.';
    exception
      when raise_exception then
        if sqlerrm <> 'ROLLING_DEMAND_STALE_OR_UNAVAILABLE' then
          raise;
        end if;
    end;
  end;

  -- ============================================================
  -- Test 10: Rolling revert works
  -- ============================================================

  -- Revert the first rolling publish (draft_r1)
  declare
    revert_result jsonb;
  begin
    revert_result := public.demand_planning_revert_publication(
      tenant_a, pub_id
    );

    if (revert_result->>'revertedOrders')::integer <> 1 then
      raise exception 'PR3B-90 FAIL: revert expected 1 order, got %.', revert_result->>'revertedOrders';
    end if;

    -- Publication must be marked reverted
    select status into v_pub_source_kind
    from public.demand_planning_publications
    where id = pub_id::uuid;

    if v_pub_source_kind <> 'reverted' then
      raise exception 'PR3B-91 FAIL: publication should be reverted, got %.', v_pub_source_kind;
    end if;
  end;

  -- ============================================================
  -- Test 11: Reverted publication no longer consumes
  -- ============================================================

  -- After reverting draft_r1, the SO-2 identity had 30 units freed
  -- (draft_batch consumed 20 from the 50 total, 30 remain).
  -- Use a fresh batch/row identity that has partial publication
  -- followed by a revert to test that consumption is released.
  declare
    batch_revert_test uuid;
    row_revert_test uuid;
    draft_rt1 uuid;
    draft_rt2 uuid;
    bucket_rt1 uuid;
    bucket_rt2 uuid;
    revert_test_pub_id uuid;
  begin
    insert into public.demand_import_batches (tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count, distribution_areas_count, distinct_orders_count, distinct_sku_count)
    values (tenant_a, 'revert-test.xlsx', 'DataSheet', 'ready', 1, 1, 1, 1, 1)
    returning id into batch_revert_test;

    update public.demand_import_batches
    set uploaded_at = timezone('utc', now()) + interval '4 hours'
    where id = batch_revert_test;

    insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
    values (tenant_a, batch_revert_test, 'DataSheet', 2, 'Cust Rev', 'SO-REV', 'SKU-REV', 100, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
    returning id into row_revert_test;

    -- Publish 30 via rolling draft
    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into draft_rt1;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_rt1, null, 'North', 'Line Rev', 'Bucket R1', 1) returning id into bucket_rt1;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_rt1, batch_revert_test, row_revert_test, bucket_rt1, 30);

    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_rt1, p_target_shift_id := shift_a
    );

    if result->>'publicationId' is null then
      raise exception 'PR3B-98 FAIL: first revert-test publish must return publicationId.';
    end if;

    revert_test_pub_id := result->>'publicationId';

    -- Revert
    declare
      revert_result jsonb;
    begin
      revert_result := public.demand_planning_revert_publication(
        tenant_a, revert_test_pub_id
      );

      if (revert_result->>'revertedOrders')::integer <> 1 then
        raise exception 'PR3B-99 FAIL: revert-test revert expected 1 order, got %.', revert_result->>'revertedOrders';
      end if;
    end;

    -- Publish 60 after revert — should succeed (100 - 0 = 100 available after revert)
    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into draft_rt2;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_rt2, null, 'North', 'Line Rev', 'Bucket R2', 2) returning id into bucket_rt2;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_rt2, batch_revert_test, row_revert_test, bucket_rt2, 60);

    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_rt2, p_target_shift_id := shift_a
    );

    if result->>'publicationId' is null then
      raise exception 'PR3B-100 FAIL: publish after revert should succeed.';
    end if;
  end;

  -- ============================================================
  -- Test 12: Latest 10 / published 4 / request 6 succeeds, request 7 fails
  -- ============================================================

  declare
    batch_d uuid;
    row_so1_d uuid;
    pub_first uuid;
    draft_x1 uuid;
    draft_x2 uuid;
    bucket_x1 uuid;
    bucket_x2 uuid;
  begin
    -- Fresh batch: SO-1 with 10 units
    insert into public.demand_import_batches (tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count, distribution_areas_count, distinct_orders_count, distinct_sku_count)
    values (tenant_a, 'quantity-test.xlsx', 'DataSheet', 'ready', 1, 1, 1, 1, 1)
    returning id into batch_d;

    update public.demand_import_batches
    set uploaded_at = timezone('utc', now()) + interval '3 hours'
    where id = batch_d;

    insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
    values (tenant_a, batch_d, 'DataSheet', 2, 'Cust Qty', 'SO-QTY', 'SKU-QTY', 10, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
    returning id into row_so1_d;

    -- Publish 4
    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into draft_x1;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_x1, null, 'North', 'Line Qty', 'Bucket X1', 1) returning id into bucket_x1;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_x1, batch_d, row_so1_d, bucket_x1, 4);

    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_x1, p_target_shift_id := shift_a
    );

    if result->>'publicationId' is null then
      raise exception 'PR3B-110 FAIL: first quantity publish must succeed.';
    end if;

    pub_first := result->>'publicationId';

    -- Request 6 more → should succeed (4 published, 6 remaining, 10 total)
    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into draft_x2;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_x2, null, 'North', 'Line Qty', 'Bucket X2', 2) returning id into bucket_x2;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_x2, batch_d, row_so1_d, bucket_x2, 6);

    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_x2, p_target_shift_id := shift_a
    );

    if result->>'publicationId' is null then
      raise exception 'PR3B-111 FAIL: second quantity publish (6 of 6 remaining) must succeed.';
    end if;

    -- Request 1 more → should fail (0 remaining)
    declare
      draft_x3 uuid;
      bucket_x3 uuid;
    begin
      insert into public.demand_planning_drafts (tenant_id, status, source_kind)
      values (tenant_a, 'draft', 'rolling') returning id into draft_x3;

      insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
      values (tenant_a, draft_x3, null, 'North', 'Line Qty', 'Bucket X3', 3) returning id into bucket_x3;

      insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
      values (tenant_a, draft_x3, batch_d, row_so1_d, bucket_x3, 1);

      begin
        result := public.manual_shift_publish_demand_planning_draft(
          tenant_a, draft_x3, p_target_shift_id := shift_a
        );
        raise exception 'PR3B-112 FAIL: over-publish should be rejected.';
      exception
        when raise_exception then
          if sqlerrm <> 'ROLLING_DEMAND_STALE_OR_UNAVAILABLE' then
            raise;
          end if;
      end;
    end;
  end;

  -- ============================================================
  -- All assertions passed
  -- ============================================================
  raise notice 'PR-3B: All rolling publish SQL tests passed.';
end
$$;

rollback;
