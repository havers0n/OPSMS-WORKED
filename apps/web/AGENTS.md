# apps/web/AGENTS.md

## Frontend rules

- Stack: React 19, Vite, TypeScript, Tailwind, Zustand, TanStack Query.
- Use shared types from `packages/domain` and route data from BFF API contracts.
- Keep business logic in feature/domain layers (`src/features`, `src/entities`, domain hooks/services).
- Put raw HTTP calls through `src/shared/api/bff/*` helpers.
- Do not duplicate backend canonical calculations in UI.
- For container/inventory quantities in product/storage screens, prefer canonical fields from BFF/API.
- Avoid inventing or hardcoding container type codes.

## Layout conventions

- Keep components stateless where possible; state should live in dedicated stores/hooks.
- Keep API side effects separated from presentation components.
- Error UI should show explicit error/state (`loading`, `empty`, `error`) rather than silent fallbacks.

## Validation

For frontend changes:

```bash
npm run lint --workspace @wos/web
npm run typecheck --workspace @wos/web
npm run test --workspace @wos/web
```

For user-facing flow changes, run:

```bash
npm run test:e2e --workspace @wos/web
```
