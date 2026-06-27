-- Description: PR A — DeliveryPoint metadata for Manual Operator orders.
-- Adds columns to manual_shift_orders for persisting resolved DeliveryPoint
-- information on each order, preserving the raw destination label and match status.
--
-- Business rule:
--   raw_destination_label = the raw text used for DeliveryPoint alias matching
--   delivery_point_id     = FK to delivery_points (set on delete null)
--   delivery_point_name   = display name of the matched delivery point
--   delivery_point_match_status = matched | unmatched | ambiguous | not_attempted
--   delivery_point_alias_text   = normalized alias text used during matching
--   delivery_point_alias_id     = FK to delivery_point_aliases (set on delete null)
--
-- Existing rows default to 'not_attempted' (no backfill of alias matching).
-- point_name is preserved unchanged.
-- line.buckets grouping behaviour is not affected.

alter table public.manual_shift_orders
  add column if not exists raw_destination_label text null,
  add column if not exists delivery_point_id uuid null,
  add column if not exists delivery_point_name text null,
  add column if not exists delivery_point_match_status text not null default 'not_attempted',
  add column if not exists delivery_point_alias_text text null,
  add column if not exists delivery_point_alias_id uuid null;

comment on column public.manual_shift_orders.raw_destination_label is 'Raw destination text used for DeliveryPoint alias matching';
comment on column public.manual_shift_orders.delivery_point_id is 'FK to delivery_points — resolved physical delivery point';
comment on column public.manual_shift_orders.delivery_point_name is 'Display name of the matched delivery point at match time';
comment on column public.manual_shift_orders.delivery_point_match_status is 'Match status: matched, unmatched, ambiguous, not_attempted';
comment on column public.manual_shift_orders.delivery_point_alias_text is 'Normalized alias text used during matching';
comment on column public.manual_shift_orders.delivery_point_alias_id is 'FK to delivery_point_aliases — the specific alias row matched';

-- FK constraints
alter table public.manual_shift_orders
  add constraint manual_shift_orders_delivery_point_id_fkey
    foreign key (delivery_point_id) references public.delivery_points(id)
    on delete set null;

alter table public.manual_shift_orders
  add constraint manual_shift_orders_delivery_point_alias_id_fkey
    foreign key (delivery_point_alias_id) references public.delivery_point_aliases(id)
    on delete set null;

-- Check constraint on match status
alter table public.manual_shift_orders
  add constraint manual_shift_orders_delivery_point_match_status_check
    check (delivery_point_match_status in ('matched', 'unmatched', 'ambiguous', 'not_attempted'));

-- Indexes
create index if not exists idx_manual_shift_orders_delivery_point_id
  on public.manual_shift_orders (delivery_point_id);

create index if not exists idx_manual_shift_orders_delivery_point_match_status
  on public.manual_shift_orders (delivery_point_match_status);

create index if not exists idx_manual_shift_orders_raw_destination_label
  on public.manual_shift_orders (raw_destination_label);
