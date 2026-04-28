import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cellKeys } from '@/entities/cell/api/queries';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';
import { createLayoutDraftFixture } from '@/widgets/warehouse-editor/model/__fixtures__/layout-draft.fixture';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { useInteractionStore } from '@/widgets/warehouse-editor/model/interaction-store';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';
import { BffRequestError } from '@/shared/api/bff/client';
import { createLayoutDraft } from '@/features/layout-draft-save/api/mutations';
import { saveLayoutDraft } from '@/features/layout-draft-save/api/mutations';
import {
  flushLayoutDraftSave,
  resetLayoutDraftSaveCoordinator,
  scheduleLayoutDraftAutosave
} from '@/features/layout-draft-save/model/use-save-layout-draft';
import { publishLayoutVersion } from '../api/mutations';
import { usePublishLayout } from './use-publish-layout';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/features/layout-draft-save/api/mutations', async () => {
  const actual = await vi.importActual<typeof import('@/features/layout-draft-save/api/mutations')>(
    '@/features/layout-draft-save/api/mutations'
  );

  return {
    ...actual,
    saveLayoutDraft: vi.fn(),
    createLayoutDraft: vi.fn()
  };
});

vi.mock('../api/mutations', () => ({
  publishLayoutVersion: vi.fn()
}));

type PublishHookResult = ReturnType<typeof usePublishLayout>;

function resetStores() {
  useModeStore.setState({
    viewMode: 'layout',
    editorMode: 'select'
  });
  useInteractionStore.setState({
    selection: { type: 'none' },
    hoveredRackId: null,
    highlightedCellIds: [],
    contextPanelMode: 'compact'
  });
  useEditorStore.setState({
    activeTask: null,
    activeStorageWorkflow: null,
    minRackDistance: 0,
    draft: null,
    draftSourceVersionId: null,
    isDraftDirty: false,
    persistenceStatus: 'idle',
    lastSaveErrorMessage: null,
    lastChangeClass: null
  });
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
  const state = useEditorStore.getState();
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

function HookHarness({
  floorId,
  onReady
}: {
  floorId: string | null;
  onReady: (result: PublishHookResult) => void;
}) {
  const result = usePublishLayout(floorId);
  onReady(result);
  return null;
}

describe('usePublishLayout', () => {
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

  it('publishes with the fresh saved draftVersion and no duplicate save when autosave is pending', async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();
    let publishHook!: PublishHookResult;

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 180, 320);

    vi.mocked(saveLayoutDraft).mockImplementation(async (currentDraft) => ({
      layoutVersionId: currentDraft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only',
      savedDraft: {
        ...currentDraft,
        draftVersion: 2
      }
    }));
    vi.mocked(publishLayoutVersion).mockResolvedValue({
      layoutVersionId: draft.layoutVersionId,
      publishedAt: '2026-04-08T10:00:00.000Z',
      generatedCells: 8,
      validation: {
        isValid: true,
        issues: []
      }
    });
    vi.mocked(createLayoutDraft).mockResolvedValue('draft-2');

    await act(async () => {
      TestRenderer.create(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(HookHarness, { floorId: draft.floorId, onReady: (result) => (publishHook = result) })
        )
      );
    });

    act(() => {
      scheduleLayoutDraftAutosave(queryClient, draft.floorId, 2000);
    });

    await act(async () => {
      await publishHook.mutateAsync();
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveLayoutDraft).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(publishLayoutVersion).mock.invocationCallOrder[0]
    );
    expect(publishLayoutVersion).toHaveBeenCalledWith(draft.layoutVersionId, 2);
    expect(createLayoutDraft).toHaveBeenCalledWith(draft.floorId);
    expectSurfaceConsistentForActiveDraft(draft.layoutVersionId);
    expect(['conflict', 'error']).not.toContain(capturePersistenceSurface().persistenceStatus);
  });

  it('reuses an in-flight save when publish starts on a dirty draft', async () => {
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();
    const pendingSave = deferred<Awaited<ReturnType<typeof saveLayoutDraft>>>();
    let publishHook!: PublishHookResult;

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 210, 360);

    vi.mocked(saveLayoutDraft).mockReturnValue(pendingSave.promise);
    vi.mocked(publishLayoutVersion).mockResolvedValue({
      layoutVersionId: draft.layoutVersionId,
      publishedAt: '2026-04-08T11:00:00.000Z',
      generatedCells: 8,
      validation: {
        isValid: true,
        issues: []
      }
    });
    vi.mocked(createLayoutDraft).mockResolvedValue('draft-2');

    await act(async () => {
      TestRenderer.create(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(HookHarness, { floorId: draft.floorId, onReady: (result) => (publishHook = result) })
        )
      );
    });

    const inFlightSave = flushLayoutDraftSave(queryClient, draft.floorId, useEditorStore.getState().draft!);

    let publishPromise!: Promise<unknown>;
    await act(async () => {
      publishPromise = publishHook.mutateAsync();
      await Promise.resolve();
    });

    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);

    pendingSave.resolve({
      layoutVersionId: draft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only',
      savedDraft: {
        ...useEditorStore.getState().draft!,
        draftVersion: 2
      }
    });

    await act(async () => {
      await inFlightSave;
      await publishPromise;
    });

    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);
    expect(publishLayoutVersion).toHaveBeenCalledWith(draft.layoutVersionId, 2);
    expect(createLayoutDraft).toHaveBeenCalledWith(draft.floorId);
    expectSurfaceConsistentForActiveDraft(draft.layoutVersionId);
  });

  it('keeps post-publish persistence surface stable and fires expected invalidations on success', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const draft = createLayoutDraftFixture();
    let publishHook!: PublishHookResult;

    useEditorStore.getState().initializeDraft(draft);

    vi.mocked(publishLayoutVersion).mockResolvedValue({
      layoutVersionId: draft.layoutVersionId,
      publishedAt: '2026-04-08T12:00:00.000Z',
      generatedCells: 8,
      validation: {
        isValid: true,
        issues: []
      }
    });
    vi.mocked(createLayoutDraft).mockResolvedValue('draft-2');

    await act(async () => {
      TestRenderer.create(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(HookHarness, { floorId: draft.floorId, onReady: (result) => (publishHook = result) })
        )
      );
    });

    await act(async () => {
      await publishHook.mutateAsync();
    });

    expect(['conflict', 'error']).not.toContain(capturePersistenceSurface().persistenceStatus);
    expectSurfaceConsistentForActiveDraft(draft.layoutVersionId);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: layoutVersionKeys.activeDraft(draft.floorId) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: layoutVersionKeys.publishedSummary(draft.floorId) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: layoutVersionKeys.workspace(draft.floorId) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: cellKeys.publishedByFloor(draft.floorId) });
  });

  it('conflict then publish retry keeps persistence surface consistent (retry may succeed or remain blocked)', async () => {
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();
    let publishHook!: PublishHookResult;

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 220, 360);

    vi.mocked(saveLayoutDraft)
      .mockRejectedValueOnce(
        new BffRequestError(409, 'DRAFT_CONFLICT', 'Layout draft was changed by another session. Please reload.', null, null)
      )
      .mockResolvedValueOnce({
        layoutVersionId: draft.layoutVersionId,
        draftVersion: 2,
        changeClass: 'geometry_only',
        savedDraft: {
          ...useEditorStore.getState().draft!,
          draftVersion: 2
        }
      });
    vi.mocked(publishLayoutVersion).mockResolvedValue({
      layoutVersionId: draft.layoutVersionId,
      publishedAt: '2026-04-08T13:00:00.000Z',
      generatedCells: 8,
      validation: {
        isValid: true,
        issues: []
      }
    });
    vi.mocked(createLayoutDraft).mockResolvedValue('draft-2');

    await act(async () => {
      TestRenderer.create(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(HookHarness, { floorId: draft.floorId, onReady: (result) => (publishHook = result) })
        )
      );
    });

    await expect(publishHook.mutateAsync()).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });
    expectSurfaceConsistentForActiveDraft(draft.layoutVersionId);

    let retryOutcome: 'succeeded' | 'blocked';
    try {
      await publishHook.mutateAsync();
      retryOutcome = 'succeeded';
    } catch {
      retryOutcome = 'blocked';
    }

    expectSurfaceConsistentForActiveDraft(draft.layoutVersionId);

    if (retryOutcome === 'succeeded') {
      expect(publishLayoutVersion).toHaveBeenCalledWith(draft.layoutVersionId, 2);
      expect(['conflict', 'error']).not.toContain(capturePersistenceSurface().persistenceStatus);
    } else {
      expect(publishLayoutVersion).toHaveBeenCalledTimes(0);
      expect(['dirty', 'conflict', 'error']).toContain(capturePersistenceSurface().persistenceStatus);
    }
  });
});
