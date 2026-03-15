import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addInventoryItem } from '../api/mutations';
import { invalidatePlacementQueries } from '@/features/placement-actions/model/invalidation';

export function useAddInventoryItem(args: {
  floorId: string | null;
  sourceCellId: string | null;
  containerId: string | null;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addInventoryItem,
    onSuccess: async (_result, variables) => {
      await invalidatePlacementQueries(queryClient, {
        floorId: args.floorId,
        sourceCellId: args.sourceCellId,
        containerId: args.containerId ?? variables.containerId
      });
    }
  });
}
