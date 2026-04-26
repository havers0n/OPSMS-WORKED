# apps/bff/AGENTS.md

## Backend rules

- Stack: Node.js, Fastify, TypeScript, Supabase.
- All public HTTP bodies must be validated (Zod) and mapped to schema outputs.
- Keep auth checks in route/service entry points; do not trust frontend-computed totals or state.
- Return typed errors with explicit codes (`ApiError` or mapped DB errors).
- Keep core business logic in service/repo layers, not inside route handlers.
- Prefer stored procedures/RPC and canonical DB views for inventory, placement, layout, and packaging quantities.

## Data and DB rules

- Database migrations live in `apps/supabase/migrations` and are mandatory for schema changes.
- Do not edit old migrations that are already applied in shared environments.
- When changing endpoint DTOs or query contracts, update consumers in `apps/web` and `packages/domain`.
- Add migration + test coverage for schema and constraint changes.

## Validation

For backend changes:

```bash
npm run lint --workspace @wos/bff
npm run typecheck --workspace @wos/bff
npm run test --workspace @wos/bff
```

If BFF auth/storage behavior changes, run at least the affected feature tests under `apps/bff/src/features/*/*.test.ts`.
