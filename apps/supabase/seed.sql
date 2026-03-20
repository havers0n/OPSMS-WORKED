-- Local development seed for authenticated warehouse workspaces.

insert into public.tenants (code, name)
values ('default', 'Default Tenant')
on conflict (code) do nothing;
