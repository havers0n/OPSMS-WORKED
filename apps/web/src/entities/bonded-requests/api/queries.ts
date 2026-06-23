import type {
  BondedCoverageRequest,
  BondedCoverageRequestDetail,
  BondedCoverageRequestStatus,
} from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const bondedRequestsKeys = {
  all: ['bonded-requests'] as const,
  list: (shiftId: string, status?: BondedCoverageRequestStatus) =>
    [...bondedRequestsKeys.all, 'list', shiftId, status ?? 'all'] as const,
  detail: (requestId: string) =>
    [...bondedRequestsKeys.all, 'detail', requestId] as const,
};

async function fetchBondedRequests(
  shiftId: string,
  status?: BondedCoverageRequestStatus,
): Promise<BondedCoverageRequest[]> {
  const params = status ? `?status=${status}` : '';
  return bffRequest<BondedCoverageRequest[]>(
    `/api/manual-shifts/${shiftId}/bonded-requests${params}`,
  );
}

async function fetchBondedRequestDetail(
  requestId: string,
): Promise<BondedCoverageRequestDetail> {
  return bffRequest<BondedCoverageRequestDetail>(
    `/api/bonded-requests/${requestId}`,
  );
}

export function bondedRequestsQueryOptions(
  shiftId: string,
  status?: BondedCoverageRequestStatus,
) {
  return queryOptions({
    queryKey: bondedRequestsKeys.list(shiftId, status),
    queryFn: () => fetchBondedRequests(shiftId, status),
    enabled: !!shiftId,
    staleTime: 10_000,
  });
}

export function bondedRequestDetailQueryOptions(requestId: string) {
  return queryOptions({
    queryKey: bondedRequestsKeys.detail(requestId),
    queryFn: () => fetchBondedRequestDetail(requestId),
    enabled: !!requestId,
    staleTime: 5_000,
  });
}
