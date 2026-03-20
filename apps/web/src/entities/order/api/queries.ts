import type { Order, OrderSummary, PickTaskSummary } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const orderKeys = {
  all: ['order'] as const,
  list: (status?: string) => [...orderKeys.all, 'list', status ?? 'all'] as const,
  detail: (orderId: string | null) => [...orderKeys.all, 'detail', orderId ?? 'none'] as const,
  execution: (orderId: string | null) => [...orderKeys.all, 'execution', orderId ?? 'none'] as const
};

async function fetchOrders(status?: string): Promise<OrderSummary[]> {
  const url = status ? `/api/orders?status=${encodeURIComponent(status)}` : '/api/orders';
  return bffRequest<OrderSummary[]>(url);
}

async function fetchOrder(orderId: string): Promise<Order> {
  return bffRequest<Order>(`/api/orders/${orderId}`);
}

export function ordersQueryOptions(status?: string) {
  return queryOptions({
    queryKey: orderKeys.list(status),
    queryFn: () => fetchOrders(status)
  });
}

export function orderQueryOptions(orderId: string | null) {
  return queryOptions({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => fetchOrder(orderId as string),
    enabled: Boolean(orderId)
  });
}

async function fetchOrderExecution(orderId: string): Promise<PickTaskSummary[]> {
  return bffRequest<PickTaskSummary[]>(`/api/orders/${orderId}/execution`);
}

export function orderExecutionQueryOptions(orderId: string | null) {
  return queryOptions({
    queryKey: orderKeys.execution(orderId),
    queryFn: () => fetchOrderExecution(orderId as string),
    enabled: Boolean(orderId)
  });
}
