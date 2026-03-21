import type { OrderStatus } from '@wos/domain';

const editableOrderStatuses = new Set<OrderStatus>(['draft', 'ready']);

export function getAllowedOrderTransitions(currentStatus: OrderStatus): OrderStatus[] {
  switch (currentStatus) {
    case 'draft':
      return ['ready', 'cancelled'];
    case 'ready':
      return ['draft', 'released', 'cancelled'];
    case 'released':
      return ['picking', 'cancelled'];
    case 'picking':
      return ['picked', 'partial'];
    case 'picked':
      return ['closed'];
    case 'partial':
      return ['closed'];
    case 'closed':
    case 'cancelled':
      return [];
    default:
      return [];
  }
}

export function isOrderTransitionAllowed(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
  return getAllowedOrderTransitions(currentStatus).includes(targetStatus);
}

export function isOrderEditableStatus(status: OrderStatus): boolean {
  return editableOrderStatuses.has(status);
}
