-- 20260627001000_delivery_points_service_role_grants.sql
-- Safety migration: grant all DML privileges on delivery_points tables to service_role.
--
-- Context:
--   PR-1 created 20260627000000_delivery_points.sql, which was applied to
--   production/staging before we discovered that service_role grants were
--   missing.  That original migration has since been amended, but environments
--   that already applied it will not re-run it automatically.
--
--   This migration ensures service_role has full DML access regardless of
--   when the original migration was applied.

grant select, insert, update on public.delivery_points to service_role;
grant select, insert, update on public.delivery_point_aliases to service_role;
