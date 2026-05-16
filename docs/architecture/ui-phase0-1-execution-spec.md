# Phase 0 + 1 Execution Spec

## 1. Package scaffold

Create the following **initial** file tree:

```text
packages/ui/
  package.json
  tsconfig.json
  src/
    index.ts
    lib/
      cn.ts
    components/
      button/
        button.tsx
        button.types.ts
      spinner/
        spinner.tsx
      empty-state/
        empty-state.tsx
      error-state/
        error-state.tsx
    styles/
      tokens.css
      index.css
```

File purposes:

- `packages/ui/package.json`  
  Define workspace package metadata, `type`, scripts (`typecheck`, `lint`), and exports map for stable public entrypoints.
- `packages/ui/tsconfig.json`  
  Package-local TS config extending root base; includes `src` and supports declaration-style package typecheck.
- `packages/ui/src/index.ts`  
  Single public barrel for supported UI exports only (`cn`, `Button`, `Spinner`, `EmptyState`, `ErrorState`, `tokens.css`).
- `packages/ui/src/lib/cn.ts`  
  Domain-agnostic className combiner utility extracted from web shared lib.
- `packages/ui/src/components/button/button.tsx`  
  ForwardRef button primitive with constrained visual variants and sizes.
- `packages/ui/src/components/button/button.types.ts`  
  Keeps Button prop contract isolated and explicit.
- `packages/ui/src/components/spinner/spinner.tsx`  
  Minimal loading indicator primitive.
- `packages/ui/src/components/empty-state/empty-state.tsx`  
  Generic empty state shell (title/description/action slot).
- `packages/ui/src/components/error-state/error-state.tsx`  
  Generic error state shell (message/retry action slot).
- `packages/ui/src/styles/tokens.css`  
  Design token subset extracted from web global CSS custom properties only.
- `packages/ui/src/styles/index.css`  
  CSS entrypoint that imports `tokens.css` and nothing app-specific.

---

## 2. Alias and config wiring

Update these repo files exactly:

1. `tsconfig.base.json`
   - Add path alias:
     - `"@wos/ui": ["packages/ui/src/index.ts"]`
     - optional subpath during migration: `"@wos/ui/*": ["packages/ui/src/*"]`

2. `apps/web/vite.config.ts`
   - In `resolve.alias`, add:
     - `"@wos/ui": path.resolve(__dirname, '../../packages/ui/src/index.ts')`
   - Keep existing `@` and `@wos/domain` aliases unchanged.

3. `apps/web/package.json`
   - Add dependency entry:
     - `"@wos/ui": "0.1.0"` (or `"workspace:*"` if your package manager/workspace policy supports it).
   - **Uncertain:** repo currently uses npm workspaces; if npm version/policy rejects `workspace:*`, pin to `0.1.0` and rely on workspace linking.

4. `packages/ui/package.json`
   - Required fields:
     - `name: "@wos/ui"`
     - `private: true`
     - `version: "0.1.0"`
     - `type: "module"`
   - Scripts:
     - `typecheck`, `lint`
   - Exports:
     - `".": "./src/index.ts"`
     - optional CSS export: `"./styles.css": "./src/styles/index.css"`

5. `eslint.config.mjs`
   - Add ruleset for `packages/ui/src/**/*.{ts,tsx}` with `no-restricted-imports` blocking:
     - `@/app/*`, `@/pages/*`, `@/widgets/*`, `@/features/*`, `@/entities/*`, `@/shared/*`
     - `@wos/domain`
     - `apps/web/*`
   - This is the hard guardrail preventing domain/app leakage into `packages/ui`.

6. (Optional but recommended) root scripts in `package.json`
   - No mandatory changes for Phase 1.
   - Optional: ensure monorepo `lint/typecheck` include new package via turbo workspace detection (already `turbo run ...` across workspaces).

---

## 3. First extraction set

Only extract the safest items below.

### Target A — `cn`
- Source: `apps/web/src/shared/lib/react/cn.ts`
- Action: **move**
- Target: `packages/ui/src/lib/cn.ts`
- Why safe: no domain imports, pure utility.
- Remove before export: nothing.
- Public API: `cn(...classes: Array<string | false | null | undefined>): string`

### Target B — `Button`
- Source: `apps/web/src/shared/ui/button.tsx`
- Action: **copy-then-refactor** (do not hard-move first to avoid breaking web imports)
- Target: `packages/ui/src/components/button/button.tsx`
- Why safe: currently primitive and React-only.
- Remove before export: any future product copy, route logic, domain-specific props.
- Public API: `Button` with `variant`, `size`, `loading`, `asChild?` (optional), `className`, `ref` forwarding.

### Target C — tokens
- Source: `apps/web/src/app/styles/global.css`
- Action: **copy-then-refactor**
- Target: `packages/ui/src/styles/tokens.css`
- Why safe: custom properties are visual infrastructure.
- Remove before export:
  - app layout globals (`html, body, #root` sizing)
  - global element resets tied to app bootstrap
  - product-specific background gradients if treated as app chrome
- Public API: CSS variables only (surface/border/text/accent/shadow/radius tokens).

### Target D — `Spinner`
- Source: **rewrite** from repeated inline loading usage (e.g. `RefreshCw` spinners in pages)
- Action: **rewrite**
- Target: `packages/ui/src/components/spinner/spinner.tsx`
- Why safe: pure visual loading primitive.
- Remove before export: icon-library coupling to domain semantics (component can keep icon dependency but not business text).
- Public API: `size`, `className`, optional `label` for accessibility.

### Target E — `EmptyState`
- Source: **rewrite** from generic empty containers used across pages
- Action: **rewrite**
- Target: `packages/ui/src/components/empty-state/empty-state.tsx`
- Why safe: shell pattern only.
- Remove before export: WMS-specific copy and actions.
- Public API: `title`, `description?`, `icon?`, `action?`, `className`.

### Target F — `ErrorState`
- Source: **rewrite** from repeated error blocks
- Action: **rewrite**
- Target: `packages/ui/src/components/error-state/error-state.tsx`
- Why safe: shell pattern only.
- Remove before export: API error contract parsing and domain wording.
- Public API: `title`, `description?`, `onRetry?`, `retryLabel?`, `className`.

Items intentionally **kept** in Phase 1: all scenario components and any component using entity/feature hooks.

---

## 4. Component API contracts

### `cn`
- Props/API: variadic class parts (`string | false | null | undefined`).
- Variants: none.
- Must NOT know about: React state, DOM, domain models.
- Styling strategy: string concatenation only.
- `className` support: N/A.
- Forward refs: N/A.

### `Button`
- Props:
  - base button props (`React.ButtonHTMLAttributes<HTMLButtonElement>`)
  - `variant?: 'primary' | 'secondary' | 'ghost' | 'danger'`
  - `size?: 'sm' | 'md' | 'lg'`
  - `loading?: boolean`
  - `leadingIcon?: ReactNode`
  - `trailingIcon?: ReactNode`
- Variants: as above, with default `primary` + `md`.
- Must NOT know about: order/wave/rack states, auth, routing, stores.
- Styling strategy: internal class map + `cn` merge.
- `className`: yes, always accepted and merged last.
- Forward refs: yes (`forwardRef<HTMLButtonElement, ButtonProps>`).

### `tokens.css`
- Props: N/A.
- Variants: N/A.
- Must NOT know about: page structure (`#root`), app shell backgrounds, domain themes.
- Styling strategy: `:root { --token: ... }` only.
- `className`: N/A.
- Forward refs: N/A.

### `Spinner`
- Props:
  - `size?: 'sm' | 'md' | 'lg'`
  - `className?: string`
  - `label?: string` (for `aria-label`)
- Variants: size only.
- Must NOT know about: loading source (query/mutation/domain workflow).
- Styling strategy: class map, animation utility classes.
- `className`: yes.
- Forward refs: optional; not required for Phase 1.

### `EmptyState`
- Props:
  - `title: ReactNode`
  - `description?: ReactNode`
  - `icon?: ReactNode`
  - `action?: ReactNode`
  - `className?: string`
- Variants: optional `tone?: 'default' | 'muted'`.
- Must NOT know about: warehouse/editor/order terms.
- Styling strategy: composable slots.
- `className`: yes.
- Forward refs: no (Phase 1).

### `ErrorState`
- Props:
  - `title?: ReactNode` (default: `Something went wrong`)
  - `description?: ReactNode`
  - `onRetry?: () => void`
  - `retryLabel?: string`
  - `className?: string`
- Variants: optional `tone?: 'error' | 'warning'`.
- Must NOT know about: BFF error types, domain-specific recovery logic.
- Styling strategy: slot + tone classes.
- `className`: yes.
- Forward refs: no (Phase 1).

---

## 5. Import migration order

Use this order to minimize breakage:

1. **Introduce package without usage changes**
   - Create `packages/ui` files and wire aliases/config first.

2. **Switch utility import (`cn`) first**
   - Replace usages in `apps/web` that currently import `@/shared/lib/react/cn`.
   - Then remove local duplicate `cn` in `rack-inspector` by importing `@wos/ui`.

3. **Adopt `Button` in low-risk/shared files**
   - Start with `apps/web/src/shared/ui/button.tsx` as a compatibility re-export wrapper:
     - `export { Button } from '@wos/ui';`
   - Then gradually update direct button-heavy files only where visual parity is verified.

4. **Load tokens in app entry styles**
   - In `apps/web/src/app/styles/global.css`, import `@wos/ui/styles.css` (or keep variables duplicated temporarily with TODO).
   - Remove duplicated token declarations only after parity check.

5. **Adopt state components (`Spinner`, `EmptyState`, `ErrorState`)**
   - Replace straightforward repeated blocks in pages with minimal behavior coupling first.

6. **Delete temporary compatibility layer**
   - Remove `apps/web/src/shared/ui/button.tsx` and old `apps/web/src/shared/lib/react/cn.ts` when no imports remain.

---

## 6. Acceptance criteria

Phase 1 is complete only when all are true:

1. `@wos/ui` is importable from `apps/web` via TS + Vite config.
2. `packages/ui` exposes `cn`, `Button`, `tokens.css`, `Spinner`, `EmptyState`, `ErrorState` via `src/index.ts`.
3. `packages/ui` has **zero** imports from:
   - `@/app`, `@/pages`, `@/widgets`, `@/features`, `@/entities`, `@/shared`
   - `@wos/domain`
4. No imports from `apps/web` into `packages/ui` (direct or indirect).
5. `apps/web` typecheck and build pass after import switches.
6. Either:
   - old `cn` and `shared/ui/button.tsx` are deleted, or
   - they are temporary wrappers with explicit TODO and zero business logic.
7. Visual behavior of migrated Button usages remains functionally equivalent (no disabled/loading regressions).

---

## 7. No-go list

Do **not** move these during Phase 1:

- `apps/web/src/widgets/app-shell/ui/top-bar.tsx`
- `apps/web/src/widgets/warehouse-editor/ui/warehouse-editor.tsx`
- `apps/web/src/widgets/warehouse-editor/ui/editor-canvas.tsx`
- `apps/web/src/widgets/warehouse-editor/ui/inspector-router.tsx`
- `apps/web/src/widgets/warehouse-editor/ui/rack-inspector.tsx` (except replacing local `cn` helper import)
- `apps/web/src/widgets/warehouse-editor/ui/rack-multi-inspector.tsx`
- `apps/web/src/widgets/warehouse-editor/ui/mode-panels/cell-placement-inspector.tsx`
- `apps/web/src/widgets/warehouse-editor/ui/mode-panels/container-placement-inspector.tsx`
- `apps/web/src/widgets/warehouse-editor/ui/tool-rail.tsx`
- `apps/web/src/widgets/warehouse-editor/ui/published-banner.tsx` (full component)
- `apps/web/src/features/rack-configure/ui/*`
- `apps/web/src/features/rack-create/ui/rack-creation-wizard.tsx`
- `apps/web/src/pages/**/*`
- `apps/web/src/widgets/warehouse-bootstrap/ui/*`

Reason: each item is scenario/workflow-driven or bound to domain/app stores.

---

## 8. Risks and rollback

1. **Mistake: moving wrappers instead of primitives**
   - Avoid: only extract primitives listed in Section 3.
   - Rollback: keep app-local wrappers; re-export from `@wos/ui` later.

2. **Mistake: leaking domain props into `Button` or state components**
   - Avoid: enforce strict prop contracts with primitive types.
   - Rollback: remove leaked props, introduce app-level adapter components.

3. **Mistake: over-extracting tokens**
   - Avoid: move only reusable CSS variables first.
   - Rollback: keep app chrome/background tokens in `apps/web` until design split is clear.

4. **Mistake: breaking className/style assumptions**
   - Avoid: every primitive must accept `className`; merge with `cn`.
   - Rollback: temporary pass-through wrappers in `apps/web`.

5. **Mistake: alias works in TS but not Vite/runtime**
   - Avoid: update both `tsconfig.base.json` and `apps/web/vite.config.ts` in same commit.
   - Rollback: switch imports to relative temporary path until alias fixed.

6. **Mistake: partial migration leaves duplicates forever**
   - Avoid: add explicit cleanup ticket and acceptance criterion #6.
   - Rollback: set wrapper deprecation deadline and lint rule for banned old paths.

---

## 9. Ready-to-execute checklist

1. Create `packages/ui` package scaffold files from Section 1.
2. Add `@wos/ui` path aliases in `tsconfig.base.json`.
3. Add `@wos/ui` alias in `apps/web/vite.config.ts`.
4. Add `@wos/ui` dependency entry to `apps/web/package.json`.
5. Add `packages/ui` import-boundary rule to `eslint.config.mjs`.
6. Implement `cn` in `packages/ui/src/lib/cn.ts` and export from `src/index.ts`.
7. Implement `Button` (forwardRef + variants + sizes + className merge) and export.
8. Implement `tokens.css` + `styles/index.css`; wire CSS export.
9. Implement `Spinner`, `EmptyState`, `ErrorState` and export.
10. Update `apps/web` imports in order from Section 5.
11. Replace local `cn` duplicate in `rack-inspector` with `@wos/ui` import.
12. Run: web typecheck/build + repo lint.
13. Remove or deprecate old `apps/web/src/shared/lib/react/cn.ts` and `apps/web/src/shared/ui/button.tsx`.
14. Verify acceptance criteria in Section 6.
