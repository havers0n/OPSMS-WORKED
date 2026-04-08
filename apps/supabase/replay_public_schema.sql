--
-- PostgreSQL database dump
--

\restrict am4aCmOpUKwoQtImfkbnKSt3H77TSxkNblJPyLRAdLDU83wqTVfBXT5hCbLmy7k

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: allocate_pick_steps(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.allocate_pick_steps(task_uuid uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  task_row            record;
  step_row            record;
  iu_row              record;
  allocated_count     int := 0;
  replenishment_count int := 0;
begin
  -- Validate: task must exist and caller must be a tenant manager.
  select pt.id, pt.tenant_id
  into   task_row
  from   public.pick_tasks pt
  where  pt.id = task_uuid
    and  public.can_manage_tenant(pt.tenant_id);

  if task_row.id is null then
    raise exception 'PICK_TASK_NOT_FOUND';
  end if;

  -- Process each pending, unallocated step in sequence_no order.
  -- Steps without a resolvable product_id (null on the order_line) are
  -- excluded from this loop; they remain pending until product resolution
  -- is corrected upstream.
  for step_row in
    select
      ps.id          as step_id,
      ps.qty_required,
      ol.product_id
    from  public.pick_steps  ps
    join  public.order_lines ol on ol.id = ps.order_line_id
    where ps.task_id            = task_uuid
      and ps.status             = 'pending'
      and ps.inventory_unit_id  is null
      and ol.product_id         is not null
    order by ps.sequence_no
  loop

    -- Find the best available inventory_unit for this product in a
    -- published primary_pick location.
    --
    -- SKIP LOCKED: if a concurrent allocate_pick_steps call for another task
    -- has already locked this inventory_unit row, skip it and try the next
    -- FIFO candidate instead of blocking.
    select
      iu.id              as inventory_unit_id,
      iu.container_id    as source_container_id,
      l.geometry_slot_id as source_cell_id
    into iu_row
    from  public.inventory_unit           iu
    join  public.containers               c
      on  c.id                 = iu.container_id
     and  c.tenant_id          = task_row.tenant_id
     and  c.current_location_id is not null
    join  public.locations                l
      on  l.id                 = c.current_location_id
     and  l.tenant_id          = task_row.tenant_id
     and  l.status             = 'active'
    join  public.product_location_roles   plr
      on  plr.location_id      = l.id
     and  plr.product_id       = step_row.product_id
     and  plr.role             = 'primary_pick'
     and  plr.state            = 'published'
     and  plr.tenant_id        = task_row.tenant_id
    where iu.product_id        = step_row.product_id
      and iu.status            = 'available'
      and iu.quantity          >= step_row.qty_required
      and iu.tenant_id         = task_row.tenant_id
    order by iu.created_at asc
    limit 1
    for update of iu skip locked;

    if iu_row.inventory_unit_id is null then
      -- No eligible stock in any primary_pick location for this product.
      update public.pick_steps
      set    status = 'needs_replenishment'
      where  id     = step_row.step_id;

      replenishment_count := replenishment_count + 1;
    else
      -- Write source truth onto the step.
      -- inventory_unit_id links execution (PR3) to the exact unit to pick.
      update public.pick_steps
      set
        inventory_unit_id   = iu_row.inventory_unit_id,
        source_container_id = iu_row.source_container_id,
        source_cell_id      = iu_row.source_cell_id
      where id = step_row.step_id;

      allocated_count := allocated_count + 1;
    end if;

  end loop;

  return jsonb_build_object(
    'taskId',             task_uuid,
    'allocated',          allocated_count,
    'needsReplenishment', replenishment_count
  );
end
$$;


--
-- Name: attach_order_to_wave(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.attach_order_to_wave(wave_uuid uuid, order_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  wave_row public.waves%rowtype;
  order_row public.orders%rowtype;
begin
  -- Lock wave first, then order.
  -- This ordering is intentional and matches existing release_wave flow
  -- (wave -> orders) to reduce deadlock risk across concurrent wave ops.
  select *
  into wave_row
  from public.waves
  where id = wave_uuid
  for update;

  if wave_row.id is null then
    raise exception 'WAVE_NOT_FOUND';
  end if;

  if wave_row.status not in ('draft', 'ready') then
    raise exception 'WAVE_MEMBERSHIP_LOCKED';
  end if;

  -- Lock the order row in the same transaction so attachability checks and
  -- membership write are evaluated against a single, race-safe snapshot.
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if order_row.wave_id = wave_uuid then
    raise exception 'ORDER_ALREADY_IN_WAVE';
  end if;

  if order_row.wave_id is not null then
    raise exception 'ORDER_ALREADY_IN_WAVE';
  end if;

  if order_row.status not in ('draft', 'ready') then
    raise exception 'ORDER_NOT_ATTACHABLE';
  end if;

  if order_row.tenant_id <> wave_row.tenant_id then
    raise exception 'TENANT_MISMATCH';
  end if;

  update public.orders
  set wave_id = wave_uuid
  where id = order_row.id;

  return order_row.id;
end
$$;


--
-- Name: backfill_locations_from_published_cells(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backfill_locations_from_published_cells() RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
  inserted_count integer := 0;
begin
  insert into public.locations (
    tenant_id,
    floor_id,
    code,
    location_type,
    geometry_slot_id,
    capacity_mode,
    status,
    sort_order
  )
  select
    s.tenant_id,
    f.id,
    c.address,
    'rack_slot',
    c.id,
    'single_container',
    'active',
    null
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  left join public.locations l on l.geometry_slot_id = c.id
  where lv.state = 'published'
    and l.id is null;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end
$$;


--
-- Name: build_cell_address(text, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_cell_address(rack_display_code text, face_side text, section_ordinal integer, level_ordinal integer, slot_no integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select public.pad_2(rack_display_code) || '-' || face_side || '.' || public.pad_2(section_ordinal::text) || '.' || public.pad_2(level_ordinal::text) || '.' || public.pad_2(slot_no::text);
$$;


--
-- Name: build_cell_code(uuid, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_cell_code(rack_uuid uuid, face_side text, section_ordinal integer, level_ordinal integer, slot_no integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select 'cell_' || substr(md5(rack_uuid::text || ':' || face_side || ':' || section_ordinal::text || ':' || level_ordinal::text || ':' || slot_no::text), 1, 24);
$$;


--
-- Name: can_access_cell(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_cell(cell_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.cells c
    join public.layout_versions lv on lv.id = c.layout_version_id
    where c.id = cell_uuid
      and public.can_access_floor(lv.floor_id)
  )
$$;


--
-- Name: can_access_container(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_container(container_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.containers c
    where c.id = container_uuid
      and public.can_access_tenant(c.tenant_id)
  )
$$;


--
-- Name: can_access_floor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_floor(floor_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.floors f
    join public.sites s on s.id = f.site_id
    where f.id = floor_uuid
      and public.can_access_tenant(s.tenant_id)
  )
$$;


--
-- Name: can_access_inventory_unit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_inventory_unit(inventory_unit_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.inventory_unit iu
    where iu.id = inventory_unit_uuid
      and public.can_access_tenant(iu.tenant_id)
  )
$$;


--
-- Name: can_access_layout_version(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_layout_version(layout_version_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.layout_versions lv
    where lv.id = layout_version_uuid
      and public.can_access_floor(lv.floor_id)
  )
$$;


--
-- Name: can_access_location(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_location(location_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.locations l
    where l.id = location_uuid
      and public.can_access_tenant(l.tenant_id)
  )
$$;


--
-- Name: can_access_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_order(order_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.orders o
    where o.id = order_uuid
      and public.can_access_tenant(o.tenant_id)
  )
$$;


--
-- Name: can_access_pick_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_pick_task(pick_task_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.pick_tasks pt
    where pt.id = pick_task_uuid
      and public.can_access_tenant(pt.tenant_id)
  )
$$;


--
-- Name: can_access_product_location_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_product_location_role(plr_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.product_location_roles plr
    where plr.id = plr_uuid
      and public.can_access_tenant(plr.tenant_id)
  )
$$;


--
-- Name: can_access_rack(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_rack(rack_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.racks r
    where r.id = rack_uuid
      and public.can_access_layout_version(r.layout_version_id)
  )
$$;


--
-- Name: can_access_site(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_site(site_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.sites s
    where s.id = site_uuid
      and public.can_access_tenant(s.tenant_id)
  )
$$;


--
-- Name: can_access_stock_movement(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_stock_movement(stock_movement_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.stock_movements sm
    where sm.id = stock_movement_uuid
      and public.can_access_tenant(sm.tenant_id)
  )
$$;


--
-- Name: can_access_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_tenant(tenant_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = tenant_uuid
        and tm.profile_id = auth.uid()
    )
$$;


--
-- Name: can_access_wave(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_wave(wave_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.waves w
    where w.id = wave_uuid
      and public.can_access_tenant(w.tenant_id)
  )
$$;


--
-- Name: can_manage_container(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_container(container_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.containers c
    where c.id = container_uuid
      and public.can_manage_tenant(c.tenant_id)
  )
$$;


--
-- Name: can_manage_floor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_floor(floor_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.floors f
    join public.sites s on s.id = f.site_id
    where f.id = floor_uuid
      and public.can_manage_tenant(s.tenant_id)
  )
$$;


--
-- Name: can_manage_inventory_unit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_inventory_unit(inventory_unit_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.inventory_unit iu
    where iu.id = inventory_unit_uuid
      and public.can_manage_tenant(iu.tenant_id)
  )
$$;


--
-- Name: can_manage_layout_version(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_layout_version(layout_version_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.layout_versions lv
    where lv.id = layout_version_uuid
      and public.can_manage_floor(lv.floor_id)
  )
$$;


--
-- Name: can_manage_location(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_location(location_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.locations l
    where l.id = location_uuid
      and public.can_manage_tenant(l.tenant_id)
  )
$$;


--
-- Name: can_manage_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_order(order_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.orders o
    where o.id = order_uuid
      and public.can_manage_tenant(o.tenant_id)
  )
$$;


--
-- Name: can_manage_pick_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_pick_task(pick_task_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.pick_tasks pt
    where pt.id = pick_task_uuid
      and public.can_manage_tenant(pt.tenant_id)
  )
$$;


--
-- Name: can_manage_product_location_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_product_location_role(plr_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.product_location_roles plr
    where plr.id = plr_uuid
      and public.can_manage_tenant(plr.tenant_id)
  )
$$;


--
-- Name: can_manage_rack(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_rack(rack_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.racks r
    where r.id = rack_uuid
      and public.can_manage_layout_version(r.layout_version_id)
  )
$$;


--
-- Name: can_manage_site(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_site(site_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.sites s
    where s.id = site_uuid
      and public.can_manage_tenant(s.tenant_id)
  )
$$;


--
-- Name: can_manage_stock_movement(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_stock_movement(stock_movement_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.stock_movements sm
    where sm.id = stock_movement_uuid
      and public.can_manage_tenant(sm.tenant_id)
  )
$$;


--
-- Name: can_manage_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_tenant(tenant_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = tenant_uuid
        and tm.profile_id = auth.uid()
        and tm.role = 'tenant_admin'
    )
$$;


--
-- Name: can_manage_wave(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_wave(wave_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.waves w
    where w.id = wave_uuid
      and public.can_manage_tenant(w.tenant_id)
  )
$$;


--
-- Name: can_publish_floor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_publish_floor(floor_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select public.can_manage_floor(floor_uuid)
$$;


--
-- Name: cancel_order_with_unreserve(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_order_with_unreserve(order_uuid uuid, reason text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  order_row public.orders%rowtype;
  actor_uuid uuid := auth.uid();
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status in ('closed', 'cancelled') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  update public.order_reservations
  set status = 'cancelled',
      cancelled_at = timezone('utc', now()),
      cancelled_by = actor_uuid,
      cancel_reason = nullif(trim(coalesce(reason, '')), '')
  where order_id = order_uuid
    and status in ('active', 'released');

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.orders
  set status = 'cancelled'
  where id = order_uuid;

  return order_uuid;
end
$$;


--
-- Name: close_order_with_unreserve(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_order_with_unreserve(order_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  order_row public.orders%rowtype;
  actor_uuid uuid := auth.uid();
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status not in ('picked', 'partial') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  update public.order_reservations
  set status = 'closed',
      closed_at = timezone('utc', now()),
      closed_by = actor_uuid
  where order_id = order_uuid
    and status in ('active', 'released');

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.orders
  set status = 'closed',
      closed_at = coalesce(closed_at, timezone('utc', now()))
  where id = order_uuid;

  return order_uuid;
end
$$;


--
-- Name: commit_order_reservations(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commit_order_reservations(order_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  order_row public.orders%rowtype;
  actor_uuid uuid := auth.uid();
  line_count integer;
  product_uuid uuid;
  required_qty numeric;
  physical_qty numeric;
  reserved_qty numeric;
  atp_qty numeric;
  shortage_sku text;
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status <> 'draft' then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  perform 1
  from public.order_lines ol
  where ol.order_id = order_uuid
  for update;
  get diagnostics line_count = row_count;

  if line_count = 0 then
    raise exception 'ORDER_HAS_NO_LINES';
  end if;

  if exists (
    select 1
    from public.order_lines ol
    where ol.order_id = order_uuid
      and ol.product_id is null
  ) then
    raise exception 'ORDER_LINE_PRODUCT_REQUIRED';
  end if;

  perform public.lock_order_reservation_products(
    order_row.tenant_id,
    array(
      select distinct ol.product_id
      from public.order_lines ol
      where ol.order_id = order_uuid
        and ol.product_id is not null
      order by ol.product_id
    )
  );

  for product_uuid, required_qty, shortage_sku in
    select ol.product_id, sum(ol.qty_required)::numeric, min(ol.sku)
    from public.order_lines ol
    where ol.order_id = order_uuid
    group by ol.product_id
    order by ol.product_id
  loop
    physical_qty := public.order_physical_available_qty(order_row.tenant_id, product_uuid);
    reserved_qty := public.order_reserved_qty(order_row.tenant_id, product_uuid);
    atp_qty := physical_qty - reserved_qty;

    if required_qty > atp_qty then
      raise exception 'INSUFFICIENT_STOCK'
        using detail = json_build_object(
          'shortage',
          json_build_object(
            'sku', shortage_sku,
            'required', required_qty,
            'physical', physical_qty,
            'reserved', reserved_qty,
            'atp', atp_qty
          )
        )::text;
    end if;
  end loop;

  insert into public.order_reservations (
    tenant_id,
    order_id,
    order_line_id,
    product_id,
    quantity,
    status,
    created_by
  )
  select
    ol.tenant_id,
    ol.order_id,
    ol.id,
    ol.product_id,
    ol.qty_required,
    'active',
    actor_uuid
  from public.order_lines ol
  where ol.order_id = order_uuid;

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.orders
  set status = 'ready'
  where id = order_uuid;

  return order_uuid;
end
$$;


--
-- Name: create_layout_draft(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_layout_draft(floor_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
declare
  existing_draft_uuid uuid;
  published_version   record;
  new_version_uuid    uuid;
  new_version_no      integer;
begin
  if auth.uid() is not null and not public.can_manage_floor(floor_uuid) then
    raise exception 'Forbidden';
  end if;

  select id into existing_draft_uuid
  from public.layout_versions
  where floor_id = floor_uuid and state = 'draft'
  limit 1;

  if existing_draft_uuid is not null then
    return existing_draft_uuid;
  end if;

  select * into published_version
  from public.layout_versions
  where floor_id = floor_uuid and state = 'published'
  order by version_no desc limit 1;

  select coalesce(max(version_no), 0) + 1 into new_version_no
  from public.layout_versions where floor_id = floor_uuid;

  insert into public.layout_versions (floor_id, version_no, state, parent_published_version_id, created_by)
  values (floor_uuid, new_version_no, 'draft', published_version.id, actor_uuid)
  returning id into new_version_uuid;

  if published_version.id is null then
    perform public.write_layout_event(
      'layout_draft_created', 'succeeded',
      new_version_uuid, 'layout_version', new_version_uuid,
      actor_uuid, jsonb_build_object('mode', 'empty')
    );
    return new_version_uuid;
  end if;

  insert into public.layout_zones (
    id, layout_version_id, code, name, category, color, x, y, width, height
  )
  select
    gen_random_uuid(),
    new_version_uuid,
    z.code,
    z.name,
    z.category,
    z.color,
    z.x,
    z.y,
    z.width,
    z.height
  from public.layout_zones z
  where z.layout_version_id = published_version.id;

  insert into public.layout_walls (
    id, layout_version_id, code, name, wall_type,
    x1, y1, x2, y2, blocks_rack_placement
  )
  select
    gen_random_uuid(),
    new_version_uuid,
    w.code,
    w.name,
    w.wall_type,
    w.x1,
    w.y1,
    w.x2,
    w.y2,
    w.blocks_rack_placement
  from public.layout_walls w
  where w.layout_version_id = published_version.id;

  drop table if exists _draft_rack_map;
  create temp table _draft_rack_map(old_id uuid primary key, new_id uuid not null) on commit drop;
  drop table if exists _draft_face_map;
  create temp table _draft_face_map(old_id uuid primary key, new_id uuid not null, old_mirror_source_face_id uuid) on commit drop;
  drop table if exists _draft_section_map;
  create temp table _draft_section_map(old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _draft_rack_map (old_id, new_id)
  select id, gen_random_uuid() from public.racks where layout_version_id = published_version.id;

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  select m.new_id, new_version_uuid, r.display_code, r.kind, r.axis, r.x, r.y, r.total_length, r.depth, r.rotation_deg, 'draft'
  from public.racks r join _draft_rack_map m on m.old_id = r.id;

  insert into _draft_face_map (old_id, new_id, old_mirror_source_face_id)
  select rf.id, gen_random_uuid(), rf.mirror_source_face_id
  from public.rack_faces rf join _draft_rack_map m on m.old_id = rf.rack_id;

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length)
  select fm.new_id, rm.new_id, rf.side, rf.enabled, rf.slot_numbering_direction, false, null, rf.face_length
  from public.rack_faces rf
  join _draft_rack_map rm on rm.old_id = rf.rack_id
  join _draft_face_map fm on fm.old_id = rf.id;

  update public.rack_faces
  set is_mirrored = true, mirror_source_face_id = fm_src.new_id
  from _draft_face_map fm join _draft_face_map fm_src on fm_src.old_id = fm.old_mirror_source_face_id
  where public.rack_faces.id = fm.new_id and fm.old_mirror_source_face_id is not null;

  insert into _draft_section_map (old_id, new_id)
  select rs.id, gen_random_uuid() from public.rack_sections rs join _draft_face_map fm on fm.old_id = rs.rack_face_id;

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  select sm.new_id, fm.new_id, rs.ordinal, rs.length
  from public.rack_sections rs
  join _draft_face_map fm on fm.old_id = rs.rack_face_id
  join _draft_section_map sm on sm.old_id = rs.id;

  insert into public.rack_levels (rack_section_id, ordinal, slot_count)
  select sm.new_id, rl.ordinal, rl.slot_count
  from public.rack_levels rl join _draft_section_map sm on sm.old_id = rl.rack_section_id;

  perform public.write_layout_event(
    'layout_draft_created', 'succeeded',
    new_version_uuid, 'layout_version', new_version_uuid,
    actor_uuid, jsonb_build_object('mode', 'cloned', 'parentPublishedVersionId', published_version.id)
  );

  return new_version_uuid;
end;
$$;


--
-- Name: current_profile_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_profile_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select auth.uid()
$$;


--
-- Name: detach_order_from_wave(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detach_order_from_wave(wave_uuid uuid, order_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  wave_row public.waves%rowtype;
  order_row public.orders%rowtype;
begin
  -- Lock wave first, then order (same reasoning as attach_order_to_wave).
  select *
  into wave_row
  from public.waves
  where id = wave_uuid
  for update;

  if wave_row.id is null then
    raise exception 'WAVE_NOT_FOUND';
  end if;

  if wave_row.status not in ('draft', 'ready') then
    raise exception 'WAVE_MEMBERSHIP_LOCKED';
  end if;

  -- Order lock is required so in-wave validation and detach write are atomic
  -- under concurrent attach/detach attempts for the same order.
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if order_row.wave_id is distinct from wave_uuid then
    raise exception 'ORDER_NOT_IN_WAVE';
  end if;

  if order_row.status not in ('draft', 'ready') then
    raise exception 'ORDER_NOT_DETACHABLE';
  end if;

  if order_row.tenant_id <> wave_row.tenant_id then
    raise exception 'TENANT_MISMATCH';
  end if;

  update public.orders
  set wave_id = null
  where id = order_row.id;

  return order_row.id;
end
$$;


--
-- Name: execute_pick_step(uuid, integer, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.execute_pick_step(step_uuid uuid, qty_actual integer, pick_container_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  step_row                    record;
  task_row                    record;
  iu_row                      record;
  pick_result                 jsonb;
  new_step_status             text;
  new_task_status             text;
  new_order_status            text := null;
  new_wave_status             text := null;
  total_steps                 int;
  terminal_steps              int;
  exception_steps             int;
  order_task_count            int;
  order_terminal_task_count   int;
  order_exception_task_count  int;
  wave_id_val                 uuid := null;
  wave_task_count             int;
  wave_terminal_task_count    int;
  wave_exception_task_count   int;
  now_utc                     timestamptz := timezone('utc', now());
begin
  -- ── Step 1: lock and load the step ─────────────────────────────────────────
  select
    ps.id,
    ps.task_id,
    ps.tenant_id,
    ps.order_id,
    ps.order_line_id,
    ps.inventory_unit_id,
    ps.pick_container_id,
    ps.qty_required,
    ps.qty_picked,
    ps.status,
    ps.source_container_id,
    ps.source_cell_id,
    ps.sequence_no
  into step_row
  from public.pick_steps ps
  where ps.id = step_uuid
  for update;

  if step_row.id is null then
    raise exception 'PICK_STEP_NOT_FOUND';
  end if;

  -- ── Step 2: tenant auth via task ────────────────────────────────────────────
  select
    pt.id,
    pt.tenant_id,
    pt.source_type,
    pt.source_id,
    pt.status
  into task_row
  from public.pick_tasks pt
  where pt.id = step_row.task_id
    and public.can_manage_tenant(pt.tenant_id);

  if task_row.id is null then
    raise exception 'PICK_TASK_NOT_FOUND';
  end if;

  -- ── Step 3: executability guards ───────────────────────────────────────────
  if step_row.status <> 'pending' then
    raise exception 'PICK_STEP_NOT_EXECUTABLE';
  end if;

  if step_row.inventory_unit_id is null then
    raise exception 'PICK_STEP_NOT_ALLOCATED';
  end if;

  if qty_actual <= 0 then
    raise exception 'INVALID_PICK_QUANTITY';
  end if;

  -- ── Step 4: validate source inventory unit ─────────────────────────────────
  select iu.id, iu.quantity, iu.status, iu.tenant_id
  into iu_row
  from public.inventory_unit iu
  where iu.id    = step_row.inventory_unit_id
    and iu.tenant_id = task_row.tenant_id;

  if iu_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  if iu_row.status <> 'available' then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_AVAILABLE';
  end if;

  if qty_actual > iu_row.quantity then
    raise exception 'PICK_QUANTITY_EXCEEDS_AVAILABLE';
  end if;

  -- ── Step 5: determine step outcome ─────────────────────────────────────────
  if qty_actual >= step_row.qty_required then
    new_step_status := 'picked';
  else
    new_step_status := 'partial';
  end if;

  -- ── Step 6: execute inventory movement ─────────────────────────────────────
  if qty_actual < iu_row.quantity then
    -- Partial depletion: split quantity into pick container
    pick_result := public.pick_partial_inventory_unit(
      step_row.inventory_unit_id,
      qty_actual::numeric,
      pick_container_uuid,
      actor_uuid
    );
  else
    -- Full depletion: move entire unit to pick container
    pick_result := public.pick_full_inventory_unit(
      step_row.inventory_unit_id,
      pick_container_uuid,
      actor_uuid
    );
  end if;

  -- ── Step 7: update the step ─────────────────────────────────────────────────
  update public.pick_steps
  set status            = new_step_status,
      qty_picked        = qty_actual,
      pick_container_id = pick_container_uuid,
      executed_at       = now_utc,
      executed_by       = actor_uuid
  where id = step_uuid;

  -- ── Step 8: task rollup ─────────────────────────────────────────────────────
  -- Reading step counts AFTER the update above — PostgreSQL read-your-own-writes
  -- guarantees the new status is visible within this transaction.
  select
    count(*)                                                        as total,
    count(*) filter (where status in (
      'picked', 'partial', 'skipped', 'exception', 'needs_replenishment'
    ))                                                              as terminal,
    count(*) filter (where status in (
      'partial', 'skipped', 'exception', 'needs_replenishment'
    ))                                                              as exceptions
  into total_steps, terminal_steps, exception_steps
  from public.pick_steps
  where task_id = task_row.id;

  if terminal_steps = total_steps then
    if exception_steps > 0 then
      new_task_status := 'completed_with_exceptions';
    else
      new_task_status := 'completed';
    end if;
  else
    new_task_status := 'in_progress';
  end if;

  update public.pick_tasks
  set status       = new_task_status,
      started_at   = coalesce(started_at, now_utc),
      completed_at = case
        when new_task_status in ('completed', 'completed_with_exceptions')
        then now_utc
        else completed_at
      end
  where id = task_row.id;

  -- ── Step 9: order rollup ────────────────────────────────────────────────────
  -- Only attempt when the task just became terminal AND it belongs to an order.
  if new_task_status in ('completed', 'completed_with_exceptions')
     and task_row.source_type = 'order'
  then
    select
      count(*),
      count(*) filter (where status in ('completed', 'completed_with_exceptions')),
      count(*) filter (where status = 'completed_with_exceptions')
    into order_task_count, order_terminal_task_count, order_exception_task_count
    from public.pick_tasks
    where source_type = 'order'
      and source_id   = task_row.source_id
      and tenant_id   = task_row.tenant_id;

    if order_terminal_task_count = order_task_count then
      if order_exception_task_count > 0 then
        new_order_status := 'partial';
      else
        new_order_status := 'picked';
      end if;

      update public.orders
      set status = new_order_status
      where id         = task_row.source_id
        and tenant_id  = task_row.tenant_id;
    end if;
  end if;

  -- ── Step 10: wave rollup ────────────────────────────────────────────────────
  -- Only attempt when the order just transitioned to a terminal state.
  if new_order_status is not null then
    select o.wave_id
    into wave_id_val
    from public.orders o
    where o.id        = task_row.source_id
      and o.tenant_id = task_row.tenant_id;

    if wave_id_val is not null then
      -- Count all pick tasks whose source order belongs to this wave.
      select
        count(pt.id),
        count(pt.id) filter (where pt.status in ('completed', 'completed_with_exceptions')),
        count(pt.id) filter (where pt.status = 'completed_with_exceptions')
      into wave_task_count, wave_terminal_task_count, wave_exception_task_count
      from public.pick_tasks pt
      join public.orders o
        on  pt.source_type = 'order'
        and pt.source_id   = o.id
        and o.wave_id      = wave_id_val
      where pt.tenant_id = task_row.tenant_id;

      if wave_task_count > 0 and wave_terminal_task_count = wave_task_count then
        if wave_exception_task_count > 0 then
          new_wave_status := 'partial';
        else
          new_wave_status := 'completed';
        end if;

        update public.waves
        set status = new_wave_status
        where id        = wave_id_val
          and tenant_id = task_row.tenant_id;
      end if;
    end if;
  end if;

  -- ── Return ─────────────────────────────────────────────────────────────────
  return jsonb_build_object(
    'stepId',       step_uuid,
    'status',       new_step_status,
    'qtyPicked',    qty_actual,
    'taskId',       task_row.id,
    'taskStatus',   new_task_status,
    'orderStatus',  new_order_status,
    'waveStatus',   new_wave_status,
    'movementId',   pick_result ->> 'transferMovementId'
  );
end
$$;


--
-- Name: generate_container_system_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_container_system_code() RETURNS text
    LANGUAGE sql
    AS $$
  select 'CNT-' || lpad(nextval('public.container_system_code_seq')::text, 6, '0')
$$;


--
-- Name: generate_pick_task_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_pick_task_number() RETURNS text
    LANGUAGE sql
    AS $$
  select 'TSK-' || lpad(nextval('public.pick_task_number_seq')::text, 6, '0')
$$;


--
-- Name: get_container_gross_weight(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_container_gross_weight(container_uuid uuid) RETURNS bigint
    LANGUAGE plpgsql STABLE
    AS $$
declare
  container_row record;
  missing_product_weight_exists boolean := false;
  inventory_weight numeric := 0;
begin
  select
    c.id,
    c.tenant_id,
    ct.tare_weight_g
  into container_row
  from public.containers c
  join public.container_types ct on ct.id = c.container_type_id
  where c.id = container_uuid;

  if container_row.id is null then
    return null;
  end if;

  if container_row.tare_weight_g is null then
    return null;
  end if;

  select exists (
    select 1
    from public.inventory_unit iu
    left join public.products p on p.id = iu.product_id
    where iu.container_id = container_uuid
      and p.unit_weight_g is null
  )
  into missing_product_weight_exists;

  if missing_product_weight_exists then
    return null;
  end if;

  select coalesce(sum(iu.quantity * p.unit_weight_g), 0)
  into inventory_weight
  from public.inventory_unit iu
  join public.products p on p.id = iu.product_id
  where iu.container_id = container_uuid;

  return container_row.tare_weight_g + inventory_weight::bigint;
end
$$;


--
-- Name: get_layout_bundle(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_layout_bundle(layout_version_uuid uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if layout_version_uuid is null then
    raise exception 'layout_version_uuid is required';
  end if;

  if not exists (
    select 1 from public.layout_versions where id = layout_version_uuid
  ) then
    raise exception 'Layout version % not found', layout_version_uuid;
  end if;

  if not public.can_access_layout_version(layout_version_uuid) then
    raise exception 'Permission denied for layout version %', layout_version_uuid;
  end if;

  return (
    select jsonb_build_object(
      'layoutVersionId', lv.id,
      'floorId',         lv.floor_id,
      'state',           lv.state,
      'versionNo',       lv.version_no,
      'draftVersion',    lv.draft_version,
      'publishedAt',     lv.published_at,
      'zones', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',       z.id,
          'code',     z.code,
          'name',     z.name,
          'category', z.category,
          'color',    z.color,
          'x',        z.x,
          'y',        z.y,
          'width',    z.width,
          'height',   z.height
        ) order by z.code)
        from public.layout_zones z
        where z.layout_version_id = lv.id
      ), '[]'::jsonb),
      'walls', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',                  w.id,
          'code',                w.code,
          'name',                w.name,
          'wallType',            w.wall_type,
          'x1',                  w.x1,
          'y1',                  w.y1,
          'x2',                  w.x2,
          'y2',                  w.y2,
          'blocksRackPlacement', w.blocks_rack_placement
        ) order by w.code)
        from public.layout_walls w
        where w.layout_version_id = lv.id
      ), '[]'::jsonb),
      'racks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',           r.id,
          'displayCode',  r.display_code,
          'kind',         r.kind,
          'axis',         r.axis,
          'x',            r.x,
          'y',            r.y,
          'totalLength',  r.total_length,
          'depth',        r.depth,
          'rotationDeg',  r.rotation_deg,
          'faces', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',                     rf.id,
              'side',                   rf.side,
              'enabled',                rf.enabled,
              'slotNumberingDirection', rf.slot_numbering_direction,
              'faceLength',             rf.face_length,
              'isMirrored',             rf.is_mirrored,
              'mirrorSourceFaceId',     rf.mirror_source_face_id,
              'sections', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'id',      rs.id,
                  'ordinal', rs.ordinal,
                  'length',  rs.length,
                  'levels', coalesce((
                    select jsonb_agg(jsonb_build_object(
                      'id',        rl.id,
                      'ordinal',   rl.ordinal,
                      'slotCount', rl.slot_count
                    ) order by rl.ordinal)
                    from public.rack_levels rl
                    where rl.rack_section_id = rs.id
                  ), '[]'::jsonb)
                ) order by rs.ordinal)
                from public.rack_sections rs
                where rs.rack_face_id = rf.id
              ), '[]'::jsonb)
            ) order by rf.side)
            from public.rack_faces rf
            where rf.rack_id = r.id
          ), '[]'::jsonb)
        ) order by r.display_code)
        from public.racks r
        where r.layout_version_id = lv.id
      ), '[]'::jsonb)
    )
    from public.layout_versions lv
    where lv.id = layout_version_uuid
  );
end;
$$;


--
-- Name: FUNCTION get_layout_bundle(layout_version_uuid uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_layout_bundle(layout_version_uuid uuid) IS 'Returns a full layout version bundle (racks→faces→sections→levels) as JSON in a single round-trip. SECURITY DEFINER bypasses per-row RLS SELECT policies; authorisation is enforced by can_access_layout_version().';


--
-- Name: handle_auth_user_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_auth_user_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1), 'operator')
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      updated_at = timezone('utc', now());

  return new;
end;
$$;


--
-- Name: insert_movement_event(uuid, uuid, uuid, uuid, uuid, text, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_movement_event(tenant_uuid uuid, floor_uuid uuid, container_uuid uuid, from_cell_uuid uuid, to_cell_uuid uuid, movement_event_type text, actor_uuid uuid, created_at_utc timestamp with time zone DEFAULT timezone('utc'::text, now())) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  movement_event_uuid uuid;
begin
  insert into public.movement_events (
    tenant_id,
    floor_id,
    container_id,
    from_cell_id,
    to_cell_id,
    event_type,
    actor_id,
    created_at
  )
  values (
    tenant_uuid,
    floor_uuid,
    container_uuid,
    from_cell_uuid,
    to_cell_uuid,
    movement_event_type,
    actor_uuid,
    created_at_utc
  )
  returning id into movement_event_uuid;

  return movement_event_uuid;
end
$$;


--
-- Name: insert_stock_movement(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, numeric, text, text, timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_stock_movement(tenant_uuid uuid, movement_type_text text, source_location_uuid uuid DEFAULT NULL::uuid, target_location_uuid uuid DEFAULT NULL::uuid, source_container_uuid uuid DEFAULT NULL::uuid, target_container_uuid uuid DEFAULT NULL::uuid, source_inventory_unit_uuid uuid DEFAULT NULL::uuid, target_inventory_unit_uuid uuid DEFAULT NULL::uuid, quantity_value numeric DEFAULT NULL::numeric, uom_value text DEFAULT NULL::text, movement_status text DEFAULT 'done'::text, created_at_utc timestamp with time zone DEFAULT timezone('utc'::text, now()), completed_at_utc timestamp with time zone DEFAULT NULL::timestamp with time zone, actor_uuid uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  inserted_uuid uuid;
begin
  insert into public.stock_movements (
    tenant_id,
    movement_type,
    source_location_id,
    target_location_id,
    source_container_id,
    target_container_id,
    source_inventory_unit_id,
    target_inventory_unit_id,
    quantity,
    uom,
    status,
    created_at,
    completed_at,
    created_by
  )
  values (
    tenant_uuid,
    movement_type_text,
    source_location_uuid,
    target_location_uuid,
    source_container_uuid,
    target_container_uuid,
    source_inventory_unit_uuid,
    target_inventory_unit_uuid,
    quantity_value,
    uom_value,
    movement_status,
    created_at_utc,
    case
      when movement_status = 'done' and completed_at_utc is null then created_at_utc
      else completed_at_utc
    end,
    actor_uuid
  )
  returning id into inserted_uuid;

  return inserted_uuid;
end
$$;


--
-- Name: inventory_item_ref_product_uuid(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_item_ref_product_uuid(item_ref text) RETURNS uuid
    LANGUAGE sql IMMUTABLE
    AS $_$
  select case
    when item_ref is null then null
    when lower(trim(item_ref)) ~ '^product:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then substring(
        lower(trim(item_ref))
        from '^product:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
      )::uuid
    else null
  end
$_$;


--
-- Name: is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.profile_id = auth.uid()
      and tm.role = 'platform_admin'
  )
$$;


--
-- Name: layout_version_cell_counts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.layout_version_cell_counts(layout_version_uuid uuid) RETURNS TABLE(rack_count bigint, cell_count bigint)
    LANGUAGE sql STABLE
    AS $$
  select
    count(distinct r.id) as rack_count,
    count(c.id) as cell_count
  from public.layout_versions lv
  left join public.racks r on r.layout_version_id = lv.id
  left join public.cells c on c.layout_version_id = lv.id
  where lv.id = layout_version_uuid;
$$;


--
-- Name: location_can_accept_container(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.location_can_accept_container(target_location_uuid uuid, container_uuid uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
declare
  container_row record;
  target_location_row record;
  occupying_container_uuid uuid;
  gross_weight_g bigint;
begin
  select
    c.id,
    c.tenant_id,
    c.current_location_id,
    ct.width_mm,
    ct.height_mm,
    ct.depth_mm
  into container_row
  from public.containers c
  join public.container_types ct on ct.id = c.container_type_id
  where c.id = container_uuid;

  if container_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'CONTAINER_NOT_FOUND');
  end if;

  select
    l.id,
    l.tenant_id,
    l.status,
    l.capacity_mode,
    l.width_mm,
    l.height_mm,
    l.depth_mm,
    l.max_weight_g
  into target_location_row
  from public.locations l
  where l.id = target_location_uuid;

  if target_location_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'LOCATION_NOT_FOUND');
  end if;

  if target_location_row.tenant_id <> container_row.tenant_id then
    return jsonb_build_object('ok', false, 'reason', 'TENANT_MISMATCH');
  end if;

  if target_location_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'LOCATION_NOT_ACTIVE');
  end if;

  if container_row.current_location_id = target_location_row.id then
    return jsonb_build_object('ok', false, 'reason', 'SAME_LOCATION');
  end if;

  if target_location_row.capacity_mode = 'single_container' then
    select c.id
    into occupying_container_uuid
    from public.containers c
    where c.current_location_id = target_location_row.id
      and c.id <> container_uuid
      and c.status not in ('closed', 'lost')
    limit 1;

    if occupying_container_uuid is not null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_OCCUPIED');
    end if;
  end if;

  if target_location_row.width_mm is not null then
    if container_row.width_mm is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_UNKNOWN');
    end if;

    if container_row.width_mm > target_location_row.width_mm then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_OVERFLOW');
    end if;
  end if;

  if target_location_row.height_mm is not null then
    if container_row.height_mm is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_UNKNOWN');
    end if;

    if container_row.height_mm > target_location_row.height_mm then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_OVERFLOW');
    end if;
  end if;

  if target_location_row.depth_mm is not null then
    if container_row.depth_mm is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_UNKNOWN');
    end if;

    if container_row.depth_mm > target_location_row.depth_mm then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_OVERFLOW');
    end if;
  end if;

  if target_location_row.max_weight_g is not null then
    gross_weight_g := public.get_container_gross_weight(container_uuid);

    if gross_weight_g is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_WEIGHT_UNKNOWN');
    end if;

    if gross_weight_g > target_location_row.max_weight_g then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_WEIGHT_OVERFLOW');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'reason', null);
end
$$;


--
-- Name: lock_order_reservation_products(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_order_reservation_products(tenant_uuid uuid, product_uuids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  product_uuid uuid;
begin
  foreach product_uuid in array product_uuids
  loop
    perform pg_advisory_xact_lock(hashtextextended(tenant_uuid::text || ':' || product_uuid::text, 0));
  end loop;
end
$$;


--
-- Name: move_container_canonical(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.move_container_canonical(container_uuid uuid, target_location_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  container_row       record;
  source_location_row record;
  validation_result   jsonb;
  validation_reason   text;
  movement_uuid       uuid;
  occurred_at_utc     timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();

  select
    c.id,
    c.tenant_id,
    c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.current_location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(container_uuid);

  validation_result := public.location_can_accept_container(
    target_location_uuid,
    container_uuid
  );
  validation_reason := validation_result ->> 'reason';

  if coalesce((validation_result ->> 'ok')::boolean, false) = false then
    if validation_reason in ('TENANT_MISMATCH', 'LOCATION_NOT_FOUND') then
      raise exception 'TARGET_LOCATION_NOT_FOUND';
    end if;
    raise exception '%', validation_reason;
  end if;

  update public.containers
  set current_location_id         = target_location_uuid,
      current_location_entered_at = occurred_at_utc,
      updated_at                  = occurred_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  movement_uuid := public.insert_stock_movement(
    container_row.tenant_id,
    'move_container',
    source_location_row.location_id,
    target_location_uuid,
    container_uuid,
    container_uuid,
    null,
    null,
    null,
    null,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'containerId',      container_uuid,
    'sourceLocationId', source_location_row.location_id,
    'targetLocationId', target_location_uuid,
    'movementId',       movement_uuid,
    'occurredAt',       occurred_at_utc
  );
end
$$;


--
-- Name: order_available_to_promise_qty(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.order_available_to_promise_qty(tenant_uuid uuid, product_uuid uuid) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select public.order_physical_available_qty(tenant_uuid, product_uuid)
       - public.order_reserved_qty(tenant_uuid, product_uuid)
$$;


--
-- Name: order_physical_available_qty(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.order_physical_available_qty(tenant_uuid uuid, product_uuid uuid) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(iu.quantity), 0)
  from public.inventory_unit iu
  where iu.tenant_id = tenant_uuid
    and iu.product_id = product_uuid
    and iu.status = 'available'
$$;


--
-- Name: order_reserved_qty(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.order_reserved_qty(tenant_uuid uuid, product_uuid uuid) RETURNS numeric
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(orv.quantity), 0)
  from public.order_reservations orv
  where orv.tenant_id = tenant_uuid
    and orv.product_id = product_uuid
    and orv.status in ('active', 'released')
$$;


--
-- Name: pad_2(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pad_2(input_value text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select lpad(input_value, 2, '0');
$$;


--
-- Name: pad_4(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pad_4(input_value text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select lpad(input_value, 4, '0');
$$;


--
-- Name: pick_full_inventory_unit(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pick_full_inventory_unit(source_inventory_unit_uuid uuid, pick_container_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  source_row          record;
  pick_container_row  record;
  source_location_row record;
  pick_location_row   record;
  pick_movement_uuid  uuid;
  occurred_at_utc     timestamptz := timezone('utc', now());
begin
  -- Lock the source inventory unit
  select
    iu.id,
    iu.tenant_id,
    iu.container_id,
    iu.product_id,
    iu.quantity,
    iu.uom,
    iu.lot_code,
    iu.serial_no,
    iu.expiry_date,
    iu.status
  into source_row
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid
  for update;

  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  if source_row.quantity <= 0 then
    raise exception 'INVALID_SPLIT_QUANTITY';
  end if;

  -- Lock pick container and validate
  select c.id, c.tenant_id
  into pick_container_row
  from public.containers c
  where c.id = pick_container_uuid
  for update;

  if pick_container_row.id is null then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  if pick_container_row.tenant_id <> source_row.tenant_id then
    raise exception 'TARGET_CONTAINER_TENANT_MISMATCH';
  end if;

  if pick_container_row.id = source_row.container_id then
    raise exception 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER';
  end if;

  -- Resolve locations for the movement record
  select * into source_location_row
  from public.resolve_active_location_for_container(source_row.container_id);

  select * into pick_location_row
  from public.resolve_active_location_for_container(pick_container_row.id);

  -- Insert pick_partial movement BEFORE updating container_id.
  -- The stock_movements trigger validates that source_inventory_unit.container_id
  -- matches source_container_id.  This is only true while the IU is still in
  -- its original container, so the movement must be written first.
  pick_movement_uuid := public.insert_stock_movement(
    source_row.tenant_id,
    'pick_partial',
    source_location_row.location_id,   -- source location (may be null if unplaced)
    pick_location_row.location_id,     -- target location (may be null if unplaced)
    source_row.container_id,           -- source container (current home of the IU)
    pick_container_uuid,               -- pick container (destination)
    source_row.id,                     -- source IU (still at source_container at this point)
    null,                              -- no separate target IU; same row is being moved
    source_row.quantity,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  -- Now reassign the inventory unit to the pick container
  update public.inventory_unit
  set container_id = pick_container_uuid,
      updated_at   = occurred_at_utc,
      updated_by   = actor_uuid
  where id = source_row.id;

  return jsonb_build_object(
    'sourceInventoryUnitId', source_row.id,
    'targetInventoryUnitId', source_row.id,   -- same row; now lives in pick container
    'sourceContainerId',     source_row.container_id,
    'targetContainerId',     pick_container_uuid,
    'sourceLocationId',      source_location_row.location_id,
    'targetLocationId',      pick_location_row.location_id,
    'quantity',              source_row.quantity,
    'uom',                   source_row.uom,
    'mergeApplied',          false,
    'transferMovementId',    pick_movement_uuid,
    'occurredAt',            occurred_at_utc
  );
end
$$;


--
-- Name: pick_partial_inventory_unit(uuid, numeric, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pick_partial_inventory_unit(source_inventory_unit_uuid uuid, quantity numeric, pick_container_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  split_result        jsonb;
  pick_movement_uuid  uuid;
  split_movement_uuid uuid;
  source_tenant_uuid  uuid;
  occurred_at_utc     timestamptz;
begin
  -- Step 1: Override actor attribution unconditionally.
  actor_uuid := auth.uid();

  -- Authorization is handled inside the hardened split_inventory_unit.
  split_result := public.split_inventory_unit(
    source_inventory_unit_uuid,
    quantity,
    pick_container_uuid,
    actor_uuid
  );

  -- Reuse the timestamp from the split so both movement records
  -- share the same occurredAt rather than drifting to a later now().
  occurred_at_utc := (split_result ->> 'occurredAt')::timestamptz;

  select iu.tenant_id
  into source_tenant_uuid
  from public.inventory_unit iu
  where iu.id = (split_result ->> 'sourceInventoryUnitId')::uuid;

  split_movement_uuid := (split_result ->> 'movementId')::uuid;

  pick_movement_uuid := public.insert_stock_movement(
    source_tenant_uuid,
    'pick_partial',
    (split_result ->> 'sourceLocationId')::uuid,
    (split_result ->> 'targetLocationId')::uuid,
    (split_result ->> 'sourceContainerId')::uuid,
    (split_result ->> 'targetContainerId')::uuid,
    (split_result ->> 'sourceInventoryUnitId')::uuid,
    (split_result ->> 'targetInventoryUnitId')::uuid,
    (split_result ->> 'quantity')::numeric,
    split_result ->> 'uom',
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return split_result || jsonb_build_object(
    'splitMovementId',    split_movement_uuid,
    'transferMovementId', pick_movement_uuid
  );
end
$$;


--
-- Name: place_container_at_location(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_container_at_location(container_uuid uuid, location_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  container_row    record;
  location_row     record;
  accept_result    jsonb;
  new_placement_id uuid;
  placed_at_utc    timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();

  select c.id, c.tenant_id, c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.current_location_id is not null then
    raise exception 'CONTAINER_ALREADY_PLACED';
  end if;

  select l.id, l.tenant_id, l.floor_id, l.geometry_slot_id
  into location_row
  from public.locations l
  where l.id = location_uuid;

  if location_row.id is null then
    raise exception 'LOCATION_NOT_FOUND';
  end if;

  if location_row.tenant_id <> container_row.tenant_id then
    raise exception 'LOCATION_NOT_FOUND';
  end if;

  accept_result := public.location_can_accept_container(location_uuid, container_uuid);
  if not coalesce((accept_result ->> 'ok')::boolean, false) then
    raise exception '%', (accept_result ->> 'reason');
  end if;

  update public.containers
  set current_location_id         = location_uuid,
      current_location_entered_at = placed_at_utc,
      updated_at                  = placed_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  perform public.insert_stock_movement(
    container_row.tenant_id,
    'place_container',
    null,
    location_uuid,
    container_uuid,
    container_uuid,
    null,
    null,
    null,
    null,
    'done',
    placed_at_utc,
    placed_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'action',      'placed',
    'containerId', container_uuid,
    'locationId',  location_uuid,
    'cellId',      location_row.geometry_slot_id,
    'placementId', new_placement_id,
    'occurredAt',  placed_at_utc
  );
exception
  when unique_violation then
    raise exception 'CONTAINER_ALREADY_PLACED';
end
$$;


--
-- Name: prevent_committed_order_line_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_committed_order_line_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  order_status text;
  committed_line_update_allowed boolean;
begin
  select o.status
  into order_status
  from public.orders o
  where o.id = old.order_id;

  committed_line_update_allowed :=
    coalesce(current_setting('wos.allow_committed_order_line_system_update', true), '') = 'on';

  if order_status <> 'draft' and not committed_line_update_allowed then
    raise exception 'ORDER_NOT_EDITABLE_IN_READY';
  end if;

  return old;
end
$$;


--
-- Name: provision_default_tenant_membership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.provision_default_tenant_membership() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  default_tenant_uuid uuid;
  assigned_role text;
begin
  select id
  into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is not null then
    assigned_role := case
      when exists (
        select 1
        from public.tenant_members tm
        where tm.tenant_id = default_tenant_uuid
      ) then 'operator'
      else 'tenant_admin'
    end;

    insert into public.tenant_members (tenant_id, profile_id, role)
    values (default_tenant_uuid, new.id, assigned_role)
    on conflict (tenant_id, profile_id) do nothing;
  end if;

  return new;
end;
$$;


--
-- Name: publish_layout_version(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.publish_layout_version(layout_version_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  validation_result jsonb;
  inserted_cells integer := 0;
  floor_uuid uuid;
  layout_state text;
  archived_version_id uuid;
  session_actor_uuid uuid := auth.uid();
  effective_actor_uuid uuid;
begin
  -- Prevent actor spoofing in SECURITY DEFINER context:
  -- authenticated callers are always attributed to auth.uid();
  -- actor_uuid is only used when auth context is absent.
  effective_actor_uuid := coalesce(session_actor_uuid, actor_uuid);

  select floor_id
  into floor_uuid
  from public.layout_versions
  where id = layout_version_uuid;

  if floor_uuid is null then
    raise exception 'Layout version % not found.', layout_version_uuid;
  end if;

  -- Keep canonical publish authz semantics:
  -- auth.uid() null is intentionally allowed for trusted internal/system calls.
  if session_actor_uuid is not null and not public.can_publish_floor(floor_uuid) then
    raise exception 'Forbidden';
  end if;

  -- Floor is the publish domain boundary: concurrent publish commands for the
  -- same floor must serialize, while independent floors stay non-blocking.
  perform pg_advisory_xact_lock(hashtextextended(floor_uuid::text, 29));

  -- Strict active-draft guard after lock acquisition.
  select state
  into layout_state
  from public.layout_versions
  where id = layout_version_uuid;

  if layout_state <> 'draft' then
    raise exception 'Layout version % is not an active draft.', layout_version_uuid;
  end if;

  validation_result := public.validate_layout_version(layout_version_uuid);

  if coalesce((validation_result ->> 'isValid')::boolean, false) = false then
    perform public.write_layout_event(
      'layout_publish',
      'failed',
      layout_version_uuid,
      'layout_version',
      layout_version_uuid,
      effective_actor_uuid,
      jsonb_build_object('reason', 'validation_failed', 'validation', validation_result)
    );
    raise exception 'Layout version % failed validation.', layout_version_uuid;
  end if;

  inserted_cells := public.regenerate_layout_cells(layout_version_uuid);

  select id
  into archived_version_id
  from public.layout_versions
  where floor_id = floor_uuid
    and state = 'published'
    and id <> layout_version_uuid
  limit 1;

  update public.layout_versions
  set state = 'archived',
      archived_at = timezone('utc', now())
  where floor_id = floor_uuid
    and state = 'published'
    and id <> layout_version_uuid;

  if archived_version_id is not null then
    perform public.write_layout_event(
      'layout_archived',
      'succeeded',
      archived_version_id,
      'layout_version',
      archived_version_id,
      effective_actor_uuid,
      jsonb_build_object('replacedBy', layout_version_uuid)
    );
  end if;

  -- Compare-and-set semantics: publish only if the version is still draft.
  update public.layout_versions
  set state = 'published',
      published_at = timezone('utc', now()),
      published_by = effective_actor_uuid
  where id = layout_version_uuid
    and state = 'draft';

  if not found then
    raise exception 'Layout version % could not be published because it is no longer draft.', layout_version_uuid;
  end if;

  update public.racks
  set state = 'published'
  where layout_version_id = layout_version_uuid;

  -- Preserved 0053 fix: regenerate_layout_cells() happens before publish state
  -- switch, so trigger-based sync can skip. Explicit post-publish upsert keeps
  -- locations aligned and remaps geometry_slot_id on re-publish by (floor_id, code).
  insert into public.locations (
    tenant_id,
    floor_id,
    code,
    location_type,
    geometry_slot_id,
    capacity_mode,
    status
  )
  select
    s.tenant_id,
    f.id,
    coalesce(c.address, c.cell_code),
    'rack_slot',
    c.id,
    'single_container',
    'active'
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  where c.layout_version_id = layout_version_uuid
  on conflict (floor_id, code) do update
    set geometry_slot_id = excluded.geometry_slot_id,
        status = 'active',
        updated_at = timezone('utc', now());

  perform public.write_layout_event(
    'layout_publish',
    'succeeded',
    layout_version_uuid,
    'layout_version',
    layout_version_uuid,
    effective_actor_uuid,
    jsonb_build_object('generatedCells', inserted_cells)
  );

  return jsonb_build_object(
    'layoutVersionId', layout_version_uuid,
    'publishedAt', timezone('utc', now()),
    'generatedCells', inserted_cells,
    'validation', validation_result
  );
exception
  when others then
    -- Only log the event if the layout version actually exists in the DB.
    -- floor_uuid is null when the version was not found, in which case
    -- write_layout_event would violate the operation_events FK constraint.
    if layout_version_uuid is not null and floor_uuid is not null then
      perform public.write_layout_event(
        'layout_publish',
        'failed',
        layout_version_uuid,
        'layout_version',
        layout_version_uuid,
        effective_actor_uuid,
        jsonb_build_object('error', sqlerrm)
      );
    end if;
    raise;
end;
$$;


--
-- Name: receive_inventory_unit(uuid, uuid, uuid, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_inventory_unit(tenant_uuid uuid, container_uuid uuid, product_uuid uuid, quantity numeric, uom text, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  container_row record;
  product_row record;
  inserted_row public.inventory_unit%rowtype;
begin
  -- Caller-supplied actor_uuid is discarded. auth.uid() is the only
  -- accepted attribution source for this command.
  actor_uuid := auth.uid();

  -- Lock container with inline auth + workspace tenant scope.
  -- Missing, unauthorized, and tenant-mismatched container UUIDs are masked
  -- as CONTAINER_NOT_FOUND to match current route semantics.
  select c.id, c.tenant_id, c.status
  into container_row
  from public.containers c
  where c.id = container_uuid
    and c.tenant_id = tenant_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.status <> 'active' then
    raise exception 'CONTAINER_NOT_RECEIVABLE';
  end if;

  -- Lock product row so eligibility decision (is_active) and insert stay
  -- race-safe against concurrent product deactivation.
  select
    p.id,
    p.source,
    p.external_product_id,
    p.sku,
    p.name,
    p.permalink,
    p.image_urls,
    p.image_files,
    p.is_active,
    p.created_at,
    p.updated_at
  into product_row
  from public.products p
  where p.id = product_uuid
  for update;

  if product_row.id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if not product_row.is_active then
    raise exception 'PRODUCT_INACTIVE';
  end if;

  insert into public.inventory_unit (
    tenant_id,
    container_id,
    product_id,
    quantity,
    uom,
    status,
    created_by
  )
  values (
    container_row.tenant_id,
    container_row.id,
    product_row.id,
    quantity,
    uom,
    'available',
    actor_uuid
  )
  returning *
  into inserted_row;

  return jsonb_build_object(
    'inventoryUnit',
    jsonb_build_object(
      'id', inserted_row.id,
      'tenant_id', inserted_row.tenant_id,
      'container_id', inserted_row.container_id,
      'product_id', inserted_row.product_id,
      'quantity', inserted_row.quantity,
      'uom', inserted_row.uom,
      'lot_code', inserted_row.lot_code,
      'serial_no', inserted_row.serial_no,
      'expiry_date', inserted_row.expiry_date,
      'status', inserted_row.status,
      'created_at', inserted_row.created_at,
      'updated_at', inserted_row.updated_at,
      'created_by', inserted_row.created_by
    ),
    'product',
    jsonb_build_object(
      'id', product_row.id,
      'source', product_row.source,
      'external_product_id', product_row.external_product_id,
      'sku', product_row.sku,
      'name', product_row.name,
      'permalink', product_row.permalink,
      'image_urls', product_row.image_urls,
      'image_files', product_row.image_files,
      'is_active', product_row.is_active,
      'created_at', product_row.created_at,
      'updated_at', product_row.updated_at
    )
  );
end
$$;


--
-- Name: regenerate_layout_cells(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.regenerate_layout_cells(layout_version_uuid uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  inserted_count integer := 0;
begin
  if auth.uid() is not null and not public.can_manage_layout_version(layout_version_uuid) then
    raise exception 'Forbidden';
  end if;

  delete from public.cells
  where layout_version_id = layout_version_uuid;

  insert into public.cells (
    layout_version_id,
    rack_id,
    rack_face_id,
    rack_section_id,
    rack_level_id,
    slot_no,
    cell_code,
    address,
    address_sort_key,
    status
  )
  select
    lv.id as layout_version_id,
    r.id as rack_id,
    rf.id as rack_face_id,
    rs.id as rack_section_id,
    rl.id as rack_level_id,
    gs.slot_no,
    public.build_cell_code(r.id, rf.side, rs.ordinal, rl.ordinal, gs.slot_no) as cell_code,
    public.build_cell_address(r.display_code, rf.side, rs.ordinal, rl.ordinal, gs.slot_no) as address,
    public.pad_4(r.display_code) || '-' || rf.side || '-' || public.pad_2(rs.ordinal::text) || '-' || public.pad_2(rl.ordinal::text) || '-' || public.pad_2(gs.slot_no::text) as address_sort_key,
    'active' as status
  from public.layout_versions lv
  join public.racks r on r.layout_version_id = lv.id
  join public.rack_faces rf on rf.rack_id = r.id and rf.enabled = true
  join public.rack_sections rs on rs.rack_face_id = coalesce(rf.mirror_source_face_id, rf.id)
  join public.rack_levels rl on rl.rack_section_id = rs.id
  join lateral generate_series(1, rl.slot_count) as gs(slot_no) on true
  where lv.id = layout_version_uuid;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;


--
-- Name: release_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_order(order_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  order_row public.orders%rowtype;
  line_count integer;
  reservation_mismatch_count integer;
  task_uuid uuid;
  actor_uuid uuid := auth.uid();
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status <> 'ready' then
    raise exception 'ORDER_NOT_READY';
  end if;

  select count(*)
  into line_count
  from public.order_lines
  where order_id = order_uuid;

  if line_count = 0 then
    raise exception 'ORDER_HAS_NO_LINES';
  end if;

  select count(*)
  into reservation_mismatch_count
  from public.order_lines ol
  left join public.order_reservations orv
    on orv.order_line_id = ol.id
   and orv.status = 'active'
  where ol.order_id = order_uuid
    and (
      orv.id is null
      or orv.tenant_id <> ol.tenant_id
      or orv.order_id <> ol.order_id
      or orv.product_id is distinct from ol.product_id
      or orv.quantity <> ol.qty_required
    );

  if reservation_mismatch_count > 0 then
    raise exception 'RESERVATION_MISMATCH';
  end if;

  if exists (
    select 1
    from public.pick_tasks pt
    where pt.source_type = 'order'
      and pt.source_id = order_uuid
  ) then
    raise exception 'ORDER_ALREADY_RELEASED';
  end if;

  update public.order_reservations
  set status = 'released',
      released_at = coalesce(released_at, timezone('utc', now())),
      released_by = coalesce(released_by, actor_uuid)
  where order_id = order_uuid
    and status = 'active';

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values (order_row.tenant_id, 'order', order_uuid, 'ready')
  returning id into task_uuid;

  insert into public.pick_steps (
    task_id,
    tenant_id,
    order_id,
    order_line_id,
    sequence_no,
    sku,
    item_name,
    qty_required,
    status
  )
  select
    task_uuid,
    ol.tenant_id,
    ol.order_id,
    ol.id,
    row_number() over (order by ol.id),
    ol.sku,
    ol.name,
    ol.qty_required,
    'pending'
  from public.order_lines ol
  where ol.order_id = order_uuid
  order by ol.id;

  perform set_config('wos.allow_committed_order_line_system_update', 'on', true);
  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.order_lines
  set status = 'released'
  where order_id = order_uuid;

  update public.orders
  set status = 'released',
      released_at = coalesce(released_at, timezone('utc', now()))
  where id = order_uuid;

  return task_uuid;
end
$$;


--
-- Name: release_wave(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_wave(wave_uuid uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
  wave_row public.waves%rowtype;
  attached_order_count integer;
  blocking_order_count integer;
  order_row record;
  released_count integer := 0;
begin
  select *
  into wave_row
  from public.waves
  where id = wave_uuid
  for update;

  if wave_row.id is null then
    raise exception 'WAVE_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(wave_row.tenant_id) then
    raise exception 'WAVE_NOT_MANAGEABLE';
  end if;

  if wave_row.status <> 'ready' then
    raise exception 'WAVE_NOT_READY';
  end if;

  select count(*)
  into attached_order_count
  from public.orders
  where wave_id = wave_uuid;

  if attached_order_count = 0 then
    raise exception 'WAVE_HAS_NO_ORDERS';
  end if;

  select count(*)
  into blocking_order_count
  from public.orders
  where wave_id = wave_uuid
    and status <> 'ready';

  if blocking_order_count > 0 then
    raise exception 'WAVE_HAS_BLOCKING_ORDERS';
  end if;

  for order_row in
    select o.id
    from public.orders o
    where o.wave_id = wave_uuid
    order by o.created_at, o.id
  loop
    perform public.release_order(order_row.id);
    released_count := released_count + 1;
  end loop;

  update public.waves
  set status = 'released',
      released_at = coalesce(released_at, timezone('utc', now()))
  where id = wave_uuid;

  return released_count;
end
$$;


--
-- Name: remove_container(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_container(container_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  container_row        record;
  location_row         record;
  active_placement_id  uuid;
  removed_at_utc       timestamptz := timezone('utc', now());
begin
  actor_uuid := auth.uid();

  select c.id, c.tenant_id, c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.current_location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  select l.floor_id, l.geometry_slot_id
  into location_row
  from public.locations l
  where l.id = container_row.current_location_id;

  if location_row.floor_id is null then
    raise exception 'CURRENT_LOCATION_NOT_FOUND';
  end if;

  update public.containers
  set current_location_id         = null,
      current_location_entered_at = null,
      updated_at                  = removed_at_utc,
      updated_by                  = actor_uuid
  where id = container_uuid;

  perform public.insert_stock_movement(
    container_row.tenant_id,
    'remove_container',
    container_row.current_location_id,
    null,
    container_uuid,
    container_uuid,
    null,
    null,
    null,
    null,
    'done',
    removed_at_utc,
    removed_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'action',      'removed',
    'containerId', container_uuid,
    'cellId',      location_row.geometry_slot_id,
    'placementId', active_placement_id,
    'occurredAt',  removed_at_utc
  );
end
$$;


--
-- Name: resolve_active_location_for_container(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_active_location_for_container(container_uuid uuid) RETURNS TABLE(tenant_id uuid, floor_id uuid, location_id uuid, cell_id uuid)
    LANGUAGE sql STABLE
    AS $$
  select
    acl.tenant_id,
    acl.floor_id,
    acl.location_id,
    acl.cell_id
  from public.active_container_locations_v acl
  where acl.container_id = container_uuid
  limit 1
$$;


--
-- Name: rollback_ready_order_to_draft(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rollback_ready_order_to_draft(order_uuid uuid, reason text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  order_row public.orders%rowtype;
  actor_uuid uuid := auth.uid();
begin
  select *
  into order_row
  from public.orders
  where id = order_uuid
  for update;

  if order_row.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(order_row.tenant_id) then
    raise exception 'ORDER_NOT_MANAGEABLE';
  end if;

  if order_row.status <> 'ready' then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  update public.order_reservations
  set status = 'rolled_back',
      rolled_back_at = timezone('utc', now()),
      rolled_back_by = actor_uuid,
      rollback_reason = nullif(trim(coalesce(reason, '')), '')
  where order_id = order_uuid
    and status in ('active', 'released');

  perform set_config('wos.allow_order_reservation_status_update', 'on', true);

  update public.orders
  set status = 'draft'
  where id = order_uuid;

  return order_uuid;
end
$$;


--
-- Name: save_layout_draft(jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_layout_draft(layout_payload jsonb, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  layout_version_uuid   uuid    := (layout_payload ->> 'layoutVersionId')::uuid;
  client_draft_version  integer := (layout_payload ->> 'draftVersion')::integer;
  current_draft_version integer;
  new_draft_version     integer;
begin
  if layout_version_uuid is null then
    raise exception 'layoutVersionId is required in save_layout_draft payload';
  end if;

  select draft_version
    into current_draft_version
  from public.layout_versions
  where id = layout_version_uuid and state = 'draft'
  for update;

  if not found then
    raise exception 'Layout version % is not an active draft.', layout_version_uuid;
  end if;

  if client_draft_version is not null
    and current_draft_version is distinct from client_draft_version
  then
    raise exception 'DRAFT_CONFLICT';
  end if;

  if not public.can_manage_layout_version(layout_version_uuid) then
    raise exception 'Permission denied for layout version %', layout_version_uuid;
  end if;

  perform public.validate_layout_payload(layout_payload);

  delete from public.layout_walls
  where layout_version_id = layout_version_uuid;

  delete from public.layout_zones
  where layout_version_id = layout_version_uuid;

  delete from public.cells
  where layout_version_id = layout_version_uuid;

  delete from public.rack_levels
  where rack_section_id in (
    select rs.id
    from public.rack_sections rs
    join public.rack_faces rf on rf.id = rs.rack_face_id
    join public.racks r on r.id = rf.rack_id
    where r.layout_version_id = layout_version_uuid
  );

  delete from public.rack_sections
  where rack_face_id in (
    select rf.id
    from public.rack_faces rf
    join public.racks r on r.id = rf.rack_id
    where r.layout_version_id = layout_version_uuid
  );

  set constraints rack_faces_mirror_consistency_trigger deferred;

  delete from public.rack_faces
  where rack_id in (
    select id from public.racks where layout_version_id = layout_version_uuid
  );

  delete from public.racks
  where layout_version_id = layout_version_uuid;

  insert into public.layout_zones (
    id, layout_version_id, code, name, category,
    color, x, y, width, height
  )
  select
    (z ->> 'id')::uuid,
    layout_version_uuid,
    z ->> 'code',
    z ->> 'name',
    nullif(z ->> 'category', ''),
    z ->> 'color',
    (z ->> 'x')::numeric,
    (z ->> 'y')::numeric,
    (z ->> 'width')::numeric,
    (z ->> 'height')::numeric
  from jsonb_array_elements(coalesce(layout_payload -> 'zones', '[]'::jsonb)) as z;

  insert into public.layout_walls (
    id, layout_version_id, code, name, wall_type,
    x1, y1, x2, y2, blocks_rack_placement
  )
  select
    (w ->> 'id')::uuid,
    layout_version_uuid,
    w ->> 'code',
    nullif(w ->> 'name', ''),
    nullif(w ->> 'wallType', ''),
    (w ->> 'x1')::numeric,
    (w ->> 'y1')::numeric,
    (w ->> 'x2')::numeric,
    (w ->> 'y2')::numeric,
    coalesce((w ->> 'blocksRackPlacement')::boolean, true)
  from jsonb_array_elements(coalesce(layout_payload -> 'walls', '[]'::jsonb)) as w;

  insert into public.racks (
    id, layout_version_id, display_code, kind, axis,
    x, y, total_length, depth, rotation_deg, state
  )
  select
    (r ->> 'id')::uuid,
    layout_version_uuid,
    r ->> 'displayCode',
    r ->> 'kind',
    r ->> 'axis',
    (r ->> 'x')::numeric,
    (r ->> 'y')::numeric,
    (r ->> 'totalLength')::numeric,
    (r ->> 'depth')::numeric,
    (r ->> 'rotationDeg')::integer,
    'draft'
  from jsonb_array_elements(layout_payload -> 'racks') as r;

  insert into public.rack_faces (
    id, rack_id, side, enabled,
    slot_numbering_direction, face_length,
    is_mirrored, mirror_source_face_id
  )
  select
    (f ->> 'id')::uuid,
    (r ->> 'id')::uuid,
    f ->> 'side',
    coalesce((f ->> 'enabled')::boolean, true),
    f ->> 'slotNumberingDirection',
    nullif(f ->> 'faceLength', '')::numeric,
    false,
    null
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces') as f;

  update public.rack_faces rf
  set
    is_mirrored = true,
    mirror_source_face_id = (f ->> 'mirrorSourceFaceId')::uuid
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces') as f
  where rf.id = (f ->> 'id')::uuid
    and coalesce((f ->> 'isMirrored')::boolean, false) = true
    and nullif(f ->> 'mirrorSourceFaceId', '') is not null;

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  select
    (s ->> 'id')::uuid,
    (f ->> 'id')::uuid,
    (s ->> 'ordinal')::integer,
    (s ->> 'length')::numeric
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces') as f,
       jsonb_array_elements(f -> 'sections') as s;

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  select
    (l ->> 'id')::uuid,
    (s ->> 'id')::uuid,
    (l ->> 'ordinal')::integer,
    (l ->> 'slotCount')::integer
  from jsonb_array_elements(layout_payload -> 'racks') as r,
       jsonb_array_elements(r -> 'faces') as f,
       jsonb_array_elements(f -> 'sections') as s,
       jsonb_array_elements(s -> 'levels') as l;

  update public.layout_versions
  set draft_version = draft_version + 1,
      updated_at = timezone('utc', now())
  where id = layout_version_uuid
  returning draft_version into new_draft_version;

  perform public.write_layout_event(
    'layout_draft_saved', 'succeeded',
    layout_version_uuid, 'layout_version', layout_version_uuid,
    actor_uuid,
    jsonb_build_object(
      'rackCount', jsonb_array_length(layout_payload -> 'racks'),
      'zoneCount', jsonb_array_length(coalesce(layout_payload -> 'zones', '[]'::jsonb)),
      'wallCount', jsonb_array_length(coalesce(layout_payload -> 'walls', '[]'::jsonb)),
      'draftVersion', new_draft_version
    )
  );

  return jsonb_build_object(
    'layoutVersionId', layout_version_uuid,
    'draftVersion', new_draft_version
  );

exception
  when others then
    if layout_version_uuid is not null then
      perform public.write_layout_event(
        'layout_draft_saved', 'failed',
        layout_version_uuid, 'layout_version', layout_version_uuid,
        actor_uuid,
        jsonb_build_object('error', sqlerrm)
      );
    end if;
    raise;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: split_inventory_unit(uuid, numeric, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.split_inventory_unit(source_inventory_unit_uuid uuid, split_quantity numeric, target_container_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  source_row                 record;
  target_container_row       record;
  source_location_row        record;
  target_location_row        record;
  merge_candidate_row        record;
  target_inventory_unit_uuid uuid;
  source_quantity_after      numeric;
  target_quantity_after      numeric;
  merge_applied              boolean := false;
  occurred_at_utc            timestamptz := timezone('utc', now());
  split_movement_uuid        uuid;
begin
  -- Step 1: Override actor attribution unconditionally.
  -- Caller-supplied actor_uuid is discarded.
  actor_uuid := auth.uid();

  -- Step 2: Lock primary resource with inline tenant authorization.
  -- AND can_manage_tenant(...) inside the WHERE clause prevents
  -- FOR UPDATE from acquiring a lock on unauthorized rows.
  -- A cross-tenant UUID returns no row; id is null → same error as missing.
  select
    iu.id,
    iu.tenant_id,
    iu.container_id,
    iu.product_id,
    iu.quantity,
    iu.uom,
    iu.lot_code,
    iu.serial_no,
    iu.expiry_date,
    iu.status
  into source_row
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid
    and public.can_manage_tenant(iu.tenant_id)
  for update;

  -- Step 3: Single indistinct check — not-found and unauthorized
  -- raise the same error. Cross-tenant IU UUID is indistinguishable
  -- from a nonexistent UUID to the caller.
  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  if split_quantity <= 0 or split_quantity >= source_row.quantity then
    raise exception 'INVALID_SPLIT_QUANTITY';
  end if;

  if source_row.serial_no is not null then
    raise exception 'SERIAL_SPLIT_NOT_ALLOWED';
  end if;

  -- Lock target container.
  -- Under SECURITY DEFINER, this reads without RLS.
  -- Tenant mismatch is masked as NOT_FOUND to prevent
  -- cross-tenant container existence oracle.
  select c.id, c.tenant_id
  into target_container_row
  from public.containers c
  where c.id = target_container_uuid
  for update;

  if target_container_row.id is null then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  -- Mask: returning TARGET_CONTAINER_TENANT_MISMATCH would confirm
  -- to the caller that the UUID is a valid container in another tenant.
  if target_container_row.tenant_id <> source_row.tenant_id then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  if target_container_row.id = source_row.container_id then
    raise exception 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(source_row.container_id);

  select *
  into target_location_row
  from public.resolve_active_location_for_container(target_container_row.id);

  update public.inventory_unit iu
  set quantity   = iu.quantity - split_quantity,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where iu.id = source_row.id
  returning iu.quantity into source_quantity_after;

  select iu.id, iu.quantity
  into merge_candidate_row
  from public.inventory_unit iu
  where iu.tenant_id    = source_row.tenant_id
    and iu.container_id = target_container_row.id
    and iu.product_id   = source_row.product_id
    and iu.uom          = source_row.uom
    and iu.status       = source_row.status
    and iu.serial_no    is null
    and iu.lot_code     is not distinct from source_row.lot_code
    and iu.expiry_date  is not distinct from source_row.expiry_date
  order by iu.created_at, iu.id
  limit 1
  for update;

  if merge_candidate_row.id is not null then
    merge_applied              := true;
    target_inventory_unit_uuid := merge_candidate_row.id;

    update public.inventory_unit iu
    set quantity   = iu.quantity + split_quantity,
        updated_at = occurred_at_utc,
        updated_by = actor_uuid
    where iu.id = merge_candidate_row.id
    returning iu.quantity into target_quantity_after;
  else
    insert into public.inventory_unit (
      tenant_id,
      container_id,
      product_id,
      quantity,
      uom,
      lot_code,
      serial_no,
      expiry_date,
      status,
      created_at,
      updated_at,
      created_by,
      updated_by,
      source_inventory_unit_id
    )
    values (
      source_row.tenant_id,
      target_container_row.id,
      source_row.product_id,
      split_quantity,
      source_row.uom,
      source_row.lot_code,
      source_row.serial_no,
      source_row.expiry_date,
      source_row.status,
      occurred_at_utc,
      occurred_at_utc,
      actor_uuid,
      actor_uuid,
      source_row.id
    )
    returning id, quantity
    into target_inventory_unit_uuid, target_quantity_after;
  end if;

  -- Uses source_row.tenant_id from the authorized row, not a raw param.
  split_movement_uuid := public.insert_stock_movement(
    source_row.tenant_id,
    'split_stock',
    source_location_row.location_id,
    target_location_row.location_id,
    source_row.container_id,
    target_container_row.id,
    source_row.id,
    target_inventory_unit_uuid,
    split_quantity,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'sourceInventoryUnitId', source_row.id,
    'targetInventoryUnitId', target_inventory_unit_uuid,
    'sourceContainerId',     source_row.container_id,
    'targetContainerId',     target_container_row.id,
    'sourceLocationId',      source_location_row.location_id,
    'targetLocationId',      target_location_row.location_id,
    'quantity',              split_quantity,
    'uom',                   source_row.uom,
    'mergeApplied',          merge_applied,
    'sourceQuantity',        source_quantity_after,
    'targetQuantity',        target_quantity_after,
    'movementId',            split_movement_uuid,
    'occurredAt',            occurred_at_utc
  );
end
$$;


--
-- Name: sync_published_cell_to_location(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_published_cell_to_location() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  location_tenant_uuid uuid;
  location_floor_uuid uuid;
  layout_state text;
begin
  select
    s.tenant_id,
    f.id,
    lv.state
  into location_tenant_uuid, location_floor_uuid, layout_state
  from public.layout_versions lv
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  where lv.id = new.layout_version_id;

  if layout_state is distinct from 'published' then
    return new;
  end if;

  update public.locations
  set tenant_id = location_tenant_uuid,
      floor_id = location_floor_uuid,
      code = coalesce(new.address, new.cell_code),
      location_type = 'rack_slot',
      capacity_mode = 'single_container',
      status = 'active',
      updated_at = timezone('utc', now())
  where geometry_slot_id = new.id;

  if not found then
    insert into public.locations (
      tenant_id,
      floor_id,
      code,
      location_type,
      geometry_slot_id,
      capacity_mode,
      status
    )
    values (
      location_tenant_uuid,
      location_floor_uuid,
      coalesce(new.address, new.cell_code),
      'rack_slot',
      new.id,
      'single_container',
      'active'
    );
  end if;

  return new;
end
$$;


--
-- Name: transfer_inventory_unit(uuid, numeric, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_inventory_unit(source_inventory_unit_uuid uuid, quantity numeric, target_container_uuid uuid, actor_uuid uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  split_result           jsonb;
  transfer_movement_uuid uuid;
  split_movement_uuid    uuid;
  source_tenant_uuid     uuid;
  occurred_at_utc        timestamptz;
begin
  -- Step 1: Override actor attribution unconditionally.
  actor_uuid := auth.uid();

  -- Authorization is handled inside the hardened split_inventory_unit.
  -- split_inventory_unit is the unconditional first operation; any auth
  -- failure raises an exception and aborts here with no DML executed.
  split_result := public.split_inventory_unit(
    source_inventory_unit_uuid,
    quantity,
    target_container_uuid,
    actor_uuid
  );

  -- Reuse the timestamp from the split so both movement records
  -- share the same occurredAt rather than drifting to a later now().
  occurred_at_utc := (split_result ->> 'occurredAt')::timestamptz;

  select iu.tenant_id
  into source_tenant_uuid
  from public.inventory_unit iu
  where iu.id = (split_result ->> 'sourceInventoryUnitId')::uuid;

  split_movement_uuid := (split_result ->> 'movementId')::uuid;

  transfer_movement_uuid := public.insert_stock_movement(
    source_tenant_uuid,
    'transfer_stock',
    (split_result ->> 'sourceLocationId')::uuid,
    (split_result ->> 'targetLocationId')::uuid,
    (split_result ->> 'sourceContainerId')::uuid,
    (split_result ->> 'targetContainerId')::uuid,
    (split_result ->> 'sourceInventoryUnitId')::uuid,
    (split_result ->> 'targetInventoryUnitId')::uuid,
    (split_result ->> 'quantity')::numeric,
    split_result ->> 'uom',
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return split_result || jsonb_build_object(
    'splitMovementId',    split_movement_uuid,
    'transferMovementId', transfer_movement_uuid
  );
end
$$;


--
-- Name: validate_cells_tree_consistency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_cells_tree_consistency() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  rack_layout_version_id uuid;
  face_rack_id uuid;
  effective_face_id uuid;
  section_face_id uuid;
  level_section_id uuid;
begin
  select r.layout_version_id
  into rack_layout_version_id
  from public.racks r
  where r.id = new.rack_id;

  if rack_layout_version_id is null or rack_layout_version_id <> new.layout_version_id then
    raise exception 'Cell % references rack % outside layout version %.', new.id, new.rack_id, new.layout_version_id;
  end if;

  select rf.rack_id, coalesce(rf.mirror_source_face_id, rf.id)
  into face_rack_id, effective_face_id
  from public.rack_faces rf
  where rf.id = new.rack_face_id;

  if face_rack_id is null or face_rack_id <> new.rack_id then
    raise exception 'Cell % references rack_face % outside rack %.', new.id, new.rack_face_id, new.rack_id;
  end if;

  select rs.rack_face_id
  into section_face_id
  from public.rack_sections rs
  where rs.id = new.rack_section_id;

  if section_face_id is null or section_face_id <> effective_face_id then
    raise exception 'Cell % references rack_section % outside effective rack_face %.', new.id, new.rack_section_id, effective_face_id;
  end if;

  select rl.rack_section_id
  into level_section_id
  from public.rack_levels rl
  where rl.id = new.rack_level_id;

  if level_section_id is null or level_section_id <> new.rack_section_id then
    raise exception 'Cell % references rack_level % outside rack_section %.', new.id, new.rack_level_id, new.rack_section_id;
  end if;

  return new;
end;
$$;


--
-- Name: validate_inventory_unit_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_inventory_unit_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  container_tenant_uuid uuid;
  source_inventory_unit_tenant_uuid uuid;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = new.container_id;

  if container_tenant_uuid is null then
    raise exception 'Container % was not found for inventory unit.', new.container_id;
  end if;

  if container_tenant_uuid <> new.tenant_id then
    raise exception 'Inventory unit tenant % does not match container tenant %.', new.tenant_id, container_tenant_uuid;
  end if;

  new.uom := trim(new.uom);
  new.lot_code := nullif(trim(coalesce(new.lot_code, '')), '');
  new.serial_no := nullif(trim(coalesce(new.serial_no, '')), '');

  if new.serial_no is not null and new.quantity <> 1 then
    raise exception 'Serial-tracked inventory units must have quantity 1.';
  end if;

  if new.source_inventory_unit_id is not null then
    select iu.tenant_id
    into source_inventory_unit_tenant_uuid
    from public.inventory_unit iu
    where iu.id = new.source_inventory_unit_id;

    if source_inventory_unit_tenant_uuid is null then
      raise exception 'Source inventory unit % was not found.', new.source_inventory_unit_id;
    end if;

    if source_inventory_unit_tenant_uuid <> new.tenant_id then
      raise exception 'Source inventory unit tenant % does not match inventory unit tenant %.', source_inventory_unit_tenant_uuid, new.tenant_id;
    end if;
  end if;

  return new;
end
$$;


--
-- Name: validate_layout_payload(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_layout_payload(layout_payload jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  rack_record jsonb;
  face_record jsonb;
  source_face jsonb;
  section_record jsonb;
  level_record jsonb;
  zone_record jsonb;
  wall_record jsonb;
  rack_ids text[];
  rack_display_codes text[];
  face_ids text[];
  face_sides text[];
  zone_ids text[];
  zone_codes text[];
  wall_ids text[];
  wall_codes text[];
begin
  if layout_payload is null or jsonb_typeof(layout_payload) <> 'object' then
    raise exception 'layout_payload must be a json object';
  end if;

  if nullif(layout_payload ->> 'layoutVersionId', '') is null then
    raise exception 'layoutVersionId is required in save_layout_draft payload';
  end if;

  if jsonb_typeof(layout_payload -> 'racks') <> 'array' then
    raise exception 'layout_payload.racks must be an array';
  end if;

  if layout_payload ? 'zones' and jsonb_typeof(layout_payload -> 'zones') <> 'array' then
    raise exception 'layout_payload.zones must be an array';
  end if;

  if layout_payload ? 'walls' and jsonb_typeof(layout_payload -> 'walls') <> 'array' then
    raise exception 'layout_payload.walls must be an array';
  end if;

  select array_agg(rack_item ->> 'id'), array_agg(rack_item ->> 'displayCode')
  into rack_ids, rack_display_codes
  from jsonb_array_elements(layout_payload -> 'racks') rack_item;

  if array_length(rack_ids, 1) is not null and array_length(rack_ids, 1) <> (
    select count(distinct rack_id) from unnest(rack_ids) rack_id
  ) then
    raise exception 'layout_payload contains duplicate rack ids';
  end if;

  if array_length(rack_display_codes, 1) is not null and array_length(rack_display_codes, 1) <> (
    select count(distinct rack_code) from unnest(rack_display_codes) rack_code
  ) then
    raise exception 'layout_payload contains duplicate rack display codes';
  end if;

  for rack_record in
    select value
    from jsonb_array_elements(layout_payload -> 'racks')
  loop
    if nullif(rack_record ->> 'id', '') is null then
      raise exception 'Each rack requires an id';
    end if;

    if jsonb_typeof(rack_record -> 'faces') <> 'array' then
      raise exception 'Rack % requires a faces array', rack_record ->> 'id';
    end if;

    select array_agg(face_item ->> 'id'), array_agg(face_item ->> 'side')
    into face_ids, face_sides
    from jsonb_array_elements(rack_record -> 'faces') face_item;

    if array_length(face_ids, 1) is not null and array_length(face_ids, 1) <> (
      select count(distinct face_id) from unnest(face_ids) face_id
    ) then
      raise exception 'Rack % contains duplicate face ids', rack_record ->> 'id';
    end if;

    if array_length(face_sides, 1) is not null and array_length(face_sides, 1) <> (
      select count(distinct face_side) from unnest(face_sides) face_side
    ) then
      raise exception 'Rack % contains duplicate face sides', rack_record ->> 'id';
    end if;

    for face_record in
      select value
      from jsonb_array_elements(rack_record -> 'faces')
    loop
      if nullif(face_record ->> 'faceLength', '') is not null and coalesce((face_record ->> 'faceLength')::numeric, 0) <= 0 then
        raise exception 'Face % requires positive faceLength when provided', face_record ->> 'id';
      end if;

      if coalesce((face_record ->> 'isMirrored')::boolean, false) then
        if face_record ->> 'side' <> 'B' then
          raise exception 'Mirrored face % must be side B', face_record ->> 'id';
        end if;

        if nullif(face_record ->> 'mirrorSourceFaceId', '') is null then
          raise exception 'Mirrored face % requires mirrorSourceFaceId', face_record ->> 'id';
        end if;

        select value
        into source_face
        from jsonb_array_elements(rack_record -> 'faces') value
        where value ->> 'id' = face_record ->> 'mirrorSourceFaceId'
        limit 1;

        if source_face is null then
          raise exception 'Mirrored face % references missing source face %', face_record ->> 'id', face_record ->> 'mirrorSourceFaceId';
        end if;

        if source_face ->> 'side' <> 'A' then
          raise exception 'Mirrored face % must reference side A source face', face_record ->> 'id';
        end if;

        if source_face ->> 'id' = face_record ->> 'id' then
          raise exception 'Face % cannot mirror itself', face_record ->> 'id';
        end if;
      elsif nullif(face_record ->> 'mirrorSourceFaceId', '') is not null then
        raise exception 'Face % has mirrorSourceFaceId while isMirrored is false', face_record ->> 'id';
      end if;

      if jsonb_typeof(face_record -> 'sections') <> 'array' then
        raise exception 'Face % requires a sections array', face_record ->> 'id';
      end if;

      for section_record in
        select value
        from jsonb_array_elements(face_record -> 'sections')
      loop
        if nullif(section_record ->> 'id', '') is null then
          raise exception 'Each section requires an id';
        end if;

        if coalesce((section_record ->> 'length')::numeric, 0) <= 0 then
          raise exception 'Section % requires positive length', section_record ->> 'id';
        end if;

        if jsonb_typeof(section_record -> 'levels') <> 'array' then
          raise exception 'Section % requires a levels array', section_record ->> 'id';
        end if;

        for level_record in
          select value
          from jsonb_array_elements(section_record -> 'levels')
        loop
          if nullif(level_record ->> 'id', '') is null then
            raise exception 'Each level requires an id';
          end if;

          if coalesce((level_record ->> 'slotCount')::integer, 0) < 1 then
            raise exception 'Level % requires slotCount >= 1', level_record ->> 'id';
          end if;
        end loop;
      end loop;
    end loop;
  end loop;

  select array_agg(zone_item ->> 'id'), array_agg(zone_item ->> 'code')
  into zone_ids, zone_codes
  from jsonb_array_elements(coalesce(layout_payload -> 'zones', '[]'::jsonb)) zone_item;

  if array_length(zone_ids, 1) is not null and array_length(zone_ids, 1) <> (
    select count(distinct zone_id) from unnest(zone_ids) zone_id
  ) then
    raise exception 'layout_payload contains duplicate zone ids';
  end if;

  if array_length(zone_codes, 1) is not null and array_length(zone_codes, 1) <> (
    select count(distinct zone_code) from unnest(zone_codes) zone_code
  ) then
    raise exception 'layout_payload contains duplicate zone codes';
  end if;

  for zone_record in
    select value
    from jsonb_array_elements(coalesce(layout_payload -> 'zones', '[]'::jsonb))
  loop
    if nullif(zone_record ->> 'id', '') is null then
      raise exception 'Each zone requires an id';
    end if;

    if nullif(zone_record ->> 'code', '') is null then
      raise exception 'Zone % requires a code', zone_record ->> 'id';
    end if;

    if nullif(zone_record ->> 'name', '') is null then
      raise exception 'Zone % requires a name', zone_record ->> 'id';
    end if;

    if nullif(zone_record ->> 'color', '') is null then
      raise exception 'Zone % requires a color', zone_record ->> 'id';
    end if;

    if nullif(zone_record ->> 'category', '') is not null
      and zone_record ->> 'category' not in ('generic', 'storage', 'staging', 'packing', 'receiving', 'custom')
    then
      raise exception 'Zone % has unsupported category %', zone_record ->> 'id', zone_record ->> 'category';
    end if;

    if coalesce((zone_record ->> 'width')::numeric, 0) <= 0 then
      raise exception 'Zone % requires positive width', zone_record ->> 'id';
    end if;

    if coalesce((zone_record ->> 'height')::numeric, 0) <= 0 then
      raise exception 'Zone % requires positive height', zone_record ->> 'id';
    end if;
  end loop;

  select array_agg(wall_item ->> 'id'), array_agg(wall_item ->> 'code')
  into wall_ids, wall_codes
  from jsonb_array_elements(coalesce(layout_payload -> 'walls', '[]'::jsonb)) wall_item;

  if array_length(wall_ids, 1) is not null and array_length(wall_ids, 1) <> (
    select count(distinct wall_id) from unnest(wall_ids) wall_id
  ) then
    raise exception 'layout_payload contains duplicate wall ids';
  end if;

  if array_length(wall_codes, 1) is not null and array_length(wall_codes, 1) <> (
    select count(distinct wall_code) from unnest(wall_codes) wall_code
  ) then
    raise exception 'layout_payload contains duplicate wall codes';
  end if;

  for wall_record in
    select value
    from jsonb_array_elements(coalesce(layout_payload -> 'walls', '[]'::jsonb))
  loop
    if nullif(wall_record ->> 'id', '') is null then
      raise exception 'Each wall requires an id';
    end if;

    if nullif(wall_record ->> 'code', '') is null then
      raise exception 'Wall % requires a code', wall_record ->> 'id';
    end if;

    if wall_record ? 'name'
      and wall_record ->> 'name' is not null
      and nullif(wall_record ->> 'name', '') is null
    then
      raise exception 'Wall % name must be non-empty when provided', wall_record ->> 'id';
    end if;

    if nullif(wall_record ->> 'wallType', '') is not null
      and wall_record ->> 'wallType' not in ('generic', 'partition', 'safety', 'perimeter', 'custom')
    then
      raise exception 'Wall % has unsupported wallType %', wall_record ->> 'id', wall_record ->> 'wallType';
    end if;

    if coalesce((wall_record ->> 'blocksRackPlacement')::boolean, false) not in (true, false) then
      raise exception 'Wall % requires blocksRackPlacement boolean', wall_record ->> 'id';
    end if;

    if (wall_record ->> 'x1')::numeric <> (wall_record ->> 'x2')::numeric
      and (wall_record ->> 'y1')::numeric <> (wall_record ->> 'y2')::numeric
    then
      raise exception 'Wall % must be axis-aligned', wall_record ->> 'id';
    end if;

    if (wall_record ->> 'x1')::numeric = (wall_record ->> 'x2')::numeric
      and (wall_record ->> 'y1')::numeric = (wall_record ->> 'y2')::numeric
    then
      raise exception 'Wall % must have non-zero length', wall_record ->> 'id';
    end if;
  end loop;
end;
$$;


--
-- Name: validate_layout_version(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_layout_version(layout_version_uuid uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  issue_count integer := 0;
  issues jsonb := '[]'::jsonb;
  duplicate_count integer := 0;
  rack_record record;
  face_record record;
  section_length_sum numeric;
  expected_face_length numeric;
  source_face record;
  rack_kind text;
begin
  if auth.uid() is not null and not public.can_access_layout_version(layout_version_uuid) then
    raise exception 'Forbidden';
  end if;

  for rack_record in
    select r.id, r.display_code, r.total_length, r.kind
    from public.racks r
    where r.layout_version_id = layout_version_uuid
  loop
    rack_kind := rack_record.kind;

    if not exists (
      select 1
      from public.rack_faces rf
      where rf.rack_id = rack_record.id
        and rf.side = 'A'
        and rf.enabled = true
    ) then
      issues := issues || jsonb_build_object('code', 'rack.face_a_required', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s must have an enabled Face A.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    if not exists (
      select 1 from public.rack_faces rf where rf.rack_id = rack_record.id and rf.enabled = true
    ) then
      issues := issues || jsonb_build_object('code', 'rack.enabled_face_required', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s must have at least one enabled face.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    if rack_kind = 'single' and exists (
      select 1 from public.rack_faces rf
      where rf.rack_id = rack_record.id and rf.side = 'B' and rf.enabled = true
        and (rf.is_mirrored = true or exists (select 1 from public.rack_sections rs where rs.rack_face_id = rf.id))
    ) then
      issues := issues || jsonb_build_object('code', 'rack.single_face_b_forbidden', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s is single but Face B is configured.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    if rack_kind = 'paired' and not exists (
      select 1 from public.rack_faces rf where rf.rack_id = rack_record.id and rf.side = 'B'
    ) then
      issues := issues || jsonb_build_object('code', 'rack.paired_face_b_required', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s is paired but Face B is missing.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    for face_record in
      select rf.* from public.rack_faces rf where rf.rack_id = rack_record.id
    loop
      if face_record.is_mirrored = true then
        if face_record.mirror_source_face_id is null then
          issues := issues || jsonb_build_object('code', 'rack_face.mirror_source_required', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s is mirrored but has no source face.', face_record.side, rack_record.display_code));
          issue_count := issue_count + 1;
        elsif face_record.mirror_source_face_id = face_record.id then
          issues := issues || jsonb_build_object('code', 'rack_face.mirror_self_reference', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s cannot mirror itself.', face_record.side, rack_record.display_code));
          issue_count := issue_count + 1;
        else
          select rf.* into source_face from public.rack_faces rf where rf.id = face_record.mirror_source_face_id;

          if source_face.id is null then
            issues := issues || jsonb_build_object('code', 'rack_face.mirror_source_missing', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s references a missing mirror source.', face_record.side, rack_record.display_code));
            issue_count := issue_count + 1;
          elsif source_face.rack_id <> rack_record.id then
            issues := issues || jsonb_build_object('code', 'rack_face.mirror_cross_rack', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s cannot mirror a face from another rack.', face_record.side, rack_record.display_code));
            issue_count := issue_count + 1;
          elsif source_face.side <> 'A' or face_record.side <> 'B' then
            issues := issues || jsonb_build_object('code', 'rack_face.mirror_side_invalid', 'severity', 'error', 'entityId', face_record.id, 'message', format('Mirrored face configuration on rack %s must be B -> A.', rack_record.display_code));
            issue_count := issue_count + 1;
          end if;
        end if;
      elsif face_record.mirror_source_face_id is not null then
        issues := issues || jsonb_build_object('code', 'rack_face.mirror_source_without_flag', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s has a mirror source but isMirrored is false.', face_record.side, rack_record.display_code));
        issue_count := issue_count + 1;
      end if;

      if face_record.enabled = false and (face_record.is_mirrored = true or exists (select 1 from public.rack_sections rs where rs.rack_face_id = face_record.id)) then
        issues := issues || jsonb_build_object('code', 'rack_face.disabled_configured', 'severity', 'warning', 'entityId', face_record.id, 'message', format('Disabled face %s on rack %s still contains configured structure.', face_record.side, rack_record.display_code));
      end if;

      if face_record.enabled = false then
        continue;
      end if;

      select coalesce(sum(rs.length), 0)
      into section_length_sum
      from public.rack_sections rs
      where rs.rack_face_id = coalesce(face_record.mirror_source_face_id, face_record.id);

      expected_face_length := coalesce(face_record.face_length, rack_record.total_length);

      if not exists (
        select 1 from public.rack_sections rs where rs.rack_face_id = coalesce(face_record.mirror_source_face_id, face_record.id)
      ) then
        issues := issues || jsonb_build_object('code', 'rack_face.sections_required', 'severity', case when face_record.side = 'B' then 'warning' else 'error' end, 'entityId', face_record.id, 'message', format('Face %s on rack %s has no configured sections.', face_record.side, rack_record.display_code));
        issue_count := issue_count + case when face_record.side = 'B' then 0 else 1 end;
      elsif abs(section_length_sum - expected_face_length) > 0.001 then
        issues := issues || jsonb_build_object('code', 'rack_face.section_length_mismatch', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s section length sum (%s) does not match face length (%s).', face_record.side, section_length_sum, expected_face_length));
        issue_count := issue_count + 1;
      end if;

      if exists (
        select 1
        from public.rack_sections rs
        left join public.rack_levels rl on rl.rack_section_id = rs.id
        where rs.rack_face_id = coalesce(face_record.mirror_source_face_id, face_record.id)
        group by rs.id
        having count(rl.id) = 0
      ) then
        issues := issues || jsonb_build_object('code', 'rack_face.levels_required', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s has a section without levels.', face_record.side, rack_record.display_code));
        issue_count := issue_count + 1;
      end if;
    end loop;
  end loop;

  with generated_addresses as (
    select public.build_cell_address(r.display_code, rf.side, rs.ordinal, rl.ordinal, gs.slot_no) as address
    from public.racks r
    join public.rack_faces rf on rf.rack_id = r.id and rf.enabled = true
    join public.rack_sections rs on rs.rack_face_id = coalesce(rf.mirror_source_face_id, rf.id)
    join public.rack_levels rl on rl.rack_section_id = rs.id
    join lateral generate_series(1, rl.slot_count) as gs(slot_no) on true
    where r.layout_version_id = layout_version_uuid
  )
  select count(*)
  into duplicate_count
  from (select address from generated_addresses group by address having count(*) > 1) duplicates;

  if duplicate_count > 0 then
    issues := issues || jsonb_build_object('code', 'layout.address_duplicate', 'severity', 'error', 'message', format('Generated duplicate addresses detected (%s).', duplicate_count));
    issue_count := issue_count + 1;
  end if;

  if issue_count > 0 then
    perform public.write_layout_event('layout_validation', 'failed', layout_version_uuid, 'layout_version', layout_version_uuid, null, jsonb_build_object('issues', issues));
  end if;

  return jsonb_build_object('isValid', issue_count = 0, 'issues', issues);
end;
$$;


--
-- Name: validate_location_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_location_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  floor_tenant_uuid uuid;
  geometry_slot_tenant_uuid uuid;
  geometry_slot_floor_uuid uuid;
  geometry_slot_layout_state text;
begin
  new.code := trim(new.code);

  select s.tenant_id
  into floor_tenant_uuid
  from public.floors f
  join public.sites s on s.id = f.site_id
  where f.id = new.floor_id;

  if floor_tenant_uuid is null then
    raise exception 'Floor % was not found for location.', new.floor_id;
  end if;

  if floor_tenant_uuid <> new.tenant_id then
    raise exception 'Location tenant % does not match floor tenant %.', new.tenant_id, floor_tenant_uuid;
  end if;

  if new.location_type = 'rack_slot' and new.geometry_slot_id is null then
    raise exception 'rack_slot locations must reference a published geometry slot.';
  end if;

  if new.location_type <> 'rack_slot' and new.geometry_slot_id is not null then
    raise exception 'Only rack_slot locations may reference a geometry slot.';
  end if;

  if new.geometry_slot_id is not null then
    select s.tenant_id, f.id, lv.state
    into geometry_slot_tenant_uuid, geometry_slot_floor_uuid, geometry_slot_layout_state
    from public.cells c
    join public.layout_versions lv on lv.id = c.layout_version_id
    join public.floors f on f.id = lv.floor_id
    join public.sites s on s.id = f.site_id
    where c.id = new.geometry_slot_id;

    if geometry_slot_tenant_uuid is null then
      raise exception 'Geometry slot % was not found for location.', new.geometry_slot_id;
    end if;

    if geometry_slot_tenant_uuid <> new.tenant_id then
      raise exception 'Location tenant % does not match geometry slot tenant %.', new.tenant_id, geometry_slot_tenant_uuid;
    end if;

    if geometry_slot_layout_state <> 'published' then
      raise exception 'Geometry slot % must belong to a published layout.', new.geometry_slot_id;
    end if;

    if geometry_slot_floor_uuid <> new.floor_id then
      raise exception 'Location floor % does not match geometry slot floor %.', new.floor_id, geometry_slot_floor_uuid;
    end if;
  end if;

  return new;
end
$$;


--
-- Name: validate_order_line_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_line_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  order_tenant_uuid uuid;
  order_status text;
  committed_line_update_allowed boolean;
begin
  select o.tenant_id, o.status
  into order_tenant_uuid, order_status
  from public.orders o
  where o.id = new.order_id;

  if order_tenant_uuid is null then
    raise exception 'Order % was not found for order line.', new.order_id;
  end if;

  if order_tenant_uuid <> new.tenant_id then
    raise exception 'Order line tenant % does not match order tenant %.', new.tenant_id, order_tenant_uuid;
  end if;

  committed_line_update_allowed :=
    coalesce(current_setting('wos.allow_committed_order_line_system_update', true), '') = 'on';

  if order_status <> 'draft' and not committed_line_update_allowed then
    raise exception 'ORDER_NOT_EDITABLE_IN_READY';
  end if;

  new.sku := trim(new.sku);
  new.name := trim(new.name);

  return new;
end
$$;


--
-- Name: validate_order_reservation_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_reservation_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  order_tenant_uuid uuid;
  line_row record;
begin
  select o.tenant_id
  into order_tenant_uuid
  from public.orders o
  where o.id = new.order_id;

  if order_tenant_uuid is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if order_tenant_uuid <> new.tenant_id then
    raise exception 'TENANT_MISMATCH';
  end if;

  select ol.tenant_id, ol.order_id, ol.product_id
  into line_row
  from public.order_lines ol
  where ol.id = new.order_line_id;

  if line_row.order_id is null then
    raise exception 'ORDER_LINE_NOT_FOUND';
  end if;

  if line_row.tenant_id <> new.tenant_id
    or line_row.order_id <> new.order_id
    or line_row.product_id is distinct from new.product_id then
    raise exception 'RESERVATION_MISMATCH';
  end if;

  return new;
end
$$;


--
-- Name: validate_order_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  wave_tenant_uuid uuid;
  target_wave_status text;
  previous_wave_status text;
  reservation_status_update_allowed boolean;
begin
  new.external_number := trim(new.external_number);
  reservation_status_update_allowed :=
    coalesce(current_setting('wos.allow_order_reservation_status_update', true), '') = 'on';

  if new.wave_id is not null then
    select w.tenant_id, w.status
    into wave_tenant_uuid, target_wave_status
    from public.waves w
    where w.id = new.wave_id;

    if wave_tenant_uuid is null then
      raise exception 'Wave % was not found for order.', new.wave_id;
    end if;

    if wave_tenant_uuid <> new.tenant_id then
      raise exception 'Order tenant % does not match wave tenant %.', new.tenant_id, wave_tenant_uuid;
    end if;

    if target_wave_status in ('released', 'closed') and (tg_op = 'INSERT' or new.wave_id is distinct from old.wave_id) then
      raise exception 'Cannot add orders to a released wave.';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.wave_id is distinct from old.wave_id and old.wave_id is not null then
    select w.status
    into previous_wave_status
    from public.waves w
    where w.id = old.wave_id;

    if previous_wave_status in ('released', 'closed') then
      raise exception 'Cannot remove orders from a released wave.';
    end if;
  end if;

  if new.status in ('ready', 'released') and not exists (
    select 1
    from public.order_lines ol
    where ol.order_id = new.id
  ) then
    raise exception 'Order % must contain at least one line before status %.', new.id, new.status;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'ready' and not reservation_status_update_allowed then
      raise exception 'ORDER_RESERVATION_REQUIRED';
    end if;

    if old.status = 'ready' and new.status = 'draft' and not reservation_status_update_allowed then
      raise exception 'ROLLBACK_TO_DRAFT_REQUIRED';
    end if;

    if old.status = 'ready' and new.status = 'released' and not reservation_status_update_allowed then
      raise exception 'RESERVATION_MISMATCH';
    end if;

    if new.status = 'closed' and not reservation_status_update_allowed then
      raise exception 'ORDER_UNRESERVE_REQUIRED';
    end if;

    if new.status = 'cancelled'
      and old.status <> 'draft'
      and not reservation_status_update_allowed then
      raise exception 'ORDER_UNRESERVE_REQUIRED';
    end if;
  end if;

  return new;
end
$$;


--
-- Name: validate_rack_face_mirror_consistency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_rack_face_mirror_consistency() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  source_face record;
begin
  if new.is_mirrored = false and new.mirror_source_face_id is null then
    return new;
  end if;

  if new.is_mirrored = false and new.mirror_source_face_id is not null then
    raise exception 'Face % has mirror_source_face_id but is_mirrored is false.', new.id;
  end if;

  if new.is_mirrored = true and new.mirror_source_face_id is null then
    raise exception 'Face % is mirrored but mirror_source_face_id is null.', new.id;
  end if;

  if new.side <> 'B' then
    raise exception 'Only side B may be mirrored. Face % has side %.', new.id, new.side;
  end if;

  if new.mirror_source_face_id = new.id then
    raise exception 'Face % cannot mirror itself.', new.id;
  end if;

  select rf.id, rf.rack_id, rf.side
  into source_face
  from public.rack_faces rf
  where rf.id = new.mirror_source_face_id;

  if source_face.id is null then
    raise exception 'Face % references missing mirror source %.', new.id, new.mirror_source_face_id;
  end if;

  if source_face.rack_id <> new.rack_id then
    raise exception 'Face % references mirror source % from another rack.', new.id, new.mirror_source_face_id;
  end if;

  if source_face.side <> 'A' then
    raise exception 'Mirrored face % must reference side A source, got side %.', new.id, source_face.side;
  end if;

  return new;
end;
$$;


--
-- Name: validate_stock_movement_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_stock_movement_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  source_location_tenant_uuid uuid;
  target_location_tenant_uuid uuid;
  source_container_tenant_uuid uuid;
  target_container_tenant_uuid uuid;
  source_inventory_unit record;
  target_inventory_unit record;
begin
  new.uom := nullif(trim(coalesce(new.uom, '')), '');

  if new.quantity is not null and new.uom is null then
    raise exception 'Stock movement quantity requires uom.';
  end if;

  if new.status = 'done' and new.completed_at is null then
    new.completed_at := new.created_at;
  end if;

  if new.source_location_id is not null then
    select l.tenant_id
    into source_location_tenant_uuid
    from public.locations l
    where l.id = new.source_location_id;

    if source_location_tenant_uuid is null or source_location_tenant_uuid <> new.tenant_id then
      raise exception 'Source location tenant mismatch for stock movement.';
    end if;
  end if;

  if new.target_location_id is not null then
    select l.tenant_id
    into target_location_tenant_uuid
    from public.locations l
    where l.id = new.target_location_id;

    if target_location_tenant_uuid is null or target_location_tenant_uuid <> new.tenant_id then
      raise exception 'Target location tenant mismatch for stock movement.';
    end if;
  end if;

  if new.source_container_id is not null then
    select c.tenant_id
    into source_container_tenant_uuid
    from public.containers c
    where c.id = new.source_container_id;

    if source_container_tenant_uuid is null or source_container_tenant_uuid <> new.tenant_id then
      raise exception 'Source container tenant mismatch for stock movement.';
    end if;
  end if;

  if new.target_container_id is not null then
    select c.tenant_id
    into target_container_tenant_uuid
    from public.containers c
    where c.id = new.target_container_id;

    if target_container_tenant_uuid is null or target_container_tenant_uuid <> new.tenant_id then
      raise exception 'Target container tenant mismatch for stock movement.';
    end if;
  end if;

  if new.source_inventory_unit_id is not null then
    select iu.id, iu.tenant_id, iu.container_id
    into source_inventory_unit
    from public.inventory_unit iu
    where iu.id = new.source_inventory_unit_id;

    if source_inventory_unit.id is null or source_inventory_unit.tenant_id <> new.tenant_id then
      raise exception 'Source inventory unit tenant mismatch for stock movement.';
    end if;

    if new.source_container_id is not null and source_inventory_unit.container_id <> new.source_container_id then
      raise exception 'Source inventory unit container mismatch for stock movement.';
    end if;
  end if;

  if new.target_inventory_unit_id is not null then
    select iu.id, iu.tenant_id, iu.container_id
    into target_inventory_unit
    from public.inventory_unit iu
    where iu.id = new.target_inventory_unit_id;

    if target_inventory_unit.id is null or target_inventory_unit.tenant_id <> new.tenant_id then
      raise exception 'Target inventory unit tenant mismatch for stock movement.';
    end if;

    if new.target_container_id is not null and target_inventory_unit.container_id <> new.target_container_id then
      raise exception 'Target inventory unit container mismatch for stock movement.';
    end if;
  end if;

  return new;
end
$$;


--
-- Name: validate_wave_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_wave_row() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.name := trim(new.name);

  if new.status in ('ready', 'released') and not exists (
    select 1
    from public.orders o
    where o.wave_id = new.id
  ) then
    raise exception 'Wave % must contain at least one order before status %.', new.id, new.status;
  end if;

  return new;
end
$$;


--
-- Name: write_layout_event(text, text, uuid, text, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.write_layout_event(p_event_type text, p_status text, p_layout_version_id uuid, p_entity_type text, p_entity_id uuid, p_actor_profile_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  resolved_floor_id uuid;
  resolved_site_id uuid;
begin
  if p_layout_version_id is not null then
    select lv.floor_id, f.site_id
    into resolved_floor_id, resolved_site_id
    from public.layout_versions lv
    join public.floors f on f.id = lv.floor_id
    where lv.id = p_layout_version_id;
  end if;

  insert into public.operation_events (
    event_type,
    actor_profile_id,
    site_id,
    floor_id,
    layout_version_id,
    entity_type,
    entity_id,
    status,
    metadata
  )
  values (
    p_event_type,
    p_actor_profile_id,
    resolved_site_id,
    resolved_floor_id,
    p_layout_version_id,
    p_entity_type,
    p_entity_id,
    p_status,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: container_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.container_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text NOT NULL,
    width_mm integer,
    height_mm integer,
    depth_mm integer,
    tare_weight_g bigint,
    max_load_g bigint,
    supports_storage boolean DEFAULT true NOT NULL,
    supports_picking boolean DEFAULT false NOT NULL
);


--
-- Name: containers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.containers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    external_code text,
    container_type_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid,
    current_location_id uuid,
    current_location_entered_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid,
    operational_role text DEFAULT 'storage'::text NOT NULL,
    system_code text DEFAULT public.generate_container_system_code() NOT NULL,
    CONSTRAINT containers_operational_role_check CHECK ((operational_role = ANY (ARRAY['storage'::text, 'pick'::text]))),
    CONSTRAINT containers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'quarantined'::text, 'closed'::text, 'lost'::text, 'damaged'::text])))
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    floor_id uuid NOT NULL,
    code text NOT NULL,
    location_type text NOT NULL,
    geometry_slot_id uuid,
    capacity_mode text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    width_mm integer,
    height_mm integer,
    depth_mm integer,
    max_weight_g bigint,
    sort_order integer,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    floor_x numeric(12,3),
    floor_y numeric(12,3),
    CONSTRAINT locations_capacity_mode_check CHECK ((capacity_mode = ANY (ARRAY['single_container'::text, 'multi_container'::text]))),
    CONSTRAINT locations_code_check CHECK ((char_length(TRIM(BOTH FROM code)) > 0)),
    CONSTRAINT locations_location_type_check CHECK ((location_type = ANY (ARRAY['rack_slot'::text, 'floor'::text, 'staging'::text, 'dock'::text, 'buffer'::text]))),
    CONSTRAINT locations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text, 'draft'::text])))
);


--
-- Name: COLUMN locations.floor_x; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.locations.floor_x IS 'Canvas world X coordinate in metres. Non-rack types only. null = unpositioned.';


--
-- Name: COLUMN locations.floor_y; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.locations.floor_y IS 'Canvas world Y coordinate in metres. Non-rack types only. null = unpositioned.';


--
-- Name: active_container_locations_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_container_locations_v AS
 SELECT c.tenant_id,
    l.floor_id,
    l.id AS location_id,
    l.code AS location_code,
    l.location_type,
    l.capacity_mode,
    l.status AS location_status,
    l.geometry_slot_id AS cell_id,
    c.id AS container_id,
    c.external_code,
    ct.code AS container_type,
    c.status AS container_status,
    c.current_location_entered_at AS placed_at,
    c.system_code
   FROM ((public.containers c
     JOIN public.locations l ON ((l.id = c.current_location_id)))
     JOIN public.container_types ct ON ((ct.id = c.container_type_id)))
  WHERE (c.current_location_id IS NOT NULL);


--
-- Name: location_occupancy_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.location_occupancy_v AS
 SELECT tenant_id,
    floor_id,
    location_id,
    location_code,
    location_type,
    capacity_mode,
    location_status,
    cell_id,
    container_id,
    external_code,
    container_type,
    container_status,
    placed_at
   FROM public.active_container_locations_v;


--
-- Name: cell_occupancy_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.cell_occupancy_v AS
 SELECT tenant_id,
    cell_id,
    container_id,
    external_code,
    container_type,
    container_status,
    placed_at
   FROM public.location_occupancy_v
  WHERE (cell_id IS NOT NULL);


--
-- Name: inventory_unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_unit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    container_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric NOT NULL,
    uom text NOT NULL,
    lot_code text,
    serial_no text,
    expiry_date date,
    status text DEFAULT 'available'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid,
    updated_by uuid,
    source_inventory_unit_id uuid,
    CONSTRAINT inventory_unit_quantity_check CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT inventory_unit_status_check CHECK ((status = ANY (ARRAY['available'::text, 'reserved'::text, 'damaged'::text, 'hold'::text]))),
    CONSTRAINT inventory_unit_uom_check CHECK ((char_length(TRIM(BOTH FROM uom)) > 0))
);


--
-- Name: location_storage_snapshot_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.location_storage_snapshot_v AS
 SELECT acl.tenant_id,
    acl.floor_id,
    acl.location_id,
    acl.location_code,
    acl.location_type,
    acl.capacity_mode,
    acl.location_status,
    acl.cell_id,
    acl.container_id,
    acl.external_code,
    acl.container_type,
    acl.container_status,
    acl.placed_at,
        CASE
            WHEN (iu.product_id IS NOT NULL) THEN ('product:'::text || (iu.product_id)::text)
            ELSE NULL::text
        END AS item_ref,
    iu.product_id,
    iu.quantity,
    iu.uom
   FROM (public.active_container_locations_v acl
     LEFT JOIN public.inventory_unit iu ON ((iu.container_id = acl.container_id)));


--
-- Name: cell_storage_snapshot_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.cell_storage_snapshot_v AS
 SELECT tenant_id,
    cell_id,
    container_id,
    external_code,
    container_type,
    container_status,
    placed_at,
    item_ref,
    product_id,
    quantity,
    uom
   FROM public.location_storage_snapshot_v
  WHERE (cell_id IS NOT NULL);


--
-- Name: cells; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cells (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    layout_version_id uuid NOT NULL,
    rack_id uuid NOT NULL,
    rack_face_id uuid NOT NULL,
    rack_section_id uuid NOT NULL,
    rack_level_id uuid NOT NULL,
    slot_no integer NOT NULL,
    address text NOT NULL,
    address_sort_key text NOT NULL,
    x numeric(12,3),
    y numeric(12,3),
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    cell_code text NOT NULL,
    CONSTRAINT cells_slot_no_check CHECK ((slot_no >= 1)),
    CONSTRAINT cells_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: container_storage_canonical_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.container_storage_canonical_v AS
 SELECT c.tenant_id,
    c.id AS container_id,
    c.external_code,
    ct.code AS container_type,
    c.status AS container_status,
        CASE
            WHEN (iu.product_id IS NOT NULL) THEN ('product:'::text || (iu.product_id)::text)
            ELSE NULL::text
        END AS item_ref,
    iu.product_id,
    iu.quantity,
    iu.uom,
    iu.lot_code,
    iu.serial_no,
    iu.expiry_date,
    iu.status AS inventory_status,
    c.system_code
   FROM ((public.containers c
     JOIN public.container_types ct ON ((ct.id = c.container_type_id)))
     LEFT JOIN public.inventory_unit iu ON ((iu.container_id = c.id)));


--
-- Name: container_storage_snapshot_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.container_storage_snapshot_v AS
 SELECT c.tenant_id,
    c.id AS container_id,
    c.external_code,
    ct.code AS container_type,
    c.status AS container_status,
        CASE
            WHEN (iu.product_id IS NOT NULL) THEN ('product:'::text || (iu.product_id)::text)
            ELSE NULL::text
        END AS item_ref,
    iu.product_id,
    iu.quantity,
    iu.uom
   FROM ((public.containers c
     JOIN public.container_types ct ON ((ct.id = c.container_type_id)))
     LEFT JOIN public.inventory_unit iu ON ((iu.container_id = c.id)));


--
-- Name: container_system_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.container_system_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: floors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.floors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: layout_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layout_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    floor_id uuid NOT NULL,
    version_no integer NOT NULL,
    state text NOT NULL,
    parent_published_version_id uuid,
    created_by uuid,
    published_by uuid,
    published_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    draft_version integer DEFAULT 1 NOT NULL,
    CONSTRAINT layout_versions_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: layout_walls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layout_walls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    layout_version_id uuid NOT NULL,
    code text NOT NULL,
    name text,
    wall_type text,
    x1 numeric(12,3) NOT NULL,
    y1 numeric(12,3) NOT NULL,
    x2 numeric(12,3) NOT NULL,
    y2 numeric(12,3) NOT NULL,
    blocks_rack_placement boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT layout_walls_axis_aligned CHECK (((x1 = x2) OR (y1 = y2))),
    CONSTRAINT layout_walls_code_present CHECK ((btrim(code) <> ''::text)),
    CONSTRAINT layout_walls_name_present CHECK (((name IS NULL) OR (btrim(name) <> ''::text))),
    CONSTRAINT layout_walls_nonzero_length CHECK (((x1 <> x2) OR (y1 <> y2))),
    CONSTRAINT layout_walls_wall_type_check CHECK (((wall_type IS NULL) OR (wall_type = ANY (ARRAY['generic'::text, 'partition'::text, 'safety'::text, 'perimeter'::text, 'custom'::text]))))
);


--
-- Name: layout_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.layout_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    layout_version_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text,
    color text NOT NULL,
    x numeric(12,3) NOT NULL,
    y numeric(12,3) NOT NULL,
    width numeric(12,3) NOT NULL,
    height numeric(12,3) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT layout_zones_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['generic'::text, 'storage'::text, 'staging'::text, 'packing'::text, 'receiving'::text, 'custom'::text])))),
    CONSTRAINT layout_zones_code_present CHECK ((btrim(code) <> ''::text)),
    CONSTRAINT layout_zones_color_present CHECK ((btrim(color) <> ''::text)),
    CONSTRAINT layout_zones_height_positive CHECK ((height > (0)::numeric)),
    CONSTRAINT layout_zones_name_present CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT layout_zones_width_positive CHECK ((width > (0)::numeric))
);


--
-- Name: location_storage_canonical_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.location_storage_canonical_v AS
 SELECT acl.tenant_id,
    acl.floor_id,
    acl.location_id,
    acl.location_code,
    acl.location_type,
    acl.capacity_mode,
    acl.location_status,
    acl.cell_id,
    acl.container_id,
    acl.external_code,
    acl.container_type,
    acl.container_status,
    acl.placed_at,
        CASE
            WHEN (iu.product_id IS NOT NULL) THEN ('product:'::text || (iu.product_id)::text)
            ELSE NULL::text
        END AS item_ref,
    iu.product_id,
    iu.quantity,
    iu.uom,
    iu.lot_code,
    iu.serial_no,
    iu.expiry_date,
    iu.status AS inventory_status,
    acl.system_code
   FROM (public.active_container_locations_v acl
     LEFT JOIN public.inventory_unit iu ON ((iu.container_id = acl.container_id)));


--
-- Name: movement_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movement_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    floor_id uuid NOT NULL,
    container_id uuid NOT NULL,
    from_cell_id uuid,
    to_cell_id uuid,
    event_type text NOT NULL,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT movement_events_event_type_check CHECK ((event_type = ANY (ARRAY['placed'::text, 'removed'::text, 'moved'::text])))
);


--
-- Name: operation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    event_type text NOT NULL,
    actor_profile_id uuid,
    site_id uuid,
    floor_id uuid,
    layout_version_id uuid,
    entity_type text NOT NULL,
    entity_id uuid,
    status text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT operation_events_status_check CHECK ((status = ANY (ARRAY['succeeded'::text, 'failed'::text])))
);


--
-- Name: order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    qty_required integer NOT NULL,
    qty_picked integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    product_id uuid,
    CONSTRAINT order_lines_name_check CHECK ((char_length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT order_lines_qty_picked_check CHECK ((qty_picked >= 0)),
    CONSTRAINT order_lines_qty_required_check CHECK ((qty_required > 0)),
    CONSTRAINT order_lines_sku_check CHECK ((char_length(TRIM(BOTH FROM sku)) > 0)),
    CONSTRAINT order_lines_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'released'::text, 'picking'::text, 'picked'::text, 'partial'::text, 'skipped'::text, 'exception'::text])))
);


--
-- Name: order_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_line_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    released_at timestamp with time zone,
    rolled_back_at timestamp with time zone,
    closed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_by uuid,
    released_by uuid,
    rolled_back_by uuid,
    closed_by uuid,
    cancelled_by uuid,
    rollback_reason text,
    cancel_reason text,
    CONSTRAINT order_reservations_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT order_reservations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'released'::text, 'rolled_back'::text, 'closed'::text, 'cancelled'::text])))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    external_number text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    wave_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    released_at timestamp with time zone,
    closed_at timestamp with time zone,
    CONSTRAINT orders_external_number_check CHECK ((char_length(TRIM(BOTH FROM external_number)) > 0)),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'released'::text, 'picking'::text, 'picked'::text, 'partial'::text, 'closed'::text, 'cancelled'::text])))
);


--
-- Name: pick_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pick_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid,
    order_line_id uuid,
    sequence_no integer NOT NULL,
    sku text NOT NULL,
    item_name text NOT NULL,
    qty_required integer NOT NULL,
    qty_picked integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    source_cell_id uuid,
    source_container_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    inventory_unit_id uuid,
    pick_container_id uuid,
    executed_at timestamp with time zone,
    executed_by uuid,
    CONSTRAINT pick_steps_item_name_check CHECK ((char_length(TRIM(BOTH FROM item_name)) > 0)),
    CONSTRAINT pick_steps_qty_picked_check CHECK ((qty_picked >= 0)),
    CONSTRAINT pick_steps_qty_required_check CHECK ((qty_required > 0)),
    CONSTRAINT pick_steps_sku_check CHECK ((char_length(TRIM(BOTH FROM sku)) > 0)),
    CONSTRAINT pick_steps_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'picked'::text, 'partial'::text, 'skipped'::text, 'exception'::text, 'needs_replenishment'::text])))
);


--
-- Name: pick_task_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pick_task_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pick_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pick_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    status text DEFAULT 'ready'::text NOT NULL,
    assigned_to uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    task_number text DEFAULT public.generate_pick_task_number() NOT NULL,
    CONSTRAINT pick_tasks_source_type_check CHECK ((source_type = ANY (ARRAY['order'::text, 'wave'::text]))),
    CONSTRAINT pick_tasks_status_check CHECK ((status = ANY (ARRAY['ready'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'completed_with_exceptions'::text])))
);


--
-- Name: product_location_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_location_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    location_id uuid NOT NULL,
    role text NOT NULL,
    state text DEFAULT 'published'::text NOT NULL,
    layout_version_id uuid,
    effective_from timestamp with time zone,
    effective_to timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT product_location_roles_role_check CHECK ((role = ANY (ARRAY['primary_pick'::text, 'reserve'::text]))),
    CONSTRAINT product_location_roles_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'published'::text, 'inactive'::text])))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    external_product_id text NOT NULL,
    sku text,
    name text NOT NULL,
    permalink text,
    image_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    image_files jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    unit_weight_g bigint
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    display_name text,
    role text DEFAULT 'operator'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'operator'::text, 'picker'::text])))
);


--
-- Name: rack_faces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rack_faces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rack_id uuid NOT NULL,
    side text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    slot_numbering_direction text NOT NULL,
    is_mirrored boolean DEFAULT false NOT NULL,
    mirror_source_face_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    face_length numeric(12,3),
    CONSTRAINT rack_faces_face_length_positive CHECK (((face_length IS NULL) OR (face_length > (0)::numeric))),
    CONSTRAINT rack_faces_side_check CHECK ((side = ANY (ARRAY['A'::text, 'B'::text]))),
    CONSTRAINT rack_faces_slot_numbering_direction_check CHECK ((slot_numbering_direction = ANY (ARRAY['ltr'::text, 'rtl'::text])))
);


--
-- Name: rack_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rack_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rack_section_id uuid NOT NULL,
    ordinal integer NOT NULL,
    slot_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT rack_levels_ordinal_check CHECK ((ordinal >= 1)),
    CONSTRAINT rack_levels_slot_count_check CHECK ((slot_count >= 1))
);


--
-- Name: rack_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rack_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rack_face_id uuid NOT NULL,
    ordinal integer NOT NULL,
    length numeric(12,3) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT rack_sections_length_check CHECK ((length > (0)::numeric)),
    CONSTRAINT rack_sections_ordinal_check CHECK ((ordinal >= 1))
);


--
-- Name: racks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.racks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    layout_version_id uuid NOT NULL,
    display_code text NOT NULL,
    kind text NOT NULL,
    axis text NOT NULL,
    x numeric(12,3) NOT NULL,
    y numeric(12,3) NOT NULL,
    total_length numeric(12,3) NOT NULL,
    depth numeric(12,3) NOT NULL,
    rotation_deg integer NOT NULL,
    state text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT racks_axis_check CHECK ((axis = ANY (ARRAY['NS'::text, 'WE'::text]))),
    CONSTRAINT racks_depth_check CHECK ((depth > (0)::numeric)),
    CONSTRAINT racks_kind_check CHECK ((kind = ANY (ARRAY['single'::text, 'paired'::text]))),
    CONSTRAINT racks_rotation_deg_check CHECK ((rotation_deg = ANY (ARRAY[0, 90, 180, 270]))),
    CONSTRAINT racks_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'configured'::text, 'published'::text]))),
    CONSTRAINT racks_total_length_check CHECK ((total_length > (0)::numeric))
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    tenant_id uuid NOT NULL
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    movement_type text NOT NULL,
    source_location_id uuid,
    target_location_id uuid,
    source_container_id uuid,
    target_container_id uuid,
    source_inventory_unit_id uuid,
    target_inventory_unit_id uuid,
    quantity numeric,
    uom text,
    status text DEFAULT 'done'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at timestamp with time zone,
    created_by uuid,
    CONSTRAINT stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['receive'::text, 'putaway'::text, 'move_container'::text, 'place_container'::text, 'remove_container'::text, 'split_stock'::text, 'transfer_stock'::text, 'pick_partial'::text, 'ship'::text, 'adjust'::text]))),
    CONSTRAINT stock_movements_quantity_check CHECK (((quantity IS NULL) OR (quantity >= (0)::numeric))),
    CONSTRAINT stock_movements_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'done'::text, 'cancelled'::text])))
);


--
-- Name: tenant_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_members (
    tenant_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT tenant_members_role_check CHECK ((role = ANY (ARRAY['platform_admin'::text, 'tenant_admin'::text, 'operator'::text])))
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: waves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waves (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    released_at timestamp with time zone,
    closed_at timestamp with time zone,
    CONSTRAINT waves_name_check CHECK ((char_length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT waves_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'released'::text, 'in_progress'::text, 'completed'::text, 'partial'::text, 'closed'::text])))
);


--
-- Name: cells cells_face_level_slot_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cells
    ADD CONSTRAINT cells_face_level_slot_unique UNIQUE (rack_face_id, rack_level_id, slot_no);


--
-- Name: cells cells_layout_address_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cells
    ADD CONSTRAINT cells_layout_address_unique UNIQUE (layout_version_id, address);


--
-- Name: cells cells_layout_cell_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cells
    ADD CONSTRAINT cells_layout_cell_code_unique UNIQUE (layout_version_id, cell_code);


--
-- Name: cells cells_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cells
    ADD CONSTRAINT cells_pkey PRIMARY KEY (id);


--
-- Name: container_types container_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_types
    ADD CONSTRAINT container_types_code_key UNIQUE (code);


--
-- Name: container_types container_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container_types
    ADD CONSTRAINT container_types_pkey PRIMARY KEY (id);


--
-- Name: containers containers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_pkey PRIMARY KEY (id);


--
-- Name: floors floors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_pkey PRIMARY KEY (id);


--
-- Name: floors floors_site_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_site_code_unique UNIQUE (site_id, code);


--
-- Name: inventory_unit inventory_unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit
    ADD CONSTRAINT inventory_unit_pkey PRIMARY KEY (id);


--
-- Name: layout_versions layout_versions_floor_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_versions
    ADD CONSTRAINT layout_versions_floor_version_unique UNIQUE (floor_id, version_no);


--
-- Name: layout_versions layout_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_versions
    ADD CONSTRAINT layout_versions_pkey PRIMARY KEY (id);


--
-- Name: layout_walls layout_walls_code_unique_per_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_walls
    ADD CONSTRAINT layout_walls_code_unique_per_version UNIQUE (layout_version_id, code);


--
-- Name: layout_walls layout_walls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_walls
    ADD CONSTRAINT layout_walls_pkey PRIMARY KEY (id);


--
-- Name: layout_zones layout_zones_code_unique_per_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_zones
    ADD CONSTRAINT layout_zones_code_unique_per_version UNIQUE (layout_version_id, code);


--
-- Name: layout_zones layout_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_zones
    ADD CONSTRAINT layout_zones_pkey PRIMARY KEY (id);


--
-- Name: locations locations_floor_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_floor_id_code_key UNIQUE (floor_id, code);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: movement_events movement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movement_events
    ADD CONSTRAINT movement_events_pkey PRIMARY KEY (id);


--
-- Name: operation_events operation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_events
    ADD CONSTRAINT operation_events_pkey PRIMARY KEY (id);


--
-- Name: order_lines order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_pkey PRIMARY KEY (id);


--
-- Name: order_reservations order_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: pick_steps pick_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_steps
    ADD CONSTRAINT pick_steps_pkey PRIMARY KEY (id);


--
-- Name: pick_tasks pick_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_tasks
    ADD CONSTRAINT pick_tasks_pkey PRIMARY KEY (id);


--
-- Name: product_location_roles product_location_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_location_roles
    ADD CONSTRAINT product_location_roles_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rack_faces rack_faces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_faces
    ADD CONSTRAINT rack_faces_pkey PRIMARY KEY (id);


--
-- Name: rack_faces rack_faces_rack_side_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_faces
    ADD CONSTRAINT rack_faces_rack_side_unique UNIQUE (rack_id, side);


--
-- Name: rack_levels rack_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_levels
    ADD CONSTRAINT rack_levels_pkey PRIMARY KEY (id);


--
-- Name: rack_levels rack_levels_section_ordinal_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_levels
    ADD CONSTRAINT rack_levels_section_ordinal_unique UNIQUE (rack_section_id, ordinal);


--
-- Name: rack_sections rack_sections_face_ordinal_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_sections
    ADD CONSTRAINT rack_sections_face_ordinal_unique UNIQUE (rack_face_id, ordinal);


--
-- Name: rack_sections rack_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_sections
    ADD CONSTRAINT rack_sections_pkey PRIMARY KEY (id);


--
-- Name: racks racks_layout_display_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racks
    ADD CONSTRAINT racks_layout_display_code_unique UNIQUE (layout_version_id, display_code);


--
-- Name: racks racks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racks
    ADD CONSTRAINT racks_pkey PRIMARY KEY (id);


--
-- Name: sites sites_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_code_key UNIQUE (code);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: tenant_members tenant_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_members
    ADD CONSTRAINT tenant_members_pkey PRIMARY KEY (tenant_id, profile_id);


--
-- Name: tenants tenants_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_code_key UNIQUE (code);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: waves waves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waves
    ADD CONSTRAINT waves_pkey PRIMARY KEY (id);


--
-- Name: containers_container_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX containers_container_type_idx ON public.containers USING btree (container_type_id);


--
-- Name: containers_current_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX containers_current_location_idx ON public.containers USING btree (current_location_id) WHERE (current_location_id IS NOT NULL);


--
-- Name: containers_role_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX containers_role_status_idx ON public.containers USING btree (tenant_id, operational_role, status);


--
-- Name: containers_system_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX containers_system_code_unique ON public.containers USING btree (system_code);


--
-- Name: containers_tenant_external_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX containers_tenant_external_code_unique ON public.containers USING btree (tenant_id, external_code) WHERE (external_code IS NOT NULL);


--
-- Name: containers_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX containers_tenant_idx ON public.containers USING btree (tenant_id);


--
-- Name: inventory_unit_expiry_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_unit_expiry_date_idx ON public.inventory_unit USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);


--
-- Name: inventory_unit_lot_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_unit_lot_code_idx ON public.inventory_unit USING btree (lot_code) WHERE (lot_code IS NOT NULL);


--
-- Name: inventory_unit_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_unit_product_idx ON public.inventory_unit USING btree (product_id);


--
-- Name: inventory_unit_serial_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_unit_serial_unique ON public.inventory_unit USING btree (tenant_id, serial_no) WHERE (serial_no IS NOT NULL);


--
-- Name: inventory_unit_source_inventory_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_unit_source_inventory_unit_idx ON public.inventory_unit USING btree (source_inventory_unit_id) WHERE (source_inventory_unit_id IS NOT NULL);


--
-- Name: inventory_unit_tenant_container_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_unit_tenant_container_idx ON public.inventory_unit USING btree (tenant_id, container_id);


--
-- Name: layout_versions_one_draft_per_floor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX layout_versions_one_draft_per_floor_idx ON public.layout_versions USING btree (floor_id) WHERE (state = 'draft'::text);


--
-- Name: layout_versions_one_published_per_floor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX layout_versions_one_published_per_floor_idx ON public.layout_versions USING btree (floor_id) WHERE (state = 'published'::text);


--
-- Name: layout_walls_layout_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX layout_walls_layout_version_idx ON public.layout_walls USING btree (layout_version_id);


--
-- Name: layout_zones_layout_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX layout_zones_layout_version_idx ON public.layout_zones USING btree (layout_version_id);


--
-- Name: locations_geometry_slot_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX locations_geometry_slot_unique ON public.locations USING btree (geometry_slot_id) WHERE (geometry_slot_id IS NOT NULL);


--
-- Name: locations_tenant_floor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locations_tenant_floor_idx ON public.locations USING btree (tenant_id, floor_id);


--
-- Name: locations_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX locations_type_status_idx ON public.locations USING btree (location_type, status);


--
-- Name: movement_events_container_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movement_events_container_created_idx ON public.movement_events USING btree (container_id, created_at DESC);


--
-- Name: movement_events_tenant_floor_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movement_events_tenant_floor_created_idx ON public.movement_events USING btree (tenant_id, floor_id, created_at DESC);


--
-- Name: operation_events_floor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX operation_events_floor_idx ON public.operation_events USING btree (floor_id, created_at DESC);


--
-- Name: operation_events_layout_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX operation_events_layout_version_idx ON public.operation_events USING btree (layout_version_id, created_at DESC);


--
-- Name: order_lines_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_lines_order_idx ON public.order_lines USING btree (order_id);


--
-- Name: order_lines_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_lines_product_id_idx ON public.order_lines USING btree (product_id);


--
-- Name: order_lines_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_lines_tenant_idx ON public.order_lines USING btree (tenant_id);


--
-- Name: order_reservations_active_line_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX order_reservations_active_line_unique ON public.order_reservations USING btree (order_line_id) WHERE (status = ANY (ARRAY['active'::text, 'released'::text]));


--
-- Name: order_reservations_tenant_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_reservations_tenant_order_idx ON public.order_reservations USING btree (tenant_id, order_id);


--
-- Name: order_reservations_tenant_order_line_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_reservations_tenant_order_line_idx ON public.order_reservations USING btree (tenant_id, order_line_id);


--
-- Name: order_reservations_tenant_product_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_reservations_tenant_product_status_idx ON public.order_reservations USING btree (tenant_id, product_id, status);


--
-- Name: orders_tenant_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_tenant_created_idx ON public.orders USING btree (tenant_id, created_at DESC);


--
-- Name: orders_tenant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_tenant_status_idx ON public.orders USING btree (tenant_id, status);


--
-- Name: pick_steps_executed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pick_steps_executed_at_idx ON public.pick_steps USING btree (task_id, executed_at) WHERE (executed_at IS NOT NULL);


--
-- Name: pick_steps_inventory_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pick_steps_inventory_unit_idx ON public.pick_steps USING btree (inventory_unit_id) WHERE (inventory_unit_id IS NOT NULL);


--
-- Name: pick_steps_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pick_steps_order_idx ON public.pick_steps USING btree (order_id);


--
-- Name: pick_steps_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pick_steps_task_idx ON public.pick_steps USING btree (task_id, sequence_no);


--
-- Name: pick_steps_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pick_steps_tenant_idx ON public.pick_steps USING btree (tenant_id);


--
-- Name: pick_tasks_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pick_tasks_source_idx ON public.pick_tasks USING btree (source_type, source_id);


--
-- Name: pick_tasks_task_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pick_tasks_task_number_unique ON public.pick_tasks USING btree (task_number);


--
-- Name: pick_tasks_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pick_tasks_tenant_idx ON public.pick_tasks USING btree (tenant_id);


--
-- Name: product_location_roles_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_location_roles_location_idx ON public.product_location_roles USING btree (tenant_id, location_id);


--
-- Name: product_location_roles_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_location_roles_product_idx ON public.product_location_roles USING btree (tenant_id, product_id, role, state);


--
-- Name: product_location_roles_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_location_roles_unique_active ON public.product_location_roles USING btree (tenant_id, product_id, location_id, role) WHERE (state = 'published'::text);


--
-- Name: products_active_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_active_name_idx ON public.products USING btree (is_active, name);


--
-- Name: products_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_sku_idx ON public.products USING btree (sku);


--
-- Name: products_source_external_product_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_source_external_product_id_key ON public.products USING btree (source, external_product_id);


--
-- Name: stock_movements_source_container_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_source_container_created_idx ON public.stock_movements USING btree (source_container_id, created_at DESC) WHERE (source_container_id IS NOT NULL);


--
-- Name: stock_movements_source_inventory_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_source_inventory_created_idx ON public.stock_movements USING btree (source_inventory_unit_id, created_at DESC) WHERE (source_inventory_unit_id IS NOT NULL);


--
-- Name: stock_movements_source_location_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_source_location_created_idx ON public.stock_movements USING btree (source_location_id, created_at DESC) WHERE (source_location_id IS NOT NULL);


--
-- Name: stock_movements_target_container_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_target_container_created_idx ON public.stock_movements USING btree (target_container_id, created_at DESC) WHERE (target_container_id IS NOT NULL);


--
-- Name: stock_movements_target_inventory_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_target_inventory_created_idx ON public.stock_movements USING btree (target_inventory_unit_id, created_at DESC) WHERE (target_inventory_unit_id IS NOT NULL);


--
-- Name: stock_movements_target_location_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_target_location_created_idx ON public.stock_movements USING btree (target_location_id, created_at DESC) WHERE (target_location_id IS NOT NULL);


--
-- Name: stock_movements_tenant_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_tenant_created_idx ON public.stock_movements USING btree (tenant_id, created_at DESC);


--
-- Name: tenant_members_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_members_profile_idx ON public.tenant_members USING btree (profile_id);


--
-- Name: waves_tenant_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waves_tenant_created_idx ON public.waves USING btree (tenant_id, created_at DESC);


--
-- Name: waves_tenant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waves_tenant_status_idx ON public.waves USING btree (tenant_id, status);


--
-- Name: cells cells_tree_consistency_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER cells_tree_consistency_trigger AFTER INSERT OR UPDATE OF layout_version_id, rack_id, rack_face_id, rack_section_id, rack_level_id ON public.cells DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION public.validate_cells_tree_consistency();


--
-- Name: layout_walls layout_walls_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER layout_walls_set_updated_at BEFORE UPDATE ON public.layout_walls FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: layout_zones layout_zones_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER layout_zones_set_updated_at BEFORE UPDATE ON public.layout_zones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles on_profile_created_provision_default_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_created_provision_default_tenant AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.provision_default_tenant_membership();


--
-- Name: order_lines prevent_committed_order_line_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_committed_order_line_delete BEFORE DELETE ON public.order_lines FOR EACH ROW EXECUTE FUNCTION public.prevent_committed_order_line_delete();


--
-- Name: rack_faces rack_faces_mirror_consistency_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER rack_faces_mirror_consistency_trigger AFTER INSERT OR UPDATE OF rack_id, side, is_mirrored, mirror_source_face_id ON public.rack_faces DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_rack_face_mirror_consistency();


--
-- Name: cells set_cells_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cells_updated_at BEFORE UPDATE ON public.cells FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: containers set_containers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_containers_updated_at BEFORE UPDATE ON public.containers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: floors set_floors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_floors_updated_at BEFORE UPDATE ON public.floors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inventory_unit set_inventory_unit_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_inventory_unit_updated_at BEFORE UPDATE ON public.inventory_unit FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: layout_versions set_layout_versions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_layout_versions_updated_at BEFORE UPDATE ON public.layout_versions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: locations set_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: order_reservations set_order_reservations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_order_reservations_updated_at BEFORE UPDATE ON public.order_reservations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_location_roles set_product_location_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_product_location_roles_updated_at BEFORE UPDATE ON public.product_location_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products set_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rack_faces set_rack_faces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rack_faces_updated_at BEFORE UPDATE ON public.rack_faces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rack_levels set_rack_levels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rack_levels_updated_at BEFORE UPDATE ON public.rack_levels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: rack_sections set_rack_sections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rack_sections_updated_at BEFORE UPDATE ON public.rack_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: racks set_racks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_racks_updated_at BEFORE UPDATE ON public.racks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sites set_sites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenants set_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cells sync_published_cell_to_location; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_published_cell_to_location AFTER INSERT OR UPDATE OF address, cell_code, layout_version_id ON public.cells FOR EACH ROW EXECUTE FUNCTION public.sync_published_cell_to_location();


--
-- Name: inventory_unit validate_inventory_unit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_inventory_unit_row BEFORE INSERT OR UPDATE ON public.inventory_unit FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_unit_row();


--
-- Name: locations validate_location_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_location_row BEFORE INSERT OR UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.validate_location_row();


--
-- Name: order_lines validate_order_line_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_order_line_row BEFORE INSERT OR UPDATE ON public.order_lines FOR EACH ROW EXECUTE FUNCTION public.validate_order_line_row();


--
-- Name: order_reservations validate_order_reservation_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_order_reservation_row BEFORE INSERT OR UPDATE ON public.order_reservations FOR EACH ROW EXECUTE FUNCTION public.validate_order_reservation_row();


--
-- Name: orders validate_order_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_order_row BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_row();


--
-- Name: stock_movements validate_stock_movement_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_stock_movement_row BEFORE INSERT OR UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.validate_stock_movement_row();


--
-- Name: waves validate_wave_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_wave_row BEFORE INSERT OR UPDATE ON public.waves FOR EACH ROW EXECUTE FUNCTION public.validate_wave_row();


--
-- Name: cells cells_layout_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cells
    ADD CONSTRAINT cells_layout_version_id_fkey FOREIGN KEY (layout_version_id) REFERENCES public.layout_versions(id) ON DELETE CASCADE;


--
-- Name: cells cells_rack_face_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cells
    ADD CONSTRAINT cells_rack_face_id_fkey FOREIGN KEY (rack_face_id) REFERENCES public.rack_faces(id) ON DELETE CASCADE;


--
-- Name: cells cells_rack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cells
    ADD CONSTRAINT cells_rack_id_fkey FOREIGN KEY (rack_id) REFERENCES public.racks(id) ON DELETE CASCADE;


--
-- Name: cells cells_rack_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cells
    ADD CONSTRAINT cells_rack_level_id_fkey FOREIGN KEY (rack_level_id) REFERENCES public.rack_levels(id) ON DELETE CASCADE;


--
-- Name: cells cells_rack_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cells
    ADD CONSTRAINT cells_rack_section_id_fkey FOREIGN KEY (rack_section_id) REFERENCES public.rack_sections(id) ON DELETE CASCADE;


--
-- Name: containers containers_container_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_container_type_id_fkey FOREIGN KEY (container_type_id) REFERENCES public.container_types(id);


--
-- Name: containers containers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: containers containers_current_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_current_location_id_fkey FOREIGN KEY (current_location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: containers containers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: containers containers_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.containers
    ADD CONSTRAINT containers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: floors floors_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: inventory_unit inventory_unit_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit
    ADD CONSTRAINT inventory_unit_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.containers(id) ON DELETE CASCADE;


--
-- Name: inventory_unit inventory_unit_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit
    ADD CONSTRAINT inventory_unit_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: inventory_unit inventory_unit_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit
    ADD CONSTRAINT inventory_unit_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_unit inventory_unit_source_inventory_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit
    ADD CONSTRAINT inventory_unit_source_inventory_unit_id_fkey FOREIGN KEY (source_inventory_unit_id) REFERENCES public.inventory_unit(id) ON DELETE SET NULL;


--
-- Name: inventory_unit inventory_unit_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit
    ADD CONSTRAINT inventory_unit_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: inventory_unit inventory_unit_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit
    ADD CONSTRAINT inventory_unit_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: layout_versions layout_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_versions
    ADD CONSTRAINT layout_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: layout_versions layout_versions_floor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_versions
    ADD CONSTRAINT layout_versions_floor_id_fkey FOREIGN KEY (floor_id) REFERENCES public.floors(id) ON DELETE CASCADE;


--
-- Name: layout_versions layout_versions_parent_published_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_versions
    ADD CONSTRAINT layout_versions_parent_published_version_id_fkey FOREIGN KEY (parent_published_version_id) REFERENCES public.layout_versions(id);


--
-- Name: layout_versions layout_versions_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_versions
    ADD CONSTRAINT layout_versions_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.profiles(id);


--
-- Name: layout_walls layout_walls_layout_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_walls
    ADD CONSTRAINT layout_walls_layout_version_id_fkey FOREIGN KEY (layout_version_id) REFERENCES public.layout_versions(id) ON DELETE CASCADE;


--
-- Name: layout_zones layout_zones_layout_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.layout_zones
    ADD CONSTRAINT layout_zones_layout_version_id_fkey FOREIGN KEY (layout_version_id) REFERENCES public.layout_versions(id) ON DELETE CASCADE;


--
-- Name: locations locations_floor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_floor_id_fkey FOREIGN KEY (floor_id) REFERENCES public.floors(id) ON DELETE CASCADE;


--
-- Name: locations locations_geometry_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_geometry_slot_id_fkey FOREIGN KEY (geometry_slot_id) REFERENCES public.cells(id) ON DELETE RESTRICT;


--
-- Name: locations locations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: movement_events movement_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movement_events
    ADD CONSTRAINT movement_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: movement_events movement_events_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movement_events
    ADD CONSTRAINT movement_events_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.containers(id) ON DELETE CASCADE;


--
-- Name: movement_events movement_events_floor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movement_events
    ADD CONSTRAINT movement_events_floor_id_fkey FOREIGN KEY (floor_id) REFERENCES public.floors(id) ON DELETE CASCADE;


--
-- Name: movement_events movement_events_from_cell_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movement_events
    ADD CONSTRAINT movement_events_from_cell_id_fkey FOREIGN KEY (from_cell_id) REFERENCES public.cells(id) ON DELETE RESTRICT;


--
-- Name: movement_events movement_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movement_events
    ADD CONSTRAINT movement_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: movement_events movement_events_to_cell_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movement_events
    ADD CONSTRAINT movement_events_to_cell_id_fkey FOREIGN KEY (to_cell_id) REFERENCES public.cells(id) ON DELETE RESTRICT;


--
-- Name: operation_events operation_events_actor_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_events
    ADD CONSTRAINT operation_events_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id);


--
-- Name: operation_events operation_events_floor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_events
    ADD CONSTRAINT operation_events_floor_id_fkey FOREIGN KEY (floor_id) REFERENCES public.floors(id) ON DELETE SET NULL;


--
-- Name: operation_events operation_events_layout_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_events
    ADD CONSTRAINT operation_events_layout_version_id_fkey FOREIGN KEY (layout_version_id) REFERENCES public.layout_versions(id) ON DELETE SET NULL;


--
-- Name: operation_events operation_events_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_events
    ADD CONSTRAINT operation_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: order_lines order_lines_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_lines order_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_lines order_lines_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: order_reservations order_reservations_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id);


--
-- Name: order_reservations order_reservations_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.profiles(id);


--
-- Name: order_reservations order_reservations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: order_reservations order_reservations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_reservations order_reservations_order_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_order_line_id_fkey FOREIGN KEY (order_line_id) REFERENCES public.order_lines(id) ON DELETE CASCADE;


--
-- Name: order_reservations order_reservations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_reservations order_reservations_released_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.profiles(id);


--
-- Name: order_reservations order_reservations_rolled_back_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_rolled_back_by_fkey FOREIGN KEY (rolled_back_by) REFERENCES public.profiles(id);


--
-- Name: order_reservations order_reservations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reservations
    ADD CONSTRAINT order_reservations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: orders orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: orders orders_wave_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_wave_id_fkey FOREIGN KEY (wave_id) REFERENCES public.waves(id) ON DELETE SET NULL;


--
-- Name: pick_steps pick_steps_executed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_steps
    ADD CONSTRAINT pick_steps_executed_by_fkey FOREIGN KEY (executed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: pick_steps pick_steps_inventory_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_steps
    ADD CONSTRAINT pick_steps_inventory_unit_id_fkey FOREIGN KEY (inventory_unit_id) REFERENCES public.inventory_unit(id) ON DELETE SET NULL;


--
-- Name: pick_steps pick_steps_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_steps
    ADD CONSTRAINT pick_steps_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: pick_steps pick_steps_order_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_steps
    ADD CONSTRAINT pick_steps_order_line_id_fkey FOREIGN KEY (order_line_id) REFERENCES public.order_lines(id);


--
-- Name: pick_steps pick_steps_pick_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_steps
    ADD CONSTRAINT pick_steps_pick_container_id_fkey FOREIGN KEY (pick_container_id) REFERENCES public.containers(id) ON DELETE SET NULL;


--
-- Name: pick_steps pick_steps_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_steps
    ADD CONSTRAINT pick_steps_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.pick_tasks(id) ON DELETE CASCADE;


--
-- Name: pick_steps pick_steps_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_steps
    ADD CONSTRAINT pick_steps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: pick_tasks pick_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_tasks
    ADD CONSTRAINT pick_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);


--
-- Name: pick_tasks pick_tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pick_tasks
    ADD CONSTRAINT pick_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: product_location_roles product_location_roles_layout_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_location_roles
    ADD CONSTRAINT product_location_roles_layout_version_id_fkey FOREIGN KEY (layout_version_id) REFERENCES public.layout_versions(id) ON DELETE SET NULL;


--
-- Name: product_location_roles product_location_roles_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_location_roles
    ADD CONSTRAINT product_location_roles_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: product_location_roles product_location_roles_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_location_roles
    ADD CONSTRAINT product_location_roles_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_location_roles product_location_roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_location_roles
    ADD CONSTRAINT product_location_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rack_faces rack_faces_mirror_source_face_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_faces
    ADD CONSTRAINT rack_faces_mirror_source_face_id_fkey FOREIGN KEY (mirror_source_face_id) REFERENCES public.rack_faces(id);


--
-- Name: rack_faces rack_faces_rack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_faces
    ADD CONSTRAINT rack_faces_rack_id_fkey FOREIGN KEY (rack_id) REFERENCES public.racks(id) ON DELETE CASCADE;


--
-- Name: rack_levels rack_levels_rack_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_levels
    ADD CONSTRAINT rack_levels_rack_section_id_fkey FOREIGN KEY (rack_section_id) REFERENCES public.rack_sections(id) ON DELETE CASCADE;


--
-- Name: rack_sections rack_sections_rack_face_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rack_sections
    ADD CONSTRAINT rack_sections_rack_face_id_fkey FOREIGN KEY (rack_face_id) REFERENCES public.rack_faces(id) ON DELETE CASCADE;


--
-- Name: racks racks_layout_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.racks
    ADD CONSTRAINT racks_layout_version_id_fkey FOREIGN KEY (layout_version_id) REFERENCES public.layout_versions(id) ON DELETE CASCADE;


--
-- Name: sites sites_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_source_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_source_container_id_fkey FOREIGN KEY (source_container_id) REFERENCES public.containers(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_source_inventory_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_source_inventory_unit_id_fkey FOREIGN KEY (source_inventory_unit_id) REFERENCES public.inventory_unit(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_source_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_source_location_id_fkey FOREIGN KEY (source_location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_target_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_target_container_id_fkey FOREIGN KEY (target_container_id) REFERENCES public.containers(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_target_inventory_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_target_inventory_unit_id_fkey FOREIGN KEY (target_inventory_unit_id) REFERENCES public.inventory_unit(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_target_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_target_location_id_fkey FOREIGN KEY (target_location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_members tenant_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_members
    ADD CONSTRAINT tenant_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: tenant_members tenant_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_members
    ADD CONSTRAINT tenant_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: waves waves_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waves
    ADD CONSTRAINT waves_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: cells; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;

--
-- Name: cells cells_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cells_delete_scoped ON public.cells FOR DELETE TO authenticated USING (public.can_manage_layout_version(layout_version_id));


--
-- Name: cells cells_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cells_insert_scoped ON public.cells FOR INSERT TO authenticated WITH CHECK (public.can_manage_layout_version(layout_version_id));


--
-- Name: cells cells_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cells_select_scoped ON public.cells FOR SELECT TO authenticated USING (public.can_access_layout_version(layout_version_id));


--
-- Name: cells cells_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cells_update_scoped ON public.cells FOR UPDATE TO authenticated USING (public.can_manage_layout_version(layout_version_id)) WITH CHECK (public.can_manage_layout_version(layout_version_id));


--
-- Name: container_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.container_types ENABLE ROW LEVEL SECURITY;

--
-- Name: container_types container_types_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY container_types_select_all ON public.container_types FOR SELECT TO authenticated USING (true);


--
-- Name: containers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;

--
-- Name: containers containers_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY containers_insert_scoped ON public.containers FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: containers containers_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY containers_select_scoped ON public.containers FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: containers containers_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY containers_update_scoped ON public.containers FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id)) WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: floors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;

--
-- Name: floors floors_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY floors_delete_scoped ON public.floors FOR DELETE TO authenticated USING (public.can_manage_site(site_id));


--
-- Name: floors floors_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY floors_insert_scoped ON public.floors FOR INSERT TO authenticated WITH CHECK (public.can_manage_site(site_id));


--
-- Name: floors floors_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY floors_select_scoped ON public.floors FOR SELECT TO authenticated USING (public.can_access_site(site_id));


--
-- Name: floors floors_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY floors_update_scoped ON public.floors FOR UPDATE TO authenticated USING (public.can_manage_site(site_id)) WITH CHECK (public.can_manage_site(site_id));


--
-- Name: inventory_unit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_unit ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_unit inventory_unit_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_unit_insert_scoped ON public.inventory_unit FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: inventory_unit inventory_unit_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_unit_select_scoped ON public.inventory_unit FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: inventory_unit inventory_unit_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_unit_update_scoped ON public.inventory_unit FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id)) WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: layout_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.layout_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: layout_versions layout_versions_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_versions_delete_scoped ON public.layout_versions FOR DELETE TO authenticated USING (public.can_manage_floor(floor_id));


--
-- Name: layout_versions layout_versions_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_versions_insert_scoped ON public.layout_versions FOR INSERT TO authenticated WITH CHECK (public.can_manage_floor(floor_id));


--
-- Name: layout_versions layout_versions_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_versions_select_scoped ON public.layout_versions FOR SELECT TO authenticated USING (public.can_access_floor(floor_id));


--
-- Name: layout_versions layout_versions_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_versions_update_scoped ON public.layout_versions FOR UPDATE TO authenticated USING (public.can_manage_floor(floor_id)) WITH CHECK (public.can_manage_floor(floor_id));


--
-- Name: layout_walls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.layout_walls ENABLE ROW LEVEL SECURITY;

--
-- Name: layout_walls layout_walls_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_walls_delete_scoped ON public.layout_walls FOR DELETE TO authenticated USING (public.can_manage_layout_version(layout_version_id));


--
-- Name: layout_walls layout_walls_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_walls_insert_scoped ON public.layout_walls FOR INSERT TO authenticated WITH CHECK (public.can_manage_layout_version(layout_version_id));


--
-- Name: layout_walls layout_walls_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_walls_select_scoped ON public.layout_walls FOR SELECT TO authenticated USING (public.can_access_layout_version(layout_version_id));


--
-- Name: layout_walls layout_walls_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_walls_update_scoped ON public.layout_walls FOR UPDATE TO authenticated USING (public.can_manage_layout_version(layout_version_id)) WITH CHECK (public.can_manage_layout_version(layout_version_id));


--
-- Name: layout_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.layout_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: layout_zones layout_zones_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_zones_delete_scoped ON public.layout_zones FOR DELETE TO authenticated USING (public.can_manage_layout_version(layout_version_id));


--
-- Name: layout_zones layout_zones_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_zones_insert_scoped ON public.layout_zones FOR INSERT TO authenticated WITH CHECK (public.can_manage_layout_version(layout_version_id));


--
-- Name: layout_zones layout_zones_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_zones_select_scoped ON public.layout_zones FOR SELECT TO authenticated USING (public.can_access_layout_version(layout_version_id));


--
-- Name: layout_zones layout_zones_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY layout_zones_update_scoped ON public.layout_zones FOR UPDATE TO authenticated USING (public.can_manage_layout_version(layout_version_id)) WITH CHECK (public.can_manage_layout_version(layout_version_id));


--
-- Name: locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

--
-- Name: locations locations_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locations_insert_scoped ON public.locations FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: locations locations_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locations_select_scoped ON public.locations FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: locations locations_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locations_update_scoped ON public.locations FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id)) WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: movement_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.movement_events ENABLE ROW LEVEL SECURITY;

--
-- Name: movement_events movement_events_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY movement_events_insert_scoped ON public.movement_events FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: movement_events movement_events_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY movement_events_select_scoped ON public.movement_events FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: operation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: operation_events operation_events_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operation_events_insert_scoped ON public.operation_events FOR INSERT TO authenticated WITH CHECK ((public.is_platform_admin() OR ((site_id IS NOT NULL) AND public.can_access_site(site_id)) OR ((floor_id IS NOT NULL) AND public.can_access_floor(floor_id)) OR ((layout_version_id IS NOT NULL) AND public.can_access_layout_version(layout_version_id))));


--
-- Name: operation_events operation_events_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operation_events_select_scoped ON public.operation_events FOR SELECT TO authenticated USING ((public.is_platform_admin() OR ((site_id IS NOT NULL) AND public.can_access_site(site_id)) OR ((floor_id IS NOT NULL) AND public.can_access_floor(floor_id)) OR ((layout_version_id IS NOT NULL) AND public.can_access_layout_version(layout_version_id))));


--
-- Name: order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: order_lines order_lines_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_lines_delete_scoped ON public.order_lines FOR DELETE TO authenticated USING (public.can_manage_order(order_id));


--
-- Name: order_lines order_lines_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_lines_insert_scoped ON public.order_lines FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: order_lines order_lines_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_lines_select_scoped ON public.order_lines FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: order_lines order_lines_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_lines_update_scoped ON public.order_lines FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id));


--
-- Name: order_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: order_reservations order_reservations_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_reservations_insert_scoped ON public.order_reservations FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: order_reservations order_reservations_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_reservations_select_scoped ON public.order_reservations FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: order_reservations order_reservations_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_reservations_update_scoped ON public.order_reservations FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id)) WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_insert_scoped ON public.orders FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: orders orders_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select_scoped ON public.orders FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: orders orders_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_update_scoped ON public.orders FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id));


--
-- Name: pick_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pick_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: pick_steps pick_steps_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pick_steps_insert_scoped ON public.pick_steps FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: pick_steps pick_steps_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pick_steps_select_scoped ON public.pick_steps FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: pick_steps pick_steps_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pick_steps_update_scoped ON public.pick_steps FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id));


--
-- Name: pick_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pick_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: pick_tasks pick_tasks_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pick_tasks_insert_scoped ON public.pick_tasks FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: pick_tasks pick_tasks_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pick_tasks_select_scoped ON public.pick_tasks FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: pick_tasks pick_tasks_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pick_tasks_update_scoped ON public.pick_tasks FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id));


--
-- Name: product_location_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_location_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: product_location_roles product_location_roles_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_location_roles_insert_scoped ON public.product_location_roles FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: product_location_roles product_location_roles_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_location_roles_select_scoped ON public.product_location_roles FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: product_location_roles product_location_roles_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_location_roles_update_scoped ON public.product_location_roles FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id)) WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_select_all ON public.products FOR SELECT TO authenticated USING (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: rack_faces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rack_faces ENABLE ROW LEVEL SECURITY;

--
-- Name: rack_faces rack_faces_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_faces_delete_scoped ON public.rack_faces FOR DELETE TO authenticated USING (public.can_manage_rack(rack_id));


--
-- Name: rack_faces rack_faces_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_faces_insert_scoped ON public.rack_faces FOR INSERT TO authenticated WITH CHECK (public.can_manage_rack(rack_id));


--
-- Name: rack_faces rack_faces_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_faces_select_scoped ON public.rack_faces FOR SELECT TO authenticated USING (public.can_access_rack(rack_id));


--
-- Name: rack_faces rack_faces_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_faces_update_scoped ON public.rack_faces FOR UPDATE TO authenticated USING (public.can_manage_rack(rack_id)) WITH CHECK (public.can_manage_rack(rack_id));


--
-- Name: rack_levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rack_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: rack_levels rack_levels_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_levels_delete_scoped ON public.rack_levels FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.rack_sections rs
     JOIN public.rack_faces rf ON ((rf.id = rs.rack_face_id)))
  WHERE ((rs.id = rack_levels.rack_section_id) AND public.can_manage_rack(rf.rack_id)))));


--
-- Name: rack_levels rack_levels_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_levels_insert_scoped ON public.rack_levels FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.rack_sections rs
     JOIN public.rack_faces rf ON ((rf.id = rs.rack_face_id)))
  WHERE ((rs.id = rack_levels.rack_section_id) AND public.can_manage_rack(rf.rack_id)))));


--
-- Name: rack_levels rack_levels_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_levels_select_scoped ON public.rack_levels FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.rack_sections rs
     JOIN public.rack_faces rf ON ((rf.id = rs.rack_face_id)))
  WHERE ((rs.id = rack_levels.rack_section_id) AND public.can_access_rack(rf.rack_id)))));


--
-- Name: rack_levels rack_levels_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_levels_update_scoped ON public.rack_levels FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.rack_sections rs
     JOIN public.rack_faces rf ON ((rf.id = rs.rack_face_id)))
  WHERE ((rs.id = rack_levels.rack_section_id) AND public.can_manage_rack(rf.rack_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.rack_sections rs
     JOIN public.rack_faces rf ON ((rf.id = rs.rack_face_id)))
  WHERE ((rs.id = rack_levels.rack_section_id) AND public.can_manage_rack(rf.rack_id)))));


--
-- Name: rack_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rack_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: rack_sections rack_sections_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_sections_delete_scoped ON public.rack_sections FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.rack_faces rf
  WHERE ((rf.id = rack_sections.rack_face_id) AND public.can_manage_rack(rf.rack_id)))));


--
-- Name: rack_sections rack_sections_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_sections_insert_scoped ON public.rack_sections FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.rack_faces rf
  WHERE ((rf.id = rack_sections.rack_face_id) AND public.can_manage_rack(rf.rack_id)))));


--
-- Name: rack_sections rack_sections_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_sections_select_scoped ON public.rack_sections FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.rack_faces rf
  WHERE ((rf.id = rack_sections.rack_face_id) AND public.can_access_rack(rf.rack_id)))));


--
-- Name: rack_sections rack_sections_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rack_sections_update_scoped ON public.rack_sections FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.rack_faces rf
  WHERE ((rf.id = rack_sections.rack_face_id) AND public.can_manage_rack(rf.rack_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.rack_faces rf
  WHERE ((rf.id = rack_sections.rack_face_id) AND public.can_manage_rack(rf.rack_id)))));


--
-- Name: racks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.racks ENABLE ROW LEVEL SECURITY;

--
-- Name: racks racks_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY racks_delete_scoped ON public.racks FOR DELETE TO authenticated USING (public.can_manage_layout_version(layout_version_id));


--
-- Name: racks racks_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY racks_insert_scoped ON public.racks FOR INSERT TO authenticated WITH CHECK (public.can_manage_layout_version(layout_version_id));


--
-- Name: racks racks_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY racks_select_scoped ON public.racks FOR SELECT TO authenticated USING (public.can_access_layout_version(layout_version_id));


--
-- Name: racks racks_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY racks_update_scoped ON public.racks FOR UPDATE TO authenticated USING (public.can_manage_layout_version(layout_version_id)) WITH CHECK (public.can_manage_layout_version(layout_version_id));


--
-- Name: sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

--
-- Name: sites sites_delete_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sites_delete_scoped ON public.sites FOR DELETE TO authenticated USING (public.can_manage_tenant(tenant_id));


--
-- Name: sites sites_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sites_insert_scoped ON public.sites FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: sites sites_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sites_select_scoped ON public.sites FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: sites sites_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sites_update_scoped ON public.sites FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id)) WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements stock_movements_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_movements_insert_scoped ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: stock_movements stock_movements_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_movements_select_scoped ON public.stock_movements FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: tenant_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_members tenant_members_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_select_scoped ON public.tenant_members FOR SELECT TO authenticated USING (((profile_id = auth.uid()) OR public.is_platform_admin()));


--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants tenants_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenants_select_scoped ON public.tenants FOR SELECT TO authenticated USING (public.can_access_tenant(id));


--
-- Name: waves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waves ENABLE ROW LEVEL SECURITY;

--
-- Name: waves waves_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waves_insert_scoped ON public.waves FOR INSERT TO authenticated WITH CHECK (public.can_manage_tenant(tenant_id));


--
-- Name: waves waves_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waves_select_scoped ON public.waves FOR SELECT TO authenticated USING (public.can_access_tenant(tenant_id));


--
-- Name: waves waves_update_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waves_update_scoped ON public.waves FOR UPDATE TO authenticated USING (public.can_manage_tenant(tenant_id));


--
-- PostgreSQL database dump complete
--

\unrestrict am4aCmOpUKwoQtImfkbnKSt3H77TSxkNblJPyLRAdLDU83wqTVfBXT5hCbLmy7k

