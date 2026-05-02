# UI Architecture (PR-1 Boundary Freeze)

This document freezes the current UI layer boundaries in `apps/web/src`.

It is a documentation baseline for current structure, not a redesign.

## Layers

1. `shared/ui`
2. `entities/*/ui`
3. `widgets/app-shell/ui`
4. `warehouse/editor/ui`
5. `warehouse/editor/ui/shapes`

### Warehouse Editor Split

- `warehouse/editor/ui` = editor/workspace surfaces and compositions, excluding `shapes`.
- `warehouse/editor/ui/shapes` = scene rendering layer.

## Import Rules

- `shared/ui` must not import from `entities/*`, `features/*`, or `widgets/*`.
- `entities/*/ui` may import from `shared/ui`.
- `widgets/*` may import from `entities/*` and `shared/ui`.

## Current Entity Display Status

- Cell currently has entity display seed.
- Rack currently has entity display seed.
- Section is not a first-class entity yet.

## Scene Rendering Boundary

Rack/section/cell rendering in `warehouse/editor/ui/shapes` is scene rendering and not shared UI.

## PR-1 Scope Guard

- No code moves.
- No renames.
- No behavior changes.
