import type { Order, OrderStatus, OrderSummary } from '@wos/domain';

export type OrderAction =
  | 'edit'
  | 'mark_ready'
  | 'mark_draft'
  | 'release'
  | 'view_progress'
  | 'review'
  | 'review_issues'
  | 'close'
  | 'cancel'
  | 'open';

export function getOrderActions(status: OrderStatus): OrderAction[] {
  switch (status) {
    case 'draft':
      return ['edit', 'mark_ready', 'cancel'];
    case 'ready':
      return ['edit', 'mark_draft', 'release', 'cancel'];
    case 'released':
      return ['open', 'cancel'];
    case 'picking':
      return ['open', 'view_progress'];
    case 'picked':
      return ['review', 'close'];
    case 'partial':
      return ['review_issues', 'close'];
    case 'closed':
    case 'cancelled':
      return ['open'];
    default:
      return ['open'];
  }
}

export function canEditLines(status: OrderStatus): boolean {
  return status === 'draft' || status === 'ready';
}

export function isActiveOrder(status: OrderStatus): boolean {
  return status === 'released' || status === 'picking';
}

export function isCompletedOrder(status: OrderStatus): boolean {
  return status === 'picked' || status === 'closed';
}

export function isProblematicOrder(status: OrderStatus): boolean {
  return status === 'partial';
}

/** UI badge label */
export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'draft':     return 'Черновик';
    case 'ready':     return 'Готов';
    case 'released':  return 'Выпущен';
    case 'picking':   return 'В работе';
    case 'picked':    return 'Собран';
    case 'partial':   return 'Частично';
    case 'closed':    return 'Закрыт';
    case 'cancelled': return 'Отменён';
  }
}

/** Tailwind color classes for status badge */
export function getOrderStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'draft':     return 'bg-slate-100 text-slate-600';
    case 'ready':     return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'released':  return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
    case 'picking':   return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'picked':    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'partial':   return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'closed':    return 'bg-slate-100 text-slate-500';
    case 'cancelled': return 'bg-red-50 text-red-600';
  }
}

/** Target status when operator clicks primary action */
export function getPrimaryTransitionTarget(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case 'draft':  return 'ready';
    case 'ready':  return 'released';
    case 'picked': return 'closed';
    case 'partial':return 'closed';
    default:       return null;
  }
}

export function getProgressLabel(order: OrderSummary): string {
  if (order.unitCount === 0) return '—';
  return `${order.pickedUnitCount} / ${order.unitCount}`;
}
