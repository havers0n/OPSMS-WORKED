import type { RawDemandPlanningPreview } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const demandImportKeys = {
  all: ['demand-import'] as const,
  planningPreview: (batchId: string) => [...demandImportKeys.all, 'planning-preview', batchId] as const
};

async function fetchDemandPlanningPreview(batchId: string): Promise<RawDemandPlanningPreview> {
  return bffRequest<RawDemandPlanningPreview>(`/api/demand-imports/${batchId}/planning-preview`);
}

export function demandPlanningPreviewQueryOptions(batchId: string) {
  return queryOptions({
    queryKey: demandImportKeys.planningPreview(batchId),
    queryFn: () => fetchDemandPlanningPreview(batchId),
    enabled: !!batchId,
    staleTime: 30_000
  });
}
