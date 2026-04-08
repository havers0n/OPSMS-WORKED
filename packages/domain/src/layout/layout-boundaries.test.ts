import { describe, expect, it } from 'vitest';
import { createValidLayoutDraftFixture } from './__fixtures__/layout-draft.fixture';
import { composeLayoutDraft, splitLayoutDraft } from './layout-draft';

describe('layout boundary helpers', () => {
  it('splits lifecycle and rack geometry/structure without changing runtime draft shape on recompose', () => {
    const draft = createValidLayoutDraftFixture();

    const split = splitLayoutDraft(draft);
    const recomposed = composeLayoutDraft(split);

    expect(split.lifecycle).toEqual({
      layoutVersionId: draft.layoutVersionId,
      draftVersion: draft.draftVersion,
      floorId: draft.floorId,
      state: draft.state,
      versionNo: draft.versionNo ?? null
    });
    expect(split.racks[0]).toMatchObject({
      id: '33333333-3333-3333-3333-333333333333',
      geometry: {
        x: 10,
        y: 20,
        totalLength: 5,
        depth: 1.1,
        rotationDeg: 0
      },
      structure: {
        displayCode: '03',
        kind: 'paired',
        axis: 'NS'
      }
    });
    expect(split.racks[0]?.structure.faces[0]?.faceLength).toBeUndefined();
    expect(recomposed).toEqual({
      ...draft,
      versionNo: null
    });
  });
});
