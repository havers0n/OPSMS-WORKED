# Testing Guide

## Validation order

1) Lint
2) Typecheck
3) Unit/integration tests
4) E2E for frontend flows (if changed)

## Validation ladder

Use the smallest validation level that matches the change, then move up the ladder before merge or release.

### Unit, typecheck, and lint

Run these for normal code and contract changes:

```bash
npm run lint --workspace @wos/web
npm run typecheck --workspace @wos/web
npm run test --workspace @wos/web
npm run typecheck --workspace @wos/bff
npm run test --workspace @wos/bff
```

### Smoke E2E

Smoke E2E is the quick sanity check for the web app. Run it after frontend flow changes, routing changes, or changes that may affect the basic app startup path.

```bash
npm run test:e2e:smoke --workspace @wos/web
```

Current baseline: 5 passed.

### Critical E2E

Critical E2E is the stronger pre-merge or release check for core user journeys. Run it before merging changes that affect warehouse setup, layout, picking, product, or storage behavior.

```bash
npm run test:e2e:critical --workspace @wos/web
```

Current baseline: 11 passed.

Full E2E and performance suites are separate from the smoke and critical ladder. Run them when touching the relevant flows or performance-sensitive areas.

Known noisy output is non-blocking when the command exits with code 0:

- React `act(...)` warnings in web unit tests.
- WOS TRACE logging.

Local E2E runs require `apps/bff/.env.local`; create it from `apps/bff/.env.example` before running the web E2E suites.

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
