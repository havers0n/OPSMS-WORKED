begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  site_a uuid := gen_random_uuid();
  floor_a uuid := gen_random_uuid();
  published_lv uuid := gen_random_uuid();
  draft_lv uuid := gen_random_uuid();
  archived_lv uuid := gen_random_uuid();
  published_rack uuid := gen_random_uuid();
  published_face uuid := gen_random_uuid();
  published_section uuid := gen_random_uuid();
  published_level uuid := gen_random_uuid();
  draft_rack uuid := gen_random_uuid();
  draft_face uuid := gen_random_uuid();
  draft_section uuid := gen_random_uuid();
  draft_level uuid := gen_random_uuid();
  row_count integer;
  all_from_published boolean;
  ordered_codes text[];
begin
  if has_function_privilege('anon', 'public.list_published_cells_by_floor(uuid, integer, integer)', 'execute') then
    raise exception 'RPC15-0 FAIL: anon must not be able to execute list_published_cells_by_floor.';
  end if;

  if not has_function_privilege('authenticated', 'public.list_published_cells_by_floor(uuid, integer, integer)', 'execute') then
    raise exception 'RPC15-0 FAIL: authenticated must be able to execute list_published_cells_by_floor.';
  end if;

  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'RPC15-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'RPC 15 Tenant A'),
    (tenant_b, 'RPC15-B-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'RPC 15 Tenant B');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values
    (user_a, 'rpc15-a@wos.test', now(), now(), now(), false, '{}', '{}'),
    (user_b, 'rpc15-b@wos.test', now(), now(), now(), false, '{}', '{}');

  insert into public.tenant_members (tenant_id, profile_id, role)
  values
    (tenant_a, user_a, 'operator'),
    (tenant_b, user_b, 'operator')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (site_a, tenant_a, 'RPC15-S-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'RPC 15 Site', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values (floor_a, site_a, 'RPC15-F', 'RPC 15 Floor', 1);

  insert into public.layout_versions (id, floor_id, version_no, state, published_at)
  values
    (published_lv, floor_a, 1, 'published', now()),
    (draft_lv, floor_a, 2, 'draft', null),
    (archived_lv, floor_a, 3, 'archived', now());

  insert into public.racks (id, layout_version_id, display_code, kind, axis, x, y, total_length, depth, rotation_deg, state)
  values
    (published_rack, published_lv, 'R01', 'single', 'NS', 0, 0, 100, 10, 0, 'published'),
    (draft_rack, draft_lv, 'R01', 'single', 'NS', 0, 0, 100, 10, 0, 'draft');

  insert into public.rack_faces (id, rack_id, side, enabled, slot_numbering_direction)
  values
    (published_face, published_rack, 'A', true, 'ltr'),
    (draft_face, draft_rack, 'A', true, 'ltr');

  insert into public.rack_sections (id, rack_face_id, ordinal, length)
  values
    (published_section, published_face, 1, 100),
    (draft_section, draft_face, 1, 100);

  insert into public.rack_levels (id, rack_section_id, ordinal, slot_count)
  values
    (published_level, published_section, 1, 4),
    (draft_level, draft_section, 1, 1);

  insert into public.cells (
    id, layout_version_id, rack_id, rack_face_id, rack_section_id, rack_level_id,
    slot_no, address, address_sort_key, cell_code, x, y, status
  )
  values
    (gen_random_uuid(), published_lv, published_rack, published_face, published_section, published_level, 1, 'R01-A.01.01.02', '0001-A-01-01-01', 'CELL-B', 1, 1, 'active'),
    (gen_random_uuid(), published_lv, published_rack, published_face, published_section, published_level, 2, 'R01-A.01.01.01', '0001-A-01-01-01', 'CELL-A', 2, 1, 'active'),
    (gen_random_uuid(), published_lv, published_rack, published_face, published_section, published_level, 3, 'R01-A.01.01.03', '0001-A-01-01-03', 'CELL-C', 3, 1, 'active'),
    (gen_random_uuid(), draft_lv, draft_rack, draft_face, draft_section, draft_level, 1, 'DRAFT-A.01.01.01', '0000-A-01-01-01', 'DRAFT-CELL', 4, 1, 'active');

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*), bool_and(layout_version_id = published_lv)
  into row_count, all_from_published
  from public.list_published_cells_by_floor(floor_a, 1000, 0);

  if row_count <> 3 then
    raise exception 'RPC15-1 FAIL: expected 3 own-tenant published cells, got %', row_count;
  end if;

  if all_from_published is distinct from true then
    raise exception 'RPC15-2 FAIL: expected only latest published layout version cells.';
  end if;

  select array_agg(cell_code order by ordinal)
  into ordered_codes
  from (
    select row_number() over () as ordinal, cell_code
    from public.list_published_cells_by_floor(floor_a, 1000, 0)
  ) ordered;

  if ordered_codes <> array['CELL-A', 'CELL-B', 'CELL-C']::text[] then
    raise exception 'RPC15-3 FAIL: expected stable address_sort_key/cell_code order, got %', ordered_codes;
  end if;

  execute 'reset role';

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_b::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  begin
    perform count(*) from public.list_published_cells_by_floor(floor_a, 1000, 0);
    raise exception 'RPC15-4 FAIL: expected cross-tenant access to be denied.';
  exception
    when insufficient_privilege then
      null;
  end;

  execute 'reset role';
end;
$$;

rollback;
