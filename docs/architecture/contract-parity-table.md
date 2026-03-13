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
| `LayoutVersion` | `state` | `layout_versions.state` | active draft DTO now carries `state` | `layoutDraftSchema`; `layoutVersionSchema` | carried in editor draft state as explicit lifecycle truth | Aligned | The active draft contract now makes layout lifecycle state explicit instead of relying on route semantics alone. |
| `LayoutVersion` | `parentPublishedVersionId` / `createdBy` / `publishedBy` / `archivedAt` | `layout_versions.*` | not exposed | not represented in active layout contracts | not used | DB-only | Lifecycle/audit metadata is persisted but absent from current editor/runtime boundary. |
| `PublishedLayoutSummary` | `publishedAt` | `layout_versions.published_at`; `publish_layout_version` result | `publishedLayoutSummaryResponseSchema`; `publishResponseSchema` | `publishedLayoutSummarySchema`; `layoutPublishResultSchema` | publish status messaging | Aligned | Published timestamp survives the summary/publish flows. |
| `Rack` | `id` | `racks.id`; `save_layout_draft` payload | response + save request DTO | `rackSchema` | `editor-store`, selection, canvas | Aligned | Stable rack identity. |
| `Rack` | `displayCode` | `racks.display_code`; save payload | response + save request DTO | `rackSchema` | inspector, address generation, canvas labels | Aligned | Used as both label and address component. |
| `Rack` | `kind` | DB check: `single/paired` | save DTO now uses `rackKindSchema` | `rackKindSchema` | store/UI operate on `single/paired` only | Aligned | BFF save boundary now rejects non-canonical rack kinds before RPC. |
| `Rack` | `axis` | DB check: `NS/WE` | save DTO now uses `rackAxisSchema` | `rackAxisSchema` | store/UI operate on `NS/WE`; rotation sync mutates it | Aligned | BFF save boundary now rejects non-canonical rack axes before RPC. |
| `Rack` | `x` / `y` | `racks.x`, `racks.y` | response + save request DTO | `rackSchema` | canvas placement and spacing tools | Aligned | Stable geometry fields. |
| `Rack` | `totalLength` / `depth` | `racks.total_length`, `racks.depth` | response + save request DTO | `rackSchema` | inspector, validation, previews | Aligned | Physical dimensions survive correctly. |
| `Rack` | `rotationDeg` | DB check: `0/90/180/270` | save DTO now uses the same literal union | literal union in `rackSchema` | store rotates in 90 degree steps | Aligned | BFF write validation now rejects non-canonical rotations before RPC. |
| `Rack` | `state` | `racks.state` | not emitted in active draft DTO | not represented | not used | DB-only | Rack-level lifecycle state is persisted but not surfaced to editor clients. |
| `RackFace` | `id` | `rack_faces.id` | response + save request DTO | `rackFaceSchema` | store, inspector, mirror logic | Aligned | Stable face identity. |
| `RackFace` | `side` | DB check: `A/B` | save DTO now uses `rackFaceSideSchema` | `rackFaceSideSchema` | UI assumes `A/B` | Aligned | BFF save boundary now rejects non-canonical face sides before RPC. |
| `RackFace` | `enabled` | `rack_faces.enabled` | response + save request DTO | `rackFaceSchema` | inspector, validation, cell generation | Aligned | Correctly preserved across the active flow. |
| `RackFace` | `anchor` | removed from active persistence/RPC contract | removed from BFF DTOs and save schema | intentionally not modeled | intentionally not carried in store/UI | Removed by design | Field was obsolete in the active layout flow and duplicated semantics already carried by `slotNumberingDirection`. |
| `RackFace` | `slotNumberingDirection` | DB check: `ltr/rtl` | response present; save DTO now uses `slotNumberingDirectionSchema` | enum in `rackFaceSchema` | numbering controls, previews, cell generation | Aligned | Read and write paths now use the same finite literal set. |
| `RackFace` | `isMirrored` | `rack_faces.is_mirrored` | response + save request DTO | `rackFaceSchema` | mirror mode and validation | Aligned | Preserved end-to-end. |
| `RackFace` | `mirrorSourceFaceId` | `rack_faces.mirror_source_face_id` | response + save request DTO | `rackFaceSchema` | mirror mode and validation | Aligned | Preserved end-to-end. |
| `RackFace` | `faceLength` | `rack_faces.face_length`; `create_layout_draft`; `save_layout_draft`; `validate_layout_version` | BFF read mapper + save DTO | optional field on `rackFaceSchema` | edited and consumed in store/UI validation, presets, and geometry | Aligned | Per-face override length now survives load/save round-trips and participates in DB validation as persisted layout truth. |
| `RackSection` | `id` | `rack_sections.id` | response + save request DTO | `rackSectionSchema` | store/UI row identity | Aligned | Stable end-to-end. |
| `RackSection` | `ordinal` | `rack_sections.ordinal` | response + save request DTO | `rackSectionSchema` | inspector tables and address generation | Aligned | Stable end-to-end. |
| `RackSection` | `length` | `rack_sections.length` | response + save request DTO | `rackSectionSchema` | inspector, validation, presets | Aligned | Stable end-to-end for persisted sections. |
| `RackLevel` | `id` | `rack_levels.id` | response + save request DTO | `rackLevelSchema` | store/UI row identity | Aligned | Stable end-to-end. |
| `RackLevel` | `ordinal` | `rack_levels.ordinal` | response + save request DTO | `rackLevelSchema` | validation and address generation | Aligned | Stable end-to-end. |
| `RackLevel` | `slotCount` | `rack_levels.slot_count` | response + save request DTO | `rackLevelSchema` | previews, validation, cell generation | Aligned | Stable end-to-end. |
| `Cell` | `address.raw` / `address.sortKey` | `build_cell_address`; `cells.address`; `cells.address_sort_key` | published summary exposes only sample addresses, not full cell DTOs | `cellSchema`; `parseCellAddress`; `generatePreviewCells` mirrors the preview address format | address preview and local validation use generated preview cells | Partial | Address format is consistent, but the editor relies on locally generated preview cells rather than persisted cell rows. |
| `Cell` | `cellCode` | DB `build_cell_code` uses `md5(...):24`; persisted in `cells.cell_code` | no active BFF DTO in editor flow | persisted `cellSchema` keeps `cellCode`; preview generation now uses `previewCellKey` | not surfaced in current UI | Separated by design | Published `cell_code` remains DB truth, while local preview cells use an explicit preview-only identifier instead of overloading `cellCode`. |
| `Cell` | `x` / `y` | nullable `cells.x`, `cells.y` | no active layout editor DTO | optional in `cellSchema` | not used | Partial | Persisted shape exists but is not part of the current runtime path. |
| `Validation` | `isValid` / `issues[*].code` / `severity` / `message` / `entityId` | `validate_layout_version` RPC | `validationResponseSchema` | `layoutValidationResultSchema` | cached validation + inspector/top bar | Aligned | Validation transport itself is coherent. |
| `PublishResult` | `generatedCells` | `publish_layout_version` RPC result | `publishResponseSchema` | `layoutPublishResultSchema` | publish status messaging | Aligned | Publish impact survives correctly. |

## Priority Findings

1. Lifecycle metadata still exists in persistence beyond the active editor contract.
   `version_no`, `parent_published_version_id`, and rack `state` remain hidden or only partially surfaced, which is acceptable for now but leaves future lineage/history decisions open.

## Immediate Follow-ups

1. Decide later whether lineage/history metadata should be surfaced in dedicated summary/history contracts.
