import { useEditorStore } from './editor-store';
import type { EditorSelection } from './editor-types';

export const useViewMode = () => useEditorStore((state) => state.viewMode);
export const useSetViewMode = () => useEditorStore((state) => state.setViewMode);
export const useEditorMode = () => useEditorStore((state) => state.editorMode);
export const useSetEditorMode = () => useEditorStore((state) => state.setEditorMode);
export const useSelectedRackIds = () => useEditorStore((state) => state.selectedRackIds);
export const useSelectedRackId = () => useEditorStore((state) => state.selectedRackIds[0] ?? null);
export const useToggleRackSelection = () => useEditorStore((state) => state.toggleRackSelection);
export const useSetSelectedRackIds = () => useEditorStore((state) => state.setSelectedRackIds);
export const useMinRackDistance = () => useEditorStore((state) => state.minRackDistance);
export const useSetMinRackDistance = () => useEditorStore((state) => state.setMinRackDistance);
export const useHoveredRackId = () => useEditorStore((state) => state.hoveredRackId);
export const useCreatingRackId = () => useEditorStore((state) => state.creatingRackId);
export const useSetCreatingRackId = () => useEditorStore((state) => state.setCreatingRackId);
export const useCanvasZoom = () => useEditorStore((state) => state.zoom);
export const useLayoutDraftState = () => useEditorStore((state) => state.draft);
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

/**
 * Derived typed selection for the current editor state.
 * Cell and container variants are reserved for future modes; only 'rack' is
 * populated today from the existing selectedRackIds store field.
 */
export const useEditorSelection = (): EditorSelection =>
  useEditorStore((state): EditorSelection => {
    if (state.selectedRackIds.length > 0) {
      return { type: 'rack', rackIds: state.selectedRackIds };
    }
    return { type: 'none' };
  });
