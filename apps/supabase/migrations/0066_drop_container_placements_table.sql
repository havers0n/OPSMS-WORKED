-- 0066_drop_container_placements_table.sql
--
-- Final teardown step for the legacy container_placements stack.
-- Function-level dependencies were removed in 0065.
--
-- Scope:
--   - drop public.container_placements
--
-- Out of scope:
--   - other legacy/compat stacks

drop table if exists public.container_placements;
