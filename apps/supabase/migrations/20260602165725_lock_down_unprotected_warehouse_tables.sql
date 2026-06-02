alter table public.face_access enable row level security;
alter table public.location_policies enable row level security;
alter table public.pick_aisles enable row level security;
alter table public.sku_location_policies enable row level security;
alter table public.product_packaging_levels enable row level security;
alter table public.product_unit_profiles enable row level security;

drop policy if exists face_access_select_scoped on public.face_access;
create policy face_access_select_scoped
on public.face_access
for select
to authenticated
using (
  public.can_access_rack(rack_id)
);

drop policy if exists face_access_insert_scoped on public.face_access;
create policy face_access_insert_scoped
on public.face_access
for insert
to authenticated
with check (
  public.can_manage_rack(rack_id)
  and (
    tenant_id is null
    or exists (
      select 1
      from public.racks r
      join public.layout_versions lv on lv.id = r.layout_version_id
      join public.floors f on f.id = lv.floor_id
      join public.sites s on s.id = f.site_id
      where r.id = rack_id
        and s.tenant_id = tenant_id
    )
  )
);

drop policy if exists face_access_update_scoped on public.face_access;
create policy face_access_update_scoped
on public.face_access
for update
to authenticated
using (
  public.can_manage_rack(rack_id)
  and (
    tenant_id is null
    or exists (
      select 1
      from public.racks r
      join public.layout_versions lv on lv.id = r.layout_version_id
      join public.floors f on f.id = lv.floor_id
      join public.sites s on s.id = f.site_id
      where r.id = rack_id
        and s.tenant_id = tenant_id
    )
  )
)
with check (
  public.can_manage_rack(rack_id)
  and (
    tenant_id is null
    or exists (
      select 1
      from public.racks r
      join public.layout_versions lv on lv.id = r.layout_version_id
      join public.floors f on f.id = lv.floor_id
      join public.sites s on s.id = f.site_id
      where r.id = rack_id
        and s.tenant_id = tenant_id
    )
  )
);

drop policy if exists face_access_delete_scoped on public.face_access;
create policy face_access_delete_scoped
on public.face_access
for delete
to authenticated
using (
  public.can_manage_rack(rack_id)
);

drop policy if exists location_policies_select_scoped on public.location_policies;
create policy location_policies_select_scoped
on public.location_policies
for select
to authenticated
using (
  public.can_access_tenant(tenant_id)
);

drop policy if exists location_policies_insert_scoped on public.location_policies;
create policy location_policies_insert_scoped
on public.location_policies
for insert
to authenticated
with check (
  public.can_manage_tenant(tenant_id)
  and exists (
    select 1
    from public.locations l
    where l.id = location_id
      and l.tenant_id = tenant_id
  )
);

drop policy if exists location_policies_update_scoped on public.location_policies;
create policy location_policies_update_scoped
on public.location_policies
for update
to authenticated
using (
  public.can_manage_tenant(tenant_id)
  and exists (
    select 1
    from public.locations l
    where l.id = location_id
      and l.tenant_id = tenant_id
  )
)
with check (
  public.can_manage_tenant(tenant_id)
  and exists (
    select 1
    from public.locations l
    where l.id = location_id
      and l.tenant_id = tenant_id
  )
);

drop policy if exists location_policies_delete_scoped on public.location_policies;
create policy location_policies_delete_scoped
on public.location_policies
for delete
to authenticated
using (
  public.can_manage_tenant(tenant_id)
);

drop policy if exists pick_aisles_select_scoped on public.pick_aisles;
create policy pick_aisles_select_scoped
on public.pick_aisles
for select
to authenticated
using (
  public.can_access_tenant(tenant_id)
  and public.can_access_floor(floor_id)
);

drop policy if exists pick_aisles_insert_scoped on public.pick_aisles;
create policy pick_aisles_insert_scoped
on public.pick_aisles
for insert
to authenticated
with check (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
  and exists (
    select 1
    from public.floors f
    join public.sites s on s.id = f.site_id
    where f.id = floor_id
      and s.tenant_id = tenant_id
  )
);

drop policy if exists pick_aisles_update_scoped on public.pick_aisles;
create policy pick_aisles_update_scoped
on public.pick_aisles
for update
to authenticated
using (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
  and exists (
    select 1
    from public.floors f
    join public.sites s on s.id = f.site_id
    where f.id = floor_id
      and s.tenant_id = tenant_id
  )
)
with check (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
  and exists (
    select 1
    from public.floors f
    join public.sites s on s.id = f.site_id
    where f.id = floor_id
      and s.tenant_id = tenant_id
  )
);

drop policy if exists pick_aisles_delete_scoped on public.pick_aisles;
create policy pick_aisles_delete_scoped
on public.pick_aisles
for delete
to authenticated
using (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
);

drop policy if exists sku_location_policies_select_scoped on public.sku_location_policies;
create policy sku_location_policies_select_scoped
on public.sku_location_policies
for select
to authenticated
using (
  public.can_access_tenant(tenant_id)
);

drop policy if exists sku_location_policies_insert_scoped on public.sku_location_policies;
create policy sku_location_policies_insert_scoped
on public.sku_location_policies
for insert
to authenticated
with check (
  public.can_manage_tenant(tenant_id)
  and exists (
    select 1
    from public.locations l
    where l.id = location_id
      and l.tenant_id = tenant_id
  )
  and (
    preferred_packaging_profile_id is null
    or exists (
      select 1
      from public.packaging_profiles pp
      where pp.id = preferred_packaging_profile_id
        and pp.tenant_id = tenant_id
    )
  )
);

drop policy if exists sku_location_policies_update_scoped on public.sku_location_policies;
create policy sku_location_policies_update_scoped
on public.sku_location_policies
for update
to authenticated
using (
  public.can_manage_tenant(tenant_id)
  and exists (
    select 1
    from public.locations l
    where l.id = location_id
      and l.tenant_id = tenant_id
  )
  and (
    preferred_packaging_profile_id is null
    or exists (
      select 1
      from public.packaging_profiles pp
      where pp.id = preferred_packaging_profile_id
        and pp.tenant_id = tenant_id
    )
  )
)
with check (
  public.can_manage_tenant(tenant_id)
  and exists (
    select 1
    from public.locations l
    where l.id = location_id
      and l.tenant_id = tenant_id
  )
  and (
    preferred_packaging_profile_id is null
    or exists (
      select 1
      from public.packaging_profiles pp
      where pp.id = preferred_packaging_profile_id
        and pp.tenant_id = tenant_id
    )
  )
);

drop policy if exists sku_location_policies_delete_scoped on public.sku_location_policies;
create policy sku_location_policies_delete_scoped
on public.sku_location_policies
for delete
to authenticated
using (
  public.can_manage_tenant(tenant_id)
);

drop policy if exists product_packaging_levels_select_authenticated on public.product_packaging_levels;
create policy product_packaging_levels_select_authenticated
on public.product_packaging_levels
for select
to authenticated
using (true);

drop policy if exists product_packaging_levels_insert_platform_admin on public.product_packaging_levels;
create policy product_packaging_levels_insert_platform_admin
on public.product_packaging_levels
for insert
to authenticated
with check (public.is_platform_admin());

drop policy if exists product_packaging_levels_update_platform_admin on public.product_packaging_levels;
create policy product_packaging_levels_update_platform_admin
on public.product_packaging_levels
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists product_packaging_levels_delete_platform_admin on public.product_packaging_levels;
create policy product_packaging_levels_delete_platform_admin
on public.product_packaging_levels
for delete
to authenticated
using (public.is_platform_admin());

drop policy if exists product_unit_profiles_select_authenticated on public.product_unit_profiles;
create policy product_unit_profiles_select_authenticated
on public.product_unit_profiles
for select
to authenticated
using (true);

drop policy if exists product_unit_profiles_insert_platform_admin on public.product_unit_profiles;
create policy product_unit_profiles_insert_platform_admin
on public.product_unit_profiles
for insert
to authenticated
with check (public.is_platform_admin());

drop policy if exists product_unit_profiles_update_platform_admin on public.product_unit_profiles;
create policy product_unit_profiles_update_platform_admin
on public.product_unit_profiles
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists product_unit_profiles_delete_platform_admin on public.product_unit_profiles;
create policy product_unit_profiles_delete_platform_admin
on public.product_unit_profiles
for delete
to authenticated
using (public.is_platform_admin());
