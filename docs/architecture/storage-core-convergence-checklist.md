# Storage Core Convergence Checklist

## Status

Working migration checklist for converging the current storage implementation toward the canonical target model defined in [core-wms-data-model-v1.md](./core-wms-data-model-v1.md).

Snapshot date: `2026-03-15`

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

Schema checklist:

- [ ] introduce `inventory_unit` shape with `product_id`, `container_id`, `quantity`, `uom`, `lot_code`, `serial_no`, `expiry_date`, and `status`
- [ ] backfill existing `inventory_items` into the new shape or evolve the table in place with a documented compatibility strategy
- [ ] ensure inventory location is derived through `container.current_location_id` or equivalent location-backed state, not duplicated as a second truth

Domain checklist:

- [ ] add `inventory-unit` domain model
- [ ] deprecate `inventory-item` naming from storage-core concepts
- [ ] preserve a clean distinction between product master and stock instance

BFF checklist:

- [ ] update `inventory-product-resolution.ts` and related mappers to consume the new stock-unit shape
- [ ] update validation rules for lot, serial, expiry, and per-unit status

Web checklist:

- [ ] update `container-inventory` and `inventory-add` flows to stop treating inventory as a loose product attachment
- [ ] ensure container views show stock contents as inventory units, not ambiguous item rows

Tests and docs:

- [ ] add tests for multiple inventory units per container
- [ ] add tests for lot/serial/expiry constraints if enabled by product tracking mode

Exit criteria:

- stock is represented as container-bound execution units
- the repo no longer encourages `product -> cell` mental models

## Stage 4. Introduce First-Class `movement`

Goal:

- make execution history explicit instead of inferring it from placement side effects

Schema checklist:

- [ ] add `movement` table or converge `movement_events` into the canonical shape
- [ ] support `receive`, `putaway`, `pick`, `replenishment`, `transfer`, `ship`, and `adjust`
- [ ] support both container movement and partial product movement
- [ ] capture `from_location_id`, `to_location_id`, `container_id`, `product_id`, quantity, status, and timestamps

Domain checklist:

- [ ] add `movement` domain model and movement-type enum
- [ ] separate current-state aggregates from movement log semantics

BFF checklist:

- [ ] add movement write paths for receive, move, pick, and ship
- [ ] stop treating placement row mutation as sufficient execution history

Web checklist:

- [ ] prepare operations screens and placement feedback to reference movement outcomes
- [ ] do not expose fake “history” derived only from current placement state

Tests and docs:

- [ ] verify container move, partial pick, and ship each produce movement records
- [ ] document status model: `pending`, `done`, `cancelled`

Exit criteria:

- the system can answer “what moved, when, and from where to where” without reconstructing state from ad hoc joins

## Stage 5. Move Operational APIs Onto the Target Model

Goal:

- shift the write path from cell-centric placement operations to location-centered execution semantics

Schema checklist:

- [ ] add or update RPCs so operational writes validate against `location`
- [ ] enforce single-container capacity, disabled-location rejection, dimensional fit, and weight fit at execution boundaries

Domain checklist:

- [ ] move core execution validations into location-aware storage rules
- [ ] keep geometry validation separate from storage execution validation

BFF checklist:

- [ ] evolve placement service into a broader location-execution service or add a new service boundary beside it
- [ ] make `move-container` validate source and destination as executable locations
- [ ] add `receive`, `putaway`, `pick`, and `ship` endpoints or commands on top of the target model

Web checklist:

- [ ] stop binding all operational actions to cell-only selectors
- [ ] introduce UI concepts for non-rack locations where needed
- [ ] ensure placement inspectors can display executable location identity and constraints

Tests and docs:

- [ ] add end-to-end tests for receive, putaway, transfer, partial pick, and ship
- [ ] update API docs to expose location-centered contracts

Exit criteria:

- operational commands use `location` as the execution target
- rack slots are just one category of location, not the only possible one

## Stage 6. Retire Cell-Centric Execution Assumptions

Goal:

- remove the dangerous idea that geometry objects are themselves execution truth

Schema checklist:

- [ ] mark legacy cell-centric views as deprecated
- [ ] reduce `container_placements` to a compatibility or geometry-linked concern if it still exists
- [ ] ensure current container location can be resolved without treating `cell_id` as the primary execution key

Domain checklist:

- [ ] remove storage-core naming that implies cells own inventory
- [ ] keep cell logic only where geometry and visualization need it

BFF checklist:

- [ ] remove new code paths that depend on direct `cell_id` execution writes
- [ ] collapse bridge logic once all consumers use `location`

Web checklist:

- [ ] reduce `entities/cell` to geometry-facing concerns plus temporary compatibility reads
- [ ] move storage-oriented reads toward location-aware entities when the UI model is ready

Tests and docs:

- [ ] remove or rewrite tests that encode `cell = executable location`
- [ ] explicitly document which legacy APIs are removed or frozen

Exit criteria:

- the execution model no longer depends conceptually on published cells
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
