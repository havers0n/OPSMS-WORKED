-- 0117_floor_route_graph.sql
--
-- PR 1 foundation for tenant/floor-scoped warehouse floor routing.
-- RouteSequencer owns pick-step ordering; pgRouting owns physical paths
-- between persisted floor route nodes.

create extension if not exists postgis with schema extensions;
create extension if not exists pgrouting with schema extensions;

create table if not exists public.floor_route_nodes (
  id uuid primary key default gen_random_uuid(),
  pgr_node_id bigint generated always as identity,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  x numeric(12,3) not null,
  y numeric(12,3) not null,
  kind text not null default 'walkway',
  label text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint floor_route_nodes_pgr_node_id_unique unique (pgr_node_id),
  constraint floor_route_nodes_tenant_floor_pgr_node_id_unique unique (tenant_id, floor_id, pgr_node_id),
  constraint floor_route_nodes_tenant_floor_id_unique unique (tenant_id, floor_id, id),
  constraint floor_route_nodes_kind_check check (kind in ('walkway', 'junction', 'pick_point', 'packing_station'))
);

create index if not exists floor_route_nodes_tenant_floor_idx
  on public.floor_route_nodes (tenant_id, floor_id);

create index if not exists floor_route_nodes_tenant_floor_pgr_node_idx
  on public.floor_route_nodes (tenant_id, floor_id, pgr_node_id);

create or replace function public.validate_floor_route_node()
returns trigger
language plpgsql
as $$
declare
  floor_tenant_uuid uuid;
begin
  select s.tenant_id
  into floor_tenant_uuid
  from public.floors f
  join public.sites s on s.id = f.site_id
  where f.id = new.floor_id;

  if floor_tenant_uuid is null then
    raise exception 'Floor % was not found for floor route node.', new.floor_id;
  end if;

  if floor_tenant_uuid <> new.tenant_id then
    raise exception 'Floor route node tenant % does not match floor tenant %.', new.tenant_id, floor_tenant_uuid;
  end if;

  return new;
end
$$;

drop trigger if exists validate_floor_route_node on public.floor_route_nodes;
create trigger validate_floor_route_node
before insert or update of tenant_id, floor_id on public.floor_route_nodes
for each row execute function public.validate_floor_route_node();

drop trigger if exists set_floor_route_nodes_updated_at on public.floor_route_nodes;
create trigger set_floor_route_nodes_updated_at
before update on public.floor_route_nodes
for each row execute function public.set_updated_at();

create table if not exists public.floor_route_edges (
  id uuid primary key default gen_random_uuid(),
  pgr_edge_id bigint generated always as identity,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  source_node_id uuid not null,
  target_node_id uuid not null,
  cost numeric(12,3) not null,
  reverse_cost numeric(12,3) not null default -1,
  points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint floor_route_edges_pgr_edge_id_unique unique (pgr_edge_id),
  constraint floor_route_edges_tenant_floor_pgr_edge_id_unique unique (tenant_id, floor_id, pgr_edge_id),
  constraint floor_route_edges_cost_positive check (cost > 0),
  constraint floor_route_edges_reverse_cost_valid check (reverse_cost = -1 or reverse_cost > 0),
  constraint floor_route_edges_distinct_nodes check (source_node_id <> target_node_id),
  constraint floor_route_edges_points_array check (jsonb_typeof(points) = 'array'),
  constraint floor_route_edges_source_node_fkey
    foreign key (tenant_id, floor_id, source_node_id)
    references public.floor_route_nodes (tenant_id, floor_id, id)
    on delete cascade,
  constraint floor_route_edges_target_node_fkey
    foreign key (tenant_id, floor_id, target_node_id)
    references public.floor_route_nodes (tenant_id, floor_id, id)
    on delete cascade
);

create index if not exists floor_route_edges_tenant_floor_idx
  on public.floor_route_edges (tenant_id, floor_id);

create index if not exists floor_route_edges_source_node_idx
  on public.floor_route_edges (source_node_id);

create index if not exists floor_route_edges_target_node_idx
  on public.floor_route_edges (target_node_id);

drop trigger if exists set_floor_route_edges_updated_at on public.floor_route_edges;
create trigger set_floor_route_edges_updated_at
before update on public.floor_route_edges
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.floor_route_nodes to authenticated;
grant select, insert, update, delete on public.floor_route_edges to authenticated;
grant usage, select on sequence public.floor_route_nodes_pgr_node_id_seq to authenticated;
grant usage, select on sequence public.floor_route_edges_pgr_edge_id_seq to authenticated;

alter table public.floor_route_nodes enable row level security;
alter table public.floor_route_edges enable row level security;

drop policy if exists floor_route_nodes_select_scoped on public.floor_route_nodes;
create policy floor_route_nodes_select_scoped
on public.floor_route_nodes
for select
to authenticated
using (
  public.can_access_tenant(tenant_id)
  and public.can_access_floor(floor_id)
);

drop policy if exists floor_route_nodes_insert_scoped on public.floor_route_nodes;
create policy floor_route_nodes_insert_scoped
on public.floor_route_nodes
for insert
to authenticated
with check (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
);

drop policy if exists floor_route_nodes_update_scoped on public.floor_route_nodes;
create policy floor_route_nodes_update_scoped
on public.floor_route_nodes
for update
to authenticated
using (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
)
with check (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
);

drop policy if exists floor_route_nodes_delete_scoped on public.floor_route_nodes;
create policy floor_route_nodes_delete_scoped
on public.floor_route_nodes
for delete
to authenticated
using (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
);

drop policy if exists floor_route_edges_select_scoped on public.floor_route_edges;
create policy floor_route_edges_select_scoped
on public.floor_route_edges
for select
to authenticated
using (
  public.can_access_tenant(tenant_id)
  and public.can_access_floor(floor_id)
);

drop policy if exists floor_route_edges_insert_scoped on public.floor_route_edges;
create policy floor_route_edges_insert_scoped
on public.floor_route_edges
for insert
to authenticated
with check (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
);

drop policy if exists floor_route_edges_update_scoped on public.floor_route_edges;
create policy floor_route_edges_update_scoped
on public.floor_route_edges
for update
to authenticated
using (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
)
with check (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
);

drop policy if exists floor_route_edges_delete_scoped on public.floor_route_edges;
create policy floor_route_edges_delete_scoped
on public.floor_route_edges
for delete
to authenticated
using (
  public.can_manage_tenant(tenant_id)
  and public.can_manage_floor(floor_id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'locations'
      and column_name = 'travel_node_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'locations_travel_node_id_fkey'
  ) then
    alter table public.locations
      add constraint locations_travel_node_id_fkey
      foreign key (travel_node_id)
      references public.floor_route_nodes(id)
      on delete set null
      not valid;
  end if;
end
$$;

create or replace function public.validate_location_travel_node()
returns trigger
language plpgsql
as $$
declare
  route_node_tenant_uuid uuid;
  route_node_floor_uuid uuid;
begin
  if new.travel_node_id is null then
    return new;
  end if;

  select frn.tenant_id, frn.floor_id
  into route_node_tenant_uuid, route_node_floor_uuid
  from public.floor_route_nodes frn
  where frn.id = new.travel_node_id;

  if route_node_tenant_uuid is null then
    raise exception 'Travel node % was not found for location.', new.travel_node_id;
  end if;

  if route_node_tenant_uuid <> new.tenant_id then
    raise exception 'Location tenant % does not match travel node tenant %.', new.tenant_id, route_node_tenant_uuid;
  end if;

  if route_node_floor_uuid <> new.floor_id then
    raise exception 'Location floor % does not match travel node floor %.', new.floor_id, route_node_floor_uuid;
  end if;

  return new;
end
$$;

drop trigger if exists validate_location_travel_node on public.locations;
create trigger validate_location_travel_node
before insert or update of tenant_id, floor_id, travel_node_id on public.locations
for each row execute function public.validate_location_travel_node();

create or replace function public.get_shortest_floor_path(
  p_tenant_id uuid,
  p_floor_id uuid,
  p_start_node_id uuid,
  p_end_node_id uuid
)
returns table (
  seq integer,
  path_seq integer,
  edge_id uuid,
  source_node_id uuid,
  target_node_id uuid,
  cost numeric,
  agg_cost numeric,
  points jsonb
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_floor_tenant_id uuid;
  v_start_pgr_node_id bigint;
  v_end_pgr_node_id bigint;
  v_edges_sql text;
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required'
      using errcode = '22004';
  end if;

  if p_floor_id is null then
    raise exception 'p_floor_id is required'
      using errcode = '22004';
  end if;

  if p_start_node_id is null then
    raise exception 'p_start_node_id is required'
      using errcode = '22004';
  end if;

  if p_end_node_id is null then
    raise exception 'p_end_node_id is required'
      using errcode = '22004';
  end if;

  if not public.can_access_tenant(p_tenant_id) then
    raise exception 'Access denied for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  select s.tenant_id
  into v_floor_tenant_id
  from public.floors f
  join public.sites s on s.id = f.site_id
  where f.id = p_floor_id;

  if v_floor_tenant_id is distinct from p_tenant_id then
    return;
  end if;

  select frn.pgr_node_id
  into v_start_pgr_node_id
  from public.floor_route_nodes frn
  where frn.tenant_id = p_tenant_id
    and frn.floor_id = p_floor_id
    and frn.id = p_start_node_id;

  select frn.pgr_node_id
  into v_end_pgr_node_id
  from public.floor_route_nodes frn
  where frn.tenant_id = p_tenant_id
    and frn.floor_id = p_floor_id
    and frn.id = p_end_node_id;

  if v_start_pgr_node_id is null or v_end_pgr_node_id is null then
    return;
  end if;

  v_edges_sql := format(
    $edges$
      select
        e.pgr_edge_id::bigint as id,
        source_node.pgr_node_id::bigint as source,
        target_node.pgr_node_id::bigint as target,
        e.cost::float8 as cost,
        e.reverse_cost::float8 as reverse_cost
      from public.floor_route_edges e
      join public.floor_route_nodes source_node
        on source_node.id = e.source_node_id
      join public.floor_route_nodes target_node
        on target_node.id = e.target_node_id
      where e.tenant_id = %L::uuid
        and e.floor_id = %L::uuid
    $edges$,
    p_tenant_id,
    p_floor_id
  );

  return query
  select
    d.seq::integer,
    d.path_seq::integer,
    e.id as edge_id,
    case
      when d.node = source_node.pgr_node_id then e.source_node_id
      else e.target_node_id
    end as source_node_id,
    case
      when d.node = source_node.pgr_node_id then e.target_node_id
      else e.source_node_id
    end as target_node_id,
    d.cost::numeric,
    d.agg_cost::numeric,
    case
      when d.node = source_node.pgr_node_id then e.points
      else (
        select coalesce(jsonb_agg(point_value order by point_ordinality desc), '[]'::jsonb)
        from jsonb_array_elements(e.points) with ordinality as reversed_points(point_value, point_ordinality)
      )
    end as points
  from pgr_dijkstra(v_edges_sql, v_start_pgr_node_id, v_end_pgr_node_id, true) as d
  join public.floor_route_edges e
    on e.pgr_edge_id = d.edge
   and e.tenant_id = p_tenant_id
   and e.floor_id = p_floor_id
  join public.floor_route_nodes source_node
    on source_node.id = e.source_node_id
  join public.floor_route_nodes target_node
    on target_node.id = e.target_node_id
  where d.edge <> -1
  order by d.seq;
end;
$$;

revoke all on function public.get_shortest_floor_path(uuid, uuid, uuid, uuid) from public, anon, service_role;
grant execute on function public.get_shortest_floor_path(uuid, uuid, uuid, uuid) to authenticated;

comment on table public.floor_route_nodes is
  'Tenant/floor-scoped route graph nodes for physical warehouse floor routing.';

comment on table public.floor_route_edges is
  'Tenant/floor-scoped directed route graph edges consumed by pgRouting.';

comment on function public.get_shortest_floor_path(uuid, uuid, uuid, uuid) is
  'Returns the pgRouting shortest path between two floor route nodes within one tenant and floor.';
