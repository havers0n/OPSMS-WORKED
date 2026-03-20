# Stage 8 Backlog

Created: 2026-03-17
Source: items explicitly deferred during Stage 7 and Stage 7.1 security hardening

This file is the authoritative list of deferred items to address at the start of
Stage 8. Items are grouped by priority tier. Nothing here is aspirational — every
item corresponds to a known concrete gap in the current system.

---

## Tier 1 — Address at the start of Stage 8

These are blocking for first-class non-rack operational flows and for Stage 8
API cleanup. Do not declare Stage 8 started without a plan for each.

### 1. `place_container_at_location(container_uuid uuid, location_uuid uuid, actor_uuid uuid)` ✅ **completed: migration 0046**

**Delivered:** INVOKER function with `actor_uuid := auth.uid()` override, inline
`can_manage_tenant` gate, `location_can_accept_container` constraint enforcement,
rack-backed projection writes, legacy `movement_events` compatibility, and BFF
wiring (`POST /api/placement/place-at-location`). See Stage 7.3 in
`storage-core-convergence-checklist.md`.

**Still deferred from original scope:** writing canonical `stock_movements` on
initial placement — completed in item 2 (migration 0047).

---

### 2. `place_container` and `remove_container` → write canonical `stock_movements` ✅ **completed: migration 0047**

**Delivered:** All three placement/removal RPCs (`place_container`,
`place_container_at_location`, `remove_container`) promoted to SECURITY DEFINER
and extended to write canonical `stock_movements` rows using
`movement_type = 'place_container'` and `movement_type = 'remove_container'`.
`movement_events` dual-write retained for legacy compatibility. Full lifecycle
(place → move → remove) is now readable from `stock_movements` alone. Side fix:
`place_container` now checks `containers.current_location_id IS NOT NULL`
instead of `container_placements` rows for the "already placed" guard, closing a
gap where non-rack placements could be double-placed. All 5 SQL test files green.
See Stage 8B in `storage-core-convergence-checklist.md`.

---

### 3. Stage 8 fate decision: `place_container` and `move_container` (cell-based legacy)

**Gap:** These functions are INVOKER compatibility facades from Stage 7. They
translate cell UUIDs to location UUIDs and delegate to canonical RPCs. They are
not SECURITY DEFINER and do not write `stock_movements`.

**Decision needed:** deprecate and route all callers through location-native
RPCs, or harden and retain as a supported thin adapter.

**Constraint:** The BFF `POST /api/containers/:id/move` legacy gateway route
still calls `move_container`. It cannot be removed until the web no longer
produces cell-based move requests.

---

## Tier 2 — Convergence cleanup

These items do not block new features but are required before the Completion Gate
in `storage-core-convergence-checklist.md` can be satisfied.

### 4. Remove `inventory_item_compat_v` legacy union from canonical snapshots — ← **partially addressed: Stage 8C (migration 0048)**

**Gap:** `container_storage_snapshot_v` and `location_storage_snapshot_v` join
through `inventory_item_compat_v`, which unions `inventory_unit` with legacy
`inventory_items` rows. This means snapshot reads silently include both canonical
and legacy rows for containers that still have un-migrated legacy items.

**Stage 8C progress (migration 0048):** New canonical-only views
(`container_storage_canonical_v`, `location_storage_canonical_v`) introduced that
read only from `inventory_unit`. BFF trusted consumers repointed to canonical
views. Old mixed views kept as compatibility surfaces.

**Remaining:**
- Verify all `inventory_items` rows with `product_id IS NOT NULL` have been
  backfilled into `inventory_unit` in production (migration 0036 ran the initial
  backfill but production confirmation is needed).
- Once confirmed: remove `inventory_item_compat_v` or mark it as explicitly
  deprecated.
- Remove old mixed views after all remaining consumers migrate.

---

### 5. Remove or explicitly retire legacy cell-centric BFF routes — ← **partially addressed: Stage 8D**

See `docs/architecture/legacy-route-removal-matrix.md` for per-route decisions.

**Stage 8D progress:**
- `GET /api/cells/:cellId/containers` — **removed**: no first-party callers confirmed; route handler deleted from `app.ts`; `listCellContainers` gateway method deleted; dead web hooks/query options pruned
- `GET /api/cells/:cellId/storage` — **removed**: same; `listCellStorage` gateway method deleted; `useCellStorage`, `cellStorageQueryOptions`, `floorCellOccupancyQueryOptions` removed
- `GET /api/floors/:floorId/cell-occupancy` — **kept**: external risk; dead web hook (`useFloorCellOccupancy`) deleted but route retained
- `GET /api/rack-sections/:sectionId/slots/:slotNo/storage` — **kept**: active editor caller (`cellSlotStorageQueryOptions`)
- `POST /api/containers/:containerId/move` — **kept**: external integrator risk; no first-party web callers confirmed
- Gateway tightening lint rule added: new web code cannot import cell-based placement DTOs from `@wos/domain` outside `apps/web/src/features/placement-actions/` (ESLint `no-restricted-imports`)

**Remaining:**
- Remove `GET /api/floors/:floorId/cell-occupancy` once external usage confirmed safe (log/monitoring evidence needed)
- Remove `POST /api/containers/:containerId/move` once external integrators confirm migration to `move-to-location`
- Stage 9: migrate web placement from cell-based (`/api/placement/*` routes) to location-based; retire `place_container`, `move_container_from_cell`, `remove_container_if_in_cells` RPCs

---

### 6. Canonical storage snapshot without legacy union ✅ **completed: Stage 8C (migration 0048)**

**Delivered:** `container_storage_canonical_v` and `location_storage_canonical_v`
introduced as the canonical read model. Both read exclusively from `inventory_unit`
with no legacy union. Expose full inventory_unit field set (`lot_code`, `serial_no`,
`expiry_date`, `inventory_status`) in addition to the existing column contract.
BFF trusted consumers (`listLocationStorage`, `listCellStorage`,
`listCellStorageByIds`, `GET /api/containers/:id/storage`) repointed to canonical
views. Old mixed views (`container_storage_snapshot_v`,
`location_storage_snapshot_v`) kept as compatibility surfaces.

**Remaining deferred:** exposing the new canonical fields through BFF response
schemas and domain types (requires `@wos/domain` schema updates).

---

## Tier 3 — Movement semantics and naming cleanup

These are not blocking but accumulate as naming debt that makes the codebase
harder to reason about over time.

### 7. Align movement type vocabulary across `movement_events` and `stock_movements`

`movement_events.event_type` uses `'placed'`, `'removed'`, `'moved'`.
`stock_movements.movement_type` uses `'move_container'`, `'split_stock'`,
`'transfer_stock'`, `'pick_partial'`.

There is no `'place_container'` or `'remove_container'` movement type in
`stock_movements` yet (see item 2). Once item 2 is done, document the complete
vocabulary cross-reference and remove the ambiguity.

### 8. `actor_uuid` parameter in INVOKER functions

`place_container` still accepts an `actor_uuid` parameter and writes it to
`movement_events.actor_id`. This is a different pattern from the SECURITY
DEFINER functions that override the parameter. Before Stage 8 promotes
`place_container` to a first-class hardened RPC (item 1 / item 3), the parameter
should be aligned: either always override with `auth.uid()`, or remove the
parameter entirely.

### 9. `container_placements` comment and naming clarity

The column `container_placements.removed_at` and the views that filter on
`removed_at IS NULL` are named as if `container_placements` is a primary truth
table. Add or update inline SQL comments to clearly state:

> `container_placements` is a rack/canvas geometry projection derived from
> `containers.current_location_id`. It is not the canonical source of placement
> truth. The canonical source is `containers.current_location_id`.

---

## Not in scope for Stage 8

These were deferred in ADR-006 and remain out of scope:

- `cell_blocks` — operational exception control layer
- `operational_exceptions` — warehouse exception workflow
- route analysis, movement heatmaps, operator flow analytics
- pick and replenishment optimization
- multi-floor or cross-site container tracking

These belong to a later execution-control layer, after Stage 8 completes the
storage-core and legacy-cleanup work.
