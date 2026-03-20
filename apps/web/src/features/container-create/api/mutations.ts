import { bffRequest } from '@/shared/api/bff/client';

export type CreateContainerInput = {
  externalCode: string;
  containerTypeId: string;
};

export type CreateContainerResult = {
  containerId: string;
  externalCode: string;
  containerTypeId: string;
  status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
};

export async function createContainer(input: CreateContainerInput) {
  return bffRequest<CreateContainerResult>('/api/containers', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
