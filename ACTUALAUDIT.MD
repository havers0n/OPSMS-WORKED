Based on the full codebase read, here is the audit.

---

# WOS UI Architecture Audit

---

## 1. Executive Verdict

- **The FSD-like layer separation (app / pages / widgets / features / entities / shared) is sound in intent** and is followed consistently enough that it is worth preserving rather than replacing.
- **`shared/ui` is not a UI library.** It is a single 5-line button wrapper. The name implies a foundation that does not exist. Nothing can depend on it as a foundation because there is nothing there.
- **`entities/` has no UI files at all.** Domain objects (rack, cell, location, container) have API hooks and pure utilities but zero render components. This is a gap — domain-aware display components end up living in features or are inlined into widgets.
- **The warehouse editor widget behaves like a mini-application**, not a page region. It owns its own state stores, its own routing logic, its own lifecycle, its own query layer. This is not wrong per se, but it must be treated consciously: it should have an explicit internal boundary, not a flat file dump.
- **Three files are doing far too much:** `context-panel.tsx` (881 lines, mixes layout and storage modes), `storage-inspector-v2.tsx` (1,029 lines, 6 inline panel modes), and `editor-canvas.tsx` (683 lines, embeds dual-path legacy/V2 conditional logic).
- **`editor-store.ts` (1,242 lines, ~70 selectors, ~40 mutation methods) is a broad runtime API with no domain boundaries.** Every component can write to any slice. Selection setters have opaque side effects (they reset workflows). This is the most structural risk in the codebase.
- **The V2 storage cutover created a legible dual-path pattern** (`isStorageV2Active` flag gates two code paths). It is clean enough to finish, but needs the legacy path removed — every extra path is a permanent maintenance tax.
- **`top-bar.tsx` (474 lines) is a coordination hub that owns navigation, mutations, status display, and styling simultaneously.** It calls `useEditorStore.getState()` imperatively inside event handlers, bypassing reactive subscriptions.
- **What is structurally right:** feature-scoped UI, clean composition wrappers (`storage-workspace-v2`, `workspace-canvas-and-panel`), isolated stores (`mode-store`, `interaction-store`, `storage-focus-store`), and the logic-extraction pattern in `inspector-router-logic.ts`.
- **What matters most:** Split `context-panel.tsx` by mode, split `storage-inspector-v2.tsx` by panel kind, define domain boundaries in the editor store, and build a minimal real `shared/ui` foundation.

---

## 2. Responsibility Map

### `app/`
**Should own:** Bootstrap, routing, provider chain (auth, query client, feature flags), layout shell, global CSS variables.  
**Must not own:** Any domain logic, any warehouse-specific state, any editor behavior.  
**Current state:** Clean. `app-shell.tsx`, `providers/`, `router/` are all appropriately scoped. `store/` holds global UI state (active site/floor, drawer collapse) — acceptable.

---

### `pages/`
**Should own:** Page-level state machines (loading / error / ready branches), composition of widget-level components, page-scoped data bootstrapping.  
**Must not own:** Inline domain forms, workflow logic, render-heavy UI components.  
**Current state:** Clean. `warehouse-setup-page.tsx` (128 lines) derives a `WarehouseSetupState` from 8 query states and renders the right widget. This is exactly right.

---

### `widgets/`
**Should own:** Composed surfaces that span multiple features — the editor shell, the top bar, the inspector slot, the canvas region. Wiring between child features. Surface-level layout decisions.  
**Must not own:** Inline business logic for individual operations (rack creation, container placement), multi-hundred-line domain forms, inlined workflow branches.  
**Current state:** Mixed. The warehouse editor widget owns the right surfaces but has allowed several files to swell into mini-applications. `context-panel.tsx`, `storage-inspector-v2.tsx`, and `rack-inspector.tsx` are functioning as feature-level components that happen to live inside a widget directory.

---

### `features/`
**Should own:** One slice of user-visible capability — its API hooks, model logic, and UI components. A feature should be independently understandable.  
**Must not own:** Cross-feature coordination, global state writes that affect other features, surface-level layout.  
**Current state:** Generally clean. `rack-configure/` (6 UI tab components), `container-create/`, `placement-actions/` are all properly scoped. The one gap: some features have no UI at all, and their UI ends up embedded inline inside widget files (see violations below).

---

### `entities/`
**Should own:** Domain type definitions, API query/mutation hooks, pure domain utilities (normalization, validation helpers, address formatting).  
**Must not own:** React UI components. Currently owns none — correct in principle.  
**Gap:** Because entities have no UI layer, domain display components (rack status summary, cell status chip, occupancy bar, location address) are either missing entirely or inlined where they are first needed. This creates duplication.

---

### `shared/`
**Should own:** Truly generic, domain-ignorant building blocks: design tokens, layout primitives, input components, typography, icon wrappers, utility hooks (`cn`, `useDebounce`), API client setup.  
**Must not own:** Anything that knows what a rack, cell, container, or warehouse is.  
**Current state:** `shared/ui` is a stub. `shared/lib/cn.ts` exists. `shared/api/` holds Supabase + BFF client config. The UI foundation needs to be built.

---

## 3. Current Violations

### Violation 1 — `context-panel.tsx` (881 lines)
**What it owns:** Layout mode actions (rotate rack, duplicate, create wall, validate issues) AND storage mode actions (cell context, placement workflow dispatch, container operations) — both in the same file.  
**Why it is a problem:** Mode-specific logic is interwoven throughout. Adding a new layout mode action risks touching storage logic. Testing either mode in isolation is impossible. The file grows every time either domain changes.  
**What should own it:** `LayoutContextPanel` and `StorageContextPanel` as separate feature-level components, with a thin `ContextPanelRouter` (like the existing `inspector-router.tsx` pattern) selecting between them.

---

### Violation 2 — `storage-inspector-v2.tsx` (1,029 lines)
**What it owns:** Six panel modes (empty state, rack overview, cell overview, container detail, task-create-container, task-create-with-product) all rendered inline via a switch-like structure. Also owns local `selectedContainerId` and `taskKind` state.  
**Why it is a problem:** This is a router, not a component. Each mode has different data dependencies, different interactions, and different lifecycle concerns. Inlining all six means every mode re-renders when any mode's data changes, and the file becomes the de-facto owner of the storage V2 interaction surface.  
**What should own it:** `StorageInspectorRouter` (thin, reads focus store, dispatches to mode components) + six separate mode files: `StorageInspectorEmpty`, `RackOverviewPanel`, `CellOverviewPanel`, `ContainerDetailPanel`, `TaskCreateContainerPanel`, `TaskCreateWithProductPanel`.

---

### Violation 3 — `editor-canvas.tsx` (683 lines)
**What it owns:** Konva stage rendering + grid + layer composition + 40+ store hook declarations + 15+ `isStorageV2Active` ternaries routing interaction writes to either legacy or V2 stores + a `onV2StorageCellSelect` callback that resolves a level from published cells data before calling the V2 store.  
**Why it is a problem:** The canvas should not own the decision of which store to write to. That dual-path conditional logic is business logic about the V2 migration state, not canvas rendering logic. The level-resolution in `onV2StorageCellSelect` is domain logic (derive which level a cell belongs to from published cell data) embedded in a UI callback.  
**What should own it:** The level resolution belongs in a selector or in `StorageFocusStore.selectCell()`. The `isStorageV2Active` routing belongs in a dispatch hook (`useCanvasSelectionDispatch`) that the canvas calls without knowing which store it writes to.

---

### Violation 4 — `top-bar.tsx` (474 lines)
**What it owns:** Breadcrumb navigation (site/floor selection) + draft lifecycle actions (save, publish, validate, create draft) + workspace status display (badge, draft state, dirty flag) + 6 mutations + direct `useEditorStore.getState()` imperative reads inside event handlers + 20+ inline style objects.  
**Why it is a problem:** Navigation breadcrumb is a generic surface concern. Save/publish/validate actions are workflow concerns that belong in feature hooks. The inline `getState()` calls bypass Zustand's reactive model — they read stale state if called during a batched update.  
**What should own it:** `WorkspaceActionBar` feature component for save/publish/validate, `WarehouseNavBreadcrumb` for navigation, `WorkspaceStatusBadge` as a domain entity UI component. `top-bar.tsx` becomes a composition wrapper.

---

### Violation 5 — `editor-store.ts` (1,242 lines, ~40 mutation methods, ~70 selectors)
**What it owns:** Selection coordination, workflow lifecycle, draft lifecycle, rack mutations (15+ methods), zone mutations (3), wall mutations (3), utility helpers — all in one flat Zustand store.  
**Why it is a problem:** There are no domain boundaries. `createRack` and `startPlaceContainerWorkflow` and `markDraftSaved` are exposed at the same level. Selection setters have side effects (reset active workflow, reset objectWorkContext) that are implicit — callers do not know this. The 70-selector surface means every component can subscribe to any slice, creating invisible coupling.  
**What should own it:** Three focused store slices: `useRackMutations()`, `useWorkflowActions()`, `useDraftLifecycle()`. Selection coordination stays in `interaction-store` (which is already clean). Selectors get grouped into logical namespaces rather than 70 individual exports.

---

### Violation 6 — `rack-inspector.tsx` (602 lines)
**What it owns:** Rack summary tab + inline `SectionEditor` (250 lines) + inline `LevelEditor`.  
**Why it is a problem:** The sub-editors are independently testable domain forms but are trapped inside the inspector file. Adding a new editing surface requires touching this file.  
**What should own it:** `features/rack-configure/ui/section-editor.tsx` and `level-editor.tsx` — they are already structurally part of the `rack-configure` feature, just physically misplaced.

---

## 4. UI Library Design

The current `shared/ui` is not a foundation — it is a stub. The right strategy is **not to build a full design system upfront**, but to establish the minimum viable foundation that makes the rest consistent: design tokens, 8–10 layout primitives, and a clear rule about what belongs in each tier.

---

### Tier 1: `shared/ui/theme`
**Purpose:** Design tokens and global CSS foundation.  
**Allowed:** CSS custom properties (colors, spacing scale, radius, shadow, typography scale), Tailwind config extension, dark mode variables.  
**Forbidden:** Any React components, any domain knowledge.  
**Examples:** `--color-surface-primary`, `--space-4`, `--radius-card`, font-size scale.

---

### Tier 2: `shared/ui/primitives`
**Purpose:** Stateless, domain-ignorant building blocks. One concern per component.  
**Allowed:** Button, Input, Select, Checkbox, Badge, Icon, Spinner, Tooltip, Divider, Stack, Grid, ScrollArea.  
**Forbidden:** Any component that knows what a rack, cell, container, or warehouse is. No business-logic props like `isOccupied`, `rackStatus`, `draftState`.  
**Examples:** `<Button variant="ghost">`, `<Badge color="green">`, `<Stack gap={2}>`.

---

### Tier 3: `shared/ui/composite`
**Purpose:** Composed generic patterns with no domain knowledge.  
**Allowed:** EmptyState (generic: icon + title + description + CTA), ConfirmActionBar (generic: message + confirm/cancel), StatusBadge (generic: status string + color map), Panel (header + body + footer layout), Tabs (generic tab shell), SearchInput, InlineAlert.  
**Forbidden:** Any domain-specific props or hardcoded domain text.  
**Examples:** `<EmptyState icon={…} title="Nothing here" />`, `<ConfirmActionBar message="Delete?" onConfirm={…} />`.

---

### Tier 4: `entities/*/ui`
**Purpose:** Display components for a single domain entity. Render one entity's data with domain-aware formatting.  
**Allowed:** Read-only display components that know the entity's type shape. Formatting for domain values (address rendering, status colors, level labels).  
**Forbidden:** Mutations. Store writes. Workflow triggers. Cross-entity composition.  
**Examples:**
- `entities/rack/ui/RackStatusSummary.tsx` — renders rack geometry summary
- `entities/cell/ui/CellStatusChip.tsx` — cell status with domain-aware color
- `entities/location/ui/LocationAddress.tsx` — formats `(aisle, bay, level)` into display string
- `entities/location/ui/OccupancyBar.tsx` — occupancy percentage bar with domain thresholds

---

### Tier 5: `features/*/ui`
**Purpose:** UI for one user capability. Owns its own data hooks, local state, mutations.  
**Allowed:** Query hooks, mutation hooks, form state, feature-scoped local state, domain-aware display using entity UI components.  
**Forbidden:** Cross-feature state writes, surface layout decisions, routing.  
**Examples:**
- `features/rack-configure/ui/SectionEditor.tsx`
- `features/container-create/ui/CreateContainerForm.tsx`
- `features/layout-publish/ui/WorkspaceActionBar.tsx`
- `features/storage-cell-inspect/ui/CellOverviewPanel.tsx`

---

### Tier 6: `widgets/*/ui`
**Purpose:** Composed surfaces. Wire features together into a coherent screen region.  
**Allowed:** Composition of feature and entity UI components, surface layout, slot-based panel routing.  
**Forbidden:** Inline domain forms, inline workflow branches, raw store mutation calls.  
**Examples:**
- `widgets/warehouse-editor/ui/StorageInspectorRouter.tsx` — thin router
- `widgets/warehouse-editor/ui/ContextPanelRouter.tsx` — dispatches to LayoutContextPanel or StorageContextPanel
- `widgets/app-shell/ui/TopBar.tsx` — composes WorkspaceActionBar + WarehouseNavBreadcrumb + WorkspaceStatusBadge

---

## 5. Domain UI Strategy

Each component is placed by **actual responsibility**, not by whether the name sounds reusable.

| Component | Placement | Reasoning |
|---|---|---|
| `RackStatusSummary` | `entities/rack/ui/` | Read-only display of rack geometry data. No mutations. Domain entity display. |
| `CellStatusChip` | `entities/cell/ui/` | Maps cell status enum to color + label. Pure domain display. |
| `OccupancyBar` | `entities/location/ui/` | Renders occupancy percentage with domain-defined thresholds (full/partial/empty). Domain display. |
| `LocationAddress` | `entities/location/ui/` | Formats `(aisle, bay, level)` into a human-readable address. Pure domain formatting. |
| `WorkflowMarker` | `features/storage-workflow/ui/` | Marker tied to a specific workflow kind. Knows workflow states. Belongs with the feature. |
| `WorkspaceStatusBadge` | `features/layout-publish/ui/` | Maps draft lifecycle state to badge color + label. Coupled to `LayoutDraft` domain state. **Not generic.** |
| `LevelTabs` | `widgets/warehouse-editor/ui/` | Specific to the storage V2 navigator UI. Not reusable outside the editor. Could be a generic `Tabs` plus domain-specific level data. |
| `EmptyState` | `shared/ui/composite/` | Genuinely generic — used in navigator, inspector empty state, and other non-warehouse surfaces. Keep it generic (no warehouse text). |
| `ConfirmActionBar` | `shared/ui/composite/` | Generic pattern. Used in delete-rack confirmation and elsewhere. Domain text passed as props. |

`WorkspaceStatusBadge` is the key one to get right: it looks like a generic badge, but its color logic depends on knowing what `'draft' | 'published' | 'pending_validation'` mean semantically. That knowledge does not belong in `shared/ui`. It belongs with the domain that defines those states.

---

## 6. Target File Structure

```
apps/web/src/
├── app/
│   ├── bootstrap/main.tsx
│   ├── layouts/app-shell.tsx
│   ├── providers/              # auth, query client, feature flags
│   └── router/                 # route definitions, protected route guard
│
├── pages/
│   └── warehouse-setup/
│       └── ui/warehouse-setup-page.tsx   # state machine + composition only
│
├── widgets/
│   └── warehouse-editor/
│       ├── ui/
│       │   ├── warehouse-editor.tsx           # root orchestrator (V2 gate)
│       │   ├── storage-workspace-v2.tsx       # composition: nav + canvas + inspector
│       │   ├── workspace-canvas-and-panel.tsx # composition: canvas + context + right slot
│       │   ├── editor-canvas.tsx              # Konva stage — rendering only
│       │   ├── context-panel-router.tsx       # thin: routes to layout or storage panel
│       │   ├── storage-inspector-router.tsx   # thin: routes to panel-mode component
│       │   ├── inspector-router.tsx           # existing: selection → inspector kind
│       │   ├── right-side-panel-slot.tsx      # existing: task vs inspector slot
│       │   ├── top-bar.tsx                    # composition: breadcrumb + actions + status
│       │   └── storage-navigator.tsx          # level tabs + cell list (already reasonable)
│       ├── model/
│       │   ├── editor-store.ts                # scoped: draft lifecycle + selection coord only
│       │   ├── interaction-store.ts           # pure: hover, selection, panel mode
│       │   ├── mode-store.ts                  # pure: viewMode + editorMode
│       │   ├── editor-selectors.ts            # grouped selectors (not 70 individual exports)
│       │   ├── v2/storage-focus-store.ts      # V2 single source of truth
│       │   └── v2/v2-selectors.ts
│       └── lib/
│           ├── use-canvas-scene-model.ts
│           ├── use-canvas-stage-interactions.ts
│           ├── use-canvas-viewport-controller.ts
│           └── use-canvas-selection-dispatch.ts  # NEW: abstracts legacy vs V2 write path
│   └── app-shell/
│       └── ui/top-bar.tsx                     # after decomposition
│
├── features/
│   ├── rack-configure/
│   │   └── ui/
│   │       ├── rack-inspector.tsx             # slimmed: tab shell only
│   │       ├── section-editor.tsx             # EXTRACTED from rack-inspector
│   │       ├── level-editor.tsx               # EXTRACTED from rack-inspector
│   │       ├── face-tab.tsx
│   │       └── rack-summary-tab.tsx
│   ├── layout-publish/
│   │   └── ui/
│   │       └── workspace-action-bar.tsx       # EXTRACTED from top-bar
│   ├── storage-cell-inspect/
│   │   └── ui/
│   │       ├── cell-overview-panel.tsx        # EXTRACTED from storage-inspector-v2
│   │       ├── container-detail-panel.tsx     # EXTRACTED from storage-inspector-v2
│   │       └── rack-overview-panel.tsx        # EXTRACTED from storage-inspector-v2
│   ├── storage-workflow/
│   │   └── ui/
│   │       ├── task-create-container-panel.tsx
│   │       └── task-create-with-product-panel.tsx
│   ├── layout-context-actions/
│   │   └── ui/
│   │       └── layout-context-panel.tsx       # EXTRACTED from context-panel
│   └── storage-context-actions/
│       └── ui/
│           └── storage-context-panel.tsx      # EXTRACTED from context-panel
│
├── entities/
│   ├── rack/
│   │   ├── api/
│   │   ├── lib/
│   │   └── ui/
│   │       └── rack-status-summary.tsx        # NEW: domain display
│   ├── cell/
│   │   ├── api/
│   │   └── ui/
│   │       └── cell-status-chip.tsx           # NEW: domain display
│   └── location/
│       ├── api/
│       └── ui/
│           ├── location-address.tsx           # NEW: domain formatting
│           └── occupancy-bar.tsx              # NEW: domain display
│
└── shared/
    ├── ui/
    │   ├── theme/                             # CSS variables, Tailwind extension
    │   ├── primitives/
    │   │   ├── button.tsx                     # replace current stub
    │   │   ├── badge.tsx
    │   │   ├── input.tsx
    │   │   ├── spinner.tsx
    │   │   └── tooltip.tsx
    │   └── composite/
    │       ├── empty-state.tsx
    │       ├── confirm-action-bar.tsx
    │       └── panel.tsx
    ├── lib/
    │   └── cn.ts
    └── api/                                   # Supabase + BFF client (already clean)
```

---

## 7. Migration Plan

### Phase 1 — Extract mode-specific context panels (Low risk, high return)
**Goal:** Break `context-panel.tsx` (881 lines) into two focused feature components.  
**Files affected:**
- Create `features/layout-context-actions/ui/layout-context-panel.tsx`
- Create `features/storage-context-actions/ui/storage-context-panel.tsx`
- Reduce `widgets/warehouse-editor/ui/context-panel.tsx` to a 30-line `ContextPanelRouter`
- Update `workspace-canvas-and-panel.tsx` to import the router

**Expected payoff:** The two most different domains (layout editing vs storage operations) stop sharing mutation handlers. Each panel can be developed and tested independently. Every future storage workflow change is isolated.  
**Risk level:** Low. The two modes already have a clear internal boundary (the `resolveContextPanelIntent` logic already distinguishes them). This is a physical split along an existing logical line.

---

### Phase 2 — Split storage inspector into mode files (Medium risk, high return)
**Goal:** Reduce `storage-inspector-v2.tsx` (1,029 lines) to a router + six focused panel files.  
**Files affected:**
- `widgets/warehouse-editor/ui/storage-inspector-router.tsx` (new, ~40 lines)
- `features/storage-cell-inspect/ui/rack-overview-panel.tsx`
- `features/storage-cell-inspect/ui/cell-overview-panel.tsx`
- `features/storage-cell-inspect/ui/container-detail-panel.tsx`
- `features/storage-workflow/ui/task-create-container-panel.tsx`
- `features/storage-workflow/ui/task-create-with-product-panel.tsx`
- `widgets/warehouse-editor/ui/storage-inspector-empty.tsx` (trivial)

**Expected payoff:** Each panel mode becomes independently testable. Adding a new panel mode does not require touching existing panel code. Query hooks are co-located with the panel that needs them.  
**Risk level:** Medium. The existing `resolvePanelMode` function is already extracted and pure (good). The main risk is that some state (`selectedContainerId`, `taskKind`) currently flows across mode transitions — need to decide whether this lives in the router or in `StorageFocusStore`.

---

### Phase 3 — Abstract the V2 dual-path in editor-canvas (Medium risk, high return)
**Goal:** Remove the 15 `isStorageV2Active` ternaries from `editor-canvas.tsx` and move the decision into a dispatch hook.  
**Files affected:**
- Create `widgets/warehouse-editor/lib/use-canvas-selection-dispatch.ts` — returns `onCellSelect`, `onRackSelect` callbacks that internally route to either legacy or V2 store
- Move `onV2StorageCellSelect` level-resolution logic into `StorageFocusStore.selectCell()` or a selector
- Reduce `editor-canvas.tsx` to ~500 lines

**Expected payoff:** The canvas no longer knows about the V2 migration. When the legacy path is eventually deleted, only the dispatch hook changes, not the canvas.  
**Risk level:** Medium. Konva interaction timing is tricky; the dispatch hook must be stable (no unnecessary re-renders).

---

### Phase 4 — Build the `shared/ui` foundation (Low risk, medium return)
**Goal:** Establish a real primitive layer that all feature UI can depend on.  
**Files affected:**
- `shared/ui/theme/tokens.css` — move CSS variables from inline or scattered locations
- `shared/ui/primitives/button.tsx` — replace the current 5-line stub with a real component (variant, size, loading state)
- `shared/ui/primitives/badge.tsx`, `spinner.tsx`, `input.tsx`
- `shared/ui/composite/empty-state.tsx`, `confirm-action-bar.tsx`

**Expected payoff:** Current code repeats inline style objects and ad-hoc patterns. Centralizing eliminates duplication and creates a real dependency graph that prevents domain knowledge from leaking into shared.  
**Risk level:** Low if done incrementally. Risk is in over-engineering (building a component library when the product only needs 8 components). Scope strictly to components that appear in 3+ places.

---

### Phase 5 — Add domain display components to entities (Low risk, medium return)
**Goal:** Move domain-aware display components (`RackStatusSummary`, `CellStatusChip`, `OccupancyBar`, `LocationAddress`) into their entity directories.  
**Files affected:**
- Create `entities/rack/ui/rack-status-summary.tsx`
- Create `entities/cell/ui/cell-status-chip.tsx`
- Create `entities/location/ui/occupancy-bar.tsx`, `location-address.tsx`
- Update `storage-inspector-v2.tsx` and `storage-navigator.tsx` to import from entities

**Expected payoff:** Domain display logic stops being duplicated across inspector panels. Each display component has one home.  
**Risk level:** Low. These are read-only display components with no state side effects.

---

### Phase 6 — Decompose `editor-store.ts` by domain (High risk, high return — do last)
**Goal:** Replace the monolithic 1,242-line store with domain-bounded slices.  
**Files affected:**
- `widgets/warehouse-editor/model/rack-mutations.ts` — `createRack`, `updateRack*`, `deleteRack`, `applyFacePreset`, `addSection`, `deleteSection`
- `widgets/warehouse-editor/model/workflow-actions.ts` — `startPlaceContainerWorkflow`, `startCreateAndPlaceWorkflow`, `startPlacementMove`
- `widgets/warehouse-editor/model/draft-lifecycle.ts` — `initializeDraft`, `markDraftChanged`, `markDraftSaving`, `markDraftSaved`
- Retain `editor-store.ts` as a thin coordinator only (selection, cross-domain side effects)
- Group `editor-selectors.ts` into logical namespaces rather than 70 flat exports

**Expected payoff:** New features can import only the slice they need. The side-effect chain (selection → workflow reset → context reset) becomes explicit and traceable. Testing mutations in isolation becomes possible.  
**Risk level:** High. The store's internal side effects are load-bearing (selection resets workflows; this is intentional and correct). Splitting requires preserving these invariants across boundaries. Do only after phases 1–5 are stable and test coverage on interaction paths is strong.

---

## 8. Final Recommendation

### Recommended direction

**Phased decomposition with entity UI layer introduction.**

Execute phases 1 through 3 now. They address the three largest structural violations with bounded scope. Each phase is a physical split along an already-existing logical boundary — not a redesign. Phase 1 and 2 can run in parallel if there are two developers.

Build `shared/ui` primitives (Phase 4) alongside, not before — only when a component appears in 3+ places. Do not build the primitive layer speculatively.

Introduce `entities/*/ui` (Phase 5) after Phase 2 lands, because the storage inspector split will naturally surface the question "where does `CellStatusChip` live?"

Do not touch `editor-store.ts` until Phase 6, and only after the rest of the system has settled. The store is dangerous to refactor under uncertainty because its side effects are intentional invariants.

---

### Alternative A — V2 cutover first, then decompose

**Approach:** Complete the storage V2 migration (delete the legacy storage path in `editor-canvas.tsx`, `interaction-store`, and `editor-store`) before any structural decomposition. Then execute phases 1–5 on a cleaner baseline.  
**Tradeoff:** Delays architectural improvements by one sprint. Benefit is that phases 1–3 operate on a simpler codebase with one fewer code path. Good choice if the V2 cutover is already close to done (PR7 landed, PR8 in progress).

---

### Alternative B — Introduce an internal editor API boundary

**Approach:** Define an explicit internal interface for the warehouse editor widget — a set of stable hooks (`useEditorCommands`, `useEditorReadState`) that all UI files inside the widget must use instead of direct store access. The stores become implementation details. Any component that needs to act calls a command; any component that needs to read calls a read hook.  
**Tradeoff:** Higher design upfront cost. Benefit is that Phase 6 (editor-store decomposition) becomes safe at any time because all consumers go through the interface, not through raw store subscriptions. The risk is over-abstracting before the store shape is stable — if the domain is still evolving, this interface will change constantly.