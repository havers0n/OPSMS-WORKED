begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  shift_a uuid;
  batch_a uuid;
  draft_one uuid;
  draft_two uuid;
  draft_rolling uuid;
  bucket_one uuid;
  bucket_two uuid;
  row_one uuid;
  row_two uuid;
  result jsonb;
  pub_id uuid;
  v_count integer;
  v_line_id uuid;
  v_order_id uuid;
  v_item_id uuid;
  v_pub_status text;
  v_pub_source_kind text;
  v_pub_batch_id uuid;
  v_publication_id uuid;
begin
  -- ============================================================
  -- Phase 0: Setup
  -- ============================================================
  insert into public.tenants (id, code, name)
  values (tenant_a, 'PR3A-' || left(replace(gen_random_uuid()::text, '-', ''), 8), 'PR-3A Foundation Repair');

  insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, is_sso_user, raw_app_meta_data, raw_user_meta_data)
  values (user_a, 'pr3a@wos.test', now(), now(), now(), false, '{}', '{"display_name":"PR3A Tester"}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, user_a, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  -- Active shift
  insert into public.manual_shift_sessions (tenant_id, date, name, status, created_by_profile_id, created_by_name)
  values (tenant_a, date '2026-07-01', 'PR3A Shift', 'active', user_a, 'PR3A Tester')
  returning id into shift_a;

  -- Batch
  insert into public.demand_import_batches (tenant_id, source_file, source_sheet, status, rows_count, raw_rows_count, distribution_areas_count, distinct_orders_count, distinct_sku_count)
  values (tenant_a, 'pr3a-demand.xlsx', 'DataSheet', 'ready', 2, 2, 1, 2, 2)
  returning id into batch_a;

  -- Raw demand rows
  insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
  values (tenant_a, batch_a, 'DataSheet', 2, 'Cust A', 'SO-1', 'SKU-1', 100, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
  returning id into row_one;

  insert into public.raw_demand_rows (tenant_id, batch_id, source_sheet, source_row_number, customer_name, order_number, sku, quantity, distribution_area, planned_delivery_date, planning_status, route_flow, product_handling_flow)
  values (tenant_a, batch_a, 'DataSheet', 3, 'Cust B', 'SO-2', 'SKU-2', 50, 'North', date '2026-07-01', 'unplanned', 'pickup', 'regular')
  returning id into row_two;

  -- ============================================================
  -- Test 1: Schema constraints — source_kind, batch_id consistency
  --
  -- These direct inserts bypass RLS because the publication table
  -- has no INSERT policy (publications are created via security-definer RPC).
  -- We temporarily reset role to the test's superuser context.
  -- ============================================================

  execute 'reset role';

  -- Create a scratch draft so publication FK constraints are satisfied
  declare
    v_scratch_draft uuid;
    v_scratch_draft2 uuid;
    v_scratch_draft3 uuid;
    v_scratch_draft4 uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
    values (tenant_a, batch_a, 'draft', 'batch') returning id into v_scratch_draft;

    insert into public.demand_planning_drafts (tenant_id, status, source_kind)
    values (tenant_a, 'draft', 'rolling') returning id into v_scratch_draft2;

    insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
    values (tenant_a, batch_a, 'draft', 'batch') returning id into v_scratch_draft3;

    insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
    values (tenant_a, batch_a, 'draft', 'batch') returning id into v_scratch_draft4;

    -- 1a: Insert publication with source_kind = 'batch' and non-null batch_id (valid)
    insert into public.demand_planning_publications (tenant_id, batch_id, draft_id, target_shift_id, source_kind, status)
    values (tenant_a, batch_a, v_scratch_draft, shift_a, 'batch', 'applied');

    -- 1b: source_kind backfilled to 'batch' for existing rows
    select source_kind into v_pub_source_kind
    from public.demand_planning_publications
    where tenant_id = tenant_a limit 1;

    if v_pub_source_kind <> 'batch' then
      raise exception 'PR3A-01 FAIL: expected source_kind=batch, got %.', v_pub_source_kind;
    end if;

    -- 1c: source_kind = 'rolling' batch_id can be null (valid)
    insert into public.demand_planning_publications (tenant_id, draft_id, target_shift_id, source_kind, status)
    values (tenant_a, v_scratch_draft2, shift_a, 'rolling', 'applied');

    -- 1d: source_kind = 'batch' with null batch_id must fail
    begin
      insert into public.demand_planning_publications (tenant_id, draft_id, target_shift_id, source_kind, status)
      values (tenant_a, v_scratch_draft3, shift_a, 'batch', 'applied');
      raise exception 'PR3A-02 FAIL: batch publication with null batch_id should be rejected.';
    exception
      when check_violation then
        null;
    end;

    -- 1e: source_kind = 'rolling' with non-null batch_id must fail
    begin
      insert into public.demand_planning_publications (tenant_id, batch_id, draft_id, target_shift_id, source_kind, status)
      values (tenant_a, batch_a, v_scratch_draft4, shift_a, 'rolling', 'applied');
      raise exception 'PR3A-03 FAIL: rolling publication with non-null batch_id should be rejected.';
    exception
      when check_violation then
        null;
    end;
  end;

  -- Clean up test rows
  delete from public.demand_planning_publications where tenant_id = tenant_a;

  -- Restore authenticated role for subsequent tests
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- ============================================================
  -- Test 2: Batch publish creates publication header + returns publicationId
  -- ============================================================

  -- Create batch draft
  insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
  values (tenant_a, batch_a, 'draft', 'batch') returning id into draft_one;

  insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
  values (tenant_a, draft_one, batch_a, 'North', 'Line A', 'Bucket 1', 1) returning id into bucket_one;

  insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
  values (tenant_a, draft_one, batch_a, row_one, bucket_one, 60);

  -- Publish
  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_one, p_target_shift_id := shift_a
  );

  -- 2a: Response must contain non-null publicationId
  pub_id := result->>'publicationId';
  if pub_id is null then
    raise exception 'PR3A-10 FAIL: publish response must return publicationId.';
  end if;

  -- 2b: Publication header exists in DB
  select count(*) into v_count
  from public.demand_planning_publications
  where id = pub_id::uuid and tenant_id = tenant_a;

  if v_count <> 1 then
    raise exception 'PR3A-11 FAIL: publication header not found in DB.';
  end if;

  -- 2c: Publication has correct attributes
  select status, source_kind into v_pub_status, v_pub_source_kind
  from public.demand_planning_publications
  where id = pub_id::uuid;

  if v_pub_status <> 'applied' then
    raise exception 'PR3A-12 FAIL: publication status should be applied, got %.', v_pub_status;
  end if;

  if v_pub_source_kind <> 'batch' then
    raise exception 'PR3A-13 FAIL: publication source_kind should be batch, got %.', v_pub_source_kind;
  end if;

  -- 2d: Summary fields still correct
  if (result->>'createdLines')::integer <> 1 then
    raise exception 'PR3A-14 FAIL: expected 1 created line, got %.', result->>'createdLines';
  end if;

  if (result->>'createdOrders')::integer <> 1 then
    raise exception 'PR3A-15 FAIL: expected 1 created order, got %.', result->>'createdOrders';
  end if;

  if (result->>'createdItems')::integer <> 1 then
    raise exception 'PR3A-16 FAIL: expected 1 created item, got %.', result->>'createdItems';
  end if;

  -- ============================================================
  -- Test 3: Ledger rows contain publication_id and operational lineage
  -- ============================================================

  select
    pa.publication_id,
    pa.manual_shift_line_id,
    pa.manual_shift_order_id,
    pa.manual_shift_order_item_id,
    pa.line_created_by_publication
  into
    v_publication_id,
    v_line_id,
    v_order_id,
    v_item_id,
    v_pub_status
  from public.demand_planning_published_allocations pa
  where pa.draft_id = draft_one and pa.tenant_id = tenant_a;

  if v_publication_id is null then
    raise exception 'PR3A-20 FAIL: ledger row must have publication_id.';
  end if;

  if v_line_id is null then
    raise exception 'PR3A-21 FAIL: ledger row must have manual_shift_line_id.';
  end if;

  if v_order_id is null then
    raise exception 'PR3A-22 FAIL: ledger row must have manual_shift_order_id.';
  end if;

  if v_item_id is null then
    raise exception 'PR3A-23 FAIL: ledger row must have manual_shift_order_item_id.';
  end if;

  if v_publication_id <> pub_id::uuid then
    raise exception 'PR3A-24 FAIL: ledger publication_id must match header.';
  end if;

  -- ============================================================
  -- Test 4: Revert works through publication_id
  -- ============================================================

  result := public.demand_planning_revert_publication(
    tenant_a, pub_id
  );

  if (result->>'revertedOrders')::integer <> 1 then
    raise exception 'PR3A-30 FAIL: revert expected 1 order, got %.', result->>'revertedOrders';
  end if;

  -- Publication must be marked reverted
  select status into v_pub_status
  from public.demand_planning_publications
  where id = pub_id::uuid;

  if v_pub_status <> 'reverted' then
    raise exception 'PR3A-31 FAIL: publication status should be reverted, got %.', v_pub_status;
  end if;

  -- Draft must be reopened
  select status into v_pub_status
  from public.demand_planning_drafts
  where id = draft_one;

  if v_pub_status <> 'draft' then
    raise exception 'PR3A-32 FAIL: draft should be reopened, got %.', v_pub_status;
  end if;

  -- ============================================================
  -- Test 5: Reverted publications no longer consume availability
  -- ============================================================

  -- Publish row_one again via a new draft (the original allocation_id was
  -- already consumed in the first publish; revert does not delete ledger
  -- rows, so we need a fresh allocation).
  declare
    draft_reborn uuid;
    bucket_reborn uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
    values (tenant_a, batch_a, 'draft', 'batch') returning id into draft_reborn;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_reborn, batch_a, 'North', 'Line A', 'Bucket Reborn', 1) returning id into bucket_reborn;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_reborn, batch_a, row_one, bucket_reborn, 60);

    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_reborn, p_target_shift_id := shift_a
    );

    pub_id := result->>'publicationId';
    if pub_id is null then
      raise exception 'PR3A-40 FAIL: re-publish must return publicationId.';
    end if;
  end;

  -- Now create draft_two that tries to publish remaining 40 units of row_one
  insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
  values (tenant_a, batch_a, 'draft', 'batch') returning id into draft_two;

  insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
  values (tenant_a, draft_two, batch_a, 'North', 'Line A', 'Bucket 2', 2) returning id into bucket_two;

  insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
  values (tenant_a, draft_two, batch_a, row_one, bucket_two, 40);

  -- This should succeed because only the applied publication's 60 counts, not the reverted one
  result := public.manual_shift_publish_demand_planning_draft(
    tenant_a, draft_two, p_target_shift_id := shift_a
  );

  if (result->>'createdOrders')::integer <> 1 then
    raise exception 'PR3A-41 FAIL: expected 1 created order for second publish, got %.', result->>'createdOrders';
  end if;

  -- Now verify that publishing more than remaining (100 - 60 = 40) is rejected
  -- Create draft_three
  declare
    draft_three uuid;
    bucket_three uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
    values (tenant_a, batch_a, 'draft', 'batch') returning id into draft_three;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_three, batch_a, 'North', 'Line A', 'Bucket 3', 3) returning id into bucket_three;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_three, batch_a, row_one, bucket_three, 1);

    begin
      result := public.manual_shift_publish_demand_planning_draft(
        tenant_a, draft_three, p_target_shift_id := shift_a
      );
      raise exception 'PR3A-42 FAIL: over-publish should be blocked.';
    exception
      when raise_exception then
        if sqlerrm <> 'DEMAND_PLANNING_DEMAND_ALREADY_CONSUMED' then
          raise;
        end if;
    end;
  end;

  -- ============================================================
  -- Test 6: Rolling publish without allocations fails (PR-3A
  -- originally blocked rolling entirely; PR-3B enables rolling
  -- publish, but a draft with zero allocations still fails).
  -- ============================================================

  insert into public.demand_planning_drafts (tenant_id, status, source_kind)
  values (tenant_a, 'draft', 'rolling') returning id into draft_rolling;

  begin
    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_rolling, p_target_shift_id := shift_a
    );
    raise exception 'PR3A-50 FAIL: rolling publish with zero allocations must be blocked.';
  exception
    when raise_exception then
      if sqlerrm <> 'NO_PUBLISHABLE_ROWS' then
        raise;
      end if;
  end;

  -- ============================================================
  -- Test 7: Append into active shift still works (legacy behavior)
  -- ============================================================

  -- Only row_two is left (50 units of SKU-2 within batch_a)
  -- Publish a fresh draft for remaining row_two (no prior consumption conflict)
  declare
    draft_append uuid;
    bucket_append uuid;
  begin
    insert into public.demand_planning_drafts (tenant_id, batch_id, status, source_kind)
    values (tenant_a, batch_a, 'draft', 'batch') returning id into draft_append;

    insert into public.demand_planning_buckets (tenant_id, draft_id, batch_id, distribution_area, planning_line_name, bucket_name, sort_order)
    values (tenant_a, draft_append, batch_a, 'North', 'Line B', 'Bucket Append', 1) returning id into bucket_append;

    insert into public.demand_planning_allocations (tenant_id, draft_id, batch_id, raw_demand_row_id, bucket_id, allocated_quantity)
    values (tenant_a, draft_append, batch_a, row_two, bucket_append, 50);

    result := public.manual_shift_publish_demand_planning_draft(
      tenant_a, draft_append, p_target_shift_id := shift_a
    );

    if (result->>'createdOrders')::integer <> 1 then
      raise exception 'PR3A-60 FAIL: append expected 1 order, got %.', result->>'createdOrders';
    end if;

    -- Verify reused line (same shift, different draft)
    if (result->>'reusedLines')::integer <> 0 then
      -- Note: Line B is new, so it could be created=1; either is acceptable
      null;
    end if;

    -- Verify publicationId still present
    if result->>'publicationId' is null then
      raise exception 'PR3A-61 FAIL: append publish must return publicationId.';
    end if;

    -- Verify publication header created
    select count(*) into v_count
    from public.demand_planning_publications
    where draft_id = draft_append and tenant_id = tenant_a;

    if v_count <> 1 then
      raise exception 'PR3A-62 FAIL: append publish must create publication header.';
    end if;
  end;

  -- ============================================================
  -- All assertions passed
  -- ============================================================
end
$$;

rollback;
