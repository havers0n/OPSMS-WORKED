-- 0104_storage_preset_write_policies.sql
--
-- Storage preset authoring writes canonical packaging profile rows. The PR5
-- closure made these master-data tables readable only; product detail storage
-- preset creation and update require tenant-scoped write policies too.

drop policy if exists packaging_profiles_insert_scoped on public.packaging_profiles;
create policy packaging_profiles_insert_scoped
on public.packaging_profiles
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists packaging_profiles_update_scoped on public.packaging_profiles;
create policy packaging_profiles_update_scoped
on public.packaging_profiles
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists packaging_profile_levels_insert_scoped on public.packaging_profile_levels;
create policy packaging_profile_levels_insert_scoped
on public.packaging_profile_levels
for insert
to authenticated
with check (
  exists (
    select 1
    from public.packaging_profiles pp
    where pp.id = packaging_profile_levels.profile_id
      and public.can_manage_tenant(pp.tenant_id)
  )
);

drop policy if exists packaging_profile_levels_update_scoped on public.packaging_profile_levels;
create policy packaging_profile_levels_update_scoped
on public.packaging_profile_levels
for update
to authenticated
using (
  exists (
    select 1
    from public.packaging_profiles pp
    where pp.id = packaging_profile_levels.profile_id
      and public.can_manage_tenant(pp.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.packaging_profiles pp
    where pp.id = packaging_profile_levels.profile_id
      and public.can_manage_tenant(pp.tenant_id)
  )
);

drop policy if exists packaging_profile_levels_delete_scoped on public.packaging_profile_levels;
create policy packaging_profile_levels_delete_scoped
on public.packaging_profile_levels
for delete
to authenticated
using (
  exists (
    select 1
    from public.packaging_profiles pp
    where pp.id = packaging_profile_levels.profile_id
      and public.can_manage_tenant(pp.tenant_id)
  )
);
