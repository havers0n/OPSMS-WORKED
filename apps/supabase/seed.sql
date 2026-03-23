-- Local development seed for authenticated warehouse workspaces.

insert into public.tenants (code, name)
values ('default', 'Default Tenant')
on conflict (code) do nothing;

-- Ensure the primary dev account always has tenant_admin role.
-- The auto-provisioning trigger grants tenant_admin only to the first profile;
-- if admin@wos.local was not first, it lands as operator and cannot manage layouts.
update public.tenant_members
set role = 'tenant_admin'
where profile_id = (select id from auth.users where email = 'admin@wos.local')
  and role <> 'platform_admin';
