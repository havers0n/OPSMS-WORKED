import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import {
  buildCellStructureKey,
  type Cell,
  type Rack,
  type RackFace
} from '@wos/domain';
import { RackLayer } from './rack-layer';
import type { CanvasRenderMode } from './canvas-render-mode';

vi.mock('react-konva', () => ({
  Layer: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Layer', props, children),
  FastLayer: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('FastLayer', props, children),
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

vi.mock('./shapes/rack-cells', () => ({
  RackCells: (props: Record<string, unknown>) =>
    createElement('RackCells', props)
}));

vi.mock('./shapes/rack-body', () => ({
  RackBody: (props: Record<string, unknown>) => createElement('RackBody', props)
}));

vi.mock('./shapes/rack-sections', () => ({
  RackSections: (props: Record<string, unknown>) =>
    createElement('RackSections', props)
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

function createPublishedCell(rack: Rack, slotNo: number): Cell {
  const face = rack.faces[0]!;
  const section = face.sections[0]!;
  const level = section.levels[0]!;
  return {
    id: `${rack.id}-cell-${slotNo}`,
    layoutVersionId: 'layout-version-1',
    rackId: rack.id,
    rackFaceId: face.id,
    rackSectionId: section.id,
    rackLevelId: level.id,
    slotNo,
    status: 'active',
    cellCode: `${rack.id}-cell-${slotNo}`,
    address: {
      raw: `${rack.id}-A-1-${slotNo}`,
      parts: {
        rackCode: rack.id,
        face: 'A',
        section: 1,
        level: 1,
        slot: slotNo
      },
      sortKey: `${rack.id}-A-1-${slotNo}`
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

function renderRackLayer(params: {
  selectedRackIds: string[];
  primarySelectedRackId: string | null;
  selectedRackActiveLevel?: number;
  lod?: 0 | 1 | 2;
  zoom?: number;
  isLayoutMode?: boolean;
  isStorageMode?: boolean;
  isViewMode?: boolean;
  isActivelyPanning?: boolean;
  labelsDeferred?: boolean;
  canSelectCells?: boolean;
  canSelectRack?: boolean;
  isWorkflowScope?: boolean;
  activeCellRackId?: string | null;
  hoveredRackId?: string | null;
  isRackPassiveScopeActive?: boolean;
  renderMode?: CanvasRenderMode;
  renderSelectionOverlay?: boolean;
  canvasSelectedCellId?: string | null;
  temporaryLocateTargetCellId?: string | null;
  moveSourceCellId?: string | null;
  moveSourceRackId?: string | null;
  setSelectedCellId?: (cellId: string | null) => void;
  setSelectedRackIds?: (rackIds: string[]) => void;
  clearHighlightedCellIds?: () => void;
  highlightedCellIds?: Set<string>;
  setHighlightedCellIds?: (cellIds: string[]) => void;
  setPlacementMoveTargetCellId?: (cellId: string | null) => void;
  racks?: Rack[];
  publishedCellsById?: Map<string, Cell>;
  publishedCellsByStructure?: Map<string, Cell>;
  onV2StorageCellSelect?: (params: { cellId: string; rackId: string }) => void;
  onV2StorageRackSelect?: (params: { rackId: string }) => void;
  rackBodyShell?: 'normal' | 'cached';
}) {
  const racks = params.racks ?? [
    createRack('rack-1', 0),
    createRack('rack-2', 10)
  ];
  const rackLookup = Object.fromEntries(
    racks.map((rack) => [rack.id, rack])
  ) as Record<string, Rack>;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackLayer, {
        activeCellRackId: params.activeCellRackId ?? null,
        canSelectCells: params.canSelectCells ?? false,
        canSelectRack: params.canSelectRack ?? true,
        canvasSelectedCellId: params.canvasSelectedCellId ?? null,
        cellRuntimeById: new Map(),
        clearHighlightedCellIds:
          params.clearHighlightedCellIds ?? (() => undefined),
        diagnosticsFlags: {
          labels: 'normal',
          grid: 'normal',
          hitTest: 'normal',
          cells: 'normal',
          cellOverlays: 'normal',
          enableProductionCellCulling: true,
          rackLayerRenderer: 'layer',
          rackBodyShell: params.rackBodyShell ?? 'normal'
        },
        diagnosticsViewport: {
          canvasOffset: { x: 0, y: 0 },
          viewport: { width: 1200, height: 800 },
          zoom: params.zoom ?? 1.5
        },
        isActivelyPanning: params.isActivelyPanning ?? false,
        labelsDeferred: params.labelsDeferred ?? false,
        renderMode: params.renderMode,
        renderSelectionOverlay: params.renderSelectionOverlay,
        highlightedCellIds: params.highlightedCellIds ?? new Set<string>(),
        hoveredRackId: params.hoveredRackId ?? null,
        isLayoutEditable: true,
        isLayoutMode: params.isLayoutMode ?? true,
        isPlacing: false,
        isRackPassiveScopeActive: params.isRackPassiveScopeActive ?? false,
        isStorageMode: params.isStorageMode ?? false,
        isViewMode: params.isViewMode ?? false,
        isWorkflowScope: params.isWorkflowScope ?? false,
        lod: params.lod ?? 2,
        zoom: params.zoom ?? 1.5,
        minRackDistance: 0,
        moveSourceCellId: params.moveSourceCellId ?? null,
        moveSourceRackId: params.moveSourceRackId ?? null,
        temporaryLocateTargetCellId: params.temporaryLocateTargetCellId ?? null,
        occupiedCellIds: new Set<string>(),
        publishedCellsById: params.publishedCellsById ?? new Map(),
        publishedCellsByStructure:
          params.publishedCellsByStructure ?? new Map(),
        primarySelectedRackId: params.primarySelectedRackId,
        rackLookup,
        racks,
        selectedRackActiveLevel: params.selectedRackActiveLevel ?? 0,
        selectedRackIds: params.selectedRackIds,
        setHighlightedCellIds:
          params.setHighlightedCellIds ?? (() => undefined),
        setHoveredRackId: () => undefined,
        setPlacementMoveTargetCellId:
          params.setPlacementMoveTargetCellId ?? (() => undefined),
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

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('RackLayer high-LOD cell mounting', () => {
  it('does not mount RackSections when section rendering is inactive (lod=0)', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 0
    });
    const sections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    );
    expect(sections).toHaveLength(0);
  });

  it('renders RackCells for visible unselected racks at high LOD with level 0', () => {
    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null
    });
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
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
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.activeLevelIndex).toBe(1);
    expect(rackCells[1]?.props.rackId).toBe('rack-2');
    expect(rackCells[1]?.props.activeLevelIndex).toBe(0);
  });

  it('does not make locked racks draggable in editable layout mode', () => {
    const lockedRack = { ...createRack('rack-1', 0), isLocked: true };
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      racks: [lockedRack]
    });

    const rackGroup = renderer.root.find(
      (node) =>
        String(node.type) === 'Group' &&
        node.props['data-testid'] !== 'selection-overlay-group'
    );

    expect(rackGroup.props.draggable).toBe(false);
  });

  it('uses rackIds[0] as primary in multi-select and keeps non-primary racks at level 0', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1', 'rack-2'],
      primarySelectedRackId: 'rack-1',
      selectedRackActiveLevel: 2
    });
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
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
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.activeLevelIndex).toBe(99);
    expect(rackCells[1]?.props.rackId).toBe('rack-2');
    expect(rackCells[1]?.props.activeLevelIndex).toBe(0);
  });

  it('does not force-render all cells for the ordinary primary selected rack', () => {
    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: 'rack-1'
    });
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );

    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.forceRenderAllCells).toBe(false);
    expect(rackCells[1]?.props.rackId).toBe('rack-2');
    expect(rackCells[1]?.props.forceRenderAllCells).toBe(false);
  });

  it('does not force-render all cells for the ordinary active selected cell rack', () => {
    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      activeCellRackId: 'rack-1'
    });
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );

    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.forceRenderAllCells).toBe(false);
    expect(rackCells[1]?.props.rackId).toBe('rack-2');
    expect(rackCells[1]?.props.forceRenderAllCells).toBe(false);
  });

  it('force-renders all cells for the locate target rack', () => {
    const racks = [createRack('rack-1', 0), createRack('rack-2', 10)];
    const cells = indexCells([createPublishedCell(racks[0]!, 1)]);
    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      racks,
      publishedCellsById: cells.byId,
      publishedCellsByStructure: cells.byStructure,
      temporaryLocateTargetCellId: 'rack-1-cell-1'
    });
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );

    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.forceRenderAllCells).toBe(true);
    expect(rackCells[1]?.props.rackId).toBe('rack-2');
    expect(rackCells[1]?.props.forceRenderAllCells).toBe(false);
  });

  it('force-renders all cells for the workflow source rack', () => {
    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      moveSourceRackId: 'rack-1'
    });
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );

    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.forceRenderAllCells).toBe(true);
    expect(rackCells[1]?.props.rackId).toBe('rack-2');
    expect(rackCells[1]?.props.forceRenderAllCells).toBe(false);
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
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
    expect(rackCells).toHaveLength(2);
    expect(rackCells[0]?.props.rackId).toBe('rack-1');
    expect(rackCells[0]?.props.semanticLevels).toEqual([1, 3]);
  });

  it('passes Face A sections to the canvas for mirrored Face B', () => {
    const faceA = createFaceWithLevels('rack-1-face-a', 'A', true, [1, 3]);
    const faceB: RackFace = {
      ...createFaceWithLevels('rack-1-face-b', 'B', true, [9]),
      relationshipMode: 'mirrored',
      isMirrored: true,
      mirrorSourceFaceId: faceA.id,
      sections: []
    };
    const rackA: Rack = {
      ...createRack('rack-1', 0),
      kind: 'paired',
      faces: [faceA, faceB]
    };

    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      selectedRackActiveLevel: 0,
      racks: [rackA]
    });

    const rackSections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    )[0];
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    )[0];

    expect(rackSections?.props.faceB.id).toBe(faceB.id);
    expect(rackSections?.props.faceB.sections).toEqual(faceA.sections);
    expect(rackCells?.props.faceB.id).toBe(faceB.id);
    expect(rackCells?.props.faceB.sections).toEqual(faceA.sections);
    expect(rackCells?.props.semanticLevels).toEqual([1, 3]);
  });

  it('routes selected cell visuals through the sparse overlay layer', () => {
    const rack = createRack('rack-1', 0);
    const selectedCell = createPublishedCell(rack, 1);
    const cells = indexCells([selectedCell]);

    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      canvasSelectedCellId: selectedCell.id,
      racks: [rack],
      publishedCellsById: cells.byId,
      publishedCellsByStructure: cells.byStructure
    });

    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
    const overlayOutlines = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Rect' &&
        node.props.wosRectRole === 'cell-outline-overlay'
    );

    expect(rackCells[0]?.props.selectedCellId).toBeNull();
    expect(overlayOutlines).toHaveLength(1);
    expect(overlayOutlines[0]?.props.listening).toBe(false);
  });

  it('routes single selected highlight visuals through the sparse overlay layer', () => {
    const rack = createRack('rack-1', 0);
    const selectedCell = createPublishedCell(rack, 1);
    const cells = indexCells([selectedCell]);

    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      canvasSelectedCellId: selectedCell.id,
      highlightedCellIds: new Set([selectedCell.id]),
      racks: [rack],
      publishedCellsById: cells.byId,
      publishedCellsByStructure: cells.byStructure
    });

    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
    const overlayHalos = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Rect' &&
        node.props.wosRectRole === 'cell-halo-overlay'
    );

    expect(rackCells[0]?.props.highlightedCellIds).toBeInstanceOf(Set);
    expect(rackCells[0]?.props.highlightedCellIds.size).toBe(0);
    expect(overlayHalos).toHaveLength(1);
    expect(overlayHalos[0]?.props.listening).toBe(false);
  });

  it('keeps multi-cell highlighted search sets in base RackCells', () => {
    const rack = createRack('rack-1', 0);
    const selectedCell = createPublishedCell(rack, 1);
    const otherCell = createPublishedCell(rack, 2);
    const highlightedCellIds = new Set([selectedCell.id, otherCell.id]);
    const cells = indexCells([selectedCell, otherCell]);

    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      canvasSelectedCellId: selectedCell.id,
      highlightedCellIds,
      racks: [rack],
      publishedCellsById: cells.byId,
      publishedCellsByStructure: cells.byStructure
    });

    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
    const overlayHalos = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Rect' &&
        node.props.wosRectRole === 'cell-halo-overlay'
    );

    expect(rackCells[0]?.props.highlightedCellIds).toBe(highlightedCellIds);
    expect(overlayHalos).toHaveLength(0);
  });

  it('can keep sparse selection visuals out of the base rack layer', () => {
    const rack = createRack('rack-1', 0);
    const selectedCell = createPublishedCell(rack, 1);
    const cells = indexCells([selectedCell]);

    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      canvasSelectedCellId: selectedCell.id,
      renderSelectionOverlay: false,
      racks: [rack],
      publishedCellsById: cells.byId,
      publishedCellsByStructure: cells.byStructure
    });

    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
    const overlayOutlines = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Rect' &&
        node.props.wosRectRole === 'cell-outline-overlay'
    );

    expect(rackCells[0]?.props.selectedCellId).toBeNull();
    expect(overlayOutlines).toHaveLength(0);
  });

  it('keeps view-mode cell click selection and highlight writes unchanged', () => {
    const setSelectedCellId = vi.fn();
    const setHighlightedCellIds = vi.fn();

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      isLayoutMode: false,
      isViewMode: true,
      canSelectCells: true,
      setSelectedCellId,
      setHighlightedCellIds
    });

    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
    act(() => {
      rackCells[0].props.onCellClick('cell-1', { x: 10, y: 20 });
    });

    expect(setSelectedCellId).toHaveBeenCalledWith('cell-1');
    expect(setHighlightedCellIds).toHaveBeenCalledWith(['cell-1']);
  });

  it('keeps view-mode rack body clicks selectable at cell depth', () => {
    const setSelectedRackIds = vi.fn();

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      isLayoutMode: false,
      isViewMode: true,
      canSelectCells: true,
      canSelectRack: true,
      setSelectedRackIds
    });

    const rackGroups = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Group' &&
        typeof node.props.onClick === 'function'
    );

    act(() => {
      rackGroups[0].props.onClick({
        evt: {},
        cancelBubble: false,
        currentTarget: { getRelativePointerPosition: () => ({ x: 5, y: 5 }) }
      });
    });

    expect(setSelectedRackIds).toHaveBeenCalledWith(['rack-1']);
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

    const rackBody = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    expect(rackBody.props.showRackCode).toBe(true);
    expect(rackBody.props.rackCodeProminence).toBe('dominant');
    expect(rackBody.props.rackCodePlacement).toBe('lower-left-mid');
    expect(
      renderer.root.findAll((node) => String(node.type) === 'RackSections')
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'RackCells')
    ).toHaveLength(0);
  });

  it('maps early lod=1 to stage1: rack demoted + face only', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 1,
      zoom: 0.95
    });

    const rackBody = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    const rackSections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    )[0];
    expect(rackBody.props.rackCodeProminence).toBe('secondary');
    expect(rackBody.props.rackCodePlacement).toBe('lower-left-mid');
    expect(rackSections.props.showFaceToken).toBe(true);
    expect(rackSections.props.showSectionNumbers).toBe(false);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'RackCells')
    ).toHaveLength(0);
  });

  it('maps late lod=1 to stage2: section dominant, rack/face demoted, no cell numbers', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 1,
      zoom: 1.2
    });

    const rackBody = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    const rackSections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    )[0];
    expect(rackBody.props.rackCodeProminence).toBe('background');
    expect(rackBody.props.rackCodePlacement).toBe('lower-left-mid');
    expect(rackSections.props.showFaceToken).toBe(true);
    expect(rackSections.props.faceTokenProminence).toBe('secondary');
    expect(rackSections.props.showSectionNumbers).toBe(true);
    expect(rackSections.props.sectionNumberProminence).toBe('dominant');
    expect(
      renderer.root.findAll((node) => String(node.type) === 'RackCells')
    ).toHaveLength(0);
  });

  it('maps lod=2 to stage3: cell dominant, section hidden, rack/face quiet', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      lod: 2,
      zoom: 1.5
    });

    const rackBody = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    const rackSections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    )[0];
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    )[0];
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

  it('defaults to full render mode with labels and hit testing enabled', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1'
    });

    const layer = renderer.root.findAll(
      (node) => String(node.type) === 'Layer'
    )[0];
    const rackBody = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    )[0];

    expect(layer?.props.listening).toBe(true);
    expect(rackBody?.props.showRackCode).toBe(true);
    expect(rackCells?.props.renderMode).toBe('full');
    expect(rackCells?.props.isInteractive).toBe(false);
    expect(rackCells?.props.showCellNumbers).toBe(true);
  });

  it('keeps rack body shell rendering normal unless diagnostics opt into the cache', () => {
    const defaultRenderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null
    });
    const cachedRenderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      rackBodyShell: 'cached'
    });

    const defaultBodies = defaultRenderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    );
    const cachedBodies = cachedRenderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    );

    expect(defaultBodies.map((body) => body.props.shellRendering)).toEqual([
      'normal',
      'normal'
    ]);
    expect(cachedBodies.map((body) => body.props.shellRendering)).toEqual([
      'cached',
      'cached'
    ]);
  });

  it('passes hover, passive, selected, and selected-passive state into the cached RackBody shell', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      hoveredRackId: 'rack-2',
      isRackPassiveScopeActive: true,
      activeCellRackId: null,
      rackBodyShell: 'cached'
    });

    const rackBodies = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    );

    expect(rackBodies[0]?.props.shellRendering).toBe('cached');
    expect(rackBodies[0]?.props.isSelected).toBe(true);
    expect(rackBodies[0]?.props.isHovered).toBe(false);
    expect(rackBodies[0]?.props.isPassive).toBe(false);
    expect(rackBodies[1]?.props.shellRendering).toBe('cached');
    expect(rackBodies[1]?.props.isSelected).toBe(false);
    expect(rackBodies[1]?.props.isHovered).toBe(true);
    expect(rackBodies[1]?.props.isPassive).toBe(true);
  });

  it('passes active pan lightweight visual mode without unmounting rack/cell subtrees', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      isActivelyPanning: true,
      renderMode: 'interaction-light'
    });

    const layer = renderer.root.findAll(
      (node) => String(node.type) === 'Layer'
    )[0];
    const rackBodies = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    );
    const rackSections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    );
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );

    expect(rackBodies).toHaveLength(2);
    expect(rackSections).toHaveLength(2);
    expect(rackCells).toHaveLength(2);
    expect(rackBodies[0]?.props.isActivelyPanning).toBe(true);
    expect(rackSections[0]?.props.isActivelyPanning).toBe(true);
    expect(rackCells[0]?.props.isActivelyPanning).toBe(true);
    expect(layer?.props.listening).toBe(false);
    expect(rackBodies[0]?.props.showRackCode).toBe(false);
    expect(rackSections[0]?.props.showFaceToken).toBe(false);
    expect(rackSections[0]?.props.showSectionNumbers).toBe(false);
    expect(rackCells[0]?.props.renderMode).toBe('interaction-light');
    expect(rackCells[0]?.props.isInteractive).toBe(false);
    expect(rackCells[0]?.props.showCellNumbers).toBe(false);
    expect(rackCells[0]?.props.showFocusedFullAddress).toBe(false);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Rect' &&
          node.props.wosRectRole === 'rack-interaction'
      )
    ).toHaveLength(0);
  });

  it('uses skeleton mode during transient interaction without mounting RackCells', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      isActivelyPanning: true,
      renderMode: 'interaction-skeleton'
    });

    const layer = renderer.root.findAll(
      (node) => String(node.type) === 'Layer'
    )[0];
    const rackBodies = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    );
    const rackSections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    );

    expect(layer?.props.listening).toBe(false);
    expect(rackBodies).toHaveLength(2);
    expect(rackSections).toHaveLength(2);
    expect(
      renderer.root.findAll((node) => String(node.type) === 'RackCells')
    ).toHaveLength(0);
    expect(rackBodies[0]?.props.showRackCode).toBe(false);
    expect(rackBodies[0]?.props.isActivelyPanning).toBe(true);
    expect(rackSections[0]?.props.showFaceToken).toBe(false);
    expect(rackSections[0]?.props.showSectionNumbers).toBe(false);
    expect(rackSections[0]?.props.isActivelyPanning).toBe(true);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Rect' &&
          node.props.wosRectRole === 'rack-interaction'
      )
    ).toHaveLength(0);
  });

  it('uses restore-base to mount rack and cell bases without labels, overlays, or hit testing', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      renderMode: 'restore-base'
    });

    const layer = renderer.root.findAll(
      (node) => String(node.type) === 'Layer'
    )[0];
    const rackBody = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    const rackSections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    )[0];
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    )[0];

    expect(layer?.props.listening).toBe(false);
    expect(rackBody?.props.isSelected).toBe(false);
    expect(rackBody?.props.showRackCode).toBe(false);
    expect(rackSections?.props.showFaceToken).toBe(false);
    expect(rackSections?.props.showSectionNumbers).toBe(false);
    expect(rackCells?.props.renderMode).toBe('restore-base');
    expect(rackCells?.props.isInteractive).toBe(false);
    expect(rackCells?.props.selectedCellId).toBeNull();
    expect(rackCells?.props.showCellNumbers).toBe(false);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Rect' &&
          node.props.wosRectRole === 'rack-interaction'
      )
    ).toHaveLength(0);
  });

  it('uses restore-overlays to restore outlines and hit testing while labels stay off', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      canSelectCells: true,
      renderMode: 'restore-overlays'
    });

    const layer = renderer.root.findAll(
      (node) => String(node.type) === 'Layer'
    )[0];
    const rackBody = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    const rackSections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    )[0];
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    )[0];

    expect(layer?.props.listening).toBe(true);
    expect(rackBody?.props.isSelected).toBe(true);
    expect(rackBody?.props.showRackCode).toBe(false);
    expect(rackSections?.props.showFaceToken).toBe(false);
    expect(rackSections?.props.showSectionNumbers).toBe(false);
    expect(rackCells?.props.renderMode).toBe('restore-overlays');
    expect(rackCells?.props.isInteractive).toBe(true);
    expect(rackCells?.props.showCellNumbers).toBe(false);
    expect(
      renderer.root.findAll(
        (node) =>
          String(node.type) === 'Rect' &&
          node.props.wosRectRole === 'rack-interaction'
      )
    ).toHaveLength(2);
  });

  it('keeps labels deferred during restore-labels before final full mode', () => {
    const renderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      canSelectCells: true,
      renderMode: 'restore-labels'
    });

    const layer = renderer.root.findAll(
      (node) => String(node.type) === 'Layer'
    )[0];
    const rackBody = renderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    const rackSections = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    )[0];
    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    )[0];

    expect(layer?.props.listening).toBe(true);
    expect(rackBody?.props.isSelected).toBe(true);
    expect(rackBody?.props.showRackCode).toBe(false);
    expect(rackSections?.props.showFaceToken).toBe(false);
    expect(rackCells?.props.renderMode).toBe('restore-labels');
    expect(rackCells?.props.isInteractive).toBe(true);
    expect(rackCells?.props.showCellNumbers).toBe(false);
  });

  it('restores labels in full mode after label deferral clears', () => {
    const deferredRenderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      canSelectCells: true,
      labelsDeferred: true,
      renderMode: 'full'
    });
    const readyRenderer = renderRackLayer({
      selectedRackIds: ['rack-1'],
      primarySelectedRackId: 'rack-1',
      canSelectCells: true,
      labelsDeferred: false,
      renderMode: 'full'
    });

    const deferredBody = deferredRenderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    const readyBody = readyRenderer.root.findAll(
      (node) => String(node.type) === 'RackBody'
    )[0];
    const deferredCells = deferredRenderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    )[0];
    const readyCells = readyRenderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    )[0];

    expect(deferredBody?.props.showRackCode).toBe(false);
    expect(deferredCells?.props.showCellNumbers).toBe(false);
    expect(deferredCells?.props.showFocusedFullAddress).toBe(false);
    expect(readyBody?.props.showRackCode).toBe(true);
    expect(readyCells?.props.showCellNumbers).toBe(true);
    expect(readyCells?.props.showFocusedFullAddress).toBe(true);
  });
});

describe('RackLayer storage interaction depth', () => {
  it('cell click wins over rack click in storage mode', () => {
    const setSelectedCellId = vi.fn();
    const setSelectedRackIds = vi.fn();
    const clearHighlightedCellIds = vi.fn();
    const onV2StorageCellSelect = vi.fn();
    const onV2StorageRackSelect = vi.fn();

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      isLayoutMode: false,
      isStorageMode: true,
      canSelectCells: true,
      setSelectedCellId,
      setSelectedRackIds,
      clearHighlightedCellIds,
      onV2StorageCellSelect,
      onV2StorageRackSelect
    });

    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
    act(() => {
      rackCells[0].props.onCellClick('cell-1', { x: 10, y: 20 });
    });

    expect(onV2StorageCellSelect).toHaveBeenCalledWith({
      cellId: 'cell-1',
      rackId: 'rack-1'
    });
    expect(onV2StorageRackSelect).not.toHaveBeenCalled();
    expect(setSelectedCellId).not.toHaveBeenCalled();
    expect(setSelectedRackIds).not.toHaveBeenCalled();
    expect(clearHighlightedCellIds).not.toHaveBeenCalled();
  });

  it('rack body click in storage mode selects rack through V2 focus context', () => {
    const setSelectedCellId = vi.fn();
    const setSelectedRackIds = vi.fn();
    const clearHighlightedCellIds = vi.fn();
    const onV2StorageCellSelect = vi.fn();
    const onV2StorageRackSelect = vi.fn();

    const renderer = renderRackLayer({
      selectedRackIds: [],
      primarySelectedRackId: null,
      isLayoutMode: false,
      isStorageMode: true,
      canSelectRack: true,
      setSelectedCellId,
      setSelectedRackIds,
      clearHighlightedCellIds,
      onV2StorageCellSelect,
      onV2StorageRackSelect
    });

    const rackGroups = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Group' &&
        typeof node.props.onClick === 'function'
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
    expect(onV2StorageCellSelect).not.toHaveBeenCalled();
    expect(onV2StorageRackSelect).toHaveBeenCalledWith({ rackId: 'rack-1' });
    expect(setSelectedCellId).not.toHaveBeenCalled();
    expect(setSelectedRackIds).not.toHaveBeenCalled();
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

    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
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

    const rackCells = renderer.root.findAll(
      (node) => String(node.type) === 'RackCells'
    );
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

    const sectionNodes = renderer.root.findAll(
      (node) => String(node.type) === 'RackSections'
    );
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
      (node) =>
        String(node.type) === 'Group' &&
        typeof node.props.onClick === 'function'
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
      publishedCellsByStructure: new Map([[cellKey, { id: 'cell-1' } as Cell]])
    });

    const rackGroups = renderer.root.findAll(
      (node) =>
        String(node.type) === 'Group' &&
        typeof node.props.onClick === 'function'
    );

    act(() => {
      rackGroups[0].props.onClick({
        evt: {},
        cancelBubble: false,
        currentTarget: { getRelativePointerPosition: () => ({ x: 5, y: 5 }) }
      });
    });

    expect(onV2StorageCellSelect).toHaveBeenCalledWith({
      cellId: 'cell-1',
      rackId: 'rack-1'
    });
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
      (node) =>
        String(node.type) === 'Group' &&
        typeof node.props.onClick === 'function'
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
