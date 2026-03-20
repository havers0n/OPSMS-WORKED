import { useEditorStore } from './editor-store';
import type { EditorSelection, PlacementInteraction } from './editor-types';

// Stable empty fallbacks — must live outside selectors so the reference never changes
// between renders. Returning a new literal (e.g. `[] as string[]`) inside a Zustand
// selector causes useSyncExternalStore to see a new snapshot on every call, which
// triggers an infinite re-render loop ("getSnapshot should be cached" warning).
const EMPTY_RACK_IDS: string[] = [];

export const useViewMode = () => useEditorStore((state) => state.viewMode);
export const useSetViewMode = () => useEditorStore((state) => state.setViewMode);
export const useEditorMode = () => useEditorStore((state) => state.editorMode);
export const useSetEditorMode = () => useEditorStore((state) => state.setEditorMode);
export const useSelectedRackIds = () =>
  useEditorStore((state) =>
    state.selection.type === 'rack' ? state.selection.rackIds : EMPTY_RACK_IDS
  );
export const useSelectedRackId = () =>
  useEditorStore((state) =>
    state.selection.type === 'rack' ? (state.selection.rackIds[0] ?? null) : null
  );
export const useSetSelection = () => useEditorStore((state) => state.setSelection);
export const useClearSelection = () => useEditorStore((state) => state.clearSelection);
export const useToggleRackSelection = () => useEditorStore((state) => state.toggleRackSelection);
export const useSetSelectedRackIds = () => useEditorStore((state) => state.setSelectedRackIds);
export const useMinRackDistance = () => useEditorStore((state) => state.minRackDistance);
export const useSetMinRackDistance = () => useEditorStore((state) => state.setMinRackDistance);
export const useHoveredRackId = () => useEditorStore((state) => state.hoveredRackId);
export const useCreatingRackId = () => useEditorStore((state) => state.creatingRackId);
export const useSetCreatingRackId = () => useEditorStore((state) => state.setCreatingRackId);
export const useCanvasZoom = () => useEditorStore((state) => state.zoom);
export const useLayoutDraftState = () => useEditorStore((state) => state.draft);
export const useIsLayoutEditable = () => useEditorStore((state) => state.draft?.state === 'draft');
export const useDraftDirtyState = () => useEditorStore((state) => state.isDraftDirty);
export const useResetDraft = () => useEditorStore((state) => state.resetDraft);
export const useInitializeDraft = () => useEditorStore((state) => state.initializeDraft);
export const useMarkDraftSaved = () => useEditorStore((state) => state.markDraftSaved);
export const useCreateRack = () => useEditorStore((state) => state.createRack);
export const useDeleteRack = () => useEditorStore((state) => state.deleteRack);
export const useDuplicateRack = () => useEditorStore((state) => state.duplicateRack);
export const useSetSelectedRackId = () => useEditorStore((state) => state.setSelectedRackId);
export const useSetHoveredRackId = () => useEditorStore((state) => state.setHoveredRackId);
export const useSetCanvasZoom = () => useEditorStore((state) => state.setZoom);
export const useUpdateRackPosition = () => useEditorStore((state) => state.updateRackPosition);
export const useRotateRack = () => useEditorStore((state) => state.rotateRack);
export const useUpdateRackGeneral = () => useEditorStore((state) => state.updateRackGeneral);
export const useUpdateFaceConfig = () => useEditorStore((state) => state.updateFaceConfig);
export const useUpdateSectionLength = () => useEditorStore((state) => state.updateSectionLength);
export const useUpdateSectionSlots = () => useEditorStore((state) => state.updateSectionSlots);
export const useUpdateLevelCount = () => useEditorStore((state) => state.updateLevelCount);
export const useAddSection = () => useEditorStore((state) => state.addSection);
export const useDeleteSection = () => useEditorStore((state) => state.deleteSection);
export const useAddLevel = () => useEditorStore((state) => state.addLevel);
export const useSetFaceBMode = () => useEditorStore((state) => state.setFaceBMode);
export const useResetFaceB = () => useEditorStore((state) => state.resetFaceB);
export const useApplyFacePreset = () => useEditorStore((state) => state.applyFacePreset);
export const useSetFaceLength = () => useEditorStore((state) => state.setFaceLength);
export const useAlignRacksHorizontal = () => useEditorStore((state) => state.alignRacksHorizontal);
export const useAlignRacksVertical = () => useEditorStore((state) => state.alignRacksVertical);
export const useDistributeRacksEqual = () => useEditorStore((state) => state.distributeRacksEqual);

/** Canonical typed selection. Reads directly from the store's first-class selection field. */
export const useEditorSelection = (): EditorSelection =>
  useEditorStore((state) => state.selection);

/** Returns the selected cell ID if the current selection is a cell, otherwise null. */
export const useSelectedCellId = () =>
  useEditorStore((state) =>
    state.selection.type === 'cell' ? state.selection.cellId : null
  );
export const useSetSelectedCellId = () => useEditorStore((state) => state.setSelectedCellId);
export const useSetSelectedContainerId = () => useEditorStore((state) => state.setSelectedContainerId);
export const usePlacementInteraction = (): PlacementInteraction =>
  useEditorStore((state) => state.placementInteraction);
export const useStartPlacementMove = () => useEditorStore((state) => state.startPlacementMove);
export const useSetPlacementMoveTargetCellId = () =>
  useEditorStore((state) => state.setPlacementMoveTargetCellId);
export const useCancelPlacementInteraction = () =>
  useEditorStore((state) => state.cancelPlacementInteraction);
