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

## Design Goals

The schema must optimize for:

1. authoritative published layout truth
2. stable address generation
3. storage truth based on `Cell -> Container -> InventoryItem`
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

### Core rule

The schema must encode:

`Cell -> Container -> InventoryItem`

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

- product quantity inside a container

Key fields:

- `id uuid pk`
- `container_id uuid fk -> containers.id`
- `product_id uuid fk -> products.id`
- `quantity numeric`
- `uom text null`
- `lot_no text null`
- `expires_at timestamptz null`
- `state text check in ('active','consumed','adjusted')`
- `source_import_job_id uuid null fk -> import_jobs.id`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- quantity >= 0

Notes:

- if operational deltas are later added, they should be reflected here or through event-derived projections

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
- `inventory_items`
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

### RPC actions

- create draft
- validate layout
- publish layout
- publish import
- resolve readiness
- generate tasks
- advance pick item

## 19. Supabase Types Boundary Reminder

Generated Supabase row types must remain inside API boundaries.

Frontend and domain layers must consume mapped domain types, not raw table row shapes.

This schema map is therefore a database contract, not a UI typing strategy.
