# Compat Route Evidence Runbook

Stage 10 PR6 artifact. Created 2026-03-18.

This runbook enables an ops/infra owner to collect the runtime evidence required before
any compatibility-only BFF route can be considered a removal candidate. It is the
authoritative procedure document for Stage 10 PR7 evidence pre-conditions.

---

## Runtime architecture — Fastify/Node.js pino stdout

The BFF (`apps/bff`) is a **Fastify 5 application running on Node.js**, started via
`tsx watch src/server.ts` (development) or a compiled Node.js entrypoint (production).
It is **not** a Cloudflare Worker and has no Cloudflare-specific deployment config.

Logging uses Fastify's built-in pino integration. Every log entry is written as a
JSON object to **Node.js process stdout**. There is no in-process log sink, no
database write, and no network transport from within the application itself. Where
that stdout goes in production depends entirely on the process manager or container
runtime the deployment uses (PM2, Docker, systemd, etc.).

The log level is controlled by the `BFF_LOG_LEVEL` environment variable:

```
BFF_LOG_LEVEL=info   # default — emits trace < debug < info < warn < error < fatal
BFF_LOG_LEVEL=warn   # emits warn, error, fatal only
BFF_LOG_LEVEL=error  # emits error, fatal only
```

**Important:** compat route WARN entries are only emitted when `BFF_LOG_LEVEL` is
`warn` or lower (i.e. `info`, `debug`, `trace`, or `warn`). If the deployment has
`BFF_LOG_LEVEL=error`, the compat WARN entries are suppressed. Verify the level before
trusting a zero-hit count.

---

## Available log signals

Two independent log signals exist for each compat route. Both are emitted by the
running app today. No code changes are required.

### Signal 1 — WARN `compatRoute` entry (compat-route-specific)

Emitted by each compat route handler before execution. One entry per request.

```json
{
  "level": 40,
  "time": 1742300000000,
  "service": "@wos/bff",
  "compatRoute": "floorCellOccupancy",
  "path": "/api/floors/abc123/cell-occupancy",
  "msg": "compat route accessed — no first-party callers since Stage 8D; pending removal pending log-evidence review"
}
```

Field to query: `compatRoute`

| Route | `compatRoute` value |
|---|---|
| `GET /api/floors/:floorId/cell-occupancy` | `floorCellOccupancy` |
| `POST /api/containers/:containerId/place` | `containerPlaceByCell` |
| `POST /api/containers/:containerId/move` | `containerMoveByCell` |

Source: `apps/bff/src/app.ts` lines 1172, 1440, 1514.

### Signal 2 — INFO `onResponse` entry (all routes)

Emitted by the `onResponse` hook for every completed request. One entry per request.
Queryable even if `BFF_LOG_LEVEL=warn` is set (wait — this is INFO, so it would be
suppressed at `warn` level). At `BFF_LOG_LEVEL=info` (default), both signals are active.

```json
{
  "level": 30,
  "time": 1742300000000,
  "service": "@wos/bff",
  "route": "/api/floors/:floorId/cell-occupancy",
  "method": "GET",
  "statusCode": 200,
  "responseTimeMs": 42.1,
  "msg": "request completed"
}
```

Field to query: `route` (note: this is the route pattern, not the resolved URL path)

| Route | `route` value to search |
|---|---|
| `GET /api/floors/:floorId/cell-occupancy` | `/api/floors/:floorId/cell-occupancy` |
| `POST /api/containers/:containerId/place` | `/api/containers/:containerId/place` |
| `POST /api/containers/:containerId/move` | `/api/containers/:containerId/move` |

Source: `apps/bff/src/app.ts` lines 873–882.

**Signal 1 is preferred** for compat-route evidence because it is specific to compat
routes and carries semantic intent. Signal 2 is a fallback if the WARN level was raised.
If Signal 2 shows hits but Signal 1 does not, check `BFF_LOG_LEVEL` in the deployment.

---

## Step 1 — Verify stdout capture is working

Before trusting any evidence, confirm that BFF stdout is being collected and retained.

**Check 1: send a known request and find its log entry**

```bash
# From inside or adjacent to the BFF deployment:
curl -s http://<bff-host>:<port>/health

# In the log stream, look for:
# { "route": "/health", "method": "GET", "statusCode": 200, "msg": "request completed" }
```

If you cannot find `/health` entries in the log stream, stdout is not being captured.
Do not proceed to compat evidence collection — fix the log capture first.

**Check 2: confirm log level**

```bash
# In the deployment environment, check:
echo $BFF_LOG_LEVEL
# Expected: "info" or "warn" or empty (defaults to "info")
# If "error" or "fatal": compat WARN and INFO entries are suppressed
```

---

## Step 2 — Establish a baseline call count

Because there is no timestamp filter inside the log entries themselves (only `time`
in Unix ms), evidence collection requires:

1. Record the start timestamp (t₀) when you begin the observation window
2. Note the current cumulative hit count from existing logs (may be non-zero if logs
   have been accumulating)
3. Return at t₀ + 30 days and count hits between t₀ and t₀ + 30d

All three query sections below assume logs are written to a file or stream that
supports `jq`. Adapt for your log aggregation platform (Loki, Datadog, CloudWatch,
etc.) using the same field names.

---

## Step 3 — Query compat route hits

### 3a. Using jq on a log file

```bash
# Count all compat route hits in the log file:
jq -r 'select(.compatRoute != null) | .compatRoute' /var/log/wos-bff.log | sort | uniq -c

# Count hits for a specific route:
jq 'select(.compatRoute == "floorCellOccupancy")' /var/log/wos-bff.log | wc -l
jq 'select(.compatRoute == "containerPlaceByCell")' /var/log/wos-bff.log | wc -l
jq 'select(.compatRoute == "containerMoveByCell")' /var/log/wos-bff.log | wc -l

# Count hits within an observation window (Unix ms timestamps):
# Replace 1742300000000 and 1744892000000 with actual t₀ and t₀+30d:
jq 'select(.compatRoute == "floorCellOccupancy" and .time >= 1742300000000 and .time <= 1744892000000)' \
  /var/log/wos-bff.log | wc -l
```

### 3b. Using Signal 2 (onResponse) as fallback

```bash
# Count all requests to compat routes by route pattern:
jq -r 'select(.route != null) | .route' /var/log/wos-bff.log \
  | grep -E '/api/floors/:[^/]+/cell-occupancy|/api/containers/:[^/]+/place|/api/containers/:[^/]+/move$' \
  | sort | uniq -c

# Or with exact field match:
jq 'select(.route == "/api/floors/:floorId/cell-occupancy")' /var/log/wos-bff.log | wc -l
jq 'select(.route == "/api/containers/:containerId/place")' /var/log/wos-bff.log | wc -l
jq 'select(.route == "/api/containers/:containerId/move")' /var/log/wos-bff.log | wc -l
```

### 3c. Using Docker logs

```bash
# Stream and filter in real time:
docker logs --follow <bff-container> 2>&1 | grep '"compatRoute"'

# Query historical logs for a specific route:
docker logs --since "2026-03-18T00:00:00Z" --until "2026-04-18T00:00:00Z" <bff-container> 2>&1 \
  | jq -c 'select(.compatRoute == "floorCellOccupancy")' | wc -l
```

### 3d. Using PM2

```bash
# PM2 log file location (default):
cat ~/.pm2/logs/wos-bff-out.log | jq 'select(.compatRoute != null)' | wc -l

# Or via pm2 logs (streamed, not filterable historically):
pm2 logs wos-bff --raw | grep '"compatRoute"'
```

### 3e. Using journald (systemd)

```bash
# All compat route entries since a specific date:
journalctl -u wos-bff --since "2026-03-18" --until "2026-04-18" --output=cat \
  | jq 'select(.compatRoute != null)'

# Count by route:
journalctl -u wos-bff --since "2026-03-18" --output=cat \
  | jq -r 'select(.compatRoute != null) | .compatRoute' | sort | uniq -c
```

---

## Step 4 — Query direct SQL RPC calls to `place_container`

**This step applies only to `POST /api/containers/:containerId/place`.**

The SQL wrapper `public.place_container(uuid, uuid, uuid)` is independently callable
via Supabase REST at `/rest/v1/rpc/place_container`, bypassing the BFF entirely.
A zero BFF log count is necessary but not sufficient to remove the tandem. Direct RPC
calls must also be verified as zero.

Run this query in the Supabase project SQL editor (requires production DB access with
a service role or postgres role):

```sql
-- Note the current call count:
SELECT
  schemaname,
  funcname,
  calls,
  total_time,
  self_time
FROM pg_stat_user_functions
WHERE schemaname = 'public'
  AND funcname = 'place_container';
```

Record the `calls` value at t₀. Return at t₀ + 30 days and run again. If the delta
is zero, no direct SQL RPC calls were made in that window.

**Important caveats:**
- `pg_stat_user_functions` requires `track_functions = 'pl'` or `'all'` in
  `postgresql.conf`. Supabase enables PL/pgSQL tracking by default.
- Stats are reset by `pg_stat_reset()` or server restart. If either occurred between
  t₀ and t₀ + 30d, the delta is invalid.
- The `calls` counter is cumulative since the last stats reset, not since deployment.
  Always use delta (count at t₀+30d minus count at t₀), not the raw value.

---

## Step 5 — Evidence thresholds and governance outcomes

### Single-blocker routes (operational evidence only)

These routes have only one pre-condition before removal: operational evidence.

| Route | `compatRoute` key | Removal candidate if... |
|---|---|---|
| `GET /api/floors/:floorId/cell-occupancy` | `floorCellOccupancy` | Zero hits over ≥ 30 days, log capture verified |
| `POST /api/containers/:containerId/move` | `containerMoveByCell` | Zero hits over ≥ 30 days, log capture verified |

**Evidence classification:**

| Observed result | Classification | Next action |
|---|---|---|
| Zero WARN hits, log capture confirmed working, ≥ 30 days | **Proven unused** | Open PR7 for removal |
| One or more WARN hits in any 30-day period | **Proven used** | Retain; record hit count and any available caller origin in docs; re-evaluate at next stage |
| Zero WARN hits, but log capture not verified | **Still unknown** | Fix log capture; restart observation window |
| Observation window < 30 days | **Insufficient** | Extend window; do not advance to PR7 |

### Dual-blocker route — `POST /api/containers/:containerId/place`

This route has **two independent pre-conditions**, both must be met before removal.
Meeting only one does not unblock the PR.

**Pre-condition 1 — Operational (BFF route + SQL RPC):**
- Zero `containerPlaceByCell` WARN hits in BFF logs over ≥ 30 days (log capture verified)
- AND zero delta on `pg_stat_user_functions.calls` for `place_container` over same window

**Pre-condition 2 — Engineering (SQL test migration, separate PR):**
- All 5 SQL test files migrated away from `place_container`:
  - `0044_security_hardening.test.sql` — 4 calls (fixture setup)
  - `0045_place_container_location_enforcement.test.sql` — 3 calls (subject under test; delete this file)
  - `0047_execution_history_convergence.test.sql` — 2 calls (mixed)
  - `container_placement_actions.test.sql` — 2 calls (subject under test)
  - `current_location_pivot.test.sql` — 2 calls (fixture setup)
  - `stock_movements.test.sql` — 2 calls (fixture setup)

**Both pre-conditions must be complete before removal PR.** They are independent and
may be worked in parallel, but neither alone is sufficient.

---

## Step 6 — Reporting evidence to PR7

When evidence collection is complete, record the following in
`docs/architecture/legacy-route-removal-matrix.md` before opening PR7:

```
For each compat route being removed:
- observation start date (t₀)
- observation end date (t₀ + N days)
- signal used (Signal 1 / Signal 2 / both)
- hit count over the window
- log capture verification method
- BFF_LOG_LEVEL in deployment during window
- (place route only) pg_stat delta for place_container
- (place route only) SQL test migration PR reference
```

---

## Separation of routes — explicit governance boundary

These two groups must not be collapsed for governance purposes:

**Group A — single-blocker (operational only):**
- `GET /api/floors/:floorId/cell-occupancy`
- `POST /api/containers/:containerId/move`

If log evidence is zero for 30+ days on Group A, PR7 may remove them independently
without waiting for the place tandem.

**Group B — dual-blocker:**
- `POST /api/containers/:containerId/place` (+ `public.place_container` SQL wrapper)

Even if Group A is cleared, Group B requires both pre-conditions. PR7 may remove
Group A without touching Group B if only Group A evidence is ready.

---

## Quick reference — jq one-liners

```bash
# All compat route hit counts (tallied):
cat /path/to/bff.log | jq -r 'select(.compatRoute) | .compatRoute' | sort | uniq -c

# Zero-check for a specific route over a date-bounded window:
cat /path/to/bff.log \
  | jq --argjson t0 1742300000000 --argjson t1 1744892000000 \
    'select(.compatRoute == "floorCellOccupancy" and .time >= $t0 and .time <= $t1)' \
  | wc -l

# Verify log capture is working (should return > 0 for any active deployment):
cat /path/to/bff.log | jq 'select(.msg == "request completed")' | wc -l

# pg_stat query for place_container (run in Supabase SQL editor):
# SELECT funcname, calls FROM pg_stat_user_functions
# WHERE schemaname = 'public' AND funcname = 'place_container';
```
