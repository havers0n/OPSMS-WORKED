# Troubleshooting

## 1) Frontend shows wrong units / quantities

Symptoms:
- A parent packaging level displays `4` instead of expected `8`.
- Container card shows different quantity than location snapshot.

Checks:
- Verify that response comes from canonical snapshot endpoints.
- Confirm `packaging_profile_levels` parent links (`parent_level_type`, `qty_per_parent`) are present.
- Ensure storage preset and product packaging logic was not computed in UI fallback branch.

## 2) `create_container_from_storage_preset` fails in preset creation

Common codes:
- `STORAGE_PRESET_NOT_FOUND`
- `STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED`
- `STORAGE_PRESET_CONTAINER_TYPE_INVALID`
- `STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED`

Checks:
- Confirm profile status is `active` and `profile_type = 'storage'`.
- Ensure one unique container type exists in preset levels.
- If `materializeContents` is true, confirm exactly one materializable legacy level exists.

## 3) `/ready` returns 503 or 5xx

Common cause:
- Supabase not started, wrong URL/anon key, or migration mismatch.

Checks:
- Start Supabase (`supabase start` in `apps/supabase`).
- Compare `apps/supabase/config.toml` ports with `VITE_*` and `BFF_*` env values.
- Inspect local DB logs and run the migration list cleanly.

## 4) Layout publish/validation fails

Checks:
- Verify draft references valid floor/rack/cell hierarchy.
- Confirm draft changes are within site/floor tenant scope.
- Check validation endpoint `/api/layout-drafts/:layoutVersionId/validate` response for structured validation errors.

## 5) Pick execution conflicts (`409` / validation errors)

Checks:
- Re-fetch task from `/api/pick-tasks/:taskId` to ensure latest state.
- Ensure reserved inventory has not been moved in another concurrent action.
- Verify action was retried only after DB-level status refresh.
