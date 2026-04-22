# Warehouse Visual Semantics Model

## Purpose

This document defines the target visual semantics for warehouse cells and rack slots.

Its goal is to stop mixing three different concerns into one visual status:

- `layout`: what physical structure exists
- `storage`: what the location physically or operationally contains
- `interaction`: what the user is currently doing in the UI

This is a UI contract. It does not replace the domain model documents. It operationalizes them for canvas rendering, Storybook, and inspector behavior.

## Core rule

A cell must be rendered from three ordered layers:

1. `layout base`
2. `storage state`
3. `interaction overlay`

If a visual meaning does not fit one of those three layers, it is probably mixing concerns and should be challenged.

## Layer definitions

### 1. Layout base

Layout base answers:

- does this slot physically exist
- does it have a published cell identity
- which rack face / section / level / slot is it
- is the rack passive or active in the current scene framing

Layout base must not express:

- stock presence
- reservation
- picking activity
- quarantine
- search hit
- current selection

Layout base should be stable across `view` and `storage` mode.

### 2. Storage state

Storage state answers:

- is the location empty or occupied
- is it reserved
- is it actively involved in picking
- is it quarantined / conflicted
- is it blocked for workflow targeting

Storage state owns the primary semantic fill of the cell.

### 3. Interaction overlay

Interaction overlay answers:

- is it selected
- is it focused
- is it the locate target
- is it a search hit
- is it the workflow source

Interaction overlay must not replace storage meaning. It should use outline, halo, badge, or dashed treatment, not overwrite the storage fill.

## Top-level mode semantics

### `layout`

Shows layout truth only.

- racks, faces, sections, levels, walls, zones
- no storage fill semantics
- no container/inventory semantics
- cell slots may be shown as structure previews, but not as storage state

### `view`

Shows read-only warehouse truth.

- layout base is visible
- storage state is visible
- interaction overlay is read-only navigation only
- right panel shows lookup / locate context, not editing workflow

`view` is not its own domain-semantic layer. It is a read-only composition of layout + storage.

### `storage`

Shows operational location truth.

- layout base is visible
- storage state is visible
- interaction overlay includes workflow affordances
- right panel shows container / inventory / policy / move flow

`storage` differs from `view` by interaction and panel behavior, not by inventing a different physical meaning for the same cell.

## Canonical cell matrix

### Layout base states

| Layout base state | Meaning | Visual responsibility |
|---|---|---|
| `missing_identity` | geometric slot exists but no published cell identity exists yet | low-emphasis ghost slot |
| `published_empty_frame` | published cell exists | neutral base frame |
| `rack_selected_context` | rack is the active object context | slightly stronger neutral frame |
| `rack_passive_context` | rack is intentionally de-emphasized | reduced opacity only |

### Storage states

| Storage state | Meaning | Visual responsibility |
|---|---|---|
| `empty` | published location exists and is empty | neutral low-signal fill |
| `occupied` | occupied, but only occupancy truth is known | occupied fill fallback |
| `stocked` | operations/runtime confirms stocked state | canonical occupied fill |
| `reserved` | location is reserved | lilac dotted storage fill |
| `pick_active` | active picking work is attached | action/accent fill |
| `quarantined` | damaged, quarantined, or conflict-like state | danger/conflict fill |
| `workflow_locked` | cannot be targeted in current workflow | blocked/disabled fill |

### Interaction overlays

| Interaction overlay | Meaning | Visual responsibility |
|---|---|---|
| `selected` | current primary object | strongest outline / halo |
| `focused` | local emphasis without full selection | medium outline |
| `locate_target` | target resolved from search/locate flow | distinct target outline |
| `search_hit` | one of search matches | weaker highlight outline |
| `workflow_source` | source location of active workflow | dashed outline / source marker |

## Priority rules

Priority must be explicit.

### Storage fill priority

When multiple storage signals exist, resolve in this order:

1. `workflow_locked`
2. `quarantined`
3. `pick_active`
4. `reserved`
5. `stocked`
6. `occupied`
7. `empty`
8. `layout base only`

This keeps operational exception states above normal occupancy.

### Interaction overlay priority

When multiple interaction signals exist, resolve in this order:

1. `selected`
2. `locate_target`
3. `workflow_source`
4. `focused`
5. `search_hit`

Only one primary outline treatment should win. Secondary markers may coexist only if they do not create ambiguity.

## What must never be encoded as primary fill

These meanings belong to overlay or surrounding chrome, not cell fill:

- selected
- focused
- locate target
- search hit
- rack selected
- rack passive

If any of these overwrite the storage fill, the user loses the answer to the question "what is physically true about this location?"

## Mapping to current code

### Current owner files

- Cell visual resolution: [apps/web/src/widgets/warehouse-editor/ui/shapes/rack-cells-visual-state.ts](C:\Projects\abctestsforWOS\apps\web\src\widgets\warehouse-editor\ui\shapes\rack-cells-visual-state.ts:1)
- Palette tokens: [apps/web/src/widgets/warehouse-editor/ui/shapes/warehouse-semantic-canvas-palette.ts](C:\Projects\abctestsforWOS\apps\web\src\widgets\warehouse-editor\ui\shapes\warehouse-semantic-canvas-palette.ts:1)
- Cell rendering: [apps/web/src/widgets/warehouse-editor/ui/shapes/rack-cells.tsx](C:\Projects\abctestsforWOS\apps\web\src\widgets\warehouse-editor\ui\shapes\rack-cells.tsx:1)
- Floor scene data loading: [apps/web/src/widgets/warehouse-editor/ui/use-floor-scene-data.ts](C:\Projects\abctestsforWOS\apps\web\src\widgets\warehouse-editor\ui\use-floor-scene-data.ts:1)
- Mode capability gates: [apps/web/src/widgets/warehouse-editor/ui/use-canvas-capabilities.ts](C:\Projects\abctestsforWOS\apps\web\src\widgets\warehouse-editor\ui\use-canvas-capabilities.ts:1)

### Current mismatch

The current renderer mixes all three layers in one resolver:

- storage semantics: `runtimeStatus`, `occupied_fallback`
- workflow semantics: `isWorkflowTargetLocked`
- interaction semantics: `isSelected`, `isLocateTarget`, `isWorkflowSource`, `isFocused`, `isSearchHit`
- scene framing semantics: `isRackPassive`, `isRackSelected`

That is why the visual model feels unstable.

## Required refactor target

The target rendering API should conceptually split into:

- `resolveLayoutCellBase(...)`
- `resolveStorageCellState(...)`
- `resolveInteractionOverlay(...)`
- `composeCellVisualState(...)`

The exact file split can vary, but the responsibilities must not stay merged.

## Storybook contract

Storybook should prove the model with isolated stories:

1. `Layout base only`
2. `Storage fill only`
3. `Interaction overlay only`
4. `Same cell across layout/view/storage`
5. `Conflict priority matrix`

Current comparison stories are useful, but they still rely on mixed fixtures and do not fully isolate the visual layers.

## Repo cleanup guidance

### `uiproto`

`uiproto` is a prototype vocabulary source, not domain truth.

Its status model:

- `free`
- `partial`
- `full`
- `reserved`
- `inventory`
- `blocked`

should be treated as an early visual language study, not the canonical production semantics.

### `uiproto/deterministic`

At the time of review, the main files in `uiproto` and `uiproto/deterministic` are byte-identical duplicates.

That should be reduced to one canonical prototype source to remove cognitive noise.

## First implementation steps

1. Freeze this rule: `view` is read-only composition, not a separate cell-semantic domain.
2. Split the cell visual resolver into layout/storage/interaction responsibilities.
3. Keep storage fill semantics visible under all interaction overlays.
4. Update Storybook fixtures so they use canonical semantics first, legacy fields only as compatibility mirrors.
5. Remove duplicate prototype source or explicitly label one as archival.

## Decision summary

The correct mental model is:

- `layout` = physical structure
- `storage` = physical or operational truth of the location
- `view` = read-only navigation on top of layout + storage

The correct cell model is:

- frame from layout
- fill from storage
- outline/halo from interaction
