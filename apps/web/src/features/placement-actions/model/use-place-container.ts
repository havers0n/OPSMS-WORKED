import { useMutation, useQueryClient } from '@tanstack/react-query';
import { placeContainer as placeContainerMutation } from '../api/mutations';
import { invalidatePlacementQueries } from './invalidation';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function usePlaceContainer(args: {
  floorId: string | null;
  locationId: string | null;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: placeContainerMutation,
    onSuccess: async (_result, variables) => {
      await invalidatePlacementQueries(queryClient, {
        floorId: args.floorId,
        containerId: isUuid(variables.containerId) ? variables.containerId : null
      });
    }
  });
}
