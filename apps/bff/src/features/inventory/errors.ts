import { ApiError } from '../../errors.js';

export type InventoryErrorCode = string;

export type InventoryErrorShape = {
  code: InventoryErrorCode;
  message: string;
};

type SupabaseLikeError = {
  message?: string;
};

export function mapReceiveInventoryRpcError(error: SupabaseLikeError | null): ApiError | null {
  switch (error?.message) {
    case 'CONTAINER_NOT_FOUND':
      return new ApiError(404, 'CONTAINER_NOT_FOUND', 'Container was not found.');
    case 'CONTAINER_NOT_RECEIVABLE':
      return new ApiError(409, 'CONTAINER_NOT_RECEIVABLE', 'Only active containers can receive inventory.');
    case 'PRODUCT_NOT_FOUND':
    case 'PRODUCT_INACTIVE':
      return new ApiError(404, 'NOT_FOUND', 'Product was not found.');
    case 'PACKAGING_LEVEL_REQUIRED':
      return new ApiError(422, 'PACKAGING_LEVEL_REQUIRED', 'Packaged stock requires a product packaging level.');
    case 'PACKAGING_LEVEL_NOT_FOUND':
      return new ApiError(422, 'PACKAGING_LEVEL_NOT_FOUND', 'The selected packaging level was not found.');
    case 'PACK_COUNT_REQUIRED':
      return new ApiError(422, 'PACK_COUNT_REQUIRED', 'Packaged stock requires packCount.');
    case 'INVALID_PACK_COUNT':
      return new ApiError(422, 'INVALID_PACK_COUNT', 'packCount must be a positive integer when provided.');
    case 'INVALID_PACKAGING_STATE':
      return new ApiError(422, 'INVALID_PACKAGING_STATE', 'packagingState must be one of sealed, opened, or loose.');
    case 'SERIAL_QUANTITY_MISMATCH':
      return new ApiError(422, 'SERIAL_QUANTITY_MISMATCH', 'Serial-tracked receipts must have quantity 1.');
    case 'LOOSE_PACKAGING_METADATA_FORBIDDEN':
      return new ApiError(422, 'LOOSE_PACKAGING_METADATA_FORBIDDEN', 'Loose stock cannot include packaging level or packCount.');
    case 'PACKAGING_LEVEL_INACTIVE':
      return new ApiError(422, 'PACKAGING_LEVEL_INACTIVE', 'The selected packaging level is inactive.');
    case 'PACKAGING_LEVEL_NOT_STORABLE':
      return new ApiError(422, 'PACKAGING_LEVEL_NOT_STORABLE', 'The selected packaging level cannot be stored.');
    case 'PACKAGING_LEVEL_PRODUCT_MISMATCH':
      return new ApiError(422, 'PACKAGING_LEVEL_PRODUCT_MISMATCH', 'The selected packaging level does not belong to this product.');
    case 'SEALED_PACK_COUNT_QUANTITY_MISMATCH':
      return new ApiError(422, 'SEALED_PACK_COUNT_QUANTITY_MISMATCH', 'Sealed stock quantity must equal packCount multiplied by the packaging level quantity.');
    case 'OPENED_PACK_COUNT_QUANTITY_EXCEEDED':
      return new ApiError(422, 'OPENED_PACK_COUNT_QUANTITY_EXCEEDED', 'Opened stock quantity cannot exceed the represented package capacity.');
    case 'LOCATION_RECEIVING_DISABLED':
      return new ApiError(422, 'LOCATION_RECEIVING_DISABLED', 'Receiving is disabled for the container location.');
    case 'LOCATION_MIXED_SKUS_FORBIDDEN':
      return new ApiError(422, 'LOCATION_MIXED_SKUS_FORBIDDEN', 'Mixed-SKU receiving is not allowed for the container location.');
    case 'SKU_LOCATION_MIN_QTY_VIOLATION':
      return new ApiError(422, 'SKU_LOCATION_MIN_QTY_VIOLATION', 'Received quantity is below the minimum configured for this SKU at the location.');
    case 'SKU_LOCATION_MAX_QTY_VIOLATION':
      return new ApiError(422, 'SKU_LOCATION_MAX_QTY_VIOLATION', 'Received quantity exceeds the maximum configured for this SKU at the location.');
    case 'PACKAGING_PROFILE_NOT_FOUND':
      return new ApiError(422, 'PACKAGING_PROFILE_NOT_FOUND', 'The resolved packaging profile was not found.');
    case 'PACKAGING_PROFILE_AMBIGUOUS':
      return new ApiError(422, 'PACKAGING_PROFILE_AMBIGUOUS', 'The effective packaging profile is ambiguous.');
    case 'PACKAGING_PROFILE_LEVEL_NOT_FOUND':
      return new ApiError(422, 'PACKAGING_PROFILE_LEVEL_NOT_FOUND', 'The resolved packaging profile level was not found.');
    case 'PACKAGING_LEVEL_AMBIGUOUS':
      return new ApiError(422, 'PACKAGING_LEVEL_AMBIGUOUS', 'The resolved packaging level is ambiguous.');
    case 'PACKAGING_LEVEL_PROJECTION_MISMATCH':
      return new ApiError(409, 'PACKAGING_LEVEL_PROJECTION_MISMATCH', 'The resolved packaging level cannot be projected safely into the legacy inventory compatibility row.');
    case 'RECEIPT_CORRELATION_CONFLICT':
      return new ApiError(409, 'RECEIPT_CORRELATION_CONFLICT', 'A receipt correlation conflict was detected for this receive request.');
    default:
      return null;
  }
}
