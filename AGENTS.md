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

## Agent execution guards

### Shell environment

- Environment is Windows + PowerShell.
- Prefer repository scripts over ad-hoc shell pipelines.
- Do not assume Bash syntax works in PowerShell.
- Before using optional tools (`rg`, `gh`, `supabase`) or Docker-dependent commands, verify the tool exists and required runtime state is available.
- Before reading or editing a path, verify it exists.
- If a command fails from syntax or environment mismatch, do not rerun it unchanged.

### Retry gate

- Do not run the same failed command more than twice without changing conditions.
- Before a third attempt, add a short triage note with:
  - exact failing command;
  - first relevant error;
  - failure class (`expected validation` / `code regression` / `baseline failure` / `environment blocker` / `wrong command or cwd`);
  - new evidence gathered;
  - what changes before retry.

### Validation gate

- Before commit, require at least one targeted passing validation for the changed area.
- Before push, run lightweight workspace-scoped lint and typecheck for affected workspaces.
- Report exact pass counts where available.
- Report known baseline failures separately from regressions introduced by the current patch.
- Do not claim a failure is pre-existing without evidence.

### Layer boundary

- Investigation may cross layers when evidence requires it.
- Before editing a newly entered layer (`web`, `bff`, `supabase`, `domain`), state:
  - why the current layer is insufficient;
  - what evidence points to the new layer;
  - whether scope changes.
- Do not expand implementation scope opportunistically.

### Long-session checkpoint

- During large exploratory work, periodically summarize:
  - confirmed facts;
  - open hypotheses;
  - current scope;
  - whether to continue, split into a bounded PR, or stop at an incident report.
- Do not use arbitrary hard tool-call limits.
