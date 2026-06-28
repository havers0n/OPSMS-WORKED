-- Description: Publish a demand planning draft into operational manual shift tables.
-- Rewrite: function reconstructs publish data from demand_planning_allocations,
-- demand_planning_buckets, and raw_demand_rows inside the transaction.
-- p_plan is removed — no caller-supplied JSON is trusted for operational writes.

drop function if exists public.manual_shift_publish_demand_planning_draft(uuid, uuid, uuid, jsonb);

create or replace function public.manual_shift_publish_demand_planning_draft(
  p_tenant_id uuid,
  p_draft_id uuid,
  p_target_shift_id uuid
)
returns jsonb
language plpgsql
security invoker
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
  v_skipped_error integer;
  v_skipped_special_flow integer;
  v_skipped_no_sku integer;
  v_skipped_zero_qty integer;
  v_total_skipped integer;

  v_created_lines integer := 0;
  v_reused_lines integer := 0;
  v_created_orders integer := 0;
  v_created_items integer := 0;
  v_warnings jsonb := '[]'::jsonb;

  v_prev_line_name text;
  v_prev_dist_area text;
  v_prev_bucket_name text;
  v_prev_cust_name text;
  v_prev_order_num text;
  v_prev_fallback_sku text;
  v_prev_fallback_row_num integer;
  v_line_id uuid;
  v_order_id uuid;
  v_source_rows integer[];

  v_rec record;
  v_order_sort integer := 0;
  v_item_sort integer := 0;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  if not public.can_manage_tenant(p_tenant_id) then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_actor_id;

  if v_profile.id is null then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  v_actor_name := coalesce(
    nullif(btrim(v_profile.display_name), ''),
    nullif(btrim(v_profile.email), ''),
    'operator'
  );

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

  select *
  into v_shift
  from public.manual_shift_sessions
  where id = p_target_shift_id
    and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'SHIFT_NOT_FOUND';
  end if;

  if v_shift.status <> 'active' then
    raise exception 'SHIFT_NOT_ACTIVE';
  end if;

  select *
  into v_batch
  from public.demand_import_batches
  where id = v_draft.batch_id
    and tenant_id = p_tenant_id;

  if not found then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_FOUND';
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
    ), false) as has_null_date,
    count(*) filter (where r.planning_status = 'error') as error_count,
    count(*) filter (where r.planning_status = 'special_flow') as special_flow_count,
    count(*) filter (
      where r.planning_status not in ('error', 'special_flow')
        and (r.sku is null or nullif(btrim(r.sku), '') is null)
    ) as no_sku_count,
    count(*) filter (
      where r.planning_status not in ('error', 'special_flow')
        and r.sku is not null
        and nullif(btrim(r.sku), '') is not null
        and alloc.allocated_quantity <= 0
    ) as zero_qty_count
  into
    v_publishable_count,
    v_distinct_date_count,
    v_first_date,
    v_has_null_date,
    v_skipped_error,
    v_skipped_special_flow,
    v_skipped_no_sku,
    v_skipped_zero_qty
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

  if v_has_null_date then
    v_warnings := v_warnings || to_jsonb('Allocated publishable rows contain null planned delivery dates alongside valid dates.'::text);
  end if;

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

  v_total_skipped := v_skipped_error + v_skipped_special_flow + v_skipped_no_sku + v_skipped_zero_qty;

  -- Phase 2: iterate over publishable allocations grouped by line and order
  for v_rec in
    select
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
      select id
      into v_line_id
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
        v_created_lines := v_created_lines + 1;
      else
        v_reused_lines := v_reused_lines + 1;
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

      v_created_orders := v_created_orders + 1;

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
      nullif(btrim(v_batch.source_sheet), ''),
      v_source_rows,
      nullif(btrim(v_batch.source_file), ''),
      v_item_sort
    );

    v_created_items := v_created_items + 1;
  end loop;

  -- Phase 3: mark draft applied
  update public.demand_planning_drafts
  set status = 'applied'
  where id = p_draft_id
    and tenant_id = p_tenant_id;

  -- Phase 4: return summary
  return jsonb_build_object(
    'shiftId', p_target_shift_id,
    'draftId', p_draft_id,
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

grant execute on function public.manual_shift_publish_demand_planning_draft(uuid, uuid, uuid) to authenticated;
