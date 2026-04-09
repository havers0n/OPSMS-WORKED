# Warehouse Editor Runtime Migration Contract (PR1-PR5)

## Purpose

This document defines the migration contract for the warehouse-editor runtime relocation series.

PR1 removes fake ownership and import indirection for `canvas-geometry` and `rack-spacing`.
PR1 does **not** establish the final semantic owner of geometry utilities.
PR1 only establishes the current honest source of truth.

## Canonical Import Policy

- Runtime modules canonical path: `@/widgets/warehouse-editor/model/<submodule>`.
- Facade canonical path: `@/widgets/warehouse-editor/model/editor-selectors`.
- Compatibility re-exports are temporary bridges only.
- Compatibility re-exports are not a permanent public API.
- After relocation starts, no new imports may be introduced through old runtime paths.

## Machine-Checkable Gates

### PR1

- No imports from `widgets/warehouse-editor/lib/canvas-geometry`.
- No imports from `widgets/warehouse-editor/lib/rack-spacing`.

Checks:

- `rg -n "widgets/warehouse-editor/lib/canvas-geometry" apps/web/src` must return no matches.
- `rg -n "widgets/warehouse-editor/lib/rack-spacing" apps/web/src` must return no matches.
- `typecheck` must pass.
- `build` must pass.
- Targeted test subset must pass.

### PR2-PR4

- Old runtime paths may exist only as temporary compatibility re-export files.
- Physical owner must be `widgets/warehouse-editor/model/*`.

Checks:

- `rg`/`grep` checks for old-path usage and temporary bridge constraints.
- `typecheck`.
- `build`.
- Targeted tests per PR scope.
- Optional temporary guardrail via ESLint `no-restricted-imports` (or equivalent) if safely enforceable without broad false positives.

### PR5

- No imports from old runtime paths anywhere.
- No runtime modules left in `entities/layout-version/model/*`.
- `editor-selectors` is the single facade owner.

Checks:

- CI hard-fail `rg`/`grep` gates for old imports and disallowed module locations.
- `typecheck`.
- `build`.
- Targeted tests.

## Forbidden Changes Policy (All PRs In Series)

- No behavior changes.
- No UI cleanup.
- No naming cleanup.
- No test restructuring.
- No parallel architectural improvements.
- No "while touching this, also refactor" changes.
- Each PR changes ownership/import graph only.
- If runtime behavior changes, it must be a separate PR.

## PR1 Hard Constraints

- PR1 must not move physical implementations of `canvas-geometry` or `rack-spacing`.
- PR1 must not change runtime behavior.
- PR1 must not change store/selectors/editor runtime semantics.
- PR1 must not enter PR2+ relocation scope.

## Runtime Invariants For Later PRs

### PR3 Invariants

- `setViewMode` semantics unchanged.
- Selection reset behavior unchanged.
- Workflow reset behavior unchanged.
- `useSemanticZoom` output contract unchanged.
- Viewport/autofit behavior unchanged.

### PR4 Named Smoke Scenarios

- Open editor.
- Select rack / wall / zone / cell.
- Switch layout ↔ storage ↔ view.
- Start storage workflow.
- Cancel/reset workflow.
- Reset draft.
- Autosave / dirty-state / conflict surface.
- Publish gate failure visibility.

### PR5 CI Hard Fail Rules

- Old runtime imports forbidden.
- Runtime modules forbidden in `entities/layout-version/model/*`.
- `editor-selectors` must be the only facade owner.

