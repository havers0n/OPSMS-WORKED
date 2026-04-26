# Domain Model

## Core entities

- **Product**: catalog row (`products`) with profile data.
- **Product unit profile**: physical base-unit metadata in `product_unit_profiles`.
- **Product packaging level**: `product_packaging_levels` with base-unit qty and capabilities (`can_pick`, `can_store`, default pick).
- **Packaging profile**: `packaging_profiles` + `packaging_profile_levels` for storage semantics.
- **Storage preset**: a `packaging_profiles.profile_type = 'storage'` object attached to tenant/product and optional scope.
- **Container**: physical container record (`containers`) with optional `packaging_profile_id`, operational role, location.
- **Location**: slot/cell in warehouse floor structure (`locations`, `cells`, `racks`, etc.).
- **Inventory unit**: actual stock unit in containers with status and packaging state.
- **Order** and **Wave**: execution planning surface for fulfillment.
- **Pick task / step**: execution units tied to ordered lines and container/location state.

## Important domain rules

1. **Packaging hierarchy is cumulative**
   - A parent level uses child level quantity when resolving canonical units.
   - Example:
     - `1 base unit = 1 EA`
     - `1 box = 2 base units`
     - `1 master carton = 4 boxes`
     - `master carton = 8 base units`
   - Any direct `contains=4` result for master carton in this scenario is invalid.

2. **Storage presets are hierarchical and profile-based**
   - Presets are authoritative only if `packaging_profiles.status = 'active'` and scope rules are respected.
   - Materialization/creation flow must resolve a single container type across profile levels.

3. **Canonical quantities are backend-owned**
   - UI must render canonical snapshots from BFF/DB, not manual arithmetic.

4. **Execution actions are stateful and validated**
   - Move/swap/transfer/move-to-location operations require current container/location state checks.

## Data consistency model

- DB/RPC enforces concurrency-safe and tenant-scoped constraints.
- Policy data (`sku_location_policies`) determines preferred storage preset usage for a location/product pair.
- Location occupancy and container snapshot views are the runtime read model for most UI inventory surfaces.
