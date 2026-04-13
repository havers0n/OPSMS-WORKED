# Layout Mode — Rack/Face Domain Model Revision

## 1. Purpose

This is the third document in the Layout Mode architecture series.

**Document 1** (factual audit) captured the current state: capability inventory, state ownership map, and conflict analysis. It described what exists without prescribing change.

**Document 2** (interaction architecture redesign) proposed a target UI and task model: right-panel restructuring, explicit `faceBMode`, draft-vs-committed address handling, and incremental migration ideas.

**This document** sits between those two. It does not describe what currently exists. It does not redesign the UI or the panel. It defines what the rack/face domain model must actually mean — the semantic decisions that the redesign must obey and that the factual audit exposed as unresolved.

Specifically this document answers:

- What is a double-sided rack in this system?
- What do Face A and Face B mean and what must they never mean?
- Which physical properties belong to the rack vs the face?
- Is `ltr/rtl` an adequate canonical addressing semantic?
- What does this imply for persistence, validation, and publish?

This document must be read alongside Document 2. Decisions made here constrain implementation choices proposed there. Any future UI work, schema migration, or publish-path revision should treat this document as a prior constraint, not an optional reference.

---

## 2. Why the Current Model Is No Longer Sufficient

The current model is close to the correct structural shape, but its semantics are too weak.

Today, the system already models:

```
Rack
  RackFace
    RackSection
      RackLevel
```

The persistence model follows the same hierarchy: `racks`, `rack_faces`, `rack_sections`, and `rack_levels` are normalized tables. `rack_faces.side` is constrained to `A/B`. `face_length` already exists as a nullable per-face field. Draft creation, draft save, and layout bundle loading all operate across this hierarchy.

The problem is not that the system lacks a face model.

The problem is that the meaning of that face model is underdefined.

**Current semantic gaps:**

- Face B behavior is implicit.
- `kind` behaves more like a consequence of Face B state than a stable governing property.
- Face B semantics are reconstructed from `isMirrored + sections.length` instead of being expressed directly.
- `A/B` exist in persistence but are not defined as stable physical identities.
- `slotNumberingDirection: ltr/rtl` uses text-direction language for a physical warehouse concept.
- The current UI can imply that Face A / Face B are screen-relative labels.
- `faceLength` exists, but deeper face-level physical semantics are not explicitly modeled.
- The normalized SQL model means semantic revision affects more than frontend state.

This ambiguity blocks clean progress because the system cannot answer basic questions with confidence:

- Does rotating a rack change which face is A?
- Does Face B mean the opposite physical side or the right side of the screen?
- Is a double-sided rack one object or two linked objects?
- Is slot numbering text-directional or spatial?
- Should validation reason about one physical rack envelope or two independent bodies?
- Should publish operate on explicit face semantics or inferred mirrored state?

Without clear decisions here, UI improvements will keep leaking temporary interaction labels into domain truth.

---

## 3. Canonical Model Decision

**A double-sided rack is one rack entity with two stable, opposite rack faces.**

The canonical model remains:

```
Rack
  RackFace A
  RackFace B
```

A double-sided rack must not be modeled as two linked rack entities.

**Decision:**

The target domain model is:

- `Rack` represents one physical rack object.
- `RackFace` represents one addressable, structurally configurable face of that rack.
- Face A and Face B are stable identities of opposite faces on the same rack.
- The rack owns shared placement and shared physical-envelope semantics.
- Each face owns face-specific structure and face-specific addressing semantics.
- A rack may be single-faced or double-faced.
- A double-faced rack may support face-specific usable geometry where product reality requires it.

**Why this is the correct model:**

A warehouse operator experiences a double-sided rack as one physical object with two usable sides, not as two rack bodies that happen to be colocated.

That matters because the rack has shared physical integrity:

- one placement in the layout
- one rotation
- one physical footprint
- one conceptual identity in the floor plan
- one move operation
- one delete operation
- one publish relationship to the layout version

Faces may differ structurally, but that does not make them independent racks.

This also matches the current persistence direction. The database already stores `rack_faces` under `racks`. The required revision is semantic strengthening of the existing model, not a reversal into separate linked rack objects.

**Consequence:**

Future implementation should strengthen the existing `Rack → RackFace → RackSection → RackLevel` model rather than replace it.

This is a model clarification and extension, not a wholesale object-model rewrite.

---

## 4. Face Identity Semantics

Face A and Face B are stable face identities.

They are not:

- screen-relative labels
- compass directions
- left/right aliases
- renamed by rotation
- renamed by mirroring
- renamed by current panel order

**Decision:**

`A/B` mean:

- **A**: one stable physical face identity of the rack
- **B**: the opposite stable physical face identity of the same rack

The model should treat `A/B` the way a physical label on the rack would behave. If the rack is moved or rotated, the labels move with it. The identity does not change.

**What A/B must not mean:**

`A/B` must not mean:

- left / right on the canvas
- top / bottom on the canvas
- north / south / east / west
- front / back from the current viewport
- mirrored / non-mirrored
- visible / hidden
- primary / secondary because of UI order

Compass semantics are the wrong abstraction here. Layout drawings may not be globally north-aligned, and operators reason from local physical approach, not map compass.

Likewise, `A = left` and `B = right` is invalid. A rack rotated 180 degrees must not silently swap its face identities because the drawing changed.

**Rotation rule:**

Rack rotation changes canvas orientation only.

It does not rename faces.

If a rack is rotated:

- Face A remains Face A
- Face B remains Face B
- the face-local addressing frame remains attached to the face
- rendered screen position may change
- address interpretation must not silently invert unless the face's addressing configuration changes

**Single-faced vs double-faced semantics:**

A single-faced rack has only Face A.

A double-faced rack has Face A and Face B.

This must be explicit.

The model must not rely on vague "Face B exists conceptually" language. Either Face B is part of the rack topology or it is not.

---

## 5. Rack Topology

The current model is too weak around sidedness.

`kind` currently behaves more like a consequence of Face B state than a reliable governing property. That is backwards.

**Decision:**

Rack topology must be explicit canonical rack-level state.

The model needs a rack-level concept that answers:

- Is this rack single-faced or double-faced?
- If double-faced, what is the relationship of Face B to Face A?
- Is Face B absent, mirrored, copied, or independently configured?

This semantic responsibility belongs at the rack level, because topology is a property of the whole rack, not a property of one face in isolation.

**Why topology is rack-level:**

Topology determines the shape of the object model:

- whether one or two faces exist
- whether Face B participates in validation
- whether publish generates one face worth of cells or two
- whether the rack is structurally one-sided or two-sided

That is not a local property of Face B alone. It is a property of the rack as a whole.

**Consequence:**

`kind` may remain temporarily for compatibility, but the canonical model must not depend on weak derivation from `isMirrored + sections.length`.

The long-term model needs explicit rack topology, even if the exact field name is decided later.

---

## 6. Physical Ownership Model

The domain must cleanly separate:

- rack-level physical state
- face-level usable structure
- addressing configuration
- derived editor/runtime concerns

### 6.1 Rack-owned state

`Rack` owns properties that describe the physical object as a whole.

Rack-owned concerns include:

- rack identity
- placement / position in layout
- rotation in layout
- shared physical footprint
- nominal total length
- nominal depth
- topology
- relationship between faces at the object-model level

Rack placement and rotation are unambiguously rack-level. Faces do not have independent canvas positions.

Rack nominal depth is currently rack-level and should remain so unless a later product decision explicitly introduces asymmetric face-specific physical depth. That is a possible extension, not a current truth.

### 6.2 Face-owned state

`RackFace` owns properties that describe one usable side of the rack.

Face-owned concerns include:

- face identity: A or B
- enabled/present state within the rack topology
- face-specific structure
- face-specific usable length override
- section sequence
- level sequence
- slot generation inputs
- face-specific addressing configuration

`faceLength` is directionally correct as a face-owned field. It expresses that a face may have a usable/addressable extent that differs from the rack's nominal envelope.

### 6.3 Structural ownership

Structural config belongs primarily to `RackFace`.

Current structure:

```
RackFace
  RackSection
    RackLevel
```

That is correct.

Each face may have its own:

- section count
- section ordering
- section dimensions
- level count
- slot counts
- structural constraints

Even when Face B is mirrored from Face A, the result is still face-specific structure. Mirroring is a topology/configuration rule, not a reason to erase Face B as a domain entity.

### 6.4 Addressing ownership

Addressing config belongs to `RackFace`.

That is the correct default owner because address generation is experienced per side. A picker approaching Face A and a picker approaching Face B may interpret slot progression from different origins even though both faces belong to the same rack.

Addressing config includes:

- horizontal origin
- vertical origin
- horizontal progression
- vertical progression, if levels are directional
- any face-local rules needed to generate stable addresses

### 6.5 What is not domain ownership

The following are not canonical domain ownership:

- address preview UI state
- panel open/close state
- task-mode routing
- draft diff presentation
- other editor-only affordances

Those are derived runtime/editor concerns. They must not be mixed into the domain ownership model.

### Ownership summary

| Concern | Canonical Owner | Rationale |
|---|---|---|
| Rack identity | Rack | One physical object |
| Layout position | Rack | Both faces move together |
| Layout rotation | Rack | Both faces rotate together |
| Shared footprint | Rack | Physical envelope belongs to whole object |
| Nominal total length | Rack | Shared envelope |
| Nominal depth | Rack | Shared rack body by default |
| Rack topology | Rack | Whole-object sidedness and face relationship |
| Face identity A/B | RackFace | Stable identity of each opposite face |
| Face-specific usable length | RackFace | A face may have different usable extent |
| Sections | RackFace | Face-specific structure |
| Levels | RackSection / RackFace hierarchy | Face-specific vertical structure |
| Addressing config | RackFace | Addressing is face-local |
| Draft lifecycle | Layout version layer | Lifecycle must not redefine rack semantics |
| Preview state | Editor/runtime layer | Derived, not canonical domain truth |

---

## 7. Addressing Semantics

The current `slotNumberingDirection: ltr/rtl` is not sufficient as canonical domain language.

It may remain temporarily for compatibility, but it is structurally weak.

**Why `ltr/rtl` is weak:**

`ltr/rtl` is borrowed from text layout:

- `ltr`: left to right
- `rtl`: right to left

That is the wrong conceptual frame for physical warehouse addressing because:

- "left" and "right" are viewpoint-dependent
- they are easy to confuse with screen direction
- they do not express vertical origin at all
- they encourage text-direction thinking for a spatial problem

**Decision:**

The domain must move toward face-local spatial addressing semantics.

At minimum, addressing must distinguish:

- horizontal origin
- vertical origin
- horizontal progression
- vertical progression where applicable

The user intuition here is correct:

- start can be top or bottom
- start can be left or right
- these are spatial rules, not text-direction rules

**Canonical mental model:**

Each rack face has its own local coordinate frame.

Within that face-local frame, addressing semantics are defined relative to the face, not to the screen.

That means:

- face-local left/right are allowed as explanatory terms
- screen-left/screen-right are not domain semantics
- rotation must not change the meaning of configured face-local origins

**Compatibility position:**

Existing `slotNumberingDirection: ltr/rtl` should be treated as a legacy representation of part of the horizontal addressing rule.

A compatibility mapping may exist, but it must be explicitly defined against face-local semantics, not screen-relative semantics.

**Hard rule:**

Addressing direction is independent from face identity.

Changing addressing origin must not change whether a face is A or B.

Rotating a rack must not change whether a face is A or B.

Mirroring may initialize or constrain addressing defaults, but it must not collapse identity, orientation, and numbering into one implicit behavior.

---

## 8. Domain Invariants

These invariants must hold in the canonical model.

1. A rack is one physical object.
2. A rack can be single-faced or double-faced.
3. Single-faced rack = Face A only.
4. Double-faced rack = Face A and Face B.
5. Face A and Face B are stable opposite face identities.
6. Rotation does not rename faces.
7. Face identity is not screen-relative.
8. Face identity is not compass-relative.
9. Rack placement and rotation are rack-level.
10. Structure is face-level.
11. Addressing config is face-level.
12. Publish must preserve face identity.
13. Generated cells for Face A and Face B belong to the same rack.
14. Addressing changes must not mutate face identity.
15. UI/editor preview state must not be treated as domain truth.

---

## 9. Implications for Editing and Publish Semantics

The editor and publish path must interpret racks according to the canonical model.

### 9.1 Editing semantics

Editing must treat four concern groups as distinct:

- rack geometry
- rack topology
- face structure
- face addressing

These must not be conflated.

**Rack geometry edits:**
- move rack
- rotate rack
- change nominal length
- change nominal depth

**Rack topology edits:**
- switch between single-faced and double-faced
- enable or remove Face B
- define Face B relationship to Face A

**Face structure edits:**
- change Face A sections
- change Face B sections
- change levels
- change face-specific usable length

**Face addressing edits:**
- change horizontal origin
- change vertical origin
- change numbering progression
- review address outcomes

That separation is not just a UX preference. It follows from domain ownership.

### 9.2 Draft semantics

Draft state must preserve stable rack and face identity.

Creating a draft from a published version must clone:

- racks
- rack faces
- rack sections
- rack levels

The clone must preserve A/B identity. It must not infer face identity from display order, geometry, or current UI state.

Draft edits may change structure and addressing, but those edits must remain interpretable as:

- rack-level changes
- Face A changes
- Face B changes
- generated-address changes
- unpublished preview only

### 9.3 Publish semantics

Publish must generate cells from explicit face-specific structure and addressing under one rack identity.

For a double-sided rack:

- Face A cells belong to Face A
- Face B cells belong to Face B
- both sets of cells belong to the same rack

Publish must consume explicit topology and explicit face records/config, not weak inference from mirrored flags plus missing sections.

### 9.4 Cell generation implications

Cell generation must be face-aware.

The generator needs enough information to know:

- rack placement
- rack rotation
- rack identity
- face identity
- face-local structure
- face-local usable length
- face-local addressing config

Canvas orientation should affect rendered coordinates, not domain address meaning.

---

## 10. Persistence and Schema Implications

This is not a frontend-only concern.

The SQL model is already normalized:

- `racks` is a real table
- `rack_faces` is a real table
- `rack_faces.side` is constrained to `A/B`
- `slot_numbering_direction` is constrained to `ltr/rtl`
- `face_length` already exists as a nullable per-face field
- `get_layout_bundle()` serializes racks/faces/sections/levels as JSON
- `save_layout_draft()` writes them back from payload into SQL
- `create_layout_draft()` clones them across layout versions

The persistence model already assumes that rack faces are real first-class persisted entities. The model revision must therefore align persistence semantics with domain semantics.

**Impact map:**

| Layer | Impact |
|---|---|
| Domain types | Rack topology and face identity semantics must become explicit and stable |
| Editor state | State must stop inferring core topology from weak mirrored/section combinations |
| Layout bundle contracts | Bundles must carry explicit topology and stronger face-local addressing semantics |
| Save/load draft logic | Save/load must preserve stable A/B identity and explicit topology |
| Draft clone logic | Clone must preserve rack/face identity and future topology/address fields consistently |
| Validation logic | Validation must reason about one rack with one shared envelope and one or two usable faces |
| Publish / cell generation | Publish must generate cells from explicit face records and face-local addressing config |
| SQL schema | Existing structure is directionally correct but likely needs additive evolution for topology and stronger addressing semantics |

**Schema direction:**

The current schema does not need to be discarded.

It likely needs additive evolution.

What matters at this stage is not exact column naming, but the architectural direction:

- one rack
- stable A/B faces
- explicit topology
- face-local spatial addressing
- optional future support for stronger face-specific usable geometry

`slot_numbering_direction = ltr/rtl` should be treated as a compatibility constraint, not proof that the domain itself is text-directional.

---

## 11. Rejected Alternatives

### 11.1 Two linked racks

Rejected.

Modeling a double-sided rack as two linked rack bodies creates synthetic coupling problems around movement, rotation, deletion, validation, publishing, and address generation.

It weakens physical truth and overfits to implementation convenience.

A double-sided rack is not two racks. It is one rack with two faces.

### 11.2 Face A / Face B as left / right

Rejected.

Left/right are viewpoint-dependent and screen-dependent. They change under rotation and rendering changes.

Face identity must remain stable.

### 11.3 Face A / Face B as compass direction

Rejected.

Compass semantics are too absolute for this domain and do not survive local layout interpretation cleanly.

### 11.4 Keep `kind` as a weak derived consequence of Face B state

Rejected.

Whole-object topology must not depend on incidental derivation from secondary face fields.

### 11.5 Keep `ltr/rtl` as canonical addressing semantics

Rejected as a long-term model.

It may survive temporarily for compatibility, but it is not strong enough as the canonical warehouse addressing model.

---

## 12. Open Questions

The core decision is resolved: one rack with two stable opposite faces.

Remaining open questions are narrower:

1. What exact field or contract should represent rack topology?
2. Which Face B relationship modes are genuinely required by product?
3. Is `faceLength` sufficient, or are stronger face-specific usable-geometry fields required later?
4. What exact canonical field names should replace or supersede `ltr/rtl`?
5. How should legacy `slotNumberingDirection` be mapped during migration?
6. Must user-facing generated addresses always visibly encode face identity?

These are real follow-up questions, but they do not change the resolved core model.

---

## 13. Recommended Next Step

Produce a focused rack/face domain contract specification.

That artifact should define:

- canonical TypeScript/domain types for `Rack`, `RackFace`, structure config, and addressing config
- compatibility mapping from current `kind`, `isMirrored`, `sections.length`, and `slotNumberingDirection`
- layout bundle JSON shape changes
- validation invariants
- publish/cell-generation inputs
- additive schema recommendations, without writing migration scripts

The next step should not be another UI redesign.

The next step should be a precise domain contract that turns this model decision into implementation-ready boundaries.
