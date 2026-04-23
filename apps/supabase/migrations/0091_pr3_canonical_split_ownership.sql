-- 0091_pr3_canonical_split_ownership.sql
--
-- PR3: make split/transfer/pick-partial current physical contents canonical
-- in container_lines while keeping inventory_unit as the transitional
-- execution/runtime projection.
--
-- Scope intentionally limited to:
--   - container_lines current-state + lineage columns
--   - baseline current-state backfill for existing receipt/projection rows
--   - split_inventory_unit ownership migration
--   - transfer_inventory_unit and pick_partial_inventory_unit callers, via split
--
-- Out of scope:
--   - execute_pick_step full-pick path
--   - direct inventory_unit adjustment/repack mutation
--   - runtime storage view repointing

alter table public.container_lines
  add column if not exists line_kind text not null default 'receipt',
  add column if not exists current_container_id uuid null references public.containers(id) on delete restrict,
  add column if not exists current_qty_each numeric null,
  add column if not exists current_inventory_status text null,
  add column if not exists current_packaging_state text null,
  add column if not exists current_packaging_profile_level_id uuid null references public.packaging_profile_levels(id) on delete set null,
  add column if not exists current_pack_count integer null,
  add column if not exists root_receipt_line_id uuid null references public.container_lines(id) on delete set null,
  add column if not exists parent_container_line_id uuid null references public.container_lines(id) on delete set null,
  add column if not exists current_updated_at timestamptz null,
  add column if not exists current_updated_by uuid null references public.profiles(id) on delete set null;

alter table public.container_lines
  drop constraint if exists container_lines_line_kind_check;

alter table public.container_lines
  add constraint container_lines_line_kind_check
  check (line_kind in ('receipt', 'current_fragment'));

alter table public.container_lines
  drop constraint if exists container_lines_current_qty_each_check;

alter table public.container_lines
  add constraint container_lines_current_qty_each_check
  check (current_qty_each is null or current_qty_each >= 0);

alter table public.container_lines
  drop constraint if exists container_lines_current_inventory_status_check;

alter table public.container_lines
  add constraint container_lines_current_inventory_status_check
  check (
    current_inventory_status is null
    or current_inventory_status in ('available', 'reserved', 'damaged', 'hold')
  );

alter table public.container_lines
  drop constraint if exists container_lines_current_packaging_state_check;

alter table public.container_lines
  add constraint container_lines_current_packaging_state_check
  check (
    current_packaging_state is null
    or current_packaging_state in ('sealed', 'opened', 'loose')
  );

alter table public.container_lines
  drop constraint if exists container_lines_current_pack_count_check;

alter table public.container_lines
  add constraint container_lines_current_pack_count_check
  check (current_pack_count is null or current_pack_count > 0);

create index if not exists container_lines_current_container_product_idx
  on public.container_lines (current_container_id, product_id, current_inventory_status)
  where current_container_id is not null;

create index if not exists container_lines_lineage_root_idx
  on public.container_lines (root_receipt_line_id)
  where root_receipt_line_id is not null;

create index if not exists container_lines_parent_idx
  on public.container_lines (parent_container_line_id)
  where parent_container_line_id is not null;

-- Existing receipt rows become their own canonical current owners.
update public.container_lines cl
set line_kind = coalesce(cl.line_kind, 'receipt'),
    root_receipt_line_id = coalesce(cl.root_receipt_line_id, cl.id),
    parent_container_line_id = case
      when coalesce(cl.line_kind, 'receipt') = 'receipt' then null
      else cl.parent_container_line_id
    end,
    current_container_id = coalesce(cl.current_container_id, iu.container_id, cl.container_id),
    current_qty_each = coalesce(cl.current_qty_each, iu.quantity, cl.qty_each),
    current_inventory_status = coalesce(cl.current_inventory_status, iu.status, cl.inventory_status),
    current_packaging_state = coalesce(cl.current_packaging_state, iu.packaging_state, 'loose'),
    current_packaging_profile_level_id = coalesce(
      cl.current_packaging_profile_level_id,
      resolved_profile_level.id,
      cl.packaging_profile_level_id_at_receipt
    ),
    current_pack_count = coalesce(cl.current_pack_count, iu.pack_count),
    current_updated_at = coalesce(cl.current_updated_at, iu.updated_at, cl.created_at),
    current_updated_by = coalesce(cl.current_updated_by, iu.updated_by, cl.created_by)
from public.inventory_unit iu
left join lateral (
  select ppl.id
  from public.packaging_profile_levels ppl
  join public.packaging_profiles pp on pp.id = ppl.profile_id
  where ppl.legacy_product_packaging_level_id = iu.product_packaging_level_id
    and pp.tenant_id = iu.tenant_id
    and pp.product_id = iu.product_id
  order by pp.priority desc, ppl.id
  limit 1
) resolved_profile_level on true
where iu.container_line_id = cl.id;

update public.container_lines cl
set line_kind = coalesce(cl.line_kind, 'receipt'),
    root_receipt_line_id = coalesce(cl.root_receipt_line_id, cl.id),
    parent_container_line_id = case
      when coalesce(cl.line_kind, 'receipt') = 'receipt' then null
      else cl.parent_container_line_id
    end,
    current_container_id = coalesce(cl.current_container_id, cl.container_id),
    current_qty_each = coalesce(cl.current_qty_each, cl.qty_each),
    current_inventory_status = coalesce(cl.current_inventory_status, cl.inventory_status),
    current_packaging_state = coalesce(cl.current_packaging_state, 'loose'),
    current_packaging_profile_level_id = coalesce(
      cl.current_packaging_profile_level_id,
      cl.packaging_profile_level_id_at_receipt
    ),
    current_updated_at = coalesce(cl.current_updated_at, cl.created_at),
    current_updated_by = coalesce(cl.current_updated_by, cl.created_by)
where cl.current_qty_each is null
   or cl.current_container_id is null
   or cl.current_inventory_status is null
   or cl.current_packaging_state is null
   or cl.root_receipt_line_id is null;

create or replace function public.ensure_inventory_unit_current_container_line(
  inventory_unit_uuid uuid,
  actor_uuid uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  iu_row public.inventory_unit%rowtype;
  line_row public.container_lines%rowtype;
  resolved_profile_level_uuid uuid;
  inserted_line_uuid uuid;
  normalized_packaging_state text;
  now_utc timestamptz := timezone('utc', now());
begin
  select *
  into iu_row
  from public.inventory_unit
  where id = inventory_unit_uuid
  for update;

  if iu_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  normalized_packaging_state := coalesce(iu_row.packaging_state, 'loose');

  if iu_row.product_packaging_level_id is not null then
    select ppl.id
    into resolved_profile_level_uuid
    from public.packaging_profile_levels ppl
    join public.packaging_profiles pp on pp.id = ppl.profile_id
    where ppl.legacy_product_packaging_level_id = iu_row.product_packaging_level_id
      and pp.tenant_id = iu_row.tenant_id
      and pp.product_id = iu_row.product_id
    order by pp.priority desc, ppl.id
    limit 1;
  end if;

  if iu_row.container_line_id is not null then
    select *
    into line_row
    from public.container_lines
    where id = iu_row.container_line_id
    for update;

    if line_row.id is null then
      raise exception 'CONTAINER_LINE_NOT_FOUND';
    end if;

    if line_row.current_container_id is null
       or line_row.current_qty_each is null
       or line_row.current_inventory_status is null
       or line_row.current_packaging_state is null
       or line_row.root_receipt_line_id is null then
      update public.container_lines
      set line_kind = coalesce(line_kind, 'receipt'),
          root_receipt_line_id = coalesce(root_receipt_line_id, id),
          parent_container_line_id = case
            when coalesce(line_kind, 'receipt') = 'receipt' then null
            else parent_container_line_id
          end,
          current_container_id = coalesce(current_container_id, iu_row.container_id),
          current_qty_each = coalesce(current_qty_each, iu_row.quantity),
          current_inventory_status = coalesce(current_inventory_status, iu_row.status),
          current_packaging_state = coalesce(current_packaging_state, normalized_packaging_state),
          current_packaging_profile_level_id = coalesce(
            current_packaging_profile_level_id,
            resolved_profile_level_uuid,
            packaging_profile_level_id_at_receipt
          ),
          current_pack_count = coalesce(current_pack_count, iu_row.pack_count),
          current_updated_at = coalesce(current_updated_at, iu_row.updated_at, now_utc),
          current_updated_by = coalesce(current_updated_by, iu_row.updated_by, actor_uuid)
      where id = iu_row.container_line_id;
    end if;

    return iu_row.container_line_id;
  end if;

  insert into public.container_lines (
    tenant_id,
    container_id,
    product_id,
    qty_each,
    lot_code,
    expiry_date,
    serial_no,
    packaging_profile_level_id_at_receipt,
    design_qty_each_at_receipt,
    is_non_standard_pack,
    inventory_status,
    created_at,
    created_by,
    line_kind,
    current_container_id,
    current_qty_each,
    current_inventory_status,
    current_packaging_state,
    current_packaging_profile_level_id,
    current_pack_count,
    current_updated_at,
    current_updated_by
  )
  values (
    iu_row.tenant_id,
    iu_row.container_id,
    iu_row.product_id,
    iu_row.quantity,
    iu_row.lot_code,
    iu_row.expiry_date,
    iu_row.serial_no,
    resolved_profile_level_uuid,
    null,
    true,
    iu_row.status,
    iu_row.created_at,
    iu_row.created_by,
    'receipt',
    iu_row.container_id,
    iu_row.quantity,
    iu_row.status,
    normalized_packaging_state,
    resolved_profile_level_uuid,
    iu_row.pack_count,
    coalesce(iu_row.updated_at, now_utc),
    coalesce(iu_row.updated_by, actor_uuid)
  )
  returning id into inserted_line_uuid;

  update public.container_lines
  set root_receipt_line_id = inserted_line_uuid
  where id = inserted_line_uuid;

  update public.inventory_unit
  set container_line_id = inserted_line_uuid,
      updated_at = now_utc,
      updated_by = actor_uuid
  where id = iu_row.id;

  return inserted_line_uuid;
end
$$;

-- Baseline any projection rows that predate the receipt bridge.
do $$
declare
  iu_uuid uuid;
begin
  for iu_uuid in
    select iu.id
    from public.inventory_unit iu
    where iu.container_line_id is null
    order by iu.created_at, iu.id
  loop
    perform public.ensure_inventory_unit_current_container_line(iu_uuid, null);
  end loop;
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
security definer
set search_path = public
as $$
declare
  source_row record;
  source_line_row public.container_lines%rowtype;
  target_container_row record;
  source_location_row record;
  target_location_row record;
  merge_candidate_row record;
  merge_line_row public.container_lines%rowtype;
  source_packaging_level_row record;
  target_inventory_unit_uuid uuid;
  target_container_line_uuid uuid;
  source_quantity_after numeric;
  target_quantity_after numeric;
  target_pack_count_after integer;
  split_pack_count integer := null;
  source_pack_count_after integer := null;
  merge_applied boolean := false;
  occurred_at_utc timestamptz := timezone('utc', now());
  split_movement_uuid uuid;
begin
  actor_uuid := auth.uid();

  perform public.ensure_inventory_unit_current_container_line(
    source_inventory_unit_uuid,
    actor_uuid
  );

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
    iu.status,
    iu.packaging_state,
    iu.product_packaging_level_id,
    iu.pack_count,
    iu.container_line_id
  into source_row
  from public.inventory_unit iu
  where iu.id = source_inventory_unit_uuid
    and public.can_manage_tenant(iu.tenant_id)
  for update;

  if source_row.id is null then
    raise exception 'SOURCE_INVENTORY_UNIT_NOT_FOUND';
  end if;

  select *
  into source_line_row
  from public.container_lines cl
  where cl.id = source_row.container_line_id
  for update;

  if source_line_row.id is null then
    raise exception 'CONTAINER_LINE_NOT_FOUND';
  end if;

  if split_quantity <= 0 or split_quantity >= source_line_row.current_qty_each then
    raise exception 'INVALID_SPLIT_QUANTITY';
  end if;

  if source_row.serial_no is not null or source_line_row.serial_no is not null then
    raise exception 'SERIAL_SPLIT_NOT_ALLOWED';
  end if;

  if source_line_row.current_packaging_state = 'opened' then
    raise exception 'OPENED_PACKAGING_SPLIT_NOT_ALLOWED';
  end if;

  if source_line_row.current_packaging_state = 'sealed' then
    select
      ppl.id,
      ppl.base_unit_qty
    into source_packaging_level_row
    from public.product_packaging_levels ppl
    where ppl.id = source_row.product_packaging_level_id;

    if source_packaging_level_row.id is null and source_line_row.current_packaging_profile_level_id is not null then
      select
        ppl.id,
        ppl.qty_each as base_unit_qty
      into source_packaging_level_row
      from public.packaging_profile_levels ppl
      where ppl.id = source_line_row.current_packaging_profile_level_id;
    end if;

    if source_packaging_level_row.id is null then
      raise exception 'PACKAGING_LEVEL_NOT_FOUND';
    end if;

    if mod(split_quantity, source_packaging_level_row.base_unit_qty) <> 0 then
      raise exception 'SEALED_SPLIT_REQUIRES_WHOLE_PACKS';
    end if;

    split_pack_count := (split_quantity / source_packaging_level_row.base_unit_qty)::integer;
    source_pack_count_after := coalesce(source_line_row.current_pack_count, source_row.pack_count) - split_pack_count;
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
    raise exception 'TARGET_CONTAINER_NOT_FOUND';
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

  source_quantity_after := source_line_row.current_qty_each - split_quantity;

  update public.container_lines
  set current_qty_each = source_quantity_after,
      current_pack_count = case
        when source_line_row.current_packaging_state = 'sealed' then source_pack_count_after
        else current_pack_count
      end,
      current_updated_at = occurred_at_utc,
      current_updated_by = actor_uuid
  where id = source_line_row.id;

  update public.inventory_unit
  set quantity = source_quantity_after,
      pack_count = case
        when source_line_row.current_packaging_state = 'sealed' then source_pack_count_after
        else pack_count
      end,
      container_line_id = source_line_row.id,
      updated_at = occurred_at_utc,
      updated_by = actor_uuid
  where id = source_row.id;

  select
    iu.id,
    iu.quantity,
    iu.pack_count,
    iu.container_line_id
  into merge_candidate_row
  from public.inventory_unit iu
  where iu.tenant_id = source_row.tenant_id
    and iu.container_id = target_container_row.id
    and iu.product_id = source_row.product_id
    and iu.uom = source_row.uom
    and iu.status = source_row.status
    and iu.packaging_state = source_row.packaging_state
    and iu.product_packaging_level_id is not distinct from source_row.product_packaging_level_id
    and iu.serial_no is null
    and iu.lot_code is not distinct from source_row.lot_code
    and iu.expiry_date is not distinct from source_row.expiry_date
  order by iu.created_at, iu.id
  limit 1
  for update;

  if merge_candidate_row.id is not null then
    merge_applied := true;
    target_inventory_unit_uuid := merge_candidate_row.id;
    target_container_line_uuid := public.ensure_inventory_unit_current_container_line(
      target_inventory_unit_uuid,
      actor_uuid
    );

    select *
    into merge_line_row
    from public.container_lines
    where id = target_container_line_uuid
    for update;

    target_quantity_after := merge_line_row.current_qty_each + split_quantity;
    target_pack_count_after := case
      when source_line_row.current_packaging_state = 'loose' then null
      else coalesce(merge_line_row.current_pack_count, merge_candidate_row.pack_count, 0) + coalesce(split_pack_count, 0)
    end;

    update public.container_lines
    set current_qty_each = target_quantity_after,
        current_pack_count = target_pack_count_after,
        current_updated_at = occurred_at_utc,
        current_updated_by = actor_uuid
    where id = target_container_line_uuid;

    update public.inventory_unit
    set quantity = target_quantity_after,
        pack_count = target_pack_count_after,
        container_line_id = target_container_line_uuid,
        updated_at = occurred_at_utc,
        updated_by = actor_uuid
    where id = target_inventory_unit_uuid;
  else
    insert into public.container_lines (
      tenant_id,
      container_id,
      product_id,
      qty_each,
      lot_code,
      expiry_date,
      serial_no,
      packaging_profile_id_at_receipt,
      packaging_profile_level_id_at_receipt,
      level_type_at_receipt,
      design_qty_each_at_receipt,
      container_type_at_receipt,
      is_non_standard_pack,
      inventory_status,
      pack_level_snapshot_jsonb,
      created_by,
      line_kind,
      current_container_id,
      current_qty_each,
      current_inventory_status,
      current_packaging_state,
      current_packaging_profile_level_id,
      current_pack_count,
      root_receipt_line_id,
      parent_container_line_id,
      current_updated_at,
      current_updated_by
    )
    values (
      source_line_row.tenant_id,
      source_line_row.container_id,
      source_line_row.product_id,
      split_quantity,
      source_line_row.lot_code,
      source_line_row.expiry_date,
      null,
      source_line_row.packaging_profile_id_at_receipt,
      source_line_row.packaging_profile_level_id_at_receipt,
      source_line_row.level_type_at_receipt,
      source_line_row.design_qty_each_at_receipt,
      source_line_row.container_type_at_receipt,
      source_line_row.is_non_standard_pack,
      source_line_row.inventory_status,
      source_line_row.pack_level_snapshot_jsonb,
      actor_uuid,
      'current_fragment',
      target_container_row.id,
      split_quantity,
      source_line_row.current_inventory_status,
      source_line_row.current_packaging_state,
      source_line_row.current_packaging_profile_level_id,
      split_pack_count,
      coalesce(source_line_row.root_receipt_line_id, source_line_row.id),
      source_line_row.id,
      occurred_at_utc,
      actor_uuid
    )
    returning id, current_qty_each, current_pack_count
    into target_container_line_uuid, target_quantity_after, target_pack_count_after;

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
      packaging_state,
      product_packaging_level_id,
      pack_count,
      created_at,
      updated_at,
      created_by,
      updated_by,
      source_inventory_unit_id,
      container_line_id
    )
    values (
      source_row.tenant_id,
      target_container_row.id,
      source_row.product_id,
      split_quantity,
      source_row.uom,
      source_row.lot_code,
      null,
      source_row.expiry_date,
      source_row.status,
      source_line_row.current_packaging_state,
      source_row.product_packaging_level_id,
      split_pack_count,
      occurred_at_utc,
      occurred_at_utc,
      actor_uuid,
      actor_uuid,
      source_row.id,
      target_container_line_uuid
    )
    returning id, quantity, pack_count
    into target_inventory_unit_uuid, target_quantity_after, target_pack_count_after;
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
