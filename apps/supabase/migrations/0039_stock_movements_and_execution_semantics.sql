alter table public.inventory_unit
  add column if not exists updated_by uuid null references public.profiles(id);

alter table public.inventory_unit
  add column if not exists source_inventory_unit_id uuid null references public.inventory_unit(id) on delete set null;

create index if not exists inventory_unit_source_inventory_unit_idx
  on public.inventory_unit(source_inventory_unit_id)
  where source_inventory_unit_id is not null;

create or replace function public.validate_inventory_unit_row()
returns trigger
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  source_inventory_unit_tenant_uuid uuid;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = new.container_id;

  if container_tenant_uuid is null then
    raise exception 'Container % was not found for inventory unit.', new.container_id;
  end if;

  if container_tenant_uuid <> new.tenant_id then
    raise exception 'Inventory unit tenant % does not match container tenant %.', new.tenant_id, container_tenant_uuid;
  end if;

  new.uom := trim(new.uom);
  new.lot_code := nullif(trim(coalesce(new.lot_code, '')), '');
  new.serial_no := nullif(trim(coalesce(new.serial_no, '')), '');

  if new.serial_no is not null and new.quantity <> 1 then
    raise exception 'Serial-tracked inventory units must have quantity 1.';
  end if;

  if new.source_inventory_unit_id is not null then
    select iu.tenant_id
    into source_inventory_unit_tenant_uuid
    from public.inventory_unit iu
    where iu.id = new.source_inventory_unit_id;

    if source_inventory_unit_tenant_uuid is null then
      raise exception 'Source inventory unit % was not found.', new.source_inventory_unit_id;
    end if;

    if source_inventory_unit_tenant_uuid <> new.tenant_id then
      raise exception 'Source inventory unit tenant % does not match inventory unit tenant %.', source_inventory_unit_tenant_uuid, new.tenant_id;
    end if;
  end if;

  return new;
end
$$;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  movement_type text not null check (movement_type in ('receive', 'putaway', 'move_container', 'split_stock', 'transfer_stock', 'pick_partial', 'ship', 'adjust')),
  source_location_id uuid null references public.locations(id) on delete restrict,
  target_location_id uuid null references public.locations(id) on delete restrict,
  source_container_id uuid null references public.containers(id) on delete restrict,
  target_container_id uuid null references public.containers(id) on delete restrict,
  source_inventory_unit_id uuid null references public.inventory_unit(id) on delete restrict,
  target_inventory_unit_id uuid null references public.inventory_unit(id) on delete restrict,
  quantity numeric null check (quantity is null or quantity >= 0),
  uom text null,
  status text not null default 'done' check (status in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null
);

create index if not exists stock_movements_tenant_created_idx
  on public.stock_movements(tenant_id, created_at desc);

create index if not exists stock_movements_source_container_created_idx
  on public.stock_movements(source_container_id, created_at desc)
  where source_container_id is not null;

create index if not exists stock_movements_target_container_created_idx
  on public.stock_movements(target_container_id, created_at desc)
  where target_container_id is not null;

create index if not exists stock_movements_source_inventory_created_idx
  on public.stock_movements(source_inventory_unit_id, created_at desc)
  where source_inventory_unit_id is not null;

create index if not exists stock_movements_target_inventory_created_idx
  on public.stock_movements(target_inventory_unit_id, created_at desc)
  where target_inventory_unit_id is not null;

create index if not exists stock_movements_source_location_created_idx
  on public.stock_movements(source_location_id, created_at desc)
  where source_location_id is not null;

create index if not exists stock_movements_target_location_created_idx
  on public.stock_movements(target_location_id, created_at desc)
  where target_location_id is not null;

grant select, insert on public.stock_movements to authenticated;

alter table public.stock_movements enable row level security;

create or replace function public.can_access_stock_movement(stock_movement_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.stock_movements sm
    where sm.id = stock_movement_uuid
      and public.can_access_tenant(sm.tenant_id)
  )
$$;

create or replace function public.can_manage_stock_movement(stock_movement_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.stock_movements sm
    where sm.id = stock_movement_uuid
      and public.can_manage_tenant(sm.tenant_id)
  )
$$;

create or replace function public.validate_stock_movement_row()
returns trigger
language plpgsql
as $$
declare
  source_location_tenant_uuid uuid;
  target_location_tenant_uuid uuid;
  source_container_tenant_uuid uuid;
  target_container_tenant_uuid uuid;
  source_inventory_unit record;
  target_inventory_unit record;
begin
  new.uom := nullif(trim(coalesce(new.uom, '')), '');

  if new.quantity is not null and new.uom is null then
    raise exception 'Stock movement quantity requires uom.';
  end if;

  if new.status = 'done' and new.completed_at is null then
    new.completed_at := new.created_at;
  end if;

  if new.source_location_id is not null then
    select l.tenant_id
    into source_location_tenant_uuid
    from public.locations l
    where l.id = new.source_location_id;

    if source_location_tenant_uuid is null or source_location_tenant_uuid <> new.tenant_id then
      raise exception 'Source location tenant mismatch for stock movement.';
    end if;
  end if;

  if new.target_location_id is not null then
    select l.tenant_id
    into target_location_tenant_uuid
    from public.locations l
    where l.id = new.target_location_id;

    if target_location_tenant_uuid is null or target_location_tenant_uuid <> new.tenant_id then
      raise exception 'Target location tenant mismatch for stock movement.';
    end if;
  end if;

  if new.source_container_id is not null then
    select c.tenant_id
    into source_container_tenant_uuid
    from public.containers c
    where c.id = new.source_container_id;

    if source_container_tenant_uuid is null or source_container_tenant_uuid <> new.tenant_id then
      raise exception 'Source container tenant mismatch for stock movement.';
    end if;
  end if;

  if new.target_container_id is not null then
    select c.tenant_id
    into target_container_tenant_uuid
    from public.containers c
    where c.id = new.target_container_id;

    if target_container_tenant_uuid is null or target_container_tenant_uuid <> new.tenant_id then
      raise exception 'Target container tenant mismatch for stock movement.';
    end if;
  end if;

  if new.source_inventory_unit_id is not null then
    select iu.id, iu.tenant_id, iu.container_id
    into source_inventory_unit
    from public.inventory_unit iu
    where iu.id = new.source_inventory_unit_id;

    if source_inventory_unit.id is null or source_inventory_unit.tenant_id <> new.tenant_id then
      raise exception 'Source inventory unit tenant mismatch for stock movement.';
    end if;

    if new.source_container_id is not null and source_inventory_unit.container_id <> new.source_container_id then
      raise exception 'Source inventory unit container mismatch for stock movement.';
    end if;
  end if;

  if new.target_inventory_unit_id is not null then
    select iu.id, iu.tenant_id, iu.container_id
    into target_inventory_unit
    from public.inventory_unit iu
    where iu.id = new.target_inventory_unit_id;

    if target_inventory_unit.id is null or target_inventory_unit.tenant_id <> new.tenant_id then
      raise exception 'Target inventory unit tenant mismatch for stock movement.';
    end if;

    if new.target_container_id is not null and target_inventory_unit.container_id <> new.target_container_id then
      raise exception 'Target inventory unit container mismatch for stock movement.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists validate_stock_movement_row on public.stock_movements;
create trigger validate_stock_movement_row
before insert or update on public.stock_movements
for each row execute function public.validate_stock_movement_row();

drop policy if exists stock_movements_select_scoped on public.stock_movements;
create policy stock_movements_select_scoped
on public.stock_movements
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists stock_movements_insert_scoped on public.stock_movements;
create policy stock_movements_insert_scoped
on public.stock_movements
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

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

create or replace function public.insert_stock_movement(
  tenant_uuid uuid,
  movement_type_text text,
  source_location_uuid uuid default null,
  target_location_uuid uuid default null,
  source_container_uuid uuid default null,
  target_container_uuid uuid default null,
  source_inventory_unit_uuid uuid default null,
  target_inventory_unit_uuid uuid default null,
  quantity_value numeric default null,
  uom_value text default null,
  movement_status text default 'done',
  created_at_utc timestamptz default timezone('utc', now()),
  completed_at_utc timestamptz default null,
  actor_uuid uuid default null
)
returns uuid
language plpgsql
as $$
declare
  inserted_uuid uuid;
begin
  insert into public.stock_movements (
    tenant_id,
    movement_type,
    source_location_id,
    target_location_id,
    source_container_id,
    target_container_id,
    source_inventory_unit_id,
    target_inventory_unit_id,
    quantity,
    uom,
    status,
    created_at,
    completed_at,
    created_by
  )
  values (
    tenant_uuid,
    movement_type_text,
    source_location_uuid,
    target_location_uuid,
    source_container_uuid,
    target_container_uuid,
    source_inventory_unit_uuid,
    target_inventory_unit_uuid,
    quantity_value,
    uom_value,
    movement_status,
    created_at_utc,
    case
      when movement_status = 'done' and completed_at_utc is null then created_at_utc
      else completed_at_utc
    end,
    actor_uuid
  )
  returning id into inserted_uuid;

  return inserted_uuid;
end
$$;

create or replace function public.split_inventory_unit(
  source_inventory_unit_uuid uuid,
  split_quantity numeric,
  target_container_uuid uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  source_row record;
  target_container_row record;
  source_location_row record;
  target_location_row record;
  merge_candidate_row record;
  target_inventory_unit_uuid uuid;
  source_quantity_after numeric;
  target_quantity_after numeric;
  merge_applied boolean := false;
  occurred_at_utc timestamptz := timezone('utc', now());
  split_movement_uuid uuid;
begin
  select
    iu.id,
    iu.tenant_id,
    iu.container_id,
    iu.product_id,
    iu.quantity,
    iu.uom,
    iu.lot_code,
    iu.serial_no,
    iu.expiry_date,
    iu.status
  into source_row
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid
  for update;

  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  if split_quantity <= 0 or split_quantity >= source_row.quantity then
    raise exception 'INVALID_SPLIT_QUANTITY';
  end if;

  if source_row.serial_no is not null then
    raise exception 'SERIAL_SPLIT_NOT_ALLOWED';
  end if;

  select c.id, c.tenant_id
  into target_container_row
  from public.containers c
  where c.id = target_container_uuid
  for update;

  if target_container_row.id is null then
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
  end if;

  if target_container_row.tenant_id <> source_row.tenant_id then
    raise exception 'TARGET_CONTAINER_TENANT_MISMATCH';
  end if;

  if target_container_row.id = source_row.container_id then
    raise exception 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(source_row.container_id);

  select *
  into target_location_row
  from public.resolve_active_location_for_container(target_container_row.id);

  update public.inventory_unit iu
  set quantity = iu.quantity - split_quantity,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where iu.id = source_row.id
  returning iu.quantity into source_quantity_after;

  select
    iu.id,
    iu.quantity
  into merge_candidate_row
  from public.inventory_unit iu
  where iu.tenant_id = source_row.tenant_id
    and iu.container_id = target_container_row.id
    and iu.product_id = source_row.product_id
    and iu.uom = source_row.uom
    and iu.status = source_row.status
    and iu.serial_no is null
    and iu.lot_code is not distinct from source_row.lot_code
    and iu.expiry_date is not distinct from source_row.expiry_date
  order by iu.created_at, iu.id
  limit 1
  for update;

  if merge_candidate_row.id is not null then
    merge_applied := true;
    target_inventory_unit_uuid := merge_candidate_row.id;

    update public.inventory_unit iu
    set quantity = iu.quantity + split_quantity,
        updated_at = occurred_at_utc,
        updated_by = actor_uuid
    where iu.id = merge_candidate_row.id
    returning iu.quantity into target_quantity_after;
  else
    insert into public.inventory_unit (
      tenant_id,
      container_id,
      product_id,
      quantity,
      uom,
      lot_code,
      serial_no,
      expiry_date,
      status,
      created_at,
      updated_at,
      created_by,
      updated_by,
      source_inventory_unit_id
    )
    values (
      source_row.tenant_id,
      target_container_row.id,
      source_row.product_id,
      split_quantity,
      source_row.uom,
      source_row.lot_code,
      source_row.serial_no,
      source_row.expiry_date,
      source_row.status,
      occurred_at_utc,
      occurred_at_utc,
      actor_uuid,
      actor_uuid,
      source_row.id
    )
    returning id, quantity
    into target_inventory_unit_uuid, target_quantity_after;
  end if;

  split_movement_uuid := public.insert_stock_movement(
    source_row.tenant_id,
    'split_stock',
    source_location_row.location_id,
    target_location_row.location_id,
    source_row.container_id,
    target_container_row.id,
    source_row.id,
    target_inventory_unit_uuid,
    split_quantity,
    source_row.uom,
    'done',
    occurred_at_utc,
    occurred_at_utc,
    actor_uuid
  );

  return jsonb_build_object(
    'sourceInventoryUnitId', source_row.id,
    'targetInventoryUnitId', target_inventory_unit_uuid,
    'sourceContainerId', source_row.container_id,
    'targetContainerId', target_container_row.id,
    'sourceLocationId', source_location_row.location_id,
    'targetLocationId', target_location_row.location_id,
    'quantity', split_quantity,
    'uom', source_row.uom,
    'mergeApplied', merge_applied,
    'sourceQuantity', source_quantity_after,
    'targetQuantity', target_quantity_after,
    'movementId', split_movement_uuid,
    'occurredAt', occurred_at_utc
  );
end
$$;

create or replace function public.transfer_inventory_unit(
  source_inventory_unit_uuid uuid,
  quantity numeric,
  target_container_uuid uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  split_result jsonb;
  transfer_movement_uuid uuid;
  split_movement_uuid uuid;
  source_tenant_uuid uuid;
begin
  split_result := public.split_inventory_unit(
    source_inventory_unit_uuid,
    quantity,
    target_container_uuid,
    actor_uuid
  );

  select iu.tenant_id
  into source_tenant_uuid
  from public.inventory_unit iu
  where iu.id = (split_result ->> 'sourceInventoryUnitId')::uuid;

  split_movement_uuid := (split_result ->> 'movementId')::uuid;

  transfer_movement_uuid := public.insert_stock_movement(
    source_tenant_uuid,
    'transfer_stock',
    (split_result ->> 'sourceLocationId')::uuid,
    (split_result ->> 'targetLocationId')::uuid,
    (split_result ->> 'sourceContainerId')::uuid,
    (split_result ->> 'targetContainerId')::uuid,
    (split_result ->> 'sourceInventoryUnitId')::uuid,
    (split_result ->> 'targetInventoryUnitId')::uuid,
    (split_result ->> 'quantity')::numeric,
    split_result ->> 'uom',
    'done',
    timezone('utc', now()),
    timezone('utc', now()),
    actor_uuid
  );

  return split_result || jsonb_build_object(
    'splitMovementId', split_movement_uuid,
    'transferMovementId', transfer_movement_uuid
  );
end
$$;

create or replace function public.pick_partial_inventory_unit(
  source_inventory_unit_uuid uuid,
  quantity numeric,
  pick_container_uuid uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  split_result jsonb;
  pick_movement_uuid uuid;
  split_movement_uuid uuid;
  source_tenant_uuid uuid;
begin
  split_result := public.split_inventory_unit(
    source_inventory_unit_uuid,
    quantity,
    pick_container_uuid,
    actor_uuid
  );

  select iu.tenant_id
  into source_tenant_uuid
  from public.inventory_unit iu
  where iu.id = (split_result ->> 'sourceInventoryUnitId')::uuid;

  split_movement_uuid := (split_result ->> 'movementId')::uuid;

  pick_movement_uuid := public.insert_stock_movement(
    source_tenant_uuid,
    'pick_partial',
    (split_result ->> 'sourceLocationId')::uuid,
    (split_result ->> 'targetLocationId')::uuid,
    (split_result ->> 'sourceContainerId')::uuid,
    (split_result ->> 'targetContainerId')::uuid,
    (split_result ->> 'sourceInventoryUnitId')::uuid,
    (split_result ->> 'targetInventoryUnitId')::uuid,
    (split_result ->> 'quantity')::numeric,
    split_result ->> 'uom',
    'done',
    timezone('utc', now()),
    timezone('utc', now()),
    actor_uuid
  );

  return split_result || jsonb_build_object(
    'splitMovementId', split_movement_uuid,
    'transferMovementId', pick_movement_uuid
  );
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
  container_tenant_uuid uuid;
  source_location_row record;
  target_location_row record;
  occupying_container_uuid uuid;
  legacy_move_result jsonb;
  movement_uuid uuid;
  occurred_at_utc timestamptz;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = container_uuid
  for update;

  if container_tenant_uuid is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  select *
  into source_location_row
  from public.resolve_active_location_for_container(container_uuid);

  if source_location_row.location_id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  select
    l.id,
    l.tenant_id,
    l.floor_id,
    l.geometry_slot_id,
    l.status
  into target_location_row
  from public.locations l
  where l.id = target_location_uuid
    and l.tenant_id = container_tenant_uuid
  for update;

  if target_location_row.id is null then
    raise exception 'TARGET_LOCATION_NOT_FOUND';
  end if;

  if target_location_row.status <> 'active' then
    raise exception 'TARGET_LOCATION_NOT_ACTIVE';
  end if;

  if target_location_row.geometry_slot_id is null then
    raise exception 'TARGET_LOCATION_NOT_WRITABLE';
  end if;

  select acl.container_id
  into occupying_container_uuid
  from public.active_container_locations_v acl
  where acl.location_id = target_location_row.id
    and acl.container_id <> container_uuid
  limit 1;

  if occupying_container_uuid is not null then
    raise exception 'TARGET_LOCATION_OCCUPIED';
  end if;

  legacy_move_result := public.move_container(container_uuid, target_location_row.geometry_slot_id, actor_uuid);
  occurred_at_utc := coalesce((legacy_move_result ->> 'occurredAt')::timestamptz, timezone('utc', now()));

  movement_uuid := public.insert_stock_movement(
    container_tenant_uuid,
    'move_container',
    source_location_row.location_id,
    target_location_row.id,
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
    'targetLocationId', target_location_row.id,
    'movementId', movement_uuid,
    'occurredAt', occurred_at_utc
  );
end
$$;

grant execute on function public.resolve_active_location_for_container(uuid) to authenticated;
grant execute on function public.insert_stock_movement(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, numeric, text, text, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.split_inventory_unit(uuid, numeric, uuid, uuid) to authenticated;
grant execute on function public.transfer_inventory_unit(uuid, numeric, uuid, uuid) to authenticated;
grant execute on function public.pick_partial_inventory_unit(uuid, numeric, uuid, uuid) to authenticated;
grant execute on function public.move_container_canonical(uuid, uuid, uuid) to authenticated;
