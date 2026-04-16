-- 0025_movement_events_and_slot_actions.sql

create table if not exists public.movement_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  from_cell_id uuid null references public.cells(id) on delete restrict,
  to_cell_id uuid null references public.cells(id) on delete restrict,
  event_type text not null check (event_type in ('placed', 'removed', 'moved')),
  actor_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists movement_events_tenant_floor_created_idx
  on public.movement_events(tenant_id, floor_id, created_at desc);

create index if not exists movement_events_container_created_idx
  on public.movement_events(container_id, created_at desc);

grant select, insert on public.movement_events to authenticated;

alter table public.movement_events enable row level security;

drop policy if exists movement_events_select_scoped on public.movement_events;
create policy movement_events_select_scoped
on public.movement_events
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists movement_events_insert_scoped on public.movement_events;
create policy movement_events_insert_scoped
on public.movement_events
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

create or replace function public.insert_movement_event(
  tenant_uuid uuid,
  floor_uuid uuid,
  container_uuid uuid,
  from_cell_uuid uuid,
  to_cell_uuid uuid,
  movement_event_type text,
  actor_uuid uuid,
  created_at_utc timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
as $$
declare
  movement_event_uuid uuid;
begin
  insert into public.movement_events (
    tenant_id,
    floor_id,
    container_id,
    from_cell_id,
    to_cell_id,
    event_type,
    actor_id,
    created_at
  )
  values (
    tenant_uuid,
    floor_uuid,
    container_uuid,
    from_cell_uuid,
    to_cell_uuid,
    movement_event_type,
    actor_uuid,
    created_at_utc
  )
  returning id into movement_event_uuid;

  return movement_event_uuid;
end
$$;

create or replace function public.place_container(container_uuid uuid, cell_uuid uuid, actor_uuid uuid default null)
returns jsonb
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  target_cell_tenant_uuid uuid;
  target_floor_uuid uuid;
  target_cell_layout_state text;
  active_placement record;
  placed_at_utc timestamptz := timezone('utc', now());
  new_placement_uuid uuid;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = container_uuid
  for update;

  if container_tenant_uuid is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  select cp.id, cp.cell_id
  into active_placement
  from public.container_placements cp
  where cp.container_id = container_uuid
    and cp.removed_at is null
  for update;

  if active_placement.id is not null then
    raise exception 'CONTAINER_ALREADY_PLACED';
  end if;

  select s.tenant_id, f.id, lv.state
  into target_cell_tenant_uuid, target_floor_uuid, target_cell_layout_state
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  where c.id = cell_uuid;

  if target_cell_tenant_uuid is null then
    raise exception 'TARGET_CELL_NOT_FOUND';
  end if;

  if target_cell_tenant_uuid <> container_tenant_uuid then
    raise exception 'TARGET_CELL_TENANT_MISMATCH';
  end if;

  if target_cell_layout_state <> 'published' then
    raise exception 'TARGET_CELL_NOT_PUBLISHED';
  end if;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
  values (container_tenant_uuid, container_uuid, cell_uuid, placed_at_utc, actor_uuid)
  returning id into new_placement_uuid;

  perform public.insert_movement_event(
    container_tenant_uuid,
    target_floor_uuid,
    container_uuid,
    null,
    cell_uuid,
    'placed',
    actor_uuid,
    placed_at_utc
  );

  return jsonb_build_object(
    'action', 'placed',
    'containerId', container_uuid,
    'cellId', cell_uuid,
    'placementId', new_placement_uuid,
    'occurredAt', placed_at_utc
  );
exception
  when unique_violation then
    raise exception 'CONTAINER_ALREADY_PLACED';
end
$$;

create or replace function public.remove_container(container_uuid uuid, actor_uuid uuid default null)
returns jsonb
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  active_placement record;
  placement_floor_uuid uuid;
  removed_at_utc timestamptz := timezone('utc', now());
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = container_uuid
  for update;

  if container_tenant_uuid is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  select cp.id, cp.cell_id
  into active_placement
  from public.container_placements cp
  where cp.container_id = container_uuid
    and cp.removed_at is null
  for update;

  if active_placement.id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  select f.id
  into placement_floor_uuid
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  where c.id = active_placement.cell_id;

  update public.container_placements
  set removed_at = removed_at_utc,
      removed_by = actor_uuid
  where id = active_placement.id;

  perform public.insert_movement_event(
    container_tenant_uuid,
    placement_floor_uuid,
    container_uuid,
    active_placement.cell_id,
    null,
    'removed',
    actor_uuid,
    removed_at_utc
  );

  return jsonb_build_object(
    'action', 'removed',
    'containerId', container_uuid,
    'cellId', active_placement.cell_id,
    'placementId', active_placement.id,
    'occurredAt', removed_at_utc
  );
end
$$;

create or replace function public.move_container(container_uuid uuid, target_cell_uuid uuid, actor_uuid uuid default null)
returns jsonb
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  target_cell_tenant_uuid uuid;
  target_floor_uuid uuid;
  target_cell_layout_state text;
  active_placement record;
  moved_at_utc timestamptz := timezone('utc', now());
  new_placement_uuid uuid;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = container_uuid
  for update;

  if container_tenant_uuid is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  select cp.id, cp.cell_id
  into active_placement
  from public.container_placements cp
  where cp.container_id = container_uuid
    and cp.removed_at is null
  for update;

  if active_placement.id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  if active_placement.cell_id = target_cell_uuid then
    raise exception 'CONTAINER_ALREADY_IN_TARGET_CELL';
  end if;

  select s.tenant_id, f.id, lv.state
  into target_cell_tenant_uuid, target_floor_uuid, target_cell_layout_state
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  where c.id = target_cell_uuid;

  if target_cell_tenant_uuid is null then
    raise exception 'TARGET_CELL_NOT_FOUND';
  end if;

  if target_cell_tenant_uuid <> container_tenant_uuid then
    raise exception 'TARGET_CELL_TENANT_MISMATCH';
  end if;

  if target_cell_layout_state <> 'published' then
    raise exception 'TARGET_CELL_NOT_PUBLISHED';
  end if;

  update public.container_placements
  set removed_at = moved_at_utc,
      removed_by = actor_uuid
  where id = active_placement.id;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
  values (container_tenant_uuid, container_uuid, target_cell_uuid, moved_at_utc, actor_uuid)
  returning id into new_placement_uuid;

  perform public.insert_movement_event(
    container_tenant_uuid,
    target_floor_uuid,
    container_uuid,
    active_placement.cell_id,
    target_cell_uuid,
    'moved',
    actor_uuid,
    moved_at_utc
  );

  return jsonb_build_object(
    'action', 'moved',
    'containerId', container_uuid,
    'fromCellId', active_placement.cell_id,
    'toCellId', target_cell_uuid,
    'previousPlacementId', active_placement.id,
    'placementId', new_placement_uuid,
    'occurredAt', moved_at_utc
  );
exception
  when unique_violation then
    raise exception 'CONTAINER_ALREADY_PLACED';
end
$$;

create or replace function public.remove_container_if_in_cells(
  container_uuid uuid,
  source_cell_uuids uuid[],
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  active_placement record;
begin
  select cp.id, cp.cell_id
  into active_placement
  from public.container_placements cp
  where cp.container_id = container_uuid
    and cp.removed_at is null
  for update;

  if active_placement.id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  if source_cell_uuids is null or cardinality(source_cell_uuids) = 0 then
    raise exception 'PLACEMENT_SOURCE_MISMATCH';
  end if;

  if not (active_placement.cell_id = any(source_cell_uuids)) then
    raise exception 'PLACEMENT_SOURCE_MISMATCH';
  end if;

  return public.remove_container(container_uuid, actor_uuid);
end
$$;

grant execute on function public.insert_movement_event(uuid, uuid, uuid, uuid, uuid, text, uuid, timestamptz) to authenticated;
grant execute on function public.remove_container_if_in_cells(uuid, uuid[], uuid) to authenticated;
