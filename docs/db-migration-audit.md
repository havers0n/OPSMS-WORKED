# Database Migration Audit — WOS Project
<!-- Generated 2026-04-08 from migration archaeology of 0001–0083 -->

## Executive Summary

| Metric | Value |
|---|---|
| Total migration files | 83 (0001–0083) |
| Active tables | 24 |
| Dropped tables | 4 (container_placements, inventory_items, and their legacy views) |
| Active views | 11 |
| Active sequences | 2 |
| Active functions / RPCs | ~55 (net after drops and replacements) |
| Active triggers | ~20 |
| Active RLS policies | ~65 |
| DML seed rows | container_types × 4, tenants × 1 (in 0011), products catalog (0028, large) |
| Seed file | apps/supabase/seed.sql — tenant + tenant_member admin fixup |

Two major legacy stack teardowns completed:

1. **inventory_items → inventory_unit** (0036–0062): `inventory_items` created in 0022,
   deprecated across 0059–0061, table dropped in 0062.
2. **container_placements → containers.current_location_id** (0039–0066):
   `container_placements` created in 0019, runtime writes cut in 0063–0064,
   function stack dropped in 0065, table dropped in 0066.

---

## Complete Object Ledger

### EXTENSIONS

| Object | Introduced | Status |
|---|---|---|
| pgcrypto | 0001 | ACTIVE |

---

### SEQUENCES

| Object | Introduced | Notes | Status |
|---|---|---|---|
| `public.container_system_code_seq` | 0078 | Used by generate_container_system_code() | ACTIVE |
| `public.pick_task_number_seq` | 0078 | Used by generate_pick_task_number() | ACTIVE |

---

### TABLES (ACTIVE)

#### `public.profiles`
- Introduced: 0002
- Columns: id (uuid PK), created_at, updated_at, email, display_name
- updated_at trigger: set_profiles_updated_at (0002)
- RLS: enabled (0010); policies replaced by tenant-scoped versions (0013)
- DML: backfill INSERT in 0010 (from auth.users)
- Status: ACTIVE

#### `public.sites`
- Introduced: 0002
- Columns: id, created_at, updated_at, name, tenant_id (added 0011)
- FK: tenant_id → tenants.id (added 0011)
- updated_at trigger: set_sites_updated_at
- RLS: enabled (0010/0013)
- Status: ACTIVE

#### `public.floors`
- Introduced: 0002
- Columns: id, created_at, updated_at, name, site_id
- updated_at trigger: set_floors_updated_at
- RLS: enabled (0010/0013)
- Status: ACTIVE

#### `public.layout_versions`
- Introduced: 0003
- Columns: id, floor_id, version_no, state ('draft'|'published'), parent_published_version_id, created_by, published_at, created_at, updated_at
- Added: draft_version integer (0057) — optimistic lock counter
- Partial unique indexes: one-published-per-floor (state='published'), one-draft-per-floor (state='draft')
- updated_at trigger (0003)
- RLS: enabled (0010/0013)
- Status: ACTIVE

#### `public.racks`
- Introduced: 0004
- Columns: id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state
- updated_at trigger (0004)
- RLS: enabled (0010/0013)
- Status: ACTIVE

#### `public.rack_faces`
- Introduced: 0004
- Columns: id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id, face_length (0017)
- anchor column DROPPED in 0016
- Deferrable constraint trigger: rack_faces_mirror_consistency_trigger (0009)
- RLS: enabled (0010/0013)
- Status: ACTIVE

#### `public.rack_sections`
- Introduced: 0004
- Columns: id, rack_face_id, ordinal, length
- updated_at trigger (0004)
- RLS: enabled (0010/0013)
- Status: ACTIVE

#### `public.rack_levels`
- Introduced: 0004
- Columns: id, rack_section_id, ordinal, slot_count (no updated_at)
- RLS: enabled (0010/0013)
- Status: ACTIVE

#### `public.cells`
- Introduced: 0004
- Columns: id, rack_face_id, level_ordinal, slot_ordinal, address, layout_version_id (added later), cell_code (added 0009)
- Constraint: cells_face_level_slot_unique (replaced cells_level_slot_unique in 0008)
- Constraint trigger: cells_tree_consistency_trigger (0009, SECURITY DEFINER 0024)
- Sync trigger to locations: sync_published_cell_to_location (0037, fixed 0038)
- RLS: enabled (0010/0013)
- Status: ACTIVE

#### `public.operation_events`
- Introduced: 0009
- Columns: id, occurred_at, event_type, outcome, layout_version_id, entity_type, entity_id, actor_id, payload (jsonb)
- RLS: enabled (0013)
- Status: ACTIVE

#### `public.tenants`
- Introduced: 0011
- Columns: id, code (unique), name, created_at
- DML: INSERT 'default' tenant in 0011
- Status: ACTIVE

#### `public.tenant_members`
- Introduced: 0011
- Columns: id, tenant_id, profile_id, role, created_at
- DML: backfill membership in 0011
- Auto-provisioning trigger: on_profile_created_provision_default_tenant (0014)
- RLS: policy hardened in 0015 (profile_id=auth.uid() OR is_platform_admin())
- Status: ACTIVE

#### `public.container_types`
- Introduced: 0018
- Columns: id, code (unique), name, width_mm, height_mm, depth_mm (0040), tare_weight_g (0040), max_load_g (0040), supports_storage boolean default true (0077), supports_picking boolean default false (0077)
- DML: 4 seeded types (pallet/carton/tote/bin) in 0018; capability booleans updated 0077
- RLS: enabled (0018)
- Status: ACTIVE

#### `public.containers`
- Introduced: 0018
- Columns: id, tenant_id, container_type_id, external_code, status, current_location_id (0040), current_location_entered_at (0040), updated_at (0040), updated_by (0040), operational_role text 'storage'|'pick' (0077), system_code text not null default generate_container_system_code() (0078)
- Indexes: containers_role_status_idx (0077), containers_system_code_unique (0078)
- FK: current_location_id → locations.id (canonical placement truth)
- RLS: enabled (0018)
- Status: ACTIVE

#### `public.locations`
- Introduced: 0034
- Columns: id, tenant_id, floor_id, code, location_type, capacity_mode, status, geometry_slot_id (FK → cells.id), created_at, updated_at, floor_x numeric null (0082), floor_y numeric null (0082)
- Validate trigger: validate_location_row (0034)
- Sync trigger (from cells): sync_published_cell_to_location (0037)
- Backfill: backfill_locations_from_published_cells() called in 0034
- RLS: enabled (0034)
- Status: ACTIVE

#### `public.inventory_unit`
- Introduced: 0036
- Columns: id, tenant_id, container_id, product_id, quantity, uom, lot_code, serial_no, expiry_date, status, created_at, updated_at, updated_by (0039), source_inventory_unit_id (0039, self-ref FK)
- legacy_inventory_item_id column DROPPED in 0061
- Validate trigger: validate_inventory_unit_row (0036; sync trigger also 0036 then dropped 0061)
- RLS: enabled (0036)
- Status: ACTIVE

#### `public.stock_movements`
- Introduced: 0039
- Columns: id, tenant_id, movement_type (extended CHECK 0047), source_location_id, target_location_id, source_container_id, target_container_id, source_inventory_unit_id, target_inventory_unit_id, quantity, uom, status, occurred_at, recorded_at, recorded_by, created_at
- Movement types: receive, place, remove, transfer, split, pick_partial (types extended 0047)
- RLS: authenticated SELECT via can_access_tenant (implicit, SECURITY DEFINER functions bypass RLS)
- Status: ACTIVE

#### `public.products`
- Introduced: 0027
- Columns: id, tenant_id, sku (unique per tenant), name, description, unit_weight_g (0040), created_at, updated_at
- DML: large catalog seed in 0028 (>256KB, not fully readable)
- RLS: enabled (0027)
- Status: ACTIVE

#### `public.movement_events` (legacy audit table)
- Introduced: 0025
- Columns: id, tenant_id, event_type, container_id, from_cell_id, to_cell_id, placement_id, quantity, created_at, actor_id
- Dual-write CUT in 0058 (no more writes from place/remove functions)
- insert_movement_event REVOKED from public/authenticated in 0058
- Note: Table still exists but is no longer written to. Historical data only.
- Status: ACTIVE (but effectively frozen)

#### `public.waves`
- Introduced: 0033
- Columns: id, tenant_id, code, name, status, created_at, updated_at
- validate_wave_row trigger (0033)
- RLS: enabled (0033)
- Status: ACTIVE

#### `public.orders`
- Introduced: 0030
- Columns: id, tenant_id, external_number, status ('draft'|'ready'|'released'|'picked'|'partial'|'closed'|'cancelled'), wave_id (FK added 0033), released_at, closed_at, created_at, updated_at
- validate_order_row trigger (0030, updated 0033, updated again 0083 with reservation guards)
- RLS: enabled (0030)
- Status: ACTIVE

#### `public.order_lines`
- Introduced: 0030
- Columns: id, tenant_id, order_id, sku, name, qty_required, qty_picked, status, created_at, updated_at, product_id (0032)
- validate_order_line_row trigger (0030, updated 0083)
- prevent_committed_order_line_delete trigger (0083)
- RLS: enabled (0030)
- Status: ACTIVE

#### `public.pick_tasks`
- Introduced: 0031
- Columns: id, tenant_id, source_type, source_id, status, created_at, updated_at, started_at, completed_at, task_number text not null (0078, default generate_pick_task_number())
- Unique index: pick_tasks_task_number_unique (0078)
- RLS: enabled (0031)
- Status: ACTIVE

#### `public.pick_steps`
- Introduced: 0031
- Columns: id, task_id, tenant_id, order_id, order_line_id, sequence_no, sku, item_name, qty_required, qty_picked, status, source_container_id, source_cell_id, created_at, updated_at, inventory_unit_id (0074), pick_container_id (0074), executed_at (0076), executed_by (0076)
- status CHECK extended to include 'needs_replenishment' in 0074
- Indexes: pick_steps_inventory_unit_idx (0074), pick_steps_executed_at_idx (0076)
- RLS: enabled (0031)
- Status: ACTIVE

#### `public.product_location_roles`
- Introduced: 0074
- Columns: id, tenant_id, product_id, location_id, role ('primary_pick'|'reserve'), state ('draft'|'published'|'inactive'), layout_version_id (nullable), effective_from, effective_to, created_at, updated_at
- Unique partial index: product_location_roles_unique_active (state='published')
- Indexes: product_location_roles_product_idx, product_location_roles_location_idx
- updated_at trigger: set_product_location_roles_updated_at
- RLS: enabled (0074)
- Status: ACTIVE

#### `public.layout_zones`
- Introduced: 0080
- Columns: id, layout_version_id, code, name, category (nullable enum), color, x, y, width, height, created_at, updated_at
- Unique constraint: layout_zones_code_unique_per_version
- Index: layout_zones_layout_version_idx
- updated_at trigger: layout_zones_set_updated_at
- RLS: enabled (0080); CRUD policies scoped via can_access/manage_layout_version
- Status: ACTIVE

#### `public.layout_walls`
- Introduced: 0081
- Columns: id, layout_version_id, code, name (nullable), wall_type (nullable enum), x1, y1, x2, y2, blocks_rack_placement boolean default true, created_at, updated_at
- Constraints: axis-aligned, nonzero-length, unique code per version
- Index: layout_walls_layout_version_idx
- updated_at trigger: layout_walls_set_updated_at
- RLS: enabled (0081); CRUD policies scoped via can_access/manage_layout_version
- Status: ACTIVE

#### `public.order_reservations`
- Introduced: 0083
- Columns: id, tenant_id, order_id, order_line_id, product_id, quantity, status ('active'|'released'|'rolled_back'|'closed'|'cancelled'), created_at, updated_at, released_at, rolled_back_at, closed_at, cancelled_at, created_by, released_by, rolled_back_by, closed_by, cancelled_by, rollback_reason, cancel_reason
- Unique partial index: order_reservations_active_line_unique (status in active/released)
- Indexes: order_reservations_tenant_product_status_idx, tenant_order_idx, tenant_order_line_idx
- updated_at trigger: set_order_reservations_updated_at
- Validate trigger: validate_order_reservation_row
- RLS: enabled; select=can_access_tenant, insert/update=can_manage_tenant
- Status: ACTIVE

---

### TABLES (DROPPED)

| Table | Introduced | Dropped | Reason |
|---|---|---|---|
| `public.container_placements` | 0019 | 0066 | Superseded by containers.current_location_id (canonical) |
| `public.inventory_items` | 0022 | 0062 | Superseded by inventory_unit |

---

### VIEWS (ACTIVE)

| View | Introduced | Last Replaced | Notes |
|---|---|---|---|
| `public.cell_occupancy_v` | 0020 | 0059 | Reads from inventory_unit only |
| `public.active_container_locations_v` | 0035 | 0079 | Joins containers.current_location_id; adds system_code |
| `public.location_occupancy_v` | 0035 | 0040 | Container count per location |
| `public.location_storage_snapshot_v` | 0035 | 0059 | Reads inventory_unit only; includes system_code (0079) |
| `public.cell_storage_snapshot_v` | 0035 | 0059 | Reads inventory_unit only |
| `public.container_storage_snapshot_v` | 0023 | 0059 | Reads inventory_unit only |
| `public.container_storage_canonical_v` | 0048 | 0079 | Canonical read; adds system_code |
| `public.location_storage_canonical_v` | 0048 | 0079 | Canonical read; adds system_code |

### VIEWS (DROPPED)

| View | Introduced | Dropped | Reason |
|---|---|---|---|
| `public.inventory_item_compat_v` | 0036 | 0060 | Legacy compat wrapper removed |
| `public.inventory_items_legacy_v` | 0036 | 0061 | Legacy view removed with full stack teardown |

---

### FUNCTIONS / RPCs (ACTIVE — final versions)

#### Helper / Utility
| Function | Introduced | Last Replaced | Security | Notes |
|---|---|---|---|---|
| `public.set_updated_at()` | 0001 | — | INVOKER | Trigger function |
| `public.pad_2(int)` | 0005 | — | INVOKER | Address helper |
| `public.pad_4(int)` | 0005 | — | INVOKER | Address helper |
| `public.build_cell_address(int,int,int,text)` | 0005 | — | INVOKER | |
| `public.layout_version_cell_counts(uuid)` | 0005 | — | INVOKER | |
| `public.write_layout_event(...)` | 0009 | — | INVOKER | Audit trail writer |
| `public.insert_stock_movement(...)` | 0039 | — | INVOKER | REVOKED from public (0044) |
| `public.resolve_active_location_for_container(uuid)` | 0039 | — | INVOKER | |
| `public.get_container_gross_weight(uuid)` | 0039 | 0059 | INVOKER | Reads inventory_unit only |
| `public.location_can_accept_container(uuid,uuid)` | 0039 | — | INVOKER | |
| `public.generate_container_system_code()` | 0078 | — | INVOKER | volatile, uses sequence |
| `public.generate_pick_task_number()` | 0078 | — | INVOKER | volatile, uses sequence |

#### Auth / Tenant Scope
| Function | Introduced | Last Replaced | Security | Notes |
|---|---|---|---|---|
| `public.current_profile_id()` | 0012 | — | INVOKER | stable |
| `public.is_platform_admin()` | 0012 | — | INVOKER | stable |
| `public.can_access_tenant(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_manage_tenant(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_access_site(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_manage_site(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_access_floor(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_manage_floor(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_access_layout_version(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_manage_layout_version(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_access_rack(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_manage_rack(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_publish_floor(uuid)` | 0012 | — | INVOKER | stable |
| `public.can_access_container(uuid)` | 0018 | — | INVOKER | stable |
| `public.can_manage_container(uuid)` | 0018 | — | INVOKER | stable |
| `public.can_access_cell(uuid)` | 0020 | — | INVOKER | stable |
| `public.can_access_product_location_role(uuid)` | 0074 | — | INVOKER | stable |
| `public.can_manage_product_location_role(uuid)` | 0074 | — | INVOKER | stable |

#### Layout Lifecycle RPCs
| Function | Signature | Introduced | Last Replaced | Security | Notes |
|---|---|---|---|---|---|
| `public.regenerate_layout_cells(uuid)` | uuid | 0006 | 0024 | SECURITY DEFINER | REVOKED from public (0024) |
| `public.validate_layout_version(uuid)` | uuid→jsonb | 0006 | 0017 | SECURITY DEFINER | |
| `public.validate_layout_payload(jsonb)` | jsonb→void | 0009 | 0081 | INVOKER | Updated for zones (0080), walls (0081) |
| `public.create_layout_draft(uuid,uuid)` | →uuid | 0007 | 0081 | SECURITY DEFINER | Final: copies zones+walls, temp tables for racks |
| `public.save_layout_draft(jsonb,uuid)` | →jsonb | 0009 | 0081 | SECURITY DEFINER | Final: zones+walls+racks; DRAFT_CONFLICT guard; audit trail |
| `public.publish_layout_version(uuid,uuid)` | →jsonb | 0006 | 0069 | SECURITY DEFINER | Advisory lock, location sync, audit trail, dead remap block removed 0070 |
| `public.get_layout_bundle(uuid)` | →jsonb | 0043 | 0081 | SECURITY DEFINER | Returns zones, walls, racks, draftVersion |
| `public.backfill_locations_from_published_cells()` | →void | 0034 | — | INVOKER | Called once in 0034 |
| `public.sync_published_cell_to_location()` | trigger | 0037 | 0038 | INVOKER | Trigger on cells |
| `public.validate_cells_tree_consistency()` | trigger | 0009 | 0024 | SECURITY DEFINER | Constraint trigger |

#### Container Placement RPCs
| Function | Signature | Introduced | Last Replaced | Security | Notes |
|---|---|---|---|---|---|
| `public.place_container_at_location(uuid,uuid,uuid)` | →jsonb | 0046 | 0047 | SECURITY DEFINER | Primary placement RPC; writes stock_movements |
| `public.remove_container(uuid,uuid)` | →jsonb | 0021 | 0047 | SECURITY DEFINER | Writes stock_movements; placement dual-write CUT 0063 |
| `public.move_container_canonical(uuid,uuid,uuid)` | →jsonb | 0039 | 0064 | SECURITY DEFINER | container_placements write CUT 0064 |

#### Inventory RPCs
| Function | Signature | Introduced | Last Replaced | Security | Notes |
|---|---|---|---|---|---|
| `public.split_inventory_unit(uuid,numeric,uuid,uuid)` | →jsonb | 0039 | 0044 | SECURITY DEFINER | Partial split |
| `public.transfer_inventory_unit(uuid,uuid,uuid)` | →jsonb | 0039 | 0044 | SECURITY DEFINER | Full transfer |
| `public.pick_partial_inventory_unit(uuid,numeric,uuid,uuid)` | →jsonb | 0039 | 0044 | SECURITY DEFINER | |
| `public.pick_full_inventory_unit(uuid,uuid,uuid)` | →jsonb | 0076 | — | INVOKER | Full depletion pick |
| `public.receive_inventory_unit(...)` | →jsonb | 0068 | — | SECURITY DEFINER | Receive RPC |
| `public.sync_container_placement_projection(...)` | — | 0039 | — | INVOKER | REVOKED from public (0044); DROPPED in 0065 — **DROPPED** |

#### Picking RPCs
| Function | Signature | Introduced | Last Replaced | Security | Notes |
|---|---|---|---|---|---|
| `public.allocate_pick_steps(uuid)` | →jsonb | 0075 | — | SECURITY DEFINER | |
| `public.execute_pick_step(uuid,int,uuid,uuid)` | →jsonb | 0076 | — | SECURITY DEFINER | |

#### Wave / Order RPCs
| Function | Signature | Introduced | Last Replaced | Security | Notes |
|---|---|---|---|---|---|
| `public.release_wave(uuid)` | →uuid | 0033 | 0083 | SECURITY DEFINER | Updated with reservation checks in 0083 |
| `public.release_order(uuid)` | →uuid | 0033 | 0083 | SECURITY DEFINER | Requires active reservations; transitions to released |
| `public.attach_order_to_wave(uuid,uuid)` | →void | 0067 | — | SECURITY DEFINER | |
| `public.detach_order_from_wave(uuid,uuid)` | →void | 0067 | — | SECURITY DEFINER | |

#### Order Reservation RPCs (0083)
| Function | Signature | Security | Notes |
|---|---|---|---|
| `public.commit_order_reservations(uuid)` | →uuid | SECURITY DEFINER | ATP check; draft→ready transition |
| `public.rollback_ready_order_to_draft(uuid,text)` | →uuid | SECURITY DEFINER | ready→draft; rolls back reservations |
| `public.cancel_order_with_unreserve(uuid,text)` | →uuid | SECURITY DEFINER | cancels order + reservations |
| `public.close_order_with_unreserve(uuid)` | →uuid | SECURITY DEFINER | picked/partial→closed |
| `public.lock_order_reservation_products(uuid,uuid[])` | →void | SECURITY DEFINER | Advisory lock per product |
| `public.order_physical_available_qty(uuid,uuid)` | →numeric | INVOKER | stable |
| `public.order_reserved_qty(uuid,uuid)` | →numeric | INVOKER | stable |
| `public.order_available_to_promise_qty(uuid,uuid)` | →numeric | INVOKER | stable |

#### Auth Trigger Functions
| Function | Introduced | Notes |
|---|---|---|
| `public.handle_auth_user_profile()` | 0010 | SECURITY DEFINER; trigger on auth.users INSERT |
| `public.provision_default_tenant_membership()` | 0014 | SECURITY DEFINER; trigger on profiles INSERT |

#### Validator Trigger Functions (ACTIVE)
| Function | Table | Introduced | Last Replaced |
|---|---|---|---|
| `public.validate_location_row()` | locations | 0034 | — |
| `public.validate_inventory_unit_row()` | inventory_unit | 0036 | — |
| `public.validate_wave_row()` | waves | 0033 | — |
| `public.validate_order_row()` | orders | 0030 | 0083 |
| `public.validate_order_line_row()` | order_lines | 0030 | 0083 |
| `public.prevent_committed_order_line_delete()` | order_lines | 0083 | — |
| `public.validate_order_reservation_row()` | order_reservations | 0083 | — |

---

### FUNCTIONS (DROPPED)

| Function | Introduced | Dropped | Reason |
|---|---|---|---|
| `public.save_layout_draft(jsonb)` (no actor param) | 0007 | 0009 | Signature replaced with actor_uuid version |
| `public.remove_container_if_in_cells(uuid,uuid[],uuid)` | 0025 | 0051 | Deprecated cell-based wrapper |
| `public.move_container_from_cell(...)` | 0026 | 0052 | Deprecated cell-based wrapper |
| `public.move_container(...)` | 0021 | 0052 | Deprecated cell-based wrapper |
| `public.place_container(...)` | 0021 | 0065 | Replaced by place_container_at_location |
| `public.sync_container_placement_projection(...)` | 0039 | 0065 | container_placements stack teardown |
| `public.backfill_container_current_locations()` | 0040 | 0065 | container_placements stack teardown |
| `public.can_access_container_placement(uuid)` | 0019 | 0065 | container_placements stack teardown |
| `public.can_manage_container_placement(uuid)` | 0019 | 0065 | container_placements stack teardown |
| `public.validate_container_placement_row()` | 0019 | 0065 | container_placements stack teardown |
| `public.backfill_inventory_unit_from_inventory_items()` | 0036 | 0061 | inventory_items stack teardown |
| `public.sync_inventory_item_to_inventory_unit()` (trigger fn) | 0036 | 0061 | inventory_items stack teardown |
| `public.validate_inventory_item_row()` (trigger fn) | 0022 | 0061 | inventory_items stack teardown |
| `public.can_access_inventory_item(uuid)` | 0022 | 0061 | inventory_items stack teardown |
| `public.can_manage_inventory_item(uuid)` | 0022 | 0061 | inventory_items stack teardown |
| `public.insert_movement_event(...)` | 0025 | 0058 | REVOKED; movement_events dual-write cutoff |
| `public.inventory_item_ref_product_uuid(text)` | 0029 | 0061 | inventory_items stack teardown |

---

### TRIGGERS (ACTIVE — final)

| Trigger | Table | Function | Event | Notes |
|---|---|---|---|---|
| set_profiles_updated_at | profiles | set_updated_at | BEFORE UPDATE | |
| set_sites_updated_at | sites | set_updated_at | BEFORE UPDATE | |
| set_floors_updated_at | floors | set_updated_at | BEFORE UPDATE | |
| set_layout_versions_updated_at | layout_versions | set_updated_at | BEFORE UPDATE | |
| set_racks_updated_at | racks | set_updated_at | BEFORE UPDATE | |
| set_rack_sections_updated_at | rack_sections | set_updated_at | BEFORE UPDATE | |
| rack_faces_mirror_consistency_trigger | rack_faces | validate_rack_face_mirror | DEFERRABLE CONSTRAINT AFTER INSERT/UPDATE | |
| cells_tree_consistency_trigger | cells | validate_cells_tree_consistency | CONSTRAINT AFTER INSERT/UPDATE | SECURITY DEFINER fn |
| sync_published_cell_to_location | cells | sync_published_cell_to_location | AFTER INSERT/UPDATE | |
| on_auth_user_profile | auth.users | handle_auth_user_profile | AFTER INSERT | SECURITY DEFINER |
| on_profile_created_provision_default_tenant | profiles | provision_default_tenant_membership | AFTER INSERT | SECURITY DEFINER |
| set_product_location_roles_updated_at | product_location_roles | set_updated_at | BEFORE UPDATE | |
| validate_location_row | locations | validate_location_row | BEFORE INSERT/UPDATE | |
| validate_inventory_unit_row | inventory_unit | validate_inventory_unit_row | BEFORE INSERT/UPDATE | |
| validate_wave_row | waves | validate_wave_row | BEFORE INSERT/UPDATE | |
| validate_order_row | orders | validate_order_row | BEFORE INSERT/UPDATE | |
| validate_order_line_row | order_lines | validate_order_line_row | BEFORE INSERT/UPDATE | |
| prevent_committed_order_line_delete | order_lines | prevent_committed_order_line_delete | BEFORE DELETE | Added 0083 |
| layout_zones_set_updated_at | layout_zones | set_updated_at | BEFORE UPDATE | |
| layout_walls_set_updated_at | layout_walls | set_updated_at | BEFORE UPDATE | |
| set_order_reservations_updated_at | order_reservations | set_updated_at | BEFORE UPDATE | |
| validate_order_reservation_row | order_reservations | validate_order_reservation_row | BEFORE INSERT/UPDATE | |

---

### RLS POLICIES (ACTIVE — final per table)

All tables use tenant-scoped RLS established in migrations 0013–0083.

**General pattern (most tables):**
- SELECT: `can_access_tenant(tenant_id)` or equivalent layout/rack scope helper
- INSERT: `can_manage_tenant(tenant_id)`
- UPDATE: `can_manage_tenant(tenant_id)` (using + with check)

**Notable exceptions:**
- `tenant_members` SELECT: `profile_id = auth.uid() OR is_platform_admin()` (hardened 0015)
- Layout hierarchy tables (racks, rack_faces, etc.): use `can_access/manage_layout_version(layout_version_id)`
- `cells`: use `can_access/manage_rack(rack_face_id.rack_id)` indirectly
- `product_location_roles`, `layout_zones`, `layout_walls`, `order_reservations`: newest pattern, scoped via appropriate hierarchy helper

---

## Risk Hotspots

1. **movement_events table is frozen but not dropped.** It still exists but receives no new writes since 0058. Historical data may be inconsistent with stock_movements. Consider dropping if historical data is not needed, or archiving.

2. **products catalog seed (0028) is >256KB and was not fully readable.** The seed file inserts a large number of products. Verify that the baseline SQL properly recreates the table structure; the seed data must be re-applied separately.

3. **sync_published_cell_to_location trigger (0037/0038).** The fix migration 0038 appeared to be identical to 0037 based on the system read. Verify that the upsert fix actually landed correctly in the deployed database.

4. **container_placements remap block in publish_layout_version.** Migration 0070 removed the dead container_placements remap code but kept `remappedPlacements: 0` in the return. This is safe but the return value is misleading — callers should not rely on it.

5. **draft_version optimistic lock.** save_layout_draft raises `DRAFT_CONFLICT` when client_draft_version doesn't match. Clients must always pass their current draftVersion to avoid spurious conflicts.

6. **Order reservation state machine gated by session variables.** The validate_order_row trigger (0083) checks `wos.allow_order_reservation_status_update` session config. These are set via `set_config(... true)` (local to transaction) in the SECURITY DEFINER RPCs. Direct SQL mutations to orders.status outside the RPCs will be blocked or behave differently.

7. **pg_advisory_xact_lock in lock_order_reservation_products.** Uses `hashtextextended(tenant_uuid || ':' || product_uuid, 0)` — verify no hash collisions are plausible in prod workloads.

8. **containers.operational_role defaults to 'storage'.** All pre-0077 containers default to 'storage'. The pick container selector must explicitly filter `operational_role = 'pick'`.

---

## Uncertain States

- **0038 vs 0037 content identity**: The read tool returned identical content for both files. Verify `diff migrations/0037_sync_published_cells_to_locations.sql migrations/0038_fix_sync_published_cell_to_location_upsert.sql` in the repo to confirm whether the fix actually differs.
- **validate_wave_row in 0083**: The `release_order` function was rewritten in 0083 but `release_wave` is not shown in that migration; ensure `release_wave` was also updated or remains consistent.
- **products seed 0028**: Contents not fully readable due to >256KB file size. The table structure is known; the seed rows are not inventoried here.

---

## Objects Created Then Dropped (Archaeology Trail)

| Object | Created | Dropped | Migration path |
|---|---|---|---|
| rack_faces.anchor column | 0004 | 0016 | Unnecessary column removed |
| cells_level_slot_unique constraint | 0004 | 0008 | Replaced by cells_face_level_slot_unique |
| inventory_item_compat_v | 0036 | 0060 | compat view removed after cutoff |
| inventory_items_legacy_v | 0036 | 0061 | legacy view removed with stack teardown |
| inventory_items table | 0022 | 0062 | Superseded by inventory_unit |
| container_placements table | 0019 | 0066 | Superseded by canonical current_location_id |
| save_layout_draft(jsonb) [no actor] | 0007 | 0009 | Replaced with actor_uuid variant |
| remove_container_if_in_cells | 0025 | 0051 | Cell-based wrapper deprecated |
| move_container_from_cell | 0026 | 0052 | Cell-based wrapper deprecated |
| move_container | 0021 | 0052 | Cell-based wrapper deprecated |
| place_container | 0021 | 0065 | Replaced by place_container_at_location |
| sync_container_placement_projection | 0039 | 0065 | container_placements teardown |
| backfill_container_current_locations | 0040 | 0065 | container_placements teardown |
| can_access_container_placement | 0019 | 0065 | container_placements teardown |
| can_manage_container_placement | 0019 | 0065 | container_placements teardown |
| validate_container_placement_row | 0019 | 0065 | container_placements teardown |

---

## Non-Schema Objects (Grants, DML, Settings)

- **Extensions**: pgcrypto (0001)
- **Grants**: authenticated role granted SELECT/INSERT/UPDATE/DELETE on all active tables; specific EXECUTE grants on RPCs (see individual migrations)
- **REVOKED**: insert_stock_movement, sync_container_placement_projection from public (0044); regenerate_layout_cells from public (0024); insert_movement_event from public/authenticated (0058)
- **DML seed in migrations**: container_types × 4 (0018), tenants 'default' (0011), tenant_members backfill (0011), profiles backfill (0010), products large catalog (0028), container_type capability updates (0077), container/pick_task system_code backfill (0078)
- **seed.sql**: Inserts/upserts 'default' tenant; updates admin@wos.local tenant_member role to tenant_admin

---

## Cleanup Strategy

1. **movement_events**: Drop the table if no historical reporting need. If retained, add a comment marking it read-only.
2. **0028 products seed**: Ensure it is re-applied manually or via `supabase db seed` — it is not in schema.baseline.sql.
3. **0038 sync fix**: Diff the file against 0037 to confirm the upsert correction is real.
4. **Review return value** of publish_layout_version for `remappedPlacements: 0` — consider removing that field.
5. **containers.system_code**: Existing containers were backfilled in 0078. Verify no NULLs remain before adding NOT NULL (migration does set NOT NULL after backfill, so this should be safe if 0078 ran in a single transaction).
