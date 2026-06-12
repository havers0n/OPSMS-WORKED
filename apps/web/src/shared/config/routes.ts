export const routes = {
  login: '/login',
  operatorManual: '/operator/manual',
  warehouse: '/warehouse',
  warehouseView: '/warehouse/view',
  products: '/products',
  productDetail: '/products/:productId',
  operations: '/operations',
  picking: '/picking',
  pickingPlan: '/picking-plan',
  settings: '/settings',
  orderDetail: '/operations/orders/:orderId',
  waveDetail: '/operations/waves/:id',
  pickTaskDetail: '/operations/pick-tasks/:id',
  tasks: '/tasks',
  pickingRun: '/picking/run',
  orders: '/orders',
  waves: '/waves',
  picker: '/picker',
  pickerTask: '/picker/task/:taskId',
  pickerStep: '/picker/task/:taskId/step/:stepId',
} as const;

export function orderDetailPath(orderId: string) {
  return `/operations/orders/${orderId}`;
}

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
  if (context.wave) params.set('wave', context.wave);
  const qs = params.toString();
  return `/operations/pick-tasks/${id}${qs ? `?${qs}` : ''}`;
}

export function productDetailPath(productId: string) {
  return `/products/${productId}`;
}

export function pickerPath(): string {
  return '/picker';
}

export function pickerTaskPath(taskId: string): string {
  return `/picker/task/${taskId}`;
}

export function pickerStepPath(taskId: string, stepId: string): string {
  return `/picker/task/${taskId}/step/${stepId}`;
}

export function warehouseViewPath(opts?: {
  floorId?: string;
  cellId?: string;
  returnTaskId?: string;
  returnTaskNumber?: string;
}) {
  if (!opts) return routes.warehouseView;
  const params = new URLSearchParams();
  if (opts.floorId) params.set('floor', opts.floorId);
  if (opts.cellId) params.set('cell', opts.cellId);
  if (opts.returnTaskId) params.set('returnTaskId', opts.returnTaskId);
  if (opts.returnTaskNumber) params.set('returnTaskNumber', opts.returnTaskNumber);
  const qs = params.toString();
  return `${routes.warehouseView}${qs ? `?${qs}` : ''}`;
}
