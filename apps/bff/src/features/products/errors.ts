import { ApiError } from '../../errors.js';

export type ProductsErrorCode = string;

export type ProductsErrorShape = {
  code: ProductsErrorCode;
  message: string;
};

type SupabaseLikeError = {
  message?: string;
};

/**
 * Maps Postgres errors raised by replace_product_packaging_levels()
 * into typed ApiErrors.  Returns null for unrecognised errors so
 * callers can fall back to the generic Supabase error mapper.
 */
export function mapPackagingRpcError(error: SupabaseLikeError | null): ApiError | null {
  switch (error?.message) {
    case 'PRODUCT_NOT_FOUND':
      return new ApiError(404, 'NOT_FOUND', 'Product was not found.');
    case 'ZERO_BASE_ROWS':
      return new ApiError(422, 'ZERO_BASE_ROWS', 'Exactly one base row is required; the supplied set contains none.');
    case 'MULTIPLE_BASE_ROWS':
      return new ApiError(422, 'MULTIPLE_BASE_ROWS', 'Exactly one base row is required; the supplied set contains more than one.');
    case 'BASE_UNIT_QTY_INVALID':
      return new ApiError(422, 'BASE_UNIT_QTY_INVALID', 'The base row must have base_unit_qty = 1.');
    case 'MULTIPLE_DEFAULT_PICK_ROWS':
      return new ApiError(422, 'MULTIPLE_DEFAULT_PICK_ROWS', 'At most one default pick UOM is allowed.');
    case 'INACTIVE_DEFAULT_PICK':
      return new ApiError(422, 'INACTIVE_DEFAULT_PICK', 'An inactive packaging level cannot be the default pick UOM.');
    case 'DUPLICATE_CODE':
      return new ApiError(409, 'DUPLICATE_CODE', 'Two or more rows in the supplied set share the same code.');
    case 'BASE_UNIT_QTY_BELOW_ONE':
      return new ApiError(422, 'BASE_UNIT_QTY_BELOW_ONE', 'base_unit_qty must be >= 1 for every row.');
    case 'NON_POSITIVE_DIMENSION':
      return new ApiError(422, 'NON_POSITIVE_DIMENSION', 'Pack dimensions must be positive when provided.');
    default:
      return null;
  }
}
