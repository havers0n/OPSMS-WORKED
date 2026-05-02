import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCellStructureKey,
  type Cell,
  type RackFace,
  type OperationsCellRuntime
} from '@wos/domain';
import { CellSurfaceVisual } from './rack-cell-overlays';
import { RackCells } from './rack-cells';
import {
  resolveCellVisualState,
  type CellVisualPalette
} from './rack-cells-visual-state';
import {
  resetCanvasCullingMetrics,
  type CanvasDiagnosticsFlags
} from '../canvas-diagnostics';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Group', props, children),
  Circle: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Circle', props, children),
  Line: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Line', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Rect', props, children),
  Shape: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Shape', props, children),
  Text: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Text', props, children)
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const geometry = {
  x: 0,
  y: 0,
  width: 200,
  height: 80,
  faceAWidth: 200,
  faceBWidth: 200,
  centerX: 100,
  centerY: 40,
  isPaired: false,
  spineY: 0
};

function createFace(
  levelIds: string[],
  options?: { slotCount?: number; direction?: 'ltr' | 'rtl' }
): RackFace {
  const slotCount = options?.slotCount ?? 2;
  return {
    id: 'face-a',
    side: 'A',
    enabled: true,
    slotNumberingDirection: options?.direction ?? 'ltr',
    isMirrored: false,
    mirrorSourceFaceId: null,
    sections: [
      {
        id: 'section-a',
        ordinal: 1,
        length: 5,
        levels: levelIds.map((id, idx) => ({
          id,
          ordinal: levelIds.length - idx,
          slotCount
        }))
      }
    ]
  };
}

function createCellsMap(levelIds: string[], slotCount = 2) {
  const byStructure = new Map<string, Cell>();

  for (const levelId of levelIds) {
    for (let slotNo = 1; slotNo <= slotCount; slotNo += 1) {
      byStructure.set(
        buildCellStructureKey({
          rackId: 'rack-1',
          rackFaceId: 'face-a',
          rackSectionId: 'section-a',
          rackLevelId: levelId,
          slotNo
        }),
        {
          id: `cell-${levelId}-${slotNo}`,
          address: {
            raw: `ADDR-${levelId}-${slotNo}`,
            parts: {
              rackCode: '01',
              face: 'A',
              section: 1,
              level: 1,
              slot: slotNo
            },
            sortKey: `0001-A-01-01-0${slotNo}`
          }
        } as Cell
      );
    }
  }

  return byStructure;
}

function renderRackCells(
  activeLevelIndex: number | null,
  levelIds: string[],
  isInteractive = false
) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackCells, {
        geometry,
        rackId: 'rack-1',
        faceA: createFace(levelIds),
        faceB: null,
        isSelected: true,
        rackRotationDeg: 0,
        activeLevelIndex,
        publishedCellsByStructure: createCellsMap(levelIds),
        isInteractive,
        onCellClick: () => undefined,
        showCellNumbers: true,
        showFocusedFullAddress: true
      })
    );
  });

  return renderer;
}

function renderRackCellsWithProps(params: {
  geometryOverride?: typeof geometry;
  faceA?: RackFace;
  activeLevelIndex?: number;
  rackRotationDeg?: 0 | 90 | 180 | 270;
  levelIds?: string[];
  slotCount?: number;
  selectedCellId?: string | null;
  locateTargetCellId?: string | null;
  workflowSourceCellId?: string | null;
  highlightedCellIds?: Set<string>;
  diagnosticsFlags?: CanvasDiagnosticsFlags;
  diagnosticsViewport?: {
    canvasOffset: { x: number; y: number };
    viewport: { width: number; height: number };
    zoom: number;
  };
  isActivelyPanning?: boolean;
  forceRenderAllCells?: boolean;
  showCellNumbers?: boolean;
  showFocusedFullAddress?: boolean;
  isSelected?: boolean;
}) {
  const levelIds = params.levelIds ?? ['level-only'];
  const slotCount = params.slotCount ?? 2;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackCells, {
        geometry: params.geometryOverride ?? geometry,
        rackId: 'rack-1',
        faceA: params.faceA ?? createFace(levelIds, { slotCount }),
        faceB: null,
        isSelected: params.isSelected ?? false,
        rackRotationDeg: params.rackRotationDeg ?? 0,
        activeLevelIndex: params.activeLevelIndex ?? 0,
        publishedCellsByStructure: createCellsMap(levelIds, slotCount),
        highlightedCellIds: params.highlightedCellIds ?? new Set<string>(),
        selectedCellId: params.selectedCellId ?? null,
        locateTargetCellId: params.locateTargetCellId ?? null,
        workflowSourceCellId: params.workflowSourceCellId ?? null,
        diagnosticsFlags: params.diagnosticsFlags,
        diagnosticsViewport: params.diagnosticsViewport,
        isActivelyPanning: params.isActivelyPanning,
        forceRenderAllCells: params.forceRenderAllCells,
        showCellNumbers: params.showCellNumbers ?? true,
        showFocusedFullAddress: params.showFocusedFullAddress ?? true,
        isInteractive: false,
        onCellClick: () => undefined
      })
    );
  });
  return renderer;
}

function clickCellIdsWithCollector(
  activeLevelIndex: number | null,
  levelIds: string[]
) {
  const selected: string[] = [];
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackCells, {
        geometry,
        rackId: 'rack-1',
        faceA: createFace(levelIds),
        faceB: null,
        isSelected: true,
        rackRotationDeg: 0,
        activeLevelIndex,
        publishedCellsByStructure: createCellsMap(levelIds),
        isInteractive: true,
        onCellClick: (cellId: string) => selected.push(cellId),
        showCellNumbers: true,
        showFocusedFullAddress: true
      })
    );
  });

  for (const rectNode of renderer.root.findAll(
    (node) => String(node.type) === 'Rect'
  )) {
    if (typeof rectNode.props.onClick === 'function') {
      act(() => {
        rectNode.props.onClick({
          cancelBubble: false,
          evt: { clientX: 0, clientY: 0 }
        });
      });
    }
  }

  return selected;
}

function getCellBounds(activeLevelIndex: number | null, levelIds: string[]) {
  const renderer = renderRackCells(activeLevelIndex, levelIds, false);
  const rects = renderer.root.findAll((node) => String(node.type) === 'Rect');
  if (rects.length === 0) return null;

  const xMin = Math.min(...rects.map((node) => Number(node.props.x)));
  const yMin = Math.min(...rects.map((node) => Number(node.props.y)));
  const xMax = Math.max(
    ...rects.map((node) => Number(node.props.x) + Number(node.props.width))
  );
  const yMax = Math.max(
    ...rects.map((node) => Number(node.props.y) + Number(node.props.height))
  );

  return { xMin, yMin, xMax, yMax };
}

function getTextValues(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => String(node.props.text));
}

function getTextValuesByOwner(
  renderer: TestRenderer.ReactTestRenderer,
  owner: string
) {
  return renderer.root
    .findAll(
      (node) => String(node.type) === 'Text' && node.props.name === owner
    )
    .map((node) => String(node.props.text));
}

const TEST_DIAGNOSTICS_VIEWPORT = {
  canvasOffset: { x: 0, y: 0 },
  viewport: { width: 100, height: 100 },
  zoom: 1
};

const UNCLIPPED_DIAGNOSTICS_FLAGS: CanvasDiagnosticsFlags = {
  labels: 'normal',
  hitTest: 'normal',
  cells: 'unculled',
  cellOverlays: 'normal',
  enableProductionCellCulling: false,
  rackLayerRenderer: 'layer'
};

function countInteractionRects(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll((node) => String(node.type) === 'Rect')
    .filter(
      (rect) =>
        rect.props.opacity === 0 &&
        rect.props.fillEnabled === false &&
        rect.props.strokeEnabled === false
    ).length;
}

function getBatchedCellBaseShapes(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(
    (node) =>
      String(node.type) === 'Shape' &&
      node.props.wosShapeRole === 'cell-base-batch'
  );
}

function getBatchedCellBaseCells(renderer: TestRenderer.ReactTestRenderer) {
  return getBatchedCellBaseShapes(renderer).flatMap((shape) =>
    Array.isArray(shape.props.cells) ? shape.props.cells : []
  );
}

function getCellBaseRects(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(
    (node) =>
      String(node.type) === 'Rect' && node.props.wosRectRole === 'cell-base'
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RackCells', () => {
  const threeLevelIds = ['level-high', 'level-mid', 'level-low'];

  it('renders semantic L1 identities when activeLevelIndex=0', () => {
    const clicked = clickCellIdsWithCollector(0, threeLevelIds);
    expect(clicked).toEqual(['cell-level-low-1', 'cell-level-low-2']);
    expect(clicked).not.toContain('cell-level-mid-1');
    expect(clicked).not.toContain('cell-level-mid-2');
    expect(clicked).not.toContain('cell-level-high-1');
    expect(clicked).not.toContain('cell-level-high-2');
  });

  it('renders semantic L2 identities when activeLevelIndex=1', () => {
    const clicked = clickCellIdsWithCollector(1, threeLevelIds);
    expect(clicked).toEqual(['cell-level-mid-1', 'cell-level-mid-2']);
    expect(clicked).not.toContain('cell-level-low-1');
    expect(clicked).not.toContain('cell-level-low-2');
    expect(clicked).not.toContain('cell-level-high-1');
    expect(clicked).not.toContain('cell-level-high-2');
  });

  it('batches visible cell base surfaces into one non-listening Shape per face', () => {
    const renderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2
    });
    const shapes = getBatchedCellBaseShapes(renderer);
    const cells = getBatchedCellBaseCells(renderer);

    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.props.name).toBe('batched-cell-base-shape');
    expect(shapes[0]?.props.listening).toBe(false);
    expect(cells).toHaveLength(2);
    expect(getCellBaseRects(renderer)).toHaveLength(0);
  });

  it('passes old cell-local Rect coordinates to the batched Shape without extra transforms', () => {
    const renderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2
    });
    const shape = getBatchedCellBaseShapes(renderer)[0];
    const cells = getBatchedCellBaseCells(renderer);

    expect(shape?.props.x).toBeUndefined();
    expect(shape?.props.y).toBeUndefined();
    expect(shape?.props.offsetX).toBeUndefined();
    expect(shape?.props.offsetY).toBeUndefined();
    expect(shape?.props.rotation).toBeUndefined();
    expect(cells.map((cell) => cell.geometry)).toEqual([
      { x: 0.5, y: 4.5, width: 99, height: 71 },
      { x: 100.5, y: 4.5, width: 99, height: 71 }
    ]);
  });

  it('keeps no-overlays diagnostics from removing the batched base surface', () => {
    const renderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2,
      diagnosticsFlags: {
        labels: 'normal',
        hitTest: 'normal',
        cells: 'normal',
        cellOverlays: 'off',
        enableProductionCellCulling: true,
        rackLayerRenderer: 'layer'
      }
    });
    const shapes = getBatchedCellBaseShapes(renderer);

    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.props.disableStroke).toBe(true);
    expect(getBatchedCellBaseCells(renderer)).toHaveLength(2);
    expect(
      getRects(renderer).some((rect) =>
        [
          'cell-truth-overlay',
          'cell-outline-overlay',
          'cell-halo-overlay',
          'cell-badge'
        ].includes(String(rect.props.wosRectRole))
      )
    ).toBe(false);
    expect(countInteractionRects(renderer)).toBe(2);
  });

  it('keeps base and hit rects mounted while hiding cell outlines during active pan', () => {
    const renderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2,
      selectedCellId: 'cell-level-only-1',
      isActivelyPanning: true
    });

    expect(getBatchedCellBaseShapes(renderer)).toHaveLength(1);
    expect(getBatchedCellBaseCells(renderer)).toHaveLength(2);
    expect(countInteractionRects(renderer)).toBe(2);
    expect(getCellOutlineRoleRects(renderer)).toHaveLength(1);
    expect(getCellOutlineRoleRects(renderer)[0]?.props.visible).toBe(false);
  });

  it('keeps all cells mounted for the focused rack even when production culling would clip the far slots', () => {
    const cullingViewport = {
      canvasOffset: { x: 0, y: 0 },
      viewport: { width: 100, height: 100 },
      zoom: 1
    };
    const wideGeometry = {
      ...geometry,
      width: 1000,
      faceAWidth: 1000,
      faceBWidth: 1000,
      centerX: 500
    };

    const unselectedRenderer = renderRackCellsWithProps({
      geometryOverride: wideGeometry,
      slotCount: 4,
      diagnosticsViewport: cullingViewport,
      isSelected: false
    });
    const selectedRenderer = renderRackCellsWithProps({
      geometryOverride: wideGeometry,
      slotCount: 4,
      diagnosticsViewport: cullingViewport,
      forceRenderAllCells: true
    });

    expect(getBatchedCellBaseCells(unselectedRenderer)).toHaveLength(2);
    expect(getBatchedCellBaseCells(selectedRenderer)).toHaveLength(4);
  });

  it('uses equal displayed-band bounds for activeLevelIndex 0 and 1 on same multi-level rack', () => {
    const level0Bounds = getCellBounds(0, threeLevelIds);
    const level1Bounds = getCellBounds(1, threeLevelIds);

    expect(level0Bounds).not.toBeNull();
    expect(level1Bounds).not.toBeNull();
    expect(level0Bounds).toEqual(level1Bounds);
  });

  it('uses the same single-displayed-level footprint rule for 1-level and 3-level racks', () => {
    const oneLevelBounds = getCellBounds(0, ['level-only']);
    const threeLevelBounds = getCellBounds(0, threeLevelIds);

    expect(oneLevelBounds).not.toBeNull();
    expect(threeLevelBounds).not.toBeNull();
    expect(oneLevelBounds).toEqual(threeLevelBounds);
  });

  it('renders no cells for out-of-range activeLevelIndex without fallback', () => {
    const bounds = getCellBounds(99, threeLevelIds);
    expect(bounds).toBeNull();
  });

  it('handles empty semanticLevels input gracefully by rendering no cells', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(RackCells, {
          geometry,
          rackId: 'rack-1',
          faceA: createFace(threeLevelIds),
          faceB: null,
          isSelected: true,
          rackRotationDeg: 0,
          activeLevelIndex: 0,
          semanticLevels: [],
          publishedCellsByStructure: createCellsMap(threeLevelIds),
          isInteractive: false,
          onCellClick: () => undefined,
          showCellNumbers: true,
          showFocusedFullAddress: true
        })
      );
    });

    const clickableRects = renderer.root
      .findAll((node) => String(node.type) === 'Rect')
      .filter((node) => typeof node.props.onClick === 'function');
    expect(clickableRects).toHaveLength(0);
  });

  it('keeps sparse published levels clickable when the resolved semantic level maps to index 1', () => {
    const clicked: string[] = [];
    const sparseFace: RackFace = {
      ...createFace(['level-1', 'level-3', 'level-5']),
      sections: [
        {
          ...createFace(['level-1', 'level-3', 'level-5']).sections[0],
          levels: [
            { id: 'level-1', ordinal: 1, slotCount: 2 },
            { id: 'level-3', ordinal: 3, slotCount: 2 },
            { id: 'level-5', ordinal: 5, slotCount: 2 }
          ]
        }
      ]
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(RackCells, {
          geometry,
          rackId: 'rack-1',
          faceA: sparseFace,
          faceB: null,
          isSelected: true,
          rackRotationDeg: 0,
          activeLevelIndex: 1,
          semanticLevels: [1, 3, 5],
          publishedCellsByStructure: createCellsMap([
            'level-1',
            'level-3',
            'level-5'
          ]),
          isInteractive: true,
          onCellClick: (cellId: string) => clicked.push(cellId),
          showCellNumbers: true,
          showFocusedFullAddress: true
        })
      );
    });

    for (const rectNode of renderer.root.findAll(
      (node) => String(node.type) === 'Rect'
    )) {
      if (typeof rectNode.props.onClick === 'function') {
        act(() => {
          rectNode.props.onClick({
            cancelBubble: false,
            evt: { clientX: 0, clientY: 0 }
          });
        });
      }
    }

    expect(clicked).toEqual(['cell-level-3-1', 'cell-level-3-2']);
  });

  it('renders no cells when no rack level is resolved yet', () => {
    const clicked = clickCellIdsWithCollector(null, threeLevelIds);
    expect(clicked).toEqual([]);
  });

  it('renders slot numbers when cell geometry fits', () => {
    const renderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2
    });
    const labels = getTextValuesByOwner(renderer, 'slot-label').filter(
      (value) => /^\d+$/.test(value)
    );
    expect(labels).toEqual(['1', '2']);
  });

  it('respects slot numbering direction when rendering slot labels', () => {
    const ltrRenderer = renderRackCellsWithProps({
      faceA: createFace(['level-only'], { slotCount: 2, direction: 'ltr' }),
      slotCount: 2
    });
    const rtlRenderer = renderRackCellsWithProps({
      faceA: createFace(['level-only'], { slotCount: 2, direction: 'rtl' }),
      slotCount: 2
    });

    const ltrLabels = getTextValuesByOwner(ltrRenderer, 'slot-label').filter(
      (value) => /^\d+$/.test(value)
    );
    const rtlLabels = getTextValuesByOwner(rtlRenderer, 'slot-label').filter(
      (value) => /^\d+$/.test(value)
    );

    expect(ltrLabels).toEqual(['1', '2']);
    expect(rtlLabels).toEqual(['2', '1']);
  });

  it('reveals full address only for selected cells, not globally', () => {
    const renderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2,
      selectedCellId: 'cell-level-only-1'
    });
    const addressLabels = getTextValuesByOwner(
      renderer,
      'focused-address-label'
    ).filter((value) => value.startsWith('ADDR-'));
    expect(addressLabels).toEqual(['ADDR-level-only-1']);
    const slotOwnerAddresses = getTextValuesByOwner(
      renderer,
      'slot-label'
    ).filter((value) => value.startsWith('ADDR-'));
    expect(slotOwnerAddresses).toEqual([]);
  });

  it('reveals full address for highlighted cells', () => {
    const renderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2,
      highlightedCellIds: new Set(['cell-level-only-2'])
    });
    const addressLabels = getTextValuesByOwner(
      renderer,
      'focused-address-label'
    ).filter((value) => value.startsWith('ADDR-'));
    expect(addressLabels).toEqual(['ADDR-level-only-2']);
  });

  it('keeps focused full-address reveal independent from cell-number stage gate', () => {
    const renderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2,
      selectedCellId: 'cell-level-only-1',
      showCellNumbers: false
    });

    const slotLabels = getTextValuesByOwner(renderer, 'slot-label').filter(
      (value) => /^\d+$/.test(value)
    );
    const addressLabels = getTextValuesByOwner(
      renderer,
      'focused-address-label'
    ).filter((value) => value.startsWith('ADDR-'));

    expect(slotLabels).toEqual([]);
    expect(addressLabels).toEqual(['ADDR-level-only-1']);
  });

  it('counter-rotates slot labels to stay horizontal in vertical racks', () => {
    const renderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2,
      showCellNumbers: true
    });

    let verticalRenderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      verticalRenderer = TestRenderer.create(
        createElement(RackCells, {
          geometry,
          rackId: 'rack-1',
          faceA: createFace(['level-only'], { slotCount: 2 }),
          faceB: null,
          isSelected: true,
          rackRotationDeg: 90,
          activeLevelIndex: 0,
          publishedCellsByStructure: createCellsMap(['level-only'], 2),
          isInteractive: false,
          onCellClick: () => undefined,
          showCellNumbers: true,
          showFocusedFullAddress: true
        })
      );
    });

    const rotators = verticalRenderer.root.findAll(
      (node) =>
        String(node.type) === 'Group' &&
        node.props.name === 'slot-label-rotator'
    );
    expect(rotators.length).toBeGreaterThan(0);
    for (const node of rotators) {
      expect(node.props.rotation).toBe(-90);
    }

    const baselineRotators = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Group' &&
        node.props.name === 'slot-label-rotator'
    );
    for (const node of baselineRotators) {
      expect(Math.abs(Number(node.props.rotation))).toBe(0);
    }
  });

  it('counter-rotates focused full-address labels for 90/180/270 while keeping anchor pivot stable', () => {
    const selectedCellId = 'cell-level-only-1';
    const baseRenderer = renderRackCellsWithProps({
      levelIds: ['level-only'],
      slotCount: 2,
      selectedCellId,
      rackRotationDeg: 0
    });

    const baseRotator = baseRenderer.root.find(
      (node) =>
        String(node.type) === 'Group' &&
        node.props.name === 'focused-address-label-rotator'
    );
    const baseAnchor = {
      x: Number(baseRotator.props.x),
      y: Number(baseRotator.props.y)
    };
    expect(Math.abs(Number(baseRotator.props.rotation))).toBe(0);

    for (const rotation of [90, 180, 270] as const) {
      const rotatedRenderer = renderRackCellsWithProps({
        levelIds: ['level-only'],
        slotCount: 2,
        selectedCellId,
        rackRotationDeg: rotation
      });
      const rotator = rotatedRenderer.root.find(
        (node) =>
          String(node.type) === 'Group' &&
          node.props.name === 'focused-address-label-rotator'
      );
      expect(Number(rotator.props.rotation)).toBe(-rotation);
      expect(Number(rotator.props.x)).toBe(baseAnchor.x);
      expect(Number(rotator.props.y)).toBe(baseAnchor.y);
    }
  });

  it('hides labels cleanly when geometry is too small while keeping cell rendering', () => {
    const renderer = renderRackCellsWithProps({
      geometryOverride: {
        ...geometry,
        width: 12,
        faceAWidth: 12
      },
      levelIds: ['level-only'],
      slotCount: 2
    });
    const labels = getTextValues(renderer);
    expect(labels).toHaveLength(0);
    expect(getBatchedCellBaseCells(renderer).length).toBeGreaterThan(0);
  });

  it('keeps cell click behavior unchanged when labels are present', () => {
    const clicked = clickCellIdsWithCollector(0, ['level-only']);
    expect(clicked).toEqual(['cell-level-only-1', 'cell-level-only-2']);
  });

  it('culls offscreen cells in the default production path', () => {
    const renderer = renderRackCellsWithProps({
      geometryOverride: {
        ...geometry,
        x: 1000,
        centerX: 1100
      },
      diagnosticsViewport: TEST_DIAGNOSTICS_VIEWPORT
    });

    expect(countInteractionRects(renderer)).toBe(0);
    expect(getBatchedCellBaseCells(renderer)).toHaveLength(0);
    expect(getTextValuesByOwner(renderer, 'slot-label')).toEqual([]);
  });

  it('renders all cells when the internal unculled safety path is active', () => {
    const renderer = renderRackCellsWithProps({
      geometryOverride: {
        ...geometry,
        x: 1000,
        centerX: 1100
      },
      diagnosticsFlags: UNCLIPPED_DIAGNOSTICS_FLAGS,
      diagnosticsViewport: TEST_DIAGNOSTICS_VIEWPORT
    });

    expect(countInteractionRects(renderer)).toBe(2);
    expect(getBatchedCellBaseCells(renderer)).toHaveLength(2);
    expect(
      getTextValuesByOwner(renderer, 'slot-label').filter((value) =>
        /^\d+$/.test(value)
      )
    ).toEqual(['1', '2']);
  });

  it('force-renders selected, locate-target, and workflow-source cells outside the viewport', () => {
    for (const forcedProps of [
      { selectedCellId: 'cell-level-only-1' },
      { locateTargetCellId: 'cell-level-only-1' },
      { workflowSourceCellId: 'cell-level-only-1' }
    ]) {
      const renderer = renderRackCellsWithProps({
        geometryOverride: {
          ...geometry,
          x: 1000,
          centerX: 1100
        },
        diagnosticsViewport: TEST_DIAGNOSTICS_VIEWPORT,
        ...forcedProps
      });

      expect(countInteractionRects(renderer)).toBe(1);
      expect(getBatchedCellBaseCells(renderer)).toHaveLength(1);
    }
  });

  it('records aggregate culling metrics for rendered RackCells faces', () => {
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn()
    });
    resetCanvasCullingMetrics();

    renderRackCellsWithProps({
      geometryOverride: {
        ...geometry,
        x: 1000,
        centerX: 1100
      },
      selectedCellId: 'cell-level-only-1',
      diagnosticsViewport: TEST_DIAGNOSTICS_VIEWPORT
    });

    expect(window.__WOS_CANVAS_CULLING_METRICS__).toEqual({
      cellsTotal: 2,
      cellsRendered: 1,
      cellsCulled: 1,
      cullingRatio: 0.5
    });
  });

  it('culls labels with their parent cells without globally disabling labels', () => {
    const hiddenRenderer = renderRackCellsWithProps({
      geometryOverride: {
        ...geometry,
        x: 1000,
        centerX: 1100
      },
      diagnosticsViewport: TEST_DIAGNOSTICS_VIEWPORT
    });
    const visibleRenderer = renderRackCellsWithProps({
      geometryOverride: {
        ...geometry,
        x: -350,
        centerX: -250
      },
      diagnosticsViewport: TEST_DIAGNOSTICS_VIEWPORT
    });

    expect(getTextValuesByOwner(hiddenRenderer, 'slot-label')).toEqual([]);
    expect(
      getTextValuesByOwner(visibleRenderer, 'slot-label').filter((value) =>
        /^\d+$/.test(value)
      )
    ).toEqual(['2']);
  });
});

const TEST_PALETTE: CellVisualPalette = {
  baseFill: 'base-fill',
  baseStroke: 'base-stroke',
  occupiedFill: 'occupied-fill',
  occupiedStroke: 'occupied-stroke',
  selectedFill: 'selected-fill',
  selectedStroke: 'selected-stroke',
  focusedFill: 'focused-fill',
  focusedStroke: 'focused-stroke',
  locateTargetFill: 'locate-target-fill',
  locateTargetStroke: 'locate-target-stroke',
  searchHitFill: 'search-hit-fill',
  searchHitStroke: 'search-hit-stroke',
  workflowSourceFill: 'workflow-source-fill',
  workflowSourceStroke: 'workflow-source-stroke',
  blockedFill: 'blocked-fill',
  blockedStroke: 'blocked-stroke',
  reservedDot: 'reserved-dot',
  stockedFill: 'stocked-fill',
  stockedStroke: 'stocked-stroke',
  pickActiveFill: 'pick-active-fill',
  pickActiveStroke: 'pick-active-stroke',
  reservedFill: 'reserved-fill',
  reservedStroke: 'reserved-stroke',
  quarantinedFill: 'quarantined-fill',
  quarantinedStroke: 'quarantined-stroke',
  emptyFill: 'empty-fill',
  emptyStroke: 'empty-stroke'
};

function resolveVisual(
  overrides: Partial<Parameters<typeof resolveCellVisualState>[0]> = {}
) {
  return resolveCellVisualState(
    {
      isInteractive: true,
      isWorkflowScope: false,
      isRackPassive: false,
      isRackSelected: false,
      hasCellIdentity: true,
      isSelected: false,
      isFocused: false,
      isLocateTarget: false,
      isWorkflowSource: false,
      isSearchHit: false,
      isOccupiedByFallback: false,
      runtimeStatus: null,
      ...overrides
    },
    TEST_PALETTE
  );
}

describe('rack-cells visual-state channel ownership', () => {
  it('selected keeps canonical fill and adds outline only', () => {
    const visual = resolveVisual({
      isSelected: true,
      runtimeStatus: 'reserved'
    });
    expect(visual.surface.fill).toBe('reserved-fill');
    expect(visual.surface.stroke).toBe('reserved-stroke');
    expect(visual.outline).toEqual({
      fill: null,
      stroke: 'selected-stroke',
      strokeWidth: 2.1
    });
    expect(visual.halo).toBeNull();
    expect(visual.badge).toBeNull();
  });

  it('locate-target wins the halo slot over search-hit', () => {
    const visual = resolveVisual({
      isLocateTarget: true,
      isSearchHit: true,
      runtimeStatus: 'stocked'
    });
    expect(visual.halo).toEqual({
      fill: 'locate-target-fill',
      stroke: 'locate-target-stroke',
      strokeWidth: 2.6
    });
  });

  it('workflow-source occupies the badge slot without changing fill', () => {
    const visual = resolveVisual({
      isWorkflowSource: true,
      runtimeStatus: 'quarantined'
    });
    expect(visual.surface.fill).toBe('quarantined-fill');
    expect(visual.badge).toEqual({
      fill: 'workflow-source-fill',
      stroke: 'workflow-source-stroke',
      strokeWidth: 1,
      dash: [3, 2]
    });
  });

  it('invalid-target uses badge-only ownership and preserves canonical occupied surface', () => {
    const visual = resolveVisual({
      isWorkflowScope: true,
      isOccupiedByFallback: true
    });
    expect(visual.surface.fill).toBe('occupied-fill');
    expect(visual.surface.stroke).toBe('occupied-stroke');
    expect(visual.badge).toEqual({
      fill: 'blocked-fill',
      stroke: 'blocked-stroke',
      strokeWidth: 1
    });
    expect(visual.isClickable).toBe(false);
  });

  it('degraded truth adds a marker only and does not rewrite fill', () => {
    const visual = resolveVisual({
      isOccupiedByFallback: true
    });
    expect(visual.surface.fill).toBe('occupied-fill');
    expect(visual.truthMarker).toEqual({
      kind: 'degraded',
      color: 'occupied-stroke'
    });
  });
});

type LayeredRenderOptions = {
  runtimeStatus?:
    | 'stocked'
    | 'pick_active'
    | 'reserved'
    | 'quarantined'
    | 'empty'
    | null;
  selected?: boolean;
  locateTarget?: boolean;
  searchHit?: boolean;
  workflowSource?: boolean;
  occupied?: boolean;
  workflowScope?: boolean;
  interactive?: boolean;
  missingCellIdentity?: boolean;
};

const CELL_FILL_A_RACK_SELECTED = 'rgba(45, 118, 168, 0.1)';
const CELL_STROKE_A_RACK_SELECTED = '#5c92bb';
const CELL_STROKE_SELECTED = '#0f6a8e';
const CELL_FILL_LOCATE_TARGET = 'rgba(0, 122, 92, 0.18)';
const CELL_STROKE_LOCATE_TARGET = '#007a5c';
const CELL_FILL_SEARCH_HIT = 'rgba(211, 141, 0, 0.14)';
const CELL_FILL_WORKFLOW_SOURCE = 'rgba(86, 44, 145, 0.14)';
const CELL_STROKE_WORKFLOW_SOURCE = '#6b46c1';
const CELL_FILL_LOCKED = 'rgba(120, 61, 18, 0.16)';
const CELL_STROKE_LOCKED = '#9a5d1b';
const CELL_FILL_STOCKED = 'rgba(0, 122, 92, 0.14)';
const CELL_STROKE_STOCKED = '#218367';
const CELL_FILL_RESERVED = 'rgba(178, 156, 224, 0.34)';
const CELL_STROKE_RESERVED = '#7b67ad';
const CELL_FILL_RESERVED_DOT = 'rgba(92, 71, 143, 0.28)';

function createSingleSlotFace(levelId: string): RackFace {
  return {
    id: 'face-a',
    side: 'A',
    enabled: true,
    slotNumberingDirection: 'ltr',
    isMirrored: false,
    mirrorSourceFaceId: null,
    sections: [
      {
        id: 'section-a',
        ordinal: 1,
        length: 5,
        levels: [{ id: levelId, ordinal: 1, slotCount: 1 }]
      }
    ]
  };
}

function createSingleSlotCellsMap(levelId: string, includeCell: boolean) {
  const byStructure = new Map<string, Cell>();
  if (!includeCell) return byStructure;
  byStructure.set(
    buildCellStructureKey({
      rackId: 'rack-1',
      rackFaceId: 'face-a',
      rackSectionId: 'section-a',
      rackLevelId: levelId,
      slotNo: 1
    }),
    { id: `cell-${levelId}-1` } as Cell
  );
  return byStructure;
}

function renderLayeredCell(options: LayeredRenderOptions = {}) {
  const levelId = 'level-only';
  const cellId = `cell-${levelId}-1`;
  const cellsMap = createSingleSlotCellsMap(
    levelId,
    !options.missingCellIdentity
  );
  const occupiedCellIds = options.occupied
    ? new Set<string>([cellId])
    : new Set<string>();
  const highlightedCellIds = options.searchHit
    ? new Set<string>([cellId])
    : new Set<string>();
  const cellRuntimeById = new Map<string, OperationsCellRuntime>(
    options.runtimeStatus
      ? [[cellId, { status: options.runtimeStatus } as OperationsCellRuntime]]
      : []
  );
  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(
      createElement(RackCells, {
        geometry,
        rackId: 'rack-1',
        faceA: createSingleSlotFace(levelId),
        faceB: null,
        isSelected: true,
        activeLevelIndex: 0,
        publishedCellsByStructure: cellsMap,
        occupiedCellIds,
        highlightedCellIds,
        cellRuntimeById,
        isWorkflowScope: options.workflowScope ?? false,
        isInteractive: options.interactive ?? true,
        selectedCellId: options.selected ? cellId : '__none__',
        locateTargetCellId: options.locateTarget ? cellId : null,
        workflowSourceCellId: options.workflowSource ? cellId : null,
        onCellClick: () => undefined
      })
    );
  });

  return renderer;
}

function getRects(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll((node) => String(node.type) === 'Rect');
}

function getHitRects(renderer: TestRenderer.ReactTestRenderer) {
  return getRects(renderer).filter(
    (rect) =>
      rect.props.opacity === 0 &&
      rect.props.fillEnabled === false &&
      rect.props.strokeEnabled === false
  );
}

function getSurfaceRects(renderer: TestRenderer.ReactTestRenderer) {
  return getRects(renderer).filter(
    (rect) => rect.props.cornerRadius === 1 && Number(rect.props.width) > 100
  );
}

function getSurfaceCells(renderer: TestRenderer.ReactTestRenderer) {
  return getBatchedCellBaseCells(renderer);
}

function getOutlineRects(renderer: TestRenderer.ReactTestRenderer) {
  return getSurfaceRects(renderer).filter(
    (rect) =>
      rect.props.strokeEnabled === true && rect.props.fillEnabled !== true
  );
}

function getCellOutlineRoleRects(renderer: TestRenderer.ReactTestRenderer) {
  return getRects(renderer).filter(
    (rect) => rect.props.wosRectRole === 'cell-outline-overlay'
  );
}

function getHaloRects(renderer: TestRenderer.ReactTestRenderer) {
  return getRects(renderer).filter(
    (rect) => Number(rect.props.cornerRadius) >= 2
  );
}

function getBadgeRects(renderer: TestRenderer.ReactTestRenderer) {
  return getRects(renderer).filter(
    (rect) =>
      rect.props.cornerRadius === 1 &&
      Number(rect.props.width) <= 40 &&
      rect.props.opacity === 1
  );
}

function getTruthMarkerRects(renderer: TestRenderer.ReactTestRenderer) {
  return getRects(renderer).filter(
    (rect) =>
      rect.props.cornerRadius === 0.6 ||
      (Number(rect.props.width) < 100 &&
        rect.props.fillEnabled === false &&
        rect.props.strokeEnabled === true &&
        Number(rect.props.opacity) >= 0.8 &&
        Number(rect.props.opacity) < 1)
  );
}

function getDotCircles(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(
    (node) =>
      String(node.type) === 'Circle' &&
      node.props.fill === CELL_FILL_RESERVED_DOT
  );
}

describe('RackCells layered paint ownership', () => {
  it('selected + runtime renders surface plus outline only and keeps clickability', () => {
    const renderer = renderLayeredCell({
      selected: true,
      runtimeStatus: 'reserved'
    });

    const surfaceCells = getSurfaceCells(renderer);
    const outlineRects = getOutlineRects(renderer);
    const hitRects = getHitRects(renderer);

    expect(surfaceCells.map((cell) => cell.visualState.surface.fill)).toContain(
      CELL_FILL_RESERVED
    );
    expect(surfaceCells.map((cell) => cell.visualState.surface.fill)).not.toContain(
      'selected-fill'
    );
    expect(getDotCircles(renderer).length).toBeGreaterThan(0);
    expect(outlineRects.map((rect) => rect.props.stroke)).toContain(
      CELL_STROKE_SELECTED
    );
    expect(getHaloRects(renderer)).toHaveLength(0);
    expect(getBadgeRects(renderer)).toHaveLength(0);
    expect(hitRects).toHaveLength(1);
    expect(typeof hitRects[0]?.props.onClick).toBe('function');
  });

  it('selected + locate-target renders independent outline and locate halo', () => {
    const renderer = renderLayeredCell({
      selected: true,
      locateTarget: true,
      runtimeStatus: 'reserved'
    });
    const haloRects = getHaloRects(renderer);
    const surfaceCell = getSurfaceCells(renderer)[0];

    expect(getDotCircles(renderer).length).toBeGreaterThan(0);
    expect(
      getOutlineRects(renderer).map((rect) => rect.props.stroke)
    ).toContain(CELL_STROKE_SELECTED);
    expect(haloRects.map((rect) => rect.props.fill)).toContain(
      CELL_FILL_LOCATE_TARGET
    );
    expect(haloRects[0]?.props.strokeScaleEnabled).toBe(false);
    expect(haloRects[0]?.props.strokeWidth).toBe(2.6);
    expect(Number(haloRects[0]?.props.x)).toBeLessThan(
      Number(surfaceCell?.geometry.x)
    );
    expect(Number(haloRects[0]?.props.width)).toBeGreaterThan(
      Number(surfaceCell?.geometry.width)
    );
  });

  it('selected + search-hit renders independent outline and search halo', () => {
    const renderer = renderLayeredCell({
      selected: true,
      searchHit: true,
      runtimeStatus: 'reserved'
    });

    expect(getDotCircles(renderer).length).toBeGreaterThan(0);
    expect(
      getOutlineRects(renderer).map((rect) => rect.props.stroke)
    ).toContain(CELL_STROKE_SELECTED);
    expect(getHaloRects(renderer).map((rect) => rect.props.fill)).toContain(
      CELL_FILL_SEARCH_HIT
    );
  });

  it('locate-target suppresses search-hit in the halo slot', () => {
    const renderer = renderLayeredCell({
      locateTarget: true,
      searchHit: true,
      runtimeStatus: 'stocked'
    });

    expect(getHaloRects(renderer).map((rect) => rect.props.fill)).toEqual([
      CELL_FILL_LOCATE_TARGET
    ]);
    expect(getHaloRects(renderer).map((rect) => rect.props.stroke)).toEqual([
      CELL_STROKE_LOCATE_TARGET
    ]);
  });

  it('invalid-target uses a badge and does not repaint the main surface', () => {
    const renderer = renderLayeredCell({
      workflowScope: true,
      occupied: true
    });

    const surfaceCells = getSurfaceCells(renderer);
    const badgeRects = getBadgeRects(renderer);
    const hitRects = getHitRects(renderer);

    expect(surfaceCells.map((cell) => cell.visualState.surface.fill)).toContain(
      CELL_FILL_STOCKED
    );
    expect(surfaceCells.map((cell) => cell.visualState.surface.stroke)).toContain(
      CELL_STROKE_STOCKED
    );
    expect(badgeRects.map((rect) => rect.props.fill)).toContain(
      CELL_FILL_LOCKED
    );
    expect(badgeRects.map((rect) => rect.props.stroke)).toContain(
      CELL_STROKE_LOCKED
    );
    expect(hitRects).toHaveLength(1);
    expect(hitRects[0]?.props.onClick).toBeUndefined();
  });

  it('workflow-source renders a badge only', () => {
    const renderer = renderLayeredCell({
      workflowSource: true,
      runtimeStatus: 'stocked'
    });

    expect(getBadgeRects(renderer).map((rect) => rect.props.fill)).toContain(
      CELL_FILL_WORKFLOW_SOURCE
    );
    expect(getBadgeRects(renderer).map((rect) => rect.props.stroke)).toContain(
      CELL_STROKE_WORKFLOW_SOURCE
    );
  });

  it('degraded truth adds an internal marker without changing the occupied surface', () => {
    const renderer = renderLayeredCell({
      occupied: true
    });

    const surfaceCells = getSurfaceCells(renderer);
    const truthMarkerRects = getTruthMarkerRects(renderer);

    expect(surfaceCells.map((cell) => cell.visualState.surface.fill)).toContain(
      CELL_FILL_STOCKED
    );
    expect(truthMarkerRects.length).toBeGreaterThan(0);
  });

  it('unknown truth keeps the base surface and adds only an internal marker', () => {
    const renderer = renderLayeredCell();

    const surfaceCells = getSurfaceCells(renderer);
    const truthMarkerRects = getRects(renderer).filter(
      (rect) =>
        rect.props.fillEnabled === false &&
        typeof rect.props.stroke === 'string' &&
        Number(rect.props.opacity) === 0.82
    );

    expect(surfaceCells.map((cell) => cell.visualState.surface.fill)).toContain(
      CELL_FILL_A_RACK_SELECTED
    );
    expect(truthMarkerRects.length).toBeGreaterThan(0);
    expect(truthMarkerRects[0]?.props.fillEnabled).toBe(false);
    expect(getHaloRects(renderer)).toHaveLength(0);
    expect(getBadgeRects(renderer)).toHaveLength(0);
  });

  it('reserved renders dot decoration as part of the surface treatment', () => {
    const renderer = renderLayeredCell({
      runtimeStatus: 'reserved'
    });

    const surfaceCells = getSurfaceCells(renderer);

    expect(surfaceCells.map((cell) => cell.visualState.surface.fill)).toContain(
      CELL_FILL_RESERVED
    );
    expect(surfaceCells.map((cell) => cell.visualState.surface.stroke)).toContain(
      CELL_STROKE_RESERVED
    );
    expect(getDotCircles(renderer).length).toBeGreaterThan(0);
    expect(getHaloRects(renderer)).toHaveLength(0);
    expect(getBadgeRects(renderer)).toHaveLength(0);
  });

  it('reserved + locate-target keeps the reserved surface and adds halo only', () => {
    const renderer = renderLayeredCell({
      runtimeStatus: 'reserved',
      locateTarget: true
    });

    expect(getDotCircles(renderer).length).toBeGreaterThan(0);
    expect(getHaloRects(renderer).map((rect) => rect.props.fill)).toContain(
      CELL_FILL_LOCATE_TARGET
    );
    expect(getBadgeRects(renderer)).toHaveLength(0);
  });

  it('drops reserved dots below the small-cell threshold while keeping the reserved fill', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(CellSurfaceVisual, {
          geometry: {
            x: 0,
            y: 0,
            width: 9,
            height: 11
          },
          visualState: resolveVisual({
            runtimeStatus: 'reserved'
          })
        })
      );
    });

    const filledRects = getRects(renderer).filter(
      (rect) => rect.props.fillEnabled === true
    );

    expect(filledRects.map((rect) => rect.props.fill)).toContain(
      'reserved-fill'
    );
    expect(getDotCircles(renderer)).toHaveLength(0);
  });

  it('missing cell identity keeps base visuals and no click handler', () => {
    const renderer = renderLayeredCell({
      missingCellIdentity: true
    });
    const surfaceCells = getSurfaceCells(renderer);
    const hitRects = getHitRects(renderer);

    expect(surfaceCells).toHaveLength(1);
    expect(surfaceCells[0]?.visualState.surface.fill).toBe(
      CELL_FILL_A_RACK_SELECTED
    );
    expect(surfaceCells[0]?.visualState.surface.stroke).toBe(
      CELL_STROKE_A_RACK_SELECTED
    );
    expect(surfaceCells[0]?.visualState.opacity).toBe(0.18);
    expect(hitRects).toHaveLength(1);
    expect(hitRects[0]?.props.onClick).toBeUndefined();
  });
});
