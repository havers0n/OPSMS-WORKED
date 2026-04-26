# ADR-0002: Storage presets are backend-canonical

## Status

Accepted

## Context

Storage presets drive container creation and stock materialization.
Mixing UI-only math with DB logic creates inconsistent quantity and placement behavior.

## Decision

Storage presets are resolved through backend canonical sources:

- preset resolution and validation happen in BFF + DB functions
- quantity/materialization follows validated profile hierarchy
- frontend renders snapshot results only (usage/materialization status included)

## Consequences

- `create_container_from_storage_preset` is the single write path for preset-based container creation.
- UI cannot bypass backend resolution by computing preset result locally.
- Tests must cover partial success (`shell` + `materialization failed`) and full success cases.
