-- 0126_manual_shift_order_pick_task_bridge.sql
--
-- Extends pick_tasks to support manual shift orders as a source type.
-- Drops the FK on assigned_to so that manual_shift_worker UUIDs can be stored there
-- (pickers in manual shifts are not auth profile users).

-- Extend source_type check to include 'manual_shift_order'
alter table public.pick_tasks
  drop constraint if exists pick_tasks_source_type_check;

alter table public.pick_tasks
  add constraint pick_tasks_source_type_check
  check (source_type in ('order', 'wave', 'manual_shift_order'));

-- Drop FK on assigned_to — manual shift workers are not profiles
alter table public.pick_tasks
  drop constraint if exists pick_tasks_assigned_to_fkey;
