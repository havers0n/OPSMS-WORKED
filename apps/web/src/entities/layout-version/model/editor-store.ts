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
  buildEmptySection,
  buildNewRack,
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
