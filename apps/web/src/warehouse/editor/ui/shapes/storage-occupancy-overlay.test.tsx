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
  getStorageOccupancyOverlaySurfaceRect,
  getStorageOccupancyOverlayLod,
  resolveStatus,
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
  occupiedCellIds?: Set<string>;
  cellRuntimeById?: Map<string, OperationsCellRuntime>;
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
        occupiedCellIds: params?.occupiedCellIds ?? new Set(['cell-1', 'cell-2']),
        cellRuntimeById:
          params?.cellRuntimeById ??
          new Map([
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

type CanvasCall = {
  name: string;
  args: unknown[];
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineDash: number[];
};

function createCanvasContextRecorder() {
  const calls: CanvasCall[] = [];
  const state = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineDash: [] as number[],
    globalAlpha: 1
  };
  const record = (name: string, args: unknown[] = []) => {
    calls.push({
      name,
      args,
      fillStyle: state.fillStyle,
      strokeStyle: state.strokeStyle,
      lineWidth: state.lineWidth,
      lineDash: [...state.lineDash]
    });
  };
  const context = {
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(value: string) {
      state.fillStyle = value;
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(value: string) {
      state.strokeStyle = value;
    },
    get lineWidth() {
      return state.lineWidth;
    },
    set lineWidth(value: number) {
      state.lineWidth = value;
    },
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(value: number) {
      state.globalAlpha = value;
    },
    save: () => record('save'),
    restore: () => record('restore'),
    beginPath: () => record('beginPath'),
    closePath: () => record('closePath'),
    moveTo: (...args: number[]) => record('moveTo', args),
    lineTo: (...args: number[]) => record('lineTo', args),
    quadraticCurveTo: (...args: number[]) => record('quadraticCurveTo', args),
    fill: () => record('fill'),
    stroke: () => record('stroke'),
    strokeRect: (...args: number[]) => record('strokeRect', args),
    setLineDash: (dash: number[]) => {
      state.lineDash = dash;
      record('setLineDash', dash);
    }
  } as unknown as CanvasRenderingContext2D;

  return { calls, context };
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

describe('getStorageOccupancyOverlaySurfaceRect', () => {
  it('uses near-full-cell geometry for overview occupied surfaces', () => {
    const geometry = { x: 10, y: 20, width: 80, height: 40 };
    const rect = getStorageOccupancyOverlaySurfaceRect({ geometry, zoom: 1 });

    expect(rect).toEqual({ x: 11.5, y: 21.5, width: 77, height: 37 });
    expect(rect.width / geometry.width).toBeGreaterThan(0.9);
    expect(rect.height / geometry.height).toBeGreaterThan(0.9);
  });

  it('derives the inset from screen pixels divided by zoom', () => {
    const geometry = { x: 0, y: 0, width: 80, height: 40 };

    expect(
      getStorageOccupancyOverlaySurfaceRect({ geometry, zoom: 0.5 })
    ).toEqual({ x: 3, y: 3, width: 74, height: 34 });
    expect(
      getStorageOccupancyOverlaySurfaceRect({ geometry, zoom: 0.8 })
    ).toEqual({ x: 1.875, y: 1.875, width: 76.25, height: 36.25 });
    expect(
      getStorageOccupancyOverlaySurfaceRect({ geometry, zoom: 1 })
    ).toEqual({ x: 1.5, y: 1.5, width: 77, height: 37 });
  });

  it('clamps the inset so very small cells do not produce negative sizes', () => {
    const rect = getStorageOccupancyOverlaySurfaceRect({
      geometry: { x: 0, y: 0, width: 2, height: 1 },
      zoom: 0.1
    });

    expect(rect).toEqual({ x: 0.25, y: 0.25, width: 1.5, height: 0.5 });
  });
});

describe('resolveStatus', () => {
  const _occupiedCellIds = new Set(['cell-occupied']);
  const cellRuntimeById = new Map<string, OperationsCellRuntime>([
    ['cell-stocked', { cellId: 'cell-stocked', cellAddress: 'A.01.01.01', status: 'stocked', pickActive: true, reserved: false, quarantined: false, stocked: true, containerCount: 1, totalQuantity: 10, containers: [] }],
    ['cell-empty', { cellId: 'cell-empty', cellAddress: 'A.01.01.02', status: 'empty', pickActive: false, reserved: false, quarantined: false, stocked: false, containerCount: 0, totalQuantity: 0, containers: [] }],
    ['cell-pick-active', { cellId: 'cell-pick-active', cellAddress: 'A.01.01.03', status: 'pick_active', pickActive: true, reserved: false, quarantined: false, stocked: true, containerCount: 1, totalQuantity: 5, containers: [] }],
    ['cell-reserved', { cellId: 'cell-reserved', cellAddress: 'A.01.01.04', status: 'reserved', pickActive: false, reserved: true, quarantined: false, stocked: false, containerCount: 0, totalQuantity: 0, containers: [] }],
    ['cell-quarantined', { cellId: 'cell-quarantined', cellAddress: 'A.01.01.05', status: 'quarantined', pickActive: false, reserved: false, quarantined: true, stocked: false, containerCount: 0, totalQuantity: 0, containers: [] }]
  ]);

  it('stale runtime stocked but occupiedCellIds excludes source → empty', () => {
    const result = resolveStatus({
      cellId: 'cell-stocked',
      occupiedCellIds: new Set(),
      cellRuntimeById
    });
    expect(result.status).toBe('empty');
    expect(result.hasRuntimeTruth).toBe(false);
  });

  it('runtime empty but occupiedCellIds includes target → occupied (fallback)', () => {
    const result = resolveStatus({
      cellId: 'cell-empty',
      occupiedCellIds: new Set(['cell-empty']),
      cellRuntimeById
    });
    expect(result.status).toBe('occupied');
    expect(result.hasRuntimeTruth).toBe(false);
  });

  it('runtime stocked with occupiedCellIds includes cell → occupied (fallback)', () => {
    const result = resolveStatus({
      cellId: 'cell-stocked',
      occupiedCellIds: new Set(['cell-stocked']),
      cellRuntimeById
    });
    expect(result.status).toBe('occupied');
    expect(result.hasRuntimeTruth).toBe(false);
  });

  it('runtime empty and no fallback → empty', () => {
    const result = resolveStatus({
      cellId: 'cell-empty',
      occupiedCellIds: new Set(),
      cellRuntimeById
    });
    expect(result.status).toBe('empty');
    expect(result.hasRuntimeTruth).toBe(false);
  });

  it('exceptional runtime pick_active still overrides physical occupancy', () => {
    const result = resolveStatus({
      cellId: 'cell-pick-active',
      occupiedCellIds: new Set(),
      cellRuntimeById
    });
    expect(result.status).toBe('pick_active');
    expect(result.hasRuntimeTruth).toBe(true);
  });

  it('exceptional runtime reserved still overrides physical occupancy', () => {
    const result = resolveStatus({
      cellId: 'cell-reserved',
      occupiedCellIds: new Set(),
      cellRuntimeById
    });
    expect(result.status).toBe('reserved');
    expect(result.hasRuntimeTruth).toBe(true);
  });

  it('exceptional runtime quarantined still overrides physical occupancy with warning', () => {
    const result = resolveStatus({
      cellId: 'cell-quarantined',
      occupiedCellIds: new Set(),
      cellRuntimeById
    });
    expect(result.status).toBe('quarantined');
    expect(result.hasRuntimeTruth).toBe(true);
    expect(result.hasWarning).toBe(true);
  });

  it('no runtime and no fallback → empty', () => {
    const result = resolveStatus({
      cellId: 'unknown-cell',
      occupiedCellIds: new Set(),
      cellRuntimeById
    });
    expect(result.status).toBe('empty');
    expect(result.hasRuntimeTruth).toBe(false);
  });

  it('no runtime and occupiedCellIds includes → occupied (fallback)', () => {
    const result = resolveStatus({
      cellId: 'occupied-cell',
      occupiedCellIds: new Set(['occupied-cell']),
      cellRuntimeById
    });
    expect(result.status).toBe('occupied');
    expect(result.hasRuntimeTruth).toBe(false);
  });
});

function createMediaQueryList(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '(pointer: coarse)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  };
}

describe('coarse pointer guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null on coarse-pointer devices', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      () => createMediaQueryList(true)
    );

    const renderer = renderOverlay({ zoom: 0.6 });
    const shapes = getStorageShapes(renderer);
    expect(shapes).toHaveLength(0);
  });

  it('renders overlay on non-coarse-pointer devices', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      () => createMediaQueryList(false)
    );

    const renderer = renderOverlay({ zoom: 0.6 });
    const shapes = getStorageShapes(renderer);
    expect(shapes).toHaveLength(1);
  });

  it('falls back to desktop behavior when matchMedia is unavailable', () => {
    const originalMatchMedia = window.matchMedia;
    (window as { matchMedia?: typeof window.matchMedia }).matchMedia = undefined as unknown as typeof window.matchMedia;

    const renderer = renderOverlay({ zoom: 0.6 });
    const shapes = getStorageShapes(renderer);
    expect(shapes).toHaveLength(1);

    window.matchMedia = originalMatchMedia;
  });

  it('disableOccupancyOverlay=off still hides overlay regardless of pointer', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      () => createMediaQueryList(false)
    );

    const renderer = renderOverlay({
      zoom: 0.6,
      diagnostics: { storageOccupancyOverlay: 'off' }
    });
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Shape' &&
          node.props.wosShapeRole === 'storage-occupancy-overlay'
      )
    ).toHaveLength(0);
  });
});

describe('StorageOccupancyOverlay', () => {
  it('renders active occupancy marks at storage overview zoom while RackCells would be gated', () => {
    const renderer = renderOverlay({ zoom: 0.6 });
    const group = renderer.root.findByProps({
      name: 'storage-occupancy-rack-group'
    });
    const shapes = getStorageShapes(renderer);

    expect(group.props.listening).toBe(false);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.props.listening).toBe(false);
    expect(shapes[0]?.props.overlayLod).toBe('cell-compact');
    expect(shapes[0]?.props.cells.map((cell: { cellId: string }) => cell.cellId)).toEqual([
      'cell-1',
      'cell-2',
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
      // cell-1: no runtime, occupiedCellIds includes → occupied fallback
      { status: 'occupied', hasRuntimeTruth: false },
      // cell-2: runtime empty defers to occupiedCellIds fallback
      { status: 'occupied', hasRuntimeTruth: false },
      // cell-3: exceptional runtime pick_active overrides
      { status: 'pick_active', hasRuntimeTruth: true }
    ]);
    expect(renderer.root.findAll((node) => String(node.type) === 'Text')).toHaveLength(0);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Rect' &&
          node.props.wosRectRole === 'cell-interaction'
      )
    ).toHaveLength(0);
  });

  it('renders physical occupancy marks for all occupied cells even when runtime is stale', () => {
    const renderer = renderOverlay({
      occupiedCellIds: new Set(['cell-1', 'cell-2', 'cell-3']),
      cellRuntimeById: new Map([
        ['cell-1', runtime('cell-1', 'empty')],
        ['cell-2', runtime('cell-2', 'stocked')],
        ['cell-3', runtime('cell-3', 'empty')]
      ])
    });
    const shapes = getStorageShapes(renderer);

    expect(shapes).toHaveLength(1);
    // All three cells are physically occupied via occupiedCellIds.
    // Normal runtime states (stocked, empty) defer to physical occupancy,
    // so all show as occupied (fallback) rather than their stale runtime status.
    expect(shapes[0]?.props.cells.map((c: { cellId: string; status: string }) => ({ cellId: c.cellId, status: c.status }))).toEqual([
      { cellId: 'cell-1', status: 'occupied' },
      { cellId: 'cell-2', status: 'occupied' },
      { cellId: 'cell-3', status: 'occupied' }
    ]);
  });

  it('keeps interaction-skeleton non-listening and label/detail free', () => {
    const renderer = renderOverlay({
      renderMode: 'interaction-skeleton',
      zoom: 0.6
    });
    const group = renderer.root.findByProps({
      name: 'storage-occupancy-rack-group'
    });
    const shapes = getStorageShapes(renderer);

    expect(group.props.listening).toBe(false);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.props.name).toBe('storage-occupancy-rack-summary');
    expect(shapes[0]?.props.listening).toBe(false);
    expect(shapes[0]?.props.overlayLod).toBe('rack-summary');
    expect(renderer.root.findAll((node) => String(node.type) === 'Text')).toHaveLength(0);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Rect' &&
          node.props.wosRectRole === 'cell-interaction'
      )
    ).toHaveLength(0);
  });

  it('keeps special overview states visually distinguishable', () => {
    const renderer = renderOverlay({
      zoom: 0.5,
      occupiedCellIds: new Set(),
      cellRuntimeById: new Map([
        ['cell-1', runtime('cell-1', 'reserved')],
        ['cell-2', runtime('cell-2', 'pick_active')],
        ['cell-3', runtime('cell-3', 'quarantined')]
      ])
    });
    const shape = getStorageShapes(renderer)[0];
    const { calls, context } = createCanvasContextRecorder();
    const sceneFunc = shape?.props.sceneFunc as (context: unknown) => void;

    sceneFunc({ _context: context });

    expect(
      shape?.props.cells.map((cell: { cellId: string; status: string }) => ({
        cellId: cell.cellId,
        status: cell.status
      }))
    ).toEqual([
      { cellId: 'cell-1', status: 'reserved' },
      { cellId: 'cell-2', status: 'pick_active' },
      { cellId: 'cell-3', status: 'quarantined' }
    ]);
    expect(calls.some((call) => call.name === 'setLineDash')).toBe(true);
    expect(calls.some((call) => call.name === 'strokeRect')).toBe(true);
    expect(calls.filter((call) => call.name === 'stroke').length).toBeGreaterThan(3);
    expect(new Set(calls.filter((call) => call.name === 'fill').map((call) => call.fillStyle))).toEqual(
      new Set([
        'rgba(178, 156, 224, 0.34)',
        'rgba(86, 44, 145, 0.14)',
        'rgba(198, 88, 49, 0.16)'
      ])
    );
  });
});
