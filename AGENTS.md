# AGENTS.md

## Scope

This is the primary instruction file for this repository.

Repository is a monorepo:

- `apps/web` — React/Vite frontend.
- `apps/bff` — Fastify API layer (BFF) backed by Supabase.
- `apps/supabase` — local DB/Migrations/RPC.
- `packages/domain` — shared domain types and business schemas/contracts.

## Mandatory validation commands

Before any meaningful task change:

```bash
npm run lint
npm run typecheck
npm run test
```

For UI changes:

```bash
npm run test:e2e
```

Use workspace-scoped equivalents when required:

```bash
npm run lint --workspace @wos/web
npm run lint --workspace @wos/bff
```

## Working rules

- Do not rewrite large areas unless explicitly requested.
- Keep changes small and reviewable.
- Preserve existing public contracts unless a breaking change is explicitly requested.
- When backend DTOs/services change, update `packages/domain` and frontend API clients/types.
- When DB behavior changes, add/update migration files in `apps/supabase/migrations` and keep docs current.
- For packaging and storage presets, always verify behavior against end-to-end tests for nested quantities.
- Do not remove validation/diagnostic checks unless explicitly requested and documented.

## Domain non-negotiables

- Packaging hierarchy is cumulative.  
  Example: `box = 2 base units`, `master = 4 boxes` => `master = 8 base units`.
- Storage presets must resolve quantities through hierarchy, not direct `contains` math.
- Storage- and product-quantity display must come from backend canonical values.

## Done criteria

A task is done only when:

- code compiles
- relevant tests pass
- changed behavior is documented
- edge cases are considered
- no unrelated formatting churn is introduced

## Docs and navigation

- Keep `README.md` and `docs/` aligned with real project files.
- Nested `AGENTS.md` apply inside their directories.
