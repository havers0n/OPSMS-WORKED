import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cell, LayoutDraft, LocationOccupancyRow, LocationStorageSnapshotRow } from '@wos/domain';
import { createLayoutDraftFixture } from '../model/__fixtures__/layout-draft.fixture';
import type { EditorSelection } from '@/widgets/warehouse-editor/model/editor-types';
import { StorageRackInspector } from './storage-rack-inspector';

let mockLayoutDraft: LayoutDraft | null = null;
let mockSelectedRackActiveLevel = 0;
let mockSelection: EditorSelection = { type: 'none' };
let mockPublishedCells: Cell[] = [];
let mockLocationOccupancy: LocationOccupancyRow[] = [];
let mockLocationRef: { locationId: string } | null = { locationId: 'loc-1' };
let mockLocationStorageRows: LocationStorageSnapshotRow[] = [];
const setSelectedRackActiveLevelSpy = vi.fn();
const setSelectedContainerIdSpy = vi.fn();
const startPlaceContainerWorkflowSpy = vi.fn();
const startCreateAndPlaceWorkflowSpy = vi.fn();

vi.mock('../lib/use-workspace-layout', () => ({
  useWorkspaceLayout: () => mockLayoutDraft
}));

vi.mock('@/widgets/warehouse-editor/model/editor-selectors', async () => {
  const actual = await vi.importActual<typeof import('@/widgets/warehouse-editor/model/editor-selectors')>(
    '@/widgets/warehouse-editor/model/editor-selectors'
  );

  return {
    ...actual,
    useSelectedRackActiveLevel: () => mockSelectedRackActiveLevel,
    useSetSelectedRackActiveLevel: () => setSelectedRackActiveLevelSpy,
    useSetSelectedContainerId: () => setSelectedContainerIdSpy,
    useStartPlaceContainerWorkflow: () => startPlaceContainerWorkflowSpy,
    useStartCreateAndPlaceWorkflow: () => startCreateAndPlaceWorkflowSpy,
    useEditorSelection: () => mockSelection
  };
});

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => ({ data: mockPublishedCells })
}));

vi.mock('@/entities/location/api/use-floor-location-occupancy', () => ({
  useFloorLocationOccupancy: () => ({ data: mockLocationOccupancy })
}));

vi.mock('@/entities/location/api/use-location-by-cell', () => ({
  useLocationByCell: () => ({ data: mockLocationRef, error: null })
}));

vi.mock('@/entities/location/api/use-location-storage', () => ({
  useLocationStorage: () => ({
    data: mockLocationStorageRows,
    isPending: false,
    isError: false
  })
}));

vi.mock('@/entities/product-location-role/api/use-location-product-assignments', () => ({
  useLocationProductAssignments: () => ({
    data: [],
    isPending: false
  })
}));

vi.mock('@/entities/product-location-role/api/mutations', () => ({
  useCreateProductLocationRole: () => ({
    isPending: false,
    mutateAsync: vi.fn()
  }),
  useDeleteProductLocationRole: () => ({
    isPending: false,
    mutateAsync: vi.fn()
  })
}));

vi.mock('@/entities/product/api/use-products-search', () => ({
  useProductsSearch: () => ({
    data: []
  })
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createDraftWithLevelCount(levelCount: number): LayoutDraft {
  const draft = createLayoutDraftFixture();
  const rackId = draft.rackIds[0];
  const faceA = draft.racks[rackId]?.faces.find((face) => face.side === 'A');

  if (faceA && faceA.sections[0]) {
    faceA.sections[0].levels = Array.from({ length: levelCount }, (_, index) => ({
      id: `level-a-${index + 1}`,
      ordinal: index + 1,
      slotCount: 3
    }));
  }

  return draft;
}

function setFaceALevelCount(draft: LayoutDraft, levelCount: number) {
  const rackId = draft.rackIds[0];
  const faceA = draft.racks[rackId]?.faces.find((face) => face.side === 'A');
  if (faceA && faceA.sections[0]) {
    faceA.sections[0].levels = Array.from({ length: levelCount }, (_, index) => ({
      id: `level-a-${index + 1}`,
      ordinal: index + 1,
      slotCount: 3
    }));
  }
}

function renderInspector() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(StorageRackInspector, { workspace: null, onClose: () => undefined })
    );
  });
  return renderer;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return JSON.stringify(renderer.toJSON()).includes(text);
}

beforeEach(() => {
  setSelectedRackActiveLevelSpy.mockReset();
  setSelectedContainerIdSpy.mockReset();
  startPlaceContainerWorkflowSpy.mockReset();
  startCreateAndPlaceWorkflowSpy.mockReset();
  mockLayoutDraft = createDraftWithLevelCount(3);
  mockSelectedRackActiveLevel = 1;
  const rackId = mockLayoutDraft.rackIds[0] as string;
  mockSelection = { type: 'rack', rackIds: [rackId] };

  mockPublishedCells = [
    {
      id: 'cell-1',
      layoutVersionId: 'lv-1',
      rackId,
      rackFaceId: 'face-a',
      rackSectionId: 'section-a',
      rackLevelId: 'level-2',
      slotNo: 1,
      address: {
        raw: '01-A.01.02.01',
        parts: { rackCode: '01', face: 'A', section: 1, level: 2, slot: 1 },
        sortKey: '0001-A-01-02-01'
      },
      cellCode: 'CELL-1',
      status: 'active'
    },
    {
      id: 'cell-2',
      layoutVersionId: 'lv-1',
      rackId,
      rackFaceId: 'face-a',
      rackSectionId: 'section-a',
      rackLevelId: 'level-2',
      slotNo: 2,
      address: {
        raw: '01-A.01.02.02',
        parts: { rackCode: '01', face: 'A', section: 1, level: 2, slot: 2 },
        sortKey: '0001-A-01-02-02'
      },
      cellCode: 'CELL-2',
      status: 'active'
    }
  ];

  mockLocationOccupancy = [
    {
      tenantId: '11111111-1111-1111-1111-111111111111',
      floorId: '22222222-2222-2222-2222-222222222222',
      locationId: '33333333-3333-3333-3333-333333333333',
      locationCode: 'LOC-1',
      locationType: 'rack_slot',
      cellId: 'cell-1',
      containerId: '44444444-4444-4444-4444-444444444444',
      externalCode: null,
      containerType: 'TOTE',
      containerStatus: 'active',
      placedAt: '2026-01-01T00:00:00.000Z'
    }
  ];
  mockLocationRef = { locationId: 'loc-1' };
  mockLocationStorageRows = [
    {
      tenantId: '11111111-1111-1111-1111-111111111111',
      floorId: '22222222-2222-2222-2222-222222222222',
      locationId: '33333333-3333-3333-3333-333333333333',
      locationCode: 'LOC-1',
      locationType: 'rack_slot',
      cellId: 'cell-1',
      containerId: '44444444-4444-4444-4444-444444444444',
      systemCode: 'CNT-1',
      externalCode: 'EXT-1',
      containerType: 'TOTE',
      containerStatus: 'active',
      placedAt: '2026-01-01T00:00:00.000Z',
      itemRef: null,
      product: null,
      quantity: null,
      uom: null
    }
  ];
});

describe('StorageRackInspector', () => {
  it('renders storage empty guidance when rack cannot be resolved', () => {
    mockSelection = { type: 'none' };
    const renderer = renderInspector();

    expect(hasText(renderer, 'Storage rack')).toBe(true);
    expect(hasText(renderer, 'Select a rack or storage location to inspect storage by level.')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-rack-inspector-level-pager' })).toHaveLength(0);
  });

  it('renders rack shell with pager and summary when a rack is selected', () => {
    const renderer = renderInspector();

    expect(hasText(renderer, 'Storage rack')).toBe(true);
    expect(hasText(renderer, 'Storage summary')).toBe(true);
    expect(hasText(renderer, 'Locations')).toBe(true);
    expect(hasText(renderer, 'Occupied')).toBe(true);
    expect(hasText(renderer, 'Empty')).toBe(true);
    expect(hasText(renderer, 'Select a storage location to view its details.')).toBe(true);

    const pager = renderer.root.findByProps({ 'data-testid': 'storage-rack-inspector-level-pager' });
    act(() => {
      pager.findByProps({ 'aria-label': 'Next level' }).props.onClick();
      pager.findByProps({ 'aria-label': 'Previous level' }).props.onClick();
    });

    expect(setSelectedRackActiveLevelSpy).toHaveBeenNthCalledWith(1, 2);
    expect(setSelectedRackActiveLevelSpy).toHaveBeenNthCalledWith(2, 0);
  });

  it('keeps pager visible when published cell levels exceed rack structure levels', () => {
    setFaceALevelCount(mockLayoutDraft as LayoutDraft, 1);
    mockPublishedCells = [
      {
        ...mockPublishedCells[0],
        id: 'cell-l1',
        address: {
          ...mockPublishedCells[0].address,
          raw: '01-A.01.01.01',
          parts: { ...mockPublishedCells[0].address.parts, level: 1 }
        }
      },
      {
        ...mockPublishedCells[0],
        id: 'cell-l2',
        address: {
          ...mockPublishedCells[0].address,
          raw: '01-A.01.02.01',
          parts: { ...mockPublishedCells[0].address.parts, level: 2 }
        }
      }
    ];

    const renderer = renderInspector();
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-rack-inspector-level-pager' })).toHaveLength(1);
  });

  it('keeps pager visible when rack levels differ by rackLevelId even if address level is flat', () => {
    setFaceALevelCount(mockLayoutDraft as LayoutDraft, 1);
    mockPublishedCells = [
      {
        ...mockPublishedCells[0],
        id: 'cell-rack-level-1',
        rackLevelId: 'level-1',
        address: {
          ...mockPublishedCells[0].address,
          raw: '01-A.01.01.01',
          parts: { ...mockPublishedCells[0].address.parts, level: 1 }
        }
      },
      {
        ...mockPublishedCells[0],
        id: 'cell-rack-level-2',
        rackLevelId: 'level-2',
        address: {
          ...mockPublishedCells[0].address,
          raw: '01-A.01.01.02',
          parts: { ...mockPublishedCells[0].address.parts, level: 1, slot: 2 }
        }
      }
    ];

    const renderer = renderInspector();
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-rack-inspector-level-pager' })).toHaveLength(1);
  });

  it('keeps rack shell visible and switches lower region to location detail for cell selection', () => {
    mockSelection = { type: 'cell', cellId: 'cell-1' };
    const renderer = renderInspector();

    expect(hasText(renderer, 'Storage rack')).toBe(true);
    expect(hasText(renderer, 'Storage summary')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-rack-inspector-level-pager' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-shell-location-detail' })).toHaveLength(1);
    expect(hasText(renderer, '01-A.01.02.01')).toBe(true);
    expect(hasText(renderer, 'Select a storage location to view its details.')).toBe(false);
    expect(hasText(renderer, 'Current containers')).toBe(true);
    expect(hasText(renderer, 'Current inventory')).toBe(true);
    expect(hasText(renderer, 'Location Policy')).toBe(true);
    expect(hasText(renderer, 'Placement actions')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-context-owner' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-submit-action' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-cancel-action' })).toHaveLength(0);
  });

  it('keeps rack shell continuity for resolved container selection through source cell context', () => {
    mockSelection = { type: 'container', containerId: 'container-1', sourceCellId: 'cell-1' };
    const renderer = renderInspector();

    expect(hasText(renderer, 'Storage rack')).toBe(true);
    expect(hasText(renderer, 'Storage summary')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-rack-inspector-level-pager' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-shell-location-detail' })).toHaveLength(1);
    expect(hasText(renderer, '01-A.01.02.01')).toBe(true);
    expect(hasText(renderer, 'Select a storage location to view its details.')).toBe(false);
  });

  it('keeps existing empty-guidance behavior when selected cell cannot resolve parent rack', () => {
    mockSelection = { type: 'cell', cellId: 'missing-cell' };
    const renderer = renderInspector();

    expect(hasText(renderer, 'Storage rack')).toBe(true);
    expect(hasText(renderer, 'Select a rack or storage location to inspect storage by level.')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-rack-inspector-level-pager' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-shell-location-detail' })).toHaveLength(0);
  });

  it('de-duplicates container entries by containerId using first-seen row only', () => {
    mockLocationStorageRows = [
      ...mockLocationStorageRows,
      {
        ...mockLocationStorageRows[0],
        externalCode: 'EXT-SECOND',
        containerType: 'PALLET'
      },
      {
        ...mockLocationStorageRows[0],
        containerId: '55555555-5555-5555-5555-555555555555',
        systemCode: 'CNT-2',
        externalCode: 'EXT-NEW',
        containerType: 'BIN'
      }
    ];
    mockSelection = { type: 'cell', cellId: 'cell-1' };

    const renderer = renderInspector();
    const entries = renderer.root.findAllByProps({ 'data-testid': 'storage-shell-container-entry' });

    expect(entries).toHaveLength(2);
    expect(hasText(renderer, 'EXT-SECOND')).toBe(false);
    expect(hasText(renderer, 'EXT-NEW')).toBe(true);
  });

  it('clicking a container entry calls only setSelectedContainerId(containerId, selectedCell.id)', () => {
    mockSelection = { type: 'cell', cellId: 'cell-1' };
    const renderer = renderInspector();

    const entries = renderer.root.findAllByProps({ 'data-testid': 'storage-shell-container-entry' });
    expect(entries).toHaveLength(1);

    act(() => {
      entries[0].props.onClick();
    });

    expect(setSelectedContainerIdSpy).toHaveBeenCalledTimes(1);
    expect(setSelectedContainerIdSpy).toHaveBeenCalledWith(
      '44444444-4444-4444-4444-444444444444',
      'cell-1'
    );
    expect(setSelectedRackActiveLevelSpy).not.toHaveBeenCalled();
  });

  it('shows a clean empty state when selected cell has no containers', () => {
    mockSelection = { type: 'cell', cellId: 'cell-2' };
    mockLocationStorageRows = [];
    const renderer = renderInspector();

    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-shell-container-entry' })).toHaveLength(0);
    expect(hasText(renderer, 'No containers are currently placed at this location.')).toBe(true);
  });

  it('preserves viewed level on same-rack rack->cell drill-down without cell-driven sync', () => {
    const renderer = renderInspector();

    mockSelectedRackActiveLevel = 0;
    mockSelection = { type: 'cell', cellId: 'cell-1' };
    act(() => {
      renderer.update(
        React.createElement(StorageRackInspector, { workspace: null, onClose: () => undefined })
      );
    });

    expect(setSelectedRackActiveLevelSpy).toHaveBeenCalledWith(1);
  });

  it('does not render layout geometry/structure authoring UI', () => {
    const renderer = renderInspector();

    expect(hasText(renderer, 'Geometry')).toBe(false);
    expect(hasText(renderer, 'Structure')).toBe(false);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-work-context-switch' })).toHaveLength(0);
  });
});
