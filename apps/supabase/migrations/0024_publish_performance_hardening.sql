-- 0024_publish_performance_hardening.sql
--
-- Publish/save can generate thousands of cell rows in one transaction.
-- Running those writes under user-invoker RLS causes per-row policy checks and
-- trigger lookups, which can exceed Supabase statement timeouts on larger
-- layouts. This migration moves the heavy internal functions onto explicit
-- auth-guarded SECURITY DEFINER implementations and adds a non-partial FK index
-- for container_placements(cell_id) so cell deletes do not devolve into table
-- scans over placement history.

create index if not exists container_placements_cell_idx
  on public.container_placements(cell_id);

create or replace function public.validate_cells_tree_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rack_layout_version_id uuid;
  face_rack_id uuid;
  effective_face_id uuid;
  section_face_id uuid;
  level_section_id uuid;
begin
  select r.layout_version_id
  into rack_layout_version_id
  from public.racks r
  where r.id = new.rack_id;

  if rack_layout_version_id is null or rack_layout_version_id <> new.layout_version_id then
    raise exception 'Cell % references rack % outside layout version %.', new.id, new.rack_id, new.layout_version_id;
  end if;

  select rf.rack_id, coalesce(rf.mirror_source_face_id, rf.id)
  into face_rack_id, effective_face_id
  from public.rack_faces rf
  where rf.id = new.rack_face_id;

  if face_rack_id is null or face_rack_id <> new.rack_id then
    raise exception 'Cell % references rack_face % outside rack %.', new.id, new.rack_face_id, new.rack_id;
  end if;

  select rs.rack_face_id
  into section_face_id
  from public.rack_sections rs
  where rs.id = new.rack_section_id;

  if section_face_id is null or section_face_id <> effective_face_id then
    raise exception 'Cell % references rack_section % outside effective rack_face %.', new.id, new.rack_section_id, effective_face_id;
  end if;

  select rl.rack_section_id
  into level_section_id
  from public.rack_levels rl
  where rl.id = new.rack_level_id;

  if level_section_id is null or level_section_id <> new.rack_section_id then
    raise exception 'Cell % references rack_level % outside rack_section %.', new.id, new.rack_level_id, new.rack_section_id;
  end if;

  return new;
end;
$$;

create or replace function public.regenerate_layout_cells(layout_version_uuid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if auth.uid() is not null and not public.can_manage_layout_version(layout_version_uuid) then
    raise exception 'Forbidden';
  end if;

  delete from public.cells
  where layout_version_id = layout_version_uuid;

  insert into public.cells (
    layout_version_id,
    rack_id,
    rack_face_id,
    rack_section_id,
    rack_level_id,
    slot_no,
    cell_code,
    address,
    address_sort_key,
    status
  )
  select
    lv.id as layout_version_id,
    r.id as rack_id,
    rf.id as rack_face_id,
    rs.id as rack_section_id,
    rl.id as rack_level_id,
    gs.slot_no,
    public.build_cell_code(r.id, rf.side, rs.ordinal, rl.ordinal, gs.slot_no) as cell_code,
    public.build_cell_address(r.display_code, rf.side, rs.ordinal, rl.ordinal, gs.slot_no) as address,
    public.pad_4(r.display_code) || '-' || rf.side || '-' || public.pad_2(rs.ordinal::text) || '-' || public.pad_2(rl.ordinal::text) || '-' || public.pad_2(gs.slot_no::text) as address_sort_key,
    'active' as status
  from public.layout_versions lv
  join public.racks r on r.layout_version_id = lv.id
  join public.rack_faces rf on rf.rack_id = r.id and rf.enabled = true
  join public.rack_sections rs on rs.rack_face_id = coalesce(rf.mirror_source_face_id, rf.id)
  join public.rack_levels rl on rl.rack_section_id = rs.id
  join lateral generate_series(1, rl.slot_count) as gs(slot_no) on true
  where lv.id = layout_version_uuid;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.regenerate_layout_cells(uuid) from public;

create or replace function public.validate_layout_version(layout_version_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  issue_count integer := 0;
  issues jsonb := '[]'::jsonb;
  duplicate_count integer := 0;
  rack_record record;
  face_record record;
  section_length_sum numeric;
  expected_face_length numeric;
  source_face record;
  rack_kind text;
begin
  if auth.uid() is not null and not public.can_access_layout_version(layout_version_uuid) then
    raise exception 'Forbidden';
  end if;

  for rack_record in
    select r.id, r.display_code, r.total_length, r.kind
    from public.racks r
    where r.layout_version_id = layout_version_uuid
  loop
    rack_kind := rack_record.kind;

    if not exists (
      select 1
      from public.rack_faces rf
      where rf.rack_id = rack_record.id
        and rf.side = 'A'
        and rf.enabled = true
    ) then
      issues := issues || jsonb_build_object('code', 'rack.face_a_required', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s must have an enabled Face A.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    if not exists (
      select 1 from public.rack_faces rf where rf.rack_id = rack_record.id and rf.enabled = true
    ) then
      issues := issues || jsonb_build_object('code', 'rack.enabled_face_required', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s must have at least one enabled face.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    if rack_kind = 'single' and exists (
      select 1 from public.rack_faces rf
      where rf.rack_id = rack_record.id and rf.side = 'B' and rf.enabled = true
        and (rf.is_mirrored = true or exists (select 1 from public.rack_sections rs where rs.rack_face_id = rf.id))
    ) then
      issues := issues || jsonb_build_object('code', 'rack.single_face_b_forbidden', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s is single but Face B is configured.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    if rack_kind = 'paired' and not exists (
      select 1 from public.rack_faces rf where rf.rack_id = rack_record.id and rf.side = 'B'
    ) then
      issues := issues || jsonb_build_object('code', 'rack.paired_face_b_required', 'severity', 'error', 'entityId', rack_record.id, 'message', format('Rack %s is paired but Face B is missing.', rack_record.display_code));
      issue_count := issue_count + 1;
    end if;

    for face_record in
      select rf.* from public.rack_faces rf where rf.rack_id = rack_record.id
    loop
      if face_record.is_mirrored = true then
        if face_record.mirror_source_face_id is null then
          issues := issues || jsonb_build_object('code', 'rack_face.mirror_source_required', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s is mirrored but has no source face.', face_record.side, rack_record.display_code));
          issue_count := issue_count + 1;
        elsif face_record.mirror_source_face_id = face_record.id then
          issues := issues || jsonb_build_object('code', 'rack_face.mirror_self_reference', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s cannot mirror itself.', face_record.side, rack_record.display_code));
          issue_count := issue_count + 1;
        else
          select rf.* into source_face from public.rack_faces rf where rf.id = face_record.mirror_source_face_id;

          if source_face.id is null then
            issues := issues || jsonb_build_object('code', 'rack_face.mirror_source_missing', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s references a missing mirror source.', face_record.side, rack_record.display_code));
            issue_count := issue_count + 1;
          elsif source_face.rack_id <> rack_record.id then
            issues := issues || jsonb_build_object('code', 'rack_face.mirror_cross_rack', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s cannot mirror a face from another rack.', face_record.side, rack_record.display_code));
            issue_count := issue_count + 1;
          elsif source_face.side <> 'A' or face_record.side <> 'B' then
            issues := issues || jsonb_build_object('code', 'rack_face.mirror_side_invalid', 'severity', 'error', 'entityId', face_record.id, 'message', format('Mirrored face configuration on rack %s must be B -> A.', rack_record.display_code));
            issue_count := issue_count + 1;
          end if;
        end if;
      elsif face_record.mirror_source_face_id is not null then
        issues := issues || jsonb_build_object('code', 'rack_face.mirror_source_without_flag', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s has a mirror source but isMirrored is false.', face_record.side, rack_record.display_code));
        issue_count := issue_count + 1;
      end if;

      if face_record.enabled = false and (face_record.is_mirrored = true or exists (select 1 from public.rack_sections rs where rs.rack_face_id = face_record.id)) then
        issues := issues || jsonb_build_object('code', 'rack_face.disabled_configured', 'severity', 'warning', 'entityId', face_record.id, 'message', format('Disabled face %s on rack %s still contains configured structure.', face_record.side, rack_record.display_code));
      end if;

      if face_record.enabled = false then
        continue;
      end if;

      select coalesce(sum(rs.length), 0)
      into section_length_sum
      from public.rack_sections rs
      where rs.rack_face_id = coalesce(face_record.mirror_source_face_id, face_record.id);

      expected_face_length := coalesce(face_record.face_length, rack_record.total_length);

      if not exists (
        select 1 from public.rack_sections rs where rs.rack_face_id = coalesce(face_record.mirror_source_face_id, face_record.id)
      ) then
        issues := issues || jsonb_build_object('code', 'rack_face.sections_required', 'severity', case when face_record.side = 'B' then 'warning' else 'error' end, 'entityId', face_record.id, 'message', format('Face %s on rack %s has no configured sections.', face_record.side, rack_record.display_code));
        issue_count := issue_count + case when face_record.side = 'B' then 0 else 1 end;
      elsif abs(section_length_sum - expected_face_length) > 0.001 then
        issues := issues || jsonb_build_object('code', 'rack_face.section_length_mismatch', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s section length sum (%s) does not match face length (%s).', face_record.side, section_length_sum, expected_face_length));
        issue_count := issue_count + 1;
      end if;

      if exists (
        select 1
        from public.rack_sections rs
        left join public.rack_levels rl on rl.rack_section_id = rs.id
        where rs.rack_face_id = coalesce(face_record.mirror_source_face_id, face_record.id)
        group by rs.id
        having count(rl.id) = 0
      ) then
        issues := issues || jsonb_build_object('code', 'rack_face.levels_required', 'severity', 'error', 'entityId', face_record.id, 'message', format('Face %s on rack %s has a section without levels.', face_record.side, rack_record.display_code));
        issue_count := issue_count + 1;
      end if;
    end loop;
  end loop;

  with generated_addresses as (
    select public.build_cell_address(r.display_code, rf.side, rs.ordinal, rl.ordinal, gs.slot_no) as address
    from public.racks r
    join public.rack_faces rf on rf.rack_id = r.id and rf.enabled = true
    join public.rack_sections rs on rs.rack_face_id = coalesce(rf.mirror_source_face_id, rf.id)
    join public.rack_levels rl on rl.rack_section_id = rs.id
    join lateral generate_series(1, rl.slot_count) as gs(slot_no) on true
    where r.layout_version_id = layout_version_uuid
  )
  select count(*)
  into duplicate_count
  from (select address from generated_addresses group by address having count(*) > 1) duplicates;

  if duplicate_count > 0 then
    issues := issues || jsonb_build_object('code', 'layout.address_duplicate', 'severity', 'error', 'message', format('Generated duplicate addresses detected (%s).', duplicate_count));
    issue_count := issue_count + 1;
  end if;

  if issue_count > 0 then
    perform public.write_layout_event('layout_validation', 'failed', layout_version_uuid, 'layout_version', layout_version_uuid, null, jsonb_build_object('issues', issues));
  end if;

  return jsonb_build_object('isValid', issue_count = 0, 'issues', issues);
end;
$$;

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
begin
  select floor_id, state
  into floor_uuid, layout_state
  from public.layout_versions
  where id = layout_version_uuid;

  if floor_uuid is null then
    raise exception 'Layout version % not found.', layout_version_uuid;
  end if;

  if auth.uid() is not null and not public.can_publish_floor(floor_uuid) then
    raise exception 'Forbidden';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(floor_uuid::text, 29));

  if layout_state <> 'draft' then
    raise exception 'Layout version % is not an active draft.', layout_version_uuid;
  end if;

  validation_result := public.validate_layout_version(layout_version_uuid);

  if coalesce((validation_result ->> 'isValid')::boolean, false) = false then
    perform public.write_layout_event('layout_publish', 'failed', layout_version_uuid, 'layout_version', layout_version_uuid, actor_uuid, jsonb_build_object('reason', 'validation_failed', 'validation', validation_result));
    raise exception 'Layout version % failed validation.', layout_version_uuid;
  end if;

  inserted_cells := public.regenerate_layout_cells(layout_version_uuid);

  select id
  into archived_version_id
  from public.layout_versions
  where floor_id = floor_uuid and state = 'published' and id <> layout_version_uuid
  limit 1;

  update public.layout_versions
  set state = 'archived', archived_at = timezone('utc', now())
  where floor_id = floor_uuid and state = 'published' and id <> layout_version_uuid;

  if archived_version_id is not null then
    perform public.write_layout_event('layout_archived', 'succeeded', archived_version_id, 'layout_version', archived_version_id, actor_uuid, jsonb_build_object('replacedBy', layout_version_uuid));
  end if;

  update public.layout_versions
  set state = 'published', published_at = timezone('utc', now()), published_by = actor_uuid
  where id = layout_version_uuid and state = 'draft';

  if not found then
    raise exception 'Layout version % could not be published because it is no longer draft.', layout_version_uuid;
  end if;

  update public.racks
  set state = 'published'
  where layout_version_id = layout_version_uuid;

  perform public.write_layout_event('layout_publish', 'succeeded', layout_version_uuid, 'layout_version', layout_version_uuid, actor_uuid, jsonb_build_object('generatedCells', inserted_cells));

  return jsonb_build_object('layoutVersionId', layout_version_uuid, 'publishedAt', timezone('utc', now()), 'generatedCells', inserted_cells, 'validation', validation_result);
exception
  when others then
    if layout_version_uuid is not null then
      perform public.write_layout_event('layout_publish', 'failed', layout_version_uuid, 'layout_version', layout_version_uuid, actor_uuid, jsonb_build_object('error', sqlerrm));
    end if;
    raise;
end;
$$;
