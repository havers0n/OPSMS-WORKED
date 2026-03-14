import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeContainer as removeContainerMutation } from '../api/mutations';
import { invalidatePlacementQueries } from './invalidation';

export function useRemoveContainer(args: {
  floorId: string | null;
  sourceCellId: string | null;
  containerId: string | null;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeContainerMutation,
    onSuccess: async () => {
      await invalidatePlacementQueries(queryClient, {
        floorId: args.floorId,
        sourceCellId: args.sourceCellId,
        containerId: args.containerId
      });
    }
  });
}
