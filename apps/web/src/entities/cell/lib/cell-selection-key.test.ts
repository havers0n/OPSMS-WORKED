import { describe, expect, it } from 'vitest';
import { parseCellSelectionKey } from './cell-selection-key';

const RACK_ID    = '3dbf2a90-b1cb-42f0-afec-57f436a22f5d';
const SECTION_ID = 'd208453f-555a-40d0-b4bf-f1e6a93a7752';

describe('parseCellSelectionKey', () => {
  it('parses a valid B2 cell key', () => {
    const key = `${RACK_ID}:${SECTION_ID}:3`;
    expect(parseCellSelectionKey(key)).toEqual({
      rackId: RACK_ID,
      sectionId: SECTION_ID,
      slotNo: 3
    });
  });

  it('parses slotNo 1 (minimum valid)', () => {
    const key = `${RACK_ID}:${SECTION_ID}:1`;
    expect(parseCellSelectionKey(key)).toEqual({
      rackId: RACK_ID,
      sectionId: SECTION_ID,
      slotNo: 1
    });
  });

  it('returns null for slotNo 0 (invalid)', () => {
    expect(parseCellSelectionKey(`${RACK_ID}:${SECTION_ID}:0`)).toBeNull();
  });

  it('returns null for negative slotNo', () => {
    expect(parseCellSelectionKey(`${RACK_ID}:${SECTION_ID}:-1`)).toBeNull();
  });

  it('returns null for non-numeric slotNo', () => {
    expect(parseCellSelectionKey(`${RACK_ID}:${SECTION_ID}:abc`)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCellSelectionKey('')).toBeNull();
  });

  it('returns null for old B1-style key (missing slot)', () => {
    expect(parseCellSelectionKey(`${RACK_ID}:${SECTION_ID}`)).toBeNull();
  });

  it('returns null for key with too many parts', () => {
    expect(parseCellSelectionKey(`${RACK_ID}:${SECTION_ID}:3:extra`)).toBeNull();
  });

  it('returns null when any UUID part is empty', () => {
    expect(parseCellSelectionKey(`:${SECTION_ID}:3`)).toBeNull();
    expect(parseCellSelectionKey(`${RACK_ID}::3`)).toBeNull();
  });
});
