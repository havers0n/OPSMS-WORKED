import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { productLocationRoleKeys, type LocationProductAssignment } from './queries';

export type CreateProductLocationRoleInput = {
  locationId: string;
  productId: string;
  role: 'primary_pick' | 'reserve';
};

async function createProductLocationRole(
  input: CreateProductLocationRoleInput
): Promise<LocationProductAssignment> {
  return bffRequest<LocationProductAssignment>('/api/product-location-roles', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

async function deleteProductLocationRole(roleId: string): Promise<void> {
  await bffRequest<void>(`/api/product-location-roles/${roleId}`, {
    method: 'DELETE'
  });
}

export function useCreateProductLocationRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProductLocationRole,
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: productLocationRoleKeys.byLocation(variables.locationId)
      });
    }
  });
}

export function useDeleteProductLocationRole(locationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProductLocationRole,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: productLocationRoleKeys.byLocation(locationId)
      });
    }
  });
}
