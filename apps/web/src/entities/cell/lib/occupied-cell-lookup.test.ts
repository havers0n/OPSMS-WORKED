import { describe, expect, it } from 'vitest';
import { indexOccupiedCellIds } from './occupied-cell-lookup';

describe('occupied cell lookup', () => {
  it('builds a set of occupied cell ids for fast canvas checks', () => {
    const lookup = indexOccupiedCellIds([
      { cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398' },
      { cellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce' }
    ]);

    expect(lookup.has('216f2dd6-8f17-4de4-aaba-657f9e0e1398')).toBe(true);
    expect(lookup.has('f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce')).toBe(true);
    expect(lookup.has('missing-cell')).toBe(false);
  });
});
