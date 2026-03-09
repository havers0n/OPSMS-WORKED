-- 0014_default_tenant_membership_provisioning.sql

create or replace function public.provision_default_tenant_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_tenant_uuid uuid;
  assigned_role text;
begin
  select id
  into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is not null then
    assigned_role := case
      when exists (
        select 1
        from public.tenant_members tm
        where tm.tenant_id = default_tenant_uuid
      ) then 'operator'
      else 'tenant_admin'
    end;

    insert into public.tenant_members (tenant_id, profile_id, role)
    values (default_tenant_uuid, new.id, assigned_role)
    on conflict (tenant_id, profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_created_provision_default_tenant on public.profiles;

create trigger on_profile_created_provision_default_tenant
after insert on public.profiles
for each row execute function public.provision_default_tenant_membership();
