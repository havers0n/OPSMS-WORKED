import { describe, expect, it } from 'vitest';
import type { ManualShiftWorkHierarchyResponse, ManualShiftOrderItem } from '@wos/domain';
import {
  adaptWorkHierarchyToScheme,
  adaptOrderItemsToSchemeRows,
  buildBucketKeyForStore,
  parseBucketKey,
  NULL_BUCKET_PREFIX,
  NULL_BUCKET_DISPLAY
} from './line-scheme-adapter';

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
    ...overrides
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
    ...overrides
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
    totalLines: 1,
    itemLinesCount: 10,
    statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
    buckets: [makeBucket()],
    routeGroups: [],
    ...overrides
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
    ...overrides
  };
}

function makeHierarchy(overrides: Record<string, unknown> = {}): ManualShiftWorkHierarchyResponse {
  return {
    shiftId: 'shift-11111111-1111-4111-8111-111111111111',
    areas: [makeArea()],
    ...overrides
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
    ...overrides
  };
}

describe('adaptWorkHierarchyToScheme', () => {
  it('maps shiftId correctly', () => {
    const result = adaptWorkHierarchyToScheme(makeHierarchy());
    expect(result.shiftId).toBe('shift-11111111-1111-4111-8111-111111111111');
  });

  it('maps area fields correctly', () => {
    const result = adaptWorkHierarchyToScheme(makeHierarchy());
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].areaName).toBe('south');
    expect(result.areas[0].displayName).toBe('דרום');
    expect(result.areas[0].totalLines).toBe(1);
    expect(result.areas[0].totalOrders).toBe(2);
    expect(result.areas[0].totalQuantity).toBe(150);
  });

  it('maps line fields correctly', () => {
    const result = adaptWorkHierarchyToScheme(makeHierarchy());
    const line = result.areas[0].lines[0];
    expect(line.lineId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(line.lineGroupName).toBe('דרומי 1');
    expect(line.distributionArea).toBe('דרום');
    expect(line.lineKind).toBe('delivery_channel');
    expect(line.totalOrders).toBe(2);
    expect(line.totalQuantity).toBe(150);
  });

  it('maps bucket fields correctly', () => {
    const result = adaptWorkHierarchyToScheme(makeHierarchy());
    const bucket = result.areas[0].lines[0].buckets[0];
    expect(bucket.bucketName).toBe('all');
    expect(bucket.displayName).toBe('כללי');
    expect(bucket.totalOrders).toBe(2);
    expect(bucket.totalQuantity).toBe(150);
    expect(bucket.bucketKey).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::all');
  });

  it('maps order fields correctly', () => {
    const result = adaptWorkHierarchyToScheme(makeHierarchy());
    const order = result.areas[0].lines[0].buckets[0].orders[0];
    expect(order.orderId).toBe('11111111-1111-4111-8111-111111111111');
    expect(order.orderNumber).toBe('SO26010001');
    expect(order.customerName).toBe('לקוח לדוגמה');
    expect(order.backendStatus).toBe('queued');
    expect(order.lineCount).toBe(5);
    expect(order.totalQuantity).toBe(100);
    expect(order.hasAshlama).toBe(false);
    expect(order.hasCheckUnits).toBe(false);
  });

  it('sets assignmentStatus to unassigned when no overlay', () => {
    const result = adaptWorkHierarchyToScheme(makeHierarchy());
    const order = result.areas[0].lines[0].buckets[0].orders[0];
    expect(order.assignmentStatus).toBe('unassigned');
    expect(order.localAssignment).toBeNull();
  });

  it('sets assignmentStatus to assigned when overlay exists', () => {
    const overlay = new Map();
    overlay.set('11111111-1111-4111-8111-111111111111', {
      assignedLineId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      assignedBucketKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::all',
      assignmentType: 'whole_order' as const
    });
    const result = adaptWorkHierarchyToScheme(makeHierarchy(), overlay);
    const order = result.areas[0].lines[0].buckets[0].orders[0];
    expect(order.assignmentStatus).toBe('assigned');
    expect(order.localAssignment).not.toBeNull();
    expect(order.localAssignment!.assignedLineId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(order.localAssignment!.assignedBucketKey).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::all');
  });
});

describe('adaptWorkHierarchyToScheme - null bucket handling', () => {
  it('handles null bucketName correctly', () => {
    const hierarchy = makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [makeBucket({
            bucketName: null,
            displayName: 'קו ראשי'
          })]
        })]
      })]
    });
    const result = adaptWorkHierarchyToScheme(hierarchy);
    const bucket = result.areas[0].lines[0].buckets[0];
    expect(bucket.bucketName).toBeNull();
    expect(bucket.displayName).toBe('קו ראשי');
    expect(bucket.bucketKey).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::__null_bucket__');
  });

  it('handles multiple orders in null bucket with overlay', () => {
    const hierarchy = makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [makeBucket({
            bucketName: null,
            displayName: 'קו ראשי',
            totalOrders: 2,
            totalQuantity: 200,
            orders: [
              makeOrder({ orderId: 'o1', orderNumber: 'SO1', totalQuantity: 80 }),
              makeOrder({ orderId: 'o2', orderNumber: 'SO2', totalQuantity: 120 })
            ]
          })]
        })]
      })]
    });
    const overlay = new Map();
    overlay.set('o1', {
      assignedLineId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      assignedBucketKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::__null_bucket__',
      assignmentType: 'whole_order' as const
    });
    const result = adaptWorkHierarchyToScheme(hierarchy, overlay);
    const orders = result.areas[0].lines[0].buckets[0].orders;
    expect(orders[0].assignmentStatus).toBe('assigned');
    expect(orders[0].localAssignment!.assignedBucketKey).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa::__null_bucket__');
    expect(orders[1].assignmentStatus).toBe('unassigned');
  });

  it('handles empty buckets array', () => {
    const hierarchy = makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({ buckets: [] })]
      })]
    });
    const result = adaptWorkHierarchyToScheme(hierarchy);
    expect(result.areas[0].lines[0].buckets).toHaveLength(0);
  });
});

describe('adaptWorkHierarchyToScheme - sourceZone handling', () => {
  it('preserves sourceZone from order when present', () => {
    const hierarchy = makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [makeBucket({
            orders: [makeOrder({ sourceZone: 'צפון' })]
          })]
        })]
      })]
    });
    const result = adaptWorkHierarchyToScheme(hierarchy);
    const order = result.areas[0].lines[0].buckets[0].orders[0];
    expect(order.sourceZone).toBe('צפון');
  });

  it('sets sourceZone to null when missing', () => {
    const hierarchy = makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [makeBucket({
            orders: [makeOrder({ sourceZone: undefined })]
          })]
        })]
      })]
    });
    const result = adaptWorkHierarchyToScheme(hierarchy);
    const order = result.areas[0].lines[0].buckets[0].orders[0];
    expect(order.sourceZone).toBeNull();
  });
});

describe('adaptWorkHierarchyToScheme - area grouping', () => {
  it('handles multiple areas with same layout', () => {
    const hierarchy = makeHierarchy({
      areas: [
        makeArea({ areaName: 'north', displayName: 'צפון', lines: [makeLine({ lineGroupName: 'צפוני 1' })] }),
        makeArea({ areaName: 'south', displayName: 'דרום', lines: [makeLine({ lineGroupName: 'דרומי 1' })] })
      ]
    });
    const result = adaptWorkHierarchyToScheme(hierarchy);
    expect(result.areas).toHaveLength(2);
    expect(result.areas[0].displayName).toBe('צפון');
    expect(result.areas[1].displayName).toBe('דרום');
  });

  it('handles area with null areaName', () => {
    const hierarchy = makeHierarchy({
      areas: [makeArea({ areaName: null, displayName: 'ללא איזור' })]
    });
    const result = adaptWorkHierarchyToScheme(hierarchy);
    expect(result.areas[0].areaName).toBeNull();
    expect(result.areas[0].displayName).toBe('ללא איזור');
  });
});

describe('adaptOrderItemsToSchemeRows', () => {
  it('maps all item fields correctly', () => {
    const items: ManualShiftOrderItem[] = [makeItem()];
    const rows = adaptOrderItemsToSchemeRows(items);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('item-11111111-1111-4111-8111-111111111111');
    expect(rows[0].orderId).toBe('order-11111111-1111-4111-8111-111111111111');
    expect(rows[0].sku).toBe('SKU-001');
    expect(rows[0].description).toBe('מוצר לדוגמה');
    expect(rows[0].category).toBe('כללי');
    expect(rows[0].quantity).toBe(10);
    expect(rows[0].notes).toBeNull();
    expect(rows[0].zone).toBeNull();
    expect(rows[0].sourceRows).toBeNull();
    expect(rows[0].sourceFile).toBeNull();
  });

  it('handles empty array', () => {
    const rows = adaptOrderItemsToSchemeRows([]);
    expect(rows).toHaveLength(0);
  });

  it('handles multiple items', () => {
    const items: ManualShiftOrderItem[] = [
      makeItem({ id: 'i1', sku: 'SKU-001', quantity: 5 }),
      makeItem({ id: 'i2', sku: 'SKU-002', quantity: 10 }),
      makeItem({ id: 'i3', sku: 'SKU-003', quantity: 15 })
    ];
    const rows = adaptOrderItemsToSchemeRows(items);
    expect(rows).toHaveLength(3);
    expect(rows[0].quantity).toBe(5);
    expect(rows[1].quantity).toBe(10);
    expect(rows[2].quantity).toBe(15);
  });

  it('maps nullable description as null', () => {
    const items: ManualShiftOrderItem[] = [makeItem({ description: null })];
    const rows = adaptOrderItemsToSchemeRows(items);
    expect(rows[0].description).toBeNull();
  });

  it('maps notes, zone, sourceRows, sourceFile', () => {
    const items: ManualShiftOrderItem[] = [makeItem({
      notes: 'הערה חשובה',
      zone: 'מזרח',
      sourceRows: [1, 3, 5],
      sourceFile: 'import.xlsx'
    })];
    const rows = adaptOrderItemsToSchemeRows(items);
    expect(rows[0].notes).toBe('הערה חשובה');
    expect(rows[0].zone).toBe('מזרח');
    expect(rows[0].sourceRows).toEqual([1, 3, 5]);
    expect(rows[0].sourceFile).toBe('import.xlsx');
  });

  it('does not leak domain-only fields', () => {
    const items: ManualShiftOrderItem[] = [makeItem()];
    const rows = adaptOrderItemsToSchemeRows(items);
    const row = rows[0] as unknown as Record<string, unknown>;
    expect(row.tenantId).toBeUndefined();
    expect(row.sortOrder).toBeUndefined();
    expect(row.createdAt).toBeUndefined();
    expect(row.sourceSheet).toBeUndefined();
  });
});

describe('buildBucketKeyForStore', () => {
  it('builds key with non-null bucketName', () => {
    const key = buildBucketKeyForStore('line-1', 'all');
    expect(key).toBe('line-1::all');
  });

  it('builds key with null bucketName', () => {
    const key = buildBucketKeyForStore('line-1', null);
    expect(key).toBe(`line-1::${NULL_BUCKET_PREFIX}`);
  });

  it('produces consistent keys for same input', () => {
    const a = buildBucketKeyForStore('line-1', 'general');
    const b = buildBucketKeyForStore('line-1', 'general');
    expect(a).toBe(b);
  });
});

describe('parseBucketKey', () => {
  it('parses normal bucket key', () => {
    const result = parseBucketKey('line-1::all');
    expect(result.lineId).toBe('line-1');
    expect(result.bucketName).toBe('all');
  });

  it('parses null bucket key', () => {
    const result = parseBucketKey(`line-1::${NULL_BUCKET_PREFIX}`);
    expect(result.lineId).toBe('line-1');
    expect(result.bucketName).toBeNull();
  });

  it('returns lineId as bucketName when no separator', () => {
    const result = parseBucketKey('line-1');
    expect(result.lineId).toBe('line-1');
    expect(result.bucketName).toBeNull();
  });

  it('handles bucketName with special characters', () => {
    const result = parseBucketKey('line-1::מזרח-1');
    expect(result.lineId).toBe('line-1');
    expect(result.bucketName).toBe('מזרח-1');
  });

  it('handles double-colon in lineId gracefully', () => {
    const result = parseBucketKey('line::1::bucket');
    expect(result.lineId).toBe('line');
    expect(result.bucketName).toBe('1::bucket');
  });
});

describe('NULL_BUCKET_PREFIX', () => {
  it('is a string constant', () => {
    expect(NULL_BUCKET_PREFIX).toBe('__null_bucket__');
  });
});

describe('NULL_BUCKET_DISPLAY', () => {
  it('is קו ראשי', () => {
    expect(NULL_BUCKET_DISPLAY).toBe('קו ראשי');
  });
});

describe('duplicate orderNumber safety', () => {
  it('assignment keys use orderId not orderNumber', () => {
    const hierarchy = makeHierarchy({
      areas: [makeArea({
        lines: [makeLine({
          buckets: [makeBucket({
            orders: [
              makeOrder({ orderId: 'o1', orderNumber: 'SO-001' }),
              makeOrder({ orderId: 'o2', orderNumber: 'SO-001' })
            ]
          })]
        })]
      })]
    });
    const overlay = new Map();
    overlay.set('o1', {
      assignedLineId: 'line-1',
      assignedBucketKey: 'line-1::all',
      assignmentType: 'whole_order' as const
    });
    const result = adaptWorkHierarchyToScheme(hierarchy, overlay);
    const orders = result.areas[0].lines[0].buckets[0].orders;
    expect(orders).toHaveLength(2);
    expect(orders[0].assignmentStatus).toBe('assigned');
    expect(orders[1].assignmentStatus).toBe('unassigned');
    expect(orders[0].localAssignment).not.toBeNull();
    expect(orders[1].localAssignment).toBeNull();
  });
});
