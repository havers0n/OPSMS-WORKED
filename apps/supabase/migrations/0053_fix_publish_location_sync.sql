-- Fix: publish_layout_version regenerates cells BEFORE setting state='published',
-- so the sync_published_cell_to_location trigger fires while lv.state is still 'draft'
-- and exits early. Locations are never created for newly published cells.
--
-- Root cause sequence in publish_layout_version():
--   1. regenerate_layout_cells()   ← cells INSERTed here, trigger sees state='draft' → skip
--   2. UPDATE layout_versions SET state='published'  ← too late, no cells are touched again
--
-- Fix: after setting state='published', explicitly upsert locations for all cells
-- in this layout version. Uses (floor_id, code) ON CONFLICT to handle re-publishes.

create or replace function public.publish_layout_version(layout_version_uuid uuid, actor_uuid uuid default null)
returns jsonb
language plpgsql
as $$
declare
  validation_result jsonb;
  inserted_cells integer := 0;
  floor_uuid uuid;
begin
  select floor_id into floor_uuid
  from public.layout_versions
  where id = layout_version_uuid;

  if floor_uuid is null then
    raise exception 'Layout version % not found.', layout_version_uuid;
  end if;

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
      archived_at = timezone('utc', now())
  where floor_id = floor_uuid
    and state = 'published'
    and id <> layout_version_uuid;

  update public.layout_versions
  set state = 'published',
      published_at = timezone('utc', now()),
      published_by = actor_uuid
  where id = layout_version_uuid;

  update public.racks
  set state = 'published'
  where layout_version_id = layout_version_uuid;

  -- Upsert locations for all cells in this layout version.
  -- The trigger sync_published_cell_to_location fires during regenerate_layout_cells()
  -- above, but at that point lv.state is still 'draft' so the trigger skips creation.
  -- We do it explicitly here, after state is committed to 'published'.
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
        status            = 'active',
        updated_at        = timezone('utc', now());

  return jsonb_build_object(
    'layoutVersionId', layout_version_uuid,
    'publishedAt', timezone('utc', now()),
    'generatedCells', inserted_cells,
    'validation', validation_result
  );
end;
$$;
