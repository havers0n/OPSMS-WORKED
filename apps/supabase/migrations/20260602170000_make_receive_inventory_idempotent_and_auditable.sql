-- PR-P0B: Make receive_inventory_unit auditable and idempotent
--
-- Changes:
--   1. Insert a stock_movements row (movement_type='receive') after each
--      successful first-time receive so the audit trail captures the event.
--   2. The movement is only written on first receive (the early-return idempotent
--      paths at lines 906 and 1046 skip this block).
--   3. The existing correlation-key idempotency, constraint, and conflict checks
--      are preserved.

drop function if exists public.receive_inventory_unit(
  uuid, uuid, uuid, numeric, text, uuid, text, uuid, integer,
  text, text, text, date, uuid, uuid, text, text
);

create or replace function public.receive_inventory_unit(
  tenant_uuid uuid,
  container_uuid uuid,
  product_uuid uuid,
  quantity numeric,
  uom text,
  actor_uuid uuid default null,
  packaging_state text default 'loose',
  product_packaging_level_uuid uuid default null,
  pack_count integer default null,
  receipt_correlation_key text default null,
  lot_code text default null,
  serial_no text default null,
  expiry_date date default null,
  packaging_profile_uuid uuid default null,
  packaging_profile_level_uuid uuid default null,
  source_document_type_input text default null,
  source_document_id_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  container_row record;
  product_row record;
  resolved_location_policy public.location_policies%rowtype;
  resolved_sku_location_policy public.sku_location_policies%rowtype;
  requested_packaging_level_row record;
  projection_packaging_level_row record;
  resolved_profile_row public.packaging_profiles%rowtype;
  resolved_level_row public.packaging_profile_levels%rowtype;
  canonical_line_row public.container_lines%rowtype;
  projection_row public.inventory_unit%rowtype;
  existing_line_row public.container_lines%rowtype;
  existing_projection_row public.inventory_unit%rowtype;
  effective_inventory_status text := 'available';
  profile_candidate_count integer := 0;
  is_non_standard boolean := true;
  aggregate_line_count integer := 0;
  aggregate_packaging_profile_id uuid;
  aggregate_is_standard_pack boolean;
  normalized_uom text;
  normalized_lot_code text;
  normalized_serial_no text;
  normalized_packaging_state text;
  normalized_receipt_correlation_key text;
  receipt_conflicts boolean := false;
begin
  actor_uuid := auth.uid();

  normalized_uom := trim(uom);
  normalized_lot_code := nullif(trim(coalesce(lot_code, '')), '');
  normalized_serial_no := nullif(trim(coalesce(serial_no, '')), '');
  normalized_packaging_state := lower(trim(coalesce(packaging_state, 'loose')));
  normalized_receipt_correlation_key := nullif(trim(coalesce(receipt_correlation_key, '')), '');

  if normalized_packaging_state not in ('sealed', 'opened', 'loose') then
    raise exception 'INVALID_PACKAGING_STATE';
  end if;

  if normalized_serial_no is not null and quantity <> 1 then
    raise exception 'SERIAL_QUANTITY_MISMATCH';
  end if;

  if normalized_packaging_state = 'loose' then
    if product_packaging_level_uuid is not null or pack_count is not null then
      raise exception 'LOOSE_PACKAGING_METADATA_FORBIDDEN';
    end if;
  else
    if pack_count is null then
      raise exception 'PACK_COUNT_REQUIRED';
    end if;

    if pack_count <= 0 then
      raise exception 'INVALID_PACK_COUNT';
    end if;
  end if;

  select
    c.id,
    c.tenant_id,
    c.status,
    c.current_location_id
  into container_row
  from public.containers c
  where c.id = container_uuid
    and c.tenant_id = tenant_uuid
    and public.can_manage_tenant(c.tenant_id)
  for update;

  if container_row.id is null then
    raise exception 'CONTAINER_NOT_FOUND';
  end if;

  if container_row.status <> 'active' then
    raise exception 'CONTAINER_NOT_RECEIVABLE';
  end if;

  select
    p.id,
    p.source,
    p.external_product_id,
    p.sku,
    p.name,
    p.permalink,
    p.image_urls,
    p.image_files,
    p.is_active,
    p.created_at,
    p.updated_at
  into product_row
  from public.products p
  where p.id = product_uuid
  for update;

  if product_row.id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if not product_row.is_active then
    raise exception 'PRODUCT_INACTIVE';
  end if;

  perform public.sync_default_packaging_profile_from_legacy(tenant_uuid, product_uuid);

  if container_row.current_location_id is not null then
    select lp.*
    into resolved_location_policy
    from public.location_policies lp
    where lp.tenant_id = tenant_uuid
      and lp.location_id = container_row.current_location_id
      and lp.status = 'active'
    for update;

    select slp.*
    into resolved_sku_location_policy
    from public.sku_location_policies slp
    where slp.tenant_id = tenant_uuid
      and slp.location_id = container_row.current_location_id
      and slp.product_id = product_uuid
      and slp.status = 'active'
    for update;
  end if;

  if resolved_location_policy.id is not null then
    if not resolved_location_policy.receiving_enabled then
      raise exception 'LOCATION_RECEIVING_DISABLED';
    end if;

    effective_inventory_status := resolved_location_policy.default_inventory_status;

    if not resolved_location_policy.allow_mixed_skus and exists (
      select 1
      from public.container_lines cl
      where cl.container_id = container_uuid
        and cl.product_id <> product_uuid
    ) then
      raise exception 'LOCATION_MIXED_SKUS_FORBIDDEN';
    end if;
  end if;

  if resolved_sku_location_policy.id is not null then
    if resolved_sku_location_policy.min_qty_each is not null
      and quantity < resolved_sku_location_policy.min_qty_each then
      raise exception 'SKU_LOCATION_MIN_QTY_VIOLATION';
    end if;

    if resolved_sku_location_policy.max_qty_each is not null
      and quantity > resolved_sku_location_policy.max_qty_each then
      raise exception 'SKU_LOCATION_MAX_QTY_VIOLATION';
    end if;
  end if;

  if packaging_profile_uuid is not null then
    select pp.*
    into resolved_profile_row
    from public.packaging_profiles pp
    where pp.id = packaging_profile_uuid
      and pp.tenant_id = tenant_uuid
      and pp.product_id = product_uuid
      and pp.status = 'active'
    for update;

    if resolved_profile_row.id is null then
      raise exception 'PACKAGING_PROFILE_NOT_FOUND';
    end if;
  elsif normalized_packaging_state = 'loose' then
    if resolved_sku_location_policy.id is not null
      and resolved_sku_location_policy.preferred_packaging_profile_id is not null then
      select pp.*
      into resolved_profile_row
      from public.packaging_profiles pp
      where pp.id = resolved_sku_location_policy.preferred_packaging_profile_id
        and pp.tenant_id = tenant_uuid
        and pp.product_id = product_uuid
        and pp.status = 'active'
      for update;

      if resolved_profile_row.id is null then
        raise exception 'PACKAGING_PROFILE_NOT_FOUND';
      end if;
    else
      select count(*)
      into profile_candidate_count
      from public.packaging_profiles pp
      where pp.tenant_id = tenant_uuid
        and pp.product_id = product_uuid
        and pp.status = 'active'
        and pp.scope_type = 'tenant'
        and pp.scope_id = tenant_uuid
        and pp.is_default = true
        and public.packaging_profile_effective_window(pp.valid_from, pp.valid_to)
            @> now();

      if profile_candidate_count > 1 then
        raise exception 'PACKAGING_PROFILE_AMBIGUOUS';
      end if;

      select pp.*
      into resolved_profile_row
      from public.packaging_profiles pp
      where pp.tenant_id = tenant_uuid
        and pp.product_id = product_uuid
        and pp.status = 'active'
        and pp.scope_type = 'tenant'
        and pp.scope_id = tenant_uuid
        and pp.is_default = true
        and public.packaging_profile_effective_window(pp.valid_from, pp.valid_to)
            @> now()
      order by pp.priority desc, pp.valid_from desc nulls last, pp.id
      limit 1
      for update;
    end if;
  end if;

  if product_packaging_level_uuid is not null then
    select
      ppl.id,
      ppl.product_id,
      ppl.base_unit_qty,
      ppl.is_active,
      ppl.can_store
    into requested_packaging_level_row
    from public.product_packaging_levels ppl
    where ppl.id = product_packaging_level_uuid
    for update of ppl;

    if requested_packaging_level_row.id is null then
      raise exception 'PACKAGING_LEVEL_NOT_FOUND';
    end if;

    if requested_packaging_level_row.product_id <> product_uuid then
      raise exception 'PACKAGING_LEVEL_PRODUCT_MISMATCH';
    end if;

    if not requested_packaging_level_row.is_active then
      raise exception 'PACKAGING_LEVEL_INACTIVE';
    end if;

    if not requested_packaging_level_row.can_store then
      raise exception 'PACKAGING_LEVEL_NOT_STORABLE';
    end if;

    select bridge.*
    into resolved_level_row
    from public.packaging_profile_levels bridge
    join public.packaging_profiles bridge_profile
      on bridge_profile.id = bridge.profile_id
    where bridge.legacy_product_packaging_level_id = product_packaging_level_uuid
      and bridge_profile.tenant_id = tenant_uuid
      and bridge_profile.product_id = product_uuid
    order by bridge_profile.priority desc, bridge.id
    limit 1
    for update of bridge, bridge_profile;

    if resolved_level_row.id is null then
      raise exception 'PACKAGING_LEVEL_NOT_FOUND';
    end if;

    select pp.*
    into resolved_profile_row
    from public.packaging_profiles pp
    where pp.id = resolved_level_row.profile_id
    for update;
  elsif packaging_profile_level_uuid is not null then
    select ppl.*
    into resolved_level_row
    from public.packaging_profile_levels ppl
    join public.packaging_profiles pp on pp.id = ppl.profile_id
    where ppl.id = packaging_profile_level_uuid
      and pp.tenant_id = tenant_uuid
      and pp.product_id = product_uuid
      and pp.status = 'active'
    for update of ppl, pp;

    if resolved_level_row.id is null then
      raise exception 'PACKAGING_PROFILE_LEVEL_NOT_FOUND';
    end if;

    select pp.*
    into resolved_profile_row
    from public.packaging_profiles pp
    where pp.id = resolved_level_row.profile_id
    for update;
  elsif normalized_packaging_state <> 'loose' then
    raise exception 'PACKAGING_LEVEL_REQUIRED';
  end if;

  if normalized_packaging_state <> 'loose' then
    if resolved_level_row.legacy_product_packaging_level_id is null then
      raise exception 'PACKAGING_LEVEL_REQUIRED';
    end if;

    select
      ppl.id,
      ppl.product_id,
      ppl.base_unit_qty,
      ppl.is_active,
      ppl.can_store
    into projection_packaging_level_row
    from public.product_packaging_levels ppl
    where ppl.id = resolved_level_row.legacy_product_packaging_level_id
    for update of ppl;

    if projection_packaging_level_row.id is null then
      raise exception 'PACKAGING_LEVEL_NOT_FOUND';
    end if;

    if projection_packaging_level_row.product_id <> product_uuid then
      raise exception 'PACKAGING_LEVEL_PRODUCT_MISMATCH';
    end if;

    if not projection_packaging_level_row.is_active then
      raise exception 'PACKAGING_LEVEL_INACTIVE';
    end if;

    if not projection_packaging_level_row.can_store then
      raise exception 'PACKAGING_LEVEL_NOT_STORABLE';
    end if;

    if projection_packaging_level_row.base_unit_qty <> resolved_level_row.qty_each then
      raise exception 'PACKAGING_LEVEL_PROJECTION_MISMATCH';
    end if;

    if normalized_packaging_state = 'sealed'
      and quantity <> (pack_count * resolved_level_row.qty_each) then
      raise exception 'SEALED_PACK_COUNT_QUANTITY_MISMATCH';
    end if;

    if normalized_packaging_state = 'opened'
      and quantity > (pack_count * resolved_level_row.qty_each) then
      raise exception 'OPENED_PACK_COUNT_QUANTITY_EXCEEDED';
    end if;

    if quantity = (pack_count * resolved_level_row.qty_each) then
      is_non_standard := false;
    else
      is_non_standard := true;
    end if;
  else
    is_non_standard := true;
  end if;

  if normalized_receipt_correlation_key is not null then
    select cl.*
    into existing_line_row
    from public.container_lines cl
    where cl.tenant_id = tenant_uuid
      and cl.receipt_correlation_key = normalized_receipt_correlation_key
    for update;

    if existing_line_row.id is not null then
      select iu.*
      into existing_projection_row
      from public.inventory_unit iu
      where iu.container_line_id = existing_line_row.id
      for update;

      if existing_projection_row.id is null then
        raise exception 'RECEIPT_CORRELATION_CONFLICT';
      end if;

      receipt_conflicts :=
        existing_line_row.container_id <> container_uuid
        or existing_line_row.product_id <> product_uuid
        or existing_line_row.qty_each <> quantity
        or existing_line_row.lot_code is distinct from normalized_lot_code
        or existing_line_row.expiry_date is distinct from expiry_date
        or existing_line_row.serial_no is distinct from normalized_serial_no
        or existing_line_row.packaging_profile_id_at_receipt is distinct from resolved_profile_row.id
        or existing_line_row.packaging_profile_level_id_at_receipt is distinct from resolved_level_row.id
        or existing_line_row.level_type_at_receipt is distinct from resolved_level_row.level_type
        or existing_line_row.design_qty_each_at_receipt is distinct from resolved_level_row.qty_each
        or existing_line_row.container_type_at_receipt is distinct from resolved_level_row.container_type
        or existing_line_row.is_non_standard_pack <> is_non_standard
        or existing_line_row.inventory_status <> effective_inventory_status
        or existing_projection_row.uom <> normalized_uom
        or existing_projection_row.packaging_state <> normalized_packaging_state
        or existing_projection_row.product_packaging_level_id is distinct from resolved_level_row.legacy_product_packaging_level_id
        or existing_projection_row.pack_count is distinct from pack_count;

      if receipt_conflicts then
        raise exception 'RECEIPT_CORRELATION_CONFLICT';
      end if;

      return jsonb_build_object(
        'inventoryUnit',
        jsonb_build_object(
          'id', existing_projection_row.id,
          'tenant_id', existing_projection_row.tenant_id,
          'container_id', existing_projection_row.container_id,
          'product_id', existing_projection_row.product_id,
          'quantity', existing_projection_row.quantity,
          'uom', existing_projection_row.uom,
          'lot_code', existing_projection_row.lot_code,
          'serial_no', existing_projection_row.serial_no,
          'expiry_date', existing_projection_row.expiry_date,
          'status', existing_projection_row.status,
          'packaging_state', existing_projection_row.packaging_state,
          'product_packaging_level_id', existing_projection_row.product_packaging_level_id,
          'pack_count', existing_projection_row.pack_count,
          'created_at', existing_projection_row.created_at,
          'updated_at', existing_projection_row.updated_at,
          'created_by', existing_projection_row.created_by,
          'container_line_id', existing_projection_row.container_line_id
        ),
        'product',
        jsonb_build_object(
          'id', product_row.id,
          'source', product_row.source,
          'external_product_id', product_row.external_product_id,
          'sku', product_row.sku,
          'name', product_row.name,
          'permalink', product_row.permalink,
          'image_urls', product_row.image_urls,
          'image_files', product_row.image_files,
          'is_active', product_row.is_active,
          'created_at', product_row.created_at,
          'updated_at', product_row.updated_at
        )
      );
    end if;
  end if;

  begin
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
      receipt_correlation_key,
      created_by
    )
    values (
      tenant_uuid,
      container_uuid,
      product_uuid,
      quantity,
      normalized_lot_code,
      expiry_date,
      normalized_serial_no,
      resolved_profile_row.id,
      resolved_level_row.id,
      resolved_level_row.level_type,
      resolved_level_row.qty_each,
      resolved_level_row.container_type,
      is_non_standard,
      effective_inventory_status,
      case
        when resolved_level_row.id is null and resolved_profile_row.id is null then null
        else jsonb_build_object(
          'packaging_profile_id', resolved_profile_row.id,
          'packaging_profile_level_id', resolved_level_row.id,
          'legacy_product_packaging_level_id', resolved_level_row.legacy_product_packaging_level_id,
          'level_type', resolved_level_row.level_type,
          'design_qty_each', resolved_level_row.qty_each,
          'container_type', resolved_level_row.container_type
        )
      end,
      normalized_receipt_correlation_key,
      actor_uuid
    )
    returning *
    into canonical_line_row;
  exception
    when unique_violation then
      if normalized_receipt_correlation_key is null then
        raise;
      end if;

      select cl.*
      into existing_line_row
      from public.container_lines cl
      where cl.tenant_id = tenant_uuid
        and cl.receipt_correlation_key = normalized_receipt_correlation_key
      for update;

      if existing_line_row.id is null then
        raise;
      end if;

      select iu.*
      into existing_projection_row
      from public.inventory_unit iu
      where iu.container_line_id = existing_line_row.id
      for update;

      if existing_projection_row.id is null then
        raise exception 'RECEIPT_CORRELATION_CONFLICT';
      end if;

      receipt_conflicts :=
        existing_line_row.container_id <> container_uuid
        or existing_line_row.product_id <> product_uuid
        or existing_line_row.qty_each <> quantity
        or existing_line_row.lot_code is distinct from normalized_lot_code
        or existing_line_row.expiry_date is distinct from expiry_date
        or existing_line_row.serial_no is distinct from normalized_serial_no
        or existing_line_row.packaging_profile_id_at_receipt is distinct from resolved_profile_row.id
        or existing_line_row.packaging_profile_level_id_at_receipt is distinct from resolved_level_row.id
        or existing_line_row.level_type_at_receipt is distinct from resolved_level_row.level_type
        or existing_line_row.design_qty_each_at_receipt is distinct from resolved_level_row.qty_each
        or existing_line_row.container_type_at_receipt is distinct from resolved_level_row.container_type
        or existing_line_row.is_non_standard_pack <> is_non_standard
        or existing_line_row.inventory_status <> effective_inventory_status
        or existing_projection_row.uom <> normalized_uom
        or existing_projection_row.packaging_state <> normalized_packaging_state
        or existing_projection_row.product_packaging_level_id is distinct from resolved_level_row.legacy_product_packaging_level_id
        or existing_projection_row.pack_count is distinct from pack_count;

      if receipt_conflicts then
        raise exception 'RECEIPT_CORRELATION_CONFLICT';
      end if;

      return jsonb_build_object(
        'inventoryUnit',
        jsonb_build_object(
          'id', existing_projection_row.id,
          'tenant_id', existing_projection_row.tenant_id,
          'container_id', existing_projection_row.container_id,
          'product_id', existing_projection_row.product_id,
          'quantity', existing_projection_row.quantity,
          'uom', existing_projection_row.uom,
          'lot_code', existing_projection_row.lot_code,
          'serial_no', existing_projection_row.serial_no,
          'expiry_date', existing_projection_row.expiry_date,
          'status', existing_projection_row.status,
          'packaging_state', existing_projection_row.packaging_state,
          'product_packaging_level_id', existing_projection_row.product_packaging_level_id,
          'pack_count', existing_projection_row.pack_count,
          'created_at', existing_projection_row.created_at,
          'updated_at', existing_projection_row.updated_at,
          'created_by', existing_projection_row.created_by,
          'container_line_id', existing_projection_row.container_line_id
        ),
        'product',
        jsonb_build_object(
          'id', product_row.id,
          'source', product_row.source,
          'external_product_id', product_row.external_product_id,
          'sku', product_row.sku,
          'name', product_row.name,
          'permalink', product_row.permalink,
          'image_urls', product_row.image_urls,
          'image_files', product_row.image_files,
          'is_active', product_row.is_active,
          'created_at', product_row.created_at,
          'updated_at', product_row.updated_at
        )
      );
  end;

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
    created_by,
    container_line_id
  )
  values (
    tenant_uuid,
    container_uuid,
    product_uuid,
    quantity,
    normalized_uom,
    normalized_lot_code,
    normalized_serial_no,
    expiry_date,
    effective_inventory_status,
    normalized_packaging_state,
    resolved_level_row.legacy_product_packaging_level_id,
    pack_count,
    actor_uuid,
    canonical_line_row.id
  )
  returning *
  into projection_row;

  -- PR-P0B: Write audit trail — stock_movement for receive event.
  -- Only reaches here on first-time receive (idempotent paths return above).
  perform public.insert_stock_movement(
    tenant_uuid,
    'receive',
    null,                              -- source_location_uuid: incoming from outside
    container_row.current_location_id, -- target_location_uuid (nullable)
    null,                              -- source_container_uuid
    container_uuid,                    -- target_container_uuid
    null,                              -- source_inventory_unit_uuid
    projection_row.id,                 -- target_inventory_unit_uuid
    quantity,                          -- quantity_value
    normalized_uom,                    -- uom_value
    'done',                            -- movement_status
    timezone('utc', now()),            -- created_at_utc
    null,                              -- completed_at_utc (null → defaults to created_at when status='done')
    actor_uuid                         -- actor_uuid
  );

  select
    count(*),
    case
      when count(*) = 1 then min(cl.packaging_profile_id_at_receipt::text)::uuid
      else null
    end,
    case
      when count(*) = 1 then bool_and(not cl.is_non_standard_pack)
      else null
    end
  into aggregate_line_count, aggregate_packaging_profile_id, aggregate_is_standard_pack
  from public.container_lines cl
  where cl.container_id = container_uuid;

  update public.containers
  set packaging_profile_id = aggregate_packaging_profile_id,
      is_standard_pack = aggregate_is_standard_pack,
      received_at = timezone('utc', now()),
      source_document_type = coalesce(source_document_type_input, public.containers.source_document_type),
      source_document_id = coalesce(source_document_id_input, public.containers.source_document_id),
      last_receipt_correlation_key = normalized_receipt_correlation_key,
      updated_at = timezone('utc', now()),
      updated_by = actor_uuid
  where id = container_uuid;

  return jsonb_build_object(
    'inventoryUnit',
    jsonb_build_object(
      'id', projection_row.id,
      'tenant_id', projection_row.tenant_id,
      'container_id', projection_row.container_id,
      'product_id', projection_row.product_id,
      'quantity', projection_row.quantity,
      'uom', projection_row.uom,
      'lot_code', projection_row.lot_code,
      'serial_no', projection_row.serial_no,
      'expiry_date', projection_row.expiry_date,
      'status', projection_row.status,
      'packaging_state', projection_row.packaging_state,
      'product_packaging_level_id', projection_row.product_packaging_level_id,
      'pack_count', projection_row.pack_count,
      'created_at', projection_row.created_at,
      'updated_at', projection_row.updated_at,
      'created_by', projection_row.created_by,
      'container_line_id', projection_row.container_line_id
    ),
    'product',
    jsonb_build_object(
      'id', product_row.id,
      'source', product_row.source,
      'external_product_id', product_row.external_product_id,
      'sku', product_row.sku,
      'name', product_row.name,
      'permalink', product_row.permalink,
      'image_urls', product_row.image_urls,
      'image_files', product_row.image_files,
      'is_active', product_row.is_active,
      'created_at', product_row.created_at,
      'updated_at', product_row.updated_at
    )
  );
end
$$;

revoke execute on function public.receive_inventory_unit(
  uuid, uuid, uuid, numeric, text, uuid, text, uuid, integer, text, text, text, date, uuid, uuid, text, text
) from public;

grant execute on function public.receive_inventory_unit(
  uuid, uuid, uuid, numeric, text, uuid, text, uuid, integer, text, text, text, date, uuid, uuid, text, text
) to authenticated;
