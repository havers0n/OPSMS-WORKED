# Legacy Route Removal Matrix

Stage 7 handoff artifact. Updated through Stage 10 PR6.

| Route | Who uses it now | First-party migrated? | External risk | Decision |
|---|---|---|---|---|
| `GET /api/cells/:cellId/containers` | No first-party callers. `useCellContainers` hook was dead (no imports). | Yes | None known | ✅ **Removed in Stage 8D** — route handler deleted from `app.ts`; `listCellContainers` gateway method deleted; dead web hook files deleted |
| `GET /api/cells/:cellId/storage` | No first-party callers. `useCellStorage` hook was dead (no imports). | Yes | None known | ✅ **Removed in Stage 8D** — route handler deleted from `app.ts`; `listCellStorage` gateway method deleted; dead web hook files deleted; dead query options pruned from `entities/cell/api/queries.ts` |
| `GET /api/floors/:floorId/cell-occupancy` | No first-party callers. `useFloorCellOccupancy` hook dead (deleted in Stage 8D). Route itself kept. | Yes | Unknown — floor-level occupancy is a plausible external polling target; no log evidence either way | **Keep** (compatibility-only) — no first-party callers; external risk unknown; do not remove until log evidence |
| `GET /api/rack-sections/:sectionId/slots/:slotNo/storage` | Active: `cellSlotStorageQueryOptions` → `useCellSlotStorage` → placement-mode rack inspector. | No — intentionally kept | None known | **Keep** — active first-party caller (editor slot-storage lookup); not a legacy surface |
| `POST /api/containers/:containerId/place` | No first-party callers. `usePlaceContainer` migrated to `POST /api/placement/place-at-location` in Stage 9 PR1. | Yes | Unknown — no log evidence available; `warn`-level log instrumented since Stage 10 PR2 but CF drain not configured | **Keep** — explicit external-only compatibility contract (Stage 10 PR4). Tandem with `place_container` SQL wrapper. Two pre-conditions before removal: (1) CF log drain evidence showing zero hits ≥ 30 days; (2) SQL test migration clearing 5 test files that call `place_container` directly. Neither is complete. |
| `POST /api/containers/:containerId/move` | No first-party callers. `useMoveContainer` migrated to `POST /api/containers/:containerId/move-to-location` in Stage 9 PR1. | Yes | Unknown — no log evidence; cannot rule out external callers | **Keep** (compatibility-only) — emits deprecation headers; translation via `legacy-execution-gateway` → `move_container_canonical`; not a supported first-party path; removal deferred pending log evidence |

## Notes

- Routes marked ✅ Removed are gone from `app.ts` and (where applicable) `legacy-execution-gateway/service.ts`.
- **Compatibility-only routes are not supported first-party paths.** They are retained solely because we cannot prove the absence of external callers. Presence in this table under "Keep" does not confer supported status.
- All kept compatibility-only routes emit `Deprecation: true`, `Warning: 299`, and `Link` headers via `gateway.applyDeprecationHeaders()`, and emit a `WARN`-level structured log entry with a `compatRoute` field (added Stage 10 PR2) to make future evidence collection tractable.
- `POST /api/containers/:containerId/move` delegates to `move_container_canonical` (location-based) via the legacy execution gateway, not to the cell-based `move_container` SQL function directly.
- `POST /api/containers/:containerId/place` calls the cell-based `place_container` SQL RPC directly; no location-bridge translation is performed. The canonical replacement is `POST /api/placement/place-at-location` → `place_container_at_location`.

## Removal pre-conditions per retained surface

**Runtime log access:** The BFF is a **Fastify/Node.js server** (not a Cloudflare Worker).
Pino writes structured JSON to Node.js process stdout at the level set by the `BFF_LOG_LEVEL`
environment variable (default: `'info'`, which passes WARN entries through).
The three compat routes emit `{ compatRoute: '...' }` WARN entries on every hit (Stage 10 PR2).
These are not queryable from the repository — stdout must be captured by the deployment's
process manager (PM2, Docker, systemd, etc.) and searchable with `jq` or a log platform.
See `docs/ops/compat-route-evidence-runbook.md` for exact query procedures.

### BFF routes — operational evidence required

All three retained compat routes emit `WARN`-level structured log entries. Search BFF
pino stdout logs for the `compatRoute` JSON field. Zero hits over ≥ 30 days = safe to remove.

| Route | Log key to search | Additional blocker |
|---|---|---|
| `GET /api/floors/:floorId/cell-occupancy` | `compatRoute: "floorCellOccupancy"` | None beyond log evidence |
| `POST /api/containers/:containerId/place` | `compatRoute: "containerPlaceByCell"` | **SQL test migration required** — see below |
| `POST /api/containers/:containerId/move` | `compatRoute: "containerMoveByCell"` | None beyond log evidence |

### SQL/RPC wrappers — status

| Function | Operational evidence needed | Engineering pre-condition | Status |
|---|---|---|---|
| `place_container(uuid, uuid, uuid)` | BFF pino stdout zero-hit check for `containerPlaceByCell` WARN entries + `pg_stat_user_functions` zero-delta check for direct `/rest/v1/rpc/place_container` calls | **SQL test migration** — 15 direct calls across 5 test files (0044, 0045, 0047, container_placement_actions, current_location_pivot, stock_movements) must be migrated to `place_container_at_location` or direct fixture inserts before the function can be dropped | **Retain** — explicit external-only compatibility contract |
| `move_container(uuid, uuid, uuid)` | ~~n/a~~ | ~~n/a~~ | ✅ **Dropped in Stage 10 PR3** — migration 0052 |
| `move_container_from_cell(uuid, uuid, uuid, uuid)` | ~~n/a~~ | ~~n/a~~ | ✅ **Dropped in Stage 10 PR3** — migration 0052 |
| `remove_container_if_in_cells(uuid, uuid[], uuid)` | ~~n/a~~ | ~~n/a~~ | ✅ **Dropped in Stage 10 PR2** — migration 0051 |

### Removal path for the `place_container` tandem

The BFF route and SQL wrapper are a tandem removal unit. The SQL wrapper is directly callable
via `/rest/v1/rpc/place_container` independently of the BFF route, so removing the route
alone does not eliminate the external surface. Both must be removed together.

The two pre-conditions are independent and can be worked in parallel:
1. **Operational** (no code change): verify BFF stdout is captured by the deployment process manager; observe `containerPlaceByCell` WARN log key for ≥ 30 days; confirm zero BFF hits. Also run pg_stat delta check for direct `/rest/v1/rpc/place_container` calls. See `docs/ops/compat-route-evidence-runbook.md` for exact procedures.
2. **Engineering** (separate PR): migrate the 5 SQL test files to stop calling `place_container` directly; use `place_container_at_location` with resolved location UUIDs or direct `UPDATE containers SET current_location_id = ...` for fixture setup; delete `0045_place_container_location_enforcement.test.sql` (tests the wrapper being dropped).

Until both pre-conditions are complete, neither the BFF route nor the SQL wrapper may be removed.

## Stage 10 PR5 — Operational Evidence Pass (2026-03-18)

**Scope:** Evidence inventory only. No code changes. No removals.

### Instrumentation status — confirmed in place

All three compat routes emit structured WARN-level log entries on every hit.
Confirmed in `apps/bff/src/app.ts`:

| Route | app.ts line | Log key | Deprecation headers |
|---|---|---|---|
| `GET /api/floors/:floorId/cell-occupancy` | 1172 | `compatRoute: 'floorCellOccupancy'` | ✅ via `gateway.applyDeprecationHeaders` |
| `POST /api/containers/:containerId/place` | 1440 | `compatRoute: 'containerPlaceByCell'` | ✅ via `gateway.applyDeprecationHeaders` |
| `POST /api/containers/:containerId/move` | 1514 | `compatRoute: 'containerMoveByCell'` | ✅ via `gateway.applyDeprecationHeaders` |

### Stdout capture — not confirmed

The BFF is a Fastify/Node.js server writing pino JSON to stdout. No deployment config
exists in the repository indicating where stdout is captured in production. Runtime
evidence is not accessible from the development environment.

**Runtime evidence is not accessible. The instrumentation exists and is correct, but the
stdout capture method is deployment-specific and unspecified in the repo. Unknown usage
remains unknown.** This is a pre-existing operational gap, not introduced by these PRs.

*(Note: PR5 incorrectly described the BFF as a "Cloudflare Worker" and the gap as a
"CF Worker log drain." Corrected in PR6 — see below.)*

### Route-by-route governance decision

| Route | Log key | Stdout captured | Runtime hits | Additional blocker | Removal candidate? |
|---|---|---|---|---|---|
| `GET /api/floors/:floorId/cell-occupancy` | `floorCellOccupancy` | ❓ Unknown | **Unknown** | None | No — operational blocker only; capture stdout first |
| `POST /api/containers/:containerId/move` | `containerMoveByCell` | ❓ Unknown | **Unknown** | None | No — operational blocker only; capture stdout first |
| `POST /api/containers/:containerId/place` | `containerPlaceByCell` | ❓ Unknown | **Unknown** | **SQL test migration** — 15 calls across 5 files | No — **two independent blockers**; log evidence alone is not sufficient |

### Separation of the place tandem from the simpler routes

`GET /api/floors/:floorId/cell-occupancy` and `POST /api/containers/:containerId/move`
carry a **single blocker** — operational evidence — that is fully resolved by verifying
BFF stdout capture and observing zero hits over ≥ 30 days. No code changes are required.

`POST /api/containers/:containerId/place` carries **two independent blockers**. Even with
perfect log evidence confirming zero external BFF calls, the SQL wrapper
`public.place_container(uuid, uuid, uuid)` remains independently callable via
`/rest/v1/rpc/place_container`, and its 15 SQL test callers across 5 test domains must be
migrated before the function can be dropped. Log evidence alone does not unblock removal
of the place tandem.

These two groups must not be collapsed into a single "pending log evidence" bucket.

### Next removal candidate

If BFF stdout is captured and zero `compatRoute: "floorCellOccupancy"` hits are observed
over ≥ 30 days, `GET /api/floors/:floorId/cell-occupancy` becomes the cleanest removal:
delete route handler from `app.ts`, delete `listFloorCellOccupancy` gateway method, remove
its entry from `LEGACY_ROUTE_METADATA`, update this doc. No SQL wrapper involved.

### What changed in PR5

- [x] Confirmed instrumentation correct in `app.ts` (lines 1172, 1440, 1514)
- [x] Confirmed no deployment config exists in repository
- [x] Produced route-by-route evidence table with explicit "Unknown" classification
- [x] Separated single-blocker routes from the two-blocker place tandem
- [x] Identified `GET /api/floors/:floorId/cell-occupancy` as next removal candidate
- [x] `legacy-route-removal-matrix.md` header updated to PR5
- [x] `storage-core-convergence-checklist.md` Stage 10 PR5 section added

---

## Stage 10 PR6 — Observability Enablement and Evidence Collection Runbook (2026-03-18)

**Scope:** Docs and factual corrections only. No code changes. No removals.

### Architectural correction — BFF is Fastify/Node.js, not a Cloudflare Worker

Prior PRs (PR2–PR5) incorrectly described the BFF as a "Cloudflare Worker" requiring
a "CF Worker log drain." This was factually wrong. The actual runtime:

- **Runtime**: Fastify 5 on Node.js, started via `tsx watch src/server.ts` (dev) or
  compiled Node.js entrypoint (prod). No `wrangler`, no CF Worker SDK, no CF deployment
  config anywhere in the repository.
- **Logging**: Fastify built-in pino integration, JSON to **Node.js process stdout**.
- **Log level**: `BFF_LOG_LEVEL` env var, defaults to `'info'`. Pino at `info` level emits
  all entries at `info(30)` and above — WARN entries (`warn = 40`) are emitted by default.
  If `BFF_LOG_LEVEL=error` is set in the deployment, WARN entries are suppressed.
- **Stdout destination**: Process manager / container runtime (PM2, Docker, systemd, etc.)
  — not specifiable from within the repository.

**The instrumentation is correct and is already emitting WARN entries in production.**
The gap is not a missing drain configuration — it is that stdout capture is
deployment-environment-specific and unverified from this codebase.

References to "CF Worker log drain", "tail_consumers", `wrangler.toml`, and
"Cloudflare Worker stdout" in prior PR sections of this document have been corrected
in-place above where they appeared in structural sections (Notes, pre-conditions tables).
The historical PR narrative sections are not retroactively rewritten.

### Available log signals — confirmed

Two independent signals are already in place (no code changes needed):

**Signal 1 — WARN `compatRoute` entry** (compat-route-specific, emitted per hit):
- Field: `compatRoute` with values `floorCellOccupancy`, `containerPlaceByCell`, `containerMoveByCell`
- Source: `app.ts` lines 1172, 1440, 1514
- Requires `BFF_LOG_LEVEL` ≤ `warn` (default `info` satisfies this)

**Signal 2 — INFO `onResponse` entry** (all routes, emitted per request):
- Field: `route` with values `/api/floors/:floorId/cell-occupancy` etc.
- Source: `app.ts` lines 873–882
- Requires `BFF_LOG_LEVEL` ≤ `info` (default satisfies this; suppressed at `warn`)

Signal 1 is the primary evidence signal. Signal 2 is a fallback.

### Observability feasibility assessment

| Task | Feasible from repo? | Notes |
|---|---|---|
| Add `compatRoute` WARN logging | ✅ Already done (PR2) | No change needed |
| Add `onResponse` INFO logging | ✅ Already done | No change needed |
| Control `BFF_LOG_LEVEL` | ✅ Via env var | Deployment owner must verify it is not `error` |
| Configure stdout capture / retention | ❌ Deployment environment only | PM2/Docker/systemd — outside repo |
| Stand up log aggregation platform | ❌ Infrastructure work | Outside repo scope |
| Query `pg_stat_user_functions` | ❌ Requires production DB access | Supabase admin — outside repo |
| Provide runbook docs | ✅ Done in PR6 | `docs/ops/compat-route-evidence-runbook.md` |

### Runbook location

`docs/ops/compat-route-evidence-runbook.md` — created in PR6.

Covers:
- Runtime architecture correction (Fastify/Node.js pino stdout)
- How to verify stdout capture is working
- jq queries for each compat route (Signal 1 and Signal 2)
- Docker, PM2, journald, and log-file variants
- pg_stat_user_functions delta query for `place_container`
- Evidence thresholds (proven unused / proven used / still unknown)
- Explicit group separation: single-blocker vs dual-blocker routes
- What to record before opening PR7

### What changed in PR6

- [x] `docs/ops/compat-route-evidence-runbook.md` — created; full operational runbook
- [x] `legacy-route-removal-matrix.md` — corrected "Cloudflare Worker" / "CF drain"
  language in Notes, pre-conditions, and tandem removal sections; header updated to PR6
- [x] `storage-core-convergence-checklist.md` — corrected same factual errors;
  Stage 10 PR6 section added
- [x] No code changes — instrumentation was already correct

---

## Cell-based placement service routes (separate from legacy gateway)

Stage 9 PR1 migrated all first-party web callers. Stage 9 PR2 removed routes, handlers, and dead type surface.

| Route | Previous web caller | RPC called | Stage 9 PR2 outcome |
|---|---|---|---|
| `POST /api/placement/place` | `usePlaceContainer` → migrated to `POST /api/placement/place-at-location` | `place_container(cell_uuid, actor_uuid)` | ✅ **Removed in Stage 9 PR2** — route deleted from `app.ts`; `place-container.ts` command handler deleted; `PlaceContainerRequest` / `placeContainerRequestSchema` deleted from `@wos/domain` |
| `POST /api/placement/remove` | `useRemoveContainer` → migrated to `POST /api/containers/:id/remove` | `remove_container_if_in_cells(cell_ids[])` | ✅ **Removed in Stage 9 PR2** — route deleted; `remove-container.ts` deleted; `RemoveContainerRequest` / `removeContainerRequestSchema` deleted from `@wos/domain`. SQL wrapper `remove_container_if_in_cells` subsequently ✅ **dropped in Stage 10 PR2** (migration 0051) |
| `POST /api/placement/move` | `useMoveContainer` → migrated to `POST /api/containers/:id/move-to-location` | `move_container_from_cell(container, src, tgt)` | ✅ **Removed in Stage 9 PR2** — route deleted; `move-container.ts` deleted; `MoveContainerRequest` / `moveContainerRequestSchema` deleted from `@wos/domain`. SQL wrappers `move_container_from_cell` and `move_container` subsequently ✅ **dropped in Stage 10 PR3** (migration 0052) |
