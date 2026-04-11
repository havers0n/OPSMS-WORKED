import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cell, FloorWorkspace, LayoutDraft } from '@wos/domain';
import type { EditorSelection, ViewMode } from '@/widgets/warehouse-editor/model/editor-types';
import { createLayoutDraftFixture } from '../model/__fixtures__/layout-draft.fixture';
import { EditorCanvas } from './editor-canvas';

let mockViewMode: ViewMode = 'storage';
let mockSelection: EditorSelection = { type: 'none' };
let mockSelectedRackId: string | null = null;
let mockLayoutDraft: LayoutDraft | null = null;
let mockPublishedCellsById = new Map<string, Cell>();
let rackLayerLastProps: Record<string, unknown> | null = null;

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
  useEditorSelection: () => mockSelection,
  useInteractionScope: () => 'object' as const,
  useClearHighlightedCellIds: () => () => undefined,
  useHoveredRackId: () => null,
  useIsLayoutEditable: () => false,
  useSelectedCellId: () => (mockSelection.type === 'cell' ? mockSelection.cellId : null),
  useSelectedRackActiveLevel: () => 2,
  useSelectedRackFocus: () => ({ type: 'body' as const }),
  useSelectedZoneId: () => null,
  useSelectedWallId: () => null,
  useSetPlacementMoveTargetCellId: () => () => undefined,
  useSelectedRackId: () => mockSelectedRackId,
  useSetSelectedRackId: () => () => undefined,
  useSetSelectedWallId: () => () => undefined,
  useSetSelectedZoneId: () => () => undefined,
  useSelectedRackIds: () => (mockSelection.type === 'rack' ? mockSelection.rackIds : []),
  useSetCanvasZoom: () => () => undefined,
  useSetEditorMode: () => () => undefined,
  useSetHoveredRackId: () => () => undefined,
  useHighlightedCellIds: () => [],
  useSetHighlightedCellIds: () => () => undefined,
  useSetSelectedCellId: () => () => undefined,
  useSetSelectedRackSide: () => () => undefined,
  useSetSelectedRackIds: () => () => undefined,
  useToggleRackSelection: () => () => undefined,
  useUpdateRackPosition: () => () => undefined,
  useUpdateWallGeometry: () => () => undefined,
  useUpdateZoneRect: () => () => undefined,
  useMinRackDistance: () => 0,
  useViewMode: () => mockViewMode
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

function renderCanvas(workspace: FloorWorkspace) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(EditorCanvas, {
        workspace,
        onAddRack: () => undefined,
        onOpenInspector: () => undefined
      })
    );
  });
  return renderer;
}

describe('EditorCanvas storage active-rack wiring', () => {
  beforeEach(() => {
    rackLayerLastProps = null;
  });

  it('passes selected cell parent rack id to RackLayer in storage mode', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = null;
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

    expect(rackLayerLastProps?.primarySelectedRackId).toBe('legacy-rack-id');
  });

  it('preserves current contract: storage unresolved selected cell does not produce primarySelectedRackId', () => {
    const draft = createLayoutDraftFixture();
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = 'rack-stale';
    mockSelection = { type: 'cell', cellId: 'missing-cell' };
    mockPublishedCellsById = new Map();

    renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(rackLayerLastProps?.primarySelectedRackId).toBeNull();
  });

  it('characterizes current transitional behavior: storage container selection does not produce primarySelectedRackId continuity', () => {
    const draft = createLayoutDraftFixture();
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = 'rack-stale';
    mockSelection = { type: 'container', containerId: 'container-1', sourceCellId: 'cell-1' };
    mockPublishedCellsById = new Map();

    renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(rackLayerLastProps?.primarySelectedRackId).toBeNull();
  });
});
