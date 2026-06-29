-- RPC to safely revert a demand planning publication.
-- Reverts only if no operational activity exists on the publication's orders.
-- Soft-deletes operational rows, releases consumption, reopens draft.
-- Does NOT delete ledger rows — only marks publication reverted.

alter table public.manual_shift_order_items
  add column if not exists deleted_at timestamptz null;

-- Allow revert audit events on orders
alter table public.manual_shift_order_events
  drop constraint if exists manual_shift_order_events_event_type_check,
  add constraint manual_shift_order_events_event_type_check
  check (event_type = any (array[
    'created', 'updated', 'status_changed',
    'error_reported', 'error_fixed',
    'comment_updated', 'picker_changed', 'checker_changed',
    'bulk_imported',
    'point_deleted', 'point_restored',
    'check_started',
    'check_unit_created', 'check_unit_status_changed', 'check_unit_note_changed',
    'ashlama_created', 'ashlama_status_changed',
    'deleted'
  ]));

create or replace function public.demand_planning_revert_publication(
  p_tenant_id uuid,
  p_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_publication public.demand_planning_publications%rowtype;
  v_draft public.demand_planning_drafts%rowtype;
  v_shift public.manual_shift_sessions%rowtype;
  v_actor_id uuid;
  v_actor_name text;
  v_profile public.profiles%rowtype;

  v_created_order_ids uuid[];
  v_created_item_ids uuid[];
  v_created_line_ids uuid[];
  v_created_lines_from_pub uuid[];

  v_reverted_orders int := 0;
  v_reverted_items int := 0;
  v_released_quantity numeric := 0;
  v_lines_deleted int := 0;
  v_line_id uuid;

  -- Activity detection counters
  v_non_queued_orders int;
  v_orders_with_picker int;
  v_orders_with_checker int;
  v_check_units_count int;
  v_operational_events int;
  v_block_reasons text[] := '{}'::text[];
begin
  v_actor_id := auth.uid();
  if v_actor_id is null or not public.can_manage_tenant(p_tenant_id) then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  select * into v_profile from public.profiles where id = v_actor_id;
  if v_profile.id is null then
    raise insufficient_privilege using message = 'FORBIDDEN';
  end if;

  v_actor_name := coalesce(
    nullif(btrim(v_profile.display_name), ''),
    nullif(btrim(v_profile.email), ''),
    'operator'
  );

  -- Lock and validate publication
  select * into v_publication
  from public.demand_planning_publications
  where id = p_publication_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'DEMAND_PLANNING_PUBLICATION_NOT_FOUND';
  end if;

  if v_publication.status = 'reverted' then
    raise exception 'DEMAND_PLANNING_PUBLICATION_ALREADY_REVERTED';
  end if;

  -- Lock and validate draft
  select * into v_draft
  from public.demand_planning_drafts
  where id = v_publication.draft_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_FOUND';
  end if;

  if v_draft.status <> 'applied' then
    raise exception 'DEMAND_PLANNING_DRAFT_NOT_APPLIED';
  end if;

  -- Lock shift (no status check — even closed shifts should be revertable if no activity)
  select * into v_shift
  from public.manual_shift_sessions
  where id = v_publication.target_shift_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'SHIFT_NOT_FOUND';
  end if;

  -- Collect IDs of operational rows created by this publication
  select array_agg(distinct pa.manual_shift_order_id)
    into v_created_order_ids
  from public.demand_planning_published_allocations pa
  where pa.publication_id = p_publication_id
    and pa.tenant_id = p_tenant_id
    and pa.manual_shift_order_id is not null;

  select array_agg(distinct pa.manual_shift_order_item_id)
    into v_created_item_ids
  from public.demand_planning_published_allocations pa
  where pa.publication_id = p_publication_id
    and pa.tenant_id = p_tenant_id
    and pa.manual_shift_order_item_id is not null;

  select array_agg(distinct pa.manual_shift_line_id)
    into v_created_line_ids
  from public.demand_planning_published_allocations pa
  where pa.publication_id = p_publication_id
    and pa.tenant_id = p_tenant_id
    and pa.manual_shift_line_id is not null;

  -- Lines that were created (not reused) by this publication
  select array_agg(distinct pa.manual_shift_line_id)
    into v_created_lines_from_pub
  from public.demand_planning_published_allocations pa
  where pa.publication_id = p_publication_id
    and pa.tenant_id = p_tenant_id
    and pa.line_created_by_publication = true
    and pa.manual_shift_line_id is not null;

  -- Activity check against orders created by this publication
  if v_created_order_ids is not null and array_length(v_created_order_ids, 1) > 0 then
    -- Check 1: orders with status != 'queued'
    select count(*) into v_non_queued_orders
    from public.manual_shift_orders
    where id = any(v_created_order_ids)
      and tenant_id = p_tenant_id
      and deleted_at is null
      and status <> 'queued';

    if v_non_queued_orders > 0 then
      v_block_reasons := array_append(v_block_reasons, 'orders_started');
    end if;

    -- Check 2: orders with picker assigned
    select count(*) into v_orders_with_picker
    from public.manual_shift_orders
    where id = any(v_created_order_ids)
      and tenant_id = p_tenant_id
      and deleted_at is null
      and (picker_worker_id is not null or picker_name is not null);

    if v_orders_with_picker > 0 then
      v_block_reasons := array_append(v_block_reasons, 'picker_assigned');
    end if;

    -- Check 3: orders with checker assigned
    select count(*) into v_orders_with_checker
    from public.manual_shift_orders
    where id = any(v_created_order_ids)
      and tenant_id = p_tenant_id
      and deleted_at is null
      and checker_name is not null;

    if v_orders_with_checker > 0 then
      v_block_reasons := array_append(v_block_reasons, 'checker_assigned');
    end if;

    -- Check 4: check units for these orders
    select count(*) into v_check_units_count
    from public.manual_shift_order_check_units
    where order_id = any(v_created_order_ids)
      and tenant_id = p_tenant_id;

    if v_check_units_count > 0 then
      v_block_reasons := array_append(v_block_reasons, 'check_units_exist');
    end if;

    -- Check 5: operational events beyond clean publish-created events
    -- Only block if events exist that are NOT 'created' with source 'demand_planning_publish'
    select count(*) into v_operational_events
    from public.manual_shift_order_events
    where order_id = any(v_created_order_ids)
      and tenant_id = p_tenant_id
      and (
        event_type <> 'created'
        or coalesce(payload->>'source', '') <> 'demand_planning_publish'
      );

    if v_operational_events > 0 then
      v_block_reasons := array_append(v_block_reasons, 'non_publish_events_exist');
    end if;
  end if;

  -- If any activity detected, block with details
  if array_length(v_block_reasons, 1) > 0 then
    raise exception 'DEMAND_PLANNING_PUBLISHED_SHIFT_HAS_ACTIVITY'
      using detail = to_json(v_block_reasons)::text;
  end if;

  -- Calculate total released quantity before revert
  select coalesce(sum(pa.published_quantity), 0) into v_released_quantity
  from public.demand_planning_published_allocations pa
  where pa.publication_id = p_publication_id
    and pa.tenant_id = p_tenant_id;

  -- 1. Soft-delete items created by this publication
  if v_created_item_ids is not null and array_length(v_created_item_ids, 1) > 0 then
    update public.manual_shift_order_items
    set deleted_at = timezone('utc', now())
    where id = any(v_created_item_ids)
      and tenant_id = p_tenant_id
      and deleted_at is null;

    get diagnostics v_reverted_items = row_count;
  end if;

  -- 2. Soft-delete orders created by this publication
  -- Orders are always created fresh by publish (no reuse), so we can
  -- safely soft-delete the entire order.
  if v_created_order_ids is not null and array_length(v_created_order_ids, 1) > 0 then
    update public.manual_shift_orders
    set deleted_at = timezone('utc', now()),
        deleted_by_profile_id = v_actor_id,
        deleted_by_name = v_actor_name,
        delete_reason = 'publication_reverted'
    where id = any(v_created_order_ids)
      and tenant_id = p_tenant_id
      and deleted_at is null;

    get diagnostics v_reverted_orders = row_count;

    -- 3. Insert audit events for reverted orders
    insert into public.manual_shift_order_events (
      tenant_id, shift_id, line_id, order_id,
      event_type, actor_profile_id, actor_name,
      from_status, to_status, payload
    )
    select
      p_tenant_id, v_publication.target_shift_id, o.line_id, o.id,
      'deleted', v_actor_id, v_actor_name,
      o.status, null,
      jsonb_build_object(
        'source', 'demand_planning_revert',
        'publicationId', p_publication_id,
        'draftId', v_publication.draft_id,
        'reason', 'publication_reverted'
      )
    from public.manual_shift_orders o
    where o.id = any(v_created_order_ids)
      and o.tenant_id = p_tenant_id;
  end if;

  -- 4. Soft-delete lines that were created by this publication
  --    ONLY if they have no remaining non-deleted orders
  if v_created_lines_from_pub is not null and array_length(v_created_lines_from_pub, 1) > 0 then
    for v_line_id in select unnest(v_created_lines_from_pub) loop
      if not exists (
        select 1
        from public.manual_shift_orders o
        where o.line_id = v_line_id
          and o.tenant_id = p_tenant_id
          and o.deleted_at is null
        limit 1
      ) then
        update public.manual_shift_lines
        set deleted_at = timezone('utc', now())
        where id = v_line_id
          and tenant_id = p_tenant_id
          and deleted_at is null;
        v_lines_deleted := v_lines_deleted + 1;
      end if;
    end loop;
  end if;

  -- 5. Mark publication as reverted (ledger rows are NOT deleted — they stay for audit)
  update public.demand_planning_publications
  set status = 'reverted',
      reverted_at = timezone('utc', now()),
      reverted_by = v_actor_id
  where id = p_publication_id and tenant_id = p_tenant_id;

  -- 6. Reopen draft (set back to mutable status)
  update public.demand_planning_drafts
  set status = 'draft'
  where id = v_publication.draft_id and tenant_id = p_tenant_id;

  -- 7. Return summary
  return jsonb_build_object(
    'publicationId', p_publication_id,
    'draftId', v_publication.draft_id,
    'shiftId', v_publication.target_shift_id,
    'revertedOrders', v_reverted_orders,
    'revertedItems', v_reverted_items,
    'releasedQuantity', v_released_quantity
  );
end;
$$;

revoke all on function public.demand_planning_revert_publication(uuid, uuid)
  from public, anon;
grant execute on function public.demand_planning_revert_publication(uuid, uuid)
  to authenticated;
