# Supabase Schema Module Map

## Purpose

This document defines the recommended Supabase schema decomposition for `Warehouse Setup + Stock-Aware Directed Picking V1`.

It translates the product and architecture baseline into a concrete backend module map for:

- tables
- key relationships
- state ownership
- staging and publish flows
- SQL views and RPC boundaries

This document complements [architecture-baseline.md](./architecture-baseline.md).

Important scope note:

- this document is still primarily a schema-oriented map of the current or near-term Supabase implementation
- the canonical target storage-core model now lives in [core-wms-data-model-v1.md](./core-wms-data-model-v1.md)
- if this file and the core WMS data model disagree, treat the difference as `current implementation vs target model`, not as an unresolved naming preference

## Design Goals

The schema must optimize for:

1. authoritative published layout truth
2. stable address generation
3. storage truth converging from `Cell -> ContainerPlacement -> Container -> InventoryItem` toward `GeometrySlot -> Location -> Container -> InventoryUnit`
4. staging-first imports with lineage
5. operational readiness derivation
6. pick task generation and execution history
7. auditability and predictable state transitions

The schema must not be optimized around:

- full WMS breadth
- routing graphs
- free-form CAD editing
- live warehouse omniscience
- direct Excel mirroring into operational tables

## Current Implementation vs Target Model

This section exists to prevent one of the most dangerous documentation failures:

- describing the current schema as if it already matches the target WMS core

Right now the repo contains a real implementation and a newer canonical target model.
They are related, but they are not identical.

### Canonical references

- current implementation and storage reads in this repo: this document
- canonical target execution model: [core-wms-data-model-v1.md](./core-wms-data-model-v1.md)
- architectural decision adopting that target: [ADR-007.md](./ADR-007.md)

### Summary

| Concern | Current implementation | Target model | Status |
|---|---|---|---|
| Executable storage anchor | storage reads and new canonical execution flows now pivot around `locations`, but compatibility placement persistence still bridges through `cells` | `locations` become the executable storage entity; geometry slot is only the spatial anchor | partial |
| Geometry to execution relationship | placement points directly to `cells.id` | `geometry_slot -> location -> container -> inventory_unit` | diverged |
| Handling unit model | `containers` already exist | `containers` remain core | aligned |
| Container classification | `container_types` already exist in a minimal form | `container_type` remains core, with dimensional and load semantics becoming first-class | partial |
| Inventory content model | `inventory_items` hold current container content, currently closer to item-ref aggregation | `inventory_unit` becomes the canonical stock unit with lot, serial, expiry, and explicit stock status | partial |
| Movement history | legacy placement lifecycle still exists, but new canonical execution flows now write `stock_movements` with `move_container`, `split_stock`, `transfer_stock`, and `pick_partial` semantics | `movement` becomes a first-class execution journal for receive, putaway, pick, transfer, ship, adjust | partial |
| Non-rack operational locations | `locations` table now exists, but current Stage 1 implementation only backfills published rack slots | `location` supports `rack_slot`, `floor`, `staging`, `dock`, `buffer` | partial |
| Primary execution reads | location-centered views now exist, while `cell_storage_snapshot_v` and `cell_occupancy_v` remain legacy compatibility projections | location-centered read models such as `inventory_by_location_v`, plus container reads | partial |

### What is true today

Today the implemented storage path is effectively:

`GeometrySlot -> Location -> ContainerPlacement -> Container -> InventoryUnit`

This means:

- published cells remain the structural base for compatibility placement persistence
- new canonical execution moves now accept `location` as input and bridge to geometry only internally
- storage reads are now routed through location-backed compatibility views
- Stage 1 now also persists first-class `locations` for published rack slots
- canonical product-backed stock lives in `inventory_unit`
- new canonical execution history lives in `stock_movements`

### What the target model says

The target v1 storage core is:

`GeometrySlot -> Location -> Container -> InventoryUnit`

with:

- `Location` as the executable storage point
- `Container` as the handling unit
- `InventoryUnit` as the stock unit inside the container
- `Movement` as the execution log

### Practical rule for engineers

When reading this file:

- use it to understand what the current Supabase schema actually does
- do not assume every table here matches the canonical future execution model
- if designing new storage behavior, validate it against `core-wms-data-model-v1.md` before extending the current cell-centric schema

### Migration implication

Until the schema is converged:

- `container_placements` remain the current placement write truth in the repo
- canonical product-backed stock now lives in `inventory_unit`, while `inventory_items` remains compatibility debt
- `cells` remain the structural base for current placement features
- `locations` are now the introduced execution entity for published rack slots, but not yet the primary write target
- new work should avoid deepening the assumption that `cell = executable location`

### Convergence plan

The repo should not jump from the current schema to the target model in one rewrite.
The safer path is a staged convergence that preserves current placement behavior while introducing the execution model that future WMS workflows need.

Detailed migration checklist:

- see [storage-core-convergence-checklist.md](./storage-core-convergence-checklist.md) for the concrete tables, views, RPCs, code modules, tests, and completion gates per stage

#### Stage 1. Introduce executable `locations`

Add a first-class `locations` table without deleting or renaming the current placement path.

Target outcome:

- every executable rack slot gets a `location` row
- non-rack operational addresses such as `staging`, `dock`, `buffer`, and `floor` become first-class
- `locations.geometry_slot_id` becomes the bridge from geometry to execution

Current status:

- baseline implemented: `locations` exists, published rack slots are backfilled, and compatibility placement still runs through `cells`

Constraint:

- do not treat `locations` as a denormalized alias for `cells`; it must become the execution entity with its own lifecycle and constraints

#### Stage 2. Dual-read bridge from cells to locations

Keep current placement features working, but introduce read models that can resolve a placement through `location`.

Target outcome:

- existing placement flows can still resolve visible storage state
- new reads and APIs can ask for `location`-centered truth
- the system can support a temporary `cell -> location` compatibility bridge during migration

Current status:

- implemented for read models: `location_*` views are target-facing, while `cell_*` views remain legacy projections over the same bridge layer

Constraint:

- all new execution-facing code should prefer `location_id` over direct `cell_id` assumptions where feasible

#### Stage 3. Promote `inventory_items` into `inventory_unit`

Evolve inventory content from the current item-centric shape into a canonical stock unit bound to a container.

Target outcome:

- each stock row belongs to `container_id`
- lot, serial, expiry, and stock status become first-class fields
- inventory location is derived through the container, not stored as a parallel source of truth

Constraint:

- do not create a second direct `product -> cell` or `product -> location` execution path

Current status:

- baseline implemented: canonical `inventory_unit` now exists, product-backed legacy inventory is backfilled and synchronized, and public inventory APIs remain compatibility-stable

#### Stage 4. Introduce first-class `movement`

Add an execution journal that records how stock and containers move through the warehouse.

Target outcome:

- receive, putaway, transfer, pick, ship, and adjust become explicit movement records
- container moves and partial product moves are both representable
- placement changes stop being the only recoverable evidence of execution history

Constraint:

- movement must be an execution log, not a replacement for current-state tables

Current status:

- implemented for new canonical flows: `stock_movements` now records `move_container`, `split_stock`, `transfer_stock`, and `pick_partial`
- `move_container_canonical` now accepts `target_location_uuid`, not `target_cell_uuid`
- current physical placement persistence still bridges through `locations.geometry_slot_id -> cells.id`
- full fit, capacity, and weight enforcement remains deferred to Stage 5

#### Stage 5. Move operational APIs onto the target model

Shift write paths and read paths from cell-centric internals to location-centered execution semantics.

Target outcome:

- `receive`, `move`, `pick`, and `ship` APIs validate against `location`
- fit and capacity rules execute against `location` constraints
- warehouse operations can target non-rack locations without schema workarounds

Constraint:

- draft and published layout flows must remain geometry concerns; operational execution must not depend on draft-only structures

#### Stage 6. Retire cell-centric execution assumptions

Once the bridge is stable, remove the idea that published `cells` are themselves the executable storage truth.

Target outcome:

- `location` becomes the only execution anchor
- `container_placements` becomes either a compatibility layer or is reduced to a geometry-facing concern
- read models and invariants stop encoding `cell = storage location`

Constraint:

- deprecation should happen only after location-based reads, writes, and movement history are all production-safe

#### Stage 7. Clean up naming and invariants

After convergence, align schema names, views, RPCs, and docs with the target model.

Target outcome:

- docs, SQL, and API names consistently use `location`, `inventory_unit`, and `movement`
- invariants are enforced in one model instead of split across legacy and target terms
- product and UX language can map to a stable execution vocabulary

Constraint:

- do not rename current tables early if that creates false confidence about implementation completeness

## Schema Modules

Recommended module split inside `public` schema:

1. identity and tenancy
2. warehouse layout
3. storage truth
4. product master and operational roles
5. imports and lineage
6. stock snapshots
7. orders and readiness
8. picking execution
9. audit and events
10. views and RPC

## 1. Identity and Tenancy Module

### Tables

#### `profiles`

Purpose:

- app profile linked to `auth.users`

Key fields:

- `id uuid pk` references `auth.users.id`
- `email text`
- `display_name text`
- `role text`
- `created_at timestamptz`
- `updated_at timestamptz`

Notes:

- use app-specific roles like `admin`, `operator`, `picker`
- keep authorization logic simple in V1

#### `sites`

Purpose:

- top-level warehouse site container

Key fields:

- `id uuid pk`
- `code text unique`
- `name text`
- `timezone text`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `floors`

Purpose:

- physical floor or hall under a site

Key fields:

- `id uuid pk`
- `site_id uuid fk -> sites.id`
- `code text`
- `name text`
- `sort_order int`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(site_id, code)`

## 2. Warehouse Layout Module

This module holds layout truth.

### Core rule

- only one `published` layout version should be active per floor at a time
- draft changes happen in draft versions only
- published versions are immutable for normal editing

### Tables

#### `layout_versions`

Purpose:

- version container for all layout objects of a floor

Key fields:

- `id uuid pk`
- `floor_id uuid fk -> floors.id`
- `version_no int`
- `state text check in ('draft','published','archived')`
- `parent_published_version_id uuid null fk -> layout_versions.id`
- `created_by uuid fk -> profiles.id`
- `published_by uuid null fk -> profiles.id`
- `published_at timestamptz null`
- `archived_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(floor_id, version_no)`
- partial unique index for one published version per floor
- partial unique index for at most one active draft per floor if that is the product rule

#### `racks`

Purpose:

- top-level spatial object on the canvas

Key fields:

- `id uuid pk`
- `layout_version_id uuid fk -> layout_versions.id`
- `display_code text`
- `kind text check in ('single','paired')`
- `axis text check in ('NS','WE')`
- `x numeric`
- `y numeric`
- `total_length numeric`
- `depth numeric`
- `rotation_deg int`
- `state text check in ('draft','configured','published')`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(layout_version_id, display_code)`
- rotation limited to `0, 90, 180, 270`

Notes:

- `state='published'` is a denormalized convenience state aligned with published layout, not an independent publish workflow

#### `rack_faces`

Purpose:

- per-rack face configuration

Key fields:

- `id uuid pk`
- `rack_id uuid fk -> racks.id`
- `side text check in ('A','B')`
- `enabled boolean`
- `slot_numbering_direction text check in ('ltr','rtl')`
- `mirror_source_face_id uuid null fk -> rack_faces.id`
- `is_mirrored boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(rack_id, side)`

Notes:

- if `is_mirrored = true`, face structure is logically linked to source face
- do not treat mirroring as a UI-only concern

#### `rack_sections`

Purpose:

- first-class sections per face

Key fields:

- `id uuid pk`
- `rack_face_id uuid fk -> rack_faces.id`
- `ordinal int`
- `length numeric`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(rack_face_id, ordinal)`
- positive `length`

#### `rack_levels`

Purpose:

- levels inside a section, bottom-to-top

Key fields:

- `id uuid pk`
- `rack_section_id uuid fk -> rack_sections.id`
- `ordinal int`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(rack_section_id, ordinal)`
- ordinals start from 1 and represent bottom-to-top semantics

#### `cells`

Purpose:

- canonical addressable units generated by the system

Key fields:

- `id uuid pk`
- `layout_version_id uuid fk -> layout_versions.id`
- `rack_id uuid fk -> racks.id`
- `rack_face_id uuid fk -> rack_faces.id`
- `rack_section_id uuid fk -> rack_sections.id`
- `rack_level_id uuid fk -> rack_levels.id`
- `slot_no int`
- `address text`
- `address_sort_key text`
- `x numeric null`
- `y numeric null`
- `status text default 'active'`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(layout_version_id, address)`
- unique `(rack_level_id, slot_no)`

Notes:

- `address` is generated, never user-entered
- `address_sort_key` helps stable task ordering and UI sorting
- `x/y` here are optional logical coordinates for future overlays, not required for V1

### Layout helper tables

#### `layout_publish_reviews`

Purpose:

- stores destructive publish review results when publish cannot proceed cleanly

Key fields:

- `id uuid pk`
- `layout_version_id uuid fk -> layout_versions.id`
- `status text check in ('pending','approved','rejected')`
- `summary jsonb`
- `created_by uuid fk -> profiles.id`
- `reviewed_by uuid null fk -> profiles.id`
- `created_at timestamptz`
- `reviewed_at timestamptz null`

Use only if admin-review workflow must persist formally in V1.

## 3. Storage Truth Module

This module holds physical storage truth semantics.

Important note:

- this section below describes the current implemented or near-term schema shape
- it should now be read together with the `Current Implementation vs Target Model` section above
- Stage 3 means stock truth is now split intentionally:
  - canonical product-backed stock lives in `inventory_unit`
  - `inventory_items` remains a legacy compatibility surface for old reads and unmigrated free-text rows
- it is not the final canonical storage-core design

### Core rule

The schema must currently encode:

`Cell -> ContainerPlacement -> Container -> InventoryUnit`

with a temporary compatibility layer that still exposes legacy `InventoryItem`-shaped reads.

### Tables

#### `container_types`

Purpose:

- normalized reference set for physical container kinds

Key fields:

- `id uuid pk`
- `code text unique`
- `description text`

Recommended initial values:

- `pallet`
- `carton`
- `tote`
- `bin`

#### `containers`

Purpose:

- physical storage unit such as pallet, tote, carton, bin, or unnamed container id

Key fields:

- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `external_code text null`
- `container_type_id uuid fk -> container_types.id`
- `status text check in ('active','quarantined','closed','lost','damaged')`
- `created_by uuid null fk -> profiles.id`
- `created_at timestamptz`

Constraints:

- unique nullable `(tenant_id, external_code)` if scannable external IDs exist
- container exists independently of placement

#### `container_placements`

Purpose:

- place a container into a cell

Key fields:

- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `container_id uuid fk -> containers.id`
- `cell_id uuid fk -> cells.id`
- `placed_at timestamptz`
- `removed_at timestamptz null`
- `placed_by uuid null fk -> profiles.id`
- `removed_by uuid null fk -> profiles.id`

Constraints:

- active placement = `removed_at is null`
- at most one active placement per container
- placement only in published cells

Notes:

- multiple containers in the same cell are allowed
- placement is physical relationship, not role mapping

#### `inventory_items`

Purpose:

- current inventory content inside a container

Key fields:

- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `container_id uuid fk -> containers.id`
- `item_ref text`
- `quantity numeric`
- `uom text`
- `created_at timestamptz`
- `created_by uuid null fk -> profiles.id`

Constraints:

- quantity >= 0
- unique `(container_id, item_ref, uom)`

Notes:

- current-content truth only, not an event ledger
- inventory belongs to containers, never directly to cells
- cell content answers are derived later through active placement joins
- Stage 3: this table is now a frozen compatibility surface for legacy and free-text rows, not the preferred canonical stock model

#### `inventory_unit`

Purpose:

- canonical product-backed stock unit inside a container

Key fields:

- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `container_id uuid fk -> containers.id`
- `product_id uuid fk -> products.id`
- `legacy_inventory_item_id uuid null fk -> inventory_items.id`
- `quantity numeric`
- `uom text`
- `lot_code text null`
- `serial_no text null`
- `expiry_date date null`
- `status text check in ('available','reserved','damaged','hold')`
- `created_at timestamptz`
- `updated_at timestamptz`
- `created_by uuid null fk -> profiles.id`

Constraints:

- quantity >= 0
- `serial_no` uniqueness when present
- no uniqueness on `(container_id, product_id)` so partial-pick and lot-split evolution stays possible

Notes:

- Stage 3 canonical stock truth lives here
- inventory location is derived through container placement / active location, not duplicated on the stock row
- legacy compatibility reads may still project this data back into `InventoryItem`-shaped rows
- Stage 4 adds `updated_by` and `source_inventory_unit_id` so canonical split lineage is explicit

#### `stock_movements`

Purpose:

- canonical execution history for new movement flows

Key fields:

- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `movement_type text check in ('receive','putaway','move_container','split_stock','transfer_stock','pick_partial','ship','adjust')`
- `source_location_id uuid null fk -> locations.id`
- `target_location_id uuid null fk -> locations.id`
- `source_container_id uuid null fk -> containers.id`
- `target_container_id uuid null fk -> containers.id`
- `source_inventory_unit_id uuid null fk -> inventory_unit.id`
- `target_inventory_unit_id uuid null fk -> inventory_unit.id`
- `quantity numeric null`
- `uom text null`
- `status text check in ('pending','done','cancelled')`
- `created_at timestamptz`
- `completed_at timestamptz null`
- `created_by uuid null fk -> profiles.id`

Notes:

- Stage 4 canonical execution history lives here
- `product_id` is intentionally not duplicated on the movement row
- product identity is derived through referenced `inventory_unit` rows
- legacy `movement_events` still exists as compatibility debt for older placement flows

## 4. Product Master and Operational Role Module

### Tables

#### `products`

Purpose:

- canonical product master

Key fields:

- `id uuid pk`
- `sku text unique`
- `name text`
- `barcode text null`
- `status text check in ('active','inactive')`
- `meta jsonb default '{}'::jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `product_location_roles`

Purpose:

- operational role assignment for a product to a cell

Key fields:

- `id uuid pk`
- `product_id uuid fk -> products.id`
- `cell_id uuid fk -> cells.id`
- `role text check in ('primary_pick','reserve')`
- `state text check in ('draft','published','inactive')`
- `layout_version_id uuid fk -> layout_versions.id`
- `effective_from timestamptz null`
- `effective_to timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- business rules should prevent conflicting duplicate active role assignments where required

Notes:

- this is an operational mapping layer
- this is not the same thing as physical placement truth
- tie the role to the layout version to keep mapping semantics stable across layout evolution

## 5. Imports and Lineage Module

### Core rule

Raw imports never write directly into operational truth tables.

### Tables

#### `import_jobs`

Purpose:

- top-level lifecycle of an import

Key fields:

- `id uuid pk`
- `domain text check in ('product_master','product_location','stock_snapshot','orders')`
- `state text check in ('uploaded','parsing','parsed','validated','preview_ready','published','failed')`
- `source_file_name text`
- `storage_path text`
- `uploaded_by uuid fk -> profiles.id`
- `uploaded_at timestamptz`
- `published_at timestamptz null`
- `error_summary jsonb null`
- `stats jsonb default '{}'::jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `import_job_files`

Purpose:

- optional file metadata if one job can reference multiple sheets/files later

Key fields:

- `id uuid pk`
- `import_job_id uuid fk -> import_jobs.id`
- `source_file_name text`
- `sheet_name text null`
- `storage_path text`
- `created_at timestamptz`

Optional in V1 if one job always equals one file.

#### `import_rows_staging`

Purpose:

- generic raw or normalized staging rows with lineage

Key fields:

- `id uuid pk`
- `import_job_id uuid fk -> import_jobs.id`
- `domain text`
- `source_file_name text`
- `source_sheet_name text null`
- `source_row_number int`
- `raw_payload jsonb`
- `normalized_payload jsonb null`
- `validation_errors jsonb default '[]'::jsonb`
- `status text check in ('staged','normalized','valid','invalid','published')`
- `created_at timestamptz`
- `updated_at timestamptz`

Notes:

- generic staging keeps V1 simpler
- if domains become too large later, split staging per domain

## 6. Stock Snapshot Module

### Tables

#### `stock_snapshots`

Purpose:

- top-level published snapshot identity

Key fields:

- `id uuid pk`
- `import_job_id uuid fk -> import_jobs.id`
- `state text check in ('draft','published','superseded')`
- `snapshot_date date`
- `published_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- only one active published stock snapshot at a time if this matches product rule

#### `stock_snapshot_lines`

Purpose:

- normalized published stock lines from the imported source

Key fields:

- `id uuid pk`
- `stock_snapshot_id uuid fk -> stock_snapshots.id`
- `product_id uuid fk -> products.id`
- `cell_id uuid null fk -> cells.id`
- `container_id uuid null fk -> containers.id`
- `quantity numeric`
- `import_job_id uuid fk -> import_jobs.id`
- `source_file_name text`
- `source_sheet_name text null`
- `source_row_number int`
- `created_at timestamptz`

Notes:

- keep lineage on the published line itself
- if source only knows SKU and address, normalization resolves them to product and cell

## 7. Orders and Readiness Module

### Tables

#### `orders`

Purpose:

- operational order header

Key fields:

- `id uuid pk`
- `external_order_ref text`
- `state text check in ('imported','ready','blocked','in_progress','completed','exception')`
- `import_job_id uuid fk -> import_jobs.id`
- `ordered_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique nullable `external_order_ref` if applicable

#### `order_lines`

Purpose:

- SKU demand lines inside an order

Key fields:

- `id uuid pk`
- `order_id uuid fk -> orders.id`
- `product_id uuid null fk -> products.id`
- `sku text`
- `requested_qty numeric`
- `resolved_primary_pick_cell_id uuid null fk -> cells.id`
- `readiness_status text check in ('ready','blocked','shortage','exception')`
- `readiness_reason_code text null`
- `readiness_details jsonb default '{}'::jsonb`
- `import_job_id uuid fk -> import_jobs.id`
- `source_file_name text`
- `source_sheet_name text null`
- `source_row_number int`
- `created_at timestamptz`
- `updated_at timestamptz`

Notes:

- keep `sku` from source for auditability even after `product_id` resolution
- `resolved_primary_pick_cell_id` is a derived operational target, not storage truth

### Optional helper table

#### `order_line_resolution_runs`

Purpose:

- snapshot of readiness calculation batches if you need explicit rerun history

Optional in V1.

## 8. Picking Execution Module

### Tables

#### `pick_tasks`

Purpose:

- executable picking group generated from ready lines

Key fields:

- `id uuid pk`
- `task_code text unique`
- `state text check in ('ready','in_progress','completed','exception')`
- `assigned_to uuid null fk -> profiles.id`
- `started_at timestamptz null`
- `completed_at timestamptz null`
- `created_by uuid fk -> profiles.id`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `pick_items`

Purpose:

- atomic SKU confirmation units inside a pick task

Key fields:

- `id uuid pk`
- `pick_task_id uuid fk -> pick_tasks.id`
- `order_line_id uuid fk -> order_lines.id`
- `product_id uuid fk -> products.id`
- `cell_id uuid fk -> cells.id`
- `sequence_no int`
- `requested_qty numeric`
- `confirmed_qty numeric default 0`
- `state text check in ('pending','current','confirmed','skipped','short','missing','damaged')`
- `same_cell_continuation boolean default false`
- `started_at timestamptz null`
- `resolved_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(pick_task_id, sequence_no)`

Critical rule:

- one pick item is one SKU confirmation step
- repeated same-cell items remain separate rows

#### `pick_item_events`

Purpose:

- event log for item execution actions

Key fields:

- `id uuid pk`
- `pick_item_id uuid fk -> pick_items.id`
- `event_type text check in ('set_current','confirmed','skipped','short','missing','damaged')`
- `actor_id uuid fk -> profiles.id`
- `payload jsonb default '{}'::jsonb`
- `created_at timestamptz`

## 9. Audit and Event Module

### Tables

#### `operation_events`

Purpose:

- general audit/event stream for major operational actions

Key fields:

- `id uuid pk`
- `event_type text`
- `entity_type text`
- `entity_id uuid`
- `actor_id uuid null fk -> profiles.id`
- `payload jsonb default '{}'::jsonb`
- `created_at timestamptz`

Use for:

- layout published
- import published
- task generated
- picker exceptions

## 10. Views Module

Views should expose derived operational read models. They must not replace source-of-truth tables.

### Recommended views

#### `active_container_locations_v`

Purpose:

- canonical active execution read for container placements resolved through executable locations

Possible columns:

- `tenant_id`
- `floor_id`
- `location_id`
- `location_code`
- `location_type`
- `capacity_mode`
- `location_status`
- `cell_id`
- `container_id`
- `external_code`
- `container_type`
- `container_status`
- `placed_at`

Notes:

- derived from active `container_placements` joined to `locations`
- target-facing Stage 2 bridge view

#### `location_occupancy_v`

Purpose:

- current physical container occupancy by executable location

Possible columns:

- `tenant_id`
- `floor_id`
- `location_id`
- `location_code`
- `location_type`
- `cell_id`
- `container_id`
- `external_code`
- `container_type`
- `container_status`
- `placed_at`

Notes:

- target-facing occupancy view for future location-native reads
- `cell_id` remains only as a compatibility bridge to geometry

#### `location_storage_snapshot_v`

Purpose:

- inspection-grade current physical contents of an executable location, including container contents

Possible columns:

- `tenant_id`
- `floor_id`
- `location_id`
- `location_code`
- `location_type`
- `cell_id`
- `container_id`
- `external_code`
- `container_type`
- `container_status`
- `placed_at`
- `item_ref`
- `quantity`
- `uom`

Notes:

- target-facing Stage 2 storage snapshot view
- Stage 3: product-backed inventory content now resolves from canonical `inventory_unit`, with legacy free-text rows projected through a compatibility layer
- Stage 4: this remains a current-state read; execution history is now tracked separately in `stock_movements`
- legacy cell storage should project from this view instead of owning its own execution logic

#### `cell_occupancy_v`

Purpose:

- legacy compatibility projection of current occupancy by cell

Possible columns:

- `tenant_id`
- `cell_id`
- `container_id`
- `external_code`
- `container_type`
- `container_status`
- `placed_at`

Notes:

- derived from `location_occupancy_v`
- maintained for compatibility with current `/cells/*` and floor/slot read contracts

#### `container_storage_snapshot_v`

Purpose:

- inspection-grade current contents of a container

Possible columns:

- `tenant_id`
- `container_id`
- `external_code`
- `container_type`
- `container_status`
- `item_ref`
- `quantity`
- `uom`

Notes:

- derived from `containers + inventory_unit`, with compatibility projection for legacy free-text-only rows
- empty containers may appear with null content columns
- no readiness, reservation, or picking semantics belong here

#### `stock_movements_v`

Purpose:

- optional direct read model for canonical execution history if operations UI or integrations need it later

Notes:

- Stage 4 does not require a dedicated view yet because canonical SQL functions write directly to `stock_movements`

#### `cell_storage_snapshot_v`

Purpose:

- legacy compatibility projection of current physical contents of a cell, including container contents

Possible columns:

- `tenant_id`
- `cell_id`
- `container_id`
- `external_code`
- `container_type`
- `container_status`
- `placed_at`
- `item_ref`
- `quantity`
- `uom`

Notes:

- derived from `location_storage_snapshot_v`
- empty placed containers may appear with null content columns
- maintained only to avoid breaking current public contracts during the bridge phase

#### `v_layout_publish_impact`

Purpose:

- summarize address additions, removals, and mapping impacts between draft and published versions

#### `v_product_role_quantities`

Purpose:

- derived quantities by product and role

Possible columns:

- `product_id`
- `primary_qty`
- `reserve_qty`
- `total_qty`
- `pick_available_qty`
- `replenishable_qty`

#### `v_order_line_readiness`

Purpose:

- normalized readiness read model for UI and operations

Possible columns:

- `order_line_id`
- `order_id`
- `product_id`
- `readiness_status`
- `resolved_cell_id`
- `readiness_reason_code`
- `available_qty`

#### `v_pick_task_progress`

Purpose:

- task progress and unresolved issue summary

## 11. RPC / SQL Function Module

Use SQL functions or RPC for domain actions that must be transactional and auditable.

### Recommended RPC boundaries

#### `create_layout_draft(floor_id uuid, actor_id uuid)`

Responsibility:

- create a new draft from latest published layout or as first version

#### `validate_layout_version(layout_version_id uuid)`

Responsibility:

- run structural and addressing validation
- return errors, warnings, and publish blockers

#### `publish_layout_version(layout_version_id uuid, actor_id uuid)`

Responsibility:

- validate
- compute publish impact
- block or publish transactionally
- mark previous published version as archived if needed by policy

#### `publish_import_job(import_job_id uuid, actor_id uuid)`

Responsibility:

- move validated staged rows into domain-specific operational tables
- mark job state transition atomically

#### `place_container(container_id uuid, cell_id uuid, actor_id uuid)`

Responsibility:

- place an unplaced container into a published cell atomically
- fail if the container already has an active placement

#### `remove_container(container_id uuid, actor_id uuid)`

Responsibility:

- close the active placement timeline row atomically
- preserve placement history via `removed_at` / `removed_by`

#### `move_container(container_id uuid, target_cell_id uuid, actor_id uuid)`

Responsibility:

- move a currently placed container atomically
- close the current active placement and open the new placement in one transaction
- fail explicitly on same-cell moves instead of creating fake history

#### `move_container_canonical(container_id uuid, target_location_id uuid, actor_id uuid)`

Responsibility:

- accept `location` as the execution-facing target
- bridge internally to `geometry_slot_id -> cell_id` while current placement persistence remains cell-backed
- reject non-writable locations and occupied target locations in Stage 4
- write canonical `stock_movements(type='move_container')`

#### `split_inventory_unit(source_inventory_unit_id uuid, quantity numeric, target_container_id uuid, actor_id uuid)`

Responsibility:

- apply controlled partial-stock split semantics
- reject serial splits and full-row relocation
- auto-merge only exact-match non-serial target rows
- write canonical `stock_movements(type='split_stock')`

#### `transfer_inventory_unit(source_inventory_unit_id uuid, quantity numeric, target_container_id uuid, actor_id uuid)`

Responsibility:

- split stock into a target container
- preserve source and target execution identity
- write canonical `split_stock` plus `transfer_stock`

#### `pick_partial_inventory_unit(source_inventory_unit_id uuid, quantity numeric, pick_container_id uuid, actor_id uuid)`

Responsibility:

- model partial pick as a canonical stock split into a pick container
- keep pick semantics separate from generic transfer semantics
- write canonical `split_stock` plus `pick_partial`

#### `resolve_order_readiness(import_job_id uuid or order_batch_id uuid)`

Responsibility:

- resolve order lines against products, roles, cells, and stock conditions

#### `generate_pick_tasks(actor_id uuid, filters jsonb)`

Responsibility:

- create tasks and pick items from ready order lines in one transaction

#### `advance_pick_item(pick_item_id uuid, action text, actor_id uuid, payload jsonb)`

Responsibility:

- apply confirm/skip/short/missing/damaged with state transition and event logging

## 12. Recommended Migration Sequence

Suggested migration breakdown:

1. `0001_init_extensions.sql`
2. `0002_profiles_sites_floors.sql`
3. `0003_layout_versions.sql`
4. `0004_racks_faces_sections_levels_cells.sql`
5. `0005_layout_publish_helpers.sql`
6. `0006_products.sql`
7. `0007_product_location_roles.sql`
8. `0008_containers_placements_inventory.sql`
9. `0009_import_jobs_and_staging.sql`
10. `0010_stock_snapshots.sql`
11. `0011_orders_and_order_lines.sql`
12. `0012_pick_tasks_and_items.sql`
13. `0013_operation_events.sql`
14. `0014_views.sql`
15. `0015_rpc.sql`
16. `0016_rls.sql`

## 13. Foreign Key and Versioning Rules

### Layout versioning rules

- all layout-owned objects must belong to a `layout_version_id`
- `cells` must always be version-scoped
- product role assignments should also be version-aware to avoid broken layout coupling

### Storage rules

- physical storage points to `cells.id`
- if a layout version is superseded, operational handling must define whether old cells remain referentially valid for historical records

Recommended approach:

- historical records continue to point to historical `cells.id`
- active operational logic resolves only against cells in the active published layout where required

## 14. Deletion and History Rules

Prefer soft state transitions over destructive deletes for operational tables.

### Hard delete acceptable

- invalid draft-only objects before publish, if safe

### Soft-state preferred

- layout versions
- role mappings
- stock snapshots
- pick tasks
- pick items
- placements

Reason:

- operational auditability matters more than perfect table cleanliness

## 15. RLS Guidance

RLS should be enabled for all business tables.

### V1 principle

Keep policies role-simple:

- admin: full write access
- operator: read/write for operations they manage
- picker: limited read/write for assigned tasks and related pick items

Do not overcomplicate row ownership in V1.

## 16. What Must Not Be Modeled Incorrectly

The schema must not drift into these mistakes:

- `sku -> cell` as the storage truth
- direct writes from raw import parser into operational tables
- layout publish as mutable in-place edits
- merge of multiple same-cell SKUs into one pick confirmation row
- product-location role treated as physical placement truth
- canvas geometry fields treated as structural rack truth

## 17. Minimal V1 Operational Data Path

Canonical flow through the schema:

1. create `site` and `floor`
2. create `layout_version(draft)`
3. create `racks`, `rack_faces`, `rack_sections`, `rack_levels`
4. generate `cells`
5. validate and publish layout
6. import and publish `products`
7. import and publish `product_location_roles`
8. import and publish `stock_snapshot`
9. import and publish `orders`
10. resolve `order_lines` readiness
11. generate `pick_tasks` and `pick_items`
12. execute picking and log `pick_item_events`
13. surface operator status via views

## 18. Backend Ownership Summary

### Source-of-truth tables

- `layout_versions`
- `racks`
- `rack_faces`
- `rack_sections`
- `rack_levels`
- `cells`
- `products`
- `product_location_roles`
- `container_types`
- `containers`
- `container_placements`
- `inventory_items` (legacy compatibility surface)
- `inventory_unit` (canonical product-backed stock truth)
- `stock_movements` (canonical execution history for Stage 4+ execution flows)
- `stock_snapshots`
- `stock_snapshot_lines`
- `orders`
- `order_lines`
- `pick_tasks`
- `pick_items`

### Staging tables

- `import_jobs`
- `import_rows_staging`
- optional `import_job_files`

### Derived views

- `v_layout_publish_impact`
- `v_product_role_quantities`
- `v_order_line_readiness`
- `v_pick_task_progress`
- optional `stock_movements_v`

### RPC actions

- create draft
- validate layout
- publish layout
- publish import
- move container canonically
- split stock canonically
- transfer stock canonically
- pick stock canonically
- resolve readiness
- generate tasks
- advance pick item

## 19. Supabase Types Boundary Reminder

Generated Supabase row types must remain inside API boundaries.

Frontend and domain layers must consume mapped domain types, not raw table row shapes.

This schema map is therefore a database contract, not a UI typing strategy.
