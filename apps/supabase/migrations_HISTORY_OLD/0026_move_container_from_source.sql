create or replace function public.move_container_from_cell(
  container_uuid uuid,
  source_cell_uuid uuid,
  target_cell_uuid uuid,
  actor_uuid uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  active_placement record;
  source_floor_uuid uuid;
  target_floor_uuid uuid;
begin
  select cp.id, cp.cell_id
  into active_placement
  from public.container_placements cp
  where cp.container_id = container_uuid
    and cp.removed_at is null
  for update;

  if active_placement.id is null then
    raise exception 'CONTAINER_NOT_PLACED';
  end if;

  if active_placement.cell_id <> source_cell_uuid then
    raise exception 'PLACEMENT_SOURCE_MISMATCH';
  end if;

  if source_cell_uuid = target_cell_uuid then
    raise exception 'CONTAINER_ALREADY_IN_TARGET_CELL';
  end if;

  select f.id
  into source_floor_uuid
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  where c.id = source_cell_uuid;

  select f.id
  into target_floor_uuid
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  where c.id = target_cell_uuid;

  if source_floor_uuid is not null
    and target_floor_uuid is not null
    and source_floor_uuid <> target_floor_uuid then
    raise exception 'TARGET_CELL_CROSS_FLOOR_MOVE_NOT_ALLOWED';
  end if;

  return public.move_container(container_uuid, target_cell_uuid, actor_uuid);
end
$$;

grant execute on function public.move_container_from_cell(uuid, uuid, uuid, uuid) to authenticated;
