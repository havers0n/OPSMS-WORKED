-- 0015_tenant_member_policy_hardening.sql

drop policy if exists tenant_members_select_scoped on public.tenant_members;

create policy tenant_members_select_scoped
on public.tenant_members
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_platform_admin()
);
