import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace, LocationStorageSnapshotRow } from '@wos/domain';
import { StorageNavigator } from './storage-navigator';
import { resetStorageFocusStore, useStorageFocusStore } from '@/warehouse/editor/model/v2/storage-focus-store';
import { translate } from '@/shared/i18n';

type MockCell = {
  id: string;
  rackId: string;
  status: 'active' | 'disabled';
  address: {
    raw: string;
    parts: { face: 'A' | 'B'; level: number };
  };
};

let mockPublishedCells: MockCell[] = [];
let mockStorageRows: LocationStorageSnapshotRow[] = [];

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => ({
    data: mockPublishedCells,
    isLoading: false,
  })
}));

vi.mock('@/entities/location/api/use-floor-location-storage', () => ({
  useFloorLocationStorage: () => ({
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
    node.props.title.includes(addressRaw)
  )[0];
  expect(row).toBeDefined();
  act(() => {
    row.props.onClick();
  });
}

function changeSearch(renderer: TestRenderer.ReactTestRenderer, value: string) {
  const input = renderer.root.findByType('input');
  act(() => {
    input.props.onChange({ target: { value } });
  });
}

function findLocationRow(renderer: TestRenderer.ReactTestRenderer, addressRaw: string) {
  return renderer.root.findAll((node) =>
    node.type === 'div' &&
    typeof node.props?.title === 'string' &&
    node.props.title.includes(addressRaw)
  )[0];
}

function collectText(node: TestRenderer.ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

describe('StorageNavigator PR7 focus ownership', () => {
  beforeEach(() => {
    resetStorageFocusStore();
    mockPublishedCells = [
      {
        id: 'cell-1',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } }
      },
      {
        id: 'cell-2',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.02.01', parts: { face: 'A', level: 2 } }
      },
      {
        id: 'cell-3',
        rackId: 'rack-2',
        status: 'active',
        address: { raw: '02-A.01.01', parts: { face: 'A', level: 1 } }
      }
    ];
    mockStorageRows = [];
  });

  afterEach(() => {
    resetStorageFocusStore();
  });

  it('does not auto-select first rack when focus is null', () => {
    const workspace = createWorkspace();
    const renderer = renderNavigator(workspace);
    const tree = JSON.stringify(renderer.toJSON());
    const buttonLabels = getAllButtons(renderer).map((node) =>
      Array.isArray(node.children) ? node.children.join('') : String(node.children ?? '')
    );

    expect(useStorageFocusStore.getState().selectedRackId).toBeNull();
    expect(tree).toContain(translate('storage.field.rack'));
    expect(buttonLabels).toContain('L1');
    expect(buttonLabels).toContain('L2');
    expect(buttonLabels).toContain('L3');
    expect(tree).toContain(translate('storage.state.selectRackOnMap'));
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
    const buttonLabels = getAllButtons(renderer).map((node) =>
      Array.isArray(node.children) ? node.children.join('') : String(node.children ?? '')
    );
    const s = useStorageFocusStore.getState();

    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBeNull();
    expect(s.activeLevel).toBeNull();
    expect(tree).toContain(translate('storage.state.selectRackOnMap'));
    expect(buttonLabels).toContain('L1');
    expect(buttonLabels).toContain('L2');
    expect(buttonLabels).toContain('L3');
  });

  it('does not synthesize fake level 1 for sparse published levels', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [
      {
        id: 'cell-3',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.03', parts: { face: 'A', level: 3 } }
      },
      {
        id: 'cell-5',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.05', parts: { face: 'A', level: 5 } }
      }
    ];
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 3 });
    });

    const renderer = renderNavigator(workspace);
    const tree = JSON.stringify(renderer.toJSON());
    const buttonLabels = getAllButtons(renderer).map((node) =>
      Array.isArray(node.children) ? node.children.join('') : String(node.children ?? '')
    );

    expect(buttonLabels).toContain('L3');
    expect(buttonLabels).toContain('L5');
    expect(buttonLabels).not.toContain('L1');
    expect(tree).not.toContain(translate('storage.state.noLocationsForLevel', { level: 1 }));
  });

  it('shows fallback level buttons for empty racks', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [];
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: null });
    });

    const renderer = renderNavigator(workspace);
    const tree = JSON.stringify(renderer.toJSON());
    const buttonLabels = getAllButtons(renderer).map((node) =>
      Array.isArray(node.children) ? node.children.join('') : String(node.children ?? '')
    );

    expect(buttonLabels).toContain('L1');
    expect(buttonLabels).toContain('L2');
    expect(buttonLabels).toContain('L3');
    expect(tree).toContain(translate('storage.state.noLocationsForLevel', { level: 1 }));
  });

  it('shows a face filter only when the active level contains multiple faces', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [
      {
        id: 'cell-a',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } }
      },
      {
        id: 'cell-b',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-B.01.01', parts: { face: 'B', level: 1 } }
      },
      {
        id: 'cell-a-l2',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.02', parts: { face: 'A', level: 2 } }
      }
    ];
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });

    const renderer = renderNavigator(workspace);
    let tree = JSON.stringify(renderer.toJSON());

    expect(tree).toContain(translate('storage.field.face'));
    expect(tree).toContain('01-A.01.01');
    expect(tree).toContain('01-B.01.01');

    clickButtonByLabel(renderer, 'B');
    tree = JSON.stringify(renderer.toJSON());

    expect(tree).not.toContain('01-A.01.01');
    expect(tree).toContain('01-B.01.01');

    clickButtonByLabel(renderer, '2');
    tree = JSON.stringify(renderer.toJSON());

    expect(tree).not.toContain(translate('storage.field.face'));
    expect(tree).toContain('01-A.01.02');
  });

  it('searches by location, container code, system code, and product name', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [
      {
        id: 'cell-1',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } }
      },
      {
        id: 'cell-2',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.02', parts: { face: 'A', level: 1 } }
      }
    ];
    mockStorageRows = [
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        floorId: 'floor-1',
        locationId: '22222222-2222-4222-8222-222222222222',
        locationCode: '01-A.01.01',
        locationType: 'rack_slot',
        cellId: 'cell-1',
        containerId: '33333333-3333-4333-8333-333333333333',
        systemCode: 'CNT-100',
        externalCode: 'PALLET-RED',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-06-02T12:00:00.000Z',
        inventoryUnitId: '44444444-4444-4444-8444-444444444444',
        itemRef: 'product:sku-red',
        product: {
          id: '55555555-5555-4555-8555-555555555555',
          source: 'manual',
          externalProductId: 'SKU-RED',
          sku: 'SKU-RED',
          name: 'Red Bolts',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 5,
        uom: 'pcs'
      }
    ] as LocationStorageSnapshotRow[];
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });

    const renderer = renderNavigator(workspace);

    changeSearch(renderer, 'PALLET-RED');
    let tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('01-A.01.01');
    expect(tree).not.toContain('01-A.01.02');

    changeSearch(renderer, 'CNT-100');
    tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('01-A.01.01');
    expect(tree).not.toContain('01-A.01.02');

    changeSearch(renderer, 'Red Bolts');
    tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('01-A.01.01');
    expect(tree).not.toContain('01-A.01.02');
  });

  it('shows the matched container instead of the first row in a multi-container cell', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [
      {
        id: 'cell-1',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } }
      }
    ];
    mockStorageRows = [
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        floorId: 'floor-1',
        locationId: '22222222-2222-4222-8222-222222222222',
        locationCode: '01-A.01.01',
        locationType: 'rack_slot',
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-06-02T12:00:00.000Z',
        inventoryUnitId: null,
        itemRef: null,
        product: null,
        quantity: null,
        uom: null
      },
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        floorId: 'floor-1',
        locationId: '22222222-2222-4222-8222-222222222222',
        locationCode: '01-A.01.01',
        locationType: 'rack_slot',
        cellId: 'cell-1',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-06-02T12:01:00.000Z',
        inventoryUnitId: null,
        itemRef: null,
        product: null,
        quantity: null,
        uom: null
      }
    ] as LocationStorageSnapshotRow[];
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'PALLET-B');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain('PALLET-B');
    expect(rowText).not.toContain('PALLET-A');
  });

  it('shows the product-matched container instead of another container in the same cell', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [
      {
        id: 'cell-1',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } }
      }
    ];
    mockStorageRows = [
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        floorId: 'floor-1',
        locationId: '22222222-2222-4222-8222-222222222222',
        locationCode: '01-A.01.01',
        locationType: 'rack_slot',
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-06-02T12:00:00.000Z',
        inventoryUnitId: null,
        itemRef: null,
        product: null,
        quantity: null,
        uom: null
      },
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        floorId: 'floor-1',
        locationId: '22222222-2222-4222-8222-222222222222',
        locationCode: '01-A.01.01',
        locationType: 'rack_slot',
        cellId: 'cell-1',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-06-02T12:01:00.000Z',
        inventoryUnitId: '44444444-4444-4444-8444-444444444444',
        itemRef: 'product:sku-blue',
        product: {
          id: '55555555-5555-4555-8555-555555555555',
          source: 'manual',
          externalProductId: 'SKU-BLUE',
          sku: 'SKU-BLUE',
          name: 'Blue Nuts',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 5,
        uom: 'pcs'
      }
    ] as LocationStorageSnapshotRow[];
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Blue Nuts');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain('PALLET-B');
    expect(rowText).not.toContain('PALLET-A');
  });

  it('shows an aggregated label when the product match is ambiguous inside one cell', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [
      {
        id: 'cell-1',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } }
      }
    ];
    mockStorageRows = [
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        floorId: 'floor-1',
        locationId: '22222222-2222-4222-8222-222222222222',
        locationCode: '01-A.01.01',
        locationType: 'rack_slot',
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-06-02T12:00:00.000Z',
        inventoryUnitId: '44444444-4444-4444-8444-444444444444',
        itemRef: 'product:sku-blue-1',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'SKU-BLUE-1',
          sku: 'SKU-BLUE-1',
          name: 'Blue Nuts',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 5,
        uom: 'pcs'
      },
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        floorId: 'floor-1',
        locationId: '22222222-2222-4222-8222-222222222222',
        locationCode: '01-A.01.01',
        locationType: 'rack_slot',
        cellId: 'cell-1',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-06-02T12:01:00.000Z',
        inventoryUnitId: '44444444-4444-4444-8444-444444444445',
        itemRef: 'product:sku-blue-2',
        product: {
          id: '55555555-5555-4555-8555-555555555552',
          source: 'manual',
          externalProductId: 'SKU-BLUE-2',
          sku: 'SKU-BLUE-2',
          name: 'Blue Nuts',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 5,
        uom: 'pcs'
      }
    ] as LocationStorageSnapshotRow[];
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Blue Nuts');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain(translate('storage.inventory.containerCount', { count: 2 }));
    expect(rowText).not.toContain('PALLET-A');
    expect(rowText).not.toContain('PALLET-B');
  });
});
