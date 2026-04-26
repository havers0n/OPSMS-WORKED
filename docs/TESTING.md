# Testing Guide

## Validation order

1) Lint
2) Typecheck
3) Unit/integration tests
4) E2E for frontend flows (if changed)

## Workspace commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

Scoped checks:

```bash
npm run test --workspace @wos/domain
npm run test --workspace @wos/bff
npm run test --workspace @wos/web
```

## Backend domain checks

- Packaging/profile updates:
  - validate base level invariants
  - active precedence and uniqueness
- Orders/waves:
  - status transitions and idempotency
  - reservation lifecycle
- Layout lifecycle:
  - draft save/validate/publish behavior
  - published layout immutability

## Frontend checks

- Page/API smoke tests for touched routes in `apps/web/src`.
- Visual/interaction tests for warehouse editor and storage preset workflows via Playwright where relevant.

## Mandatory test cases for packaging hierarchy

- Case A: `box = 2` base units, `master = 4` boxes => `master = 8` base units
- Case B: `box = 6` base units, `carton = 12` boxes, `pallet = 10` cartons => `pallet = 720` base units

If either case fails, stop and update canonical resolver + UI expectations together.
