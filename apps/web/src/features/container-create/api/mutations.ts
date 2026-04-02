import { useMutation, useQueryClient } from '@tanstack/react-query';
import { containerKeys } from '@/entities/container/api/queries';
import { bffRequest } from '@/shared/api/bff/client';

export type CreateContainerInput = {
  externalCode?: string;
  containerTypeId: string;
  operationalRole?: 'storage' | 'pick';
};

export type CreateContainerResult = {
  containerId: string;
  systemCode: string;
  externalCode: string | null;
  containerTypeId: string;
  status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  operationalRole: 'storage' | 'pick';
};

export async function createContainer(input: CreateContainerInput) {
  return bffRequest<CreateContainerResult>('/api/containers', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

/** Mutation hook — creates a container and invalidates the container list cache. */
export function useCreateContainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createContainer,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: containerKeys.list() });
    }
  });
}
