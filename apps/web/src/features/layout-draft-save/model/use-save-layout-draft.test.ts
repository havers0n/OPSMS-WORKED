import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TestRenderer, { act } from 'react-test-renderer';
import { BffRequestError } from '@/shared/api/bff/client';
import { createLayoutDraftFixture } from '@/widgets/warehouse-editor/model/__fixtures__/layout-draft.fixture';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { useInteractionStore } from '@/widgets/warehouse-editor/model/interaction-store';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';
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

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 120, 240);
    vi.mocked(saveLayoutDraft).mockReturnValue(pending.promise);

    const firstPromise = flushLayoutDraftSave(queryClient, draft.floorId, useEditorStore.getState().draft!);
    const secondPromise = flushLayoutDraftSave(queryClient, draft.floorId, useEditorStore.getState().draft!);

    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);

    pending.resolve({
      layoutVersionId: draft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only',
      savedDraft: {
        ...useEditorStore.getState().draft!,
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

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 130, 250);
    vi.mocked(saveLayoutDraft).mockRejectedValue(
      new BffRequestError(409, 'DRAFT_CONFLICT', 'Layout draft was changed by another session. Please reload.', null, null)
    );

    await expect(
      flushLayoutDraftSave(queryClient, draft.floorId, useEditorStore.getState().draft!)
    ).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });

    expect(useEditorStore.getState().persistenceStatus).toBe('conflict');
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('allows manual retry after a non-conflict save error', async () => {
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 140, 260);
    vi.mocked(saveLayoutDraft)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        layoutVersionId: draft.layoutVersionId,
        draftVersion: 2,
        changeClass: 'geometry_only',
        savedDraft: {
          ...useEditorStore.getState().draft!,
          draftVersion: 2
        }
      });

    await expect(
      flushLayoutDraftSave(queryClient, draft.floorId, useEditorStore.getState().draft!)
    ).rejects.toThrow('network down');
    expect(useEditorStore.getState().persistenceStatus).toBe('error');

    await expect(
      flushLayoutDraftSave(queryClient, draft.floorId, useEditorStore.getState().draft!)
    ).resolves.toMatchObject({ draftVersion: 2 });
    expect(useEditorStore.getState().persistenceStatus).toBe('saved');
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

    useEditorStore.getState().initializeDraft(draft);

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
      useEditorStore.getState().updateRackPosition(draft.rackIds[0], 150, 270);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      useEditorStore.getState().updateRackPosition(draft.rackIds[0], 160, 280);
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
    expect(useEditorStore.getState().persistenceStatus).toBe('saved');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('autosave status flows through dirty to saving to saved', async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();
    const pending = deferred<Awaited<ReturnType<typeof saveLayoutDraft>>>();

    useEditorStore.getState().initializeDraft(draft);

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
      useEditorStore.getState().updateRackPosition(draft.rackIds[0], 190, 310);
    });
    expect(useEditorStore.getState().persistenceStatus).toBe('dirty');

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().persistenceStatus).toBe('saving');

    pending.resolve({
      layoutVersionId: draft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only',
      savedDraft: {
        ...useEditorStore.getState().draft!,
        draftVersion: 2
      }
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(useEditorStore.getState().persistenceStatus).toBe('saved');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('stops autosave after a draft conflict and does not keep retrying stale local edits', async () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const draft = createLayoutDraftFixture();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    useEditorStore.getState().initializeDraft(draft);

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
      useEditorStore.getState().updateRackPosition(draft.rackIds[0], 200, 320);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().persistenceStatus).toBe('conflict');
    expect(invalidateSpy).toHaveBeenCalledTimes(2);

    act(() => {
      useEditorStore.getState().updateRackPosition(draft.rackIds[0], 210, 330);
    });

    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(useEditorStore.getState().persistenceStatus).toBe('conflict');
    expect(saveLayoutDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer!.unmount();
    });
  });
});
