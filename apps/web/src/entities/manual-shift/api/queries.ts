import type { ManualShiftTodayResponse, ManualShiftOrder } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const manualShiftKeys = {
  all: ['manual-shift'] as const,
  today: () => [...manualShiftKeys.all, 'today'] as const,
  lines: (shiftId: string) => [...manualShiftKeys.all, 'lines', shiftId] as const,
  lineOrders: (lineId: string) => [...manualShiftKeys.all, 'line-orders', lineId] as const
};

async function fetchTodayShift(): Promise<ManualShiftTodayResponse> {
  return bffRequest<ManualShiftTodayResponse>('/api/manual-shifts/today');
}

export function todayShiftQueryOptions() {
  return queryOptions({
    queryKey: manualShiftKeys.today(),
    queryFn: fetchTodayShift,
    staleTime: 60_000
  });
}

async function fetchLineOrders(lineId: string): Promise<ManualShiftOrder[]> {
  return bffRequest<ManualShiftOrder[]>(`/api/manual-shift-lines/${lineId}/orders`);
}

export function lineOrdersQueryOptions(lineId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.lineOrders(lineId),
    queryFn: () => fetchLineOrders(lineId),
    enabled: !!lineId
  });
}
