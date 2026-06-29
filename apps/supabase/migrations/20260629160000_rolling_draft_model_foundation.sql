-- Rolling Draft Model Foundation (PR-2A)
-- Prepare model/contracts for future rolling drafts while preserving all existing batch behavior.

-- 1. Add source_kind to demand_planning_drafts
alter table public.demand_planning_drafts
  add column source_kind text not null default 'batch'
  check (source_kind in ('batch', 'rolling'));

-- 2. Make batch_id nullable in demand_planning_drafts
alter table public.demand_planning_drafts
  alter column batch_id drop not null;

-- 3. Add consistency check: batch kind requires batch_id, rolling kind requires no batch_id
alter table public.demand_planning_drafts
  add constraint demand_planning_drafts_source_kind_consistency
  check (
    (source_kind = 'batch' and batch_id is not null) or
    (source_kind = 'rolling' and batch_id is null)
  );

-- 4. Make batch_id nullable in demand_planning_buckets (rolling drafts may span multiple batches)
alter table public.demand_planning_buckets
  alter column batch_id drop not null;

-- 5. Keep demand_planning_allocations.batch_id non-null (raw-row lineage preserved)
-- No change needed - allocation.batch_id remains NOT NULL

-- Existing rows automatically become source_kind = 'batch' (via default)
-- Existing index demand_planning_drafts_tenant_batch_idx still works for batch drafts
