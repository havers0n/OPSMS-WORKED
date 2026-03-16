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
  bff/        Fastify BFF for auth, sites/floors, and layout lifecycle
  supabase/   migrations, seed, SQL tests, local Supabase config
packages/
  domain/     Zod schemas and pure domain logic
  ui/         shared UI primitives placeholder
  config/     shared config placeholder
docs/
  architecture/
```

## Current scope in code

`apps/web`:

- login flow
- `warehouse setup`, `products`, and `operations` pages
- bootstrap flow for site/floor creation
- warehouse editor backed by a draft layout
- validate/publish workflow

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
- migrations `0001` to `0015`
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

Base template: [`.env.example`](./.env.example)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BFF_URL=/api
VITE_ENABLE_DEV_AUTO_LOGIN=false
VITE_DEV_AUTH_EMAIL=admin@wos.local
VITE_DEV_AUTH_PASSWORD=warehouse123
```

For local frontend development, these values are enough:

- `VITE_SUPABASE_URL=http://127.0.0.1:55421`
- `VITE_BFF_URL=http://127.0.0.1:8787/api`

`apps/bff` can read:

- `BFF_PORT`, default `8787`
- `BFF_HOST`, default `127.0.0.1`
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY`

If BFF variables are not set, the service falls back to local defaults aligned with `apps/supabase/config.toml`.

## Local development

1. Start local Supabase:

```powershell
cd apps\supabase
supabase start
```

Current local ports from `apps/supabase/config.toml`:

- API: `http://127.0.0.1:55421`
- Studio: `http://127.0.0.1:55423`
- DB: `127.0.0.1:55422`

2. Create `.env` in the repo root based on `.env.example`.

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

- `npm run test --workspace @wos/supabase`
- `npm run test --workspace @wos/domain`

## Architecture docs

- [architecture-baseline.md](./docs/architecture/architecture-baseline.md)
- [core-wms-data-model-v1.md](./docs/architecture/core-wms-data-model-v1.md)
- [frontend-folder-file-plan.md](./docs/architecture/frontend-folder-file-plan.md)
- [supabase-schema-module-map.md](./docs/architecture/supabase-schema-module-map.md)

These documents define the main rules for:

- canvas vs inspector boundaries
- draft/publish lifecycle
- storage truth model and the target execution core
- frontend layering
- Supabase type boundaries vs domain types

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
