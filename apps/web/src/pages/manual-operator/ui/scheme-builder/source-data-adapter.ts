import type { ManualShiftWorkHierarchyResponse, ManualShiftOrderItem } from '@wos/domain';
import type { SourceArea, SourceDeliveryLine, SourceOrder, SourceOrderItem } from './scheme-types';

export function adaptWorkHierarchyToSource(response: ManualShiftWorkHierarchyResponse): {
  areas: SourceArea[];
  orders: SourceOrder[];
} {
  const orders: SourceOrder[] = [];
  const areas: SourceArea[] = response.areas.map((area) => {
    for (const line of area.lines) {
      const deliveryLine: SourceDeliveryLine = {
        lineId: line.lineId,
        lineGroupName: line.lineGroupName,
        distributionArea: line.distributionArea,
        lineKind: line.lineKind,
      };
      const buckets = line.buckets ?? [];
      for (const bucket of buckets) {
        for (const order of bucket.orders) {
          orders.push({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            pointName: order.pointName,
            sourceZone: order.sourceZone ?? null,
            backendStatus: order.status,
            totalQuantity: order.totalQuantity,
            itemLinesCount: order.lineCount,
            hasAshlama: order.hasAshlama,
            hasCheckUnits: order.hasCheckUnits,
            sourceDeliveryLine: deliveryLine,
            areaName: area.areaName,
            areaDisplayName: area.displayName,
            deliveryPointId: order.deliveryPointId ?? null,
            deliveryPointName: order.deliveryPointName ?? null,
            deliveryPointMatchStatus: order.deliveryPointMatchStatus ?? null,
            rawDestinationLabel: order.rawDestinationLabel ?? null,
          });
        }
      }
      const routeGroups = line.routeGroups ?? [];
      for (const rg of routeGroups) {
        for (const wb of rg.workBuckets) {
          for (const order of wb.orders) {
            orders.push({
              orderId: order.orderId,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              pointName: order.pointName,
              sourceZone: order.sourceZone ?? null,
              backendStatus: order.status,
              totalQuantity: order.totalQuantity,
              itemLinesCount: order.lineCount,
              hasAshlama: order.hasAshlama,
              hasCheckUnits: order.hasCheckUnits,
              sourceDeliveryLine: deliveryLine,
              areaName: area.areaName,
              areaDisplayName: area.displayName,
              deliveryPointId: order.deliveryPointId ?? null,
              deliveryPointName: order.deliveryPointName ?? null,
              deliveryPointMatchStatus: order.deliveryPointMatchStatus ?? null,
              rawDestinationLabel: order.rawDestinationLabel ?? null,
            });
          }
        }
      }
    }
    return {
      areaName: area.areaName,
      displayName: area.displayName,
      totalOrders: area.totalOrders,
      totalQuantity: area.totalQuantity,
      itemLinesCount: area.itemLinesCount,
    };
  });
  return { areas, orders };
}

export function adaptOrderItemsToSource(items: ManualShiftOrderItem[]): SourceOrderItem[] {
  return items.map((item) => ({
    id: item.id,
    orderId: item.orderId,
    sku: item.sku,
    description: item.description,
    category: item.category,
    quantity: item.quantity,
    notes: item.notes,
    zone: item.zone,
    sourceRows: item.sourceRows,
    sourceFile: item.sourceFile,
  }));
}
