import type { QueryClient } from '@tanstack/react-query';
import { locationKeys } from '@/entities/location/api/queries';
import { containerKeys } from '@/entities/container/api/queries';
import { layoutVersionKeys } from '@/entities/layout-version/api/queries';

export async function invalidatePlacementQueries(
  queryClient: QueryClient,
  args: {
    floorId: string | null;
    sourceCellId?: string | null;
    targetCellId?: string | null;
    containerId?: string | null;
  }
) {
  const jobs: Array<Promise<unknown>> = [];

  // Invalidate all location storage queries — we can't map cellId -> locationId here,
  // so we use a broad prefix invalidation to cover the affected cells.
  jobs.push(
    queryClient.invalidateQueries({
      queryKey: [...locationKeys.all, 'storage']
    })
  );

  if (args.containerId) {
    jobs.push(
      queryClient.invalidateQueries({
        queryKey: containerKeys.storage(args.containerId)
      })
    );
  }

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
