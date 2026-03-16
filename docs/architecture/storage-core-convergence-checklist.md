# Storage Core Convergence Checklist

## Status

Working migration checklist for converging the current storage implementation toward the canonical target model defined in [core-wms-data-model-v1.md](./core-wms-data-model-v1.md).

Snapshot date: `2026-03-16`

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

## Stage 7. Align Naming, Contracts, and Invariants

Goal:

- finish the migration by making docs, APIs, and code speak the same language

Schema checklist:

- [ ] rename or supersede legacy views and RPCs so the public contract reflects the target model
- [ ] confirm that the surviving schema names match `location`, `container_type`, `container`, `inventory_unit`, and `movement`

Domain checklist:

- [ ] export the new canonical storage types from `packages/domain/src/index.ts`
- [ ] remove or clearly deprecate legacy names that would confuse new contributors

BFF checklist:

- [ ] align request and response schemas with the canonical model
- [ ] remove transitional fields once clients no longer depend on them

Web checklist:

- [ ] align entity and feature naming with the target execution vocabulary
- [ ] remove UI language that suggests raw cells are the operational address

Tests and docs:

- [ ] update all architecture docs that still describe storage through cell-centric terms
- [ ] add a clear migration-complete note in `supabase-schema-module-map.md` once the bridge is gone

Exit criteria:

- the repo has one storage vocabulary instead of two competing ones
- a new engineer reading the docs will not be misled about what the system actually executes on

## Completion Gate

Do not call the migration complete until all of the following are true:

- current-state storage truth is location-centered
- inventory is container-bound through `inventory_unit`
- movement is first-class and queryable
- non-rack operational locations are supported
- cell-centric compatibility views are either removed or clearly marked legacy
- docs no longer blur geometry truth with execution truth
