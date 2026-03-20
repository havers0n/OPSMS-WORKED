-- 0012_auth_scope_helpers.sql

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.profile_id = auth.uid()
      and tm.role = 'platform_admin'
  )
$$;

create or replace function public.can_access_tenant(tenant_uuid uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = tenant_uuid
        and tm.profile_id = auth.uid()
    )
$$;

create or replace function public.can_manage_tenant(tenant_uuid uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = tenant_uuid
        and tm.profile_id = auth.uid()
        and tm.role = 'tenant_admin'
    )
$$;

create or replace function public.can_access_site(site_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = site_uuid
      and public.can_access_tenant(s.tenant_id)
  )
$$;

create or replace function public.can_manage_site(site_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = site_uuid
      and public.can_manage_tenant(s.tenant_id)
  )
$$;

create or replace function public.can_access_floor(floor_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.floors f
    join public.sites s on s.id = f.site_id
    where f.id = floor_uuid
      and public.can_access_tenant(s.tenant_id)
  )
$$;

create or replace function public.can_manage_floor(floor_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.floors f
    join public.sites s on s.id = f.site_id
    where f.id = floor_uuid
      and public.can_manage_tenant(s.tenant_id)
  )
$$;

create or replace function public.can_access_layout_version(layout_version_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.layout_versions lv
    where lv.id = layout_version_uuid
      and public.can_access_floor(lv.floor_id)
  )
$$;

create or replace function public.can_manage_layout_version(layout_version_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.layout_versions lv
    where lv.id = layout_version_uuid
      and public.can_manage_floor(lv.floor_id)
  )
$$;

create or replace function public.can_access_rack(rack_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.racks r
    where r.id = rack_uuid
      and public.can_access_layout_version(r.layout_version_id)
  )
$$;

create or replace function public.can_manage_rack(rack_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.racks r
    where r.id = rack_uuid
      and public.can_manage_layout_version(r.layout_version_id)
  )
$$;

create or replace function public.can_publish_floor(floor_uuid uuid)
returns boolean
language sql
stable
as $$
  select public.can_manage_floor(floor_uuid)
$$;
