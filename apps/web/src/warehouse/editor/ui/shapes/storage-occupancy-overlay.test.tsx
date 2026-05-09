import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import {
  buildCellStructureKey,
  type Cell,
  type OperationsCellRuntime,
  type Rack,
  type RackFace
} from '@wos/domain';
import type { CanvasDiagnosticsFlags } from '../canvas-diagnostics';
import {
  getStorageOccupancyOverlayLod,
  StorageOccupancyOverlay
} from './storage-occupancy-overlay';

vi.mock('react-konva', () => ({
  Layer: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Layer', props, children),
  Group: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Group', props, children),
  Shape: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Shape', props, children),
  Text: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Text', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Rect', props, children)
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const diagnosticsFlags: CanvasDiagnosticsFlags = {
  labels: 'normal',
  grid: 'normal',
  hitTest: 'normal',
  cells: 'normal',
  cellOverlays: 'normal',
  storageOccupancyOverlay: 'on',
  enableProductionCellCulling: true,
  rackLayerRenderer: 'layer'
};

function createFace(): RackFace {
  return {
    id: 'face-a',
    side: 'A',
    enabled: true,
    slotNumberingDirection: 'ltr',
    relationshipMode: 'independent',
    isMirrored: false,
    mirrorSourceFaceId: null,
    sections: [
      {
        id: 'section-a',
        ordinal: 1,
        length: 5,
        levels: [{ id: 'level-only', ordinal: 1, slotCount: 3 }]
      }
    ]
  };
}

function createRack(): Rack {
  return {
    id: 'rack-1',
    displayCode: 'R1',
    kind: 'single',
    axis: 'NS',
    x: 0,
    y: 0,
    totalLength: 5,
    depth: 2,
    rotationDeg: 0,
    faces: [createFace()]
  };
}

function createCell(slotNo: number): Cell {
  return {
    id: `cell-${slotNo}`,
    layoutVersionId: 'layout-version-1',
    rackId: 'rack-1',
    rackFaceId: 'face-a',
    rackSectionId: 'section-a',
    rackLevelId: 'level-only',
    slotNo,
    status: 'active',
    cellCode: `cell-${slotNo}`,
    address: {
      raw: `R1-A-01-01-${slotNo}`,
      parts: {
        rackCode: 'R1',
        face: 'A',
        section: 1,
        level: 1,
        slot: slotNo
      },
      sortKey: `R1-A-01-01-${slotNo}`
    }
  };
}

function indexCells(cells: Cell[]) {
  return new Map(
    cells.map((cell) => [
      buildCellStructureKey({
        rackId: cell.rackId,
        rackFaceId: cell.rackFaceId,
        rackSectionId: cell.rackSectionId,
        rackLevelId: cell.rackLevelId,
        slotNo: cell.slotNo
      }),
      cell
    ])
  );
}

function runtime(
  cellId: string,
  status: OperationsCellRuntime['status']
): OperationsCellRuntime {
  return {
    cellId,
    cellAddress: cellId,
    status,
    pickActive: status === 'pick_active',
    reserved: status === 'reserved',
    quarantined: status === 'quarantined',
    stocked: status === 'stocked',
    containerCount: status === 'empty' ? 0 : 1,
    totalQuantity: status === 'empty' ? 0 : 1,
    containers: []
  } as OperationsCellRuntime;
}

function renderOverlay(params?: {
  renderMode?: Parameters<typeof getStorageOccupancyOverlayLod>[0]['renderMode'];
  zoom?: number;
  diagnostics?: Partial<CanvasDiagnosticsFlags>;
}) {
  const rack = createRack();
  const publishedCellsByStructure = indexCells([
    createCell(1),
    createCell(2),
    createCell(3)
  ]);
  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(
      createElement(StorageOccupancyOverlay, {
        isStorageMode: true,
        racks: [rack],
        primarySelectedRackId: null,
        selectedRackActiveLevel: null,
        publishedCellsByStructure,
        occupiedCellIds: new Set(['cell-1', 'cell-2']),
        cellRuntimeById: new Map([
          ['cell-2', runtime('cell-2', 'empty')],
          ['cell-3', runtime('cell-3', 'pick_active')]
        ]),
        diagnosticsFlags: { ...diagnosticsFlags, ...params?.diagnostics },
        diagnosticsViewport: {
          canvasOffset: { x: 0, y: 0 },
          viewport: { width: 1000, height: 800 },
          zoom: params?.zoom ?? 0.6
        },
        renderMode: params?.renderMode ?? 'full',
        zoom: params?.zoom ?? 0.6
      })
    );
  });

  return renderer;
}

function getStorageShapes(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(
    (node) =>
      String(node.type) === 'Shape' &&
      node.props.wosShapeRole === 'storage-occupancy-overlay'
  );
}

describe('getStorageOccupancyOverlayLod', () => {
  it('hides far zoom and disabled/non-storage states', () => {
    expect(
      getStorageOccupancyOverlayLod({
        isStorageMode: true,
        renderMode: 'full',
        zoom: 0.1
      })
    ).toBe('hidden');
    expect(
      getStorageOccupancyOverlayLod({
        isStorageMode: false,
        renderMode: 'full',
        zoom: 0.6
      })
    ).toBe('hidden');
  });

  it('uses compact cell marks at overview zoom before RackCells LOD2', () => {
    expect(
      getStorageOccupancyOverlayLod({
        isStorageMode: true,
        renderMode: 'full',
        zoom: 0.6
      })
    ).toBe('cell-compact');
  });

  it('uses status cell marks at medium and deep zoom', () => {
    expect(
      getStorageOccupancyOverlayLod({
        isStorageMode: true,
        renderMode: 'full',
        zoom: 1
      })
    ).toBe('cell-status');
    expect(
      getStorageOccupancyOverlayLod({
        isStorageMode: true,
        renderMode: 'full',
        zoom: 1.6
      })
    ).toBe('cell-status');
  });

  it('uses summary rendering during interaction-skeleton', () => {
    expect(
      getStorageOccupancyOverlayLod({
        isStorageMode: true,
        renderMode: 'interaction-skeleton',
        zoom: 0.6
      })
    ).toBe('rack-summary');
  });
});

describe('StorageOccupancyOverlay', () => {
  it('renders active occupancy marks at storage overview zoom while RackCells would be gated', () => {
    const renderer = renderOverlay({ zoom: 0.6 });
    const layer = renderer.root.findByProps({
      name: 'storage-occupancy-overlay-layer'
    });
    const shapes = getStorageShapes(renderer);

    expect(layer.props.listening).toBe(false);
    expect(layer.props.wosOverlayLod).toBe('cell-compact');
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.props.cells.map((cell: { cellId: string }) => cell.cellId)).toEqual([
      'cell-1',
      'cell-3'
    ]);
    expect(
      shapes[0]?.props.cells.map(
        (cell: { status: string; hasRuntimeTruth: boolean }) => ({
          status: cell.status,
          hasRuntimeTruth: cell.hasRuntimeTruth
        })
      )
    ).toEqual([
      { status: 'occupied', hasRuntimeTruth: false },
      { status: 'pick_active', hasRuntimeTruth: true }
    ]);
  });

  it('keeps interaction-skeleton non-listening and label/detail free', () => {
    const renderer = renderOverlay({
      renderMode: 'interaction-skeleton',
      zoom: 0.6
    });
    const layer = renderer.root.findByProps({
      name: 'storage-occupancy-overlay-layer'
    });
    const shapes = getStorageShapes(renderer);

    expect(layer.props.listening).toBe(false);
    expect(layer.props.wosOverlayLod).toBe('rack-summary');
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.props.name).toBe('storage-occupancy-rack-summary');
    expect(renderer.root.findAll((node) => String(node.type) === 'Text')).toHaveLength(0);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Rect' &&
          node.props.wosRectRole === 'cell-interaction'
      )
    ).toHaveLength(0);
  });
});
