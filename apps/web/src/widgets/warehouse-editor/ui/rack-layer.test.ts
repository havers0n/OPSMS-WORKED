import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { Rack, RackFace } from '@wos/domain';
import { RackLayer } from './rack-layer';

vi.mock('react-konva', () => ({
  Layer: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Layer', props, children),
  Group: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Group', props, children),
  Line: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Line', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Rect', props, children),
  Text: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Text', props, children)
}));

vi.mock('./shapes/rack-cells', () => ({
  RackCells: (props: Record<string, unknown>) => createElement('RackCells', props)
}));

vi.mock('./shapes/rack-sections', () => ({
  RackSections: (props: Record<string, unknown>) => createElement('RackSections', props)
}));

function createFace(id: string): RackFace {
  return {
    id,
    side: 'A',
    enabled: true,
    slotNumberingDirection: 'ltr',
    isMirrored: false,
    mirrorSourceFaceId: null,
    sections: [
      {
        id: `${id}-section`,
        ordinal: 1,
        length: 5,
        levels: [{ id: `${id}-level-1`, ordinal: 1, slotCount: 2 }]
      }
    ]
  };
}

function createRack(id: string, x: number): Rack {
  return {
    id,
    displayCode: id,
    kind: 'single',
    axis: 'NS',
    x,
    y: 0,
    totalLength: 5,
    depth: 1.2,
    rotationDeg: 0,
    faces: [createFace(`${id}-face-a`)]
  };
}

function renderRackLayer(params: {
  selectedRackIds: string[];
  primarySelectedRackId: string | null;
  selectedRackActiveLevel?: number;
  lod?: 0 | 1 | 2;
  isLayoutMode?: boolean;
  isStorageMode?: boolean;
  canSelectCells?: boolean;
  canSelectRack?: boolean;
  isWorkflowScope?: boolean;
  setSelectedCellId?: (cellId: string | null) => void;
  setSelectedRackIds?: (rackIds: string[]) => void;
  clearHighlightedCellIds?: () => void;
  setPlacementMoveTargetCellId?: (cellId: string | null) => void;
}) {
  const racks = [createRack('rack-1', 0), createRack('rack-2', 10)];
  const rackLookup = Object.fromEntries(racks.map((rack) => [rack.id, rack])) as Record<string, Rack>;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackLayer, {
      activeCellRackId: null,
      canSelectCells: params.canSelectCells ?? false,
      canSelectRack: params.canSelectRack ?? true,
      canvasSelectedCellId: null,
      cellRuntimeById: new Map(),
      clearHighlightedCellIds: params.clearHighlightedCellIds ?? (() => undefined),
      highlightedCellIds: new Set<string>(),
      hoveredRackId: null,
      isLayoutEditable: true,
      isLayoutMode: params.isLayoutMode ?? true,
      isPlacing: false,
      isRackPassiveScopeActive: false,
      isStorageMode: params.isStorageMode ?? false,
      isViewMode: false,
      isWorkflowScope: params.isWorkflowScope ?? false,
      lod: params.lod ?? 2,
      minRackDistance: 0,
      moveSourceCellId: null,
      moveSourceRackId: null,
      occupiedCellIds: new Set<string>(),
      publishedCellsByStructure: new Map(),
      primarySelectedRackId: params.primarySelectedRackId,
      rackLookup,
      racks,
      selectedRackActiveLevel: params.selectedRackActiveLevel ?? 0,
      selectedRackIds: params.selectedRackIds,
      setHighlightedCellIds: () => undefined,
      setHoveredRackId: () => undefined,
      setPlacementMoveTargetCellId: params.setPlacementMoveTargetCellId ?? (() => undefined),
      setSelectedCellId: params.setSelectedCellId ?? (() => undefined),
      setSelectedRackId: () => undefined,
      setSelectedRackIds: params.setSelectedRackIds ?? (() => undefined),
      setSnapGuides: () => undefined,
      toggleRackSelection: () => undefined,
      updateRackPosition: () => undefined
      })
    );
  });
  return renderer;
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('RackLayer high-LOD cell mounting', () => {
  it('renders RackCells for visible unselected racks at high LOD with level 0', () => {
    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null
    });
    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells');
    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.activeLevelIndex).toBe(0);
    expect(rackCells[1]?.props.activeLevelIndex).toBe(0);
  });

  it('renders selected rack with selectedRackActiveLevel and others with level 0', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      selectedRackActiveLevel: 1
    });
    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells');
    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.activeLevelIndex).toBe(1);
    expect(rackCells[1]?.props.rackId).toBe('rack-2');
    expect(rackCells[1]?.props.activeLevelIndex).toBe(0);
  });

  it('uses rackIds[0] as primary in multi-select and keeps non-primary racks at level 0', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1', 'rack-2'],
      primarySelectedRackId: 'rack-1',
      selectedRackActiveLevel: 2
    });
    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells');
    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.activeLevelIndex).toBe(2);
    expect(rackCells[1]?.props.rackId).toBe('rack-2');
    expect(rackCells[1]?.props.activeLevelIndex).toBe(0);
  });

  it('passes invalid selected level index through for the selected rack while keeping others at 0', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      selectedRackActiveLevel: 99
    });
    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells');
    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.activeLevelIndex).toBe(99);
    expect(rackCells[1]?.props.rackId).toBe('rack-2');
    expect(rackCells[1]?.props.activeLevelIndex).toBe(0);
  });
});

describe('RackLayer storage interaction depth', () => {
  it('cell click wins over rack click in storage mode', () => {
    const setSelectedCellId = vi.fn();
    const setSelectedRackIds = vi.fn();
    const clearHighlightedCellIds = vi.fn();

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      isLayoutMode: false,
      isStorageMode: true,
      canSelectCells: true,
      setSelectedCellId,
      setSelectedRackIds,
      clearHighlightedCellIds
    });

    const rackCells = renderer.root.findAllByType('RackCells');
    act(() => {
      rackCells[0].props.onCellClick('cell-1', { x: 10, y: 20 });
    });

    expect(setSelectedCellId).toHaveBeenCalledWith('cell-1');
    expect(setSelectedRackIds).not.toHaveBeenCalled();
    expect(clearHighlightedCellIds).not.toHaveBeenCalled();
  });

  it('rack body click in storage mode selects rack and clears selected cell context', () => {
    const setSelectedCellId = vi.fn();
    const setSelectedRackIds = vi.fn();
    const clearHighlightedCellIds = vi.fn();

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      isLayoutMode: false,
      isStorageMode: true,
      canSelectRack: true,
      setSelectedCellId,
      setSelectedRackIds,
      clearHighlightedCellIds
    });

    const rackGroups = renderer.root.findAll(
      (node) => String(node.type) === 'Group' && typeof node.props.onClick === 'function'
    );

    expect(rackGroups.length).toBeGreaterThan(0);

    act(() => {
      rackGroups[0].props.onClick({ evt: {}, cancelBubble: false });
    });

    expect(clearHighlightedCellIds).toHaveBeenCalledTimes(1);
    expect(setSelectedCellId).toHaveBeenCalledWith(null);
    expect(setSelectedRackIds).toHaveBeenCalledWith(['rack-1']);
  });

  it('storage workflow cell click keeps move-target behavior', () => {
    const setPlacementMoveTargetCellId = vi.fn();
    const setSelectedCellId = vi.fn();

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      isLayoutMode: false,
      isStorageMode: true,
      isWorkflowScope: true,
      canSelectCells: true,
      setPlacementMoveTargetCellId,
      setSelectedCellId
    });

    const rackCells = renderer.root.findAllByType('RackCells');
    act(() => {
      rackCells[0].props.onCellClick('cell-9', { x: 0, y: 0 });
    });

    expect(setPlacementMoveTargetCellId).toHaveBeenCalledWith('cell-9');
    expect(setSelectedCellId).not.toHaveBeenCalled();
  });

  it('keeps section rendering non-interactive (no section selection semantics)', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 1,
      isLayoutMode: false,
      isStorageMode: true
    });

    const sectionNodes = renderer.root.findAllByType('RackSections');
    expect(sectionNodes.length).toBeGreaterThan(0);
    expect(sectionNodes[0].props.onClick).toBeUndefined();
    expect(sectionNodes[0].props.onTap).toBeUndefined();
  });

  it('rack press ignores already-cancelled events (defensive non-bubbling guard)', () => {
    const setSelectedRackIds = vi.fn();
    const setSelectedCellId = vi.fn();
    const clearHighlightedCellIds = vi.fn();

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      isLayoutMode: false,
      isStorageMode: true,
      setSelectedRackIds,
      setSelectedCellId,
      clearHighlightedCellIds
    });

    const rackGroups = renderer.root.findAll(
      (node) => String(node.type) === 'Group' && typeof node.props.onClick === 'function'
    );

    act(() => {
      rackGroups[0].props.onClick({ evt: {}, cancelBubble: true });
    });

    expect(setSelectedRackIds).not.toHaveBeenCalled();
    expect(setSelectedCellId).not.toHaveBeenCalled();
    expect(clearHighlightedCellIds).not.toHaveBeenCalled();
  });
});
