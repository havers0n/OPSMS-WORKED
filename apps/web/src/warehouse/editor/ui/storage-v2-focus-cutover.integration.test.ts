import { createElement, Fragment } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace } from '@wos/domain';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StorageNavigator } from './storage-navigator';
import { StorageInspectorV2 } from './storage-inspector-v2';
import { StorageWorkspaceV2 } from './storage-workspace-v2';
import { resetStorageFocusStore, useStorageFocusStore } from '@/warehouse/editor/model/v2/storage-focus-store';

type MockCell = {
  id: string;
  rackId: string;
  status: 'active' | 'disabled';
  address: {
    raw: string;
    parts: { level: number };
  };
};

let mockPublishedCells: MockCell[] = [];
let mockOccupancyRows: Array<{ cellId: string | null; containerId?: string | null; externalCode?: string | null }> = [];
let mockStorageRowsByLocationId: Record<string, Array<{ locationCode?: string | null; locationType?: string | null; containerId: string; containerStatus: string }>> = {};
const workspaceCanvasAndPanelSpy = vi.fn();

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => ({
    data: mockPublishedCells,
    isLoading: false,
  })
}));

vi.mock('@/entities/location/api/use-floor-location-occupancy', () => ({
  useFloorLocationOccupancy: () => ({
    data: mockOccupancyRows,
    isLoading: false,
  })
}));

vi.mock('@/entities/location/api/use-location-by-cell', () => ({
  useLocationByCell: (cellId: string | null) => ({
    data: cellId ? { locationId: `loc-${cellId}` } : null,
    isLoading: false,
  })
}));

vi.mock('@/entities/location/api/use-location-storage', () => ({
  useLocationStorage: (locationId: string | null) => ({
    data: locationId ? (mockStorageRowsByLocationId[locationId] ?? []) : [],
    isLoading: false,
  })
}));

vi.mock('./workspace-canvas-and-panel', () => ({
  WorkspaceCanvasAndPanel: (props: Record<string, unknown>) => {
    workspaceCanvasAndPanelSpy(props);
    return createElement('div', { 'data-testid': 'storage-v2-canvas' }, 'Canvas');
  }
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
      rackIds: ['rack-1', 'rack-2'],
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
        },
        'rack-2': {
          id: 'rack-2',
          displayCode: 'R-02',
          kind: 'single',
          axis: 'NS',
          x: 10,
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

function renderV2Pair(workspace: FloorWorkspace) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(Fragment, null,
          createElement(StorageNavigator, { workspace }),
          createElement(StorageInspectorV2, { workspace })
        )
      )
    );
  });
  return renderer;
}

function renderStorageWorkspaceV2(workspace: FloorWorkspace) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(StorageWorkspaceV2, {
          workspace,
          onAddRack: () => undefined,
          onOpenInspector: () => undefined,
          onCloseInspector: () => undefined
        })
      )
    );
  });
  return renderer;
}

function clickLocationByAddress(renderer: TestRenderer.ReactTestRenderer, addressRaw: string) {
  const row = renderer.root.findAll((node) =>
    node.type === 'div' &&
    typeof node.props?.title === 'string' &&
    node.props.title.includes(`Location ${addressRaw}`)
  )[0];
  expect(row).toBeDefined();
  act(() => {
    row.props.onClick();
  });
}

function clickButtonByLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const button = renderer.root.findAllByType('button').find((node) => {
    const text = Array.isArray(node.children) ? node.children.join('') : String(node.children ?? '');
    return text.includes(label);
  });
  expect(button).toBeDefined();
  act(() => {
    button!.props.onClick();
  });
}

function getButtonLabels(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByType('button').map((node) =>
    Array.isArray(node.children) ? node.children.join('') : String(node.children ?? '')
  );
}

describe('Storage V2 focus cutover integration', () => {
  beforeEach(() => {
    resetStorageFocusStore();
    mockPublishedCells = [
      {
        id: 'cell-1',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.01', parts: { level: 1 } }
      },
      {
        id: 'cell-2',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.02.01', parts: { level: 2 } }
      }
    ];
    mockOccupancyRows = [];
    mockStorageRowsByLocationId = {
      'loc-cell-1': [
        {
          locationCode: 'LOC-01',
          locationType: 'rack_slot',
          containerId: 'container-1',
          containerStatus: 'stored'
        }
      ]
    };
    workspaceCanvasAndPanelSpy.mockClear();
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });
  });

  afterEach(() => {
    resetStorageFocusStore();
  });

  it('keeps navigator + inspector coherent through select/level-change/empty-collapse', () => {
    const renderer = renderV2Pair(createWorkspace());

    // 1) select location -> single focus truth shared across surfaces
    clickLocationByAddress(renderer, '01-A.01.01');
    let s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBe('cell-1');
    expect(s.selectedRackId).toBe('rack-1');
    expect(s.activeLevel).toBe(1);
    let tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('R-01');
    expect(tree).toContain('LOC-01');

    // 2) level change -> cell cleared, rack preserved
    clickButtonByLabel(renderer, '2');
    s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBe('rack-1');
    expect(s.activeLevel).toBe(2);
    tree = JSON.stringify(renderer.toJSON());
    expect(
      tree.includes('No location selected') || tree.includes('Loading rack...')
    ).toBe(true);

    // 3) empty-canvas collapse semantics from focus-store, then navigator must not reanimate rack
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1
      });
      useStorageFocusStore.getState().handleEmptyCanvasClick();
      useStorageFocusStore.getState().handleEmptyCanvasClick();
    });
    s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBeNull();
    expect(s.activeLevel).toBeNull();
    tree = JSON.stringify(renderer.toJSON());
    expect(
      tree.includes('No rack context available') || tree.includes('No location selected')
    ).toBe(true);
  });

  it('StorageWorkspaceV2 keeps compact V2 shell mounted across rackless and focused states', async () => {
    await act(async () => {
      useStorageFocusStore.getState().clearAllFocus();
      await Promise.resolve();
    });

    const renderer = renderStorageWorkspaceV2(createWorkspace());

    expect(renderer.root.findByProps({ 'data-testid': 'storage-v2-canvas' })).toBeTruthy();
    expect(workspaceCanvasAndPanelSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hideContextPanel: true,
        hideRightPanel: true,
        isStorageV2: true
      })
    );
    let tree = JSON.stringify(renderer.toJSON());
    let buttonLabels = getButtonLabels(renderer);
    expect(tree).toContain('Search location');
    expect(buttonLabels).toContain('L1');
    expect(buttonLabels).toContain('L2');
    expect(buttonLabels).toContain('L3');
    expect(tree).toContain('Select a rack on the map to browse locations.');
    expect(tree).toContain('No location selected');

    await act(async () => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
      await Promise.resolve();
    });

    tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('Search location');
    expect(tree).toContain('R-01');

    clickLocationByAddress(renderer, '01-A.01.01');
    tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('LOC-01');
    expect(tree).toContain('Current containers');
    expect(tree).toContain('Current inventory');
    expect(tree).toContain('Location Policy');
    expect(tree).not.toContain('Current Contents');
    expect(tree).not.toContain('Inventory Preview');

    await act(async () => {
      useStorageFocusStore.getState().handleEmptyCanvasClick();
      await Promise.resolve();
    });
    tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('Search location');
    expect(tree).toContain('R-01');

    await act(async () => {
      useStorageFocusStore.getState().handleEmptyCanvasClick();
      await Promise.resolve();
    });
    tree = JSON.stringify(renderer.toJSON());
    buttonLabels = getButtonLabels(renderer);
    expect(tree).toContain('Search location');
    expect(buttonLabels).toContain('L1');
    expect(buttonLabels).toContain('L2');
    expect(buttonLabels).toContain('L3');
    expect(tree).toContain('Select a rack on the map to browse locations.');
    expect(tree).toContain('No location selected');
  });
});

