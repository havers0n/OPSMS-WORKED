import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cell, FloorWorkspace, LayoutDraft } from '@wos/domain';
import type { EditorSelection, ViewMode } from '@/widgets/warehouse-editor/model/editor-types';
import { resolvePanelMode } from './storage-inspector-v2/mode';
import { createLayoutDraftFixture } from '../model/__fixtures__/layout-draft.fixture';
import { EditorCanvas } from './editor-canvas';

let mockViewMode: ViewMode = 'storage';
let mockSelection: EditorSelection = { type: 'none' };
let mockSelectedRackId: string | null = null;
let mockSelectedRackActiveLevel = 2;
let mockLayoutDraft: LayoutDraft | null = null;
let mockPublishedCellsById = new Map<string, Cell>();
let rackLayerLastProps: Record<string, unknown> | null = null;
let storageFocusSelectCellSpy = vi.fn();
let storageFocusSelectRackSpy = vi.fn();

vi.mock('react-konva', () => ({
  Layer: ({ children, ...props }: { children?: React.ReactNode }) => createElement('Layer', props, children),
  Line: ({ children, ...props }: { children?: React.ReactNode }) => createElement('Line', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) => createElement('Rect', props, children),
  Stage: ({ children, ...props }: { children?: React.ReactNode }) => createElement('Stage', props, children)
}));

vi.mock('@/entities/layout-version/lib/canvas-geometry', () => ({
  GRID_SIZE: 1,
  MAJOR_GRID_SIZE: 5,
  MINOR_GRID_ZOOM_THRESHOLD: 999,
  isRackInViewport: () => true
}));

vi.mock('@/widgets/warehouse-editor/model/editor-selectors', () => ({
  useActiveTask: () => null,
  useActiveStorageWorkflow: () => null,
  useCanvasZoom: () => 1,
  useCancelPlacementInteraction: () => () => undefined,
  useCreateFreeWall: () => () => undefined,
  useCreateRack: () => () => undefined,
  useDeleteWall: () => () => undefined,
  useCreateZone: () => () => undefined,
  useClearSelection: () => () => undefined,
  useDeleteZone: () => () => undefined,
  useEditorMode: () => 'select' as const,
  useInteractionScope: () => 'object' as const,
  useClearHighlightedCellIds: () => () => undefined,
  useHoveredRackId: () => null,
  useIsLayoutEditable: () => false,
  useSelectedZoneId: () => null,
  useSelectedWallId: () => null,
  useSetPlacementMoveTargetCellId: () => () => undefined,
  useSetSelectedCellId: () => () => undefined,
  useSetSelectedRackId: () => () => undefined,
  useSetSelectedWallId: () => () => undefined,
  useSetSelectedZoneId: () => () => undefined,
  useSetCanvasZoom: () => () => undefined,
  useSetEditorMode: () => () => undefined,
  useSetHoveredRackId: () => () => undefined,
  useHighlightedCellIds: () => [],
  useSetHighlightedCellIds: () => () => undefined,
  useSetSelectedRackSide: () => () => undefined,
  useSetSelectedRackIds: () => () => undefined,
  useToggleRackSelection: () => () => undefined,
  useUpdateRackPosition: () => () => undefined,
  useUpdateWallGeometry: () => () => undefined,
  useUpdateZoneRect: () => () => undefined,
  useMinRackDistance: () => 0,
  useViewMode: () => mockViewMode
}));

vi.mock('@/widgets/warehouse-editor/model/editor-store', () => ({
  useEditorStore: (selector: (state: { selectedRackActiveLevel: number }) => unknown) =>
    selector({ selectedRackActiveLevel: mockSelectedRackActiveLevel })
}));

vi.mock('@/widgets/warehouse-editor/model/interaction-store', () => ({
  useInteractionStore: (selector: (state: { selection: EditorSelection }) => unknown) =>
    selector({ selection: mockSelection })
}));

vi.mock('@/widgets/warehouse-editor/model/v2/v2-selectors', () => ({
  useStorageFocusActiveLevel: () => null,
  useStorageFocusSelectedCellId: () => (mockSelection.type === 'cell' ? mockSelection.cellId : null),
  useStorageFocusSelectedRackId: () => mockSelectedRackId,
  useStorageFocusSelectCell: () => storageFocusSelectCellSpy,
  useStorageFocusSelectRack: () => storageFocusSelectRackSpy,
  useStorageFocusHandleEmptyCanvasClick: () => () => undefined
}));

vi.mock('../lib/use-workspace-layout', () => ({
  useWorkspaceLayout: () => mockLayoutDraft
}));

vi.mock('./canvas-hud', () => ({
  CanvasHud: () => null
}));

vi.mock('./rack-layer', () => ({
  RackLayer: (props: Record<string, unknown>) => {
    rackLayerLastProps = props;
    return createElement('RackLayer', props);
  }
}));

vi.mock('./shapes/snap-guides', () => ({
  SnapGuides: () => null
}));

vi.mock('./wall-layer', () => ({
  WallLayer: () => null
}));

vi.mock('./zone-layer', () => ({
  ZoneLayer: () => null
}));

vi.mock('./use-canvas-keyboard-shortcuts', () => ({
  useCanvasKeyboardShortcuts: () => undefined
}));

vi.mock('./use-canvas-stage-interactions', () => ({
  useCanvasStageInteractions: () => ({
    cancelDrawWall: () => undefined,
    cancelDrawZone: () => undefined,
    draftWallLine: null,
    draftZoneRect: null,
    marquee: null,
    onMouseDown: () => undefined,
    onMouseMove: () => undefined,
    onMouseUp: () => undefined
  })
}));

vi.mock('./use-canvas-viewport-controller', () => ({
  useCanvasViewportController: () => ({
    containerRef: { current: null },
    viewport: { width: 1000, height: 800, x: 0, y: 0 },
    canvasOffset: { x: 0, y: 0 },
    isPanning: false,
    handleZoom: () => undefined
  })
}));

vi.mock('./use-canvas-scene-model', () => ({
  useCanvasSceneModel: () => ({
    hud: {
      hintText: '',
      selectedRackAnchorRect: null,
      selectedRackSideFocus: null,
      selectedStorageCellAnchorRect: null,
      selectedWallAnchorRect: null,
      selectedZoneAnchorRect: null,
      shouldShowLayoutRackGeometryBar: false,
      shouldShowLayoutRackSideHandles: false,
      shouldShowLayoutWallBar: false,
      shouldShowLayoutZoneBar: false,
      shouldShowStorageCellBar: false
    },
    interaction: {
      canSelectCells: true,
      canSelectRack: true,
      canSelectWall: false,
      canSelectZone: false,
      interactionLevel: 'L3' as const,
      isDrawingWall: false,
      isDrawingZone: false,
      isLayoutDrawToolActive: false,
      isLayoutMode: false,
      isPlacementMoveMode: false,
      isPlacing: false,
      isStorageMode: true,
      isViewMode: false,
      lod: 2 as const
    },
    layers: {
      placementLayout: mockLayoutDraft,
      racks: [],
      walls: [],
      zones: []
    },
    lookups: {
      floorOperationsCellsById: new Map(),
      highlightedCellIdSet: new Set<string>(),
      occupiedCellIds: new Set<string>(),
      publishedCellsById: mockPublishedCellsById,
      publishedCellsByStructure: new Map()
    },
    selection: {
      activeCellRackId: null,
      canvasSelectedCellId: mockSelection.type === 'cell' ? mockSelection.cellId : null,
      moveSourceRackId: null,
      selectedRack: null,
      selectedStorageCell: null,
      selectedWall: null,
      selectedZone: null
    },
    workflow: {
      moveSourceCellId: null
    }
  })
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderCanvas(workspace: FloorWorkspace, params?: { isStorageV2?: boolean }) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(EditorCanvas, {
        workspace,
        onAddRack: () => undefined,
        onOpenInspector: () => undefined,
        isStorageV2: params?.isStorageV2
      })
    );
  });
  return renderer;
}

describe('EditorCanvas storage active-rack wiring', () => {
  beforeEach(() => {
    rackLayerLastProps = null;
    storageFocusSelectCellSpy = vi.fn();
    storageFocusSelectRackSpy = vi.fn();
  });

  it('passes selected cell parent rack id to RackLayer in storage mode', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = null;
    mockSelectedRackActiveLevel = 2;
    mockSelection = { type: 'cell', cellId: 'cell-1' };
    mockPublishedCellsById = new Map([
      ['cell-1', {
        id: 'cell-1',
        layoutVersionId: 'lv-1',
        rackId,
        rackFaceId: 'face-a',
        rackSectionId: 'section-a',
        rackLevelId: 'level-1',
        slotNo: 1,
        address: {
          raw: '01-A.01.01.01',
          parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 1 },
          sortKey: '0001-A-01-01-01'
        },
        cellCode: 'CELL-1',
        status: 'active'
      } satisfies Cell]
    ]);

    renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(rackLayerLastProps?.primarySelectedRackId).toBe(rackId);
  });

  it('passes selected rack id from shared resolver for storage rack selection', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = 'legacy-rack-id';
    mockSelectedRackActiveLevel = 2;
    mockSelection = { type: 'rack', rackIds: [rackId] };
    mockPublishedCellsById = new Map();

    renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(rackLayerLastProps?.primarySelectedRackId).toBe(rackId);
  });

  it('keeps selectedRackId semantics in non-storage mode', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockLayoutDraft = draft;
    mockViewMode = 'view';
    mockSelectedRackId = 'legacy-rack-id';
    mockSelectedRackActiveLevel = 2;
    mockSelection = { type: 'rack', rackIds: [rackId] };
    mockPublishedCellsById = new Map([
      ['cell-1', {
        id: 'cell-1',
        layoutVersionId: 'lv-1',
        rackId,
        rackFaceId: 'face-a',
        rackSectionId: 'section-a',
        rackLevelId: 'level-1',
        slotNo: 1,
        address: {
          raw: '01-A.01.01.01',
          parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 1 },
          sortKey: '0001-A-01-01-01'
        },
        cellCode: 'CELL-1',
        status: 'active'
      } satisfies Cell]
    ]);

    renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(rackLayerLastProps?.primarySelectedRackId).toBe(rackId);
  });

  it('preserves current contract: storage unresolved selected cell does not produce primarySelectedRackId', () => {
    const draft = createLayoutDraftFixture();
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = 'rack-stale';
    mockSelectedRackActiveLevel = 2;
    mockSelection = { type: 'cell', cellId: 'missing-cell' };
    mockPublishedCellsById = new Map();

    renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(rackLayerLastProps?.primarySelectedRackId).toBeNull();
  });

  it('sets primarySelectedRackId for resolved storage container selection', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = 'rack-stale';
    mockSelectedRackActiveLevel = 2;
    mockSelection = { type: 'container', containerId: 'container-1', sourceCellId: 'cell-1' };
    mockPublishedCellsById = new Map([
      ['cell-1', {
        id: 'cell-1',
        layoutVersionId: 'lv-1',
        rackId,
        rackFaceId: 'face-a',
        rackSectionId: 'section-a',
        rackLevelId: 'level-1',
        slotNo: 1,
        address: {
          raw: '01-A.01.01.01',
          parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 1 },
          sortKey: '0001-A-01-01-01'
        },
        cellCode: 'CELL-1',
        status: 'active'
      } satisfies Cell]
    ]);

    renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(rackLayerLastProps?.primarySelectedRackId).toBe(rackId);
  });

  it('keeps explicit unresolved container fallback: no primarySelectedRackId without source-cell context', () => {
    const draft = createLayoutDraftFixture();
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = 'rack-stale';
    mockSelectedRackActiveLevel = 2;
    mockSelection = { type: 'container', containerId: 'container-1', sourceCellId: 'cell-1' };
    mockPublishedCellsById = new Map();

    renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(rackLayerLastProps?.primarySelectedRackId).toBeNull();
  });

  it('storage V2 canvas cell callback writes selectCell with cell/rack/level', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = null;
    mockSelection = { type: 'none' };
    mockPublishedCellsById = new Map([
      ['cell-1', {
        id: 'cell-1',
        layoutVersionId: 'lv-1',
        rackId,
        rackFaceId: 'face-a',
        rackSectionId: 'section-a',
        rackLevelId: 'level-1',
        slotNo: 1,
        address: {
          raw: '01-A.01.01.01',
          parts: { rackCode: '01', face: 'A', section: 1, level: 3, slot: 1 },
          sortKey: '0001-A-01-03-01'
        },
        cellCode: 'CELL-1',
        status: 'active'
      } satisfies Cell]
    ]);

    renderCanvas(
      {
        floorId: draft.floorId,
        activeDraft: draft,
        latestPublished: draft
      },
      { isStorageV2: true }
    );

    const onV2StorageCellSelect = rackLayerLastProps?.onV2StorageCellSelect as ((params: { cellId: string; rackId: string }) => void);
    expect(typeof onV2StorageCellSelect).toBe('function');
    act(() => {
      onV2StorageCellSelect({ cellId: 'cell-1', rackId });
    });

    expect(storageFocusSelectCellSpy).toHaveBeenCalledWith({ cellId: 'cell-1', rackId, level: 3 });

    const panelMode = resolvePanelMode(rackId, 'cell-1', null);
    expect(panelMode).toEqual({ kind: 'cell-overview', cellId: 'cell-1' });
  });

  it('storage V2 canvas rack callback writes rack-only focus', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelection = { type: 'none' };
    mockPublishedCellsById = new Map();

    renderCanvas(
      {
        floorId: draft.floorId,
        activeDraft: draft,
        latestPublished: draft
      },
      { isStorageV2: true }
    );

    const onV2StorageRackSelect = rackLayerLastProps?.onV2StorageRackSelect as ((params: { rackId: string }) => void);
    expect(typeof onV2StorageRackSelect).toBe('function');
    act(() => {
      onV2StorageRackSelect({ rackId });
    });

    expect(storageFocusSelectRackSpy).toHaveBeenCalledWith({ rackId });
    expect(storageFocusSelectCellSpy).not.toHaveBeenCalled();
  });
});
