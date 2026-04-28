import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cellKeys } from '@/entities/cell/api/queries';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { BffRequestError } from '@/shared/api/bff/client';
import {
  cancelScheduledLayoutDraftSave,
  useSaveLayoutDraft
} from '@/features/layout-draft-save/model/use-save-layout-draft';
import { createLayoutDraft } from '@/features/layout-draft-save/api/mutations';
import { publishLayoutVersion } from '../api/mutations';

const TRACE = import.meta.env.DEV;

export function usePublishLayout(floorId: string | null) {
  const queryClient = useQueryClient();
  const saveDraft = useSaveLayoutDraft(floorId);

  return useMutation({
    mutationFn: async () => {
      const currentDraft = useEditorStore.getState().draft;
      const isDraftDirty = useEditorStore.getState().isDraftDirty;

      if (!currentDraft || currentDraft.state !== 'draft' || !floorId) {
        throw new Error('Layout draft is unavailable.');
      }

      let layoutVersionId = currentDraft.layoutVersionId;
      let draftVersion = currentDraft.draftVersion ?? null;

      if (TRACE) {
        console.debug('[WOS TRACE]', {
          t: Date.now(),
          op: 'publishLayout:mutationFn:before',
          layoutVersionId,
          draftVersion,
          isDraftDirty,
          floorId
        });
      }

      if (isDraftDirty) {
        cancelScheduledLayoutDraftSave();
        const saved = await saveDraft.flushSave(currentDraft);
        if (saved) {
          layoutVersionId = saved.layoutVersionId;
          draftVersion = saved.draftVersion;
        } else {
          const latestDraft = useEditorStore.getState().draft;
          layoutVersionId = latestDraft?.layoutVersionId ?? layoutVersionId;
          draftVersion = latestDraft?.draftVersion ?? draftVersion;
        }
      }

      if (draftVersion === null) {
        throw new Error('Layout draft version is unavailable. Please reload.');
      }

      const published = await publishLayoutVersion(layoutVersionId, draftVersion);

      const draftId = await createLayoutDraft(floorId);
      if (TRACE) {
        console.debug('[WOS TRACE]', {
          t: Date.now(),
          op: 'publishLayout:mutationFn:after-createDraft',
          floorId,
          publishedLayoutVersionId: layoutVersionId,
          expectedDraftVersion: draftVersion,
          newDraftId: draftId
        });
      }

      return published;
    },
    onSuccess: () => {
      if (TRACE) {
        console.debug('[WOS TRACE]', { t: Date.now(), op: 'publishLayout:onSuccess', floorId });
      }
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.publishedSummary(floorId) });
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.workspace(floorId) });
      // Published cells reference UUIDs from the newly-promoted layout version.
      // Invalidate so that RackCells lookup keys align with the fresh published rack tree.
      void queryClient.invalidateQueries({ queryKey: cellKeys.publishedByFloor(floorId) });
    },
    onError: (error) => {
      // The DB publish may have succeeded even if the BFF response failed (e.g.
      // response schema mismatch). Always reload workspace so the store doesn't
      // hold a stale draft ID that is already published.
      if (error instanceof BffRequestError && (error.code === 'DRAFT_CONFLICT' || error.code === 'DRAFT_NOT_ACTIVE')) {
        void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) });
      }
      void queryClient.invalidateQueries({ queryKey: layoutVersionKeys.workspace(floorId) });
    }
  });
}
