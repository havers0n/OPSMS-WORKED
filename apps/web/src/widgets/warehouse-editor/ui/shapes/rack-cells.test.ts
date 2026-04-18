import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { buildCellStructureKey, type Cell, type RackFace } from '@wos/domain';
import { RackCells } from './rack-cells';
import { resolveCellVisualState, type CellVisualPalette } from './rack-cells-visual-state';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Group', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Rect', props, children)
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function createFace(levelIds: string[]): RackFace {
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
        levels: levelIds.map((id, idx) => ({
          id,
          ordinal: levelIds.length - idx,
          slotCount: 2
        }))
      }
    ]
  };
}

function createCellsMap(levelIds: string[]) {
  const byStructure = new Map<string, Cell>();

  for (const levelId of levelIds) {
    for (const slotNo of [1, 2]) {
      byStructure.set(
        buildCellStructureKey({
          rackId: 'rack-1',
          rackFaceId: 'face-a',
          rackSectionId: 'section-a',
          rackLevelId: levelId,
          slotNo
        }),
        { id: `cell-${levelId}-${slotNo}` } as Cell
      );
    }
  }

  return byStructure;
}

function renderRackCells(activeLevelIndex: number, levelIds: string[], isInteractive = false) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackCells, {
        geometry,
        rackId: 'rack-1',
        faceA: createFace(levelIds),
        faceB: null,
        isSelected: true,
        activeLevelIndex,
        publishedCellsByStructure: createCellsMap(levelIds),
        isInteractive,
        onCellClick: () => undefined
      })
    );
  });

  return renderer;
}

function clickCellIdsWithCollector(activeLevelIndex: number, levelIds: string[]) {
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
        activeLevelIndex,
        publishedCellsByStructure: createCellsMap(levelIds),
        isInteractive: true,
        onCellClick: (cellId: string) => selected.push(cellId)
      })
    );
  });

  for (const rectNode of renderer.root.findAll((node) => String(node.type) === 'Rect')) {
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

function getCellBounds(activeLevelIndex: number, levelIds: string[]) {
  const renderer = renderRackCells(activeLevelIndex, levelIds, false);
  const rects = renderer.root.findAll((node) => String(node.type) === 'Rect');
  if (rects.length === 0) return null;

  const xMin = Math.min(...rects.map((node) => Number(node.props.x)));
  const yMin = Math.min(...rects.map((node) => Number(node.props.y)));
  const xMax = Math.max(...rects.map((node) => Number(node.props.x) + Number(node.props.width)));
  const yMax = Math.max(...rects.map((node) => Number(node.props.y) + Number(node.props.height)));

  return { xMin, yMin, xMax, yMax };
}

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
          activeLevelIndex: 0,
          semanticLevels: [],
          publishedCellsByStructure: createCellsMap(threeLevelIds),
          isInteractive: false,
          onCellClick: () => undefined
        })
      );
    });

    const clickableRects = renderer.root
      .findAll((node) => String(node.type) === 'Rect')
      .filter((node) => typeof node.props.onClick === 'function');
    expect(clickableRects).toHaveLength(0);
  });

  it('supports sparse semantic levels via explicit semanticLevels mapping', () => {
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
          activeLevelIndex: 1,
          semanticLevels: [1, 3, 5],
          publishedCellsByStructure: createCellsMap(['level-1', 'level-3', 'level-5']),
          isInteractive: true,
          onCellClick: (cellId: string) => clicked.push(cellId)
        })
      );
    });

    for (const rectNode of renderer.root.findAll((node) => String(node.type) === 'Rect')) {
      if (typeof rectNode.props.onClick === 'function') {
        act(() => {
          rectNode.props.onClick({ cancelBubble: false, evt: { clientX: 0, clientY: 0 } });
        });
      }
    }

    expect(clicked).toEqual(['cell-level-3-1', 'cell-level-3-2']);
  });
});

const TEST_PALETTE: CellVisualPalette = {
  baseFill: 'base-fill',
  baseStroke: 'base-stroke',
  occupiedFill: 'occupied-fill',
  occupiedStroke: 'occupied-stroke',
  selectedFill: 'selected-fill',
  selectedStroke: 'selected-stroke',
  workflowSourceFill: 'workflow-source-fill',
  workflowSourceStroke: 'workflow-source-stroke',
  highlightedStroke: 'highlighted-stroke',
  lockedFill: 'locked-fill',
  lockedStroke: 'locked-stroke',
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

function resolveVisual(overrides: Partial<Parameters<typeof resolveCellVisualState>[0]> = {}) {
  return resolveCellVisualState(
    {
      isInteractive: true,
      isWorkflowScope: false,
      isRackPassive: false,
      isRackSelected: false,
      hasCellIdentity: true,
      isSelected: false,
      isWorkflowSource: false,
      isHighlighted: false,
      isOccupiedByFallback: false,
      runtimeStatus: null,
      ...overrides
    },
    TEST_PALETTE
  );
}

describe('rack-cells visual-state precedence', () => {
  it('selected + runtime keeps selected visuals', () => {
    const visual = resolveVisual({ isSelected: true, runtimeStatus: 'reserved' });
    expect(visual.fill).toBe('selected-fill');
    expect(visual.stroke).toBe('selected-stroke');
    expect(visual.strokeWidth).toBe(1.4);
    expect(visual.opacity).toBe(0.98);
  });

  it('selected + occupied keeps selected visuals over occupied fallback', () => {
    const visual = resolveVisual({ isSelected: true, isOccupiedByFallback: true });
    expect(visual.fill).toBe('selected-fill');
    expect(visual.stroke).toBe('selected-stroke');
    expect(visual.strokeWidth).toBe(1.4);
    expect(visual.opacity).toBe(0.98);
  });

  it('highlighted + runtime keeps runtime fill and highlighted stroke', () => {
    const visual = resolveVisual({ isHighlighted: true, runtimeStatus: 'stocked' });
    expect(visual.fill).toBe('stocked-fill');
    expect(visual.stroke).toBe('highlighted-stroke');
    expect(visual.strokeWidth).toBe(1.2);
    expect(visual.opacity).toBe(0.98);
  });

  it('workflow source + runtime keeps workflow source visuals', () => {
    const visual = resolveVisual({ isWorkflowSource: true, runtimeStatus: 'quarantined' });
    expect(visual.fill).toBe('workflow-source-fill');
    expect(visual.stroke).toBe('workflow-source-stroke');
    expect(visual.strokeWidth).toBe(1.2);
    expect(visual.opacity).toBe(0.98);
  });

  it('workflow target locked + occupied uses locked visuals and is not clickable', () => {
    const visual = resolveVisual({
      isWorkflowScope: true,
      isOccupiedByFallback: true
    });
    expect(visual.flags.isWorkflowTargetLocked).toBe(true);
    expect(visual.fill).toBe('locked-fill');
    expect(visual.stroke).toBe('locked-stroke');
    expect(visual.opacity).toBe(0.24);
    expect(visual.isClickable).toBe(false);
  });

  it('passive + runtime keeps runtime colors and passive opacity', () => {
    const visual = resolveVisual({
      isRackPassive: true,
      runtimeStatus: 'pick_active'
    });
    expect(visual.fill).toBe('pick-active-fill');
    expect(visual.stroke).toBe('pick-active-stroke');
    expect(visual.opacity).toBe(0.4);
  });

  it('missing cell identity uses missing-cell opacity and never clickable', () => {
    const visual = resolveVisual({
      hasCellIdentity: false,
      isInteractive: true
    });
    expect(visual.flags.isMissingCellIdentity).toBe(true);
    expect(visual.opacity).toBe(0.18);
    expect(visual.isClickable).toBe(false);
  });

  it('rack selected + empty base uses selected-rack opacity and width without state overrides', () => {
    const visual = resolveVisual({
      isRackSelected: true
    });
    expect(visual.fill).toBe('base-fill');
    expect(visual.stroke).toBe('base-stroke');
    expect(visual.opacity).toBe(0.9);
    expect(visual.strokeWidth).toBe(0.9);
  });

  it('runtime absent + occupied fallback uses occupied fallback visuals', () => {
    const visual = resolveVisual({
      isOccupiedByFallback: true
    });
    expect(visual.fill).toBe('occupied-fill');
    expect(visual.stroke).toBe('occupied-stroke');
    expect(visual.opacity).toBe(0.98);
    expect(visual.strokeWidth).toBe(0.9);
  });
});
