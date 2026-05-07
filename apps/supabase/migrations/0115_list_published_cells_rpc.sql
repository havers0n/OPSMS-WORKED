-- 0115_list_published_cells_rpc.sql
--
-- Fast read path for GET /api/floors/:floorId/published-cells.
-- The previous table read evaluated cells RLS per row; this RPC performs one
-- floor authorization check, then reads the latest published layout cells under
-- SECURITY DEFINER.

create index if not exists idx_cells_layout_version_address_sort_cell_code
  on public.cells (layout_version_id, address_sort_key, cell_code);

create or replace function public.list_published_cells_by_floor(
  p_floor_id uuid,
  p_limit integer default 1000,
  p_offset integer default 0
)
returns table (
  id uuid,
  layout_version_id uuid,
  rack_id uuid,
  rack_face_id uuid,
  rack_section_id uuid,
  rack_level_id uuid,
  slot_no integer,
  address text,
  address_sort_key text,
  cell_code text,
  x numeric,
  y numeric,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_layout_version_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 1000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_floor_id is null then
    raise exception 'p_floor_id is required'
      using errcode = '22004';
  end if;

  if not public.can_access_floor(p_floor_id) then
    raise exception 'Access denied for floor %', p_floor_id
      using errcode = '42501';
  end if;

  select lv.id
  into v_layout_version_id
  from public.layout_versions lv
  where lv.floor_id = p_floor_id
    and lv.state = 'published'
  order by lv.version_no desc
  limit 1;

  if v_layout_version_id is null then
    return;
  end if;

  return query
  select
    c.id,
    c.layout_version_id,
    c.rack_id,
    c.rack_face_id,
    c.rack_section_id,
    c.rack_level_id,
    c.slot_no,
    c.address,
    c.address_sort_key,
    c.cell_code,
    c.x,
    c.y,
    c.status
  from public.cells c
  where c.layout_version_id = v_layout_version_id
  order by c.address_sort_key asc, c.cell_code asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.list_published_cells_by_floor(uuid, integer, integer) from public, anon, service_role;
grant execute on function public.list_published_cells_by_floor(uuid, integer, integer) to authenticated;

comment on function public.list_published_cells_by_floor(uuid, integer, integer) is
  'Returns published cells for a floor from the latest published layout version. '
  'SECURITY DEFINER bypasses per-row cells RLS after one can_access_floor() authorization check.';
