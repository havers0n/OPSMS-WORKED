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

-- Deterministic layout-only demo warehouse.
--
-- Visual coordinate system:
-- - origin (0,0) is the top-left of rack 08
-- - X grows left-to-right, Y grows top-to-bottom
-- - vertical racks 08..01 are aligned to y=0
-- - 09 sits 4.80m below rack 05, 10 sits 2.45m below 09
--
-- Repo-native storage model:
-- - vertical racks are stored as axis='NS', rotation_deg=90 using the
--   verified unrotated origin that reproduces the agreed visual bounds
-- - horizontal racks are stored as axis='WE', rotation_deg=0
-- - this seed remains draft-first and structure-only:
--   racks + rack_faces + rack_sections + rack_levels
-- - cells/locations/inventory are intentionally not seeded here;
--   publish generates cells via regenerate_layout_cells()

create or replace function pg_temp.seed_uuid(seed text)
returns uuid
language sql
immutable
as $$
  select (
    substr(hex, 1, 8) || '-' ||
    substr(hex, 9, 4) || '-' ||
    substr(hex, 13, 4) || '-' ||
    substr(hex, 17, 4) || '-' ||
    substr(hex, 21, 12)
  )::uuid
  from (select md5(seed) as hex) hashed;
$$;

do $$
declare
  default_tenant_id uuid;
  demo_site_id constant uuid := 'd1000000-0000-4000-8000-000000000001'::uuid;
  demo_floor_id constant uuid := 'd2000000-0000-4000-8000-000000000001'::uuid;
  demo_layout_version_id constant uuid := 'd3000000-0000-4000-8000-000000000001'::uuid;
begin
  select id
  into default_tenant_id
  from public.tenants
  where code = 'default';

  if default_tenant_id is null then
    raise exception 'Default tenant must exist before seeding the demo warehouse layout.';
  end if;

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (demo_site_id, default_tenant_id, 'DEMO_LAYOUT', 'Demo Layout Site', 'Asia/Jerusalem')
  on conflict (id) do update
  set tenant_id = excluded.tenant_id,
      code = excluded.code,
      name = excluded.name,
      timezone = excluded.timezone;

  insert into public.floors (id, site_id, code, name, sort_order)
  values (demo_floor_id, demo_site_id, 'DL1', 'Demo Layout Floor', 0)
  on conflict (id) do update
  set site_id = excluded.site_id,
      code = excluded.code,
      name = excluded.name,
      sort_order = excluded.sort_order;

  insert into public.layout_versions (
    id, floor_id, version_no, draft_version, state,
    parent_published_version_id, created_by, published_by, published_at, archived_at
  )
  values (
    demo_layout_version_id, demo_floor_id, 1, 1, 'draft',
    null, null, null, null, null
  )
  on conflict (id) do update
  set floor_id = excluded.floor_id,
      version_no = excluded.version_no,
      draft_version = excluded.draft_version,
      state = excluded.state,
      parent_published_version_id = excluded.parent_published_version_id,
      created_by = excluded.created_by,
      published_by = excluded.published_by,
      published_at = excluded.published_at,
      archived_at = excluded.archived_at;

  delete from public.layout_walls
  where layout_version_id = demo_layout_version_id;

  delete from public.layout_zones
  where layout_version_id = demo_layout_version_id;

  delete from public.cells
  where layout_version_id = demo_layout_version_id;

  delete from public.rack_levels
  where rack_section_id in (
    select rs.id
    from public.rack_sections rs
    join public.rack_faces rf on rf.id = rs.rack_face_id
    join public.racks r on r.id = rf.rack_id
    where r.layout_version_id = demo_layout_version_id
  );

  delete from public.rack_sections
  where rack_face_id in (
    select rf.id
    from public.rack_faces rf
    join public.racks r on r.id = rf.rack_id
    where r.layout_version_id = demo_layout_version_id
  );

  set constraints rack_faces_mirror_consistency_trigger deferred;

  delete from public.rack_faces
  where rack_id in (
    select id
    from public.racks
    where layout_version_id = demo_layout_version_id
  );

  delete from public.racks
  where layout_version_id = demo_layout_version_id;

  insert into public.racks (
    id, layout_version_id, display_code, kind, axis,
    x, y, total_length, depth, rotation_deg, state
  )
  values
    ('a64f2f0b-2b4f-4f8b-9e9b-080808080808'::uuid, demo_layout_version_id, '08', 'single', 'NS', -12.000, 12.000, 25.000, 1.000, 90, 'draft'),
    ('a64f2f0b-2b4f-4f8b-9e9b-070707070707'::uuid, demo_layout_version_id, '07', 'paired', 'NS', -8.150, 12.850, 28.000, 2.300, 90, 'draft'),
    ('a64f2f0b-2b4f-4f8b-9e9b-060606060606'::uuid, demo_layout_version_id, '06', 'paired', 'NS', -1.450, 11.750, 26.000, 2.500, 90, 'draft'),
    ('a64f2f0b-2b4f-4f8b-9e9b-050505050505'::uuid, demo_layout_version_id, '05', 'paired', 'NS', 4.250, 11.750, 26.000, 2.500, 90, 'draft'),
    ('a64f2f0b-2b4f-4f8b-9e9b-040404040404'::uuid, demo_layout_version_id, '04', 'paired', 'NS', 9.750, 11.450, 25.200, 2.300, 90, 'draft'),
    ('a64f2f0b-2b4f-4f8b-9e9b-030303030303'::uuid, demo_layout_version_id, '03', 'paired', 'NS', 14.550, 11.500, 25.200, 2.200, 90, 'draft'),
    ('a64f2f0b-2b4f-4f8b-9e9b-020202020202'::uuid, demo_layout_version_id, '02', 'paired', 'NS', 25.050, 5.900, 14.000, 2.200, 90, 'draft'),
    ('a64f2f0b-2b4f-4f8b-9e9b-010101010101'::uuid, demo_layout_version_id, '01', 'single', 'NS', 27.850, 8.000, 17.000, 1.000, 90, 'draft'),
    ('a64f2f0b-2b4f-4f8b-9e9b-090909090909'::uuid, demo_layout_version_id, '09', 'single', 'WE', 16.000, 30.800, 17.000, 2.250, 0, 'draft'),
    ('a64f2f0b-2b4f-4f8b-9e9b-101010101010'::uuid, demo_layout_version_id, '10', 'single', 'WE', 16.000, 35.500, 18.000, 1.000, 0, 'draft');

  insert into public.rack_faces (
    id, rack_id, side, enabled, slot_numbering_direction,
    face_mode, is_mirrored, mirror_source_face_id, face_length
  )
  values
    ('a64f2f0b-2b4f-4f8b-9e9b-08aa08aa08aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-080808080808'::uuid, 'A', true, 'ltr', 'independent', false, null, null),

    ('a64f2f0b-2b4f-4f8b-9e9b-07aa07aa07aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-070707070707'::uuid, 'A', true, 'ltr', 'independent', false, null, null),
    ('a64f2f0b-2b4f-4f8b-9e9b-07bb07bb07bb'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-070707070707'::uuid, 'B', true, 'rtl', 'mirrored', true, 'a64f2f0b-2b4f-4f8b-9e9b-07aa07aa07aa'::uuid, null),

    ('a64f2f0b-2b4f-4f8b-9e9b-06aa06aa06aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-060606060606'::uuid, 'A', true, 'ltr', 'independent', false, null, null),
    ('a64f2f0b-2b4f-4f8b-9e9b-06bb06bb06bb'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-060606060606'::uuid, 'B', true, 'rtl', 'mirrored', true, 'a64f2f0b-2b4f-4f8b-9e9b-06aa06aa06aa'::uuid, null),

    ('a64f2f0b-2b4f-4f8b-9e9b-05aa05aa05aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-050505050505'::uuid, 'A', true, 'ltr', 'independent', false, null, null),
    ('a64f2f0b-2b4f-4f8b-9e9b-05bb05bb05bb'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-050505050505'::uuid, 'B', true, 'rtl', 'mirrored', true, 'a64f2f0b-2b4f-4f8b-9e9b-05aa05aa05aa'::uuid, null),

    ('a64f2f0b-2b4f-4f8b-9e9b-04aa04aa04aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-040404040404'::uuid, 'A', true, 'ltr', 'independent', false, null, null),
    ('a64f2f0b-2b4f-4f8b-9e9b-04bb04bb04bb'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-040404040404'::uuid, 'B', true, 'rtl', 'mirrored', true, 'a64f2f0b-2b4f-4f8b-9e9b-04aa04aa04aa'::uuid, null),

    ('a64f2f0b-2b4f-4f8b-9e9b-03aa03aa03aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-030303030303'::uuid, 'A', true, 'ltr', 'independent', false, null, null),
    ('a64f2f0b-2b4f-4f8b-9e9b-03bb03bb03bb'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-030303030303'::uuid, 'B', true, 'rtl', 'mirrored', true, 'a64f2f0b-2b4f-4f8b-9e9b-03aa03aa03aa'::uuid, null),

    ('a64f2f0b-2b4f-4f8b-9e9b-02aa02aa02aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-020202020202'::uuid, 'A', true, 'ltr', 'independent', false, null, null),
    ('a64f2f0b-2b4f-4f8b-9e9b-02bb02bb02bb'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-020202020202'::uuid, 'B', true, 'rtl', 'mirrored', true, 'a64f2f0b-2b4f-4f8b-9e9b-02aa02aa02aa'::uuid, null),

    ('a64f2f0b-2b4f-4f8b-9e9b-01aa01aa01aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-010101010101'::uuid, 'A', true, 'ltr', 'independent', false, null, null),
    ('a64f2f0b-2b4f-4f8b-9e9b-09aa09aa09aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-090909090909'::uuid, 'A', true, 'ltr', 'independent', false, null, null),
    ('a64f2f0b-2b4f-4f8b-9e9b-10aa10aa10aa'::uuid, 'a64f2f0b-2b4f-4f8b-9e9b-101010101010'::uuid, 'A', true, 'ltr', 'independent', false, null, null);

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  with rack_structure_spec(display_code, sections_per_face, levels_per_section, slots_per_level) as (
    values
      ('01', 6, 3, 3),
      ('02', 5, 3, 3),
      ('03', 9, 3, 3),
      ('04', 9, 3, 3),
      ('05', 9, 3, 3),
      ('06', 9, 3, 3),
      ('07', 10, 3, 3),
      ('08', 8, 3, 3),
      ('09', 6, 2, 3),
      ('10', 6, 2, 3)
  ),
  face_a as (
    select
      r.display_code,
      rf.id as rack_face_id,
      coalesce(rf.face_length, r.total_length) as target_length,
      spec.sections_per_face
    from public.racks r
    join public.rack_faces rf
      on rf.rack_id = r.id
     and rf.side = 'A'
    join rack_structure_spec spec
      on spec.display_code = r.display_code
    where r.layout_version_id = demo_layout_version_id
  )
  select
    pg_temp.seed_uuid(format('demo-layout:%s:face:A:section:%s', face_a.display_code, section_ordinal)),
    face_a.rack_face_id,
    section_ordinal,
    case
      when section_ordinal < face_a.sections_per_face
        then round(face_a.target_length / face_a.sections_per_face, 3)
      else face_a.target_length - (round(face_a.target_length / face_a.sections_per_face, 3) * (face_a.sections_per_face - 1))
    end
  from face_a
  cross join lateral generate_series(1, face_a.sections_per_face) as sections(section_ordinal);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count, structural_default_role)
  with rack_structure_spec(display_code, sections_per_face, levels_per_section, slots_per_level) as (
    values
      ('01', 6, 3, 3),
      ('02', 5, 3, 3),
      ('03', 9, 3, 3),
      ('04', 9, 3, 3),
      ('05', 9, 3, 3),
      ('06', 9, 3, 3),
      ('07', 10, 3, 3),
      ('08', 8, 3, 3),
      ('09', 6, 2, 3),
      ('10', 6, 2, 3)
  ),
  face_a as (
    select
      r.display_code,
      spec.sections_per_face,
      spec.levels_per_section,
      spec.slots_per_level
    from public.racks r
    join public.rack_faces rf
      on rf.rack_id = r.id
     and rf.side = 'A'
    join rack_structure_spec spec
      on spec.display_code = r.display_code
    where r.layout_version_id = demo_layout_version_id
  )
  select
    pg_temp.seed_uuid(format('demo-layout:%s:face:A:section:%s:level:%s', face_a.display_code, section_ordinal, level_ordinal)),
    pg_temp.seed_uuid(format('demo-layout:%s:face:A:section:%s', face_a.display_code, section_ordinal)),
    level_ordinal,
    face_a.slots_per_level,
    'none'
  from face_a
  cross join lateral generate_series(1, face_a.sections_per_face) as sections(section_ordinal)
  cross join lateral generate_series(1, face_a.levels_per_section) as levels(level_ordinal);
end
$$;
