begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  site_a uuid := gen_random_uuid();
  site_a_other uuid := gen_random_uuid();
  site_b uuid := gen_random_uuid();
  floor_a uuid := gen_random_uuid();
  floor_a_other uuid := gen_random_uuid();
  floor_b uuid := gen_random_uuid();
  node_a uuid := gen_random_uuid();
  node_b uuid := gen_random_uuid();
  node_c uuid := gen_random_uuid();
  node_isolated uuid := gen_random_uuid();
  node_tenant_b uuid := gen_random_uuid();
  node_floor_other uuid := gen_random_uuid();
  reverse_a uuid := gen_random_uuid();
  reverse_b uuid := gen_random_uuid();
  edge_ab uuid := gen_random_uuid();
  edge_bc uuid := gen_random_uuid();
  reverse_edge uuid := gen_random_uuid();
  location_a uuid := gen_random_uuid();
  path_count integer;
  path_edges uuid[];
  path_sources uuid[];
  path_targets uuid[];
  path_agg_costs numeric[];
  reverse_points jsonb;
begin
  insert into public.tenants (id, code, name)
  values
    (tenant_a, 'FRG-A-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Floor Route Graph Tenant A'),
    (tenant_b, 'FRG-B-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'Floor Route Graph Tenant B');

  insert into auth.users (
    id, email, email_confirmed_at, created_at, updated_at,
    is_sso_user, raw_app_meta_data, raw_user_meta_data
  )
  values (
    user_a,
    'floor-route-graph-a@wos.test',
    now(),
    now(),
    now(),
    false,
    '{}',
    '{}'
  );

  insert into public.tenant_members (tenant_id, profile_id, role)
  values (tenant_a, user_a, 'tenant_admin')
  on conflict (tenant_id, profile_id) do update set role = excluded.role;

  insert into public.sites (id, tenant_id, code, name, timezone)
  values
    (site_a, tenant_a, 'FRG-SA-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'FRG Site A', 'UTC'),
    (site_a_other, tenant_a, 'FRG-SAO-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'FRG Site A Other', 'UTC'),
    (site_b, tenant_b, 'FRG-SB-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8), 'FRG Site B', 'UTC');

  insert into public.floors (id, site_id, code, name, sort_order)
  values
    (floor_a, site_a, 'FRG-F-A', 'FRG Floor A', 1),
    (floor_a_other, site_a_other, 'FRG-F-A2', 'FRG Floor A Other', 2),
    (floor_b, site_b, 'FRG-F-B', 'FRG Floor B', 1);

  insert into public.floor_route_nodes (id, tenant_id, floor_id, x, y, kind, label)
  values
    (node_a, tenant_a, floor_a, 0, 0, 'walkway', 'A'),
    (node_b, tenant_a, floor_a, 10, 0, 'junction', 'B'),
    (node_c, tenant_a, floor_a, 20, 0, 'pick_point', 'C'),
    (node_isolated, tenant_a, floor_a, 100, 100, 'walkway', 'isolated'),
    (reverse_a, tenant_a, floor_a, 0, 20, 'walkway', 'reverse A'),
    (reverse_b, tenant_a, floor_a, 10, 20, 'walkway', 'reverse B'),
    (node_floor_other, tenant_a, floor_a_other, 0, 0, 'walkway', 'other floor'),
    (node_tenant_b, tenant_b, floor_b, 0, 0, 'walkway', 'other tenant');

  insert into public.floor_route_edges (
    id, tenant_id, floor_id, source_node_id, target_node_id, cost, reverse_cost, points
  )
  values
    (edge_ab, tenant_a, floor_a, node_a, node_b, 1, -1, '[{"x":0,"y":0},{"x":10,"y":0}]'::jsonb),
    (edge_bc, tenant_a, floor_a, node_b, node_c, 1, -1, '[{"x":10,"y":0},{"x":20,"y":0}]'::jsonb),
    (reverse_edge, tenant_a, floor_a, reverse_a, reverse_b, 5, 2, '[{"x":0,"y":20},{"x":10,"y":20}]'::jsonb);

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select
    count(*),
    array_agg(edge_id order by seq),
    array_agg(source_node_id order by seq),
    array_agg(target_node_id order by seq),
    array_agg(agg_cost order by seq)
  into path_count, path_edges, path_sources, path_targets, path_agg_costs
  from public.get_shortest_floor_path(tenant_a, floor_a, node_a, node_c);

  if path_count <> 2 then
    raise exception 'FRG-1 FAIL: expected two path segments from A to C, got %.', path_count;
  end if;

  if path_edges <> array[edge_ab, edge_bc]::uuid[] then
    raise exception 'FRG-2 FAIL: expected A->B->C edge order, got %.', path_edges;
  end if;

  if path_sources <> array[node_a, node_b]::uuid[]
    or path_targets <> array[node_b, node_c]::uuid[] then
    raise exception 'FRG-3 FAIL: expected path traversal A->B then B->C.';
  end if;

  if path_agg_costs <> array[0, 1]::numeric[] then
    raise exception 'FRG-4 FAIL: expected pgRouting aggregate costs 0,1, got %.', path_agg_costs;
  end if;

  select count(*)
  into path_count
  from public.get_shortest_floor_path(tenant_a, floor_a, node_a, node_tenant_b);

  if path_count <> 0 then
    raise exception 'FRG-5 FAIL: cross-tenant node must not resolve inside tenant A graph.';
  end if;

  select count(*)
  into path_count
  from public.get_shortest_floor_path(tenant_a, floor_a, node_a, node_floor_other);

  if path_count <> 0 then
    raise exception 'FRG-6 FAIL: cross-floor node must not resolve inside floor A graph.';
  end if;

  select count(*)
  into path_count
  from public.get_shortest_floor_path(tenant_a, floor_a, node_c, node_a);

  if path_count <> 0 then
    raise exception 'FRG-7 FAIL: reverse_cost = -1 must block reverse traversal.';
  end if;

  select count(*), array_agg(source_node_id order by seq), array_agg(target_node_id order by seq), (array_agg(points order by seq))[1]
  into path_count, path_sources, path_targets, reverse_points
  from public.get_shortest_floor_path(tenant_a, floor_a, reverse_b, reverse_a);

  if path_count <> 1 then
    raise exception 'FRG-8 FAIL: reverse_cost > 0 must allow one reverse segment, got %.', path_count;
  end if;

  if path_sources <> array[reverse_b]::uuid[] or path_targets <> array[reverse_a]::uuid[] then
    raise exception 'FRG-9 FAIL: reverse traversal must return traversal-direction source/target.';
  end if;

  if reverse_points <> '[{"x": 10, "y": 20}, {"x": 0, "y": 20}]'::jsonb then
    raise exception 'FRG-10 FAIL: reverse traversal must reverse points, got %.', reverse_points;
  end if;

  select count(*)
  into path_count
  from public.get_shortest_floor_path(tenant_a, floor_a, node_a, node_isolated);

  if path_count <> 0 then
    raise exception 'FRG-11 FAIL: disconnected node must return empty path.';
  end if;

  select count(*)
  into path_count
  from public.get_shortest_floor_path(tenant_a, floor_a, gen_random_uuid(), node_a);

  if path_count <> 0 then
    raise exception 'FRG-12 FAIL: missing start node must return empty path.';
  end if;

  execute 'reset role';

  begin
    insert into public.floor_route_edges (tenant_id, floor_id, source_node_id, target_node_id, cost)
    values (tenant_a, floor_a, node_a, node_a, 1);
    raise exception 'FRG-13 FAIL: self-edge insert should have failed.';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.floor_route_edges (tenant_id, floor_id, source_node_id, target_node_id, cost)
    values (tenant_a, floor_a, node_a, node_b, 0);
    raise exception 'FRG-14 FAIL: non-positive cost insert should have failed.';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.floor_route_edges (tenant_id, floor_id, source_node_id, target_node_id, cost, reverse_cost)
    values (tenant_a, floor_a, node_a, node_b, 1, 0);
    raise exception 'FRG-15 FAIL: invalid reverse_cost insert should have failed.';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.floor_route_edges (tenant_id, floor_id, source_node_id, target_node_id, cost)
    values (tenant_a, floor_a, node_a, node_tenant_b, 1);
    raise exception 'FRG-16 FAIL: cross-tenant edge insert should have failed.';
  exception
    when foreign_key_violation then
      null;
  end;

  begin
    insert into public.floor_route_edges (tenant_id, floor_id, source_node_id, target_node_id, cost)
    values (tenant_a, floor_a, node_a, node_floor_other, 1);
    raise exception 'FRG-17 FAIL: cross-floor edge insert should have failed.';
  exception
    when foreign_key_violation then
      null;
  end;

  insert into public.locations (id, tenant_id, floor_id, code, location_type, capacity_mode, status)
  values (location_a, tenant_a, floor_a, 'FRG-LOC-A', 'staging', 'single_container', 'active');

  if not exists (
    select 1
    from public.locations
    where id = location_a
      and travel_node_id is null
  ) then
    raise exception 'FRG-18 FAIL: locations.travel_node_id must remain nullable.';
  end if;

  update public.locations
  set travel_node_id = node_a
  where id = location_a;

  if not exists (
    select 1
    from public.locations
    where id = location_a
      and travel_node_id = node_a
  ) then
    raise exception 'FRG-19 FAIL: valid same-tenant/floor travel node should be accepted.';
  end if;

  begin
    update public.locations
    set travel_node_id = gen_random_uuid()
    where id = location_a;
    raise exception 'FRG-20 FAIL: unknown travel node should have failed.';
  exception
    when others then
      if position('Travel node' in sqlerrm) = 0
        and sqlstate <> '23503' then
        raise;
      end if;
  end;

  begin
    update public.locations
    set travel_node_id = node_tenant_b
    where id = location_a;
    raise exception 'FRG-21 FAIL: tenant-mismatched travel node should have failed.';
  exception
    when others then
      if position('does not match travel node tenant' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    update public.locations
    set travel_node_id = node_floor_other
    where id = location_a;
    raise exception 'FRG-22 FAIL: floor-mismatched travel node should have failed.';
  exception
    when others then
      if position('does not match travel node floor' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end
$$;

rollback;
