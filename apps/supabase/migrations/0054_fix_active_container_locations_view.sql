-- 0054_fix_active_container_locations_view.sql
--
-- Fix: active_container_locations_v joins through container_placements.cell_id,
-- which is a snapshot written at placement time. After each publish cycle,
-- publish_layout_version() regenerates cells with new auto-UUIDs and upserts
-- locations.geometry_slot_id to the new UUIDs (migration 0053). The snapshot
-- in container_placements.cell_id is never updated, so:
--
--   container_placements.cell_id  = V1_cell_uuid   (stale)
--   locations.geometry_slot_id    = V2_cell_uuid   (current)
--   JOIN condition: V2 = V1       → false → zero rows
--
-- Every container placed before the second publish becomes invisible in the
-- placement UI, occupancy views, inventory snapshot, and picking queries.
--
-- Root cause: the join key is wrong. The stable identity is:
--   containers.current_location_id → locations.id
-- Location IDs are never regenerated. This is the canonical placement truth,
-- as documented in migration 0046:
--   "Canonical placement truth is containers.current_location_id.
--    Do not consult container_placements — that is the projection, not truth."
--
-- Fix: rebuild active_container_locations_v to join through the stable link.
-- All dependent views (location_occupancy_v, location_storage_snapshot_v,
-- cell_occupancy_v, cell_storage_snapshot_v) are unchanged — they read
-- active_container_locations_v by column name, so they inherit the fix.
--
-- Column contract preserved:
--   tenant_id, floor_id, location_id, location_code, location_type,
--   capacity_mode, location_status, cell_id, container_id, external_code,
--   container_type, container_status, placed_at
--
-- Behavioural delta:
--   placed_at: was cp.placed_at (row insert time); now c.current_location_entered_at
--   (set atomically with current_location_id in place_container_at_location).
--   Semantically equivalent — both record when the container arrived at its
--   current location. The old value was more precise for historical rows;
--   the new value is always current and never goes stale.
--
--   placement_id: was implicitly cp.id via cp.*; now absent. No column in
--   the original view exposed cp.id directly, so no consumer is broken.
--   If a future caller needs the container_placements row id, add a LEFT JOIN
--   on container_placements(container_id, removed_at) at that point.
--
-- No schema changes. No data migrations. Safe to apply in production.

create or replace view public.active_container_locations_v as
select
  c.tenant_id,
  l.floor_id,
  l.id                              as location_id,
  l.code                            as location_code,
  l.location_type,
  l.capacity_mode,
  l.status                          as location_status,
  l.geometry_slot_id                as cell_id,       -- always current: updated by publish (0053)
  c.id                              as container_id,
  c.external_code,
  ct.code                           as container_type,
  c.status                          as container_status,
  c.current_location_entered_at     as placed_at      -- set atomically with current_location_id
from public.containers c
join public.locations l
  on l.id = c.current_location_id                     -- stable FK; never regenerated on publish
join public.container_types ct
  on ct.id = c.container_type_id
where c.current_location_id is not null;

-- Dependent views are not redefined here — their SELECT columns are identical
-- and they reference active_container_locations_v by name. CREATE OR REPLACE
-- above propagates the fix automatically.
--
-- Grants: active_container_locations_v already has SELECT granted to
-- authenticated (migration 0035). CREATE OR REPLACE preserves existing grants
-- in Postgres — no re-grant needed.
--
-- Verify after applying:
--   select count(*) from public.active_container_locations_v;
--   -- should match count of containers with current_location_id is not null
--
--   select count(*) from public.location_occupancy_v;
--   select count(*) from public.location_storage_snapshot_v;
--   -- all three should return same row count
