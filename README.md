# abctestsforWOS

Monorepo for `Warehouse Setup + Stock-Aware Directed Picking V1`.

The product covers a narrow warehouse operations contour:

- warehouse and floor setup
- rack configuration and cell address generation
- draft/publish lifecycle for layout versions
- import preparation through Supabase
- future readiness, pick task, and picker execution flows

The repository already contains a frontend app, a BFF layer, and a local Supabase setup with migrations and SQL tests.

## Stack

- `React 19`
- `TypeScript`
- `Vite`
- `Tailwind CSS 4`
- `TanStack Query`
- `Zustand`
- `Fastify`
- `Supabase`
- `Postgres`
- `Turborepo`
- `Vitest`
- `Playwright`

## Repository layout

```text
apps/
  web/        frontend application
  bff/        Fastify BFF for auth, sites/floors, layout, products, orders, waves
  supabase/   migrations, seed, SQL tests, local Supabase config
packages/
  domain/     Zod schemas and pure domain logic
  ui/         shared UI primitives placeholder
  config/     shared config placeholder
docs/
  ARCHITECTURE.md
  DOMAIN_MODEL.md
  API.md
  DATABASE.md
  TESTING.md
  TROUBLESHOOTING.md
  CODE_REVIEW.md
  PLANS.md
  architecture/
  decisions/
```

## Current scope in code

`apps/web`:

- login flow
- `warehouse setup`, `products`, and `operations` pages
- bootstrap flow for site/floor creation
- warehouse editor backed by a draft layout
- validate/publish workflow
- Canvas-based picking-plan preview and route review

`apps/bff`:

- `GET /health`
- `GET /ready`
- `GET /api/me`
- `GET/POST /api/sites`
- `GET /api/sites/:siteId/floors`
- `POST /api/floors`
- `GET /api/floors/:floorId/layout-draft`
- `GET /api/floors/:floorId/published-layout`
- `POST /api/layout-drafts`
- `POST /api/layout-drafts/save`
- `POST /api/layout-drafts/:layoutVersionId/validate`
- `POST /api/layout-drafts/:layoutVersionId/publish`

`apps/supabase`:

- local Supabase config
- migrations up to `0107`
- `seed.sql`
- SQL tests for layout lifecycle

## Requirements

- `Node.js 20+` recommended
- `npm 10+`
- `Supabase CLI`

Quick check:

```powershell
node -v
npm -v
supabase --version
```

## Installation

```powershell
npm install
```

## Environment variables

Repo root template: [`.env.example`](./.env.example)

BFF local template: [`apps/bff/.env.example`](./apps/bff/.env.example)

```env
BFF_PORT=8787
BFF_HOST=127.0.0.1
BFF_LOG_LEVEL=info
# BFF_CORS_ORIGIN is optional. When unset, the BFF allows local Vite dev and E2E ports.
# BFF_CORS_ORIGIN=http://127.0.0.1:5173
SUPABASE_URL=http://127.0.0.1:54421
SUPABASE_ANON_KEY=<local Supabase anon key>

VITE_SUPABASE_URL=http://127.0.0.1:54421
VITE_SUPABASE_ANON_KEY=
VITE_BFF_URL=http://127.0.0.1:8787/api
VITE_ENABLE_DEV_AUTO_LOGIN=false
VITE_DEV_AUTH_EMAIL=admin@wos.local
VITE_DEV_AUTH_PASSWORD=warehouse123
```

Backend (`apps/bff`) requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` and reads only backend-prefixed variables for service settings.
The BFF dev script runs from `apps/bff` and loads `apps/bff/.env.local`.

## Local development

1. Start local Supabase:

```powershell
cd apps\supabase
supabase start
```

Current local ports from `apps/supabase/config.toml`:

- API: `http://127.0.0.1:54421`
- Studio: `http://127.0.0.1:54423`
- DB: `127.0.0.1:54422`

2. Create the local env files from the templates:

```powershell
cp .env.example .env
cp apps/bff/.env.example apps/bff/.env.local
```

3. Start frontend and BFF from the root:

```powershell
npm run dev
```

This normally starts:

- `apps/web` via Vite
- `apps/bff` via `tsx watch`

Run workspaces separately if needed:

```powershell
npm run dev --workspace @wos/web
npm run dev --workspace @wos/bff
```

## Common commands

```powershell
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run gen:types
```

Workspace-specific examples:

- `npm run test --workspace @wos/domain`

## Architecture docs
- [AGENTS.md](./AGENTS.md) — root instructions for all agents
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — component boundaries and data flow
- [docs/DOMAIN_MODEL.md](./docs/DOMAIN_MODEL.md) — product, packaging, preset, execution rules
- [docs/API.md](./docs/API.md) — endpoint inventory and behavior
- [docs/DATABASE.md](./docs/DATABASE.md) — schema, views, migrations, RPCs
- [docs/TESTING.md](./docs/TESTING.md) — how to verify changes
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) — common failure patterns
- [docs/CODE_REVIEW.md](./docs/CODE_REVIEW.md) — review checklist
- [docs/PLANS.md](./docs/PLANS.md) — structured approach for large work
- [docs/architecture/canvas-picking-planning-migration.md](./docs/architecture/canvas-picking-planning-migration.md) - Canvas picking/planning entrypoint
- [docs/decisions/ADR-0001-packaging-hierarchy.md](./docs/decisions/ADR-0001-packaging-hierarchy.md)
- [docs/decisions/ADR-0002-storage-presets.md](./docs/decisions/ADR-0002-storage-presets.md)

## Current editor and storage-core status

Important current truths:

- published layout is the authoritative spatial truth
- layout editing happens only in draft
- warehouse editor UX still has known mode-clarity and precision-editing limitations
- the execution/storage core is not fully converged yet
- the canonical target storage model is documented in `docs/architecture/core-wms-data-model-v1.md`

Practical meaning:

- current placement flows still rely on published structural cells
- future WMS execution flows should converge on `Location -> Container -> InventoryUnit -> Movement`
- geometry and execution semantics must not be collapsed into one model

## Notes

- Root `npm run dev` does not start Supabase. Local Supabase must be started separately with the CLI.
- `npm run gen:types` writes generated Supabase types to `apps/web/src/shared/api/supabase/types.ts`.
- By architecture rule, generated Supabase row types should stay inside the API layer.
