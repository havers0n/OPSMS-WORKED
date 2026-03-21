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
    default:
      return null;
  }
}
