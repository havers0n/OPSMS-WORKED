-- 0140_allow_internal_order_line_projection_updates.sql
--
-- Narrowly allow the internal order-line projection helper to update
-- projection-owned fields on committed orders without weakening the
-- general committed-order edit guard for ordinary demand edits.

create or replace function public._recalculate_order_line_projection(
  line_uuid uuid
)
returns void
language plpgsql
as $$
declare
  new_qty_picked int;
  new_status     text;
  current_status text;
  line_qty_required int;
  prior_committed_line_update_setting text :=
    coalesce(
      nullif(current_setting('wos.allow_committed_order_line_system_update', true), ''),
      'off'
    );
begin
  select ol.status, ol.qty_required
  into   current_status, line_qty_required
  from   public.order_lines ol
  where  ol.id = line_uuid
  for    update;

  if current_status is null then
    return;
  end if;

  select
    coalesce(sum(ps.qty_picked), 0),
    case
      when coalesce(sum(ps.qty_picked), 0) >= line_qty_required
        then 'picked'
      when bool_or(ps.status = 'exception')
        then 'exception'
      when bool_or(ps.status = 'needs_replenishment')
        then 'exception'
      when coalesce(sum(ps.qty_picked), 0) > 0
        then 'partial'
      when count(*) > 0 and bool_and(ps.status = 'skipped')
        then 'skipped'
      when count(*) > 0 and not bool_or(ps.status in ('picked', 'partial', 'skipped', 'exception', 'needs_replenishment'))
        then 'released'
      else current_status
    end
  into new_qty_picked, new_status
  from public.pick_steps ps
  where ps.order_line_id = line_uuid;

  perform set_config('wos.allow_committed_order_line_system_update', 'on', true);

  update public.order_lines
  set    qty_picked = new_qty_picked,
         status     = new_status
  where  id = line_uuid;

  perform set_config(
    'wos.allow_committed_order_line_system_update',
    prior_committed_line_update_setting,
    true
  );
end;
$$;

revoke execute on function public._recalculate_order_line_projection(uuid)
  from public, anon, authenticated;
