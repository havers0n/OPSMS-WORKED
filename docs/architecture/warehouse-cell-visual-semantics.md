# Warehouse Cell Visual Semantics Freeze

This document is the checked-in review baseline for PR2 through PR5 of the warehouse cell visual-semantics migration.

It freezes the rendering contract that follow-up PRs are allowed to implement. PR1 does not implement this model; it documents the target and characterizes the current seams that will be changed later.

## Frozen layer model

- `base/frame`: physical structure only
- `fill`: storage truth only
- `overlay`: interaction/workflow only

Layer ownership is exclusive. A meaning that belongs to one layer must not leak into another.

## Frozen storage vocabulary

Canonical storage states:

- `empty`
- `occupied`
- `reserved`
- `pick-active`
- `quarantined`

Notes:

- `occupied` is the canonical non-empty class.
- Fallback occupancy is not a separate canonical storage state.
- Degraded truth may reuse `occupied` only under the fallback rule below.

## Frozen overlay vocabulary

Canonical interaction/workflow overlays:

- `selected`
- `locate-target`
- `search-hit`
- `workflow-source`
- `invalid-target`

These meanings belong to overlay channels only. They must never redefine storage truth.

## Forbidden encodings

Primary fill must never encode:

- selection
- focus
- locate/search state
- workflow source/target validity
- mode editability
- rack-selected context
- policy/default-role intent
- data confidence or uncertainty

Per-cell opacity/dim is not a canonical semantic channel for storage truth or interaction truth.

## Degraded / fallback truth rule

- Authoritative runtime storage truth is the only source allowed to render `empty`, `reserved`, `pick-active`, and `quarantined`.
- If runtime truth is missing and fallback occupancy positively asserts occupancy, render `occupied` and express uncertainty through a non-fill secondary marker.
- If runtime truth is missing and fallback occupancy does not positively assert occupancy, do not invent a storage fill.
- Fallback occupancy must never create a sixth fill class.
- Missing runtime truth must never be rendered as `empty`.

## View / Storage parity rule

For the same cell and the same underlying truth:

- `View` and `Storage` must render identical `base + fill`
- only overlays, panels, and action affordances may differ

`Layout` must not show storage truth as primary fill.

## Migration notes

- PR2 intentionally changes scene-data loading so `View` and `Storage` receive the same authoritative runtime truth.
- PR3 intentionally changes resolver ownership so fill/base/fallback semantics follow this contract.
- PR4 intentionally changes overlay normalization so overlay channels and precedence follow this contract.

