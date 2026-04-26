# Picking / Routing Architecture (Future Model)

## Purpose

This document defines **domain vocabulary and architecture boundaries** for future picking strategy and routing work.

This is intentionally **rails, not train**:
- no behavior changes;
- no picking execution flow changes;
- no database migration in this PR.

## Core principle

- `locations` are executable warehouse/storage points.
- `cells` are layout/geometry entities.
- Future picking/routing/work planning must use executable `locations.id`.
- `cells.id` may be used only as a geometry/display bridge.

This avoids introducing a second executable warehouse model.

## Planning pipeline

```text
Order / Wave / Line
→ PickingStrategy
→ PickTaskCandidate
→ WorkPackage
→ WorkSplitPolicy
→ RouteSequencer
→ RouteStep
→ Picker Execution UI
```

Reference service layering:

```text
PickingStrategy
→ PickTaskGenerator
→ WorkPackageBuilder
→ WorkSplitService
→ WorkAssignmentService
→ RouteSequencer
→ PickingExecutionMapper
```

## Picking methods

- `single_order`: one order at a time.
- `batch`: multiple orders collected together, then typically sorted.
- `wave_bulk`: wave-level aggregated picking, then sorted/consolidated.
- `cluster`: multiple orders collected together with cart/tote slots.
- `zone`: work split by warehouse zones.
- `pick_and_pack`: picker picks directly into final order container.
- `two_step`: first bulk collect, then allocate/sort to orders.

## RouteSequencer / RouteBuilder responsibility

RouteSequencer (RouteBuilder) **should**:
- sequence an already-created `WorkPackage`;
- use `routeSequence`, zone order, address fallback, and handling hints;
- return deterministic `RouteStep[]`.

RouteSequencer (RouteBuilder) **must NOT**:
- select orders;
- choose picking method;
- aggregate order lines;
- split oversized work;
- assign picker/cart/zone;
- resolve inventory availability;
- mutate execution state.

## Aisle / face access concept

`Rack 6 / Face B` and `Rack 7 / Face A` can be opposite sides of the same aisle.

Do not infer this from face names (A/B). Model it explicitly through:
- `PickAisle`
- `FaceAccess`
- `accessAisleId`
- `sideOfAisle`
- `positionAlongAisle`

Example:
- `Rack 6 / Face B → Aisle 6-7 / left side`
- `Rack 7 / Face A → Aisle 6-7 / right side`

This lets routing understand that opposite faces may still be serviced from the same walking path.

## PR boundaries

### PR 2 — Location-first pick execution
- add `pick_steps.source_location_id`;
- backfill from `source_cell_id`;
- update allocation/read models.

### PR 3 — StorageLocation projection + route/access foundation

`StorageLocationProjection` is the route-planning-facing view over executable
storage locations (`locations.id`).

Scope:
- add deterministic ordering primitive `routeSequence`;
- keep separate optional `pickSequence` for later picking preference logic;
- expose optional zone/access metadata:
  - `zoneId`, `pickZoneId`, `taskZoneId`, `allocationZoneId`;
  - `accessAisleId`, `sideOfAisle`, `positionAlongAisle`, `travelNodeId`;
- keep canvas coordinates (`x`, `y`) as optional hints only.

Important modeling rules:
- `zoneId` is not automatically equivalent to visual `layout_zones`;
- face names (`A`, `B`) are labels, not topology;
- opposite faces must be modeled explicitly via aisle/access relationships.

Example:

```text
Rack 6 / Face B / Section 03
→ StorageLocationProjection:
  accessAisleId: "AISLE-06-07"
  sideOfAisle: "left"
  positionAlongAisle: 3

Rack 7 / Face A / Section 03
→ StorageLocationProjection:
  accessAisleId: "AISLE-06-07"
  sideOfAisle: "right"
  positionAlongAisle: 3
```

### PR 4 — Aisle/face topology foundation

PR 4 introduced explicit aisle/access topology primitives:
- `PickAisle`;
- `FaceAccess`;
- `StorageLocationProjection.accessAisleId`;
- `StorageLocationProjection.sideOfAisle`;
- `StorageLocationProjection.positionAlongAisle`.

This removed implicit topology inference from face labels (`A`/`B`) and established explicit walking-path semantics for future route planning.

### PR 5 — PickingStrategy config foundation

`PickingStrategy` in PR 5 is planning configuration only.

It **defines how future work should be shaped**, but does not execute anything:
- no route is built in PR 5;
- no `WorkPackage` is created in PR 5;
- no release/allocation behavior is changed in PR 5.

Default strategy intent:
- `single_order`: one order at a time;
- `batch`: collect multiple orders together, sort later;
- `wave_bulk`: wave-level aggregated collection, then sort/consolidate;
- `cluster`: collect multiple orders with explicit cart/tote slot guidance;
- `zone`: split work by zones, consolidate later;
- `pick_and_pack`: pick directly into the final order container with handling-aware sequencing;
- `two_step`: step 1 bulk collection, step 2 sort/allocate to orders.

Future pipeline consumption:

```text
PickTaskGenerator
→ WorkPackageBuilder
→ WorkSplitService
→ RouteSequencer
```

### PR 6 — Workload complexity score foundation

PR 6 introduces a **domain-level workload complexity score** to estimate how hard a potential picking workload is before any split/build/route behavior exists.

Scope and non-goals:
- computed before `WorkPackage` planning and splitting;
- does not change picking execution;
- does not create routes;
- does not modify release/allocation behavior;
- does not persist new planning state.

Current complexity dimensions (MVP heuristics):
- pick lines;
- unique locations;
- zones;
- aisles;
- total weight;
- total volume;
- handling classes (`heavy`, `bulky`, `fragile`, `cold`/`frozen`, `hazmat`);
- unknown/missing data (dimensions, locations).

The score is intentionally deterministic and explainable. It is a conservative MVP heuristic and **not final warehouse optimization science**.

Example workload snapshot (Line #77):
- 9 orders;
- 42 pick lines;
- 31 SKU;
- 28 locations;
- 5 zones;
- 4 aisles;
- 120 kg;
- 430 L;
- 8 heavy tasks;
- 4 bulky tasks;
- 6 unknown dimensions.

Complexity result: `HIGH` / `CRITICAL` (threshold-dependent).

Typical warnings:
- Workload exceeds max weight.
- Workload touches too many zones.
- Some tasks are missing dimensions.

Future usage:
- PR 7 can consume this score when building `WorkPackage` plans;
- PR 8 can use strategy `WorkSplitPolicy` thresholds for split decisions.

### PR 7 — WorkPackage planner foundation

PR 7 introduces a pure domain-level planner that converts task candidates into a planning container (`WorkPackageDraft`).

It consumes:
- `PickTaskCandidate[]`;
- `PickingStrategy` (explicit or default);
- `StorageLocationProjection`-compatible location refs;
- `WorkloadComplexityScore` from `estimateWorkloadComplexity()`.

It intentionally does **not**:
- split work into multiple packages;
- sequence walking/picking routes;
- allocate inventory;
- persist planning records.

PR 7 planning pipeline:

```text
PickTaskCandidate[]
+ PickingStrategy
+ StorageLocationProjection refs
→ WorkloadComplexityScore
→ WorkPackageDraft
```

Example:

Input:
- 42 task candidates;
- strategy: `batch`;
- 9 orders;
- 28 locations;
- 5 zones.

Output `WorkPackageDraft` (illustrative):
- method: `batch`;
- tasks: 42;
- totalWeightKg: 120;
- totalVolumeLiters: 430;
- complexity: `high`;
- warnings:
  - strategy requires post-sort;
  - workload touches too many zones;
  - workload exceeds max weight.

## Notes for current execution model

PR 2 introduced `pick_steps.source_location_id` and location-first read/allocation
paths while preserving compatibility fallbacks.

The routing model should not depend on visual-canvas-only coordinates. Coordinates can support geometry, but executable planning identity remains `locations.id`.

### PR 8 — WorkSplitService foundation

PR 8 introduces a pure domain-level `WorkSplitService` that takes a planned `WorkPackageDraft` and returns one or more planned `WorkPackageDraft` children.

It uses:
- strategy `WorkSplitPolicy` thresholds;
- `WorkloadComplexityScore` (via `estimateWorkloadComplexity()`).

It does **not**:
- create routes;
- allocate stock;
- persist data;
- modify picking execution.

MVP deterministic split priority:
1. split by zone;
2. split by aisle/location;
3. split by weight;
4. split by volume;
5. split by pick lines.

Example (illustrative):

Input (Line #77 / WorkPackageDraft):
- 42 pick lines;
- 120kg;
- 5 zones;
- 28 locations.

Output:
- Package P1 — Zone A/B;
- Package P2 — Zone C;
- Package P3 — Unknown / overflow.

Assignment behavior in PR 8 (conservative):
- `assignedPickerId` is preserved into child packages;
- `assignedZoneId` is set only when split reason is zone and child zone is known;
- `assignedCartId` is intentionally not propagated to avoid unsafe duplication in cluster/cart-slot flows.

PR 9 is planned to introduce RouteSequencer MVP.
