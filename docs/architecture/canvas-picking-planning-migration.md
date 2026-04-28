# Canvas Picking Planning Migration

## Decision

Picking planning now enters through the warehouse Canvas, not through direct
order-detail or wave-detail actions.

The old `useOpenPickingPlan` navigation helper and the direct `Plan picking` /
`Plan wave` buttons on order and wave detail pages are intentionally removed.
Those pages remain lifecycle, status, line/order, and execution-detail surfaces.
They should not reintroduce direct planning buttons.

## Current entrypoint

Operators open the warehouse workspace and switch the Canvas stage to
`Picking plan` with `ViewStageSwitcher`.

Relevant frontend surfaces:

- `apps/web/src/widgets/app-shell/ui/view-stage-switcher.tsx`
- `apps/web/src/widgets/warehouse-editor/ui/picking-planning-overlay.tsx`
- `apps/web/src/features/picking-planning-canvas`
- `apps/web/src/entities/picking-planning`

The Canvas overlay owns picking-plan preview, route-step review, selection, and
route geometry evidence. This keeps spatial planning attached to the warehouse
map instead of scattering planning launch actions across order and wave detail
pages.

## Review notes

- Deleting order/wave direct planning tests is part of the migration because
  those tests asserted removed entrypoints.
- This migration does not remove order, wave, or pick-task detail routes.
- This migration does not change BFF planning contracts or database behavior.
- Future picking/planning UI should extend the Canvas overlay or its feature
  slice, not recreate the old `useOpenPickingPlan` flow.
