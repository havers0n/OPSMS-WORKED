import { describe, expect, it } from 'vitest';
import { generatePreviewCells } from './generate-cells';
import { createValidLayoutDraftFixture } from './__fixtures__/layout-draft.fixture';

describe('generatePreviewCells', () => {
  it('generates canonical addresses from a live draft shape', () => {
    const cells = generatePreviewCells(createValidLayoutDraftFixture());
    const addresses = cells.map((cell) => cell.address.raw);

    expect(cells).toHaveLength(8);
    expect(addresses).toContain('03-A.01.01.01');
    expect(addresses).toContain('03-A.01.01.02');
    expect(addresses).toContain('03-A.01.02.01');
    expect(addresses).toContain('03-B.01.01.01');
    expect(addresses).toContain('03-B.01.01.02');
  });

  it('exposes previewCellKey instead of persisted cellCode on generated preview cells', () => {
    const [firstCell] = generatePreviewCells(createValidLayoutDraftFixture());

    expect(firstCell?.previewCellKey).toMatch(/^cell_[0-9a-f]{8}$/);
    expect(firstCell).not.toHaveProperty('cellCode');
  });

  it('falls back to legacy mirror fields when relationshipMode is absent', () => {
    const draft = createValidLayoutDraftFixture();
    const faceB = draft.racks[draft.rackIds[0]].faces.find((face) => face.side === 'B');
    if (!faceB) {
      throw new Error('Expected Face B fixture');
    }

    delete faceB.relationshipMode;

    const cells = generatePreviewCells(draft);
    const faceBCells = cells.filter((cell) => cell.address.raw.startsWith('03-B.'));
    expect(faceBCells).toHaveLength(4);
  });
});
