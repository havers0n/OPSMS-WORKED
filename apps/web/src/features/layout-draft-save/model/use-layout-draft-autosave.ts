import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  cancelScheduledLayoutDraftSave,
  isLayoutDraftSaveInFlight,
  scheduleLayoutDraftAutosave
} from './use-save-layout-draft';
import {
  useDraftDirtyState,
  useDraftPersistenceStatus,
  useLayoutDraftState
} from '@/widgets/warehouse-editor/model/editor-selectors';

const AUTOSAVE_DEBOUNCE_MS = 2000;

export function useLayoutDraftAutosave(floorId: string | null) {
  const queryClient = useQueryClient();
  const draft = useLayoutDraftState();
  const isDraftDirty = useDraftDirtyState();
  const persistenceStatus = useDraftPersistenceStatus();

  useEffect(() => {
    const shouldAutosave =
      Boolean(floorId) &&
      draft?.state === 'draft' &&
      isDraftDirty &&
      persistenceStatus === 'dirty' &&
      !isLayoutDraftSaveInFlight();

    if (!shouldAutosave) {
      cancelScheduledLayoutDraftSave();
      return;
    }

    scheduleLayoutDraftAutosave(queryClient, floorId, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      cancelScheduledLayoutDraftSave();
    };
  }, [draft, floorId, isDraftDirty, persistenceStatus, queryClient]);
}
