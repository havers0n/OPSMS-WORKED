-- migration: 0050_deprecate_place_container_wrapper
-- stage: 10 PR1 — usage evidence collection and compatibility boundary inventory
--
-- Adds a COMMENT ON FUNCTION deprecation stamp to place_container(), closing
-- the gap left by migration 0049 which stamped the three fully-dead wrappers
-- (remove_container_if_in_cells, move_container_from_cell, move_container) but
-- not place_container.
--
-- place_container is different from the 0049 wrappers: it still has an active
-- BFF caller (POST /api/containers/:containerId/place), but that route is itself
-- a compatibility-only surface with no first-party callers since Stage 9 PR1.
-- The full chain is:
--
--   [no first-party caller]
--     → POST /api/containers/:containerId/place  (compat BFF route; emits Deprecation headers)
--       → place_container(container_uuid, cell_uuid, actor_uuid)  ← this function
--
-- External Supabase REST callers may also reach this function directly via
-- /rest/v1/rpc/place_container.  No log evidence exists to rule that out.
--
-- Being retained does NOT mean this is a supported first-party execution path.
-- It is a compatibility-only surface pending log-evidence review in Stage 10.
--
-- Canonical replacement:
--   place_container_at_location(container_uuid, location_uuid, actor_uuid)
--   via POST /api/placement/place-at-location

comment on function public.place_container(uuid, uuid, uuid) is
  'COMPATIBILITY-ONLY — NOT a supported first-party execution path.'
  ' Called only by the deprecated BFF route POST /api/containers/:containerId/place,'
  ' which emits Deprecation headers and has had no first-party callers since Stage 9 PR1.'
  ' External callers may also reach this function via /rest/v1/rpc/place_container;'
  ' no log evidence exists to rule that out.'
  ' Canonical replacement: place_container_at_location(container_uuid, location_uuid, actor_uuid)'
  ' via POST /api/placement/place-at-location.'
  ' Removal target: Stage 10 PR2, in tandem with the BFF route, pending log-evidence review.';
