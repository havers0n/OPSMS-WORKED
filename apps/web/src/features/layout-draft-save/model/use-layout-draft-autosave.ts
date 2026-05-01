import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  cancelScheduledLayoutDraftSave,
  isLayoutDraftSaveInFlight,
  scheduleLayoutDraftAutosave
} from './use-save-layout-draft';
import {
  useIsWarehouseDraftDirty,
  useWarehouseDraftStatus,
  useWarehouseLayoutDraft
} from '@/warehouse/state/layout-draft';

const AUTOSAVE_DEBOUNCE_MS = 2000;

export function useLayoutDraftAutosave(floorId: string | null) {
  const queryClient = useQueryClient();
  const draft = useWarehouseLayoutDraft();
  const isDraftDirty = useIsWarehouseDraftDirty();
  const persistenceStatus = useWarehouseDraftStatus();

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
