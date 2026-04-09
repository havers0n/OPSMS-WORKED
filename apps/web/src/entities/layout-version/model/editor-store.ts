import type {
  LayoutChangeClass,
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
  type ActiveLayoutTask,
  type ActiveStorageWorkflow,
  normalizeViewMode,
  type AnyViewMode,
  type EditorMode,
  type EditorSelection,
  type RackSelectionFocus,
  type RackSideFocus,
  type ObjectWorkContext,
  type ViewMode
} from './editor-types';
import { useModeStore } from './mode-store';
import { useInteractionStore } from './interaction-store';
import { createStorageWorkflowActions } from './storage-workflow-actions';
import {
  buildEmptySection,
  buildNewRack,
  buildNewFreeWall,
  buildNewWallFromRackSide,
  buildNewZone,
  canEditDraft,
  clampZoneCoordinate,
  clampZoneSize,
  cloneDraft,
  getRackSelectionFocus,
  getSelectedRackIds,
  makeRackSelection,
  newEntityId,
  nextLevelOrdinal,
  nextRackDisplayCode,
  nextSectionOrdinal,
  normalizeDraft,
  normalizeRack,
  normalizeWallGeometry,
  updateRackInDraft,
  updateWallInDraft,
  updateZoneInDraft
} from './editor-store-helpers';
import {
  checkMinimumDistance,
  alignRacksToLine,
  distributeRacksEqually
} from '../lib/rack-spacing';

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
  objectWorkContext: ObjectWorkContext;
  activeTask: ActiveLayoutTask;
  activeStorageWorkflow: ActiveStorageWorkflow;
  minRackDistance: number;
  draft: LayoutDraft | null;
  draftSourceVersionId: string | null;
  isDraftDirty: boolean;
  persistenceStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error';
  lastSaveErrorMessage: string | null;
  lastChangeClass: LayoutChangeClass | null;
  // — Mode (coordinates with mode-store) —
  setViewMode: (mode: AnyViewMode) => void;
  setEditorMode: (mode: EditorMode) => void;
  setObjectWorkContext: (context: ObjectWorkContext) => void;
  // — Selection coordinators (also reset activeStorageWorkflow) —
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
  // — Storage workflow (domain semantics) —
  startPlaceContainerWorkflow: (cellId: string) => void;
  startCreateAndPlaceWorkflow: (cellId: string) => void;
  startPlacementMove: (containerId: string, fromCellId: string) => void;
  setPlacementMoveTargetCellId: (cellId: string | null) => void;
  cancelPlacementInteraction: () => void;
  setActiveStorageWorkflowError: (errorMessage: string | null) => void;
  setCreateAndPlacePlacementRetry: (createdContainer: { id: string; code: string }, errorMessage: string) => void;
  markActiveStorageWorkflowSubmitting: () => void;
  clearActiveTask: () => void;
  // — Layout config —
  setMinRackDistance: (distance: number) => void;
  resetDraft: () => void;
  initializeDraft: (draft: LayoutDraft) => void;
  markDraftSaving: (saveResult: { layoutVersionId: string }) => void;
  markDraftSaved: (saveResult: {
    layoutVersionId: string;
    draftVersion: number | null;
    changeClass: LayoutChangeClass;
    keepDirty?: boolean;
  }) => void;
  markDraftSaveConflict: (saveResult: { layoutVersionId: string; message: string }) => void;
  markDraftSaveError: (saveResult: {
    layoutVersionId: string;
    message: string;
    keepDirty?: boolean;
  }) => void;
  createRack: (x: number, y: number) => void;
  createZone: (rect: { x: number; y: number; width: number; height: number }) => void;
  createFreeWall: (x1: number, y1: number, x2: number, y2: number) => void;
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
  objectWorkContext: 'geometry' as ObjectWorkContext,
  activeTask: null as ActiveLayoutTask,
  activeStorageWorkflow: null as ActiveStorageWorkflow,
  minRackDistance: 0,
  draft: null,
  draftSourceVersionId: null,
  isDraftDirty: false,
  persistenceStatus: 'idle' as const,
  lastSaveErrorMessage: null as string | null,
  lastChangeClass: null as LayoutChangeClass | null
};

const WORKFLOW_RESET = {
  activeTask: null as ActiveLayoutTask,
  activeStorageWorkflow: null as ActiveStorageWorkflow
};

function getSingleSelectedRackId(selection: EditorSelection): string | null {
  return selection.type === 'rack' && selection.rackIds.length === 1 ? selection.rackIds[0] ?? null : null;
}

function shouldResetObjectWorkContext(prevSelection: EditorSelection, nextSelection: EditorSelection) {
  return getSingleSelectedRackId(prevSelection) !== getSingleSelectedRackId(nextSelection);
}

function objectWorkContextResetPatch(
  prevSelection: EditorSelection,
  nextSelection: EditorSelection
) {
  return shouldResetObjectWorkContext(prevSelection, nextSelection)
    ? { objectWorkContext: 'geometry' as const }
    : {};
}

function markDraftChanged<T extends object>(state: Pick<EditorStore, 'persistenceStatus'>, patch: T): T & {
  isDraftDirty: true;
  persistenceStatus: 'dirty' | 'conflict';
  lastSaveErrorMessage: string | null;
} {
  return {
    ...patch,
    isDraftDirty: true,
    persistenceStatus: state.persistenceStatus === 'conflict' ? 'conflict' : 'dirty',
    lastSaveErrorMessage: null
  };
}

export const useEditorStore = create<EditorStore>((set) => ({
  ...initialEditorState,
  setViewMode: (nextViewMode) => {
    // Coordinate: update mode-store, clear interaction, clear workflow
    useModeStore.getState().setViewMode(nextViewMode);
    useModeStore.getState().setEditorMode('select');
    // clearForModeSwitch: clears selection and highlightedCellIds
    useInteractionStore.getState().clearForModeSwitch();
    set({ ...WORKFLOW_RESET, objectWorkContext: 'geometry' });
  },
  setEditorMode: (editorMode) => {
    useModeStore.getState().setEditorMode(editorMode);
  },
  setObjectWorkContext: (objectWorkContext) => set({ objectWorkContext }),
  // — Selection coordinators: delegate to interaction-store + reset active workflow —
  setSelection: (selection) => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().setSelection(selection);
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, selection)
    });
  },
  clearSelection: () => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().clearSelection();
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, { type: 'none' })
    });
  },
  setSelectedRackIds: (rackIds) => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().setSelectedRackIds(rackIds);
    const nextSelection = makeRackSelection(rackIds);
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, nextSelection)
    });
  },
  setSelectedRackId: (rackId) => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().setSelectedRackId(rackId);
    const nextSelection: EditorSelection = rackId
      ? { type: 'rack', rackIds: [rackId], focus: { type: 'body' } }
      : { type: 'none' };
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, nextSelection)
    });
  },
  setSelectedRackSide: (rackId, side) => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().setSelectedRackSide(rackId, side);
    const nextSelection: EditorSelection = {
      type: 'rack',
      rackIds: [rackId],
      focus: { type: 'side', side }
    };
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, nextSelection)
    });
  },
  toggleRackSelection: (rackId) => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().toggleRackSelection(rackId);
    const current = getSelectedRackIds(prevSelection);
    const next = current.includes(rackId)
      ? current.filter((id) => id !== rackId)
      : [...current, rackId];
    const nextSelection = makeRackSelection(next);
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, nextSelection)
    });
  },
  setSelectedZoneId: (zoneId) => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().setSelectedZoneId(zoneId);
    const nextSelection = zoneId ? ({ type: 'zone', zoneId } as const) : ({ type: 'none' } as const);
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, nextSelection)
    });
  },
  setSelectedWallId: (wallId) => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().setSelectedWallId(wallId);
    const nextSelection = wallId ? ({ type: 'wall', wallId } as const) : ({ type: 'none' } as const);
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, nextSelection)
    });
  },
  setSelectedCellId: (cellId) => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().setSelectedCellId(cellId);
    const nextSelection = cellId ? ({ type: 'cell', cellId } as const) : ({ type: 'none' } as const);
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, nextSelection)
    });
  },
  setSelectedContainerId: (containerId, sourceCellId) => {
    const prevSelection = useInteractionStore.getState().selection;
    useInteractionStore.getState().setSelectedContainerId(containerId, sourceCellId);
    const nextSelection = containerId
      ? ({ type: 'container', containerId, sourceCellId } as const)
      : ({ type: 'none' } as const);
    set({
      ...WORKFLOW_RESET,
      ...objectWorkContextResetPatch(prevSelection, nextSelection)
    });
  },
  startPlaceContainerWorkflow: (cellId) =>
    set((state) => {
      const isStorageMode = useModeStore.getState().viewMode === 'storage';
      // Selection update is a side effect here (drives inspector panel)
      useInteractionStore.getState().setSelectedCellId(cellId);
      return {
        activeStorageWorkflow: isStorageMode
          ? { kind: 'place-container', cellId, status: 'editing', errorMessage: null }
          : state.activeStorageWorkflow
      };
    }),
  startCreateAndPlaceWorkflow: (cellId) =>
    set((state) => {
      const isStorageMode = useModeStore.getState().viewMode === 'storage';
      useInteractionStore.getState().setSelectedCellId(cellId);
      return {
        activeStorageWorkflow: isStorageMode
          ? {
              kind: 'create-and-place',
              cellId,
              status: 'editing',
              errorMessage: null,
              createdContainer: null
            }
          : state.activeStorageWorkflow
      };
    }),
  startPlacementMove: (containerId, fromCellId) =>
    set((state) => {
      const isStorageMode = useModeStore.getState().viewMode === 'storage';
      return {
        activeStorageWorkflow: isStorageMode
          ? {
              kind: 'move-container',
              containerId,
              sourceCellId: fromCellId,
              targetCellId: null,
              status: 'targeting',
              errorMessage: null
            }
          : state.activeStorageWorkflow
      };
    }),
  ...createStorageWorkflowActions(set),
  clearActiveTask: () => set({ activeTask: null }),
  setMinRackDistance: (minRackDistance) => set({ minRackDistance }),
  resetDraft: () => {
    if (TRACE) {
      console.debug('[WOS TRACE]', { t: Date.now(), op: 'resetDraft' });
    }
    useModeStore.getState().setViewMode('layout');
    useModeStore.getState().setEditorMode('select');
    useInteractionStore.getState().resetAll();
    set({
      draft: null,
      draftSourceVersionId: null,
      objectWorkContext: 'geometry',
      ...WORKFLOW_RESET,
      isDraftDirty: false,
      persistenceStatus: 'idle',
      lastSaveErrorMessage: null,
      lastChangeClass: null
    });
  },
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
      const currentSelection = useInteractionStore.getState().selection;
      const currentRackIds = getSelectedRackIds(currentSelection);
      const nextRackIds =
        currentRackIds.length > 0 && currentRackIds.every(id => nextDraftState.racks[id])
          ? currentRackIds
          : [];
      const nextFocus =
        nextRackIds.length === 1 && currentRackIds.length === 1 && nextRackIds[0] === currentRackIds[0]
          ? getRackSelectionFocus(currentSelection)
          : { type: 'body' as const };
      const nextSelection: EditorSelection =
        currentSelection.type === 'rack'
          ? makeRackSelection(nextRackIds, nextFocus)
          : currentSelection.type === 'zone'
            ? nextDraftState.zones[currentSelection.zoneId]
              ? currentSelection
              : { type: 'none' }
            : currentSelection.type === 'wall'
              ? nextDraftState.walls[currentSelection.wallId]
                ? currentSelection
                : { type: 'none' }
            : currentSelection;

      // Update selection in interaction-store if it changed
      if (nextSelection !== currentSelection) {
        useInteractionStore.getState().setSelection(nextSelection);
      }

      return {
        draft: nextDraftState,
        draftSourceVersionId: nextDraftState.layoutVersionId,
        ...objectWorkContextResetPatch(currentSelection, nextSelection),
        isDraftDirty: normalized.changed,
        persistenceStatus: normalized.changed ? 'dirty' : 'idle',
        lastSaveErrorMessage: null,
        lastChangeClass: null
      };
    }),
  markDraftSaving: (saveResult) =>
    set((state) => {
      if (!state.draft || state.draft.layoutVersionId !== saveResult.layoutVersionId) {
        return state;
      }

      return {
        persistenceStatus: 'saving',
        lastSaveErrorMessage: null
      };
    }),
  markDraftSaved: (saveResult) =>
    set((state) => {
      if (!state.draft || state.draft.layoutVersionId !== saveResult.layoutVersionId) {
        return state;
      }

      return {
        draft: {
          ...state.draft,
          draftVersion: saveResult.draftVersion
        },
        draftSourceVersionId: saveResult.layoutVersionId,
        isDraftDirty: saveResult.keepDirty ? true : false,
        persistenceStatus: saveResult.keepDirty ? 'dirty' : 'saved',
        lastSaveErrorMessage: null,
        lastChangeClass: saveResult.changeClass
      };
    }),
  markDraftSaveConflict: (saveResult) =>
    set((state) => {
      if (!state.draft || state.draft.layoutVersionId !== saveResult.layoutVersionId) {
        return state;
      }

      return {
        persistenceStatus: 'conflict',
        lastSaveErrorMessage: saveResult.message
      };
    }),
  markDraftSaveError: (saveResult) =>
    set((state) => {
      if (!state.draft || state.draft.layoutVersionId !== saveResult.layoutVersionId) {
        return state;
      }

      return {
        isDraftDirty: true,
        persistenceStatus: saveResult.keepDirty ? 'dirty' : 'error',
        lastSaveErrorMessage: saveResult.message
      };
    }),
  createRack: (x, y) => {
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const newRack = buildNewRack(state.draft.racks, x, y);
      const nextDraft = cloneDraft(state.draft);
      nextDraft.rackIds = [...nextDraft.rackIds, newRack.id];
      nextDraft.racks[newRack.id] = newRack;
      // Update interaction state as a side effect inside set() — safe because
      // Zustand's set() is synchronous and this fires before subscribers.
      useInteractionStore.getState().setSelection({ type: 'rack', rackIds: [newRack.id], focus: { type: 'body' } });
      return markDraftChanged(state, {
        draft: nextDraft,
        activeTask: { type: 'rack_creation', rackId: newRack.id }
      });
    });
    useModeStore.getState().setEditorMode('select');
  },
  createZone: (rect) => {
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const newZone = buildNewZone(state.draft.zones, rect);
      const nextDraft = cloneDraft(state.draft);
      nextDraft.zoneIds = [...nextDraft.zoneIds, newZone.id];
      nextDraft.zones[newZone.id] = newZone;
      useInteractionStore.getState().setSelection({ type: 'zone', zoneId: newZone.id });
      return markDraftChanged(state, { draft: nextDraft });
    });
    useModeStore.getState().setEditorMode('select');
  },
  createFreeWall: (x1, y1, x2, y2) => {
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const newWall = buildNewFreeWall(state.draft.walls, x1, y1, x2, y2);
      if (!newWall) return state;

      const nextDraft = cloneDraft(state.draft);
      nextDraft.wallIds = [...nextDraft.wallIds, newWall.id];
      nextDraft.walls[newWall.id] = newWall;
      useInteractionStore.getState().setSelection({ type: 'wall', wallId: newWall.id });
      return markDraftChanged(state, { draft: nextDraft });
    });
    useModeStore.getState().setEditorMode('select');
  },
  createWallFromRackSide: (rackId, side) => {
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const rack = state.draft.racks[rackId];
      if (!rack) return state;

      const newWall = buildNewWallFromRackSide(state.draft.walls, rack, side);
      const nextDraft = cloneDraft(state.draft);
      nextDraft.wallIds = [...nextDraft.wallIds, newWall.id];
      nextDraft.walls[newWall.id] = newWall;
      useInteractionStore.getState().setSelection({ type: 'wall', wallId: newWall.id });
      return markDraftChanged(state, { draft: nextDraft });
    });
    useModeStore.getState().setEditorMode('select');
  },
  deleteRack: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const nextDraft = cloneDraft(state.draft);
      delete nextDraft.racks[rackId];
      nextDraft.rackIds = nextDraft.rackIds.filter((id) => id !== rackId);

      const ix = useInteractionStore.getState();
      const nextRackIds = getSelectedRackIds(ix.selection).filter(id => id !== rackId);
      ix.setSelectedRackIds(nextRackIds);

      return markDraftChanged(state, {
        draft: nextDraft,
        activeTask:
          state.activeTask?.type === 'rack_creation' && state.activeTask.rackId === rackId
            ? null
            : state.activeTask
      });
    }),
  deleteZone: (zoneId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const nextDraft = cloneDraft(state.draft);
      delete nextDraft.zones[zoneId];
      nextDraft.zoneIds = nextDraft.zoneIds.filter((id) => id !== zoneId);

      const ix = useInteractionStore.getState();
      if (ix.selection.type === 'zone' && ix.selection.zoneId === zoneId) {
        ix.clearSelection();
      }

      return markDraftChanged(state, { draft: nextDraft });
    }),
  deleteWall: (wallId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const nextDraft = cloneDraft(state.draft);
      delete nextDraft.walls[wallId];
      nextDraft.wallIds = nextDraft.wallIds.filter((id) => id !== wallId);

      const ix = useInteractionStore.getState();
      if (ix.selection.type === 'wall' && ix.selection.wallId === wallId) {
        ix.clearSelection();
      }

      return markDraftChanged(state, { draft: nextDraft });
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
      useInteractionStore.getState().setSelection({ type: 'rack', rackIds: [newRackId], focus: { type: 'body' } });
      return markDraftChanged(state, { draft: nextDraft });
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

      return markDraftChanged(state, {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({ ...rack, x, y })),
      });
    }),
  updateZoneRect: (zoneId, rect) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
        draft: updateZoneInDraft(state.draft, zoneId, (zone) => ({
          ...zone,
          x: clampZoneCoordinate(rect.x),
          y: clampZoneCoordinate(rect.y),
          width: clampZoneSize(rect.width),
          height: clampZoneSize(rect.height)
        })),
      });
    }),
  updateZoneDetails: (zoneId, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
        draft: updateZoneInDraft(state.draft, zoneId, (zone) => ({
          ...zone,
          name: patch.name !== undefined ? patch.name : zone.name,
          category: patch.category !== undefined ? patch.category : zone.category,
          color: patch.color !== undefined ? patch.color : zone.color
        })),
      });
    }),
  updateWallGeometry: (wallId, geometry) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
        draft: updateWallInDraft(state.draft, wallId, (wall) => ({
          ...wall,
          ...normalizeWallGeometry(geometry, wall)
        })),
      });
    }),
  updateWallDetails: (wallId, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
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
      });
    }),
  rotateRack: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
        draft: updateRackInDraft(state.draft, rackId, (rack) => {
          const newDeg = (((rack.rotationDeg + 90) % 360) as 0 | 90 | 180 | 270);
          // axis auto-syncs with visual rotation:
          //   0° / 180° → rack body is horizontal → WE (West–East)
          //   90° / 270° → rack body is vertical  → NS (North–South)
          const newAxis: Rack['axis'] = (newDeg === 90 || newDeg === 270) ? 'NS' : 'WE';
          return { ...rack, rotationDeg: newDeg, axis: newAxis };
        }),
      });
    }),
  updateRackGeneral: (rackId, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
        draft: updateRackInDraft(state.draft, rackId, (rack) => normalizeRack({ ...rack, ...patch })),
      });
    }),
  updateFaceConfig: (rackId, side, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) => (face.side === side ? { ...face, ...patch } : face))
        })),
      });
    }),
  updateSectionLength: (rackId, side, sectionId, length) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
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
      });
    }),
  updateSectionSlots: (rackId, side, sectionId, slotCount) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
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
      });
    }),
  updateLevelCount: (rackId, side, sectionId, count) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
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
      });
    }),
  addSection: (rackId, side) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
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
      });
    }),
  deleteSection: (rackId, side, sectionId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? { ...face, sections: face.sections.filter((section) => section.id !== sectionId) }
              : face
          )
        })),
      });
    }),
  addLevel: (rackId, side, sectionId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
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
      });
    }),
  applyFacePreset: (rackId, side, sectionCount, levelCount, slotCount) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
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
      });
    }),
  resetFaceB: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          kind: 'single' as RackKind,
          faces: rack.faces.map((face) =>
            face.side === 'B'
              ? { ...face, enabled: false, isMirrored: false, mirrorSourceFaceId: null, sections: [] }
              : face
          )
        })),
      });
    }),
  setFaceLength: (rackId, side, length) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
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
      });
    }),
  setFaceBMode: (rackId, mode) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return markDraftChanged(state, {
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
      });
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

      return markDraftChanged(state, {
        draft: nextDraft,
      });
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

      return markDraftChanged(state, {
        draft: nextDraft,
      });
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

      return markDraftChanged(state, {
        draft: nextDraft,
      });
    })
}));

export function resetEditorStore() {
  useEditorStore.setState(initialEditorState);
}
