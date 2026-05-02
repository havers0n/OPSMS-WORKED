import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cell, FloorWorkspace, LayoutDraft } from '@wos/domain';
import type {
  EditorSelection,
  ViewMode
} from '@/warehouse/editor/model/editor-types';
import { resolvePanelMode } from './storage-inspector-v2/mode';
import { createLayoutDraftFixture } from '../model/__fixtures__/layout-draft.fixture';
import { EditorCanvas } from './editor-canvas';

const { mockIsRackInViewport } = vi.hoisted(() => ({
  mockIsRackInViewport: vi.fn(() => true)
}));

let mockViewMode: ViewMode = 'storage';
let mockSelection: EditorSelection = { type: 'none' };
let mockSelectedRackId: string | null = null;
let mockSelectedRackActiveLevel = 2;
let mockStorageFocusActiveLevel: number | null = null;
let mockLayoutDraft: LayoutDraft | null = null;
let mockPublishedCellsById = new Map<string, Cell>();
let mockIsPanning = false;
let rackLayerLastProps: Record<string, unknown> | null = null;
let canvasHudLastProps: Record<string, unknown> | null = null;
let storageFocusSelectCellSpy = vi.fn();
let storageFocusSelectRackSpy = vi.fn();

vi.mock('react-konva', () => ({
  Layer: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Layer', props, children),
  Line: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Line', props, children),
  Rect: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Rect', props, children),
  Stage: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Stage', props, children)
}));

vi.mock('@/entities/layout-version/lib/canvas-geometry', () => ({
  GRID_SIZE: 1,
  MAJOR_GRID_SIZE: 5,
  MINOR_GRID_ZOOM_THRESHOLD: 999,
  isRackInViewport: mockIsRackInViewport
}));

vi.mock('@/warehouse/editor/model/editor-selectors', () => ({
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
  useViewMode: () => mockViewMode,
  useViewStage: () => 'map' as const
}));

vi.mock('@/warehouse/editor/model/editor-store', () => ({
  useEditorStore: (
    selector: (state: { selectedRackActiveLevel: number }) => unknown
  ) => selector({ selectedRackActiveLevel: mockSelectedRackActiveLevel })
}));

vi.mock('@/warehouse/editor/model/interaction-store', () => ({
  useInteractionStore: (
    selector: (state: { selection: EditorSelection }) => unknown
  ) => selector({ selection: mockSelection })
}));

vi.mock('@/warehouse/editor/model/v2/v2-selectors', () => ({
  useStorageFocusActiveLevel: () => mockStorageFocusActiveLevel,
  useStorageFocusSelectedCellId: () =>
    mockSelection.type === 'cell' ? mockSelection.cellId : null,
  useStorageFocusSelectedRackId: () => mockSelectedRackId,
  useStorageFocusSelectCell: () => storageFocusSelectCellSpy,
  useStorageFocusSelectRack: () => storageFocusSelectRackSpy,
  useStorageFocusHandleEmptyCanvasClick: () => () => undefined
}));

vi.mock('../lib/use-workspace-layout', () => ({
  useWorkspaceLayout: () => mockLayoutDraft
}));

vi.mock('./canvas-hud', () => ({
  CanvasHud: (props: Record<string, unknown>) => {
    canvasHudLastProps = props;
    return null;
  }
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
    isPanning: mockIsPanning,
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
      racks: mockLayoutDraft ? Object.values(mockLayoutDraft.racks) : [],
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
      canvasSelectedCellId:
        mockSelection.type === 'cell' ? mockSelection.cellId : null,
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

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderCanvas(
  workspace: FloorWorkspace,
  params?: { isStorageV2?: boolean }
) {
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
    canvasHudLastProps = null;
    storageFocusSelectCellSpy = vi.fn();
    storageFocusSelectRackSpy = vi.fn();
    mockStorageFocusActiveLevel = null;
    mockIsPanning = false;
    mockIsRackInViewport.mockReset();
    mockIsRackInViewport.mockReturnValue(true);
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
      [
        'cell-1',
        {
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
        } satisfies Cell
      ]
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
      [
        'cell-1',
        {
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
        } satisfies Cell
      ]
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
    mockSelection = {
      type: 'container',
      containerId: 'container-1',
      sourceCellId: 'cell-1'
    };
    mockPublishedCellsById = new Map([
      [
        'cell-1',
        {
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
        } satisfies Cell
      ]
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
    mockSelection = {
      type: 'container',
      containerId: 'container-1',
      sourceCellId: 'cell-1'
    };
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
      [
        'cell-1',
        {
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
        } satisfies Cell
      ]
    ]);

    renderCanvas(
      {
        floorId: draft.floorId,
        activeDraft: draft,
        latestPublished: draft
      },
      { isStorageV2: true }
    );

    const onV2StorageCellSelect =
      rackLayerLastProps?.onV2StorageCellSelect as (params: {
        cellId: string;
        rackId: string;
      }) => void;
    expect(typeof onV2StorageCellSelect).toBe('function');
    act(() => {
      onV2StorageCellSelect({ cellId: 'cell-1', rackId });
    });

    expect(storageFocusSelectCellSpy).toHaveBeenCalledWith({
      cellId: 'cell-1',
      rackId,
      level: 3
    });

    const panelMode = resolvePanelMode(rackId, 'cell-1', null);
    expect(panelMode).toEqual({ kind: 'cell-overview', cellId: 'cell-1' });
  });

  it('storage V2 canvas rack callback writes the first resolved published level', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelection = { type: 'none' };
    mockPublishedCellsById = new Map([
      [
        'cell-5',
        {
          id: 'cell-5',
          layoutVersionId: 'lv-1',
          rackId,
          rackFaceId: 'face-a',
          rackSectionId: 'section-a',
          rackLevelId: 'level-5',
          slotNo: 1,
          address: {
            raw: '01-A.01.05.01',
            parts: { rackCode: '01', face: 'A', section: 1, level: 5, slot: 1 },
            sortKey: '0001-A-01-05-01'
          },
          cellCode: 'CELL-5',
          status: 'active'
        } satisfies Cell
      ],
      [
        'cell-3',
        {
          id: 'cell-3',
          layoutVersionId: 'lv-1',
          rackId,
          rackFaceId: 'face-a',
          rackSectionId: 'section-a',
          rackLevelId: 'level-3',
          slotNo: 1,
          address: {
            raw: '01-A.01.03.01',
            parts: { rackCode: '01', face: 'A', section: 1, level: 3, slot: 1 },
            sortKey: '0001-A-01-03-01'
          },
          cellCode: 'CELL-3',
          status: 'active'
        } satisfies Cell
      ]
    ]);

    renderCanvas(
      {
        floorId: draft.floorId,
        activeDraft: draft,
        latestPublished: draft
      },
      { isStorageV2: true }
    );

    const onV2StorageRackSelect =
      rackLayerLastProps?.onV2StorageRackSelect as (params: {
        rackId: string;
      }) => void;
    expect(typeof onV2StorageRackSelect).toBe('function');
    act(() => {
      onV2StorageRackSelect({ rackId });
    });

    expect(storageFocusSelectRackSpy).toHaveBeenCalledWith({
      rackId,
      level: 3
    });
    expect(storageFocusSelectCellSpy).not.toHaveBeenCalled();
  });

  it('keeps the selected rack active level null in Storage V2 until a semantic level is resolved', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = rackId;
    mockStorageFocusActiveLevel = null;
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

    expect(rackLayerLastProps?.selectedRackActiveLevel).toBeNull();
  });

  it('maps sparse semantic rack focus levels to the matching canvas level index', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    draft.racks[rackId] = {
      ...draft.racks[rackId],
      faces: [
        {
          ...draft.racks[rackId].faces[0],
          sections: [
            {
              ...draft.racks[rackId].faces[0].sections[0],
              levels: [
                { id: 'level-3', ordinal: 3, slotCount: 3 },
                { id: 'level-5', ordinal: 5, slotCount: 3 }
              ]
            }
          ]
        },
        draft.racks[rackId].faces[1]
      ]
    };
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = rackId;
    mockStorageFocusActiveLevel = 3;
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

    expect(rackLayerLastProps?.selectedRackActiveLevel).toBe(0);
  });

  it('suppresses storage inspect affordance wiring in active Storage V2 canvas path', () => {
    const draft = createLayoutDraftFixture();
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelection = { type: 'cell', cellId: 'cell-1' };
    mockPublishedCellsById = new Map();

    renderCanvas(
      {
        floorId: draft.floorId,
        activeDraft: draft,
        latestPublished: draft
      },
      { isStorageV2: true }
    );

    expect(canvasHudLastProps?.shouldShowStorageCellBar).toBe(false);
  });

  it('keeps an offscreen selected cell parent rack in the RackLayer input', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0] as string;
    mockIsRackInViewport.mockReturnValue(false);
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelectedRackId = null;
    mockSelectedRackActiveLevel = 2;
    mockSelection = { type: 'cell', cellId: 'cell-1' };
    mockPublishedCellsById = new Map([
      [
        'cell-1',
        {
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
        } satisfies Cell
      ]
    ]);

    renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    const racks = rackLayerLastProps?.racks as Array<{ id: string }>;
    expect(racks.map((rack) => rack.id)).toContain(rackId);
  });

  it('forwards active pan visual mode to RackLayer and restores idle mode', () => {
    const draft = createLayoutDraftFixture();
    mockLayoutDraft = draft;
    mockViewMode = 'storage';
    mockSelection = { type: 'none' };
    mockPublishedCellsById = new Map();
    mockIsPanning = true;

    const renderer = renderCanvas({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(rackLayerLastProps?.isActivelyPanning).toBe(true);

    act(() => {
      mockIsPanning = false;
      renderer.update(
        createElement(EditorCanvas, {
          workspace: {
            floorId: draft.floorId,
            activeDraft: draft,
            latestPublished: draft
          },
          onAddRack: () => undefined,
          onOpenInspector: () => undefined
        })
      );
    });

    expect(rackLayerLastProps?.isActivelyPanning).toBe(false);
  });
});
