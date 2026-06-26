import type { RawDemandPlanningPreview, RawDemandPlanningPreviewOrderItem } from '@wos/domain';
import type { SourceArea, SourceOrder, SourceOrderItem } from './scheme-types';

export type DemandSourceData = {
  areas: SourceArea[];
  orders: SourceOrder[];
  orderItemMap: Record<string, SourceOrderItem[]>;
  specialFlowOrders: SourceOrder[];
  specialFlowItems: SourceOrderItem[];
  errorOrders: SourceOrder[];
  errorItems: SourceOrderItem[];
};

export function buildDemandOrderId(
  batchId: string,
  distributionArea: string | null,
  orderNumber: string | null,
  customerName: string | null
): string {
  return `demand:${batchId}:${distributionArea ?? 'no-area'}:${orderNumber ?? 'no-order'}:${customerName ?? 'no-customer'}`;
}

function adaptItem(
  item: RawDemandPlanningPreviewOrderItem,
  orderId: string,
): SourceOrderItem {
  return {
    id: item.rawDemandRowId,
    orderId,
    sku: item.sku ?? '',
    description: item.description,
    category: item.category,
    quantity: item.quantity ?? 0,
    notes: null,
    zone: null,
    sourceRows: null,
    sourceFile: null,
    productHandlingFlow: item.productHandlingFlow,
    planningStatus: item.planningStatus,
    issues: item.issues.length > 0 ? item.issues : undefined,
    isSpecialFlow: item.planningStatus === 'special_flow',
    isError: item.planningStatus === 'error',
  };
}

export function adaptDemandPlanningPreviewToSource(
  preview: RawDemandPlanningPreview,
  batchId: string
): DemandSourceData {
  const areas: SourceArea[] = [];
  const orders: SourceOrder[] = [];
  const orderItemMap: Record<string, SourceOrderItem[]> = {};
  const specialFlowOrders: SourceOrder[] = [];
  const specialFlowItems: SourceOrderItem[] = [];
  const errorOrders: SourceOrder[] = [];
  const errorItems: SourceOrderItem[] = [];

  for (const area of preview.distributionAreas) {
    const areaName = area.distributionArea ?? '__missing__';
    const displayName = area.distributionArea ?? '(ללא אזור)';

    areas.push({
      areaName,
      displayName,
      totalOrders: area.ordersCount,
      totalQuantity: area.totalQuantity,
    });

    for (const rawOrder of area.orders) {
      const orderId = buildDemandOrderId(
        batchId,
        area.distributionArea,
        rawOrder.orderNumber,
        rawOrder.customerName
      );

      const items: SourceOrderItem[] = [];
      const orderSpecialItems: SourceOrderItem[] = [];
      const orderErrorItems: SourceOrderItem[] = [];

      for (const rawItem of rawOrder.items) {
        if (rawItem.planningStatus === 'error') {
          const adapted = adaptItem(rawItem, orderId);
          orderErrorItems.push(adapted);
          errorItems.push(adapted);
          continue;
        }
        if (rawItem.planningStatus === 'special_flow') {
          const adapted = adaptItem(rawItem, orderId);
          orderSpecialItems.push(adapted);
          specialFlowItems.push(adapted);
          continue;
        }
        items.push(adaptItem(rawItem, orderId));
      }

      const baseOrder: SourceOrder = {
        orderId,
        orderNumber: rawOrder.orderNumber,
        customerName: rawOrder.customerName,
        pointName: null,
        sourceZone: null,
        backendStatus: 'queued',
        totalQuantity: rawOrder.totalQuantity,
        itemLinesCount: rawOrder.rowsCount,
        hasAshlama: false,
        hasCheckUnits: false,
        sourceDeliveryLine: null,
        areaName,
        areaDisplayName: displayName,
      };

      if (items.length > 0) {
        orders.push(baseOrder);
        orderItemMap[orderId] = items;
      }

      if (orderSpecialItems.length > 0) {
        specialFlowOrders.push({ ...baseOrder, orderId: `${orderId}:special`, itemLinesCount: orderSpecialItems.length });
        orderItemMap[`${orderId}:special`] = orderSpecialItems;
      }

      if (orderErrorItems.length > 0) {
        errorOrders.push({ ...baseOrder, orderId: `${orderId}:error`, itemLinesCount: orderErrorItems.length });
        orderItemMap[`${orderId}:error`] = orderErrorItems;
      }
    }
  }

  return { areas, orders, orderItemMap, specialFlowOrders, specialFlowItems, errorOrders, errorItems };
}