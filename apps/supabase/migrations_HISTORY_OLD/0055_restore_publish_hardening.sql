-- 0055_restore_publish_hardening.sql
--
-- Migration 0053 replaced publish_layout_version() wholesale via CREATE OR REPLACE,
-- discarding all hardening that was added in migration 0024. This migration
-- restores the stripped protections while preserving the 0053 location-sync fix.
--
-- Restored from 0024:
--   - pg_advisory_xact_lock
--   - SECURITY DEFINER
--   - SET search_path = public
--   - actor_uuid := coalesce(auth.uid(), actor_uuid)
--   - IF NOT FOUND guard after publish UPDATE
--   - write_layout_event success/failure audit trail
--   - EXCEPTION block with re-raise
--
-- Preserved from 0053:
--   - regenerate_layout_cells() flow
--   - explicit locations upsert after state='published'
--   - ON CONFLICT (floor_id, code) DO UPDATE
--   - validation payload in response
--   - generatedCells count in response

create or replace function public.publish_layout_version(
  layout_version_uuid uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  validation_result   jsonb;
  inserted_cells      integer := 0;
  floor_uuid          uuid;
  archived_version_id uuid;
  published_at_utc    timestamptz;
begin
  actor_uuid := coalesce(auth.uid(), actor_uuid);
  published_at_utc := timezone('utc', now());

  select floor_id
    into floor_uuid
  from public.layout_versions
  where id = layout_version_uuid;

  if floor_uuid is null then
    raise exception 'Layout version % not found.', layout_version_uuid;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(floor_uuid::text, 29));

  if auth.uid() is not null and not public.can_publish_floor(floor_uuid) then
    raise exception 'Forbidden';
  end if;

  validation_result := public.validate_layout_version(layout_version_uuid);

  if coalesce((validation_result ->> 'isValid')::boolean, false) = false then
    raise exception 'Layout version % failed validation.', layout_version_uuid;
  end if;

  inserted_cells := public.regenerate_layout_cells(layout_version_uuid);

  update public.layout_versions
  set state = 'archived',
      archived_at = published_at_utc
  where floor_id = floor_uuid
    and state = 'published'
    and id <> layout_version_uuid
  returning id into archived_version_id;

  update public.layout_versions
  set state = 'published',
      published_at = published_at_utc,
      published_by = actor_uuid
  where id = layout_version_uuid
    and state = 'draft';

  if not found then
    raise exception
      'publish_layout_version: layout_version % was not found or is not an active draft.',
      layout_version_uuid;
  end if;

  update public.racks
  set state = 'published'
  where layout_version_id = layout_version_uuid;

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
        updated_at = published_at_utc;

  perform public.write_layout_event(
    'layout_publish',
    'succeeded',
    layout_version_uuid,
    'layout_version',
    layout_version_uuid,
    actor_uuid,
    jsonb_build_object(
      'archivedVersionId', archived_version_id,
      'generatedCells', inserted_cells
    )
  );

  return jsonb_build_object(
    'layoutVersionId', layout_version_uuid,
    'publishedAt', published_at_utc,
    'generatedCells', inserted_cells,
    'validation', validation_result
  );

exception when others then
  perform public.write_layout_event(
    'layout_publish',
    'failed',
    layout_version_uuid,
    'layout_version',
    layout_version_uuid,
    actor_uuid,
    jsonb_build_object(
      'error', sqlerrm
    )
  );
  raise;
end;
$$;