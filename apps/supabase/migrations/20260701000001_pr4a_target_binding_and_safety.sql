-- PR-4A: Target Binding and Safety
--
-- 1. Add target_date, target_shift_id to demand_planning_drafts
-- 2. Block publish when any publishable row has null planned_delivery_date
-- 3. Add tenant authorization check to demand_planning_rolling_publish_validate
-- 4. Draft-target validation helper

-- ═══════════════════════════════════════════════════════════════════════════════
-- Part 1: Add target columns to demand_planning_drafts
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.demand_planning_drafts
  add column if not exists target_date date;

alter table public.demand_planning_drafts
  add column if not exists target_shift_id uuid;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Part 2: Block publish on null planned_delivery_date
--
-- The operational core already detects has_null_date; make it a hard error.
-- Update both the rolling and batch branches inside the publish RPC.
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

  -- PR-4A: Hard block on null planned_delivery_date
  if v_has_null_date then
    raise exception 'DEMAND_PLANNING_NULL_DELIVERY_DATE';
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
      -- Per-allocation batch metadata
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
-- Part 3: Add tenant auth to demand_planning_rolling_publish_validate
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
  -- PR-4A: Tenant authorization check
  if not public.can_manage_tenant(p_tenant_id) then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

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
      sum(ak.allocated_quantity) over (
        partition by ak.fk_order_number, ak.fk_sku, ak.fk_customer_name,
                     ak.fk_distribution_area, ak.fk_delivery_date
      ) as key_requested_total,
      (coalesce(lr.latest_quantity, 0) - coalesce(pbk.published_quantity, 0)) as key_available_total,
      case when ak.current_raw_row_id = lr.latest_row_id then true else false end as is_latest,
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
-- Part 4: Draft-target validation helper
--
-- Validates that the draft's targetDate and targetShiftId are consistent:
--  - If targetShiftId is set, the corresponding shift must exist, be active,
--    and its date must match targetDate (if set).
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.demand_planning_validate_draft_target(
  p_tenant_id uuid,
  p_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_draft public.demand_planning_drafts%rowtype;
  v_shift public.manual_shift_sessions%rowtype;
  v_errors jsonb := '[]'::jsonb;
begin
  if not public.can_manage_tenant(p_tenant_id) then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  select * into v_draft
  from public.demand_planning_drafts
  where id = p_draft_id and tenant_id = p_tenant_id;

  if not found then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_FOUND';
  end if;

  -- If targetShiftId is set, validate shift
  if v_draft.target_shift_id is not null then
    select * into v_shift
    from public.manual_shift_sessions
    where id = v_draft.target_shift_id and tenant_id = p_tenant_id;

    if not found then
      v_errors := v_errors || to_jsonb('{"field":"targetShiftId","code":"SHIFT_NOT_FOUND","message":"Target shift not found."}'::jsonb);
    else
      if v_shift.status <> 'active' then
        v_errors := v_errors || to_jsonb(format('{"field":"targetShiftId","code":"SHIFT_NOT_ACTIVE","message":"Target shift %s is not active."}', v_shift.id)::jsonb);
      end if;

      -- If targetDate is also set, verify consistency
      if v_draft.target_date is not null and v_draft.target_date <> v_shift.date then
        v_errors := v_errors || to_jsonb(format('{"field":"targetDate","code":"TARGET_DATE_MISMATCH","message":"Target date %s does not match shift date %s."}', v_draft.target_date, v_shift.date)::jsonb);
      end if;
    end if;
  end if;

  -- If targetDate is set but no targetShiftId (just informational — valid)
  return jsonb_build_object('valid', jsonb_array_length(v_errors) = 0, 'errors', v_errors);
end;
$$;

revoke all on function public.demand_planning_validate_draft_target(uuid, uuid)
  from public, anon;
grant execute on function public.demand_planning_validate_draft_target(uuid, uuid)
  to authenticated;
