import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { LayoutDraft } from '@wos/domain';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import {
  getWarehouseDraftPersistenceSnapshot,
  getWarehouseDraftSnapshot,
  useWarehouseDraftStatus,
  useWarehouseLayoutDraft,
  warehouseLayoutDraftActions
} from '@/warehouse/state/layout-draft';
import { BffRequestError } from '@/shared/api/bff/client';
import { saveLayoutDraft } from '../api/mutations';

type SaveLayoutDraftResult = Awaited<ReturnType<typeof saveLayoutDraft>>;

let inFlightSavePromise: Promise<SaveLayoutDraftResult> | null = null;
let scheduledAutosaveTimer: ReturnType<typeof setTimeout> | null = null;

function clearScheduledAutosaveTimer() {
  if (scheduledAutosaveTimer !== null) {
    clearTimeout(scheduledAutosaveTimer);
    scheduledAutosaveTimer = null;
  }
}

async function invalidateDraftQueries(queryClient: QueryClient, floorId: string | null, layoutVersionId: string) {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] === 'layout-validation' && query.queryKey[1] === layoutVersionId
  });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) }),
    queryClient.invalidateQueries({ queryKey: layoutVersionKeys.workspace(floorId) })
  ]);
}

async function invalidateDraftWorkspace(queryClient: QueryClient, floorId: string | null) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: layoutVersionKeys.activeDraft(floorId) }),
    queryClient.invalidateQueries({ queryKey: layoutVersionKeys.workspace(floorId) })
  ]);
}

async function runSaveLayoutDraft(queryClient: QueryClient, floorId: string | null, draftSnapshot: LayoutDraft) {
  if (inFlightSavePromise) {
    return inFlightSavePromise;
  }

  warehouseLayoutDraftActions.markDraftSaving({ layoutVersionId: draftSnapshot.layoutVersionId });

  const promise = saveLayoutDraft(draftSnapshot)
    .then(async (result) => {
      const keepDirty = getWarehouseDraftSnapshot() !== draftSnapshot;

      warehouseLayoutDraftActions.markDraftSaved({
        layoutVersionId: result.layoutVersionId,
        draftVersion: result.draftVersion,
        changeClass: result.changeClass,
        keepDirty
      });

      await invalidateDraftQueries(queryClient, floorId, result.layoutVersionId);
      return result;
    })
    .catch(async (error) => {
      const keepDirty = getWarehouseDraftSnapshot() !== draftSnapshot;

      if (error instanceof BffRequestError && (error.code === 'DRAFT_NOT_ACTIVE' || error.code === 'DRAFT_CONFLICT')) {
        warehouseLayoutDraftActions.markDraftSaveConflict({
          layoutVersionId: draftSnapshot.layoutVersionId,
          message: error.message
        });
        await invalidateDraftWorkspace(queryClient, floorId);
        throw error;
      }

      warehouseLayoutDraftActions.markDraftSaveError({
        layoutVersionId: draftSnapshot.layoutVersionId,
        message: error instanceof Error ? error.message : 'Save failed',
        keepDirty
      });
      throw error;
    })
    .finally(() => {
      if (inFlightSavePromise === promise) {
        inFlightSavePromise = null;
      }
    });

  inFlightSavePromise = promise;
  return promise;
}

export function cancelScheduledLayoutDraftSave() {
  clearScheduledAutosaveTimer();
}

export function hasScheduledLayoutDraftSave() {
  return scheduledAutosaveTimer !== null;
}

export function isLayoutDraftSaveInFlight() {
  return inFlightSavePromise !== null;
}

export function scheduleLayoutDraftAutosave(
  queryClient: QueryClient,
  floorId: string | null,
  delayMs: number
) {
  clearScheduledAutosaveTimer();
  scheduledAutosaveTimer = setTimeout(() => {
    scheduledAutosaveTimer = null;
    const { draft, isDraftDirty, persistenceStatus } = getWarehouseDraftPersistenceSnapshot();

    if (!draft || draft.state !== 'draft') {
      return;
    }

    if (!isDraftDirty || persistenceStatus !== 'dirty') {
      return;
    }

    void runSaveLayoutDraft(queryClient, floorId, draft).catch(() => {
      // Autosave updates store/query state via runSaveLayoutDraft side effects.
      // Swallow the rejection here so conflict/save errors do not surface as
      // unhandled promise rejections from the debounce callback.
    });
  }, delayMs);
}

export async function flushLayoutDraftSave(queryClient: QueryClient, floorId: string | null, draft?: LayoutDraft) {
  clearScheduledAutosaveTimer();

  if (inFlightSavePromise) {
    return inFlightSavePromise;
  }

  const currentDraft = draft ?? getWarehouseDraftSnapshot();

  if (!currentDraft || currentDraft.state !== 'draft' || !floorId) {
    throw new Error('Layout draft is unavailable.');
  }

  if (!getWarehouseDraftPersistenceSnapshot().isDraftDirty) {
    return null;
  }

  return runSaveLayoutDraft(queryClient, floorId, currentDraft);
}

export function resetLayoutDraftSaveCoordinator() {
  clearScheduledAutosaveTimer();
  inFlightSavePromise = null;
}

export function useSaveLayoutDraft(floorId: string | null) {
  const queryClient = useQueryClient();
  const draft = useWarehouseLayoutDraft();
  const persistenceStatus = useWarehouseDraftStatus();

  return {
    isPending: persistenceStatus === 'saving',
    mutateAsync: (layoutDraft?: LayoutDraft) => flushLayoutDraftSave(queryClient, floorId, layoutDraft),
    flushSave: (layoutDraft?: LayoutDraft) => flushLayoutDraftSave(queryClient, floorId, layoutDraft),
    saveNow: (layoutDraft?: LayoutDraft) => {
      const currentDraft = layoutDraft ?? draft;

      if (!currentDraft || currentDraft.state !== 'draft' || !floorId) {
        return Promise.reject(new Error('Layout draft is unavailable.'));
      }

      return runSaveLayoutDraft(queryClient, floorId, currentDraft);
    }
  };
}
