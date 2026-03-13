# Architecture Baseline

## Purpose

This document fixes the non-negotiable architecture baseline for `Warehouse Setup + Stock-Aware Directed Picking V1`.

It exists to prevent architecture drift during implementation.

The system is not:

- a full WMS
- an ERP replacement
- a routing platform

The system is:

- warehouse setup
- stock-aware operational readiness
- directed picking execution

The baseline below is mandatory unless explicitly superseded by a written architecture decision.

## Product Scope Canon

V1 must support one narrow operational contour:

1. warehouse layout setup
2. address generation
3. products and storage/location roles
4. imports for product master, stock snapshot, orders, and product-location mappings
5. operational readiness derivation
6. pick task generation
7. picker execution flow
8. operator status visibility

V1 must not expand into:

- rooms / walls / doors workflows
- routing engine / nav graph
- wave picking
- multi-picker balancing
- full Excel bidirectional sync
- receiving / dispatch / replenishment as full modules
- full real-time inventory truth
- analytics suite
- canvas-based product placement editing

## Technical Stack Baseline

### Backend

- Supabase
- Postgres as authoritative persistence layer
- SQL migrations as the only schema change mechanism
- Supabase Storage for import files
- Supabase Auth for user access
- SQL views / functions / RPC for derived operational logic

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query for server state
- Zustand for editor and UI-only state
- React Hook Form for complex forms
- Zod for validation and parser contracts

### Canvas

- React Konva

Canvas is allowed to handle:

- rack placement
- selection
- drag move
- 90 degree rotation
- spatial preview

Canvas is not allowed to own:

- structural configuration truth
- business logic
- product placement workflows

## Repo Architecture Baseline

The project should follow this repository shape:

```text
abctestsforWOS/
  apps/
    web/
    supabase/
  packages/
    domain/
    ui/
    config/
  docs/
  scripts/
```

### Responsibilities

- `apps/web`: frontend application
- `apps/supabase`: migrations, SQL functions, RLS, database tests
- `packages/domain`: canonical business contracts, Zod schemas, pure domain logic
- `packages/ui`: reusable UI primitives only
- `packages/config`: shared lint, TS, and style configuration

## Truth Model Baseline

### Layout truth

- `Published LayoutVersion` is the authoritative spatial truth inside the app

### Stock truth

Stock in V1 is:

- published imported stock snapshot
- plus local in-system delta from confirmed operations

It is not guaranteed to be full live warehouse truth.

### Picking truth

- `PickTask` and `PickItem` execution states inside the app are authoritative for execution history

### Placement truth

- product-location mapping is an operational storage rule
- it is not physical truth by itself

## Domain Model Baseline

### Spatial layer

- `Site`
- `Floor`
- `LayoutVersion`
- `Rack`
- `RackFace`
- `RackSection`
- `RackLevel`
- `Cell`

### Storage layer

- `Container`
- `ContainerPlacement`
- `InventoryItem`

### Master layer

- `Product`

### Operational mapping layer

- `ProductLocationRole`

### Operations layer

- `ImportJob`
- `StockSnapshot`
- `StockSnapshotLine`
- `Order`
- `OrderLine`
- `PickTask`
- `PickItem`
- `OperationEvent`

## Storage Semantics Baseline

The model must never collapse into `SKU -> Cell`.

Canonical model:

- `Cell = address`
- `Container = physical storage unit in a cell`
- `InventoryItem = product quantity inside container`

Canonical relationship:

`Cell -> Container -> InventoryItem`

Implications:

- one cell may contain multiple containers
- one cell may contain multiple SKUs
- picker still navigates to the cell address

## Product Location Role Baseline

V1 role model:

- `primary_pick`
- `reserve`

Rules:

- directed picking in V1 targets `primary_pick`
- `reserve` exists for future replenishment logic
- `reserve` is not a normal default pick target

Derived quantities may exist later:

- `primary_qty`
- `reserve_qty`
- `total_qty`
- `pick_available_qty`
- `replenishable_qty`

These are derived values, not source of truth.

## Rack Editor Canon

### Editor shell

The warehouse editor must have four zones:

1. left drawer
2. top bar
3. central canvas
4. right inspector

### Left drawer

Navigation modules:

- Warehouse
- Products
- Operations
- Analytics

### Top bar

Global actions:

- Create
- Save Draft
- Validate
- Publish
- Floor Switch
- Undo / Redo
- View controls

### Central canvas

Spatial context only:

- grid
- rack placement
- rack selection
- movement
- controlled rotation
- previews

### Right inspector

Structural editing only:

- rack general config
- A/B face config
- validation
- summary
- publish impact preview

## Canvas vs Inspector Boundary

This boundary is non-negotiable.

### Canvas

Allowed:

- place rack
- select rack
- drag move
- rotate by 90 degree step

Not allowed:

- free-angle rotation
- arbitrary free resize as primary editing mode
- deep structural editing on canvas
- product placement editing on canvas in V1

### Inspector

Must own:

- structural editing
- sections / levels / cells setup
- paired rack configuration
- validation view
- publish impact review

Canonical rule:

`Canvas = spatial context`

`Inspector = structural editing logic`

## Rack Model Baseline

Rack types:

- `single`
- `paired`

Rack fields:

- `display_code`
- `kind`
- `axis: NS | WE`
- `x`
- `y`
- `total_length`
- `depth`
- `rotation_deg`

RackFace fields:

- `side: A | B`
- `enabled`
- `slot_numbering_direction: ltr | rtl`

Rules:

- Face A and Face B may differ
- Face B supports:
  - mirror from A
  - copy A and edit
  - start from scratch

### Paired rack UX canon

Default flow:

1. configure Face A
2. choose Face B strategy
3. edit Face B if needed
4. review summary

Default options:

- Mirror A -> B
- Copy A -> B and edit
- Start from scratch

Advanced compare mode may exist later, but must not be the default V1 flow.

## Sections / Levels / Cells Canon

- sections are first-class objects
- sections may have different lengths
- Face A and Face B may have different section counts
- levels go bottom-to-top
- each section may have different level counts
- slots per level may differ
- slot numbering direction is defined per face
- cell addresses are generated by the system, never entered manually

## Addressing Baseline

Canonical display format:

`03-A.02.03.04`

Meaning:

- `03-A` = rack code + face
- `02` = section
- `03` = level
- `04` = slot

Rules:

- levels are numbered bottom-to-top
- slot numbering direction is face-specific
- orientation affects geometry only
- display address and internal IDs are different things

The addressing model is fixed and may not be redefined ad hoc during implementation.

## Draft / Publish Baseline

Layout changes happen only in draft.

Layout version states:

- `draft`
- `published`
- `archived`

Rules:

- published layout is immutable for normal users
- publish is a layout-version level action
- destructive changes require conflict review
- changes that break mappings, cells, or addressing must block publish or require admin review
- published layout may not be directly edited as a draft
- new edits require a new draft cycle

## Import Pipeline Baseline

Every import must follow this pipeline:

1. upload
2. detect
3. parse
4. stage
5. normalize
6. validate
7. preview
8. publish

Supported V1 domains:

- `stock_snapshot`
- `orders`
- `product_master`
- `product_location`

Rules:

- raw file data never writes directly to operational tables
- staging is mandatory
- source lineage is mandatory
- publish is the only moment imported data becomes operationally active

## Source Lineage Baseline

Every significant imported record must retain:

- `import_job_id`
- `source_file_name`
- `source_sheet_name`
- `source_row_number`
- `imported_at`

The system must always be able to answer: "Where did this record come from?"

## Operational Readiness Canon

Daily flow:

1. import stock snapshot
2. import orders
3. resolve order lines
4. derive outcomes
5. create pick tasks from ready lines
6. execute picker flow
7. show operator statuses and unresolved issues

Resolver steps:

1. `SKU -> Product`
2. `Product -> operational location role`
3. `role -> valid cell`
4. stock condition

Line outcomes:

- `ready`
- `shortage`
- `blocked`
- `exception`

## Picking Baseline

### PickTask states

- `ready`
- `in_progress`
- `completed`
- `exception`

### PickItem states

- `pending`
- `current`
- `confirmed`
- `skipped`
- `short`
- `missing`
- `damaged`

### Confirmation rule

One pick item equals one SKU confirmation step.

This remains true even if:

- multiple SKUs are in the same cell
- the same cell repeats across consecutive steps

Example:

1. `03-A.02.03.04 -> SKU A -> confirm`
2. `03-A.02.03.04 -> SKU B -> confirm`
3. `03-A.02.03.04 -> SKU C -> confirm`

This is valid and must not be collapsed into a bulk confirm.

### Same-cell UI rule

If the next item is in the same cell:

- address may remain visually stable
- SKU card changes
- the UI may show a hint such as `same location`

But confirmation remains separate per SKU.

## State Architecture Baseline

State architecture is more important than component architecture.

We must strictly separate:

### Source of truth / persisted domain state

- layout draft
- selected rack config
- product/location data
- import results
- task/item states

### Derived state

- generated cells preview
- validation result
- summary metrics
- publish impact
- readiness buckets

### UI-only state

- active tab
- selected face
- editor mode
- compare mode
- collapsed drawer
- zoom level

Business logic must never live only inside JSX or canvas object props.

## Supabase Types and Domain Types Baseline

This is mandatory.

### Rule

Generated Supabase types must not leave `api/` boundaries.

Types such as:

- `Database['public']['Tables']['...']['Row']`
- `Database['public']['Views']['...']['Row']`

may be used only inside:

- `shared/api`
- `*/api/*`

### Mapping rule

Every API layer must map DB rows into domain types before returning data to the rest of the app.

Required pattern:

1. read raw Supabase row
2. map fields in `api/mappers.ts`
3. validate / normalize via Zod schema from `packages/domain`
4. return a domain object

The UI must never depend directly on SQL row structure.

### Consequence

- domain logic is stable even if SQL schema evolves
- the rest of the app works on canonical business types

## Frontend Layering and Boundaries Baseline

The frontend uses a pragmatic FSD-style architecture.

Expected layers:

- `app`
- `pages`
- `widgets`
- `features`
- `entities`
- `shared`

### Import rules

- `app` may import from all lower layers
- `pages` may import `widgets`, `features`, `entities`, `shared`
- `widgets` may import `features`, `entities`, `shared`
- `features` may import `entities`, `shared`
- `entities` may import `shared` only
- `shared` must not depend on higher layers

Default restrictions:

- `features -> features` is forbidden
- `entities -> widgets/features/pages/app` is forbidden
- deep imports bypassing public API are forbidden

### Enforcement

Layer boundaries must be enforced by ESLint.

Recommended tooling:

- `eslint-plugin-boundaries`

The goal is not style purity. The goal is preventing long-term architecture collapse.

## Zustand and Canvas Performance Baseline

The editor store will contain high-frequency ephemeral state:

- pointer position
- hover state
- drag state
- preview rotation
- zoom
- pan

### Mandatory rules

- never subscribe to the whole store
- never export a "god selector"
- always use atomic selectors
- isolate canvas interaction state from inspector/form state

Correct pattern:

```ts
const zoom = useEditorStore((state) => state.zoom);
const hoveredRackId = useEditorStore((state) => state.hoveredRackId);
```

Forbidden pattern:

```ts
const editorState = useEditorStore();
```

Consequences:

- canvas updates must not rerender the whole app shell
- hover and drag events must not rerender inspector forms

## Testing Baseline

### Domain tests

Domain tests must live inside `packages/domain/src/**/*.test.ts`.

These tests cover pure business logic:

- addressing
- rack config derivation
- publish impact
- readiness derivation
- pick sequencing
- derived quantities

Recommended runner:

- Vitest

### Database tests

SQL tests must live in `apps/supabase/tests/`.

These tests cover:

- publish invariants
- import rules
- RLS
- readiness SQL/RPC
- pick-task generation logic

### Frontend end-to-end tests

Frontend happy-path tests should live in `apps/web/e2e/`.

Recommended runner:

- Playwright

V1 priority is end-to-end confidence, not exhaustive unit testing of React components.

Minimum E2E scenarios:

1. create floor -> configure rack -> publish layout
2. import products / locations / stock / orders
3. review readiness outcomes
4. generate pick task
5. complete picker item-by-item flow

## UI Sandbox Baseline

Complex UI states must be developed and reviewed outside the live database flow.

Recommended tooling:

- Ladle

Expected location:

- `apps/web/.ladle/`
- `apps/web/src/**/*.stories.tsx`

Priority story coverage:

- rack inspector states
- Face B empty states
- mirror / copy / scratch states
- compare mode
- validation error states
- publish blocked state
- imports preview states
- picker same-cell flow states

This is required to avoid slow UI development coupled to live backend setup.

## Implementation Principles

1. model first, UI second
2. spatial editor is not an inventory table
3. physical storage truth is not the same thing as picking shortcut truth
4. one SKU confirmation equals one step
5. published layout is immutable
6. canvas is context, inspector is logic
7. do not optimize routing before execution flow works

## Change Control

The following must not be redefined by implementation convenience:

- addressing model
- draft/publish logic
- storage truth semantics
- primary/reserve semantics
- pick confirmation rule
- state machines
- canvas vs inspector responsibility split
- import pipeline phases
- placement vs storage distinction

If any of the above must change, it requires an explicit written architecture decision.
