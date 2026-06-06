-- 0141_allocate_pick_steps_structural_roles.test.sql
--
-- Focused regression tests for effective-role resolution in
-- allocate_pick_steps.
--
-- 1.  Explicit primary_pick role + structural reserve   → allocated
-- 2.  Explicit reserve override + structural primary_pick → needs_replenishment
-- 3.  No explicit + structural primary_pick              → allocated
-- 4.  No explicit + structural reserve                   → needs_replenishment
-- 5.  No explicit + structural none                      → needs_replenishment
-- 6.  Unpublished/draft explicit (ignored, structural used) → allocated
-- 7.  Unplaced container (current_location_id IS NULL)   → needs_replenishment
-- 8.  Existing explicit primary_pick unchanged            → allocated
-- 9.  Shortage still updates order_lines.status = 'exception'
-- 10. Recovery: structural change → re-allocation succeeds
-- 11. Cross-tenant candidate excluded
-- 12. Live-style: 2 products, no explicit, structural primary_pick → both allocated

begin;

do $$
declare
  default_tenant_uuid  uuid;
  actor_uuid           uuid := gen_random_uuid();
  other_tenant_uuid    uuid;
  pallet_type_uuid     uuid;
  site_uuid            uuid := gen_random_uuid();
  floor_uuid           uuid := gen_random_uuid();

  -- Rack topology
  lv_uuid              uuid := gen_random_uuid();
  rack_uuid            uuid := gen_random_uuid();
  face_uuid            uuid := gen_random_uuid();
  section_uuid         uuid := gen_random_uuid();
  level_pp_uuid        uuid := gen_random_uuid();
  level_res_uuid       uuid := gen_random_uuid();
  level_none_uuid      uuid := gen_random_uuid();
  cell_pp_uuid         uuid := gen_random_uuid();
  cell_res_uuid        uuid := gen_random_uuid();
  cell_none_uuid       uuid := gen_random_uuid();

  -- Locations
  loc_floor_uuid       uuid;
  loc_pp_uuid          uuid;
  loc_res_uuid         uuid;
  loc_none_uuid        uuid;

  -- Per-test products (generated inline)
  result               jsonb;
  line_status          text;
  line_qty             int;
begin
  -- ── Resolve defaults ────────────────────────────────────────────────────────
  select id into default_tenant_uuid from public.tenants where code = 'default';
  if default_tenant_uuid is null then
    raise exception 'Test precondition failed: default tenant not found.';
  end if;

  select id into pallet_type_uuid from public.container_types where code = 'pallet';
  if pallet_type_uuid is null then
    raise exception 'Test precondition failed: pallet container type not found.';
  end if;

  -- Second tenant for isolation tests
  insert into public.tenants (id, code, name)
  values (gen_random_uuid(), 'STRU-TENANT-2', 'Structural Role Test Tenant')
  returning id into other_tenant_uuid;

  -- ── Actor + auth context ────────────────────────────────────────────────────
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  ) values (
    actor_uuid, 'pr141-actor@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (default_tenant_uuid, actor_uuid, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  -- ── Site + floor ────────────────────────────────────────────────────────────
  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'PR141-SITE', 'PR-141 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'PR141-FLOOR', 'PR-141 Floor', 1);

  -- ── Rack topology ───────────────────────────────────────────────────────────
  insert into public.layout_versions (id, floor_id, version_no, state)
  values (lv_uuid, floor_uuid, 1, 'published');

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg)
  values (rack_uuid, lv_uuid, 'PR141-RACK', 'single', 'NS', 0, 0, 1000, 1000, 0);

  insert into public.rack_faces (id, rack_id, side, slot_numbering_direction)
  values (face_uuid, rack_uuid, 'A', 'ltr');

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values (section_uuid, face_uuid, 1, 1000);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count, structural_default_role)
  values
    (level_pp_uuid,   section_uuid, 1, 10, 'primary_pick'),
    (level_res_uuid,  section_uuid, 2, 10, 'reserve'),
    (level_none_uuid, section_uuid, 3, 10, 'none');

  insert into public.cells (id, layout_version_id, rack_id, rack_face_id, rack_section_id, rack_level_id, slot_no, address, address_sort_key, cell_code)
  values
    (cell_pp_uuid,   lv_uuid, rack_uuid, face_uuid, section_uuid, level_pp_uuid,   1, 'PP-1',   'PP-1',   'PP-1-1-1-1'),
    (cell_res_uuid,  lv_uuid, rack_uuid, face_uuid, section_uuid, level_res_uuid,  1, 'RES-1',  'RES-1',  'RES-1-1-1-1'),
    (cell_none_uuid, lv_uuid, rack_uuid, face_uuid, section_uuid, level_none_uuid, 1, 'NONE-1', 'NONE-1', 'NONE-1-1-1-1');

  -- ── Locations ───────────────────────────────────────────────────────────────
  -- Floor-type location (no geometry slot, used for explicit-primary_pick tests)
  insert into public.locations (id, tenant_id, floor_id, code, location_type, capacity_mode, status, geometry_slot_id)
  values
    (gen_random_uuid(), default_tenant_uuid, floor_uuid, 'PR141-FLOOR', 'floor', 'single_container', 'active', null)
  returning id into loc_floor_uuid;

  -- Rack-slot locations are auto-created by the sync_published_cell_to_location
  -- trigger when cells are inserted into a published layout.  Query for them.
  select id into loc_pp_uuid
  from public.locations where geometry_slot_id = cell_pp_uuid;

  select id into loc_res_uuid
  from public.locations where geometry_slot_id = cell_res_uuid;

  select id into loc_none_uuid
  from public.locations where geometry_slot_id = cell_none_uuid;

  if loc_pp_uuid is null or loc_res_uuid is null or loc_none_uuid is null then
    raise exception 'Test fixture failed: sync trigger did not create rack-slot locations';
  end if;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Helper: create a product + container + inventory_unit at a given location.
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    function_lineno int;
  begin
    -- We inline the helper at each call site since PL/pgSQL does not support
    -- dynamic DDL inside the main block.  The pattern is:
    --
    --   declare
    --     pX_uuid  uuid := gen_random_uuid();
    --     cX_uuid  uuid := gen_random_uuid();
    --     iuX_uuid uuid;
    --   begin
    --     insert product, container (with/without location), inventory_unit;
    --     select inventory_unit id into iuX_uuid;
    --     ... test logic ...
    --   end;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 1: Explicit primary_pick role + structural reserve → allocated
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p1_uuid   uuid := gen_random_uuid();
    c1_uuid   uuid := gen_random_uuid();
    iu1_uuid  uuid;
    o1_uuid   uuid := gen_random_uuid();
    l1_uuid   uuid := gen_random_uuid();
    t1_uuid   uuid;
    s1_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p1_uuid, 'test-suite', 'pr141-1', 'SKU-P141-1', 'PR-141 Product 1', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c1_uuid, default_tenant_uuid, 'PR141-C1', pallet_type_uuid, 'active', loc_res_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c1_uuid, p1_uuid, 10, 'pcs', 'available');

    select id into iu1_uuid from public.inventory_unit where container_id = c1_uuid and product_id = p1_uuid;

    -- Explicit primary_pick overrides structural reserve
    insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
    values (default_tenant_uuid, p1_uuid, loc_res_uuid, 'primary_pick', 'published');

    insert into public.orders (id, tenant_id, external_number, status)
    values (o1_uuid, default_tenant_uuid, 'PR141-O1', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l1_uuid, o1_uuid, default_tenant_uuid, 'SKU-P141-1', 'PR-141 Product 1', 3, p1_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o1_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o1_uuid, 'ready')
    returning id into t1_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t1_uuid, default_tenant_uuid, o1_uuid, l1_uuid, 1, 'SKU-P141-1', 'PR-141 Product 1', 3, 'pending')
    returning id into s1_uuid;

    result := public.allocate_pick_steps(t1_uuid);

    if (result ->> 'allocated')::int <> 1 then
      raise exception 'Test 1 failed: expected allocated=1 (explicit primary_pick + structural reserve), got allocated=%',
        result ->> 'allocated';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s1_uuid and status = 'pending' and inventory_unit_id = iu1_uuid
    ) then
      raise exception 'Test 1 failed: step must be allocated with correct inventory_unit_id';
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 2: Explicit reserve override + structural primary_pick → needs_replenishment
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p2_uuid   uuid := gen_random_uuid();
    c2_uuid   uuid := gen_random_uuid();
    iu2_uuid  uuid;
    o2_uuid   uuid := gen_random_uuid();
    l2_uuid   uuid := gen_random_uuid();
    t2_uuid   uuid;
    s2_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p2_uuid, 'test-suite', 'pr141-2', 'SKU-P141-2', 'PR-141 Product 2', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c2_uuid, default_tenant_uuid, 'PR141-C2', pallet_type_uuid, 'active', loc_pp_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c2_uuid, p2_uuid, 10, 'pcs', 'available');

    select id into iu2_uuid from public.inventory_unit where container_id = c2_uuid and product_id = p2_uuid;

    -- Explicit reserve overrides structural primary_pick
    insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
    values (default_tenant_uuid, p2_uuid, loc_pp_uuid, 'reserve', 'published');

    insert into public.orders (id, tenant_id, external_number, status)
    values (o2_uuid, default_tenant_uuid, 'PR141-O2', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l2_uuid, o2_uuid, default_tenant_uuid, 'SKU-P141-2', 'PR-141 Product 2', 3, p2_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o2_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o2_uuid, 'ready')
    returning id into t2_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t2_uuid, default_tenant_uuid, o2_uuid, l2_uuid, 1, 'SKU-P141-2', 'PR-141 Product 2', 3, 'pending')
    returning id into s2_uuid;

    result := public.allocate_pick_steps(t2_uuid);

    if (result ->> 'needsReplenishment')::int <> 1 then
      raise exception 'Test 2 failed: expected needsReplenishment=1 (explicit reserve overrides structural primary_pick), got needsReplenishment=%',
        result ->> 'needsReplenishment';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s2_uuid and status = 'needs_replenishment'
    ) then
      raise exception 'Test 2 failed: step must be needs_replenishment when explicit reserve overrides structural primary_pick';
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 3: No explicit role + structural primary_pick → allocated
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p3_uuid   uuid := gen_random_uuid();
    c3_uuid   uuid := gen_random_uuid();
    iu3_uuid  uuid;
    o3_uuid   uuid := gen_random_uuid();
    l3_uuid   uuid := gen_random_uuid();
    t3_uuid   uuid;
    s3_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p3_uuid, 'test-suite', 'pr141-3', 'SKU-P141-3', 'PR-141 Product 3', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c3_uuid, default_tenant_uuid, 'PR141-C3', pallet_type_uuid, 'active', loc_pp_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c3_uuid, p3_uuid, 10, 'pcs', 'available');

    select id into iu3_uuid from public.inventory_unit where container_id = c3_uuid and product_id = p3_uuid;

    -- No explicit product_location_roles — rely on structural fallback

    insert into public.orders (id, tenant_id, external_number, status)
    values (o3_uuid, default_tenant_uuid, 'PR141-O3', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l3_uuid, o3_uuid, default_tenant_uuid, 'SKU-P141-3', 'PR-141 Product 3', 3, p3_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o3_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o3_uuid, 'ready')
    returning id into t3_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t3_uuid, default_tenant_uuid, o3_uuid, l3_uuid, 1, 'SKU-P141-3', 'PR-141 Product 3', 3, 'pending')
    returning id into s3_uuid;

    result := public.allocate_pick_steps(t3_uuid);

    if (result ->> 'allocated')::int <> 1 then
      raise exception 'Test 3 failed: expected allocated=1 (no explicit, structural primary_pick), got allocated=%',
        result ->> 'allocated';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s3_uuid and status = 'pending' and inventory_unit_id = iu3_uuid
    ) then
      raise exception 'Test 3 failed: step must be allocated via structural primary_pick fallback';
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 4: No explicit role + structural reserve → needs_replenishment
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p4_uuid   uuid := gen_random_uuid();
    c4_uuid   uuid := gen_random_uuid();
    iu4_uuid  uuid;
    o4_uuid   uuid := gen_random_uuid();
    l4_uuid   uuid := gen_random_uuid();
    t4_uuid   uuid;
    s4_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p4_uuid, 'test-suite', 'pr141-4', 'SKU-P141-4', 'PR-141 Product 4', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c4_uuid, default_tenant_uuid, 'PR141-C4', pallet_type_uuid, 'active', loc_res_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c4_uuid, p4_uuid, 10, 'pcs', 'available');

    select id into iu4_uuid from public.inventory_unit where container_id = c4_uuid and product_id = p4_uuid;

    insert into public.orders (id, tenant_id, external_number, status)
    values (o4_uuid, default_tenant_uuid, 'PR141-O4', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l4_uuid, o4_uuid, default_tenant_uuid, 'SKU-P141-4', 'PR-141 Product 4', 3, p4_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o4_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o4_uuid, 'ready')
    returning id into t4_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t4_uuid, default_tenant_uuid, o4_uuid, l4_uuid, 1, 'SKU-P141-4', 'PR-141 Product 4', 3, 'pending')
    returning id into s4_uuid;

    result := public.allocate_pick_steps(t4_uuid);

    if (result ->> 'needsReplenishment')::int <> 1 then
      raise exception 'Test 4 failed: expected needsReplenishment=1 (structural reserve, no explicit), got needsReplenishment=%',
        result ->> 'needsReplenishment';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s4_uuid and status = 'needs_replenishment'
    ) then
      raise exception 'Test 4 failed: step must be needs_replenishment at structural reserve location';
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 5: No explicit role + structural none → needs_replenishment
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p5_uuid   uuid := gen_random_uuid();
    c5_uuid   uuid := gen_random_uuid();
    iu5_uuid  uuid;
    o5_uuid   uuid := gen_random_uuid();
    l5_uuid   uuid := gen_random_uuid();
    t5_uuid   uuid;
    s5_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p5_uuid, 'test-suite', 'pr141-5', 'SKU-P141-5', 'PR-141 Product 5', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c5_uuid, default_tenant_uuid, 'PR141-C5', pallet_type_uuid, 'active', loc_none_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c5_uuid, p5_uuid, 10, 'pcs', 'available');

    select id into iu5_uuid from public.inventory_unit where container_id = c5_uuid and product_id = p5_uuid;

    insert into public.orders (id, tenant_id, external_number, status)
    values (o5_uuid, default_tenant_uuid, 'PR141-O5', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l5_uuid, o5_uuid, default_tenant_uuid, 'SKU-P141-5', 'PR-141 Product 5', 3, p5_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o5_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o5_uuid, 'ready')
    returning id into t5_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t5_uuid, default_tenant_uuid, o5_uuid, l5_uuid, 1, 'SKU-P141-5', 'PR-141 Product 5', 3, 'pending')
    returning id into s5_uuid;

    result := public.allocate_pick_steps(t5_uuid);

    if (result ->> 'needsReplenishment')::int <> 1 then
      raise exception 'Test 5 failed: expected needsReplenishment=1 (structural none, no explicit), got needsReplenishment=%',
        result ->> 'needsReplenishment';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s5_uuid and status = 'needs_replenishment'
    ) then
      raise exception 'Test 5 failed: step must be needs_replenishment at structural none location';
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 6: Unpublished/draft explicit role → ignored, structural fallback used
  --
  -- A 'draft' reserve row exists for the product at loc_pp.  Since it is not
  -- 'published', the allocator must ignore the explicit role and fall back to
  -- the structural primary_pick default.  This matches Picking Planning, which
  -- filters WHERE state = 'published'.
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p6_uuid   uuid := gen_random_uuid();
    c6_uuid   uuid := gen_random_uuid();
    iu6_uuid  uuid;
    o6_uuid   uuid := gen_random_uuid();
    l6_uuid   uuid := gen_random_uuid();
    t6_uuid   uuid;
    s6_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p6_uuid, 'test-suite', 'pr141-6', 'SKU-P141-6', 'PR-141 Product 6', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c6_uuid, default_tenant_uuid, 'PR141-C6', pallet_type_uuid, 'active', loc_pp_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c6_uuid, p6_uuid, 10, 'pcs', 'available');

    select id into iu6_uuid from public.inventory_unit where container_id = c6_uuid and product_id = p6_uuid;

    -- Draft entry — must be ignored, structural primary_pick should apply
    insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
    values (default_tenant_uuid, p6_uuid, loc_pp_uuid, 'reserve', 'draft');

    insert into public.orders (id, tenant_id, external_number, status)
    values (o6_uuid, default_tenant_uuid, 'PR141-O6', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l6_uuid, o6_uuid, default_tenant_uuid, 'SKU-P141-6', 'PR-141 Product 6', 3, p6_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o6_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o6_uuid, 'ready')
    returning id into t6_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t6_uuid, default_tenant_uuid, o6_uuid, l6_uuid, 1, 'SKU-P141-6', 'PR-141 Product 6', 3, 'pending')
    returning id into s6_uuid;

    result := public.allocate_pick_steps(t6_uuid);

    if (result ->> 'allocated')::int <> 1 then
      raise exception 'Test 6 failed: expected allocated=1 (draft explicit ignored, structural primary_pick used), got allocated=%',
        result ->> 'allocated';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s6_uuid and status = 'pending' and inventory_unit_id = iu6_uuid
    ) then
      raise exception 'Test 6 failed: step must be allocated via structural primary_pick (draft reserve ignored)';
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 7: Unplaced container (current_location_id IS NULL) → needs_replenishment
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p7_uuid   uuid := gen_random_uuid();
    c7_uuid   uuid := gen_random_uuid();
    iu7_uuid  uuid;
    o7_uuid   uuid := gen_random_uuid();
    l7_uuid   uuid := gen_random_uuid();
    t7_uuid   uuid;
    s7_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p7_uuid, 'test-suite', 'pr141-7', 'SKU-P141-7', 'PR-141 Product 7', true);

    -- Container is NOT placed — current_location_id stays NULL
    insert into public.containers (id, tenant_id, external_code, container_type_id, status)
    values (c7_uuid, default_tenant_uuid, 'PR141-C7', pallet_type_uuid, 'active');

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c7_uuid, p7_uuid, 10, 'pcs', 'available');

    select id into iu7_uuid from public.inventory_unit where container_id = c7_uuid and product_id = p7_uuid;

    insert into public.orders (id, tenant_id, external_number, status)
    values (o7_uuid, default_tenant_uuid, 'PR141-O7', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l7_uuid, o7_uuid, default_tenant_uuid, 'SKU-P141-7', 'PR-141 Product 7', 3, p7_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o7_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o7_uuid, 'ready')
    returning id into t7_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t7_uuid, default_tenant_uuid, o7_uuid, l7_uuid, 1, 'SKU-P141-7', 'PR-141 Product 7', 3, 'pending')
    returning id into s7_uuid;

    result := public.allocate_pick_steps(t7_uuid);

    if (result ->> 'needsReplenishment')::int <> 1 then
      raise exception 'Test 7 failed: expected needsReplenishment=1 (unplaced container), got needsReplenishment=%',
        result ->> 'needsReplenishment';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s7_uuid and status = 'needs_replenishment'
    ) then
      raise exception 'Test 7 failed: step must be needs_replenishment when container has no location';
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 8: Existing explicit primary_pick behavior unchanged
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p8_uuid   uuid := gen_random_uuid();
    c8_uuid   uuid := gen_random_uuid();
    iu8_uuid  uuid;
    o8_uuid   uuid := gen_random_uuid();
    l8_uuid   uuid := gen_random_uuid();
    t8_uuid   uuid;
    s8_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p8_uuid, 'test-suite', 'pr141-8', 'SKU-P141-8', 'PR-141 Product 8', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c8_uuid, default_tenant_uuid, 'PR141-C8', pallet_type_uuid, 'active', loc_floor_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c8_uuid, p8_uuid, 10, 'pcs', 'available');

    select id into iu8_uuid from public.inventory_unit where container_id = c8_uuid and product_id = p8_uuid;

    -- Standard explicit primary_pick (same semantics as original allocator)
    insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
    values (default_tenant_uuid, p8_uuid, loc_floor_uuid, 'primary_pick', 'published');

    insert into public.orders (id, tenant_id, external_number, status)
    values (o8_uuid, default_tenant_uuid, 'PR141-O8', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l8_uuid, o8_uuid, default_tenant_uuid, 'SKU-P141-8', 'PR-141 Product 8', 3, p8_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o8_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o8_uuid, 'ready')
    returning id into t8_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t8_uuid, default_tenant_uuid, o8_uuid, l8_uuid, 1, 'SKU-P141-8', 'PR-141 Product 8', 3, 'pending')
    returning id into s8_uuid;

    result := public.allocate_pick_steps(t8_uuid);

    if (result ->> 'allocated')::int <> 1 then
      raise exception 'Test 8 failed: expected allocated=1 (existing explicit primary_pick unchanged), got allocated=%',
        result ->> 'allocated';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s8_uuid and status = 'pending' and inventory_unit_id = iu8_uuid
    ) then
      raise exception 'Test 8 failed: explicit primary_pick must still allocate';
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 9: Shortage still updates order_lines.status = 'exception'
  --
  -- Reuses the structural reserve scenario from Test 4 and verifies the
  -- projection recalculation produces 'exception'.
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p9_uuid   uuid := gen_random_uuid();
    c9_uuid   uuid := gen_random_uuid();
    o9_uuid   uuid := gen_random_uuid();
    l9_uuid   uuid := gen_random_uuid();
    t9_uuid   uuid;
    s9_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p9_uuid, 'test-suite', 'pr141-9', 'SKU-P141-9', 'PR-141 Product 9', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c9_uuid, default_tenant_uuid, 'PR141-C9', pallet_type_uuid, 'active', loc_res_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c9_uuid, p9_uuid, 10, 'pcs', 'available');

    insert into public.orders (id, tenant_id, external_number, status)
    values (o9_uuid, default_tenant_uuid, 'PR141-O9', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l9_uuid, o9_uuid, default_tenant_uuid, 'SKU-P141-9', 'PR-141 Product 9', 3, p9_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o9_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o9_uuid, 'ready')
    returning id into t9_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t9_uuid, default_tenant_uuid, o9_uuid, l9_uuid, 1, 'SKU-P141-9', 'PR-141 Product 9', 3, 'pending')
    returning id into s9_uuid;

    result := public.allocate_pick_steps(t9_uuid);

    if (result ->> 'needsReplenishment')::int <> 1 then
      raise exception 'Test 9a failed: expected needsReplenishment=1, got %', result ->> 'needsReplenishment';
    end if;

    select status, qty_picked into line_status, line_qty
    from public.order_lines where id = l9_uuid;

    if line_qty <> 0 then
      raise exception 'Test 9b failed: expected qty_picked=0, got %', line_qty;
    end if;

    if line_status <> 'exception' then
      raise exception 'Test 9c failed: expected order_line status=exception after shortage, got %', line_status;
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 10: Recovery — after structural fallback candidate appears,
  --           re-allocation succeeds and exception is cleared.
  --
  --   Step 1: Product at structural 'none' location → needs_replenishment
  --   Step 2: Change rack_level to 'primary_pick'
  --   Step 3: Reset step to pending
  --   Step 4: Re-allocate → succeeds, exception cleared
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p10_uuid   uuid := gen_random_uuid();
    c10_uuid   uuid := gen_random_uuid();
    iu10_uuid  uuid;
    o10_uuid   uuid := gen_random_uuid();
    l10_uuid   uuid := gen_random_uuid();
    t10_uuid   uuid;
    s10_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p10_uuid, 'test-suite', 'pr141-10', 'SKU-P141-10', 'PR-141 Product 10', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c10_uuid, default_tenant_uuid, 'PR141-C10', pallet_type_uuid, 'active', loc_none_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (default_tenant_uuid, c10_uuid, p10_uuid, 10, 'pcs', 'available');

    select id into iu10_uuid from public.inventory_unit where container_id = c10_uuid and product_id = p10_uuid;

    insert into public.orders (id, tenant_id, external_number, status)
    values (o10_uuid, default_tenant_uuid, 'PR141-O10', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l10_uuid, o10_uuid, default_tenant_uuid, 'SKU-P141-10', 'PR-141 Product 10', 3, p10_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o10_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o10_uuid, 'ready')
    returning id into t10_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t10_uuid, default_tenant_uuid, o10_uuid, l10_uuid, 1, 'SKU-P141-10', 'PR-141 Product 10', 3, 'pending')
    returning id into s10_uuid;

    -- Step 1: Allocate → needs_replenishment (structural none)
    result := public.allocate_pick_steps(t10_uuid);

    if (result ->> 'needsReplenishment')::int <> 1 then
      raise exception 'Test 10a failed: expected needsReplenishment=1, got %', result ->> 'needsReplenishment';
    end if;

    select status into line_status from public.order_lines where id = l10_uuid;
    if line_status <> 'exception' then
      raise exception 'Test 10a failed: expected order_line status=exception after shortage, got %', line_status;
    end if;

    -- Step 2: Fix structural role
    update public.rack_levels
    set structural_default_role = 'primary_pick'
    where id = level_none_uuid;

    -- Step 3: Reset step to pending
    update public.pick_steps
    set status = 'pending'
    where id = s10_uuid;

    -- Step 4: Re-allocate → should succeed now
    result := public.allocate_pick_steps(t10_uuid);

    if (result ->> 'allocated')::int <> 1 then
      raise exception 'Test 10b failed: expected allocated=1 on re-allocate after structural fix, got allocated=%',
        result ->> 'allocated';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s10_uuid and status = 'pending' and inventory_unit_id = iu10_uuid
    ) then
      raise exception 'Test 10b failed: step must be allocated after structural recovery';
    end if;

    -- Step 5: Stale exception must be cleared
    select status into line_status from public.order_lines where id = l10_uuid;
    if line_status = 'exception' then
      raise exception 'Test 10c failed: order_line status should not be exception after recovery, got %', line_status;
    end if;

    -- Restore level_none for downstream tests that do not expect structural role change.
    update public.rack_levels
    set structural_default_role = 'none'
    where id = level_none_uuid;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 11: Cross-tenant candidate excluded
  --
  -- A product exists in another tenant at a structural primary_pick location.
  -- The allocator must respect tenant isolation and not pick it.
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p11_uuid   uuid := gen_random_uuid();
    c11_uuid   uuid := gen_random_uuid();
    iu11_uuid  uuid;
    o11_uuid   uuid := gen_random_uuid();
    l11_uuid   uuid := gen_random_uuid();
    t11_uuid   uuid;
    s11_uuid   uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values (p11_uuid, 'test-suite', 'pr141-11', 'SKU-P141-11', 'PR-141 Product 11', true);

    -- Container + inventory for DEFAULT tenant at loc_pp (structural primary_pick)
    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values (c11_uuid, other_tenant_uuid, 'PR141-C11', pallet_type_uuid, 'active', loc_pp_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values (other_tenant_uuid, c11_uuid, p11_uuid, 10, 'pcs', 'available');

    select id into iu11_uuid from public.inventory_unit where container_id = c11_uuid and product_id = p11_uuid;

    insert into public.orders (id, tenant_id, external_number, status)
    values (o11_uuid, default_tenant_uuid, 'PR141-O11', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values (l11_uuid, o11_uuid, default_tenant_uuid, 'SKU-P141-11', 'PR-141 Product 11', 3, p11_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o11_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o11_uuid, 'ready')
    returning id into t11_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values (gen_random_uuid(), t11_uuid, default_tenant_uuid, o11_uuid, l11_uuid, 1, 'SKU-P141-11', 'PR-141 Product 11', 3, 'pending')
    returning id into s11_uuid;

    result := public.allocate_pick_steps(t11_uuid);

    if (result ->> 'needsReplenishment')::int <> 1 then
      raise exception 'Test 11 failed: expected needsReplenishment=1 (cross-tenant candidate excluded), got needsReplenishment=%',
        result ->> 'needsReplenishment';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s11_uuid and status = 'needs_replenishment'
    ) then
      raise exception 'Test 11 failed: cross-tenant inventory must not be eligible';
    end if;
  end;

  -- ══════════════════════════════════════════════════════════════════════════════
  -- Test 12: Live-style integration — 2 products, no explicit roles,
  --           both at structural primary_pick → both allocated
  -- ══════════════════════════════════════════════════════════════════════════════
  declare
    p12a_uuid  uuid := gen_random_uuid();
    p12b_uuid  uuid := gen_random_uuid();
    c12a_uuid  uuid := gen_random_uuid();
    c12b_uuid  uuid := gen_random_uuid();
    iu12a_uuid uuid;
    iu12b_uuid uuid;
    o12_uuid   uuid := gen_random_uuid();
    l12a_uuid  uuid := gen_random_uuid();
    l12b_uuid  uuid := gen_random_uuid();
    t12_uuid   uuid;
    s12a_uuid  uuid;
    s12b_uuid  uuid;
  begin
    insert into public.products (id, source, external_product_id, sku, name, is_active)
    values
      (p12a_uuid, 'test-suite', 'pr141-12a', 'SKU-P141-12A', 'PR-141 Product 12A', true),
      (p12b_uuid, 'test-suite', 'pr141-12b', 'SKU-P141-12B', 'PR-141 Product 12B', true);

    insert into public.containers (id, tenant_id, external_code, container_type_id, status, current_location_id, current_location_entered_at)
    values
      (c12a_uuid, default_tenant_uuid, 'PR141-C12A', pallet_type_uuid, 'active', loc_pp_uuid, now()),
      (c12b_uuid, default_tenant_uuid, 'PR141-C12B', pallet_type_uuid, 'active', loc_pp_uuid, now());

    insert into public.inventory_unit (tenant_id, container_id, product_id, quantity, uom, status)
    values
      (default_tenant_uuid, c12a_uuid, p12a_uuid, 10, 'pcs', 'available'),
      (default_tenant_uuid, c12b_uuid, p12b_uuid, 10, 'pcs', 'available');

    select id into iu12a_uuid from public.inventory_unit where container_id = c12a_uuid and product_id = p12a_uuid;
    select id into iu12b_uuid from public.inventory_unit where container_id = c12b_uuid and product_id = p12b_uuid;

    -- No explicit roles — both rely on structural primary_pick via loc_pp

    insert into public.orders (id, tenant_id, external_number, status)
    values (o12_uuid, default_tenant_uuid, 'PR141-O12', 'draft');

    insert into public.order_lines (id, order_id, tenant_id, sku, name, qty_required, product_id, status)
    values
      (l12a_uuid, o12_uuid, default_tenant_uuid, 'SKU-P141-12A', 'PR-141 Product 12A', 5, p12a_uuid, 'released'),
      (l12b_uuid, o12_uuid, default_tenant_uuid, 'SKU-P141-12B', 'PR-141 Product 12B', 3, p12b_uuid, 'released');

    perform set_config('wos.allow_order_reservation_status_update', 'on', true);
    perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

    update public.orders set status = 'released' where id = o12_uuid;

    insert into public.pick_tasks (tenant_id, source_type, source_id, status)
    values (default_tenant_uuid, 'order', o12_uuid, 'ready')
    returning id into t12_uuid;

    insert into public.pick_steps (id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, status)
    values
      (gen_random_uuid(), t12_uuid, default_tenant_uuid, o12_uuid, l12a_uuid, 1, 'SKU-P141-12A', 'PR-141 Product 12A', 5, 'pending'),
      (gen_random_uuid(), t12_uuid, default_tenant_uuid, o12_uuid, l12b_uuid, 2, 'SKU-P141-12B', 'PR-141 Product 12B', 3, 'pending');

    select id into s12a_uuid from public.pick_steps where task_id = t12_uuid and order_line_id = l12a_uuid;
    select id into s12b_uuid from public.pick_steps where task_id = t12_uuid and order_line_id = l12b_uuid;

    result := public.allocate_pick_steps(t12_uuid);

    if (result ->> 'allocated')::int <> 2 then
      raise exception 'Test 12 failed: expected allocated=2 (both structural primary_pick), got allocated=%',
        result ->> 'allocated';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s12a_uuid and status = 'pending' and inventory_unit_id = iu12a_uuid
    ) then
      raise exception 'Test 12 failed: step A must be allocated';
    end if;

    if not exists (
      select 1 from public.pick_steps
      where id = s12b_uuid and status = 'pending' and inventory_unit_id = iu12b_uuid
    ) then
      raise exception 'Test 12 failed: step B must be allocated';
    end if;
  end;

  raise notice 'All 0141 structural-role tests passed.';
end
$$;

rollback;
