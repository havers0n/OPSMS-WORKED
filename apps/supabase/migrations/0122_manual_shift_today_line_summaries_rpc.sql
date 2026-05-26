-- Migration: 0122_manual_shift_today_line_summaries_rpc.sql
-- Description: Add lightweight aggregate RPC for manual shift line summaries used by /api/manual-shifts/today.

create or replace function public.manual_shift_list_line_summaries(p_shift_id uuid)
returns table (
  line_id uuid,
  tenant_id uuid,
  shift_id uuid,
  name text,
  sort_order integer,
  status text,
  created_at timestamptz,
  total_orders integer,
  queued_orders integer,
  picking_orders integer,
  waiting_check_orders integer,
  returned_orders integer,
  done_orders integer,
  error_count integer
)
language sql
stable
security invoker
as $$
with orders_agg as (
  select
    o.line_id,
    count(*)::int as total_orders,
    count(*) filter (where o.status = 'queued')::int as queued_orders,
    count(*) filter (where o.status = 'picking')::int as picking_orders,
    count(*) filter (where o.status = 'waiting_check')::int as waiting_check_orders,
    count(*) filter (where o.status = 'returned')::int as returned_orders,
    count(*) filter (where o.status = 'done')::int as done_orders
  from public.manual_shift_orders o
  where o.shift_id = p_shift_id
  group by o.line_id
),
errors_agg as (
  select
    e.line_id,
    count(*)::int as error_count
  from public.manual_shift_order_errors e
  where e.shift_id = p_shift_id
  group by e.line_id
)
select
  l.id as line_id,
  l.tenant_id,
  l.shift_id,
  l.name,
  l.sort_order,
  case
    when coalesce(o.total_orders, 0) = 0 then 'open'
    when coalesce(o.queued_orders, 0) = coalesce(o.total_orders, 0) then 'open'
    when coalesce(o.done_orders, 0) = coalesce(o.total_orders, 0) then 'done'
    else 'in_progress'
  end as status,
  l.created_at,
  coalesce(o.total_orders, 0) as total_orders,
  coalesce(o.queued_orders, 0) as queued_orders,
  coalesce(o.picking_orders, 0) as picking_orders,
  coalesce(o.waiting_check_orders, 0) as waiting_check_orders,
  coalesce(o.returned_orders, 0) as returned_orders,
  coalesce(o.done_orders, 0) as done_orders,
  coalesce(e.error_count, 0) as error_count
from public.manual_shift_lines l
left join orders_agg o on o.line_id = l.id
left join errors_agg e on e.line_id = l.id
where l.shift_id = p_shift_id
order by l.sort_order asc, l.created_at asc;
$$;

grant execute on function public.manual_shift_list_line_summaries(uuid) to authenticated;

