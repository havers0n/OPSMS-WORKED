import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { buildCellStructureKey, type Cell, type Rack, type RackFace } from '@wos/domain';
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

vi.mock('./shapes/rack-body', () => ({
  RackBody: (props: Record<string, unknown>) => createElement('RackBody', props)
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

function createFaceWithLevels(
  id: string,
  side: 'A' | 'B',
  enabled: boolean,
  ordinals: number[]
): RackFace {
  return {
    id,
    side,
    enabled,
    slotNumberingDirection: 'ltr',
    isMirrored: false,
    mirrorSourceFaceId: null,
    sections: [
      {
        id: `${id}-section`,
        ordinal: 1,
        length: 5,
        levels: ordinals.map((ordinal, index) => ({
          id: `${id}-level-${index + 1}`,
          ordinal,
          slotCount: 2
        }))
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
  zoom?: number;
  isLayoutMode?: boolean;
  isStorageMode?: boolean;
  canSelectCells?: boolean;
  canSelectRack?: boolean;
  isWorkflowScope?: boolean;
  temporaryLocateTargetCellId?: string | null;
  moveSourceCellId?: string | null;
  moveSourceRackId?: string | null;
  setSelectedCellId?: (cellId: string | null) => void;
  setSelectedRackIds?: (rackIds: string[]) => void;
  clearHighlightedCellIds?: () => void;
  setPlacementMoveTargetCellId?: (cellId: string | null) => void;
  racks?: Rack[];
  publishedCellsByStructure?: Map<string, Cell>;
  onV2StorageCellSelect?: (params: { cellId: string; rackId: string }) => void;
  onV2StorageRackSelect?: (params: { rackId: string }) => void;
}) {
  const racks = params.racks ?? [createRack('rack-1', 0), createRack('rack-2', 10)];
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
      zoom: params.zoom ?? 1.5,
      minRackDistance: 0,
      moveSourceCellId: params.moveSourceCellId ?? null,
      moveSourceRackId: params.moveSourceRackId ?? null,
      temporaryLocateTargetCellId: params.temporaryLocateTargetCellId ?? null,
  occupiedCellIds: new Set<string>(),
      publishedCellsByStructure: params.publishedCellsByStructure ?? new Map(),
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
      updateRackPosition: () => undefined,
      onV2StorageCellSelect: params.onV2StorageCellSelect,
      onV2StorageRackSelect: params.onV2StorageRackSelect
      })
    );
  });
  return renderer;
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('RackLayer high-LOD cell mounting', () => {
  it('does not mount RackSections when section rendering is inactive (lod=0)', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 0
    });
    const sections = renderer.root.findAll((node) => String(node.type) === 'RackSections');
    expect(sections).toHaveLength(0);
  });

  it('renders RackCells for visible unselected racks at high LOD with level 0', () => {
    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null
    });
    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells');
    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.activeLevelIndex).toBe(0);
    expect(rackCells[1]?.props.activeLevelIndex).toBe(0);
    expect(rackCells[0]?.props.locateTargetCellId).toBeNull();
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

  it('passes rack-wide semantic level union (enabled faces only) to RackCells', () => {
    const rackA: Rack = {
      ...createRack('rack-1', 0),
      faces: [
        createFaceWithLevels('rack-1-face-a', 'A', true, [1]),
        createFaceWithLevels('rack-1-face-b', 'B', true, [3]),
        createFaceWithLevels('rack-1-face-b-disabled', 'B', false, [9])
      ]
    };
    const rackB = createRack('rack-2', 10);
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      selectedRackActiveLevel: 0,
      racks: [rackA, rackB]
    });
    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells');
    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.semanticLevels).toEqual([1, 3]);
  });
});

describe('RackLayer reveal hierarchy policy wiring', () => {
  it('maps lod=0 to stage0 global namespace: rack dominant only', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 0,
      zoom: 0.8
    });

    const rackBody = renderer.root.findAll((node) => String(node.type) === 'RackBody')[0];
    expect(rackBody.props.showRackCode).toBe(true);
    expect(rackBody.props.rackCodeProminence).toBe('dominant');
    expect(rackBody.props.rackCodePlacement).toBe('lower-left-mid');
    expect(renderer.root.findAll((node) => String(node.type) === 'RackSections')).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'RackCells')).toHaveLength(0);
  });

  it('maps early lod=1 to stage1: rack demoted + face only', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 1,
      zoom: 0.95
    });

    const rackBody = renderer.root.findAll((node) => String(node.type) === 'RackBody')[0];
    const rackSections = renderer.root.findAll((node) => String(node.type) === 'RackSections')[0];
    expect(rackBody.props.rackCodeProminence).toBe('secondary');
    expect(rackBody.props.rackCodePlacement).toBe('lower-left-mid');
    expect(rackSections.props.showFaceToken).toBe(true);
    expect(rackSections.props.showSectionNumbers).toBe(false);
    expect(renderer.root.findAll((node) => String(node.type) === 'RackCells')).toHaveLength(0);
  });

  it('maps late lod=1 to stage2: section dominant, rack/face demoted, no cell numbers', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 1,
      zoom: 1.2
    });

    const rackBody = renderer.root.findAll((node) => String(node.type) === 'RackBody')[0];
    const rackSections = renderer.root.findAll((node) => String(node.type) === 'RackSections')[0];
    expect(rackBody.props.rackCodeProminence).toBe('background');
    expect(rackBody.props.rackCodePlacement).toBe('lower-left-mid');
    expect(rackSections.props.showFaceToken).toBe(true);
    expect(rackSections.props.faceTokenProminence).toBe('secondary');
    expect(rackSections.props.showSectionNumbers).toBe(true);
    expect(rackSections.props.sectionNumberProminence).toBe('dominant');
    expect(renderer.root.findAll((node) => String(node.type) === 'RackCells')).toHaveLength(0);
  });

  it('maps lod=2 to stage3: cell dominant, section hidden, rack/face quiet', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 2,
      zoom: 1.5
    });

    const rackBody = renderer.root.findAll((node) => String(node.type) === 'RackBody')[0];
    const rackSections = renderer.root.findAll((node) => String(node.type) === 'RackSections')[0];
    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells')[0];
    expect(rackBody.props.rackCodeProminence).toBe('background');
    expect(rackBody.props.rackCodePlacement).toBe('lower-left-mid');
    expect(rackSections.props.showFaceToken).toBe(true);
    expect(rackSections.props.faceTokenProminence).toBe('background');
    expect(rackSections.props.showSectionNumbers).toBe(false);
    expect(rackSections.props.sectionNumberProminence).toBe('background');
    expect(rackCells.props.showCellNumbers).toBe(true);
    expect(rackCells.props.cellNumberProminence).toBe('dominant');
    expect(rackCells.props.showFocusedFullAddress).toBe(true);
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

    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells');
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
      rackGroups[0].props.onClick({
        evt: {},
        cancelBubble: false,
        currentTarget: { getRelativePointerPosition: () => null }
      });
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

    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells');
    act(() => {
      rackCells[0].props.onCellClick('cell-9', { x: 0, y: 0 });
    });

    expect(setPlacementMoveTargetCellId).toHaveBeenCalledWith('cell-9');
    expect(setSelectedCellId).not.toHaveBeenCalled();
  });

  it('passes temporary locate-target channel separately from workflow-source', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      temporaryLocateTargetCellId: 'cell-target',
      moveSourceCellId: 'cell-source',
      moveSourceRackId: 'rack-1'
    });

    const rackCells = renderer.root.findAll((node) => String(node.type) === 'RackCells');
    expect(rackCells[0]?.props.locateTargetCellId).toBe('cell-target');
    expect(rackCells[0]?.props.workflowSourceCellId).toBe('cell-source');
  });

  it('keeps section rendering non-interactive (no section selection semantics)', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 1,
      isLayoutMode: false,
      isStorageMode: true
    });

    const sectionNodes = renderer.root.findAll((node) => String(node.type) === 'RackSections');
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

  it('storage V2 rack click resolves visible cell target before rack fallback', () => {
    const onV2StorageCellSelect = vi.fn();
    const onV2StorageRackSelect = vi.fn();
    const rack = createRack('rack-1', 0);
    const face = rack.faces[0]!;
    const section = face.sections[0]!;
    const level = section.levels[0]!;
    const cellKey = buildCellStructureKey({
      rackId: rack.id,
      rackFaceId: face.id,
      rackSectionId: section.id,
      rackLevelId: level.id,
      slotNo: 1
    });

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: 'rack-1',
      isLayoutMode: false,
      isStorageMode: true,
      canSelectCells: true,
      canSelectRack: true,
      racks: [rack],
      onV2StorageCellSelect,
      onV2StorageRackSelect,
      publishedCellsByStructure: new Map([
        [cellKey, { id: 'cell-1' } as Cell]
      ])
    });

    const rackGroups = renderer.root.findAll(
      (node) => String(node.type) === 'Group' && typeof node.props.onClick === 'function'
    );

    act(() => {
      rackGroups[0].props.onClick({
        evt: {},
        cancelBubble: false,
        currentTarget: { getRelativePointerPosition: () => ({ x: 5, y: 5 }) }
      });
    });

    expect(onV2StorageCellSelect).toHaveBeenCalledWith({ cellId: 'cell-1', rackId: 'rack-1' });
    expect(onV2StorageRackSelect).not.toHaveBeenCalled();
  });

  it('storage V2 rack click falls back to rack-only when no cell target resolves', () => {
    const onV2StorageCellSelect = vi.fn();
    const onV2StorageRackSelect = vi.fn();

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: 'rack-1',
      isLayoutMode: false,
      isStorageMode: true,
      canSelectCells: true,
      canSelectRack: true,
      racks: [createRack('rack-1', 0)],
      onV2StorageCellSelect,
      onV2StorageRackSelect,
      publishedCellsByStructure: new Map()
    });

    const rackGroups = renderer.root.findAll(
      (node) => String(node.type) === 'Group' && typeof node.props.onClick === 'function'
    );

    act(() => {
      rackGroups[0].props.onClick({
        evt: {},
        cancelBubble: false,
        currentTarget: { getRelativePointerPosition: () => ({ x: 5, y: 5 }) }
      });
    });

    expect(onV2StorageCellSelect).not.toHaveBeenCalled();
    expect(onV2StorageRackSelect).toHaveBeenCalledWith({ rackId: 'rack-1' });
  });
});
