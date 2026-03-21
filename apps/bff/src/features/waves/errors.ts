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
