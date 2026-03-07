import { describe, expect, it } from 'vitest';
import { generateLayoutCells } from './generate-cells';
import { createValidLayoutDraftFixture } from './__fixtures__/layout-draft.fixture';

describe('generateLayoutCells', () => {
  it('generates canonical addresses from a live draft shape', () => {
    const cells = generateLayoutCells(createValidLayoutDraftFixture());
    const addresses = cells.map((cell) => cell.address.raw);

    expect(cells).toHaveLength(8);
    expect(addresses).toContain('03-A.01.01.01');
    expect(addresses).toContain('03-A.01.01.02');
    expect(addresses).toContain('03-A.01.02.01');
    expect(addresses).toContain('03-B.01.01.01');
    expect(addresses).toContain('03-B.01.01.02');
  });
});
