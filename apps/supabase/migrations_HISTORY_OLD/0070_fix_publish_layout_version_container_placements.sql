-- 0070_fix_publish_layout_version_container_placements.sql
--
-- The live DB has a version of publish_layout_version that still references
-- public.container_placements (dropped in 0066).  That reference causes every
-- publish attempt to fail with "relation does not exist".
--
-- This migration replaces the function with a version that:
--   • removes the dead container_placements remap block
--   • preserves the remappedPlacements field in the return object (always 0 now)
--   • keeps all other 0069 hardening semantics intact

create or replace function public.publish_layout_version(layout_version_uuid uuid, actor_uuid uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  validation_result   jsonb;
  inserted_cells      integer     := 0;
  floor_uuid          uuid;
  layout_state        text;
  archived_version_id uuid;
  session_actor_uuid  uuid        := auth.uid();
  effective_actor_uuid uuid;
  published_at_utc    timestamptz := timezone('utc', now());
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

  select id
    into archived_version_id
  from public.layout_versions
  where floor_id = floor_uuid
    and state    = 'published'
    and id      <> layout_version_uuid
  limit 1;

  update public.layout_versions
  set state       = 'archived',
      archived_at = published_at_utc
  where floor_id = floor_uuid
    and state    = 'published'
    and id      <> layout_version_uuid;

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
  set state        = 'published',
      published_at = published_at_utc,
      published_by = effective_actor_uuid
  where id    = layout_version_uuid
    and state = 'draft';

  if not found then
    raise exception 'Layout version % could not be published because it is no longer draft.', layout_version_uuid;
  end if;

  update public.racks
  set state = 'published'
  where layout_version_id = layout_version_uuid;

  -- Sync published cells to locations (preserved from 0053 fix).
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
  join public.floors f            on f.id  = lv.floor_id
  join public.sites  s            on s.id  = f.site_id
  where c.layout_version_id = layout_version_uuid
  on conflict (floor_id, code) do update
    set geometry_slot_id = excluded.geometry_slot_id,
        status           = 'active',
        updated_at       = timezone('utc', now());

  perform public.write_layout_event(
    'layout_publish',
    'succeeded',
    layout_version_uuid,
    'layout_version',
    layout_version_uuid,
    effective_actor_uuid,
    jsonb_build_object(
      'generatedCells',     inserted_cells,
      'remappedPlacements', 0
    )
  );

  return jsonb_build_object(
    'layoutVersionId',    layout_version_uuid,
    'publishedAt',        published_at_utc,
    'generatedCells',     inserted_cells,
    'remappedPlacements', 0,
    'validation',         validation_result
  );

exception
  when others then
    if layout_version_uuid is not null then
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
