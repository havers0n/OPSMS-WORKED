import type {
  LayoutDraft,
  Rack,
  RackFace,
  RackKind,
  SlotNumberingDirection,
  Wall,
  Zone
} from '@wos/domain';
import { create } from 'zustand';
import {
  type ActiveStorageWorkflow,
  type ContextPanelMode,
  normalizeViewMode,
  type AnyViewMode,
  type EditorMode,
  type EditorSelection,
  type RackSelectionFocus,
  type RackSideFocus,
  type ViewMode
} from './editor-types';
import {
  checkMinimumDistance,
  alignRacksToLine,
  distributeRacksEqually
} from '../lib/rack-spacing';
import {
  getRackCanvasRect,
  GRID_SIZE
} from '../lib/canvas-geometry';

const TRACE = import.meta.env.DEV;

function summarizeDraftForLogs(draft: LayoutDraft | null | undefined) {
  if (!draft) return null;
  const sample = draft.rackIds
    .slice(0, 10)
    .map((id) => {
      const rack = draft.racks[id];
      if (!rack) return null;
      return { id: rack.id, x: rack.x, y: rack.y };
    })
    .filter(Boolean);

  return {
    layoutVersionId: draft.layoutVersionId,
    state: draft.state,
    rackCount: draft.rackIds.length,
    zoneCount: draft.zoneIds.length,
    wallCount: draft.wallIds.length,
    sample
  };
}

type EditorStore = {
  viewMode: ViewMode;
  editorMode: EditorMode;
  /** Canonical selection state. Use setSelection / clearSelection to mutate. */
  selection: EditorSelection;
  activeStorageWorkflow: ActiveStorageWorkflow;
  contextPanelMode: ContextPanelMode;
  hoveredRackId: string | null;
  /** ID of the rack currently going through the creation wizard. Cleared on wizard finish/cancel. */
  creatingRackId: string | null;
  highlightedCellIds: string[];
  zoom: number;
  minRackDistance: number;
  draft: LayoutDraft | null;
  draftSourceVersionId: string | null;
  isDraftDirty: boolean;
  setViewMode: (mode: AnyViewMode) => void;
  setEditorMode: (mode: EditorMode) => void;
  setSelection: (selection: EditorSelection) => void;
  clearSelection: () => void;
  /** Convenience wrapper — sets a rack-type selection from an id array. */
  setSelectedRackIds: (rackIds: string[]) => void;
  /** Convenience wrapper — sets a single-rack selection, or clears if null. */
  setSelectedRackId: (rackId: string | null) => void;
  /** Focus a specific side of one selected rack. */
  setSelectedRackSide: (rackId: string, side: RackSideFocus) => void;
  toggleRackSelection: (rackId: string) => void;
  setSelectedZoneId: (zoneId: string | null) => void;
  setSelectedWallId: (wallId: string | null) => void;
  /** Convenience wrapper — sets a cell-type selection, or clears if null. */
  setSelectedCellId: (cellId: string | null) => void;
  /** Convenience wrapper — sets a container-type selection, or clears if null. */
  setSelectedContainerId: (containerId: string | null, sourceCellId?: string | null) => void;
  startPlaceContainerWorkflow: (cellId: string) => void;
  startCreateAndPlaceWorkflow: (cellId: string) => void;
  startPlacementMove: (containerId: string, fromCellId: string) => void;
  setPlacementMoveTargetCellId: (cellId: string | null) => void;
  cancelPlacementInteraction: () => void;
  setActiveStorageWorkflowError: (errorMessage: string | null) => void;
  setCreateAndPlacePlacementRetry: (createdContainer: { id: string; code: string }, errorMessage: string) => void;
  markActiveStorageWorkflowSubmitting: () => void;
  setContextPanelMode: (mode: ContextPanelMode) => void;
  toggleContextPanelMode: () => void;
  setHoveredRackId: (rackId: string | null) => void;
  setCreatingRackId: (rackId: string | null) => void;
  setHighlightedCellIds: (cellIds: string[]) => void;
  clearHighlightedCellIds: () => void;
  setZoom: (zoom: number) => void;
  setMinRackDistance: (distance: number) => void;
  resetDraft: () => void;
  initializeDraft: (draft: LayoutDraft) => void;
  markDraftSaved: (layoutVersionId: string) => void;
  createRack: (x: number, y: number) => void;
  createZone: (rect: { x: number; y: number; width: number; height: number }) => void;
  createWallFromRackSide: (rackId: string, side: RackSideFocus) => void;
  deleteRack: (rackId: string) => void;
  deleteZone: (zoneId: string) => void;
  deleteWall: (wallId: string) => void;
  duplicateRack: (rackId: string) => void;
  updateRackPosition: (rackId: string, x: number, y: number) => void;
  updateZoneRect: (zoneId: string, rect: { x: number; y: number; width: number; height: number }) => void;
  updateZoneDetails: (zoneId: string, patch: Partial<Pick<Zone, 'name' | 'category' | 'color'>>) => void;
  updateWallGeometry: (
    wallId: string,
    geometry: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>
  ) => void;
  updateWallDetails: (
    wallId: string,
    patch: Partial<Pick<Wall, 'code' | 'name' | 'wallType' | 'blocksRackPlacement'>>
  ) => void;
  rotateRack: (rackId: string) => void;
  updateRackGeneral: (rackId: string, patch: Partial<Pick<Rack, 'displayCode' | 'kind' | 'axis' | 'totalLength' | 'depth'>>) => void;
  updateFaceConfig: (rackId: string, side: 'A' | 'B', patch: Partial<Pick<RackFace, 'slotNumberingDirection' | 'enabled'>>) => void;
  updateSectionLength: (rackId: string, side: 'A' | 'B', sectionId: string, length: number) => void;
  updateSectionSlots: (rackId: string, side: 'A' | 'B', sectionId: string, slotCount: number) => void;
  updateLevelCount: (rackId: string, side: 'A' | 'B', sectionId: string, count: number) => void;
  addSection: (rackId: string, side: 'A' | 'B') => void;
  deleteSection: (rackId: string, side: 'A' | 'B', sectionId: string) => void;
  addLevel: (rackId: string, side: 'A' | 'B', sectionId: string) => void;
  setFaceBMode: (rackId: string, mode: 'mirror' | 'copy' | 'scratch') => void;
  resetFaceB: (rackId: string) => void;
  /** Replace all sections in a face with N equal-length sections generated from preset values. */
  applyFacePreset: (rackId: string, side: 'A' | 'B', sectionCount: number, levelCount: number, slotCount: number) => void;
  /** Set an independent physical length for one face (paired racks with asymmetric face lengths). */
  setFaceLength: (rackId: string, side: 'A' | 'B', length: number) => void;
  alignRacksHorizontal: (rackIds: string[]) => void;
  alignRacksVertical: (rackIds: string[]) => void;
  distributeRacksEqual: (rackIds: string[], axis: 'x' | 'y') => void;
};

const initialEditorState = {
  viewMode: 'layout' as ViewMode,
  editorMode: 'select' as EditorMode,
  selection: { type: 'none' } as EditorSelection,
  activeStorageWorkflow: null as ActiveStorageWorkflow,
  contextPanelMode: 'compact' as ContextPanelMode,
  hoveredRackId: null,
  creatingRackId: null,
  highlightedCellIds: [],
  zoom: 1,
  minRackDistance: 0,
  draft: null,
  draftSourceVersionId: null,
  isDraftDirty: false
};

// ── Selection helpers ──────────────────────────────────────────────────────────

function makeRackSelection(
  ids: string[],
  focus: RackSelectionFocus = { type: 'body' }
): EditorSelection {
  return ids.length > 0 ? { type: 'rack', rackIds: ids, focus } : { type: 'none' };
}

function getRackSelectionFocus(selection: EditorSelection): RackSelectionFocus {
  return selection.type === 'rack'
    ? (selection.focus ?? { type: 'body' })
    : { type: 'body' };
}

function getSelectedRackIds(selection: EditorSelection): string[] {
  return selection.type === 'rack' ? selection.rackIds : [];
}

function cloneDraft(draft: LayoutDraft): LayoutDraft {
  return structuredClone(draft);
}

function canEditDraft(draft: LayoutDraft | null): draft is LayoutDraft {
  return Boolean(draft && draft.state === 'draft');
}

function updateRackInDraft(draft: LayoutDraft, rackId: string, updater: (rack: Rack) => Rack): LayoutDraft {
  const nextDraft = cloneDraft(draft);
  const rack = nextDraft.racks[rackId];
  nextDraft.racks[rackId] = updater(rack);
  return nextDraft;
}

function updateZoneInDraft(draft: LayoutDraft, zoneId: string, updater: (zone: Zone) => Zone): LayoutDraft {
  const nextDraft = cloneDraft(draft);
  const zone = nextDraft.zones[zoneId];
  if (!zone) {
    return draft;
  }

  nextDraft.zones[zoneId] = updater(zone);
  return nextDraft;
}

function updateWallInDraft(draft: LayoutDraft, wallId: string, updater: (wall: Wall) => Wall): LayoutDraft {
  const nextDraft = cloneDraft(draft);
  const wall = nextDraft.walls[wallId];
  if (!wall) {
    return draft;
  }

  nextDraft.walls[wallId] = updater(wall);
  return nextDraft;
}

function nextSectionOrdinal(face: RackFace) {
  return face.sections.length === 0 ? 1 : Math.max(...face.sections.map((section) => section.ordinal)) + 1;
}

function nextLevelOrdinal(section: RackFace['sections'][number]) {
  return section.levels.length === 0 ? 1 : Math.max(...section.levels.map((level) => level.ordinal)) + 1;
}

function newEntityId() {
  return crypto.randomUUID();
}

function roundLength(length: number) {
  return Math.round(length * 1000) / 1000;
}

function lengthsMatch(left: number, right: number) {
  return Math.abs(left - right) < 0.001;
}

function buildEmptySection(side: 'A' | 'B', ordinal: number, slotCount = 3, length = 2.5) {
  return {
    id: newEntityId(),
    ordinal,
    length,
    levels: [{ id: newEntityId(), ordinal: 1, slotCount }]
  };
}

function scaleSectionsToLength(sections: RackFace['sections'], targetLength: number) {
  if (sections.length === 0) {
    return sections;
  }

  if (sections.length === 1) {
    return lengthsMatch(sections[0].length, targetLength)
      ? sections
      : [{ ...sections[0], length: roundLength(targetLength) }];
  }

  const currentSum = sections.reduce((sum, section) => sum + section.length, 0);
  if (currentSum <= 0 || lengthsMatch(currentSum, targetLength)) {
    return sections;
  }

  const nextSections = sections.map((section) => ({ ...section }));
  let assigned = 0;

  for (let index = 0; index < nextSections.length; index += 1) {
    if (index === nextSections.length - 1) {
      nextSections[index].length = roundLength(targetLength - assigned);
      continue;
    }

    const scaled = roundLength((sections[index].length / currentSum) * targetLength);
    nextSections[index].length = scaled;
    assigned += scaled;
  }

  return nextSections;
}

function normalizeRack(rack: Rack): Rack {
  return {
    ...rack,
    faces: rack.faces.map((face) => {
      if (rack.kind === 'single' && face.side === 'B') {
        return {
          ...face,
          enabled: false,
          isMirrored: false,
          mirrorSourceFaceId: null,
          faceLength: undefined,
          sections: []
        };
      }

      if (face.side === 'B' && face.isMirrored) {
        return {
          ...face,
          enabled: true,
          faceLength: undefined,
          sections: []
        };
      }

      if (face.sections.length === 0) {
        return face;
      }

      const expectedLength = face.faceLength ?? rack.totalLength;
      const nextSections = scaleSectionsToLength(face.sections, expectedLength);
      return nextSections === face.sections ? face : { ...face, sections: nextSections };
    })
  };
}

function normalizeDraft(draft: LayoutDraft) {
  let changed = false;
  const nextDraft = cloneDraft(draft);

  for (const rackId of nextDraft.rackIds) {
    const normalizedRack = normalizeRack(nextDraft.racks[rackId]);
    if (JSON.stringify(normalizedRack) !== JSON.stringify(nextDraft.racks[rackId])) {
      nextDraft.racks[rackId] = normalizedRack;
      changed = true;
    }
  }

  return { draft: nextDraft, changed };
}

function nextRackDisplayCode(racks: Record<string, Rack>): string {
  const numerics = Object.values(racks)
    .map((r) => parseInt(r.displayCode, 10))
    .filter((n) => !isNaN(n));
  const max = numerics.length > 0 ? Math.max(...numerics) : 0;
  return String(max + 1).padStart(2, '0');
}

function nextZoneCode(zones: Record<string, Zone>): string {
  const numerics = Object.values(zones)
    .map((zone) => parseInt(zone.code.replace(/^Z/i, ''), 10))
    .filter((value) => !Number.isNaN(value));
  const max = numerics.length > 0 ? Math.max(...numerics) : 0;
  return `Z${String(max + 1).padStart(2, '0')}`;
}

function clampZoneCoordinate(value: number) {
  return Math.round(value);
}

function clampZoneSize(value: number) {
  return Math.max(40, Math.round(value));
}

const DEFAULT_ZONE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa'];
const WALL_SIDE_OFFSET = 12;
const MIN_WALL_LENGTH = GRID_SIZE;

function buildNewZone(
  zones: Record<string, Zone>,
  rect: { x: number; y: number; width: number; height: number }
): Zone {
  const id = newEntityId();
  const code = nextZoneCode(zones);
  const colorIndex =
    Math.max(0, parseInt(code.replace(/^Z/i, ''), 10) - 1) %
    DEFAULT_ZONE_COLORS.length;

  return {
    id,
    code,
    name: `Zone ${code.replace(/^Z/i, '')}`,
    category: null,
    color: DEFAULT_ZONE_COLORS[colorIndex],
    x: clampZoneCoordinate(rect.x),
    y: clampZoneCoordinate(rect.y),
    width: clampZoneSize(rect.width),
    height: clampZoneSize(rect.height)
  };
}

function buildNewRack(racks: Record<string, Rack>, x: number, y: number): Rack {
  const rackId = newEntityId();
  const faceAId = newEntityId();
  const faceBId = newEntityId();
  const displayCode = nextRackDisplayCode(racks);
  const totalLength = 5;

  return {
    id: rackId,
    displayCode,
    kind: 'single',
    axis: 'NS',
    x,
    y,
    totalLength,
    depth: 1.2,
    rotationDeg: 0,
    faces: [
      {
        id: faceAId,
        side: 'A',
        enabled: true,
        slotNumberingDirection: 'ltr',
        isMirrored: false,
        mirrorSourceFaceId: null,
        sections: [buildEmptySection('A', 1, 3, totalLength)]
      },
      {
        id: faceBId,
        side: 'B',
        enabled: false,
        slotNumberingDirection: 'ltr',
        isMirrored: false,
        mirrorSourceFaceId: null,
        sections: []
      }
    ]
  };
}

function nextWallCode(walls: Record<string, Wall>): string {
  const numerics = Object.values(walls)
    .map((wall) => parseInt(wall.code.replace(/^W/i, ''), 10))
    .filter((value) => !Number.isNaN(value));
  const max = numerics.length > 0 ? Math.max(...numerics) : 0;
  return `W${String(max + 1).padStart(2, '0')}`;
}

function roundWallCoordinate(value: number) {
  return Math.round(value);
}

function getWallOrientation(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>): 'horizontal' | 'vertical' {
  if (wall.x1 === wall.x2 && wall.y1 !== wall.y2) {
    return 'vertical';
  }

  if (wall.y1 === wall.y2 && wall.x1 !== wall.x2) {
    return 'horizontal';
  }

  const dx = Math.abs(wall.x2 - wall.x1);
  const dy = Math.abs(wall.y2 - wall.y1);
  return dx >= dy ? 'horizontal' : 'vertical';
}

function normalizeWallGeometry(
  geometry: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>,
  previousWall?: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>
) {
  const orientation = previousWall
    ? getWallOrientation(previousWall)
    : getWallOrientation(geometry);
  const x1 = roundWallCoordinate(geometry.x1);
  const y1 = roundWallCoordinate(geometry.y1);
  const x2 = roundWallCoordinate(geometry.x2);
  const y2 = roundWallCoordinate(geometry.y2);

  if (orientation === 'horizontal') {
    const y =
      previousWall &&
      geometry.y1 === previousWall.y1 &&
      geometry.y2 !== previousWall.y2
        ? y2
        : y1;
    const nextX2 = x2 === x1 ? x1 + MIN_WALL_LENGTH : x2;
    return {
      x1,
      y1: y,
      x2: roundWallCoordinate(nextX2),
      y2: y
    };
  }

  const x =
    previousWall &&
    geometry.x1 === previousWall.x1 &&
    geometry.x2 !== previousWall.x2
      ? x2
      : x1;
  const nextY2 = y2 === y1 ? y1 + MIN_WALL_LENGTH : y2;
  return {
    x1: x,
    y1,
    x2: x,
    y2: roundWallCoordinate(nextY2)
  };
}

function buildWallSeedFromRackSide(
  rack: Rack,
  side: RackSideFocus
): Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'> {
  const rackRect = getRackCanvasRect(rack);

  if (side === 'north') {
    const y = Math.max(0, Math.round(rackRect.y - WALL_SIDE_OFFSET));
    return normalizeWallGeometry({
      x1: rackRect.x,
      y1: y,
      x2: rackRect.x + Math.max(MIN_WALL_LENGTH, rackRect.width),
      y2: y
    });
  }

  if (side === 'south') {
    const y = Math.round(rackRect.y + rackRect.height + WALL_SIDE_OFFSET);
    return normalizeWallGeometry({
      x1: rackRect.x,
      y1: y,
      x2: rackRect.x + Math.max(MIN_WALL_LENGTH, rackRect.width),
      y2: y
    });
  }

  if (side === 'west') {
    const x = Math.max(0, Math.round(rackRect.x - WALL_SIDE_OFFSET));
    return normalizeWallGeometry({
      x1: x,
      y1: rackRect.y,
      x2: x,
      y2: rackRect.y + Math.max(MIN_WALL_LENGTH, rackRect.height)
    });
  }

  const x = Math.round(rackRect.x + rackRect.width + WALL_SIDE_OFFSET);
  return normalizeWallGeometry({
    x1: x,
    y1: rackRect.y,
    x2: x,
    y2: rackRect.y + Math.max(MIN_WALL_LENGTH, rackRect.height)
  });
}

function buildNewWallFromRackSide(
  walls: Record<string, Wall>,
  rack: Rack,
  side: RackSideFocus
): Wall {
  const code = nextWallCode(walls);

  return {
    id: newEntityId(),
    code,
    name: `Wall ${code.replace(/^W/i, '')}`,
    wallType: 'generic',
    ...buildWallSeedFromRackSide(rack, side),
    blocksRackPlacement: true
  };
}

export const useEditorStore = create<EditorStore>((set) => ({
  ...initialEditorState,
  setViewMode: (nextViewMode) =>
    set({
      viewMode: normalizeViewMode(nextViewMode),
      editorMode: 'select',
      // Clear selection on every mode switch — stale rack/cell selections from
      // the previous mode should never bleed into the new one.
      selection: { type: 'none' },
      activeStorageWorkflow: null,
      creatingRackId: null,
      highlightedCellIds: []
    }),
  setEditorMode: (editorMode) => set({ editorMode }),
  setSelection: (selection) =>
    set({
      selection,
      activeStorageWorkflow: null
    }),
  clearSelection: () =>
    set({
      selection: { type: 'none' },
      activeStorageWorkflow: null
    }),
  setSelectedRackIds: (rackIds) =>
    set({
      selection: makeRackSelection(rackIds),
      activeStorageWorkflow: null
    }),
  setSelectedRackId: (rackId) =>
    set({
      selection: rackId
        ? { type: 'rack', rackIds: [rackId], focus: { type: 'body' } }
        : { type: 'none' },
      activeStorageWorkflow: null
    }),
  setSelectedRackSide: (rackId, side) =>
    set({
      selection: {
        type: 'rack',
        rackIds: [rackId],
        focus: { type: 'side', side }
      },
      activeStorageWorkflow: null
    }),
  toggleRackSelection: (rackId) => set((state) => {
    const current = getSelectedRackIds(state.selection);
    const next = current.includes(rackId)
      ? current.filter(id => id !== rackId)
      : [...current, rackId];
    return {
      selection: makeRackSelection(next),
      activeStorageWorkflow: null
    };
  }),
  setSelectedZoneId: (zoneId) =>
    set({
      selection: zoneId ? { type: 'zone', zoneId } : { type: 'none' },
      activeStorageWorkflow: null
    }),
  setSelectedWallId: (wallId) =>
    set({
      selection: wallId ? { type: 'wall', wallId } : { type: 'none' },
      activeStorageWorkflow: null
    }),
  setSelectedCellId: (cellId) =>
    set({
      selection: cellId ? { type: 'cell', cellId } : { type: 'none' },
      activeStorageWorkflow: null
    }),
  setSelectedContainerId: (containerId, sourceCellId = null) =>
    set({
      selection: containerId
        ? { type: 'container', containerId, sourceCellId }
        : { type: 'none' },
      activeStorageWorkflow: null
    }),
  startPlaceContainerWorkflow: (cellId) =>
    set((state) => ({
      selection: { type: 'cell', cellId },
      activeStorageWorkflow:
        state.viewMode === 'storage'
          ? {
              kind: 'place-container',
              cellId,
              status: 'editing',
              errorMessage: null
            }
          : state.activeStorageWorkflow
    })),
  startCreateAndPlaceWorkflow: (cellId) =>
    set((state) => ({
      selection: { type: 'cell', cellId },
      activeStorageWorkflow:
        state.viewMode === 'storage'
          ? {
              kind: 'create-and-place',
              cellId,
              status: 'editing',
              errorMessage: null,
              createdContainer: null
            }
          : state.activeStorageWorkflow
    })),
  startPlacementMove: (containerId, fromCellId) =>
    set((state) => ({
      activeStorageWorkflow:
        state.viewMode === 'storage'
          ? {
              kind: 'move-container',
              containerId,
              sourceCellId: fromCellId,
              targetCellId: null,
              status: 'targeting',
              errorMessage: null
            }
          : state.activeStorageWorkflow
    })),
  setPlacementMoveTargetCellId: (cellId) =>
    set((state) => ({
      activeStorageWorkflow:
        state.activeStorageWorkflow?.kind === 'move-container' &&
        state.activeStorageWorkflow.status !== 'submitting'
          ? {
              ...state.activeStorageWorkflow,
              targetCellId: cellId,
              status: 'targeting',
              errorMessage: null
            }
          : state.activeStorageWorkflow
    })),
  cancelPlacementInteraction: () => set({ activeStorageWorkflow: null }),
  setActiveStorageWorkflowError: (errorMessage) =>
    set((state) => {
      if (state.activeStorageWorkflow === null) {
        return state;
      }

      if (errorMessage === null) {
        if (state.activeStorageWorkflow.kind === 'move-container') {
          return {
            activeStorageWorkflow: {
              ...state.activeStorageWorkflow,
              status: 'targeting',
              errorMessage: null
            }
          };
        }

        if (state.activeStorageWorkflow.kind === 'place-container') {
          return {
            activeStorageWorkflow: {
              ...state.activeStorageWorkflow,
              status: 'editing',
              errorMessage: null
            }
          };
        }

        return {
          activeStorageWorkflow: {
            ...state.activeStorageWorkflow,
            status:
              state.activeStorageWorkflow.createdContainer !== null
                ? 'placement-retry'
                : 'editing',
            errorMessage: null
          }
        };
      }

      return {
        activeStorageWorkflow: {
          ...state.activeStorageWorkflow,
          status: 'error',
          errorMessage
        }
      };
    }),
  setCreateAndPlacePlacementRetry: (createdContainer, errorMessage) =>
    set((state) => {
      if (state.activeStorageWorkflow?.kind !== 'create-and-place') {
        return state;
      }

      return {
        activeStorageWorkflow: {
          ...state.activeStorageWorkflow,
          status: 'placement-retry',
          errorMessage,
          createdContainer
        }
      };
    }),
  markActiveStorageWorkflowSubmitting: () =>
    set((state) => {
      if (state.activeStorageWorkflow === null) {
        return state;
      }

      return {
        activeStorageWorkflow: {
          ...state.activeStorageWorkflow,
          status: 'submitting',
          errorMessage: null
        }
      };
    }),
  setContextPanelMode: (contextPanelMode) => set({ contextPanelMode }),
  toggleContextPanelMode: () =>
    set((state) => ({
      contextPanelMode: state.contextPanelMode === 'compact' ? 'expanded' : 'compact'
    })),
  setHoveredRackId: (hoveredRackId) => set({ hoveredRackId }),
  setCreatingRackId: (creatingRackId) => set({ creatingRackId }),
  setHighlightedCellIds: (cellIds) => set({ highlightedCellIds: [...new Set(cellIds)] }),
  clearHighlightedCellIds: () => set({ highlightedCellIds: [] }),
  setZoom: (zoom) => set({ zoom }),
  setMinRackDistance: (minRackDistance) => set({ minRackDistance }),
  resetDraft: () =>
    set(() => {
      if (TRACE) {
        console.debug('[WOS TRACE]', { t: Date.now(), op: 'resetDraft' });
      }
      return {
        draft: null,
        draftSourceVersionId: null,
        selection: { type: 'none' },
        activeStorageWorkflow: null,
        contextPanelMode: 'compact',
        highlightedCellIds: [],
        hoveredRackId: null,
        creatingRackId: null,
        isDraftDirty: false,
        editorMode: 'select',
        viewMode: 'layout'
      };
    }),
  initializeDraft: (draft) =>
    set((state) => {
      if (TRACE) {
        const incoming = summarizeDraftForLogs(draft);
        const sameId = state.draft?.layoutVersionId === draft.layoutVersionId;
        console.debug('[WOS TRACE]', {
          t: Date.now(),
          op: 'initializeDraft:call',
          incoming,
          store: {
            existingLayoutVersionId: state.draft?.layoutVersionId ?? null,
            isDraftDirty: state.isDraftDirty
          },
          guard: { sameId, wouldBlock: sameId }
        });
      }

      // Guard: block same-id rehydration unconditionally.
      //
      // The server stores positions exactly as sent — there is no server-side
      // normalization that would require re-initializing Zustand from a
      // post-save refetch.  Allowing same-id reinits creates a race window:
      // a stale workspace refetch (started before save committed) can arrive
      // after markDraftSaved and overwrite Zustand with pre-save positions.
      //
      // Different-id calls (after publish creates a new draft) are always allowed.
      if (state.draft?.layoutVersionId === draft.layoutVersionId) {
        if (TRACE) {
          console.debug('[WOS TRACE]', {
            t: Date.now(),
            op: 'initializeDraft:guard-blocked',
            layoutVersionId: draft.layoutVersionId
          });
        }
        return state;
      }

      if (TRACE) {
        console.debug('[WOS TRACE]', {
          t: Date.now(),
          op: 'initializeDraft:accepted',
          incoming: summarizeDraftForLogs(draft)
        });
      }

      const normalized = normalizeDraft(draft);
      const nextDraftState = normalized.draft;

      // Preserve the current rack selection only if it's still valid in the new draft.
      // Never auto-select the first rack — it overwrites cell/container selections that
      // happen to be live when a layout-version switch occurs (e.g. draft creation while
      // the user is in placement mode).
      const currentRackIds = getSelectedRackIds(state.selection);
      const nextRackIds =
        currentRackIds.length > 0 && currentRackIds.every(id => nextDraftState.racks[id])
          ? currentRackIds
          : [];
      const nextFocus =
        nextRackIds.length === 1 && currentRackIds.length === 1 && nextRackIds[0] === currentRackIds[0]
          ? getRackSelectionFocus(state.selection)
          : { type: 'body' as const };
      const nextSelection: EditorSelection =
        state.selection.type === 'rack'
          ? makeRackSelection(nextRackIds, nextFocus)
          : state.selection.type === 'zone'
            ? nextDraftState.zones[state.selection.zoneId]
              ? state.selection
              : { type: 'none' }
            : state.selection.type === 'wall'
              ? nextDraftState.walls[state.selection.wallId]
                ? state.selection
                : { type: 'none' }
            : state.selection;

      return {
        draft: nextDraftState,
        draftSourceVersionId: nextDraftState.layoutVersionId,
        selection: nextSelection,
        isDraftDirty: normalized.changed
      };
    }),
  markDraftSaved: (layoutVersionId) =>
    set((state) => {
      if (!state.draft || state.draft.layoutVersionId !== layoutVersionId) {
        return state;
      }

      return {
        draftSourceVersionId: layoutVersionId,
        isDraftDirty: false
      };
    }),
  createRack: (x, y) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const newRack = buildNewRack(state.draft.racks, x, y);
      const nextDraft = cloneDraft(state.draft);
      nextDraft.rackIds = [...nextDraft.rackIds, newRack.id];
      nextDraft.racks[newRack.id] = newRack;

      return {
        draft: nextDraft,
        selection: { type: 'rack', rackIds: [newRack.id], focus: { type: 'body' } },
        creatingRackId: newRack.id,
        editorMode: 'select',
        isDraftDirty: true
      };
    }),
  createZone: (rect) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const newZone = buildNewZone(state.draft.zones, rect);
      const nextDraft = cloneDraft(state.draft);
      nextDraft.zoneIds = [...nextDraft.zoneIds, newZone.id];
      nextDraft.zones[newZone.id] = newZone;

      return {
        draft: nextDraft,
        selection: { type: 'zone', zoneId: newZone.id },
        editorMode: 'select',
        isDraftDirty: true
      };
    }),
  createWallFromRackSide: (rackId, side) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const rack = state.draft.racks[rackId];
      if (!rack) return state;

      const newWall = buildNewWallFromRackSide(state.draft.walls, rack, side);
      const nextDraft = cloneDraft(state.draft);
      nextDraft.wallIds = [...nextDraft.wallIds, newWall.id];
      nextDraft.walls[newWall.id] = newWall;

      return {
        draft: nextDraft,
        selection: { type: 'wall', wallId: newWall.id },
        editorMode: 'select',
        isDraftDirty: true
      };
    }),
  deleteRack: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const nextDraft = cloneDraft(state.draft);
      delete nextDraft.racks[rackId];
      nextDraft.rackIds = nextDraft.rackIds.filter((id) => id !== rackId);

      return {
        draft: nextDraft,
        selection: makeRackSelection(getSelectedRackIds(state.selection).filter(id => id !== rackId)),
        creatingRackId: state.creatingRackId === rackId ? null : state.creatingRackId,
        isDraftDirty: true
      };
    }),
  deleteZone: (zoneId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const nextDraft = cloneDraft(state.draft);
      delete nextDraft.zones[zoneId];
      nextDraft.zoneIds = nextDraft.zoneIds.filter((id) => id !== zoneId);

      return {
        draft: nextDraft,
        selection:
          state.selection.type === 'zone' && state.selection.zoneId === zoneId
            ? { type: 'none' }
            : state.selection,
        isDraftDirty: true
      };
    }),
  deleteWall: (wallId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const nextDraft = cloneDraft(state.draft);
      delete nextDraft.walls[wallId];
      nextDraft.wallIds = nextDraft.wallIds.filter((id) => id !== wallId);

      return {
        draft: nextDraft,
        selection:
          state.selection.type === 'wall' && state.selection.wallId === wallId
            ? { type: 'none' }
            : state.selection,
        isDraftDirty: true
      };
    }),
  duplicateRack: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const source = state.draft.racks[rackId];
      if (!source) return state;

      const newRackId = newEntityId();
      const nextDraft = cloneDraft(state.draft);
      const displayCode = nextRackDisplayCode(nextDraft.racks);

      // Deep-clone the rack and assign new IDs throughout
      const duplicate: Rack = {
        ...structuredClone(source),
        id: newRackId,
        displayCode,
        x: source.x + 80,
        y: source.y + 80,
        faces: source.faces.map((face) => ({
          ...face,
          id: newEntityId(),
          mirrorSourceFaceId: null,
          sections: face.sections.map((section) => ({
            ...section,
            id: newEntityId(),
            levels: section.levels.map((level) => ({
              ...level,
              id: newEntityId()
            }))
          }))
        }))
      };

      nextDraft.rackIds = [...nextDraft.rackIds, newRackId];
      nextDraft.racks[newRackId] = duplicate;

      return {
        draft: nextDraft,
        selection: { type: 'rack', rackIds: [newRackId], focus: { type: 'body' } },
        isDraftDirty: true
      };
    }),
  updateRackPosition: (rackId, x, y) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const rack = state.draft.racks[rackId];
      if (!rack) return state;

      // Validate position with minimum distance constraint
      const otherRacks = Object.values(state.draft.racks).filter(r => r.id !== rackId);
      const isValid = checkMinimumDistance({ ...rack, x, y }, x, y, otherRacks, state.minRackDistance);

      if (!isValid) {
        // Position violates minimum distance - reject update
        return state;
      }

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({ ...rack, x, y })),
        isDraftDirty: true
      };
    }),
  updateZoneRect: (zoneId, rect) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateZoneInDraft(state.draft, zoneId, (zone) => ({
          ...zone,
          x: clampZoneCoordinate(rect.x),
          y: clampZoneCoordinate(rect.y),
          width: clampZoneSize(rect.width),
          height: clampZoneSize(rect.height)
        })),
        isDraftDirty: true
      };
    }),
  updateZoneDetails: (zoneId, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateZoneInDraft(state.draft, zoneId, (zone) => ({
          ...zone,
          name: patch.name !== undefined ? patch.name : zone.name,
          category: patch.category !== undefined ? patch.category : zone.category,
          color: patch.color !== undefined ? patch.color : zone.color
        })),
        isDraftDirty: true
      };
    }),
  updateWallGeometry: (wallId, geometry) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateWallInDraft(state.draft, wallId, (wall) => ({
          ...wall,
          ...normalizeWallGeometry(geometry, wall)
        })),
        isDraftDirty: true
      };
    }),
  updateWallDetails: (wallId, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateWallInDraft(state.draft, wallId, (wall) => ({
          ...wall,
          code:
            patch.code !== undefined && patch.code.trim().length > 0
              ? patch.code.trim()
              : wall.code,
          name:
            patch.name !== undefined
              ? patch.name === null
                ? null
                : patch.name.trim().length > 0
                  ? patch.name.trim()
                  : null
              : wall.name,
          wallType:
            patch.wallType !== undefined ? patch.wallType : wall.wallType,
          blocksRackPlacement:
            patch.blocksRackPlacement !== undefined
              ? patch.blocksRackPlacement
              : wall.blocksRackPlacement
        })),
        isDraftDirty: true
      };
    }),
  rotateRack: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => {
          const newDeg = (((rack.rotationDeg + 90) % 360) as 0 | 90 | 180 | 270);
          // axis auto-syncs with visual rotation:
          //   0° / 180° → rack body is horizontal → WE (West–East)
          //   90° / 270° → rack body is vertical  → NS (North–South)
          const newAxis: Rack['axis'] = (newDeg === 90 || newDeg === 270) ? 'NS' : 'WE';
          return { ...rack, rotationDeg: newDeg, axis: newAxis };
        }),
        isDraftDirty: true
      };
    }),
  updateRackGeneral: (rackId, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => normalizeRack({ ...rack, ...patch })),
        isDraftDirty: true
      };
    }),
  updateFaceConfig: (rackId, side, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) => (face.side === side ? { ...face, ...patch } : face))
        })),
        isDraftDirty: true
      };
    }),
  updateSectionLength: (rackId, side, sectionId, length) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: face.sections.map((section) => (section.id === sectionId ? { ...section, length } : section))
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  updateSectionSlots: (rackId, side, sectionId, slotCount) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: face.sections.map((section) =>
                    section.id === sectionId
                      ? { ...section, levels: section.levels.map((level) => ({ ...level, slotCount })) }
                      : section
                  )
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  updateLevelCount: (rackId, side, sectionId, count) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: face.sections.map((section) => {
                    if (section.id !== sectionId) return section;
                    const target = Math.max(1, count);
                    const currentSlotCount = section.levels[0]?.slotCount ?? 3;
                    if (target > section.levels.length) {
                      const toAdd = Array.from({ length: target - section.levels.length }, (_, i) => ({
                        id: newEntityId(),
                        ordinal: nextLevelOrdinal(section) + i,
                        slotCount: currentSlotCount
                      }));
                      return { ...section, levels: [...section.levels, ...toAdd] };
                    }
                    return { ...section, levels: section.levels.slice(0, target) };
                  })
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  addSection: (rackId, side) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: [
                    ...face.sections,
                    buildEmptySection(side, nextSectionOrdinal(face), face.sections[0]?.levels[0]?.slotCount ?? 3)
                  ]
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  deleteSection: (rackId, side, sectionId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? { ...face, sections: face.sections.filter((section) => section.id !== sectionId) }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  addLevel: (rackId, side, sectionId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: face.sections.map((section) =>
                    section.id === sectionId
                      ? {
                          ...section,
                          levels: [
                            ...section.levels,
                            {
                              id: newEntityId(),
                              ordinal: nextLevelOrdinal(section),
                              slotCount: section.levels[0]?.slotCount ?? 3
                            }
                          ]
                        }
                      : section
                  )
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  applyFacePreset: (rackId, side, sectionCount, levelCount, slotCount) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => {
          const face = rack.faces.find((f) => f.side === side);
          // Use per-face length if set (asymmetric paired rack), else fall back to rack total
          const totalLength = face?.faceLength ?? rack.totalLength;
          const baseLength = Math.floor((totalLength / sectionCount) * 100) / 100;
          // Last section absorbs rounding remainder
          const lastLength = Math.round((totalLength - baseLength * (sectionCount - 1)) * 100) / 100;

          return {
            ...rack,
            faces: rack.faces.map((face) => {
              if (face.side !== side) return face;

              const sections = Array.from({ length: sectionCount }, (_, i) => {
                const ordinal = i + 1;
                const length = i === sectionCount - 1 ? lastLength : baseLength;
                return {
                  id: newEntityId(),
                  ordinal,
                  length,
                  levels: Array.from({ length: levelCount }, (__, j) => ({
                    id: newEntityId(),
                    ordinal: j + 1,
                    slotCount
                  }))
                };
              });

              return { ...face, sections };
            })
          };
        }),
        isDraftDirty: true
      };
    }),
  resetFaceB: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          kind: 'single' as RackKind,
          faces: rack.faces.map((face) =>
            face.side === 'B'
              ? { ...face, enabled: false, isMirrored: false, mirrorSourceFaceId: null, sections: [] }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  setFaceLength: (rackId, side, length) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) =>
          normalizeRack({
            ...rack,
            faces: rack.faces.map((face) => {
              if (face.side === side) {
                return { ...face, faceLength: length };
              }

              if (side === 'A' && face.side === 'B' && face.isMirrored) {
                return { ...face, faceLength: undefined };
              }

              return face;
            })
          })
        ),
        isDraftDirty: true
      };
    }),
  setFaceBMode: (rackId, mode) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => {
          const faceA = rack.faces.find((face) => face.side === 'A');
          const faceB = rack.faces.find((face) => face.side === 'B');

          if (!faceA || !faceB) {
            return rack;
          }

          const sectionsCopy = faceA.sections.map((section) => ({
            ...section,
            id: newEntityId(),
            levels: section.levels.map((level) => ({
              ...level,
              id: newEntityId()
            }))
          }));

          let nextFaceB: RackFace = faceB;

          if (mode === 'mirror') {
            nextFaceB = {
              ...faceB,
              enabled: true,
              isMirrored: true,
              mirrorSourceFaceId: faceA.id,
              faceLength: undefined,
              slotNumberingDirection: 'rtl' as SlotNumberingDirection,
              sections: []
            };
          }

          if (mode === 'copy') {
            nextFaceB = {
              ...faceB,
              enabled: true,
              isMirrored: false,
              mirrorSourceFaceId: null,
              sections: sectionsCopy
            };
          }

          if (mode === 'scratch') {
            nextFaceB = {
              ...faceB,
              enabled: true,
              isMirrored: false,
              mirrorSourceFaceId: null,
              sections: [buildEmptySection('B', 1, 3, faceB.faceLength ?? rack.totalLength)]
            };
          }

          return {
            ...rack,
            kind: 'paired' as RackKind,
            faces: rack.faces.map((face) => (face.side === 'B' ? nextFaceB : face))
          };
        }),
        isDraftDirty: true
      };
    }),
  alignRacksHorizontal: (rackIds) =>
    set((state) => {
      if (!canEditDraft(state.draft) || rackIds.length < 2) return state;

      const racks = rackIds.map(id => state.draft!.racks[id]).filter(Boolean);
      if (racks.length < 2) return state;

      // Use first rack's Y as reference
      const referenceY = racks[0].y;
      const updates = alignRacksToLine(racks, 'y', referenceY);

      let nextDraft = cloneDraft(state.draft);
      for (const [rackId, pos] of Object.entries(updates)) {
        nextDraft = updateRackInDraft(nextDraft, rackId, (rack) => ({ ...rack, ...pos }));
      }

      return {
        draft: nextDraft,
        isDraftDirty: true
      };
    }),
  alignRacksVertical: (rackIds) =>
    set((state) => {
      if (!canEditDraft(state.draft) || rackIds.length < 2) return state;

      const racks = rackIds.map(id => state.draft!.racks[id]).filter(Boolean);
      if (racks.length < 2) return state;

      // Use first rack's X as reference
      const referenceX = racks[0].x;
      const updates = alignRacksToLine(racks, 'x', referenceX);

      let nextDraft = cloneDraft(state.draft);
      for (const [rackId, pos] of Object.entries(updates)) {
        nextDraft = updateRackInDraft(nextDraft, rackId, (rack) => ({ ...rack, ...pos }));
      }

      return {
        draft: nextDraft,
        isDraftDirty: true
      };
    }),
  distributeRacksEqual: (rackIds, axis) =>
    set((state) => {
      if (!canEditDraft(state.draft) || rackIds.length < 2) return state;

      const racks = rackIds.map(id => state.draft!.racks[id]).filter(Boolean);
      if (racks.length < 2) return state;

      const updates = distributeRacksEqually(racks, axis, state.minRackDistance);

      let nextDraft = cloneDraft(state.draft);
      for (const [rackId, pos] of Object.entries(updates)) {
        nextDraft = updateRackInDraft(nextDraft, rackId, (rack) => ({ ...rack, ...pos }));
      }

      return {
        draft: nextDraft,
        isDraftDirty: true
      };
    })
}));

export function resetEditorStore() {
  useEditorStore.setState(initialEditorState);
}
