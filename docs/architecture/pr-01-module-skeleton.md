# PR-01 Module Skeleton (Structural-Only)

## Scope

This PR introduces a backend module skeleton under `apps/bff/src` to prepare safe incremental refactors.

It is intentionally **structural-only**:
- no runtime behavior changes
- no HTTP contract changes
- no SQL/RPC behavior changes
- no business logic moved out of `app.ts`

## Added Structure

- `app/` scaffold files for future app composition
- `shared/http`, `shared/errors`, `shared/db` scaffold files for future shared utilities
- feature module placeholders for:
  - `orders`
  - `waves`
  - `layout`
  - `inventory`
  - `sites`
  - `floors`
  - `products`

Each feature folder currently contains only placeholders:
- `routes.ts`
- `service.ts`
- `repo.ts`
- `errors.ts`
- `schemas.ts`

## Provisional Contract Note

Names and contracts in this scaffold are provisional.
Actual service/repo/error contracts will be defined in later PRs when real code is extracted.
PR-01 does **not** establish the final backend API/module shape.

## Why This Is Safe

- Existing runtime entrypoint remains unchanged: `src/server.ts -> buildApp()`.
- Existing route registration remains in `src/app.ts`.
- New files are not wired into request handling yet.

## Planned Follow-Up PRs

- PR-02+: move route registration into feature `routes.ts` modules incrementally.
- PR-05+: extract write-flow orchestration into feature `service.ts` modules.
- PR-07+: extract data access into feature `repo.ts` modules.
- PR-09+: move feature-specific schema declarations into `schemas.ts` and align shared validation contracts.
- PR-11+: centralize feature/infra error mapping via `shared/errors`.
