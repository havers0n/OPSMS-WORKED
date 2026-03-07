import { useMutation, useQueryClient } from '@tanstack/react-query';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { createLayoutDraft } from '@/features/layout-draft-save/api/mutations';

export function useCreateLayoutDraft(floorId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (overrideFloorId?: string) => {
      const nextFloorId = overrideFloorId ?? floorId;

      if (!nextFloorId) {
        throw new Error('Active floor is required to create a draft');
      }

      return createLayoutDraft(nextFloorId);
    },
    onSuccess: (_data, overrideFloorId) => {
      const nextFloorId = overrideFloorId ?? floorId;
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(nextFloorId ?? null) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.all });
    }
  });
}
