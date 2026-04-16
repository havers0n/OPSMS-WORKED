begin;

set local search_path to public;

insert into public.tenants (id, code, name)
values ('70000000-0000-4000-8000-000000000001'::uuid, 'SQLTEST_0084', 'SQL Test 0084')
on conflict (id) do nothing;

insert into public.sites (id, tenant_id, code, name, timezone)
values (
  '70000000-0000-4000-8000-000000000002'::uuid,
  '70000000-0000-4000-8000-000000000001'::uuid,
  'SQL0084',
  'SQL 0084 Site',
  'Asia/Jerusalem'
)
on conflict (id) do nothing;

insert into public.floors (id, site_id, code, name, sort_order)
values (
  '70000000-0000-4000-8000-000000000003'::uuid,
  '70000000-0000-4000-8000-000000000002'::uuid,
  'F0084',
  'Floor 0084',
  0
)
on conflict (id) do nothing;

insert into public.layout_versions (id, floor_id, version_no, state)
values (
  '70000000-0000-4000-8000-000000000004'::uuid,
  '70000000-0000-4000-8000-000000000003'::uuid,
  1,
  'draft'
)
on conflict (id) do nothing;

insert into public.racks (
  id,
  layout_version_id,
  display_code,
  kind,
  axis,
  x,
  y,
  total_length,
  depth,
  rotation_deg,
  state
)
values (
  '70000000-0000-4000-8000-000000000005'::uuid,
  '70000000-0000-4000-8000-000000000004'::uuid,
  'R0084',
  'paired',
  'NS',
  0,
  0,
  5,
  1,
  0,
  'draft'
)
on conflict (id) do nothing;

-- Legacy-compatible inserts without face_mode should still hydrate canonical mode.
insert into public.rack_faces (
  id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id
)
values (
  '70000000-0000-4000-8000-000000000006'::uuid,
  '70000000-0000-4000-8000-000000000005'::uuid,
  'A',
  true,
  'ltr',
  false,
  null
);

insert into public.rack_faces (
  id, rack_id, side, enabled, slot_numbering_direction, is_mirrored, mirror_source_face_id
)
values (
  '70000000-0000-4000-8000-000000000007'::uuid,
  '70000000-0000-4000-8000-000000000005'::uuid,
  'B',
  true,
  'rtl',
  true,
  '70000000-0000-4000-8000-000000000006'::uuid
);

do $$
declare
  face_a_mode text;
  face_b_mode text;
  face_b_mirror boolean;
  face_b_source uuid;
  level_default text;
begin
  select face_mode into face_a_mode
  from public.rack_faces
  where id = '70000000-0000-4000-8000-000000000006'::uuid;

  if face_a_mode <> 'independent' then
    raise exception 'Expected face A face_mode independent, got %', face_a_mode;
  end if;

  select face_mode into face_b_mode
  from public.rack_faces
  where id = '70000000-0000-4000-8000-000000000007'::uuid;

  if face_b_mode <> 'mirrored' then
    raise exception 'Expected face B face_mode mirrored, got %', face_b_mode;
  end if;

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values (
    '70000000-0000-4000-8000-000000000008'::uuid,
    '70000000-0000-4000-8000-000000000006'::uuid,
    1,
    5
  );

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values (
    '70000000-0000-4000-8000-000000000009'::uuid,
    '70000000-0000-4000-8000-000000000008'::uuid,
    1,
    2
  );

  select structural_default_role into level_default
  from public.rack_levels
  where id = '70000000-0000-4000-8000-000000000009'::uuid;

  if level_default <> 'none' then
    raise exception 'Expected structural_default_role default none, got %', level_default;
  end if;

  update public.rack_faces
  set face_mode = 'independent'
  where id = '70000000-0000-4000-8000-000000000007'::uuid;

  select is_mirrored, mirror_source_face_id
    into face_b_mirror, face_b_source
  from public.rack_faces
  where id = '70000000-0000-4000-8000-000000000007'::uuid;

  if face_b_mirror is distinct from false then
    raise exception 'Expected legacy is_mirrored=false after independent mode sync';
  end if;

  if face_b_source is not null then
    raise exception 'Expected mirror_source_face_id null after independent mode sync';
  end if;
end
$$;

rollback;
