# OPS MS Project Dossier

## 1. Product identity

OPS MS is currently a warehouse-operations product centered on warehouse setup, spatial layout, storage execution truth, product/package semantics, and read-only picking-planning previews. The README describes the repo as `Warehouse Setup + Stock-Aware Directed Picking V1`, with warehouse/floor setup, rack configuration, cell address generation, draft/publish layout lifecycle, products, operations pages, and Canvas-based picking-plan preview and route review (`README.md`; `docs/ARCHITECTURE.md`).

It is not a generic full WMS, ERP replacement, or routing platform. The architecture baseline explicitly says the system is not a full WMS, not an ERP replacement, and not a routing platform; it is warehouse setup, stock-aware operational readiness, and directed picking execution (`docs/architecture/architecture-baseline.md`). The current code has moved beyond a pure setup tool because it includes location/container/inventory/movement APIs, canonical storage views, picking execution routes, and planning-preview endpoints (`docs/API.md`; `apps/bff/src/app.ts`; `apps/supabase/migrations/0034_locations.sql`; `apps/supabase/migrations/0036_inventory_unit.sql`; `apps/supabase/migrations/0040_current_location_pivot_and_location_constraints.sql`; `apps/supabase/migrations/0048_canonical_snapshot_views.sql`).

Best current classification: OPS MS is a spatial warehouse operations/control foundation with WMS-like execution primitives and a Canvas-centered picking planner. It is closer to a spatial WMS plus operations planning surface than to a standalone WES, ERP, slotting engine, or simulation product. Advanced routing, graph optimization, multi-picker balancing, and full analytics/control tower are either explicitly out of current scope or not confirmed as implemented (`docs/architecture/architecture-baseline.md`; `docs/architecture/picking-routing.md`).

## 2. Repository structure

| Area | Path | Responsibility | Notes |
|---|---|---|---|
| Root workspace | `package.json` | npm workspaces and Turborepo commands | Workspaces are `apps/*` and `packages/*`; commands include `lint`, `typecheck`, `test`, `test:e2e`, and `gen:types`. |
| Instructions | `AGENTS.md` | Repo rules and done criteria | Requires small changes, public contract preservation, validation commands, storage-preset quantity correctness, and docs alignment. |
| Frontend | `apps/web` | React/Vite app, warehouse editor, product/operations pages, Canvas, BFF client | Uses React 19, Vite, Tailwind, TanStack Query, Zustand, React Konva (`apps/web/package.json`). |
| BFF | `apps/bff` | Fastify API layer, auth/workspace resolution, service/repo orchestration, DTO mapping | `buildApp()` registers health, sites, floors, layout, containers, locations, products, storage presets, orders, waves, picking, and planning routes (`apps/bff/src/app.ts`). |
| Supabase | `apps/supabase` | Local DB, migrations, SQL RPC/functions/views/tests | Migrations span layout lifecycle, storage convergence, products/packaging, orders/waves/picking, storage presets, and route/access foundations (`apps/supabase/migrations`). |
| Shared domain | `packages/domain` | Zod schemas, enums, pure domain logic, planning pipeline | Contains layout, storage, catalog, warehouse, and operations modules (`packages/domain/src/index.ts`; `packages/domain/package.json`). |
| Architecture docs | `docs/`, `docs/architecture`, `docs/decisions` | Architecture baseline, domain model, API/database/testing guides, ADRs | Includes key rules for spatial/execution separation, packaging hierarchy, storage presets, and Canvas planning entrypoint. |

## 3. Current architecture

The main runtime flow is: user action -> React UI -> BFF API client -> Fastify routes -> services/repos -> Supabase tables/RPC/views -> BFF DTO -> UI (`docs/ARCHITECTURE.md`).

Frontend ownership: `apps/web` owns presentation, navigation, editor/canvas interaction state, API-query hooks, and UI composition. It should render canonical values received from BFF/DB, not compute storage truth. The architecture docs put presentation rules in `apps/web`, server state in TanStack Query, UI/editor state in Zustand, and generated Supabase row types inside API boundaries (`docs/ARCHITECTURE.md`; `docs/architecture/system-overview.md`; `docs/architecture/architecture-baseline.md`). Current evidence includes frontend BFF client code under `apps/web/src/shared/api/bff`, entity API hooks under `apps/web/src/entities/*/api`, and Canvas/editor code under `apps/web/src/warehouse/editor`.

BFF ownership: `apps/bff` authenticates Supabase bearer tokens, resolves current tenant context, exposes REST endpoints, validates DTOs with Zod, maps rows into domain response shapes, handles stable error responses, and orchestrates service/repo calls. `buildApp()` wires route groups and request logging/error handling (`apps/bff/src/app.ts`; `apps/bff/src/auth.ts`; `apps/bff/src/errors.ts`; `apps/bff/src/route-deps.ts`; `apps/bff/src/schemas.ts`).

Database ownership: `apps/supabase` owns schema, migrations, RLS, constraints, views, and transactional RPC/functions. Architecture docs identify DB views/functions as canonical inventory/storage calculation sources, and migrations implement layout lifecycle, location synchronization, inventory-unit truth, canonical movement, storage views, storage presets, and picking execution (`docs/ARCHITECTURE.md`; `docs/DATABASE.md`; `apps/supabase/migrations`).

Shared domain ownership: `packages/domain` owns framework-agnostic schemas, enums, and pure logic: rack/cell/addressing, layout validation, storage snapshots/rules, catalog/product packaging contracts, order/wave/picking types, and the pure picking-planning pipeline (`packages/domain/src/layout`; `packages/domain/src/storage`; `packages/domain/src/catalog`; `packages/domain/src/operations`).

Tests: domain and BFF use Vitest; web uses Vitest plus Playwright; Supabase has SQL test scripts. The testing guide documents lint/typecheck/test order and E2E smoke/critical ladders (`docs/TESTING.md`; `apps/web/e2e`; `apps/supabase/tests/sql`).

## 4. Core domain model

| Entity | Meaning | Source of truth | Evidence | Notes / risks |
|---|---|---|---|---|
| Site | Tenant-scoped warehouse/site container. | DB `sites`, BFF site routes, domain schema. | `packages/domain/src/warehouse/site.ts`; `apps/bff/src/routes/sites.routes.ts`; `apps/supabase/migrations/0002_profiles_sites_floors.sql`. | Used for floor hierarchy and tenant boundary. |
| Floor | Warehouse floor/workspace under a site. | DB `floors`, BFF floor/workspace endpoints. | `packages/domain/src/warehouse/floor.ts`; `packages/domain/src/warehouse/floor-workspace.ts`; `apps/bff/src/routes/floors.routes.ts`. | Floor is publish concurrency boundary in later layout migrations (`0112`, `0114`). |
| LayoutVersion | Draft/published/archived layout state for a floor. | DB `layout_versions`; RPC lifecycle; domain schema. | `packages/domain/src/layout/layout-version.ts`; `apps/supabase/migrations/0003_layout_versions.sql`; `0006_layout_validation_and_publish.sql`; `0007_layout_draft_lifecycle.sql`. | Published layout is spatial truth; edits happen through drafts. |
| Rack | Physical rack geometry and structural container for faces/sections/levels. | DB rack tables and domain rack schema. | `packages/domain/src/layout/rack.ts`; `apps/supabase/migrations/0004_racks_faces_sections_levels_cells.sql`; `apps/web/src/warehouse/editor/ui/rack-layer.tsx`. | Face A/B can differ; mirrored/independent face modes exist. |
| Cell / GeometrySlot | Generated spatial slot/address within published layout. | DB `cells`; generated by publish; domain cell schema. | `packages/domain/src/layout/cell.ts`; `apps/supabase/migrations/0004_racks_faces_sections_levels_cells.sql`; `0006_layout_validation_and_publish.sql`. | Cell is spatial/address anchor, not execution truth. |
| Location | Executable storage point, optionally linked to a geometry slot. | DB `locations`, BFF location reads/mutations, domain location schema. | `packages/domain/src/storage/location.ts`; `apps/supabase/migrations/0034_locations.sql`; `apps/bff/src/routes/location-read.routes.ts`. | `rack_slot` must reference published geometry; non-rack locations may have no geometry. |
| ContainerType | Reference type for physical handling units. | DB `container_types`; BFF container type route; domain schema. | `packages/domain/src/storage/container.ts`; `apps/bff/src/routes/container-read.routes.ts`; `apps/supabase/migrations/0018_container_registry.sql`; `0040_current_location_pivot_and_location_constraints.sql`. | Supports storage/picking capability flags and fit dimensions. |
| Container | Concrete physical handling unit; inventory lives inside it. | DB `containers`; `current_location_id` current-state truth; BFF service/routes. | `packages/domain/src/storage/container.ts`; `apps/supabase/migrations/0018_container_registry.sql`; `0040_current_location_pivot_and_location_constraints.sql`; `apps/bff/src/routes/container-read.routes.ts`. | Current location may be null for unplaced/in-transit states; active placed state derives from `current_location_id`. |
| InventoryUnit | Accounted stock content in a container. | DB `inventory_unit`; canonical views; domain schema. | `packages/domain/src/storage/inventory-unit.ts`; `apps/supabase/migrations/0036_inventory_unit.sql`; `0088_inventory_unit_packaging_truth.sql`; `apps/bff/src/routes/container-mutations.routes.ts`. | Inventory never lives directly in cell/location. Packaging metadata is validated in DB. |
| Movement | Execution/history record for container or inventory movement. | DB `stock_movements`; RPC functions; domain stock movement schema. | `packages/domain/src/storage/stock-movement.ts`; `apps/supabase/migrations/0039_stock_movements_and_execution_semantics.sql`; `0047_execution_history_convergence.sql`; `docs/DATABASE.md`. | General audit/event history exists partially; full event-sourced analytics is not confirmed. |
| Product / SKU | Product catalog/master row with source/external ID, SKU, name, assets. | DB `products`; BFF product routes; domain product schema. | `packages/domain/src/catalog/product.ts`; `apps/supabase/migrations/0027_products_catalog.sql`; `apps/bff/src/features/products/routes.ts`. | Products do not appear tenant-scoped in current schema; BFF planning restricts catalog reads from tenant-visible order lines (`docs/architecture/picking-routing.md`). |
| Packaging level | Product UOM/package level with base-unit quantity and pick/store flags. | DB `product_packaging_levels`; domain/BFF validation. | `packages/domain/src/catalog/product-packaging-level.ts`; `apps/supabase/migrations/0086_product_packaging_levels.sql`; `0087_replace_product_packaging_levels_rpc.sql`; `apps/bff/src/features/products/packaging-validation.ts`. | Hierarchy must be cumulative; direct naive `contains` math is invalid. |
| Storage preset | Backend-canonical storage profile based on `packaging_profiles.profile_type='storage'`. | DB `packaging_profiles`/`packaging_profile_levels`, BFF storage-presets service/routes, domain schema. | `packages/domain/src/catalog/storage-preset.ts`; `apps/supabase/migrations/0102_storage_preset_semantics.sql`; `0103_storage_preset_materialization.sql`; `apps/bff/src/routes/storage-presets.routes.ts`; `docs/decisions/ADR-0002-storage-presets.md`. | No separate storage preset table; materialization can be shell/materialized/partial failed. |
| Order | Customer/fulfillment order with lines and lifecycle. | DB `orders`/`order_lines`, BFF order service/routes, domain operation schema. | `packages/domain/src/operations/order.ts`; `apps/supabase/migrations/0030_orders.sql`; `0083_order_reservations.sql`; `apps/bff/src/features/orders/routes.ts`. | Planning preview reads orders but does not allocate or persist plans. |
| Wave | Grouping/status surface for orders. | DB `waves` and `orders.wave_id`; BFF wave routes/service. | `packages/domain/src/operations/wave.ts`; `apps/supabase/migrations/0033_waves.sql`; `0067_order_wave_membership_rpcs.sql`; `apps/bff/src/features/waves/routes.ts`; `docs/architecture/picking-routing.md`. | Current wave membership contract is `orders.wave_id -> waves.id`. |
| Pick task | Execution unit for picking. | DB `pick_tasks`; BFF picking routes/service; domain schema. | `packages/domain/src/operations/pick-task.ts`; `apps/supabase/migrations/0031_pick_tasks.sql`; `0075_allocate_pick_steps.sql`; `apps/bff/src/routes/picking-execution.routes.ts`. | Execution exists, while advanced acceptance from preview is not confirmed. |
| Pick step | Per-step picking execution row. | DB `pick_steps`; allocation/execution RPCs; BFF routes. | `apps/supabase/migrations/0074_pick_execution_schema.sql`; `0075_allocate_pick_steps.sql`; `0076_execute_pick_step.sql`; `0106_pick_steps_source_location_foundation.sql`; `apps/bff/src/routes/picking-execution.routes.ts`. | `source_location_id` foundation moves picking toward location-first execution. |
| Picking work package | Preview-only planned work container before execution persistence. | Pure domain planning pipeline and BFF preview response. | `packages/domain/src/operations/picking-planning.ts`; `work-package-planner.ts`; `work-split-service.ts`; `picking-planning-pipeline.ts`; `apps/bff/src/features/picking-planning/service.ts`. | Not persisted and not tied to execution task creation yet. |
| Route step | Deterministic planned step sequence over a work package. | Domain `RouteStep`; frontend route geometry overlay. | `packages/domain/src/operations/route-sequencer.ts`; `apps/web/src/features/picking-planning-canvas/model/route-step-geometry.ts`; `apps/web/src/features/picking-planning-canvas/ui/picking-route-overlay-layer.tsx`. | Distance mode falls back to hybrid; graph routing is not implemented. |

## 5. Spatial truth

A layout is the floor's spatial structure: racks, faces, sections, levels, slots/cells, zones, and walls. It is versioned by `layout_versions` and edited as draft before being published (`packages/domain/src/layout/layout-draft.ts`; `packages/domain/src/layout/layout-version.ts`; `apps/supabase/migrations/0003_layout_versions.sql`; `0004_racks_faces_sections_levels_cells.sql`; `0080_layout_zones.sql`; `0081_layout_walls.sql`).

Draft vs published: layout changes happen only in a draft. Published layout is immutable for normal editing and is the authoritative spatial truth. Publishing validates the draft, regenerates cells, archives the previous published version, marks the draft published, and updates rack state (`docs/architecture/architecture-baseline.md`; `apps/supabase/migrations/0006_layout_validation_and_publish.sql`; `apps/bff/src/routes/layout-mutations.routes.ts`).

A rack is a spatial/structural object with display code, kind (`single`/`paired`), axis, x/y position, total length, depth, rotation, and faces. A face has side A/B, enabled state, slot numbering direction, mirrored/independent relationship, optional face length, and sections. Sections have length and levels; levels have ordinal and slot count (`packages/domain/src/layout/rack.ts`; `apps/supabase/migrations/0004_racks_faces_sections_levels_cells.sql`; `docs/architecture/layout-mode-rack-face-domain-model.md`).

A cell/geometry slot is generated from rack code, face, section, level, and slot number. Address format is fixed as `03-A.02.03.04` style, generated by the system, not manually authored. Domain functions `buildCellAddress`, `parseCellAddress`, and `buildPreviewCellKey` encode this (`packages/domain/src/layout/cell.ts`; `apps/supabase/migrations/0006_layout_validation_and_publish.sql`; `docs/architecture/architecture-baseline.md`).

Published layout means: a validated `layout_versions.state='published'` version whose generated cells become the active spatial address set. Published cells are then synchronized into executable `locations` as `rack_slot` locations through location-sync functions/triggers (`apps/supabase/migrations/0034_locations.sql`; `0037_sync_published_cells_to_locations.sql`; `0053_fix_publish_location_sync.sql`; `0112_publish_layout_destructive_location_guard.sql`; `0114_publish_layout_explicit_rename_mappings.sql`).

What must never be treated as execution/inventory truth: racks, cells, geometry slots, canvas coordinates, and preview cell keys. Evidence: architecture rules say slot is not execution truth, location is not geometry, and inventory does not live directly in a slot (`docs/architecture/core-wms-data-model-v1.md`; `docs/architecture/architecture-baseline.md`). Domain `location.ts` states a location is the executable storage entity and geometry slots remain spatial truth.

## 6. Execution truth

Execution truth answers what physically exists in storage now, where it is located now, and what moved. The canonical model is `GeometrySlot -> Location -> Container -> InventoryUnit`, with movement history in `stock_movements` (`docs/architecture/core-wms-data-model-v1.md`; `docs/architecture/architecture-baseline.md`; `packages/domain/src/storage/stock-movement.ts`).

`Location` is the executable storage entity. It has `locationType` (`rack_slot`, `floor`, `staging`, `dock`, `buffer`), optional `geometrySlotId`, `capacityMode`, status, dimensions/weight limit, sequencing/access metadata, and optional coordinates for non-rack locations (`packages/domain/src/storage/location.ts`; `apps/supabase/migrations/0034_locations.sql`; `0107_locations_route_access_foundation.sql`; `0108_pick_aisles_face_access_foundation.sql`).

`Container` is the physical handling unit. It has type, status, operational role (`storage` or `pick`), optional parent, packaging profile metadata, and current location state. DB migration `0040` adds `containers.current_location_id` and related indexes/functions; canonical movement functions update that field (`packages/domain/src/storage/container.ts`; `apps/supabase/migrations/0040_current_location_pivot_and_location_constraints.sql`; `0101_swap_containers_canonical.sql`; `apps/bff/src/features/execution/service.ts`).

`InventoryUnit` is the stock content inside a container. It carries product, quantity, UOM, lot/serial/expiry, status, packaging state, package level, pack count, and source inventory unit. It is created by `receive_inventory_unit`, split/transferred/picked by execution RPCs, and exposed by canonical storage views (`packages/domain/src/storage/inventory-unit.ts`; `apps/supabase/migrations/0036_inventory_unit.sql`; `0068_receive_inventory_unit_rpc.sql`; `0088_inventory_unit_packaging_truth.sql`; `0091_pr3_canonical_split_ownership.sql`; `0092_pr4_execute_pick_full_canonical_ownership.sql`).

Inventory actually lives in `inventory_unit` rows tied to `container_id`; location is derived through the container's `current_location_id` and canonical views such as `location_storage_canonical_v` (`apps/supabase/migrations/0036_inventory_unit.sql`; `0048_canonical_snapshot_views.sql`; `packages/domain/src/storage/location-storage-snapshot.ts`).

Location relates to geometry through `locations.geometry_slot_id`. For `rack_slot`, it must reference a published geometry slot; for non-rack locations, it must be null (`apps/supabase/migrations/0034_locations.sql`; `packages/domain/src/storage/location.ts`). Location is therefore linked to geometry but not identical to geometry.

`Container.currentLocationId` behavior: the domain exposes current location through `containerCurrentLocationSchema`; BFF exposes `GET /api/containers/:containerId/location`; canonical DB movement functions treat `containers.current_location_id` as current-state placement truth and use older `container_placements` only as projection/compatibility where needed (`packages/domain/src/storage/container-current-location.ts`; `apps/bff/src/routes/container-read.routes.ts`; `apps/supabase/migrations/0040_current_location_pivot_and_location_constraints.sql`; `0048_canonical_snapshot_views.sql`; `docs/architecture/core-wms-data-model-v1.md`).

Execution invariants supported by repository evidence:

- Inventory belongs to containers, not slots (`packages/domain/src/storage/inventory-unit.ts`; `apps/supabase/migrations/0036_inventory_unit.sql`; `docs/architecture/core-wms-data-model-v1.md`).
- `rack_slot` locations reference published cells; non-rack locations do not (`apps/supabase/migrations/0034_locations.sql`).
- Single-container locations reject occupancy conflicts; inactive/draft/disabled locations are not canonical write targets (`apps/supabase/migrations/0040_current_location_pivot_and_location_constraints.sql`; `packages/domain/src/storage/location-rules.ts`).
- Fit validation treats unknown required dimension/weight data as failure when a location enforces that limit (`apps/supabase/migrations/0040_current_location_pivot_and_location_constraints.sql`; `packages/domain/src/storage/location-rules.ts`).

## 7. Inventory and storage rules

Packaging hierarchy is cumulative. ADR-0001 states parent quantity equals child quantity multiplied by the quantity-per-parent link, and gives the hard example `box=2`, `master=4 boxes` -> `master=8 base units`. `AGENTS.md` and `docs/TESTING.md` repeat this as a non-negotiable regression case (`AGENTS.md`; `docs/decisions/ADR-0001-packaging-hierarchy.md`; `docs/TESTING.md`).

Product model: `products` stores source, external product ID, SKU, name, permalink/assets, active flag, and timestamps (`packages/domain/src/catalog/product.ts`; `apps/supabase/migrations/0027_products_catalog.sql`; `apps/bff/src/features/products/routes.ts`). Product unit profile stores base-unit physical metadata (`unitWeightG`, dimensions, weight/size classes) (`packages/domain/src/catalog/product-unit-profile.ts`; `apps/supabase/migrations/0085_product_unit_profiles.sql`).

Packaging levels: `product_packaging_levels` have `baseUnitQty`, `isBase`, `canPick`, `canStore`, default pick UOM, barcode, package dimensions/weight, sort order, and active status (`packages/domain/src/catalog/product-packaging-level.ts`; `apps/supabase/migrations/0086_product_packaging_levels.sql`). BFF product routes support get/put/post/patch/delete packaging levels and atomic full replace (`apps/bff/src/features/products/routes.ts`).

Storage presets: ADR-0002 says presets are backend-canonical; UI cannot bypass backend resolution. Migration `0102` explicitly implements storage presets as `packaging_profiles` with `profile_type='storage'`, not a parallel table, and `create_container_from_storage_preset` as the write path (`docs/decisions/ADR-0002-storage-presets.md`; `apps/supabase/migrations/0102_storage_preset_semantics.sql`; `apps/bff/src/routes/storage-presets.routes.ts`).

Preferred presets and policies: `sku_location_policies.preferred_packaging_profile_id` drives preferred status in canonical storage views; BFF exposes `PUT /api/locations/:locationId/sku-policies/:productId/storage-preset` (`apps/supabase/migrations/0102_storage_preset_semantics.sql`; `apps/bff/src/routes/storage-presets.routes.ts`; `packages/domain/src/storage/location-policy.ts`).

Materialized contents vs shell containers: `createContainerFromStoragePresetResultSchema` returns `materializationMode`, `materializationStatus`, optional materialization error fields, and optional materialized `inventoryUnitId`/`containerLineId`/quantity. Migration `0103` adds storage-preset materialization, and `0111` fixes multi-pack materialization (`packages/domain/src/catalog/storage-preset.ts`; `apps/supabase/migrations/0103_storage_preset_materialization.sql`; `0111_fix_multi_pack_storage_preset_materialization.sql`; `apps/web/e2e/storage-presets-partial-failed.spec.ts`).

Move/transfer/split/pick semantics present in code:

- `POST /api/containers/:containerId/move-to-location` calls canonical execution service (`apps/bff/src/routes/container-movement.routes.ts`; `apps/bff/src/features/execution/service.ts`).
- `POST /api/containers/:containerId/swap` calls `swapContainersCanonical` (`apps/bff/src/routes/container-movement.routes.ts`; `apps/supabase/migrations/0101_swap_containers_canonical.sql`).
- `POST /api/inventory/:inventoryUnitId/transfer` and `/pick-partial` call execution service over canonical inventory units (`apps/bff/src/routes/inventory-movement.routes.ts`; `apps/supabase/migrations/0091_pr3_canonical_split_ownership.sql`; `0092_pr4_execute_pick_full_canonical_ownership.sql`).

Known quantity risks: the repo repeatedly warns that frontend/manual math is unsafe for storage quantities and that nested package resolution must be tested (`AGENTS.md`; `docs/decisions/ADR-0001-packaging-hierarchy.md`; `docs/decisions/ADR-0002-storage-presets.md`; `docs/TESTING.md`). External audits should treat this as a hard architecture constraint, not a recommendation.

## 8. Picking planning model

Current picking planning is preview-oriented and read-only. The pure domain pipeline composes `PickTaskCandidate[]` plus strategy/location projections into `WorkPackageDraft`, split results, route steps, warnings, and metadata through `planPickingWork()` (`packages/domain/src/operations/picking-planning.ts`; `work-package-planner.ts`; `work-split-service.ts`; `route-sequencer.ts`; `picking-planning-pipeline.ts`).

The planning pipeline vocabulary is: Order/Wave/Line -> PickingStrategy -> PickTaskCandidate -> WorkPackage -> WorkSplitPolicy -> RouteSequencer -> RouteStep -> Picker Execution UI (`docs/architecture/picking-routing.md`). BFF preview service exposes:

- `POST /api/picking-planning/preview` for explicit task input.
- `POST /api/picking-planning/preview/orders` for read-only order-derived planning input.
- `POST /api/picking-planning/preview/wave` for wave-derived preview.

Evidence: `apps/bff/src/features/picking-planning/routes.ts`; `apps/bff/src/features/picking-planning/service.ts`; `apps/bff/src/features/picking-planning/input-builder.ts`; `apps/bff/src/features/picking-planning/response-mapper.ts`.

Order/wave planning flow: order and wave preview builders read order lines, product metadata, product-location roles, available inventory in containers at active locations, unresolved lines, coverage diagnostics, and route projections. They do not release orders/waves, allocate inventory, create pick tasks/steps, or persist planning output (`docs/architecture/picking-routing.md`; `apps/bff/src/features/picking-planning/input-builder.ts`; `apps/bff/src/features/picking-planning/diagnostics.ts`; `apps/bff/src/features/picking-planning/service.ts`).

Task/step/work package concepts:

- `PickTaskCandidate` uses executable `fromLocationId = locations.id` and order references (`packages/domain/src/operations/picking-planning.ts`).
- `WorkPackage` groups tasks and carries method, picker/zone/cart assignment fields, estimated distance/time/complexity (`packages/domain/src/operations/picking-planning.ts`; `work-package-planner.ts`).
- `RouteStep` sequences a task with `fromLocationId`, SKU, qty, allocations, and optional handling instruction (`packages/domain/src/operations/picking-planning.ts`; `route-sequencer.ts`).

Route sequencing concepts: modes include `location_sequence`, `address_sequence`, `handling`, `hybrid`, and `distance`. Distance mode currently falls back to hybrid with a structured warning; true graph routing is not implemented (`packages/domain/src/operations/route-sequencer.ts`; `docs/architecture/picking-routing.md`).

Route geometry evidence: frontend resolves route step anchors from `locationsById` using either `cellId` -> published cell -> rack geometry or projection `x/y`; unresolved cases are explicitly surfaced (`apps/web/src/features/picking-planning-canvas/model/route-step-geometry.ts`). Konva overlay renders arrows, markers, and labels (`apps/web/src/features/picking-planning-canvas/ui/picking-route-overlay-layer.tsx`).

Unresolved lines/warnings: preview responses include `unresolved`, `unresolvedSummary`, `coverage`, `warnings`, and structured `warningDetails` with codes/severity (`apps/bff/src/features/picking-planning/diagnostics.ts`; `response-mapper.ts`; `packages/domain/src/operations/planning-warning.ts`; `docs/architecture/picking-routing.md`).

Canvas entrypoint: picking planning is intended to be launched/reviewed from the warehouse Canvas `Picking plan` stage, not from order/wave detail pages. The migration doc says direct order/wave planning buttons and `useOpenPickingPlan` were intentionally removed (`docs/architecture/canvas-picking-planning-migration.md`). Current frontend evidence: `apps/web/src/warehouse/shell/ui/view-stage-switcher.tsx`, `apps/web/src/warehouse/editor/ui/picking-planning-overlay.tsx`, `apps/web/src/warehouse/editor/ui/editor-canvas.tsx`.

## 9. Canvas and UI model

The warehouse editor is a React Konva spatial workspace. It renders grid, zones, walls, racks, cells, snap guides, HUD, selection, storage state, placement workflows, and the picking-plan overlay (`apps/web/src/warehouse/editor/ui/editor-canvas.tsx`; `apps/web/src/warehouse/editor/ui/warehouse-editor.tsx`; `apps/web/src/warehouse/editor/ui/workspace-canvas-and-panel.tsx`).

Canvas ownership: architecture baseline says Canvas handles rack placement, selection, drag move, 90-degree rotation, and spatial preview; inspector/forms own structural editing and business logic (`docs/architecture/architecture-baseline.md`). Current code follows that split with rack inspector/configuration files under `apps/web/src/warehouse/editor/ui/rack-inspector*` and `apps/web/src/features/rack-configure`.

Selection model: current editor state separates legacy editor store and interaction store; Storage V2 uses a separate focus store with no dual-write in active path (`apps/web/src/warehouse/editor/model/editor-store.ts`; `interaction-store.ts`; `model/v2/storage-focus-store.ts`; `apps/web/src/warehouse/editor/ui/editor-canvas.tsx`). Canvas supports rack, cell, wall, zone, container, workflow target, hover, locate, and highlighted-cell concerns (`apps/web/src/warehouse/editor/model/editor-types.ts`; `apps/web/src/warehouse/editor/ui/use-canvas-scene-model.ts`).

Picking-plan overlay: when view mode is `view` and stage is `picking-plan`, `EditorCanvas` displays `PickingPlanningOverlay` plus `PickingRouteOverlayLayer`; overlay owns preview loading, package tabs, route-step review, step selection, manual route-step reordering in preview UI, warnings, coverage, and unresolved geometry indicators (`apps/web/src/warehouse/editor/ui/editor-canvas.tsx`; `apps/web/src/warehouse/editor/ui/picking-planning-overlay.tsx`; `apps/web/src/entities/picking-planning/model/overlay-store.ts`; `apps/web/src/entities/picking-planning/model/route-steps.ts`).

Performance/culling/diagnostics: Canvas has viewport culling (`isRackInViewport`, visible racks), LOD, diagnostics flags for labels/hit tests/cells/cell overlays/culling/rack renderer, render-pipeline diagnostics, and E2E performance suites (`apps/web/src/warehouse/editor/ui/editor-canvas.tsx`; `apps/web/src/warehouse/editor/ui/canvas-diagnostics.ts`; `apps/web/src/entities/layout-version/lib/canvas-geometry.viewport-culling.test.ts`; `apps/web/e2e/performance/dl1-diagnostics.spec.ts`; `apps/web/e2e/performance/dl1-fps.spec.ts`).

What Canvas already does better than a generic drawing tool: it is domain-aware. It binds published layout identity, location occupancy/storage state, product/location policies, storage workflows, picking-plan route geometry, warnings, and diagnostics to the spatial map (`docs/architecture/warehouse-visual-semantics-model.md`; `apps/web/src/warehouse/editor/ui/use-floor-scene-data.ts`; `apps/web/src/warehouse/editor/ui/shapes/rack-cells-visual-state.ts`; `apps/web/src/features/picking-planning-canvas/model/route-step-geometry.ts`).

## 10. API surface summary

Layout / warehouse setup:

- Routes: `/api/sites`, `/api/sites/:siteId/floors`, `/api/floors`, `/api/floors/:floorId/workspace`, `/api/floors/:floorId/layout-draft`, `/api/floors/:floorId/published-layout`, `/api/floors/:floorId/published-cells`, `/api/layout-drafts`, `/api/layout-drafts/save`, `/api/layout-drafts/:layoutVersionId/validate`, `/api/layout-drafts/:layoutVersionId/publish` (`docs/API.md`; `apps/bff/src/routes/sites.routes.ts`; `floors.routes.ts`; `layout-read.routes.ts`; `layout-mutations.routes.ts`).
- DTOs/schemas: `createLayoutDraftBodySchema`, `saveLayoutDraftBodySchema`, layout validation/publish schemas in `apps/bff/src/schemas.ts`; domain layout schemas in `packages/domain/src/layout`.
- DB/RPC: `create_layout_draft`, `save_layout_draft`, `validate_layout_version`, `publish_layout_version`, `publish_layout_version_with_renames`, `get_layout_bundle` (`docs/DATABASE.md`; migrations `0006`, `0007`, `0043`, `0114`).
- Maturity: strongly implemented and tested; publish/location destructive guards are actively hardened.

Products / packaging / storage presets:

- Routes: `/api/products`, `/api/products/search`, `/api/products/:productId`, `/unit-profile`, `/packaging-levels`, `/storage-presets`, `/api/storage-presets/:presetId/create-container`, `/api/locations/:locationId/sku-policies/:productId/storage-preset` (`docs/API.md`; `apps/bff/src/features/products/routes.ts`; `apps/bff/src/routes/storage-presets.routes.ts`).
- DTOs: product/unit/packaging/storage preset schemas in `apps/bff/src/schemas.ts` and `packages/domain/src/catalog`.
- DB/RPC: `products`, `product_unit_profiles`, `product_packaging_levels`, `packaging_profiles`, `packaging_profile_levels`, `sku_location_policies`, `create_container_from_storage_preset`, `materialize_storage_preset_container_contents` (`docs/DATABASE.md`; migrations `0085`, `0086`, `0102`, `0103`, `0105`, `0111`).
- Maturity: implemented with explicit ADRs; nested quantity correctness remains a high-risk area requiring tests.

Locations / containers / inventory:

- Routes: `/api/container-types`, `/api/containers`, `/api/containers/:containerId`, `/api/containers/:containerId/location`, `/api/containers/:containerId/storage`, `/api/locations/:locationId/containers`, `/api/locations/:locationId/storage`, `/api/locations/by-cell/:cellId`, `/api/floors/:floorId/location-occupancy`, `/api/floors/:floorId/non-rack-locations`, `/api/containers`, `/api/containers/:containerId/remove`, `/api/containers/:containerId/inventory` (`docs/API.md`; `apps/bff/src/routes/container-read.routes.ts`; `container-mutations.routes.ts`; `location-read.routes.ts`).
- DTOs/domain: `Container`, `ContainerCurrentLocation`, `InventoryUnit`, `Location`, `LocationStorageSnapshotRow`, `ContainerStorageSnapshotRow` (`packages/domain/src/storage`).
- DB/views: `locations`, `container_types`, `containers`, `inventory_unit`, `container_storage_canonical_v`, `location_storage_canonical_v`, `location_occupancy_v`, `active_container_locations_v` (`docs/DATABASE.md`; migrations `0034`, `0036`, `0040`, `0048`).
- Maturity: canonical location/container/inventory model is implemented, with some compatibility history documented.

Movements / placement / transfers:

- Routes: `/api/placement/place-at-location`, `/api/containers/:containerId/move-to-location`, `/api/containers/:containerId/swap`, `/api/inventory/:inventoryUnitId/transfer`, `/api/inventory/:inventoryUnitId/pick-partial` (`apps/bff/src/routes/container-movement.routes.ts`; `inventory-movement.routes.ts`).
- DB/RPC: `place_container_at_location`, `move_container_canonical`, `swap_containers_canonical`, `transfer_inventory_unit`, `pick_partial_inventory_unit`, stock movement history (`docs/DATABASE.md`; migrations `0046`, `0091`, `0092`, `0101`).
- Maturity: implemented as canonical execution endpoints; older cell-centric wrappers are deprecated/removed in migration history (`0049`-`0066`; `docs/architecture/legacy-route-removal-matrix.md`).

Orders / waves:

- Routes: `/api/orders`, `/api/orders/:orderId`, `/api/orders/:orderId/lines`, `/api/orders/:orderId/status`, `/api/orders/:orderId/execution`, `/api/waves`, `/api/waves/:waveId`, `/api/waves/:waveId/status`, `/api/waves/:waveId/orders` (`apps/bff/src/features/orders/routes.ts`; `apps/bff/src/features/waves/routes.ts`; `apps/bff/src/routes/picking-execution.routes.ts`).
- DB/RPC: `orders`, `order_lines`, `waves`, `release_order`, `close_order_with_unreserve`, `cancel_order_with_unreserve`, `rollback_ready_order_to_draft`, `release_wave`, `attach_order_to_wave`, `detach_order_from_wave` (`docs/DATABASE.md`; migrations `0030`, `0033`, `0067`, `0083`).
- Maturity: implemented for lifecycle and membership; advanced WES-style orchestration not confirmed.

Picking tasks / pick steps:

- Routes: `/api/pick-tasks/:taskId`, `/api/pick-tasks/:taskId/allocate`, `/api/pick-steps/:stepId/execute` (`apps/bff/src/routes/picking-execution.routes.ts`).
- DB/RPC: `pick_tasks`, `pick_steps`, `allocate_pick_steps`, `execute_pick_step`, `pick_steps.source_location_id` foundation (`docs/DATABASE.md`; migrations `0031`, `0074`, `0075`, `0076`, `0106`).
- Maturity: execution primitives exist; scanner/mobile/offline flows are not confirmed.

Picking planning previews:

- Routes: `/api/picking-planning/preview`, `/preview/orders`, `/preview/wave` (`apps/bff/src/features/picking-planning/routes.ts`).
- DTOs: `PickingPlanningPreviewResponse`, warning/coverage/unresolved DTOs in BFF response mapper and frontend entity model (`apps/bff/src/features/picking-planning/schema.ts`; `response-mapper.ts`; `apps/web/src/entities/picking-planning/model/types.ts`).
- Maturity: read-only preview and Canvas route review are implemented; plan acceptance/persistence is not confirmed.

Simulation / future planning:

- No dedicated simulation sandbox, optimization solver integration, or graph routing engine is confirmed. Distance routing explicitly falls back to hybrid in `route-sequencer.ts`; architecture docs reserve future graph/routing work (`packages/domain/src/operations/route-sequencer.ts`; `docs/architecture/picking-routing.md`).

## 11. Database model summary

Important tables:

- Identity/tenancy: `profiles`, `tenants`, `tenant_members` (`apps/supabase/migrations/0002_profiles_sites_floors.sql`; `0011_tenants_and_membership.sql`).
- Layout: `sites`, `floors`, `layout_versions`, `racks`, `rack_faces`, `rack_sections`, `rack_levels`, `cells`, `layout_zones`, `layout_walls` (`0002`, `0003`, `0004`, `0080`, `0081`).
- Execution/storage: `locations`, `container_types`, `containers`, `container_lines`, `inventory_unit`, `stock_movements` (`0018`, `0034`, `0036`, `0039`, `0040`, `0088`).
- Products/packaging: `products`, `product_unit_profiles`, `product_packaging_levels`, `packaging_profiles`, `packaging_profile_levels`, `sku_location_policies` (`0027`, `0085`, `0086`, `0102`, `0105`).
- Orders/picking: `orders`, `order_lines`, `waves`, `pick_tasks`, `pick_steps`, `order_reservations` (`0030`, `0031`, `0033`, `0074`, `0083`, `0106`).
- Route/access foundation: `pick_aisles`, `face_access`, location route/access columns (`0107`, `0108`).

Important views/read models:

- `container_storage_canonical_v` and `location_storage_canonical_v` read directly from `inventory_unit`, not legacy inventory compatibility rows (`apps/supabase/migrations/0048_canonical_snapshot_views.sql`; `0102_storage_preset_semantics.sql`; `0100_expose_inventory_unit_id_in_storage_snapshots.sql`).
- `location_occupancy_v` and `active_container_locations_v` are canonical read surfaces for occupancy/current locations (`docs/DATABASE.md`; `apps/supabase/migrations/0054_fix_active_container_locations_view.sql`; `0079_expose_system_code_in_canonical_storage_views.sql`).

Important RPC/functions:

- Layout: `create_layout_draft`, `save_layout_draft`, `validate_layout_version`, `publish_layout_version`, `publish_layout_version_with_renames`, `get_layout_bundle` (`docs/DATABASE.md`; migrations `0006`, `0007`, `0041`, `0042`, `0043`, `0114`).
- Inventory/storage: `receive_inventory_unit`, `split_inventory_unit`, `pick_partial_inventory_unit`, `transfer_inventory_unit`, `create_container_from_storage_preset`, `materialize_storage_preset_container_contents` (`0036`, `0068`, `0088`, `0091`, `0102`, `0103`).
- Execution: `move_container_canonical`, `swap_containers_canonical`, `place_container_at_location`, `location_can_accept_container` (`0040`, `0046`, `0101`).
- Orders/picking: `release_order`, `release_wave`, `attach_order_to_wave`, `allocate_pick_steps`, `execute_pick_step` (`0030`, `0033`, `0067`, `0075`, `0076`).

Important constraints/lifecycle rules:

- Rack/cell address generation uses unique layout/address and level/slot constraints (`apps/supabase/migrations/0004_racks_faces_sections_levels_cells.sql`).
- Locations enforce tenant/floor/geometry consistency and require rack slots to reference published geometry (`apps/supabase/migrations/0034_locations.sql`).
- `locations_geometry_slot_unique` enforces one executable location per geometry slot when present (`apps/supabase/migrations/0034_locations.sql`).
- Inventory validates tenant/container consistency, serial quantity, packaging state, pack counts, and package-level/product matching (`apps/supabase/migrations/0036_inventory_unit.sql`; `0088_inventory_unit_packaging_truth.sql`).
- Publish hardening blocks destructive layout changes when removed locations still have operational references, and `publish_layout_version_with_renames` preserves logical `locations.id` across explicit address renames (`apps/supabase/migrations/0112_publish_layout_destructive_location_guard.sql`; `0114_publish_layout_explicit_rename_mappings.sql`).

Movement/history model: `stock_movements` is the canonical execution-history table for receive, putaway, move_container, split_stock, transfer_stock, pick_partial, ship, adjust, place/remove container (`packages/domain/src/storage/stock-movement.ts`; `apps/supabase/migrations/0039_stock_movements_and_execution_semantics.sql`; `0047_execution_history_convergence.sql`). Older `movement_events` exist in migration history and docs, but current canonical movement evidence points to `stock_movements`.

Migration safety/idempotency patterns: migrations commonly use `if not exists`, `drop trigger if exists`, `create or replace function/view`, scoped indexes, RLS policies, advisory locks for publish, and explicit backfill functions (`0034_locations.sql`; `0040_current_location_pivot_and_location_constraints.sql`; `0112_publish_layout_destructive_location_guard.sql`; `0114_publish_layout_explicit_rename_mappings.sql`).

## 12. Testing and validation

Validation commands required by repo instructions are `npm run lint`, `npm run typecheck`, and `npm run test`; UI changes also require `npm run test:e2e` (`AGENTS.md`; `docs/TESTING.md`). For this dossier-only change, the mandatory three commands were run and passed on 2026-05-06. The test output included existing React `act(...)` warnings and WOS trace logs; `docs/TESTING.md` says those are non-blocking when exit code is 0.

Vitest coverage:

- Domain tests cover layout/cell generation, storage rules/snapshots, packaging/storage presets, inventory unit rules, stock movements, picking strategies, workload complexity, work-package planning, splitting, routing, and planning pipeline (`packages/domain/src/**/*.test.ts`).
- BFF tests cover app routes, mappers, orders/waves, product packaging validation, storage presets, location reads/projections, execution, placement, picking, and picking planning preview (`apps/bff/src/**/*.test.ts`).
- Web tests cover API query/mutation adapters, product detail, storage presets UI, canvas editor, selection, culling, route overlay, picking planning overlay, and shell/view stage behavior (`apps/web/src/**/*.test.ts`, `*.test.tsx`).

Playwright coverage:

- E2E files include auth runtime, layout geometry, layout lifecycle, warehouse setup, storage-presets partial failure, and DL1 performance diagnostics/FPS (`apps/web/e2e`).
- `apps/web/package.json` defines smoke, critical, warehouse, storage, and performance test scripts.

SQL/database tests:

- Supabase tests cover layout lifecycle, container registry/placement, canonical snapshots, inventory units, stock movements, orders/waves, pick allocation/execution, storage presets, packaging normalization, publish destructive guards, and explicit rename mappings (`apps/supabase/tests/sql`).

Known validation gaps:

- `docs/architecture/picking-routing.md` states graph routing, cart-slot assignment, reserve fallback, multi-source allocation, plan persistence, and release-from-accepted-plan are future/non-goals for current preview PRs.
- `docs/architecture/architecture-baseline.md` lists imports, readiness, full picking generation/execution, real-time inventory truth, analytics, wave picking, and routing engine capabilities as out of V1 or planned/baseline rather than fully implemented. Some later code implements parts of picking/waves; the exact production completeness of scanner/mobile execution remains not confirmed.

## 13. Existing strengths

- Strong spatial/execution separation: `Cell`/geometry and `Location`/execution are distinct in docs, domain, DB constraints, and read models (`docs/architecture/core-wms-data-model-v1.md`; `packages/domain/src/storage/location.ts`; `apps/supabase/migrations/0034_locations.sql`).
- Published layout lifecycle: draft/save/validate/publish/rename/destructive guards are implemented and SQL-tested (`apps/supabase/migrations/0006_layout_validation_and_publish.sql`; `0112_publish_layout_destructive_location_guard.sql`; `0114_publish_layout_explicit_rename_mappings.sql`; `apps/supabase/tests/sql`).
- Container-backed inventory: canonical inventory is `Container -> InventoryUnit`, with current location on container and canonical storage views (`apps/supabase/migrations/0036_inventory_unit.sql`; `0040_current_location_pivot_and_location_constraints.sql`; `0048_canonical_snapshot_views.sql`).
- Backend-canonical quantity/preset discipline: ADRs and tests require cumulative packaging and backend-owned storage-preset materialization (`docs/decisions/ADR-0001-packaging-hierarchy.md`; `docs/decisions/ADR-0002-storage-presets.md`; `docs/TESTING.md`).
- Canvas-based route review: picking preview and route geometry are overlaid directly on the warehouse Canvas, with unresolved geometry status and warning/coverage UI (`docs/architecture/canvas-picking-planning-migration.md`; `apps/web/src/warehouse/editor/ui/picking-planning-overlay.tsx`; `apps/web/src/features/picking-planning-canvas`).
- Domain/BFF/API boundaries: shared schemas and pure logic live in `packages/domain`; BFF routes validate/map; frontend consumes DTOs through API layers (`docs/ARCHITECTURE.md`; `docs/architecture/system-overview.md`; `apps/bff/src/schemas.ts`; `apps/web/src/entities/*/api`).
- Testing and diagnostics discipline: unit, SQL, E2E, performance scripts, canvas diagnostics, and architecture/testing docs are present (`docs/TESTING.md`; `apps/web/e2e/performance`; `apps/web/src/warehouse/editor/ui/canvas-diagnostics.ts`).

## 14. Known gaps / unfinished areas

Evidence-backed gaps only:

- True shortest-path/graph routing is not implemented; `distance` mode falls back to `hybrid` (`packages/domain/src/operations/route-sequencer.ts`; `docs/architecture/picking-routing.md`).
- Picking planning is preview-only; current planning docs say no plan persistence, no allocation mutation, no release behavior changes, no pick task/step creation from preview, and future PRs may persist accepted plans (`docs/architecture/picking-routing.md`; `apps/bff/src/features/picking-planning/service.ts`).
- Cart-slot assignment and cluster cart execution are not implemented; warnings exist when cluster requires cart slots without assignments (`packages/domain/src/operations/work-package-planner.ts`; `route-sequencer.ts`; `docs/architecture/picking-routing.md`).
- Multi-source allocation, reserve fallback, and partial/multi-source planning are explicitly future/non-goals in preview docs (`docs/architecture/picking-routing.md`).
- Mobile scanner execution, offline-first picking, pack station flow, worker assignment, KPI/control tower, ERP integration, OR-Tools/Timefold integration, and simulation sandbox are not confirmed in code/docs inspected. Treat them as open gaps only after product confirmation, not as proven scope.
- Full import pipeline/readiness modules are documented as baseline/planned, but current repo evidence reviewed here does not confirm complete production import/readiness implementation (`docs/architecture/architecture-baseline.md`; `docs/architecture/system-overview.md`).
- Advanced slotting/replenishment optimization is not confirmed; `reserve`/primary roles and location policies exist, but no external solver/slotting engine is evident (`packages/domain/src/operations/product-location-role.ts`; `apps/bff/src/features/product-location-roles`; `docs/architecture/picking-routing.md`).

## 15. External audit comparison rules

Future audits of external WMS/WES/ERP/optimization/slotting/routing/canvas/simulation projects must compare them against OPS MS architecture, not a generic WMS assumption.

Hard rules:

- Do not recommend flat `SKU -> Location` or `SKU -> Cell` as the canonical model. OPS MS uses `Location -> Container -> InventoryUnit`, and docs explicitly reject `SKU -> Cell` collapse (`docs/architecture/core-wms-data-model-v1.md`; `docs/architecture/architecture-baseline.md`).
- Do not mix geometry slots/cells with execution locations. `Cell` is spatial truth; `Location` is executable storage truth (`packages/domain/src/storage/location.ts`; `apps/supabase/migrations/0034_locations.sql`).
- Do not put inventory directly in slots or locations. Inventory belongs to `Container`, and current location is derived from `Container.currentLocationId` (`packages/domain/src/storage/inventory-unit.ts`; `apps/supabase/migrations/0036_inventory_unit.sql`; `0040_current_location_pivot_and_location_constraints.sql`).
- Do not recommend frontend-owned canonical quantity math. Packaging and storage preset quantities must come from backend/DB/domain contracts (`AGENTS.md`; `docs/decisions/ADR-0001-packaging-hierarchy.md`; `docs/decisions/ADR-0002-storage-presets.md`).
- Do not recommend naive direct storage-preset math. Packaging hierarchy is cumulative and storage presets resolve through profile hierarchy (`docs/decisions/ADR-0001-packaging-hierarchy.md`; `docs/TESTING.md`; `apps/supabase/migrations/0102_storage_preset_semantics.sql`; `0103_storage_preset_materialization.sql`).
- Do not recommend launching picking planning from order/wave detail pages unless humans explicitly reverse the Canvas migration. Current decision is Canvas `Picking plan` stage only (`docs/architecture/canvas-picking-planning-migration.md`; `apps/web/src/warehouse/shell/ui/view-stage-switcher.tsx`).
- Do not recommend copying external code into OPS MS. Use external projects as references for patterns and small PRs; preserve OPS MS contracts and architecture boundaries (`AGENTS.md`; `docs/architecture/architecture-baseline.md`).
- Do not recommend large rewrites. Repo rules require small, reviewable changes and public contract preservation (`AGENTS.md`).
- Do not treat Canvas as a generic drawing tool. Canvas is a domain-aware spatial operations surface with published layout, location/storage state, route overlays, and diagnostics (`apps/web/src/warehouse/editor/ui/editor-canvas.tsx`; `docs/architecture/warehouse-visual-semantics-model.md`).
- Do not claim advanced optimization/simulation already exists unless cited to code. Current route sequencing is deterministic MVP with graph routing absent (`packages/domain/src/operations/route-sequencer.ts`; `docs/architecture/picking-routing.md`).

## 16. Reusable context block for future prompts

OPS MS is a TypeScript monorepo for `Warehouse Setup + Stock-Aware Directed Picking V1`. It is not a generic full WMS, ERP, or routing platform. Current product shape is a spatial warehouse operations foundation with WMS-like storage/execution primitives and Canvas-centered picking-plan preview/review. Stack: React 19/Vite/Tailwind/TanStack Query/Zustand/React Konva frontend in `apps/web`, Fastify BFF in `apps/bff`, Supabase/Postgres migrations/RPC/views/RLS in `apps/supabase`, and shared Zod/domain logic in `packages/domain`.

Architecture boundary: frontend owns presentation, navigation, Canvas/editor interactions, and API hooks; BFF owns auth, tenant context, request validation, DTO mapping, and service/repo orchestration; database owns authoritative schema, constraints, views, and transactional RPC; `packages/domain` owns shared schemas/enums and pure domain logic. Generated Supabase row types must stay inside API layers and be mapped into domain/DTO shapes.

Core rule: separate spatial truth from execution truth. Spatial truth is published `LayoutVersion` with `Rack -> RackFace -> RackSection -> RackLevel -> Cell/GeometrySlot`; cells have generated addresses like `03-A.02.03.04` and are not execution truth. Execution truth is `Location -> Container -> InventoryUnit`, with `Movement/stock_movements` for history. `Location` is executable storage, may link to `geometrySlotId`, and can be non-rack (`floor`, `staging`, `dock`, `buffer`) without geometry. `Container.currentLocationId` is canonical current-state placement truth. Inventory belongs to containers, never directly to slots/locations.

Products use `products`, `product_unit_profiles`, and `product_packaging_levels`. Packaging hierarchy is cumulative (`box=2`, `master=4 boxes` means `master=8 base units`). Storage presets are backend-canonical `packaging_profiles.profile_type='storage'`; frontend must render canonical snapshots/status and must not compute storage quantities locally.

Picking planning is currently read-only preview. Domain pipeline builds `PickTaskCandidate -> WorkPackage -> split -> RouteStep`; BFF exposes `/api/picking-planning/preview`, `/preview/orders`, and `/preview/wave`. It returns warnings, unresolved lines, coverage, packages, and route steps, but does not allocate, release, create pick tasks/steps, or persist accepted plans. Planning UI belongs in the warehouse Canvas `Picking plan` stage, not order/wave detail pages. Route geometry uses `locations.id` plus optional `cellId`/projection coordinates; graph routing is not implemented and distance mode falls back to hybrid.

External audits must not recommend flat SKU-location models, geometry/execution collapse, frontend-owned quantity math, naive preset math, direct order/wave planning launches, large rewrites, or copying external code. Compare external projects against this architecture.

## 17. Open questions

- Is OPS MS intended to become a full WMS eventually, or remain a narrow spatial WMS/operations-control product? Current docs say V1 is not a full WMS, but later execution primitives are significant (`docs/architecture/architecture-baseline.md`; `README.md`).
- Which current picking execution flows are production-ready versus scaffolded? Pick task/step allocation/execution exists, but mobile scanner/offline/worker assignment flows are not confirmed (`apps/bff/src/routes/picking-execution.routes.ts`; `apps/supabase/migrations/0075_allocate_pick_steps.sql`; `0076_execute_pick_step.sql`).
- Should external audits evaluate import/readiness pipelines now, or treat them as planned baseline? Docs describe import/readiness canon, but implementation completeness was not confirmed in this audit (`docs/architecture/architecture-baseline.md`; `docs/architecture/system-overview.md`).
- What is the target plan-acceptance flow after Canvas preview? Current preview explicitly avoids persistence/allocation/release; future accepted-plan persistence is mentioned but not implemented (`docs/architecture/picking-routing.md`).
- How should non-rack locations be edited visually long term? Domain and API support `floorX`/`floorY`, but the complete UX for non-rack location editing was not confirmed (`packages/domain/src/storage/location.ts`; `apps/bff/src/routes/location-read.routes.ts`).
- Are `movement_events`, `operation_events`, and `stock_movements` intended to converge into one audit/event model? Current canonical movement evidence points to `stock_movements`, while docs mention events/audit history in multiple places (`packages/domain/src/storage/stock-movement.ts`; `docs/architecture/supabase-schema-module-map.md`; `docs/architecture/ADR-003.md`).
- Should external solver integrations such as OR-Tools/Timefold be considered near-term? No implementation was found; route sequencing is deterministic MVP with graph routing absent (`packages/domain/src/operations/route-sequencer.ts`; `docs/architecture/picking-routing.md`).
