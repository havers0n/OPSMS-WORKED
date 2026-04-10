import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { buildCellStructureKey, type Cell, type RackFace } from '@wos/domain';
import { RackCells } from './rack-cells';

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

  it('renders only level-0 identities when activeLevelIndex=0', () => {
    const clicked = clickCellIdsWithCollector(0, threeLevelIds);
    expect(clicked).toEqual(['cell-level-high-1', 'cell-level-high-2']);
    expect(clicked).not.toContain('cell-level-mid-1');
    expect(clicked).not.toContain('cell-level-mid-2');
    expect(clicked).not.toContain('cell-level-low-1');
    expect(clicked).not.toContain('cell-level-low-2');
  });

  it('renders only level-1 identities when activeLevelIndex=1', () => {
    const clicked = clickCellIdsWithCollector(1, threeLevelIds);
    expect(clicked).toEqual(['cell-level-mid-1', 'cell-level-mid-2']);
    expect(clicked).not.toContain('cell-level-high-1');
    expect(clicked).not.toContain('cell-level-high-2');
    expect(clicked).not.toContain('cell-level-low-1');
    expect(clicked).not.toContain('cell-level-low-2');
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
});
