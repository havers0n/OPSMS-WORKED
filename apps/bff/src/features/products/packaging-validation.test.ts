import { describe, expect, it } from 'vitest';
import {
  validateFinalPackagingState,
  assertFinalPackagingState,
  assertBaseRowPreserved,
  type PackagingLevelInput
} from './packaging-validation.js';
import { ApiError } from '../../errors.js';
import type { ProductPackagingLevel } from '@wos/domain';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const base = (overrides?: Partial<PackagingLevelInput>): PackagingLevelInput => ({
  code: 'EACH',
  name: 'Each',
  baseUnitQty: 1,
  isBase: true,
  canPick: true,
  canStore: true,
  isDefaultPickUom: true,
  barcode: null,
  packWeightG: null,
  packWidthMm: null,
  packHeightMm: null,
  packDepthMm: null,
  sortOrder: 0,
  isActive: true,
  ...overrides
});

const carton = (overrides?: Partial<PackagingLevelInput>): PackagingLevelInput => ({
  code: 'CTN',
  name: 'Carton',
  baseUnitQty: 12,
  isBase: false,
  canPick: true,
  canStore: true,
  isDefaultPickUom: false,
  barcode: null,
  packWeightG: null,
  packWidthMm: null,
  packHeightMm: null,
  packDepthMm: null,
  sortOrder: 1,
  isActive: true,
  ...overrides
});

// ── validateFinalPackagingState ───────────────────────────────────────────────

describe('validateFinalPackagingState', () => {
  it('returns no violations for a valid minimal set (one base)', () => {
    const violations = validateFinalPackagingState([base()]);
    expect(violations).toHaveLength(0);
  });

  it('returns no violations for a valid multi-level set', () => {
    const violations = validateFinalPackagingState([base(), carton()]);
    expect(violations).toHaveLength(0);
  });

  // ── Critical: zero base rows ────────────────────────────────────────────────

  it('reports ZERO_BASE_ROWS when no base row is present', () => {
    const violations = validateFinalPackagingState([carton()]);
    expect(violations.some((v) => v.code === 'ZERO_BASE_ROWS')).toBe(true);
  });

  it('reports ZERO_BASE_ROWS for an empty set', () => {
    const violations = validateFinalPackagingState([]);
    expect(violations.some((v) => v.code === 'ZERO_BASE_ROWS')).toBe(true);
  });

  // ── Critical: multiple base rows ───────────────────────────────────────────

  it('reports MULTIPLE_BASE_ROWS when two base rows are present', () => {
    const violations = validateFinalPackagingState([base(), base({ code: 'EACH2', name: 'Each 2' })]);
    expect(violations.some((v) => v.code === 'MULTIPLE_BASE_ROWS')).toBe(true);
  });

  it('reports MULTIPLE_BASE_ROWS for three base rows', () => {
    const violations = validateFinalPackagingState([
      base(),
      base({ code: 'B2', name: 'B2' }),
      base({ code: 'B3', name: 'B3' })
    ]);
    expect(violations.some((v) => v.code === 'MULTIPLE_BASE_ROWS')).toBe(true);
  });

  // ── Critical: multiple default pick rows ───────────────────────────────────

  it('reports MULTIPLE_DEFAULT_PICK_ROWS when two rows have isDefaultPickUom=true', () => {
    const violations = validateFinalPackagingState([
      base({ isDefaultPickUom: true }),
      carton({ isDefaultPickUom: true })
    ]);
    expect(violations.some((v) => v.code === 'MULTIPLE_DEFAULT_PICK_ROWS')).toBe(true);
  });

  // ── Base row qty invariant ─────────────────────────────────────────────────

  it('reports BASE_UNIT_QTY_INVALID when base row has baseUnitQty != 1', () => {
    const violations = validateFinalPackagingState([base({ baseUnitQty: 6 })]);
    expect(violations.some((v) => v.code === 'BASE_UNIT_QTY_INVALID')).toBe(true);
  });

  it('accepts base row with baseUnitQty = 1', () => {
    const violations = validateFinalPackagingState([base({ baseUnitQty: 1 })]);
    expect(violations.some((v) => v.code === 'BASE_UNIT_QTY_INVALID')).toBe(false);
  });

  // ── Inactive default pick ──────────────────────────────────────────────────

  it('reports INACTIVE_DEFAULT_PICK when inactive level is default pick', () => {
    const violations = validateFinalPackagingState([
      base({ isDefaultPickUom: false }),
      carton({ isDefaultPickUom: true, isActive: false })
    ]);
    expect(violations.some((v) => v.code === 'INACTIVE_DEFAULT_PICK')).toBe(true);
  });

  // ── Duplicate codes ────────────────────────────────────────────────────────

  it('reports DUPLICATE_CODE when two rows share the same code', () => {
    const violations = validateFinalPackagingState([
      base({ code: 'X' }),
      carton({ code: 'X' })
    ]);
    expect(violations.some((v) => v.code === 'DUPLICATE_CODE')).toBe(true);
  });

  it('does not report DUPLICATE_CODE for distinct codes', () => {
    const violations = validateFinalPackagingState([base({ code: 'EACH' }), carton({ code: 'CTN' })]);
    expect(violations.some((v) => v.code === 'DUPLICATE_CODE')).toBe(false);
  });

  // ── baseUnitQty < 1 ────────────────────────────────────────────────────────

  it('reports BASE_UNIT_QTY_BELOW_ONE for zero qty', () => {
    const violations = validateFinalPackagingState([base(), carton({ baseUnitQty: 0 })]);
    expect(violations.some((v) => v.code === 'BASE_UNIT_QTY_BELOW_ONE')).toBe(true);
  });

  // ── Non-positive dimensions ────────────────────────────────────────────────

  it('reports NON_POSITIVE_DIMENSION for zero pack weight', () => {
    const violations = validateFinalPackagingState([base(), carton({ packWeightG: 0 })]);
    expect(violations.some((v) => v.code === 'NON_POSITIVE_DIMENSION')).toBe(true);
  });

  it('accepts null dimensions (optional)', () => {
    const violations = validateFinalPackagingState([base(), carton({ packWeightG: null })]);
    expect(violations.some((v) => v.code === 'NON_POSITIVE_DIMENSION')).toBe(false);
  });
});

// ── assertFinalPackagingState ─────────────────────────────────────────────────

describe('assertFinalPackagingState', () => {
  it('does not throw for a valid set', () => {
    expect(() => assertFinalPackagingState([base(), carton()])).not.toThrow();
  });

  it('throws ApiError 422 ZERO_BASE_ROWS for empty set', () => {
    expect(() => assertFinalPackagingState([])).toThrow(ApiError);
    try {
      assertFinalPackagingState([]);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(422);
      expect((err as ApiError).code).toBe('ZERO_BASE_ROWS');
    }
  });

  it('throws ApiError 422 MULTIPLE_BASE_ROWS for two base rows', () => {
    try {
      assertFinalPackagingState([base(), base({ code: 'B2', name: 'B2' })]);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('MULTIPLE_BASE_ROWS');
    }
  });

  it('throws ApiError 422 MULTIPLE_DEFAULT_PICK_ROWS', () => {
    try {
      assertFinalPackagingState([base({ isDefaultPickUom: true }), carton({ isDefaultPickUom: true })]);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('MULTIPLE_DEFAULT_PICK_ROWS');
    }
  });

  it('throws ApiError 422 BASE_UNIT_QTY_INVALID', () => {
    try {
      assertFinalPackagingState([base({ baseUnitQty: 3 })]);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('BASE_UNIT_QTY_INVALID');
    }
  });

  it('throws ApiError 409 DUPLICATE_CODE for duplicate code in final set', () => {
    try {
      assertFinalPackagingState([base({ code: 'EACH' }), carton({ code: 'EACH' })]);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(409);
      expect((err as ApiError).code).toBe('DUPLICATE_CODE');
    }
  });
});

// ── assertBaseRowPreserved ────────────────────────────────────────────────────

function makeLevel(overrides: Partial<ProductPackagingLevel>): ProductPackagingLevel {
  return {
    id: crypto.randomUUID(),
    productId: crypto.randomUUID(),
    code: 'X',
    name: 'X',
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

describe('assertBaseRowPreserved', () => {
  it('does not throw when exactly one base row remains', () => {
    const levels = [makeLevel({ isBase: true }), makeLevel({ isBase: false })];
    expect(() => assertBaseRowPreserved(levels)).not.toThrow();
  });

  it('throws ZERO_BASE_ROWS when remaining set has no base row', () => {
    const levels = [makeLevel({ isBase: false })];
    try {
      assertBaseRowPreserved(levels);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('ZERO_BASE_ROWS');
    }
  });

  it('throws ZERO_BASE_ROWS for an empty remaining set', () => {
    try {
      assertBaseRowPreserved([]);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('ZERO_BASE_ROWS');
    }
  });

  it('throws MULTIPLE_BASE_ROWS when two base rows remain', () => {
    const levels = [makeLevel({ isBase: true }), makeLevel({ isBase: true })];
    try {
      assertBaseRowPreserved(levels);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('MULTIPLE_BASE_ROWS');
    }
  });
});
