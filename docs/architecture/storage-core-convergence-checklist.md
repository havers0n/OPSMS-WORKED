# Storage Core Convergence Checklist

## Status

Working migration checklist for converging the current storage implementation toward the canonical target model defined in [core-wms-data-model-v1.md](./core-wms-data-model-v1.md).

Snapshot date: `2026-03-17`

This document is intentionally operational.
It is not another conceptual architecture note.
It exists to answer a harder question:

- what exactly has to change in SQL, domain code, BFF, web, tests, and docs before the repo can honestly say it uses `location / inventory_unit / movement`

## Canonical References

- target execution model: [core-wms-data-model-v1.md](./core-wms-data-model-v1.md)
- adopting decision: [ADR-007.md](./ADR-007.md)
- current schema map and staged plan: [supabase-schema-module-map.md](./supabase-schema-module-map.md)

## Working Rule

Use this checklist together with the schema map:

- `supabase-schema-module-map.md` explains the current and near-term schema shape
- this file lists the concrete migration work needed to converge
- do not mark a stage complete just because one table or one endpoint was renamed

## Current Change Surface

These are the main repo areas touched by the convergence:

### Supabase schema and SQL

- `apps/supabase/migrations/0018_container_registry.sql`
- `apps/supabase/migrations/0019_container_placements.sql`
- `apps/supabase/migrations/0020_cell_occupancy_view.sql`
- `apps/supabase/migrations/0021_container_placement_actions.sql`
- `apps/supabase/migrations/0022_inventory_items.sql`
- `apps/supabase/migrations/0023_resolved_storage_snapshots.sql`
- `apps/supabase/migrations/0025_movement_events_and_slot_actions.sql`
- `apps/supabase/migrations/0026_move_container_from_source.sql`
- `apps/supabase/migrations/0034_locations.sql`
- `apps/supabase/tests/`

### Domain package

- `packages/domain/src/storage/container.ts`
- `packages/domain/src/storage/container-placement.ts`
- `packages/domain/src/storage/container-placement-action.ts`
- `packages/domain/src/storage/cell-occupancy.ts`
- `packages/domain/src/storage/cell-storage-snapshot.ts`
- `packages/domain/src/storage/container-storage-snapshot.ts`
- `packages/domain/src/storage/inventory-item.ts`
- `packages/domain/src/storage/inventory-item-ref.ts`
- `packages/domain/src/catalog/product.ts`
- `packages/domain/src/operations/`

### BFF

- `apps/bff/src/features/placement/placement-repo.ts`
- `apps/bff/src/features/placement/service.ts`
- `apps/bff/src/features/placement/place-container.ts`
- `apps/bff/src/features/placement/move-container.ts`
- `apps/bff/src/features/placement/remove-container.ts`
- `apps/bff/src/features/placement/placement-validators.ts`
- `apps/bff/src/inventory-product-resolution.ts`
- `apps/bff/src/mappers.ts`
- `apps/bff/src/schemas.ts`

### Web

- `apps/web/src/entities/cell/`
- `apps/web/src/entities/container/`
- `apps/web/src/features/container-create/`
- `apps/web/src/features/container-inventory/`
- `apps/web/src/features/inventory-add/`
- `apps/web/src/features/placement-actions/`
- `apps/web/src/widgets/warehouse-editor/ui/mode-panels/`

### Docs that must stay aligned

- `docs/architecture/architecture-baseline.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/invariant-matrix.md`
- `docs/architecture/supabase-schema-module-map.md`
- `docs/architecture/core-wms-data-model-v1.md`

## Stage 1. Introduce Executable `locations`

Goal:

- create `location` as the execution entity without breaking current placement behavior

Implementation status snapshot:

- `public.locations` exists as a first-class execution entity
- published rack slots are backfilled into `locations`
- current placement persistence still runs through `container_placements`
- BFF has an additive internal bridge read from `cellId` to `locationId`
- web remains intentionally cell-centric in this stage

Schema checklist:

- [x] add `location` table with execution-facing fields and lifecycle timestamps
- [x] enforce uniqueness of `location.code` within the current execution scope
- [x] add initial constraints for `location_type`, `capacity_mode`, and `status`
- [x] enforce one-to-one `geometry_slot_id` mapping in v1
- [x] backfill `location` rows for existing executable published rack slots
- [ ] add first non-rack location seeds for receiving, staging, dock, buffer, and ship flows if the app already exposes such states

Domain checklist:

- [x] add `location` domain type under `packages/domain/src/storage/`
- [x] keep `cell` in `packages/domain/src/layout/` as geometry only
- [x] add type-level storage note that `slot != location`

BFF checklist:

- [x] add repository support that can resolve executable storage by `location`
- [x] do not remove current cell-centric placement routes yet

Web checklist:

- [x] keep current cell-centric queries unchanged in Stage 1
- [ ] prepare a `location`-aware read path without forcing an immediate UI rewrite

Tests and docs:

- [x] add migration tests for `location` constraints and backfill behavior
- [x] document that `geometry_slot_id` is one-to-one in v1

Exit criteria:

- every executable rack slot can be mapped to a `location`
- non-rack operational addresses can exist without inventing fake cells
- no new feature introduces a stronger dependency on `cell = executable location`

## Stage 2. Build the Cell-to-Location Compatibility Bridge

Goal:

- keep current placement working while allowing new reads to pivot around `location`

Implementation status snapshot:

- location-centered read views now exist
- legacy `cell_*` views remain supported as compatibility projections
- BFF storage reads are location-backed internally while public responses remain unchanged
- web remains intentionally unchanged in this stage

Schema checklist:

- [x] add compatibility views or joins that resolve active placement through `location`
- [x] introduce location-centered read views alongside existing cell-centered views
- [x] keep existing views operational until all consumers move off them

Domain checklist:

- [x] add snapshot models that can describe storage by `location`
- [x] avoid expanding `cell-storage-snapshot` semantics any further

BFF checklist:

- [x] keep current placement repository support for target location identity
- [x] switch internal storage reads to location-backed sources without changing public response shapes

Web checklist:

- [x] keep existing web hooks stable while BFF responses remain unchanged
- [x] avoid any UX or invalidation changes in this stage

Tests and docs:

- [x] verify that placement and storage reads remain stable after the bridge
- [x] document which views are legacy and which are target-facing

Exit criteria:

- storage reads can be served through `location` without removing current placement UX
- engineers can build new storage features without starting from raw `cell_id`

## Stage 3. Promote `inventory_items` Into `inventory_unit`

Goal:

- make the stock unit explicit and container-bound

Implementation status snapshot:

- canonical `inventory_unit` now exists as the target stock table
- product-backed legacy `inventory_items` rows are backfilled and synchronized into canonical stock units
- public inventory endpoints remain compatibility-stable while writing canonical rows
- `inventory_items` now remains explicit compatibility debt rather than the preferred storage-core model

Schema checklist:

- [x] introduce `inventory_unit` shape with `product_id`, `container_id`, `quantity`, `uom`, `lot_code`, `serial_no`, `expiry_date`, and `status`
- [x] backfill existing `inventory_items` into the new shape or evolve the table in place with a documented compatibility strategy
- [x] ensure inventory location is derived through `container.current_location_id` or equivalent location-backed state, not duplicated as a second truth

Domain checklist:

- [x] add `inventory-unit` domain model
- [x] deprecate `inventory-item` naming from storage-core concepts
- [x] preserve a clean distinction between product master and stock instance

BFF checklist:

- [x] update `inventory-product-resolution.ts` and related mappers to consume the new stock-unit shape
- [x] update validation rules for lot, serial, expiry, and per-unit status

Web checklist:

- [x] update `container-inventory` and `inventory-add` flows to stop treating inventory as a loose product attachment
- [x] ensure container views show stock contents as inventory units, not ambiguous item rows

Tests and docs:

- [x] add tests for multiple inventory units per container
- [x] add tests for lot/serial/expiry constraints if enabled by product tracking mode

Exit criteria:

- stock is represented as container-bound execution units
- the repo no longer encourages `product -> cell` mental models

## Stage 4. Canonical Split Semantics and Execution Movements

Goal:

- make partial-stock semantics and execution history explicit without changing public UI or API contracts

Implementation status snapshot:

- `inventory_unit` now carries Stage 4 execution metadata through `updated_by` and `source_inventory_unit_id`
- canonical split rules now exist in domain and SQL
- `stock_movements` now exists as canonical execution history for new flows
- canonical execution RPCs now operate on `location` as the input boundary, not `cell`
- current physical placement persistence still bridges through `container_placements` and `geometry_slot_id`
- full fit, weight, and capacity enforcement is intentionally deferred to Stage 5

Schema checklist:

- [x] extend `inventory_unit` with split-lineage metadata needed for canonical execution semantics
- [x] add canonical `stock_movements` instead of overloading legacy `movement_events`
- [x] support `move_container`, `split_stock`, `transfer_stock`, and `pick_partial` as first-class execution operations
- [x] capture source/target `location`, `container`, `inventory_unit`, quantity, status, and timestamps in canonical movement rows
- [x] keep `product_id` out of canonical movement rows and derive product identity through referenced inventory units
- [x] keep legacy `movement_events` untouched as compatibility debt

Domain checklist:

- [x] add `stock-movement` domain model and execution movement-type enum
- [x] add explicit split/merge helpers for `inventory_unit`
- [x] separate current-state stock rows from movement-log semantics

BFF checklist:

- [x] add internal execution repo/service for canonical move, split, transfer, and pick-partial flows
- [x] keep public web-visible inventory and storage endpoints unchanged
- [x] stop treating placement row mutation as sufficient execution history for new canonical flows

Web checklist:

- [x] keep web behavior intentionally unchanged in Stage 4
- [x] avoid exposing fake history derived only from placement state; canonical history now exists below the API boundary
- [ ] prepare future operations UX to consume canonical execution outcomes in a later stage
- [ ] do not expose fake “history” derived only from current placement state

Tests and docs:

- [x] verify canonical move, split, transfer, and pick-partial flows write `stock_movements`
- [x] document status model: `pending`, `done`, `cancelled`
- [x] document that Stage 4 canonical move accepts `targetLocationId`, not `targetCellId`
- [x] document that full fit/capacity enforcement remains deferred to Stage 5

Exit criteria:

- canonical stock can be split without hacks
- exact-match merge is deterministic instead of accidental row duplication
- whole-container move and partial-stock transfer are separate execution paths
- the system can answer “what moved, when, and from where to where” without reconstructing state from ad hoc joins

## Stage 5. Canonical Current Location Pivot + Location Constraint Enforcement

Goal:

- make `containers.current_location_id` the canonical current-state truth
- rebase current-state reads on location-native state
- keep public API/UI stable while operational writes stop executing through geometry

Implementation status snapshot:

- `containers.current_location_id` now exists and is backfilled from the old placement bridge
- current-state read views now derive from canonical container location instead of active placements
- `container_placements` now acts only as a geometry/rack compatibility projection
- canonical move now supports non-rack targets and explicitly syncs rack projection only when needed
- Stage 5 now enforces location status, same-location rejection, single-container occupancy, dimension fit, and weight fit

Schema checklist:

- [x] add `containers.current_location_id`
- [x] add idempotent backfill from the active location bridge
- [x] pivot `active_container_locations_v`, `location_occupancy_v`, and `location_storage_snapshot_v` to canonical current location
- [x] keep `cell_*` views only as compatibility projections for geometry-backed locations
- [x] update canonical move to write `current_location_id` directly
- [x] sync rack placement projection explicitly instead of treating it as execution truth
- [x] support non-rack canonical move targets
- [x] enforce active-only, same-location, single-container, dimension-fit, and weight-fit rules in canonical move

Domain checklist:

- [x] add location-aware fit/capacity helpers and explicit failure reasons
- [x] keep geometry validation separate from storage execution validation

BFF checklist:

- [x] pivot internal move execution to `locationId`
- [x] keep the existing cell-based move route as a compatibility facade
- [x] preserve current public payload shapes while resolving `cell -> location` internally
- [ ] add broader receive / putaway / ship wrappers only when product scope needs them

Web checklist:

- [x] keep public web hooks and payload shapes unchanged
- [x] avoid any new visible state or UI concepts in Stage 5
- [ ] expose location-native operational controls in a later UX stage

Tests and docs:

- [x] add SQL acceptance coverage for current-location pivot and enforced constraints
- [x] update docs to state that `containers.current_location_id` is canonical truth
- [ ] add end-to-end receive / putaway / ship coverage only when those flows are promoted beyond thin wrappers

Exit criteria:

- current-state storage truth is container-location-native
- `container_placements` no longer answers “where is the container now?”
- non-rack locations are valid canonical write targets
- hard location constraints are enforced by canonical move
- public contracts remain compatibility-stable

## Stage 6. Public Location-Native API Pivot + Legacy Surface Freeze

Goal:

- finish the public vocabulary pivot without breaking existing clients

Implementation status snapshot:

- location-native public execution endpoints now exist for occupancy, storage, canonical move, transfer, and pick-partial
- `GET /api/containers/:containerId/location` now exposes canonical current location explicitly
- old cell-centric routes remain supported, but they are now deprecated compatibility facades
- `inventory_items`, `movement_events`, and `container_placements` are now documented as frozen legacy surfaces
- web now has additive location-native query modules without forcing an immediate UI rewrite

Schema checklist:

- [x] mark legacy cell-centric views as deprecated compatibility projections
- [x] keep `container_placements` reduced to rack/canvas projection only
- [x] ensure current container location can be resolved directly without treating `cell_id` as the primary execution key
- [x] freeze `inventory_items` and `movement_events` as non-canonical execution surfaces

Domain checklist:

- [x] add public location-native DTOs for occupancy, storage, and current container location
- [x] keep `InventoryItem` and `cell-*` types as compatibility-only exports
- [x] keep cell logic only where geometry and visualization need it

BFF checklist:

- [x] add new public location-native routes for read and write execution flows
- [x] add explicit `GET /api/containers/:containerId/location`
- [x] keep legacy cell routes stable while resolving them through canonical location-backed reads
- [x] stop adding new public execution paths that start from `cell_id`
- [ ] collapse compatibility bridge logic only after all consumers migrate to location-native routes

Web checklist:

- [x] add location-native query modules and hooks alongside existing cell-facing entities
- [ ] reduce `entities/cell` to geometry-facing concerns plus temporary compatibility reads
- [ ] migrate storage-oriented UI reads toward location-aware entities as product scope allows

Tests and docs:

- [x] add BFF/domain/web coverage for new location-native public contracts
- [x] rewrite compatibility tests so they no longer assume `cell = executable location`
- [x] explicitly document which APIs and schema surfaces are frozen legacy compatibility
- [ ] remove deprecated compatibility routes only in a later cleanup stage after client migration

Exit criteria:

- there is a public location-native execution API
- container current location is explicitly readable through public API
- old cell-centric routes are clearly deprecated but still functional
- new execution work no longer starts from `cell`, `item_ref`, or `movement_events`
- geometry can evolve without threatening storage identity

## Stage 7. First-Party Client Migration + Centralized Legacy Route Gateway

Goal:

- first-party web no longer reads execution data through `/api/cells/*`
- all legacy route translation is centralized in one BFF adapter layer
- every legacy route emits deprecation metadata
- every legacy route has an explicit Stage 8 decision

BFF checklist:

- [x] create `features/legacy-execution-gateway/service.ts` — single adapter layer owning all legacy route translation
- [x] wire all 5 legacy routes through the gateway (replaced inline handlers in `app.ts`)
- [x] all legacy routes emit `Deprecation`, `Warning`, and `Link` response headers
- [x] add `GET /api/locations/by-cell/:cellId` for first-party cell → location resolution at the boundary
- [x] `POST /api/containers/:containerId/move` goes only through `cell → location → canonical move` in gateway

Domain checklist:

- [x] add `LocationReference` type (`packages/domain/src/storage/location-reference.ts`)
- [x] export `LocationReference` from `packages/domain/src/index.ts`
- [x] annotate legacy DTOs (`InventoryItem`, `container-placement`, `cell-occupancy`, `cell-storage-snapshot`) as compatibility-only

Web checklist:

- [x] migrate `cell-placement-inspector.tsx` from `useCellStorage` → `useLocationByCell` + `useLocationStorage`
- [x] migrate `editor-canvas.tsx` from `useFloorCellOccupancy` → `useFloorLocationOccupancy`
- [x] update `indexOccupiedCellIds` to accept `LocationOccupancyRow[]` (nullable `cellId`)
- [x] update `placement-actions/invalidation.ts` to use `locationKeys` instead of `cellKeys`
- [x] update `container-inventory/invalidation.ts` to use `locationKeys` instead of `cellKeys`
- [x] add `useLocationByCell` hook + `locationByCellQueryOptions` in `entities/location/api`
- [x] `entities/cell` is now geometry/editor-only (published cells, canvas selection, slot rendering, occupied-cell index)

Removal checklist (Stage 8 handoff):

See `docs/architecture/legacy-route-removal-matrix.md`

Exit criteria (all met):

- [x] first-party web no longer reads execution data through `/api/cells/*`
- [x] first-party web no longer uses `cell` as storage vocabulary outside geometry/editor concerns
- [x] all legacy execution routes return deprecation metadata
- [x] all legacy route adapters are centralized in exactly one BFF compatibility layer
- [x] every legacy route has an explicit Stage 8 decision (see removal matrix)
- [ ] no new first-party execution code imports legacy DTOs outside the compatibility gateway (invariant — enforce in Stage 8)

## Stage 7.1 — Security Hardening Patch

Migration: `0044_security_definer_hardening.sql`
Closed: 2026-03-17

This is a maintenance patch applied between Stage 7 and Stage 8.
It closes authorization gaps that Stage 7 introduced when execution RPCs became
SECURITY DEFINER without the corresponding inline protection.

### What changed

- [x] `move_container_canonical` → SECURITY DEFINER; `actor_uuid := auth.uid()` override; inline `can_manage_tenant` gate inside `SELECT … FOR UPDATE`; oracle masking (`TARGET_LOCATION_NOT_FOUND`)
- [x] `split_inventory_unit` → SECURITY DEFINER; `actor_uuid := auth.uid()` override; inline auth gate; oracle masking (`TARGET_CONTAINER_NOT_FOUND`)
- [x] `transfer_inventory_unit` → SECURITY DEFINER; `actor_uuid := auth.uid()` override; `occurred_at_utc` reuse from split result
- [x] `pick_partial_inventory_unit` → SECURITY DEFINER; `actor_uuid := auth.uid()` override; `occurred_at_utc` reuse from split result
- [x] `remove_container` → stays INVOKER; inline auth gate added; rewritten to derive placement from `containers.current_location_id` instead of `container_placements`; handles rack-backed and non-rack locations; hard guard `CURRENT_LOCATION_NOT_FOUND`
- [x] `REVOKE EXECUTE ON insert_stock_movement FROM authenticated`
- [x] `REVOKE EXECUTE ON sync_container_placement_projection FROM authenticated`

### Security tests added

- [x] CT-1 through CT-5: cross-tenant UUID attacks return `CONTAINER_NOT_FOUND` / `TARGET_LOCATION_NOT_FOUND` / `TARGET_CONTAINER_NOT_FOUND`
- [x] SP-1 through SP-3: caller-supplied `actor_uuid` is ignored; `auth.uid()` appears in audit trail
- [x] DH-1, DH-2: direct helper calls as `authenticated` raise `insufficient_privilege`
- [x] NF-1: non-existent UUID and cross-tenant UUID return identical error strings
- [x] LC-1, LC-2: legitimate same-tenant calls continue to work
- [x] TS-1, TS-2: split and transfer/pick movements share one timestamp
- [x] CR-1, CR-2, CR-3: canonical remove works for rack-backed and non-rack locations; respects `current_location_id` as truth

### Deferred (see stage-8-backlog.md)

- `place_container_at_location(uuid, uuid, uuid)` — first-class non-rack initial placement RPC
- `place_container` / `remove_container` writing canonical `stock_movements`
- `place_container` and `move_container` (cell-based legacy) — Stage 8 fate decision
- `inventory_item_compat_v` legacy union removal

## Stage 7.2 — place_container Occupancy Enforcement

Migration: `0045_place_container_location_enforcement.sql`
Closed: 2026-03-17

Maintenance patch applied between Stage 7.1 and Stage 8.
Adds canonical location constraint enforcement to `place_container()` so that
initial rack-backed placement respects the same location rules already enforced
by `move_container_canonical`.

### What changed

- [x] `place_container` now calls `location_can_accept_container(target_location_uuid, container_uuid)` after resolving the target location UUID and before writing any row
- [x] `LOCATION_OCCUPIED` raised and propagated if `capacity_mode = 'single_container'` and a container is already present
- [x] `LOCATION_NOT_ACTIVE` raised and propagated if location `status = 'disabled'`
- [x] No rows written on constraint rejection (no side effects)
- [x] All existing error codes and output shape unchanged (regression-safe)
- [x] BFF `placement-repo.ts`: `mapPlacementRpcError` maps `LOCATION_OCCUPIED` → `LocationOccupiedError`; `LOCATION_NOT_ACTIVE` → `LocationNotActiveError`
- [x] BFF `app.ts`: `mapPlacementError` maps both new error classes to HTTP 409 responses

### Tests added

- [x] OC-1: empty published cell → `action=placed`, active placement row, `current_location_id` set (regression)
- [x] OC-2: occupied `single_container` location → `LOCATION_OCCUPIED`; no `container_placements` row; `current_location_id` still null
- [x] OC-3: disabled location → `LOCATION_NOT_ACTIVE`; no `container_placements` row; `current_location_id` still null

### Deferred (see stage-8-backlog.md)

- `place_container_at_location(uuid, uuid, uuid)` — completed in Stage 7.3 (migration 0046)

## Stage 7.3 — place_container_at_location

Migration: `0046_place_container_at_location.sql`
Closed: 2026-03-17

Adds the first-class RPC for initial container placement into any location UUID,
enabling non-rack operational flows (receive / putaway / staging / dock) that were
previously impossible without privileged direct SQL writes to containers.

### What changed

- [x] `place_container_at_location(container_uuid, location_uuid, actor_uuid)` added as INVOKER function
- [x] `actor_uuid := auth.uid()` override as first executable statement (same pattern as `remove_container`)
- [x] Inline `can_manage_tenant` gate inside `SELECT … FOR UPDATE` on containers
- [x] Explicit tenant check on target location; TENANT_MISMATCH masked as `LOCATION_NOT_FOUND`
- [x] `location_can_accept_container` gate enforces LOCATION_NOT_ACTIVE, LOCATION_OCCUPIED, dimension and weight constraints before any row is written
- [x] Rack-backed locations (`geometry_slot_id IS NOT NULL`): writes `container_placements` projection row in addition to `current_location_id`
- [x] Non-rack locations: writes only `containers.current_location_id`; no `container_placements` row
- [x] `movement_events` legacy record emitted for both cases (`to_cell_id` is null for non-rack)
- [x] Returns `{ action, containerId, locationId, cellId, placementId, occurredAt }` (cellId and placementId are null for non-rack)
- [x] BFF `placement-repo.ts`: `placeContainerAtLocation` method added; maps `LOCATION_NOT_FOUND` → `LocationNotFoundError`
- [x] BFF `errors.ts`: `LocationNotFoundError` added
- [x] BFF `place-container-at-location.ts`: command handler added
- [x] BFF `service.ts`: `placeContainerAtLocation` added to `PlacementCommandService`
- [x] BFF `app.ts`: `POST /api/placement/place-at-location` route added; `LocationNotFoundError` mapped to 404

### Tests added

- [x] PL-1: rack-backed placement → `action=placed`, active `container_placements` row, `current_location_id` set, `movement_event` with `to_cell_id = cell`
- [x] PL-2: non-rack placement → `action=placed`, no `container_placements` row, `current_location_id` set, `movement_event` with `to_cell_id = null`
- [x] PL-3: `CONTAINER_ALREADY_PLACED` — rejected when container already has `current_location_id`
- [x] PL-4: `LOCATION_OCCUPIED` — single_container location already occupied; no side effects
- [x] PL-5: `LOCATION_NOT_ACTIVE` — disabled location; no side effects
- [x] PL-6: `LOCATION_NOT_FOUND` — non-existent UUID; covers cross-tenant oracle masking

## Stage 8B — Execution History Convergence

Migration: `0047_execution_history_convergence.sql`
Closed: 2026-03-17

Promotes `place_container`, `place_container_at_location`, and `remove_container`
to SECURITY DEFINER and adds canonical `stock_movements` writes to all three,
making the full container lifecycle readable from a single history table.

### What changed

- [x] `stock_movements_movement_type_check` constraint extended to include `'place_container'` and `'remove_container'`
- [x] `place_container` → promoted to SECURITY DEFINER; `actor_uuid := auth.uid()` override as first statement; inline `can_manage_tenant` gate inside `SELECT … FOR UPDATE`; `CONTAINER_ALREADY_PLACED` check switched from `container_placements.removed_at IS NULL` to canonical `containers.current_location_id IS NOT NULL` (fixes double-place bug for containers at non-rack locations); writes `stock_movements` row (`movement_type='place_container'`, `source_location=null`, `target_location=location_uuid`, `status='done'`) after placement; retains `movement_events` legacy write (dual-write)
- [x] `place_container_at_location` → promoted from INVOKER to SECURITY DEFINER; all other behaviour from migration 0046 unchanged; writes `stock_movements` row (`movement_type='place_container'`, `source_location=null`, `target_location=location_uuid`, `status='done'`); retains `movement_events` legacy write
- [x] `remove_container` → promoted from INVOKER to SECURITY DEFINER; reads `containers.current_location_id` before clearing it (captures the source for history); writes `stock_movements` row (`movement_type='remove_container'`, `source_location=previous_location_uuid`, `target_location=null`, `status='done'`); retains `movement_events` legacy write (dual-write)
- [x] `REVOKE EXECUTE ON insert_stock_movement FROM public, authenticated` — extended in migration 0044 to revoke from `PUBLIC` (not just `authenticated`), eliminating the inherited-PUBLIC-grant bypass
- [x] No BFF changes needed — stock_movements writes are transparent to the BFF layer

### Tests added

File: `apps/supabase/tests/sql/0047_execution_history_convergence.test.sql`

- [x] EH-1: `place_container` (rack-backed) → `stock_movements` row with `movement_type='place_container'`, `source_location=null`, `target_location=location_a`; `movement_events` compat row still written (dual-write verified)
- [x] EH-2: `place_container_at_location` (rack-backed) → `stock_movements` row with `movement_type='place_container'`, `target_location=location_b`
- [x] EH-3: `place_container_at_location` (non-rack staging) → `stock_movements` row with `movement_type='place_container'`, `target_location=staging_location`
- [x] EH-4: `remove_container` → `stock_movements` row with `movement_type='remove_container'`, `source_location=location_a`, `target_location=null`; `movement_events` compat row still written (dual-write verified)
- [x] EH-5: Full lifecycle (`place_container` → `move_container_canonical` → `remove_container`) yields exactly 3 consecutive `stock_movements` rows; ordering verified (`place` before `move` before `remove`)

### Tests updated (auth retrofit for SECURITY DEFINER promotion)

- [x] `0044_security_hardening.test.sql` — added `set_config('request.jwt.claims', ...)` before 4 `place_container` fixture calls; added `DELETE FROM stock_movements` cleanup before `DELETE FROM inventory_unit` in TS-1, TS-2, SP-2 blocks (FK ON DELETE RESTRICT)
- [x] `0045_place_container_location_enforcement.test.sql` — added full auth setup block (`auth.users` insert + `tenant_members` insert + `set_config` JWT claims) before first `place_container` call

### Deferred (see stage-8-backlog.md)

- `place_container` and `move_container` (cell-based legacy) — Stage 8 fate decision (backlog item 3)
- `inventory_item_compat_v` legacy union removal (backlog item 4)
- Legacy cell-centric BFF route removal (backlog item 5)

## Stage 8C — Canonical Snapshot Cleanup

Migration: `0048_canonical_snapshot_views.sql`
Closed: 2026-03-17

Introduces canonical-only storage snapshot views that read exclusively from
`inventory_unit`, eliminating the legacy compatibility union from trusted read
paths. The old mixed views are retained as compatibility surfaces.

### Audit findings

- `container_storage_snapshot_v` (migration 0036): joins `containers` LEFT JOIN
  `inventory_item_compat_v` — **mixed/compat**: may return legacy-only rows
  (`product_id IS NULL`) for containers with un-migrated `inventory_items`.
- `location_storage_snapshot_v` (migration 0040): joins
  `active_container_locations_v` LEFT JOIN `inventory_item_compat_v` — **same
  issue on the inventory side**; placement side is already canonical (uses
  `containers.current_location_id` since migration 0040).
- `active_container_locations_v` (migration 0040): uses
  `containers.current_location_id` — **canonical**; no change needed.
- `inventory_item_compat_v` (migration 0036): UNION ALL of `inventory_unit`
  (canonical) and `inventory_items_legacy_v` (`product_id IS NULL`). Does not
  expose `lot_code`, `serial_no`, `expiry_date`, or `status` from `inventory_unit`.
- BFF trusted consumers reading the mixed views: `listLocationStorage`,
  `listCellStorage`, `listCellStorageByIds` in `location-read-repo.ts`;
  `GET /api/containers/:containerId/storage` in `app.ts`.

### What changed

- [x] `public.container_storage_canonical_v` added — reads `containers` LEFT JOIN
  `inventory_unit` directly; exposes `lot_code`, `serial_no`, `expiry_date`,
  `inventory_status` in addition to the existing column set; `item_ref`
  synthesised as `'product:' || product_id::text` (null for empty containers)
- [x] `public.location_storage_canonical_v` added — reads
  `active_container_locations_v` LEFT JOIN `inventory_unit` directly; same
  additional fields; placement side is canonical (unchanged from migration 0040)
- [x] Both canonical views granted SELECT to `authenticated`
- [x] `container_storage_snapshot_v` and `location_storage_snapshot_v` kept
  unchanged as mixed/compatibility surfaces; they are no longer the trusted
  source for internal read paths
- [x] `LocationReadRepo.listLocationStorage` repointed to `location_storage_canonical_v`
- [x] `LocationReadRepo.listCellStorage` repointed to `location_storage_canonical_v`
- [x] `LocationReadRepo.listCellStorageByIds` repointed to `location_storage_canonical_v`
- [x] `GET /api/containers/:containerId/storage` repointed to `container_storage_canonical_v`
- [x] No BFF type or API schema changes in this PR: the existing column select
  strings are compatible with the canonical views; new fields (`lot_code`,
  `serial_no`, `expiry_date`, `inventory_status`) are available for future
  consumers to opt into

### Tests added

File: `apps/supabase/tests/sql/0048_canonical_snapshot_views.test.sql`

- [x] T1: `container_storage_canonical_v` returns no row with `item_ref` set for a
  container whose only inventory is a legacy `inventory_items` row
  (`product_id IS NULL`); `container_storage_snapshot_v` (compat) still returns
  the legacy row
- [x] T2: `location_storage_canonical_v` returns no row with `item_ref` set at the
  location where the legacy-only container is placed; compat view still returns
  the legacy row at that location
- [x] T3: both canonical views return correct `product_id`, `quantity`, `uom`,
  `lot_code`, `expiry_date`, and `inventory_status` for a canonical
  `inventory_unit` row
- [x] T4: `container_storage_snapshot_v` and `location_storage_snapshot_v` remain
  functional and unchanged — still return both canonical and legacy rows

### Deferred (see stage-8-backlog.md)

- Exposing `lot_code`, `serial_no`, `expiry_date`, `inventory_status` through BFF
  response schemas and domain types (requires domain schema updates)
- Removing `inventory_item_compat_v` (backlog item 4 — requires production data
  verification that all `inventory_items` rows with `product_id IS NOT NULL` are
  backfilled into `inventory_unit`)
- Removing old mixed snapshot views after all consumers migrate to canonical views

## Stage 8D — Legacy Surface Removal and Gateway Tightening

Closed: 2026-03-17

Executes the Stage 8 removal decisions from `legacy-route-removal-matrix.md` for
the two confirmed-dead legacy routes, removes orphaned dead web code, and adds a
lint gate that prevents new first-party web code from importing cell-based
placement DTOs outside their existing compatibility boundary.

### Audit findings (first-party caller verification)

- `GET /api/cells/:cellId/containers` — `useCellContainers` hook and `listCellContainers` gateway method both dead; no imports found in `apps/web/src` outside the definition files themselves. **Remove confirmed.**
- `GET /api/cells/:cellId/storage` — `useCellStorage` hook and `cellStorageQueryOptions` dead; no imports found. **Remove confirmed.**
- `GET /api/floors/:floorId/cell-occupancy` — `useFloorCellOccupancy` hook dead (no callers); route itself retained due to external integrator risk.
- `GET /api/rack-sections/:sectionId/slots/:slotNo/storage` — active: `cellSlotStorageQueryOptions` used by `useCellSlotStorage` in placement-mode rack inspector. **Keep.**
- `POST /api/containers/:containerId/move` — no first-party web callers (web uses `/api/placement/move`); retained due to external integrator risk.
- `POST /api/placement/place|remove|move` — active first-party callers (`usePlaceContainer`, `useRemoveContainer`, `useMoveContainer`). Not removed; fate decisions documented in removal matrix.

### What changed

- [x] `GET /api/cells/:cellId/containers` route handler removed from `app.ts`
- [x] `GET /api/cells/:cellId/storage` route handler removed from `app.ts`
- [x] `listCellContainers` and `listCellStorage` methods removed from `LegacyExecutionGateway` type and implementation in `legacy-execution-gateway/service.ts`
- [x] `cellContainers` and `cellStorage` entries removed from `LEGACY_ROUTE_METADATA`
- [x] `CellOccupancyRow` and `mapCellOccupancyRowToDomain` imports removed from `legacy-execution-gateway/service.ts` (no longer referenced)
- [x] `cellStorageSnapshotResponseSchema` and `cellOccupancyResponseSchema` imports removed from `app.ts`
- [x] `apps/web/src/entities/cell/api/use-cell-storage.ts` — deleted (dead file, no callers)
- [x] `apps/web/src/entities/cell/api/use-floor-cell-occupancy.ts` — deleted (dead file, no callers)
- [x] `cellStorageQueryOptions`, `floorCellOccupancyQueryOptions`, `fetchCellStorage`, `fetchFloorCellOccupancy` removed from `entities/cell/api/queries.ts`
- [x] `cellKeys.storage` and `cellKeys.occupancyByFloor` removed from `cellKeys` (dead key paths)
- [x] `FloorCellOccupancyRow` import removed from `entities/cell/api/queries.ts`
- [x] Gateway tightening lint rule added to `eslint.config.mjs`: new web code outside `apps/web/src/features/placement-actions/**` cannot import `PlaceContainerRequest`, `RemoveContainerRequest`, `MoveContainerRequest`, `placeContainerRequestSchema`, `removeContainerRequestSchema`, `moveContainerRequestSchema`, `PlacementCommandResponse`, or `placementCommandResponseSchema` from `@wos/domain`
- [x] BFF test file (`app.test.ts`): 3 tests for removed routes deleted ("returns active container occupancy for a cell", "returns resolved storage snapshot for a cell", "returns [] for a valid empty cell storage snapshot")

### Fate decisions documented

- `place_container(cell_uuid, actor_uuid)` — No first-party callers since Stage 9 PR1; BFF route removed in Stage 9 PR2. RPC kept in DB (still called by `POST /api/containers/:id/place` legacy external route)
- `move_container_from_cell(container, src, tgt)` — No first-party callers since Stage 9 PR1; BFF facade route removed in Stage 9 PR2. RPC kept (still called by legacy gateway `moveContainerByCell`)
- `remove_container_if_in_cells(cell_ids[])` — No first-party callers since Stage 9 PR1; BFF facade route removed in Stage 9 PR2. RPC kept (still callable via legacy gateway path)

### Deferred (see stage-8-backlog.md item 5)

- Remove `GET /api/floors/:floorId/cell-occupancy` once external usage confirmed safe
- Remove `POST /api/containers/:containerId/move` once external integrators confirm migration
- Stage 9: web placement migration from cell-based to location-based

## Stage 9 PR1 — Repoint First-Party Placement Callers

Closed: 2026-03-17

Migrates the three active first-party web placement/remove/move hooks from the
cell-based placement façade to canonical execution routes, making the legacy
`/api/placement/place`, `/api/placement/remove`, and `/api/placement/move` routes
dead (no first-party callers).

### Caller inventory (before PR1)

| Hook | File | Route | Body |
|---|---|---|---|
| `usePlaceContainer` | `cell-placement-inspector.tsx` | `POST /api/placement/place` | `{ containerId, targetCellId }` |
| `useRemoveContainer` | `container-placement-inspector.tsx` | `POST /api/placement/remove` | `{ containerId, fromCellId }` |
| `useMoveContainer` | `container-placement-inspector.tsx` | `POST /api/placement/move` | `{ containerId, fromCellId, toCellId }` |

### What changed

- [x] `apps/web/src/features/placement-actions/api/mutations.ts` — all 3 mutation functions rewritten:
  - `placeContainer` → `POST /api/placement/place-at-location` with `{ containerId, locationId }`
  - `removeContainer` → `POST /api/containers/:containerId/remove` (no body; containerId in path)
  - `moveContainer` → `POST /api/containers/:containerId/move-to-location` with `{ targetLocationId }`
  - Legacy domain DTOs (`PlaceContainerRequest`, `RemoveContainerRequest`, `MoveContainerRequest`) removed from imports; replaced with canonical types (`RemoveContainerResult`, `CanonicalMoveContainerResult`)
- [x] `use-place-container.ts` — args changed from `cellSelectionId` to `locationId`
- [x] `use-remove-container.ts` — `sourceCellId` arg dropped (no longer passed to mutation or needed for invalidation)
- [x] `use-move-container.ts` — `targetCellId` arg dropped (caller now provides `targetLocationId` in `mutateAsync`)
- [x] `cell-placement-inspector.tsx` — passes `locationId` (from existing `useLocationByCell(cellId)` query) to `usePlaceContainer` and `mutateAsync`; `!locationId` guard added to `handlePlace` and `handleCreateAndPlace`
- [x] `container-placement-inspector.tsx` — adds `useLocationByCell(targetCellId)` for `targetLocationId`; `useMoveContainer` and `useRemoveContainer` args updated; `mutateAsync` call sites updated; `handleConfirmMove` guards on `!targetLocationId`

### Caller inventory (after PR1)

| Route | First-party web callers |
|---|---|
| `POST /api/placement/place` | **None** |
| `POST /api/placement/remove` | **None** |
| `POST /api/placement/move` | **None** |
| `POST /api/placement/place-at-location` | `usePlaceContainer` |
| `POST /api/containers/:id/remove` | `useRemoveContainer` |
| `POST /api/containers/:id/move-to-location` | `useMoveContainer` |

## Stage 9 PR2 — Remove Cell-Based Placement Facade Routes

Closed: 2026-03-17

Removed the three dead BFF facade routes and all associated dead code surface.

### What was removed

- [x] `POST /api/placement/place` — route handler deleted from `app.ts`
- [x] `POST /api/placement/remove` — route handler deleted from `app.ts`
- [x] `POST /api/placement/move` — route handler deleted from `app.ts`
- [x] `apps/bff/src/features/placement/place-container.ts` — command handler (only caller was `placement/place`)
- [x] `apps/bff/src/features/placement/remove-container.ts` — command handler (only caller was `placement/remove`)
- [x] `apps/bff/src/features/placement/move-container.ts` — command handler (only caller was `placement/move`)
- [x] `apps/bff/src/features/placement/placement-service.test.ts` — unit tests for deleted handlers
- [x] `PlacementCommandService.placeContainer/removeContainer/moveContainer` — removed from service interface and factory
- [x] `PlacementRepo.placeContainer/removeContainerFromCells/moveContainerFromCell/resolveSourceCells` — removed from repo interface and implementation
- [x] `mapPlacementRpcError` trimmed — removed dead cases for cell-based RPC errors
- [x] `mapPlacementError` trimmed in `app.ts` — removed 7 dead branches; kept 4 canonical-relevant ones
- [x] `apps/bff/src/features/placement/errors.ts` — removed 7 cell-based error classes; kept 4 canonical ones
- [x] `packages/domain/src/storage/placement-command.ts` — deleted entirely (`PlaceContainerRequest`, `RemoveContainerRequest`, `MoveContainerRequest`, `PlacementCommandResponse` all gone)
- [x] `packages/domain/src/index.ts` — removed `export * from './storage/placement-command'`
- [x] `apps/bff/src/schemas.ts` — removed `placementPlaceBodySchema`, `placementRemoveBodySchema`, `placementMoveBodySchema`, `placementCommandResponse`; removed dead `@wos/domain` imports
- [x] `eslint.config.mjs` — removed Stage 8D gateway tightening rule (symbols deleted, TS compiler now enforces)
- [x] `app.test.ts` — removed 6 facade route tests

## Stage 9 PR3 — SQL/RPC Wrapper Fate Decision and Compatibility Surface Reduction

Closed: 2026-03-18

Audited all in-scope SQL/RPC wrappers. Tightened the external-facing BFF surface.
No SQL functions were dropped — external caller status is unknown for the dead wrappers
and no log evidence exists to rule out direct Supabase REST access.

**Compatibility-only ≠ supported first-party path.** These surfaces are retained
only because we cannot prove absence of external callers. They carry no maintenance
commitment and are removal targets in Stage 10.

### What changed

- [x] `POST /api/containers/:containerId/place` — now emits `Deprecation: true`, `Warning: 299`, `Link` headers (Stage 9 PR3); registered in `LEGACY_ROUTE_METADATA` as `containerPlaceByCell`; calls `place_container` (cell-based RPC); no first-party callers since Stage 9 PR1
- [x] `apps/bff/src/features/legacy-execution-gateway/service.ts` — `containerPlaceByCell` added to `LEGACY_ROUTE_METADATA`
- [x] `apps/supabase/migrations/0049_deprecate_cell_based_placement_wrappers.sql` — `COMMENT ON FUNCTION` added to three dead SQL wrappers: `remove_container_if_in_cells`, `move_container_from_cell`, `move_container`
- [x] `docs/architecture/legacy-route-removal-matrix.md` — `POST /api/containers/:containerId/place` registered; compatibility-only language sharpened; stale note about `/api/placement/move` removed

### SQL/RPC surface after PR3

**Canonical (supported first-party):**
- `place_container_at_location(container_uuid, location_uuid, actor_uuid)` — `POST /api/placement/place-at-location`
- `remove_container(container_uuid, actor_uuid)` — `POST /api/containers/:id/remove`
- `move_container_canonical(container_uuid, target_location_uuid, actor_uuid)` — `POST /api/containers/:id/move-to-location`

**Compatibility-only (not supported first-party; external risk unknown):**
- `place_container(container_uuid, cell_uuid, actor_uuid)` — active BFF caller (`POST /api/containers/:id/place`, emits deprecation headers); cell-based; removal deferred
- `remove_container_if_in_cells(uuid, uuid[], uuid)` — no BFF caller; SQL deprecation comment added; removal target Stage 10
- `move_container_from_cell(uuid, uuid, uuid, uuid)` — no BFF caller; SQL deprecation comment added; removal target Stage 10
- `move_container(uuid, uuid, uuid)` — no BFF caller; only called by `move_container_from_cell` SQL-internally; SQL deprecation comment added; removal target Stage 10

## Stage 10 PR1 — Usage Evidence Collection and Compatibility Boundary Inventory

Closed: 2026-03-18

Audited all retained compatibility-only BFF routes and SQL/RPC wrappers. Produced the
full evidence inventory. No removals — external caller status remains unknown for all
retained surfaces. This PR closes the SQL deprecation stamp gap (migration 0050) and
corrects documentation inconsistencies carried forward from Stage 6.

### Evidence finding

No runtime log evidence is available in the codebase. The BFF is a Fastify/Node.js server
that emits per-request pino JSON logs to process stdout (not persisted or queryable from
the repository). The Supabase project does not expose function call counts in any tracked
file. All external usage classifications remain **unknown** and must stay that way until an
operational log review is performed.

### Gaps closed

- [x] `apps/supabase/migrations/0050_deprecate_place_container_wrapper.sql` — adds
  `COMMENT ON FUNCTION public.place_container(uuid, uuid, uuid)` with compatibility-only
  language, closing the gap where `place_container` was the only in-scope wrapper without
  a SQL deprecation stamp (0049 covered the three fully-dead wrappers; `place_container`
  was missed because it still has an active, though deprecated, BFF route caller)
- [x] `docs/architecture/api-contract-map.md` — Deprecated Compatibility Endpoints section
  corrected: added `POST /api/containers/:containerId/place`; removed deleted routes
  (`GET /api/cells/:cellId/containers`, `GET /api/cells/:cellId/storage`); removed
  `GET /api/rack-sections/:sectionId/slots/:slotNo/storage` which has an active
  first-party caller and was incorrectly classified as deprecated since Stage 6
- [x] `docs/architecture/legacy-route-removal-matrix.md` — added Evidence Gaps section
  stating exactly what operational check (BFF pino stdout capture, pg_stat_user_functions)
  is required before any retained compatibility route can be promoted to removal

### Compatibility surface after Stage 10 PR1

**Retained BFF routes (compatibility-only; no first-party callers; external risk unknown):**

| Route | Backed by | Deprecation headers | Evidence needed before removal |
|---|---|---|---|
| `GET /api/floors/:id/cell-occupancy` | `location_occupancy_v` via gateway | ✅ | 30-day zero-hit window in BFF pino stdout logs |
| `POST /api/containers/:id/place` | `place_container` SQL (cell-based) | ✅ | 30-day zero-hit window in BFF pino stdout logs |
| `POST /api/containers/:id/move` | `move_container_canonical` via gateway | ✅ | 30-day zero-hit window in BFF pino stdout logs |

**Retained SQL/RPC wrappers (compatibility-only; external risk unknown):**

| Function | `COMMENT ON FUNCTION` | BFF caller | SQL-internal caller | Evidence needed |
|---|---|---|---|---|
| `place_container(uuid, uuid, uuid)` | ✅ migration 0050 | `POST /api/containers/:id/place` (compat) | None | Zero-hit BFF pino log check + pg_stat delta check + BFF route removal |
| `remove_container_if_in_cells(uuid, uuid[], uuid)` | ✅ migration 0049 | None | None | pg_stat_user_functions zero-delta check |
| `move_container_from_cell(uuid, uuid, uuid, uuid)` | ✅ migration 0049 | None | None | pg_stat_user_functions zero-delta check |
| `move_container(uuid, uuid, uuid)` | ✅ migration 0049 | None | `move_container_from_cell` (compat) | Drop after `move_container_from_cell` |

**Removal priority order** (unblocked after evidence collected):
1. `remove_container_if_in_cells` — no dependencies; semantically safest (delegates to canonical `remove_container`)
2. `move_container_from_cell` + `move_container` — drop in tandem (dependency chain)
3. `POST /api/containers/:id/place` + `place_container` — drop in tandem (BFF route must go first)
4. `POST /api/containers/:id/move` — drop independently (SQL is already canonical)
5. `GET /api/floors/:id/cell-occupancy` — drop independently

## Stage 10 PR2 — First Safe Removal and Compat Route Instrumentation

Closed: 2026-03-18

Gathered real usage evidence. Runtime logs are not accessible from the development
environment (BFF pino stdout — capture method deployment-specific, not defined in repo).
Evidence collection was done via exhaustive codebase search.

### Evidence findings

- `remove_container_if_in_cells`: zero callers in entire codebase (code, SQL tests,
  scripts); internal guard logic uses stale `container_placements.removed_at IS NULL`
  (not canonical `containers.current_location_id`); smallest blast radius; dropped.
- `move_container_from_cell` + `move_container`: zero codebase callers; deferred to
  Stage 10 PR3 to validate the pattern before widening.
- `place_container`: blocked by SQL test dependency (0044, 0045, 0047 test files
  call it directly). Cannot drop without SQL test migration.
- All three BFF compat routes: live test coverage in `app.test.ts`; external usage
  unknown; instrumented, not removed.

### What changed

- [x] `apps/supabase/migrations/0051_drop_remove_container_if_in_cells.sql` — REVOKE
  EXECUTE + DROP FUNCTION for `remove_container_if_in_cells(uuid, uuid[], uuid)`.
  First SQL compatibility wrapper confirmed dead and dropped.
- [x] `apps/bff/src/app.ts` — Added `request.log.warn({ compatRoute: '...' })` to
  `GET /api/floors/:id/cell-occupancy`, `POST /api/containers/:id/place`, and
  `POST /api/containers/:id/move`. Enables operational log-drain evidence collection
  by searching for the `compatRoute` JSON field in BFF pino stdout logs.
- [x] `docs/architecture/legacy-route-removal-matrix.md` — Marked
  `remove_container_if_in_cells` as dropped; updated evidence-gap table; added
  instrumentation note.
- [x] `docs/architecture/storage-core-convergence-checklist.md` — This section.

### SQL/RPC surface after Stage 10 PR2

**Canonical (supported first-party):**
- `place_container_at_location(container_uuid, location_uuid, actor_uuid)` — `POST /api/placement/place-at-location`
- `remove_container(container_uuid, actor_uuid)` — `POST /api/containers/:id/remove`
- `move_container_canonical(container_uuid, target_location_uuid, actor_uuid)` — `POST /api/containers/:id/move-to-location`

**Dropped:**
- `remove_container_if_in_cells(uuid, uuid[], uuid)` — ✅ migration 0051
- `move_container_from_cell(uuid, uuid, uuid, uuid)` — ✅ migration 0052 (Stage 10 PR3)
- `move_container(uuid, uuid, uuid)` — ✅ migration 0052 (Stage 10 PR3)

**Compatibility-only (retained; no first-party callers; external risk unknown):**
- `place_container(container_uuid, cell_uuid, actor_uuid)` — active compat BFF caller; SQL test dependency blocks removal; instrumented BFF route emits deprecation headers + warn log

## Stage 10 PR3 — Remove Dead SQL Move-Wrapper Chain

Closed: 2026-03-18

Removed `move_container_from_cell(uuid, uuid, uuid, uuid)` and `move_container(uuid, uuid, uuid)`
together in dependency order (`move_container_from_cell` first, then `move_container`).

### Evidence

- `move_container_from_cell`: zero callers in entire codebase (code, SQL tests, scripts).
  No BFF caller since Stage 9 PR2. No SQL test calls it. Stale placement truth
  (container_placements.removed_at IS NULL, not canonical containers.current_location_id).
- `move_container`: zero BFF/web/script callers. Only caller was `move_container_from_cell`
  (also removed here). SQL test `container_placement_actions.test.sql` called it directly —
  those test cases were removed as part of this PR. The `movement_type = 'move_container'`
  string value in `stock_movements` is unaffected (data value, not a function reference;
  `move_container_canonical` continues writing this movement_type).
- Both had COMMENT ON FUNCTION deprecation stamps from migration 0049.
- Same evidence pattern as `remove_container_if_in_cells` (dropped Stage 10 PR2).

### What changed

- [x] `apps/supabase/migrations/0052_drop_move_container_wrappers.sql` — REVOKE EXECUTE
  + DROP FUNCTION for both `move_container_from_cell` and `move_container`; drops in
  dependency order (caller first, callee second)
- [x] `apps/supabase/tests/sql/container_placement_actions.test.sql` — removed all
  `move_container` test cases (lines 212–293 of original) and their dead fixture setup
  (draft site/floor/layout/rack, move/idle/invalid/same-cell container fixtures); kept
  `place_container` and `remove_container` test coverage intact; reduced slot_count from
  3 to 2 (only 2 cells now needed); added tombstone comment explaining the removal
- [x] `docs/architecture/legacy-route-removal-matrix.md` — marked both functions dropped
  in migration 0052; updated the Cell-based routes table row for `POST /api/placement/move`

### SQL/RPC surface after Stage 10 PR3

**Canonical (supported first-party):**
- `place_container_at_location(container_uuid, location_uuid, actor_uuid)`
- `remove_container(container_uuid, actor_uuid)`
- `move_container_canonical(container_uuid, target_location_uuid, actor_uuid)`

**Dropped (Stages 10 PR2–PR3):**
- `remove_container_if_in_cells` — migration 0051
- `move_container_from_cell` — migration 0052
- `move_container` — migration 0052

**Compatibility-only (one remaining SQL wrapper):**
- `place_container(container_uuid, cell_uuid, actor_uuid)` — **explicit external-only
  compatibility contract** (Stage 10 PR4); called by compat BFF route
  `POST /api/containers/:id/place`; also directly callable via Supabase REST
  `/rest/v1/rpc/place_container`; SQL test dependency blocks removal (see Stage 10 PR4
  section below)

### Operational note — how to collect BFF route evidence

The BFF is a Fastify/Node.js server writing pino JSON to stdout. Search the BFF process
stdout stream (PM2 logs, Docker logs, journald, etc.) for structured log entries with:
```json
{ "compatRoute": "containerPlaceByCell" }
{ "compatRoute": "containerMoveByCell" }
{ "compatRoute": "floorCellOccupancy" }
```
Log level is `warn`. `BFF_LOG_LEVEL` must be `warn` or lower (default `info` satisfies
this). If zero hits over a 30-day window, the corresponding BFF route (and for
`containerPlaceByCell` its SQL RPC, subject to the SQL test pre-condition) can proceed to
removal in a subsequent PR. See `docs/ops/compat-route-evidence-runbook.md` for exact jq
query commands and evidence thresholds.

## Stage 10 PR4 — Fate Decision for the place_container Compatibility Tandem

Closed: 2026-03-18

Evaluated `POST /api/containers/:id/place` and `public.place_container(uuid, uuid, uuid)`
for removal. Removal is not evidence-safe in this PR. Both are retained as an explicit
**external-only compatibility contract**.

### Why removal was not performed

Two independent pre-conditions block removal, and neither is complete:

**Blocker 1 — Operational (log evidence):**
The BFF route emits `request.log.warn({ compatRoute: 'containerPlaceByCell' })` since Stage
10 PR2. The BFF is a Fastify/Node.js server writing pino JSON to stdout; stdout capture is
deployment-specific and not configured in the repository. Runtime evidence is not accessible
from the development environment. External call frequency is unknown.

**Blocker 2 — Engineering (SQL test migration):**
`public.place_container` has **15 direct call sites across 5 SQL test files**:

| Test file | Calls | Role |
|---|---|---|
| `0044_security_hardening.test.sql` | 4 | Fixture setup (places containers for security tests) |
| `0045_place_container_location_enforcement.test.sql` | 3 | Subject under test (tests constraint enforcement on wrapper) |
| `0047_execution_history_convergence.test.sql` | 2 | Mixed: EH-1 tests wrapper; EH-5 uses as fixture |
| `container_placement_actions.test.sql` | 2 | Subject under test (tests action result and movement event) |
| `current_location_pivot.test.sql` | 2 | Fixture setup |
| `stock_movements.test.sql` | 2 | Fixture setup |

This is a different scope from the `move_container` SQL test cleanup in PR3. That was a
single dedicated test block covering only the dropped wrapper. Here, `place_container` is
the **test fixture primitive used across six separate test domains**. Three test files
(`0044`, `current_location_pivot`, `stock_movements`) use it purely as a setup utility; to
remove the function, those would need to switch to `place_container_at_location` (with
location UUID resolution) or direct `UPDATE containers SET current_location_id = ...`
fixture inserts. That is a separate SQL test migration PR with its own scope.

### Governance status after PR4

`POST /api/containers/:id/place` and `public.place_container(...)` are now explicitly
classified as an **external-only compatibility contract**, not merely "deferred pending
evidence." This is a stronger label — it means:

- They carry no first-party caller in the web application
- They are retained solely because (a) external usage cannot be proven absent and
  (b) the SQL test dependency has not yet been cleared
- They confer no supported-path status
- They are removal candidates once BOTH pre-conditions are met

### What changed in PR4

- [x] `docs/architecture/legacy-route-removal-matrix.md` — replaced vague "deferred
  pending log evidence" with explicit two-blocker table; added tandem removal path section;
  split evidence-gap section into per-surface requirement tables

### Removal path (future work)

Step 1 (engineering, separate PR): Migrate all 5 SQL test files from `place_container` to
`place_container_at_location` for rack placements, or direct container fixture inserts
for non-test-subject usage. Delete `0045_place_container_location_enforcement.test.sql`
(exists solely to test the wrapper being dropped).

Step 2 (operational): Verify BFF stdout is captured by the deployment process manager;
collect `containerPlaceByCell` WARN log counts over ≥ 30 days using jq or log platform.
Also run pg_stat delta check on direct `/rest/v1/rpc/place_container` call counts.
See `docs/ops/compat-route-evidence-runbook.md` for exact procedures.

Step 3 (removal PR): Once both pre-conditions are met, remove tandem: delete the BFF route
handler, its BFF unit tests, revoke + drop `public.place_container(uuid, uuid, uuid)`,
update docs.

## Stage 10 PR5 — Operational Evidence Pass

Closed: 2026-03-18

Evidence-only pass across the three remaining compatibility-only BFF routes. No code
changes, no removals.

### Instrumentation confirmed

All three compat routes were verified to emit `WARN`-level structured log entries with the
`compatRoute` field on every hit (`apps/bff/src/app.ts` lines 1172, 1440, 1514). Deprecation
headers are applied by `gateway.applyDeprecationHeaders()` on all three. The instrumentation
introduced in Stage 10 PR2 is correctly in place.

### Stdout capture not confirmed

*(Note: PR5 incorrectly described the BFF as a "Cloudflare Worker" and the gap as "no CF
log drain." Corrected in PR6. The actual runtime is Fastify/Node.js pino stdout.)*

No deployment config exists in the repository indicating where BFF stdout is captured.
Runtime request counts for all three routes are **unknown**.

This is a pre-existing operational gap — not introduced by Stage 10 PRs.

### Route classification after PR5

| Route | Log key | Blockers | Classification |
|---|---|---|---|
| `GET /api/floors/:floorId/cell-occupancy` | `floorCellOccupancy` | Operational only | Retain — verify stdout capture |
| `POST /api/containers/:containerId/move` | `containerMoveByCell` | Operational only | Retain — verify stdout capture |
| `POST /api/containers/:containerId/place` | `containerPlaceByCell` | Operational + SQL test migration | Retain — two-blocker contract |

### Key distinction preserved from PR4

Single-blocker routes (`cell-occupancy`, `move`) and the two-blocker place tandem are
deliberately maintained in separate governance buckets. Verified zero-hit log evidence
would unblock the single-blocker routes independently; it would not unblock the place
tandem without the SQL test migration also being complete.

### Next removal candidate

`GET /api/floors/:floorId/cell-occupancy` — single blocker, no SQL wrapper dependency, no
test file dependency. If log evidence confirms zero hits over ≥ 30 days, this is a
self-contained single-file route removal with no other surfaces to clean up.

### What changed in PR5

- [x] `legacy-route-removal-matrix.md` — added PR5 evidence section; route-by-route table;
  explicit "no drain configured" finding; next removal candidate identified
- [x] `storage-core-convergence-checklist.md` — this section

## Stage 10 PR6 — Observability Enablement and Evidence Collection Runbook

Closed: 2026-03-18

Docs-only PR. No code changes, no removals. Corrects factual errors introduced in
PR2–PR5 and produces the authoritative evidence collection runbook.

### Critical architectural correction

The BFF was incorrectly described as a "Cloudflare Worker" in Stage 10 PR2–PR5.
The actual runtime:

- **Fastify 5 on Node.js** — started via `tsx watch src/server.ts` (dev) or compiled
  Node.js entrypoint (prod). No `wrangler`, no CF Worker SDK, no CF deployment config.
- **Pino JSON to Node.js process stdout** — not a CF-specific log destination.
- **`BFF_LOG_LEVEL` env var** — defaults to `'info'`, which already passes WARN entries
  through (pino: warn=40 > info=30). No `BFF_LOG_LEVEL` change is needed.
- **All three compat route WARN entries are currently emitting in production.**

The gap is not a missing CF drain — it is that stdout capture is deployment-environment-
specific and not verified from this codebase.

### What the repo can control (confirmed complete, no code changes needed)

| Capability | Status |
|---|---|
| `compatRoute` WARN logging on each compat route hit | ✅ Emitting (PR2) |
| `onResponse` INFO logging with `route` field on every request | ✅ Emitting |
| `BFF_LOG_LEVEL` defaulting to `info` (passes WARN through) | ✅ Correct default |
| Deprecation headers on all three routes | ✅ Applied |

### What requires deployment environment action (outside repo)

1. **Verify** BFF stdout is captured and retained by the process manager
2. **Verify** `BFF_LOG_LEVEL` is not `error` in production (would suppress WARN)
3. **Collect** 30-day log sample and query with jq or log platform
4. **Run** pg_stat delta check for `place_container` direct RPC calls

### Runbook

Full step-by-step procedures in `docs/ops/compat-route-evidence-runbook.md`.
Covers: runtime architecture, stdout verification, jq query commands for each route,
Docker/PM2/journald/file variants, pg_stat_user_functions delta query, evidence thresholds,
explicit group separation (single-blocker vs dual-blocker), PR7 evidence record format.

### What changed in PR6

- [x] `docs/ops/compat-route-evidence-runbook.md` — created (new file, new directory)
- [x] `docs/architecture/legacy-route-removal-matrix.md` — corrected "CF Worker" /
  "CF drain" language in Notes, pre-conditions, and tandem removal sections; added Stage
  10 PR6 section; header updated to PR6
- [x] `docs/architecture/storage-core-convergence-checklist.md` — corrected same factual
  errors in PR1–PR5 sections; added this section
- [x] No code changes — instrumentation was already correct

## Completion Gate

Do not call the migration complete until all of the following are true:

- current-state storage truth is location-centered
- inventory is container-bound through `inventory_unit`
- movement is first-class and queryable
- non-rack operational locations are supported
- cell-centric compatibility views are either removed or clearly marked legacy
- docs no longer blur geometry truth with execution truth
