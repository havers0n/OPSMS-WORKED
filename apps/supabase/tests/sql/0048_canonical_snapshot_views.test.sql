-- 0048_canonical_snapshot_views.test.sql
--
-- Verifies that canonical snapshot views remain canonical-only and that
-- runtime snapshot views preserve the canonical projection contract.
--
-- T1. container_storage_canonical_v excludes non-canonical rows
--       • canonical view: no row with item_ref set for a placed container
--         with no inventory_unit rows
--       • runtime snapshot view behaves the same
--
-- T2. location_storage_canonical_v excludes non-canonical rows
--       • same assertion at the location-scoped view level
--       • runtime snapshot view behaves the same
--
-- T3. canonical views expose canonical inventory fields correctly
--       • product_id, quantity, uom, lot_code, expiry_date, inventory_status
--         all read from inventory_unit without distortion
--       • item_ref synthesised as 'product:<uuid>'
--       • both container-scoped and location-scoped canonical views verified
--
-- T4. runtime snapshot views are canonical-only projections
--       • container_storage_snapshot_v and location_storage_snapshot_v remain
--         queryable for runtime callers
--       • both expose canonical rows and exclude non-canonical rows
--
-- Infrastructure note:
--   Placement is established by directly updating containers.current_location_id
--   rather than calling place_container/place_container_at_location RPCs.
--   This keeps the view tests independent from the write-path tests (0047).

begin;

do $$
declare
  default_tenant_uuid   uuid;
  pallet_type_uuid      uuid;
  product_a_uuid        uuid;

  container_a_uuid      uuid;   -- canonical: has an inventory_unit row
  container_b_uuid      uuid;   -- empty: no inventory_unit rows

  site_uuid             uuid := gen_random_uuid();
  floor_uuid            uuid := gen_random_uuid();
  location_a_uuid       uuid := gen_random_uuid();   -- container A placed here
  location_b_uuid       uuid := gen_random_uuid();   -- container B placed here

  row_count             int;
  snap_item_ref         text;
  snap_product_id       uuid;
  snap_quantity         numeric;
  snap_uom              text;
  snap_lot_code         text;
  snap_inventory_status text;
begin
  select id into default_tenant_uuid from public.tenants where code = 'default';
  select id into pallet_type_uuid    from public.container_types where code = 'pallet';

  -- ── Product (global catalog; no tenant_id) ─────────────────────────────────
  insert into public.products (source, external_product_id, sku, name)
  values ('test', 'CS48-WIDGET-001', 'CS48-WIDGET', 'CS48 Test Widget')
  returning id into product_a_uuid;

  -- ── Infrastructure: site + floor + two staging locations ──────────────────
  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_uuid, default_tenant_uuid, 'CS48-SITE', 'CS48 Test Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_uuid, site_uuid, 'F1', 'CS48 Floor', 1);

  -- Non-rack staging locations; no geometry_slot_id needed for view testing.
  insert into public.locations (
    id, tenant_id, floor_id, code, location_type,
    geometry_slot_id, capacity_mode, status
  )
  values
    (location_a_uuid, default_tenant_uuid, floor_uuid, 'CS48-STG-A', 'staging',
     null, 'multi_container', 'active'),
    (location_b_uuid, default_tenant_uuid, floor_uuid, 'CS48-STG-B', 'staging',
     null, 'multi_container', 'active');

  -- ── Container A: canonical inventory (inventory_unit row) ─────────────────
  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'CS48-CAN', pallet_type_uuid, 'active')
  returning id into container_a_uuid;

  insert into public.inventory_unit (
    tenant_id, container_id, product_id,
    quantity, uom, lot_code, expiry_date, status
  )
  values (
    default_tenant_uuid, container_a_uuid, product_a_uuid,
    24, 'EA', 'LOT-2026-A', '2027-01-01', 'available'
  );

  -- Place container A by writing canonical placement truth directly.
  update public.containers
  set current_location_id         = location_a_uuid,
      current_location_entered_at = timezone('utc', now()),
      updated_at                  = timezone('utc', now())
  where id = container_a_uuid;

  -- ── Container B: empty inventory (no inventory_unit rows) ─
  insert into public.containers (tenant_id, external_code, container_type_id, status)
  values (default_tenant_uuid, 'CS48-LEG', pallet_type_uuid, 'active')
  returning id into container_b_uuid;

  -- Place container B.
  update public.containers
  set current_location_id         = location_b_uuid,
      current_location_entered_at = timezone('utc', now()),
      updated_at                  = timezone('utc', now())
  where id = container_b_uuid;


  -- ══════════════════════════════════════════════════════════════════════════
  -- T1. container_storage_canonical_v excludes legacy-only rows
  -- ══════════════════════════════════════════════════════════════════════════

  -- T1-a: canonical view must not return any row with item_ref set for container B.
  -- Container B has no inventory_unit row; the LEFT JOIN yields one null row
  -- (empty container representation), but item_ref is null in that row.
  select count(*)
  into row_count
  from public.container_storage_canonical_v
  where container_id = container_b_uuid
    and item_ref is not null;

  if row_count <> 0 then
    raise exception
      'T1 FAIL: container_storage_canonical_v returned % row(s) with item_ref set '
      'for empty container; expected 0.',
      row_count;
  end if;

  -- T1-b: runtime snapshot view also excludes item_ref rows for empty container.
  select count(*)
  into row_count
  from public.container_storage_snapshot_v
  where container_id = container_b_uuid
    and item_ref is not null
    and product_id is null;

  if row_count <> 0 then
    raise exception
      'T1 FAIL: container_storage_snapshot_v returned % unexpected row(s) for '
      'container B; expected 0.',
      row_count;
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- T2. location_storage_canonical_v excludes non-canonical rows
  -- ══════════════════════════════════════════════════════════════════════════

  -- T2-a: canonical view must not return any row with item_ref set at location B.
  select count(*)
  into row_count
  from public.location_storage_canonical_v
  where container_id = container_b_uuid
    and item_ref is not null;

  if row_count <> 0 then
    raise exception
      'T2 FAIL: location_storage_canonical_v returned % row(s) with item_ref set '
      'for empty container at its location; expected 0.',
      row_count;
  end if;

  -- T2-b: runtime snapshot view also excludes item_ref rows at location B.
  select count(*)
  into row_count
  from public.location_storage_snapshot_v
  where container_id = container_b_uuid
    and item_ref is not null
    and product_id is null;

  if row_count <> 0 then
    raise exception
      'T2 FAIL: location_storage_snapshot_v returned % unexpected row(s) for '
      'container at location B; expected 0.',
      row_count;
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- T3. canonical views return canonical inventory fields correctly
  -- ══════════════════════════════════════════════════════════════════════════

  -- T3-a: container-scoped canonical view.
  select item_ref, product_id, quantity, uom, lot_code, inventory_status
  into snap_item_ref, snap_product_id, snap_quantity, snap_uom,
       snap_lot_code, snap_inventory_status
  from public.container_storage_canonical_v
  where container_id = container_a_uuid
    and product_id is not null
  limit 1;

  if snap_product_id is distinct from product_a_uuid then
    raise exception 'T3 FAIL: container snapshot: expected product_id=%, got %',
      product_a_uuid, snap_product_id;
  end if;

  if snap_item_ref is distinct from 'product:' || product_a_uuid::text then
    raise exception 'T3 FAIL: container snapshot: expected item_ref=product:<uuid>, got %',
      snap_item_ref;
  end if;

  if snap_quantity is distinct from 24 then
    raise exception 'T3 FAIL: container snapshot: expected quantity=24, got %', snap_quantity;
  end if;

  if snap_uom is distinct from 'EA' then
    raise exception 'T3 FAIL: container snapshot: expected uom=EA, got %', snap_uom;
  end if;

  if snap_lot_code is distinct from 'LOT-2026-A' then
    raise exception 'T3 FAIL: container snapshot: expected lot_code=LOT-2026-A, got %',
      snap_lot_code;
  end if;

  if snap_inventory_status is distinct from 'available' then
    raise exception 'T3 FAIL: container snapshot: expected inventory_status=available, got %',
      snap_inventory_status;
  end if;

  -- T3-b: location-scoped canonical view returns the same canonical fields.
  select item_ref, product_id, quantity, uom, lot_code, inventory_status
  into snap_item_ref, snap_product_id, snap_quantity, snap_uom,
       snap_lot_code, snap_inventory_status
  from public.location_storage_canonical_v
  where container_id = container_a_uuid
    and product_id is not null
  limit 1;

  if snap_product_id is distinct from product_a_uuid then
    raise exception 'T3 FAIL: location snapshot: expected product_id=%, got %',
      product_a_uuid, snap_product_id;
  end if;

  if snap_lot_code is distinct from 'LOT-2026-A' then
    raise exception 'T3 FAIL: location snapshot: expected lot_code=LOT-2026-A, got %',
      snap_lot_code;
  end if;

  if snap_inventory_status is distinct from 'available' then
    raise exception 'T3 FAIL: location snapshot: expected inventory_status=available, got %',
      snap_inventory_status;
  end if;


  -- ══════════════════════════════════════════════════════════════════════════
  -- T4. runtime snapshot views are canonical-only projections
  -- ══════════════════════════════════════════════════════════════════════════

  -- T4-a: compat container snapshot still returns the canonical row for container A.
  select count(*)
  into row_count
  from public.container_storage_snapshot_v
  where container_id = container_a_uuid
    and product_id = product_a_uuid;

  if row_count <> 1 then
    raise exception
      'T4 FAIL: container_storage_snapshot_v lost canonical row for container A; '
      'expected 1, got %.',
      row_count;
  end if;

  -- T4-b: compat location snapshot still returns the canonical row for container A.
  select count(*)
  into row_count
  from public.location_storage_snapshot_v
  where container_id = container_a_uuid
    and product_id = product_a_uuid;

  if row_count <> 1 then
    raise exception
      'T4 FAIL: location_storage_snapshot_v lost canonical row for container A; '
      'expected 1, got %.',
      row_count;
  end if;

  -- T4-c: runtime snapshot views do not return inventory rows for empty container B.
  select count(*)
  into row_count
  from public.container_storage_snapshot_v
  where container_id = container_b_uuid
    and item_ref is not null;

  if row_count <> 0 then
    raise exception
      'T4 FAIL: container_storage_snapshot_v returned unexpected row(s) for container '
      'B; expected 0, got %.',
      row_count;
  end if;

end
$$;

rollback;
