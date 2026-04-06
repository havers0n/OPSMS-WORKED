import { useEditorStore } from './editor-store';
import { useCameraStore } from './camera-store';
import { useModeStore } from './mode-store';
import { useInteractionStore } from './interaction-store';
import {
  resolveInteractionScope,
  type ActiveStorageWorkflow,
  type EditorSelection,
  type InteractionScope,
  type RackSelectionFocus
} from './editor-types';

// Stable empty fallbacks — must live outside selectors so the reference never changes
// between renders. Returning a new literal (e.g. `[] as string[]`) inside a Zustand
// selector causes useSyncExternalStore to see a new snapshot on every call, which
// triggers an infinite re-render loop ("getSnapshot should be cached" warning).
const EMPTY_RACK_IDS: string[] = [];
const BODY_RACK_FOCUS: RackSelectionFocus = { type: 'body' };

export const useViewMode = () => useModeStore((state) => state.viewMode);
export const useSetViewMode = () => useEditorStore((state) => state.setViewMode);
export const useEditorMode = () => useModeStore((state) => state.editorMode);
export const useSetEditorMode = () => useEditorStore((state) => state.setEditorMode);
// — Selection state — reads from interaction-store
export const useSelectedRackIds = () =>
  useInteractionStore((state) =>
    state.selection.type === 'rack' ? state.selection.rackIds : EMPTY_RACK_IDS
  );
export const useSelectedRackId = () =>
  useInteractionStore((state) =>
    state.selection.type === 'rack' ? (state.selection.rackIds[0] ?? null) : null
  );
export const useSelectedZoneId = () =>
  useInteractionStore((state) =>
    state.selection.type === 'zone' ? state.selection.zoneId : null
  );
export const useSelectedWallId = () =>
  useInteractionStore((state) =>
    state.selection.type === 'wall' ? state.selection.wallId : null
  );
export const useSelectedRackFocus = (): RackSelectionFocus =>
  useInteractionStore((state) =>
    state.selection.type === 'rack'
      ? (state.selection.focus ?? BODY_RACK_FOCUS)
      : BODY_RACK_FOCUS
  );
// Selection setters stay in editor-store (they also reset activeStorageWorkflow)
export const useSetSelection = () => useEditorStore((state) => state.setSelection);
export const useClearSelection = () => useEditorStore((state) => state.clearSelection);
export const useToggleRackSelection = () => useEditorStore((state) => state.toggleRackSelection);
export const useSetSelectedRackIds = () => useEditorStore((state) => state.setSelectedRackIds);
export const useMinRackDistance = () => useEditorStore((state) => state.minRackDistance);
export const useSetMinRackDistance = () => useEditorStore((state) => state.setMinRackDistance);
// — Pure interaction state — reads/writes directly from interaction-store
export const useHoveredRackId = () => useInteractionStore((state) => state.hoveredRackId);
export const useCreatingRackId = () => useInteractionStore((state) => state.creatingRackId);
export const useSetCreatingRackId = () => useInteractionStore((state) => state.setCreatingRackId);
export const useHighlightedCellIds = () => useInteractionStore((state) => state.highlightedCellIds);
export const useSetHighlightedCellIds = () => useInteractionStore((state) => state.setHighlightedCellIds);
export const useClearHighlightedCellIds = () => useInteractionStore((state) => state.clearHighlightedCellIds);
export const useCanvasZoom = () => useCameraStore((state) => state.zoom);
export const useLayoutDraftState = () => useEditorStore((state) => state.draft);
export const useIsLayoutEditable = () => {
  const viewMode = useModeStore((state) => state.viewMode);
  const draftState = useEditorStore((state) => state.draft?.state);
  return viewMode === 'layout' && draftState === 'draft';
};
export const useDraftDirtyState = () => useEditorStore((state) => state.isDraftDirty);
export const useResetDraft = () => useEditorStore((state) => state.resetDraft);
export const useInitializeDraft = () => useEditorStore((state) => state.initializeDraft);
export const useMarkDraftSaved = () => useEditorStore((state) => state.markDraftSaved);
export const useCreateRack = () => useEditorStore((state) => state.createRack);
export const useCreateZone = () => useEditorStore((state) => state.createZone);
export const useCreateFreeWall = () => useEditorStore((state) => state.createFreeWall);
export const useCreateWallFromRackSide = () =>
  useEditorStore((state) => state.createWallFromRackSide);
export const useDeleteRack = () => useEditorStore((state) => state.deleteRack);
export const useDeleteZone = () => useEditorStore((state) => state.deleteZone);
export const useDeleteWall = () => useEditorStore((state) => state.deleteWall);
export const useDuplicateRack = () => useEditorStore((state) => state.duplicateRack);
export const useSetSelectedRackId = () => useEditorStore((state) => state.setSelectedRackId);
export const useSetSelectedZoneId = () => useEditorStore((state) => state.setSelectedZoneId);
export const useSetSelectedWallId = () => useEditorStore((state) => state.setSelectedWallId);
export const useSetSelectedRackSide = () =>
  useEditorStore((state) => state.setSelectedRackSide);
export const useSetHoveredRackId = () => useInteractionStore((state) => state.setHoveredRackId);
export const useSetCanvasZoom = () => useCameraStore((state) => state.setZoom);
export const useUpdateRackPosition = () => useEditorStore((state) => state.updateRackPosition);
export const useUpdateZoneRect = () => useEditorStore((state) => state.updateZoneRect);
export const useUpdateZoneDetails = () => useEditorStore((state) => state.updateZoneDetails);
export const useUpdateWallGeometry = () => useEditorStore((state) => state.updateWallGeometry);
export const useUpdateWallDetails = () => useEditorStore((state) => state.updateWallDetails);
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

/** Canonical typed selection. Reads from interaction-store. */
export const useEditorSelection = (): EditorSelection =>
  useInteractionStore((state) => state.selection);

/** Returns the selected cell ID if the current selection is a cell, otherwise null. */
export const useSelectedCellId = () =>
  useInteractionStore((state) =>
    state.selection.type === 'cell' ? state.selection.cellId : null
  );
export const useSetSelectedCellId = () => useEditorStore((state) => state.setSelectedCellId);
export const useSetSelectedContainerId = () => useEditorStore((state) => state.setSelectedContainerId);
export const useActiveStorageWorkflow = (): ActiveStorageWorkflow =>
  useEditorStore((state) => state.activeStorageWorkflow);
export const useInteractionScope = (): InteractionScope => {
  const selection = useInteractionStore((state) => state.selection);
  const activeStorageWorkflow = useEditorStore((state) => state.activeStorageWorkflow);
  return resolveInteractionScope(selection, activeStorageWorkflow);
};
export const useStartPlaceContainerWorkflow = () =>
  useEditorStore((state) => state.startPlaceContainerWorkflow);
export const useStartCreateAndPlaceWorkflow = () =>
  useEditorStore((state) => state.startCreateAndPlaceWorkflow);
export const useStartPlacementMove = () => useEditorStore((state) => state.startPlacementMove);
export const useSetPlacementMoveTargetCellId = () =>
  useEditorStore((state) => state.setPlacementMoveTargetCellId);
export const useCancelPlacementInteraction = () =>
  useEditorStore((state) => state.cancelPlacementInteraction);
export const useSetActiveStorageWorkflowError = () =>
  useEditorStore((state) => state.setActiveStorageWorkflowError);
export const useSetCreateAndPlacePlacementRetry = () =>
  useEditorStore((state) => state.setCreateAndPlacePlacementRetry);
export const useMarkActiveStorageWorkflowSubmitting = () =>
  useEditorStore((state) => state.markActiveStorageWorkflowSubmitting);
export const useContextPanelMode = () =>
  useInteractionStore((state) => state.contextPanelMode);
export const useSetContextPanelMode = () =>
  useInteractionStore((state) => state.setContextPanelMode);
export const useToggleContextPanelMode = () =>
  useInteractionStore((state) => state.toggleContextPanelMode);
