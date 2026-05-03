begin;

create or replace function pg_temp.create_publish_guard_fixture(label text)
returns table (
  tenant_id uuid,
  floor_id uuid,
  published_layout_id uuid,
  first_location_id uuid,
  first_location_code text,
  first_slot_id uuid,
  second_location_id uuid,
  second_location_code text,
  second_slot_id uuid
)
language plpgsql
as $$
declare
  tenant_uuid uuid;
  site_uuid uuid := gen_random_uuid();
  floor_uuid uuid := gen_random_uuid();
  draft_uuid uuid;
  rack_uuid uuid := gen_random_uuid();
  face_uuid uuid := gen_random_uuid();
  section_uuid uuid := gen_random_uuid();
  level_uuid uuid := gen_random_uuid();
  cell_one record;
  cell_two record;
begin
  select id
  into tenant_uuid
  from public.tenants
  where code = 'default';

  if tenant_uuid is null then
    raise exception 'Expected default tenant to exist.';
  end if;

  insert into public.sites (id, tenant_id, code, name, timezone)
  values (
    site_uuid,
    tenant_uuid,
    'P1G-' || upper(substring(replace(site_uuid::text, '-', '') from 1 for 10)),
    'Phase 1 Guard ' || label,
    'UTC'
  );

  insert into public.floors (id, site_id, code, name, sort_order)
  values (
    floor_uuid,
    site_uuid,
    'P1G-' || upper(substring(replace(floor_uuid::text, '-', '') from 1 for 10)),
    'Phase 1 Guard ' || label,
    1
  );

  draft_uuid := public.create_layout_draft(floor_uuid, null);

  perform public.save_layout_draft(
    jsonb_build_object(
      'layoutVersionId', draft_uuid,
      'floorId', floor_uuid::text,
      'racks', jsonb_build_array(
        jsonb_build_object(
          'id', rack_uuid,
          'displayCode', '01',
          'kind', 'single',
          'axis', 'NS',
          'x', 10,
          'y', 20,
          'totalLength', 5,
          'depth', 1.1,
          'rotationDeg', 0,
          'faces', jsonb_build_array(
            jsonb_build_object(
              'id', face_uuid,
              'side', 'A',
              'enabled', true,
              'slotNumberingDirection', 'ltr',
              'isMirrored', false,
              'mirrorSourceFaceId', null,
              'sections', jsonb_build_array(
                jsonb_build_object(
                  'id', section_uuid,
                  'ordinal', 1,
                  'length', 5,
                  'levels', jsonb_build_array(
                    jsonb_build_object(
                      'id', level_uuid,
                      'ordinal', 1,
                      'slotCount', 2
                    )
                  )
                )
              )
            )
          )
        )
      )
    ),
    null
  );

  perform public.publish_layout_version(draft_uuid, null);

  select c.id, coalesce(c.address, c.cell_code) as code
  into cell_one
  from public.cells c
  where c.layout_version_id = draft_uuid
  order by c.slot_no
  limit 1;

  select c.id, coalesce(c.address, c.cell_code) as code
  into cell_two
  from public.cells c
  where c.layout_version_id = draft_uuid
  order by c.slot_no
  offset 1
  limit 1;

  if cell_one.id is null or cell_two.id is null then
    raise exception 'Expected two published cells for fixture %.', label;
  end if;

  return query
  select
    tenant_uuid,
    floor_uuid,
    draft_uuid,
    l1.id,
    cell_one.code,
    cell_one.id,
    l2.id,
    cell_two.code,
    cell_two.id
  from public.locations l1
  join public.locations l2
    on l2.floor_id = floor_uuid
   and l2.code = cell_two.code
  where l1.floor_id = floor_uuid
    and l1.code = cell_one.code;
end
$$;

create or replace function pg_temp.delete_second_slot_from_draft(draft_uuid uuid)
returns void
language sql
as $$
  update public.rack_levels rl
  set slot_count = 1
  from public.rack_sections rs
  join public.rack_faces rf on rf.id = rs.rack_face_id
  join public.racks r on r.id = rf.rack_id
  where rl.rack_section_id = rs.id
    and r.layout_version_id = draft_uuid;
$$;

create or replace function pg_temp.expect_destructive_publish_blocked(draft_uuid uuid, expected_fragment text)
returns void
language plpgsql
as $$
begin
  perform public.publish_layout_version(draft_uuid, null);
  raise exception 'Expected publish % to be blocked.', draft_uuid;
exception
  when others then
    if position('PUBLISH_LAYOUT_DESTRUCTIVE_LOCATION_BLOCKED' in sqlerrm) = 0
      or position(expected_fragment in sqlerrm) = 0 then
      raise;
    end if;
end
$$;

do $$
declare
  actor_uuid uuid := gen_random_uuid();
  fixture record;
  draft_uuid uuid;
  location_id_after uuid;
  slot_id_after uuid;
  published_count integer;
  container_type_uuid uuid;
  product_uuid uuid;
begin
  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    actor_uuid, 'phase1-publish-guard@wos.test', now(), now(), now(),
    false, '{}', '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  select t.id, actor_uuid, 'tenant_admin'
  from public.tenants t
  where t.code = 'default'
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_uuid::text)::text,
    true
  );

  select id
  into container_type_uuid
  from public.container_types
  where code = 'bin';

  if container_type_uuid is null then
    raise exception 'Expected bin container type to exist.';
  end if;

  -- 1. Republish unchanged address preserves location.id and remaps geometry_slot_id.
  select * into fixture from pg_temp.create_publish_guard_fixture('unchanged');
  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform public.publish_layout_version(draft_uuid, null);

  select l.id, l.geometry_slot_id
  into location_id_after, slot_id_after
  from public.locations l
  where l.floor_id = fixture.floor_id
    and l.code = fixture.first_location_code;

  if location_id_after is distinct from fixture.first_location_id then
    raise exception 'Unchanged republish must preserve locations.id.';
  end if;

  if slot_id_after is null or slot_id_after = fixture.first_slot_id then
    raise exception 'Unchanged republish must update geometry_slot_id to the new cell.';
  end if;

  -- 2. Republish moved same-code slot succeeds.
  draft_uuid := public.create_layout_draft(fixture.floor_id, null);

  update public.racks
  set x = x + 100,
      y = y + 50
  where layout_version_id = draft_uuid;

  perform public.publish_layout_version(draft_uuid, null);

  if (
    select l.id
    from public.locations l
    where l.floor_id = fixture.floor_id
      and l.code = fixture.first_location_code
  ) is distinct from fixture.first_location_id then
    raise exception 'Moved same-code slot must keep the canonical location row.';
  end if;

  -- 3. Republish deleted occupied slot is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('deleted occupied');

  insert into public.containers (tenant_id, external_code, container_type_id, status, current_location_id)
  values (fixture.tenant_id, 'P1G-OCC-' || substring(fixture.floor_id::text from 1 for 8), container_type_uuid, 'active', fixture.second_location_id);

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'containers.current_location_id');

  if (select state from public.layout_versions where id = fixture.published_layout_id) <> 'published' then
    raise exception 'Blocked occupied deletion must leave the previous layout published.';
  end if;

  -- 4. Republish renamed occupied slot is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('renamed occupied');

  insert into public.containers (tenant_id, external_code, container_type_id, status, current_location_id)
  values (fixture.tenant_id, 'P1G-REN-' || substring(fixture.floor_id::text from 1 for 8), container_type_uuid, 'active', fixture.first_location_id);

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);

  update public.racks
  set display_code = '77'
  where layout_version_id = draft_uuid;

  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'containers.current_location_id');

  -- 5. Republish deleted location with product_location_roles is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('product role');
  product_uuid := gen_random_uuid();

  insert into public.products (id, source, external_product_id, sku, name)
  values (product_uuid, 'phase1-guard', product_uuid::text, 'P1G-ROLE', 'Phase 1 Role Product');

  insert into public.product_location_roles (tenant_id, product_id, location_id, role, state)
  values (fixture.tenant_id, product_uuid, fixture.second_location_id, 'primary_pick', 'published');

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'product_location_roles.location_id');

  -- 6. Republish deleted location with sku_location_policies is blocked.
  select * into fixture from pg_temp.create_publish_guard_fixture('sku policy');
  product_uuid := gen_random_uuid();

  insert into public.products (id, source, external_product_id, sku, name)
  values (product_uuid, 'phase1-guard', product_uuid::text, 'P1G-SKU', 'Phase 1 SKU Policy Product');

  insert into public.sku_location_policies (tenant_id, location_id, product_id, min_qty_each, max_qty_each, status)
  values (fixture.tenant_id, fixture.second_location_id, product_uuid, 1, 10, 'active');

  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform pg_temp.expect_destructive_publish_blocked(draft_uuid, 'sku_location_policies.location_id');

  -- 7. Republish deleted empty slot does not block.
  select * into fixture from pg_temp.create_publish_guard_fixture('deleted empty');
  draft_uuid := public.create_layout_draft(fixture.floor_id, null);
  perform pg_temp.delete_second_slot_from_draft(draft_uuid);
  perform public.publish_layout_version(draft_uuid, null);

  select count(*)
  into published_count
  from public.layout_versions
  where floor_id = fixture.floor_id
    and state = 'published';

  if published_count <> 1 then
    raise exception 'Deleted empty slot publish should leave exactly one published layout.';
  end if;

  if (select state from public.layout_versions where id = draft_uuid) <> 'published' then
    raise exception 'Deleted empty slot draft should publish successfully.';
  end if;
end
$$;

rollback;
