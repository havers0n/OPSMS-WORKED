-- migration: 0051_drop_remove_container_if_in_cells
-- stage: 10 PR2 — first safe removal after evidence collection
--
-- Drops public.remove_container_if_in_cells(uuid, uuid[], uuid).
--
-- Evidence for removal:
--   1. Zero callers in the entire codebase (exhaustive search of all .ts, .tsx, .js,
--      .sql non-migration files): no BFF code, no web app code, no SQL tests,
--      no scripts, no tooling.
--   2. The last BFF caller — POST /api/placement/remove — was deleted in Stage 9 PR2.
--   3. No SQL test in apps/supabase/tests/ calls this function.
--   4. COMMENT ON FUNCTION deprecation stamp was applied in migration 0049.
--   5. No SQL-internal dependents: only caller was the now-deleted BFF route.
--   6. Internal logic is stale: the function body (migration 0025, never updated) checks
--      container_placements.removed_at IS NULL as placement truth, while the canonical
--      model has used containers.current_location_id since Stage 8. The function would
--      misfire on containers placed via non-rack paths.
--
-- External Supabase REST callers (/rest/v1/rpc/remove_container_if_in_cells) cannot be
-- ruled out — runtime logs are not accessible from the development environment. This is
-- an acknowledged gap. The evidence profile (zero internal callers, stale logic, smallest
-- blast radius of all retained wrappers) was judged sufficient for removal in Stage 10 PR2.
--
-- If an external caller exists, they will receive a Supabase 404 (function not found)
-- on their next call. No data will be silently corrupted. The canonical replacement is:
--   remove_container(container_uuid, actor_uuid)
-- accessible via POST /api/containers/:containerId/remove or directly via
--   /rest/v1/rpc/remove_container

revoke execute on function public.remove_container_if_in_cells(uuid, uuid[], uuid) from authenticated;

drop function public.remove_container_if_in_cells(uuid, uuid[], uuid);
