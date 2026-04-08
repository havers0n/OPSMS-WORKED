# Layout BFF ↔ SQL Boundary Audit

## 1. Executive Verdict

- Правильно уже сделано следующее: SQL держит нормализованную structural model, publish как транзакционный server-side use case, cell generation как derived artifact, location sync как publish-side projection, и ключевые invariants через FK/unique/check/trigger constraints ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):951, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2391, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2689, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3507, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5458, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):6194).
- Главный architectural debt не в SQL model, а в boundary: BFF почти ничего не моделирует поверх RPC, frontend/BFF contract остаётся coarse snapshot, а lifecycle/geometry/structure distinctions уже есть в UI и SQL, но почти не выражены в server contract ([apps/bff/src/features/layout/service.ts](apps/bff/src/features/layout/service.ts):11, [apps/bff/src/features/layout/repo.ts](apps/bff/src/features/layout/repo.ts):329, [apps/bff/src/schemas.ts](apps/bff/src/schemas.ts):166).
- RPC не надо “выносить в код” ради моды. Выносить в app code publish serialization, DB-backed structural invariants, cell regeneration, location remap и mirror/tree consistency было бы регрессией.
- `save` не надо ломать на many commands прямо сейчас. Правильный шаг: оставить snapshot save как persistence primitive, но немедленно ввести typed domain split в BFF, вернуть `draftVersion` в contract, добавить changeset classification и нормальное ownership validation/publish.

## 2. Current Server Model

### Normalized SQL entities

- `layout_versions` хранит lifecycle version entity: `state`, `version_no`, `parent_published_version_id`, `published_at`, `archived_at`, `draft_version`; один draft и один published на floor enforced partial unique indexes ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4960, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5886).
- `racks`, `rack_faces`, `rack_sections`, `rack_levels` выражают structural aggregate. Уникальности на `display_code`, `rack_id+side`, `face+ordinal`, `section+ordinal` и mirror consistency trigger enforceят topology, а не UI convention ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5294, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5347, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5690, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5706, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5714, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5730, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4410, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):6229).
- `cells` не являются authored draft content. Это derived structural artifact, regenerated from rack tree, with uniqueness on `(layout_version_id,address)` and `(layout_version_id,cell_code)`, plus tree consistency trigger ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2689, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5458, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5466, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5474, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3633, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):6194).
- `layout_zones` and `layout_walls` уже лежат как first-class geometry overlays, с own checks and uniqueness per version ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4981, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5006, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5554, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5570).
- `locations` это navigation/operations projection, не authored rack structure: код, type, capacity, optional `geometry_slot_id`, optional `floor_x/floor_y` for non-rack geometry, uniqueness on `(floor_id,code)` and unique `geometry_slot_id` ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4679, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5586, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5914).

### Real aggregates

- Draft aggregate today is effectively `LayoutVersion + racks/faces/sections/levels + zones + walls`; SQL bundle returns exactly that ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):1483).
- Published operational projection is `cells + locations`, generated from published structure, not edited directly on the layout save path ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2453, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2501, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3507).

### Lifecycle operations

- `create_layout_draft` is already a lifecycle use case, not CRUD. It enforces one-draft-per-floor, clones last published version, remaps IDs transactionally, preserves mirror links, and logs event metadata ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):951).
- `save_layout_draft` is a persistence rewrite of authored draft content with optimistic lock hook (`draft_version`) plus payload validation ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3080).
- `validate_layout_version` is a server semantic validation of persisted draft state, not a shape parse ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4015).
- `publish_layout_version` is the authoritative state transition and projection build ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2391).

### Derived artifacts

- `cells` are derived on publish and regenerated wholesale ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2453, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2700).
- `locations.geometry_slot_id` is updated from published cells via trigger and explicit publish upsert; this is downstream operational infrastructure, not draft authoring content ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2498, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3507, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):6348).

## 3. Current BFF Contract

### Bundle out

- `GET /api/floors/:floorId/layout-draft` and `GET /api/floors/:floorId/workspace` hydrate the editor with the full layout bundle via `get_layout_bundle` or table fallback ([apps/bff/src/app.ts](apps/bff/src/app.ts):952, [apps/bff/src/app.ts](apps/bff/src/app.ts):963, [apps/bff/src/features/layout/repo.ts](apps/bff/src/features/layout/repo.ts):135, [apps/bff/src/features/layout/repo.ts](apps/bff/src/features/layout/repo.ts):166).
- The RPC bundle includes `draftVersion`, but BFF mapper drops it, and the domain `LayoutDraft` type has no field for it ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):1504, [apps/bff/src/mappers.ts](apps/bff/src/mappers.ts):602, [packages/domain/src/layout/layout-draft.ts](packages/domain/src/layout/layout-draft.ts):7).
- Repo also strips `versionNo` from active/published draft payloads via `omitVersionNo`, so BFF deliberately reduces lifecycle metadata even further ([apps/bff/src/features/layout/repo.ts](apps/bff/src/features/layout/repo.ts):107, [apps/bff/src/features/layout/repo.ts](apps/bff/src/features/layout/repo.ts):258).

### Bundle in

- Frontend save payload is:

```ts
{
  layoutDraft: {
    layoutVersionId: string,
    racks: Rack[],
    zones: Zone[],
    walls: Wall[]
  }
}
```

  Proof: mapper and mutation do exactly that, no `draftVersion`, no command intent, no changeset metadata ([apps/web/src/features/layout-draft-save/api/mappers.ts](apps/web/src/features/layout-draft-save/api/mappers.ts):65, [apps/web/src/features/layout-draft-save/api/mutations.ts](apps/web/src/features/layout-draft-save/api/mutations.ts):5, [apps/bff/src/schemas.ts](apps/bff/src/schemas.ts):166).

### Validate/publish contract

- `POST /api/layout-drafts/:layoutVersionId/validate` and `POST /api/layout-drafts/:layoutVersionId/publish` are thin route wrappers over repo RPCs ([apps/bff/src/app.ts](apps/bff/src/app.ts):1015, [apps/bff/src/app.ts](apps/bff/src/app.ts):1026, [apps/bff/src/features/layout/service.ts](apps/bff/src/features/layout/service.ts):11).
- `publish` response carries `generatedCells` and nested validation; frontend then separately calls `createLayoutDraft` after publish, so lifecycle orchestration is split across DB publish and client follow-up ([apps/web/src/features/layout-publish/api/mutations.ts](apps/web/src/features/layout-publish/api/mutations.ts):4, [apps/web/src/features/layout-publish/model/use-publish-layout.ts](apps/web/src/features/layout-publish/model/use-publish-layout.ts):13).

### Where BFF is a thin wrapper

- Service layer adds no meaning at all; it forwards repo calls 1:1 ([apps/bff/src/features/layout/service.ts](apps/bff/src/features/layout/service.ts):11).
- Save route validates JSON shape, forwards to RPC, then throws away returned `draftVersion` and returns only `layoutVersionId` ([apps/bff/src/app.ts](apps/bff/src/app.ts):1004, [apps/bff/src/features/layout/repo.ts](apps/bff/src/features/layout/repo.ts):329).
- Error mapping does not understand `DRAFT_CONFLICT`; it maps only “not active draft” specially and otherwise collapses `P0001` to generic placement conflict text, which is the wrong boundary for layout save conflicts ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3104, [apps/bff/src/errors.ts](apps/bff/src/errors.ts):32).

### Where BFF already adds meaning

- It normalizes bundle hydration into domain `LayoutDraft` and published summary response ([apps/bff/src/mappers.ts](apps/bff/src/mappers.ts):598, [apps/bff/src/features/layout/repo.ts](apps/bff/src/features/layout/repo.ts):268).
- It exposes workspace as `activeDraft + latestPublished`, which is already a lifecycle-aware UI model ([apps/bff/src/app.ts](apps/bff/src/app.ts):963, [packages/domain/src/warehouse/floor-workspace.ts](packages/domain/src/warehouse/floor-workspace.ts):4).

## 4. Geometry / Structure / Lifecycle Mapping

| Concern | Current SQL model | Current BFF model | Current frontend contract | Problem | Needed target model |
| --- | --- | --- | --- | --- | --- |
| Geometry | `racks.x/y/axis/rotation_deg/depth/total_length`, `layout_zones`, `layout_walls`, non-rack `locations.floor_x/floor_y` ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4679, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4981, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5006, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5347) | Mixed into one `LayoutDraft` blob; no `LayoutGeometry*` types | UI clearly thinks in canvas geometry, walls, zones, rack positions | Boundary cannot classify geometry-only changes; all saves look identical | Add `LayoutGeometrySnapshot` or typed `geometry` subtree in BFF/domain contract |
| Structure | `racks`, `rack_faces`, `rack_sections`, `rack_levels`; derived `cells` ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2689, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5294, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5331) | Same `LayoutDraft` blob | Same `LayoutDraft` blob plus frontend structural cell keys ([apps/web/src/entities/cell/lib/cell-selection-key.ts](apps/web/src/entities/cell/lib/cell-selection-key.ts):4) | Authored structure and derived structure are conflated; cells leak into UI identity logic | Add explicit `LayoutStructureSnapshot`; keep `cells` outside authored snapshot |
| Lifecycle | `layout_versions.state/version_no/draft_version/published_at/parent_published_version_id`, RPC use cases ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4960, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):951, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2391, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3080) | Thin routes and workspace response; no explicit domain model for save conflict, draft freshness, publish readiness | UI has save/validate/publish toolbar flow; client manually saves before publish ([apps/web/src/widgets/app-shell/ui/top-bar.tsx](apps/web/src/widgets/app-shell/ui/top-bar.tsx):161) | Lifecycle semantics exist but are not first-class in BFF; `draftVersion` disappears | Add explicit `LayoutDraftState` / `LayoutLifecycleInfo` with `draftVersion`, validation status, publish readiness |
| Navigation / infrastructure | `locations`, occupancy views, container placement flows | Separate endpoints outside layout service | UI consumes published cells and locations as operational runtime data | Risk is mixing this with authoring domain | Keep outside layout-authoring contract; reference as runtime projections only |

## 5. Snapshot Save Analysis

### What current save actually does

- Locks the draft row via `FOR UPDATE`, optionally checks `draftVersion`, validates payload shape/semantic shape, deletes entire authored subtree, reinserts zones/walls/racks/faces/sections/levels, increments `draft_version`, emits event ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3084).
- This is a full-replace subtree contract. Not “patch”, not command bus.

### What is good about it

- Simplicity: one authored snapshot persists the complete draft.
- Determinism: server never merges partial rack-tree writes.
- Atomicity: one transaction rebuilds a coherent hierarchy.
- SQL-side validation is centralized.

### What it breaks

- Auditability: server sees only “whole tree replaced”, not “rack moved vs face mirrored vs wall renamed”.
- Change classification: impossible to know whether publish impact is geometry-only, structural, or lifecycle-neutral without extra diffing.
- Selective validation: current model validates full payload or full version; no cheap structural/geometry delta ownership.
- Conflict semantics: `draft_version` exists but contract drops it, so optimistic concurrency is effectively disabled at boundary ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3086, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3268, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):1508, [apps/bff/src/mappers.ts](apps/bff/src/mappers.ts):602, [apps/web/src/features/layout-draft-save/api/mappers.ts](apps/web/src/features/layout-draft-save/api/mappers.ts):65).
- Save/publish orchestration ambiguity: publish correctness currently depends on client remembering to save first; top bar comments explicitly admit that publish reads DB state, not current in-memory draft ([apps/web/src/widgets/app-shell/ui/top-bar.tsx](apps/web/src/widgets/app-shell/ui/top-bar.tsx):178).

### Is performance the main issue?

- Not yet, based on code alone. The stronger evidence is semantic opacity, not proven DB throughput collapse.

### Do we need granular commands now?

- No. The evidence supports a boundary redesign before command explosion.
- First changes should be:
  - restore typed lifecycle metadata including `draftVersion`
  - add BFF-side changeset classification over snapshot diff
  - make save response return updated draft meta
  - centralize publish orchestration in BFF/use-case layer instead of client choreography

## 6. Validation / Publish Ownership

### Validation ownership now

- Client pre-check exists in `validateLayoutDraft()` and is structurally close to server validation, but it is not authoritative ([packages/domain/src/layout/validate-layout.ts](packages/domain/src/layout/validate-layout.ts):19).
- Server authoritative validation is `validate_layout_version(layout_version_uuid)` over persisted draft rows ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4015).
- Save path also has payload validation via `validate_layout_payload(layout_payload)` before rewrite ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3114, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3741).

### Conflict today

- The same semantic rules are duplicated on client and server for racks/walls/address duplication.
- Client validation is useful UX, but publish still depends on server validation and persisted DB state.

### Target ownership

- Client: pre-check only, immediate editor feedback, optimistic “likely valid”.
- Server payload validation: shape + cross-reference sanity for authored snapshot.
- Server version validation: publish-readiness and all authoritative invariants over stored draft.
- Publish: must always re-run server validation; this part is already correct.

## 7. What Should Stay in SQL/RPC

- `create_layout_draft`: ID remap, clone semantics, one-draft-per-floor race safety ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):951, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5886).
- `publish_layout_version`: advisory lock by floor, compare-and-set draft guard, archive old published, persist publish metadata ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2424, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2482).
- `regenerate_layout_cells`: derived artifact generation from normalized structure ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2689).
- `sync_published_cell_to_location` and publish-time location upsert: infrastructure projection sync ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):2501, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3507).
- Structural consistency in DB: FK graph, uniqueness, face mirror trigger, cells tree trigger ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4410, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):3633, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5458, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5690, [apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):5714).
- Location integrity checks that depend on published geometry truth ([apps/supabase/replay_public_schema.sql](apps/supabase/replay_public_schema.sql):4167).

## 8. What Must Move Up Into BFF/Domain Layer

- Typed lifecycle contract:
  - `draftVersion`
  - `versionNo`
  - `publishedAt`
  - `parentPublishedVersionId`
  - save conflict status
- Typed authored split:
  - `LayoutStructureSnapshot`
  - `LayoutGeometrySnapshot`
  - `LayoutLifecycleInfo`
- BFF changeset classification:
  - geometry-only
  - structure-changing
  - publish-impacting
- Explicit use cases:
  - `saveDraftSnapshot`
  - `validateDraft`
  - `publishDraft`
  - `createDraftFromPublished`
- Orchestration:
  - “save before publish” should be a server/BFF use case, not a client footgun ([apps/web/src/widgets/app-shell/ui/top-bar.tsx](apps/web/src/widgets/app-shell/ui/top-bar.tsx):178).

## 9. Recommended Refactor Strategy

### Stage 1

- Keep current RPCs.
- Add `draftVersion` to domain `LayoutDraft`, BFF bundle mappers, save body schema, frontend save mapper, and save response.
- Stop dropping lifecycle metadata in repo/BFF (`omitVersionNo`, ignored `draftVersion`).
- Add explicit `DRAFT_CONFLICT` error mapping in BFF.
- Add BFF `saveDraft` response contract:
  - `layoutVersionId`
  - `draftVersion`
  - `changeClass`

### Stage 2

- Introduce boundary types in domain/BFF:
  - `LayoutStructureSnapshot`
  - `LayoutGeometrySnapshot`
  - `LayoutDraftMeta`
- Keep one snapshot endpoint but classify diff server-side:
  - moved rack / changed wall / changed zone => geometry
  - changed face/section/level/mirror/displayCode => structure
  - no content change but stale version => lifecycle/conflict
- Expose validation ownership explicitly:
  - `precheckValidation`
  - `persistedDraftValidation`
  - `publishReadiness`

### Stage 3

- Only if evidence appears that snapshot diffing is insufficient:
  - add explicit commands for a few high-value structural operations
  - examples: `moveRack`, `replaceFaceStructure`, `setMirrorFace`, `upsertWall`, `upsertZone`
- Do not add commands for everything.
- Do not command-ify `cells` or publish projection maintenance.

## 10. Final Recommendation

- Snapshot save should stay for now as the persistence primitive.
- Immediate changes to introduce:
  - lifecycle metadata in contract, especially `draftVersion`
  - explicit geometry / structure / lifecycle split in BFF/domain types
  - changeset classification in BFF over snapshot diff
  - authoritative validation ownership wording and APIs
  - publish orchestration moved out of the client click handler
- What would be a mistake too early:
  - exploding the model into many RPC commands before the boundary types exist
  - moving publish invariants/cell generation/location sync into app code
  - treating `cells` or `locations` as authored draft content

Bottom line:

- The DB is already carrying the right hard responsibilities.
- The weak point is the BFF/domain contract.
- Fix the boundary first.
- Keep snapshot save, but make it typed, conflict-aware, and classifiable.
