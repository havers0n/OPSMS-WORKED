import { bffRequest } from '@/shared/api/bff/client';

export type AddInventoryToContainerInput = {
  containerId: string;
  sku: string;
  quantity: number;
  uom: string;
};

export type AddInventoryToContainerResult = {
  ok: true;
  containerId: string;
  sku: string;
  quantity: number;
  uom: string;
};

export async function addInventoryToContainer(input: AddInventoryToContainerInput) {
  const { containerId, ...body } = input;

  return bffRequest<AddInventoryToContainerResult>(`/api/containers/${containerId}/inventory`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
