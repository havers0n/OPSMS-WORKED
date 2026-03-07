import { afterEach, describe, expect, it } from 'vitest';
import { createLayoutDraftFixture } from './__fixtures__/layout-draft.fixture';
import { useEditorStore } from './editor-store';

function resetStore() {
  useEditorStore.setState({
    selectedRackId: null,
    hoveredRackId: null,
    zoom: 1,
    draft: null,
    draftSourceVersionId: null,
    isDraftDirty: false
  });
}

afterEach(() => {
  resetStore();
});

describe('editor-store', () => {
  it('initializes live draft into local state', () => {
    const draft = createLayoutDraftFixture();

    useEditorStore.getState().initializeDraft(draft);

    expect(useEditorStore.getState().draft?.layoutVersionId).toBe(draft.layoutVersionId);
    expect(useEditorStore.getState().selectedRackId).toBe(draft.rackIds[0]);
    expect(useEditorStore.getState().isDraftDirty).toBe(false);
  });

  it('does not overwrite a dirty draft when the same layout version re-queries', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 100, 200);

    const dirtyDraft = useEditorStore.getState().draft;
    useEditorStore.getState().initializeDraft(createLayoutDraftFixture());

    expect(useEditorStore.getState().draft).toEqual(dirtyDraft);
    expect(useEditorStore.getState().isDraftDirty).toBe(true);
  });

  it('markDraftSaved clears dirty state for the active draft version', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 100, 200);

    useEditorStore.getState().markDraftSaved(draft.layoutVersionId);

    expect(useEditorStore.getState().isDraftDirty).toBe(false);
    expect(useEditorStore.getState().draft?.layoutVersionId).toBe(draft.layoutVersionId);
  });

  it('resetDraft clears selected rack and dirty state', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 100, 200);

    useEditorStore.getState().resetDraft();

    expect(useEditorStore.getState().draft).toBeNull();
    expect(useEditorStore.getState().selectedRackId).toBeNull();
    expect(useEditorStore.getState().isDraftDirty).toBe(false);
  });
});
