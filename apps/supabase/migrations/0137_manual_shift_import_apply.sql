-- 0137_manual_shift_import_apply.sql
-- Add deterministic order sorting field and transactional daily import apply RPC.

alter table public.manual_shift_orders
  add column if not exists sort_order integer null;

create or replace function public.manual_shift_apply_daily_import(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_preview jsonb
)
returns table (
  shift_id uuid,
  lines_created integer,
  orders_created integer
)
language plpgsql
security invoker
as $$
declare
  v_shift public.manual_shift_sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_session_actor_id uuid;
  v_session_actor_name text;
  v_import_date date;
  v_line record;
  v_order record;
  v_created_line_id uuid;
  v_lines_created integer := 0;
  v_orders_created integer := 0;
  v_created_order_id uuid;
  v_line_names text[] := '{}';
  v_order_points text[] := '{}';
  v_order_raws text[] := '{}';
  v_line_sort_orders integer[] := '{}';
  v_order_sort_orders integer[] := '{}';
  v_line_name text;
  v_point_name text;
  v_raw_label text;
  v_total_orders integer;
  v_max_lines integer := 100;
  v_max_orders integer := 2000;
  v_max_line_name_len integer := 200;
  v_max_point_name_len integer := 300;
  v_max_raw_label_len integer := 500;
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

  if p_preview is null or jsonb_typeof(p_preview) <> 'object' then
    raise exception 'INVALID_PREVIEW_PAYLOAD';
  end if;
  if not (p_preview ? 'importDate') then
    raise exception 'INVALID_PREVIEW_PAYLOAD';
  end if;
  if jsonb_typeof(p_preview -> 'lines') <> 'array' then
    raise exception 'INVALID_PREVIEW_PAYLOAD';
  end if;

  begin
    v_import_date := (p_preview ->> 'importDate')::date;
  exception
    when others then
      raise exception 'INVALID_PREVIEW_PAYLOAD';
  end;
  if jsonb_array_length(p_preview -> 'lines') < 1 or jsonb_array_length(p_preview -> 'lines') > v_max_lines then
    raise exception 'INVALID_PREVIEW_PAYLOAD';
  end if;

  select coalesce(sum(jsonb_array_length(coalesce(l.orders, '[]'::jsonb))), 0)::integer
  into v_total_orders
  from jsonb_to_recordset(p_preview -> 'lines') as l(
    name text,
    "rawLabel" text,
    "sourceRow" integer,
    "sortOrder" integer,
    orders jsonb
  );
  if v_total_orders < 1 or v_total_orders > v_max_orders then
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

  if v_shift.date <> v_import_date then
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

  for v_line in
    select *
    from jsonb_to_recordset(p_preview -> 'lines') as l(
      name text,
      "rawLabel" text,
      "sourceRow" integer,
      "sortOrder" integer,
      orders jsonb
    )
    order by l."sortOrder" asc, l."sourceRow" asc, l.name asc
  loop
    v_line_name := coalesce(btrim(v_line.name), '');
    if v_line_name = '' then
      raise exception 'INVALID_PREVIEW_PAYLOAD';
    end if;
    if char_length(v_line_name) > v_max_line_name_len then
      raise exception 'INVALID_PREVIEW_PAYLOAD';
    end if;
    if array_position(v_line_names, v_line_name) is not null then
      raise exception 'INVALID_PREVIEW_PAYLOAD';
    end if;
    v_line_names := array_append(v_line_names, v_line_name);

    if v_line."sortOrder" is null or v_line."sortOrder" < 1 then
      raise exception 'INVALID_PREVIEW_PAYLOAD';
    end if;
    if array_position(v_line_sort_orders, v_line."sortOrder") is not null then
      raise exception 'INVALID_PREVIEW_PAYLOAD';
    end if;
    v_line_sort_orders := array_append(v_line_sort_orders, v_line."sortOrder");
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
      v_line.name,
      v_line."sortOrder"
    )
    returning id into v_created_line_id;

    v_lines_created := v_lines_created + 1;
    v_order_points := '{}';
    v_order_raws := '{}';
    v_order_sort_orders := '{}';

    for v_order in
      select *
      from jsonb_to_recordset(v_line.orders) as o(
        "pointName" text,
        "rawLabel" text,
        "sourceRow" integer,
        "sortOrder" integer
      )
      order by o."sortOrder" asc, o."sourceRow" asc, o."pointName" asc
    loop
      v_point_name := coalesce(btrim(v_order."pointName"), '');
      v_raw_label := coalesce(v_order."rawLabel", '');
      if v_point_name = '' then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      if char_length(v_point_name) > v_max_point_name_len then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      if char_length(v_raw_label) > v_max_raw_label_len then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      if array_position(v_order_points, v_point_name) is not null then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      if array_position(v_order_raws, v_raw_label) is not null then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      v_order_points := array_append(v_order_points, v_point_name);
      v_order_raws := array_append(v_order_raws, v_raw_label);

      if v_order."sortOrder" is null or v_order."sortOrder" < 1 then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      if array_position(v_order_sort_orders, v_order."sortOrder") is not null then
        raise exception 'INVALID_PREVIEW_PAYLOAD';
      end if;
      v_order_sort_orders := array_append(v_order_sort_orders, v_order."sortOrder");

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
        null,
        null,
        v_point_name,
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
        'bulk_imported',
        v_session_actor_id,
        v_session_actor_name,
        null,
        'queued',
        jsonb_build_object(
          'raw', v_raw_label,
          'source', 'daily_xlsx_import',
          'sourceRow', v_order."sourceRow"
        )
      );

      v_orders_created := v_orders_created + 1;
    end loop;
  end loop;

  return query
  select
    p_shift_id,
    v_lines_created,
    v_orders_created;
end;
$$;

revoke all on function public.manual_shift_apply_daily_import(uuid, uuid, jsonb) from public;
revoke all on function public.manual_shift_apply_daily_import(uuid, uuid, jsonb) from anon;
revoke all on function public.manual_shift_apply_daily_import(uuid, uuid, jsonb) from authenticated;
grant execute on function public.manual_shift_apply_daily_import(uuid, uuid, jsonb) to authenticated;
