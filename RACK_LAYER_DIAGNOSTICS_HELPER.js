/**
 * RackLayer Child Profiling Diagnostic Helper
 *
 * USAGE IN BROWSER CONSOLE:
 * 1. Copy this entire script
 * 2. Paste into browser DevTools console
 * 3. Call: WOS_DIAGNOSTICS.enableDiagnostics()
 * 4. Navigate to route preview or trigger canvas activity
 * 5. Call: WOS_DIAGNOSTICS.reportMetrics()
 */

window.WOS_DIAGNOSTICS = {
  enableDiagnostics() {
    console.log('[WOS] Enabling canvas render pipeline diagnostics...');

    // Create render pipeline diagnostics object
    window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__ = {
      enabled: true,
      currentRenderMode: 'full',
      renderModeCounts: {
        full: 0,
        'interaction-light': 0,
        'interaction-skeleton': 0,
        'restore-base': 0,
        'restore-overlays': 0,
        'restore-labels': 0
      },
      renderModeTransitionCounts: {},
      currentPhase: 'idle',
      phaseCounts: {
        idle: 0,
        'active-skeleton': 0,
        'restore-base': 0,
        'restore-overlays': 0,
        'restore-labels': 0,
        'settled-full': 0
      },
      phaseMarks: [],
      cameraStoreUpdates: 0,
      offsetUpdates: 0,
      zoomCameraUpdates: 0,
      zoomTransientUpdates: 0,
      zoomDurableCommits: 0,
      components: {},
      mode: { active: 'unknown', counts: { view: 0, storage: 0, layout: 0, unknown: 0 } },
      dataSizes: {
        rackCount: 0,
        visibleRackCount: 0,
        publishedCellsTotal: 0,
        renderedCellsCount: 0,
        occupiedCellsCount: 0,
        runtimeCellsCount: 0,
        navigatorVisibleCellCount: 0
      },
      timings: {},
      counters: {},
      konva: {
        layerDrawCalls: 0,
        layerBatchDrawCalls: 0,
        layerDrawCallsByName: {},
        layerBatchDrawCallsByName: {},
        layerNodeCountsByName: {},
        rackLayerNodeCount: 0,
        cellStateOverlayLayerNodeCount: 0
      },
      selectionOverlay: {
        affectedCellCount: 0,
        highlightedCellCount: 0,
        resolvedCount: 0,
        unresolvedCount: 0
      },
      forceRenderReasons: {
        none: 0,
        selection: 0,
        locate: 0,
        workflow: 0,
        debug: 0
      }
    };

    // Initialize child profiling
    window.__WOS_RACK_LAYER_CHILD_PROFILING__ = {
      enabled: true,
      childMetrics: {}
    };

    // Initialize other required objects
    window.__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__ = {};
    window.__WOS_RACK_LAYER_RENDER_EVENTS__ = { events: [] };

    console.log('[WOS] ✓ Diagnostics enabled');
    console.log('[WOS] Now navigate to route preview or trigger canvas activity');
    console.log('[WOS] Then call: WOS_DIAGNOSTICS.reportMetrics()');
  },

  disableDiagnostics() {
    if (window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__) {
      window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__.enabled = false;
    }
    console.log('[WOS] Diagnostics disabled');
  },

  reportMetrics() {
    const childProfiling = window.__WOS_RACK_LAYER_CHILD_PROFILING__;
    const rackLayerEvents = window.__WOS_RACK_LAYER_RENDER_EVENTS__;

    if (!childProfiling || !childProfiling.childMetrics || Object.keys(childProfiling.childMetrics).length === 0) {
      console.log('[WOS] No child profiling metrics collected yet');
      return;
    }

    const metrics = Object.values(childProfiling.childMetrics);
    const totalDurationMs = metrics.reduce((sum, m) => sum + m.totalActualDurationMs, 0);

    console.log('\n========================================');
    console.log('RackLayer Child Attribution Report');
    console.log('========================================\n');
    console.log(`Total child profiler duration: ${totalDurationMs.toFixed(2)}ms`);
    console.log(`Total children tracked: ${metrics.length}\n`);

    // Aggregate per child type
    const perChild = {};
    for (const metric of metrics) {
      const key = metric.childName;
      const entry = perChild[key] || { renderCount: 0, totalDuration: 0, maxDuration: 0, instances: 0, examples: [] };
      entry.renderCount += metric.renderCount;
      entry.totalDuration += metric.totalActualDurationMs;
      entry.maxDuration = Math.max(entry.maxDuration, metric.maxActualDurationMs);
      entry.instances += 1;
      entry.examples.push(metric);
      perChild[key] = entry;
    }

    // Sort per child by total duration
    const sortedPerChild = Object.entries(perChild).sort((a, b) => b[1].totalDuration - a[1].totalDuration);

    console.log('--- Per Child Type Summary ---\n');
    console.table(sortedPerChild.map(([childName, stats]) => ({
      'Child': childName,
      'Renders': stats.renderCount,
      'Total (ms)': stats.totalDuration.toFixed(2),
      'Max (ms)': stats.maxDuration.toFixed(2),
      'Avg (ms)': (stats.totalDuration / stats.renderCount).toFixed(2),
      '% of Total': ((stats.totalDuration / totalDurationMs) * 100).toFixed(1),
      'Instances': stats.instances
    })));

    console.log('\n--- Per Instance (Top 20) ---\n');
    const sorted = [...metrics].sort((a, b) => b.totalActualDurationMs - a.totalActualDurationMs);
    const displayMetrics = sorted.slice(0, 20).map(m => ({
      'Child': m.rackId ? `${m.childName}:${m.rackId}` : m.childName,
      'Renders': m.renderCount,
      'Total (ms)': m.totalActualDurationMs.toFixed(2),
      'Max (ms)': m.maxActualDurationMs.toFixed(2),
      'Avg (ms)': (m.totalActualDurationMs / m.renderCount).toFixed(2),
      'Changed Refs': Object.keys(m.propChanges).join(',') || '(none)'
    }));
    console.table(displayMetrics);

    console.log('\n--- Analysis ---\n');

    // Check if RackBody re-renders on runtime-only changes
    const rackBodies = metrics.filter(m => m.childName === 'RackBody');
    const rackCells = metrics.filter(m => m.childName === 'RackCells');
    const selectionOverlay = metrics.find(m => m.childName === 'SelectionOverlayLayer');

    const rackBodyOnlyRuntimeChanges = rackBodies.filter(m => {
      const refs = Object.keys(m.propChanges);
      return refs.some(r => ['cellRuntimeById_id', 'occupiedCellIds_id'].includes(r)) &&
             !refs.includes('racks_id');
    });

    console.log(`Total RackBody renders: ${rackBodies.reduce((sum, m) => sum + m.renderCount, 0)}`);
    console.log(`RackBody renders with only runtime changes: ${rackBodyOnlyRuntimeChanges.reduce((sum, m) => sum + m.renderCount, 0)}`);
    if (rackBodyOnlyRuntimeChanges.length > 0) {
      console.warn(`⚠️  RackBody re-renders on occupiedCellIds_id / cellRuntimeById_id changes (should not!)`);
    } else {
      console.log(`✓ RackBody does NOT re-render on runtime-only changes`);
    }

    console.log(`\nTotal RackCells renders: ${rackCells.reduce((sum, m) => sum + m.renderCount, 0)}`);
    const cellsTime = rackCells.reduce((sum, m) => sum + m.totalActualDurationMs, 0);
    console.log(`RackCells total time: ${cellsTime.toFixed(2)}ms (${((cellsTime / totalDurationMs) * 100).toFixed(1)}% of total)`);
    console.log(`RackCells is ${cellsTime > totalDurationMs * 0.5 ? 'DOMINANT' : 'not dominant'} contributor`);

    const mostExpensiveChild = sortedPerChild[0];
    console.log(`\n✓ Most expensive child: ${mostExpensiveChild[0]} (${mostExpensiveChild[1].totalDuration.toFixed(2)}ms, ${((mostExpensiveChild[1].totalDuration / totalDurationMs) * 100).toFixed(1)}%)`);

    console.log(`\n--- RackLayer Render Events ---`);
    if (rackLayerEvents && rackLayerEvents.events.length > 0) {
      console.log(`RackLayer rendered ${rackLayerEvents.events.length} times`);
      console.log(`Renders with changed refs:`);
      for (let i = 0; i < Math.min(5, rackLayerEvents.events.length); i++) {
        const event = rackLayerEvents.events[i];
        const changedRefKeys = event.changedKeys.filter(k => k.includes('_id'));
        console.log(`  #${event.renderIndex}: ${changedRefKeys.join(', ') || '(no ref changes)'}`);
      }
    }

    console.log('\n========================================\n');
  },

  testDisabled() {
    // Test that profiling is off when diagnostics disabled
    if (window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__) {
      window.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__.enabled = false;
    }
    window.__WOS_RACK_LAYER_CHILD_PROFILING__ = undefined;

    console.log('[WOS] ✓ Disabled diagnostics for gating test');
    console.log('[WOS] Navigate and observe that no metrics are collected');
    console.log('[WOS] Then verify: WOS_DIAGNOSTICS.checkDisabledGating()');
  },

  checkDisabledGating() {
    const profiling = window.__WOS_RACK_LAYER_CHILD_PROFILING__;
    if (!profiling || Object.keys(profiling.childMetrics || {}).length === 0) {
      console.log('✓ CONFIRMED: Child profiling is gated and disabled when diagnostics are off');
    } else {
      console.warn('✗ ISSUE: Child profiling still recording when it should be disabled');
    }
  }
};

console.log('[WOS] Diagnostic helper loaded. Call WOS_DIAGNOSTICS.enableDiagnostics() to start.');
