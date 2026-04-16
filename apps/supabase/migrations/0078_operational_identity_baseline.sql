-- 0078_operational_identity_baseline.sql
--
-- Adds DB-owned operational identity for:
--   1. containers    -> system_code
--   2. pick_tasks    -> task_number

create sequence if not exists public.container_system_code_seq;
create sequence if not exists public.pick_task_number_seq;

create or replace function public.generate_container_system_code()
returns text
language sql
volatile
as $$
  select 'CNT-' || lpad(nextval('public.container_system_code_seq')::text, 6, '0')
$$;

create or replace function public.generate_pick_task_number()
returns text
language sql
volatile
as $$
  select 'TSK-' || lpad(nextval('public.pick_task_number_seq')::text, 6, '0')
$$;

alter table public.containers
  add column if not exists system_code text;

alter table public.pick_tasks
  add column if not exists task_number text;

update public.containers
set system_code = public.generate_container_system_code()
where system_code is null;

update public.pick_tasks
set task_number = public.generate_pick_task_number()
where task_number is null;

alter table public.containers
  alter column system_code set default public.generate_container_system_code();

alter table public.pick_tasks
  alter column task_number set default public.generate_pick_task_number();

alter table public.containers
  alter column system_code set not null;

alter table public.pick_tasks
  alter column task_number set not null;

create unique index if not exists containers_system_code_unique
  on public.containers(system_code);

create unique index if not exists pick_tasks_task_number_unique
  on public.pick_tasks(task_number);
