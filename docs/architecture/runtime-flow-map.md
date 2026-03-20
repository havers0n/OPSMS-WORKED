# Runtime Flow Map

This document turns the current warehouse-layout architecture into an executable runtime map.

It reflects the implementation that exists now across:

- `apps/web`
- `apps/bff`
- `apps/supabase`
- `packages/domain`

For each use case, the map names the actual trigger, frontend entrypoint, feature hook or local action, BFF endpoint, Supabase read/write path, returned shape, and concrete failure points.

## Login Flow

- Trigger: user submits the login form on `/login` or auth bootstrap auto-runs in dev mode.
- Frontend entrypoint: `pages/login/ui/login-page.tsx` -> `useAuth().signIn()` / `useAuth().signUp()`, then `app/providers/auth-provider.tsx`.
- Feature hook / action: `signInWithPassword()` or `signUpWithPassword()` in `shared/api/supabase/auth.ts`, then `resolveWorkspaceSession()` in `AuthProvider`.
- BFF endpoint: `GET /api/me`
- Supabase table / RPC:
  - Supabase Auth `auth.users`
  - `profiles`
  - `tenant_members`
  - `tenants`
  - no RPC
- Returned shape:

```ts
{
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  currentTenantId: string | null;
  memberships: Array<{
    tenantId: string;
    tenantCode: string;
    tenantName: string;
    role: 'platform_admin' | 'tenant_admin' | 'operator';
  }>;
}
```

1. `LoginPage.handleSubmit()` calls `signIn()` or `signUp()`.
2. The web client creates a Supabase Auth session through `supabase.auth.signInWithPassword()` or `supabase.auth.signUp()`.
3. `AuthProvider` resolves the authenticated user via `supabase.auth.getUser()`.
4. `AuthProvider.resolveWorkspaceSession()` calls `bffRequest('/me')`.
5. `bffRequest()` adds `Authorization: Bearer <access_token>` from the current Supabase session.
6. BFF `requireAuth()` validates the token through `anonClient.auth.getUser(accessToken)`.
7. BFF loads `profiles` and nested `tenant_members(tenants(...))`, chooses the current tenant, and returns the workspace session DTO.
8. `ProtectedRoute` now allows `AppShell` to render.

Failure points:

- Supabase Auth can reject invalid credentials, unconfirmed email, or signup failures.
- `AuthProvider` can fail to resolve a user immediately after sign-in and throw `Authenticated user session was not established.`
- `GET /api/me` returns `401` when the bearer token is missing or invalid.
- `GET /api/me` returns `403 WORKSPACE_UNAVAILABLE` when the profile row is missing or the user has no tenant membership.
- Tenant selection is implicit today: the BFF picks the first admin-like membership or the first membership; there is no explicit workspace picker yet.

## Workspace Bootstrap Flow

- Trigger: `WarehouseSetupPage` reaches `bootstrap_required` state and the user clicks `Create Site, Floor, and First Draft`.
- Frontend entrypoint: `widgets/warehouse-bootstrap/ui/bootstrap-wizard.tsx`
- Feature hook / action:
  - `useCreateSite()`
  - `useCreateFloor()`
  - `useCreateLayoutDraft()`
  - `setActiveSiteId()` / `setActiveFloorId()` in UI store
- BFF endpoint:
  - `POST /api/sites`
  - `POST /api/floors`
  - `POST /api/layout-drafts`
- Supabase table / RPC:
  - `sites` insert
  - `floors` insert
  - RPC `create_layout_draft(floor_uuid, actor_uuid)`
  - `create_layout_draft` writes `layout_versions` and, when a published version exists, clones `racks`, `rack_faces`, `rack_sections`, `rack_levels`
  - `operation_events` is written by the hardened RPC
- Returned shape:

```ts
// POST /api/sites
{ id: string }

// POST /api/floors
{ id: string }

// POST /api/layout-drafts
{ id: string } // layoutVersionId
```

1. `WarehouseSetupPage` renders `BootstrapWizard` when there are no sites yet.
2. `BootstrapWizard.handleBootstrap()` calls `createSite.mutateAsync(...)`.
3. `POST /api/sites` inserts a tenant-scoped row into `sites` using the current tenant from BFF auth context.
4. On success, the UI stores `activeSiteId`.
5. `createFloor.mutateAsync(...)` calls `POST /api/floors`.
6. BFF inserts the first row into `floors`.
7. On success, the UI stores `activeFloorId`.
8. `createDraft.mutateAsync(createdFloorId)` calls `POST /api/layout-drafts`.
9. BFF calls Supabase RPC `create_layout_draft(floor_uuid, actor_uuid)`.
10. Query invalidation refreshes the active draft query for the selected floor.
11. Once the draft query resolves, `WarehouseSetupPage` leaves bootstrap mode and the editor can render.

Failure points:

- `POST /api/sites` returns `403 WORKSPACE_UNAVAILABLE` if the authenticated user has no active tenant in BFF auth context.
- Tenant/site/floor RLS can block inserts for non-admin roles.
- Unique/foreign-key violations surface as `409 CONFLICT` or `409 CONSTRAINT_VIOLATION`.
- `create_layout_draft` returns an existing draft if one already exists, so bootstrap is not guaranteed to create a fresh version number.
- The flow only becomes editor-ready after the follow-up `GET /api/floors/:floorId/layout-draft` succeeds.

## Load Layout Draft Flow

- Trigger: user opens `/warehouse`, selects a floor in the top bar, or query invalidation refreshes the active draft.
- Frontend entrypoint:
  - `pages/warehouse-setup/ui/warehouse-setup-page.tsx`
  - `widgets/warehouse-editor/ui/warehouse-editor.tsx`
- Feature hook / action:
  - `useActiveLayoutDraft(activeFloorId)`
  - `initializeDraft(layoutDraft)` in editor store
- BFF endpoint: `GET /api/floors/:floorId/layout-draft`
- Supabase table / RPC:
  - `layout_versions`
  - `racks`
  - `rack_faces`
  - `rack_sections`
  - `rack_levels`
  - no RPC
- Returned shape:

```ts
type LayoutDraft = {
  layoutVersionId: string;
  floorId: string;
  state: 'draft' | 'published' | 'archived';
  rackIds: string[];
  racks: Record<string, Rack>;
} | null;
```

1. `WarehouseSetupPage` resolves site and floor context from `useSites()` and `useFloors(activeSiteId)`.
2. Once `activeFloorId` exists, `useActiveLayoutDraft(activeFloorId)` calls `GET /api/floors/:floorId/layout-draft`.
3. BFF reads all layout versions for the floor and picks the newest `state = 'draft'`.
4. BFF loads racks for that layout version.
5. If racks exist, BFF loads related `rack_faces`, `rack_sections`, and `rack_levels`.
6. BFF maps DB rows into the domain `LayoutDraft` DTO, including explicit lifecycle `state`, and validates it with `layoutDraftSchema`.
7. `WarehouseEditor` receives the query result and calls `initializeDraft(layoutDraft)` into Zustand.
8. Canvas and inspector now read from the local editor store, not directly from TanStack Query.

Failure points:

- No active draft is not an error here; the endpoint returns `null`.
- Missing token, invalid token, or tenant-scoped RLS can block the read path before the editor is initialized.
- Any select failure or mapper/schema parse failure bubbles as a BFF error and leaves the page in `error` state.
- `rack_faces.anchor` was removed from the active persistence/RPC contract because it was obsolete and duplicated semantics already carried by `slotNumberingDirection`.
- If the local draft is dirty and the same draft version is re-fetched, `initializeDraft()` intentionally keeps the dirty local state and ignores the refreshed server payload.

## Edit Rack Flow

- Trigger: user drags a rack on the canvas, rotates it, changes general properties, edits face sections/levels, or configures Face B mode.
- Frontend entrypoint:
  - `widgets/warehouse-editor/ui/editor-canvas.tsx`
  - `widgets/warehouse-editor/ui/rack-inspector.tsx`
  - `features/rack-configure/ui/general-tab.tsx`
  - `features/rack-configure/ui/face-tab.tsx`
  - `features/rack-create/ui/rack-creation-wizard.tsx`
- Feature hook / action:
  - `useUpdateRackPosition()`
  - `useRotateRack()`
  - `useUpdateRackGeneral()`
  - `useUpdateFaceConfig()`
  - `useAddSection()` / `useDeleteSection()`
  - `useUpdateSectionLength()` / `useUpdateSectionSlots()` / `useUpdateLevelCount()`
  - `useSetFaceBMode()` / `useResetFaceB()` / `useApplyFacePreset()`
  - local derived domain calls: `generatePreviewCells()` and `validateLayoutDraft()`
- BFF endpoint: none in this flow
- Supabase table / RPC: none in this flow
- Returned shape:

```ts
// No network response.
// The result is a local editor-store mutation:
{
  draft: LayoutDraft;
  isDraftDirty: true;
}

// Derived in inspector:
{
  rackCells: GeneratedCell[];
  validationResult: LayoutValidationResult;
}
```

1. The selected rack is read from the local Zustand draft.
2. Canvas actions update spatial fields such as `x`, `y`, and `rotationDeg`.
3. Inspector actions update structural fields such as `displayCode`, `kind`, sections, levels, slots, and Face B mode.
4. Each store action clones the local `draft`, writes the change, and flips `isDraftDirty = true`.
5. `RackInspector` computes local cell previews with `generatePreviewCells()` for the selected rack.
6. `RackInspector` computes local validation with `validateLayoutDraft()` and prefers cached server validation only when the draft is clean.
7. No server write happens here; persistence is deferred to `Save Draft Flow`.

Failure points:

- With no local draft loaded, most editor-store actions no-op.
- `updateRackPosition()` rejects moves that violate the configured minimum rack distance.
- Structural problems remain local until save, validate, or publish; the UI can show warnings while the DB remains unchanged.
- Browser refresh, sign-out, or context switch can discard edits that never went through `save_layout_draft`.
- This flow depends on the already-degraded in-memory rack-face shape, so fields missing from the domain contract cannot be preserved through edit/save round-trips.

## Save Draft Flow

- Trigger: user clicks `Save` in the top bar.
- Frontend entrypoint: `widgets/app-shell/ui/top-bar.tsx`
- Feature hook / action:
  - `useSaveLayoutDraft(activeFloorId)`
  - `saveLayoutDraft(layoutDraft)`
  - `mapLayoutDraftToSavePayload(layoutDraft)`
- BFF endpoint: `POST /api/layout-drafts/save`
- Supabase table / RPC:
  - RPC `save_layout_draft(layout_payload, actor_uuid)`
  - helper `validate_layout_payload(layout_payload)`
  - destructive rewrite of `racks`, `rack_faces`, `rack_sections`, `rack_levels`
  - `cells` cleared for the draft version
  - `operation_events` written by the RPC
- Returned shape:

```ts
// BFF response
{ layoutVersionId: string }

// Hook-level return
{
  layoutVersionId: string;
  savedDraft: LayoutDraft;
}
```

1. `TopBar.handleSaveDraft()` reads the current local `layoutDraft` from Zustand.
2. `useSaveLayoutDraft()` calls `saveLayoutDraft(layoutDraft)`.
3. The feature mapper flattens the domain draft into the transport payload expected by BFF.
4. `POST /api/layout-drafts/save` validates the request body with Zod.
5. BFF calls Supabase RPC `save_layout_draft(layout_payload, actor_uuid)`.
6. The RPC validates the JSON payload shape and rejects malformed or duplicate IDs.
7. The RPC deletes existing draft-side cells and all structural rows under the draft version.
8. The RPC reinserts racks, faces, sections, and levels from the payload.
9. BFF returns `{ layoutVersionId }`.
10. On success, the frontend marks the draft saved, clears cached validation for that layout version, and invalidates the active draft query.

Failure points:

- The save button is disabled unless the app has an active floor, a local draft, and a live draft loaded for the same version.
- BFF request-body validation can fail before any RPC call.
- `save_layout_draft` rejects payloads for non-draft layout versions and malformed mirrored-face structures.
- `anchor` is no longer part of the save contract; unchanged layout drafts now round-trip without an extra synthetic field.
- The RPC is a destructive rewrite path: any field not present in the payload is dropped from persisted draft state on the next successful save.

## Validate Flow

- Trigger: user clicks `Validate` in the top bar.
- Frontend entrypoint: `widgets/app-shell/ui/top-bar.tsx`
- Feature hook / action:
  - `useLayoutValidation(layoutVersionId)`
  - `validateLayoutVersion(layoutVersionId)`
  - query cache key `layoutValidationKeys.byLayoutVersion(layoutVersionId)`
- BFF endpoint: `POST /api/layout-drafts/:layoutVersionId/validate`
- Supabase table / RPC:
  - RPC `validate_layout_version(layout_version_uuid)`
  - reads `racks`, `rack_faces`, `rack_sections`, `rack_levels`
  - may write failed validation events to `operation_events`
- Returned shape:

```ts
{
  isValid: boolean;
  issues: Array<{
    code: string;
    severity: 'error' | 'warning';
    message: string;
    entityId?: string;
  }>;
}
```

1. `TopBar.handleValidate()` calls `validateLayout.mutateAsync(layoutDraft.layoutVersionId)`.
2. The feature sends `POST /api/layout-drafts/:layoutVersionId/validate`.
3. BFF calls Supabase RPC `validate_layout_version(layout_version_uuid)`.
4. The RPC checks rack-level invariants such as Face A presence, enabled faces, mirrored-face consistency, section-length sums, missing levels, and duplicate generated addresses.
5. BFF maps the RPC result into the domain validation DTO and returns it.
6. The mutation stores the result in TanStack Query cache for this layout version.
7. The top bar shows status text, and the inspector reuses the cached server validation while the draft stays clean.

Failure points:

- Transport/auth failures still behave like normal BFF errors.
- Semantic validation problems do not raise HTTP errors; they come back as `200` with `isValid: false`.
- The current RPC does not explicitly fail when `layoutVersionId` does not exist or is stale; a bad UUID can produce a misleading empty-success result.
- Once the draft becomes dirty again, the UI falls back to client-side preview validation until a new server validation is requested.

## Publish Flow

- Trigger: user clicks `Publish` in the top bar.
- Frontend entrypoint: `widgets/app-shell/ui/top-bar.tsx`
- Feature hook / action:
  - `usePublishLayout(activeFloorId)`
  - `publishLayoutVersion(layoutVersionId)`
- BFF endpoint: `POST /api/layout-drafts/:layoutVersionId/publish`
- Supabase table / RPC:
  - RPC `publish_layout_version(layout_version_uuid, actor_uuid)`
  - advisory floor lock
  - nested call to `validate_layout_version(layout_version_uuid)`
  - `regenerate_layout_cells(layout_version_uuid)`
  - updates `layout_versions`
  - updates `racks`
  - writes `cells`
  - writes `operation_events`
- Returned shape:

```ts
{
  layoutVersionId: string;
  publishedAt: string;
  generatedCells: number;
  validation: {
    isValid: boolean;
    issues: LayoutValidationIssue[];
  };
}
```

1. `TopBar.handlePublish()` calls `publishLayout.mutateAsync(layoutDraft.layoutVersionId)`.
2. The feature sends `POST /api/layout-drafts/:layoutVersionId/publish`.
3. BFF calls Supabase RPC `publish_layout_version(layout_version_uuid, actor_uuid)`.
4. The RPC locks the floor, verifies the target version still exists and is still `draft`, then runs validation.
5. If validation passes, the RPC regenerates all cells for the layout version.
6. The previous published layout for the floor is archived.
7. The target draft is promoted to `published`, and its racks are marked `published`.
8. The RPC returns publish metadata including `generatedCells` and the nested validation result.
9. The frontend invalidates the active draft query for the floor.
10. The floor now has no active draft until the user starts a new draft cycle.

Failure points:

- The publish button is disabled while the draft is dirty, while no live draft is loaded, or while another action is in flight.
- `publish_layout_version` fails if the layout version is missing, is no longer `draft`, or fails validation.
- Validation and publish SQL exceptions are currently normalized by BFF as generic `SUPABASE_ERROR` responses, so the client loses structured failure reasons on transport errors.
- Successful publish does not open a new draft automatically; the next edit session depends on a separate `create_layout_draft` call.
