# PR-02 HTTP Contract Freeze (Write Endpoints)

## Scope

PR-02 freezes the **current** external HTTP contract for BFF write endpoints via automated tests.

This PR is intentionally **contract-freeze only**:
- no runtime behavior changes
- no SQL/RPC behavior changes
- no business logic moves
- no route/error normalization

## Frozen Write Endpoints

- `POST /api/sites`
- `POST /api/containers`
- `POST /api/containers/:containerId/remove`
- `POST /api/placement/place-at-location`
- `POST /api/containers/:containerId/move-to-location`
- `POST /api/containers/:containerId/inventory`
- `POST /api/inventory/:inventoryUnitId/transfer`
- `POST /api/inventory/:inventoryUnitId/pick-partial`
- `POST /api/floors`
- `POST /api/layout-drafts`
- `POST /api/layout-drafts/save`
- `POST /api/layout-drafts/:layoutVersionId/validate`
- `POST /api/layout-drafts/:layoutVersionId/publish`
- `POST /api/orders`
- `POST /api/orders/:orderId/lines`
- `DELETE /api/orders/:orderId/lines/:lineId`
- `PATCH /api/orders/:orderId/status`
- `POST /api/waves`
- `PATCH /api/waves/:waveId/status`
- `POST /api/waves/:waveId/orders`
- `DELETE /api/waves/:waveId/orders/:orderId`

## What Is Protected by Tests

For the endpoints above, tests explicitly lock current behavior for:
- success status codes
- key error status codes
- stable error code names
- response body shape (success and key domain errors)

## Known Inconsistencies (Intentionally Unchanged)

The following are documented and frozen as current behavior in PR-02. They are **not** fixed here:

- `CONTAINER_NOT_FOUND` vs generic `NOT_FOUND`
- generic `P0001` fallback mapped to `PLACEMENT_CONFLICT`
- `ORDER_NOT_MANAGEABLE` / `WAVE_NOT_MANAGEABLE` not normalized
- inactive product sometimes mapped as `NOT_FOUND`
- mixed `200/201/204` command response statuses

## Follow-Up

Contract consistency and normalization are deferred to later refactor PRs (PR-05/06/07/08/09/11) after behavior is protected by this regression safety net.
