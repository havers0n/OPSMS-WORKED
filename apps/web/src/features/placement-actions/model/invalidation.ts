import type { QueryClient } from '@tanstack/react-query';
import { cellKeys } from '@/entities/cell/api/queries';
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
  const cellIds = new Set(
    [args.sourceCellId, args.targetCellId].filter(
      (cellId): cellId is string => typeof cellId === 'string' && cellId.length > 0
    )
  );

  for (const cellId of cellIds) {
    jobs.push(
      queryClient.invalidateQueries({
        queryKey: cellKeys.storage(cellId)
      })
    );
  }

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
        queryKey: layoutVersionKeys.workspace(args.floorId)
      })
    );
  }

  await Promise.all(jobs);
}
