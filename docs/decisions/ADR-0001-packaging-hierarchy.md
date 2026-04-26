# ADR-0001: Packaging hierarchy quantities are cumulative

## Status

Accepted

## Context

Products can define packaging at multiple levels (base, box, master, pallet).
Display and plan-calculation cannot use a flat `qty` value from a single level; they must follow parent relationships.

## Decision

All packaging calculations in canonical inventory and storage flows are cumulative through hierarchy:

- parent quantity = child quantity × qty per parent link.

## Consequences

- UI must use canonical quantities from BFF/DB, not manual math.
- Storage preset validation and materialization must use resolved hierarchy values.
- New regression cases include nested examples before merge (`box=2, master=4` => `master=8`).
