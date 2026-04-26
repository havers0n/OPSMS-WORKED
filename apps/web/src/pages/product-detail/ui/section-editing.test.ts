import { describe, expect, it } from 'vitest';
import {
  createPackagingLevelDraft,
  createPackagingLevelDrafts,
  createEmptyPackagingLevelDraft,
  createUnitProfileDraft,
  resolvePackagingDraftQuantities,
  validatePackagingLevelsDraft,
  validateUnitProfileDraft
} from './section-editing';
import type { ProductPackagingLevel } from '@wos/domain';

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

  function createMasterRow() {
    return {
      ...createEmptyPackagingLevelDraft('master'),
      code: 'MST',
      name: 'Master',
      baseUnitQty: '5',
      containedLevelDraftId: 'case'
    };
  }

  it('accepts a valid structured set', () => {
    const result = validatePackagingLevelsDraft([createBaseRow(), createCaseRow()]);
    expect(result.payload).toHaveLength(2);
    expect(result.rowErrors).toEqual({});
    expect(result.sectionErrors).toEqual([]);
  });

  it('preserves packaging payload field names and shape', () => {
    const result = validatePackagingLevelsDraft([
      { ...createBaseRow(), canPick: true, canStore: false, isDefaultPickUom: true },
      { ...createCaseRow(), canPick: false, canStore: true, isDefaultPickUom: false }
    ]);

    expect(result.payload).toEqual([
      {
        code: 'EA',
        name: 'Each',
        baseUnitQty: 1,
        isBase: true,
        canPick: true,
        canStore: false,
        isDefaultPickUom: true,
        barcode: null,
        packWeightG: null,
        packWidthMm: null,
        packHeightMm: null,
        packDepthMm: null,
        sortOrder: 0,
        isActive: true
      },
      {
        code: 'CTN',
        name: 'Carton',
        baseUnitQty: 12,
        isBase: false,
        canPick: false,
        canStore: true,
        isDefaultPickUom: false,
        barcode: null,
        packWeightG: null,
        packWidthMm: null,
        packHeightMm: null,
        packDepthMm: null,
        sortOrder: 1,
        isActive: true
      }
    ]);
  });

  it('serializes only explicit manual packaging override values', () => {
    const result = validatePackagingLevelsDraft([
      createBaseRow(),
      {
        ...createCaseRow(),
        packWeightG: '500',
        packWidthMm: '300',
        packHeightMm: '200',
        packDepthMm: '100'
      }
    ]);

    expect(result.payload?.[0]).toMatchObject({
      packWeightG: null,
      packWidthMm: null,
      packHeightMm: null,
      packDepthMm: null
    });
    expect(result.payload?.[1]).toMatchObject({
      packWeightG: 500,
      packWidthMm: 300,
      packHeightMm: 200,
      packDepthMm: 100
    });
  });

  it('serializes nested quantities as cumulative base units', () => {
    const result = validatePackagingLevelsDraft([
      createBaseRow(),
      { ...createCaseRow(), baseUnitQty: '10', containedLevelDraftId: 'base' },
      createMasterRow()
    ]);

    expect(result.payload?.map((row) => ({ code: row.code, baseUnitQty: row.baseUnitQty }))).toEqual([
      { code: 'EA', baseUnitQty: 1 },
      { code: 'CTN', baseUnitQty: 10 },
      { code: 'MST', baseUnitQty: 50 }
    ]);
  });

  it('rejects circular nested quantities', () => {
    const result = validatePackagingLevelsDraft([
      createBaseRow(),
      { ...createCaseRow(), containedLevelDraftId: 'master' },
      { ...createMasterRow(), containedLevelDraftId: 'case' }
    ]);

    expect(result.payload).toBeNull();
    expect(Object.values(result.rowErrors).flatMap((errors) => Object.values(errors))).toContain(
      'Packaging containment cannot be circular.'
    );
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

describe('createPackagingLevelDraft', () => {
  function makeLevel(overrides: Partial<ProductPackagingLevel>): ProductPackagingLevel {
    return {
      id: crypto.randomUUID(),
      productId: crypto.randomUUID(),
      code: 'EA',
      name: 'Each',
      baseUnitQty: 1,
      isBase: false,
      canPick: true,
      canStore: true,
      isDefaultPickUom: false,
      barcode: null,
      packWeightG: null,
      packWidthMm: null,
      packHeightMm: null,
      packDepthMm: null,
      sortOrder: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  it('normalizes dirty persisted base rows to quantity 1 in editor draft', () => {
    const dirtyBase = makeLevel({
      isBase: true,
      baseUnitQty: 10
    });

    const draft = createPackagingLevelDraft(dirtyBase, 0);
    expect(draft.baseUnitQty).toBe('1');
  });

  it('derives editable nested counts from persisted cumulative base quantities', () => {
    const productId = crypto.randomUUID();
    const base = makeLevel({ id: crypto.randomUUID(), productId, code: 'EA', name: 'Each', isBase: true, baseUnitQty: 1 });
    const medium = makeLevel({ id: crypto.randomUUID(), productId, code: 'MED', name: 'Medium', baseUnitQty: 10 });
    const big = makeLevel({ id: crypto.randomUUID(), productId, code: 'BIG', name: 'Big', baseUnitQty: 50 });

    const drafts = createPackagingLevelDrafts([base, medium, big]);
    const mediumDraft = drafts.find((draft) => draft.id === medium.id);
    const bigDraft = drafts.find((draft) => draft.id === big.id);

    expect(mediumDraft?.baseUnitQty).toBe('10');
    expect(mediumDraft?.containedLevelDraftId).toBe(drafts.find((draft) => draft.id === base.id)?.draftId);
    expect(bigDraft?.baseUnitQty).toBe('5');
    expect(bigDraft?.containedLevelDraftId).toBe(mediumDraft?.draftId);
    expect(resolvePackagingDraftQuantities(drafts)[bigDraft!.draftId]?.canonicalBaseUnitQty).toBe(50);
  });
});
