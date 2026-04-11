import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace } from '@wos/domain';
import { StorageNavigator } from './storage-navigator';
import { resetStorageFocusStore, useStorageFocusStore } from '@/widgets/warehouse-editor/model/v2/storage-focus-store';

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

function renderNavigator(workspace: FloorWorkspace) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(StorageNavigator, { workspace }));
  });
  return renderer;
}

function getAllButtons(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByType('button');
}

function clickButtonByLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const button = getAllButtons(renderer).find((node) => {
    const text = Array.isArray(node.children) ? node.children.join('') : String(node.children ?? '');
    return text.includes(label);
  });
  expect(button).toBeDefined();
  act(() => {
    button!.props.onClick();
  });
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

describe('StorageNavigator PR7 focus ownership', () => {
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
      },
      {
        id: 'cell-3',
        rackId: 'rack-2',
        status: 'active',
        address: { raw: '02-A.01.01', parts: { level: 1 } }
      }
    ];
    mockOccupancyRows = [];
  });

  afterEach(() => {
    resetStorageFocusStore();
  });

  it('does not auto-select first rack when focus is null', () => {
    const workspace = createWorkspace();
    const renderer = renderNavigator(workspace);
    const tree = JSON.stringify(renderer.toJSON());

    expect(useStorageFocusStore.getState().selectedRackId).toBeNull();
    expect(tree).toContain('Current:');
    expect(tree).toContain('—');
    expect(tree).toContain('No rack context available');
  });

  it('clicking a location writes focus transition to storage-focus-store', () => {
    const workspace = createWorkspace();
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });
    const renderer = renderNavigator(workspace);

    clickLocationByAddress(renderer, '01-A.01.01');

    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBe('cell-1');
    expect(s.selectedRackId).toBe('rack-1');
    expect(s.activeLevel).toBe(1);
  });

  it('clicking a level tab clears cell while preserving rack context', () => {
    const workspace = createWorkspace();
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1
      });
    });
    const renderer = renderNavigator(workspace);

    clickButtonByLabel(renderer, '2');

    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBe('rack-1');
    expect(s.activeLevel).toBe(2);
  });

  it('does not reanimate rack after focus is cleared', () => {
    const workspace = createWorkspace();
    act(() => {
      useStorageFocusStore.getState().selectCell({
        cellId: 'cell-1',
        rackId: 'rack-1',
        level: 1
      });
      useStorageFocusStore.getState().handleEmptyCanvasClick();
      useStorageFocusStore.getState().handleEmptyCanvasClick();
    });

    const renderer = renderNavigator(workspace);
    const tree = JSON.stringify(renderer.toJSON());
    const s = useStorageFocusStore.getState();

    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBeNull();
    expect(s.activeLevel).toBeNull();
    expect(tree).toContain('No rack context available');
    expect(tree).toContain('Current:');
    expect(tree).toContain('—');
  });
});

