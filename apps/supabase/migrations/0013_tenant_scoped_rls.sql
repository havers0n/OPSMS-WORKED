-- 0013_tenant_scoped_rls.sql

grant select on public.tenants to authenticated;
grant select on public.tenant_members to authenticated;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

drop policy if exists tenants_select_scoped on public.tenants;
create policy tenants_select_scoped
on public.tenants
for select
to authenticated
using (public.can_access_tenant(id));

drop policy if exists tenant_members_select_scoped on public.tenant_members;
create policy tenant_members_select_scoped
on public.tenant_members
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.can_access_tenant(tenant_id)
);

drop policy if exists sites_authenticated_all on public.sites;
drop policy if exists floors_authenticated_all on public.floors;
drop policy if exists layout_versions_authenticated_all on public.layout_versions;
drop policy if exists racks_authenticated_all on public.racks;
drop policy if exists rack_faces_authenticated_all on public.rack_faces;
drop policy if exists rack_sections_authenticated_all on public.rack_sections;
drop policy if exists rack_levels_authenticated_all on public.rack_levels;
drop policy if exists cells_authenticated_all on public.cells;
drop policy if exists operation_events_authenticated_read on public.operation_events;
drop policy if exists operation_events_authenticated_insert on public.operation_events;

drop policy if exists sites_select_scoped on public.sites;
create policy sites_select_scoped
on public.sites
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists sites_insert_scoped on public.sites;
create policy sites_insert_scoped
on public.sites
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists sites_update_scoped on public.sites;
create policy sites_update_scoped
on public.sites
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));

drop policy if exists sites_delete_scoped on public.sites;
create policy sites_delete_scoped
on public.sites
for delete
to authenticated
using (public.can_manage_tenant(tenant_id));

drop policy if exists floors_select_scoped on public.floors;
create policy floors_select_scoped
on public.floors
for select
to authenticated
using (public.can_access_site(site_id));

drop policy if exists floors_insert_scoped on public.floors;
create policy floors_insert_scoped
on public.floors
for insert
to authenticated
with check (public.can_manage_site(site_id));

drop policy if exists floors_update_scoped on public.floors;
create policy floors_update_scoped
on public.floors
for update
to authenticated
using (public.can_manage_site(site_id))
with check (public.can_manage_site(site_id));

drop policy if exists floors_delete_scoped on public.floors;
create policy floors_delete_scoped
on public.floors
for delete
to authenticated
using (public.can_manage_site(site_id));

drop policy if exists layout_versions_select_scoped on public.layout_versions;
create policy layout_versions_select_scoped
on public.layout_versions
for select
to authenticated
using (public.can_access_floor(floor_id));

drop policy if exists layout_versions_insert_scoped on public.layout_versions;
create policy layout_versions_insert_scoped
on public.layout_versions
for insert
to authenticated
with check (public.can_manage_floor(floor_id));

drop policy if exists layout_versions_update_scoped on public.layout_versions;
create policy layout_versions_update_scoped
on public.layout_versions
for update
to authenticated
using (public.can_manage_floor(floor_id))
with check (public.can_manage_floor(floor_id));

drop policy if exists layout_versions_delete_scoped on public.layout_versions;
create policy layout_versions_delete_scoped
on public.layout_versions
for delete
to authenticated
using (public.can_manage_floor(floor_id));

drop policy if exists racks_select_scoped on public.racks;
create policy racks_select_scoped
on public.racks
for select
to authenticated
using (public.can_access_layout_version(layout_version_id));

drop policy if exists racks_insert_scoped on public.racks;
create policy racks_insert_scoped
on public.racks
for insert
to authenticated
with check (public.can_manage_layout_version(layout_version_id));

drop policy if exists racks_update_scoped on public.racks;
create policy racks_update_scoped
on public.racks
for update
to authenticated
using (public.can_manage_layout_version(layout_version_id))
with check (public.can_manage_layout_version(layout_version_id));

drop policy if exists racks_delete_scoped on public.racks;
create policy racks_delete_scoped
on public.racks
for delete
to authenticated
using (public.can_manage_layout_version(layout_version_id));

drop policy if exists rack_faces_select_scoped on public.rack_faces;
create policy rack_faces_select_scoped
on public.rack_faces
for select
to authenticated
using (public.can_access_rack(rack_id));

drop policy if exists rack_faces_insert_scoped on public.rack_faces;
create policy rack_faces_insert_scoped
on public.rack_faces
for insert
to authenticated
with check (public.can_manage_rack(rack_id));

drop policy if exists rack_faces_update_scoped on public.rack_faces;
create policy rack_faces_update_scoped
on public.rack_faces
for update
to authenticated
using (public.can_manage_rack(rack_id))
with check (public.can_manage_rack(rack_id));

drop policy if exists rack_faces_delete_scoped on public.rack_faces;
create policy rack_faces_delete_scoped
on public.rack_faces
for delete
to authenticated
using (public.can_manage_rack(rack_id));

drop policy if exists rack_sections_select_scoped on public.rack_sections;
create policy rack_sections_select_scoped
on public.rack_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.rack_faces rf
    where rf.id = rack_face_id
      and public.can_access_rack(rf.rack_id)
  )
);

drop policy if exists rack_sections_insert_scoped on public.rack_sections;
create policy rack_sections_insert_scoped
on public.rack_sections
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rack_faces rf
    where rf.id = rack_face_id
      and public.can_manage_rack(rf.rack_id)
  )
);

drop policy if exists rack_sections_update_scoped on public.rack_sections;
create policy rack_sections_update_scoped
on public.rack_sections
for update
to authenticated
using (
  exists (
    select 1
    from public.rack_faces rf
    where rf.id = rack_face_id
      and public.can_manage_rack(rf.rack_id)
  )
)
with check (
  exists (
    select 1
    from public.rack_faces rf
    where rf.id = rack_face_id
      and public.can_manage_rack(rf.rack_id)
  )
);

drop policy if exists rack_sections_delete_scoped on public.rack_sections;
create policy rack_sections_delete_scoped
on public.rack_sections
for delete
to authenticated
using (
  exists (
    select 1
    from public.rack_faces rf
    where rf.id = rack_face_id
      and public.can_manage_rack(rf.rack_id)
  )
);

drop policy if exists rack_levels_select_scoped on public.rack_levels;
create policy rack_levels_select_scoped
on public.rack_levels
for select
to authenticated
using (
  exists (
    select 1
    from public.rack_sections rs
    join public.rack_faces rf on rf.id = rs.rack_face_id
    where rs.id = rack_section_id
      and public.can_access_rack(rf.rack_id)
  )
);

drop policy if exists rack_levels_insert_scoped on public.rack_levels;
create policy rack_levels_insert_scoped
on public.rack_levels
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rack_sections rs
    join public.rack_faces rf on rf.id = rs.rack_face_id
    where rs.id = rack_section_id
      and public.can_manage_rack(rf.rack_id)
  )
);

drop policy if exists rack_levels_update_scoped on public.rack_levels;
create policy rack_levels_update_scoped
on public.rack_levels
for update
to authenticated
using (
  exists (
    select 1
    from public.rack_sections rs
    join public.rack_faces rf on rf.id = rs.rack_face_id
    where rs.id = rack_section_id
      and public.can_manage_rack(rf.rack_id)
  )
)
with check (
  exists (
    select 1
    from public.rack_sections rs
    join public.rack_faces rf on rf.id = rs.rack_face_id
    where rs.id = rack_section_id
      and public.can_manage_rack(rf.rack_id)
  )
);

drop policy if exists rack_levels_delete_scoped on public.rack_levels;
create policy rack_levels_delete_scoped
on public.rack_levels
for delete
to authenticated
using (
  exists (
    select 1
    from public.rack_sections rs
    join public.rack_faces rf on rf.id = rs.rack_face_id
    where rs.id = rack_section_id
      and public.can_manage_rack(rf.rack_id)
  )
);

drop policy if exists cells_select_scoped on public.cells;
create policy cells_select_scoped
on public.cells
for select
to authenticated
using (public.can_access_layout_version(layout_version_id));

drop policy if exists cells_insert_scoped on public.cells;
create policy cells_insert_scoped
on public.cells
for insert
to authenticated
with check (public.can_manage_layout_version(layout_version_id));

drop policy if exists cells_update_scoped on public.cells;
create policy cells_update_scoped
on public.cells
for update
to authenticated
using (public.can_manage_layout_version(layout_version_id))
with check (public.can_manage_layout_version(layout_version_id));

drop policy if exists cells_delete_scoped on public.cells;
create policy cells_delete_scoped
on public.cells
for delete
to authenticated
using (public.can_manage_layout_version(layout_version_id));

drop policy if exists operation_events_select_scoped on public.operation_events;
create policy operation_events_select_scoped
on public.operation_events
for select
to authenticated
using (
  public.is_platform_admin()
  or (
    site_id is not null
    and public.can_access_site(site_id)
  )
  or (
    floor_id is not null
    and public.can_access_floor(floor_id)
  )
  or (
    layout_version_id is not null
    and public.can_access_layout_version(layout_version_id)
  )
);

drop policy if exists operation_events_insert_scoped on public.operation_events;
create policy operation_events_insert_scoped
on public.operation_events
for insert
to authenticated
with check (
  public.is_platform_admin()
  or (
    site_id is not null
    and public.can_access_site(site_id)
  )
  or (
    floor_id is not null
    and public.can_access_floor(floor_id)
  )
  or (
    layout_version_id is not null
    and public.can_access_layout_version(layout_version_id)
  )
);
