import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { addInventoryItem, type AddInventoryItemInput } from '../api/mutations';
import { invalidatePlacementQueries } from '@/features/placement-actions/model/invalidation';

export type AddInventoryItemMutationInput = Omit<AddInventoryItemInput, 'receiptCorrelationKey'>;

export function useAddInventoryItem(args: {
  floorId: string | null;
  sourceCellId: string | null;
  containerId: string | null;
}) {
  const queryClient = useQueryClient();
  const correlationKeyRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: (params: AddInventoryItemMutationInput) => {
      if (!correlationKeyRef.current) {
        correlationKeyRef.current = crypto.randomUUID();
      }
      return addInventoryItem({
        ...params,
        receiptCorrelationKey: correlationKeyRef.current
      });
    },
    onSuccess: async (_result, variables) => {
      correlationKeyRef.current = null;
      await invalidatePlacementQueries(queryClient, {
        floorId: args.floorId,
        sourceCellId: args.sourceCellId,
        containerId: args.containerId ?? variables.containerId
      });
    }
  });
}
