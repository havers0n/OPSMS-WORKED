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
