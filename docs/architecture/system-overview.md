# System Overview

This document is the primary high-level map of the system. It should help an agent quickly answer four questions:

1. What are the main bounded contexts?
2. Which subsystem owns which responsibility?
3. How does data move through the system?
4. Which invariants must not be violated?

The repo is a monorepo with three main runtime parts:

- `apps/web`: React frontend and warehouse editor UI
- `apps/bff`: thin Fastify BFF used by the frontend
- `apps/supabase`: authoritative database, SQL migrations, RPC, RLS

Shared business contracts and pure logic live in `packages/domain`.

## Architectural style

- frontend: pragmatic Feature-Sliced Design (`app/pages/widgets/features/entities/shared`)
- frontend state: TanStack Query for server state, Zustand for editor/UI state, pure domain logic in `@wos/domain`
- frontend rendering: SPA with React 19, Vite, Tailwind, React Konva for spatial editing
- backend: modular service architecture with a thin BFF over Supabase
- data: Postgres in Supabase is the authoritative persistence layer
- database logic: SQL migrations + RPC/functions + RLS policies
- transport: REST over the BFF for application workflows; Supabase Auth session/token flow for identity
- realtime: not a primary runtime path yet; architecture leaves room for Supabase realtime/event-driven extensions later
- repo style: modular monorepo with explicit separation between UI, domain contracts, backend gateway, and persistence

## Main domains

### 1. Identity & Access

Owns authentication, user profile, tenant membership, workspace selection, and authorization scope.

Core concepts:

- `auth.users` in Supabase Auth
- `profiles`
- `tenants`
- `tenant_members`
- roles such as `platform_admin`, `tenant_admin`, `operator`

### 2. Warehouse Topology

Owns the physical warehouse hierarchy and operational workspace container.

Core concepts:

- `Site`
- `Floor`

### 3. Layout Lifecycle

Owns editable and published spatial structure of the warehouse.

Core concepts:

- `LayoutVersion`
- draft/publish/archive lifecycle
- layout validation
- publish impact

### 4. Rack Configuration & Addressing

Owns rack structure, face configuration, section/level/slot semantics, and generated addresses.

Core concepts:

- `Rack`
- `RackFace`
- `RackSection`
- `RackLevel`
- `Cell`

### 5. Storage Truth

Owns physical storage semantics and must stay separate from layout editing and picking shortcuts.

Core concepts:

- `Location`
- `ContainerType`
- `Container`
- `InventoryUnit`
- `Movement`

### 6. Product Master & Operational Location Roles

Owns SKU master data and operational mapping of products to cells.

Core concepts:

- `Product`
- `ProductLocationRole`
- roles such as `primary_pick` and `reserve`

### 7. Imports & Lineage

Owns ingestion of external files into staging and controlled publish into operational tables.

Core concepts:

- `ImportJob`
- staging rows
- source lineage fields

### 8. Operations Readiness & Picking

Owns readiness derivation, task creation, and picker execution history.

Core concepts:

- `StockSnapshot`
- `Order`
- `OrderLine`
- `PickTask`
- `PickItem`
- `OperationEvent`

## Main subsystems

### Editor UI

Lives in `apps/web`.

Responsibilities:

- app shell, routing, auth bootstrap
- warehouse bootstrap flow
- warehouse editor canvas
- rack inspector
- local editor interactions such as select, place, drag, rotate, duplicate

Important boundary:

- canvas provides spatial context
- inspector owns structural editing

### Frontend Domain API Layer

Lives in `apps/web/src/entities/*/api`, `apps/web/src/features/*/api`, and `apps/web/src/shared/api`.

Responsibilities:

- fetch via BFF
- map transport/database payloads into domain objects
- keep generated Supabase row types inside API boundaries

### BFF / Application Gateway

Lives in `apps/bff`.

Responsibilities:

- authenticate requests using Supabase bearer token
- resolve current tenant workspace
- expose REST endpoints for web flows
- call Supabase tables and RPC functions
- normalize errors and log request lifecycle

Important characteristic:

- the BFF is intentionally thin
- business truth still lives in Postgres/RPC/domain contracts, not in the BFF

### Domain Package

Lives in `packages/domain`.

Responsibilities:

- canonical schemas and enums
- pure layout generation and validation logic
- stable contracts shared across frontend and BFF

Examples:

- layout draft schema
- rack schema
- generated cells
- layout validation rules

### Persistence & Database Logic

Lives in `apps/supabase`.

Responsibilities:

- table schema
- foreign keys and constraints
- RPC for transactional domain actions
- RLS for tenant-scoped access
- SQL tests for lifecycle invariants

### Auth & Authorization

Implemented across Supabase Auth, profile/membership tables, RLS helpers, and BFF auth middleware.

Responsibilities:

- session validation
- user-to-profile resolution
- tenant membership lookup
- tenant/site/floor/layout scoped access checks

## Dependent services

### External managed services

- Supabase Auth: authentication and session tokens
- Supabase Postgres: authoritative data store
- Supabase Storage: intended file storage for import pipeline

### Internal services/modules

- Fastify BFF: application-facing gateway for the web app
- `@wos/domain`: shared business contracts and pure logic

## Data flows

### 1. Authentication and workspace resolution

1. User signs in through Supabase Auth in the web app.
2. Frontend stores session through the Supabase client.
3. Frontend calls BFF with `Authorization: Bearer <token>`.
4. BFF validates the token through Supabase Auth.
5. BFF loads `profiles` and `tenant_members`.
6. BFF resolves the current tenant workspace and returns `/api/me`.

### 2. Warehouse bootstrap

1. Frontend calls BFF to create a site.
2. Frontend calls BFF to create the first floor.
3. Frontend calls BFF RPC `create_layout_draft`.
4. Draft becomes the editable spatial context for the editor.

### 3. Layout editing flow

1. Frontend loads active draft and published summary via BFF.
2. BFF reads `layout_versions`, `racks`, `rack_faces`, `rack_sections`, `rack_levels`, `cells`.
3. BFF maps DB rows into domain objects.
4. Frontend initializes Zustand editor state from the loaded draft.
5. User edits rack geometry and face structure locally.
6. Pure domain functions generate cells and validation previews on the client.
7. Frontend saves the draft through BFF RPC `save_layout_draft`.

### 4. Layout validation and publish flow

1. Frontend requests validation for a layout version.
2. BFF calls RPC `validate_layout_version`.
3. DB returns validation issues and publish blockers.
4. Frontend requests publish.
5. BFF calls RPC `publish_layout_version`.
6. Postgres enforces transactional publish rules and cell generation consistency.
7. Published `LayoutVersion` becomes the authoritative spatial truth.

### 5. Planned import pipeline flow

1. File is uploaded to storage.
2. Import job is created.
3. Data is staged and normalized.
4. Validation runs before publish.
5. Publish moves validated rows into operational tables.
6. Source lineage remains traceable from operational records back to source file/sheet/row.

### 6. Planned operations flow

1. Published layout defines valid address space.
2. Product/location roles map products to operational cells.
3. Stock snapshot and orders are imported and published.
4. Readiness is resolved against products, roles, cells, and stock conditions.
5. Ready lines generate pick tasks and pick items.
6. Picker confirms each SKU step individually.
7. Events and task state updates form operational audit history.

## Cross-cutting concerns

- auth: Supabase Auth + frontend auth provider + BFF bearer validation
- permissions: tenant-aware RLS plus BFF workspace resolution
- validation: Zod in frontend/BFF, pure domain validation in `@wos/domain`, SQL/RPC validation in Postgres
- logging: Fastify request/response logging with redacted auth headers
- error handling: BFF normalizes transport and Supabase errors into stable API errors
- tenancy: tenant membership is part of the security model, not just UI context
- type boundaries: generated Supabase row types must not leak outside API layers
- testing: domain unit tests, SQL tests, frontend tests

## Key invariants

- `Published LayoutVersion` is the authoritative spatial truth.
- Layout edits happen only in draft; published versions are not edited in place.
- Cells are generated by the system, never manually authored by users.
- Addressing semantics are fixed and must stay stable across UI/backend implementation.
- Storage truth is container-first and location-based, never `SKU -> Cell`.
- Geometry slot and executable location are not the same entity.
- Product-location role is an operational mapping, not physical storage truth.
- Canvas owns spatial manipulation only; structural configuration belongs to inspector/forms.
- Rack rotation is constrained to 90-degree steps.
- Same-cell multi-SKU picking still produces separate pick confirmation steps.
- Raw import data must not write directly into operational truth tables.
- BFF should stay thin; transactional business rules belong in Postgres RPC/functions and domain contracts.
- Supabase generated row types must remain inside `api/` boundaries and be mapped into domain types before reaching UI logic.

## Current implementation snapshot

The repository currently implements the foundation strongly in these areas:

- tenant-aware auth and workspace resolution
- site/floor bootstrap
- layout draft loading, local editing, validation, save, and publish
- shared domain contracts for layout and readiness-related types
- tenant-scoped RLS for the layout stack

The following areas are present mostly as architecture baseline or UI placeholders, not yet as full production flows:

- imports and storage pipeline
- stock snapshot ingestion
- readiness derivation
- pick task generation and picker execution
- realtime synchronization

## Mental model summary

If reduced to one sentence:

`apps/web` edits and visualizes warehouse layout, `apps/bff` authenticates and orchestrates application requests, `apps/supabase` owns authoritative data and transactional rules, and `packages/domain` defines the stable business language between them.
