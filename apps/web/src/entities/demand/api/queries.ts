import type {
  RawDemandPlanningPreview,
  DemandPlanningDraftWithAssignments,
  DemandImportAppendDiffResponse,
  DemandBacklogOrderListResponse,
  DemandBacklogOrderQuery,
  DemandExplorerQuery,
  DemandExplorerResponse,
  DemandExplorerItemsResponse
} from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const demandImportKeys = {
  all: ['demand-import'] as const,
  planningPreview: (batchId: string, scope: 'all' | 'remaining' = 'all') => [...demandImportKeys.all, 'planning-preview', batchId, scope] as const,
  draft: (draftId: string) => [...demandImportKeys.all, 'draft', draftId] as const,
  appendDiff: (batchId: string, shiftId: string) => [...demandImportKeys.all, 'append-diff', batchId, shiftId] as const
};

export const demandBacklogKeys = {
  all: ['demand-backlog'] as const,
  orders: (filters: DemandBacklogOrderQuery) => [...demandBacklogKeys.all, 'orders', {
    dateFrom: filters.dateFrom, dateTo: filters.dateTo, status: filters.status, q: filters.q,
    sku: filters.sku, customer: filters.customer, distributionArea: filters.distributionArea,
    distributionLine: filters.distributionLine, sourceBatchId: filters.sourceBatchId,
    page: filters.page, limit: filters.limit
  }] as const
};

async function fetchDemandBacklogOrders(filters: DemandBacklogOrderQuery): Promise<DemandBacklogOrderListResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return bffRequest<DemandBacklogOrderListResponse>(`/api/demand-planning/backlog-orders?${params.toString()}`);
}

export function demandBacklogOrdersQueryOptions(filters: DemandBacklogOrderQuery) {
  return queryOptions({
    queryKey: demandBacklogKeys.orders(filters),
    queryFn: () => fetchDemandBacklogOrders(filters),
    staleTime: 30_000
  });
}

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

interface DemandImportAvailableBatch {
  id: string;
  sourceFile: string;
  sourceSheet: string;
  totalRows: number;
  remainingRows: number;
  totalQuantity: number;
  remainingQuantity: number;
  canPlan: boolean;
  status: string;
}

interface DemandImportAvailableBatchesResponse {
  batches: DemandImportAvailableBatch[];
}

async function fetchDemandImportAvailableBatches(): Promise<DemandImportAvailableBatchesResponse> {
  return bffRequest<DemandImportAvailableBatchesResponse>('/api/demand-imports/available-for-planning');
}

export const demandImportAvailableBatchesQueryKey = [...demandImportKeys.all, 'available-batches'] as const;

export function demandImportAvailableBatchesQueryOptions() {
  return queryOptions({
    queryKey: demandImportAvailableBatchesQueryKey,
    queryFn: fetchDemandImportAvailableBatches,
    staleTime: 30_000
  });
}

// ── Demand Explorer (PR-1) ──────────────────────────────────────────────────

export const demandExplorerKeys = {
  all: ['demand-explorer'] as const,
  list: (draftId: string, filters: DemandExplorerQuery) => [...demandExplorerKeys.all, 'list', draftId, {
    distributionArea: filters.distributionArea,
    search: filters.search,
    status: filters.status,
    page: filters.page,
    limit: filters.limit
  }] as const,
  orderItems: (draftId: string, orderId: string) => [...demandExplorerKeys.all, 'order-items', draftId, orderId] as const
};

async function fetchDemandExplorer(draftId: string, filters: DemandExplorerQuery): Promise<DemandExplorerResponse> {
  const params = new URLSearchParams();
  if (filters.distributionArea) params.set('distributionArea', filters.distributionArea);
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 20));
  return bffRequest<DemandExplorerResponse>(
    `/api/demand-planning-drafts/${draftId}/demand-explorer?${params.toString()}`
  );
}

export function demandExplorerQueryOptions(draftId: string, filters: DemandExplorerQuery) {
  return queryOptions({
    queryKey: demandExplorerKeys.list(draftId, filters),
    queryFn: () => fetchDemandExplorer(draftId, filters),
    enabled: !!draftId,
    staleTime: 30_000
  });
}

async function fetchDemandExplorerOrderItems(draftId: string, orderId: string): Promise<DemandExplorerItemsResponse> {
  return bffRequest<DemandExplorerItemsResponse>(
    `/api/demand-planning-drafts/${draftId}/demand-explorer/orders/${orderId}/items`
  );
}

export function demandExplorerOrderItemsQueryOptions(draftId: string, orderId: string) {
  return queryOptions({
    queryKey: demandExplorerKeys.orderItems(draftId, orderId),
    queryFn: () => fetchDemandExplorerOrderItems(draftId, orderId),
    enabled: !!draftId && !!orderId,
    staleTime: 30_000
  });
}
