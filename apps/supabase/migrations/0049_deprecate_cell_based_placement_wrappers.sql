-- migration: 0049_deprecate_cell_based_placement_wrappers
-- stage: 9 PR3 — SQL/RPC wrapper fate decision
--
-- These three functions are unreachable from the first-party BFF execution
-- surface as of Stage 9 PR2.  No BFF route calls them.  They are retained
-- in-place because external callers may reach them via the Supabase REST API
-- (/rest/v1/rpc/<name>) and we have no log evidence to rule that out.
--
-- Being retained does NOT mean they are a supported first-party execution path.
-- They are compatibility-only surfaces pending log-evidence review in Stage 10.
--
-- Canonical replacements:
--   remove_container_if_in_cells  →  remove_container(container_uuid, actor_uuid)
--   move_container_from_cell      →  move_container_canonical(container_uuid, target_location_uuid, actor_uuid)
--   move_container                →  move_container_canonical(container_uuid, target_location_uuid, actor_uuid)

comment on function public.remove_container_if_in_cells(uuid, uuid[], uuid) is
  'COMPATIBILITY-ONLY — NOT a supported first-party execution path.'
  ' Unreachable from the BFF since Stage 9 PR2 (POST /api/placement/remove deleted).'
  ' Retained only because external Supabase REST callers cannot be ruled out without log evidence.'
  ' Canonical replacement: remove_container(container_uuid, actor_uuid).'
  ' Removal target: Stage 10, pending log-evidence review.';

comment on function public.move_container_from_cell(uuid, uuid, uuid, uuid) is
  'COMPATIBILITY-ONLY — NOT a supported first-party execution path.'
  ' Unreachable from the BFF since Stage 9 PR2 (POST /api/placement/move deleted).'
  ' Retained only because external Supabase REST callers cannot be ruled out without log evidence.'
  ' Canonical replacement: move_container_canonical(container_uuid, target_location_uuid, actor_uuid).'
  ' Removal target: Stage 10, pending log-evidence review.';

comment on function public.move_container(uuid, uuid, uuid) is
  'COMPATIBILITY-ONLY — NOT a supported first-party execution path.'
  ' Only remaining caller is move_container_from_cell (also compatibility-only, also deprecated).'
  ' Unreachable from the BFF since Stage 9 PR2.'
  ' Canonical replacement: move_container_canonical(container_uuid, target_location_uuid, actor_uuid).'
  ' Removal target: Stage 10, in tandem with move_container_from_cell, pending log-evidence review.';
