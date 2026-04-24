import type { CanonicalTransferInventoryResult, InventoryItem } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';

export type AddInventoryToContainerInput = {
  containerId: string;
  productId: string;
  quantity: number;
  uom: string;
  packagingState?: 'sealed' | 'opened' | 'loose';
  productPackagingLevelId?: string | null;
  packCount?: number | null;
};

export type AddInventoryToContainerResult = InventoryItem;

export async function addInventoryToContainer(input: AddInventoryToContainerInput) {
  const { containerId, ...body } = input;

  return bffRequest<AddInventoryToContainerResult>(`/api/containers/${containerId}/inventory`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export type TransferInventoryToContainerInput = {
  inventoryUnitId: string;
  targetContainerId: string;
  quantity: number;
};

export async function transferInventoryToContainer(input: TransferInventoryToContainerInput) {
  const { inventoryUnitId, targetContainerId, quantity } = input;

  return bffRequest<CanonicalTransferInventoryResult>(`/api/inventory/${inventoryUnitId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ targetContainerId, quantity })
  });
}
