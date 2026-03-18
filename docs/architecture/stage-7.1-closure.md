# Stage 7.1 — Security Hardening Patch — Closure Note

Closed: 2026-03-17
Migration: `0044_security_definer_hardening.sql`
Test file: `tests/sql/0044_security_hardening.test.sql`
SQL suite: 17 / 17 PASS

---

## What was the problem

Stage 7 introduced five execution RPCs that ran as SECURITY DEFINER but were
missing the authorization infrastructure that SECURITY DEFINER requires.

Specifically:

1. **Caller-controlled actor identity.**
   All five functions accepted an `actor_uuid` parameter and used it verbatim as
   the audit identity written to `created_by` / `updated_by`. An authenticated
   caller could pass any UUID — including a UUID belonging to another user or a
   non-existent user — and that UUID would appear in the audit trail.

2. **Missing inline authorization gate on SECURITY DEFINER paths.**
   SECURITY DEFINER bypasses RLS. The functions that became SECURITY DEFINER
   inherited no row-level filtering for the caller's tenant after that change.
   A caller with a valid JWT but no membership in the target tenant could invoke
   the function and operate on rows belonging to a different tenant.

3. **UUID existence oracle.**
   `move_container_canonical` raised `TENANT_MISMATCH` or `LOCATION_NOT_FOUND`
   depending on whether the target location existed. `split_inventory_unit`
   raised `TARGET_CONTAINER_TENANT_MISMATCH` when the target container existed
   but belonged to another tenant. These distinct error strings told an
   unauthenticated attacker whether a given UUID existed in the database.

4. **Direct helper call permitted.**
   `insert_stock_movement` and `sync_container_placement_projection` had
   `GRANT EXECUTE … TO authenticated` from their original migrations. Any
   authenticated user could call them directly with arbitrary arguments,
   bypassing all the validation and authorization logic in the outer RPCs.

5. **remove_container read placement from `container_placements`.**
   `container_placements` is a geometry/rack projection table, not the canonical
   source of truth for current container location. A container moved to a
   non-rack location has no `container_placements` row, so `remove_container`
   would incorrectly report `CONTAINER_NOT_PLACED` for a container that actually
   had a valid `current_location_id`.

---

## What changed

### `move_container_canonical` → SECURITY DEFINER

- First executable statement overrides `actor_uuid := auth.uid()`.
- Container row is locked with `WHERE … AND public.can_manage_tenant(tenant_id)`.
  A call that fails authorization and a call for a non-existent UUID both fall
  through the same `if container_row.id is null then raise CONTAINER_NOT_FOUND`.
  The oracle is closed.
- `TENANT_MISMATCH` and `LOCATION_NOT_FOUND` are remapped to
  `TARGET_LOCATION_NOT_FOUND` before surfacing to the caller.
- `set search_path = public` guards against search-path injection.

### `split_inventory_unit` → SECURITY DEFINER

- First executable statement overrides `actor_uuid := auth.uid()`.
- Source IU locked with inline `can_manage_tenant` gate.
- `TARGET_CONTAINER_TENANT_MISMATCH` remapped to `TARGET_CONTAINER_NOT_FOUND`.

### `transfer_inventory_unit` → SECURITY DEFINER

- First executable statement overrides `actor_uuid := auth.uid()`.
- `occurred_at_utc` captured from split result and reused for the transfer
  movement so both movements share an atomic timestamp.

### `pick_partial_inventory_unit` → SECURITY DEFINER

- First executable statement overrides `actor_uuid := auth.uid()`.
- Same `occurred_at_utc` reuse pattern as transfer.

### `remove_container` — stays INVOKER, rewritten for canonical truth

- INVOKER is correct: the function needs no elevated privilege beyond what the
  calling session already holds.
- Authorization gate added: `WHERE … AND public.can_manage_tenant(tenant_id)`.
- Derives placement from `containers.current_location_id`, not from
  `container_placements` rows.
- Handles both rack-backed locations (closes placement projection row, returns
  `cellId`) and non-rack locations (no projection row to close, returns
  `cellId: null`).
- Hard guard: if `current_location_id` is set but the `locations` row is missing,
  raises `CURRENT_LOCATION_NOT_FOUND` instead of silently succeeding or producing
  a NULL floor_id.

### Helper revocations

```sql
revoke execute on function public.insert_stock_movement(...) from authenticated;
revoke execute on function public.sync_container_placement_projection(uuid, uuid)
  from authenticated;
```

These helpers are now internal-only. Authenticated users receive
`permission denied` when attempting direct calls.

---

## Claims that are now true

| Claim | Evidence |
|-------|----------|
| Caller-supplied `actor_uuid` cannot influence audit identity | `actor_uuid := auth.uid()` is the first executable statement in all five functions; SP-1, SP-2, SP-3 |
| Cross-tenant container UUID returns the same error as a non-existent UUID | Inline `can_manage_tenant` gate inside `SELECT … FOR UPDATE`; NF-1 |
| Cross-tenant target location is masked as `TARGET_LOCATION_NOT_FOUND` | Oracle remapping in `move_container_canonical`; CT-4 |
| Cross-tenant target container is masked as `TARGET_CONTAINER_NOT_FOUND` | Oracle remapping in `split_inventory_unit`; CT-3 |
| Authenticated role cannot call helper functions directly | `REVOKE EXECUTE` in 0044; DH-1, DH-2 |
| `remove_container` uses `current_location_id` as canonical truth | Rewrote function body; CR-1, CR-2, CR-3 |
| `remove_container` works correctly for non-rack locations | `geometry_slot_id` check, no placement projection required; CR-2 |
| Split and its wrapping transfer/pick share one atomic timestamp | `occurred_at_utc` captured from split result and reused; TS-1, TS-2 |
| Full SQL test suite is green | 17 / 17 PASS |

---

## What was consciously left deferred

### `place_container` and `move_container` (cell-based legacy) stay INVOKER

These are Stage 7 compatibility facades. They operate under the caller's session
RLS and do not write `stock_movements`. Their fate is a Stage 8 decision
(see removal matrix). No new first-party code should start from these paths.

### `place_container_at_location(uuid, uuid, uuid)` does not exist yet

Initial placement into non-rack locations currently requires a direct
`UPDATE containers SET current_location_id = …` from a trusted context (e.g.,
a superuser migration or a test fixture). A public `place_container_at_location`
RPC is logged in the Stage 8 backlog.

### place / remove do not yet write `stock_movements`

`place_container` and `remove_container` write `movement_events` (legacy
compatibility table). They do not write canonical `stock_movements`. This is
acceptable while those paths remain compatibility facades but must be addressed
before Stage 8 promotes them to first-class status.

### `container_placements` projection asymmetry is accepted

`place_container` into a rack cell writes a `container_placements` row.
`remove_container` from a non-rack location has no placement row to close.
This is correct by design: the projection exists only for rack/canvas geometry
consumers. The asymmetry is documented; no code treats the absence of a
projection row as "not placed."

### `inventory_item_compat_v` still unions legacy items

The canonical storage snapshot (`container_storage_snapshot_v`,
`location_storage_snapshot_v`) still unions `inventory_unit` with legacy
`inventory_items` rows through `inventory_item_compat_v`. Removing this union
requires all legacy inventory items to be migrated, which is a separate Stage 8
item.
