import type {
  ManualShiftLine,
  ManualShiftSession,
  ManualShiftOrder,
  ManualShiftOrderError,
  ManualShiftBulkAddResult,
  ManualShiftOrderStatus,
  ManualShiftOrderErrorType,
  ManualShiftOrderSize,
  ManualShiftWorker,
  ManualShiftWorkerRole
} from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { manualShiftKeys } from './queries';

type CreateShiftInput = { name: string; date?: string };
type CreateLineInput = { shiftId: string; name: string; sortOrder?: number };

type CreateWorkerInput = {
  shiftId: string;
  name: string;
  role?: ManualShiftWorkerRole;
  sortOrder?: number;
};

type PatchWorkerInput = {
  workerId: string;
  shiftId: string;
  name?: string;
  role?: ManualShiftWorkerRole;
  active?: boolean;
  sortOrder?: number;
};

type CreateOrderInput = {
  lineId: string;
  pointName?: string | null;
  orderNumber?: string | null;
  palletCount?: number | null;
  customerName?: string | null;
  pickerName?: string | null;
  pickerWorkerId?: string | null;
  checkerName?: string | null;
  lineCount?: number | null;
  size?: ManualShiftOrderSize;
  status?: ManualShiftOrderStatus;
  comment?: string | null;
};

type BulkCreateOrdersInput = {
  lineId: string;
  rawText?: string;
  rows?: { orderNumber: string; pickerName?: string | null; lineCount?: number | null }[];
};

type UpdateOrderStatusInput = {
  orderId: string;
  lineId: string;
  status: ManualShiftOrderStatus;
};

type CreateOrderErrorInput = {
  orderId: string;
  lineId: string;
  type: ManualShiftOrderErrorType;
  comment?: string;
};

async function createWorker({ shiftId, ...body }: CreateWorkerInput): Promise<ManualShiftWorker> {
  return bffRequest<ManualShiftWorker>(`/api/manual-shifts/${shiftId}/workers`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

async function patchWorker({ workerId, shiftId: _shiftId, ...body }: PatchWorkerInput): Promise<ManualShiftWorker> {
  return bffRequest<ManualShiftWorker>(`/api/manual-shift-workers/${workerId}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

async function createShift(input: CreateShiftInput): Promise<ManualShiftSession> {
  return bffRequest<ManualShiftSession>('/api/manual-shifts', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

async function createLine({ shiftId, name, sortOrder }: CreateLineInput): Promise<ManualShiftLine> {
  return bffRequest<ManualShiftLine>(`/api/manual-shifts/${shiftId}/lines`, {
    method: 'POST',
    body: JSON.stringify({ name, sortOrder })
  });
}

async function createOrder({ lineId, ...fields }: CreateOrderInput): Promise<ManualShiftOrder> {
  return bffRequest<ManualShiftOrder>(`/api/manual-shift-lines/${lineId}/orders`, {
    method: 'POST',
    body: JSON.stringify(fields)
  });
}

async function bulkCreateOrders({
  lineId,
  ...body
}: BulkCreateOrdersInput): Promise<ManualShiftBulkAddResult> {
  return bffRequest<ManualShiftBulkAddResult>(
    `/api/manual-shift-lines/${lineId}/orders/bulk`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

async function updateOrderStatus({
  orderId,
  status
}: UpdateOrderStatusInput): Promise<ManualShiftOrder> {
  return bffRequest<ManualShiftOrder>(`/api/manual-shift-orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

async function createOrderError({
  orderId,
  type,
  comment
}: CreateOrderErrorInput): Promise<ManualShiftOrderError> {
  return bffRequest<ManualShiftOrderError>(`/api/manual-shift-orders/${orderId}/errors`, {
    method: 'POST',
    body: JSON.stringify({ type, comment })
  });
}

export function useCreateManualShiftWorker(shiftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateWorkerInput, 'shiftId'>) => createWorker({ ...input, shiftId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.workers(shiftId) });
    }
  });
}

export function usePatchManualShiftWorker(shiftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<PatchWorkerInput, 'shiftId'>) =>
      patchWorker({ ...input, shiftId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.workers(shiftId) });
    }
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
    }
  });
}

export function useCreateLine(shiftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateLineInput, 'shiftId'>) => createLine({ ...input, shiftId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.lines(shiftId) });
    }
  });
}

export function useCreateManualShiftOrder(lineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateOrderInput, 'lineId'>) => createOrder({ ...input, lineId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.lineOrders(lineId) });
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
    }
  });
}

export function useBulkCreateManualShiftOrders(lineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<BulkCreateOrdersInput, 'lineId'>) =>
      bulkCreateOrders({ ...input, lineId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.lineOrders(lineId) });
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
    }
  });
}

export function useUpdateManualShiftOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOrderStatus,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: manualShiftKeys.lineOrders(variables.lineId)
      });
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
    }
  });
}

export function useCreateManualShiftOrderError() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrderError,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: manualShiftKeys.lineOrders(variables.lineId)
      });
      void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
    }
  });
}
