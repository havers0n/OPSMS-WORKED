-- 0005_layout_publish_helpers.sql

create or replace function public.pad_2(input_value text)
returns text
language sql
immutable
as $$
  select lpad(input_value, 2, '0');
$$;

create or replace function public.pad_4(input_value text)
returns text
language sql
immutable
as $$
  select lpad(input_value, 4, '0');
$$;

create or replace function public.build_cell_address(
  rack_display_code text,
  face_side text,
  section_ordinal integer,
  level_ordinal integer,
  slot_no integer
)
returns text
language sql
immutable
as $$
  select public.pad_2(rack_display_code) || '-' || face_side || '.' || public.pad_2(section_ordinal::text) || '.' || public.pad_2(level_ordinal::text) || '.' || public.pad_2(slot_no::text);
$$;

create or replace function public.layout_version_cell_counts(layout_version_uuid uuid)
returns table (
  rack_count bigint,
  cell_count bigint
)
language sql
stable
as $$
  select
    count(distinct r.id) as rack_count,
    count(c.id) as cell_count
  from public.layout_versions lv
  left join public.racks r on r.layout_version_id = lv.id
  left join public.cells c on c.layout_version_id = lv.id
  where lv.id = layout_version_uuid;
$$;
