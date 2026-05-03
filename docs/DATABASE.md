# Database

## Migration rules

- Every DB-facing behavior change must be done through `apps/supabase/migrations`.
- Do not modify committed migrations that are already applied to shared environments.
- Add indexes, views, and constraints with comments and migration notes.

## Baseline domain tables

Core structural tables used by app services:

- `sites`, `floors`
- `layout_versions`, `racks`, `rack_sections`, `rack_levels`, `cells`, `layout_zones`, `layout_walls`
- `locations`, `container_types`, `containers`, `container_lines`
- `products`, `product_unit_profiles`, `product_packaging_levels`
- `packaging_profiles`, `packaging_profile_levels`, `sku_location_policies`
- `inventory_unit`, `orders`, `order_lines`, `waves`, `pick_tasks`, `pick_steps`

## Canonical views / read models

- `container_storage_canonical_v`
- `location_storage_canonical_v`
- `location_occupancy_v`
- `active_container_locations_v`

These views should be treated as read-models for UI and execution surfaces.

## SQL procedures/functions in use

Layout:
- `create_layout_draft`
- `save_layout_draft`
- `validate_layout_version`
- `publish_layout_version`
- `publish_layout_version_with_renames`
- `get_layout_bundle`

Inventory and storage:
- `receive_inventory_unit`
- `split_inventory_unit`
- `pick_partial_inventory_unit`
- `transfer_inventory_unit`

Execution:
- `move_container_canonical`
- `swap_containers_canonical`
- `place_container_at_location`

Orders/waves/picking:
- `release_order`
- `close_order_with_unreserve`
- `cancel_order_with_unreserve`
- `rollback_ready_order_to_draft`
- `release_wave`
- `attach_order_to_wave`
- `detach_order_from_wave`
- `allocate_pick_steps`
- `execute_pick_step`

Storage presets:
- `create_container_from_storage_preset`
- `materialize_storage_preset_container_contents`

## Practical implications for API clients

- Frontend should rely on canonical views and explicit DTOs from BFF instead of raw table fields.
- Storage preset UI relies on DB-side resolution for container type, materialization flags, and usage state.
- Any schema migration impacting query names or return fields requires coordinated changes in:
  - `packages/domain` (schemas/types)
  - `apps/bff` (mappers + route responses)
  - `apps/web` (consumer typing + rendering)
