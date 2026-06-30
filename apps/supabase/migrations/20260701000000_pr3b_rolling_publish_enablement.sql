-- PR-3B: Rolling Demand Publish Enablement
--
-- 1. Rolling availability validation helper
-- 2. Tenant-scoped advisory lock for publish concurrency
-- 3. Update public publish RPC with rolling validation branch
-- 4. Per-allocation batch_id in ledger rows
-- 5. Operational core batch metadata per allocation

-- ═══════════════════════════════════════════════════════════════════════════════
-- Part 1: Rolling Publish Validation Helper
--
-- Validates rolling draft allocations against current available demand.
-- Returns conflict rows; empty result means safe to publish.
-- Runs inside the publish transaction for TOCTOU safety.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.demand_planning_rolling_publish_validate(
  p_tenant_id uuid,
  p_draft_id uuid
)
returns table(conflict jsonb)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source_kind text;
  v_draft_status text;
begin
  -- Validate draft exists, is rolling, and is mutable
  select source_kind, status into strict v_source_kind, v_draft_status
  from public.demand_planning_drafts
  where id = p_draft_id and tenant_id = p_tenant_id;

  if v_source_kind <> 'rolling' then
    raise exception 'DEMAND_PLANNING_ROLLING_PUBLISH_VALIDATE_WRONG_KIND';
  end if;

  if v_draft_status not in ('draft', 'ready') then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_MUTABLE';
  end if;

  -- Core validation: group allocations by fallback-key identity fields,
  -- compare against current latest ready-batch rows and published consumption.
  return query
  with
  -- 1. All allocations in this draft with > 0 quantity and their row identity
  allocation_keys as (
    select
      a.id as allocation_id,
      a.raw_demand_row_id,
      a.allocated_quantity,
      coalesce(nullif(btrim(r.order_number), ''), '') as fk_order_number,
      coalesce(nullif(btrim(r.sku), ''), '') as fk_sku,
      coalesce(nullif(btrim(r.customer_name), ''), '') as fk_customer_name,
      coalesce(nullif(btrim(r.distribution_area), ''), '') as fk_distribution_area,
      r.planned_delivery_date as fk_delivery_date,
      r.id as current_raw_row_id,
      r.quantity as current_quantity,
      r.batch_id as current_batch_id
    from public.demand_planning_allocations a
    join public.raw_demand_rows r
      on r.id = a.raw_demand_row_id
     and r.tenant_id = p_tenant_id
    where a.tenant_id = p_tenant_id
      and a.draft_id = p_draft_id
      and a.allocated_quantity > 0
  ),
  -- 2. Latest ready-batch row per fallback key (identity fields)
  --    ORDER BY uploaded_at DESC, batch_id DESC per domain resolver V1
  latest_rows as (
    select distinct on (
      coalesce(nullif(btrim(r.order_number), ''), ''),
      coalesce(nullif(btrim(r.sku), ''), ''),
      coalesce(nullif(btrim(r.customer_name), ''), ''),
      coalesce(nullif(btrim(r.distribution_area), ''), ''),
      r.planned_delivery_date
    )
      r.id as latest_row_id,
      r.batch_id as latest_batch_id,
      r.quantity as latest_quantity,
      r.tenant_id,
      coalesce(nullif(btrim(r.order_number), ''), '') as fk_order_number,
      coalesce(nullif(btrim(r.sku), ''), '') as fk_sku,
      coalesce(nullif(btrim(r.customer_name), ''), '') as fk_customer_name,
      coalesce(nullif(btrim(r.distribution_area), ''), '') as fk_distribution_area,
      r.planned_delivery_date as fk_delivery_date,
      b.uploaded_at
    from public.raw_demand_rows r
    join public.demand_import_batches b
      on b.id = r.batch_id
     and b.tenant_id = p_tenant_id
     and b.status = 'ready'
    where r.tenant_id = p_tenant_id
      -- Only consider rows matching allocation identity keys
      and (coalesce(nullif(btrim(r.order_number), ''), ''),
           coalesce(nullif(btrim(r.sku), ''), ''),
           coalesce(nullif(btrim(r.customer_name), ''), ''),
           coalesce(nullif(btrim(r.distribution_area), ''), ''),
           r.planned_delivery_date) in (
        select ak.fk_order_number, ak.fk_sku, ak.fk_customer_name,
               ak.fk_distribution_area, ak.fk_delivery_date
        from allocation_keys ak
      )
    order by
      coalesce(nullif(btrim(r.order_number), ''), ''),
      coalesce(nullif(btrim(r.sku), ''), ''),
      coalesce(nullif(btrim(r.customer_name), ''), ''),
      coalesce(nullif(btrim(r.distribution_area), ''), ''),
      r.planned_delivery_date,
      b.uploaded_at desc,
      b.id desc
  ),
  -- 3. Duplicate detection: rows in the newest batch per key
  --    Note: aggregate ORDER BY is unsupported inside OVER(), so row_ids
  --    is computed via a subquery; row_count uses a plain window count.
  newest_batch_rows as (
    select distinct on (lr.fk_order_number, lr.fk_sku, lr.fk_customer_name,
                        lr.fk_distribution_area, lr.fk_delivery_date)
      lr.fk_order_number, lr.fk_sku, lr.fk_customer_name,
      lr.fk_distribution_area, lr.fk_delivery_date,
      lr.latest_batch_id,
      (select count(*)
       from public.raw_demand_rows r2
       where r2.tenant_id = lr.tenant_id
         and r2.batch_id = lr.latest_batch_id
         and coalesce(nullif(btrim(r2.order_number), ''), '') = lr.fk_order_number
         and coalesce(nullif(btrim(r2.sku), ''), '') = lr.fk_sku
         and coalesce(nullif(btrim(r2.customer_name), ''), '') = lr.fk_customer_name
         and coalesce(nullif(btrim(r2.distribution_area), ''), '') = lr.fk_distribution_area
         and r2.planned_delivery_date is not distinct from lr.fk_delivery_date
      ) as row_count
    from latest_rows lr
  ),
  -- 4. Per-key published quantity (revert-aware)
  published_by_key as (
    select
      coalesce(nullif(btrim(pa_r.order_number), ''), '') as fk_order_number,
      coalesce(nullif(btrim(pa_r.sku), ''), '') as fk_sku,
      coalesce(nullif(btrim(pa_r.customer_name), ''), '') as fk_customer_name,
      coalesce(nullif(btrim(pa_r.distribution_area), ''), '') as fk_distribution_area,
      pa_r.planned_delivery_date as fk_delivery_date,
      coalesce(sum(pa.published_quantity), 0) as published_quantity
    from public.demand_planning_published_allocations pa
    join public.raw_demand_rows pa_r
      on pa_r.id = pa.raw_demand_row_id
     and pa_r.tenant_id = p_tenant_id
    left join public.demand_planning_publications pub
      on pub.id = pa.publication_id
    where pa.tenant_id = p_tenant_id
      and (pa.publication_id is null or pub.status = 'applied')
    group by 1, 2, 3, 4, 5
  ),
  -- 5. Per-allocation validation checks
  checks as (
    select
      ak.allocation_id,
      ak.current_raw_row_id as raw_demand_row_id,
      nullif(btrim(ak.fk_sku), '') as sku,
      nullif(btrim(ak.fk_order_number), '') as order_number,
      ak.allocated_quantity as requested_quantity,
      lr.latest_row_id,
      coalesce(lr.latest_quantity, 0) as latest_quantity,
      coalesce(pbk.published_quantity, 0) as already_published,
      -- Aggregate requested quantity for this key across all allocations
      sum(ak.allocated_quantity) over (
        partition by ak.fk_order_number, ak.fk_sku, ak.fk_customer_name,
                     ak.fk_distribution_area, ak.fk_delivery_date
      ) as key_requested_total,
      -- Available = latest quantity - already published
      (coalesce(lr.latest_quantity, 0) - coalesce(pbk.published_quantity, 0)) as key_available_total,
      -- Is this allocation still pointing at the latest row for this key?
      case when ak.current_raw_row_id = lr.latest_row_id then true else false end as is_latest,
      -- Are there multiple rows with this key in the newest batch?
      case when nbr.row_count > 1 then true else false end as has_duplicate
    from allocation_keys ak
    left join latest_rows lr
      on lr.fk_order_number = ak.fk_order_number
     and lr.fk_sku = ak.fk_sku
     and lr.fk_customer_name = ak.fk_customer_name
     and lr.fk_distribution_area = ak.fk_distribution_area
     and lr.fk_delivery_date is not distinct from ak.fk_delivery_date
    left join published_by_key pbk
      on pbk.fk_order_number = ak.fk_order_number
     and pbk.fk_sku = ak.fk_sku
     and pbk.fk_customer_name = ak.fk_customer_name
     and pbk.fk_distribution_area = ak.fk_distribution_area
     and pbk.fk_delivery_date is not distinct from ak.fk_delivery_date
    left join newest_batch_rows nbr
      on nbr.fk_order_number = ak.fk_order_number
     and nbr.fk_sku = ak.fk_sku
     and nbr.fk_customer_name = ak.fk_customer_name
     and nbr.fk_distribution_area = ak.fk_distribution_area
     and nbr.fk_delivery_date is not distinct from ak.fk_delivery_date
  )
  -- 6. Emit conflicts for any stale/duplicate/insufficient allocations
  --    DISTINCT ensures one row per allocation when newest_batch_rows
  --    produces multiple rows for the same fallback key.
  select distinct jsonb_build_object(
    'allocationId', c.allocation_id,
    'rawDemandRowId', c.raw_demand_row_id,
    'sku', c.sku,
    'orderNumber', c.order_number,
    'requestedQuantity', c.requested_quantity,
    'availableQuantity', c.key_available_total,
    'status',
    case
      when c.has_duplicate then 'duplicate_conflict'
      when not c.is_latest then 'stale'
      when c.key_requested_total > c.key_available_total then 'insufficient_quantity'
      else 'available'
    end,
    'reason',
    case
      when c.has_duplicate
        then 'Multiple rows with the same identity exist in the newest batch.'
      when not c.is_latest
        then 'The raw demand row is no longer the latest for this fallback identity.'
      when c.key_requested_total > c.key_available_total
        then format(
          'Requested %s but only %s available (latest quantity %s, already published %s).',
          c.key_requested_total::text,
          greatest(c.key_available_total, 0)::text,
          c.latest_quantity::text,
          c.already_published::text
        )
      else 'OK'
    end
  )::jsonb as conflict
  from checks c
  where c.has_duplicate
     or not c.is_latest
     or c.key_requested_total > c.key_available_total;
end;
$$;

revoke all on function public.demand_planning_rolling_publish_validate(uuid, uuid)
  from public, anon;
grant execute on function public.demand_planning_rolling_publish_validate(uuid, uuid)
  to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Part 2: Update operational core for per-allocation batch metadata
--
-- For rolling drafts, each allocation may come from a different import batch.
-- Add demand_import_batches join so source_sheet/source_file resolve
-- per allocation rather than from the (null) draft-level batch_id.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.manual_shift_publish_demand_planning_operational_core(
  p_tenant_id uuid,
  p_draft_id uuid,
  p_target_shift_id uuid
)
returns table(
  allocation_id uuid,
  line_id uuid,
  order_id uuid,
  item_id uuid,
  line_created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_draft public.demand_planning_drafts%rowtype;
  v_shift public.manual_shift_sessions%rowtype;
  v_batch public.demand_import_batches%rowtype;
  v_profile public.profiles%rowtype;
  v_actor_id uuid;
  v_actor_name text;

  v_publishable_count integer;
  v_distinct_date_count integer;
  v_first_date date;
  v_has_null_date boolean;

  v_prev_line_name text;
  v_prev_dist_area text;
  v_prev_bucket_name text;
  v_prev_cust_name text;
  v_prev_order_num text;
  v_prev_fallback_sku text;
  v_prev_fallback_row_num integer;
  v_line_id uuid;
  v_order_id uuid;
  v_item_id uuid;
  v_created_line boolean;
  v_source_rows integer[];

  v_rec record;
  v_order_sort integer := 0;
  v_item_sort integer := 0;
begin
  -- Authenticate
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  if not public.can_manage_tenant(p_tenant_id) then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  select * into v_profile from public.profiles where id = v_actor_id;
  if v_profile.id is null then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  v_actor_name := coalesce(
    nullif(btrim(v_profile.display_name), ''),
    nullif(btrim(v_profile.email), ''),
    'operator'
  );

  -- Lock and validate draft
  select * into v_draft
  from public.demand_planning_drafts
  where id = p_draft_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_FOUND';
  end if;

  if v_draft.status not in ('draft', 'ready') then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_MUTABLE';
  end if;

  -- Lock and validate shift
  select * into v_shift
  from public.manual_shift_sessions
  where id = p_target_shift_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'SHIFT_NOT_FOUND';
  end if;

  if v_shift.status <> 'active' then
    raise exception 'SHIFT_NOT_ACTIVE';
  end if;

  -- Resolve batch when draft has a specific batch (batch mode only)
  -- Rolling mode resolves per-allocation batch metadata via join below
  if v_draft.batch_id is not null then
    select * into v_batch
    from public.demand_import_batches
    where id = v_draft.batch_id and tenant_id = p_tenant_id;

    if not found then
      raise exception 'DEMAND_PLANNING_DRAFT_NOT_FOUND';
    end if;
  end if;

  -- Phase 1: pre-validate publishable rows and planned delivery dates
  select
    count(*) filter (
      where r.planning_status not in ('error', 'special_flow')
        and r.sku is not null
        and nullif(btrim(r.sku), '') is not null
        and alloc.allocated_quantity > 0
    ) as publishable_count,
    coalesce(count(distinct r.planned_delivery_date) filter (
      where r.planning_status not in ('error', 'special_flow')
        and r.sku is not null
        and nullif(btrim(r.sku), '') is not null
        and alloc.allocated_quantity > 0
    ), 0) as distinct_date_count,
    min(r.planned_delivery_date) filter (
      where r.planning_status not in ('error', 'special_flow')
        and r.sku is not null
        and nullif(btrim(r.sku), '') is not null
        and alloc.allocated_quantity > 0
    ) as first_date,
    coalesce(bool_or(r.planned_delivery_date is null) filter (
      where r.planning_status not in ('error', 'special_flow')
        and r.sku is not null
        and nullif(btrim(r.sku), '') is not null
        and alloc.allocated_quantity > 0
    ), false) as has_null_date
  into
    v_publishable_count,
    v_distinct_date_count,
    v_first_date,
    v_has_null_date
  from public.demand_planning_allocations alloc
  join public.raw_demand_rows r on r.id = alloc.raw_demand_row_id
  where alloc.draft_id = p_draft_id
    and alloc.tenant_id = p_tenant_id;

  if v_publishable_count = 0 then
    raise exception 'NO_PUBLISHABLE_ROWS';
  end if;

  if v_distinct_date_count > 1 then
    raise exception 'DATE_AMBIGUOUS';
  end if;

  if v_distinct_date_count = 1 then
    if v_first_date is distinct from v_shift.date then
      raise exception 'DATE_MISMATCH';
    end if;
  end if;

  -- Phase 2: iterate over publishable allocations grouped by line and order
  for v_rec in
    select
      alloc.id as allocation_id,
      coalesce(b.distribution_area, '') as dist_area,
      btrim(b.planning_line_name) as line_name,
      b.sort_order as line_sort,
      btrim(b.bucket_name) as bucket_name,
      nullif(btrim(r.customer_name), '') as cust_name,
      nullif(btrim(r.order_number), '') as order_num,
      btrim(r.sku) as sku,
      r.description,
      r.category,
      alloc.allocated_quantity as qty,
      r.notes,
      r.source_sheet as row_source_sheet,
      r.source_row_number,
      -- Per-allocation batch metadata (rolling: each allocation may differ)
      ib.source_sheet as batch_source_sheet,
      ib.source_file as batch_source_file,
      case
        when nullif(btrim(r.customer_name), '') is not null or nullif(btrim(r.order_number), '') is not null then 0
        else 1
      end as order_group,
      coalesce(nullif(btrim(r.customer_name), ''), nullif(btrim(r.order_number), ''), nullif(btrim(r.sku), ''), 'DataSheet row ' || r.source_row_number::text) as point_name
    from public.demand_planning_allocations alloc
    join public.demand_planning_buckets b
      on b.id = alloc.bucket_id
      and b.draft_id = p_draft_id
      and b.tenant_id = p_tenant_id
    join public.raw_demand_rows r
      on r.id = alloc.raw_demand_row_id
      and r.tenant_id = p_tenant_id
    join public.demand_import_batches ib
      on ib.id = r.batch_id
      and ib.tenant_id = p_tenant_id
    where alloc.draft_id = p_draft_id
      and alloc.tenant_id = p_tenant_id
      and r.planning_status not in ('error', 'special_flow')
      and r.sku is not null
      and nullif(btrim(r.sku), '') is not null
      and alloc.allocated_quantity > 0
    order by
      coalesce(b.distribution_area, '') asc,
      btrim(b.planning_line_name) asc,
      btrim(b.bucket_name) asc,
      case
        when nullif(btrim(r.customer_name), '') is not null or nullif(btrim(r.order_number), '') is not null then 0
        else 1
      end asc,
      coalesce(nullif(btrim(r.customer_name), ''), '') asc,
      coalesce(nullif(btrim(r.order_number), ''), '') asc,
      coalesce(nullif(btrim(r.sku), ''), '') asc,
      r.source_row_number asc
  loop
    -- Detect line change
    if v_prev_line_name is distinct from v_rec.line_name
       or v_prev_dist_area is distinct from v_rec.dist_area then

      v_prev_line_name := v_rec.line_name;
      v_prev_dist_area := v_rec.dist_area;
      v_prev_bucket_name := null;
      v_prev_cust_name := null;
      v_prev_order_num := null;
      v_prev_fallback_sku := null;
      v_prev_fallback_row_num := null;
      v_order_sort := 0;

      -- Try to find existing line
      select id into v_line_id
      from public.manual_shift_lines
      where shift_id = p_target_shift_id
        and deleted_at is null
        and name = v_rec.line_name
        and distribution_area is not distinct from nullif(v_rec.dist_area, '')
      limit 1;

      if v_line_id is null then
        insert into public.manual_shift_lines (
          tenant_id, shift_id, name, sort_order, distribution_area
        )
        values (
          p_tenant_id, p_target_shift_id, v_rec.line_name,
          v_rec.line_sort, nullif(v_rec.dist_area, '')
        )
        returning id into v_line_id;
        v_created_line := true;
      else
        v_created_line := false;
      end if;
    end if;

    -- Detect order change
    if v_prev_bucket_name is distinct from v_rec.bucket_name
       or v_prev_cust_name is distinct from v_rec.cust_name
       or v_prev_order_num is distinct from v_rec.order_num
       or (
         v_rec.order_group = 1
         and (
           v_prev_fallback_sku is distinct from v_rec.sku
           or v_prev_fallback_row_num is distinct from v_rec.source_row_number
         )
       ) then

      v_prev_bucket_name := v_rec.bucket_name;
      v_prev_cust_name := v_rec.cust_name;
      v_prev_order_num := v_rec.order_num;
      if v_rec.order_group = 1 then
        v_prev_fallback_sku := v_rec.sku;
        v_prev_fallback_row_num := v_rec.source_row_number;
      else
        v_prev_fallback_sku := null;
        v_prev_fallback_row_num := null;
      end if;
      v_order_sort := v_order_sort + 1;
      v_item_sort := 0;

      insert into public.manual_shift_orders (
        tenant_id, shift_id, line_id,
        order_number, customer_name, point_name,
        sort_order, size, status,
        raw_route_line, route_base, work_bucket_name, work_bucket_type
      )
      values (
        p_tenant_id, p_target_shift_id, v_line_id,
        v_rec.order_num, v_rec.cust_name, v_rec.point_name,
        v_order_sort, 'unknown', 'queued',
        v_rec.line_name || '/' || v_rec.bucket_name,
        v_rec.line_name, v_rec.bucket_name, null
      )
      returning id into v_order_id;

      insert into public.manual_shift_order_events (
        tenant_id, shift_id, line_id, order_id,
        event_type, actor_profile_id, actor_name,
        from_status, to_status, payload
      )
      values (
        p_tenant_id, p_target_shift_id, v_line_id, v_order_id,
        'created', v_actor_id, v_actor_name,
        null, 'queued',
        jsonb_build_object(
          'source', 'demand_planning_publish',
          'draftId', p_draft_id,
          'targetShiftId', p_target_shift_id,
          'workBucketName', v_rec.bucket_name
        )
      );
    end if;

    -- Insert item for this allocation
    v_item_sort := v_item_sort + 1;

    v_source_rows := array[v_rec.source_row_number];

    insert into public.manual_shift_order_items (
      tenant_id, shift_id, line_id, order_id,
      sku, description, category, quantity, notes, zone,
      source_sheet, source_rows, source_file, sort_order
    )
    values (
      p_tenant_id, p_target_shift_id, v_line_id, v_order_id,
      v_rec.sku,
      nullif(btrim(v_rec.description), ''),
      nullif(btrim(v_rec.category), ''),
      v_rec.qty,
      nullif(btrim(v_rec.notes), ''),
      null,
      -- Use per-allocation batch metadata (from raw_demand_row -> demand_import_batches join)
      nullif(btrim(v_rec.batch_source_sheet), ''),
      v_source_rows,
      nullif(btrim(v_rec.batch_source_file), ''),
      v_item_sort
    )
    returning id into v_item_id;

    -- Emit mapping row for the caller
    allocation_id := v_rec.allocation_id;
    line_id := v_line_id;
    order_id := v_order_id;
    item_id := v_item_id;
    line_created := coalesce(v_created_line, false);
    return next;
  end loop;

  -- Mark draft applied
  update public.demand_planning_drafts
  set status = 'applied'
  where id = p_draft_id and tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.manual_shift_publish_demand_planning_operational_core(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Part 3: Rewrite public publish RPC with rolling validation branch
--
-- Rolling drafts now pass through a validation helper inside the transaction.
-- Batch drafts continue through the existing path unchanged.
-- ═══════════════════════════════════════════════════════════════════════════════

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
