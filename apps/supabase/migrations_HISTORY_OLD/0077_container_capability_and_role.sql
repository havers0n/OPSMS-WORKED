-- 0077_container_capability_and_role.sql
-- PR6-A: Schema foundation for the combined container model.
--
-- Two changes landed together because they form a single logical unit:
-- capability on the type (what can this container be used for?),
-- and operational role on the instance (what is it currently used for?).
-- Separating them would leave the DB in an inconsistent intermediate state
-- where neither half of the model is queryable.
--
-- 1. container_types: supports_storage, supports_picking
-- 2. containers: operational_role
-- 3. index for the later picker-selector hot path

-- ============================================================
-- 1. container_types — capability booleans
--
-- supports_storage: this physical type can hold inventory in a
--   rack cell or floor location.  Pallets and cartons belong here.
--
-- supports_picking: this physical type can travel with a picker
--   as a destination container during pick execution.  Totes belong
--   here.
--
-- Defaults:
--   supports_storage = true   — safe fallback for unknown future types
--   supports_picking = false  — pick capability must be explicit opt-in;
--                               a newly added type should not silently
--                               appear in the picker container selector
-- ============================================================

alter table public.container_types
  add column if not exists supports_storage boolean not null default true,
  add column if not exists supports_picking boolean not null default false;

-- Agreed MVP mapping for the four seeded types.
-- All four are known; no unknown type exists in the current seed.
update public.container_types set supports_storage = true,  supports_picking = true  where code = 'pallet';
update public.container_types set supports_storage = true,  supports_picking = true  where code = 'carton';
update public.container_types set supports_storage = false, supports_picking = true  where code = 'tote';
update public.container_types set supports_storage = true,  supports_picking = true  where code = 'bin';

-- ============================================================
-- 2. containers — operational role
--
-- operational_role: the current operational assignment of this
--   specific container instance.
--
--   'storage' — container is used to hold inventory in a warehouse
--               location.  This is the safe default; all containers
--               that existed before this migration are storage containers.
--
--   'pick'    — container is used by a picker as a destination tote/
--               carrier during pick execution.  Must be explicitly set
--               at creation time by the picker flow.
--
-- DEFAULT 'storage' is correct for all pre-existing rows: every
-- container created before this migration was created via the
-- placement editor (CellPlacementInspector) as a storage vessel.
-- No pick containers exist yet in the dataset.
-- ============================================================

alter table public.containers
  add column if not exists operational_role text not null default 'storage'
    check (operational_role in ('storage', 'pick'));

-- ============================================================
-- 3. Index for picker selector hot path
--
-- Later PR6-C will filter: operational_role = 'pick' AND status = 'active'
-- scoped to a tenant.  This index makes that query a fast index scan.
-- ============================================================

create index if not exists containers_role_status_idx
  on public.containers(tenant_id, operational_role, status);
