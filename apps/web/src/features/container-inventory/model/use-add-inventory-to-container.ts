import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addInventoryToContainer as addInventoryToContainerMutation } from '../api/mutations';
import { invalidateContainerInventoryQueries } from './invalidation';

export function useAddInventoryToContainer(args: {
  floorId: string | null;
  sourceCellId: string | null;
  containerId: string | null;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addInventoryToContainerMutation,
    onSuccess: async () => {
      await invalidateContainerInventoryQueries(queryClient, {
        floorId: args.floorId,
        sourceCellId: args.sourceCellId,
        containerId: args.containerId
      });
    }
  });
}
