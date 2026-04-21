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
    default:
      return null;
  }
}
