# Manual Shift Control

## Purpose
- Manual Shift Control is a manual operational log / dispatcher tool for shift management.
- It is intended for the approved Operator Mobile V2 interface and its later isolated app route at `/operator/manual`.
- It is not canonical WOS order execution.

## Hard Domain Boundary
- Manual Shift Control must not touch or reinterpret:
  - canonical `orders`
  - `orders.status`
  - `pick_tasks`
  - `waves`
  - warehouse editor, map, routing, storage, or inventory logic
- Manual shift orders are their own persistence model and must not become canonical order stubs.

## Core Manual Model
- `ManualShiftSession`
  - tenant-scoped shift session for a local operational date
  - status: `active | closed`
- `ManualShiftLine`
  - a manual Kav / line inside a shift
  - status: `open | in_progress | done`
  - should be derived from contained manual orders when possible
- `ManualShiftOrder`
  - a manually tracked operational order record
  - status: `queued | picking | waiting_check | returned | done`
- `ManualShiftOrderEvent`
  - append-only operational log for status changes and other actions
- `ManualShiftOrderError`
  - quality / checking issue captured against a manual order

## Route Target
- The target isolated route for later UI integration is `/operator/manual`.
- The approved mobile UI should be integrated approximately as-is:
  - mobile-first layout
  - bottom navigation
  - Queue / Check / People / Day screens
  - large order cards
  - large OK / Error actions
  - touch-friendly manual dispatcher flows

## Status Semantics
### Shift status
- `active`: the local shift session is open for manual operations
- `closed`: the session is finished and should become read-only except for later admin tooling

### Line status
- `open`: no manual orders exist yet, or all contained manual orders are still `queued`
- `in_progress`: line contains at least one non-terminal manual order
- `done`: all contained manual orders are `done`

### Manual order status
- `queued`: order exists in manual queue and has not started picking
- `picking`: operator has started handling the order
- `waiting_check`: order is waiting for QC / check decision
- `returned`: order failed check and was returned for correction
- `done`: manual shift-control flow is complete for this order

## Allowed Manual Order Transitions
- `queued -> picking`
- `picking -> waiting_check`
- `waiting_check -> done`
- `waiting_check -> returned`
- `returned -> waiting_check`

Disallowed in MVP:
- `returned -> done`
- any transition out of `done`
- any skip over intermediate statuses not listed above

Each future persisted transition is expected to:
- update the order status
- update the relevant timestamp
- create a `ManualShiftOrderEvent`

## Picker and Checker Identity
- For MVP, `pickerName` and `checkerName` are free-text strings.
- Manual Shift Control must not require user/profile linkage for these fields.
- Event records may later store actor name and/or actor profile id, but MVP manual order fields stay free-text.

## Size Rules
- `1–3 = S`
- `4–8 = M`
- `9–20 = L`
- `21+ = XL`
- missing or invalid line count = `unknown`

## Tenant-Local Date Assumption
- Shift `date` uses tenant-local calendar date semantics.
- Future DB/BFF implementation must avoid UTC-day confusion when resolving “today’s active shift”.
- Default assumption for PR2:
  - one active shift per tenant per local date

## Duplicate Order Numbers
- Duplicate manual order numbers are allowed in MVP.
- Future UI/backend may warn about duplicates within the same shift or line, but PR1 does not define hard rejection.
