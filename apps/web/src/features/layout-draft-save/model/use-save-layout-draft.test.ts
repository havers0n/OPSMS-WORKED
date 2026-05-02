import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TestRenderer, { act } from 'react-test-renderer';
import { BffRequestError } from '@/shared/api/bff/client';
import { createLayoutDraftFixture } from '@/warehouse/editor/model/__fixtures__/layout-draft.fixture';
import {
  getWarehouseDraftPersistenceSnapshot,
  getWarehouseDraftSnapshot,
  warehouseLayoutDraftActions
} from '@/warehouse/state/layout-draft';
import { warehouseInteractionActions } from '@/warehouse/state/interaction';
import { warehouseViewModeActions } from '@/warehouse/state/view-mode';
import { useLayoutDraftAutosave } from './use-layout-draft-autosave';
import {
  flushLayoutDraftSave,
  resetLayoutDraftSaveCoordinator
} from './use-save-layout-draft';
import { saveLayoutDraft } from '../api/mutations';

vi.mock('../api/mutations', () => ({
  saveLayoutDraft: vi.fn()
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function resetStores() {
  warehouseViewModeActions.reset();
  warehouseInteractionActions.resetAll();
  warehouseLayoutDraftActions.resetDraft();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function capturePersistenceSurface() {
  const state = getWarehouseDraftPersistenceSnapshot();
  return {
    isDraftDirty: state.isDraftDirty,
    persistenceStatus: state.persistenceStatus,
    draftSourceVersionId: state.draftSourceVersionId,
    draftLayoutVersionId: state.draft?.layoutVersionId ?? null
  };
}

function expectSurfaceConsistentForActiveDraft(expectedLayoutVersionId: string) {
  const surface = capturePersistenceSurface();
  expect(surface.draftLayoutVersionId).toBe(expectedLayoutVersionId);
  expect(surface.draftSourceVersionId).toBe(expectedLayoutVersionId);
  if (surface.isDraftDirty) {
    expect(['dirty', 'conflict', 'error']).toContain(surface.persistenceStatus);
  } else {
    expect(['saved', 'idle']).toContain(surface.persistenceStatus);
  }
}

function AutosaveHarness({ floorId }: { floorId: string | null }) {
  useLayoutDraftAutosave(floorId);
  return null;
}

describe('use-save-layout-draft coordinator', () => {
  beforeEach(() => {
    resetStores();
    resetLayoutDraftSaveCoordinator();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetStores();
    resetLayoutDraftSaveCoordinator();
  });

  it('reuses one in-flight save promise', async () => {
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();
    const pending = deferred<Awaited<ReturnType<typeof saveLayoutDraft>>>();

    warehouseLayoutDraftActions.initializeDraft(draft);
    warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 120, 240);
    vi.mocked(saveLayoutDraft).mockReturnValue(pending.promise);

    const firstPromise = flushLayoutDraftSave(queryClient, draft.floorId, getWarehouseDraftSnapshot()!);
    const secondPromise = flushLayoutDraftSave(queryClient, draft.floorId, getWarehouseDraftSnapshot()!);

    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);

    pending.resolve({
      layoutVersionId: draft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only',
      savedDraft: {
        ...getWarehouseDraftSnapshot()!,
        draftVersion: 2
      }
    });

    await expect(firstPromise).resolves.toMatchObject({ draftVersion: 2 });
    await expect(secondPromise).resolves.toMatchObject({ draftVersion: 2 });
  });

  it('marks conflict and invalidates workspace queries on draft conflict', async () => {
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    warehouseLayoutDraftActions.initializeDraft(draft);
    warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 130, 250);
    vi.mocked(saveLayoutDraft).mockRejectedValue(
      new BffRequestError(409, 'DRAFT_CONFLICT', 'Layout draft was changed by another session. Please reload.', null, null)
    );

    await expect(
      flushLayoutDraftSave(queryClient, draft.floorId, getWarehouseDraftSnapshot()!)
    ).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });

    expect(getWarehouseDraftPersistenceSnapshot().persistenceStatus).toBe('conflict');
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('allows manual retry after a non-conflict save error', async () => {
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();

    warehouseLayoutDraftActions.initializeDraft(draft);
    warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 140, 260);
    vi.mocked(saveLayoutDraft)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        layoutVersionId: draft.layoutVersionId,
        draftVersion: 2,
        changeClass: 'geometry_only',
        savedDraft: {
          ...getWarehouseDraftSnapshot()!,
          draftVersion: 2
        }
      });

    await expect(
      flushLayoutDraftSave(queryClient, draft.floorId, getWarehouseDraftSnapshot()!)
    ).rejects.toThrow('network down');
    expect(getWarehouseDraftPersistenceSnapshot().persistenceStatus).toBe('error');

    await expect(
      flushLayoutDraftSave(queryClient, draft.floorId, getWarehouseDraftSnapshot()!)
    ).resolves.toMatchObject({ draftVersion: 2 });
    expect(getWarehouseDraftPersistenceSnapshot().persistenceStatus).toBe('saved');
  });

  it('autosaves dirty drafts with one debounce timer across repeated edits', async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();

    vi.mocked(saveLayoutDraft).mockImplementation(async (currentDraft) => ({
      layoutVersionId: currentDraft.layoutVersionId,
      draftVersion: (currentDraft.draftVersion ?? 0) + 1,
      changeClass: 'geometry_only',
      savedDraft: {
        ...currentDraft,
        draftVersion: (currentDraft.draftVersion ?? 0) + 1
      }
    }));

    warehouseLayoutDraftActions.initializeDraft(draft);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(AutosaveHarness, { floorId: draft.floorId })
        )
      );
    });

    act(() => {
      warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 150, 270);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 160, 280);
    });
    await act(async () => {
      vi.advanceTimersByTime(1999);
      await Promise.resolve();
    });

    expect(saveLayoutDraft).toHaveBeenCalledTimes(0);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);
    expect(getWarehouseDraftPersistenceSnapshot().persistenceStatus).toBe('saved');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('autosave status flows through dirty to saving to saved', async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();
    const pending = deferred<Awaited<ReturnType<typeof saveLayoutDraft>>>();

    warehouseLayoutDraftActions.initializeDraft(draft);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(AutosaveHarness, { floorId: draft.floorId })
        )
      );
    });

    vi.mocked(saveLayoutDraft).mockReturnValue(pending.promise);

    act(() => {
      warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 190, 310);
    });
    expect(getWarehouseDraftPersistenceSnapshot().persistenceStatus).toBe('dirty');

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);
    expect(getWarehouseDraftPersistenceSnapshot().persistenceStatus).toBe('saving');

    pending.resolve({
      layoutVersionId: draft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only',
      savedDraft: {
        ...getWarehouseDraftSnapshot()!,
        draftVersion: 2
      }
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getWarehouseDraftPersistenceSnapshot().persistenceStatus).toBe('saved');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('manual save while autosave is scheduled does not create duplicate save requests', async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();

    warehouseLayoutDraftActions.initializeDraft(draft);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(AutosaveHarness, { floorId: draft.floorId })
        )
      );
    });

    vi.mocked(saveLayoutDraft).mockImplementation(async (currentDraft) => ({
      layoutVersionId: currentDraft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only',
      savedDraft: {
        ...currentDraft,
        draftVersion: 2
      }
    }));

    act(() => {
      warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 175, 295);
    });

    const manualSavePromise = flushLayoutDraftSave(queryClient, draft.floorId, getWarehouseDraftSnapshot()!);
    await expect(manualSavePromise).resolves.toMatchObject({ draftVersion: 2 });

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });

    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);
    expect(capturePersistenceSurface()).toEqual({
      isDraftDirty: false,
      persistenceStatus: 'saved',
      draftSourceVersionId: draft.layoutVersionId,
      draftLayoutVersionId: draft.layoutVersionId
    });

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('stops autosave after a draft conflict and does not keep retrying stale local edits', async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    warehouseLayoutDraftActions.initializeDraft(draft);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(AutosaveHarness, { floorId: draft.floorId })
        )
      );
    });

    vi.mocked(saveLayoutDraft).mockRejectedValue(
      new BffRequestError(409, 'DRAFT_CONFLICT', 'Layout draft was changed by another session. Please reload.', null, null)
    );

    act(() => {
      warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 200, 320);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);
    expect(getWarehouseDraftPersistenceSnapshot().persistenceStatus).toBe('conflict');
    expect(invalidateSpy).toHaveBeenCalledTimes(2);

    act(() => {
      warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 210, 330);
    });

    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(getWarehouseDraftPersistenceSnapshot().persistenceStatus).toBe('conflict');
    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('conflict then manual retry keeps persistence surface consistent (retry may succeed or remain blocked)', async () => {
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();

    warehouseLayoutDraftActions.initializeDraft(draft);
    warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 205, 325);

    vi.mocked(saveLayoutDraft)
      .mockRejectedValueOnce(
        new BffRequestError(409, 'DRAFT_CONFLICT', 'Layout draft was changed by another session. Please reload.', null, null)
      )
      .mockResolvedValueOnce({
        layoutVersionId: draft.layoutVersionId,
        draftVersion: 2,
        changeClass: 'geometry_only',
        savedDraft: {
          ...getWarehouseDraftSnapshot()!,
          draftVersion: 2
        }
      });

    await expect(
      flushLayoutDraftSave(queryClient, draft.floorId, getWarehouseDraftSnapshot()!)
    ).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });

    expect(capturePersistenceSurface()).toEqual({
      isDraftDirty: true,
      persistenceStatus: 'conflict',
      draftSourceVersionId: draft.layoutVersionId,
      draftLayoutVersionId: draft.layoutVersionId
    });

    let retryOutcome: 'succeeded' | 'blocked';
    try {
      await flushLayoutDraftSave(queryClient, draft.floorId, getWarehouseDraftSnapshot()!);
      retryOutcome = 'succeeded';
    } catch {
      retryOutcome = 'blocked';
    }

    if (retryOutcome === 'succeeded') {
      expectSurfaceConsistentForActiveDraft(draft.layoutVersionId);
      expect(['conflict', 'error']).not.toContain(capturePersistenceSurface().persistenceStatus);
    } else {
      expect(capturePersistenceSurface().persistenceStatus).toBe('conflict');
      expectSurfaceConsistentForActiveDraft(draft.layoutVersionId);
    }
  });
});
