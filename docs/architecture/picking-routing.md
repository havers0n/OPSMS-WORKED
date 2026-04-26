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

### PR 4 — PickAisle + FaceAccess topology

PR 4 introduces explicit topology entities that bridge layout geometry and
future route sequencing:

- `PickAisle` represents a walkable aisle/access lane.
- `FaceAccess` records that a rack face is serviced from a specific aisle.
- `locations.id` remains the executable point; topology is access metadata.

Topology must be explicit. Face labels (`A` / `B`) are naming conventions,
not routing truth. Two faces are considered opposite only when they are mapped
to the same aisle.

Example topology mapping:

```text
Aisle AISLE-06-07
left side:
  Rack 6 / Face B
right side:
  Rack 7 / Face A
```

Example location-level access metadata:

```text
Rack 6 Face B Section 03
→ accessAisleId: AISLE-06-07
→ sideOfAisle: left
→ positionAlongAisle: 3

Rack 7 Face A Section 03
→ accessAisleId: AISLE-06-07
→ sideOfAisle: right
→ positionAlongAisle: 3
```

Non-goals for PR 4:
- does not implement `RouteSequencer`;
- does not auto-infer topology from face names;
- does not change current pick execution flow.

Future sequencing can group by `accessAisleId` and order by
`positionAlongAisle` (with additional policy later).

### PR 5 — PickingStrategy config

### PR 6 — Workload complexity score

### PR 7 — WorkPackage planner

### PR 8 — WorkSplitPolicy

### PR 9 — RouteSequencer MVP

## Notes for current execution model

PR 2 introduced `pick_steps.source_location_id` and location-first read/allocation
paths while preserving compatibility fallbacks.

The routing model should not depend on visual-canvas-only coordinates. Coordinates can support geometry, but executable planning identity remains `locations.id`.
