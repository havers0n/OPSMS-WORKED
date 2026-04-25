import { describe, expect, it, vi } from 'vitest';
import { createStoragePresetsServiceFromRepo, type StoragePresetsService } from './service.js';
import type { StoragePresetsRepo } from './repo.js';

function createRepo(overrides: Partial<StoragePresetsRepo> = {}): StoragePresetsRepo {
  return {
    listByProduct: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as never),
    patch: vi.fn(async () => ({}) as never),
    setPreferredPolicy: vi.fn(async () => ({}) as never),
    activeStoragePresetExists: vi.fn(async () => true),
    createContainerFromPreset: vi.fn(async () => ({}) as never),
    ...overrides
  };
}

describe('storage presets service', () => {
  it('rejects preset definitions that do not resolve exactly one container type', async () => {
    const service: StoragePresetsService = createStoragePresetsServiceFromRepo(createRepo());

    await expect(
      service.create('tenant-a', 'product-a', {
        code: 'BAD',
        name: 'Bad preset',
        scopeType: 'tenant',
        isDefault: false,
        priority: 0,
        status: 'active',
        levels: [
          { levelType: 'CTN', qtyEach: 8, containerType: 'pallet' },
          { levelType: 'BIN', qtyEach: 1, containerType: 'bin' }
        ]
      })
    ).rejects.toMatchObject({ code: 'STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED' });
  });

  it('validates preferred preset is active storage for same product before upsert', async () => {
    const repo = createRepo({
      activeStoragePresetExists: vi.fn(async () => false)
    });
    const service = createStoragePresetsServiceFromRepo(repo);

    await expect(
      service.setPreferredPolicy('tenant-a', 'location-a', 'product-a', 'preset-a')
    ).rejects.toMatchObject({ code: 'PREFERRED_STORAGE_PRESET_INVALID' });
  });
});
