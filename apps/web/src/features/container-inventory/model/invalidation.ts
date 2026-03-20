import type { QueryClient } from '@tanstack/react-query';
import { locationKeys } from '@/entities/location/api/queries';
import { containerKeys } from '@/entities/container/api/queries';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';

export async function invalidateContainerInventoryQueries(
  queryClient: QueryClient,
  args: {
    floorId: string | null;
    sourceCellId: string | null;
    containerId: string | null;
  }
) {
  const jobs: Array<Promise<unknown>> = [];

  if (args.containerId) {
    jobs.push(
      queryClient.invalidateQueries({
        queryKey: containerKeys.storage(args.containerId)
      })
    );
  }

  // Invalidate all location storage queries (cellId -> locationId mapping not available here).
  jobs.push(
    queryClient.invalidateQueries({
      queryKey: [...locationKeys.all, 'storage']
    })
  );

  if (args.floorId) {
    jobs.push(
      queryClient.invalidateQueries({
        queryKey: locationKeys.occupancyByFloor(args.floorId)
      })
    );
    jobs.push(
      queryClient.invalidateQueries({
        queryKey: layoutVersionKeys.workspace(args.floorId)
      })
    );
  }

  await Promise.all(jobs);
}
