-- 0065_disconnect_container_placements_function_stack.sql
--
-- Migration A for final container_placements teardown.
--
-- Scope:
--   - remove remaining function-level dependencies on public.container_placements
--   - keep public.container_placements table in place for now
--
-- Explicitly out of scope:
--   - dropping public.container_placements
--   - dropping table-level indexes/policies/grants

-- 1) Compatibility wrapper still writing container_placements
revoke execute on function public.place_container(uuid, uuid, uuid)
from public, authenticated;

drop function if exists public.place_container(uuid, uuid, uuid);

-- 2) Projection sync helper
revoke execute on function public.sync_container_placement_projection(uuid, uuid)
from public, authenticated;

drop function if exists public.sync_container_placement_projection(uuid, uuid);

-- 3) One-time backfill helper
revoke execute on function public.backfill_container_current_locations()
from public, authenticated;

drop function if exists public.backfill_container_current_locations();

-- 4) Legacy placement access helpers
revoke execute on function public.can_access_container_placement(uuid)
from public, authenticated;

drop function if exists public.can_access_container_placement(uuid);

revoke execute on function public.can_manage_container_placement(uuid)
from public, authenticated;

drop function if exists public.can_manage_container_placement(uuid);

-- 5) Trigger function cleanup
-- validate_container_placement_row() is still referenced by the table trigger,
-- so drop the trigger first, then drop the function.
drop trigger if exists validate_container_placement_row on public.container_placements;

drop function if exists public.validate_container_placement_row();
