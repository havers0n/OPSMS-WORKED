# Layout Mode — Rack/Face Domain Contract Specification

## 1. Purpose

This document operationalizes the accepted domain model decisions from **Document 3 (Rack/Face Domain Model Revision)** into concrete, implementation-ready contracts.

It defines canonical types, field-level semantics, topology and addressing contracts, legacy compatibility rules, editor-state boundaries, bundle shape, validation invariants, and publish inputs.

It is not a UI redesign. It is not a migration script. It is not a repeat of the philosophical model argument. Those decisions are already resolved. This document translates them into engineering contracts.

**Relationship to the document series:**
- Document 1 (factual audit): what exists
- Document 2 (interaction architecture redesign): how the panel and task model should evolve
- Document 3 (domain model revision): what the model must mean
- **This document (contract specification): what the implementation must conform to**

---

## 2. Scope

### In scope

- Canonical domain entity contracts (`Rack`, `RackFace`, `RackSection`, `RackLevel`, `RackTopology`, `AddressingConfig`)
- Field-level canonical definitions
- Topology contract (sidedness, Face B relationship mode)
- Addressing contract (replacing `ltr/rtl`)
- Legacy compatibility rules per field
- Editor-state contract boundaries
- Layout bundle JSON shape
- Validation invariants
- Publish/cell-generation input contract
- Persistence impact summary

### Out of scope

- SQL migration scripts
- UI redesign or right-panel structure
- Endpoint-by-endpoint BFF API design
- Component structure
- Storage mode and container workflows
- Detailed Supabase function implementation

---

## 3. Canonical Domain Entities

### 3.1 Rack

**Purpose:** Represents one physical rack object placed in a layout. Owns all shared physical-envelope and placement properties.

**Canonical owner:** Rack entity (persisted in `racks` table).

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Stable rack identity |
| `displayCode` | `string` | Human-readable rack label; unique per layout version |
| `x` | `number` | Canvas x-position (metres) |
| `y` | `number` | Canvas y-position (metres) |
| `totalLength` | `number` (positive) | Nominal shared physical envelope length (metres) |
| `depth` | `number` (positive) | Nominal shared physical depth (metres) |
| `rotationDeg` | `0 \| 90 \| 180 \| 270` | Canvas rotation; does not affect face identity |
| `sidedness` | `'single' \| 'double'` | **Canonical topology: whether rack has one or two faces** |
| `faceBRelationship` | `'absent' \| 'mirrored' \| 'independent'` | **Canonical Face B mode; must be `'absent'` when `sidedness = 'single'`** |
| `faces` | `RackFace[]` | 1 face if single, 2 faces if double; always contains Face A |

**Optional fields:**

None beyond what is listed. Derived or compatibility fields are not canonical rack-level optional fields.

**Forbidden ambiguity:**

- `sidedness` must never be inferred from `faces.length` or `isMirrored` at runtime. It is canonical persistent state.
- `faceBRelationship` must never be inferred from section counts or `isMirrored` state. It is canonical persistent state.
- `rotationDeg` is the sole authority on rack orientation. The `axis` field (legacy) must not be used to derive or override orientation.

---

### 3.2 RackFace

**Purpose:** Represents one addressable, structurally configurable physical face of a rack.

**Canonical owner:** RackFace entity (persisted in `rack_faces` table, `side` constrained to `A/B`).

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Stable face identity |
| `rackId` | `string` (UUID) | Parent rack |
| `side` | `'A' \| 'B'` | Stable face identity label; not screen-relative |
| `enabled` | `boolean` | Whether this face participates in validation and cell generation |
| `addressing` | `AddressingConfig` | **Canonical face-local addressing config (see §6)** |
| `sections` | `RackSection[]` | Face-specific structure |

**Optional fields:**

| Field | Type | Notes |
|---|---|---|
| `faceLength` | `number` (positive) | Per-face usable length override (metres); if absent, rack.totalLength applies |
| `mirrorSourceFaceId` | `string \| null` | Only set when `rack.faceBRelationship = 'mirrored'`; points to the source face |

**Forbidden ambiguity:**

- `side` must not change due to rack rotation, canvas position changes, or rendering order.
- `addressing` is face-owned; it must not be derived from or overridden by rack-level state.
- A mirrored face must still exist as a real `RackFace` entity with its own `id`, `side`, and `addressing`. Mirroring is a structural shortcut, not an erasure of face identity.

---

### 3.3 RackSection

**Purpose:** One structural segment along the length of a rack face. Holds slot-bearing levels.

**Canonical owner:** RackSection entity (persisted in `rack_sections` table, scoped to a `RackFace`).

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Stable section identity |
| `ordinal` | `number` (int ≥ 1) | Physical order within the face |
| `length` | `number` (positive) | Physical length (metres) |
| `levels` | `RackLevel[]` | Must be non-empty for an enabled face |

---

### 3.4 RackLevel

**Purpose:** One horizontal tier within a section. Holds a uniform count of addressable slots.

**Canonical owner:** RackLevel entity (persisted in `rack_levels` table, scoped to a `RackSection`).

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (UUID) | Stable level identity |
| `ordinal` | `number` (int ≥ 1) | Vertical order within the section |
| `slotCount` | `number` (int ≥ 1) | Number of addressable slots on this level |

---

### 3.5 RackTopology

**Purpose:** Expresses canonical rack-level sidedness and Face B relationship in a discrete, derivation-free contract.

**Canonical owner:** Rack entity (fields on `Rack`, not a separate entity).

**Fields:**

```
sidedness:          'single' | 'double'
faceBRelationship:  'absent' | 'mirrored' | 'independent'
```

**Constraints:**

| sidedness | faceBRelationship | Meaning |
|---|---|---|
| `single` | `absent` | One-sided rack; Face B must not exist |
| `double` | `mirrored` | Face B mirrors Face A's structure |
| `double` | `independent` | Face B has its own structure and addressing |

No other combinations are valid. `sidedness = 'single'` with `faceBRelationship = 'mirrored'` is an invariant violation.

---

### 3.6 AddressingConfig

**Purpose:** Defines face-local spatial addressing semantics for slot number assignment. Replaces `slotNumberingDirection: ltr/rtl` as the canonical addressing contract.

**Canonical owner:** `RackFace` (per face; addressing is face-local).

**Fields:**

```
horizontalOrigin:  'near-end' | 'far-end'
verticalOrigin:    'bottom' | 'top'
```

**Semantics:**

- `horizontalOrigin: 'near-end'` — section address ordinal 1 starts at the conventional entry end of the rack (the end the rack was placed with as its reference end). Section ordinals increase away from that end.
- `horizontalOrigin: 'far-end'` — section address ordinal 1 starts at the far end. Section ordinals increase toward the entry end.
- `verticalOrigin: 'bottom'` — level ordinal 1 is the lowest physical level.
- `verticalOrigin: 'top'` — level ordinal 1 is the highest physical level.

These semantics are face-local and rack-relative. They do not change meaning when the rack is rotated. They do not refer to screen coordinates.

**Default values (new racks):**

```
horizontalOrigin: 'near-end'
verticalOrigin:   'bottom'
```

---

## 4. Canonical Field-Level Contract

| Field | Canonical owner | Canonical type | Notes |
|---|---|---|---|
| `rack.id` | Rack | UUID string | Stable across draft edits |
| `rack.displayCode` | Rack | string | Unique per layout version |
| `rack.x` | Rack | number (metres) | Canvas position; moves both faces together |
| `rack.y` | Rack | number (metres) | Canvas position; moves both faces together |
| `rack.rotationDeg` | Rack | `0\|90\|180\|270` | Canvas orientation; does not rename faces |
| `rack.totalLength` | Rack | number > 0 (metres) | Nominal shared envelope |
| `rack.depth` | Rack | number > 0 (metres) | Nominal shared depth; face-specific depth not yet modeled |
| `rack.sidedness` | Rack (topology) | `'single'\|'double'` | Canonical; replaces `kind` |
| `rack.faceBRelationship` | Rack (topology) | `'absent'\|'mirrored'\|'independent'` | Canonical; replaces `isMirrored` |
| `face.id` | RackFace | UUID string | Stable; not reassigned by rotation or edits |
| `face.side` | RackFace | `'A'\|'B'` | Stable identity; never screen-relative |
| `face.enabled` | RackFace | boolean | Controls cell generation participation |
| `face.faceLength` | RackFace | number > 0 \| null | Optional per-face usable length override |
| `face.addressing` | RackFace | AddressingConfig | Face-local spatial addressing; canonical |
| `face.sections` | RackFace | RackSection[] | Face-specific structure |
| `face.mirrorSourceFaceId` | RackFace | UUID \| null | Set only when `rack.faceBRelationship = 'mirrored'` |
| `section.ordinal` | RackSection | int ≥ 1 | Physical section order within face |
| `section.length` | RackSection | number > 0 (metres) | Physical section length |
| `level.ordinal` | RackLevel | int ≥ 1 | Physical level order within section |
| `level.slotCount` | RackLevel | int ≥ 1 | Addressable slots per level |

---

## 5. Topology Contract

### What topology must answer

1. **Is this rack single-faced or double-faced?** → `rack.sidedness`
2. **If double-faced, what is the structural relationship of Face B to Face A?** → `rack.faceBRelationship`

### Canonical topology fields

`sidedness` and `faceBRelationship` are canonical, directly persisted rack-level fields.

They must not be derived at read-time from:
- `faces.length`
- any face's `isMirrored` value
- any face's `sections.length`
- any face's `enabled` status

### Face B relationship modes

**`absent`**: Rack has no Face B. `faces` contains only Face A. `sidedness` must be `'single'`.

**`mirrored`**: Face B structurally mirrors Face A. Face B must exist as a real `RackFace` entity with its own `id`, `side = 'B'`, and `mirrorSourceFaceId` pointing to Face A's `id`. Cell generation resolves Face B's sections from Face A at generation time. Face B may still have its own `addressing` config (independent of Face A's).

**`independent`**: Face B has its own `sections`, its own `addressing`, and optionally its own `faceLength`. No `mirrorSourceFaceId` is set.

### Legacy / derived fields

| Field | Status | Notes |
|---|---|---|
| `kind: 'single'\|'paired'` | Legacy → derived | `'single'` ↔ `sidedness='single'`; `'paired'` ↔ `sidedness='double'` |
| `isMirrored: boolean` | Legacy → derived | `true` ↔ `faceBRelationship='mirrored'` |
| `mirrorSourceFaceId` | Compatibility-only | Retained during `'mirrored'` mode; null otherwise |
| `axis: 'NS'\|'WE'` | Deprecated | Redundant with `rotationDeg`; must not be used as authority |

### What may be editor-only

Editor task state (e.g., which Face B configuration mode the user is currently in the process of configuring) is editor-only runtime state. It must not be saved to the draft or treated as canonical topology. Only resolved `sidedness` and `faceBRelationship` survive save/load.

---

## 6. Addressing Contract

### Problem with current `slotNumberingDirection: ltr/rtl`

`ltr/rtl` is not sufficient because:

1. It does not express vertical origin (which level is ordinal 1).
2. "Left" and "right" are screen-relative and change meaning under rotation.
3. It collapses two independent spatial axes into a single poorly-named flag.

### Canonical addressing contract

The canonical addressing representation is `AddressingConfig` (see §3.6):

```
horizontalOrigin:  'near-end' | 'far-end'
verticalOrigin:    'bottom' | 'top'
```

`near-end` and `far-end` are rack-relative. They are defined relative to the rack's reference entry point, which is established at placement time and does not change when the rack is rotated.

### Compatibility mapping from `slotNumberingDirection`

| Legacy value | Canonical mapping |
|---|---|
| `ltr` | `{ horizontalOrigin: 'near-end', verticalOrigin: 'bottom' }` |
| `rtl` | `{ horizontalOrigin: 'far-end', verticalOrigin: 'bottom' }` |

**Lossy note:** Both legacy values map to `verticalOrigin: 'bottom'` because `ltr/rtl` encodes no vertical information. Any rack where level ordinal 1 is physically at the top cannot be represented in the legacy model. The canonical model resolves this.

### `slotNumberingDirection` status

`slotNumberingDirection: ltr/rtl` is a **compatibility-only** field. It should not be treated as the source of truth in any new code path. New code must read `face.addressing.horizontalOrigin` and `face.addressing.verticalOrigin`.

`slotNumberingDirection` must be kept in persistence and bundle contracts during the migration window so existing saved drafts can be read without loss.

### Addressing is face-local

Each face has its own `AddressingConfig`. Face A and Face B may have different addressing origins. Even when `faceBRelationship = 'mirrored'` (Face B mirrors Face A's structure), Face B retains its own `addressing` config that may differ from Face A's.

---

## 7. Legacy Compatibility Contract

Each legacy field is classified and its relationship to the canonical model defined.

### `kind: 'single' | 'paired'`

- **Status:** Compatibility-only. **Target: deprecated.**
- **Derivation from canonical:** `kind = sidedness === 'single' ? 'single' : 'paired'`
- **Reading rule:** During migration window, may be read for backward compatibility. Must not be written as the authoritative source; `sidedness` is written instead.
- **Validation rule:** If `kind` is present and conflicts with `sidedness`, `sidedness` wins.

### `isMirrored: boolean`

- **Status:** Compatibility-only on `RackFace`. **Target: deprecated.**
- **Derivation from canonical:** `isMirrored = rack.faceBRelationship === 'mirrored' && face.side === 'B'`
- **Reading rule:** During migration window, may be read to derive `faceBRelationship` for legacy records. New code must not write `isMirrored` as the source of truth.

### `mirrorSourceFaceId: string | null`

- **Status:** Retained as a structural pointer during `faceBRelationship = 'mirrored'` mode.
- **Canonicality:** Partially canonical in the mirrored mode only. Must be `null` when `faceBRelationship = 'independent'` or `'absent'`.
- **Not canonical for:** determining topology (that is `faceBRelationship`'s job).

### `sections.length` as implicit signal

- **Status:** Not canonical for anything. **Forbidden as a topology signal.**
- `sections.length === 0` on Face B must not be interpreted as "Face B is absent" or "Face B is single-sided."
- Topology is determined exclusively by `rack.sidedness` and `rack.faceBRelationship`.

### `slotNumberingDirection: 'ltr' | 'rtl'`

- **Status:** Compatibility-only on `RackFace`. **Target: deprecated.**
- **Derivation from canonical:** `slotNumberingDirection = face.addressing.horizontalOrigin === 'near-end' ? 'ltr' : 'rtl'` (approximate; loses vertical origin)
- **Reading rule:** May be read to bootstrap `AddressingConfig` during migration, using the lossy compatibility mapping defined in §6.
- **Writing rule:** New code writes `face.addressing`; `slotNumberingDirection` may be kept as a compatibility mirror during migration window.

### `axis: 'NS' | 'WE'`

- **Status:** Deprecated. **No canonical mapping.**
- `rotationDeg` is the sole authority on rack orientation.
- `axis` must not be used in any new validation, cell generation, or UI logic.
- Persisted `axis` values may be retained in the schema as a safety buffer during migration but must be treated as informational only.

---

## 8. Editor State Contract

### What must survive save/load

The following must be part of the draft payload persisted to `save_layout_draft` and recovered from `get_layout_bundle`:

- `rack.id`
- `rack.displayCode`
- `rack.x`, `rack.y`, `rack.rotationDeg`
- `rack.totalLength`, `rack.depth`
- `rack.sidedness`
- `rack.faceBRelationship`
- `face.id`, `face.side`, `face.enabled`
- `face.faceLength` (when set)
- `face.addressing` (canonical; `slotNumberingDirection` retained as compat mirror)
- `face.mirrorSourceFaceId` (when `faceBRelationship = 'mirrored'`)
- `face.sections` (full structure)
- section ordinals, lengths, levels, level ordinals, slotCounts

### What is editor-only runtime state

The following must not be written to draft payload:

- Current inspector panel open/close state
- Which Face B configuration task mode the user is currently in
- Draft address preview results
- `RackSideFocus` ('north'/'east'/'south'/'west') — editor-only UI hint, not canonical state
- `ObjectWorkContext` ('geometry'/'structure') — editor-only navigation state
- Floating toolbar visibility
- Multi-rack selection state
- Any canvas zoom/pan state

### Topology must be explicit in editor state

`editorStore` must hold `rack.sidedness` and `rack.faceBRelationship` as first-class fields. These must not be derived at render time from `faces.length` or `isMirrored`.

When a user action changes topology (e.g., enabling Face B, switching Face B from mirrored to independent), the store must update `sidedness` and `faceBRelationship` directly — not indirectly via legacy face flags.

### Addressing must be explicit in editor state

`editorStore` must hold `face.addressing: AddressingConfig` per face. `slotNumberingDirection` may exist as a compatibility mirror but must not be the field that drives cell generation preview in new code.

---

## 9. Layout Bundle Contract

The layout bundle (`get_layout_bundle` RPC output, consumed by `mapLayoutBundleJsonToDomain`) must carry the following shape for each rack. Fields marked `[compat]` may be present during the migration window but are not canonical targets.

### Target bundle shape per rack

```jsonc
{
  "id": "<uuid>",
  "displayCode": "A1",
  "x": 12.5,
  "y": 8.0,
  "totalLength": 6.0,
  "depth": 1.2,
  "rotationDeg": 90,

  // Canonical topology
  "sidedness": "double",
  "faceBRelationship": "mirrored",

  // Legacy compat — present during migration window, not authoritative
  "kind": "paired",      // [compat]
  "axis": "WE",          // [compat]

  "faces": [
    {
      "id": "<uuid>",
      "side": "A",
      "enabled": true,
      "faceLength": null,

      // Canonical addressing
      "addressing": {
        "horizontalOrigin": "near-end",
        "verticalOrigin": "bottom"
      },

      // Legacy compat
      "slotNumberingDirection": "ltr",   // [compat]
      "isMirrored": false,               // [compat]
      "mirrorSourceFaceId": null,

      "sections": [
        {
          "id": "<uuid>",
          "ordinal": 1,
          "length": 2.0,
          "levels": [
            { "id": "<uuid>", "ordinal": 1, "slotCount": 8 },
            { "id": "<uuid>", "ordinal": 2, "slotCount": 8 }
          ]
        }
      ]
    },
    {
      "id": "<uuid>",
      "side": "B",
      "enabled": true,
      "faceLength": null,

      "addressing": {
        "horizontalOrigin": "near-end",
        "verticalOrigin": "bottom"
      },

      "slotNumberingDirection": "ltr",   // [compat]
      "isMirrored": true,                // [compat]
      "mirrorSourceFaceId": "<face-A-uuid>",

      "sections": []  // Empty for mirrored; generator resolves from Face A
    }
  ]
}
```

### Bundle contract rules

1. `sidedness` and `faceBRelationship` must be present and canonical.
2. `kind` and `axis` may be present for compatibility; consuming code must not treat them as authoritative.
3. `addressing` must be present on every face.
4. `slotNumberingDirection` may be present as a compat mirror during migration.
5. Mirrored faces may have `sections: []`; this is not an error — generator resolves from `mirrorSourceFaceId`.
6. `mirrorSourceFaceId` must be present and non-null on a mirrored Face B.
7. All UUIDs must be stable across load/save cycles.

---

## 10. Validation Contract

### Rack identity invariants

- `displayCode` must be unique within a `layoutVersionId`.
- `rack.id` must not change during draft edits.
- A rack must have at least one face with `side = 'A'` and `enabled = true`.

### Face identity invariants

- `face.side` must be stable across all edits and save/load cycles.
- Face A must always be present.
- Face B may be absent only when `rack.sidedness = 'single'`.
- Face B must be present when `rack.sidedness = 'double'`.
- A face with `side = 'B'` and `enabled = false` is allowed; it does not participate in cell generation.

### Topology consistency invariants

- `sidedness = 'single'` → `faceBRelationship = 'absent'` → no Face B entity.
- `sidedness = 'double'` → `faceBRelationship ∈ {'mirrored', 'independent'}` → Face B entity must exist.
- `faceBRelationship = 'mirrored'` → `face.mirrorSourceFaceId` must point to a valid Face A `id` within the same rack.
- `faceBRelationship = 'independent'` → `face.mirrorSourceFaceId` must be null.
- `faceBRelationship = 'absent'` → no Face B entity; any `isMirrored` flag on a Face A row is invalid.

### Structure validity invariants

- For each enabled face: `sections` must be non-empty.
- For each section: `levels` must be non-empty.
- For each enabled face: sum of `section.length` values must equal `face.faceLength ?? rack.totalLength` (within 0.001 m tolerance).
- For mirrored faces: section structure is resolved from `mirrorSourceFaceId` at generation time; the face's own `sections` may be empty.
- `level.slotCount` must be ≥ 1.

### Addressing validity invariants

- `face.addressing` must be present and fully specified on every face.
- `face.addressing.horizontalOrigin` must be `'near-end'` or `'far-end'`. No other values allowed.
- `face.addressing.verticalOrigin` must be `'bottom'` or `'top'`. No other values allowed.

### Uniqueness / collision rules

- Generated cell addresses must be globally unique within a `layoutVersionId`.
- Address collision is a hard error that blocks publish.
- Address format: `{displayCode}-{side}.{sectionOrdinal}.{levelOrdinal}.{slotNo}` (canonical; not changed by this revision).

### Screen-relative leak prohibition

- `RackSideFocus` ('north'/'east'/'south'/'west') must not appear in any saved draft, bundle, or validation rule. It is editor-only.
- `axis` ('NS'/'WE') must not be used as input to validation logic in new code.
- No validation rule may compare a face's identity to a canvas direction.

---

## 11. Publish / Cell-Generation Contract

### What publish operates on

Publish operates on one rack entity with one or two enabled faces. It must not treat a double-sided rack as two independent operations.

### Required inputs to cell generation

Cell generation for a rack requires:

- `rack.id`, `rack.displayCode`
- `rack.x`, `rack.y`, `rack.rotationDeg` (for spatial coordinate output, if applicable)
- For each enabled face:
  - `face.id`, `face.side` (stable identity; propagated into generated cells)
  - `face.addressing` (canonical; used for section traversal order and level ordinal direction)
  - Resolved sections: own sections if `independent`; source face's sections if `mirrored`
  - `face.faceLength ?? rack.totalLength` (for validation only; not needed by generator directly)

### Face identity must survive into generated cells

Every generated cell must carry:
- `rackId`
- `rackFaceId` (the actual face UUID, stable)
- `face.side` contribution to the cell address (`A` or `B`)

Cell address format retains `{side}` as part of the address string. `side` is sourced from the face entity, not inferred from screen position.

### What publish must not do

- Publish must not infer `sidedness` or `faceBRelationship` from legacy fields at publish time.
- Publish must not use `isMirrored` as the primary topology signal.
- Publish must not derive face identity from canvas position, rotation, or display order.
- Publish must not use `slotNumberingDirection` as the primary addressing input in new code; it must use `face.addressing`.

### Compatibility logic

During the migration window, if a saved draft contains only legacy fields (`kind`, `isMirrored`, `slotNumberingDirection`) and does not yet carry canonical fields (`sidedness`, `faceBRelationship`, `addressing`), the bundle mapper must apply the compatibility derivation defined in §7 before passing data to cell generation. This compatibility bridge must be explicit and isolated — not silently spread through generation logic.

---

## 12. Persistence Impact Summary

This is not a migration plan. It is an impact scope statement.

| Area | Impact |
|---|---|
| **Schema shape** | `racks` table needs `sidedness` and `face_b_relationship` columns. `rack_faces` table needs `addressing_horizontal_origin` and `addressing_vertical_origin` columns. Existing `kind`, `axis`, `is_mirrored`, `slot_numbering_direction` columns should be retained during migration window. `axis` column may eventually be removed. |
| **Bundle serialization** | `get_layout_bundle` RPC must emit `sidedness`, `faceBRelationship`, and `addressing` fields. Existing legacy fields remain for backward compat during migration. |
| **Save/load path** | `save_layout_draft` payload must include canonical fields. Mapper must read canonical fields when present; fall back to compatibility derivation for legacy-only records. |
| **Draft clone path** | `create_layout_draft` copies all four tables. Canonical fields will be cloned automatically once present in schema. No logic change required beyond schema. |
| **Validation path** | Validation must be updated to enforce topology invariants (§10). Current validation that reasons about `kind` and `isMirrored` must be updated to reason about `sidedness` and `faceBRelationship`. |
| **Publish / cell generation path** | Generator must consume `face.addressing` instead of `slotNumberingDirection`. Topology resolution must use `faceBRelationship` instead of `isMirrored`. Compatibility bridge required for legacy records during migration window. |

---

## 13. Canonical vs Legacy Summary Matrix

| Concern | Canonical representation | Legacy representation | Status |
|---|---|---|---|
| Rack sidedness | `rack.sidedness: 'single'\|'double'` | `rack.kind: 'single'\|'paired'` | Legacy → derived; `kind` to be deprecated |
| Face B relationship mode | `rack.faceBRelationship: 'absent'\|'mirrored'\|'independent'` | `face.isMirrored: boolean` | Legacy → derived; `isMirrored` to be deprecated |
| Mirrored face pointer | `face.mirrorSourceFaceId` (compat retained in `'mirrored'` mode) | Same field; no rename | Partially canonical in mirrored mode only |
| Face identity | `face.side: 'A'\|'B'` (stable, not screen-relative) | Same field; semantics clarified | Canonical; semantics strengthened, no rename |
| Horizontal address origin | `face.addressing.horizontalOrigin: 'near-end'\|'far-end'` | `face.slotNumberingDirection: 'ltr'\|'rtl'` | Legacy → compatibility-only; `slotNumberingDirection` to be deprecated |
| Vertical address origin | `face.addressing.verticalOrigin: 'bottom'\|'top'` | Not representable in legacy model | New canonical field; no legacy equivalent |
| Rack orientation | `rack.rotationDeg: 0\|90\|180\|270` | `rack.axis: 'NS'\|'WE'` | `axis` deprecated; `rotationDeg` is authoritative |
| Usable face length | `face.faceLength` (optional override) | Same field; semantics unchanged | Canonical; no change needed |
| Rack depth | `rack.depth` | Same field | Canonical; no change |
| Mirrored section inference | `faceBRelationship = 'mirrored'` + `mirrorSourceFaceId` | `isMirrored = true` + `sections.length === 0` | Legacy inference pattern to be eliminated |
| Topology signal | `rack.sidedness` + `rack.faceBRelationship` | `faces.length`, `isMirrored`, `sections.length` | Implicit signals forbidden; explicit canonical fields required |

---

## 14. Open Questions

The following questions are genuinely unresolved and require product decision before implementation of the relevant area.

1. **`near-end` / `far-end` reference point definition**: What exactly establishes the "near end" of a rack at placement time? Is it the end closest to the placement drag origin, or a separate attribute set by the operator, or always the lower-ordinal end? This must be defined before addressing fields can be written into new records.

2. **Face B addressing under mirroring**: When `faceBRelationship = 'mirrored'`, should Face B's `addressing` default to the inverse of Face A's `horizontalOrigin` (since Face B is physically approached from the opposite direction), or must the operator configure it explicitly? Both are defensible; product must choose.

3. **Depth per face**: The current model treats depth as rack-level. If a future product decision introduces face-specific depth (e.g., a rack with a wider Face A and narrower Face B), the ownership model supports this addition on `RackFace`, but the schema and validation contracts would need extension. This is currently deferred.

4. **`faceBRelationship = 'copied'`**: The current contract defines `mirrored` (structural mirror, resolved at generation time) and `independent` (fully separate structure). A `copied` mode (Face B was initialized from Face A but is now diverged independently) could be useful as an editor affordance, but it collapses to `independent` in the domain model. This should be confirmed: is `copied` ever a persistent semantic, or is it editor task state only?

---

## 15. Recommended Implementation Order

The following sequence minimizes breakage while establishing canonical semantics progressively.

**Track 1 — Domain types** *(no persistence changes required)*
Update `packages/domain` TypeScript types:
- Add `RackTopology`, `AddressingConfig` types.
- Add `sidedness`, `faceBRelationship`, `addressing` to `Rack` and `RackFace` schemas.
- Keep legacy fields (`kind`, `isMirrored`, `slotNumberingDirection`) in schemas as optional/compat.
- Add compatibility derivation functions (`deriveTopologyFromLegacy`, `deriveAddressingFromLegacy`).

**Track 2 — Editor state**
Update `editorStore` to hold `sidedness`, `faceBRelationship`, `addressing` as first-class fields. Replace topology derivation logic that reads `isMirrored`/`sections.length`. Keep legacy field writes as compat mirrors.

**Track 3 — Bundle contract**
Update `get_layout_bundle` RPC and mapper (`mapLayoutBundleJsonToDomain`) to:
- Emit and parse canonical fields.
- Apply compatibility derivation when reading legacy-only records.
- Validate that canonical fields and legacy fields agree when both are present.

**Track 4 — Validation**
Update `validateLayoutDraft` to enforce topology invariants defined in §10. Replace `kind`-based and `isMirrored`-based checks with `sidedness`/`faceBRelationship` checks.

**Track 5 — Publish / cell generation**
Update `generateRackCells` and publish path to consume `face.addressing` instead of `slotNumberingDirection`. Apply compatibility bridge for records without canonical addressing fields. Confirm cell address format is unchanged.

**Track 6 — Persistence adaptation**
Add schema columns for canonical fields (`sidedness`, `face_b_relationship`, `addressing_horizontal_origin`, `addressing_vertical_origin`). Update `save_layout_draft` to write canonical fields. Backfill existing records using compatibility derivation. Do not drop legacy columns until all read paths are confirmed migrated.
