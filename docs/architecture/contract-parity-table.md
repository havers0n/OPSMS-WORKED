# Contract Parity Audit

Scope: current layout-core runtime path only.

Path audited:

`Postgres schema / RPC -> BFF DTO -> packages/domain -> frontend entity mapping -> editor store / UI`

Status legend:

- `Aligned`: same field survives across the active path with compatible semantics.
- `Partial`: field exists, but only on part of the path or one flow variant.
- `Weakened`: a boundary accepts looser values than downstream invariants allow.
- `Dropped`: field is loaded or required upstream, then lost before UI/store round-trip.
- `Frontend-only`: field exists in domain/UI but has no persisted source in the current layout flow.
- `Divergent`: same field name exists on both sides, but implementation/meaning differs.
- `DB-only`: persisted lifecycle/audit data not surfaced in the current editor flow.

## Table

| Entity | Field | DB/RPC source | BFF DTO | Domain schema | UI/store | Status | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `LayoutDraft` | `layoutVersionId` | `layout_versions.id`; `save_layout_draft`; `publish_layout_version` | `layoutDraftResponseSchema`; `layoutVersionIdResponseSchema`; `publishResponseSchema` | `layoutDraftSchema`; `layoutPublishResultSchema` | `editor-store.draft.layoutVersionId`; validation cache key | Aligned | Primary identity survives end-to-end. |
| `LayoutDraft` | `floorId` | `layout_versions.floor_id` | `layoutDraftResponseSchema`; `publishedLayoutSummaryResponseSchema` | `layoutDraftSchema`; `publishedLayoutSummarySchema` | active floor context; editor draft state | Aligned | Stable across read flows. |
| `LayoutVersion` | `versionNo` | `layout_versions.version_no` | emitted only in published summary | `publishedLayoutSummarySchema`; `layoutVersionSchema` exists separately | published summary consumers only | Partial | Active draft fetch reads `version_no` for selection, but drops it from the editor DTO. |
| `LayoutVersion` | `state` | `layout_versions.state` | used in BFF lookup only; not emitted in draft DTO | `layoutVersionSchema` exists, not used in draft transport | not stored in editor state | Partial | Important lifecycle flag exists in persistence, but current draft contract hides it. |
| `LayoutVersion` | `parentPublishedVersionId` / `createdBy` / `publishedBy` / `archivedAt` | `layout_versions.*` | not exposed | not represented in active layout contracts | not used | DB-only | Lifecycle/audit metadata is persisted but absent from current editor/runtime boundary. |
| `PublishedLayoutSummary` | `publishedAt` | `layout_versions.published_at`; `publish_layout_version` result | `publishedLayoutSummaryResponseSchema`; `publishResponseSchema` | `publishedLayoutSummarySchema`; `layoutPublishResultSchema` | publish status messaging | Aligned | Published timestamp survives the summary/publish flows. |
| `Rack` | `id` | `racks.id`; `save_layout_draft` payload | response + save request DTO | `rackSchema` | `editor-store`, selection, canvas | Aligned | Stable rack identity. |
| `Rack` | `displayCode` | `racks.display_code`; save payload | response + save request DTO | `rackSchema` | inspector, address generation, canvas labels | Aligned | Used as both label and address component. |
| `Rack` | `kind` | DB check: `single/paired` | save DTO accepts any non-empty string | `rackKindSchema` | store/UI operate on `single/paired` only | Weakened | BFF request validation is looser than DB/domain invariants. |
| `Rack` | `axis` | DB check: `NS/WE` | save DTO accepts any non-empty string | `rackAxisSchema` | store/UI operate on `NS/WE`; rotation sync mutates it | Weakened | Test fixtures still use stale values like `horizontal`, which would only fail later at DB insertion. |
| `Rack` | `x` / `y` | `racks.x`, `racks.y` | response + save request DTO | `rackSchema` | canvas placement and spacing tools | Aligned | Stable geometry fields. |
| `Rack` | `totalLength` / `depth` | `racks.total_length`, `racks.depth` | response + save request DTO | `rackSchema` | inspector, validation, previews | Aligned | Physical dimensions survive correctly. |
| `Rack` | `rotationDeg` | DB check: `0/90/180/270` | save DTO accepts any number | literal union in `rackSchema` | store rotates in 90 degree steps | Weakened | BFF request contract is looser than DB/domain. |
| `Rack` | `state` | `racks.state` | not emitted in active draft DTO | not represented | not used | DB-only | Rack-level lifecycle state is persisted but not surfaced to editor clients. |
| `RackFace` | `id` | `rack_faces.id` | response + save request DTO | `rackFaceSchema` | store, inspector, mirror logic | Aligned | Stable face identity. |
| `RackFace` | `side` | DB check: `A/B` | save DTO accepts any non-empty string | `rackFaceSideSchema` | UI assumes `A/B` | Weakened | Another loose BFF input boundary. |
| `RackFace` | `enabled` | `rack_faces.enabled` | response + save request DTO | `rackFaceSchema` | inspector, validation, cell generation | Aligned | Correctly preserved across the active flow. |
| `RackFace` | `anchor` | `rack_faces.anchor`; `create_layout_draft`; `save_layout_draft` payload requires it | BFF read mapper includes it; save DTO requires it | missing from `rackFaceSchema` | not present in store; comments/UI copy still reference anchor semantics | Dropped | Confirmed domain-boundary loss. Frontend save mapper cannot send it back, so current web save contract is broken for real round-trip persistence. |
| `RackFace` | `slotNumberingDirection` | DB check: `ltr/rtl` | response present; save DTO accepts any non-empty string | enum in `rackFaceSchema` | numbering controls, previews, cell generation | Weakened | Read path is fine; write validation is still looser than DB/domain. |
| `RackFace` | `isMirrored` | `rack_faces.is_mirrored` | response + save request DTO | `rackFaceSchema` | mirror mode and validation | Aligned | Preserved end-to-end. |
| `RackFace` | `mirrorSourceFaceId` | `rack_faces.mirror_source_face_id` | response + save request DTO | `rackFaceSchema` | mirror mode and validation | Aligned | Preserved end-to-end. |
| `RackFace` | `faceLength` | none in current DB schema or RPC payload | not present | optional field on `rackFaceSchema` | edited and consumed in store/UI validation and presets | Frontend-only | Asymmetric face length exists only locally today; save/publish/DB validation cannot persist or verify it. |
| `RackSection` | `id` | `rack_sections.id` | response + save request DTO | `rackSectionSchema` | store/UI row identity | Aligned | Stable end-to-end. |
| `RackSection` | `ordinal` | `rack_sections.ordinal` | response + save request DTO | `rackSectionSchema` | inspector tables and address generation | Aligned | Stable end-to-end. |
| `RackSection` | `length` | `rack_sections.length` | response + save request DTO | `rackSectionSchema` | inspector, validation, presets | Aligned | Stable end-to-end for persisted sections. |
| `RackLevel` | `id` | `rack_levels.id` | response + save request DTO | `rackLevelSchema` | store/UI row identity | Aligned | Stable end-to-end. |
| `RackLevel` | `ordinal` | `rack_levels.ordinal` | response + save request DTO | `rackLevelSchema` | validation and address generation | Aligned | Stable end-to-end. |
| `RackLevel` | `slotCount` | `rack_levels.slot_count` | response + save request DTO | `rackLevelSchema` | previews, validation, cell generation | Aligned | Stable end-to-end. |
| `Cell` | `address.raw` / `address.sortKey` | `build_cell_address`; `cells.address`; `cells.address_sort_key` | published summary exposes only sample addresses, not full cell DTOs | `cellSchema`; `parseCellAddress`; `generateLayoutCells` mirror the string format | address preview and local validation use generated cells | Partial | Address format is consistent, but the editor relies on locally generated cells rather than persisted cell rows. |
| `Cell` | `cellCode` | DB `build_cell_code` uses `md5(...):24`; persisted in `cells.cell_code` | no active BFF DTO in editor flow | `cellSchema`; `buildCellCode` uses a different lightweight hash | not surfaced in current UI | Divergent | Same field name, different algorithm. Frontend-generated `cellCode` is not parity-safe with persisted truth. |
| `Cell` | `x` / `y` | nullable `cells.x`, `cells.y` | no active layout editor DTO | optional in `cellSchema` | not used | Partial | Persisted shape exists but is not part of the current runtime path. |
| `Validation` | `isValid` / `issues[*].code` / `severity` / `message` / `entityId` | `validate_layout_version` RPC | `validationResponseSchema` | `layoutValidationResultSchema` | cached validation + inspector/top bar | Aligned | Validation transport itself is coherent. |
| `PublishResult` | `generatedCells` | `publish_layout_version` RPC result | `publishResponseSchema` | `layoutPublishResultSchema` | publish status messaging | Aligned | Publish impact survives correctly. |

## Priority Findings

1. `rack_faces.anchor` is the clearest current parity breach.
   It is persisted, cloned, selected, and required by the save RPC contract, but it disappears in `packages/domain` and therefore cannot survive a frontend round-trip.

2. `faceLength` is the inverse breach.
   It is modeled and actively used in the frontend/domain layer, but there is no persisted source of truth in the current DB/RPC contract.

3. BFF write validation is materially weaker than downstream invariants.
   `kind`, `axis`, `side`, `slotNumberingDirection`, `anchor`, and `rotationDeg` are accepted as generic strings/numbers in the save DTO even though DB/domain are enum-constrained.

4. `cellCode` is not parity-safe today.
   The DB and `packages/domain` generate different values under the same field name, so local derived cells must not be treated as operational truth.

5. Lifecycle metadata exists in persistence but not in the active editor contract.
   `layout_versions.state`, `version_no`, `parent_published_version_id`, and rack `state` are either hidden or only partially surfaced, which makes editor/runtime decisions depend on out-of-band query logic instead of explicit DTO truth.

## Immediate Follow-ups

1. Fix the `RackFace` contract first: either restore `anchor` in `packages/domain` and frontend save mapping, or remove it from persistence/RPC if the field is truly obsolete.
2. Decide whether `faceLength` is real domain truth or only a UI experiment. If real, add DB/RPC parity before relying on it for validation/publish semantics.
3. Tighten BFF save schemas to the same enums/literal sets enforced by DB/domain.
4. Rename or separate local preview cell identifiers from persisted `cellCode` unless both sides use the same algorithm.
