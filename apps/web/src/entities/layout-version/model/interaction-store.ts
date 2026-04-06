import { create } from 'zustand';
import {
  type ContextPanelMode,
  type EditorSelection,
  type RackSideFocus
} from './editor-types';
import { makeRackSelection, getSelectedRackIds } from './editor-store-helpers';

/**
 * Interaction Store — independent axis for all user interaction state.
 *
 * Owns:
 *   - selection (which entity the user has selected)
 *   - hoveredRackId (transient hover highlight)
 *   - creatingRackId (UI flag: rack is in creation wizard)
 *   - highlightedCellIds (search/filter highlight overlay)
 *   - contextPanelMode (compact vs expanded panel)
 *
 * Does NOT own:
 *   - activeStorageWorkflow (domain/business semantics — stays in editor-store)
 *   - camera zoom / pan (camera-store)
 *   - viewMode / editorMode (mode-store)
 *   - layout draft / domain entities (editor-store)
 *
 * Selection coupling note:
 *   These setters are intentionally pure (no workflow side effects).
 *   When a user-initiated selection change should also clear the active workflow,
 *   call the coordinating action in editor-store (e.g. setSelection, clearSelection),
 *   which calls interaction-store.setSelection() AND resets the workflow.
 *   Direct mutations here (from resetAll / clearForModeSwitch) are safe because
 *   they are called from editor-store actions that also reset the workflow.
 */

type InteractionStore = {
  selection: EditorSelection;
  hoveredRackId: string | null;
  creatingRackId: string | null;
  highlightedCellIds: string[];
  contextPanelMode: ContextPanelMode;

  // — Selection (pure, no workflow side effects) —
  setSelection: (selection: EditorSelection) => void;
  clearSelection: () => void;
  setSelectedRackIds: (rackIds: string[]) => void;
  setSelectedRackId: (rackId: string | null) => void;
  setSelectedRackSide: (rackId: string, side: RackSideFocus) => void;
  toggleRackSelection: (rackId: string) => void;
  setSelectedZoneId: (zoneId: string | null) => void;
  setSelectedWallId: (wallId: string | null) => void;
  setSelectedCellId: (cellId: string | null) => void;
  setSelectedContainerId: (containerId: string | null, sourceCellId?: string | null) => void;

  // — Hover (pure, no side effects) —
  setHoveredRackId: (rackId: string | null) => void;

  // — Creation wizard (pure, no side effects) —
  setCreatingRackId: (rackId: string | null) => void;

  // — Highlights (pure, no side effects) —
  setHighlightedCellIds: (cellIds: string[]) => void;
  clearHighlightedCellIds: () => void;

  // — Panel state (pure, no side effects) —
  setContextPanelMode: (mode: ContextPanelMode) => void;
  toggleContextPanelMode: () => void;

  // — Resets (called by editor-store coordinators, not directly by components) —
  /** Clears selection, creatingRackId, and highlights. Used on mode transitions. */
  clearForModeSwitch: () => void;
  /** Resets all interaction state to initial values. Used on full draft reset. */
  resetAll: () => void;
};

const initialInteractionState = {
  selection: { type: 'none' } as EditorSelection,
  hoveredRackId: null as string | null,
  creatingRackId: null as string | null,
  highlightedCellIds: [] as string[],
  contextPanelMode: 'compact' as ContextPanelMode
};

export const useInteractionStore = create<InteractionStore>((set, get) => ({
  ...initialInteractionState,

  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: { type: 'none' } }),

  setSelectedRackIds: (rackIds) => set({ selection: makeRackSelection(rackIds) }),
  setSelectedRackId: (rackId) =>
    set({
      selection: rackId
        ? { type: 'rack', rackIds: [rackId], focus: { type: 'body' } }
        : { type: 'none' }
    }),
  setSelectedRackSide: (rackId, side) =>
    set({
      selection: { type: 'rack', rackIds: [rackId], focus: { type: 'side', side } }
    }),
  toggleRackSelection: (rackId) => {
    const current = getSelectedRackIds(get().selection);
    const next = current.includes(rackId)
      ? current.filter((id) => id !== rackId)
      : [...current, rackId];
    set({ selection: makeRackSelection(next) });
  },

  setSelectedZoneId: (zoneId) =>
    set({ selection: zoneId ? { type: 'zone', zoneId } : { type: 'none' } }),
  setSelectedWallId: (wallId) =>
    set({ selection: wallId ? { type: 'wall', wallId } : { type: 'none' } }),
  setSelectedCellId: (cellId) =>
    set({ selection: cellId ? { type: 'cell', cellId } : { type: 'none' } }),
  setSelectedContainerId: (containerId, sourceCellId = null) =>
    set({
      selection: containerId
        ? { type: 'container', containerId, sourceCellId }
        : { type: 'none' }
    }),

  setHoveredRackId: (hoveredRackId) => set({ hoveredRackId }),
  setCreatingRackId: (creatingRackId) => set({ creatingRackId }),

  setHighlightedCellIds: (cellIds) => set({ highlightedCellIds: [...new Set(cellIds)] }),
  clearHighlightedCellIds: () => set({ highlightedCellIds: [] }),

  setContextPanelMode: (contextPanelMode) => set({ contextPanelMode }),
  toggleContextPanelMode: () =>
    set((state) => ({
      contextPanelMode: state.contextPanelMode === 'compact' ? 'expanded' : 'compact'
    })),

  clearForModeSwitch: () =>
    set({
      selection: { type: 'none' },
      creatingRackId: null,
      highlightedCellIds: []
    }),

  resetAll: () => set({ ...initialInteractionState })
}));
