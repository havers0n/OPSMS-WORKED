import { ApiError } from '../../errors.js';

export function mapStoragePresetError(error: unknown): ApiError | null {
  if (!(error instanceof Error)) return null;

  if (error.message.includes('STORAGE_PRESET_NOT_FOUND')) {
    return new ApiError(404, 'STORAGE_PRESET_NOT_FOUND', 'Storage preset was not found.');
  }

  if (error.message.includes('STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED')) {
    return new ApiError(422, 'STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED', 'Storage preset must resolve exactly one container type.');
  }

  if (error.message.includes('STORAGE_PRESET_CONTAINER_TYPE_INVALID')) {
    return new ApiError(422, 'STORAGE_PRESET_CONTAINER_TYPE_INVALID', 'Storage preset does not resolve a valid storage container type.');
  }

  if (error.message.includes('STORAGE_PRESET_MATERIALIZATION_FAILED')) {
    return new ApiError(
      422,
      'STORAGE_PRESET_MATERIALIZATION_FAILED',
      'Container was created/placed, but preset contents materialization failed.'
    );
  }

  if (error.message.includes('STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED')) {
    return new ApiError(
      422,
      'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED',
      'Storage preset must have exactly one materializable level for this phase.'
    );
  }

  return null;
}
