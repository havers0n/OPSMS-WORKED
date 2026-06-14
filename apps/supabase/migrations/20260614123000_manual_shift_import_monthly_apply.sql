-- 20260614123000_manual_shift_import_monthly_apply.sql
-- Description: Transactional monthly import apply RPC using the Batch 2 parser plan.

create or replace function public.manual_shift_apply_monthly_import(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_selected_date date,
  p_plan jsonb
)
returns table (
  shift_id uuid,
  selected_date date,
  lines_created integer,
  orders_created integer,
  order_items_created integer
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
  v_source_rows integer[];
  v_source_sheet text;
  v_source_file text;
begin
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

  if exists (
    select 1
    from public.manual_shift_lines l
    where l.shift_id = p_shift_id
      and l.tenant_id = p_tenant_id
  ) or exists (
    select 1
    from public.manual_shift_orders o
    where o.shift_id = p_shift_id
      and o.tenant_id = p_tenant_id
  ) then
    raise exception 'SHIFT_NOT_EMPTY';
  end if;

  v_source_sheet := nullif(btrim(coalesce(p_plan -> 'preview' -> 'source' ->> 'sheetName', '')), '');
  v_source_file := nullif(btrim(coalesce(p_plan -> 'preview' -> 'source' ->> 'fileName', '')), '');

  for v_line in
    select *
    from jsonb_to_recordset(p_plan -> 'lines') as l(
      "lineName" text,
      "sortOrder" integer,
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
      sort_order
    )
    values (
      p_tenant_id,
      p_shift_id,
      v_line."lineName",
      v_line."sortOrder"
    )
    returning id into v_created_line_id;

    v_lines_created := v_lines_created + 1;

    for v_order in
      select *
      from jsonb_to_recordset(v_line.orders) as o(
        "pointName" text,
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
        null,
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
          "sortOrder" integer
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
          null,
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
    v_order_items_created;
end;
$$;

revoke all on function public.manual_shift_apply_monthly_import(uuid, uuid, date, jsonb) from public;
revoke all on function public.manual_shift_apply_monthly_import(uuid, uuid, date, jsonb) from anon;
revoke all on function public.manual_shift_apply_monthly_import(uuid, uuid, date, jsonb) from authenticated;
grant execute on function public.manual_shift_apply_monthly_import(uuid, uuid, date, jsonb) to authenticated;
