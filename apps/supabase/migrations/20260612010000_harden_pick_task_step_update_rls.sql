-- 20260612010000_harden_pick_task_step_update_rls.sql
-- Add WITH CHECK enforcement to pick_tasks and pick_steps UPDATE policies.
-- Prevents a privileged tenant user from moving a row's tenant_id to another tenant.

drop policy if exists pick_tasks_update_scoped on public.pick_tasks;
create policy pick_tasks_update_scoped
on public.pick_tasks
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists pick_steps_update_scoped on public.pick_steps;
create policy pick_steps_update_scoped
on public.pick_steps
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));
