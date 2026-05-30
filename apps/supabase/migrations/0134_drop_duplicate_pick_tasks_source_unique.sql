-- 0134_drop_duplicate_pick_tasks_source_unique.sql
--
-- pick_tasks_source_unique (added in 0127) is structurally identical to
-- pick_tasks_source_unique_idx (added in 0126): same table, same column order
-- (tenant_id, source_type, source_id), same uniqueness, no predicate, no
-- included columns, no expression.  Retaining both doubles write overhead with
-- no additional enforcement benefit.  Drop the 0127 copy; the 0126 index
-- continues to enforce uniqueness.

drop index if exists public.pick_tasks_source_unique;
