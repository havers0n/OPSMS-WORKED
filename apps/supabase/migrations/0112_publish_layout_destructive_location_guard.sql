-- 0112_publish_layout_destructive_location_guard.sql
--
-- Phase 1: block layout publish when a removed rack-slot code still has
-- operational or rule references through its canonical locations.id.

create or replace function public.publish_layout_version(layout_version_uuid uuid, actor_uuid uuid default null)
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

  -- Preserved 0053 fix: regenerate_layout_cells() happens before publish state
  -- switch, so trigger-based sync can skip. Explicit post-publish upsert keeps
  -- locations aligned and remaps geometry_slot_id on re-publish by (floor_id, code).
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
