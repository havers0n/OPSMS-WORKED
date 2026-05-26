import type {
  ManualShiftTodayResponse,
  ManualShiftOrder,
  ManualShiftPeopleSummary,
  ManualShiftDaySummary
} from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const manualShiftKeys = {
  all: ['manual-shift'] as const,
  today: () => [...manualShiftKeys.all, 'today'] as const,
  lines: (shiftId: string) => [...manualShiftKeys.all, 'lines', shiftId] as const,
  lineOrders: (lineId: string) => [...manualShiftKeys.all, 'line-orders', lineId] as const,
  shiftOrders: (shiftId: string) => [...manualShiftKeys.all, 'shift-orders', shiftId] as const,
  peopleSummary: (shiftId: string) =>
    [...manualShiftKeys.all, 'people-summary', shiftId] as const,
  daySummary: (shiftId: string) => [...manualShiftKeys.all, 'day-summary', shiftId] as const
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

async function fetchShiftOrders(shiftId: string): Promise<ManualShiftOrder[]> {
  return bffRequest<ManualShiftOrder[]>(`/api/manual-shifts/${shiftId}/orders`);
}

export function shiftOrdersQueryOptions(shiftId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.shiftOrders(shiftId),
    queryFn: () => fetchShiftOrders(shiftId),
    enabled: !!shiftId,
    staleTime: 10_000
  });
}

async function fetchPeopleSummary(shiftId: string): Promise<ManualShiftPeopleSummary> {
  return bffRequest<ManualShiftPeopleSummary>(`/api/manual-shifts/${shiftId}/people-summary`);
}

export function peopleSummaryQueryOptions(shiftId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.peopleSummary(shiftId),
    queryFn: () => fetchPeopleSummary(shiftId),
    enabled: !!shiftId,
    staleTime: 30_000
  });
}

async function fetchDaySummary(shiftId: string): Promise<ManualShiftDaySummary> {
  return bffRequest<ManualShiftDaySummary>(`/api/manual-shifts/${shiftId}/day-summary`);
}

export function daySummaryQueryOptions(shiftId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.daySummary(shiftId),
    queryFn: () => fetchDaySummary(shiftId),
    enabled: !!shiftId,
    staleTime: 30_000
  });
}
