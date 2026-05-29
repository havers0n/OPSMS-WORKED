/**
 * Focused one-shot diagnostic: capture the per-render sequence for RackLayer
 * during route-preview startup and report which snapshot keys actually change
 * between mount and update#1.
 *
 * This test is intentionally report-only (no budget assertions) and is meant
 * to be run once to produce the attribution data requested.
 */

import { test, expect, type Page } from '@playwright/test';
import { signInToWarehouse } from '../support/auth';
import {
  resetWarehouseData,
  seedExplicitDraftScenario
} from '../support/local-supabase';
import { buildDemoWarehouseRackPayloads } from '../support/demo-warehouse-layout';

type RenderEvent = {
  renderIndex: number;
  snapshot: Record<string, unknown>;
  changedKeys: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function armRackLayerRenderEvents(page: Page) {
  await page.evaluate(() => {
    const g = window as unknown as Record<string, unknown>;

    // Replicate the minimal diagnostics object that recordCanvasComponentRender needs.
    // We create it from scratch so no prior state bleeds in.
    const createComponentMetrics = () => ({
      renders: 0,
      causes: { stateUpdates: 0, propsChanges: 0, parentRerenders: 0 },
      changedKeys: {}
    });

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
      components: {
        EditorCanvas: createComponentMetrics(),
        CellStateOverlayLayer: createComponentMetrics(),
        RackBody: createComponentMetrics(),
        RackLayer: createComponentMetrics(),
        RackCells: createComponentMetrics(),
        SelectionOverlayLayer: createComponentMetrics(),
        StorageNavigator: createComponentMetrics(),
        StorageInspectorV2: createComponentMetrics()
      },
      mode: {
        active: 'unknown',
        counts: { view: 0, storage: 0, layout: 0, unknown: 0 }
      },
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
    };

    g['__WOS_CANVAS_RENDER_PIPELINE_PREV_SNAPSHOTS__'] = {};
    // The per-render event store that canvas-diagnostics.ts now writes into.
    g['__WOS_RACK_LAYER_RENDER_EVENTS__'] = { events: [] };
  });
}

async function readRackLayerRenderEvents(page: Page): Promise<RenderEvent[]> {
  return page.evaluate(() => {
    const g = window as unknown as {
      __WOS_RACK_LAYER_RENDER_EVENTS__?: { events: RenderEvent[] };
    };
    return g.__WOS_RACK_LAYER_RENDER_EVENTS__?.events ?? [];
  });
}

async function waitForCanvasStable(page: Page, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible({
    timeout: timeoutMs
  });

  // Poll until the canvas stops redrawing (two consecutive identical pixel hashes).
  let prevHash: string | null = null;
  let stableCount = 0;

  while (Date.now() < deadline) {
    await page.waitForTimeout(400);

    const hash = await page.evaluate(() => {
      const canvas = document.querySelector(
        '.konvajs-content canvas'
      ) as HTMLCanvasElement | null;
      if (!canvas) return null;
      // Use a small centre sample to detect change without full-pixel cost.
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const cx = Math.floor(canvas.width / 2);
      const cy = Math.floor(canvas.height / 2);
      const px = ctx.getImageData(cx, cy, 4, 4).data;
      return Array.from(px).join(',');
    });

    if (hash !== null && hash === prevHash) {
      stableCount += 1;
      if (stableCount >= 2) return;
    } else {
      stableCount = 0;
    }
    prevHash = hash;
  }
  throw new Error('Canvas did not stabilise within timeout');
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('report RackLayer per-render attribution during route-preview startup', async ({
  page
}) => {
  // ---------- Seed ----------
  await resetWarehouseData();
  const rackPayloads = buildDemoWarehouseRackPayloads();
  const scenario = await seedExplicitDraftScenario({ racks: rackPayloads });
  const { floor, layoutVersionId } = scenario;

  // ---------- Sign in, land on /warehouse (no canvas yet) ----------
  await signInToWarehouse(page);
  await page.goto('/warehouse');
  await page.waitForLoadState('networkidle');

  // ---------- Arm diagnostics while SPA is idle (before navigation) ----------
  await armRackLayerRenderEvents(page);

  // ---------- Client-side route transition (mirrors route-preview scenario) ----------
  await page.evaluate((url) => {
    window.history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `/warehouse/view?floor=${floor.id}`);

  // ---------- Wait for canvas to be stable ----------
  await waitForCanvasStable(page);
  // Give async store updates a moment to settle.
  await page.waitForTimeout(800);

  // ---------- Read back render events ----------
  const events = await readRackLayerRenderEvents(page);

  // ---------- Report ----------
  console.log('\n======== RackLayer render attribution (route-preview) ========');
  console.log(`Total RackLayer renders: ${events.length}`);
  console.log(`Floor: ${floor.id}  LayoutVersion: ${layoutVersionId}`);
  console.log('');

  const ID_KEYS = [
    'racks_id',
    'cellRuntimeById_id',
    'occupiedCellIds_id',
    'publishedCellsByStructure_id',
    'publishedCellsById_id'
  ] as const;

  for (const ev of events) {
    const isMountLabel = ev.renderIndex === 1 ? ' [MOUNT]' : '';
    const changedLabel =
      ev.changedKeys.length === 0
        ? '(no snapshot changes)'
        : ev.changedKeys.map((k) => `${k}=${String(ev.snapshot[k]).slice(0, 60)}`).join(', ');
    console.log(`  render#${ev.renderIndex}${isMountLabel}: changedKeys=[${ev.changedKeys.join(', ')}]`);
    console.log(`    rackIds="${ev.snapshot['rackIds']}"`);
    // Print ref-identity tokens so we know which array/Map/Set changed reference.
    const idLine = ID_KEYS.map(
      (k) => `${k}=${ev.snapshot[k]}`
    ).join('  ');
    console.log(`    ref-ids: ${idLine}`);
    if (ev.changedKeys.length > 0) {
      console.log(`    changed values: ${changedLabel}`);
    }
  }

  if (events.length >= 2) {
    const mount   = events[0]!;
    const update1 = events[1]!;
    const mountRackIds   = mount.snapshot['rackIds']   as string;
    const update1RackIds = update1.snapshot['rackIds'] as string;
    const rackIdsIdentical = mountRackIds === update1RackIds;

    console.log('\n------- mount vs update#1 comparison -------');
    console.log(`  mount   rackIds : "${mountRackIds}"`);
    console.log(`  update#1 rackIds: "${update1RackIds}"`);
    console.log(`  rackIds identical: ${rackIdsIdentical}`);

    // Show which ref-identity tokens changed between every consecutive render.
    console.log('\n------- ref-identity deltas per render -------');
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1]!;
      const curr = events[i]!;
      const changed = ID_KEYS.filter(
        (k) => prev.snapshot[k] !== curr.snapshot[k]
      );
      const label = changed.length === 0 ? '(no ref changes)' : changed.join(', ');
      console.log(`  render#${prev.renderIndex}→render#${curr.renderIndex}: ${label}`);
    }

    if (rackIdsIdentical) {
      console.log('\n  VERDICT: update#1 rackIds STRING is unchanged.');
      console.log('  This is array identity churn — the visible rack set did NOT change.');

      const changed1 = update1.changedKeys;
      const refChanges1 = ID_KEYS.filter(
        (k) => mount.snapshot[k] !== update1.snapshot[k]
      );
      if (changed1.length > 0) {
        console.log(`  changedKeys in update#1: [${changed1.join(', ')}]`);
      }
      if (refChanges1.length > 0) {
        console.log(`  ref-identity changes in update#1: [${refChanges1.join(', ')}]`);
        console.log('  → These are the exact props whose array/Map/Set reference changed.');
      }
      if (changed1.length === 0 && refChanges1.length === 0) {
        console.log('  No snapshot changes at all — update#1 may be a parent re-render with no prop change.');
      }
    } else {
      console.log('\n  VERDICT: update#1 rackIds STRING changed.');
      console.log('  This is a REAL viewport/culling change — different racks became visible.');
      console.log('  Do not stabilize; update#1 is legitimate.');
    }

    expect(events.length).toBeGreaterThanOrEqual(1);
  } else {
    console.log('\nWARNING: fewer than 2 render events captured.');
    expect(events.length).toBeGreaterThanOrEqual(1);
  }
});
