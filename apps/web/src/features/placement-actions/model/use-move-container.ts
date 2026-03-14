import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moveContainer as moveContainerMutation } from '../api/mutations';
import { invalidatePlacementQueries } from './invalidation';

export function useMoveContainer(args: {
  floorId: string | null;
  sourceCellId: string | null;
  targetCellId: string | null;
  containerId: string | null;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: moveContainerMutation,
    onSuccess: async () => {
      await invalidatePlacementQueries(queryClient, {
        floorId: args.floorId,
        sourceCellId: args.sourceCellId,
        targetCellId: args.targetCellId,
        containerId: args.containerId
      });
    }
  });
}
