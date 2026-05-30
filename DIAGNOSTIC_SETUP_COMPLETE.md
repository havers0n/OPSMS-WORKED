# RackLayer Child-Level Attribution Diagnostics — Setup Complete ✓

## What Was Implemented

✓ **RackLayerChildProfiler component** — wraps each child with React.Profiler
✓ **Reference-identity tracking** — detects which ref-identity props changed between renders
✓ **Per-child metrics collection** — render count, duration, changed refs for each child/instance
✓ **Diagnostic reporting function** — `getRackLayerChildProfilingReport()` generates human-readable summary
✓ **Zero production overhead** — profiling disabled by default, gated behind diagnostics flag
✓ **Console helper script** — ready-to-paste code for easy diagnostics setup

## Files Created

1. **`rack-layer-child-profiler.tsx`** — Profiler wrapper component + context
2. **`RACK_LAYER_DIAGNOSTICS_HELPER.js`** — Copy-paste console helper for easy setup
3. **`DIAGNOSTIC_RUNBOOK.md`** — Step-by-step guide for running diagnostics
4. **`RACK_LAYER_CHILD_ATTRIBUTION_DIAGNOSTICS.md`** — Technical details and architecture

## Files Modified

1. **`canvas-diagnostics.ts`**
   - Added child-level metrics types and recording functions
   - Added `getRackLayerChildProfilingReport()` for human-readable output
   - Added window type declarations for storage

2. **`rack-layer.tsx`**
   - Added ref-identity change tracking
   - Wrapped all children (RackBody, RackSections, RackCells, SelectionOverlayLayer) with profilers
   - Wrapped render tree with RackLayerProfilingContextProvider
   - Added detailed usage documentation

## How to Run Diagnostics

### Quick Version (3 minutes)

1. **Open browser DevTools** (F12) → Console tab
2. **Copy-paste** the entire contents of `RACK_LAYER_DIAGNOSTICS_HELPER.js`
3. **Run**: `WOS_DIAGNOSTICS.enableDiagnostics()`
4. **Navigate** to route preview or interact with canvas
5. **Run**: `WOS_DIAGNOSTICS.reportMetrics()`
6. **See** the breakdown of child metrics

### Full Instructions

See **`DIAGNOSTIC_RUNBOOK.md`** for complete step-by-step guide

## What the Report Will Show

The diagnostic report includes:

### 1. Total Duration
```
Total child profiler duration: XXX.XXms
```
Sum of all RackLayer child render times during session.

### 2. Per-Child Type Summary Table
| Child | Renders | Total (ms) | Max (ms) | Avg (ms) | % of Total | Instances |
|-------|---------|-----------|----------|----------|-----------|-----------|
| RackCells | 20 | 320.15 | 89.23 | 16.01 | 77.6% | 4 |
| RackBody | 4 | 65.30 | 18.45 | 16.33 | 15.8% | 4 |
| RackSections | 4 | 25.60 | 7.20 | 6.40 | 6.2% | 4 |
| SelectionOverlayLayer | 4 | 1.40 | 0.40 | 0.35 | 0.3% | 1 |

**What it answers:**
- Which child dominates (RackCells > 50% = yes, it's dynamic grid)
- Whether static geometry (RackBody, RackSections) takes significant time

### 3. Per-Instance Details (Top 20)
| Child | Renders | Total (ms) | Max (ms) | Avg (ms) | Changed Refs |
|-------|---------|-----------|----------|----------|--------------|
| RackCells:rack-001 | 5 | 80.45 | 22.30 | 16.09 | cellRuntimeById_id,occupiedCellIds_id |
| RackCells:rack-002 | 5 | 78.20 | 21.10 | 15.64 | cellRuntimeById_id,occupiedCellIds_id |
| RackBody:rack-001 | 1 | 16.50 | 16.50 | 16.50 | (none) |
| RackBody:rack-002 | 1 | 15.80 | 15.80 | 15.80 | (none) |

**What it answers:**
- Which specific instances are expensive
- **CRITICAL**: Do RackBody re-renders include occupiedCellIds_id? (should not!)
- Which ref-identity props actually trigger each re-render

### 4. Analysis Section
```
✓ Most expensive child: RackCells (320.15ms, 77.6% of total)

Total RackBody renders: 4
RackBody renders with only runtime changes: 0
✓ RackBody does NOT re-render on runtime-only changes

Total RackCells renders: 20
RackCells total time: 320.15ms (77.6% of total)
RackCells is DOMINANT contributor
```

**What it answers:**
- Which child is the bottleneck
- **CRITICAL**: Does RackBody re-render when only occupiedCellIds/cellRuntimeById changes?
- Should we focus on RackCells optimization or static geometry memoization?

## Key Findings to Expect

Based on the task description, we expect:

### ✓ Confirmed
- RackLayer renders 4 times during route-preview startup
- Reference-identity churn on racks_id, cellRuntimeById_id, occupiedCellIds_id
- Total RackLayer child time will be in the 400ms range

### ❓ To Discover
1. **Does RackBody re-render on cellRuntimeById_id or occupiedCellIds_id changes?**
   - If YES → Static geometry is re-computing unnecessarily (bug)
   - If NO → RackBody is properly memoized ✓

2. **Which child dominates the 400ms?**
   - RackCells > 60% → Focus on cell grid optimization or visibleRacks stabilization
   - RackBody > 30% → Focus on memoizing static geometry
   - RackSections > 20% → Focus on label rendering optimization

3. **Is the re-render churn on racks_id alone or do runtime changes trigger everything?**
   - If runtime changes alone don't trigger static geometry → Good, just need runtime optimization
   - If runtime changes trigger all children → Need deeper dependency analysis

## Gating Verification

The diagnostics will also verify that profiling is **properly gated**:

```javascript
// When diagnostics are ENABLED
WOS_DIAGNOSTICS.enableDiagnostics()
// Child profilers are active, recording metrics

// When diagnostics are DISABLED
WOS_DIAGNOSTICS.testDisabled()
WOS_DIAGNOSTICS.checkDisabledGating()
// Child profilers return children directly (zero overhead)
// No metrics are collected
```

Expected: ✓ `Child profiling is gated and disabled when diagnostics are off`

## Production Impact

✓ **Zero production overhead**
- Profilers only wrap children when `isCanvasRenderPipelineDiagnosticsEnabled()` returns true
- When disabled, `RackLayerChildProfiler` returns children directly (no wrapper)
- Context creation conditional on diagnostics enabled
- All recording functions check gate before writing

✓ **No code path changes**
- Only measurement added, no logic changes
- Children render exactly the same
- No additional props passed to children

✓ **No bundle size impact for users**
- Helper script is dev-only
- Dead code elimination will remove disabled profilers in production build

## What's NOT Included (Preserved Constraints)

✗ **No visibleRacks stabilization** — that's a separate PR
✗ **No RackLayer splitting** — that's a separate PR  
✗ **No optimization implemented** — diagnostics only
✗ **No culling changes** — RackCells culling behavior unchanged
✗ **No state mutations** — read-only diagnostics

## Next Steps

1. **Run the diagnostics** using the helper script (see DIAGNOSTIC_RUNBOOK.md)
2. **Collect the report** showing which child is expensive and which props trigger re-renders
3. **Share findings** with the team showing exact metrics
4. **Design the optimization PR** based on evidence from the report

The goal: **One narrow, evidence-based PR** instead of guessing which child to optimize.

## Files Ready to Use

```
RACK_LAYER_DIAGNOSTICS_HELPER.js          ← Copy-paste into DevTools console
DIAGNOSTIC_RUNBOOK.md                      ← Step-by-step instructions
RACK_LAYER_CHILD_ATTRIBUTION_DIAGNOSTICS.md  ← Technical details
```

**Status: Ready for diagnostics collection** ✓

---

## Example: Running the Diagnostic

```javascript
// 1. Paste helper script into DevTools console
// 2. Run:
WOS_DIAGNOSTICS.enableDiagnostics()

// 3. Navigate to route preview, wait for load

// 4. Run:
WOS_DIAGNOSTICS.reportMetrics()

// 5. See output like:
/*
========================================
RackLayer Child Attribution Report
========================================

Total child profiler duration: 412.45ms
Total children tracked: 36

--- Per Child Type Summary ---
┌─────────────────┬─────────┬──────────┬────────┬────────┬──────────────┬───────────┐
│ Child           │ Renders │ Total    │ Max    │ Avg    │ % of Total   │ Instances │
├─────────────────┼─────────┼──────────┼────────┼────────┼──────────────┼───────────┤
│ RackCells       │ 20      │ 320.15   │ 89.23  │ 16.01  │ 77.6%        │ 4         │
│ RackBody        │ 4       │ 65.30    │ 18.45  │ 16.33  │ 15.8%        │ 4         │
│ RackSections    │ 4       │ 25.60    │ 7.20   │ 6.40   │ 6.2%         │ 4         │
│ SelectionOverlayLayer │ 4 │ 1.40     │ 0.40   │ 0.35   │ 0.3%         │ 1         │
└─────────────────┴─────────┴──────────┴────────┴────────┴──────────────┴───────────┘

--- Analysis ---
✓ Most expensive child: RackCells (320.15ms, 77.6% of total)
✓ RackBody does NOT re-render on runtime-only changes
*/
```

Now ready to run diagnostics and identify the optimization target! 🎯
