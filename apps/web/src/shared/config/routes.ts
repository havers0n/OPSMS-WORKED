export const routes = {
  login: '/login',
  warehouse: '/warehouse',
  warehouseView: '/warehouse/view',
  products: '/products',
  operations: '/operations',
  waveDetail: '/operations/waves/:id',
  pickTaskDetail: '/operations/pick-tasks/:id',
  orders: '/orders',
  waves: '/waves'
} as const;

export function waveDetailPath(id: string) {
  return `/operations/waves/${id}`;
}

export function pickTaskDetailPath(
  id: string,
  context?: { orderId?: string; waveId?: string }
) {
  if (!context) return `/operations/pick-tasks/${id}`;
  const params = new URLSearchParams();
  if (context.orderId) params.set('order', context.orderId);
  if (context.waveId) params.set('wave', context.waveId);
  const qs = params.toString();
  return `/operations/pick-tasks/${id}${qs ? `?${qs}` : ''}`;
}
