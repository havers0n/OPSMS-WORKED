import type { DemandImportDataSheetPreview, DemandImportDataSheetCreateResponse, DemandPlanningDraftWithAssignments, DemandPlanningPutPlanRequest, DemandPlanningPublishToShiftRequest, DemandPlanningPublishToShiftResponse } from '@wos/domain';
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

async function publishDemandPlanningDraftToShift(
  draftId: string,
  body: DemandPlanningPublishToShiftRequest
): Promise<DemandPlanningPublishToShiftResponse> {
  return bffRequest<DemandPlanningPublishToShiftResponse>(
    `/api/demand-planning-drafts/${draftId}/publish-to-shift`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export function usePublishDemandPlanningDraftToShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ draftId, body }: { draftId: string; body: DemandPlanningPublishToShiftRequest }) =>
      publishDemandPlanningDraftToShift(draftId, body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['demand-import', 'draft', data.draftId] });
      queryClient.invalidateQueries({ queryKey: ['manual-shift', 'work-hierarchy', data.shiftId] });
      queryClient.invalidateQueries({ queryKey: ['manual-shift', 'lines', data.shiftId] });
      queryClient.invalidateQueries({ queryKey: ['manual-shift', 'orders', data.shiftId] });
    },
  });
}
