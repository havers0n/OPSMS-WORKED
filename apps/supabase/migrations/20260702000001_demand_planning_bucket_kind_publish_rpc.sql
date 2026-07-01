-- PR-1.1 defense-in-depth: reject publish when positive allocations exist
-- inside technical_unassigned buckets.
--
-- A technical_unassigned bucket existing in the draft is fine — only
-- buckets with allocated_quantity > 0 at publish time are rejected.
--
-- This is a CREATE OR REPLACE of the function defined in
-- 20260701000000_pr3b_rolling_publish_enablement.sql with the new
-- DRAFT_HAS_UNASSIGNED_ALLOCATIONS check added after the advisory lock.

create or replace function public.manual_shift_publish_demand_planning_draft(
  p_tenant_id uuid,
  p_draft_id uuid,
  p_target_shift_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_draft public.demand_planning_drafts%rowtype;
  v_result jsonb;
  v_publication_id uuid;

  -- Summary counters
  v_created_lines int := 0;
  v_reused_lines int := 0;
  v_created_orders int := 0;
  v_created_items int := 0;
  v_total_skipped int := 0;
  v_warnings jsonb := '[]'::jsonb;

  -- Core mapping records
  v_core_rec record;

  v_skipped_error int;
  v_skipped_special_flow int;
  v_skipped_requires_review int;
  v_skipped_no_sku int;
  v_skipped_zero_qty int;

  -- Rolling validation
  v_conflicts jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null or not public.can_manage_tenant(p_tenant_id) then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  -- Lock and validate draft
  select *
  into v_draft
  from public.demand_planning_drafts
  where id = p_draft_id
    and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_FOUND';
  end if;

  if v_draft.status not in ('draft', 'ready') then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_MUTABLE';
  end if;

  -- Acquire tenant-scoped advisory lock to serialize publish/revert/import
  -- critical sections for this tenant.
  -- The lock intentionally serializes batch and rolling publish paths
  -- so rolling availability validation cannot race with batch consumption.
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':demand_planning_publish', 0
  ));

  -- ═════════════════════════════════════════════════════════════════════════════
  -- PR-1.1: Reject publish when technical_unassigned buckets have positive
  -- allocations.  The bucket may exist with zero allocations — that is fine.
  -- ═════════════════════════════════════════════════════════════════════════════
  if exists (
    select 1
    from public.demand_planning_allocations a
    join public.demand_planning_buckets b on b.id = a.bucket_id
    where a.draft_id = p_draft_id
      and a.tenant_id = p_tenant_id
      and b.bucket_kind = 'technical_unassigned'
      and a.allocated_quantity > 0
  ) then
    raise exception 'DRAFT_HAS_UNASSIGNED_ALLOCATIONS';
  end if;

  -- ═════════════════════════════════════════════════════════════════════════════
  -- Rolling branch
  -- ═════════════════════════════════════════════════════════════════════════════
  if v_draft.source_kind = 'rolling' then
    -- Validate rolling availability inside the transaction
    select coalesce(jsonb_agg(conflict), '[]'::jsonb)
    into v_conflicts
    from public.demand_planning_rolling_publish_validate(p_tenant_id, p_draft_id);

    if jsonb_array_length(v_conflicts) > 0 then
      raise exception 'ROLLING_DEMAND_STALE_OR_UNAVAILABLE'
        using detail = jsonb_build_object('conflicts', v_conflicts)::text;
    end if;

    -- Serialize consumption on raw rows (no batch_id filter for rolling)
    perform 1
    from public.raw_demand_rows r
    where r.tenant_id = p_tenant_id
      and r.id in (
        select a.raw_demand_row_id
        from public.demand_planning_allocations a
        where a.tenant_id = p_tenant_id
          and a.draft_id = p_draft_id
          and a.allocated_quantity > 0
      )
    order by r.id
    for update;

    -- Pre-compute skip warnings
    select
      coalesce(count(*) filter (where r.planning_status = 'error'), 0),
      coalesce(count(*) filter (where r.planning_status = 'special_flow'), 0),
      coalesce(count(*) filter (where r.planning_status = 'requires_review'), 0),
      coalesce(count(*) filter (
        where r.planning_status not in ('error', 'special_flow', 'requires_review')
          and (r.sku is null or nullif(btrim(r.sku), '') is null)
      ), 0),
      coalesce(count(*) filter (
        where r.planning_status not in ('error', 'special_flow', 'requires_review')
          and r.sku is not null
          and nullif(btrim(r.sku), '') is not null
          and a.allocated_quantity <= 0
      ), 0)
    into v_skipped_error, v_skipped_special_flow, v_skipped_requires_review, v_skipped_no_sku, v_skipped_zero_qty
    from public.demand_planning_allocations a
    join public.raw_demand_rows r on r.id = a.raw_demand_row_id
    where a.draft_id = p_draft_id
      and a.tenant_id = p_tenant_id;

    v_total_skipped := v_skipped_error + v_skipped_special_flow + v_skipped_requires_review + v_skipped_no_sku + v_skipped_zero_qty;

    if v_skipped_error > 0 then
      v_warnings := v_warnings || to_jsonb(format('%s error row(s) were skipped.', v_skipped_error)::text);
    end if;
    if v_skipped_special_flow > 0 then
      v_warnings := v_warnings || to_jsonb(format('%s special_flow row(s) were skipped because no explicit publish rule exists for them yet.', v_skipped_special_flow)::text);
    end if;
    if v_skipped_requires_review > 0 then
      v_warnings := v_warnings || to_jsonb(format('%s requires_review row(s) were skipped.', v_skipped_requires_review)::text);
    end if;
    if v_skipped_no_sku > 0 then
      v_warnings := v_warnings || to_jsonb(format('%s row(s) were skipped because SKU is required for operational order items.', v_skipped_no_sku)::text);
    end if;
    if v_skipped_zero_qty > 0 then
      v_warnings := v_warnings || to_jsonb(format('%s row(s) were skipped because allocated quantity must be positive.', v_skipped_zero_qty)::text);
    end if;

    -- Create publication header with source_kind = 'rolling', batch_id = NULL
    insert into public.demand_planning_publications (
      tenant_id, batch_id, draft_id, target_shift_id,
      source_kind, status
    )
    values (
      p_tenant_id, null, p_draft_id, p_target_shift_id,
      'rolling', 'applied'
    )
    returning id into v_publication_id;

    -- Execute operational core
    for v_core_rec in
      select * from public.manual_shift_publish_demand_planning_operational_core(
        p_tenant_id, p_draft_id, p_target_shift_id
      )
    loop
      if v_core_rec.line_created then
        v_created_lines := v_created_lines + 1;
      else
        v_reused_lines := v_reused_lines + 1;
      end if;
      v_created_orders := v_created_orders + 1;
      v_created_items := v_created_items + 1;

      -- Insert ledger row with per-allocation batch_id for lineage
      insert into public.demand_planning_published_allocations (
        tenant_id, batch_id, draft_id, target_shift_id,
        raw_demand_row_id, allocation_id, published_quantity,
        publication_id,
        manual_shift_line_id, manual_shift_order_id, manual_shift_order_item_id,
        line_created_by_publication
      )
      select
        p_tenant_id,
        a.batch_id,  -- per-allocation batch lineage (NOT v_draft.batch_id, which is null for rolling)
        p_draft_id,
        p_target_shift_id,
        a.raw_demand_row_id,
        v_core_rec.allocation_id,
        a.allocated_quantity,
        v_publication_id,
        v_core_rec.line_id,
        v_core_rec.order_id,
        v_core_rec.item_id,
        v_core_rec.line_created
      from public.demand_planning_allocations a
      where a.id = v_core_rec.allocation_id
        and a.tenant_id = p_tenant_id;
    end loop;

    -- Build response
    return jsonb_build_object(
      'shiftId', p_target_shift_id,
      'draftId', p_draft_id,
      'publicationId', v_publication_id,
      'createdLines', v_created_lines,
      'reusedLines', v_reused_lines,
      'createdOrders', v_created_orders,
      'updatedOrders', 0,
      'createdItems', v_created_items,
      'skippedRows', v_total_skipped,
      'warnings', v_warnings
    );
  end if;

  -- ═════════════════════════════════════════════════════════════════════════════
  -- Batch branch (unchanged behavior from PR-3A)
  -- ═════════════════════════════════════════════════════════════════════════════

  -- Cross-draft consistency check (all allocations reference the same batch)
  if exists (
    select 1
    from public.demand_planning_allocations a
    join public.raw_demand_rows r on r.id = a.raw_demand_row_id
    where a.tenant_id = p_tenant_id
      and a.draft_id = p_draft_id
      and (a.batch_id <> v_draft.batch_id or r.batch_id <> v_draft.batch_id or r.tenant_id <> p_tenant_id)
  ) then
    raise exception 'DEMAND_PLANNING_DRAFT_SOURCE_MISMATCH';
  end if;

  -- Serialize consumption checks per raw row
  perform 1
  from public.raw_demand_rows r
  where r.tenant_id = p_tenant_id
    and r.id in (
      select a.raw_demand_row_id
      from public.demand_planning_allocations a
      where a.tenant_id = p_tenant_id
        and a.draft_id = p_draft_id
        and a.batch_id = v_draft.batch_id
        and a.allocated_quantity > 0
    )
  order by r.id
  for update;

  -- Revert-aware consumption check
  if exists (
    select 1
    from (
      select
        r.id,
        coalesce(r.quantity, 0) as source_quantity,
        coalesce(existing.published_quantity, 0) as already_published_quantity,
        sum(a.allocated_quantity) as requested_quantity
      from public.demand_planning_allocations a
      join public.raw_demand_rows r
        on r.id = a.raw_demand_row_id
       and r.tenant_id = p_tenant_id
      left join lateral (
        select coalesce(sum(pa.published_quantity), 0) as published_quantity
        from public.demand_planning_published_allocations pa
        left join public.demand_planning_publications pub
          on pub.id = pa.publication_id
        where pa.tenant_id = p_tenant_id
          and pa.raw_demand_row_id = r.id
          and (pa.publication_id is null or pub.status = 'applied')
      ) existing on true
      where a.tenant_id = p_tenant_id
        and a.draft_id = p_draft_id
        and a.batch_id = v_draft.batch_id
        and a.allocated_quantity > 0
        and r.planning_status not in ('error', 'special_flow')
        and nullif(btrim(r.sku), '') is not null
      group by r.id, r.quantity, existing.published_quantity
    ) consumption
    where consumption.already_published_quantity + consumption.requested_quantity
      > consumption.source_quantity
  ) then
    raise exception 'DEMAND_PLANNING_DEMAND_ALREADY_CONSUMED';
  end if;

  -- Pre-compute skip warnings before calling core
  select
    coalesce(count(*) filter (where r.planning_status = 'error'), 0),
    coalesce(count(*) filter (where r.planning_status = 'special_flow'), 0),
    coalesce(count(*) filter (
      where r.planning_status not in ('error', 'special_flow')
        and (r.sku is null or nullif(btrim(r.sku), '') is null)
    ), 0),
    coalesce(count(*) filter (
      where r.planning_status not in ('error', 'special_flow')
        and r.sku is not null
        and nullif(btrim(r.sku), '') is not null
        and a.allocated_quantity <= 0
    ), 0)
  into v_skipped_error, v_skipped_special_flow, v_skipped_no_sku, v_skipped_zero_qty
  from public.demand_planning_allocations a
  join public.raw_demand_rows r on r.id = a.raw_demand_row_id
  where a.draft_id = p_draft_id
    and a.tenant_id = p_tenant_id;

  v_total_skipped := v_skipped_error + v_skipped_special_flow + v_skipped_no_sku + v_skipped_zero_qty;

  if v_skipped_error > 0 then
    v_warnings := v_warnings || to_jsonb(format('%s error row(s) were skipped.', v_skipped_error)::text);
  end if;
  if v_skipped_special_flow > 0 then
    v_warnings := v_warnings || to_jsonb(format('%s special_flow row(s) were skipped because no explicit publish rule exists for them yet.', v_skipped_special_flow)::text);
  end if;
  if v_skipped_no_sku > 0 then
    v_warnings := v_warnings || to_jsonb(format('%s row(s) were skipped because SKU is required for operational order items.', v_skipped_no_sku)::text);
  end if;
  if v_skipped_zero_qty > 0 then
    v_warnings := v_warnings || to_jsonb(format('%s row(s) were skipped because allocated quantity must be positive.', v_skipped_zero_qty)::text);
  end if;

  -- Create publication header
  insert into public.demand_planning_publications (
    tenant_id, batch_id, draft_id, target_shift_id,
    source_kind, status
  )
  values (
    p_tenant_id, v_draft.batch_id, p_draft_id, p_target_shift_id,
    'batch', 'applied'
  )
  returning id into v_publication_id;

  -- Execute operational core
  for v_core_rec in
    select * from public.manual_shift_publish_demand_planning_operational_core(
      p_tenant_id, p_draft_id, p_target_shift_id
    )
  loop
    if v_core_rec.line_created then
      v_created_lines := v_created_lines + 1;
    else
      v_reused_lines := v_reused_lines + 1;
    end if;
    v_created_orders := v_created_orders + 1;
    v_created_items := v_created_items + 1;

    -- Insert ledger row with full lineage
    insert into public.demand_planning_published_allocations (
      tenant_id, batch_id, draft_id, target_shift_id,
      raw_demand_row_id, allocation_id, published_quantity,
      publication_id,
      manual_shift_line_id, manual_shift_order_id, manual_shift_order_item_id,
      line_created_by_publication
    )
    select
      p_tenant_id,
      coalesce(v_draft.batch_id, a.batch_id),  -- draft batch_id for batch, allocation batch_id for rolling
      p_draft_id,
      p_target_shift_id,
      a.raw_demand_row_id,
      v_core_rec.allocation_id,
      a.allocated_quantity,
      v_publication_id,
      v_core_rec.line_id,
      v_core_rec.order_id,
      v_core_rec.item_id,
      v_core_rec.line_created
    from public.demand_planning_allocations a
    where a.id = v_core_rec.allocation_id
      and a.tenant_id = p_tenant_id;
  end loop;

  -- Build response (same shape as legacy + publicationId)
  return jsonb_build_object(
    'shiftId', p_target_shift_id,
    'draftId', p_draft_id,
    'publicationId', v_publication_id,
    'createdLines', v_created_lines,
    'reusedLines', v_reused_lines,
    'createdOrders', v_created_orders,
    'updatedOrders', 0,
    'createdItems', v_created_items,
    'skippedRows', v_total_skipped,
    'warnings', v_warnings
  );
end;
$$;

revoke all on function public.manual_shift_publish_demand_planning_draft(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.manual_shift_publish_demand_planning_draft(uuid, uuid, uuid)
  to authenticated;
