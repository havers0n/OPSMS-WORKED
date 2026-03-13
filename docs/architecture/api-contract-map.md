# API Contract Map

This document is the contract index for the current BFF surface in `apps/bff`.

It answers, for each endpoint:

- purpose
- request schema
- response schema
- auth requirement
- domain owner
- source of truth
- side effects
- idempotency / non-idempotency
- related RPC/tables
- primary failure cases

## Scope

Included here:

- all currently implemented BFF endpoints in `apps/bff/src/app.ts`
- both product endpoints under `/api/*` and operational probes (`/health`, `/ready`)

Not included here:

- future import / readiness / picking APIs that do not exist yet
- direct Supabase table access from the frontend (the current web app uses the BFF)

## Common Contract Rules

### Transport

- Transport is JSON over HTTP.
- The BFF is a thin orchestration layer over Supabase tables and RPC.
- Postgres + Supabase RLS remain the authoritative enforcement layer for data truth and authorization scope.

### Authentication

- All `/api/*` endpoints require `Authorization: Bearer <supabase-access-token>`.
- BFF auth resolution loads:
  - Supabase Auth user
  - `public.profiles`
  - `public.tenant_members`
  - `public.tenants`
- Requests without a valid bearer token fail with `401 UNAUTHORIZED`.
- Requests for users without a tenant workspace fail with `403 WORKSPACE_UNAVAILABLE`.

### Error Envelope

All BFF route errors use the shared error schema:

```json
{
  "code": "STRING_CODE",
  "message": "Human readable message",
  "requestId": "uuid-like request id",
  "errorId": "uuid"
}
```

Common mapped cases:

- `400 VALIDATION_ERROR`: request/path/body does not match BFF schema
- `401 UNAUTHORIZED`: missing or invalid bearer token
- `403 FORBIDDEN`: RLS / permission failure
- `403 WORKSPACE_UNAVAILABLE`: authenticated user has no active tenant workspace
- `404 NOT_FOUND`: missing single-row resource where Supabase returned `PGRST116`
- `409 CONFLICT`: unique constraint violation
- `409 CONSTRAINT_VIOLATION`: FK or related integrity violation
- `502 SUPABASE_ERROR`: uncategorized DB/RPC error propagated through BFF

### Ownership Model

Domain owners below use the bounded-context names from [`docs/architecture/system-overview.md`](C:\Projects\abctestsforWOS\docs\architecture\system-overview.md):

- `Platform / Service Health`
- `Identity & Access`
- `Warehouse Topology`
- `Layout Lifecycle`
- `Rack Configuration & Addressing`

### Important Note About Request Validation

- BFF request schemas validate transport shape.
- Several semantic constraints are enforced only in Postgres, not in Zod.
- Example: `save_layout_draft` accepts strings at the BFF layer, but DB checks/RPC validation still enforce valid rack kinds, axes, face rules, uniqueness, and address-generation invariants.

## Operational Endpoints

### `GET /health`

Purpose:

- lightweight liveness probe for the BFF process

Domain owner:

- `Platform / Service Health`

Auth requirement:

- none

Request schema:

- no body
- no query params

Response schema:

```json
{
  "status": "ok",
  "service": "string",
  "time": "ISO timestamp"
}
```

Source of truth:

- BFF process state
- current server clock

Related RPC/tables:

- none

Side effects:

- none

Idempotency:

- idempotent

Failure cases:

- unexpected BFF runtime failure

### `GET /ready`

Purpose:

- readiness probe that verifies the BFF can reach Supabase

Domain owner:

- `Platform / Service Health`

Auth requirement:

- none

Request schema:

- no body
- no query params

Response schema:

```json
{
  "status": "ready",
  "service": "string",
  "checks": {
    "supabase": "ok"
  }
}
```

Source of truth:

- anonymous Supabase probe against `public.sites`

Related RPC/tables:

- table `public.sites` for connectivity check only

Side effects:

- none

Idempotency:

- idempotent

Failure cases:

- Supabase connectivity failure
- DB unavailable or misconfigured credentials
- returns `503 BFF_NOT_READY`

## Application Endpoints

### `GET /api/sites`

Purpose:

- list sites visible in the authenticated tenant scope

Domain owner:

- `Warehouse Topology`

Auth requirement:

- authenticated tenant member
- effective read access is tenant-scoped through BFF auth context plus RLS on `public.sites`

Request schema:

- no body
- no query params

Response schema:

- `sitesResponseSchema`
- array of `Site`

```json
[
  {
    "id": "uuid",
    "code": "string",
    "name": "string",
    "timezone": "string"
  }
]
```

Source of truth:

- table `public.sites`

Related RPC/tables:

- `public.sites`
- auth context from `public.profiles`, `public.tenant_members`, `public.tenants`

Side effects:

- none

Idempotency:

- idempotent

Failure cases:

- missing / invalid bearer token
- no tenant membership
- tenant-scope denial by RLS
- unexpected Supabase read failure

### `GET /api/me`

Purpose:

- resolve the current authenticated workspace/session contract for the frontend

Domain owner:

- `Identity & Access`

Auth requirement:

- authenticated tenant member

Request schema:

- no body
- no query params

Response schema:

- `currentWorkspaceResponseSchema`

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "string"
  },
  "currentTenantId": "uuid | null",
  "memberships": [
    {
      "tenantId": "uuid",
      "tenantCode": "string",
      "tenantName": "string",
      "role": "platform_admin | tenant_admin | operator"
    }
  ]
}
```

Source of truth:

- Supabase Auth user identity
- `public.profiles`
- `public.tenant_members`
- `public.tenants`

Related RPC/tables:

- Supabase Auth `auth.getUser`
- `public.profiles`
- `public.tenant_members`
- `public.tenants`

Side effects:

- none

Idempotency:

- idempotent

Failure cases:

- missing / invalid bearer token
- authenticated user has no profile row
- authenticated user has no tenant membership

### `POST /api/sites`

Purpose:

- create a site in the caller's current tenant workspace

Domain owner:

- `Warehouse Topology`

Auth requirement:

- authenticated tenant member with tenant write access
- in practice this means `currentTenant` must exist and DB insert must satisfy `can_manage_tenant(tenant_id)`

Request schema:

- body `createSiteBodySchema`

```json
{
  "code": "string",
  "name": "string",
  "timezone": "string"
}
```

- actor and tenant are implied from bearer token / workspace resolution

Response schema:

- `idResponseSchema`

```json
{
  "id": "uuid"
}
```

Source of truth:

- inserted row in `public.sites`

Related RPC/tables:

- `public.sites`
- auth context from `public.profiles`, `public.tenant_members`, `public.tenants`

Side effects:

- inserts a new site row
- assigns the site to the caller's resolved current tenant

Idempotency:

- non-idempotent
- repeated successful calls create multiple sites unless blocked by uniqueness on `sites.code`

Failure cases:

- invalid body shape
- no active tenant workspace on the auth context
- duplicate site code
- tenant write-access denial

### `GET /api/sites/:siteId/floors`

Purpose:

- list floors for one site

Domain owner:

- `Warehouse Topology`

Auth requirement:

- authenticated tenant member with read access to the target site

Request schema:

- path param `siteId: uuid`
- validated via `idResponseSchema`

Response schema:

- `floorsResponseSchema`
- array of `Floor`

```json
[
  {
    "id": "uuid",
    "siteId": "uuid",
    "code": "string",
    "name": "string",
    "sortOrder": 0
  }
]
```

Source of truth:

- table `public.floors`

Related RPC/tables:

- `public.floors`
- `public.sites` indirectly via site-scope helpers / RLS

Side effects:

- none

Idempotency:

- idempotent

Failure cases:

- invalid `siteId`
- missing / invalid bearer token
- site access denied by RLS
- unexpected Supabase read failure

### `POST /api/floors`

Purpose:

- create a floor inside an existing site

Domain owner:

- `Warehouse Topology`

Auth requirement:

- authenticated tenant member with write access to the target site
- enforced by insert policy on `public.floors` via `can_manage_site(site_id)`

Request schema:

- body `createFloorBodySchema`

```json
{
  "siteId": "uuid",
  "code": "string",
  "name": "string",
  "sortOrder": 0
}
```

Response schema:

- `idResponseSchema`

```json
{
  "id": "uuid"
}
```

Source of truth:

- inserted row in `public.floors`

Related RPC/tables:

- `public.floors`
- `public.sites` through FK and site-scope auth helpers

Side effects:

- inserts a new floor row

Idempotency:

- non-idempotent
- repeated successful calls create multiple floors unless blocked by `(site_id, code)` uniqueness

Failure cases:

- invalid body shape
- target site does not exist
- duplicate floor code within the same site
- site write-access denial

### `GET /api/floors/:floorId/layout-draft`

Purpose:

- load the current active draft for a floor, expanded into the frontend draft model

Domain owner:

- `Layout Lifecycle`

Auth requirement:

- authenticated tenant member with read access to the target floor / draft

Request schema:

- path param `floorId: uuid`
- validated via `idResponseSchema`

Response schema:

- `layoutDraftResponseSchema`
- `LayoutDraft | null`

```json
{
  "layoutVersionId": "uuid",
  "floorId": "uuid",
  "rackIds": ["uuid"],
  "racks": {
    "rack-id": {
      "id": "uuid",
      "displayCode": "string",
      "kind": "single | paired",
      "axis": "NS | WE",
      "x": 0,
      "y": 0,
      "totalLength": 1.0,
      "depth": 1.0,
      "rotationDeg": 0,
      "faces": [
        {
          "id": "uuid",
          "side": "A | B",
          "enabled": true,
          "slotNumberingDirection": "ltr | rtl",
          "isMirrored": false,
          "mirrorSourceFaceId": null,
          "sections": [
            {
              "id": "uuid",
              "ordinal": 1,
              "length": 1.0,
              "levels": [
                {
                  "id": "uuid",
                  "ordinal": 1,
                  "slotCount": 1
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

- returns `null` when the floor has no active draft

Source of truth:

- latest `public.layout_versions` row for the floor with `state = 'draft'`
- associated rack tree in `public.racks`, `public.rack_faces`, `public.rack_sections`, `public.rack_levels`

Related RPC/tables:

- `public.layout_versions`
- `public.racks`
- `public.rack_faces`
- `public.rack_sections`
- `public.rack_levels`

Side effects:

- none

Idempotency:

- idempotent

Failure cases:

- invalid `floorId`
- floor access denied
- underlying draft tree read failure

### `GET /api/floors/:floorId/published-layout`

Purpose:

- return the latest published layout summary for a floor

Domain owner:

- `Layout Lifecycle`

Auth requirement:

- authenticated tenant member with read access to the target floor

Request schema:

- path param `floorId: uuid`
- validated via `idResponseSchema`

Response schema:

- `publishedLayoutSummaryResponseSchema`
- `PublishedLayoutSummary | null`

```json
{
  "layoutVersionId": "uuid",
  "floorId": "uuid",
  "versionNo": 3,
  "publishedAt": "ISO timestamp",
  "cellCount": 8,
  "sampleAddresses": ["03-A.01.01.01"]
}
```

- returns `null` when the floor has no published layout

Source of truth:

- latest `public.layout_versions` row for the floor with `state = 'published'`
- `public.cells` for count and sample addresses

Related RPC/tables:

- `public.layout_versions`
- `public.cells`

Side effects:

- none

Idempotency:

- idempotent

Failure cases:

- invalid `floorId`
- floor access denied
- published version read failure
- cell summary read failure

### `POST /api/layout-drafts`

Purpose:

- open the editable draft cycle for a floor
- if a draft already exists for that floor, return it instead of creating another

Domain owner:

- `Layout Lifecycle`

Auth requirement:

- authenticated tenant member with write access to the target floor

Request schema:

- body `createLayoutDraftBodySchema`

```json
{
  "floorId": "uuid"
}
```

- actor is implied from bearer token and passed to RPC as `actor_uuid`

Response schema:

- `idResponseSchema`

```json
{
  "id": "uuid"
}
```

Source of truth:

- RPC `public.create_layout_draft(floor_uuid, actor_uuid)`

Related RPC/tables:

- RPC `public.create_layout_draft`
- tables `public.layout_versions`, `public.racks`, `public.rack_faces`, `public.rack_sections`, `public.rack_levels`
- audit table `public.operation_events`

Side effects:

- creates a new draft `layout_versions` row if none exists
- clones the currently published rack tree into the new draft when a published version exists
- writes `layout_draft_created` audit event

Idempotency:

- conditionally idempotent per floor while an active draft already exists
- repeated calls for the same floor return the existing draft id
- after the existing draft is published/closed, the next call creates a new draft version

Failure cases:

- invalid body shape
- floor not found
- floor write-access denial
- unique/race conflicts around one-draft-per-floor invariant

### `POST /api/layout-drafts/save`

Purpose:

- persist the current editor draft payload into the active draft layout version

Domain owner:

- `Layout Lifecycle`
- `Rack Configuration & Addressing`

Auth requirement:

- authenticated tenant member with write access to the target draft layout version

Request schema:

- body `saveLayoutDraftBodySchema`

```json
{
  "layoutDraft": {
    "layoutVersionId": "uuid",
    "racks": [
      {
        "id": "uuid",
        "displayCode": "string",
        "kind": "string",
        "axis": "string",
        "x": 0,
        "y": 0,
        "totalLength": 1.0,
        "depth": 1.0,
        "rotationDeg": 0,
        "faces": [
          {
            "id": "uuid",
            "side": "string",
            "enabled": true,
            "slotNumberingDirection": "string",
            "isMirrored": false,
            "mirrorSourceFaceId": "uuid | null",
            "sections": [
              {
                "id": "uuid",
                "ordinal": 1,
                "length": 1.0,
                "levels": [
                  {
                    "id": "uuid",
                    "ordinal": 1,
                    "slotCount": 1
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Response schema:

- `layoutVersionIdResponseSchema`

```json
{
  "layoutVersionId": "uuid"
}
```

Source of truth:

- RPC `public.save_layout_draft(layout_payload, actor_uuid)`

Related RPC/tables:

- RPC `public.save_layout_draft`
- helper validation `public.validate_layout_payload`
- tables `public.layout_versions`, `public.racks`, `public.rack_faces`, `public.rack_sections`, `public.rack_levels`, `public.cells`
- audit table `public.operation_events`

Side effects:

- destructively rewrites the draft rack tree for the target `layoutVersionId`
- deletes existing draft cells
- deletes existing `rack_levels`, `rack_sections`, `rack_faces`, `racks` for that draft
- reinserts the submitted rack tree using client-provided ids
- writes `layout_draft_saved` audit event with success/failure status

Idempotency:

- not strictly idempotent
- identical payloads usually converge to the same persisted rack tree and same returned `layoutVersionId`
- still operationally non-idempotent because each call performs a destructive rewrite and writes a fresh audit event

Failure cases:

- invalid body shape
- missing `layoutVersionId`
- target layout version is not an active draft
- duplicate rack ids or duplicate rack display codes in payload
- duplicate face ids or duplicate face sides within a rack
- invalid mirrored-face configuration
- non-positive section length
- `slotCount < 1`
- DB enum/check/FK/unique violations on rack tree insert
- draft write-access denial

### `POST /api/layout-drafts/:layoutVersionId/validate`

Purpose:

- validate one layout version for publish readiness and structural correctness

Domain owner:

- `Layout Lifecycle`
- `Rack Configuration & Addressing`

Auth requirement:

- authenticated tenant member
- intended access scope is read access to the target layout version
- effective enforcement depends on BFF auth plus invoker-scoped DB visibility/RLS

Request schema:

- path param `layoutVersionId: uuid`
- validated via `idResponseSchema`

Response schema:

- `validationResponseSchema`

```json
{
  "isValid": true,
  "issues": [
    {
      "code": "string",
      "severity": "error | warning",
      "message": "string",
      "entityId": "uuid?"
    }
  ]
}
```

Source of truth:

- RPC `public.validate_layout_version(layout_version_uuid)`

Related RPC/tables:

- RPC `public.validate_layout_version`
- tables `public.racks`, `public.rack_faces`, `public.rack_sections`, `public.rack_levels`
- address-generation helpers used during duplicate-address checks
- audit table `public.operation_events` when validation fails

Side effects:

- no persisted layout mutation
- when validation fails, RPC writes `layout_validation` failed audit event

Idempotency:

- state-idempotent for the layout itself
- operationally non-idempotent for invalid layouts because repeated failed calls append repeated audit events

Failure cases:

- invalid `layoutVersionId`
- inaccessible or missing layout version
- validation blockers such as:
  - missing enabled Face A
  - no enabled faces
  - paired/single face configuration violations
  - mirror-source inconsistencies
  - missing sections or levels
  - section-length mismatch
  - duplicate generated addresses

### `POST /api/layout-drafts/:layoutVersionId/publish`

Purpose:

- publish a validated layout version and make it the authoritative spatial truth for its floor

Domain owner:

- `Layout Lifecycle`
- `Rack Configuration & Addressing`

Auth requirement:

- authenticated tenant member with write/publish access to the target floor/layout version

Request schema:

- path param `layoutVersionId: uuid`
- validated via `idResponseSchema`
- actor is implied from bearer token

Response schema:

- `publishResponseSchema`

```json
{
  "layoutVersionId": "uuid",
  "publishedAt": "ISO timestamp",
  "generatedCells": 4,
  "validation": {
    "isValid": true,
    "issues": []
  }
}
```

Source of truth:

- RPC `public.publish_layout_version(layout_version_uuid, actor_uuid)`

Related RPC/tables:

- RPC `public.publish_layout_version`
- RPC `public.validate_layout_version`
- helper `public.regenerate_layout_cells`
- tables `public.layout_versions`, `public.racks`, `public.rack_faces`, `public.rack_sections`, `public.rack_levels`, `public.cells`
- audit table `public.operation_events`

Side effects:

- validates the target layout version
- deletes and regenerates cells for the published version
- archives the previous published version for the same floor
- marks the target draft as `published`
- stamps `published_at` and `published_by`
- marks racks in that version as `published`
- writes `layout_publish` audit event
- may write `layout_archived` audit event for the replaced published version

Idempotency:

- non-idempotent
- a successful publish changes lifecycle state and archive state
- repeating the same publish call on the now-published version fails because it is no longer an active draft

Failure cases:

- invalid `layoutVersionId`
- layout version not found
- target layout version is not an active draft
- floor/layout publish access denial
- validation blockers
- duplicate/generated address conflicts
- race on draft state transition
- downstream cell-regeneration or audit-write failure

## Quick Matrix

| Endpoint | Domain owner | Auth | Source of truth | Side effects | Idempotency |
|----------|--------------|------|-----------------|--------------|-------------|
| `GET /health` | Platform / Service Health | none | BFF process | none | idempotent |
| `GET /ready` | Platform / Service Health | none | Supabase connectivity probe | none | idempotent |
| `GET /api/sites` | Warehouse Topology | authenticated read | `public.sites` | none | idempotent |
| `GET /api/me` | Identity & Access | authenticated | Auth + `profiles` + memberships | none | idempotent |
| `POST /api/sites` | Warehouse Topology | authenticated write | `public.sites` | insert site | non-idempotent |
| `GET /api/sites/:siteId/floors` | Warehouse Topology | authenticated read | `public.floors` | none | idempotent |
| `POST /api/floors` | Warehouse Topology | authenticated write | `public.floors` | insert floor | non-idempotent |
| `GET /api/floors/:floorId/layout-draft` | Layout Lifecycle | authenticated read | `layout_versions` + rack tree | none | idempotent |
| `GET /api/floors/:floorId/published-layout` | Layout Lifecycle | authenticated read | `layout_versions` + `cells` | none | idempotent |
| `POST /api/layout-drafts` | Layout Lifecycle | authenticated write | `create_layout_draft` RPC | create/clone draft + audit | conditionally idempotent |
| `POST /api/layout-drafts/save` | Layout Lifecycle + Rack Configuration & Addressing | authenticated write | `save_layout_draft` RPC | destructive rewrite + audit | operationally non-idempotent |
| `POST /api/layout-drafts/:layoutVersionId/validate` | Layout Lifecycle + Rack Configuration & Addressing | authenticated read | `validate_layout_version` RPC | failed-validation audit only | state-idempotent, operationally non-idempotent when invalid |
| `POST /api/layout-drafts/:layoutVersionId/publish` | Layout Lifecycle + Rack Configuration & Addressing | authenticated write | `publish_layout_version` RPC | validate, archive, publish, generate cells, audit | non-idempotent |
