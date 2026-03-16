alter table public.container_types
  add column if not exists width_mm int null,
  add column if not exists height_mm int null,
  add column if not exists depth_mm int null,
  add column if not exists tare_weight_g bigint null,
  add column if not exists max_load_g bigint null;

alter table public.products
  add column if not exists unit_weight_g bigint null;

alter table public.containers
  add column if not exists current_location_id uuid null references public.locations(id) on delete restrict,
  add column if not exists current_location_entered_at timestamptz null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_by uuid null references public.profiles(id);

create index if not exists containers_current_location_idx
  on public.containers(current_location_id)
  where current_location_id is not null;

drop trigger if exists set_containers_updated_at on public.containers;
create trigger set_containers_updated_at
before update on public.containers
for each row execute function public.set_updated_at();

create or replace function public.backfill_container_current_locations()
returns integer
language plpgsql
as $$
declare
  updated_count integer := 0;
begin
  with current_bridge as (
    select
      cp.container_id,
      l.id as location_id,
      cp.placed_at
    from public.container_placements cp
    join public.locations l
      on l.geometry_slot_id = cp.cell_id
     and l.tenant_id = cp.tenant_id
    where cp.removed_at is null
  )
  update public.containers c
  set current_location_id = cb.location_id,
      current_location_entered_at = cb.placed_at
  from current_bridge cb
  where c.id = cb.container_id
    and (
      c.current_location_id is distinct from cb.location_id
      or c.current_location_entered_at is distinct from cb.placed_at
    );

  get diagnostics updated_count = row_count;
  return updated_count;
end
$$;

select public.backfill_container_current_locations();

create or replace function public.get_container_gross_weight(container_uuid uuid)
returns bigint
language plpgsql
stable
as $$
declare
  container_row record;
  legacy_unknown_exists boolean := false;
  missing_product_weight_exists boolean := false;
  inventory_weight numeric := 0;
begin
  select
    c.id,
    c.tenant_id,
    ct.tare_weight_g
  into container_row
  from public.containers c
  join public.container_types ct on ct.id = c.container_type_id
  where c.id = container_uuid;

  if container_row.id is null then
    return null;
  end if;

  if container_row.tare_weight_g is null then
    return null;
  end if;

  select exists (
    select 1
    from public.inventory_items ii
    where ii.container_id = container_uuid
      and ii.product_id is null
  )
  into legacy_unknown_exists;

  if legacy_unknown_exists then
    return null;
  end if;

  select exists (
    select 1
    from public.inventory_unit iu
    left join public.products p on p.id = iu.product_id
    where iu.container_id = container_uuid
      and p.unit_weight_g is null
  )
  into missing_product_weight_exists;

  if missing_product_weight_exists then
    return null;
  end if;

  select coalesce(sum(iu.quantity * p.unit_weight_g), 0)
  into inventory_weight
  from public.inventory_unit iu
  join public.products p on p.id = iu.product_id
  where iu.container_id = container_uuid;

  return container_row.tare_weight_g + inventory_weight::bigint;
end
$$;

create or replace function public.location_can_accept_container(target_location_uuid uuid, container_uuid uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  container_row record;
  target_location_row record;
  occupying_container_uuid uuid;
  gross_weight_g bigint;
begin
  select
    c.id,
    c.tenant_id,
    c.current_location_id,
    ct.width_mm,
    ct.height_mm,
    ct.depth_mm
  into container_row
  from public.containers c
  join public.container_types ct on ct.id = c.container_type_id
  where c.id = container_uuid;

  if container_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'CONTAINER_NOT_FOUND');
  end if;

  select
    l.id,
    l.tenant_id,
    l.status,
    l.capacity_mode,
    l.width_mm,
    l.height_mm,
    l.depth_mm,
    l.max_weight_g
  into target_location_row
  from public.locations l
  where l.id = target_location_uuid;

  if target_location_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'LOCATION_NOT_FOUND');
  end if;

  if target_location_row.tenant_id <> container_row.tenant_id then
    return jsonb_build_object('ok', false, 'reason', 'TENANT_MISMATCH');
  end if;

  if target_location_row.status <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'LOCATION_NOT_ACTIVE');
  end if;

  if container_row.current_location_id = target_location_row.id then
    return jsonb_build_object('ok', false, 'reason', 'SAME_LOCATION');
  end if;

  if target_location_row.capacity_mode = 'single_container' then
    select c.id
    into occupying_container_uuid
    from public.containers c
    where c.current_location_id = target_location_row.id
      and c.id <> container_uuid
      and c.status not in ('closed', 'lost')
    limit 1;

    if occupying_container_uuid is not null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_OCCUPIED');
    end if;
  end if;

  if target_location_row.width_mm is not null then
    if container_row.width_mm is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_UNKNOWN');
    end if;

    if container_row.width_mm > target_location_row.width_mm then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_OVERFLOW');
    end if;
  end if;

  if target_location_row.height_mm is not null then
    if container_row.height_mm is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_UNKNOWN');
    end if;

    if container_row.height_mm > target_location_row.height_mm then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_OVERFLOW');
    end if;
  end if;

  if target_location_row.depth_mm is not null then
    if container_row.depth_mm is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_UNKNOWN');
    end if;

    if container_row.depth_mm > target_location_row.depth_mm then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_DIMENSION_OVERFLOW');
    end if;
  end if;

  if target_location_row.max_weight_g is not null then
    gross_weight_g := public.get_container_gross_weight(container_uuid);

    if gross_weight_g is null then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_WEIGHT_UNKNOWN');
    end if;

    if gross_weight_g > target_location_row.max_weight_g then
      return jsonb_build_object('ok', false, 'reason', 'LOCATION_WEIGHT_OVERFLOW');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'reason', null);
end
$$;

create or replace function public.sync_container_placement_projection(container_uuid uuid, actor_uuid uuid default null)
returns void
language plpgsql
as $$
declare
  container_row record;
  target_location_row record;
  active_placement record;
  placement_time_utc timestamptz;
begin
  select
    c.id,
    c.tenant_id,
    c.current_location_id,
    coalesce(c.current_location_entered_at, c.created_at) as placement_time
  into container_row
  from public.containers c
  where c.id = container_uuid
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  select cp.id, cp.cell_id
  into active_placement
  from public.container_placements cp
  where cp.container_id = container_uuid
    and cp.removed_at is null
  for update;

  placement_time_utc := container_row.placement_time;

  if container_row.current_location_id is null then
    if active_placement.id is not null then
      update public.container_placements
      set removed_at = placement_time_utc,
          removed_by = actor_uuid
      where id = active_placement.id;
    end if;

    return;
  end if;

  select l.id, l.geometry_slot_id
  into target_location_row
  from public.locations l
  where l.id = container_row.current_location_id
  for update;

  if target_location_row.id is null then
    raise exception 'LOCATION_NOT_FOUND';
  end if;

  if target_location_row.geometry_slot_id is null then
    if active_placement.id is not null then
      update public.container_placements
      set removed_at = placement_time_utc,
          removed_by = actor_uuid
      where id = active_placement.id;
    end if;

    return;
  end if;

  if active_placement.id is not null and active_placement.cell_id = target_location_row.geometry_slot_id then
    return;
  end if;

  if active_placement.id is not null then
    update public.container_placements
    set removed_at = placement_time_utc,
        removed_by = actor_uuid
    where id = active_placement.id;
  end if;

  insert into public.container_placements (
    tenant_id,
    container_id,
    cell_id,
    placed_at,
    placed_by
  )
  values (
    container_row.tenant_id,
    container_uuid,
    target_location_row.geometry_slot_id,
    placement_time_utc,
    actor_uuid
  );
end
$$;

create or replace view public.active_container_locations_v as
select
  c.tenant_id,
  l.floor_id,
  l.id as location_id,
  l.code as location_code,
  l.location_type,
  l.capacity_mode,
  l.status as location_status,
  l.geometry_slot_id as cell_id,
  c.id as container_id,
  c.external_code,
  ct.code as container_type,
  c.status as container_status,
  coalesce(c.current_location_entered_at, c.created_at) as placed_at
from public.containers c
join public.locations l on l.id = c.current_location_id
join public.container_types ct on ct.id = c.container_type_id;

create or replace view public.location_occupancy_v as
select
  tenant_id,
  floor_id,
  location_id,
  location_code,
  location_type,
  capacity_mode,
  location_status,
  cell_id,
  container_id,
  external_code,
  container_type,
  container_status,
  placed_at
from public.active_container_locations_v;

create or replace view public.location_storage_snapshot_v as
select
  acl.tenant_id,
  acl.floor_id,
  acl.location_id,
  acl.location_code,
  acl.location_type,
  acl.capacity_mode,
  acl.location_status,
  acl.cell_id,
  acl.container_id,
  acl.external_code,
  acl.container_type,
  acl.container_status,
  acl.placed_at,
  ic.item_ref,
  ic.product_id,
  ic.quantity,
  ic.uom
from public.active_container_locations_v acl
left join public.inventory_item_compat_v ic on ic.container_id = acl.container_id;

create or replace view public.cell_occupancy_v as
select
  tenant_id,
  cell_id,
  container_id,
  external_code,
  container_type,
  container_status,
  placed_at
from public.location_occupancy_v
where cell_id is not null;

create or replace view public.cell_storage_snapshot_v as
select
  tenant_id,
  cell_id,
  container_id,
  external_code,
  container_type,
  container_status,
  placed_at,
  item_ref,
  product_id,
  quantity,
  uom
from public.location_storage_snapshot_v
where cell_id is not null;

create or replace function public.resolve_active_location_for_container(container_uuid uuid)
returns table (
  tenant_id uuid,
  floor_id uuid,
  location_id uuid,
  cell_id uuid
)
language sql
stable
as $$
  select
    acl.tenant_id,
    acl.floor_id,
    acl.location_id,
    acl.cell_id
  from public.active_container_locations_v acl
  where acl.container_id = container_uuid
  limit 1
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
  target_location_uuid uuid;
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

  select l.id
  into target_location_uuid
  from public.locations l
  where l.geometry_slot_id = cell_uuid
    and l.tenant_id = container_tenant_uuid
  limit 1;

  if target_location_uuid is null then
    raise exception 'TARGET_CELL_LOCATION_NOT_FOUND';
  end if;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
  values (container_tenant_uuid, container_uuid, cell_uuid, placed_at_utc, actor_uuid)
  returning id into new_placement_uuid;

  update public.containers
  set current_location_id = target_location_uuid,
      current_location_entered_at = placed_at_utc,
      updated_at = placed_at_utc,
      updated_by = actor_uuid
  where id = container_uuid;

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

  update public.containers
  set current_location_id = null,
      current_location_entered_at = null,
      updated_at = removed_at_utc,
      updated_by = actor_uuid
  where id = container_uuid;

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
  target_location_uuid uuid;
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

  select l.id
  into target_location_uuid
  from public.locations l
  where l.geometry_slot_id = target_cell_uuid
    and l.tenant_id = container_tenant_uuid
  limit 1;

  if target_location_uuid is null then
    raise exception 'TARGET_CELL_LOCATION_NOT_FOUND';
  end if;

  update public.container_placements
  set removed_at = moved_at_utc,
      removed_by = actor_uuid
  where id = active_placement.id;

  insert into public.container_placements (tenant_id, container_id, cell_id, placed_at, placed_by)
  values (container_tenant_uuid, container_uuid, target_cell_uuid, moved_at_utc, actor_uuid)
  returning id into new_placement_uuid;

  update public.containers
  set current_location_id = target_location_uuid,
      current_location_entered_at = moved_at_utc,
      updated_at = moved_at_utc,
      updated_by = actor_uuid
  where id = container_uuid;

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

create or replace function public.move_container_canonical(
  container_uuid uuid,
  target_location_uuid uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  container_row record;
  source_location_row record;
  validation_result jsonb;
  validation_reason text;
  movement_uuid uuid;
  occurred_at_utc timestamptz := timezone('utc', now());
begin
  select
    c.id,
    c.tenant_id,
    c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.current_location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(container_uuid);

  validation_result := public.location_can_accept_container(target_location_uuid, container_uuid);
  validation_reason := validation_result ->> 'reason';

  if coalesce((validation_result ->> 'ok')::boolean, false) = false then
    raise exception '%', validation_reason;
  end if;

  update public.containers
  set current_location_id = target_location_uuid,
      current_location_entered_at = occurred_at_utc,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where id = container_uuid;

  perform public.sync_container_placement_projection(container_uuid, actor_uuid);

  movement_uuid := public.insert_stock_movement(
    container_row.tenant_id,
    'move_container',
    source_location_row.location_id,
    target_location_uuid,
    container_uuid,
    container_uuid,
    null,
    null,
    null,
    null,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'containerId', container_uuid,
    'sourceLocationId', source_location_row.location_id,
    'targetLocationId', target_location_uuid,
    'movementId', movement_uuid,
    'occurredAt', occurred_at_utc
  );
end
$$;

grant execute on function public.backfill_container_current_locations() to authenticated;
grant execute on function public.get_container_gross_weight(uuid) to authenticated;
grant execute on function public.location_can_accept_container(uuid, uuid) to authenticated;
grant execute on function public.sync_container_placement_projection(uuid, uuid) to authenticated;
