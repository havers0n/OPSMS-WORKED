-- Migration 0043: fast get_layout_bundle with SECURITY DEFINER
--
-- Problem: fetchLayoutVersionBundle in the BFF does 4 sequential Supabase
-- JS queries (.from('racks').select()…, .from('rack_faces')…, etc.).
-- Each query is subject to per-row RLS WITH CHECK / USING policies:
--   rack_levels SELECT → can_access_rack → can_manage_layout_version →
--   can_manage_floor  (3 nested lookups per row)
-- For 2 000 levels that is ~6 000 extra round-trips → statement timeout.
--
-- Fix: SECURITY DEFINER function that returns the entire layout bundle as
-- a single JSON object in one DB round-trip, bypassing per-row RLS.
-- Authorisation is enforced by a single can_access_layout_version() call
-- at the top of the function.

create or replace function public.get_layout_bundle(
  layout_version_uuid uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if layout_version_uuid is null then
    raise exception 'layout_version_uuid is required';
  end if;

  if not exists (
    select 1 from public.layout_versions where id = layout_version_uuid
  ) then
    raise exception 'Layout version % not found', layout_version_uuid;
  end if;

  -- Single authz check replaces per-row RLS
  if not public.can_access_layout_version(layout_version_uuid) then
    raise exception 'Permission denied for layout version %', layout_version_uuid;
  end if;

  return (
    select jsonb_build_object(
      'layoutVersionId', lv.id,
      'floorId',         lv.floor_id,
      'state',           lv.state,
      'versionNo',       lv.version_no,
      'publishedAt',     lv.published_at,
      'racks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',           r.id,
          'displayCode',  r.display_code,
          'kind',         r.kind,
          'axis',         r.axis,
          'x',            r.x,
          'y',            r.y,
          'totalLength',  r.total_length,
          'depth',        r.depth,
          'rotationDeg',  r.rotation_deg,
          'faces', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id',                    rf.id,
              'side',                  rf.side,
              'enabled',               rf.enabled,
              'slotNumberingDirection',rf.slot_numbering_direction,
              'faceLength',            rf.face_length,
              'isMirrored',            rf.is_mirrored,
              'mirrorSourceFaceId',    rf.mirror_source_face_id,
              'sections', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'id',      rs.id,
                  'ordinal', rs.ordinal,
                  'length',  rs.length,
                  'levels', coalesce((
                    select jsonb_agg(jsonb_build_object(
                      'id',        rl.id,
                      'ordinal',   rl.ordinal,
                      'slotCount', rl.slot_count
                    ) order by rl.ordinal)
                    from public.rack_levels rl
                    where rl.rack_section_id = rs.id
                  ), '[]'::jsonb)
                ) order by rs.ordinal)
                from public.rack_sections rs
                where rs.rack_face_id = rf.id
              ), '[]'::jsonb)
            ) order by rf.side)
            from public.rack_faces rf
            where rf.rack_id = r.id
          ), '[]'::jsonb)
        ) order by r.display_code)
        from public.racks r
        where r.layout_version_id = lv.id
      ), '[]'::jsonb)
    )
    from public.layout_versions lv
    where lv.id = layout_version_uuid
  );
end;
$$;

grant execute on function public.get_layout_bundle(uuid) to authenticated;

comment on function public.get_layout_bundle(uuid) is
  'Returns a full layout version bundle (racks→faces→sections→levels) as '
  'JSON in a single round-trip. SECURITY DEFINER bypasses per-row RLS '
  'SELECT policies; authorisation is enforced by can_access_layout_version().';
