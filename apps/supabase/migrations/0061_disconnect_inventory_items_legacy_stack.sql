-- 0061_disconnect_inventory_items_legacy_stack.sql
--
-- Disconnects legacy inventory_items compatibility objects from canonical schema.
-- This migration intentionally does not drop public.inventory_items itself.

drop view if exists public.inventory_items_legacy_v;

drop trigger if exists sync_inventory_item_to_inventory_unit on public.inventory_items;
drop trigger if exists validate_inventory_item_row on public.inventory_items;

drop function if exists public.sync_inventory_item_to_inventory_unit();
drop function if exists public.validate_inventory_item_row();
drop function if exists public.backfill_inventory_unit_from_inventory_items();
drop function if exists public.can_access_inventory_item(uuid);
drop function if exists public.can_manage_inventory_item(uuid);

alter table public.inventory_unit
  drop constraint if exists inventory_unit_legacy_inventory_item_id_fkey;

alter table public.inventory_unit
  drop column if exists legacy_inventory_item_id;
