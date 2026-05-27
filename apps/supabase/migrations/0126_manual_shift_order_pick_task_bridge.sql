-- 0126_manual_shift_order_pick_task_bridge.sql
--
-- Extends pick_tasks/manual_shift_workers for manual shift order task bridging
-- while preserving assigned_to auth/profile semantics.

-- Extend source_type check to include 'manual_shift_order'
alter table public.pick_tasks
  drop constraint if exists pick_tasks_source_type_check;

alter table public.pick_tasks
  add constraint pick_tasks_source_type_check
  check (source_type in ('order', 'wave', 'manual_shift_order'));

alter table public.pick_tasks
  add column if not exists assigned_worker_id uuid null
    references public.manual_shift_workers(id) on delete set null;

create index if not exists pick_tasks_assigned_worker_idx
  on public.pick_tasks(assigned_worker_id)
  where assigned_worker_id is not null;

alter table public.manual_shift_workers
  add column if not exists auth_user_id uuid null
    references public.profiles(id) on delete set null;

create unique index if not exists manual_shift_workers_auth_user_unique
  on public.manual_shift_workers(auth_user_id)
  where auth_user_id is not null;

create unique index if not exists pick_tasks_source_unique_idx
  on public.pick_tasks(tenant_id, source_type, source_id);
