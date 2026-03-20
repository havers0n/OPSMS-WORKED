import { useMutation, useQueryClient } from '@tanstack/react-query';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { createLayoutDraft } from '../api/mutations';

export function useCreateLayoutDraft(floorId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (selectedFloorId: string) => createLayoutDraft(selectedFloorId),
    onSuccess: (_draftId, selectedFloorId) => {
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(selectedFloorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.workspace(selectedFloorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.workspace(floorId) });
    }
  });
}
