import { describe, expect, it } from 'vitest';
import {
  buildPackagingLevelsComparable,
  buildUnitProfileComparable,
  createEmptyPackagingLevelDraft
} from '../ui/section-editing';
import {
  equalPackagingLevelsComparable,
  equalUnitProfileComparable
} from './comparators';

describe('equalUnitProfileComparable', () => {
  it('matches the current comparable payload semantics field-by-field', () => {
    const source = buildUnitProfileComparable({
      unitWeightG: '10',
      unitWidthMm: '20',
      unitHeightMm: '30',
      unitDepthMm: '40',
      weightClass: 'light',
      sizeClass: 'small'
    });
    const same = buildUnitProfileComparable({
      unitWeightG: '10',
      unitWidthMm: '20',
      unitHeightMm: '30',
      unitDepthMm: '40',
      weightClass: 'light',
      sizeClass: 'small'
    });
    const changed = buildUnitProfileComparable({
      unitWeightG: '10',
      unitWidthMm: '20',
      unitHeightMm: '30',
      unitDepthMm: '41',
      weightClass: 'light',
      sizeClass: 'small'
    });

    expect(source).not.toBeNull();
    expect(same).not.toBeNull();
    expect(changed).not.toBeNull();
    expect(equalUnitProfileComparable(source!, same!)).toBe(true);
    expect(equalUnitProfileComparable(source!, changed!)).toBe(false);
  });
});

describe('equalPackagingLevelsComparable', () => {
  function createRows() {
    const base = {
      ...createEmptyPackagingLevelDraft('base'),
      id: 'base-id',
      code: 'EA',
      name: 'Each',
      baseUnitQty: '1',
      isBase: true
    };
    const caseRow = {
      ...createEmptyPackagingLevelDraft('case'),
      id: 'case-id',
      code: 'CTN',
      name: 'Carton',
      baseUnitQty: '12',
      barcode: '123'
    };

    return { base, caseRow };
  }

  it('compares normalized packaging rows by explicit typed fields', () => {
    const { base, caseRow } = createRows();
    const source = buildPackagingLevelsComparable([base, caseRow]);
    const same = buildPackagingLevelsComparable([
      { ...base, code: ' EA ' },
      { ...caseRow, barcode: '123 ' }
    ]);
    const changed = buildPackagingLevelsComparable([
      base,
      { ...caseRow, packWeightG: '99' }
    ]);

    expect(equalPackagingLevelsComparable(source, same)).toBe(true);
    expect(equalPackagingLevelsComparable(source, changed)).toBe(false);
  });

  it('treats row order as part of equality, matching current sortOrder-based semantics', () => {
    const { base, caseRow } = createRows();
    const source = buildPackagingLevelsComparable([base, caseRow]);
    const reordered = buildPackagingLevelsComparable([caseRow, base]);

    expect(equalPackagingLevelsComparable(source, reordered)).toBe(false);
  });
});
