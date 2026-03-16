import type { InventoryItem } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';

export type AddInventoryToContainerInput = {
  containerId: string;
  productId: string;
  quantity: number;
  uom: string;
};

export type AddInventoryToContainerResult = InventoryItem;

export async function addInventoryToContainer(input: AddInventoryToContainerInput) {
  const { containerId, ...body } = input;

  return bffRequest<AddInventoryToContainerResult>(`/api/containers/${containerId}/inventory`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
