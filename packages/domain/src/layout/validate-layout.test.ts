import { describe, expect, it } from 'vitest';
import { validateLayoutDraft } from './validate-layout';
import { createValidLayoutDraftFixture } from './__fixtures__/layout-draft.fixture';

describe('validateLayoutDraft', () => {
  it('passes a structurally valid live draft', () => {
    const result = validateLayoutDraft(createValidLayoutDraftFixture());

    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('reports structural errors for invalid section lengths', () => {
    const draft = createValidLayoutDraftFixture();
    draft.racks[draft.rackIds[0]].faces[0].sections[0].length = 4;

    const result = validateLayoutDraft(draft);

    expect(result.isValid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'rack_face.section_length_mismatch')).toBe(true);
  });

  it('uses faceLength override instead of rack.totalLength when provided', () => {
    const draft = createValidLayoutDraftFixture();
    draft.racks[draft.rackIds[0]].faces[0].faceLength = 4;
    draft.racks[draft.rackIds[0]].faces[1].faceLength = 4;
    draft.racks[draft.rackIds[0]].faces[0].sections[0].length = 4;

    const result = validateLayoutDraft(draft);

    expect(result.isValid).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'rack_face.section_length_mismatch')).toBe(false);
  });

  it('rejects single racks with configured Face B', () => {
    const draft = createValidLayoutDraftFixture();
    draft.racks[draft.rackIds[0]].kind = 'single';
    draft.racks[draft.rackIds[0]].faces[1].enabled = true;
    draft.racks[draft.rackIds[0]].faces[1].sections = [
      {
        id: 'section-b-1',
        ordinal: 1,
        length: 5,
        levels: [{ id: 'level-b-1', ordinal: 1, slotCount: 3 }]
      }
    ];

    const result = validateLayoutDraft(draft);

    expect(result.isValid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'rack.single_face_b_forbidden')).toBe(true);
  });

  it('rejects non-axis-aligned or zero-length walls', () => {
    const draft = createValidLayoutDraftFixture();
    const diagonalWallId = '99999999-9999-9999-9999-999999999901';
    const zeroLengthWallId = '99999999-9999-9999-9999-999999999902';

    draft.wallIds = [diagonalWallId, zeroLengthWallId];
    draft.walls = {
      [diagonalWallId]: {
        id: diagonalWallId,
        code: 'W01',
        name: 'Diagonal wall',
        wallType: 'generic',
        x1: 10,
        y1: 10,
        x2: 40,
        y2: 50,
        blocksRackPlacement: true
      },
      [zeroLengthWallId]: {
        id: zeroLengthWallId,
        code: 'W02',
        name: 'Point wall',
        wallType: 'generic',
        x1: 80,
        y1: 120,
        x2: 80,
        y2: 120,
        blocksRackPlacement: true
      }
    };

    const result = validateLayoutDraft(draft);

    expect(result.isValid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'wall.axis_alignment_required')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'wall.zero_length_forbidden')).toBe(true);
  });
});
