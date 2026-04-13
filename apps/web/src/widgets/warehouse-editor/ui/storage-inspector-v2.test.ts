import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace } from '@wos/domain';
import { StorageInspectorV2, resolvePanelMode } from './storage-inspector-v2';
import { resetStorageFocusStore, useStorageFocusStore } from '@/widgets/warehouse-editor/model/v2/storage-focus-store';

type MockCell = {
  id: string;
  rackId: string;
  address: {
    raw: string;
    parts: { level: number };
  };
};

type MockStorageRow = {
  locationCode?: string | null;
  locationType?: string | null;
  containerId: string;
  containerStatus: string;
  systemCode?: string;
  externalCode?: string | null;
  containerType?: string;
  itemRef?: string | null;
  quantity?: number | null;
  uom?: string | null;
  product?: { sku?: string; name?: string } | null;
};

let mockPublishedCells: MockCell[] = [];
let mockLocationRef: { locationId: string } | null = null;
let mockStorageRows: MockStorageRow[] = [];

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => ({
    data: mockPublishedCells,
    isLoading: false,
  })
}));

vi.mock('@/entities/location/api/use-location-by-cell', () => ({
  useLocationByCell: () => ({
    data: mockLocationRef,
    isLoading: false,
  })
}));

vi.mock('@/entities/location/api/use-location-storage', () => ({
  useLocationStorage: () => ({
    data: mockStorageRows,
    isLoading: false,
  })
}));

type MockRackInspectorPayload = {
  rackId: string;
  displayCode: string;
  kind: string;
  axis: string;
  totalLevels: number;
  totalCells: number;
  levels: Array<{ levelOrdinal: number; totalCells: number; occupiedCells: number; emptyCells: number }>;
  occupancySummary: { totalCells: number; occupiedCells: number; emptyCells: number; occupancyRate: number };
};

let mockRackInspectorData: MockRackInspectorPayload | null = null;
let mockRackInspectorLoading = false;

vi.mock('@/entities/rack/api/use-rack-inspector', () => ({
  useRackInspector: () => ({
    data: mockRackInspectorData,
    isLoading: mockRackInspectorLoading,
    isError: false,
  })
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createWorkspace(): FloorWorkspace {
  return {
    floorId: 'floor-1',
    activeDraft: null,
    latestPublished: {
      floorId: 'floor-1',
      layoutVersionId: 'layout-1',
      draftVersion: 1,
      versionNo: 1,
      state: 'published',
      zoneIds: [],
      zones: {},
      wallIds: [],
      walls: {},
      rackIds: ['rack-1'],
      racks: {
        'rack-1': {
          id: 'rack-1',
          displayCode: 'R-01',
          kind: 'single',
          axis: 'NS',
          x: 0,
          y: 0,
          totalLength: 5,
          depth: 1,
          rotationDeg: 0,
          faces: []
        }
      }
    }
  } as unknown as FloorWorkspace;
}

function renderInspector(workspace: FloorWorkspace) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(StorageInspectorV2, { workspace }));
  });
  return renderer;
}

function flattenText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (node === null) return '';
  if (Array.isArray(node)) return node.map((child) => flattenText(child)).join('');
  const own = (node.children ?? [])
    .map((child) => (typeof child === 'string' ? child : flattenText(child)))
    .join('');
  return own;
}

// ── resolvePanelMode — pure function tests ────────────────────────────────────

describe('resolvePanelMode', () => {
  it('returns empty when rackId, cellId, and containerId are all null', () => {
    expect(resolvePanelMode(null, null, null)).toEqual({ kind: 'empty' });
  });

  it('returns rack-overview when rackId is set and cellId is null', () => {
    expect(resolvePanelMode('rack-1', null, null)).toEqual({ kind: 'rack-overview', rackId: 'rack-1' });
  });

  it('returns rack-overview even when containerId is set but cellId is null', () => {
    // containerId is local to the cell panel; without cellId it has no effect
    expect(resolvePanelMode('rack-1', null, 'c-1')).toEqual({ kind: 'rack-overview', rackId: 'rack-1' });
  });

  it('returns cell-overview when cellId is set and containerId is null', () => {
    expect(resolvePanelMode('rack-1', 'cell-1', null)).toEqual({ kind: 'cell-overview', cellId: 'cell-1' });
  });

  it('returns cell-overview when cellId is set and rackId is null', () => {
    expect(resolvePanelMode(null, 'cell-1', null)).toEqual({ kind: 'cell-overview', cellId: 'cell-1' });
  });

  it('returns container-detail when both cellId and containerId are set', () => {
    expect(resolvePanelMode('rack-1', 'cell-1', 'c-1')).toEqual({
      kind: 'container-detail',
      cellId: 'cell-1',
      containerId: 'c-1',
    });
  });

  it('container-detail takes priority over cell-overview', () => {
    const mode = resolvePanelMode(null, 'cell-1', 'c-1');
    expect(mode.kind).toBe('container-detail');
  });
});

// ── Breadcrumb fallbacks ───────────────────────────────────────────────────────

describe('StorageInspectorV2 breadcrumb fallbacks', () => {
  beforeEach(() => {
    resetStorageFocusStore();
    mockPublishedCells = [
      {
        id: 'cell-1',
        rackId: 'rack-1',
        address: { raw: '01-A.01.01', parts: { level: 1 } }
      }
    ];
    mockLocationRef = { locationId: 'loc-1' };
    mockStorageRows = [
      {
        locationCode: 'LOC-SEM-01',
        locationType: 'rack_slot',
        containerId: 'container-1',
        containerStatus: 'stored',
        systemCode: 'C-001',
        externalCode: null,
        containerType: 'pallet',
      }
    ];
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1
      });
    });
  });

  afterEach(() => {
    resetStorageFocusStore();
  });

  it('uses locationCode when available', () => {
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());

    expect(text).toContain('R-01');
    expect(text).toContain('Level 1');
    expect(text).toContain('LOC-SEM-01');
  });

  it('falls back to semantic cell address when locationCode is missing', () => {
    mockStorageRows = [
      {
        locationCode: null,
        locationType: 'rack_slot',
        containerId: 'container-1',
        containerStatus: 'stored',
        systemCode: 'C-001',
        externalCode: null,
        containerType: 'pallet',
      }
    ];
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());

    expect(text).toContain('01-A.01.01');
  });

  it('falls back to raw cellId only as the last resort', () => {
    mockPublishedCells = [];
    mockStorageRows = [
      {
        locationCode: null,
        locationType: 'rack_slot',
        containerId: 'container-1',
        containerStatus: 'stored',
        systemCode: 'C-001',
        externalCode: null,
        containerType: 'pallet',
      }
    ];
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());

    expect(text).toContain('cell-1');
  });

  it('reads selectedCellId/selectedRackId/activeLevel from focus store for breadcrumb context', () => {
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 3
      });
    });
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());

    expect(text).toContain('R-01');
    expect(text).toContain('Level 3');
    expect(text).toContain('LOC-SEM-01');
  });
});

// ── Panel mode integration tests ──────────────────────────────────────────────

describe('StorageInspectorV2 panel modes', () => {
  beforeEach(() => {
    resetStorageFocusStore();
    mockPublishedCells = [];
    mockLocationRef = null;
    mockStorageRows = [];
    mockRackInspectorData = {
      rackId: 'rack-1',
      displayCode: 'R-01',
      kind: 'single',
      axis: 'NS',
      totalLevels: 2,
      totalCells: 4,
      levels: [
        { levelOrdinal: 1, totalCells: 2, occupiedCells: 1, emptyCells: 1 },
        { levelOrdinal: 2, totalCells: 2, occupiedCells: 0, emptyCells: 2 },
      ],
      occupancySummary: { totalCells: 4, occupiedCells: 1, emptyCells: 3, occupancyRate: 0.25 },
    };
    mockRackInspectorLoading = false;
  });

  afterEach(() => {
    resetStorageFocusStore();
    mockRackInspectorData = null;
    mockRackInspectorLoading = false;
  });

  it('shows empty state when neither cellId nor rackId is set', () => {
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('No location selected');
  });

  it('shows rack-overview when rackId is set but cellId is null', () => {
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('R-01');
    expect(text).not.toContain('No location selected');
  });

  it('shows cell-overview (not rack-overview) when cellId is set', () => {
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1,
      });
    });
    mockPublishedCells = [
      { id: 'cell-1', rackId: 'rack-1', address: { raw: '01-A.01.01', parts: { level: 1 } } }
    ];
    mockLocationRef = { locationId: 'loc-1' };
    mockStorageRows = [];
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());
    // Shows cell-overview breadcrumb elements
    expect(text).toContain('01-A.01.01');
    // Does NOT show rack-overview occupancy/levels sections
    expect(text).not.toContain('1 / 4 cells occupied');
  });

  it('rack-overview and cell-overview do not render simultaneously', () => {
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1,
      });
    });
    mockLocationRef = { locationId: 'loc-1' };
    mockStorageRows = [];
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());

    const hasRackOccupancy = text.includes('cells occupied');
    const hasLevelsSection = text.includes('L1:');
    expect(hasRackOccupancy).toBe(false);
    expect(hasLevelsSection).toBe(false);
  });

  it('rack-overview shows occupancy rate and levels breakdown', () => {
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('25%');
    expect(text).toContain('1 / 4 cells occupied');
    expect(text).toContain('L1:');
    expect(text).toContain('1/2');
    expect(text).toContain('L2:');
    expect(text).toContain('0/2');
  });

  it('opens container-detail when a container is clicked from cell-overview', () => {
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1,
      });
    });
    mockPublishedCells = [
      { id: 'cell-1', rackId: 'rack-1', address: { raw: '01-A.01.01', parts: { level: 1 } } }
    ];
    mockLocationRef = { locationId: 'loc-1' };
    mockStorageRows = [
      {
        locationCode: 'LOC-01',
        locationType: 'rack_slot',
        containerId: 'c-1',
        containerStatus: 'stored',
        systemCode: 'C-001',
        externalCode: null,
        containerType: 'pallet',
        itemRef: null,
        quantity: null,
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(StorageInspectorV2, { workspace: createWorkspace() }));
    });

    // Should be in cell-overview — find the container button and click it
    const root = renderer.root;
    const containerButton = root.findByProps({ 'aria-label': 'View container C-001' });
    act(() => {
      containerButton.props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    // Should now be in container-detail — Back button visible, container data shown
    expect(text).toContain('← Back');
    expect(text).toContain('C-001');
    expect(text).toContain('Empty container');
  });

  it('back action from container-detail returns to cell-overview', () => {
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1,
      });
    });
    mockPublishedCells = [
      { id: 'cell-1', rackId: 'rack-1', address: { raw: '01-A.01.01', parts: { level: 1 } } }
    ];
    mockLocationRef = { locationId: 'loc-1' };
    mockStorageRows = [
      {
        locationCode: 'LOC-01',
        locationType: 'rack_slot',
        containerId: 'c-1',
        containerStatus: 'stored',
        systemCode: 'C-001',
        externalCode: null,
        containerType: 'pallet',
        itemRef: null,
        quantity: null,
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(StorageInspectorV2, { workspace: createWorkspace() }));
    });

    // Drill into container-detail
    const root = renderer.root;
    const containerButton = root.findByProps({ 'aria-label': 'View container C-001' });
    act(() => {
      containerButton.props.onClick();
    });

    // Now click Back
    const backButton = root.findByProps({ 'aria-label': 'Back to cell overview' });
    act(() => {
      backButton.props.onClick();
    });

    const text = flattenText(renderer.toJSON());
    // Should be back in cell-overview — no Back button, cell-overview sections visible
    // Breadcrumb shows locationCode ('LOC-01') which takes priority over cell address
    expect(text).not.toContain('← Back');
    expect(text).toContain('LOC-01');
    expect(text).toContain('Current Contents');
  });

  it('resets local container selection when selectedCellId changes to a different cell', () => {
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1,
      });
    });
    mockPublishedCells = [
      { id: 'cell-1', rackId: 'rack-1', address: { raw: '01-A.01.01', parts: { level: 1 } } },
      { id: 'cell-2', rackId: 'rack-1', address: { raw: '01-A.01.02', parts: { level: 1 } } },
    ];
    mockLocationRef = { locationId: 'loc-1' };
    mockStorageRows = [
      {
        locationCode: 'LOC-01',
        locationType: 'rack_slot',
        containerId: 'c-1',
        containerStatus: 'stored',
        systemCode: 'C-001',
        externalCode: null,
        containerType: 'pallet',
        itemRef: null,
        quantity: null,
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(StorageInspectorV2, { workspace: createWorkspace() }));
    });

    // Drill into container-detail
    const root = renderer.root;
    const containerButton = root.findByProps({ 'aria-label': 'View container C-001' });
    act(() => {
      containerButton.props.onClick();
    });

    // Verify we're in container-detail
    expect(flattenText(renderer.toJSON())).toContain('← Back');

    // Now change the selected cell (simulates user clicking a different cell)
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-2',
        rackId: 'rack-1',
        level: 1,
      });
    });

    // container-detail should be gone, back to cell-overview for the new cell
    const text = flattenText(renderer.toJSON());
    expect(text).not.toContain('← Back');
  });

  it('resets local container selection when selectedCellId clears', () => {
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1,
      });
    });
    mockPublishedCells = [
      { id: 'cell-1', rackId: 'rack-1', address: { raw: '01-A.01.01', parts: { level: 1 } } }
    ];
    mockLocationRef = { locationId: 'loc-1' };
    mockStorageRows = [
      {
        locationCode: 'LOC-01',
        locationType: 'rack_slot',
        containerId: 'c-1',
        containerStatus: 'stored',
        systemCode: 'C-001',
        externalCode: null,
        containerType: 'pallet',
        itemRef: null,
        quantity: null,
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(StorageInspectorV2, { workspace: createWorkspace() }));
    });

    // Drill into container-detail
    const root = renderer.root;
    const containerButton = root.findByProps({ 'aria-label': 'View container C-001' });
    act(() => {
      containerButton.props.onClick();
    });

    expect(flattenText(renderer.toJSON())).toContain('← Back');

    // Clear cell selection (keeps rack selected)
    act(() => {
      useStorageFocusStore.getState().clearCell();
    });

    // Should now show rack-overview (cellId gone → containerId reset → rack-overview)
    const text = flattenText(renderer.toJSON());
    expect(text).not.toContain('← Back');
    expect(text).toContain('R-01');
    expect(text).not.toContain('No location selected');
  });
});
