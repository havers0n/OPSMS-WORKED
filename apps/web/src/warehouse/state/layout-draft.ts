import type { LayoutDraft } from '@wos/domain';
import {
  useDraftDirtyState,
  useDraftPersistenceStatus,
  useInitializeDraft,
  useLastDraftSaveErrorMessage,
  useLayoutDraftState,
  useMarkDraftSaveConflict,
  useMarkDraftSaveError,
  useMarkDraftSaved,
  useMarkDraftSaving,
  useResetDraft
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';

export const useWarehouseLayoutDraft = useLayoutDraftState;
export const useWarehouseDraftStatus = useDraftPersistenceStatus;
export const useIsWarehouseDraftDirty = useDraftDirtyState;
export const useLastWarehouseDraftSaveError = useLastDraftSaveErrorMessage;
export const useInitializeWarehouseDraft = useInitializeDraft;
export const useMarkWarehouseDraftSaving = useMarkDraftSaving;
export const useMarkWarehouseDraftSaved = useMarkDraftSaved;
export const useMarkWarehouseDraftSaveConflict = useMarkDraftSaveConflict;
export const useMarkWarehouseDraftSaveError = useMarkDraftSaveError;
export const useResetWarehouseDraft = useResetDraft;

export function getWarehouseDraftSnapshot(): LayoutDraft | null {
  return useEditorStore.getState().draft;
}

export function getWarehouseDraftPersistenceSnapshot() {
  const state = useEditorStore.getState();

  return {
    draft: state.draft,
    draftSourceVersionId: state.draftSourceVersionId,
    isDraftDirty: state.isDraftDirty,
    persistenceStatus: state.persistenceStatus,
    lastSaveErrorMessage: state.lastSaveErrorMessage
  };
}

export const warehouseLayoutDraftActions = {
  initializeDraft: (draft: LayoutDraft) => useEditorStore.getState().initializeDraft(draft),
  markDraftSaving: (saveResult: { layoutVersionId: string }) =>
    useEditorStore.getState().markDraftSaving(saveResult),
  markDraftSaved: (saveResult: Parameters<ReturnType<typeof useMarkDraftSaved>>[0]) =>
    useEditorStore.getState().markDraftSaved(saveResult),
  markDraftSaveConflict: (saveResult: { layoutVersionId: string; message: string }) =>
    useEditorStore.getState().markDraftSaveConflict(saveResult),
  markDraftSaveError: (saveResult: Parameters<ReturnType<typeof useMarkDraftSaveError>>[0]) =>
    useEditorStore.getState().markDraftSaveError(saveResult),
  resetDraft: () => useEditorStore.getState().resetDraft(),
  updateRackPosition: (rackId: string, x: number, y: number) =>
    useEditorStore.getState().updateRackPosition(rackId, x, y)
};
