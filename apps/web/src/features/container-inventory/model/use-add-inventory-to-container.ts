import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { addInventoryToContainer as addInventoryToContainerMutation, type AddInventoryToContainerInput } from '../api/mutations';
import { invalidateContainerInventoryQueries } from './invalidation';
import { createUuid } from '@/shared/lib/create-uuid';

export type AddInventoryToContainerMutationInput = Omit<AddInventoryToContainerInput, 'receiptCorrelationKey'>;

export function useAddInventoryToContainer(args: {
  floorId: string | null;
  sourceCellId: string | null;
  containerId: string | null;
}) {
  const queryClient = useQueryClient();
  const correlationKeyRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: (params: AddInventoryToContainerMutationInput) => {
      if (!correlationKeyRef.current) {
        correlationKeyRef.current = createUuid();
      }
      return addInventoryToContainerMutation({
        ...params,
        receiptCorrelationKey: correlationKeyRef.current
      });
    },
    onSuccess: async () => {
      correlationKeyRef.current = null;
      await invalidateContainerInventoryQueries(queryClient, {
        floorId: args.floorId,
        sourceCellId: args.sourceCellId,
        containerId: args.containerId
      });
    }
  });
}
