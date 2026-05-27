-- 0127_pick_task_worker_assignment_normalization.sql
--
-- Restore pick_tasks.assigned_to semantics (profile/auth identity),
-- add explicit worker assignment for manual-shift flow,
-- and enforce source-level idempotency.

alter table public.pick_tasks
  drop constraint if exists pick_tasks_source_type_check;

alter table public.pick_tasks
  add constraint pick_tasks_source_type_check
  check (source_type in ('order', 'wave', 'manual_shift_order'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pick_tasks_assigned_to_fkey'
      and conrelid = 'public.pick_tasks'::regclass
  ) then
    alter table public.pick_tasks
      add constraint pick_tasks_assigned_to_fkey
      foreign key (assigned_to) references public.profiles(id);
  end if;
end $$;

alter table public.pick_tasks
  add column if not exists assigned_worker_id uuid null
    references public.manual_shift_workers(id) on delete set null;

create index if not exists pick_tasks_assigned_worker_idx
  on public.pick_tasks(assigned_worker_id)
  where assigned_worker_id is not null;

create unique index if not exists pick_tasks_source_unique
  on public.pick_tasks(tenant_id, source_type, source_id);

alter table public.manual_shift_workers
  add column if not exists auth_user_id uuid null
    references public.profiles(id) on delete set null;

create unique index if not exists manual_shift_workers_auth_user_unique
  on public.manual_shift_workers(auth_user_id)
  where auth_user_id is not null;
