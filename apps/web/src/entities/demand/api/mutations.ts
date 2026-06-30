import type { DemandImportDataSheetPreview, DemandImportDataSheetCreateResponse, DemandPlanningDraftWithAssignments, DemandPlanningPutPlanRequest, DemandPlanningPublishToShiftRequest, DemandPlanningPublishToShiftResponse, DemandPlanningRevertPublicationResponse } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { demandImportAvailableBatchesQueryKey } from './queries';

const manualShiftAll = ['manual-shift'] as const;
const msk = {
  all: manualShiftAll,
  today: () => [...manualShiftAll, 'today'] as const,
  byDate: (date: string) => [...manualShiftAll, 'by-date', date] as const,
  byId: (shiftId: string) => [...manualShiftAll, 'by-id', shiftId] as const,
  lines: (shiftId: string) => [...manualShiftAll, 'lines', shiftId] as const,
  shiftOrders: (shiftId: string) => [...manualShiftAll, 'shift-orders', shiftId] as const,
  workHierarchy: (shiftId: string) => [...manualShiftAll, 'work-hierarchy', shiftId] as const,
  daySummary: (shiftId: string) => [...manualShiftAll, 'day-summary', shiftId] as const,
};

type DemandImportDataSheetPreviewResponse = {
  preview: DemandImportDataSheetPreview;
};

async function previewDataSheetDemandImport(file: File, targetShiftId?: string | null): Promise<DemandImportDataSheetPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (targetShiftId) formData.append('targetShiftId', targetShiftId);
  return bffRequest<DemandImportDataSheetPreviewResponse>('/api/demand-imports/datasheet/preview', {
    method: 'POST',
    body: formData
  });
}

async function createDataSheetDemandImport(file: File, targetShiftId?: string | null): Promise<DemandImportDataSheetCreateResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (targetShiftId) formData.append('targetShiftId', targetShiftId);
  return bffRequest<DemandImportDataSheetCreateResponse>('/api/demand-imports/datasheet', {
    method: 'POST',
    body: formData
  });
}

type CreateDemandPlanningDraftInput = string | { batchId: string; scope: 'all' | 'remaining' };

async function createDemandPlanningDraft(input: CreateDemandPlanningDraftInput): Promise<DemandPlanningDraftWithAssignments> {
  const batchId = typeof input === 'string' ? input : input.batchId;
  const scope = typeof input === 'string' ? 'all' : input.scope;
  return bffRequest<DemandPlanningDraftWithAssignments>(`/api/demand-imports/${batchId}/planning-drafts`, {
    method: 'POST',
    body: JSON.stringify({ scope })
  });
}

type DataSheetImportInput = { file: File; targetShiftId?: string | null };

export function usePreviewDataSheetDemandImport() {
  return useMutation({
    mutationFn: ({ file, targetShiftId }: DataSheetImportInput) => previewDataSheetDemandImport(file, targetShiftId)
  });
}

export function useCreateDataSheetDemandImport() {
  return useMutation({
    mutationFn: ({ file, targetShiftId }: DataSheetImportInput) => createDataSheetDemandImport(file, targetShiftId)
  });
}

export function useCreateDemandPlanningDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDemandPlanningDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: demandImportAvailableBatchesQueryKey });
    }
  });
}

const rollingDraftRequests = new Map<string, Promise<DemandPlanningDraftWithAssignments>>();

async function createRollingDemandPlanningDraft(targetShiftId: string): Promise<DemandPlanningDraftWithAssignments> {
  const existing = rollingDraftRequests.get(targetShiftId);
  if (existing) return existing;

  const request = bffRequest<DemandPlanningDraftWithAssignments>('/api/demand-planning/rolling-drafts', {
    method: 'POST',
    body: JSON.stringify({ targetShiftId })
  }).finally(() => {
    rollingDraftRequests.delete(targetShiftId);
  });
  rollingDraftRequests.set(targetShiftId, request);
  return request;
}

export function useCreateRollingDemandPlanningDraft() {
  return useMutation({ mutationFn: createRollingDemandPlanningDraft });
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
      queryClient.invalidateQueries({ queryKey: ['demand-import', 'planning-preview'] });
      queryClient.invalidateQueries({ queryKey: demandImportAvailableBatchesQueryKey });
      queryClient.invalidateQueries({ queryKey: msk.workHierarchy(data.shiftId) });
      queryClient.invalidateQueries({ queryKey: msk.lines(data.shiftId) });
      queryClient.invalidateQueries({ queryKey: msk.shiftOrders(data.shiftId) });
      queryClient.invalidateQueries({ queryKey: msk.byId(data.shiftId) });
      queryClient.invalidateQueries({ queryKey: msk.today() });
      queryClient.invalidateQueries({ queryKey: msk.daySummary(data.shiftId) });
    },
  });
}

async function revertDemandPlanningPublication(publicationId: string): Promise<DemandPlanningRevertPublicationResponse> {
  return bffRequest<DemandPlanningRevertPublicationResponse>(
    `/api/demand-planning-publications/${publicationId}/revert`,
    { method: 'POST' }
  );
}

export function useRevertDemandPlanningPublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revertDemandPlanningPublication,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['demand-import', 'draft', data.draftId] });
      queryClient.invalidateQueries({ queryKey: ['demand-import', 'planning-preview'] });
      queryClient.invalidateQueries({ queryKey: demandImportAvailableBatchesQueryKey });
      queryClient.invalidateQueries({ queryKey: msk.workHierarchy(data.shiftId) });
      queryClient.invalidateQueries({ queryKey: msk.lines(data.shiftId) });
      queryClient.invalidateQueries({ queryKey: msk.shiftOrders(data.shiftId) });
      queryClient.invalidateQueries({ queryKey: msk.byId(data.shiftId) });
      queryClient.invalidateQueries({ queryKey: msk.today() });
      queryClient.invalidateQueries({ queryKey: msk.daySummary(data.shiftId) });
    },
  });
}
