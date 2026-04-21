import { describe, expect, it } from 'vitest';
import {
  createEmptyPackagingLevelDraft,
  createUnitProfileDraft,
  validatePackagingLevelsDraft,
  validateUnitProfileDraft
} from './section-editing';

describe('validateUnitProfileDraft', () => {
  it('accepts nullable exact dimensions and nullable fallback classes', () => {
    const result = validateUnitProfileDraft(createUnitProfileDraft(null));
    expect(result.payload).toEqual({
      unitWeightG: null,
      unitWidthMm: null,
      unitHeightMm: null,
      unitDepthMm: null,
      weightClass: null,
      sizeClass: null
    });
  });

  it('rejects non-integer or non-positive values', () => {
    const result = validateUnitProfileDraft({
      unitWeightG: 'abc',
      unitWidthMm: '0',
      unitHeightMm: '-1',
      unitDepthMm: '3.5',
      weightClass: '',
      sizeClass: ''
    });

    expect(result.payload).toBeNull();
    expect(result.fieldErrors.unitWeightG).toBeDefined();
    expect(result.fieldErrors.unitWidthMm).toBeDefined();
    expect(result.fieldErrors.unitHeightMm).toBeDefined();
    expect(result.fieldErrors.unitDepthMm).toBeDefined();
  });
});

describe('validatePackagingLevelsDraft', () => {
  function createBaseRow() {
    return {
      ...createEmptyPackagingLevelDraft('base'),
      code: 'EA',
      name: 'Each',
      baseUnitQty: '1',
      isBase: true
    };
  }

  function createCaseRow() {
    return {
      ...createEmptyPackagingLevelDraft('case'),
      code: 'CTN',
      name: 'Carton',
      baseUnitQty: '12'
    };
  }

  it('accepts a valid structured set', () => {
    const result = validatePackagingLevelsDraft([createBaseRow(), createCaseRow()]);
    expect(result.payload).toHaveLength(2);
    expect(result.rowErrors).toEqual({});
    expect(result.sectionErrors).toEqual([]);
  });

  it('requires exactly one base row', () => {
    const noBase = validatePackagingLevelsDraft([{ ...createCaseRow(), draftId: 'row-1' }]);
    expect(noBase.payload).toBeNull();
    expect(noBase.sectionErrors).toContain('Packaging levels must contain exactly one base row.');

    const twoBase = validatePackagingLevelsDraft([
      createBaseRow(),
      { ...createCaseRow(), isBase: true }
    ]);
    expect(twoBase.payload).toBeNull();
    expect(twoBase.sectionErrors).toContain('Packaging levels must contain exactly one base row.');
  });

  it('rejects multiple default-pick rows and inactive default-pick rows', () => {
    const result = validatePackagingLevelsDraft([
      { ...createBaseRow(), isDefaultPickUom: true, isActive: false },
      { ...createCaseRow(), isDefaultPickUom: true }
    ]);

    expect(result.payload).toBeNull();
    expect(result.sectionErrors).toContain('Packaging levels can contain at most one default pick row.');
    expect(result.sectionErrors).toContain('Row 1: inactive level cannot be default pick.');
  });
});
