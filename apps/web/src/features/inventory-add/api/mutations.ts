import type { InventoryItem } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';

export type AddInventoryItemInput = {
  containerId: string;
  productId: string;
  quantity: number;
  uom: string;
};

export async function addInventoryItem({
  containerId,
  ...body
}: AddInventoryItemInput) {
  return bffRequest<InventoryItem>(`/api/containers/${containerId}/inventory`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
