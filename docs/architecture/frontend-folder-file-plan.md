# Frontend Folder/File Plan

## Purpose

This document defines the recommended frontend folder and file structure for `Warehouse Setup + Stock-Aware Directed Picking V1`.

It translates the architecture baseline and Supabase schema map into a concrete implementation layout for the frontend application.

This document complements:

- [architecture-baseline.md](./architecture-baseline.md)
- [supabase-schema-module-map.md](./supabase-schema-module-map.md)

## Frontend Stack Context

The plan assumes:

- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- Zustand
- React Hook Form
- Zod
- React Konva
- Supabase as backend

## Design Goals

The frontend structure must support:

1. strict domain boundaries
2. separation of server state, derived state, and UI-only state
3. canvas as spatial context only
4. inspector as structural editor
5. import-driven operational workflows
6. operator and picker flows without collapsing into a full WMS frontend

It must avoid:

- feature-to-feature spaghetti imports
- raw Supabase row types leaking into UI
- business logic embedded in JSX
- canvas owning structural truth
- route pages containing domain logic

## Top-Level App Structure

Recommended structure for `apps/web`:

```text
apps/web/
  e2e/
  public/
  src/
    app/
    pages/
    widgets/
    features/
    entities/
    processes/
    shared/
  .ladle/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

## Layer Responsibilities

### `app`

App-level wiring only.

Allowed responsibilities:

- bootstrapping
- providers
- router
- app shell layout
- global UI store
- global styles

### `pages`

Route-level composition only.

Allowed responsibilities:

- assembling widgets and processes for a route
- passing route params and high-level page context

Not allowed:

- direct database orchestration
- large business workflows
- reusable domain logic

### `widgets`

Large screen blocks.

Allowed responsibilities:

- page regions
- screen-level composites
- canvas shell
- inspector shell
- imports console shell
- picker session shell

### `features`

User actions and bounded interaction flows.

Allowed responsibilities:

- mutations
- forms
- small workflow slices
- action buttons and state transitions

### `entities`

Domain entities and their frontend API boundaries.

Allowed responsibilities:

- entity types
- selectors
- API queries and mutations
- row-to-domain mappers
- entity-level small UI fragments

### `processes`

Cross-entity, cross-feature orchestration.

Allowed responsibilities:

- warehouse setup flow
- import pipeline flow
- order readiness flow
- directed picking flow

### `shared`

Foundation only.

Allowed responsibilities:

- Supabase client
- config
- generic utilities
- generic UI primitives
- cross-cutting helpers

## `src/app` Plan

```text
src/app/
  bootstrap/
    main.tsx
  providers/
    app-provider.tsx
    query-provider.tsx
    auth-provider.tsx
  router/
    index.tsx
    routes.tsx
  layouts/
    app-shell.tsx
  store/
    ui-store.ts
  styles/
    global.css
```

### File roles

#### `bootstrap/main.tsx`

- frontend entrypoint
- mounts the app

#### `providers/query-provider.tsx`

- owns `QueryClientProvider`
- sets query defaults

#### `providers/auth-provider.tsx`

- bootstraps Supabase auth/session state

#### `providers/app-provider.tsx`

- composes all top-level providers

#### `router/routes.tsx`

- canonical route map

#### `layouts/app-shell.tsx`

- shared shell layout across module pages

#### `store/ui-store.ts`

- global UI-only state such as drawer collapse
- must not hold domain truth

#### `styles/global.css`

- Tailwind import
- app tokens and minimal global base styles

## `src/pages` Plan

```text
src/pages/
  warehouse-setup/
    ui/
      warehouse-setup-page.tsx
  products/
    ui/
      products-page.tsx
  imports/
    ui/
      imports-page.tsx
  operations/
    ui/
      operations-page.tsx
  picker/
    ui/
      picker-page.tsx
```

### Route roles

#### `warehouse-setup-page.tsx`

- renders warehouse editor and rack inspector workflow

#### `products-page.tsx`

- renders product master and product-location role views

#### `imports-page.tsx`

- renders import jobs and preview/publish flows

#### `operations-page.tsx`

- renders readiness and task generation flows

#### `picker-page.tsx`

- renders picker execution interface

## `src/widgets` Plan

```text
src/widgets/
  app-shell/
    ui/
      left-drawer.tsx
      top-bar.tsx
      module-header.tsx
  warehouse-editor/
    model/
      editor-store.ts
      editor-selectors.ts
      editor-types.ts
    ui/
      warehouse-editor.tsx
      editor-toolbar.tsx
      editor-canvas.tsx
      canvas-grid.tsx
      canvas-viewport.tsx
      rack-node.tsx
      selection-overlay.tsx
      zoom-controls.tsx
    lib/
      canvas-mappers.ts
      canvas-geometry.ts
  rack-inspector/
    ui/
      rack-inspector.tsx
      inspector-summary.tsx
      inspector-tabs.tsx
      publish-impact-panel.tsx
      validation-banner.tsx
  imports-console/
    ui/
      imports-console.tsx
      import-job-list.tsx
      import-job-detail.tsx
      import-preview-table.tsx
      import-lineage-panel.tsx
  readiness-board/
    ui/
      readiness-board.tsx
      readiness-summary-cards.tsx
      readiness-filters.tsx
      readiness-table.tsx
  pick-task-board/
    ui/
      pick-task-board.tsx
      pick-task-list.tsx
      pick-task-detail.tsx
  picker-session/
    ui/
      picker-session.tsx
      current-pick-card.tsx
      picker-progress.tsx
      same-cell-hint.tsx
      picker-actions.tsx
```

### Widget responsibilities

#### `app-shell`

- left navigation
- top bar
- shared page framing

#### `warehouse-editor`

- React Konva integration
- canvas viewport and interactions
- selected rack display
- no structural truth ownership

#### `rack-inspector`

- sticky summary
- inspector tabs container
- validation and publish impact shell

#### `imports-console`

- import jobs list
- detail panel
- preview table
- lineage display

#### `readiness-board`

- readiness cards, filters, and tabular outcome view

#### `pick-task-board`

- operator-facing task list and details

#### `picker-session`

- picker execution card flow
- progress and action controls

## `src/features` Plan

```text
src/features/
  layout-draft-save/
    api/
      mutations.ts
    model/
      use-save-layout-draft.ts
  layout-publish/
    api/
      mutations.ts
    model/
      use-publish-layout.ts
    ui/
      publish-layout-button.tsx
  layout-validate/
    api/
      queries.ts
    model/
      use-layout-validation.ts
  rack-create/
    model/
      use-create-rack.ts
    ui/
      create-rack-button.tsx
  rack-move/
    model/
      use-move-rack.ts
  rack-rotate/
    model/
      use-rotate-rack.ts
  rack-configure/
    model/
      rack-config-form.ts
      rack-config-schema.ts
      rack-config-default-values.ts
    ui/
      general-tab.tsx
      face-tab.tsx
      summary-tab.tsx
  face-b-configure-mode/
    model/
      types.ts
      use-face-b-mode.ts
    ui/
      face-b-empty-state.tsx
      face-b-mode-selector.tsx
  face-compare-mode/
    ui/
      face-compare-mode.tsx
      face-compare-section-row.tsx
  import-upload/
    api/
      mutations.ts
    ui/
      import-upload-dropzone.tsx
  import-publish/
    api/
      mutations.ts
    ui/
      publish-import-button.tsx
  order-readiness-resolve/
    api/
      mutations.ts
    model/
      use-resolve-order-readiness.ts
  pick-task-generate/
    api/
      mutations.ts
    ui/
      generate-pick-task-button.tsx
  pick-item-confirm/
    api/
      mutations.ts
    ui/
      confirm-pick-item-button.tsx
  pick-item-report-exception/
    api/
      mutations.ts
    ui/
      report-short-button.tsx
      report-missing-button.tsx
      report-damaged-button.tsx
```

### Feature rules

- a feature may import `entities` and `shared`
- a feature must not import another feature by default
- feature UI should remain action-focused, not page-structural

## `src/entities` Plan

```text
src/entities/
  site/
    model/
      types.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
  floor/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
  layout-version/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
  rack/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mutations.ts
      mappers.ts
      keys.ts
    ui/
      rack-badge.tsx
      rack-summary.tsx
  rack-face/
    model/
      types.ts
  rack-section/
    model/
      types.ts
  cell/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
    ui/
      cell-address-badge.tsx
  product/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mutations.ts
      mappers.ts
      keys.ts
  product-location-role/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mutations.ts
      mappers.ts
      keys.ts
  container/
    model/
      types.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
  inventory-item/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
  import-job/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mutations.ts
      mappers.ts
      keys.ts
  stock-snapshot/
    model/
      types.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
  order/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
  pick-task/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
  pick-item/
    model/
      types.ts
      selectors.ts
    api/
      queries.ts
      mappers.ts
      keys.ts
```

### Entity file roles

#### `model/types.ts`

- local entity-facing types composed from domain contracts if needed

#### `model/selectors.ts`

- pure selectors over entity data

#### `api/keys.ts`

- TanStack Query keys

#### `api/queries.ts`

- reads from Supabase

#### `api/mutations.ts`

- writes to Supabase or invokes RPC

#### `api/mappers.ts`

- maps raw Supabase row types to domain/entity types
- must be the only place where DB row shape is interpreted

#### `ui/*`

- tiny entity visuals only
- not full-screen compositions

## Supabase Type Boundary Rule

This structure assumes one strict rule:

- generated Supabase row types must not leave `api/` folders

Allowed:

- `Database['public']['Tables']['racks']['Row']` inside `entities/rack/api/mappers.ts`

Forbidden:

- UI components importing raw Supabase row types
- feature logic depending on table row shapes

Mapping flow must be:

1. Supabase row
2. `api/mappers.ts`
3. Zod parse / normalize via `packages/domain`
4. mapped domain/entity object
5. UI consumes clean object

## `src/processes` Plan

```text
src/processes/
  warehouse-setup/
    ui/
      warehouse-setup-flow.tsx
  import-pipeline/
    ui/
      import-pipeline-flow.tsx
  order-readiness/
    ui/
      order-readiness-flow.tsx
  directed-picking/
    ui/
      directed-picking-flow.tsx
```

### Process responsibilities

#### `warehouse-setup-flow.tsx`

- connects editor, inspector, validation, save draft, and publish flow

#### `import-pipeline-flow.tsx`

- connects upload, preview, lineage, and publish

#### `order-readiness-flow.tsx`

- connects import outcomes, readiness summaries, and task generation triggers

#### `directed-picking-flow.tsx`

- connects pick task detail and picker execution sequence

## `src/shared` Plan

```text
src/shared/
  api/
    supabase/
      client.ts
      types.ts
      query-client.ts
  config/
    env.ts
    routes.ts
  lib/
    format/
      numbers.ts
      dates.ts
      addresses.ts
    zod/
      common.ts
    guards/
      is-non-null.ts
    react/
      cn.ts
  types/
    common.ts
  constants/
    ui.ts
  ui/
    button.tsx
    input.tsx
    select.tsx
    tabs.tsx
    panel.tsx
    badge.tsx
    table.tsx
    empty-state.tsx
    form-field.tsx
```

### Shared rules

Do put here:

- Supabase client setup
- generic formatting helpers
- generic components
- environment config

Do not put here:

- rack logic
- addressing logic with warehouse semantics
- picking rules
- import domain orchestration

## Warehouse Setup Exact File Plan

This is the first major frontend module and should be implemented first.

```text
src/pages/warehouse-setup/ui/warehouse-setup-page.tsx

src/widgets/warehouse-editor/ui/warehouse-editor.tsx
src/widgets/warehouse-editor/ui/editor-toolbar.tsx
src/widgets/warehouse-editor/ui/editor-canvas.tsx
src/widgets/warehouse-editor/ui/rack-node.tsx
src/widgets/warehouse-editor/model/editor-store.ts
src/widgets/warehouse-editor/model/editor-selectors.ts
src/widgets/warehouse-editor/lib/canvas-mappers.ts

src/widgets/rack-inspector/ui/rack-inspector.tsx
src/widgets/rack-inspector/ui/inspector-summary.tsx
src/widgets/rack-inspector/ui/inspector-tabs.tsx
src/widgets/rack-inspector/ui/publish-impact-panel.tsx
src/widgets/rack-inspector/ui/validation-banner.tsx

src/features/rack-configure/ui/general-tab.tsx
src/features/rack-configure/ui/face-tab.tsx
src/features/rack-configure/ui/summary-tab.tsx
src/features/face-b-configure-mode/ui/face-b-empty-state.tsx
src/features/face-compare-mode/ui/face-compare-mode.tsx

src/features/layout-draft-save/model/use-save-layout-draft.ts
src/features/layout-publish/model/use-publish-layout.ts
src/features/layout-validate/model/use-layout-validation.ts
```

## Products and Roles Exact File Plan

```text
src/pages/products/ui/products-page.tsx

src/widgets/product-master/ui/product-master-table.tsx
src/widgets/product-location-roles/ui/product-location-roles-table.tsx

src/entities/product/api/queries.ts
src/entities/product/api/mutations.ts
src/entities/product/api/mappers.ts

src/entities/product-location-role/api/queries.ts
src/entities/product-location-role/api/mutations.ts
src/entities/product-location-role/api/mappers.ts
```

## Imports Exact File Plan

```text
src/pages/imports/ui/imports-page.tsx

src/widgets/imports-console/ui/imports-console.tsx
src/widgets/imports-console/ui/import-job-list.tsx
src/widgets/imports-console/ui/import-job-detail.tsx
src/widgets/imports-console/ui/import-preview-table.tsx
src/widgets/imports-console/ui/import-lineage-panel.tsx

src/features/import-upload/api/mutations.ts
src/features/import-upload/ui/import-upload-dropzone.tsx
src/features/import-publish/api/mutations.ts
src/features/import-publish/ui/publish-import-button.tsx

src/entities/import-job/api/queries.ts
src/entities/import-job/api/mutations.ts
src/entities/import-job/api/mappers.ts
src/entities/import-job/model/selectors.ts
```

## Operations and Readiness Exact File Plan

```text
src/pages/operations/ui/operations-page.tsx

src/widgets/readiness-board/ui/readiness-board.tsx
src/widgets/readiness-board/ui/readiness-summary-cards.tsx
src/widgets/readiness-board/ui/readiness-filters.tsx
src/widgets/readiness-board/ui/readiness-table.tsx

src/features/order-readiness-resolve/api/mutations.ts
src/features/order-readiness-resolve/model/use-resolve-order-readiness.ts
src/features/pick-task-generate/api/mutations.ts
src/features/pick-task-generate/ui/generate-pick-task-button.tsx

src/entities/order/api/queries.ts
src/entities/order/api/mappers.ts
src/entities/pick-task/api/queries.ts
src/entities/pick-task/api/mappers.ts
```

## Picker Exact File Plan

```text
src/pages/picker/ui/picker-page.tsx

src/widgets/picker-session/ui/picker-session.tsx
src/widgets/picker-session/ui/current-pick-card.tsx
src/widgets/picker-session/ui/picker-progress.tsx
src/widgets/picker-session/ui/same-cell-hint.tsx
src/widgets/picker-session/ui/picker-actions.tsx

src/features/pick-item-confirm/api/mutations.ts
src/features/pick-item-confirm/ui/confirm-pick-item-button.tsx

src/features/pick-item-report-exception/api/mutations.ts
src/features/pick-item-report-exception/ui/report-short-button.tsx
src/features/pick-item-report-exception/ui/report-missing-button.tsx
src/features/pick-item-report-exception/ui/report-damaged-button.tsx

src/entities/pick-item/api/queries.ts
src/entities/pick-item/api/mappers.ts
```

## Query/API Conventions

Each entity API folder should follow this structure where applicable:

```text
api/
  keys.ts
  queries.ts
  mutations.ts
  mappers.ts
```

### Responsibilities

- `keys.ts`: query keys
- `queries.ts`: read requests
- `mutations.ts`: writes or RPC calls
- `mappers.ts`: DB row to domain/entity mapping

## Form Conventions

Dense forms should use a `model/` structure like this:

```text
model/
  schema.ts
  default-values.ts
  form.ts
```

Example for rack config:

```text
src/features/rack-configure/model/
  rack-config-schema.ts
  rack-config-default-values.ts
  rack-config-form.ts
```

## Warehouse Editor Store Rules

The warehouse editor is the highest-risk rendering area.

Recommended files:

```text
src/widgets/warehouse-editor/model/
  editor-store.ts
  editor-selectors.ts
  editor-types.ts
```

Rules:

- no whole-store subscriptions
- use atomic selectors only
- keep drag/hover/pointer state isolated from inspector state
- Konva nodes should receive derived props, not raw business state objects

Correct pattern:

```ts
const zoom = useEditorStore((state) => state.zoom);
const selectedRackId = useEditorStore((state) => state.selectedRackId);
```

Forbidden pattern:

```ts
const editorState = useEditorStore();
```

## Story / Sandbox Files

Use Ladle for state-heavy UI development.

Recommended stories:

```text
src/widgets/rack-inspector/ui/rack-inspector.stories.tsx
src/widgets/warehouse-editor/ui/editor-canvas.stories.tsx
src/widgets/imports-console/ui/imports-console.stories.tsx
src/widgets/picker-session/ui/picker-session.stories.tsx
src/features/face-b-configure-mode/ui/face-b-empty-state.stories.tsx
src/features/face-compare-mode/ui/face-compare-mode.stories.tsx
```

Priority coverage:

- rack inspector empty and loaded states
- Face B mirror / copy / scratch
- compare mode
- layout validation errors
- publish blocked state
- import preview with row errors
- picker same-cell sequence

## E2E File Plan

```text
apps/web/e2e/
  warehouse-setup.spec.ts
  imports.spec.ts
  readiness.spec.ts
  picking.spec.ts
```

### E2E responsibilities

#### `warehouse-setup.spec.ts`

- create floor
- create and configure rack
- save draft
- publish layout

#### `imports.spec.ts`

- upload import
- preview rows
- publish import

#### `readiness.spec.ts`

- resolve order readiness
- inspect ready / blocked / shortage / exception buckets

#### `picking.spec.ts`

- generate pick task
- execute item-by-item picking flow
- verify same-cell repeated steps remain separate confirmations

## Initial File Scaffolding Priority

Recommended order of creation:

1. `app/`
2. `shared/`
3. `entities/layout-version`, `entities/rack`, `entities/cell`
4. `widgets/app-shell`
5. `widgets/warehouse-editor`
6. `widgets/rack-inspector`
7. `features/rack-configure`, `layout-save`, `layout-validate`, `layout-publish`
8. `entities/product`, `product-location-role`, `import-job`
9. `widgets/imports-console`
10. `widgets/readiness-board`
11. `widgets/picker-session`

## Minimal First File Set

A pragmatic initial file set for the first frontend implementation slice:

```text
apps/web/src/app/bootstrap/main.tsx
apps/web/src/app/providers/app-provider.tsx
apps/web/src/app/providers/query-provider.tsx
apps/web/src/app/router/routes.tsx
apps/web/src/app/layouts/app-shell.tsx
apps/web/src/app/styles/global.css

apps/web/src/shared/api/supabase/client.ts
apps/web/src/shared/api/supabase/types.ts
apps/web/src/shared/api/supabase/query-client.ts

apps/web/src/pages/warehouse-setup/ui/warehouse-setup-page.tsx

apps/web/src/widgets/app-shell/ui/left-drawer.tsx
apps/web/src/widgets/app-shell/ui/top-bar.tsx

apps/web/src/widgets/warehouse-editor/model/editor-store.ts
apps/web/src/widgets/warehouse-editor/model/editor-selectors.ts
apps/web/src/widgets/warehouse-editor/ui/warehouse-editor.tsx
apps/web/src/widgets/warehouse-editor/ui/editor-canvas.tsx

apps/web/src/widgets/rack-inspector/ui/rack-inspector.tsx
apps/web/src/widgets/rack-inspector/ui/inspector-summary.tsx

apps/web/src/features/rack-configure/ui/general-tab.tsx
apps/web/src/features/rack-configure/ui/face-tab.tsx
apps/web/src/features/rack-configure/ui/summary-tab.tsx
apps/web/src/features/face-b-configure-mode/ui/face-b-empty-state.tsx

apps/web/src/entities/layout-version/api/queries.ts
apps/web/src/entities/rack/api/queries.ts
apps/web/src/entities/rack/api/mappers.ts
apps/web/src/entities/cell/api/queries.ts
apps/web/src/entities/cell/api/mappers.ts
```

## Main Rule Summary

If reduced to one rule:

- `pages` compose
- `widgets` structure screen regions
- `features` implement user actions
- `entities` own entity contracts and API boundaries
- `shared` provides the foundation
- `app` wires the application together

The folder plan is only correct if it preserves the architecture baseline:

- domain types stay decoupled from DB row shapes
- canvas remains spatial context
- inspector remains structural editor
- imports remain pipeline-driven
- operational flows remain narrow and explicit
