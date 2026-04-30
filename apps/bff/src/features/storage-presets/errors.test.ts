import { describe, expect, it } from 'vitest';
import { ApiError } from '../../errors.js';
import { mapStoragePresetError } from './errors.js';

describe('mapStoragePresetError', () => {
  it('returns null for non-Error input', () => {
    expect(mapStoragePresetError('STORAGE_PRESET_NOT_FOUND')).toBeNull();
  });

  it('returns null for unknown Error input', () => {
    expect(mapStoragePresetError(new Error('SOMETHING_ELSE'))).toBeNull();
  });

  it('maps STORAGE_PRESET_NOT_FOUND to ApiError 404', () => {
    const result = mapStoragePresetError(new Error('STORAGE_PRESET_NOT_FOUND'));

    expect(result).toBeInstanceOf(ApiError);
    expect(result).toMatchObject({ statusCode: 404, code: 'STORAGE_PRESET_NOT_FOUND' });
  });

  it('maps STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED to ApiError 422', () => {
    const result = mapStoragePresetError(new Error('STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED'));

    expect(result).toBeInstanceOf(ApiError);
    expect(result).toMatchObject({ statusCode: 422, code: 'STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED' });
  });

  it('maps STORAGE_PRESET_CONTAINER_TYPE_INVALID to ApiError 422', () => {
    const result = mapStoragePresetError(new Error('STORAGE_PRESET_CONTAINER_TYPE_INVALID'));

    expect(result).toBeInstanceOf(ApiError);
    expect(result).toMatchObject({ statusCode: 422, code: 'STORAGE_PRESET_CONTAINER_TYPE_INVALID' });
  });

  it('maps STORAGE_PRESET_MATERIALIZATION_FAILED to ApiError 422', () => {
    const result = mapStoragePresetError(new Error('STORAGE_PRESET_MATERIALIZATION_FAILED'));

    expect(result).toBeInstanceOf(ApiError);
    expect(result).toMatchObject({ statusCode: 422, code: 'STORAGE_PRESET_MATERIALIZATION_FAILED' });
  });

  it('maps STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED to ApiError 422', () => {
    const result = mapStoragePresetError(new Error('STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED'));

    expect(result).toBeInstanceOf(ApiError);
    expect(result).toMatchObject({ statusCode: 422, code: 'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED' });
  });
});
