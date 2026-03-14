import type { QueryClient } from '@tanstack/react-query';
import { cellKeys } from '@/entities/cell/api/queries';
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

  if (args.sourceCellId) {
    jobs.push(
      queryClient.invalidateQueries({
        queryKey: cellKeys.storage(args.sourceCellId)
      })
    );
  }

  jobs.push(
    queryClient.invalidateQueries({
      queryKey: [...cellKeys.all, 'slot-storage']
    })
  );

  if (args.floorId) {
    jobs.push(
      queryClient.invalidateQueries({
        queryKey: cellKeys.occupancyByFloor(args.floorId)
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
