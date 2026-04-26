# Architecture

## System shape

The repository is a TypeScript monorepo with three runtime layers:

1. **Frontend**: `apps/web`
2. **API/BFF**: `apps/bff` (Fastify + service/repo split + Supabase auth)
3. **Database**: `apps/supabase` with migrations and SQL functions/views
4. **Shared contracts**: `packages/domain`

## Data flow

```text
User action -> React UI -> BFF API client -> Fastify routes -> Domain services -> Supabase DB/RPC -> canonical rows/views -> BFF DTO -> UI
```

## Sources of truth

- **Canonical inventory/storage calculations**: DB views + DB functions (`apps/supabase/migrations`)
- **Domain contracts**: `packages/domain`
- **Presentation rules**: `apps/web` (formatting, controls, navigation)
- **Mutation constraints**: `apps/bff` service/repo + Supabase RLS/RPC

## Operational boundaries

- Frontend must not compute canonical storage quantities from raw `qty` fields.
- BFF validates and maps payloads and handles domain/service-level orchestration.
- DB migrations are the contract boundary for schema and business constraints.
- Shared package should stay framework-agnostic and small.

## Feature clusters

- Warehouse setup/layout:
  - `apps/web`: floor/site and editor UX
  - `apps/bff`: floor/layout draft/publish endpoints and repos
  - DB: layout tables + `get_layout_bundle`/`validate_layout_version`/`publish_layout_version`
- Products and storage presets:
  - `apps/web`: product/detail screens and preset tooling
  - `apps/bff`: product/unit profile + storage preset endpoints + policies
  - DB: `products`, `product_unit_profiles`, `product_packaging_levels`, `packaging_profiles`, `packaging_profile_levels`
- Inventory/operations:
  - `apps/web`: order/warehouse operations pages
  - `apps/bff`: orders, waves, picking, placement, movement
  - DB: `orders`, `waves`, `pick_tasks`, `pick_steps`, `inventory_unit`, canonical movement views/RPC
