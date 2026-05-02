import {
  useAddSection,
  useAlignRacksHorizontal,
  useAlignRacksVertical,
  useApplyFacePreset,
  useClearActiveTask,
  useDeleteRack,
  useDeleteSection,
  useDistributeRacksEqual,
  useIsLayoutEditable,
  useLayoutDraftState,
  useMinRackDistance,
  useRotateRack,
  useSelectedRackIds,
  useSetFaceBRelationship,
  useSetFaceLength,
  useSetMinRackDistance,
  useSetSelectedRackId,
  useUpdateLevelCount,
  useUpdateRackGeneral,
  useUpdateRackPosition,
  useUpdateSectionLength,
  useUpdateSectionSlots
} from '@/warehouse/editor/model/editor-selectors';
import { useEditorStore } from '@/warehouse/editor/model/editor-store';
import type { RackSideFocus } from '@/warehouse/editor/model/editor-types';

export type WarehouseRackSideFocus = RackSideFocus;

export {
  useAddSection,
  useAlignRacksHorizontal,
  useAlignRacksVertical,
  useApplyFacePreset,
  useClearActiveTask,
  useDeleteRack,
  useDeleteSection,
  useDistributeRacksEqual,
  useIsLayoutEditable,
  useLayoutDraftState,
  useMinRackDistance,
  useRotateRack,
  useSelectedRackIds,
  useSetFaceBRelationship,
  useSetFaceLength,
  useSetMinRackDistance,
  useSetSelectedRackId,
  useUpdateLevelCount,
  useUpdateRackGeneral,
  useUpdateRackPosition,
  useUpdateSectionLength,
  useUpdateSectionSlots
};

export function useRackLayoutActions() {
  return {
    addSection: useAddSection(),
    alignRacksHorizontal: useAlignRacksHorizontal(),
    alignRacksVertical: useAlignRacksVertical(),
    applyFacePreset: useApplyFacePreset(),
    clearActiveTask: useClearActiveTask(),
    deleteRack: useDeleteRack(),
    deleteSection: useDeleteSection(),
    distributeRacksEqual: useDistributeRacksEqual(),
    rotateRack: useRotateRack(),
    setFaceBRelationship: useSetFaceBRelationship(),
    setFaceLength: useSetFaceLength(),
    setMinRackDistance: useSetMinRackDistance(),
    setSelectedRackId: useSetSelectedRackId(),
    updateLevelCount: useUpdateLevelCount(),
    updateRackGeneral: useUpdateRackGeneral(),
    updateRackPosition: useUpdateRackPosition(),
    updateSectionLength: useUpdateSectionLength(),
    updateSectionSlots: useUpdateSectionSlots()
  };
}

export function getWarehouseActiveLayoutTaskSnapshot() {
  return useEditorStore.getState().activeTask;
}

export const warehouseRackLayoutActions = {
  createRack: (x: number, y: number) => useEditorStore.getState().createRack(x, y),
  updateRackPosition: (rackId: string, x: number, y: number) =>
    useEditorStore.getState().updateRackPosition(rackId, x, y)
};
