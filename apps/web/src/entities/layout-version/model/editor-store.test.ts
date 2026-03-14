import { afterEach, describe, expect, it } from 'vitest';
import { mapLayoutDraftToSavePayload } from '../../../features/layout-draft-save/api/mappers';
import { createLayoutDraftFixture } from './__fixtures__/layout-draft.fixture';
import { useEditorStore } from './editor-store';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resetStore() {
  useEditorStore.setState({
    selection: { type: 'none' },
    hoveredRackId: null,
    creatingRackId: null,
    zoom: 1,
    minRackDistance: 0,
    draft: null,
    draftSourceVersionId: null,
    isDraftDirty: false
  });
}

function createUuidLayoutDraftFixture() {
  return {
    layoutVersionId: crypto.randomUUID(),
    floorId: crypto.randomUUID(),
    state: 'draft' as const,
    rackIds: [],
    racks: {}
  };
}

afterEach(() => {
  resetStore();
});

describe('editor-store', () => {
  it('initializes live draft into local state', () => {
    const draft = createLayoutDraftFixture();

    useEditorStore.getState().initializeDraft(draft);

    expect(useEditorStore.getState().draft?.layoutVersionId).toBe(draft.layoutVersionId);
    expect(useEditorStore.getState().draft?.state).toBe('draft');
    const sel = useEditorStore.getState().selection;
    expect(sel.type === 'rack' ? sel.rackIds[0] : null).toBe(draft.rackIds[0]);
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

  it('preserves faceLength when initializing and saving an unchanged draft', () => {
    const draft = createLayoutDraftFixture();
    draft.racks[draft.rackIds[0]].faces[0].faceLength = 4.5;

    useEditorStore.getState().initializeDraft(draft);

    expect(useEditorStore.getState().draft?.racks[draft.rackIds[0]].faces[0].faceLength).toBe(4.5);
    expect(mapLayoutDraftToSavePayload(useEditorStore.getState().draft!).racks[0]?.faces[0].faceLength).toBe(4.5);
  });

  it('resetDraft clears selected rack and dirty state', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 100, 200);

    useEditorStore.getState().resetDraft();

    expect(useEditorStore.getState().draft).toBeNull();
    expect(useEditorStore.getState().selection).toEqual({ type: 'none' });
    expect(useEditorStore.getState().isDraftDirty).toBe(false);
  });

  it('generates UUID ids for all new entities sent to save', () => {
    useEditorStore.getState().initializeDraft(createUuidLayoutDraftFixture());
    useEditorStore.getState().createRack(120, 80);

    const rackId = useEditorStore.getState().draft?.rackIds[0];
    expect(rackId).toBeTruthy();

    const sectionId = useEditorStore.getState().draft?.racks[rackId!].faces[0]?.sections[0]?.id;
    expect(sectionId).toBeTruthy();

    useEditorStore.getState().addSection(rackId!, 'A');
    useEditorStore.getState().addLevel(rackId!, 'A', sectionId!);
    useEditorStore.getState().updateLevelCount(rackId!, 'A', sectionId!, 3);
    useEditorStore.getState().applyFacePreset(rackId!, 'A', 2, 2, 4);
    useEditorStore.getState().setFaceBMode(rackId!, 'copy');
    useEditorStore.getState().duplicateRack(rackId!);

    const payload = mapLayoutDraftToSavePayload(useEditorStore.getState().draft!);

    expect(payload.layoutVersionId).toMatch(UUID_REGEX);

    for (const rack of payload.racks) {
      expect(rack.id).toMatch(UUID_REGEX);

      for (const face of rack.faces) {
        expect(face.id).toMatch(UUID_REGEX);
        expect(face.mirrorSourceFaceId === null || UUID_REGEX.test(face.mirrorSourceFaceId)).toBe(true);

        for (const section of face.sections) {
          expect(section.id).toMatch(UUID_REGEX);

          for (const level of section.levels) {
            expect(level.id).toMatch(UUID_REGEX);
          }
        }
      }
    }
  });
});
