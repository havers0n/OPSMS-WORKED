# packages/domain/AGENTS.md

## Domain rules

- This package is pure domain + schemas (`zod`): no infra imports (no Supabase/Fastify/React).
- Keep domain contracts explicit and stable: product/profile/layout/operation entities and related schemas.
- Shared types are part of API correctness; update this package before changing request/response shapes in `apps/bff` or `apps/web`.
- Prefer helper functions and tested schemas over ad-hoc parsing in app layers.

## Testing and drift prevention

- Run `vitest` for all schema/logic changes:

```bash
npm run typecheck --workspace @wos/domain
npm run test --workspace @wos/domain
```

- Any schema shape change must be reflected in at least one domain test.
- Add/adjust BFF and UI tests when domain fields are removed, renamed, or semantics change.
