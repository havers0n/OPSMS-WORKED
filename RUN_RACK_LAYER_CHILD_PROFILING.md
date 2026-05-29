# RackLayer Child Profiling Test

A focused, non-destructive Playwright spec that captures child-level render metrics during route-preview startup.

## Features

- **Non-destructive**: Uses existing local warehouse data (no reset, no seed required)
- **Self-contained**: No need for E2E_ALLOW_WAREHOUSE_RESET environment variable
- **Route-preview simulation**: Triggers via client-side navigation (history.pushState)
- **Full diagnostics**: Captures metrics for all RackLayer child components:
  - **RackBody** — static geometry (rack shell/frame)
  - **RackSections** — face/section geometry and labels
  - **RackCells** — dynamic cell grid, labels, runtime state
  - **SelectionOverlayLayer** — selection/highlight overlay
  - **InteractionRect** — hit-test interaction target

## Prerequisites

1. **Local Supabase running** with seed data (or any warehouse data in the database)
2. **Dev server running**:
   ```bash
   npm run dev
   ```
3. **BFF running** (for auth):
   ```bash
   cd apps/bff && tsx watch src/server.ts
   ```

## Running the Test

### Option 1: Run the test directly

```bash
cd apps/web
npx playwright test e2e/performance/rack-layer-child-profiling.spec.ts
```

### Option 2: Run with browser UI (for debugging)

```bash
cd apps/web
npx playwright test --debug e2e/performance/rack-layer-child-profiling.spec.ts
```

### Option 3: Run headed mode (watch the browser)

```bash
cd apps/web
npx playwright test --headed e2e/performance/rack-layer-child-profiling.spec.ts
```

## Output

The test prints a detailed report to the console:

```
========================================
RackLayer Child Profiling Report
========================================

Total child profiler duration: 412.45ms
Total children tracked: 36

--- Per Child Type Summary ---

┌─────────────────────┬─────────┬───────────┬─────────┬────────┬───────────┬───────────┐
│ Child               │ Renders │ Total(ms) │ Max(ms) │ Avg(ms)│ % of Total│ Instances │
├─────────────────────┼─────────┼───────────┼─────────┼────────┼───────────┼───────────┤
│ RackCells           │ 20      │ 320.15    │ 89.23   │ 16.01  │ 77.6%     │ 4         │
│ RackBody            │ 4       │ 65.30     │ 18.45   │ 16.33  │ 15.8%     │ 4         │
│ SelectionOverlay... │ 6       │ 15.23     │ 5.12    │ 2.54   │ 3.7%      │ 1         │
└─────────────────────┴─────────┴───────────┴─────────┴────────┴───────────┴───────────┘

--- Per Instance (Top 20) ---

┌──────────────────────────┬─────────┬───────────┬─────────┬────────┬────────────────────────────────┐
│ Child                    │ Renders │ Total(ms) │ Max(ms) │ Avg(ms)│ Changed Refs                   │
├──────────────────────────┼─────────┼───────────┼─────────┼────────┼────────────────────────────────┤
│ RackCells:rack-001       │ 5       │ 80.45     │ 22.30   │ 16.09  │ cellRuntimeById_id,occupation…│
│ RackCells:rack-002       │ 5       │ 78.12     │ 21.45   │ 15.62  │ cellRuntimeById_id             │
│ RackBody:rack-001        │ 1       │ 18.45     │ 18.45   │ 18.45  │ racks_id                      │
└──────────────────────────┴─────────┴───────────┴─────────┴────────┴────────────────────────────────┘

--- Analysis ---

Total RackBody renders: 4
RackBody renders with only runtime changes: 0
✓ RackBody does NOT re-render on runtime-only changes

Total RackCells renders: 20
RackCells total time: 320.15ms (77.6% of total)
RackCells is DOMINANT contributor

✓ Most expensive child: RackCells (320.15ms, 77.6%)

--- RackLayer Render Events ---

RackLayer rendered 5 times
First 5 renders with changed refs:
  #1: (no ref changes)
  #2: racks_id
  #3: cellRuntimeById_id, occupiedCellIds_id
  #4: occupiedCellIds_id
  #5: (no ref changes)

========================================
```

## Interpreting Results

### Key Questions Answered

1. **Which child is responsible for most time?**
   - Look at the "% of Total" column in the Per Child Type summary
   - RackCells > 50% → suggests geometric/cell rendering is the bottleneck

2. **Does RackBody re-render on runtime-only changes?**
   - Look for "RackBody renders with only runtime changes"
   - `0` ✓ = good (RackBody memoization working)
   - `> 0` ⚠️ = problem (needs investigation)

3. **What props changed when?**
   - "Changed Refs" column shows which reference-identity props changed:
     - `racks_id` — visible rack set changed (legitimate re-render)
     - `cellRuntimeById_id` — runtime state changed (expected for RackCells, unexpected for RackBody)
     - `occupiedCellIds_id` — occupancy state changed (indicates culling dependency)

4. **Is RackCells time dominated by which ref changes?**
   - Scan the per-instance table for RackCells entries
   - Most RackCells with `cellRuntimeById_id` → runtime updates are expensive
   - Most RackCells with `occupiedCellIds_id` → occupancy logic is expensive
   - Most RackCells with `racks_id` → culling/visible rack set impacts performance

## Troubleshooting

### "Canvas did not stabilize within timeout"
- Canvas rendering failed to reach a stable state within 20 seconds
- Check that the warehouse has data and the canvas renders properly
- Increase `timeoutMs` in `waitForCanvasReady()` if needed

### "No child profiling metrics collected"
- Diagnostics were armed but child profiler never recorded anything
- Verify that `isCanvasRenderPipelineDiagnosticsEnabled()` returns `true` in the app
- Check that RackLayer is actually rendering (not hidden or culled)

### "RackLayer rendered 0 times"
- The render event tracking didn't capture any RackLayer render events
- This suggests the diagnostics object wasn't properly initialized before route transition
- Verify `enableDiagnosticsBeforeStartup()` ran before `pushState()`

## Next Steps

Once you have the report:

1. **Identify the bottleneck child** — which subtree accounts for most time?
2. **Understand the re-render trigger** — which reference-identity props cause each re-render?
3. **Design an optimization PR** based on findings:
   - If RackBody re-renders on `occupiedCellIds_id` → memoize or stabilize it
   - If RackCells dominates on `racks_id` → visibleRacks stabilization may not help; check culling logic
   - If SelectionOverlayLayer is expensive → check hit-test computation
   - If RackSections is expensive → check label rendering or section geometry

## Related Files

- **Test**: `apps/web/e2e/performance/rack-layer-child-profiling.spec.ts`
- **Diagnostics instrumentation**: `apps/web/src/warehouse/editor/ui/canvas-diagnostics.ts`
- **Child profiler**: `apps/web/src/warehouse/editor/ui/rack-layer-child-profiler.tsx`
- **RackLayer**: `apps/web/src/warehouse/editor/ui/rack-layer.tsx`
- **Diagnostic documentation**: `RACK_LAYER_CHILD_ATTRIBUTION_DIAGNOSTICS.md`
