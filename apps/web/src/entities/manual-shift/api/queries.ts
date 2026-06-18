import type {
  BindableUser,
  ManualShiftTodayResponse,
  ManualShiftOrder,
  ManualShiftOrderDetail,
  ManualShiftOrderCheckUnit,
  ManualShiftOrderAshlama,
  ManualShiftOrderEvent,
  ManualShiftPeopleSummary,
  ManualShiftDaySummary,
  ManualShiftWorker,
  ManualShiftWorkHierarchyResponse,
  OpenAshlamaBoardItem
} from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const manualShiftKeys = {
  all: ['manual-shift'] as const,
  today: () => [...manualShiftKeys.all, 'today'] as const,
  byDate: (date: string) => [...manualShiftKeys.all, 'by-date', date] as const,
  lines: (shiftId: string) => [...manualShiftKeys.all, 'lines', shiftId] as const,
  lineOrders: (lineId: string) => [...manualShiftKeys.all, 'line-orders', lineId] as const,
  shiftOrders: (shiftId: string) => [...manualShiftKeys.all, 'shift-orders', shiftId] as const,
  workHierarchy: (shiftId: string) => [...manualShiftKeys.all, 'work-hierarchy', shiftId] as const,
  orderCheckUnits: (orderId: string) => [...manualShiftKeys.all, 'order-check-units', orderId] as const,
  orderAshlamot: (orderId: string) => [...manualShiftKeys.all, 'order-ashlamot', orderId] as const,
  orderEvents: (orderId: string) => [...manualShiftKeys.all, 'order-events', orderId] as const,
  orderDetail: (orderId: string) => [...manualShiftKeys.all, 'order-detail', orderId] as const,
  workers: (shiftId: string) => [...manualShiftKeys.all, 'workers', shiftId] as const,
  peopleSummary: (shiftId: string) =>
    [...manualShiftKeys.all, 'people-summary', shiftId] as const,
  daySummary: (shiftId: string) => [...manualShiftKeys.all, 'day-summary', shiftId] as const,
  shiftOpenAshlamot: (shiftId: string) =>
    [...manualShiftKeys.all, 'shift-open-ashlamot', shiftId] as const,
  bindableUsers: () => [...manualShiftKeys.all, 'bindable-users'] as const
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

async function fetchShiftByDate(date: string): Promise<ManualShiftTodayResponse> {
  return bffRequest<ManualShiftTodayResponse>(`/api/manual-shifts/by-date?date=${date}`);
}

export function shiftByDateQueryOptions(date: string) {
  return queryOptions({
    queryKey: manualShiftKeys.byDate(date),
    queryFn: () => fetchShiftByDate(date),
    staleTime: 60_000,
    enabled: !!date
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

async function fetchWorkHierarchy(shiftId: string): Promise<ManualShiftWorkHierarchyResponse> {
  return bffRequest<ManualShiftWorkHierarchyResponse>(`/api/manual-shifts/${shiftId}/work-hierarchy`);
}

export function workHierarchyQueryOptions(shiftId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.workHierarchy(shiftId),
    queryFn: () => fetchWorkHierarchy(shiftId),
    enabled: !!shiftId,
    staleTime: 10_000
  });
}

async function fetchOrderCheckUnits(orderId: string): Promise<ManualShiftOrderCheckUnit[]> {
  return bffRequest<ManualShiftOrderCheckUnit[]>(`/api/manual-shift-orders/${orderId}/check-units`);
}

export function orderCheckUnitsQueryOptions(orderId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.orderCheckUnits(orderId),
    queryFn: () => fetchOrderCheckUnits(orderId),
    enabled: !!orderId,
    staleTime: 10_000
  });
}

async function fetchOrderAshlamot(orderId: string): Promise<ManualShiftOrderAshlama[]> {
  return bffRequest<ManualShiftOrderAshlama[]>(`/api/manual-shift-orders/${orderId}/ashlamot`);
}

export function orderAshlamotQueryOptions(orderId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.orderAshlamot(orderId),
    queryFn: () => fetchOrderAshlamot(orderId),
    enabled: !!orderId,
    staleTime: 10_000
  });
}

async function fetchOrderEvents(orderId: string): Promise<ManualShiftOrderEvent[]> {
  return bffRequest<ManualShiftOrderEvent[]>(`/api/manual-shift-orders/${orderId}/events`);
}

async function fetchOrderDetail(orderId: string): Promise<ManualShiftOrderDetail> {
  return bffRequest<ManualShiftOrderDetail>(`/api/manual-shift-orders/${orderId}`);
}

export function orderEventsQueryOptions(orderId: string, enabled: boolean) {
  return queryOptions({
    queryKey: manualShiftKeys.orderEvents(orderId),
    queryFn: () => fetchOrderEvents(orderId),
    enabled: enabled && !!orderId,
    staleTime: 30_000
  });
}

export function orderDetailQueryOptions(orderId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.orderDetail(orderId),
    queryFn: () => fetchOrderDetail(orderId),
    enabled: !!orderId,
    staleTime: 30_000
  });
}

async function fetchShiftWorkers(shiftId: string): Promise<ManualShiftWorker[]> {
  return bffRequest<ManualShiftWorker[]>(`/api/manual-shifts/${shiftId}/workers`);
}

export function shiftWorkersQueryOptions(shiftId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.workers(shiftId),
    queryFn: () => fetchShiftWorkers(shiftId),
    enabled: !!shiftId,
    staleTime: 30_000
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

async function fetchShiftOpenAshlamot(shiftId: string): Promise<OpenAshlamaBoardItem[]> {
  return bffRequest<OpenAshlamaBoardItem[]>(`/api/manual-shifts/${shiftId}/open-ashlamot`);
}

export function shiftOpenAshlamotQueryOptions(shiftId: string) {
  return queryOptions({
    queryKey: manualShiftKeys.shiftOpenAshlamot(shiftId),
    queryFn: () => fetchShiftOpenAshlamot(shiftId),
    enabled: !!shiftId,
    staleTime: 10_000
  });
}

async function fetchBindableUsers(): Promise<BindableUser[]> {
  return bffRequest<BindableUser[]>('/api/manual-shifts/worker-bindable-users');
}

export function bindableUsersQueryOptions() {
  return queryOptions({
    queryKey: manualShiftKeys.bindableUsers(),
    queryFn: fetchBindableUsers,
    staleTime: 30_000
  });
}
