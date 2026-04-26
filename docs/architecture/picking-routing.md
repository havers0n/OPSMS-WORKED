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

### PR 3 — StorageLocation projection and route fields
- `addressLabel`;
- `routeSequence`;
- `zoneId`;
- `accessAisleId`.

### PR 4 — PickingStrategy config

### PR 5 — Workload complexity score

### PR 6 — WorkPackage planner

### PR 7 — WorkSplitPolicy

### PR 8 — RouteSequencer MVP

## Notes for current execution model

Current pick execution still uses `pick_steps.source_cell_id`. That migration to `source_location_id` is intentionally deferred to PR 2.

The routing model should not depend on visual-canvas-only coordinates. Coordinates can support geometry, but executable planning identity remains `locations.id`.
