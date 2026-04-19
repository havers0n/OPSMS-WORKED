import type { ProductPackagingLevel } from '@wos/domain';
import { ApiError } from '../../errors.js';

export type PackagingLevelInput = {
  id?: string;
  code: string;
  name: string;
  baseUnitQty: number;
  isBase: boolean;
  canPick: boolean;
  canStore: boolean;
  isDefaultPickUom: boolean;
  barcode?: string | null;
  packWeightG?: number | null;
  packWidthMm?: number | null;
  packHeightMm?: number | null;
  packDepthMm?: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type FinalStateViolation = {
  code: string;
  message: string;
  levelIndex?: number;
};

/**
 * Validates the final intended set of packaging levels for a product.
 * Pure function — no side effects, testable without DB.
 *
 * Returns a list of violations. Empty array means valid.
 */
export function validateFinalPackagingState(
  levels: Array<PackagingLevelInput | ProductPackagingLevel>
): FinalStateViolation[] {
  const violations: FinalStateViolation[] = [];

  const baseRows = levels.filter((l) => l.isBase);
  if (baseRows.length === 0) {
    violations.push({ code: 'ZERO_BASE_ROWS', message: 'Exactly one base row is required. Found 0.' });
  } else if (baseRows.length > 1) {
    violations.push({
      code: 'MULTIPLE_BASE_ROWS',
      message: `Exactly one base row is required. Found ${baseRows.length}.`
    });
  }

  const defaultPickRows = levels.filter((l) => l.isDefaultPickUom);
  if (defaultPickRows.length > 1) {
    violations.push({
      code: 'MULTIPLE_DEFAULT_PICK_ROWS',
      message: `At most one default pick UOM is allowed. Found ${defaultPickRows.length}.`
    });
  }

  const codes = new Set<string>();
  levels.forEach((l, i) => {
    if (l.isBase && l.baseUnitQty !== 1) {
      violations.push({
        code: 'BASE_UNIT_QTY_INVALID',
        message: `Base row must have baseUnitQty = 1 (got ${l.baseUnitQty}).`,
        levelIndex: i
      });
    }

    if (!l.isActive && l.isDefaultPickUom) {
      violations.push({
        code: 'INACTIVE_DEFAULT_PICK',
        message: 'Inactive level cannot be the default pick UOM.',
        levelIndex: i
      });
    }

    if (!l.code.trim()) {
      violations.push({ code: 'EMPTY_CODE', message: 'Level code cannot be empty.', levelIndex: i });
    } else if (codes.has(l.code.trim())) {
      violations.push({
        code: 'DUPLICATE_CODE',
        message: `Duplicate code "${l.code.trim()}" in set.`,
        levelIndex: i
      });
    } else {
      codes.add(l.code.trim());
    }

    if (l.baseUnitQty < 1) {
      violations.push({
        code: 'BASE_UNIT_QTY_BELOW_ONE',
        message: 'baseUnitQty must be ≥ 1.',
        levelIndex: i
      });
    }

    const checkPositive = (val: number | null | undefined, field: string) => {
      if (val != null && val <= 0) {
        violations.push({ code: 'NON_POSITIVE_DIMENSION', message: `${field} must be positive.`, levelIndex: i });
      }
    };
    checkPositive('packWeightG' in l ? l.packWeightG : null, 'packWeightG');
    checkPositive('packWidthMm' in l ? l.packWidthMm : null, 'packWidthMm');
    checkPositive('packHeightMm' in l ? l.packHeightMm : null, 'packHeightMm');
    checkPositive('packDepthMm' in l ? l.packDepthMm : null, 'packDepthMm');
  });

  return violations;
}

/**
 * Throws ApiError 422 if the final set is invalid.
 * Used by both the batch-replace route and individual mutation guards.
 */
export function assertFinalPackagingState(
  levels: Array<PackagingLevelInput | ProductPackagingLevel>
): void {
  const violations = validateFinalPackagingState(levels);
  if (violations.length === 0) return;

  const [first, ...rest] = violations;
  const statusCode = first.code === 'DUPLICATE_CODE' ? 409 : 422;
  throw new ApiError(statusCode, first.code, first.message, rest.length > 0 ? rest : undefined);
}

/**
 * Checks that the given set still has exactly one base row after a mutating
 * operation. Used by individual delete/update guards.
 */
export function assertBaseRowPreserved(
  levelsAfterOp: ProductPackagingLevel[]
): void {
  const baseCount = levelsAfterOp.filter((l) => l.isBase).length;
  if (baseCount === 0) {
    throw new ApiError(
      422,
      'ZERO_BASE_ROWS',
      'This operation would leave the product with no base packaging level. Assign another base row first.'
    );
  }
  if (baseCount > 1) {
    throw new ApiError(422, 'MULTIPLE_BASE_ROWS', 'This operation would result in multiple base rows.');
  }
}
