import { ApiError } from '../../errors.js';

export type WavesErrorCode = string;

export type WavesErrorShape = {
  code: WavesErrorCode;
  message: string;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
};

export function waveNotFound(waveId: string): ApiError {
  return new ApiError(404, 'WAVE_NOT_FOUND', `Wave ${waveId} not found.`);
}

export function invalidWaveTransition(currentStatus: string, targetStatus: string): ApiError {
  return new ApiError(
    409,
    'INVALID_WAVE_TRANSITION',
    `Cannot transition wave from '${currentStatus}' to '${targetStatus}'.`
  );
}

export function waveHasNoOrdersForReady(): ApiError {
  return new ApiError(409, 'WAVE_HAS_NO_ORDERS', 'Cannot mark an empty wave as ready.');
}

export function waveHasNoOrdersForRelease(): ApiError {
  return new ApiError(409, 'WAVE_HAS_NO_ORDERS', 'Cannot release an empty wave.');
}

export function waveHasBlockingOrders(): ApiError {
  return new ApiError(409, 'WAVE_HAS_BLOCKING_ORDERS', 'All attached orders must be ready before wave release.');
}

export function mapReleaseWaveRpcError(error: SupabaseLikeError | null): Error | SupabaseLikeError | null {
  const message = error?.message ?? 'WAVE_RELEASE_FAILED';

  switch (message) {
    case 'WAVE_NOT_FOUND':
      return new ApiError(404, 'WAVE_NOT_FOUND', 'Wave was not found.');
    case 'WAVE_NOT_READY':
      return new ApiError(409, 'INVALID_WAVE_TRANSITION', 'Only ready waves can be released.');
    case 'WAVE_HAS_NO_ORDERS':
      return new ApiError(409, 'WAVE_HAS_NO_ORDERS', 'Cannot release an empty wave.');
    case 'WAVE_HAS_BLOCKING_ORDERS':
      return new ApiError(409, 'WAVE_HAS_BLOCKING_ORDERS', 'All attached orders must be ready before wave release.');
    default:
      return error;
  }
}

export function mapWaveMembershipRpcError(
  error: SupabaseLikeError | null,
  input: { waveId: string; orderId: string }
): Error | SupabaseLikeError | null {
  const message = error?.message ?? 'WAVE_MEMBERSHIP_UPDATE_FAILED';

  switch (message) {
    case 'WAVE_NOT_FOUND':
      return new ApiError(404, 'WAVE_NOT_FOUND', `Wave ${input.waveId} not found.`);
    case 'ORDER_NOT_FOUND':
      return new ApiError(404, 'ORDER_NOT_FOUND', `Order ${input.orderId} not found.`);
    case 'WAVE_MEMBERSHIP_LOCKED':
      return new ApiError(409, 'WAVE_MEMBERSHIP_LOCKED', 'Released waves have immutable membership.');
    case 'ORDER_ALREADY_IN_WAVE':
      return new ApiError(409, 'ORDER_ALREADY_IN_WAVE', 'Order is already attached to this wave.');
    case 'ORDER_NOT_IN_WAVE':
      return new ApiError(409, 'ORDER_NOT_IN_WAVE', 'Order is not attached to this wave.');
    case 'ORDER_NOT_ATTACHABLE':
      return new ApiError(409, 'ORDER_NOT_ATTACHABLE', 'Only draft or ready orders can be attached to a wave.');
    case 'ORDER_NOT_DETACHABLE':
      return new ApiError(409, 'ORDER_NOT_DETACHABLE', 'Only draft or ready orders can be detached from a wave.');
    default:
      return error;
  }
}
