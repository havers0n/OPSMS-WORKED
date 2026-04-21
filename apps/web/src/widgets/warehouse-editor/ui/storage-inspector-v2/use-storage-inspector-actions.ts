import { useQueryClient } from '@tanstack/react-query';
import { useAddInventoryToContainer } from '@/features/container-inventory/model/use-add-inventory-to-container';
import {
  useCreateProductLocationRole,
  useDeleteProductLocationRole
} from '@/entities/product-location-role/api/mutations';
import { createContainerIntents } from './use-storage-inspector-actions.container-intents';
import { createRoleIntents } from './use-storage-inspector-actions.role-intents';

export interface UseStorageInspectorActionsParams {
  floorId: string | null;
  locationId: string | null;
  addProductSourceCellId: string | null;
  addProductContainerId: string | null;
}

export function useStorageInspectorActions({
  floorId,
  locationId,
  addProductSourceCellId,
  addProductContainerId
}: UseStorageInspectorActionsParams) {
  const queryClient = useQueryClient();
  const createProductLocationRole = useCreateProductLocationRole();
  const deleteProductLocationRole = useDeleteProductLocationRole(locationId);
  const addInventoryToContainer = useAddInventoryToContainer({
    floorId,
    sourceCellId: addProductSourceCellId,
    containerId: addProductContainerId
  });

  const containerIntents = createContainerIntents({
    queryClient,
    floorId,
    locationId,
    addInventoryToContainerMutateAsync: addInventoryToContainer.mutateAsync
  });

  const roleIntents = createRoleIntents({
    queryClient,
    createProductLocationRoleMutateAsync: createProductLocationRole.mutateAsync,
    deleteProductLocationRoleMutateAsync: deleteProductLocationRole.mutateAsync
  });

  return {
    addInventoryToContainer,
    ...containerIntents,
    ...roleIntents
  };
}

export type StorageInspectorActions = ReturnType<typeof useStorageInspectorActions>;
