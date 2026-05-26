-- =============================================================================
-- DEMO WAREHOUSE PLACEMENT + ROUTE SCENARIO
-- 20 products across 10 racks (2 per rack), + order DEMO-ROUTE-001 (6 lines)
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING)
-- Portable: resolves tenant/layout/location/product IDs dynamically by code/SKU
-- =============================================================================
--
-- Layout (all Face A, level 1, slot 1 — except 05-A.09.01.03 slot 3):
--
--  Rack 07  x=-13.2  NS  07-A.01 / 07-A.04  (CNT-S-001, CNT-S-002)
--  Rack 08  x= -6.7  NS  08-A.01 / 08-A.04  (CNT-S-003, CNT-S-004)
--  Rack 06  x= -1.3  NS  06-A.01 / 06-A.04  (CNT-S-005, CNT-S-006)
--  Rack 05  x=  3.9  NS  05-A.03 / 05-A.09  (CNT-S-007, CNT-S-008)
--  Rack 10  x=  4.9  WE  10-A.01 / 10-A.04  (CNT-S-009, CNT-S-010)
--  Rack 09  x=  8.3  WE  09-A.01 / 09-A.04  (CNT-S-011, CNT-S-012)
--  Rack 04  x=  9.75 NS  04-A.01 / 04-A.06  (CNT-S-013, CNT-S-014)
--  Rack 03  x= 14.5  NS  03-A.01 / 03-A.06  (CNT-S-015, CNT-S-016)
--  Rack 02  x= 25.0  NS  02-A.01 / 02-A.05  (CNT-S-017, CNT-S-018)
--  Rack 01  x= 27.9  NS  01-A.01 / 01-A.04  (CNT-S-019, CNT-S-020)
--
-- Demo order DEMO-ROUTE-001 (id: ee000000-ee00-4000-8000-000000000000):
--  6 lines: Rack07 → Rack06 → Rack05 → Rack09(deep,y=30m) → Rack03 → Rack01
-- =============================================================================

DO $$
DECLARE
  v_tenant_id        uuid;
  v_layout_ver_id    uuid;
  v_bin_type_id      uuid;

  -- location IDs (by code)
  loc_07_01 uuid; loc_07_04 uuid;
  loc_08_01 uuid; loc_08_04 uuid;
  loc_06_01 uuid; loc_06_04 uuid;
  loc_05_03 uuid; loc_05_09 uuid;
  loc_10_01 uuid; loc_10_04 uuid;
  loc_09_01 uuid; loc_09_04 uuid;
  loc_04_01 uuid; loc_04_06 uuid;
  loc_03_01 uuid; loc_03_06 uuid;
  loc_02_01 uuid; loc_02_05 uuid;
  loc_01_01 uuid; loc_01_04 uuid;

  -- product IDs (by SKU)
  p_sunbed       uuid;  -- 0617588425158  מיטת שיזוף
  p_carcharger   uuid;  -- 0842387000736  מטען רכב
  p_trolley      uuid;  -- 2-7290110473815  עגלת שטח
  p_hanger       uuid;  -- 3664944293385  מתלה בגדים
  p_knife        uuid;  -- 3664944294191  אולר רב תכליתי
  p_cutlery      uuid;  -- 3664944294207  סכום לשטח
  p_bubblegun    uuid;  -- 3664944523338  אקדח בועות
  p_poncho       uuid;  -- 3664944526292  כרבולית פונצ'ו
  p_headphones   uuid;  -- 4895182241848  אוזניות לזום
  p_roundpool    uuid;  -- 6941057400006  בריכה עגולה
  p_boat         uuid;  -- 6941057402659  סירה מתנפחת
  p_mattchill    uuid;  -- 6941057420141  מזרן CHILL N FLOAT
  p_dragon       uuid;  -- 6941057420233  דרקון רכיבה
  p_mattingle    uuid;  -- 6941057420349  מזרן ים יחיד
  p_ringhandles  uuid;  -- 6941057422558  גלגל ים עם ידיות
  p_trigon       uuid;  -- 6941057425788  מנתפח טריגון
  p_seatpool     uuid;  -- 6941057454757  בריכת מושבים
  p_dolphin      uuid;  -- 6941057455358  דולפין רכיבה
  p_swring       uuid;  -- 6942138930573  גלגל שחייה Bestway
  p_mattbest     uuid;  -- 6942138940480  מזרון ים Bestway

BEGIN

  -- ── Resolve context IDs ────────────────────────────────────────────────────

  SELECT id INTO v_tenant_id FROM tenants WHERE code = 'default' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "default" not found — run seed.sql first';
  END IF;

  SELECT lv.id INTO v_layout_ver_id
  FROM layout_versions lv
  WHERE lv.state = 'published'
  ORDER BY lv.published_at DESC NULLS LAST
  LIMIT 1;
  IF v_layout_ver_id IS NULL THEN
    RAISE EXCEPTION 'No published layout version found';
  END IF;

  SELECT id INTO v_bin_type_id FROM container_types WHERE code = 'bin' LIMIT 1;
  IF v_bin_type_id IS NULL THEN
    RAISE EXCEPTION 'Container type "bin" not found';
  END IF;

  -- ── Location lookup ────────────────────────────────────────────────────────

  SELECT id INTO loc_07_01 FROM locations WHERE code = '07-A.01.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_07_04 FROM locations WHERE code = '07-A.04.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_08_01 FROM locations WHERE code = '08-A.01.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_08_04 FROM locations WHERE code = '08-A.04.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_06_01 FROM locations WHERE code = '06-A.01.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_06_04 FROM locations WHERE code = '06-A.04.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_05_03 FROM locations WHERE code = '05-A.03.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_05_09 FROM locations WHERE code = '05-A.09.01.03' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_10_01 FROM locations WHERE code = '10-A.01.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_10_04 FROM locations WHERE code = '10-A.04.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_09_01 FROM locations WHERE code = '09-A.01.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_09_04 FROM locations WHERE code = '09-A.04.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_04_01 FROM locations WHERE code = '04-A.01.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_04_06 FROM locations WHERE code = '04-A.06.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_03_01 FROM locations WHERE code = '03-A.01.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_03_06 FROM locations WHERE code = '03-A.06.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_02_01 FROM locations WHERE code = '02-A.01.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_02_05 FROM locations WHERE code = '02-A.05.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_01_01 FROM locations WHERE code = '01-A.01.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;
  SELECT id INTO loc_01_04 FROM locations WHERE code = '01-A.04.01.01' AND tenant_id = v_tenant_id AND status = 'active' LIMIT 1;

  -- ── Product lookup ─────────────────────────────────────────────────────────

  SELECT id INTO p_sunbed      FROM products WHERE sku = '0617588425158' LIMIT 1;
  SELECT id INTO p_carcharger  FROM products WHERE sku = '0842387000736' LIMIT 1;
  SELECT id INTO p_trolley     FROM products WHERE sku = '2-7290110473815' LIMIT 1;
  SELECT id INTO p_hanger      FROM products WHERE sku = '3664944293385' LIMIT 1;
  SELECT id INTO p_knife       FROM products WHERE sku = '3664944294191' LIMIT 1;
  SELECT id INTO p_cutlery     FROM products WHERE sku = '3664944294207' LIMIT 1;
  SELECT id INTO p_bubblegun   FROM products WHERE sku = '3664944523338' LIMIT 1;
  SELECT id INTO p_poncho      FROM products WHERE sku = '3664944526292' LIMIT 1;
  SELECT id INTO p_headphones  FROM products WHERE sku = '4895182241848' LIMIT 1;
  SELECT id INTO p_roundpool   FROM products WHERE sku = '6941057400006' LIMIT 1;
  SELECT id INTO p_boat        FROM products WHERE sku = '6941057402659' LIMIT 1;
  SELECT id INTO p_mattchill   FROM products WHERE sku = '6941057420141' LIMIT 1;
  SELECT id INTO p_dragon      FROM products WHERE sku = '6941057420233' LIMIT 1;
  SELECT id INTO p_mattingle   FROM products WHERE sku = '6941057420349' LIMIT 1;
  SELECT id INTO p_ringhandles FROM products WHERE sku = '6941057422558' LIMIT 1;
  SELECT id INTO p_trigon      FROM products WHERE sku = '6941057425788' LIMIT 1;
  SELECT id INTO p_seatpool    FROM products WHERE sku = '6941057454757' LIMIT 1;
  SELECT id INTO p_dolphin     FROM products WHERE sku = '6941057455358' LIMIT 1;
  SELECT id INTO p_swring      FROM products WHERE sku = '6942138930573' LIMIT 1;
  SELECT id INTO p_mattbest    FROM products WHERE sku = '6942138940480' LIMIT 1;

  -- ── 1. Containers (20 bins, one per location) ──────────────────────────────

  INSERT INTO containers (id, tenant_id, external_code, container_type_id, status, operational_role, system_code, current_location_id, current_location_entered_at) VALUES
    ('ee000001-ee00-4000-8000-000000000000', v_tenant_id, 'S-001', v_bin_type_id, 'active', 'storage', 'CNT-S-001', loc_07_01, now()),
    ('ee000002-ee00-4000-8000-000000000000', v_tenant_id, 'S-002', v_bin_type_id, 'active', 'storage', 'CNT-S-002', loc_07_04, now()),
    ('ee000003-ee00-4000-8000-000000000000', v_tenant_id, 'S-003', v_bin_type_id, 'active', 'storage', 'CNT-S-003', loc_08_01, now()),
    ('ee000004-ee00-4000-8000-000000000000', v_tenant_id, 'S-004', v_bin_type_id, 'active', 'storage', 'CNT-S-004', loc_08_04, now()),
    ('ee000005-ee00-4000-8000-000000000000', v_tenant_id, 'S-005', v_bin_type_id, 'active', 'storage', 'CNT-S-005', loc_06_01, now()),
    ('ee000006-ee00-4000-8000-000000000000', v_tenant_id, 'S-006', v_bin_type_id, 'active', 'storage', 'CNT-S-006', loc_06_04, now()),
    ('ee000007-ee00-4000-8000-000000000000', v_tenant_id, 'S-007', v_bin_type_id, 'active', 'storage', 'CNT-S-007', loc_05_03, now()),
    ('ee000008-ee00-4000-8000-000000000000', v_tenant_id, 'S-008', v_bin_type_id, 'active', 'storage', 'CNT-S-008', loc_05_09, now()),
    ('ee000009-ee00-4000-8000-000000000000', v_tenant_id, 'S-009', v_bin_type_id, 'active', 'storage', 'CNT-S-009', loc_10_01, now()),
    ('ee00000a-ee00-4000-8000-000000000000', v_tenant_id, 'S-010', v_bin_type_id, 'active', 'storage', 'CNT-S-010', loc_10_04, now()),
    ('ee00000b-ee00-4000-8000-000000000000', v_tenant_id, 'S-011', v_bin_type_id, 'active', 'storage', 'CNT-S-011', loc_09_01, now()),
    ('ee00000c-ee00-4000-8000-000000000000', v_tenant_id, 'S-012', v_bin_type_id, 'active', 'storage', 'CNT-S-012', loc_09_04, now()),
    ('ee00000d-ee00-4000-8000-000000000000', v_tenant_id, 'S-013', v_bin_type_id, 'active', 'storage', 'CNT-S-013', loc_04_01, now()),
    ('ee00000e-ee00-4000-8000-000000000000', v_tenant_id, 'S-014', v_bin_type_id, 'active', 'storage', 'CNT-S-014', loc_04_06, now()),
    ('ee00000f-ee00-4000-8000-000000000000', v_tenant_id, 'S-015', v_bin_type_id, 'active', 'storage', 'CNT-S-015', loc_03_01, now()),
    ('ee000010-ee00-4000-8000-000000000000', v_tenant_id, 'S-016', v_bin_type_id, 'active', 'storage', 'CNT-S-016', loc_03_06, now()),
    ('ee000011-ee00-4000-8000-000000000000', v_tenant_id, 'S-017', v_bin_type_id, 'active', 'storage', 'CNT-S-017', loc_02_01, now()),
    ('ee000012-ee00-4000-8000-000000000000', v_tenant_id, 'S-018', v_bin_type_id, 'active', 'storage', 'CNT-S-018', loc_02_05, now()),
    ('ee000013-ee00-4000-8000-000000000000', v_tenant_id, 'S-019', v_bin_type_id, 'active', 'storage', 'CNT-S-019', loc_01_01, now()),
    ('ee000014-ee00-4000-8000-000000000000', v_tenant_id, 'S-020', v_bin_type_id, 'active', 'storage', 'CNT-S-020', loc_01_04, now())
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. Container lines ─────────────────────────────────────────────────────

  INSERT INTO container_lines (id, tenant_id, container_id, product_id, qty_each, is_non_standard_pack, inventory_status, line_kind) VALUES
    ('ee000001-ee00-4000-8000-000000000001', v_tenant_id, 'ee000001-ee00-4000-8000-000000000000', p_sunbed,      30, false, 'available', 'receipt'),
    ('ee000002-ee00-4000-8000-000000000001', v_tenant_id, 'ee000002-ee00-4000-8000-000000000000', p_carcharger,  50, false, 'available', 'receipt'),
    ('ee000003-ee00-4000-8000-000000000001', v_tenant_id, 'ee000003-ee00-4000-8000-000000000000', p_trolley,     20, false, 'available', 'receipt'),
    ('ee000004-ee00-4000-8000-000000000001', v_tenant_id, 'ee000004-ee00-4000-8000-000000000000', p_hanger,      40, false, 'available', 'receipt'),
    ('ee000005-ee00-4000-8000-000000000001', v_tenant_id, 'ee000005-ee00-4000-8000-000000000000', p_knife,       60, false, 'available', 'receipt'),
    ('ee000006-ee00-4000-8000-000000000001', v_tenant_id, 'ee000006-ee00-4000-8000-000000000000', p_cutlery,     35, false, 'available', 'receipt'),
    ('ee000007-ee00-4000-8000-000000000001', v_tenant_id, 'ee000007-ee00-4000-8000-000000000000', p_bubblegun,   80, false, 'available', 'receipt'),
    ('ee000008-ee00-4000-8000-000000000001', v_tenant_id, 'ee000008-ee00-4000-8000-000000000000', p_mattbest,   100, false, 'available', 'receipt'),
    ('ee000009-ee00-4000-8000-000000000001', v_tenant_id, 'ee000009-ee00-4000-8000-000000000000', p_poncho,      25, false, 'available', 'receipt'),
    ('ee00000a-ee00-4000-8000-000000000001', v_tenant_id, 'ee00000a-ee00-4000-8000-000000000000', p_headphones,  45, false, 'available', 'receipt'),
    ('ee00000b-ee00-4000-8000-000000000001', v_tenant_id, 'ee00000b-ee00-4000-8000-000000000000', p_roundpool,   15, false, 'available', 'receipt'),
    ('ee00000c-ee00-4000-8000-000000000001', v_tenant_id, 'ee00000c-ee00-4000-8000-000000000000', p_boat,        10, false, 'available', 'receipt'),
    ('ee00000d-ee00-4000-8000-000000000001', v_tenant_id, 'ee00000d-ee00-4000-8000-000000000000', p_mattchill,   40, false, 'available', 'receipt'),
    ('ee00000e-ee00-4000-8000-000000000001', v_tenant_id, 'ee00000e-ee00-4000-8000-000000000000', p_dragon,      30, false, 'available', 'receipt'),
    ('ee00000f-ee00-4000-8000-000000000001', v_tenant_id, 'ee00000f-ee00-4000-8000-000000000000', p_mattingle,   55, false, 'available', 'receipt'),
    ('ee000010-ee00-4000-8000-000000000001', v_tenant_id, 'ee000010-ee00-4000-8000-000000000000', p_ringhandles, 20, false, 'available', 'receipt'),
    ('ee000011-ee00-4000-8000-000000000001', v_tenant_id, 'ee000011-ee00-4000-8000-000000000000', p_trigon,      12, false, 'available', 'receipt'),
    ('ee000012-ee00-4000-8000-000000000001', v_tenant_id, 'ee000012-ee00-4000-8000-000000000000', p_seatpool,    18, false, 'available', 'receipt'),
    ('ee000013-ee00-4000-8000-000000000001', v_tenant_id, 'ee000013-ee00-4000-8000-000000000000', p_dolphin,     35, false, 'available', 'receipt'),
    ('ee000014-ee00-4000-8000-000000000001', v_tenant_id, 'ee000014-ee00-4000-8000-000000000000', p_swring,      60, false, 'available', 'receipt')
  ON CONFLICT (id) DO NOTHING;

  -- ── 3. Inventory units ─────────────────────────────────────────────────────

  INSERT INTO inventory_unit (id, tenant_id, container_id, product_id, quantity, uom, status, packaging_state, container_line_id) VALUES
    ('ee000001-ee00-4000-8000-000000000002', v_tenant_id, 'ee000001-ee00-4000-8000-000000000000', p_sunbed,       30, 'pcs', 'available', 'loose', 'ee000001-ee00-4000-8000-000000000001'),
    ('ee000002-ee00-4000-8000-000000000002', v_tenant_id, 'ee000002-ee00-4000-8000-000000000000', p_carcharger,   50, 'pcs', 'available', 'loose', 'ee000002-ee00-4000-8000-000000000001'),
    ('ee000003-ee00-4000-8000-000000000002', v_tenant_id, 'ee000003-ee00-4000-8000-000000000000', p_trolley,      20, 'pcs', 'available', 'loose', 'ee000003-ee00-4000-8000-000000000001'),
    ('ee000004-ee00-4000-8000-000000000002', v_tenant_id, 'ee000004-ee00-4000-8000-000000000000', p_hanger,       40, 'pcs', 'available', 'loose', 'ee000004-ee00-4000-8000-000000000001'),
    ('ee000005-ee00-4000-8000-000000000002', v_tenant_id, 'ee000005-ee00-4000-8000-000000000000', p_knife,        60, 'pcs', 'available', 'loose', 'ee000005-ee00-4000-8000-000000000001'),
    ('ee000006-ee00-4000-8000-000000000002', v_tenant_id, 'ee000006-ee00-4000-8000-000000000000', p_cutlery,      35, 'pcs', 'available', 'loose', 'ee000006-ee00-4000-8000-000000000001'),
    ('ee000007-ee00-4000-8000-000000000002', v_tenant_id, 'ee000007-ee00-4000-8000-000000000000', p_bubblegun,    80, 'pcs', 'available', 'loose', 'ee000007-ee00-4000-8000-000000000001'),
    ('ee000008-ee00-4000-8000-000000000002', v_tenant_id, 'ee000008-ee00-4000-8000-000000000000', p_mattbest,    100, 'pcs', 'available', 'loose', 'ee000008-ee00-4000-8000-000000000001'),
    ('ee000009-ee00-4000-8000-000000000002', v_tenant_id, 'ee000009-ee00-4000-8000-000000000000', p_poncho,       25, 'pcs', 'available', 'loose', 'ee000009-ee00-4000-8000-000000000001'),
    ('ee00000a-ee00-4000-8000-000000000002', v_tenant_id, 'ee00000a-ee00-4000-8000-000000000000', p_headphones,   45, 'pcs', 'available', 'loose', 'ee00000a-ee00-4000-8000-000000000001'),
    ('ee00000b-ee00-4000-8000-000000000002', v_tenant_id, 'ee00000b-ee00-4000-8000-000000000000', p_roundpool,    15, 'pcs', 'available', 'loose', 'ee00000b-ee00-4000-8000-000000000001'),
    ('ee00000c-ee00-4000-8000-000000000002', v_tenant_id, 'ee00000c-ee00-4000-8000-000000000000', p_boat,         10, 'pcs', 'available', 'loose', 'ee00000c-ee00-4000-8000-000000000001'),
    ('ee00000d-ee00-4000-8000-000000000002', v_tenant_id, 'ee00000d-ee00-4000-8000-000000000000', p_mattchill,    40, 'pcs', 'available', 'loose', 'ee00000d-ee00-4000-8000-000000000001'),
    ('ee00000e-ee00-4000-8000-000000000002', v_tenant_id, 'ee00000e-ee00-4000-8000-000000000000', p_dragon,       30, 'pcs', 'available', 'loose', 'ee00000e-ee00-4000-8000-000000000001'),
    ('ee00000f-ee00-4000-8000-000000000002', v_tenant_id, 'ee00000f-ee00-4000-8000-000000000000', p_mattingle,    55, 'pcs', 'available', 'loose', 'ee00000f-ee00-4000-8000-000000000001'),
    ('ee000010-ee00-4000-8000-000000000002', v_tenant_id, 'ee000010-ee00-4000-8000-000000000000', p_ringhandles,  20, 'pcs', 'available', 'loose', 'ee000010-ee00-4000-8000-000000000001'),
    ('ee000011-ee00-4000-8000-000000000002', v_tenant_id, 'ee000011-ee00-4000-8000-000000000000', p_trigon,       12, 'pcs', 'available', 'loose', 'ee000011-ee00-4000-8000-000000000001'),
    ('ee000012-ee00-4000-8000-000000000002', v_tenant_id, 'ee000012-ee00-4000-8000-000000000000', p_seatpool,     18, 'pcs', 'available', 'loose', 'ee000012-ee00-4000-8000-000000000001'),
    ('ee000013-ee00-4000-8000-000000000002', v_tenant_id, 'ee000013-ee00-4000-8000-000000000000', p_dolphin,      35, 'pcs', 'available', 'loose', 'ee000013-ee00-4000-8000-000000000001'),
    ('ee000014-ee00-4000-8000-000000000002', v_tenant_id, 'ee000014-ee00-4000-8000-000000000000', p_swring,       60, 'pcs', 'available', 'loose', 'ee000014-ee00-4000-8000-000000000001')
  ON CONFLICT (id) DO NOTHING;

  -- ── 4. Product location roles (primary_pick, published) ────────────────────
  -- Required: structural_default_role = 'none' on all rack levels in this layout

  INSERT INTO product_location_roles (id, tenant_id, product_id, location_id, role, state, layout_version_id) VALUES
    ('ee000001-ee00-4000-8000-000000000003', v_tenant_id, p_sunbed,      loc_07_01, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000002-ee00-4000-8000-000000000003', v_tenant_id, p_carcharger,  loc_07_04, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000003-ee00-4000-8000-000000000003', v_tenant_id, p_trolley,     loc_08_01, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000004-ee00-4000-8000-000000000003', v_tenant_id, p_hanger,      loc_08_04, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000005-ee00-4000-8000-000000000003', v_tenant_id, p_knife,       loc_06_01, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000006-ee00-4000-8000-000000000003', v_tenant_id, p_cutlery,     loc_06_04, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000007-ee00-4000-8000-000000000003', v_tenant_id, p_bubblegun,   loc_05_03, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000008-ee00-4000-8000-000000000003', v_tenant_id, p_mattbest,    loc_05_09, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000009-ee00-4000-8000-000000000003', v_tenant_id, p_poncho,      loc_10_01, 'primary_pick', 'published', v_layout_ver_id),
    ('ee00000a-ee00-4000-8000-000000000003', v_tenant_id, p_headphones,  loc_10_04, 'primary_pick', 'published', v_layout_ver_id),
    ('ee00000b-ee00-4000-8000-000000000003', v_tenant_id, p_roundpool,   loc_09_01, 'primary_pick', 'published', v_layout_ver_id),
    ('ee00000c-ee00-4000-8000-000000000003', v_tenant_id, p_boat,        loc_09_04, 'primary_pick', 'published', v_layout_ver_id),
    ('ee00000d-ee00-4000-8000-000000000003', v_tenant_id, p_mattchill,   loc_04_01, 'primary_pick', 'published', v_layout_ver_id),
    ('ee00000e-ee00-4000-8000-000000000003', v_tenant_id, p_dragon,      loc_04_06, 'primary_pick', 'published', v_layout_ver_id),
    ('ee00000f-ee00-4000-8000-000000000003', v_tenant_id, p_mattingle,   loc_03_01, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000010-ee00-4000-8000-000000000003', v_tenant_id, p_ringhandles, loc_03_06, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000011-ee00-4000-8000-000000000003', v_tenant_id, p_trigon,      loc_02_01, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000012-ee00-4000-8000-000000000003', v_tenant_id, p_seatpool,    loc_02_05, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000013-ee00-4000-8000-000000000003', v_tenant_id, p_dolphin,     loc_01_01, 'primary_pick', 'published', v_layout_ver_id),
    ('ee000014-ee00-4000-8000-000000000003', v_tenant_id, p_swring,      loc_01_04, 'primary_pick', 'published', v_layout_ver_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 5. Demo wave + order DEMO-ROUTE-001 ───────────────────────────────────
  -- Route: Rack07(x=-13) → Rack06(x=-1) → Rack05(x=4) → Rack09(y=30,deep) → Rack03(x=14) → Rack01(x=28)

  INSERT INTO waves (id, tenant_id, name, status)
  VALUES ('ee000000-ee00-4000-8000-000000000005', v_tenant_id, 'DEMO-WAVE-001', 'released')
  ON CONFLICT (id) DO UPDATE SET status = 'released';

  INSERT INTO orders (id, tenant_id, wave_id, external_number, status, priority)
  VALUES ('ee000000-ee00-4000-8000-000000000000', v_tenant_id, 'ee000000-ee00-4000-8000-000000000005', 'DEMO-ROUTE-001', 'released', 1)
  ON CONFLICT (id) DO UPDATE SET status = 'released', wave_id = 'ee000000-ee00-4000-8000-000000000005';

  INSERT INTO order_lines (id, order_id, tenant_id, sku, name, qty_required, qty_picked, status, product_id) VALUES
    ('ee000001-ee00-4000-8000-000000000004', 'ee000000-ee00-4000-8000-000000000000', v_tenant_id, '0617588425158', 'מיטת שיזוף וקמפינג מתקפלת',    1, 0, 'pending', p_sunbed),
    ('ee000005-ee00-4000-8000-000000000004', 'ee000000-ee00-4000-8000-000000000000', v_tenant_id, '3664944294191', 'אולר רב תכליתי 11 ב1',          2, 0, 'pending', p_knife),
    ('ee000008-ee00-4000-8000-000000000004', 'ee000000-ee00-4000-8000-000000000000', v_tenant_id, '6942138940480', 'מזרון ים Bestway',               1, 0, 'pending', p_mattbest),
    ('ee00000b-ee00-4000-8000-000000000004', 'ee000000-ee00-4000-8000-000000000000', v_tenant_id, '6941057400006', 'בריכה עגולה',                    1, 0, 'pending', p_roundpool),
    ('ee00000f-ee00-4000-8000-000000000004', 'ee000000-ee00-4000-8000-000000000000', v_tenant_id, '6941057420349', 'מזרן ים יחיד צבעוני',           2, 0, 'pending', p_mattingle),
    ('ee000013-ee00-4000-8000-000000000004', 'ee000000-ee00-4000-8000-000000000000', v_tenant_id, '6941057455358', 'דולפין רכיבה מתנפח מותג INTEX', 1, 0, 'pending', p_dolphin)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Demo scenario inserted: tenant=%, layout_version=%, 20 containers, 20 inventory units, 6 order lines (DEMO-ROUTE-001)', v_tenant_id, v_layout_ver_id;

END $$;
