# RackLayer Child-Level Attribution Diagnostics

## Overview

Added child-level profiler instrumentation to RackLayer to identify which subtree causes ~400ms renders during route-preview startup, and whether runtime-only updates (cellRuntimeById, occupiedCellIds) trigger expensive static geometry work.

**Constraints satisfied:**
- Diagnostics-only (gated, no production overhead)
- No changes to visual semantics, culling, or storage runtime
- No visibleRacks stabilization yet
- No RackLayer splitting yet
- Existing RackLayer render events preserved

## What Was Instrumented

Each RackLayer child is now wrapped with React.Profiler:

1. **RackBody** — static geometry (rack shell/frame)
2. **RackSections** — face/section geometry and labels (conditional, lod >= 1)
3. **RackCells** — dynamic cell grid, labels, runtime visual state (conditional)
4. **SelectionOverlayLayer** — selection/highlight overlay
5. **InteractionRect** — hit-test interaction target

## How It Works

### Reference-Identity Tracking
RackLayer now tracks which reference-identity props changed between renders:
- `racks_id` — racks array identity
- `cellRuntimeById_id` — runtime data map identity
- `occupiedCellIds_id` — occupancy set identity
- `publishedCellsByStructure_id` — published cells map identity
- `publishedCellsById_id` — published cells map identity

### Context Propagation
A React Context (`RackLayerProfilingContext`) passes the changed ref identities to all children, so each Profiler can record which specific references changed when it re-rendered.

### Per-Child Metrics
For each child instance, recorded metrics include:
- **renderCount** — how many times this child re-rendered
- **totalActualDurationMs** — sum of all render durations
- **maxActualDurationMs** — peak render time
- **lastActualDurationMs** — most recent render time
- **propChanges** — which reference-identity props changed (recorded as string array)

## Files Changed

### New Files
1. **`apps/web/src/warehouse/editor/ui/rack-layer-child-profiler.tsx`**
   - `RackLayerChildProfiler` component: wraps children with React.Profiler
   - `RackLayerProfilingContext`: shares ref-identity changes with children
   - `RackLayerRefIdentityChanges`: type for ref-identity change flags
   - `useRackLayerRefIdentityChanges()`: hook to access context

### Modified Files
1. **`apps/web/src/warehouse/editor/ui/canvas-diagnostics.ts`**
   - Added `RackLayerChildName` type (union of child component names)
   - Added `RackLayerChildProfilerMetrics` type (per-child metrics)
   - Added `RackLayerChildProfiling` type (container for all child metrics)
   - Added `recordRackLayerChildProfiler()` — records profiler metrics
   - Added `resetRackLayerChildProfiling()` — clears child metrics
   - Added `getRackLayerChildProfilingReport()` — generates diagnostic report
   - Updated `resetCanvasRenderPipelineDiagnostics()` to reset child profiling
   - Added window type declarations for `__WOS_RACK_LAYER_CHILD_PROFILING__`

2. **`apps/web/src/warehouse/editor/ui/rack-layer.tsx`**
   - Added 35-line docstring with diagnostic usage instructions
   - Added ref-identity tracking: `currentRefIds` object and `prevRefIdsRef` to detect changes
   - Added `RackLayerRefIdentityChanges` computation
   - Wrapped all children with `RackLayerChildProfiler`:
     - RackBody per rack
     - RackSections per rack (if rendered)
     - RackCells per rack (if rendered)
     - SelectionOverlayLayer (global)
     - InteractionRect per rack (if rendered)
   - Wrapped render tree with `RackLayerProfilingContextProvider`

## Usage

### Enable Diagnostics
```javascript
// In DevTools console during route-preview startup
window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__ = {
  enabled: true,
  currentRenderMode: 'full',
  renderModeCounts: { full: 0, 'interaction-light': 0, 'interaction-skeleton': 0, 'restore-base': 0, 'restore-overlays': 0, 'restore-labels': 0 },
  renderModeTransitionCounts: {},
  currentPhase: 'idle',
  phaseCounts: { idle: 0, 'active-skeleton': 0, 'restore-base': 0, 'restore-overlays': 0, 'restore-labels': 0, 'settled-full': 0 },
  phaseMarks: [],
  cameraStoreUpdates: 0,
  offsetUpdates: 0,
  zoomCameraUpdates: 0,
  zoomTransientUpdates: 0,
  zoomDurableCommits: 0,
  components: {},
  mode: { active: 'unknown', counts: { view: 0, storage: 0, layout: 0, unknown: 0 } },
  dataSizes: { rackCount: 0, visibleRackCount: 0, publishedCellsTotal: 0, renderedCellsCount: 0, occupiedCellsCount: 0, runtimeCellsCount: 0, navigatorVisibleCellCount: 0 },
  timings: {},
  counters: {},
  konva: { layerDrawCalls: 0, layerBatchDrawCalls: 0, layerDrawCallsByName: {}, layerBatchDrawCallsByName: {}, layerNodeCountsByName: {}, rackLayerNodeCount: 0, cellStateOverlayLayerNodeCount: 0 },
  selectionOverlay: { affectedCellCount: 0, highlightedCellCount: 0, resolvedCount: 0, unresolvedCount: 0 },
  forceRenderReasons: { none: 0, selection: 0, locate: 0, workflow: 0, debug: 0 }
};
```

Or use helper from earlier sessions:
```javascript
window.resetCanvasRenderPipelineDiagnostics?.();
```

### Navigate / Trigger Activity
Navigate to a route preview or trigger canvas interaction to populate metrics.

### Get Report
```javascript
// Import and call
import { getRackLayerChildProfilingReport } from './src/warehouse/editor/ui/canvas-diagnostics'
const { summary, childMetrics } = getRackLayerChildProfilingReport()
console.log(summary)
```

### Analyze Output
Report shows:
1. **Per Child Type** — aggregated metrics (RackBody, RackCells, etc.)
   - Total renders and instances
   - Total/max/avg duration
   - Percentage of total time
   
2. **Per Instance** (top 20 by duration)
   - Render count
   - Duration stats
   - Which ref-identity props changed

**Key questions to answer:**
- Which child is responsible for most of the ~400ms? (RackCells likely > RackBody)
- Does RackBody re-render when only occupiedCellIds_id changes? (should not)
- Does RackCells re-render on cellRuntimeById_id? (expected, runtime state)
- Does RackCells re-render on occupiedCellIds_id? (indicates culling dependency)

## Example Output Structure

```
=== RackLayer Child Attribution Report ===
Total children tracked: 36
Total time: 412.45ms

--- Per Child Type ---
RackCells:
  Total renders: 20 (across 4 instances)
  Total duration: 320.15ms
  Max duration: 89.23ms
  Avg per render: 16.01ms
  % of total: 77.6%

RackBody:
  Total renders: 4 (across 4 instances)
  Total duration: 65.30ms
  Max duration: 18.45ms
  Avg per render: 16.33ms
  % of total: 15.8%

...

--- Per Instance ---
RackCells:rack-001:
  Renders: 5
  Total duration: 80.45ms
  Max duration: 22.30ms
  Avg: 16.09ms
  Changed refs: cellRuntimeById_id(5), occupiedCellIds_id(3)
```

## Next Steps

Once the diagnostics are collected:

1. **Identify the bottleneck child** — which subtree accounts for most time?
2. **Understand the re-render trigger** — which reference-identity props cause each re-render?
3. **Design the optimization PR** — based on findings:
   - If RackBody re-renders on occupiedCellIds → memoize or stabilize
   - If RackCells re-renders on racks_id → visibleRacks stabilization may not help; check internal dependencies
   - If SelectionOverlayLayer is expensive → check hit-test computation

The goal is to have a **single, narrow PR** with evidence showing exactly what needs to be fixed.

## Gating Notes

- Profiling is **disabled by default** (only active when `isCanvasRenderPipelineDiagnosticsEnabled()` returns true)
- `RackLayerChildProfiler` returns children directly if diagnostics are disabled (zero overhead)
- Context is only created when diagnostics are enabled
- All recording functions check `isCanvasRenderPipelineDiagnosticsEnabled()` before writing data
- No production bundle size increase (dev-only code path)

## Constraints Verification

✓ **Diagnostics only** — gated behind `isCanvasRenderPipelineDiagnosticsEnabled()`
✓ **No visual changes** — profilers wrap, don't modify children
✓ **No culling changes** — RackCells culling behavior unchanged
✓ **No storage/runtime changes** — no state mutations
✓ **No visibleRacks stabilization** — that's a separate PR
✓ **No RackLayer splitting** — that's a separate PR
✓ **Existing render events preserved** — `recordCanvasComponentRender` still called for RackLayer
✓ **Production overhead avoided** — profilers disabled when diagnostics off
