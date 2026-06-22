import { describe, expect, it } from 'vitest';
import type { ManualShiftWorkHierarchyResponse, ManualShiftOrderItem } from '@wos/domain';
import { adaptWorkHierarchyToSource, adaptOrderItemsToSource } from './source-data-adapter';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderId: '11111111-1111-4111-8111-111111111111',
    orderNumber: 'SO26010001',
    customerName: 'לקוח לדוגמה',
    pointName: 'נקודה א',
    sourceZone: null,
    status: 'queued' as const,
    lineCount: 5,
    totalQuantity: 100,
    hasAshlama: false,
    hasCheckUnits: false,
    ...overrides,
  };
}

function makeBucket(overrides: Record<string, unknown> = {}) {
  return {
    bucketName: 'all',
    displayName: 'כללי',
    totalOrders: 2,
    totalQuantity: 150,
    statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
    orders: [makeOrder()],
    ...overrides,
  };
}

function makeLine(overrides: Record<string, unknown> = {}) {
  return {
    lineId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    lineGroupName: 'דרומי 1',
    distributionArea: 'דרום',
    lineKind: 'delivery_channel' as const,
    status: 'open' as const,
    totalBuckets: 1,
    totalOrders: 2,
    totalQuantity: 150,
    itemLinesCount: 10,
    statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
    buckets: [makeBucket()],
    routeGroups: [],
    ...overrides,
  };
}

function makeArea(overrides: Record<string, unknown> = {}) {
  return {
    areaName: 'south',
    displayName: 'דרום',
    totalLines: 1,
    totalBuckets: 1,
    totalOrders: 2,
    totalQuantity: 150,
    itemLinesCount: 10,
    statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
    lines: [makeLine()],
    ...overrides,
  };
}

function makeHierarchy(overrides: Record<string, unknown> = {}): ManualShiftWorkHierarchyResponse {
  return {
    shiftId: 'shift-11111111-1111-4111-8111-111111111111',
    areas: [makeArea()],
    ...overrides,
  } as ManualShiftWorkHierarchyResponse;
}

function makeItem(overrides: Record<string, unknown> = {}): ManualShiftOrderItem {
  return {
    id: 'item-11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-11111111-1111-4111-8111-111111111111',
    shiftId: 'shift-11111111-1111-4111-8111-111111111111',
    lineId: 'line-11111111-1111-4111-8111-111111111111',
    orderId: 'order-11111111-1111-4111-8111-111111111111',
    sku: 'SKU-001',
    description: 'מוצר לדוגמה',
    category: 'כללי',
    quantity: 10,
    notes: null,
    zone: null,
    sourceSheet: null,
    sourceRows: null,
    sourceFile: null,
    sortOrder: 0,
    createdAt: '2026-06-21T07:00:00.000Z',
    ...overrides,
  };
}

describe('adaptWorkHierarchyToSource', () => {
  it('extracts areas with correct metadata', () => {
    const result = adaptWorkHierarchyToSource(makeHierarchy());
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].areaName).toBe('south');
    expect(result.areas[0].displayName).toBe('דרום');
    expect(result.areas[0].totalOrders).toBe(2);
    expect(result.areas[0].totalQuantity).toBe(150);
  });

  it('flattens orders from buckets with source delivery line metadata', () => {
    const result = adaptWorkHierarchyToSource(makeHierarchy());
    expect(result.orders).toHaveLength(1);
    const order = result.orders[0];
    expect(order.orderId).toBe('11111111-1111-4111-8111-111111111111');
    expect(order.orderNumber).toBe('SO26010001');
    expect(order.customerName).toBe('לקוח לדוגמה');
    expect(order.sourceDeliveryLine).not.toBeNull();
    expect(order.sourceDeliveryLine!.lineId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(order.sourceDeliveryLine!.lineGroupName).toBe('דרומי 1');
    expect(order.sourceDeliveryLine!.distributionArea).toBe('דרום');
    expect(order.sourceDeliveryLine!.lineKind).toBe('delivery_channel');
    expect(order.areaName).toBe('south');
    expect(order.areaDisplayName).toBe('דרום');
    expect(order.backendStatus).toBe('queued');
    expect(order.totalQuantity).toBe(100);
    expect(order.itemLinesCount).toBe(5);
    expect(order.hasAshlama).toBe(false);
    expect(order.hasCheckUnits).toBe(false);
  });

  it('handles multiple areas', () => {
    const result = adaptWorkHierarchyToSource(makeHierarchy({
      areas: [
        makeArea({ areaName: 'north', displayName: 'צפון' }),
        makeArea({ areaName: 'south', displayName: 'דרום' }),
      ],
    }));
    expect(result.areas).toHaveLength(2);
    expect(result.areas[0].displayName).toBe('צפון');
    expect(result.areas[1].displayName).toBe('דרום');
  });

  it('handles area with null name', () => {
    const result = adaptWorkHierarchyToSource(makeHierarchy({
      areas: [makeArea({ areaName: null, displayName: 'ללא איזור' })],
    }));
    expect(result.areas[0].areaName).toBeNull();
    expect(result.areas[0].displayName).toBe('ללא איזור');
  });

  it('handles empty areas', () => {
    const result = adaptWorkHierarchyToSource(makeHierarchy({ areas: [] }));
    expect(result.areas).toHaveLength(0);
    expect(result.orders).toHaveLength(0);
  });

  it('captures hasAshlama and hasCheckUnits from order', () => {
    const result = adaptWorkHierarchyToSource(makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [makeBucket({
            orders: [makeOrder({ hasAshlama: true, hasCheckUnits: true })],
          })],
        })],
      })],
    }));
    const order = result.orders[0];
    expect(order.hasAshlama).toBe(true);
    expect(order.hasCheckUnits).toBe(true);
  });

  it('maps sourceZone from order', () => {
    const result = adaptWorkHierarchyToSource(makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [makeBucket({
            orders: [makeOrder({ sourceZone: 'צפון' })],
          })],
        })],
      })],
    }));
    expect(result.orders[0].sourceZone).toBe('צפון');
  });

  it('maps sourceZone to null when missing', () => {
    const result = adaptWorkHierarchyToSource(makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [makeBucket({
            orders: [makeOrder({ sourceZone: undefined })],
          })],
        })],
      })],
    }));
    expect(result.orders[0].sourceZone).toBeNull();
  });
});

describe('adaptWorkHierarchyToSource with routeGroups', () => {
  it('flattens orders from routeGroups > workBuckets', () => {
    const hierarchy = makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [],
          routeGroups: [{
            routeGroupKey: 'rg-1',
            routeGroupName: 'כללי',
            routeGroupKind: 'general' as const,
            classificationConfidence: 'high' as const,
            classificationReasons: [],
            orderCount: 1,
            itemLinesCount: 5,
            totalQuantity: 100,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            workBuckets: [{
              workBucketKey: 'wb-1',
              workBucketName: 'כללי',
              workBucketDisplayName: 'כללי',
              workBucketKind: 'general' as const,
              classificationConfidence: 'high' as const,
              classificationReasons: [],
              orderCount: 1,
              itemLinesCount: 5,
              totalQuantity: 100,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              orders: [makeOrder({ orderId: 'rg-order-1', orderNumber: 'SO-RG-1' })],
            }],
          }],
        })],
      })],
    });
    const result = adaptWorkHierarchyToSource(hierarchy);
    expect(result.orders).toHaveLength(1);
    const order = result.orders[0];
    expect(order.orderId).toBe('rg-order-1');
    expect(order.sourceDeliveryLine).not.toBeNull();
    expect(order.sourceDeliveryLine!.lineGroupName).toBe('דרומי 1');
  });
});

describe('adaptOrderItemsToSource', () => {
  it('maps all item fields correctly', () => {
    const items: ManualShiftOrderItem[] = [makeItem()];
    const result = adaptOrderItemsToSource(items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('item-11111111-1111-4111-8111-111111111111');
    expect(result[0].orderId).toBe('order-11111111-1111-4111-8111-111111111111');
    expect(result[0].sku).toBe('SKU-001');
    expect(result[0].description).toBe('מוצר לדוגמה');
    expect(result[0].category).toBe('כללי');
    expect(result[0].quantity).toBe(10);
  });

  it('handles empty array', () => {
    expect(adaptOrderItemsToSource([])).toHaveLength(0);
  });

  it('does not leak domain-only fields', () => {
    const items: ManualShiftOrderItem[] = [makeItem()];
    const result = adaptOrderItemsToSource(items);
    const row = result[0] as unknown as Record<string, unknown>;
    expect(row.tenantId).toBeUndefined();
    expect(row.sortOrder).toBeUndefined();
    expect(row.createdAt).toBeUndefined();
    expect(row.sourceSheet).toBeUndefined();
  });
});

describe('duplicate orderNumber safety', () => {
  it('orders use orderId as key, not orderNumber', () => {
    const result = adaptWorkHierarchyToSource(makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [makeBucket({
            orders: [
              makeOrder({ orderId: 'o1', orderNumber: 'SO-001' }),
              makeOrder({ orderId: 'o2', orderNumber: 'SO-001' }),
            ],
          })],
        })],
      })],
    }));
    expect(result.orders).toHaveLength(2);
    expect(result.orders[0].orderId).toBe('o1');
    expect(result.orders[1].orderId).toBe('o2');
    expect(result.orders[0].orderNumber).toBe('SO-001');
    expect(result.orders[1].orderNumber).toBe('SO-001');
  });
});
