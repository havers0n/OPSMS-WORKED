import { ApiError } from '../../errors.js';

export type OrdersErrorCode = string;

export type OrdersErrorShape = {
  code: OrdersErrorCode;
  message: string;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
};

export function orderNotFound(orderId: string): ApiError {
  return new ApiError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
}

export function waveNotFound(waveId: string): ApiError {
  return new ApiError(404, 'WAVE_NOT_FOUND', `Wave ${waveId} not found.`);
}

export function waveNotEditableForOrderCreate(): ApiError {
  return new ApiError(409, 'WAVE_NOT_EDITABLE', 'Orders can only be created inside draft or ready waves.');
}

export function orderNotEditableForAddLine(status: string): ApiError {
  return new ApiError(409, 'ORDER_NOT_EDITABLE', `Cannot add lines to an order in status '${status}'.`);
}

export function orderNotEditableForRemoveLine(status: string): ApiError {
  return new ApiError(409, 'ORDER_NOT_EDITABLE', `Cannot remove lines from an order in status '${status}'.`);
}

export function productNotFound(): ApiError {
  return new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
}

export function productInactive(): ApiError {
  return new ApiError(409, 'PRODUCT_INACTIVE', 'Inactive products cannot be added to orders.');
}

export function invalidOrderTransition(currentStatus: string, targetStatus: string): ApiError {
  return new ApiError(
    409,
    'INVALID_TRANSITION',
    `Cannot transition order from '${currentStatus}' to '${targetStatus}'.`
  );
}

export function orderHasNoLinesForReady(): ApiError {
  return new ApiError(409, 'ORDER_HAS_NO_LINES', 'Cannot mark an order as ready until it has at least one line.');
}

export function orderReleaseControlledByWave(): ApiError {
  return new ApiError(
    409,
    'ORDER_RELEASE_CONTROLLED_BY_WAVE',
    'This order belongs to a wave. Release is controlled by the wave.'
  );
}

export function mapReleaseOrderRpcError(error: SupabaseLikeError | null): Error | SupabaseLikeError | null {
  const message = error?.message ?? 'ORDER_RELEASE_FAILED';

  switch (message) {
    case 'ORDER_NOT_FOUND':
      return new ApiError(404, 'ORDER_NOT_FOUND', 'Order was not found.');
    case 'ORDER_NOT_READY':
      return new ApiError(409, 'INVALID_TRANSITION', 'Only ready orders can be released.');
    case 'ORDER_HAS_NO_LINES':
      return new ApiError(409, 'ORDER_HAS_NO_LINES', 'Cannot release an order with no lines.');
    case 'ORDER_ALREADY_RELEASED':
      return new ApiError(409, 'ORDER_ALREADY_RELEASED', 'Order has already been released.');
    default:
      return error;
  }
}
