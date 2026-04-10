-- migration: 0052_drop_move_container_wrappers
-- stage: 10 PR3 — remove dead SQL compatibility move-wrapper chain
--
-- Drops move_container_from_cell(uuid, uuid, uuid, uuid) and
-- move_container(uuid, uuid, uuid) together in dependency order.
-- move_container_from_cell calls move_container, so it is dropped first.
--
-- Evidence for removal:
--   1. Zero callers in the entire codebase (exhaustive search of all .ts, .tsx,
--      .js, .sql non-migration files): no BFF code, no web app code, no scripts.
--   2. move_container_from_cell: last BFF caller (POST /api/placement/move) was
--      deleted in Stage 9 PR2. No SQL test calls it.
--   3. move_container: only production caller was move_container_from_cell (also
--      removed here). No BFF code calls it directly. One SQL test
--      (container_placement_actions.test.sql) called it — those test cases were
--      removed as part of this PR since the test covered only the dead wrapper.
--      The movement_type string 'move_container' stored in stock_movements rows
--      is unaffected (it is a data value, not a function reference).
--   4. COMMENT ON FUNCTION deprecation stamps applied in migration 0049.
--   5. Internal logic of move_container_from_cell uses stale
--      container_placements.removed_at IS NULL placement truth (never updated
--      past Stage 8); the function would misfire on non-rack containers.
--
-- External Supabase REST callers (/rest/v1/rpc/move_container_from_cell and
-- /rest/v1/rpc/move_container) cannot be ruled out — runtime logs are not
-- accessible from the development environment. This is an acknowledged gap.
-- The evidence profile (zero internal callers, stale logic, same dead-code
-- pattern as remove_container_if_in_cells removed in PR2) was judged sufficient.
--
-- If an external caller exists, they will receive a Supabase 404 (function not
-- found) on their next call. No data will be silently corrupted.
-- Canonical replacement: move_container_canonical(container_uuid, location_uuid, actor_uuid)
-- accessible via POST /api/containers/:containerId/move-to-location or directly
-- via /rest/v1/rpc/move_container_canonical

-- Drop caller first, then callee.

revoke execute on function public.move_container_from_cell(uuid, uuid, uuid, uuid) from authenticated;

drop function public.move_container_from_cell(uuid, uuid, uuid, uuid);

revoke execute on function public.move_container(uuid, uuid, uuid) from authenticated;

drop function public.move_container(uuid, uuid, uuid);
