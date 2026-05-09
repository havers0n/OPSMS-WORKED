import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import {
  buildCellStructureKey,
  type Cell,
  type Rack,
  type RackFace
} from '@wos/domain';
import { SelectionOverlayLayer } from './selection-overlay-layer';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Group', props, children),
  Circle: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Circle', props, children),
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
        levels: [{ id: 'level-only', ordinal: 1, slotCount: 2 }]
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
      raw: `ADDR-${slotNo}`,
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
  return {
    byId: new Map(cells.map((cell) => [cell.id, cell])),
    byStructure: new Map(
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
    )
  };
}

function renderSelectionOverlay(params: {
  selectedCellId: string | null;
  highlightedCellId?: string | null;
  showFocusedFullAddress?: boolean;
}) {
  const rack = createRack();
  const cells = indexCells([createCell(1), createCell(2)]);
  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(
      createElement(SelectionOverlayLayer, {
        selectedCellId: params.selectedCellId,
        highlightedCellId: params.highlightedCellId ?? null,
        racks: [rack],
        primarySelectedRackId: rack.id,
        selectedRackActiveLevel: 0,
        publishedCellsById: cells.byId,
        publishedCellsByStructure: cells.byStructure,
        showFocusedFullAddress: params.showFocusedFullAddress ?? true,
        isActivelyPanning: false
      })
    );
  });

  return renderer;
}

function getOutlineRects(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(
    (node) =>
      String(node.type) === 'Rect' &&
      node.props.wosRectRole === 'cell-outline-overlay'
  );
}

function getFocusedAddressLabels(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(
    (node) =>
      String(node.type) === 'Text' &&
      node.props.name === 'focused-address-label'
  );
}

function getHaloRects(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(
    (node) =>
      String(node.type) === 'Rect' &&
      node.props.wosRectRole === 'cell-halo-overlay'
  );
}

describe('SelectionOverlayLayer', () => {
  it('renders one selected outline for a selected cell id', () => {
    const renderer = renderSelectionOverlay({ selectedCellId: 'cell-1' });

    const outlines = getOutlineRects(renderer);
    expect(outlines).toHaveLength(1);
    expect(outlines[0]?.props.x).toBe(0.5);
    expect(outlines[0]?.props.y).toBe(4.5);
    expect(outlines[0]?.props.width).toBe(99);
    expect(outlines[0]?.props.height).toBe(71);
  });

  it('renders no selected overlay without a selected cell id', () => {
    const renderer = renderSelectionOverlay({ selectedCellId: null });

    expect(getOutlineRects(renderer)).toHaveLength(0);
    expect(getHaloRects(renderer)).toHaveLength(0);
  });

  it('renders one highlighted halo for a highlighted cell id', () => {
    const renderer = renderSelectionOverlay({
      selectedCellId: 'cell-1',
      highlightedCellId: 'cell-1'
    });

    const halos = getHaloRects(renderer);
    expect(halos).toHaveLength(1);
    expect(halos[0]?.props.x).toBe(-0.5);
    expect(halos[0]?.props.y).toBe(3.5);
    expect(halos[0]?.props.width).toBe(101);
    expect(halos[0]?.props.height).toBe(73);
    expect(halos[0]?.props.listening).toBe(false);
  });

  it('keeps overlay groups and nodes non-listening', () => {
    const renderer = renderSelectionOverlay({
      selectedCellId: 'cell-1',
      highlightedCellId: 'cell-1'
    });

    const groups = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Group' &&
        String(node.props.name).startsWith('selection-overlay')
    );
    const outlines = getOutlineRects(renderer);
    const halos = getHaloRects(renderer);

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.props.listening === false)).toBe(true);
    expect(outlines[0]?.props.listening).toBe(false);
    expect(halos[0]?.props.listening).toBe(false);
  });

  it('renders the focused address label only when reveal policy allows it', () => {
    const visibleRenderer = renderSelectionOverlay({
      selectedCellId: 'cell-1',
      showFocusedFullAddress: true
    });
    const hiddenRenderer = renderSelectionOverlay({
      selectedCellId: 'cell-1',
      showFocusedFullAddress: false
    });

    expect(
      getFocusedAddressLabels(visibleRenderer).map((node) => node.props.text)
    ).toEqual(['ADDR-1']);
    expect(getFocusedAddressLabels(hiddenRenderer)).toHaveLength(0);
  });
});
