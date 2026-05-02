# UI Migration Audit

## Executive Summary

- `packages/ui` currently exists only as a placeholder README and contains no reusable components, hooks, styles, or exports.
- Most UI implementation lives under `apps/web/src`, but the majority of those components are domain/workflow-specific to warehouse layout editing, rack configuration, order/wave operations, and placement.
- There are a few safe extraction opportunities immediately available (e.g., className helper, base button primitive, modal shell, empty/loading/error state patterns, simple progress and badge visual primitives), but several current “shared-looking” pieces are coupled to app state, editor stores, or WMS concepts.
- The best strategy is conservative: establish a minimal `packages/ui` foundation first, then extract only components that are truly domain-agnostic.

## Classification Rules

1. **Domain knowledge test**
   - If a component knows about WMS entities (rack, cell, floor, wave, order, SKU, layout draft/publish), it stays in `apps/web`.
2. **Dependency boundary test**
   - If it imports from `@/entities/*`, `@/features/*`, `@/app/*` stores/providers, or BFF/API contracts, it is not a `packages/ui` primitive as-is.
3. **Portability test**
   - If it cannot be reused in another product without renaming props/text/behavior, keep it in app scope.
4. **Presentation vs scenario test**
   - Generic visual primitives/layout/state shells move to `packages/ui`.
   - Scenario components that orchestrate workflow/state remain in `apps/web`.
5. **Safety rule**
   - If classification is uncertain, mark as candidate and keep in `apps/web` until dependency reduction is done.

## Inventory

### Move to packages/ui

| File | Component/Pattern | Purpose | Dependency notes | Decision | Confidence |
|---|---|---|---|---|---|
| `apps/web/src/shared/lib/react/cn.ts` | `cn` | className merge helper | No domain dependency | Move to `packages/ui/lib/cn.ts` | High |
| `apps/web/src/shared/ui/button.tsx` | `Button` (current minimal) | primitive button element | React-only; currently too thin but safe start | Move and evolve (variants/sizes) | High |
| `apps/web/src/app/styles/global.css` (token subset) | CSS custom properties (`--surface-*`, `--border-*`, etc.) | design token foundation | Global app styles mixed with tokens; split required | Move token layer to `packages/ui/styles/tokens.css` | Medium |
| `apps/web/src/pages/waves/ui/waves-page.tsx` + `apps/web/src/pages/operations/ui/operations-page.tsx` | `WaveProgress` pattern | reusable tiny progress meter | duplicated visual-only logic | Extract shared `ProgressInline`/`MetricProgress` primitive | Medium |
| `apps/web/src/pages/*` modal snippets | Modal overlay/surface structure | repeated modal shell | repeated implementation, no explicit shared component | Extract `Modal` + `ModalHeader/Footer` | Medium |
| `apps/web/src/widgets/warehouse-editor/ui/published-banner.tsx` (pattern only) | Inline banner with action | reusable status banner pattern | text is domain-specific, but visual shell generic | Keep text/domain in app, extract `InlineBanner` shell | Medium |

### Keep in apps/web

| File | Component | Purpose | Dependency notes | Decision | Confidence |
|---|---|---|---|---|---|
| `apps/web/src/widgets/warehouse-editor/ui/editor-canvas.tsx` | `EditorCanvas` | Konva-based warehouse layout editor | heavy editor store + domain hooks | Keep | High |
| `apps/web/src/widgets/warehouse-editor/ui/mode-panels/cell-placement-inspector.tsx` | `CellPlacementInspector` | cell/container occupancy workflow | location/container/product hooks + mutations | Keep | High |
| `apps/web/src/widgets/warehouse-editor/ui/mode-panels/container-placement-inspector.tsx` | `ContainerPlacementInspector` | container inventory and movement workflow | multiple entity/feature dependencies | Keep | High |
| `apps/web/src/widgets/warehouse-editor/ui/rack-inspector.tsx` | `RackInspector` | rack edit/validation workflow | domain types + feature hooks + editor selectors | Keep | High |
| `apps/web/src/features/rack-configure/ui/*` | Rack config tabs/forms | rack geometry/face configuration | domain terms, rack-specific prop model | Keep | High |
| `apps/web/src/features/rack-create/ui/rack-creation-wizard.tsx` | `RackCreationWizard` | rack creation scenario | composes rack-specific components | Keep | High |
| `apps/web/src/features/face-b-configure-mode/ui/face-b-empty-state.tsx` | `FaceBEmptyState` | Face B strategy selection | explicitly rack/face domain language | Keep | High |
| `apps/web/src/widgets/app-shell/ui/top-bar.tsx` | `TopBar` | tenant/site/floor/layout actions + publish/save | auth + stores + entities + features | Keep | High |
| `apps/web/src/widgets/app-shell/ui/app-header.tsx` | `AppHeader` | authenticated header | auth + app drawer state | Keep | High |
| `apps/web/src/widgets/app-shell/ui/left-drawer.tsx` | `LeftDrawer` | product navigation | route config + product-specific IA labels | Keep | High |
| `apps/web/src/pages/orders/ui/orders-page.tsx` | `OrdersPage` | orders management workflow | order/product domain orchestration | Keep | High |
| `apps/web/src/pages/waves/ui/waves-page.tsx` | `WavesPage` | wave lifecycle workflow | wave/order APIs + domain status logic | Keep | High |
| `apps/web/src/pages/operations/ui/operations-page.tsx` | `OperationsPage` | operations landing/workflow | wave/order domain orchestration | Keep | High |
| `apps/web/src/pages/warehouse-setup/ui/warehouse-setup-page.tsx` | `WarehouseSetupPage` | site/floor workspace bootstrapping | site/floor/layout domain dependencies | Keep | High |

### Candidates

| File | Component | Why ambiguous | Decision now | Confidence |
|---|---|---|---|---|
| `apps/web/src/widgets/warehouse-editor/ui/mode-panels/layout-empty-panel.tsx` | `LayoutEmptyPanel` | visual empty-state shell is generic, copy/text/actions are layout-specific | Keep; extract generic `EmptyStatePanel` later | Medium |
| `apps/web/src/widgets/warehouse-editor/ui/mode-panels/placement-mode-panel.tsx` | `PlacementModePanel` | mostly presentational but hard-coded warehouse copy | Keep; migrate to generic shell + app-specific content | Medium |
| `apps/web/src/widgets/warehouse-editor/ui/tool-rail.tsx` | `ToolRail` | toolbar UI pattern reusable, but wired to editor mode/store | Keep; extract generic `IconRail` with controlled props later | Medium |
| `apps/web/src/features/rack-configure/ui/section-preset-form.tsx` | `Stepper` subcomponent | internal numeric stepper is generic, parent form is rack-specific | Extract only `NumberStepper` primitive | Medium |
| `apps/web/src/widgets/warehouse-editor/ui/published-banner.tsx` | `PublishedBanner` | visual “notice + CTA” pattern generic, semantics layout-specific | Keep semantic wrapper in app, share shell | Medium |

### Duplicates / cleanup

| Issue | Evidence | Action |
|---|---|---|
| Duplicate order drawer implementation | `pages/orders/ui/orders-page.tsx` has internal `OrderDrawer`, `TaskCard`, `ProductLineEditor`; `pages/operations/ui/order-drawer.tsx` defines near-identical components | Keep one domain component under `apps/web/src/features/order/ui/order-drawer.tsx`; import from both pages |
| Duplicate `WaveProgress` implementation | Present in both `pages/waves/ui/waves-page.tsx` and `pages/operations/ui/operations-page.tsx` | Extract shared visual primitive (`MetricProgress`) |
| Duplicate local `cn` helper | `shared/lib/react/cn.ts` and separate `cn` in `widgets/warehouse-editor/ui/rack-inspector.tsx` | Single source in shared UI package |
| Fake shared primitive | `shared/ui/button.tsx` exists but is essentially raw `<button {...props} />` and appears unused by app components | Replace with real typed button primitive; migrate usages incrementally |

## Target packages/ui Structure

```text
packages/ui/
  package.json
  tsconfig.json
  src/
    index.ts
    components/
      button.tsx
      input.tsx
      textarea.tsx
      select.tsx
      badge.tsx
      spinner.tsx
      skeleton.tsx
      modal.tsx
      dialog.tsx
      inline-banner.tsx
      empty-state.tsx
      error-state.tsx
      table-shell.tsx
      pagination.tsx
      number-stepper.tsx
      metric-progress.tsx
    layout/
      stack.tsx
      inline.tsx
      panel.tsx
      page-header.tsx
      toolbar.tsx
    hooks/
      use-disclosure.ts
      use-debounced-value.ts
      use-media-query.ts
    lib/
      cn.ts
      polymorphic.ts
    styles/
      tokens.css
      reset.css
```

### Export shape

- `packages/ui/src/index.ts` should re-export stable primitives only.
- No exports from feature/domain folders.
- `apps/web` imports via `@wos/ui` (or direct package path aliases during transition).

## Migration Phases

### Phase 0

- **Goal:** Baseline and guardrails.
- **Exact actions:**
  - Create `packages/ui/package.json`, `src/index.ts`, base folder skeleton.
  - Add lint rule/ESLint override to prevent `packages/ui` importing `@/entities/*`, `@/features/*`, `@wos/domain` business types.
  - Add workspace alias for `@wos/ui` in `apps/web` build config.
- **Prerequisites:** package scaffolding + path resolution.
- **Risks:** broken imports during alias setup.
- **Do NOT move yet:** any warehouse editor or order/wave workflow components.
- **Benefit:** safe boundary before extraction.

### Phase 1

- **Goal:** extract safe primitives first.
- **Move/extract:**
  - `shared/lib/react/cn.ts` → `packages/ui/src/lib/cn.ts`
  - `shared/ui/button.tsx` → `packages/ui/src/components/button.tsx` (upgrade API)
  - token subset from `app/styles/global.css` → `packages/ui/src/styles/tokens.css`
  - introduce `Spinner`, `Badge`, `EmptyState`, `ErrorState` primitives (from repeated inline patterns)
- **Prerequisites:** Phase 0 complete.
- **Risks:** style drift if tokens split incorrectly.
- **Do NOT move yet:** top bars, drawers, inspectors.
- **Benefit:** immediate reuse and visual consistency.

### Phase 2

- **Goal:** extract generic layout/state shells.
- **Move/extract:**
  - modal shell pattern from `operations-page`, `waves-page`, `orders-page` into `Modal`.
  - `WaveProgress` duplicated bars → `MetricProgress`.
  - `PublishedBanner`/`LayoutEmptyPanel` visuals into reusable `InlineBanner` + `EmptyStatePanel` (keep domain text in app).
  - `SectionPresetForm` internal numeric stepper → `NumberStepper`.
- **Prerequisites:** primitives available.
- **Risks:** accidental over-generalization.
- **Do NOT move yet:** scenario orchestration components.
- **Benefit:** reduces copy-paste while preserving domain boundaries.

### Phase 3

- **Goal:** address ambiguous candidates by decoupling first.
- **Move/extract candidates after refactor:**
  - `ToolRail` -> split into controlled generic `IconRail` + domain adapter in app.
  - extract optional `PanelHeader`, `PropertyList`, `KeyValueList` from rack/inspector UIs only if they become prop-driven and domain-agnostic.
- **Prerequisites:** clear prop contracts free from editor store dependencies.
- **Risks:** hidden coupling to editor state.
- **Do NOT move yet:** `EditorCanvas`, `RackInspector`, placement inspectors.
- **Benefit:** gradual boundary hardening without rewrite.

### Phase 4

- **Goal:** cleanup + enforcement.
- **Exact actions:**
  - remove duplicate `OrderDrawer` implementations by consolidating domain component in app layer.
  - replace remaining duplicate `cn`, modals, progress bars with `@wos/ui` imports.
  - add boundary lint checks in CI (`depcruise`/eslint import rules).
  - document contribution rules: what belongs in `packages/ui`.
- **Risks:** merge conflicts during broad replacement.
- **Do NOT move yet:** any component still importing domain hooks or business constants.
- **Benefit:** maintainable long-term architecture and faster UI development.

## Boundary / Dependency Risks

1. **Cross-layer coupling in visual components**
   - `TopBar` imports auth provider, app store selectors, entity queries, feature mutations, and domain types in one component; moving this would violate `packages/ui` boundaries.
2. **Shared-looking components with business hooks**
   - Placement/inspector components look like panels but directly call entity APIs and mutation hooks.
3. **Embedded helper duplication**
   - `cn` helper redefined locally in `rack-inspector` despite existing shared helper.
4. **Pseudo-generic page fragments**
   - modal/toolbar/progress fragments are repeated inline, but each file embeds domain actions.
5. **Package-level boundary risk**
   - `apps/web` alias currently includes `@wos/domain` only; `@wos/ui` wiring is absent and must be added deliberately.
6. **`packages/ui` should not depend on `packages/domain`**
   - Keep `packages/ui` typed with UI-generic primitives and primitive scalar props; adapt domain models in app adapters.

## Best First Extractions

1. **`cn` utility** (`shared/lib/react/cn.ts`)
   - Zero domain coupling; used pattern appears duplicated.
2. **`Button` primitive** (`shared/ui/button.tsx` -> enhanced)
   - Existing placeholder allows safe migration point and immediate standardization.
3. **`MetricProgress`** (from duplicated `WaveProgress`)
   - High reuse with tiny API (`value`, `max`, `colorWhenComplete`).
4. **`Modal` shell** (from operations/waves/orders modal wrappers)
   - Removes repeated overlay/container markup and keyboard/close behavior duplication.
5. **`StatusBadge` primitive** (from repeated status chip patterns)
   - Keep semantic mapping in app, move visual chip primitive.
6. **`EmptyState` + `ErrorState` + `Spinner`**
   - Repeated loading/empty/error scaffolding across pages/inspectors.
7. **`NumberStepper`** (from `SectionPresetForm` internal `Stepper`)
   - Pure UI control with broad utility.
8. **CSS tokens package file** (from `global.css` variable set)
   - Enables consistent theming and future multi-app usage.

## Anti-Patterns Found

- **Fake shared component:** a minimal `Button` primitive exists but does not provide real shared behavior/variants and appears underused.
- **Wrapper/duplication hell:** order drawer logic duplicated between orders and operations pages.
- **App-specific pretending generic (risk):** visual fragments like tool rails and banners are close to reusable but currently include domain wording/state wiring.
- **Inconsistent state components:** loading/error/empty UI implemented ad hoc in many places.
- **Styling duplication:** repeated utility class blocks for buttons, cards, modal containers, chips, and panel headers.
- **Feature logic mixed with presentation:** several large components combine API mutations, entity selectors, and rendering in one file.

## Final Recommendation

### Target tree

```text
packages/ui/
  package.json
  src/
    index.ts
    components/
      button.tsx
      modal.tsx
      badge.tsx
      spinner.tsx
      empty-state.tsx
      error-state.tsx
      metric-progress.tsx
      number-stepper.tsx
      inline-banner.tsx
    layout/
      panel.tsx
      stack.tsx
      inline.tsx
      toolbar.tsx
    lib/
      cn.ts
    hooks/
      use-disclosure.ts
      use-debounced-value.ts
    styles/
      tokens.css
```

### Migration order

1. Scaffold `packages/ui` package + exports + lint guardrails.
2. Move `cn` and `Button`; start replacing local duplicates.
3. Extract `Modal`, `MetricProgress`, `Spinner`, `EmptyState`, `ErrorState`.
4. Consolidate duplicate `OrderDrawer` in app domain layer (not in UI package).
5. Extract `NumberStepper`, `InlineBanner`, and panel/layout shells.
6. Evaluate candidates (`ToolRail`, layout empty panels) only after dependency decoupling.

### Guardrails

- `packages/ui` may not import from `@/entities`, `@/features`, `@/app`, or business API clients.
- `packages/ui` may not accept domain models directly (`Rack`, `Wave`, etc.); pass primitive props/view-models.
- Any new component entering `packages/ui` must show at least 2 usage contexts or clear cross-feature reuse potential.
- If uncertain, keep component in `apps/web` and extract only the generic subparts.
