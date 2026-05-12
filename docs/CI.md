# Basic CI

This repository has a first-pass GitHub Actions workflow at `.github/workflows/ci.yml`.

## What CI Runs

The workflow runs on pull requests and pushes to `main` or `master` with Node.js 20 and npm cache enabled.

It currently runs:

```bash
npm ci
npm run typecheck
npm run lint
npm run test --workspace @wos/domain
npm run test --workspace @wos/bff
npm run test --workspace @wos/web
npm run build
```

The workflow sets safe dummy/public values for the frontend and BFF build environment. It does not require committed secrets.

## Why Root Test Is Not Used

Root `npm run test` runs every workspace test through Turborepo. That includes `@wos/supabase`, whose `test` script invokes a PowerShell SQL test against a local Supabase Docker container. That is not CI-safe for the first basic workflow, so CI uses scoped unit tests for `@wos/domain`, `@wos/bff`, and `@wos/web`.

## Postponed Checks

Supabase SQL tests are postponed until CI has an explicit local Supabase service setup, migration/reset strategy, and Linux-compatible test runner.

Playwright/E2E tests are postponed because they currently assume Supabase, auth, and environment setup that is not part of this basic CI workflow.

## Production Environment Notes

Use `.env.production.example` as the production environment template. Production/server runtimes must bind the BFF to all interfaces with:

```env
BFF_HOST=0.0.0.0
```

Production frontend builds must keep:

```env
VITE_ENABLE_DEV_AUTO_LOGIN=false
```

CI build placeholders are separate from production values and are defined in the workflow.

## Before Docker Or CD

The next phase should add Docker production readiness before any deployment workflow:

- Add Dockerfiles and a production runtime strategy.
- Add `.dockerignore` and a server/static asset plan.
- Confirm BFF runtime module resolution and startup in the built artifact.
- Decide how production environment values are injected.
- Decide how migrations are run operationally, without adding automatic migrations to basic CI.
- Make Supabase SQL and Playwright/E2E tests CI-safe in their own later workflows or jobs.

## Local Equivalent

To run the same checks locally:

```bash
npm ci
npm run typecheck
npm run lint
npm run test --workspace @wos/domain
npm run test --workspace @wos/bff
npm run test --workspace @wos/web
npm run build
```

Do not treat this as a replacement for local Supabase SQL or Playwright/E2E validation; those remain separate until their CI setup is explicit.
