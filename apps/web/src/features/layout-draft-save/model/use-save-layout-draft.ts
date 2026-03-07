import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LayoutDraft } from '@wos/domain';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { saveLayoutDraft } from '@/features/layout-draft-save/api/mutations';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';

export function useSaveLayoutDraft(floorId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layoutDraft: LayoutDraft) => saveLayoutDraft(layoutDraft),
    onSuccess: ({ layoutVersionId }) => {
      useEditorStore.getState().markDraftSaved(layoutVersionId);
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) });
    }
  });
}
