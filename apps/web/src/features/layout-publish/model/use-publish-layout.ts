import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cellKeys } from '@/entities/cell/api/queries';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { createLayoutDraft } from '@/features/layout-draft-save/api/mutations';
import { publishLayoutVersion } from '../api/mutations';

export function usePublishLayout(floorId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (layoutVersionId: string) => {
      const published = await publishLayoutVersion(layoutVersionId);

      if (floorId) {
        await createLayoutDraft(floorId);
      }

      return published;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.publishedSummary(floorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.workspace(floorId) });
      // Published cells reference UUIDs from the newly-promoted layout version.
      // Invalidate so that RackCells lookup keys align with the fresh published rack tree.
      void queryClient.invalidateQueries({ queryKey: cellKeys.publishedByFloor(floorId) });
    }
  });
}
