# Entity Lifecycle Map

## Purpose

This document centralizes lifecycle rules for the core WMS-domain entities.

It exists to make the following explicit in one place:

- canonical states
- allowed transitions
- transition owners
- invalid transitions
- persistence ownership
- UI representation

## Scope

Current implemented lifecycle maps:

- `LayoutVersion`
- `Rack`
- `Cell`

Planned lifecycle baselines for future modules:

- `ImportJob`
- `OrderLine`
- `PickTask`
- `PickItem`

Important:

- `LayoutVersion` lifecycle is already enforced in schema, RPC, and tests.
- `Rack` lifecycle is partially enforced, but its `configured` state is currently a schema placeholder, not a fully used persisted workflow.
- `Cell` lifecycle is mostly generation-based. It is not a rich standalone state machine yet.
- Planned entities below are target architecture baselines, not yet fully implemented.

---

## Current Entities

### LayoutVersion

Canonical lifecycle:

`draft -> published -> archived`

#### States

| State | Meaning | Editable | Notes |
| --- | --- | --- | --- |
| `draft` | Working layout version for a floor | Yes | The only editable layout state |
| `published` | Active authoritative spatial truth for a floor | No | Immutable for normal editing |
| `archived` | Historical superseded layout version | No | Read-only history |

#### Transitions

| Transition | Owner | Mechanism | Notes |
| --- | --- | --- | --- |
| `none -> draft` | Layout lifecycle RPC | `create_layout_draft(floor_id, actor_id)` | Creates first draft or clones latest published version |
| `draft -> published` | Layout publish RPC | `publish_layout_version(layout_version_id, actor_id)` | Runs validation first, regenerates cells, publishes atomically |
| `published -> archived` | Layout publish RPC | `publish_layout_version(...)` | Happens automatically when another draft on the same floor is published |

#### Rules

- only `draft` is editable
- `published` is immutable for normal users
- `archived` is historical only
- only one `published` layout version may exist per floor
- only one `draft` layout version may exist per floor
- a new edit cycle must start from `create_layout_draft`; published versions are not edited in place
- publish is a layout-version level action, never a per-rack action

#### Invalid Transitions

- `published -> draft` in place
- `archived -> draft`
- `archived -> published`
- `published -> published` by calling publish again on the same row
- `draft -> archived` as a direct user flow
- saving or publishing a layout version that is not in `draft`
- creating a second active draft or a second active published version for the same floor

#### Persistence Layer

- source-of-truth table: `public.layout_versions`
- main fields: `floor_id`, `version_no`, `state`, `parent_published_version_id`, `published_at`, `archived_at`
- hard invariants are enforced by:
  - state check constraint: `draft | published | archived`
  - partial unique index: one `published` per floor
  - partial unique index: one `draft` per floor
- transactional ownership lives in RPC/functions:
  - `create_layout_draft`
  - `save_layout_draft`
  - `validate_layout_version`
  - `publish_layout_version`
- audit trail lives in `public.operation_events`

#### UI Representation

- top bar exposes `Init`, `Save`, `Validate`, and `Publish`
- editor loads only the active `draft` as the editable layout context
- top bar shows draft sync state via `Unsaved` / `Synced`
- validation and publish feedback is surfaced as top-bar status text such as `Valid`, `Saved`, `Published / N cells`
- `published` is treated as runtime truth and source for the next draft clone, not as a directly editable screen state
- `archived` currently behaves as history in persistence; it is not a first-class editor mode

---

### Rack

Schema state set:

`draft | configured | published`

Effective current lifecycle:

`draft -> published`

`configured` is reserved but not currently used as an independently persisted workflow.

#### States

| State | Meaning | Current Usage | Notes |
| --- | --- | --- | --- |
| `draft` | Rack belongs to a draft layout and can be edited | Active | Written on draft save and draft clone |
| `configured` | Rack is structurally configured enough for future workflows | Placeholder | Present in schema only; not currently written by RPC/UI |
| `published` | Rack belongs to a published layout version | Active | Set automatically during layout publish |

#### Transitions

| Transition | Owner | Mechanism | Notes |
| --- | --- | --- | --- |
| `none -> draft` | Editor + draft persistence flow | local create in editor, then `save_layout_draft(...)` | Rack is created inside draft context only |
| `draft -> published` | Layout publish RPC | `publish_layout_version(...)` | All racks of the layout are promoted together |
| `published -> draft` | Layout draft creation flow | `create_layout_draft(...)` clones published structure into new draft rows | This is a clone into new rows, not an in-place state reversal |

#### Rules

- rack lifecycle is subordinate to `LayoutVersion`; racks do not publish independently
- rack edits are draft-only
- publishing a layout promotes all racks in that layout version together
- `configured` must not be treated as a working business state until a real transition owner exists
- `display_code` must be unique within a layout version
- `rotation_deg` is limited to `0 | 90 | 180 | 270`
- rack validity depends on structural rules on faces, sections, levels, and mirrored-face consistency

#### Invalid Transitions

- publishing a single rack without publishing its parent layout version
- editing a `published` rack in place
- assuming `configured` is a persisted milestone in downstream logic
- moving a rack between layout versions in place
- duplicate `display_code` inside one layout version
- invalid rotations outside `0/90/180/270`
- single rack with configured Face B
- mirrored face B referencing another rack or itself

#### Persistence Layer

- source-of-truth table: `public.racks`
- child structure lives in:
  - `public.rack_faces`
  - `public.rack_sections`
  - `public.rack_levels`
- rack rows are rewritten through `save_layout_draft(...)`
- rack state is aligned to parent layout lifecycle:
  - draft saves write `state = 'draft'`
  - layout publish sets `state = 'published'`
- important note from schema design:
  - `racks.state = 'published'` is a denormalized convenience flag aligned with layout publish, not a separate publish workflow

#### UI Representation

- rack is the primary editable canvas object in the warehouse editor
- new rack flow uses a creation wizard: `geometry -> sections -> face B -> done`
- rack inspector is the structural editing surface
- rack validation is shown with per-rack status badges: `error`, `warning`, or `valid`
- inspector summary shows face configuration, generated cell estimate, and address preview
- there is currently no explicit UI badge for persisted `configured` state

---

### Cell

Current cell lifecycle is generation-based, not a rich standalone state machine.

Effective current lifecycle:

`draft preview -> active persisted cell -> historical cell`

Where:

- `draft preview` is derived in frontend/domain code and is not persisted in `cells`
- `historical` is inferred from the parent `LayoutVersion` becoming `archived`

Schema status set:

`active | inactive`

Current publish flow generates only `active` rows.

#### States

| State | Carrier | Meaning | Current Usage |
| --- | --- | --- | --- |
| `preview` | Derived UI/domain state | Cell address and geometry preview for a draft | Active in UI only; uses preview-only identity rather than persisted `cell_code` |
| `active` | `cells.status = 'active'` | Persisted usable cell generated from published structure | Active |
| `inactive` | `cells.status = 'inactive'` | Reserved for future deactivation semantics | Placeholder |
| `historical` | Parent `layout_versions.state = 'archived'` | Persisted cell row kept for historical reference | Implicit |

#### Transitions

| Transition | Owner | Mechanism | Notes |
| --- | --- | --- | --- |
| `none -> preview` | Domain/UI derivation | `generatePreviewCells(...)` and address preview flows | Used during draft editing and validation preview |
| `preview -> active` | Layout publish RPC | `publish_layout_version(...)` -> `regenerate_layout_cells(...)` | Cells are generated transactionally at publish time |
| `active -> historical` | Layout publish RPC | parent `LayoutVersion` becomes `archived` | Cell rows stay persisted under archived version |
| `active -> inactive` | Not owned yet | Not implemented | Reserved future transition only |

#### Rules

- cells are generated by the system, never manually authored by users
- cell identity is structural and version-scoped
- cells belong to a specific `layout_version_id`
- current draft persistence deletes draft cells; draft editing relies on derived preview, not persisted `cells` rows
- published cells are regenerated from rack/face/section/level structure during publish
- address uniqueness, tree consistency, and deterministic `cell_code` are enforced in persistence
- preview cells use an explicit preview-only key and must not be confused with persisted `cell_code`

#### Invalid Transitions

- manual user editing of cell addresses as free text
- direct business logic that treats draft preview cells or their preview identifiers as persisted truth
- creating a cell outside the rack/face/section/level tree
- duplicate address within one layout version
- duplicate `cell_code` within one layout version
- duplicate slot within one rack level
- treating `inactive` as supported behavior before an explicit owner/workflow exists

#### Persistence Layer

- source-of-truth table: `public.cells`
- derived from:
  - `public.racks`
  - `public.rack_faces`
  - `public.rack_sections`
  - `public.rack_levels`
- generation owner:
  - `regenerate_layout_cells(layout_version_id)`
- helper invariants:
  - unique `(layout_version_id, address)`
  - unique `(layout_version_id, cell_code)`
  - unique `(rack_level_id, slot_no)`
  - tree-consistency trigger on `layout_version_id/rack_id/rack_face_id/rack_section_id/rack_level_id`
- `cell_code` is deterministic and intended to remain stable for the same structural slot

#### UI Representation

- on canvas, cells are shown as top-down slot columns rather than persisted records being edited directly
- rack summary and inspector show generated-cell estimates and address previews
- publish feedback surfaces generated cell count in the top bar
- there is currently no dedicated UI for per-cell status transitions such as `active -> inactive`

---

## Planned Entities

These are target lifecycle baselines for the next operational modules.

They should be treated as intended architecture, not as already-enforced runtime behavior.

### ImportJob

Target canonical lifecycle:

`uploaded -> parsing -> parsed -> validated -> preview_ready -> published`

Terminal failure branch:

`uploaded | parsing | parsed | validated -> failed`

Business pipeline detail that should still exist even if persisted as fewer coarse states:

`upload -> detect -> parse -> stage -> normalize -> validate -> preview -> publish`

#### States

| State | Meaning |
| --- | --- |
| `uploaded` | File exists, job created, not yet parsed |
| `parsing` | Parser/staging pipeline is running |
| `parsed` | Raw data parsed into staging |
| `validated` | Validation finished successfully |
| `preview_ready` | Preview can be reviewed before publish |
| `published` | Imported data became operationally active |
| `failed` | Terminal failure requiring retry/new job |

#### Transitions

| Transition | Owner | Notes |
| --- | --- | --- |
| `none -> uploaded` | Upload/import creation flow | Creates the job and stores source metadata |
| `uploaded -> parsing -> parsed` | Import pipeline worker/RPC | Raw file is parsed and staged |
| `parsed -> validated` | Validation pipeline | Structural/domain checks pass |
| `validated -> preview_ready` | Import pipeline | Preview is materialized for operator review |
| `preview_ready -> published` | Publish RPC | Only publish makes imported data operationally active |
| `uploaded/parsing/parsed/validated -> failed` | Import pipeline | Failure path with error summary |

#### Invalid Transitions

- raw file directly writing into operational tables
- `uploaded -> published` without staging/validation
- `failed -> published`
- mutating published operational data by editing staging rows in place

#### Persistence Layer

- future source-of-truth table: `public.import_jobs`
- future staging: `public.import_rows_staging`
- file lineage should include:
  - `import_job_id`
  - `source_file_name`
  - `source_sheet_name`
  - `source_row_number`
  - `imported_at`

#### UI Representation

- upload screen with job status badge/progress
- validation preview before publish
- explicit publish action
- failed-job review with row-level error summary

---

### OrderLine

Target lifecycle:

`imported -> ready | blocked | shortage | exception`

Re-resolution loop:

`blocked | shortage | exception -> ready`

and, if prerequisites degrade again:

`ready -> blocked | shortage | exception`

#### States

| State | Meaning |
| --- | --- |
| `imported` | Line exists but readiness has not been resolved yet |
| `ready` | Product, role, cell, and stock conditions are satisfied |
| `blocked` | Missing master/mapping/layout prerequisite |
| `shortage` | Product/cell resolved but quantity is insufficient |
| `exception` | Unexpected or ambiguous resolution failure |

#### Transitions

| Transition | Owner | Notes |
| --- | --- | --- |
| `none -> imported` | Order import publish flow | Line is normalized into operational order tables |
| `imported -> ready/blocked/shortage/exception` | Readiness resolver | Evaluates product, role, cell, and stock conditions |
| `blocked/shortage/exception -> ready` | Readiness resolver rerun | Happens after data corrections or stock/layout changes |
| `ready -> blocked/shortage/exception` | Readiness resolver rerun | Allowed before task generation if inputs become invalid |

#### Invalid Transitions

- manual jump from `imported` directly into pick execution
- hiding readiness failures inside free-text comments instead of explicit state
- treating `resolved_primary_pick_cell_id` as physical storage truth

#### Persistence Layer

- future source-of-truth table: `public.order_lines`
- future status field: `readiness_status`
- supporting fields should include:
  - `resolved_primary_pick_cell_id`
  - `readiness_reason_code`
  - `readiness_details`
  - import lineage columns

#### UI Representation

- readiness worklist with state badges and filters
- line-level explanation of why a line is `blocked`, `shortage`, or `exception`
- operator surface to rerun or review resolution after imports/layout changes

---

### PickTask

Target lifecycle:

`ready -> in_progress -> completed`

Exception branch:

`ready | in_progress -> exception`

Optional recovery path:

`exception -> in_progress`

This recovery path should exist only if explicit operator recovery is implemented.

#### States

| State | Meaning |
| --- | --- |
| `ready` | Task is generated and awaiting assignment/start |
| `in_progress` | Picker has started executing task items |
| `completed` | All items are resolved and task is closed |
| `exception` | Task needs intervention due to unresolved execution issue |

#### Transitions

| Transition | Owner | Notes |
| --- | --- | --- |
| `none -> ready` | Task generation RPC | Created from ready order lines |
| `ready -> in_progress` | Picker start/claim flow | Usually triggered when picker begins execution |
| `in_progress -> completed` | Task aggregate logic | Only when all pick items are resolved to terminal outcomes |
| `ready/in_progress -> exception` | Execution workflow or operator action | For blocked or abnormal execution cases |
| `exception -> in_progress` | Operator recovery flow | Optional future recovery transition |

#### Invalid Transitions

- `completed -> in_progress`
- `completed -> exception`
- closing task as `completed` while open items remain
- generating task from non-ready order lines

#### Persistence Layer

- future source-of-truth table: `public.pick_tasks`
- supporting entities:
  - `public.pick_items`
  - `public.operation_events`

#### UI Representation

- task queue / assignment list
- task progress badge and item counters
- explicit exception state for supervisor/operator review

---

### PickItem

Target lifecycle:

`pending -> current -> confirmed | skipped | short | missing | damaged`

All terminal outcomes are per-SKU and per-step.

#### States

| State | Meaning |
| --- | --- |
| `pending` | Item is queued but not yet active |
| `current` | Item is the active confirmation step |
| `confirmed` | Requested pick was confirmed |
| `skipped` | Picker intentionally skipped item |
| `short` | Picker found some but not enough quantity |
| `missing` | Picker found none |
| `damaged` | Item/product found but unusable |

#### Transitions

| Transition | Owner | Notes |
| --- | --- | --- |
| `none -> pending` | Task generation RPC | Items are created in sequence order |
| `pending -> current` | Pick execution flow | Exactly one active current item per task flow |
| `current -> confirmed/skipped/short/missing/damaged` | Picker action | Atomic outcome step |
| `resolved current -> next pending becomes current` | Pick execution flow | Next-step activation, not a bulk confirm |

#### Rules

- one pick item equals one SKU confirmation step
- same-cell consecutive SKUs remain separate pick items
- same location may keep the address visually stable, but confirmation stays item-by-item
- terminal outcomes should be evented and auditable

#### Invalid Transitions

- `pending -> confirmed` without first becoming `current`
- more than one `current` item in one task execution flow
- merging multiple same-cell SKUs into one confirmation action
- changing terminal outcome without an explicit reopen/recovery flow

#### Persistence Layer

- future source-of-truth table: `public.pick_items`
- future event log: `public.pick_item_events`
- key fields should include:
  - `pick_task_id`
  - `order_line_id`
  - `cell_id`
  - `sequence_no`
  - `state`
  - `same_cell_continuation`

#### UI Representation

- picker UI should surface one active item at a time
- address can remain visually stable for same-cell continuation
- SKU card and action set change per item
- action buttons should map directly to terminal outcomes:
  - `Confirm`
  - `Skip`
  - `Short`
  - `Missing`
  - `Damaged`

---

## Cross-Entity Rules

- `LayoutVersion` owns the lifecycle boundary for `Rack` and persisted `Cell`
- `Rack` must not acquire an independent publish workflow
- `Cell` must stay generated, not manually curated
- imported data becomes operationally active only at publish time
- readiness state must stay explicit on `OrderLine`
- pick execution truth must live in `PickTask` and `PickItem`, not in ad hoc UI-only flags
- same-cell multi-SKU picking must remain separate per-item confirmation steps
