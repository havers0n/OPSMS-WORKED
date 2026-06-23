import type {
  BondedCoverageRequestDetail,
  BondedCoverageRequestItem,
  AddBondedCoverageRequestItemInput,
  CancelBondedCoverageRequestInput,
  CloseBondedCoverageRequestInput,
  CreateBondedCoverageRequestInput,
  UpdateBondedCoverageRequestItemInput,
} from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { bondedRequestsKeys } from './queries';

export function useCreateBondedRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      shiftId,
      data,
    }: {
      shiftId: string;
      data: CreateBondedCoverageRequestInput;
    }) =>
      bffRequest<BondedCoverageRequestDetail>(
        `/api/manual-shifts/${shiftId}/bonded-requests`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: bondedRequestsKeys.list(variables.shiftId),
      });
    },
  });
}

export function useAddBondedRequestItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      data,
    }: {
      requestId: string;
      data: AddBondedCoverageRequestItemInput;
    }) =>
      bffRequest<BondedCoverageRequestItem>(
        `/api/bonded-requests/${requestId}/items`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: bondedRequestsKeys.detail(variables.requestId),
      });
    },
  });
}

export function useUpdateBondedRequestItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      itemId,
      data,
    }: {
      requestId: string;
      itemId: string;
      data: UpdateBondedCoverageRequestItemInput;
    }) =>
      bffRequest<BondedCoverageRequestItem>(
        `/api/bonded-requests/${requestId}/items/${itemId}`,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: bondedRequestsKeys.detail(variables.requestId),
      });
    },
  });
}

export function useCloseBondedRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      data,
    }: {
      requestId: string;
      data: CloseBondedCoverageRequestInput;
      shiftId?: string;
    }) =>
      bffRequest<BondedCoverageRequestDetail>(
        `/api/bonded-requests/${requestId}/close`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: bondedRequestsKeys.detail(variables.requestId),
      });
      if (variables.shiftId) {
        void queryClient.invalidateQueries({
          queryKey: bondedRequestsKeys.list(variables.shiftId),
        });
      }
    },
  });
}

export function useCancelBondedRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      data,
    }: {
      requestId: string;
      data: CancelBondedCoverageRequestInput;
      shiftId?: string;
    }) =>
      bffRequest<BondedCoverageRequestDetail>(
        `/api/bonded-requests/${requestId}/cancel`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: bondedRequestsKeys.detail(variables.requestId),
      });
      if (variables.shiftId) {
        void queryClient.invalidateQueries({
          queryKey: bondedRequestsKeys.list(variables.shiftId),
        });
      }
    },
  });
}
