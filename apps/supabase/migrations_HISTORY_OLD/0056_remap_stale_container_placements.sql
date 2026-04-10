-- 0056_remap_stale_container_placements.sql
--
-- P1-1: Remap container_placements.cell_id from stale V1 UUIDs to current
-- published cell UUIDs, using locations.geometry_slot_id as the bridge.
--
-- Problem:
--   publish_layout_version() regenerates cells with new auto-UUIDs each cycle.
--   After publish, locations.geometry_slot_id is updated to V2 cell UUIDs (0053).
--   But container_placements.cell_id still holds V1 UUIDs → stale projection.
--   This prevents cleanup of archived cells (FK ON DELETE RESTRICT holds V1 cells).
--
-- Fix — two parts:
--
--   Part 1: one-time backfill.
--     Updates all active placements already in DB where cp.cell_id no longer
--     matches the current published cell for that location. Safe because
--     locations.geometry_slot_id always points to a published cell (enforced
--     by validate_location_row trigger + 0053 upsert logic).
--
--   Part 2: ongoing — adds a remap step inside publish_layout_version(),
--     executed immediately after the locations upsert (Step 9 in publish sequence).
--     Scoped to floor_uuid so only placements on the published floor are touched.
--
-- Trigger safety:
--   validate_container_placement_row fires BEFORE UPDATE on container_placements.
--   On UPDATE it checks: if new.cell_id <> old.cell_id then cell must be published.
--   At the time this remap runs, V2 cells are already published (Step 7 in publish
--   or, in backfill, we filter WHERE new_lv.state = 'published'). Check passes. ✓
--
-- Non-remappable rows (rack renamed, section reordered — no address match):
--   cp.cell_id is left unchanged. These are handled by P1-2 pre-publish validation
--   (future migration). The view fix (0054) keeps them visible in the UI regardless.

-- ─── Part 1: one-time backfill ────────────────────────────────────────────────

do $$
declare
  remapped_count integer;
begin
  update public.container_placements cp
  set    cell_id = l.geometry_slot_id
  from   public.cells old_c
  join   public.layout_versions old_lv
           on  old_lv.id = old_c.layout_version_id
  join   public.locations l
           on  l.floor_id          = old_lv.floor_id
           and l.code              = old_c.address
           and l.geometry_slot_id  is not null
           and l.geometry_slot_id <> old_c.id
  join   public.cells new_c
           on  new_c.id = l.geometry_slot_id
  join   public.layout_versions new_lv
           on  new_lv.id    = new_c.layout_version_id
           and new_lv.state = 'published'      -- only remap to published cells
  where  cp.cell_id    = old_c.id
    and  cp.removed_at is null;

  get diagnostics remapped_count = row_count;
  raise notice 'P1-1 backfill: remapped % container_placement row(s).', remapped_count;
end $$;

-- ─── Part 2: add remap step to publish_layout_version() ──────────────────────

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
  remapped_placements integer := 0;
  floor_uuid          uuid;
  archived_version_id uuid;
  published_at_utc    timestamptz;
begin
  actor_uuid       := coalesce(auth.uid(), actor_uuid);
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

  -- Step 4-5: regenerate cells (DELETE old V2-draft cells, INSERT new V2 cells)
  inserted_cells := public.regenerate_layout_cells(layout_version_uuid);

  -- Step 6: archive old published version
  update public.layout_versions
  set state       = 'archived',
      archived_at = published_at_utc
  where floor_id = floor_uuid
    and state    = 'published'
    and id      <> layout_version_uuid
  returning id into archived_version_id;

  -- Step 7: mark this version published
  update public.layout_versions
  set state        = 'published',
      published_at = published_at_utc,
      published_by = actor_uuid
  where id    = layout_version_uuid
    and state = 'draft';

  if not found then
    raise exception
      'publish_layout_version: layout_version % was not found or is not an active draft.',
      layout_version_uuid;
  end if;

  -- Step 8: mark racks published
  update public.racks
  set state = 'published'
  where layout_version_id = layout_version_uuid;

  -- Step 9: upsert locations for all new V2 cells.
  -- ON CONFLICT (floor_id, code) updates geometry_slot_id → V2 cell UUID.
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
  join public.floors f           on f.id  = lv.floor_id
  join public.sites s            on s.id  = f.site_id
  where c.layout_version_id = layout_version_uuid
  on conflict (floor_id, code) do update
    set geometry_slot_id = excluded.geometry_slot_id,
        status           = 'active',
        updated_at       = published_at_utc;

  -- Step 10: remap active container_placements on this floor from stale V1
  -- cell UUIDs to current V2 cell UUIDs.
  --
  -- Match key: old_cell.address = location.code (same key as Step 9).
  -- Only active placements (removed_at IS NULL) are touched.
  -- Placements with no address match (rack deleted/renamed) are left unchanged
  -- and must be caught by P1-2 pre-publish validation (future).
  --
  -- The validate_container_placement_row trigger fires on this UPDATE and
  -- checks that the new cell_id belongs to a published layout. V2 cells are
  -- published (Step 7 above), so the check passes.
  update public.container_placements cp
  set    cell_id = l.geometry_slot_id
  from   public.cells old_c
  join   public.layout_versions old_lv
           on  old_lv.id      = old_c.layout_version_id
           and old_lv.floor_id = floor_uuid
  join   public.locations l
           on  l.floor_id          = floor_uuid
           and l.code              = old_c.address
           and l.geometry_slot_id  is not null
           and l.geometry_slot_id <> old_c.id
  where  cp.cell_id    = old_c.id
    and  cp.removed_at is null;

  get diagnostics remapped_placements = row_count;

  perform public.write_layout_event(
    'layout_publish',
    'succeeded',
    layout_version_uuid,
    'layout_version',
    layout_version_uuid,
    actor_uuid,
    jsonb_build_object(
      'archivedVersionId',   archived_version_id,
      'generatedCells',      inserted_cells,
      'remappedPlacements',  remapped_placements
    )
  );

  return jsonb_build_object(
    'layoutVersionId',    layout_version_uuid,
    'publishedAt',        published_at_utc,
    'generatedCells',     inserted_cells,
    'remappedPlacements', remapped_placements,
    'validation',         validation_result
  );

exception when others then
  perform public.write_layout_event(
    'layout_publish',
    'failed',
    layout_version_uuid,
    'layout_version',
    layout_version_uuid,
    actor_uuid,
    jsonb_build_object('error', sqlerrm)
  );
  raise;
end;
$$;
