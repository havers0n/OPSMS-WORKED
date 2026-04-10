-- 0060_drop_inventory_item_compat_view.sql
--
-- inventory_item_compat_v is no longer required by runtime/test paths after 0059.
-- Scope intentionally limited to dropping this compatibility view only.

drop view if exists public.inventory_item_compat_v;
