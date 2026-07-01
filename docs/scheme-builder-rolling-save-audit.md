# Scheme Builder rolling draft save audit

## Runtime chain

The verified frontend chain is:

1. `SchemeBuilder.handleConfirmAssign` / `handleConfirmAllocations` calls the Zustand allocation actions.
2. `useSchemeBuilderStore.allocateItemRows` or `allocateItemQty` records the destination work-group ID locally.
3. `SchemeBuilder.handleSaveDraft` calls `buildPlanPayload`.
4. For `draft.sourceKind === 'rolling'`, `buildPlanPayload` requires both the rolling audit and source rows, builds every bucket from current local planning lines/work groups, and calls `buildRollingPlanAllocations` for the canonical rolling row set.
5. `usePutDemandPlanningPlan` sends `PUT /api/demand-planning-drafts/:draftId/plan`.
6. The BFF validates the body, enforces the exact rolling row set, replaces `demand_planning_buckets` and `demand_planning_allocations`, and returns the hydrated draft.
7. Reload fetches the draft and `SchemeBuilder` calls `hydrateFromDraft`, restoring persisted buckets and allocations into Zustand.

## Changed files and functions

- `apps/web/src/pages/manual-operator/ui/scheme-builder/index.tsx`
  - `createPlanPayload` delegates to the guarded serializer.
  - `handleSaveDraft` uses that serializer.
  - Save mutation/build errors render as prominent `role="alert"` panels. A `BffRequestError` displays both its backend code and message.
- `apps/web/src/pages/manual-operator/ui/scheme-builder/plan-payload.ts`
  - `buildPlanPayload` owns batch and rolling serialization.
  - A rolling draft cannot fall through to batch serialization. Missing audit data or rows throws a clear error before the PUT.
- `apps/web/src/pages/manual-operator/ui/scheme-builder/plan-payload.test.ts`
  - Covers a new `ראשי / כללי` bucket, its allocation destination, the rolling guard, and unchanged batch behavior.
- `apps/web/src/pages/manual-operator/ui/scheme-builder/scheme-store.test.ts`
  - Covers assignment to a newly created work group in local Zustand state.
- `apps/web/src/pages/manual-operator/ui/scheme-builder/index.test.tsx`
  - Covers visible `DEMAND_PLANNING_ROLLING_ROW_SET_MISMATCH` output and reload hydration of a saved non-default bucket/allocation.

## Manual end-to-end verification

1. Open a rolling draft in Scheme Builder.
2. Create planning line `ראשי` and work group `כללי`.
3. Assign one demand row to `כללי`, then click `שמור טיוטה`.
4. In browser DevTools, inspect the `PUT /api/demand-planning-drafts/<draft-id>/plan` request. Confirm:
   - `buckets` contains `{ "planningLineName": "ראשי", "bucketName": "כללי" }` for the correct area.
   - the assigned row's allocation has `bucketKey` equal to `<area>|ראשי|כללי`.
   - every canonical rolling row occurs exactly once in `allocations`.
5. Run this read-only SQL with the actual draft UUID:

```sql
select
  b.draft_id,
  b.id as bucket_id,
  b.distribution_area,
  b.planning_line_name,
  b.bucket_name,
  a.raw_demand_row_id,
  a.allocated_quantity
from public.demand_planning_buckets b
left join public.demand_planning_allocations a on a.bucket_id = b.id
where b.draft_id = '<draft-id>'::uuid
order by b.sort_order, a.raw_demand_row_id;
```

6. Confirm the assigned row points to the bucket whose `planning_line_name = 'ראשי'` and `bucket_name = 'כללי'`.
7. Reload the page. Confirm `ראשי / כללי` and the row assignment are restored.
8. Negative check: force or reproduce a row-set mismatch. Confirm the UI shows a red alert containing `DEMAND_PLANNING_ROLLING_ROW_SET_MISMATCH` and the backend message; it must not show a success state.
