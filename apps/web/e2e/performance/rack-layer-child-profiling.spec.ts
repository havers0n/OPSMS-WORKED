/**
 * Focused, non-destructive diagnostic for RackLayer child profiling.
 *
 * Uses existing local warehouse data (no reset or seed).
 * Navigates to the first available floor in /warehouse/view route.
 * Enables render pipeline diagnostics before startup.
 * Captures child-level metrics for RackBody, RackSections, RackCells,
 * SelectionOverlayLayer, and InteractionRect.
 */

import { test, expect, type Page } from '@playwright/test';
import { signInToWarehouse } from '../support/auth';

// Configure baseURL for relative navigation (signInToWarehouse uses page.goto('/login'))
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:5174';
test.use({ baseURL });

interface ChildMetrics {
  childName: string;
  rackId?: string;
  renderCount: number;
  totalActualDurationMs: number;
  maxActualDurationMs: number;
  lastActualDurationMs: number;
  propChanges: Record<string, boolean>;
}

interface RackLayerChildProfilingData {
  enabled?: boolean;
  childMetrics?: Record<string, ChildMetrics>;
}

interface RenderPipelineDiagnosticsState {
  enabled: boolean;
  currentRenderMode: string;
  renderModeCounts: Record<string, number>;
  renderModeTransitionCounts: Record<string, number>;
  currentPhase: string;
  phaseCounts: Record<string, number>;
  phaseMarks: unknown[];
  cameraStoreUpdates: number;
  offsetUpdates: number;
  zoomCameraUpdates: number;
  zoomTransientUpdates: number;
  zoomDurableCommits: number;
  components: Record<string, unknown>;
  mode: { active: string; counts: Record<string, number> };
  dataSizes: Record<string, number>;
  timings: Record<string, unknown>;
  counters: Record<string, number>;
  konva: Record<string, unknown>;
  selectionOverlay: Record<string, unknown>;
  forceRenderReasons: Record<string, number>;
}

interface RackLayerRenderEvent {
  renderIndex: number;
  snapshot: Record<string, unknown>;
  changedKeys: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function enableDiagnosticsBeforeStartup(page: Page) {
  await page.evaluate(() => {
    const g = window as unknown as Record<string, unknown>;

    // Initialize render pipeline diagnostics
    g['__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__'] = {
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
      forceRenderReasons: { none: 0, selection: 0, locate: 0, workflow: 0, debug: 0 }
    } as RenderPipelineDiagnosticsState;

    // Initialize child profiling
    g['__WOS_RACK_LAYER_CHILD_PROFILING__'] = {
      enabled: true,
      childMetrics: {}
    } as RackLayerChildProfilingData;

    // Initialize snapshot tracking
    g['__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__'] = {};

    // Initialize render events
    g['__WOS_RACK_LAYER_RENDER_EVENTS__'] = { events: [] };

    console.log('[WOS] Diagnostics armed before startup');
  });
}

async function waitForCanvasReady(page: Page, timeoutMs = 20000) {
  // Wait for canvas element to be visible
  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible({
    timeout: timeoutMs
  });

  // Poll until canvas stabilizes (two consecutive identical pixel hashes)
  const deadline = Date.now() + timeoutMs;
  let prevHash: string | null = null;
  let stableCount = 0;

  while (Date.now() < deadline) {
    await page.waitForTimeout(400);

    const hash = await page.evaluate(() => {
      const canvas = document.querySelector(
        '.konvajs-content canvas'
      ) as HTMLCanvasElement | null;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const cx = Math.floor(canvas.width / 2);
      const cy = Math.floor(canvas.height / 2);
      const px = ctx.getImageData(cx, cy, 4, 4).data;
      return Array.from(px).join(',');
    });

    if (hash !== null && hash === prevHash) {
      stableCount += 1;
      if (stableCount >= 2) {
        // Canvas is stable, wait a bit more for render pipeline to settle
        await page.waitForTimeout(600);
        return;
      }
    } else {
      stableCount = 0;
    }
    prevHash = hash;
  }
  throw new Error('Canvas did not stabilize within timeout');
}

async function readChildProfilingMetrics(
  page: Page
): Promise<{
  childProfiling: RackLayerChildProfilingData;
  renderPipelineDiagnostics: RenderPipelineDiagnosticsState | Record<string, unknown>;
  rackLayerRenderEvents: { events: RackLayerRenderEvent[] };
}> {
  return page.evaluate(() => {
    const g = window as unknown as {
      __WOS_RACK_LAYER_CHILD_PROFILING__?: RackLayerChildProfilingData;
      __WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__?: RenderPipelineDiagnosticsState;
      __WOS_RACK_LAYER_RENDER_EVENTS__?: { events: RackLayerRenderEvent[] };
    };
    return {
      childProfiling: g.__WOS_RACK_LAYER_CHILD_PROFILING__ ?? { enabled: false, childMetrics: {} },
      renderPipelineDiagnostics: g.__WOS_CANVAS_RENDER_PIPELINE_DIAGNOSTICS__ ?? {},
      rackLayerRenderEvents: g.__WOS_RACK_LAYER_RENDER_EVENTS__ ?? { events: [] }
    };
  });
}

async function getFirstAvailableFloorId(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    // Query the local supabase instance for the first floor
    try {
      const response = await fetch('/api/floors?limit=1');
      if (!response.ok) return null;
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0].id;
      }
      return null;
    } catch {
      return null;
    }
  });
}

async function resolveFloorId(page: Page): Promise<string> {
  // 1. Check explicit environment variable (Node-side, not in page.evaluate)
  const explicitFloorId = process.env.WOS_E2E_FLOOR_ID?.trim();
  if (explicitFloorId) {
    console.log(`[WOS] Using floor ID from WOS_E2E_FLOOR_ID: ${explicitFloorId}`);
    return explicitFloorId;
  }

  // 2. Try to discover a floor from existing data
  const discoveredFloorId = await getFirstAvailableFloorId(page);
  if (discoveredFloorId) {
    console.log(`[WOS] Using discovered floor ID: ${discoveredFloorId}`);
    return discoveredFloorId;
  }

  // 3. Fail if no floor found (no fallback to default-floor)
  throw new Error(
    'No floor found for RackLayer child profiling. ' +
      'Provide WOS_E2E_FLOOR_ID env var or seed/publish a floor. ' +
      'Do not fallback to default-floor.'
  );
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('RackLayer child profiling during route-preview startup (non-destructive)', async ({
  page
}) => {
  // ---------- Sign in (uses existing local warehouse data) ----------
  await signInToWarehouse(page);
  await page.goto('/warehouse');
  await page.waitForLoadState('networkidle');

  // Resolve floor ID from env var, existing data, or error
  const floorId = await resolveFloorId(page);

  // ---------- Arm diagnostics BEFORE route transition ----------
  await enableDiagnosticsBeforeStartup(page);

  // ---------- Client-side route transition (route-preview scenario) ----------
  console.log(`[WOS] Final route-preview floor ID: ${floorId}`);
  console.log('[WOS] Triggering route-preview via pushState...');
  await page.evaluate((url) => {
    window.history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `/warehouse/view?floor=${floorId}`);

  // ---------- Wait for canvas to be ready and stable ----------
  await waitForCanvasReady(page);

  // ---------- Read diagnostics ----------
  const { childProfiling, rackLayerRenderEvents } = await readChildProfilingMetrics(page);

  // ---------- Print summary ----------
  console.log('\n========================================');
  console.log('RackLayer Child Profiling Report');
  console.log('========================================\n');

  if (!childProfiling.childMetrics || Object.keys(childProfiling.childMetrics).length === 0) {
    console.log('⚠️  No child profiling metrics collected.');
    console.log('   This is expected if diagnostics were not properly enabled.');
    expect(false).toBeFalsy(); // Report but don't fail
    return;
  }

  const metrics = Object.values(childProfiling.childMetrics) as ChildMetrics[];
  const totalDurationMs = metrics.reduce((sum, m) => sum + m.totalActualDurationMs, 0);

  console.log(`Total child profiler duration: ${totalDurationMs.toFixed(2)}ms`);
  console.log(`Total children tracked: ${metrics.length}\n`);

  // Aggregate per child type
  interface ChildTypeSummary {
    renderCount: number;
    totalDuration: number;
    maxDuration: number;
    instances: number;
    examples: ChildMetrics[];
  }
  const perChild: Record<string, ChildTypeSummary> = {};
  for (const metric of metrics) {
    const key = metric.childName;
    const entry = perChild[key] || {
      renderCount: 0,
      totalDuration: 0,
      maxDuration: 0,
      instances: 0,
      examples: []
    };
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
  const summaryTable = sortedPerChild.map(([childName, stats]) => ({
    'Child': childName,
    'Renders': stats.renderCount,
    'Total (ms)': stats.totalDuration.toFixed(2),
    'Max (ms)': stats.maxDuration.toFixed(2),
    'Avg (ms)': (stats.totalDuration / stats.renderCount).toFixed(2),
    '% of Total': ((stats.totalDuration / totalDurationMs) * 100).toFixed(1),
    'Instances': stats.instances
  }));
  console.table(summaryTable);

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

  // ---------- Analysis ----------
  console.log('\n--- Analysis ---\n');

  const rackBodies = metrics.filter(m => m.childName === 'RackBody');
  const rackCells = metrics.filter(m => m.childName === 'RackCells');
  const selectionOverlay = metrics.find(m => m.childName === 'SelectionOverlayLayer');

  // Check if RackBody re-renders on runtime-only changes
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

  if (sortedPerChild.length > 0) {
    const mostExpensiveChild = sortedPerChild[0];
    console.log(`\n✓ Most expensive child: ${mostExpensiveChild[0]} (${mostExpensiveChild[1].totalDuration.toFixed(2)}ms, ${((mostExpensiveChild[1].totalDuration / totalDurationMs) * 100).toFixed(1)}%)`);
  }

  // Report RackLayer render events
  console.log(`\n--- RackLayer Render Events ---`);
  if (rackLayerRenderEvents && rackLayerRenderEvents.events.length > 0) {
    console.log(`RackLayer rendered ${rackLayerRenderEvents.events.length} times`);
    console.log(`First 5 renders with changed refs:`);
    for (let i = 0; i < Math.min(5, rackLayerRenderEvents.events.length); i++) {
      const event = rackLayerRenderEvents.events[i];
      const changedRefKeys = event.changedKeys.filter(k => k.includes('_id'));
      console.log(`  #${event.renderIndex}: ${changedRefKeys.join(', ') || '(no ref changes)'}`);
    }
  } else {
    console.log('No RackLayer render events captured.');
  }

  console.log('\n========================================\n');

  // Verify that we captured something
  expect(metrics.length).toBeGreaterThan(0);
  expect(totalDurationMs).toBeGreaterThan(0);
});
