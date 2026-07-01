-- PR-1.1: Add explicit bucket_kind column to demand_planning_buckets.
-- Replaces legacy name-based technical bucket detection
-- (planning_line_name = 'default' AND bucket_name = 'unassigned')
-- with an explicit enumerated column.

alter table public.demand_planning_buckets
  add column if not exists bucket_kind text
  check (bucket_kind in ('technical_unassigned', 'work_group'));

-- Backfill: default/unassigned → technical_unassigned
update public.demand_planning_buckets
set bucket_kind = 'technical_unassigned'
where planning_line_name = 'default' and bucket_name = 'unassigned';

-- Backfill: all other rows → work_group
update public.demand_planning_buckets
set bucket_kind = 'work_group'
where bucket_kind is null;

-- Now that all rows have a value, enforce NOT NULL
alter table public.demand_planning_buckets
  alter column bucket_kind set not null;

create index if not exists dp_buckets_kind_idx
  on public.demand_planning_buckets(bucket_kind);
