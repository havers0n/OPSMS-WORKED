import type {
  RawDemandPlanningPreview,
  DemandPlanningDraftWithAssignments,
  DemandImportAppendDiffResponse
} from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const demandImportKeys = {
  all: ['demand-import'] as const,
  planningPreview: (batchId: string, scope: 'all' | 'remaining' = 'all') => [...demandImportKeys.all, 'planning-preview', batchId, scope] as const,
  draft: (draftId: string) => [...demandImportKeys.all, 'draft', draftId] as const,
  appendDiff: (batchId: string, shiftId: string) => [...demandImportKeys.all, 'append-diff', batchId, shiftId] as const
};

async function fetchDemandPlanningPreview(batchId: string, scope: 'all' | 'remaining'): Promise<RawDemandPlanningPreview> {
  const suffix = scope === 'remaining' ? '?scope=remaining' : '';
  return bffRequest<RawDemandPlanningPreview>(`/api/demand-imports/${batchId}/planning-preview${suffix}`);
}

export function demandPlanningPreviewQueryOptions(batchId: string, scope: 'all' | 'remaining' = 'all') {
  return queryOptions({
    queryKey: demandImportKeys.planningPreview(batchId, scope),
    queryFn: () => fetchDemandPlanningPreview(batchId, scope),
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

async function fetchDemandImportAppendDiff(
  batchId: string,
  shiftId: string
): Promise<DemandImportAppendDiffResponse> {
  return bffRequest<DemandImportAppendDiffResponse>(
    `/api/demand-imports/${batchId}/append-diff`,
    {
      method: 'POST',
      body: JSON.stringify({ shiftId })
    }
  );
}

export function demandImportAppendDiffQueryOptions(batchId: string, shiftId: string) {
  return queryOptions({
    queryKey: demandImportKeys.appendDiff(batchId, shiftId),
    queryFn: () => fetchDemandImportAppendDiff(batchId, shiftId),
    enabled: !!batchId && !!shiftId,
    staleTime: 60_000
  });
}
