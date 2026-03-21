-- 0068_receive_inventory_unit_rpc.sql
--
-- Atomic receive command for container inventory intake.
-- Scope:
--   - add public.receive_inventory_unit(...)
--   - keep HTTP contract untouched (route switch is PR-08)
--
-- Security model: SECURITY DEFINER (execution-family pattern).
--   - actor_uuid is always overridden from auth.uid()
--   - inline can_manage_tenant authorization gate controls access
--   - container lookup is workspace-scoped (tenant_uuid) and oracle-masked
--     as CONTAINER_NOT_FOUND for missing/unauthorized/mismatched-tenant
--
-- Concurrency:
--   - lock container row while checking receivable status
--   - lock product row while checking active status
--   - insert happens in the same transaction after both checks

create or replace function public.receive_inventory_unit(
  tenant_uuid uuid,
  container_uuid uuid,
  product_uuid uuid,
  quantity numeric,
  uom text,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  container_row record;
  product_row record;
  inserted_row public.inventory_unit%rowtype;
begin
  -- Caller-supplied actor_uuid is discarded. auth.uid() is the only
  -- accepted attribution source for this command.
  actor_uuid := auth.uid();

  -- Lock container with inline auth + workspace tenant scope.
  -- Missing, unauthorized, and tenant-mismatched container UUIDs are masked
  -- as CONTAINER_NOT_FOUND to match current route semantics.
  select c.id, c.tenant_id, c.status
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

  -- Lock product row so eligibility decision (is_active) and insert stay
  -- race-safe against concurrent product deactivation.
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

  insert into public.inventory_unit (
    tenant_id,
    container_id,
    product_id,
    quantity,
    uom,
    status,
    created_by
  )
  values (
    container_row.tenant_id,
    container_row.id,
    product_row.id,
    quantity,
    uom,
    'available',
    actor_uuid
  )
  returning *
  into inserted_row;

  return jsonb_build_object(
    'inventoryUnit',
    jsonb_build_object(
      'id', inserted_row.id,
      'tenant_id', inserted_row.tenant_id,
      'container_id', inserted_row.container_id,
      'product_id', inserted_row.product_id,
      'quantity', inserted_row.quantity,
      'uom', inserted_row.uom,
      'lot_code', inserted_row.lot_code,
      'serial_no', inserted_row.serial_no,
      'expiry_date', inserted_row.expiry_date,
      'status', inserted_row.status,
      'created_at', inserted_row.created_at,
      'updated_at', inserted_row.updated_at,
      'created_by', inserted_row.created_by
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

revoke execute on function public.receive_inventory_unit(uuid, uuid, uuid, numeric, text, uuid) from public;
grant execute on function public.receive_inventory_unit(uuid, uuid, uuid, numeric, text, uuid) to authenticated;
