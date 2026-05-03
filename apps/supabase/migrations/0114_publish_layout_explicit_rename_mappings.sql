-- 0114_publish_layout_explicit_rename_mappings.sql
--
-- Phase 3B: support explicit location rename mappings during publish.
-- Mapped logical locations keep the same locations.id while their code and
-- geometry_slot_id move to the newly published cell.

create or replace function public.publish_layout_version_with_renames(
  layout_version_uuid uuid,
  actor_uuid uuid default null,
  rename_mappings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  validation_result jsonb;
  inserted_cells integer := 0;
  floor_uuid uuid;
  layout_state text;
  archived_version_id uuid;
  session_actor_uuid uuid := auth.uid();
  effective_actor_uuid uuid;
  destructive_location_code text;
  destructive_reference_source text;
  mapping_item jsonb;
  mapping_ordinal integer;
  normalized_old_code text;
  normalized_new_code text;
  conflicting_code text;
begin
  -- Prevent actor spoofing in SECURITY DEFINER context:
  -- authenticated callers are always attributed to auth.uid();
  -- actor_uuid is only used when auth context is absent.
  effective_actor_uuid := coalesce(session_actor_uuid, actor_uuid);

  select floor_id
  into floor_uuid
  from public.layout_versions
  where id = layout_version_uuid;

  if floor_uuid is null then
    raise exception 'Layout version % not found.', layout_version_uuid;
  end if;

  -- Keep canonical publish authz semantics:
  -- auth.uid() null is intentionally allowed for trusted internal/system calls.
  if session_actor_uuid is not null and not public.can_publish_floor(floor_uuid) then
    raise exception 'Forbidden';
  end if;

  -- Floor is the publish domain boundary: concurrent publish commands for the
  -- same floor must serialize, while independent floors stay non-blocking.
  perform pg_advisory_xact_lock(hashtextextended(floor_uuid::text, 29));

  -- Strict active-draft guard after lock acquisition.
  select state
  into layout_state
  from public.layout_versions
  where id = layout_version_uuid;

  if layout_state <> 'draft' then
    raise exception 'Layout version % is not an active draft.', layout_version_uuid;
  end if;

  validation_result := public.validate_layout_version(layout_version_uuid);

  if coalesce((validation_result ->> 'isValid')::boolean, false) = false then
    perform public.write_layout_event(
      'layout_publish',
      'failed',
      layout_version_uuid,
      'layout_version',
      layout_version_uuid,
      effective_actor_uuid,
      jsonb_build_object('reason', 'validation_failed', 'validation', validation_result)
    );
    raise exception 'Layout version % failed validation.', layout_version_uuid;
  end if;

  inserted_cells := public.regenerate_layout_cells(layout_version_uuid);

  if rename_mappings is null or jsonb_typeof(rename_mappings) <> 'array' then
    raise exception 'PUBLISH_LAYOUT_RENAME_INVALID_PAYLOAD: rename_mappings must be a JSON array.';
  end if;

  drop table if exists pg_temp.publish_layout_rename_mappings;
  create temporary table publish_layout_rename_mappings (
    ordinal integer not null,
    old_code text not null,
    new_code text not null,
    old_location_id uuid null,
    new_cell_id uuid null
  ) on commit drop;

  mapping_ordinal := 0;
  for mapping_item in
    select value
    from jsonb_array_elements(rename_mappings)
  loop
    mapping_ordinal := mapping_ordinal + 1;

    if jsonb_typeof(mapping_item) <> 'object' then
      raise exception 'PUBLISH_LAYOUT_RENAME_INVALID_PAYLOAD: rename mapping item % must be an object.', mapping_ordinal;
    end if;

    normalized_old_code := btrim(mapping_item ->> 'old_code');
    normalized_new_code := btrim(mapping_item ->> 'new_code');

    if normalized_old_code is null or normalized_old_code = '' then
      raise exception 'PUBLISH_LAYOUT_RENAME_BLANK_CODE: old_code must not be null or blank.';
    end if;

    if normalized_new_code is null or normalized_new_code = '' then
      raise exception 'PUBLISH_LAYOUT_RENAME_BLANK_CODE: new_code must not be null or blank.';
    end if;

    if normalized_old_code = normalized_new_code then
      raise exception 'PUBLISH_LAYOUT_RENAME_SAME_CODE: old_code and new_code must differ for code %.', normalized_old_code;
    end if;

    insert into pg_temp.publish_layout_rename_mappings (ordinal, old_code, new_code)
    values (mapping_ordinal, normalized_old_code, normalized_new_code);
  end loop;

  select old_code
  into conflicting_code
  from pg_temp.publish_layout_rename_mappings
  group by old_code
  having count(*) > 1
  order by old_code
  limit 1;

  if conflicting_code is not null then
    raise exception 'PUBLISH_LAYOUT_RENAME_DUPLICATE_OLD_CODE: old_code % is mapped more than once.', conflicting_code;
  end if;

  select new_code
  into conflicting_code
  from pg_temp.publish_layout_rename_mappings
  group by new_code
  having count(*) > 1
  order by new_code
  limit 1;

  if conflicting_code is not null then
    raise exception 'PUBLISH_LAYOUT_RENAME_DUPLICATE_NEW_CODE: new_code % is mapped more than once.', conflicting_code;
  end if;

  select m.new_code
  into conflicting_code
  from pg_temp.publish_layout_rename_mappings m
  join pg_temp.publish_layout_rename_mappings chained
    on chained.old_code = m.new_code
  order by m.new_code
  limit 1;

  if conflicting_code is not null then
    raise exception 'PUBLISH_LAYOUT_RENAME_CHAIN_OR_CYCLE_UNSUPPORTED: mapped new_code % is also a mapped old_code.', conflicting_code;
  end if;

  select m.old_code
  into conflicting_code
  from pg_temp.publish_layout_rename_mappings m
  where not exists (
    select 1
    from public.layout_versions lv
    join public.cells c on c.layout_version_id = lv.id
    where lv.floor_id = floor_uuid
      and lv.state = 'published'
      and lv.id <> layout_version_uuid
      and coalesce(c.address, c.cell_code) = m.old_code
  )
  order by m.old_code
  limit 1;

  if conflicting_code is not null then
    raise exception 'PUBLISH_LAYOUT_RENAME_OLD_CODE_NOT_PUBLISHED: old_code % is not in the current published cells for this floor.', conflicting_code;
  end if;

  update pg_temp.publish_layout_rename_mappings m
  set old_location_id = l.id
  from public.locations l
  where l.floor_id = floor_uuid
    and l.code = m.old_code
    and l.status = 'active';

  select m.old_code
  into conflicting_code
  from pg_temp.publish_layout_rename_mappings m
  where m.old_location_id is null
  order by m.old_code
  limit 1;

  if conflicting_code is not null then
    raise exception 'PUBLISH_LAYOUT_RENAME_OLD_LOCATION_NOT_FOUND: old_code % has no active locations row to preserve.', conflicting_code;
  end if;

  update pg_temp.publish_layout_rename_mappings m
  set new_cell_id = c.id
  from public.cells c
  where c.layout_version_id = layout_version_uuid
    and coalesce(c.address, c.cell_code) = m.new_code;

  select m.new_code
  into conflicting_code
  from pg_temp.publish_layout_rename_mappings m
  where m.new_cell_id is null
  order by m.new_code
  limit 1;

  if conflicting_code is not null then
    raise exception 'PUBLISH_LAYOUT_RENAME_NEW_CODE_NOT_IN_DRAFT: new_code % is not in the regenerated draft cells.', conflicting_code;
  end if;

  select m.old_code
  into conflicting_code
  from pg_temp.publish_layout_rename_mappings m
  where exists (
    select 1
    from public.cells c
    where c.layout_version_id = layout_version_uuid
      and coalesce(c.address, c.cell_code) = m.old_code
  )
  order by m.old_code
  limit 1;

  if conflicting_code is not null then
    raise exception 'PUBLISH_LAYOUT_RENAME_OLD_CODE_STILL_IN_DRAFT: old_code % still exists unchanged in the regenerated draft cells.', conflicting_code;
  end if;

  select m.new_code
  into conflicting_code
  from pg_temp.publish_layout_rename_mappings m
  where exists (
    select 1
    from public.locations l
    where l.floor_id = floor_uuid
      and l.code = m.new_code
  )
  order by m.new_code
  limit 1;

  if conflicting_code is not null then
    raise exception 'PUBLISH_LAYOUT_RENAME_TARGET_LOCATION_EXISTS: new_code % already has a locations row on this floor.', conflicting_code;
  end if;

  destructive_location_code := null;
  destructive_reference_source := null;

  with old_published_codes as (
    select distinct coalesce(c.address, c.cell_code) as code
    from public.layout_versions lv
    join public.cells c on c.layout_version_id = lv.id
    where lv.floor_id = floor_uuid
      and lv.state = 'published'
      and lv.id <> layout_version_uuid
      and coalesce(c.address, c.cell_code) is not null
  ),
  new_draft_codes as (
    select distinct coalesce(c.address, c.cell_code) as code
    from public.cells c
    where c.layout_version_id = layout_version_uuid
      and coalesce(c.address, c.cell_code) is not null
  ),
  removed_codes as (
    select old_code.code
    from old_published_codes old_code
    left join new_draft_codes new_code
      on new_code.code = old_code.code
    where new_code.code is null
      and not exists (
        select 1
        from pg_temp.publish_layout_rename_mappings m
        where m.old_code = old_code.code
      )
  ),
  removed_locations as (
    select l.id, l.code
    from removed_codes removed_code
    join public.locations l
      on l.floor_id = floor_uuid
     and l.code = removed_code.code
  ),
  blocking_references as (
    select rl.code, 'containers.current_location_id' as source
    from removed_locations rl
    where exists (
      select 1
      from public.containers c
      where c.current_location_id = rl.id
    )

    union all

    select rl.code, 'product_location_roles.location_id'
    from removed_locations rl
    where exists (
      select 1
      from public.product_location_roles plr
      where plr.location_id = rl.id
        and plr.state in ('draft', 'published')
    )

    union all

    select rl.code, 'sku_location_policies.location_id'
    from removed_locations rl
    where exists (
      select 1
      from public.sku_location_policies slp
      where slp.location_id = rl.id
        and slp.status = 'active'
    )

    union all

    select rl.code, 'location_policies.location_id'
    from removed_locations rl
    where exists (
      select 1
      from public.location_policies lp
      where lp.location_id = rl.id
        and lp.status = 'active'
    )

    union all

    select rl.code, 'pick_steps.source_location_id'
    from removed_locations rl
    where exists (
      select 1
      from public.pick_steps ps
      where ps.source_location_id = rl.id
        and ps.status in ('pending', 'partial', 'needs_replenishment')
    )

    union all

    select rl.code, 'stock_movements.source_location_id'
    from removed_locations rl
    where exists (
      select 1
      from public.stock_movements sm
      where sm.source_location_id = rl.id
        and sm.status = 'pending'
    )

    union all

    select rl.code, 'stock_movements.target_location_id'
    from removed_locations rl
    where exists (
      select 1
      from public.stock_movements sm
      where sm.target_location_id = rl.id
        and sm.status = 'pending'
    )

    union all

    select rl.code, 'packaging_profiles.scope_id'
    from removed_locations rl
    where exists (
      select 1
      from public.packaging_profiles pp
      where pp.scope_type = 'location'
        and pp.scope_id = rl.id
        and pp.status = 'active'
    )
  )
  select br.code, br.source
  into destructive_location_code, destructive_reference_source
  from blocking_references br
  order by br.code, br.source
  limit 1;

  if destructive_location_code is not null then
    raise exception 'PUBLISH_LAYOUT_DESTRUCTIVE_LOCATION_BLOCKED: removed location code % is still referenced by %.',
      destructive_location_code,
      destructive_reference_source;
  end if;

  -- The guard above has proven these removed floor/code locations have no
  -- blocking references. Mapped old codes are intentionally excluded here so a
  -- rename preserves and reactivates the existing logical location row.
  with old_published_codes as (
    select distinct coalesce(c.address, c.cell_code) as code
    from public.layout_versions lv
    join public.cells c on c.layout_version_id = lv.id
    where lv.floor_id = floor_uuid
      and lv.state = 'published'
      and lv.id <> layout_version_uuid
      and coalesce(c.address, c.cell_code) is not null
  ),
  new_draft_codes as (
    select distinct coalesce(c.address, c.cell_code) as code
    from public.cells c
    where c.layout_version_id = layout_version_uuid
      and coalesce(c.address, c.cell_code) is not null
  ),
  removed_codes as (
    select old_code.code
    from old_published_codes old_code
    left join new_draft_codes new_code
      on new_code.code = old_code.code
    where new_code.code is null
      and not exists (
        select 1
        from pg_temp.publish_layout_rename_mappings m
        where m.old_code = old_code.code
      )
  ),
  removed_locations as (
    select l.id
    from removed_codes removed_code
    join public.locations l
      on l.floor_id = floor_uuid
     and l.code = removed_code.code
  )
  update public.locations l
  set status = 'disabled',
      updated_at = timezone('utc', now())
  from removed_locations rl
  where l.id = rl.id
    and l.status <> 'disabled';

  select id
  into archived_version_id
  from public.layout_versions
  where floor_id = floor_uuid
    and state = 'published'
    and id <> layout_version_uuid
  limit 1;

  update public.layout_versions
  set state = 'archived',
      archived_at = timezone('utc', now())
  where floor_id = floor_uuid
    and state = 'published'
    and id <> layout_version_uuid;

  if archived_version_id is not null then
    perform public.write_layout_event(
      'layout_archived',
      'succeeded',
      archived_version_id,
      'layout_version',
      archived_version_id,
      effective_actor_uuid,
      jsonb_build_object('replacedBy', layout_version_uuid)
    );
  end if;

  -- Compare-and-set semantics: publish only if the version is still draft.
  update public.layout_versions
  set state = 'published',
      published_at = timezone('utc', now()),
      published_by = effective_actor_uuid
  where id = layout_version_uuid
    and state = 'draft';

  if not found then
    raise exception 'Layout version % could not be published because it is no longer draft.', layout_version_uuid;
  end if;

  update public.racks
  set state = 'published'
  where layout_version_id = layout_version_uuid;

  update public.locations l
  set code = m.new_code,
      geometry_slot_id = m.new_cell_id,
      status = 'active',
      updated_at = timezone('utc', now())
  from pg_temp.publish_layout_rename_mappings m
  where l.id = m.old_location_id;

  -- Preserved 0053 fix: regenerate_layout_cells() happens before publish state
  -- switch, so trigger-based sync can skip. Explicit post-publish upsert keeps
  -- locations aligned and remaps geometry_slot_id on re-publish by (floor_id, code).
  -- Mapped new codes are skipped because the rename update above already
  -- represents them with the preserved locations.id.
  insert into public.locations (
    tenant_id,
    floor_id,
    code,
    location_type,
    geometry_slot_id,
    capacity_mode,
    status
  )
  select
    s.tenant_id,
    f.id,
    coalesce(c.address, c.cell_code),
    'rack_slot',
    c.id,
    'single_container',
    'active'
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  where c.layout_version_id = layout_version_uuid
    and not exists (
      select 1
      from pg_temp.publish_layout_rename_mappings m
      where m.new_code = coalesce(c.address, c.cell_code)
    )
  on conflict (floor_id, code) do update
    set geometry_slot_id = excluded.geometry_slot_id,
        status = 'active',
        updated_at = timezone('utc', now());

  perform public.write_layout_event(
    'layout_publish',
    'succeeded',
    layout_version_uuid,
    'layout_version',
    layout_version_uuid,
    effective_actor_uuid,
    jsonb_build_object('generatedCells', inserted_cells)
  );

  return jsonb_build_object(
    'layoutVersionId', layout_version_uuid,
    'publishedAt', timezone('utc', now()),
    'generatedCells', inserted_cells,
    'validation', validation_result
  );
exception
  when others then
    -- Only log the event if the layout version actually exists in the DB.
    -- floor_uuid is null when the version was not found, in which case
    -- write_layout_event would violate the operation_events FK constraint.
    if layout_version_uuid is not null and floor_uuid is not null then
      perform public.write_layout_event(
        'layout_publish',
        'failed',
        layout_version_uuid,
        'layout_version',
        layout_version_uuid,
        effective_actor_uuid,
        jsonb_build_object('error', sqlerrm)
      );
    end if;
    raise;
end;
$$;

create or replace function public.publish_layout_version(layout_version_uuid uuid, actor_uuid uuid default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.publish_layout_version_with_renames(layout_version_uuid, actor_uuid, '[]'::jsonb);
$$;

grant execute on function public.publish_layout_version_with_renames(uuid, uuid, jsonb) to authenticated;
grant execute on function public.publish_layout_version(uuid, uuid) to authenticated;
