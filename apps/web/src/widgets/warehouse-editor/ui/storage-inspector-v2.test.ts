import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace } from '@wos/domain';
import { StorageInspectorV2 } from './storage-inspector-v2';
import { resetStorageFocusStore, useStorageFocusStore } from '@/widgets/warehouse-editor/model/v2/storage-focus-store';

type MockCell = {
  id: string;
  rackId: string;
  address: {
    raw: string;
    parts: { level: number };
  };
};

let mockPublishedCells: MockCell[] = [];
let mockLocationRef: { locationId: string } | null = null;
let mockStorageRows: Array<{ locationCode?: string | null; locationType?: string | null; containerId: string; containerStatus: string }> = [];

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
        containerStatus: 'stored'
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
        containerStatus: 'stored'
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
        containerStatus: 'stored'
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

describe('StorageInspectorV2 rack-summary integration (PR1)', () => {
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

  it('shows EmptyState when neither cellId nor rackId is set', () => {
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('No location selected');
  });

  it('shows RackSummary when rackId is set but cellId is null', () => {
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('R-01');
    expect(text).not.toContain('No location selected');
  });

  it('shows cell path (not RackSummary) when cellId is set', () => {
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
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());
    // Should show cell breadcrumb (includes rack code from breadcrumb context)
    expect(text).toContain('01-A.01.01');
    // Should NOT show the rack-summary occupancy/levels sections
    expect(text).not.toContain('1 / 4 cells occupied');
  });

  it('RackSummary shows occupancy rate', () => {
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('25%');
    expect(text).toContain('1 / 4 cells occupied');
  });

  it('RackSummary shows levels breakdown', () => {
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });
    const renderer = renderInspector(createWorkspace());
    const text = flattenText(renderer.toJSON());
    expect(text).toContain('L1:');
    expect(text).toContain('1/2');
    expect(text).toContain('L2:');
    expect(text).toContain('0/2');
  });
});
