# RackLayer Child Profiling Diagnostic Runbook

## Quick Start

### Prerequisites
- Dev server running: `npm run dev` (web on port 5174, if 5173 is in use)
- Browser with DevTools open (F12)
- Access to route preview or canvas interaction

### Step 1: Enable Diagnostics (Copy-Paste Helper)

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Copy the entire contents of `RACK_LAYER_DIAGNOSTICS_HELPER.js`
4. Paste into the console and press Enter
5. You should see: `[WOS] Diagnostic helper loaded...`

### Step 2: Activate Diagnostics

In the console, run:
```javascript
WOS_DIAGNOSTICS.enableDiagnostics()
```

Expected output:
```
[WOS] Enabling canvas render pipeline diagnostics...
[WOS] ✓ Diagnostics enabled
[WOS] Now navigate to route preview or trigger canvas activity
[WOS] Then call: WOS_DIAGNOSTICS.reportMetrics()
```

### Step 3: Trigger Route Preview Activity

Navigate to or interact with:
- **Route Preview** page (if available)
- Warehouse Editor with canvas interaction
- Any page that renders RackLayer

**Key: Make sure RackLayer renders** (you should see warehouse floor plan with racks)

### Step 4: Collect Metrics

Once the page has loaded and rendered, run in console:
```javascript
WOS_DIAGNOSTICS.reportMetrics()
```

This will output:
1. **Total child profiler duration** (ms)
2. **Per Child Type Summary** table:
   - Child name
   - Render count
   - Total, max, avg duration
   - % of total
   - Instance count
3. **Per Instance** (top 20 by duration):
   - Child and rack ID
   - Render stats
   - Changed ref keys
4. **Analysis section** with answers to key questions

### Step 5: Test Gating (Optional)

Test that profiling is properly gated when disabled:

```javascript
WOS_DIAGNOSTICS.testDisabled()
// Navigate to another page, then:
WOS_DIAGNOSTICS.checkDisabledGating()
```

Expected: `✓ CONFIRMED: Child profiling is gated and disabled when diagnostics are off`

---

## Key Questions the Report Will Answer

### 1. Total RackLayer Child Profiler Duration
Look at the first line of the report:
```
Total child profiler duration: XXX.XXms
```

This is the sum of all child render times during the captured session. The goal is to see if it correlates with the ~400ms RackLayer updates mentioned.

### 2. Which Child is Responsible for Most Time?

The **Per Child Type Summary** table shows this ranked by `% of Total`:
- **RackCells > 50%?** → RackCells dominates
- **RackBody + RackSections > 30%?** → Static geometry is expensive
- **SelectionOverlayLayer high?** → Overlay is expensive

### 3. Does RackBody Re-render on Runtime-Only Changes?

Look in **Analysis** section:
```
RackBody renders with only runtime changes: X
```

If this number is > 0, then **RackBody is re-rendering when only cellRuntimeById_id or occupiedCellIds_id changes**, which indicates a static geometry re-computation bug.

✓ **Expected**: Should be 0 (RackBody should only re-render when racks_id or selection state changes)
✗ **Problem**: > 0 means static geometry is being re-computed on runtime updates

### 4. Does RackCells Dominate?

Look in **Analysis**:
```
RackCells is DOMINANT / NOT DOMINANT contributor
RackCells total time: XXX.XXms (YY.Y% of total)
```

✓ **Expected**: RackCells > 50% (it handles dynamic grid + labels + runtime state)
✗ **Surprising**: RackCells < 30% (suggests static geometry is expensive)

### 5. What Ref-Identity Props Change?

In **Per Instance** table, look at **Changed Refs** column:
- **racks_id** → Rack array changed (geometry recomputation)
- **cellRuntimeById_id** → Runtime state changed (grid visual updates)
- **occupiedCellIds_id** → Occupancy changed (grid visual updates)
- **publishedCellsByStructure_id** → Cell structure changed (rare)

This shows **which props triggered each re-render**.

---

## Interpreting Results

### Scenario A: RackCells Dominates, No Static Geometry on Runtime Changes
```
Expected result:
- RackCells: 75% of time, renders 20x
- RackBody: 20% of time, renders 4x
- RackBody Changed Refs: (none) or just racks_id

Conclusion:
✓ Static geometry (RackBody, RackSections) is properly memoized
✓ RackCells doing runtime updates (expected)
→ Next step: Optimize RackCells internals (cell grid rendering, labels)
   or investigate visibleRacks stabilization
```

### Scenario B: RackBody Re-renders on occupiedCellIds_id
```
Unexpected result:
- RackBody renders 20x, many with occupiedCellIds_id change
- RackBody: 40% of time despite no geometry change

Conclusion:
✗ RackBody is unnecessarily re-rendering on runtime changes
→ Next step: Memoize RackBody or stabilize geometry props
   Use React.memo() or useMemo() on geometry calculation
```

### Scenario C: RackCells Very Small Contributor
```
Unexpected result:
- RackCells: only 15% of time, renders 20x
- RackBody: 60% of time, renders 4x
- RackSections: 25% of time

Conclusion:
✗ Static geometry (RackBody + RackSections) is expensive
✗ Likely re-rendering on every parent render
→ Next step: Check if RackBody/RackSections are memoized
   or if geometry calculation is expensive
```

---

## Raw Data Location

If you want to inspect raw metrics programmatically:

```javascript
// Raw child metrics object
window.__WOS_RACK_LAYER_CHILD_PROFILING__.childMetrics

// Example entry:
{
  "RackBody:rack-001": {
    childName: "RackBody",
    rackId: "rack-001",
    renderCount: 5,
    totalActualDurationMs: 25.3,
    maxActualDurationMs: 8.2,
    lastActualDurationMs: 4.1,
    propChanges: { "racks_id": 2, "cellRuntimeById_id": 3 },
    refChanges: {}
  }
}

// RackLayer render events
window.__WOS_RACK_LAYER_RENDER_EVENTS__.events
// Shows: renderIndex, snapshot (props at that render), changedKeys

// Render pipeline diagnostics
window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__
```

---

## Troubleshooting

### "No child profiling metrics collected yet"
**Possible causes:**
- RackLayer didn't render (route doesn't have canvas)
- Diagnostics got disabled
- Child profilers were not applied (check git changes)

**Solution:**
1. Verify you're on a page with RackLayer (check DevTools Elements > Konva canvas)
2. Check console for any TypeScript errors
3. Run `WOS_DIAGNOSTICS.enableDiagnostics()` again
4. Trigger a canvas re-render (scroll, zoom, etc.)

### Metrics seem too low (< 50ms total)
**Possible causes:**
- Route preview didn't fully load
- Canvas is off-screen or culled
- Only a few racks visible

**Solution:**
- Zoom out to see all racks
- Scroll around the canvas to trigger RackCell renders
- Wait for initial load to complete
- Try a different view (if available)

### All metrics on one child type only
**Possible causes:**
- Only one child is rendering in the visible area
- Conditional rendering (RackSections/RackCells only render at certain LOD levels)

**Solution:**
- Check LOD (level of detail) setting
- Verify racks are visible with all details
- Zoom in/out to change LOD

---

## Export Results

To save the full report:

```javascript
const report = WOS_DIAGNOSTICS.reportMetrics()
// The output above is automatically in console
// Right-click console > Save as > save_logs.txt
// Or:
copy(window.__WOS_RACK_LAYER_CHILD_PROFILING__)
// Paste into editor and save as metrics.json
```

---

## One-Time Test Command

To run the entire diagnostic cycle in one go (for automation):

```javascript
// Load helper if not already loaded
eval(`<contents of RACK_LAYER_DIAGNOSTICS_HELPER.js>`)

// Enable diagnostics
WOS_DIAGNOSTICS.enableDiagnostics()

// [Navigate/interact here in your test]

// Report (after navigation)
WOS_DIAGNOSTICS.reportMetrics()
```

---

## Expected Findings

Based on the task description, we expect to find:

1. ✓ **RackLayer renders 4 times** (recorded in `__WOS_RACK_LAYER_RENDER_EVENTS__`)
2. ✓ **Reference identity churn** on:
   - update#1: racks_id, cellRuntimeById_id, occupiedCellIds_id
   - update#2: cellRuntimeById_id, occupiedCellIds_id
   - update#3: occupiedCellIds_id
3. ❓ **Which child re-renders most?** (this is what we're diagnosing)
4. ❓ **Does static geometry re-render on runtime changes?** (this is what we're diagnosing)
5. ✓ **No production overhead** (gating works)

---

## Next Steps After Report

Once you have the report, share:

1. The **Per Child Type Summary** table
2. The **Most expensive child** line
3. The **RackBody re-renders on runtime-only changes** line
4. Any **Per Instance** entries with surprising high durations

With this data, we can design the **next optimization PR** with evidence showing:
- Exactly which subtree to optimize
- Which props cause the expensive re-renders
- Whether the fix is memoization, stabilization, or restructuring
