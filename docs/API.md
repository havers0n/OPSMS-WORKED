# API

Base URL is relative to `VITE_BFF_URL` in frontend config (default `/api` in local web build).

## Auth and headers

- All protected routes require Supabase bearer token in `Authorization` header.
- `GET /health` and `/ready` are unauthenticated.

## Health and identity

- `GET /health` — service health.
- `GET /ready` — checks DB connectivity.
- `GET /api/me` — authenticated user + membership context.

## Sites and layout context

- `GET /api/sites`
- `POST /api/sites`
- `GET /api/sites/:siteId/floors`

## Floors + layout draft/publish lifecycle

- `POST /api/floors`
- `GET /api/floors/:floorId/layout-draft`
- `GET /api/floors/:floorId/published-layout`
- `GET /api/floors/:floorId/workspace`
- `GET /api/floors/:floorId/published-cells`
- `GET /api/floors/:floorId/location-occupancy`
- `POST /api/layout-drafts`
- `POST /api/layout-drafts/save`
- `POST /api/layout-drafts/:layoutVersionId/validate`
- `POST /api/layout-drafts/:layoutVersionId/publish`

## Products and unit profile

- `GET /api/products`
- `GET /api/products/search`
- `GET /api/products/:productId`
- `GET /api/products/:productId/unit-profile`
- `PUT /api/products/:productId/unit-profile`
- `GET /api/products/:productId/packaging-levels`
- `POST /api/products/:productId/packaging-levels`
- `PUT /api/products/:productId/packaging-levels`
- `PATCH /api/products/:productId/packaging-levels/:levelId`
- `DELETE /api/products/:productId/packaging-levels/:levelId`

Storage preset domain in product context:

- `GET /api/products/:productId/storage-presets`
- `POST /api/products/:productId/storage-presets`
- `PATCH /api/products/:productId/storage-presets/:presetId`
- `PUT /api/locations/:locationId/sku-policies/:productId/storage-preset`
- `POST /api/storage-presets/:presetId/create-container`

## Containers and locations

- `GET /api/container-types`
- `GET /api/containers`
- `GET /api/containers/:containerId`
- `GET /api/containers/:containerId/location`
- `GET /api/containers/:containerId/storage`
- `GET /api/locations/:locationId/containers`
- `GET /api/locations/:locationId/storage`
- `POST /api/containers`
- `POST /api/containers/:containerId/remove`
- `POST /api/containers/:containerId/inventory`

## Placement and execution

- `POST /api/placement/place-at-location`
- `POST /api/containers/:containerId/move-to-location`
- `POST /api/containers/:containerId/swap`
- `POST /api/inventory/:inventoryUnitId/transfer`
- `POST /api/inventory/:inventoryUnitId/pick-partial`

## Orders / waves / picking

- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/:orderId`
- `POST /api/orders/:orderId/lines`
- `DELETE /api/orders/:orderId/lines/:lineId`
- `PATCH /api/orders/:orderId/status`
- `GET /api/orders/:orderId/execution`

- `GET /api/waves`
- `POST /api/waves`
- `GET /api/waves/:waveId`
- `PATCH /api/waves/:waveId/status`
- `POST /api/waves/:waveId/orders`
- `DELETE /api/waves/:waveId/orders/:orderId`

- `GET /api/pick-tasks/:taskId`
- `POST /api/pick-tasks/:taskId/allocate`
- `POST /api/pick-steps/:stepId/execute`
- `POST /api/picking-planning/preview`
- `POST /api/picking-planning/preview/orders`
- `POST /api/picking-planning/preview/wave`

## Location/product role endpoints

- `GET /api/locations/:locationId/product-assignments`
- `GET /api/locations/:locationId/effective-role`
- `POST /api/product-location-roles`
- `DELETE /api/product-location-roles/:roleId`

## Error behavior

- Validation failures should return `VALIDATION_ERROR`-style codes with field context.
- Domain failures are explicit (`*_NOT_FOUND`, conflict, state/permission failures).
- Mapping and status shape should remain stable; include codes in client handling.
