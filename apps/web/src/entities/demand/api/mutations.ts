import type { DemandImportDataSheetPreview, DemandImportDataSheetCreateResponse, DemandPlanningDraftWithAssignments } from '@wos/domain';
import { useMutation } from '@tanstack/react-query';
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
