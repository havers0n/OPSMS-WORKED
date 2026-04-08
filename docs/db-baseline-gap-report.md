# Database Baseline Gap Report
<!-- Generated 2026-04-08 from migration archaeology of 0001–0083 -->

This report documents everything that is NOT captured in `apps/supabase/schema.baseline.sql`
but IS required for a fully functional environment. These are things that must be
re-applied manually or through separate seed/data processes.

---

## 1. DML Seed Data Embedded in Migrations

These INSERT / UPDATE statements live inside migration files and are not structural SQL.
They must be re-run in order after the schema baseline is applied.

### 1a. container_types (migration 0018 + 0077)

```sql
-- From 0018_container_registry.sql
insert into public.container_types (code, name) values
  ('pallet', 'Pallet'),
  ('carton', 'Carton'),
  ('tote',   'Tote'),
  ('bin',    'Bin')
on conflict (code) do nothing;

-- From 0077_container_capability_and_role.sql
update public.container_types set supports_storage = true,  supports_picking = true  where code = 'pallet';
update public.container_types set supports_storage = true,  supports_picking = true  where code = 'carton';
update public.container_types set supports_storage = false, supports_picking = true  where code = 'tote';
update public.container_types set supports_storage = true,  supports_picking = true  where code = 'bin';
```

### 1b. tenants (migration 0011)

```sql
insert into public.tenants (code, name)
values ('default', 'Default Tenant')
on conflict (code) do nothing;
```

### 1c. products catalog (migration 0028)

File: `apps/supabase/migrations/0028_products_catalog_seed.sql`

This file is **>256KB** and contains a large number of product INSERT statements.
It MUST be applied as a separate seed step. The table structure (products) is
included in schema.baseline.sql, but the data is not.

**Re-application:**
```bash
# From the supabase project root:
psql $DATABASE_URL -f apps/supabase/migrations/0028_products_catalog_seed.sql
```

Or via Supabase CLI:
```bash
supabase db push --include-seed
```

### 1d. profiles backfill (migration 0010)

The original migration backfilled profiles from auth.users at the time of migration.
In a fresh environment, this is handled by the `on_auth_user_profile` trigger and does
not need manual re-application. New user signups will auto-create profiles.

### 1e. tenant_members backfill (migration 0011)

Original migration backfilled tenant membership for existing profiles. In a fresh
environment, the `on_profile_created_provision_default_tenant` trigger handles this
automatically. Manual backfill needed only if profiles exist without memberships:

```sql
insert into public.tenant_members (tenant_id, profile_id, role)
select
  (select id from public.tenants where code = 'default'),
  p.id,
  case when rn = 1 then 'tenant_admin' else 'operator' end
from (
  select id, row_number() over (order by created_at) as rn
  from public.profiles
) p
on conflict (tenant_id, profile_id) do nothing;
```

### 1f. system_code backfill (migration 0078)

Containers and pick_tasks created before 0078 had their system_code/task_number
backfilled in the migration. In a fresh environment with baseline schema, the columns
have `default generate_container_system_code()` so all new rows get values automatically.
No manual backfill needed in fresh environment.

### 1g. locations backfill from published cells (migration 0034)

```sql
-- Called once in 0034, only needed if published layout versions exist without locations
select public.backfill_locations_from_published_cells();
```

---

## 2. Seed File (apps/supabase/seed.sql)

The seed file is used for local development only. It:

1. Upserts the 'default' tenant (safe to run — uses `on conflict do nothing`)
2. Promotes `admin@wos.local` to `tenant_admin` role

```sql
-- Full content of seed.sql:
insert into public.tenants (code, name)
values ('default', 'Default Tenant')
on conflict (code) do nothing;

update public.tenant_members
set role = 'tenant_admin'
where profile_id = (select id from auth.users where email = 'admin@wos.local')
  and role <> 'platform_admin';
```

**This file is local-dev only** and should NOT be run against production.

---

## 3. Large Functions Omitted from schema.baseline.sql

The following functions are too large and complex to maintain as copies in the baseline.
Their **final version** lives in the migration files listed. When reconstructing the schema,
copy verbatim from those files:

| Function | Final Version Migration | Notes |
|---|---|---|
| `validate_layout_payload` | 0081_layout_walls.sql | Lines 71–339 |
| `create_layout_draft` | 0081_layout_walls.sql | Lines 566–801 |
| `save_layout_draft` | 0081_layout_walls.sql | Lines 373–564 |
| `get_layout_bundle` | 0081_layout_walls.sql | Lines 341–451 |
| `publish_layout_version` | 0069_publish_layout_version_hardening.sql (body) + 0070 (remove dead remap) + 0071 (exception guard) | Merge all three |
| `regenerate_layout_cells` | 0024_publish_performance_hardening.sql | SECURITY DEFINER; REVOKED from public |
| `validate_layout_version` | 0017_promote_rack_face_length.sql | |
| `rack_faces_mirror_consistency_trigger` function | 0009_layout_hardening.sql | DEFERRABLE constraint trigger body |
| `validate_cells_tree_consistency` | 0009_layout_hardening.sql | Full body with tree checks |
| `place_container_at_location` | 0047_execution_history_convergence.sql | SECURITY DEFINER |
| `remove_container` | 0047_execution_history_convergence.sql | SECURITY DEFINER |
| `move_container_canonical` | 0064_cutoff_container_placements_runtime_writes_stage2.sql | |
| `split_inventory_unit` | 0044_security_definer_hardening.sql | |
| `transfer_inventory_unit` | 0044_security_definer_hardening.sql | |
| `pick_partial_inventory_unit` | 0044_security_definer_hardening.sql | |
| `pick_full_inventory_unit` | 0076_execute_pick_step.sql | |
| `execute_pick_step` | 0076_execute_pick_step.sql | |
| `allocate_pick_steps` | 0075_allocate_pick_steps.sql | |
| `receive_inventory_unit` | 0068_receive_inventory_unit_rpc.sql | |
| `insert_stock_movement` | 0039_stock_movements_and_execution_semantics.sql | REVOKED from public |
| `resolve_active_location_for_container` | 0039_stock_movements_and_execution_semantics.sql | |
| `get_container_gross_weight` | 0059_cutoff_inventory_items_runtime_reads.sql | Final version |
| `location_can_accept_container` | 0039_stock_movements_and_execution_semantics.sql | |
| `attach_order_to_wave` | 0067_order_wave_membership_rpcs.sql | |
| `detach_order_from_wave` | 0067_order_wave_membership_rpcs.sql | |
| `release_order` | 0083_order_reservations.sql | Final version with reservation checks |
| `release_wave` | 0083_order_reservations.sql | Final version with reservation checks |
| `commit_order_reservations` | 0083_order_reservations.sql | |
| `rollback_ready_order_to_draft` | 0083_order_reservations.sql | |
| `cancel_order_with_unreserve` | 0083_order_reservations.sql | |
| `close_order_with_unreserve` | 0083_order_reservations.sql | |
| `lock_order_reservation_products` | 0083_order_reservations.sql | |

---

## 4. RLS Policies Abbreviated in Baseline

The baseline SQL only includes complete policies for the most critical tables. The following
tables have abbreviated or commented-out policies in the baseline — copy from source migrations
when deploying:

| Table | Source Migration |
|---|---|
| rack_faces | 0013_tenant_scoped_rls.sql |
| rack_sections | 0013_tenant_scoped_rls.sql |
| rack_levels | 0013_tenant_scoped_rls.sql |
| cells | 0013_tenant_scoped_rls.sql |
| operation_events | 0013_tenant_scoped_rls.sql |
| locations | 0034_locations.sql |
| stock_movements | 0039_stock_movements_and_execution_semantics.sql |
| waves | 0033_waves.sql |
| orders | 0030_orders.sql |
| order_lines | 0030_orders.sql |
| pick_tasks | 0031_pick_tasks.sql |
| pick_steps | 0031_pick_tasks.sql |

---

## 5. Grants Requiring Manual Verification

These grants were REVOKED in migrations and must NOT be re-granted:

| Object | Revoked From | Migration |
|---|---|---|
| `regenerate_layout_cells` | public | 0024 |
| `insert_stock_movement` | public, authenticated | 0044 |
| `sync_container_placement_projection` | public, authenticated | 0044 |
| `insert_movement_event` | public, authenticated | 0058 |

---

## 6. Vault / Secrets

No vault secrets were found in any migration (0001–0083). No manual vault re-application needed.

---

## 7. Cron Jobs

No pg_cron jobs were found in any migration (0001–0083). No cron re-application needed.

---

## 8. Storage Buckets

No storage.buckets were created in any migration (0001–0083). No storage re-application needed.

---

## 9. Notable Edge Cases Requiring Manual Review

### 9a. movement_events table
The `movement_events` table exists but has received no writes since migration 0058.
It is included in the baseline as a structural object. Decide whether to:
- Keep it as a read-only archive
- Drop it (`DROP TABLE public.movement_events;`)

### 9b. 0038 vs 0037 identity
Verify whether `0037_sync_published_cells_to_locations.sql` and
`0038_fix_sync_published_cell_to_location_upsert.sql` are actually different files.
If 0038 is a no-op duplicate, the deployed DB may still be on the 0037 (non-upsert) version.

```bash
diff apps/supabase/migrations/0037_sync_published_cells_to_locations.sql \
     apps/supabase/migrations/0038_fix_sync_published_cell_to_location_upsert.sql
```

### 9c. validate_cells_tree_consistency function body
The baseline includes a stub for this function. The full tree consistency logic
from migration 0009 must be used instead. Copy from:
`apps/supabase/migrations/0009_layout_hardening.sql`

### 9d. rack_faces_mirror_consistency_trigger
This deferrable constraint trigger is commented out in the baseline because it
requires the `validate_rack_face_mirror` trigger function body from 0009.
Uncomment after defining that function. Without it, mirror consistency is NOT enforced
at DB level.

---

## 10. Re-Application Order for Fresh Environment

For a fully functional fresh database:

1. Apply `apps/supabase/schema.baseline.sql`
2. Copy and apply large function bodies from migration files listed in Section 3
3. Apply complete RLS policies from source migrations (Section 4)
4. Run container_types DML (Section 1a)
5. Run tenants DML (Section 1b)
6. Run products catalog seed (Section 1c): `0028_products_catalog_seed.sql`
7. Run `apps/supabase/seed.sql` (local dev only)
8. Create at least one auth user (admin@wos.local for local dev) — triggers will
   auto-create profile and tenant membership
