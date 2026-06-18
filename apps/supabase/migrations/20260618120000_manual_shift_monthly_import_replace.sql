-- Description: PR3G — safe monthly re-import / replace mode.
-- Adds p_mode parameter ('initial' | 'replace') to the monthly import RPC.
-- Replace mode: safety-checked soft-delete of existing lines/orders,
-- hard-delete of items/events, then insert new plan.
-- Return type gains replaced_lines, replaced_orders, replaced_items columns.
-- Uses DROP + CREATE because the return type changes.

drop function if exists public.manual_shift_apply_monthly_import(uuid, uuid, date, jsonb);

create function public.manual_shift_apply_monthly_import(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_selected_date date,
  p_plan jsonb,
  p_mode text default 'initial'
)
returns table (
  shift_id uuid,
  selected_date date,
  lines_created integer,
  orders_created integer,
  order_items_created integer,
  replaced_lines integer,
  replaced_orders integer,
  replaced_items integer
)
language plpgsql
security invoker
as $$
declare
  v_shift public.manual_shift_sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_session_actor_id uuid;
  v_session_actor_name text;
  v_line record;
  v_order record;
  v_item record;
  v_created_line_id uuid;
  v_created_order_id uuid;
  v_lines_created integer := 0;
  v_orders_created integer := 0;
  v_order_items_created integer := 0;
  v_replaced_lines integer := 0;
  v_replaced_orders integer := 0;
  v_replaced_items integer := 0;
  v_source_rows integer[];
  v_source_sheet text;
  v_source_file text;
  v_active_lines_count integer := 0;
  v_active_orders_count integer := 0;
  v_soft_deleted_lines_count integer := 0;
  v_soft_deleted_orders_count integer := 0;
  v_non_queued_orders integer := 0;
  v_orders_with_picker integer := 0;
  v_orders_with_checker integer := 0;
  v_check_units_count integer := 0;
  v_non_import_events integer := 0;
begin
  if p_mode not in ('initial', 'replace') then
    raise exception 'INVALID_PREVIEW_PAYLOAD';
  end if;

  v_session_actor_id := auth.uid();
  if v_session_actor_id is null then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;
  if not public.can_manage_tenant(p_tenant_id) then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.id = v_session_actor_id;
  if v_profile.id is null then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;
  v_session_actor_name := coalesce(
    nullif(btrim(v_profile.display_name), ''),
    nullif(btrim(v_profile.email), ''),
    'operator'
  );

  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    raise exception 'INVALID_PREVIEW_PAYLOAD';
  end if;
  if jsonb_typeof(coalesce(p_plan -> 'lines', 'null'::jsonb)) <> 'array' then
    raise exception 'INVALID_PREVIEW_PAYLOAD';
  end if;

  select *
  into v_shift
  from public.manual_shift_sessions s
  where s.id = p_shift_id
    and s.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'SHIFT_NOT_FOUND';
  end if;

  if v_shift.status <> 'active' then
    raise exception 'SHIFT_NOT_ACTIVE';
  end if;

  if v_shift.date <> p_selected_date then
    raise exception 'SHIFT_DATE_MISMATCH';
  end if;

  -- Count active (non-deleted) lines
  select count(*)::int
  into v_active_lines_count
  from public.manual_shift_lines l
  where l.shift_id = p_shift_id
    and l.tenant_id = p_tenant_id
    and l.deleted_at is null;

  -- Count soft-deleted lines (for diagnostics)
  select count(*)::int
  into v_soft_deleted_lines_count
  from public.manual_shift_lines l
  where l.shift_id = p_shift_id
    and l.tenant_id = p_tenant_id
    and l.deleted_at is not null;

  -- Count active (non-deleted) orders
  select count(*)::int
  into v_active_orders_count
  from public.manual_shift_orders o
  where o.shift_id = p_shift_id
    and o.tenant_id = p_tenant_id
    and o.deleted_at is null;

  -- Count soft-deleted orders
  select count(*)::int
  into v_soft_deleted_orders_count
  from public.manual_shift_orders o
  where o.shift_id = p_shift_id
    and o.tenant_id = p_tenant_id
    and o.deleted_at is not null;

  if p_mode = 'initial' then
    -- Original empty-shift guard
    if v_active_lines_count > 0
      or v_active_orders_count > 0
      or exists (
        select 1
        from public.manual_shift_order_items i
        join public.manual_shift_orders o
          on o.id = i.order_id
         and o.shift_id = p_shift_id
         and o.tenant_id = p_tenant_id
         and o.deleted_at is null
        where i.shift_id = p_shift_id
          and i.tenant_id = p_tenant_id
      )
    then
      raise exception 'SHIFT_NOT_EMPTY';
    end if;
  else
    -- Replace mode: safety checks
    if v_active_lines_count = 0 and v_active_orders_count = 0 then
      raise exception 'SHIFT_NOT_EMPTY';
    end if;

    -- Check: no orders in non-queued status
    select count(*)::int
    into v_non_queued_orders
    from public.manual_shift_orders o
    where o.shift_id = p_shift_id
      and o.tenant_id = p_tenant_id
      and o.deleted_at is null
      and o.status <> 'queued';

    if v_non_queued_orders > 0 then
      raise exception 'MONTHLY_REPLACE_NOT_SAFE' using hint = 'orders_started';
    end if;

    -- Check: no picker assigned
    select count(*)::int
    into v_orders_with_picker
    from public.manual_shift_orders o
    where o.shift_id = p_shift_id
      and o.tenant_id = p_tenant_id
      and o.deleted_at is null
      and (o.picker_worker_id is not null or o.picker_name is not null);

    if v_orders_with_picker > 0 then
      raise exception 'MONTHLY_REPLACE_NOT_SAFE' using hint = 'picker_assigned';
    end if;

    -- Check: no checker assigned
    select count(*)::int
    into v_orders_with_checker
    from public.manual_shift_orders o
    where o.shift_id = p_shift_id
      and o.tenant_id = p_tenant_id
      and o.deleted_at is null
      and o.checker_name is not null;

    if v_orders_with_checker > 0 then
      raise exception 'MONTHLY_REPLACE_NOT_SAFE' using hint = 'checker_assigned';
    end if;

    -- Check: no check units exist
    select count(*)::int
    into v_check_units_count
    from public.manual_shift_order_check_units cu
    where cu.shift_id = p_shift_id
      and cu.tenant_id = p_tenant_id;

    if v_check_units_count > 0 then
      raise exception 'MONTHLY_REPLACE_NOT_SAFE' using hint = 'check_units_exist';
    end if;

    -- Check: no non-import operational events (only created/monthly_xlsx_import events are safe)
    select count(*)::int
    into v_non_import_events
    from public.manual_shift_order_events ev
    join public.manual_shift_orders o
      on o.id = ev.order_id
     and o.shift_id = p_shift_id
     and o.tenant_id = p_tenant_id
     and o.deleted_at is null
    where ev.shift_id = p_shift_id
      and ev.tenant_id = p_tenant_id
      and (
        ev.event_type <> 'created'
        or coalesce(ev.payload ->> 'source', '') <> 'monthly_xlsx_import'
      );

    if v_non_import_events > 0 then
      raise exception 'MONTHLY_REPLACE_NOT_SAFE' using hint = 'non_import_events_exist';
    end if;

    -- Replace: soft-delete active lines
    update public.manual_shift_lines
    set deleted_at = timezone('utc', now()),
        deleted_by_profile_id = v_session_actor_id,
        deleted_by_name = v_session_actor_name,
        delete_reason = 'monthly_reimport'
    where shift_id = p_shift_id
      and tenant_id = p_tenant_id
      and deleted_at is null;
    get diagnostics v_replaced_lines = row_count;

    -- Replace: soft-delete active orders
    update public.manual_shift_orders
    set deleted_at = timezone('utc', now()),
        deleted_by_profile_id = v_session_actor_id,
        deleted_by_name = v_session_actor_name,
        delete_reason = 'monthly_reimport'
    where shift_id = p_shift_id
      and tenant_id = p_tenant_id
      and deleted_at is null;
    get diagnostics v_replaced_orders = row_count;

    -- Replace: hard-delete order items (no soft-delete column)
    with deleted_items as (
      delete from public.manual_shift_order_items
      where shift_id = p_shift_id
        and tenant_id = p_tenant_id
      returning id
    )
    select count(*)::int into v_replaced_items from deleted_items;

    -- Replace: hard-delete order events (no soft-delete column)
    delete from public.manual_shift_order_events
    where shift_id = p_shift_id
      and tenant_id = p_tenant_id;
  end if;

  v_source_sheet := nullif(btrim(coalesce(p_plan -> 'preview' -> 'source' ->> 'sheetName', '')), '');
  v_source_file := nullif(btrim(coalesce(p_plan -> 'preview' -> 'source' ->> 'fileName', '')), '');

  for v_line in
    select *
    from jsonb_to_recordset(p_plan -> 'lines') as l(
      "lineName" text,
      "sortOrder" integer,
      "distributionArea" text,
      orders jsonb
    )
    order by l."sortOrder" asc, l."lineName" asc
  loop
    if coalesce(btrim(v_line."lineName"), '') = '' then
      raise exception 'INVALID_PREVIEW_PAYLOAD';
    end if;
    if v_line."sortOrder" is null or v_line."sortOrder" < 1 then
      raise exception 'INVALID_PREVIEW_PAYLOAD';
    end if;
    if v_line.orders is null or jsonb_typeof(v_line.orders) <> 'array' then
      raise exception 'INVALID_PREVIEW_PAYLOAD';
    end if;

    insert into public.manual_shift_lines (
      tenant_id,
      shift_id,
      name,
      sort_order,
      distribution_area
    )
    values (
      p_tenant_id,
      p_shift_id,
      v_line."lineName",
      v_line."sortOrder",
      nullif(btrim(v_line."distributionArea"), '')
    )
    returning id into v_created_line_id;

    v_lines_created := v_lines_created + 1;

    for v_order in
      select *
      from jsonb_to_recordset(v_line.orders) as o(
        "pointName" text,
        "customerName" text,
        "orderNumber" text,
        "totalQuantity" numeric,
        "sourceRows" jsonb,
        "sortOrder" integer,
        items jsonb
      )
      order by o."sortOrder" asc, o."pointName" asc, o."orderNumber" asc
    loop
      if coalesce(btrim(v_order."pointName"), '') = '' then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      if coalesce(btrim(v_order."orderNumber"), '') = '' then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      if v_order."sortOrder" is null or v_order."sortOrder" < 1 then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      if v_order.items is null or jsonb_typeof(v_order.items) <> 'array' then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;

      insert into public.manual_shift_orders (
        tenant_id,
        shift_id,
        line_id,
        order_number,
        customer_name,
        point_name,
        pallet_count,
        picker_worker_id,
        picker_name,
        checker_name,
        line_count,
        sort_order,
        size,
        status
      )
      values (
        p_tenant_id,
        p_shift_id,
        v_created_line_id,
        v_order."orderNumber",
        nullif(btrim(v_order."customerName"), ''),
        v_order."pointName",
        null,
        null,
        null,
        null,
        null,
        v_order."sortOrder",
        'unknown',
        'queued'
      )
      returning id into v_created_order_id;

      v_orders_created := v_orders_created + 1;

      insert into public.manual_shift_order_events (
        tenant_id,
        shift_id,
        line_id,
        order_id,
        event_type,
        actor_profile_id,
        actor_name,
        from_status,
        to_status,
        payload
      )
      values (
        p_tenant_id,
        p_shift_id,
        v_created_line_id,
        v_created_order_id,
        'created',
        v_session_actor_id,
        v_session_actor_name,
        null,
        'queued',
        jsonb_build_object(
          'source', 'monthly_xlsx_import',
          'selectedDate', p_selected_date,
          'pointName', v_order."pointName",
          'orderNumber', v_order."orderNumber",
          'totalQuantity', v_order."totalQuantity"
        )
      );

      for v_item in
        select *
        from jsonb_to_recordset(v_order.items) as i(
          sku text,
          description text,
          category text,
          quantity numeric,
          notes text,
          "sourceRows" jsonb,
          "sortOrder" integer,
          "zone" text
        )
        order by i."sortOrder" asc, i.sku asc
      loop
        if coalesce(btrim(v_item.sku), '') = '' then
          raise exception 'INVALID_PREVIEW_PAYLOAD';
        end if;
        if v_item.quantity is null or v_item.quantity <= 0 then
          raise exception 'INVALID_PREVIEW_PAYLOAD';
        end if;
        if v_item."sortOrder" is null or v_item."sortOrder" < 1 then
          raise exception 'INVALID_PREVIEW_PAYLOAD';
        end if;

        select coalesce(array_agg(value::integer order by ordinality), '{}'::integer[])
        into v_source_rows
        from jsonb_array_elements_text(coalesce(v_item."sourceRows", '[]'::jsonb)) with ordinality as source_rows(value, ordinality);

        if v_source_rows is null or cardinality(v_source_rows) = 0 then
          raise exception 'INVALID_PREVIEW_PAYLOAD';
        end if;

        insert into public.manual_shift_order_items (
          tenant_id,
          shift_id,
          line_id,
          order_id,
          sku,
          description,
          category,
          quantity,
          notes,
          zone,
          source_sheet,
          source_rows,
          source_file,
          sort_order
        )
        values (
          p_tenant_id,
          p_shift_id,
          v_created_line_id,
          v_created_order_id,
          v_item.sku,
          v_item.description,
          v_item.category,
          v_item.quantity,
          v_item.notes,
          nullif(btrim(v_item."zone"), ''),
          v_source_sheet,
          v_source_rows,
          v_source_file,
          v_item."sortOrder"
        );

        v_order_items_created := v_order_items_created + 1;
      end loop;
    end loop;
  end loop;

  return query
  select
    p_shift_id,
    p_selected_date,
    v_lines_created,
    v_orders_created,
    v_order_items_created,
    v_replaced_lines,
    v_replaced_orders,
    v_replaced_items;
end;
$$;

revoke all on function public.manual_shift_apply_monthly_import(uuid, uuid, date, jsonb, text) from public;
revoke all on function public.manual_shift_apply_monthly_import(uuid, uuid, date, jsonb, text) from anon;
revoke all on function public.manual_shift_apply_monthly_import(uuid, uuid, date, jsonb, text) from authenticated;
grant execute on function public.manual_shift_apply_monthly_import(uuid, uuid, date, jsonb, text) to authenticated;
