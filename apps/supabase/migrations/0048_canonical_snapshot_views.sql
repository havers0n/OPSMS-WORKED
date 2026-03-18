-- 0048_canonical_snapshot_views.sql
--
-- Stage 8C: Canonical-only storage snapshot views.
--
-- Problem:
--   container_storage_snapshot_v and location_storage_snapshot_v both join
--   through inventory_item_compat_v, which is a UNION ALL of:
--     • inventory_unit rows (canonical)
--     • inventory_items rows WHERE product_id IS NULL (legacy-only)
--
--   Snapshot reads therefore silently return mixed results: correct canonical
--   data for containers with inventory_unit rows, and stale legacy-only rows
--   for containers that still have un-migrated inventory_items with no product_id.
--   A caller cannot distinguish the two sources from the row shape alone.
--
-- Fix:
--   Introduce two new canonical-only views that join directly to inventory_unit:
--     public.container_storage_canonical_v  — container-scoped canonical snapshot
--     public.location_storage_canonical_v   — location-scoped canonical snapshot
--
--   These views:
--     • read inventory exclusively from inventory_unit
--     • expose the full canonical inventory_unit field set (lot_code, serial_no,
--       expiry_date, inventory_status) that the compat path never surfaced
--     • are structurally compatible with the old views for the existing column set
--       (same column names; additional columns are additive)
--
--   The old views are kept as mixed/compatibility surfaces:
--     container_storage_snapshot_v  — COMPAT: may include legacy-only rows
--     location_storage_snapshot_v   — COMPAT: may include legacy-only rows
--
-- BFF trusted consumers repointed in this migration (BFF source edits):
--   GET /api/containers/:containerId/storage    → container_storage_canonical_v
--   LocationReadRepo: listLocationStorage,
--                     listCellStorage,
--                     listCellStorageByIds      → location_storage_canonical_v

-- ============================================================
-- 1. container_storage_canonical_v
--    Reads inventory exclusively from inventory_unit.
--
--    item_ref is synthesized as 'product:<uuid>' for rows with inventory,
--    consistent with the encoding used by inventory_item_compat_v for canonical
--    rows. For containers with no inventory_unit rows the LEFT JOIN yields a
--    single null row (empty container), matching the old view's behavior for
--    genuinely empty containers.
--
--    Additional canonical fields (lot_code, serial_no, expiry_date,
--    inventory_status) are present and selectable; existing consumers that
--    select only the original column set continue to work without modification.
-- ============================================================

create or replace view public.container_storage_canonical_v as
select
  c.tenant_id,
  c.id                                                  as container_id,
  c.external_code,
  ct.code                                               as container_type,
  c.status                                              as container_status,
  case
    when iu.product_id is not null
    then 'product:' || iu.product_id::text
    else null
  end                                                   as item_ref,
  iu.product_id,
  iu.quantity,
  iu.uom,
  iu.lot_code,
  iu.serial_no,
  iu.expiry_date,
  iu.status                                             as inventory_status
from public.containers c
join public.container_types ct on ct.id = c.container_type_id
left join public.inventory_unit iu on iu.container_id = c.id;

grant select on public.container_storage_canonical_v to authenticated;

-- ============================================================
-- 2. location_storage_canonical_v
--    Reads inventory exclusively from inventory_unit.
--
--    Placement is derived from active_container_locations_v, which uses
--    containers.current_location_id as the canonical placement truth (since
--    migration 0040). Both the placement and inventory sides of this view are
--    therefore canonical — no legacy compatibility union on either side.
--
--    Only placed containers (current_location_id IS NOT NULL) appear here,
--    which is the same contract as the old location_storage_snapshot_v.
-- ============================================================

create or replace view public.location_storage_canonical_v as
select
  acl.tenant_id,
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
  case
    when iu.product_id is not null
    then 'product:' || iu.product_id::text
    else null
  end                                                   as item_ref,
  iu.product_id,
  iu.quantity,
  iu.uom,
  iu.lot_code,
  iu.serial_no,
  iu.expiry_date,
  iu.status                                             as inventory_status
from public.active_container_locations_v acl
left join public.inventory_unit iu on iu.container_id = acl.container_id;

grant select on public.location_storage_canonical_v to authenticated;
