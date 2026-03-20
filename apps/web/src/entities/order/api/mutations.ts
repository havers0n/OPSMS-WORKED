import type { Order, OrderLine, OrderStatus } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { orderKeys } from './queries';

// ── Create order ──────────────────────────────────────────────────────────────

type CreateOrderInput = {
  externalNumber: string;
  priority?: number;
  waveId?: string;
};

async function createOrder(input: CreateOrderInput): Promise<Order> {
  return bffRequest<Order>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    }
  });
}

// ── Add line ──────────────────────────────────────────────────────────────────

type AddOrderLineInput = {
  orderId: string;
  productId: string;
  qtyRequired: number;
};

async function addOrderLine({ orderId, ...body }: AddOrderLineInput): Promise<OrderLine> {
  return bffRequest<OrderLine>(`/api/orders/${orderId}/lines`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function useAddOrderLine(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<AddOrderLineInput, 'orderId'>) => addOrderLine({ orderId, ...input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    }
  });
}

// ── Remove line ───────────────────────────────────────────────────────────────

async function removeOrderLine({ orderId, lineId }: { orderId: string; lineId: string }): Promise<void> {
  await bffRequest<void>(`/api/orders/${orderId}/lines/${lineId}`, { method: 'DELETE' });
}

export function useRemoveOrderLine(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => removeOrderLine({ orderId, lineId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    }
  });
}

// ── Transition status ─────────────────────────────────────────────────────────

async function transitionOrderStatus({ orderId, status }: { orderId: string; status: OrderStatus }): Promise<Order> {
  return bffRequest<Order>(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export function useTransitionOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transitionOrderStatus,
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.execution(order.id) });
      queryClient.setQueryData(orderKeys.detail(order.id), order);
    }
  });
}
