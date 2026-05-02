# Component Map

Карта ниже описывает текущую реализацию в `apps/web/src`, а не целевую FSD-схему.

## Route Chain

`AppRouter` -> `ProtectedRoute` -> `AppShell` -> route page

- `AppRouter` (`app/router/routes.tsx`) монтирует:
  - `/login` -> `LoginPage`
  - `/warehouse` -> `ProtectedRoute` -> `AppShell` -> `WarehouseSetupPage`
  - `/products` -> `ProtectedRoute` -> `AppShell` -> `ProductsPage`
  - `/operations` -> `ProtectedRoute` -> `AppShell` -> `OperationsPage`
- `ProtectedRoute` владеет только auth/workspace gate.
- `AppShell` сейчас рендерит только `TopBar` + `Outlet`.
- `LeftDrawer` существует в `widgets/app-shell/ui/left-drawer.tsx`, но в текущий shell не подключен.

---

## Route: `/login`

### Page

- `pages/login/ui/login-page.tsx`
  - stateful page
  - держит локальное form state: `mode`, `email`, `password`, `isSubmitting`, `formError`
  - читает `useAuth()`
  - после успешного auth делает redirect на `/warehouse`

### Widgets

- нет

### Features

- отдельного feature-slice для auth form пока нет

### Entities

- нет

### Data flow

- `AuthProvider` -> `useAuth()` -> `LoginPage`
- `LoginPage` -> `signIn` / `signUp` -> Supabase auth + BFF `/me`
- `LoginPage` -> `navigate(nextPath)`

### Presentational vs stateful

- stateful: `LoginPage`
- dumb/presentational: нет выделенных подкомпонентов

### Temporary / placeholder

- нет явных placeholder-компонентов, но вся auth UI живет прямо в page без выделения feature/widget слоя

---

## Route: `/warehouse`

### Page

- `warehouse/app/routes/warehouse-setup/ui/warehouse-setup-page.tsx`
  - главный оркестратор route
  - читает:
    - `useActiveSiteId`, `useActiveFloorId` из `app/store/ui-store`
    - `useSites()`
    - `useFloors(activeSiteId)`
    - `useActiveLayoutDraft(activeFloorId)`
  - выставляет default site через `setActiveSiteId`
  - вычисляет `WarehouseSetupState`
  - роутит UI между bootstrap / floor selection / editor

### Widgets

- `widgets/app-shell/ui/top-bar.tsx`
- `warehouse/bootstrap/ui/bootstrap-wizard.tsx`
- `warehouse/bootstrap/ui/site-floor-setup-state.tsx`
- `warehouse/editor/ui/warehouse-editor.tsx`

### Feature slices, реально задействованные маршрутом

- `features/site-create`
- `features/floor-create`
- `features/layout-draft-save`
- `features/layout-validate`
- `features/layout-publish`
- `features/rack-create`
- `features/rack-configure`
- `features/face-b-configure-mode`

### Entity slices, реально задействованные маршрутом

- `entities/site`
- `entities/floor`
- `entities/layout-version`

### Entity slices, присутствуют, но в route не участвуют

- `entities/rack`
- `entities/cell`
  - сейчас это по сути заготовки API-границы
  - импортов из UI-слоев у них нет

---

## Route: `/warehouse` -> Page state split

### `bootstrap_required`

- `BootstrapWizard`
  - stateful widget
  - держит локальные поля первого site/floor
  - вызывает:
    - `useCreateSite`
    - `useCreateFloor`
    - `useCreateLayoutDraft`
  - после успеха пишет:
    - `ui-store.activeSiteId`
    - `ui-store.activeFloorId`

### `floor_selection_required`

- `SiteFloorSetupState`
  - stateful widget
  - показывает текущий site/floor context
  - умеет:
    - создать site
    - создать floor
    - создать draft для выбранного floor
    - показать published layout summary
  - читает:
    - `useSites`
    - `useFloors`
    - `usePublishedLayoutSummary`
    - `ui-store`

### `draft_ready`

- `WarehouseEditor`
  - stateful widget
  - соединяет editor canvas + tool rail + inspector
  - грузит live draft через `useActiveLayoutDraft(activeFloorId)`
  - инициализирует `entities/layout-version/model/editor-store`

---

## Inside `warehouse/editor`

### Widget shell

- `warehouse/editor/ui/warehouse-editor.tsx`
  - stateful orchestrator
  - владеет:
    - `inspectorOpen`
    - auto-open/close inspector на основе `selectedRackId` и `creatingRackId`
  - инициализирует editor state:
    - `initializeDraft(layoutDraft)`
    - `resetDraft()` при смене floor
  - children:
    - `ToolRail`
    - `EditorCanvas`
    - `RackInspector`

### Left side: tooling

- `ToolRail`
  - thin connected component
  - читает `viewMode`, `editorMode`, `layoutDraft`
  - меняет только `editorMode`
  - реальный набор инструментов:
    - `layout`: `Select`, `Rack`
    - `semantics`: только `Select`
    - `placement`: только `Select`
    - `flow`: только `Select`

### Center: canvas

- `EditorCanvas`
  - самый stateful UI-компонент редактора
  - работает с canvas напрямую через `react-konva`
  - local transient state:
    - `viewport`
    - `canvasOffset`
    - `isPanning`
    - `snapGuides`
  - global editor state:
    - `zoom`
    - `editorMode`
    - `draft`
    - `selectedRackIds`
    - `hoveredRackId`
    - `minRackDistance`
  - делает spatial mutations:
    - `createRack`
    - `updateRackPosition`
    - `rotateRack`
    - `duplicateRack`
    - `deleteRack`
    - `setSelectedRackIds`
    - `toggleRackSelection`
  - canvas children:
    - `FloatingToolbar`
    - `RackBody`
    - `RackSections`
    - `RackCells`
    - `SnapGuides`

### Right side: inspector

- `RackInspector`
  - stateful structural editor
  - local UI state:
    - `openSections`
    - `confirmingDelete`
  - global editor state:
    - selected/creating rack
    - draft
    - dirty flag
  - pure domain reads:
    - `generatePreviewCells(layoutDraft)`
    - `validateLayoutDraft(layoutDraft)`
  - server validation cache:
    - `useCachedLayoutValidation(layoutVersionId)`
  - structural mutations:
    - `updateFaceConfig`
    - `applyFacePreset`
    - `setFaceBMode`
    - `resetFaceB`
    - `rotateRack`
    - `duplicateRack`
    - `deleteRack`
  - дочерние editor parts:
    - `RackCreationWizard` when `selectedRackId === creatingRackId`
    - `GeneralTab`
    - `SpacingTab`
    - `SectionPresetForm`
    - `FrontElevationPreview`
    - `FaceTab`
    - `FaceBEmptyState`

---

## Editor component ownership

### Canvas-owned components

- `EditorCanvas`
- `FloatingToolbar`
- `RackBody`
- `RackSections`
- `RackCells`
- `SnapGuides`

Их зона ответственности:

- spatial selection
- click-to-place
- drag move
- snap guides
- zoom / pan
- 90 degree rotation trigger
- визуальный preview rack geometry

### Inspector-owned components

- `RackInspector`
- `RackCreationWizard`
- `GeneralTab`
- `SpacingTab`
- `FaceTab`
- `SectionPresetForm`
- `FrontElevationPreview`
- `FaceBEmptyState`

Их зона ответственности:

- rack general fields
- face A / face B configuration
- section/level/slot structure
- numbering direction
- spacing rules and multi-select alignment commands
- validation preview
- generated address preview

### Top-bar-owned lifecycle

- `TopBar`
  - не редактирует rack structure напрямую
  - владеет layout lifecycle actions:
    - create draft
    - save draft
    - validate draft
    - publish draft
    - site/floor switch
    - view mode switch

---

## Real data flow

### 1. Context selection and bootstrap

- `TopBar` <-> `ui-store`
  - `activeSiteId`
  - `activeFloorId`
- `WarehouseSetupPage` читает этот context
- `useSites` и `useFloors(activeSiteId)` дают read model для page/top-bar/bootstrap
- `BootstrapWizard` и `SiteFloorSetupState` вызывают feature mutations
- feature mutations инвалидируют entity queries

### 2. Loading editor draft

- `useActiveLayoutDraft(activeFloorId)` -> `WarehouseSetupPage`
- `WarehouseSetupPage` решает, можно ли открыть editor
- `WarehouseEditor` снова читает `useActiveLayoutDraft(activeFloorId)`
- `WarehouseEditor` -> `initializeDraft(layoutDraft)` -> `editor-store`

Это важный факт текущей реализации:

- live draft приходит из React Query
- после этого рабочая editable truth живет в `entities/layout-version/model/editor-store`
- `EditorCanvas` и `RackInspector` не получают draft через props
- они читают один и тот же `editor-store`

### 3. Spatial editing path

- `EditorCanvas`
  - читает `draft` и selection из `editor-store`
  - пишет обратно spatial mutations в `editor-store`
- `RackInspector`
  - мгновенно видит эти изменения, потому что читает тот же store

### 4. Structural editing path

- `GeneralTab`, `FaceTab`, `SpacingTab`, `RackCreationWizard`
  - вызывают selector actions из `editor-store`
- `RackInspector`
  - рендерит derived preview из уже измененного draft
- `EditorCanvas`
  - перерисовывает geometry из того же draft

### 5. Persist / validate / publish path

- `TopBar` -> `useSaveLayoutDraft(activeFloorId)` -> BFF `/layout-drafts/save`
- `TopBar` -> `useLayoutValidation(layoutVersionId)` -> BFF `/layout-drafts/{id}/validate`
- `TopBar` -> `usePublishLayout(activeFloorId)` -> BFF `/layout-drafts/{id}/publish`
- `useSaveLayoutDraft` после успеха:
  - `markDraftSaved(layoutVersionId)` в `editor-store`
  - invalidate `activeDraft(floorId)`
- `usePublishLayout` invalidate `activeDraft(floorId)`

### 6. Read model boundaries

- `entities/site`, `entities/floor`, `entities/layout-version`
  - содержат React Query hooks и query keys
  - являются read boundary между widgets/pages и BFF
- `shared/api/bff/client.ts`
  - общий transport boundary
- `@wos/domain`
  - pure domain rules:
    - `generatePreviewCells`
    - `validateLayoutDraft`
    - schema parsing

---

## Stateful vs dumb / presentational

### Stateful orchestrators

- `AuthProvider`
- `ProtectedRoute`
- `LoginPage`
- `WarehouseSetupPage`
- `WarehouseEditor`
- `TopBar`
- `BootstrapWizard`
- `SiteFloorSetupState`
- `EditorCanvas`
- `RackInspector`
- `RackCreationWizard`
- `ProductsPage`
- `OperationsPage`

### Thin connected components

- `ToolRail`
- `GeneralTab`
- `SpacingTab`
- `FaceTab`

Это не dumb-компоненты: они сами подписаны на store/actions, но их orchestration узкая.

### Local-state feature UI

- `SectionPresetForm`
  - держит локальные scalar controls и отдает mutation наружу через `onApply`

### Dumb / presentational

- `AppShell`
- `FaceBEmptyState`
- `FrontElevationPreview`
- `RackBody`
- `RackSections`
- `RackCells`
- `SnapGuides`

---

## Current ownership rules from code

- `WarehouseSetupPage` owns route branching between bootstrap, floor gate and editor.
- `TopBar` owns global warehouse context switching and draft lifecycle actions.
- `WarehouseEditor` owns editor shell composition and inspector visibility.
- `EditorCanvas` owns spatial interaction only.
- `RackInspector` owns structural editing only.
- `features/*` own transport mutations to BFF.
- `entities/*` own query keys, read hooks and API read-model boundaries.
- `@wos/domain` owns pure layout rules, generated cells and validation logic.

---

## Temporary / legacy / placeholder

### Definitely temporary / placeholder

- `pages/products/ui/products-page.tsx`
  - работает на `demoProducts`
  - не использует entities/features/api
  - сейчас это standalone demo page

- `pages/operations/ui/operations-page.tsx`
  - работает на локальных `lines` и `pickingEvents`
  - не использует entities/features/api
  - часть блоков прямо подписана как "что еще должно быть на экране"
  - это route-level placeholder

- `TopBar` view modes:
  - `semantics`
  - `placement`
  - `flow`
  - помечены `available: false`
  - UI уже есть, функциональности нет

- `TopBar` actions:
  - `Undo`
  - `Redo`
  - явно disabled с `coming soon`

- `ToolRail`
  - полноценно поддерживает только `layout`
  - для остальных modes по сути остается `Select`

### Legacy / orphaned right now

- `widgets/app-shell/ui/left-drawer.tsx`
  - существует, но не подключен в `AppShell`
  - выглядит как оставшаяся/отложенная реализация shell navigation

- `features/rack-configure/ui/summary-tab.tsx`
  - экспортируется, но нигде не импортируется
  - сейчас orphaned component

### Intentional empty states, не legacy

- `FaceBEmptyState`
  - реальный рабочий empty state до выбора стратегии Face B

- `RackInspector` -> `No rack selected`
  - реальный empty state inspector без selection

- `WarehouseSetupPage` loading/error cards
  - реальные route gate states, не placeholder

---

## Practical map by layer

### `app`

- `router/routes.tsx`
- `router/protected-route.tsx`
- `layouts/app-shell.tsx`
- `providers/auth-provider.tsx`
- `store/ui-store.ts`

### `pages`

- `login`
- `warehouse-setup`
- `products`
- `operations`

### `widgets`

- `app-shell/top-bar`
- `warehouse/bootstrap/bootstrap-wizard`
- `warehouse/bootstrap/site-floor-setup-state`
- `warehouse/editor/warehouse-editor`
- `warehouse/editor/editor-canvas`
- `warehouse/editor/rack-inspector`
- `warehouse/editor/tool-rail`

### `features`

- create site/floor
- create/save draft
- validate/publish draft
- rack creation wizard
- rack configure forms
- face B mode selection

### `entities`

- `site`: site list read model
- `floor`: floor list read model
- `layout-version`: active draft, published summary, editor store
- `rack` and `cell`: present but currently not wired into route composition

## Short ownership summary

- Canvas owns spatial interaction only.
- Inspector owns structural editing.
- Top bar owns draft lifecycle and warehouse context switching.
- Features own write operations to BFF.
- Entities own read models and query boundaries.
- Current editable layout truth lives in `entities/layout-version/model/editor-store`, not in canvas props and not in inspector-local state.
