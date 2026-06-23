import type { SourceOrder, SourceOrderItem, ItemAllocation, OrderBadgeStatus } from './scheme-types';
import { getOrderSplitStatus } from './scheme-store';

export interface OrderProgress {
  allocatedQty: number;
  totalQty: number;
  allocatedRows: number;
  totalRows: number;
}

export function getOrderBadgeStatus(
  orderId: string,
  orderItemMap: Record<string, SourceOrderItem[]>,
  itemAllocations: ItemAllocation[],
): OrderBadgeStatus {
  const items = orderItemMap[orderId];
  if (!items || items.length === 0) return 'not_loaded';
  return getOrderSplitStatus(orderId, items, itemAllocations);
}

export function getOrderProgress(
  orderId: string,
  orderItemMap: Record<string, SourceOrderItem[]>,
  itemAllocations: ItemAllocation[],
): OrderProgress | null {
  const items = orderItemMap[orderId];
  if (!items || items.length === 0) return null;

  let allocatedQty = 0;
  let totalQty = 0;
  let allocatedRows = 0;
  const totalRows = items.length;

  for (const item of items) {
    totalQty += item.quantity;
    const itemAssigned = itemAllocations
      .filter((a) => a.itemRowId === item.id)
      .reduce((s, a) => s + a.qty, 0);
    allocatedQty += itemAssigned;
    if (itemAssigned > 0) allocatedRows++;
  }

  return { allocatedQty, totalQty, allocatedRows, totalRows };
}

export function filterOrdersBySearch(
  orders: SourceOrder[],
  query: string,
  orderItemMap: Record<string, SourceOrderItem[]>,
): SourceOrder[] {
  if (!query.trim()) return orders;
  const q = query.trim().toLowerCase();
  return orders.filter((o) => {
    if (o.orderNumber?.toLowerCase().includes(q)) return true;
    if (o.customerName?.toLowerCase().includes(q)) return true;
    if (o.sourceDeliveryLine?.lineGroupName?.toLowerCase().includes(q)) return true;
    const items = orderItemMap[o.orderId];
    if (items) {
      for (const item of items) {
        if (item.sku.toLowerCase().includes(q)) return true;
        if (item.description?.toLowerCase().includes(q)) return true;
      }
    }
    return false;
  });
}

export function filterOrdersByStatus(
  orders: SourceOrder[],
  statusFilter: OrderBadgeStatus | 'all',
  orderItemMap: Record<string, SourceOrderItem[]>,
  itemAllocations: ItemAllocation[],
): SourceOrder[] {
  if (statusFilter === 'all') return orders;
  return orders.filter((o) => {
    const badgeStatus = getOrderBadgeStatus(o.orderId, orderItemMap, itemAllocations);
    return badgeStatus === statusFilter;
  });
}
