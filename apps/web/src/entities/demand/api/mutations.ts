import type { DemandImportDataSheetPreview, DemandImportDataSheetCreateResponse, DemandPlanningDraftWithAssignments, DemandPlanningPutPlanRequest } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

type DemandImportDataSheetPreviewResponse = {
  preview: DemandImportDataSheetPreview;
};

async function previewDataSheetDemandImport(file: File): Promise<DemandImportDataSheetPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return bffRequest<DemandImportDataSheetPreviewResponse>('/api/demand-imports/datasheet/preview', {
    method: 'POST',
    body: formData
  });
}

async function createDataSheetDemandImport(file: File): Promise<DemandImportDataSheetCreateResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return bffRequest<DemandImportDataSheetCreateResponse>('/api/demand-imports/datasheet', {
    method: 'POST',
    body: formData
  });
}

async function createDemandPlanningDraft(batchId: string): Promise<DemandPlanningDraftWithAssignments> {
  return bffRequest<DemandPlanningDraftWithAssignments>(`/api/demand-imports/${batchId}/planning-drafts`, {
    method: 'POST'
  });
}

export function usePreviewDataSheetDemandImport() {
  return useMutation({
    mutationFn: previewDataSheetDemandImport
  });
}

export function useCreateDataSheetDemandImport() {
  return useMutation({
    mutationFn: createDataSheetDemandImport
  });
}

export function useCreateDemandPlanningDraft() {
  return useMutation({
    mutationFn: createDemandPlanningDraft
  });
}

async function putDemandPlanningPlan(
  draftId: string,
  body: DemandPlanningPutPlanRequest
): Promise<DemandPlanningDraftWithAssignments> {
  return bffRequest<DemandPlanningDraftWithAssignments>(
    `/api/demand-planning-drafts/${draftId}/plan`,
    { method: 'PUT', body: JSON.stringify(body) }
  );
}

export function usePutDemandPlanningPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ draftId, body }: { draftId: string; body: DemandPlanningPutPlanRequest }) =>
      putDemandPlanningPlan(draftId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['demand-import', 'draft', variables.draftId] });
    },
  });
}
