import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace, LocationStorageSnapshotRow } from '@wos/domain';
import { StorageNavigator } from './storage-navigator';
import { resetStorageFocusStore, useStorageFocusStore } from '@/warehouse/editor/model/v2/storage-focus-store';
import type { StorageCameraFocusRequest } from '@/warehouse/editor/model/v2/storage-focus-store';
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

function makeStorageRow(overrides: Partial<LocationStorageSnapshotRow> & Pick<LocationStorageSnapshotRow, 'cellId' | 'containerId' | 'systemCode'>): LocationStorageSnapshotRow {
  return {
    tenantId: '11111111-1111-4111-8111-111111111111',
    floorId: 'floor-1',
    locationId: '22222222-2222-4222-8222-222222222222',
    locationCode: '01-A.01.01',
    locationType: 'rack_slot',
    cellId: overrides.cellId,
    containerId: overrides.containerId,
    systemCode: overrides.systemCode,
    externalCode: overrides.externalCode ?? null,
    containerType: overrides.containerType ?? 'pallet',
    containerStatus: overrides.containerStatus ?? 'active',
    placedAt: overrides.placedAt ?? '2026-06-02T12:00:00.000Z',
    inventoryUnitId: overrides.inventoryUnitId ?? null,
    itemRef: overrides.itemRef ?? null,
    product: overrides.product ?? null,
    quantity: overrides.quantity ?? null,
    uom: overrides.uom ?? null,
    packagingState: overrides.packagingState,
    productPackagingLevelId: overrides.productPackagingLevelId,
    packCount: overrides.packCount,
    containerPackagingProfileId: overrides.containerPackagingProfileId,
    containerIsStandardPack: overrides.containerIsStandardPack,
    preferredPackagingProfileId: overrides.preferredPackagingProfileId,
    presetUsageStatus: overrides.presetUsageStatus,
    presetMaterializationStatus: overrides.presetMaterializationStatus
  };
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

function findButtonByLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  return getAllButtons(renderer).find((node) => {
    const text = Array.isArray(node.children) ? node.children.join('') : String(node.children ?? '');
    return text.includes(label);
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

function findLocationRows(renderer: TestRenderer.ReactTestRenderer, addressRaw: string) {
  return renderer.root.findAll((node) =>
    node.type === 'div' &&
    typeof node.props?.title === 'string' &&
    node.props.title.includes(addressRaw)
  );
}

function collectText(node: TestRenderer.ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

function selectRackLevelOne() {
  act(() => {
    useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
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

    expect(useStorageFocusStore.getState().selectedRackId).toBeNull();
    expect(tree).toContain(translate('storage.field.rack'));
    expect(tree).toContain(translate('storage.navigator.allRacks'));
    expect(tree).toContain('R-01');
    expect(tree).toContain('R-02');
    expect(tree).not.toContain('L1');
    expect(tree).not.toContain('L2');
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
    expect(tree).toContain(translate('storage.navigator.allRacks'));
    expect(tree).toContain('R-01');
    expect(tree).toContain('R-02');
    expect(tree).not.toContain('L1');
    expect(tree).not.toContain('L2');
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

  it('keeps existing badges on empty query and shows no subtitle', () => {
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
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-100',
        externalCode: 'PALLET-RED',
        product: {
          id: '55555555-5555-4555-8555-555555555555',
          source: 'manual',
          externalProductId: 'EXT-RED',
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
      }),
      makeStorageRow({
        cellId: 'cell-2',
        containerId: 'container-b',
        systemCode: 'CNT-200',
        externalCode: 'PALLET-A'
      }),
      makeStorageRow({
        cellId: 'cell-2',
        containerId: 'container-c',
        systemCode: 'CNT-201',
        externalCode: 'PALLET-B'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    const firstRow = collectText(findLocationRow(renderer, '01-A.01.01'));
    const secondRow = collectText(findLocationRow(renderer, '01-A.01.02'));

    expect(firstRow).toContain('PALLET-RED');
    expect(firstRow).not.toContain('Red Bolts');
    expect(secondRow).toContain(translate('storage.inventory.containerCount', { count: 2 }));
  });

  it('preserves the container badge and hides subtitle for location queries', () => {
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
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, '01-A.01.01');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain('PALLET-A');
    expect(rowText).not.toContain(translate('storage.navigator.matchingProducts', { count: 1 }));
  });

  it('selects the matched container for an exact external container code query and shows no subtitle', () => {
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
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        product: {
          id: '55555555-5555-4555-8555-555555555555',
          source: 'manual',
          externalProductId: 'EXT-ALPHA',
          sku: 'SKU-ALPHA',
          name: 'PALLET-B fasteners',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 4,
        uom: 'pcs'
      }),
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'PALLET-B');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain('PALLET-B');
    expect(rowText).not.toContain('PALLET-A');
    expect(rowText).not.toContain('fasteners');
  });

  it('shows product name, sku, quantity, and uom for product-name queries', () => {
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
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-BLUE',
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
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Blue Nuts');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain('PALLET-A');
    expect(rowText).toContain('Blue Nuts');
    expect(rowText).toContain('SKU-BLUE');
    expect(rowText).toContain('5 pcs');
  });

  it('prefers an exact sku match over a partial product-name match in the same cell', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [{ id: 'cell-1', rackId: 'rack-1', status: 'active', address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } } }];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-ONE',
          sku: 'SKU-ALPHA',
          name: 'SKU-001 anchors',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 1,
        uom: 'pcs'
      }),
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B',
        product: {
          id: '55555555-5555-4555-8555-555555555552',
          source: 'manual',
          externalProductId: 'EXT-TWO',
          sku: 'SKU-001',
          name: 'Anchor Kit',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 3,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'SKU-001');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain('PALLET-B');
    expect(rowText).toContain('Anchor Kit');
    expect(rowText).not.toContain('anchors');
  });

  it('prefers an exact container code over a substring product-name match in the same cell', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [{ id: 'cell-1', rackId: 'rack-1', status: 'active', address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } } }];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-ONE',
          sku: 'SKU-ONE',
          name: 'CNT-002 clamp',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 1,
        uom: 'pcs'
      }),
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'CNT-002');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain('PALLET-B');
    expect(rowText).not.toContain('clamp');
  });

  it('safely aggregates one product across multiple rows in the same container', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [{ id: 'cell-1', rackId: 'rack-1', status: 'active', address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } } }];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        inventoryUnitId: '44444444-4444-4444-8444-444444444444',
        itemRef: 'internal-ref-1',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-BLUE',
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
      }),
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        inventoryUnitId: '44444444-4444-4444-8444-444444444445',
        itemRef: 'internal-ref-2',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-BLUE',
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
        quantity: 7,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Blue Nuts');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain('PALLET-A');
    expect(rowText).toContain('12 pcs');
    expect(rowText.match(/Blue Nuts/g)?.length).toBe(1);
  });

  it('shows container count badge and product subtitle for one matched product across multiple containers', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [{ id: 'cell-1', rackId: 'rack-1', status: 'active', address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } } }];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-BLUE',
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
      }),
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-BLUE',
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
        quantity: 7,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Blue Nuts');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain(translate('storage.inventory.containerCount', { count: 2 }));
    expect(rowText).toContain('Blue Nuts');
    expect(rowText).not.toContain('SKU-BLUE');
    expect(rowText).toContain('12 pcs');
  });

  it('suppresses quantity when matched product rows use different uom values', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [{ id: 'cell-1', rackId: 'rack-1', status: 'active', address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } } }];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-BLUE',
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
      }),
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-BLUE',
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
        quantity: 7,
        uom: 'box'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Blue Nuts');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain('Blue Nuts');
    expect(rowText).not.toContain('12 pcs');
    expect(rowText).not.toContain('box');
  });

  it('shows a neutral subtitle when multiple distinct matched products exist', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [{ id: 'cell-1', rackId: 'rack-1', status: 'active', address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } } }];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        product: {
          id: '55555555-5555-4555-8555-555555555551',
          source: 'manual',
          externalProductId: 'EXT-BLUE-1',
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
      }),
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B',
        product: {
          id: '55555555-5555-4555-8555-555555555552',
          source: 'manual',
          externalProductId: 'EXT-BLUE-2',
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
        quantity: 7,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Blue Nuts');

    const rowText = collectText(findLocationRow(renderer, '01-A.01.01'));
    expect(rowText).toContain(translate('storage.inventory.containerCount', { count: 2 }));
    expect(rowText).toContain(translate('storage.navigator.matchingProducts', { count: 2 }));
    expect(rowText).not.toContain('SKU-BLUE-1');
    expect(rowText).not.toContain('SKU-BLUE-2');
  });

  it('finds product results before any rack is selected', () => {
    const workspace = createWorkspace();
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-3',
        containerId: 'container-c',
        systemCode: 'CNT-300',
        externalCode: 'PALLET-C',
        locationCode: '02-A.01.01',
        product: {
          id: '55555555-5555-4555-8555-555555555553',
          source: 'manual',
          externalProductId: 'EXT-GREEN',
          sku: 'SKU-GREEN',
          name: 'Green Washers',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 9,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Green Washers');

    const tree = JSON.stringify(renderer.toJSON());
    const rowText = collectText(findLocationRow(renderer, '02-A.01.01'));

    expect(rowText).toContain('02-A.01.01');
    expect(rowText).toContain('R-02');
    expect(rowText).toContain(translate('storage.field.levelWithNumber', { level: 1 }));
    expect(tree).toContain(translate('storage.navigator.searchingEntireWarehouse'));
    expect(tree).not.toContain(translate('storage.state.selectRackOnMap'));
  });

  it('returns cross-rack product results even when another rack is selected', () => {
    const workspace = createWorkspace();
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-3',
        containerId: 'container-c',
        systemCode: 'CNT-300',
        externalCode: 'PALLET-C',
        locationCode: '02-A.01.01',
        product: {
          id: '55555555-5555-4555-8555-555555555553',
          source: 'manual',
          externalProductId: 'EXT-GREEN',
          sku: 'SKU-GREEN',
          name: 'Green Washers',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 9,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Green Washers');

    const tree = JSON.stringify(renderer.toJSON());
    const rowText = collectText(findLocationRow(renderer, '02-A.01.01'));

    expect(rowText).toContain('R-02');
    expect(tree).not.toContain('01-A.01.01');
  });

  it('returns cross-level container results while keeping browse level unchanged until click', () => {
    const workspace = createWorkspace();
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-2',
        containerId: 'container-b',
        systemCode: 'CNT-L2',
        externalCode: 'PALLET-L2',
        locationCode: '01-A.02.01'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'PALLET-L2');

    const rowText = collectText(findLocationRow(renderer, '01-A.02.01'));
    expect(rowText).toContain(translate('storage.field.levelWithNumber', { level: 2 }));
    expect(useStorageFocusStore.getState().activeLevel).toBe(1);
  });

  it('renders every matching physical cell once across multiple racks', () => {
    const workspace = createWorkspace();
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        locationCode: '01-A.01.01',
        product: {
          id: '55555555-5555-4555-8555-555555555554',
          source: 'manual',
          externalProductId: 'EXT-BLACK',
          sku: 'SKU-BLACK',
          name: 'Black Bolts',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 2,
        uom: 'pcs'
      }),
      makeStorageRow({
        cellId: 'cell-3',
        containerId: 'container-c',
        systemCode: 'CNT-003',
        externalCode: 'PALLET-C',
        locationCode: '02-A.01.01',
        product: {
          id: '55555555-5555-4555-8555-555555555554',
          source: 'manual',
          externalProductId: 'EXT-BLACK',
          sku: 'SKU-BLACK',
          name: 'Black Bolts',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 4,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Black Bolts');

    expect(findLocationRows(renderer, '01-A.01.01')).toHaveLength(1);
    expect(findLocationRows(renderer, '02-A.01.01')).toHaveLength(1);
  });

  it('restores the previous browse state after clearing a global query', () => {
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
        id: 'cell-l2',
        rackId: 'rack-1',
        status: 'active',
        address: { raw: '01-A.02.01', parts: { face: 'A', level: 2 } }
      },
      {
        id: 'cell-r2',
        rackId: 'rack-2',
        status: 'active',
        address: { raw: '02-A.01.01', parts: { face: 'A', level: 1 } }
      }
    ];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-r2',
        containerId: 'container-r2',
        systemCode: 'CNT-R2',
        externalCode: 'PALLET-R2',
        locationCode: '02-A.01.01',
        product: {
          id: '55555555-5555-4555-8555-555555555559',
          source: 'manual',
          externalProductId: 'EXT-R2',
          sku: 'SKU-R2',
          name: 'Remote Item',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 1,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    clickButtonByLabel(renderer, 'B');
    clickButtonByLabel(renderer, translate('storage.filter.empty'));

    let tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('01-B.01.01');
    expect(tree).not.toContain('01-A.01.01');

    changeSearch(renderer, 'Remote Item');
    tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('02-A.01.01');

    changeSearch(renderer, '');
    tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('01-B.01.01');
    expect(tree).not.toContain('01-A.01.01');
    expect(tree).not.toContain('02-A.01.01');
  });

  it('ignores the empty-only filter during global search and reapplies it after clearing the query', () => {
    const workspace = createWorkspace();
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        locationCode: '01-A.01.01',
        product: {
          id: '55555555-5555-4555-8555-555555555555',
          source: 'manual',
          externalProductId: 'EXT-RED',
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
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    clickButtonByLabel(renderer, translate('storage.filter.empty'));
    expect(JSON.stringify(renderer.toJSON())).toContain(translate('storage.state.noLocationsMatchFilters'));

    changeSearch(renderer, 'Red Bolts');
    let tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('01-A.01.01');

    changeSearch(renderer, '');
    tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain(translate('storage.state.noLocationsMatchFilters'));
  });

  it('finds location queries globally across racks', () => {
    const workspace = createWorkspace();
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, '02-A.01.01');

    const rowText = collectText(findLocationRow(renderer, '02-A.01.01'));
    expect(rowText).toContain('R-02');
  });

  it('disables browse controls during global search and re-enables them after query clear', () => {
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
      }
    ];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-b',
        containerId: 'container-b',
        systemCode: 'CNT-002',
        externalCode: 'PALLET-B',
        locationCode: '01-B.01.01',
        product: {
          id: '55555555-5555-4555-8555-555555555560',
          source: 'manual',
          externalProductId: 'EXT-B',
          sku: 'SKU-B',
          name: 'Blue Brackets',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 3,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Blue Brackets');

    expect(findButtonByLabel(renderer, 'L1')?.props.disabled).toBe(true);
    expect(findButtonByLabel(renderer, translate('storage.filter.all'))?.props.disabled).toBe(true);
    expect(findButtonByLabel(renderer, 'B')?.props.disabled).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain(translate('storage.navigator.searchingEntireWarehouse'));

    changeSearch(renderer, '');

    expect(findButtonByLabel(renderer, 'L1')?.props.disabled).toBe(false);
    expect(findButtonByLabel(renderer, translate('storage.filter.all'))?.props.disabled).toBe(false);
    expect(findButtonByLabel(renderer, 'B')?.props.disabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).not.toContain(translate('storage.navigator.searchingEntireWarehouse'));
  });

  it('clicking a global result updates selected rack, level, and cell', () => {
    const workspace = createWorkspace();
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-3',
        containerId: 'container-c',
        systemCode: 'CNT-300',
        externalCode: 'PALLET-C',
        locationCode: '02-A.01.01',
        product: {
          id: '55555555-5555-4555-8555-555555555553',
          source: 'manual',
          externalProductId: 'EXT-GREEN',
          sku: 'SKU-GREEN',
          name: 'Green Washers',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 9,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Green Washers');
    clickLocationByAddress(renderer, '02-A.01.01');

    const state = useStorageFocusStore.getState();
    expect(state.selectedRackId).toBe('rack-2');
    expect(state.activeLevel).toBe(1);
    expect(state.selectedCellId).toBe('cell-3');
  });

  it('does not match containerType values', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [{ id: 'cell-1', rackId: 'rack-1', status: 'active', address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } } }];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'EXT-001',
        containerType: 'pallet'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'pallet');

    expect(JSON.stringify(renderer.toJSON())).toContain(translate('storage.state.noLocationsMatchFilters'));
  });

  it('does not match internal itemRef values', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [{ id: 'cell-1', rackId: 'rack-1', status: 'active', address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } } }];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: 'container-a',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A',
        itemRef: 'internal-ref-123'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'internal-ref-123');

    expect(JSON.stringify(renderer.toJSON())).toContain(translate('storage.state.noLocationsMatchFilters'));
  });

  it('does not match uuid container ids', () => {
    const workspace = createWorkspace();
    mockPublishedCells = [{ id: 'cell-1', rackId: 'rack-1', status: 'active', address: { raw: '01-A.01.01', parts: { face: 'A', level: 1 } } }];
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-1',
        containerId: '33333333-3333-4333-8333-333333333333',
        systemCode: 'CNT-001',
        externalCode: 'PALLET-A'
      })
    ] as LocationStorageSnapshotRow[];
    selectRackLevelOne();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, '33333333-3333-4333-8333-333333333333');

    expect(JSON.stringify(renderer.toJSON())).toContain(translate('storage.state.noLocationsMatchFilters'));
  });

  // ── Camera focus request tests ─────────────────────────────────────────────

  it('14: click global result emits exactly one camera request with correct ids', () => {
    const workspace = createWorkspace();
    mockStorageRows = [
      makeStorageRow({
        cellId: 'cell-3',
        containerId: 'container-c',
        systemCode: 'CNT-300',
        externalCode: 'PALLET-C',
        locationCode: '02-A.01.01',
        product: {
          id: '55555555-5555-4555-8555-555555555553',
          source: 'manual',
          externalProductId: 'EXT-GREEN',
          sku: 'SKU-GREEN',
          name: 'Green Washers',
          permalink: null,
          imageUrls: [],
          imageFiles: [],
          isActive: true,
          category: null,
          createdAt: '2026-06-02T12:00:00.000Z',
          updatedAt: '2026-06-02T12:00:00.000Z'
        },
        quantity: 9,
        uom: 'pcs'
      })
    ] as LocationStorageSnapshotRow[];

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'Green Washers');

    // Clear any prior state
    useStorageFocusStore.getState().clearCameraFocusRequest();
    clickLocationByAddress(renderer, '02-A.01.01');

    const request: StorageCameraFocusRequest | null = useStorageFocusStore.getState().cameraFocusRequest;
    expect(request).not.toBeNull();
    expect(request!.source).toBe('storage-global-search');
    expect(request!.rackId).toBe('rack-2');
    expect(request!.cellId).toBe('cell-3');
    expect(request!.requestId).toBeGreaterThan(0);
  });

  it('15: browse-mode cell click does not create camera request', () => {
    const workspace = createWorkspace();
    act(() => {
      useStorageFocusStore.getState().selectRack({ rackId: 'rack-1', level: 1 });
    });
    useStorageFocusStore.getState().clearCameraFocusRequest();

    const renderer = renderNavigator(workspace);
    clickLocationByAddress(renderer, '01-A.01.01');

    const request = useStorageFocusStore.getState().cameraFocusRequest;
    expect(request).toBeNull();
  });

  it('16: typing does not create camera request', () => {
    const workspace = createWorkspace();
    useStorageFocusStore.getState().clearCameraFocusRequest();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'something');
    changeSearch(renderer, 'something else');

    const request = useStorageFocusStore.getState().cameraFocusRequest;
    expect(request).toBeNull();
  });

  it('17: clear query does not create camera request', () => {
    const workspace = createWorkspace();
    useStorageFocusStore.getState().clearCameraFocusRequest();

    const renderer = renderNavigator(workspace);
    changeSearch(renderer, 'something');
    changeSearch(renderer, '');

    const request = useStorageFocusStore.getState().cameraFocusRequest;
    expect(request).toBeNull();
  });
});
