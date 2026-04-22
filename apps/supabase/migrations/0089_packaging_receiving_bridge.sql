-- 0089_packaging_receiving_bridge.sql
--
-- PR1: additive receiving bridge for canonical packaging profiles,
-- canonical container content rows, and receipt-stage compatibility
-- projection into inventory_unit.

create table if not exists public.packaging_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null check (char_length(trim(code)) > 0),
  name text not null check (char_length(trim(name)) > 0),
  profile_type text not null check (profile_type in ('legacy_bridge', 'receiving')),
  scope_type text not null check (scope_type in ('tenant', 'location')),
  scope_id uuid not null,
  valid_from timestamptz null,
  valid_to timestamptz null,
  priority integer not null default 0,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, product_id, scope_type, scope_id, code)
);

create index if not exists packaging_profiles_tenant_product_scope_idx
  on public.packaging_profiles (tenant_id, product_id, scope_type, scope_id, status, priority desc);

create or replace function public.packaging_profile_effective_window(
  valid_from_input timestamptz,
  valid_to_input timestamptz
)
returns tstzrange
language sql
immutable
as $$
  select tstzrange(
    coalesce(valid_from_input, '-infinity'::timestamptz),
    coalesce(valid_to_input, 'infinity'::timestamptz),
    '[)'
  )
$$;

create or replace function public.validate_packaging_profile_row()
returns trigger
language plpgsql
as $$
declare
  conflicting_default_uuid uuid;
  conflicting_priority_uuid uuid;
begin
  new.code := trim(new.code);
  new.name := trim(new.name);

  if new.scope_type = 'tenant' and new.scope_id <> new.tenant_id then
    raise exception 'PACKAGING_PROFILE_SCOPE_MISMATCH';
  end if;

  if new.scope_type = 'location' then
    if not exists (
      select 1
      from public.locations l
      where l.id = new.scope_id
        and l.tenant_id = new.tenant_id
    ) then
      raise exception 'PACKAGING_PROFILE_SCOPE_MISMATCH';
    end if;
  end if;

  if new.valid_from is not null and new.valid_to is not null and new.valid_from >= new.valid_to then
    raise exception 'PACKAGING_PROFILE_WINDOW_INVALID';
  end if;

  if new.status = 'active' and new.is_default then
    select pp.id
    into conflicting_default_uuid
    from public.packaging_profiles pp
    where pp.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and pp.tenant_id = new.tenant_id
      and pp.product_id = new.product_id
      and pp.scope_type = new.scope_type
      and pp.scope_id = new.scope_id
      and pp.status = 'active'
      and pp.is_default = true
      and public.packaging_profile_effective_window(pp.valid_from, pp.valid_to)
          && public.packaging_profile_effective_window(new.valid_from, new.valid_to)
    limit 1;

    if conflicting_default_uuid is not null then
      raise exception 'PACKAGING_PROFILE_DEFAULT_OVERLAP';
    end if;
  end if;

  if new.status = 'active' then
    select pp.id
    into conflicting_priority_uuid
    from public.packaging_profiles pp
    where pp.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and pp.tenant_id = new.tenant_id
      and pp.product_id = new.product_id
      and pp.scope_type = new.scope_type
      and pp.scope_id = new.scope_id
      and pp.status = 'active'
      and pp.priority = new.priority
      and public.packaging_profile_effective_window(pp.valid_from, pp.valid_to)
          && public.packaging_profile_effective_window(new.valid_from, new.valid_to)
    limit 1;

    if conflicting_priority_uuid is not null then
      raise exception 'PACKAGING_PROFILE_PRIORITY_OVERLAP';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists validate_packaging_profile_row on public.packaging_profiles;
create trigger validate_packaging_profile_row
before insert or update on public.packaging_profiles
for each row execute function public.validate_packaging_profile_row();

drop trigger if exists set_packaging_profiles_updated_at on public.packaging_profiles;
create trigger set_packaging_profiles_updated_at
before update on public.packaging_profiles
for each row execute function public.set_updated_at();

create table if not exists public.packaging_profile_levels (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.packaging_profiles(id) on delete cascade,
  level_type text not null check (char_length(trim(level_type)) > 0),
  qty_each integer not null check (qty_each > 0),
  parent_level_type text null,
  qty_per_parent integer null check (qty_per_parent is null or qty_per_parent > 0),
  container_type text null,
  tare_weight_g integer null check (tare_weight_g is null or tare_weight_g > 0),
  nominal_gross_weight_g integer null check (nominal_gross_weight_g is null or nominal_gross_weight_g > 0),
  length_mm integer null check (length_mm is null or length_mm > 0),
  width_mm integer null check (width_mm is null or width_mm > 0),
  height_mm integer null check (height_mm is null or height_mm > 0),
  cases_per_tier integer null check (cases_per_tier is null or cases_per_tier > 0),
  tiers_per_pallet integer null check (tiers_per_pallet is null or tiers_per_pallet > 0),
  max_stack_height integer null check (max_stack_height is null or max_stack_height > 0),
  max_stack_weight integer null check (max_stack_weight is null or max_stack_weight > 0),
  legacy_product_packaging_level_id uuid null references public.product_packaging_levels(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, level_type),
  unique (profile_id, legacy_product_packaging_level_id)
);

create index if not exists packaging_profile_levels_profile_qty_idx
  on public.packaging_profile_levels (profile_id, qty_each);

drop trigger if exists set_packaging_profile_levels_updated_at on public.packaging_profile_levels;
create trigger set_packaging_profile_levels_updated_at
before update on public.packaging_profile_levels
for each row execute function public.set_updated_at();

alter table public.containers
  add column if not exists barcode text null,
  add column if not exists external_ref text null,
  add column if not exists parent_container_id uuid null references public.containers(id) on delete restrict,
  add column if not exists packaging_profile_id uuid null references public.packaging_profiles(id) on delete set null,
  add column if not exists is_standard_pack boolean null,
  add column if not exists gross_weight_g integer null check (gross_weight_g is null or gross_weight_g > 0),
  add column if not exists length_mm integer null check (length_mm is null or length_mm > 0),
  add column if not exists width_mm integer null check (width_mm is null or width_mm > 0),
  add column if not exists height_mm integer null check (height_mm is null or height_mm > 0),
  add column if not exists received_at timestamptz null,
  add column if not exists source_document_type text null,
  add column if not exists source_document_id text null,
  add column if not exists last_receipt_correlation_key text null;

create index if not exists containers_parent_container_idx
  on public.containers(parent_container_id)
  where parent_container_id is not null;

create or replace function public.validate_container_parent_cycle()
returns trigger
language plpgsql
as $$
declare
  cycle_found boolean := false;
begin
  if new.parent_container_id is null then
    return new;
  end if;

  if new.parent_container_id = new.id then
    raise exception 'CONTAINER_PARENT_CYCLE';
  end if;

  with recursive parent_chain as (
    select c.id, c.parent_container_id
    from public.containers c
    where c.id = new.parent_container_id

    union all

    select c.id, c.parent_container_id
    from public.containers c
    join parent_chain pc on pc.parent_container_id = c.id
  )
  select exists (
    select 1
    from parent_chain
    where id = new.id
  )
  into cycle_found;

  if cycle_found then
    raise exception 'CONTAINER_PARENT_CYCLE';
  end if;

  return new;
end
$$;

drop trigger if exists validate_container_parent_cycle on public.containers;
create trigger validate_container_parent_cycle
before insert or update of parent_container_id on public.containers
for each row execute function public.validate_container_parent_cycle();

create table if not exists public.location_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  receiving_enabled boolean not null default true,
  allow_mixed_skus boolean not null default true,
  default_inventory_status text not null default 'available'
    check (default_inventory_status in ('available', 'reserved', 'damaged', 'hold')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (location_id)
);

drop trigger if exists set_location_policies_updated_at on public.location_policies;
create trigger set_location_policies_updated_at
before update on public.location_policies
for each row execute function public.set_updated_at();

create table if not exists public.sku_location_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  min_qty_each integer null check (min_qty_each is null or min_qty_each > 0),
  max_qty_each integer null check (max_qty_each is null or max_qty_each > 0),
  preferred_packaging_profile_id uuid null references public.packaging_profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, location_id, product_id),
  check (
    min_qty_each is null
    or max_qty_each is null
    or min_qty_each <= max_qty_each
  )
);

drop trigger if exists set_sku_location_policies_updated_at on public.sku_location_policies;
create trigger set_sku_location_policies_updated_at
before update on public.sku_location_policies
for each row execute function public.set_updated_at();

create or replace function public.validate_sku_location_policy_row()
returns trigger
language plpgsql
as $$
declare
  preferred_product_uuid uuid;
  location_tenant_uuid uuid;
begin
  select l.tenant_id
  into location_tenant_uuid
  from public.locations l
  where l.id = new.location_id;

  if location_tenant_uuid is null or location_tenant_uuid <> new.tenant_id then
    raise exception 'SKU_LOCATION_POLICY_LOCATION_TENANT_MISMATCH';
  end if;

  if new.preferred_packaging_profile_id is not null then
    select pp.product_id
    into preferred_product_uuid
    from public.packaging_profiles pp
    where pp.id = new.preferred_packaging_profile_id
      and pp.tenant_id = new.tenant_id;

    if preferred_product_uuid is null then
      raise exception 'SKU_LOCATION_POLICY_PREFERRED_PROFILE_NOT_FOUND';
    end if;

    if preferred_product_uuid <> new.product_id then
      raise exception 'SKU_LOCATION_POLICY_PREFERRED_PROFILE_PRODUCT_MISMATCH';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists validate_sku_location_policy_row on public.sku_location_policies;
create trigger validate_sku_location_policy_row
before insert or update on public.sku_location_policies
for each row execute function public.validate_sku_location_policy_row();

create table if not exists public.container_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty_each numeric not null check (qty_each > 0),
  lot_code text null,
  expiry_date date null,
  serial_no text null,
  packaging_profile_id_at_receipt uuid null references public.packaging_profiles(id) on delete set null,
  packaging_profile_level_id_at_receipt uuid null references public.packaging_profile_levels(id) on delete set null,
  level_type_at_receipt text null,
  design_qty_each_at_receipt integer null check (design_qty_each_at_receipt is null or design_qty_each_at_receipt > 0),
  container_type_at_receipt text null,
  is_non_standard_pack boolean not null default true,
  inventory_status text not null default 'available'
    check (inventory_status in ('available', 'reserved', 'damaged', 'hold')),
  pack_level_snapshot_jsonb jsonb null,
  receipt_correlation_key text null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid null references public.profiles(id),
  check (serial_no is null or qty_each = 1)
);

create index if not exists container_lines_container_product_idx
  on public.container_lines (container_id, product_id, created_at);

create unique index if not exists container_lines_receipt_correlation_uidx
  on public.container_lines (tenant_id, receipt_correlation_key)
  where receipt_correlation_key is not null;

create unique index if not exists container_lines_serial_uidx
  on public.container_lines (tenant_id, serial_no)
  where serial_no is not null;

alter table public.inventory_unit
  add column if not exists container_line_id uuid null references public.container_lines(id) on delete set null;

create unique index if not exists inventory_unit_container_line_uidx
  on public.inventory_unit (container_line_id)
  where container_line_id is not null;

create or replace function public.sync_default_packaging_profile_from_legacy(
  tenant_uuid uuid,
  product_uuid uuid
)
returns uuid
language plpgsql
as $$
declare
  profile_uuid uuid;
begin
  if not exists (
    select 1
    from public.product_packaging_levels ppl
    where ppl.product_id = product_uuid
  ) then
    return null;
  end if;

  select pp.id
  into profile_uuid
  from public.packaging_profiles pp
  where pp.tenant_id = tenant_uuid
    and pp.product_id = product_uuid
    and pp.scope_type = 'tenant'
    and pp.scope_id = tenant_uuid
    and pp.code = 'LEGACY-BRIDGE'
  limit 1
  for update;

  if profile_uuid is null then
    insert into public.packaging_profiles (
      tenant_id,
      product_id,
      code,
      name,
      profile_type,
      scope_type,
      scope_id,
      priority,
      is_default,
      status
    )
    values (
      tenant_uuid,
      product_uuid,
      'LEGACY-BRIDGE',
      'Legacy Bridge Default',
      'legacy_bridge',
      'tenant',
      tenant_uuid,
      0,
      true,
      'active'
    )
    returning id into profile_uuid;
  else
    update public.packaging_profiles
    set name = 'Legacy Bridge Default',
        profile_type = 'legacy_bridge',
        priority = 0,
        is_default = true,
        status = 'active',
        updated_at = timezone('utc', now())
    where id = profile_uuid;
  end if;

  insert into public.packaging_profile_levels (
    profile_id,
    level_type,
    qty_each,
    parent_level_type,
    qty_per_parent,
    container_type,
    tare_weight_g,
    nominal_gross_weight_g,
    length_mm,
    width_mm,
    height_mm,
    legacy_product_packaging_level_id
  )
  select
    profile_uuid,
    case
      when legacy.is_base then 'each'
      else lower(trim(legacy.code))
    end as level_type,
    legacy.base_unit_qty,
    case
      when legacy.is_base then null
      else 'each'
    end as parent_level_type,
    case
      when legacy.is_base then null
      else legacy.base_unit_qty
    end as qty_per_parent,
    case
      when lower(legacy.code) like '%plt%' or lower(legacy.code) like '%pallet%' then 'pallet'
      when lower(legacy.code) like '%ctn%' or lower(legacy.code) like '%carton%' or lower(legacy.code) like '%case%' then 'carton'
      else lower(trim(legacy.code))
    end as container_type,
    null,
    legacy.pack_weight_g,
    legacy.pack_depth_mm,
    legacy.pack_width_mm,
    legacy.pack_height_mm,
    legacy.id
  from public.product_packaging_levels legacy
  where legacy.product_id = product_uuid
  on conflict (profile_id, legacy_product_packaging_level_id)
  do update
  set level_type = excluded.level_type,
      qty_each = excluded.qty_each,
      parent_level_type = excluded.parent_level_type,
      qty_per_parent = excluded.qty_per_parent,
      container_type = excluded.container_type,
      tare_weight_g = excluded.tare_weight_g,
      nominal_gross_weight_g = excluded.nominal_gross_weight_g,
      length_mm = excluded.length_mm,
      width_mm = excluded.width_mm,
      height_mm = excluded.height_mm;

  return profile_uuid;
end
$$;

do $$
declare
  tenant_row record;
  product_row record;
begin
  for tenant_row in
    select t.id
    from public.tenants t
  loop
    for product_row in
      select distinct ppl.product_id
      from public.product_packaging_levels ppl
    loop
      perform public.sync_default_packaging_profile_from_legacy(tenant_row.id, product_row.product_id);
    end loop;
  end loop;
end
$$;

drop function if exists public.receive_inventory_unit(uuid, uuid, uuid, numeric, text, uuid);
drop function if exists public.receive_inventory_unit(uuid, uuid, uuid, numeric, text, uuid, text, uuid, integer);

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
