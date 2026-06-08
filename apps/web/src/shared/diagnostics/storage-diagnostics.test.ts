// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStorageBreadcrumbs,
  getOrCreateSessionId,
  getStorageBreadcrumbs,
  isStorageHeartbeatRunning,
  parseStorageDebugFlags,
  recordStorageBreadcrumb,
  resetSessionId,
  startStorageHeartbeat,
  stopStorageHeartbeat
} from './storage-diagnostics';

describe('parseStorageDebugFlags', () => {
  it('returns all false for empty search', () => {
    const flags = parseStorageDebugFlags('');
    expect(flags).toEqual({
      disableRackLayer: false,
      disableCanvasSceneData: false,
      disableOccupancyOverlay: false,
      disableNavigator: false,
      disableInspector: false,
      disableStorageData: false,
      disableRackBodies: false,
      disableRackBodyShadows: false,
      simpleRackBodyShell: false,
      disableRackBodyLabels: false,
      disableRackBodyStrokes: false
    });
  });

  it('returns all false for search without debug flags', () => {
    const flags = parseStorageDebugFlags('?floor=abc&cell=def');
    expect(flags).toEqual({
      disableRackLayer: false,
      disableCanvasSceneData: false,
      disableOccupancyOverlay: false,
      disableNavigator: false,
      disableInspector: false,
      disableStorageData: false,
      disableRackBodies: false,
      disableRackBodyShadows: false,
      simpleRackBodyShell: false,
      disableRackBodyLabels: false,
      disableRackBodyStrokes: false
    });
  });

  it('parses single flag', () => {
    const flags = parseStorageDebugFlags('?disableNavigator=1');
    expect(flags).toEqual({
      disableRackLayer: false,
      disableCanvasSceneData: false,
      disableOccupancyOverlay: false,
      disableNavigator: true,
      disableInspector: false,
      disableStorageData: false,
      disableRackBodies: false,
      disableRackBodyShadows: false,
      simpleRackBodyShell: false,
      disableRackBodyLabels: false,
      disableRackBodyStrokes: false
    });
  });

  it('parses multiple flags', () => {
    const flags = parseStorageDebugFlags('?disableNavigator=1&disableInspector=1&disableStorageData=1');
    expect(flags).toEqual({
      disableRackLayer: false,
      disableCanvasSceneData: false,
      disableOccupancyOverlay: false,
      disableNavigator: true,
      disableInspector: true,
      disableStorageData: true,
      disableRackBodies: false,
      disableRackBodyShadows: false,
      simpleRackBodyShell: false,
      disableRackBodyLabels: false,
      disableRackBodyStrokes: false
    });
  });

  it('parses all flags simultaneously', () => {
    const flags = parseStorageDebugFlags(
      '?disableOccupancyOverlay=1&disableNavigator=1&disableInspector=1&disableStorageData=1'
    );
    expect(flags).toEqual({
      disableRackLayer: false,
      disableCanvasSceneData: false,
      disableOccupancyOverlay: true,
      disableNavigator: true,
      disableInspector: true,
      disableStorageData: true,
      disableRackBodies: false,
      disableRackBodyShadows: false,
      simpleRackBodyShell: false,
      disableRackBodyLabels: false,
      disableRackBodyStrokes: false
    });
  });

  it('ignores non-1 values', () => {
    const flags = parseStorageDebugFlags('?disableNavigator=true&disableInspector=0');
    expect(flags).toEqual({
      disableRackLayer: false,
      disableCanvasSceneData: false,
      disableOccupancyOverlay: false,
      disableNavigator: false,
      disableInspector: false,
      disableStorageData: false,
      disableRackBodies: false,
      disableRackBodyShadows: false,
      simpleRackBodyShell: false,
      disableRackBodyLabels: false,
      disableRackBodyStrokes: false
    });
  });

  it('coexists with debug=1', () => {
    const flags = parseStorageDebugFlags('?debug=1&disableStorageData=1');
    expect(flags.disableStorageData).toBe(true);
  });
});

describe('breadcrumbs', () => {
  beforeEach(() => {
    clearStorageBreadcrumbs();
  });

  it('records and retrieves breadcrumbs', () => {
    recordStorageBreadcrumb('storage-mode-entered', { floorId: 'f1' });

    const crumbs = getStorageBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].name).toBe('storage-mode-entered');
    expect(crumbs[0].data?.floorId).toBe('f1');
    expect(crumbs[0].timestamp).toBeTruthy();
  });

  it('records multiple breadcrumbs in reverse order', () => {
    recordStorageBreadcrumb('storage-mode-entered');
    recordStorageBreadcrumb('navigator-mounted');

    const crumbs = getStorageBreadcrumbs();
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].name).toBe('navigator-mounted');
    expect(crumbs[1].name).toBe('storage-mode-entered');
  });

  it('clears breadcrumbs', () => {
    recordStorageBreadcrumb('storage-mode-entered');
    clearStorageBreadcrumbs();

    expect(getStorageBreadcrumbs()).toHaveLength(0);
  });

  it('caps breadcrumbs at 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      recordStorageBreadcrumb('inspector-mounted', { index: i });
    }

    expect(getStorageBreadcrumbs()).toHaveLength(20);
  });
});

describe('sessionId', () => {
  beforeEach(() => {
    resetSessionId();
  });

  it('generates a valid UUID', () => {
    const id = getOrCreateSessionId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('returns the same ID on repeated calls', () => {
    const first = getOrCreateSessionId();
    const second = getOrCreateSessionId();
    expect(second).toBe(first);
  });

  it('generates a new ID after reset', () => {
    const first = getOrCreateSessionId();
    resetSessionId();
    const second = getOrCreateSessionId();
    expect(second).not.toBe(first);
  });
});

describe('heartbeat', () => {
  beforeEach(() => {
    stopStorageHeartbeat();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopStorageHeartbeat();
    vi.useRealTimers();
  });

  it('does not start without explicit call', () => {
    expect(isStorageHeartbeatRunning()).toBe(false);
  });

  it('starts and stops', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));

    startStorageHeartbeat({
      getRoute: () => '/warehouse/view?debug=1',
      getActiveWarehouseMode: () => 'storage',
      getFloorId: () => 'f1',
      getPublishedCellCount: () => 42,
      getOccupancyRowCount: () => 10,
      getNavigatorItemCount: () => 5,
      getDebugFlags: () => parseStorageDebugFlags('?debug=1')
    });

    expect(isStorageHeartbeatRunning()).toBe(true);

    // Immediate send on start, plus one after the interval
    vi.advanceTimersByTime(2000);

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const callArgs = fetchSpy.mock.calls[0]!;
    expect(callArgs[0]).toContain('/diagnostics/heartbeat');
    const body = JSON.parse((callArgs[1] as RequestInit).body as string);
    // Sequence 1 is the immediate send, 2 is the interval send
    expect(body.sequence).toBeGreaterThanOrEqual(1);
    expect(body.sequence).toBeLessThanOrEqual(2);
    expect(body.sessionId).toBeTruthy();
    expect(body.publishedCellCount).toBe(42);
    expect(body.occupancyRowCount).toBe(10);
    expect(body.navigatorItemCount).toBe(5);
    expect(body.route).toBe('/warehouse/view?debug=1');
    expect(body.activeWarehouseMode).toBe('storage');

    stopStorageHeartbeat();
    expect(isStorageHeartbeatRunning()).toBe(false);

    fetchSpy.mockRestore();
  });

  it('does not run without debug=1 (heartbeat only starts when called)', () => {
    expect(isStorageHeartbeatRunning()).toBe(false);
  });

  it('includes active debug flags in payload', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    const flags = parseStorageDebugFlags('?disableNavigator=1&disableStorageData=1');

    startStorageHeartbeat({
      getRoute: () => '/warehouse/view',
      getActiveWarehouseMode: () => 'storage',
      getFloorId: () => null,
      getPublishedCellCount: () => 0,
      getOccupancyRowCount: () => 0,
      getNavigatorItemCount: () => null,
      getDebugFlags: () => flags
    });

    vi.advanceTimersByTime(2000);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.activeDebugFlags).toEqual({
      disableRackLayer: false,
      disableCanvasSceneData: false,
      disableOccupancyOverlay: false,
      disableNavigator: true,
      disableInspector: false,
      disableStorageData: true,
      disableRackBodies: false,
      disableRackBodyShadows: false,
      simpleRackBodyShell: false,
      disableRackBodyLabels: false,
      disableRackBodyStrokes: false
    });

    fetchSpy.mockRestore();
  });

  it('includes rackLayerDiagnostics when getter is provided', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    const rackDiag = {
      renderedRackCount: 12,
      renderedCellCount: 48,
      rackBodyNodeCount: 12,
      rackCellNodeCount: 24,
      runtimeVisualNodeCount: 16,
      visibleRackCount: 12,
      statusCounts: { reserved: 2, pick_active: 0, occupied: 10, empty: 2, exception: 0, other: 0 },
      effectiveLod: 2 as const,
      hitTestEnabled: true,
      cacheEnabled: false,
      rackLayerMountCount: 1,
      rackLayerUnmountCount: 0,
      rackLayerDrawCount: 5
    };

    startStorageHeartbeat({
      getRoute: () => '/warehouse/view',
      getActiveWarehouseMode: () => 'storage',
      getFloorId: () => null,
      getPublishedCellCount: () => 0,
      getOccupancyRowCount: () => 0,
      getNavigatorItemCount: () => null,
      getDebugFlags: () => parseStorageDebugFlags(''),
      getRackLayerDiagnostics: () => rackDiag
    });

    vi.advanceTimersByTime(2000);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.rackLayerDiagnostics).toEqual(rackDiag);

    fetchSpy.mockRestore();
  });
});
