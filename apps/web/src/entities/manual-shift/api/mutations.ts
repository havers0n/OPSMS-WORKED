import type {
  ManualShiftLine,
  ManualShiftSession,
  ManualShiftOrder,
  ManualShiftOrderError,
  ManualShiftBulkAddResult,
  ManualShiftOrderStatus,
  ManualShiftOrderErrorType,
  ManualShiftOrderSize,
  ManualShiftOrderCheckUnit,
  ManualShiftOrderAshlama,
  ManualShiftOrderAshlamaStatus,
  ManualShiftOrderCheckUnitStatus,
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

type PatchOrderInput = {
  orderId: string;
  lineId: string;
  shiftId: string;
  pickerName?: string | null;
  pickerWorkerId?: string | null;
  lineCount?: number | null;
  palletCount?: number | null;
  startedAt?: string | null;
  waitingCheckAt?: string | null;
  finishedAt?: string | null;
  checkedAt?: string | null;
};

type CreateOrderErrorInput = {
  orderId: string;
  lineId: string;
  type: ManualShiftOrderErrorType;
  comment?: string;
};

type CreateOrderCheckUnitInput = {
  orderId: string;
  note?: string | null;
  reason?: string | null;
};

type UpdateOrderCheckUnitStatusInput = {
  checkUnitId: string;
  status: ManualShiftOrderCheckUnitStatus;
  note?: string | null;
  reason?: string | null;
};

type PatchOrderCheckUnitInput = {
  checkUnitId: string;
  note?: string | null;
  reason?: string | null;
};

type CreateOrderAshlamaInput = {
  orderId: string;
  checkUnitId: string;
  text: string;
};

type PatchOrderAshlamaInput = {
  ashlamaId: string;
  status: ManualShiftOrderAshlamaStatus;
};

type DeleteRestoreManualShiftInput = {
  reason?: string;
};

type DeleteRestoreOrderContext = {
  lineId: string;
  shiftId: string;
};

type DeleteRestoreLineContext = {
  shiftId: string;
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

async function createOrderCheckUnit({
  orderId,
  note,
  reason
}: CreateOrderCheckUnitInput): Promise<ManualShiftOrderCheckUnit> {
  return bffRequest<ManualShiftOrderCheckUnit>(`/api/manual-shift-orders/${orderId}/check-units`, {
    method: 'POST',
    body: JSON.stringify({ note, reason })
  });
}

async function updateOrderCheckUnitStatus({
  checkUnitId,
  status,
  note,
  reason
}: UpdateOrderCheckUnitStatusInput): Promise<ManualShiftOrderCheckUnit> {
  return bffRequest<ManualShiftOrderCheckUnit>(`/api/manual-shift-check-units/${checkUnitId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note, reason })
  });
}

async function patchOrderCheckUnit({
  checkUnitId,
  note,
  reason
}: PatchOrderCheckUnitInput): Promise<ManualShiftOrderCheckUnit> {
  return bffRequest<ManualShiftOrderCheckUnit>(`/api/manual-shift-check-units/${checkUnitId}`, {
    method: 'PATCH',
    body: JSON.stringify({ note, reason })
  });
}

async function createOrderAshlama({
  orderId,
  checkUnitId,
  text
}: CreateOrderAshlamaInput): Promise<ManualShiftOrderAshlama> {
  return bffRequest<ManualShiftOrderAshlama>(`/api/manual-shift-orders/${orderId}/ashlamot`, {
    method: 'POST',
    body: JSON.stringify({ checkUnitId, text })
  });
}

async function patchOrderAshlama({
  ashlamaId,
  status
}: PatchOrderAshlamaInput): Promise<ManualShiftOrderAshlama> {
  return bffRequest<ManualShiftOrderAshlama>(`/api/manual-shift-ashlamot/${ashlamaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

async function patchOrder({
  orderId,
  lineId: _lineId,
  shiftId: _shiftId,
  pickerName,
  pickerWorkerId,
  lineCount,
  palletCount,
  startedAt,
  waitingCheckAt,
  finishedAt,
  checkedAt
}: PatchOrderInput): Promise<ManualShiftOrder> {
  return bffRequest<ManualShiftOrder>(`/api/manual-shift-orders/${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ pickerName, pickerWorkerId, lineCount, palletCount, startedAt, waitingCheckAt, finishedAt, checkedAt })
  });
}

async function deleteManualShiftOrder(
  orderId: string,
  body: DeleteRestoreManualShiftInput
): Promise<ManualShiftOrder> {
  return bffRequest<ManualShiftOrder>(`/api/manual-shift-orders/${orderId}/delete`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

async function restoreManualShiftOrder(
  orderId: string,
  body: DeleteRestoreManualShiftInput
): Promise<ManualShiftOrder> {
  return bffRequest<ManualShiftOrder>(`/api/manual-shift-orders/${orderId}/restore`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

async function deleteManualShiftLine(
  lineId: string,
  body: DeleteRestoreManualShiftInput
): Promise<ManualShiftLine> {
  return bffRequest<ManualShiftLine>(`/api/manual-shift-lines/${lineId}/delete`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

async function restoreManualShiftLine(
  lineId: string,
  body: DeleteRestoreManualShiftInput
): Promise<ManualShiftLine> {
  return bffRequest<ManualShiftLine>(`/api/manual-shift-lines/${lineId}/restore`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

function invalidateOrderQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  lineId: string,
  shiftId: string
) {
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.lineOrders(lineId) });
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.shiftOrders(shiftId) });
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.peopleSummary(shiftId) });
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.daySummary(shiftId) });
}

function invalidateOrderCheckUnitQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  checkUnit: Pick<ManualShiftOrderCheckUnit, 'orderId'>
) {
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.orderCheckUnits(checkUnit.orderId) });
}

function invalidateOrderAshlamaQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  orderId: string
) {
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.orderAshlamot(orderId) });
}

function invalidateLineQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  lineId: string,
  shiftId: string
) {
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.lines(shiftId) });
  void queryClient.invalidateQueries({ queryKey: manualShiftKeys.lineOrders(lineId) });
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

export function useCreateManualShiftOrderCheckUnit(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateOrderCheckUnitInput, 'orderId'> = {}) =>
      createOrderCheckUnit({ ...input, orderId }),
    onSuccess: (checkUnit) => {
      invalidateOrderCheckUnitQueries(queryClient, checkUnit);
    }
  });
}

export function useUpdateManualShiftOrderCheckUnitStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOrderCheckUnitStatus,
    onSuccess: (checkUnit) => {
      invalidateOrderCheckUnitQueries(queryClient, checkUnit);
    }
  });
}

export function usePatchManualShiftOrderCheckUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchOrderCheckUnit,
    onSuccess: (checkUnit) => {
      invalidateOrderCheckUnitQueries(queryClient, checkUnit);
    }
  });
}

export function useCreateManualShiftOrderAshlama(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateOrderAshlamaInput, 'orderId'>) =>
      createOrderAshlama({ ...input, orderId }),
    onSuccess: () => {
      invalidateOrderAshlamaQueries(queryClient, orderId);
    }
  });
}

export function usePatchManualShiftOrderAshlama(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchOrderAshlama,
    onSuccess: () => {
      invalidateOrderAshlamaQueries(queryClient, orderId);
    }
  });
}

export function usePatchManualShiftOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchOrder,
    onSuccess: (_data, variables) => {
      invalidateOrderQueries(queryClient, variables.lineId, variables.shiftId);
    }
  });
}

export function useDeleteManualShiftOrder(
  orderId: string,
  context: DeleteRestoreOrderContext
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteRestoreManualShiftInput = {}) =>
      deleteManualShiftOrder(orderId, input),
    onSuccess: () => {
      invalidateOrderQueries(queryClient, context.lineId, context.shiftId);
    }
  });
}

export function useRestoreManualShiftOrder(
  orderId: string,
  context: DeleteRestoreOrderContext
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteRestoreManualShiftInput = {}) =>
      restoreManualShiftOrder(orderId, input),
    onSuccess: () => {
      invalidateOrderQueries(queryClient, context.lineId, context.shiftId);
    }
  });
}

export function useDeleteManualShiftLine(lineId: string, context: DeleteRestoreLineContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteRestoreManualShiftInput = {}) =>
      deleteManualShiftLine(lineId, input),
    onSuccess: () => {
      invalidateLineQueries(queryClient, lineId, context.shiftId);
    }
  });
}

export function useRestoreManualShiftLine(lineId: string, context: DeleteRestoreLineContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteRestoreManualShiftInput = {}) =>
      restoreManualShiftLine(lineId, input),
    onSuccess: () => {
      invalidateLineQueries(queryClient, lineId, context.shiftId);
    }
  });
}
