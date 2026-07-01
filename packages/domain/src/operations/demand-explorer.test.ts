import { describe, it, expect } from 'vitest';
import {
  demandExplorerOrderStatusSchema,
  demandExplorerItemSchema,
  demandExplorerOrderSchema,
  demandExplorerQuerySchema,
  demandExplorerResponseSchema,
  demandExplorerItemsResponseSchema,
  isUserVisiblePlanningBucket,
  computeExplorerOrderStatus,
  computeExplorerRemainingQuantity,
  computeExplorerSkuCount,
  computeOrderGroupKey,
  hashOrderGroupKey,
} from './demand-explorer';

describe('demandExplorerOrderStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(demandExplorerOrderStatusSchema.parse('unassigned')).toBe('unassigned');
    expect(demandExplorerOrderStatusSchema.parse('partial')).toBe('partial');
    expect(demandExplorerOrderStatusSchema.parse('assigned')).toBe('assigned');
    expect(demandExplorerOrderStatusSchema.parse('over_allocated')).toBe('over_allocated');
  });

  it('rejects invalid status', () => {
    expect(() => demandExplorerOrderStatusSchema.parse('available')).toThrow();
    expect(() => demandExplorerOrderStatusSchema.parse('foo')).toThrow();
  });
});

describe('demandExplorerItemSchema', () => {
  it('parses a valid item', () => {
    const item = demandExplorerItemSchema.parse({
      itemId: '00000000-0000-0000-0000-000000000001',
      sku: 'SKU-001',
      description: 'חלב עמיד',
      category: 'מוצרי חלב',
      quantity: 50,
      assignedQuantity: 20,
      remainingQuantity: 30,
      status: 'unplanned'
    });
    expect(item.sku).toBe('SKU-001');
    expect(item.remainingQuantity).toBe(30);
  });

  it('rejects negative quantity', () => {
    expect(() => demandExplorerItemSchema.parse({
      itemId: '00000000-0000-0000-0000-000000000001',
      sku: 'SKU-001',
      description: null,
      category: null,
      quantity: -1,
      assignedQuantity: 0,
      remainingQuantity: 0,
      status: 'unplanned'
    })).toThrow();
  });
});

describe('demandExplorerOrderSchema', () => {
  it('parses a valid order', () => {
    const order = demandExplorerOrderSchema.parse({
      orderId: 'order_abc123',
      orderNumber: 'SO-12345',
      customerName: 'תנובה',
      distributionArea: 'צפון',
      rowCount: 8,
      skuCount: 12,
      totalQuantity: 350,
      assignedQuantity: 200,
      remainingQuantity: 150,
      publishedQuantity: 0,
      status: 'partial'
    });
    expect(order.orderId).toBe('order_abc123');
    expect(order.remainingQuantity).toBe(150);
  });
});

describe('demandExplorerQuerySchema', () => {
  it('applies defaults', () => {
    const q = demandExplorerQuerySchema.parse({});
    expect(q.page).toBe(1);
    expect(q.limit).toBe(20);
    expect(q.distributionArea).toBeUndefined();
    expect(q.search).toBeUndefined();
    expect(q.status).toBeUndefined();
  });

  it('parses string coerce for page/limit', () => {
    const q = demandExplorerQuerySchema.parse({ page: '2', limit: '10' });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(10);
  });

  it('rejects limit over 100', () => {
    expect(() => demandExplorerQuerySchema.parse({ limit: 200 })).toThrow();
  });
});

describe('demandExplorerResponseSchema', () => {
  it('parses a valid response', () => {
    const resp = demandExplorerResponseSchema.parse({
      orders: [{
        orderId: 'o1',
        orderNumber: 'SO-1',
        customerName: 'c1',
        distributionArea: 'צפון',
        rowCount: 2,
        skuCount: 1,
        totalQuantity: 100,
        assignedQuantity: 50,
        remainingQuantity: 50,
        publishedQuantity: 0,
        status: 'partial'
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      summary: {
        totalOrders: 1,
        totalSkuCount: 1,
        totalQuantity: 100,
        totalAssignedQuantity: 50,
        totalRemainingQuantity: 50
      }
    });
    expect(resp.orders).toHaveLength(1);
    expect(resp.pagination.total).toBe(1);
  });
});

describe('demandExplorerItemsResponseSchema', () => {
  it('parses a valid items response', () => {
    const resp = demandExplorerItemsResponseSchema.parse({
      orderId: 'o1',
      items: [{
        itemId: '00000000-0000-0000-0000-000000000001',
        sku: 'SKU-1',
        description: 'desc',
        category: 'cat',
        quantity: 10,
        assignedQuantity: 5,
        remainingQuantity: 5,
        status: 'unplanned'
      }]
    });
    expect(resp.items).toHaveLength(1);
  });
});

describe('isUserVisiblePlanningBucket', () => {
  it('returns true for normal buckets', () => {
    expect(isUserVisiblePlanningBucket({ planningLineName: 'line1', bucketName: 'group1' })).toBe(true);
  });

  it('returns false for default planning line', () => {
    expect(isUserVisiblePlanningBucket({ planningLineName: 'default', bucketName: 'group1' })).toBe(false);
  });

  it('returns false for unassigned bucket', () => {
    expect(isUserVisiblePlanningBucket({ planningLineName: 'line1', bucketName: 'unassigned' })).toBe(false);
  });

  it('returns false when both are technical names', () => {
    expect(isUserVisiblePlanningBucket({ planningLineName: 'default', bucketName: 'unassigned' })).toBe(false);
  });
});

describe('computeExplorerOrderStatus', () => {
  it('returns unassigned when total is zero', () => {
    expect(computeExplorerOrderStatus(0, 0)).toBe('unassigned');
  });

  it('returns unassigned when nothing is assigned', () => {
    expect(computeExplorerOrderStatus(100, 0)).toBe('unassigned');
  });

  it('returns partial when some is assigned', () => {
    expect(computeExplorerOrderStatus(100, 50)).toBe('partial');
  });

  it('returns assigned when fully assigned', () => {
    expect(computeExplorerOrderStatus(100, 100)).toBe('assigned');
  });

  it('returns over_allocated when significantly over', () => {
    expect(computeExplorerOrderStatus(100, 120)).toBe('over_allocated');
  });
});

describe('computeExplorerRemainingQuantity', () => {
  it('computes remaining as total minus assigned', () => {
    expect(computeExplorerRemainingQuantity(100, 30)).toBe(70);
  });

  it('returns 0 when fully assigned', () => {
    expect(computeExplorerRemainingQuantity(100, 100)).toBe(0);
  });

  it('returns 0 when over assigned', () => {
    expect(computeExplorerRemainingQuantity(100, 150)).toBe(0);
  });
});

describe('computeExplorerSkuCount', () => {
  it('counts distinct non-null SKUs', () => {
    const rows = [
      { sku: 'A' }, { sku: 'B' }, { sku: 'A' }, { sku: null }
    ];
    expect(computeExplorerSkuCount(rows)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(computeExplorerSkuCount([])).toBe(0);
  });

  it('returns 0 when all SKUs are null', () => {
    const rows = [{ sku: null }, { sku: null }];
    expect(computeExplorerSkuCount(rows)).toBe(0);
  });
});

describe('computeOrderGroupKey', () => {
  it('includes all four fields', () => {
    const key = computeOrderGroupKey({
      distributionArea: 'צפון',
      orderNumber: 'SO-1',
      customerName: 'תנובה',
      plannedDeliveryDate: '2026-07-15',
    });
    expect(key).toBe('צפון|SO-1|תנובה|2026-07-15');
  });

  it('handles null fields as empty string', () => {
    const key = computeOrderGroupKey({
      distributionArea: null,
      orderNumber: 'SO-1',
      customerName: null,
      plannedDeliveryDate: null,
    });
    expect(key).toBe('|SO-1||');
  });
});

describe('hashOrderGroupKey', () => {
  it('returns deterministic results', () => {
    const key = computeOrderGroupKey({
      distributionArea: 'צפון',
      orderNumber: 'SO-1',
      customerName: 'תנובה',
      plannedDeliveryDate: '2026-07-15',
    });
    const h1 = hashOrderGroupKey(key);
    const h2 = hashOrderGroupKey(key);
    expect(h1).toBe(h2);
  });

  it('different distributionArea produces different hash', () => {
    const key1 = computeOrderGroupKey({ distributionArea: 'צפון', orderNumber: 'SO-1', customerName: 'תנובה', plannedDeliveryDate: null });
    const key2 = computeOrderGroupKey({ distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'תנובה', plannedDeliveryDate: null });
    expect(hashOrderGroupKey(key1)).not.toBe(hashOrderGroupKey(key2));
  });

  it('same data with same date produces same hash', () => {
    const a = computeOrderGroupKey({ distributionArea: 'צפון', orderNumber: 'SO-1', customerName: 'תנובה', plannedDeliveryDate: '2026-07-15' });
    const b = computeOrderGroupKey({ distributionArea: 'צפון', orderNumber: 'SO-1', customerName: 'תנובה', plannedDeliveryDate: '2026-07-15' });
    expect(hashOrderGroupKey(a)).toBe(hashOrderGroupKey(b));
  });

  it('different date produces different hash', () => {
    const a = computeOrderGroupKey({ distributionArea: 'צפון', orderNumber: 'SO-1', customerName: 'תנובה', plannedDeliveryDate: '2026-07-15' });
    const b = computeOrderGroupKey({ distributionArea: 'צפון', orderNumber: 'SO-1', customerName: 'תנובה', plannedDeliveryDate: '2026-07-16' });
    expect(hashOrderGroupKey(a)).not.toBe(hashOrderGroupKey(b));
  });
});
