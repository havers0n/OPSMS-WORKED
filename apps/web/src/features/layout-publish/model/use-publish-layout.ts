import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cellKeys } from '@/entities/cell/api/queries';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { createLayoutDraft } from '@/features/layout-draft-save/api/mutations';
import { publishLayoutVersion } from '../api/mutations';

const TRACE = import.meta.env.DEV;

export function usePublishLayout(floorId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (layoutVersionId: string) => {
      if (TRACE) {
        // eslint-disable-next-line no-console
        console.debug('[WOS TRACE]', { t: Date.now(), op: 'publishLayout:mutationFn:before', layoutVersionId, floorId });
      }
      const published = await publishLayoutVersion(layoutVersionId);

      if (floorId) {
        const draftId = await createLayoutDraft(floorId);
        if (TRACE) {
          // eslint-disable-next-line no-console
          console.debug('[WOS TRACE]', {
            t: Date.now(),
            op: 'publishLayout:mutationFn:after-createDraft',
            floorId,
            newDraftId: draftId
          });
        }
      }

      return published;
    },
    onSuccess: () => {
      if (TRACE) {
        // eslint-disable-next-line no-console
        console.debug('[WOS TRACE]', { t: Date.now(), op: 'publishLayout:onSuccess', floorId });
      }
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.publishedSummary(floorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.workspace(floorId) });
      // Published cells reference UUIDs from the newly-promoted layout version.
      // Invalidate so that RackCells lookup keys align with the fresh published rack tree.
      void queryClient.invalidateQueries({ queryKey: cellKeys.publishedByFloor(floorId) });
    }
  });
}
