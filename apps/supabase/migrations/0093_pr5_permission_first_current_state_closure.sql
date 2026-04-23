-- 0093_pr5_permission_first_current_state_closure.sql
--
-- PR5: permission-first current-state mutation closure.
--
-- Canonical current-state mutation is function-only. container_lines remains
-- the canonical owner for migrated physical-content flows; inventory_unit is
-- kept as a compatibility/execution projection and must not be mutated
-- directly by authenticated application callers.
--
-- Scope intentionally limited to permissions/guardrails:
--   - close direct inventory_unit DML for application roles
--   - close direct stock_movements inserts for application roles
--   - keep supported SECURITY DEFINER RPC mutation paths working
--   - make internal canonical/projection helpers non-callable directly
--   - add read-only tenant-scoped access needed by BFF fill reads
--
-- Out of scope:
--   - canonical rename
--   - inventory_unit removal
--   - adjustment or repack canonicalization
--   - runtime storage view repointing

-- inventory_unit is projection-only for app callers. Supported mutations must
-- go through receive/split/transfer/pick/execute RPCs.
revoke insert, update, delete on table public.inventory_unit
from authenticated, anon, public;

drop policy if exists inventory_unit_insert_scoped on public.inventory_unit;
drop policy if exists inventory_unit_update_scoped on public.inventory_unit;

grant select on table public.inventory_unit to authenticated;

comment on table public.inventory_unit is
  'Compatibility/execution projection for current inventory. Application roles may read it but must not mutate it directly; supported mutations are function-only and canonicalize through container_lines where migrated.';

-- stock_movements is the execution/history journal. Application callers should
-- not be able to mint history rows directly, including adjustment rows.
revoke insert, update, delete on table public.stock_movements
from authenticated, anon, public;

drop policy if exists stock_movements_insert_scoped on public.stock_movements;

grant select on table public.stock_movements to authenticated;

comment on table public.stock_movements is
  'Execution/history journal. Application roles may read it but must not insert movement history directly; supported mutation RPCs write it through internal helpers.';

-- Internal helpers must not be direct RPC surfaces.
revoke execute on function public.ensure_inventory_unit_current_container_line(uuid, uuid)
from authenticated, anon, public;

revoke execute on function public.pick_full_inventory_unit(uuid, uuid, uuid)
from authenticated, anon, public;

comment on function public.ensure_inventory_unit_current_container_line(uuid, uuid) is
  'Internal projection-to-canonical bootstrap helper. Not a public RPC surface.';

comment on function public.pick_full_inventory_unit(uuid, uuid, uuid) is
  'Internal full-pick helper for execute_pick_step. Direct calls bypass workflow state and are unsupported.';

-- BFF fill reads now query container_lines directly for immutable receipt
-- snapshots. Keep this read-only and tenant-scoped; do not grant DML.
alter table public.container_lines enable row level security;

drop policy if exists container_lines_select_scoped on public.container_lines;
create policy container_lines_select_scoped
on public.container_lines
for select
to authenticated
using (public.can_access_tenant(tenant_id));

grant select on table public.container_lines to authenticated;

comment on table public.container_lines is
  'Canonical container content and current-state owner for migrated flows. Application roles may read tenant-scoped rows but must not write this table directly.';

-- BFF fill fallback reads packaging profile levels by id. Expose packaging
-- master data read-only through tenant-scoped policies via packaging_profiles.
alter table public.packaging_profiles enable row level security;

drop policy if exists packaging_profiles_select_scoped on public.packaging_profiles;
create policy packaging_profiles_select_scoped
on public.packaging_profiles
for select
to authenticated
using (public.can_access_tenant(tenant_id));

grant select on table public.packaging_profiles to authenticated;

alter table public.packaging_profile_levels enable row level security;

drop policy if exists packaging_profile_levels_select_scoped on public.packaging_profile_levels;
create policy packaging_profile_levels_select_scoped
on public.packaging_profile_levels
for select
to authenticated
using (
  exists (
    select 1
    from public.packaging_profiles pp
    where pp.id = packaging_profile_levels.profile_id
      and public.can_access_tenant(pp.tenant_id)
  )
);

grant select on table public.packaging_profile_levels to authenticated;
