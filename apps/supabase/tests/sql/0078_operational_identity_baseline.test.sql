-- 0078_operational_identity_baseline.test.sql
--
-- Verifies that containers.system_code and pick_tasks.task_number:
--   1. exist
--   2. are backfilled
--   3. default for new rows
--   4. are non-null and unique

begin;

do $$
declare
  default_tenant_uuid uuid;
  pallet_type_uuid    uuid;
  order_uuid          uuid := gen_random_uuid();
  container_a_uuid    uuid;
  container_b_uuid    uuid;
  task_a_uuid         uuid;
  task_b_uuid         uuid;
  container_a_code    text;
  container_b_code    text;
  task_a_number       text;
  task_b_number       text;
begin
  select id into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Expected default tenant to exist.';
  end if;

  select id into pallet_type_uuid
  from public.container_types
  where code = 'pallet';

  if pallet_type_uuid is null then
    raise exception 'Expected pallet container type to exist.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'containers'
      and column_name = 'system_code'
      and is_nullable = 'NO'
  ) then
    raise exception 'Expected containers.system_code to exist and be NOT NULL.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pick_tasks'
      and column_name = 'task_number'
      and is_nullable = 'NO'
  ) then
    raise exception 'Expected pick_tasks.task_number to exist and be NOT NULL.';
  end if;

  insert into public.orders (id, tenant_id, external_number, status)
  values (order_uuid, default_tenant_uuid, 'PR10-ORDER', 'draft');

  insert into public.containers (tenant_id, external_code, container_type_id)
  values
    (default_tenant_uuid, 'PR10-CNT-A', pallet_type_uuid),
    (default_tenant_uuid, null,         pallet_type_uuid);

  select id, system_code
    into container_a_uuid, container_a_code
  from public.containers
  where tenant_id = default_tenant_uuid
    and external_code = 'PR10-CNT-A';

  select id, system_code
    into container_b_uuid, container_b_code
  from public.containers
  where tenant_id = default_tenant_uuid
    and external_code is null
  order by created_at desc
  limit 1;

  if container_a_code is null or container_a_code !~ '^CNT-[0-9]{6}$' then
    raise exception 'Expected generated container system_code for explicit-code row, got %.', container_a_code;
  end if;

  if container_b_code is null or container_b_code !~ '^CNT-[0-9]{6}$' then
    raise exception 'Expected generated container system_code for null external_code row, got %.', container_b_code;
  end if;

  if container_a_code = container_b_code then
    raise exception 'Expected unique container system_code values.';
  end if;

  insert into public.pick_tasks (tenant_id, source_type, source_id, status)
  values
    (default_tenant_uuid, 'order', order_uuid, 'ready'),
    (default_tenant_uuid, 'order', order_uuid, 'assigned');

  select id, task_number
    into task_a_uuid, task_a_number
  from public.pick_tasks
  where tenant_id = default_tenant_uuid
    and source_id = order_uuid
    and status = 'ready';

  select id, task_number
    into task_b_uuid, task_b_number
  from public.pick_tasks
  where tenant_id = default_tenant_uuid
    and source_id = order_uuid
    and status = 'assigned';

  if task_a_number is null or task_a_number !~ '^TSK-[0-9]{6}$' then
    raise exception 'Expected generated task_number for ready task, got %.', task_a_number;
  end if;

  if task_b_number is null or task_b_number !~ '^TSK-[0-9]{6}$' then
    raise exception 'Expected generated task_number for assigned task, got %.', task_b_number;
  end if;

  if task_a_number = task_b_number then
    raise exception 'Expected unique pick task numbers.';
  end if;

  begin
    insert into public.containers (tenant_id, external_code, container_type_id, system_code)
    values (default_tenant_uuid, 'PR10-CNT-DUP', pallet_type_uuid, container_a_code);
    raise exception 'Expected duplicate containers.system_code to violate uniqueness.';
  exception
    when unique_violation then
      null;
  end;

  begin
    insert into public.pick_tasks (tenant_id, source_type, source_id, status, task_number)
    values (default_tenant_uuid, 'order', order_uuid, 'completed', task_a_number);
    raise exception 'Expected duplicate pick_tasks.task_number to violate uniqueness.';
  exception
    when unique_violation then
      null;
  end;
end
$$;

rollback;
