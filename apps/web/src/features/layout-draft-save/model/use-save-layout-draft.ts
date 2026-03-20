import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LayoutDraft } from '@wos/domain';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { useEditorStore } from '@/entities/layout-version/model/editor-store';
import { saveLayoutDraft } from '../api/mutations';

export function useSaveLayoutDraft(floorId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layoutDraft: LayoutDraft) => saveLayoutDraft(layoutDraft),
    onSuccess: ({ layoutVersionId }) => {
      useEditorStore.getState().markDraftSaved(layoutVersionId);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] === 'layout-validation' && query.queryKey[1] === layoutVersionId
      });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.workspace(floorId) });
    }
  });
}
