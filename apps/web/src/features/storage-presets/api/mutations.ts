import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { containerKeys } from '@/entities/container/api/queries';
import { locationKeys } from '@/entities/location/api/queries';
import { productKeys } from '@/entities/product/api/queries';

export type CreateContainerFromStoragePresetInput = {
  presetId: string;
  locationId?: string;
  externalCode?: string;
  materializeContents?: boolean;
};

export type CreateContainerFromStoragePresetResult = {
  containerId: string;
  systemCode: string;
  externalCode: string | null;
  containerTypeId: string;
  packagingProfileId: string;
  isStandardPack: true;
  placedLocationId: string | null;
  materializationMode: 'shell' | 'materialized';
  materializedInventoryUnitId: string | null;
  materializedContainerLineId: string | null;
  materializedQuantity: number | null;
};

export type SetPreferredStoragePresetInput = {
  locationId: string;
  productId: string;
  preferredPackagingProfileId: string | null;
};

export async function createContainerFromStoragePreset(
  input: CreateContainerFromStoragePresetInput
) {
  return bffRequest<CreateContainerFromStoragePresetResult>(
    `/api/storage-presets/${input.presetId}/create-container`,
    {
      method: 'POST',
      body: JSON.stringify({
        locationId: input.locationId,
        externalCode: input.externalCode,
        materializeContents: input.materializeContents ?? false
      })
    }
  );
}

export async function setPreferredStoragePreset(input: SetPreferredStoragePresetInput) {
  return bffRequest(`/api/locations/${input.locationId}/sku-policies/${input.productId}/storage-preset`, {
    method: 'PUT',
    body: JSON.stringify({
      preferredPackagingProfileId: input.preferredPackagingProfileId
    })
  });
}

export function useCreateContainerFromStoragePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createContainerFromStoragePreset,
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: containerKeys.list() });
      if (variables.locationId) {
        void queryClient.invalidateQueries({ queryKey: locationKeys.storage(variables.locationId) });
      }
    }
  });
}

export function useSetPreferredStoragePreset(productId: string | null, locationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setPreferredStoragePreset,
    onSuccess: () => {
      if (productId) {
        void queryClient.invalidateQueries({ queryKey: productKeys.storagePresets(productId) });
      }
      if (locationId) {
        void queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      }
    }
  });
}
