# Legacy Route Removal Matrix

Stage 7 handoff artifact. Each row has an explicit Stage 8 decision.

| Route | Who uses it now | First-party migrated? | External risk | Stage 8 removal candidate? |
|---|---|---|---|---|
| `GET /api/cells/:cellId/containers` | Was used by `cell-placement-inspector.tsx`. Migrated to `/api/locations/by-cell/:cellId` + `/api/locations/:locationId/containers`. | Yes | None known | **Yes** — remove in Stage 8 once no external callers confirmed |
| `GET /api/cells/:cellId/storage` | Was used by `cell-placement-inspector.tsx`. Migrated to `useLocationStorage`. | Yes | None known | **Yes** — remove in Stage 8 once no external callers confirmed |
| `GET /api/floors/:floorId/cell-occupancy` | Was used by `editor-canvas.tsx`. Migrated to `useFloorLocationOccupancy`. | Yes | Possible external integrator risk — floor-level occupancy is a common polling target | **Keep temporarily** — verify no external consumers before Stage 8 removal |
| `GET /api/rack-sections/:sectionId/slots/:slotNo/storage` | Used by `useCellSlotStorage` in placement-mode rack inspector (geometry/editor concern, not execution). | No — intentionally kept for editor slot inspection | None known | **Keep temporarily** — editor still needs slot-based storage lookup; reassess after editor architecture is stable |
| `POST /api/containers/:containerId/move` | Was used by `use-move-container.ts` (first-party). First-party now uses `/api/containers/:containerId/move-to-location`. | Yes | High risk — most likely to be called by external WMS integrators using cell IDs | **Keep temporarily** — highest external risk; do not remove until all known integrators confirm migration to `move-to-location` |

## Notes

- All routes above now emit `Deprecation: true`, `Warning: 299`, and `Link` headers pointing to successor routes.
- Translation logic lives exclusively in `apps/bff/src/features/legacy-execution-gateway/service.ts`.
- No write behavior bypasses canonical move in Stage 7.
- Stage 8 may remove rows marked "Yes" after verifying no external usage in logs/monitoring.
