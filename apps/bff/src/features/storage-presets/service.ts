import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateStoragePresetBody,
  PatchStoragePresetBody,
  StoragePreset,
  CreateContainerFromStoragePresetResult
} from '@wos/domain';
import { ApiError } from '../../errors.js';
import {
  createStoragePresetsRepo,
  type SkuLocationStoragePolicy,
  type StoragePresetsRepo
} from './repo.js';

export type StoragePresetsService = {
  listByProduct(tenantId: string, productId: string): Promise<StoragePreset[]>;
  create(tenantId: string, productId: string, input: CreateStoragePresetBody): Promise<StoragePreset>;
  patch(tenantId: string, productId: string, presetId: string, input: PatchStoragePresetBody): Promise<StoragePreset>;
  setPreferredPolicy(
    tenantId: string,
    locationId: string,
    productId: string,
    preferredPackagingProfileId: string | null
  ): Promise<SkuLocationStoragePolicy>;
  createContainerFromPreset(args: {
    presetId: string;
    locationId?: string;
    externalCode?: string;
    actorId: string;
  }): Promise<CreateContainerFromStoragePresetResult>;
};

function assertStoragePresetInput(input: CreateStoragePresetBody | PatchStoragePresetBody): void {
  if (input.levels !== undefined) {
    const containerTypes = new Set(
      input.levels
        .map((level) => level.containerType?.trim())
        .filter((value): value is string => Boolean(value))
    );
    if (containerTypes.size !== 1) {
      throw new ApiError(
        422,
        'STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED',
        'Storage preset must resolve exactly one container type.'
      );
    }
  }
}

export function createStoragePresetsServiceFromRepo(repo: StoragePresetsRepo): StoragePresetsService {
  return {
    listByProduct: (tenantId, productId) => repo.listByProduct(tenantId, productId),

    async create(tenantId, productId, input) {
      assertStoragePresetInput(input);
      return repo.create(tenantId, productId, input);
    },

    async patch(tenantId, productId, presetId, input) {
      assertStoragePresetInput(input);
      return repo.patch(tenantId, productId, presetId, input);
    },

    async setPreferredPolicy(tenantId, locationId, productId, preferredPackagingProfileId) {
      if (preferredPackagingProfileId !== null) {
        const exists = await repo.activeStoragePresetExists(tenantId, productId, preferredPackagingProfileId);
        if (!exists) {
          throw new ApiError(
            422,
            'PREFERRED_STORAGE_PRESET_INVALID',
            'Preferred preset must be an active storage preset for the same product.'
          );
        }
      }
      return repo.setPreferredPolicy(tenantId, locationId, productId, preferredPackagingProfileId);
    },

    createContainerFromPreset: (args) => repo.createContainerFromPreset(args)
  };
}

export function createStoragePresetsService(supabase: SupabaseClient): StoragePresetsService {
  return createStoragePresetsServiceFromRepo(createStoragePresetsRepo(supabase));
}
