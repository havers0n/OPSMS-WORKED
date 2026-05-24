import { queryOptions } from '@tanstack/react-query';
import type { OrderSummary, WaveSummary } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';

export type PickingQueueOrderItemDto = {
  kind: 'order';
  id: string;
  displayCode: string;
  status: 'ready' | 'in_progress' | 'blocked';
  lineCount?: number;
  taskCount?: number;
  plannedQtyEach?: number;
  warningCount?: number;
};

export type PickingQueueWaveItemDto = {
  kind: 'wave';
  id: string;
  displayCode: string;
  status: 'ready' | 'in_progress' | 'blocked';
  orderCount?: number;
  lineCount?: number;
  taskCount?: number;
  warningCount?: number;
};

export type PickingQueueItemDto = PickingQueueOrderItemDto | PickingQueueWaveItemDto;

const PICKABLE_WAVE_STATUSES = new Set(['ready', 'released', 'in_progress']);

async function fetchOrders(): Promise<OrderSummary[]> {
  return bffRequest<OrderSummary[]>('/api/orders');
}

async function fetchWaves(): Promise<WaveSummary[]> {
  return bffRequest<WaveSummary[]>('/api/waves');
}

function mapOrderStatus(status: OrderSummary['status']): PickingQueueOrderItemDto['status'] | null {
  if (status === 'ready' || status === 'released') return 'ready';
  if (status === 'picking') return 'in_progress';
  return null;
}

function mapWaveStatus(status: WaveSummary['status']): PickingQueueWaveItemDto['status'] | null {
  if (status === 'ready' || status === 'released') return 'ready';
  if (status === 'in_progress') return 'in_progress';
  return null;
}

export async function fetchPickingQueue(): Promise<PickingQueueItemDto[]> {
  const [orders, waves] = await Promise.all([fetchOrders(), fetchWaves()]);

  const orderItems = orders.reduce<PickingQueueOrderItemDto[]>((acc, order) => {
    if (order.waveId) return acc;
    const status = mapOrderStatus(order.status);
    if (!status) return acc;
    acc.push({
      kind: 'order',
      id: order.id,
      displayCode: order.externalNumber,
      status,
      lineCount: order.lineCount
    });
    return acc;
  }, []);

  const waveItems = waves.reduce<PickingQueueWaveItemDto[]>((acc, wave) => {
    if (!PICKABLE_WAVE_STATUSES.has(wave.status)) return acc;
    const status = mapWaveStatus(wave.status);
    if (!status) return acc;
    acc.push({
      kind: 'wave',
      id: wave.id,
      displayCode: wave.name,
      status,
      orderCount: wave.totalOrders
    });
    return acc;
  }, []);

  return [...orderItems, ...waveItems];
}

export const pickingQueueKeys = {
  all: ['picking-queue'] as const
};

export function pickingQueueQueryOptions() {
  return queryOptions({
    queryKey: pickingQueueKeys.all,
    queryFn: fetchPickingQueue
  });
}
