import type { RawDemandPlanningPreview, DemandPlanningDraftWithAssignments } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const demandImportKeys = {
  all: ['demand-import'] as const,
  planningPreview: (batchId: string) => [...demandImportKeys.all, 'planning-preview', batchId] as const,
  draft: (draftId: string) => [...demandImportKeys.all, 'draft', draftId] as const
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

async function fetchDemandPlanningDraft(draftId: string): Promise<DemandPlanningDraftWithAssignments> {
  return bffRequest<DemandPlanningDraftWithAssignments>(`/api/demand-planning-drafts/${draftId}`);
}

export function demandPlanningDraftQueryOptions(draftId: string) {
  return queryOptions({
    queryKey: demandImportKeys.draft(draftId),
    queryFn: () => fetchDemandPlanningDraft(draftId),
    enabled: !!draftId,
    staleTime: 30_000
  });
}
