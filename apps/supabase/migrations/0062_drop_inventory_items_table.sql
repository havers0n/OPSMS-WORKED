-- 0062_drop_inventory_items_table.sql
--
-- Finalizes the inventory_items legacy stack teardown after 0061 disconnect.

drop table if exists public.inventory_items;
