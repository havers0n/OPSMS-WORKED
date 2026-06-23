import { describe, expect, it, beforeEach } from 'vitest';
import { useSchemeBuilderStore } from './scheme-store';
import { getOrderBadgeStatus, getOrderProgress, filterOrdersBySearch, filterOrdersByStatus } from './order-list-utils';
import type { SourceOrder, SourceOrderItem, ItemAllocation } from './scheme-types';

function makeOrder(overrides: Partial<SourceOrder> = {}): SourceOrder {
  return {
    orderId: 'order-1',
    orderNumber: 'SO-001',
    customerName: 'לקוח אלfa',
    pointName: 'נקודה א',
    sourceZone: null,
    backendStatus: 'queued',
    totalQuantity: 50,
    itemLinesCount: 5,
    hasAshlama: false,
    hasCheckUnits: false,
    sourceDeliveryLine: { lineId: 'line-1', lineGroupName: 'דרומי 1', distributionArea: 'דרום', lineKind: 'delivery_channel' },
    areaName: 'south',
    areaDisplayName: 'דרום',
    ...overrides,
  };
}

function makeItem(id: string, orderId: string, qty: number, overrides: Partial<SourceOrderItem> = {}): SourceOrderItem {
  return {
    id,
    orderId,
    sku: 'SKU-' + id,
    description: 'מוצר ' + id,
    category: 'כללי',
    quantity: qty,
    notes: null,
    zone: null,
    sourceRows: null,
    sourceFile: null,
    ...overrides,
  };
}

function makeAlloc(itemRowId: string, workGroupId: string, qty: number): ItemAllocation {
  return { id: `alloc-${itemRowId}-${workGroupId}`, itemRowId, workGroupId, qty, createdAt: Date.now() };
}

function resetStore() {
  useSchemeBuilderStore.setState({
    selectedAreaName: null,
    planningLines: [],
    workGroups: [],
    itemAllocations: [],
    targetWorkGroupId: null,
  });
}

describe('getOrderBadgeStatus', () => {
  beforeEach(() => resetStore());

  it('returns not_loaded when order has no entry in orderItemMap', () => {
    const status = getOrderBadgeStatus('order-1', {}, []);
    expect(status).toBe('not_loaded');
  });

  it('returns not_loaded when orderItemMap has entry but empty array', () => {
    const status = getOrderBadgeStatus('order-1', { 'order-1': [] }, []);
    expect(status).toBe('not_loaded');
  });

  it('returns unassigned when items loaded but all have 0 assigned qty', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const status = getOrderBadgeStatus('order-1', { 'order-1': items }, []);
    expect(status).toBe('unassigned');
  });

  it('returns assigned when all items fully allocated to one group', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const allocations = [
      makeAlloc('i1', 'wg-1', 10),
      makeAlloc('i2', 'wg-1', 5),
    ];
    const status = getOrderBadgeStatus('order-1', { 'order-1': items }, allocations);
    expect(status).toBe('assigned');
  });

  it('returns partial when some qty remains', () => {
    const items = [makeItem('i1', 'order-1', 10)];
    const allocations = [makeAlloc('i1', 'wg-1', 4)];
    const status = getOrderBadgeStatus('order-1', { 'order-1': items }, allocations);
    expect(status).toBe('partial');
  });

  it('returns split when same item allocated to multiple groups', () => {
    const items = [makeItem('i1', 'order-1', 10)];
    const allocations = [
      makeAlloc('i1', 'wg-1', 4),
      makeAlloc('i1', 'wg-2', 6),
    ];
    const status = getOrderBadgeStatus('order-1', { 'order-1': items }, allocations);
    expect(status).toBe('split');
  });

  it('returns split when different items go to different groups (even if fully allocated)', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const allocations = [
      makeAlloc('i1', 'wg-1', 10),
      makeAlloc('i2', 'wg-2', 5),
    ];
    const status = getOrderBadgeStatus('order-1', { 'order-1': items }, allocations);
    expect(status).toBe('split');
  });
});

describe('getOrderProgress', () => {
  it('returns null when order not loaded', () => {
    expect(getOrderProgress('order-1', {}, [])).toBeNull();
  });

  it('returns null when orderItemMap has empty array', () => {
    expect(getOrderProgress('order-1', { 'order-1': [] }, [])).toBeNull();
  });

  it('returns correct progress for partially allocated order', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const allocations = [makeAlloc('i1', 'wg-1', 4)];
    const progress = getOrderProgress('order-1', { 'order-1': items }, allocations);
    expect(progress).toEqual({ allocatedQty: 4, totalQty: 15, allocatedRows: 1, totalRows: 2 });
  });

  it('returns correct progress for fully allocated order', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const allocations = [
      makeAlloc('i1', 'wg-1', 10),
      makeAlloc('i2', 'wg-1', 5),
    ];
    const progress = getOrderProgress('order-1', { 'order-1': items }, allocations);
    expect(progress).toEqual({ allocatedQty: 15, totalQty: 15, allocatedRows: 2, totalRows: 2 });
  });

  it('returns 0/0 for loaded but unallocated order', () => {
    const items = [makeItem('i1', 'order-1', 10), makeItem('i2', 'order-1', 5)];
    const progress = getOrderProgress('order-1', { 'order-1': items }, []);
    expect(progress).toEqual({ allocatedQty: 0, totalQty: 15, allocatedRows: 0, totalRows: 2 });
  });

  it('sums allocations across multiple work groups', () => {
    const items = [makeItem('i1', 'order-1', 10)];
    const allocations = [
      makeAlloc('i1', 'wg-1', 4),
      makeAlloc('i1', 'wg-2', 6),
    ];
    const progress = getOrderProgress('order-1', { 'order-1': items }, allocations);
    expect(progress).toEqual({ allocatedQty: 10, totalQty: 10, allocatedRows: 1, totalRows: 1 });
  });
});

describe('filterOrdersBySearch', () => {
  const orders = [
    makeOrder({ orderId: 'o1', orderNumber: 'SO-100', customerName: 'לקוח אלfa' }),
    makeOrder({ orderId: 'o2', orderNumber: 'SO-200', customerName: 'בן דוד' }),
    makeOrder({ orderId: 'o3', orderNumber: 'SO-300', customerName: 'כהן', sourceDeliveryLine: { lineId: 'l2', lineGroupName: 'צפוני 2', distributionArea: 'צפון', lineKind: 'route' } }),
  ];

  it('returns all orders when query is empty', () => {
    expect(filterOrdersBySearch(orders, '', {})).toHaveLength(3);
  });

  it('filters by order number', () => {
    const result = filterOrdersBySearch(orders, 'SO-100', {});
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o1');
  });

  it('filters by customer name', () => {
    const result = filterOrdersBySearch(orders, 'בן דוד', {});
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o2');
  });

  it('filters by source delivery line name', () => {
    const result = filterOrdersBySearch(orders, 'צפוני', {});
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o3');
  });

  it('filters by loaded SKU', () => {
    const orderItemMap = {
      'o1': [makeItem('i1', 'o1', 10, { sku: 'ABC-123' })],
    };
    const result = filterOrdersBySearch(orders, 'ABC-123', orderItemMap);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o1');
  });

  it('filters by loaded item description', () => {
    const orderItemMap = {
      'o2': [makeItem('i2', 'o2', 5, { description: 'מגש פלסטיק' })],
    };
    const result = filterOrdersBySearch(orders, 'מגש', orderItemMap);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o2');
  });

  it('does not filter by SKU of unloaded orders', () => {
    const result = filterOrdersBySearch(orders, 'UNLOADED-SKU', {});
    expect(result).toHaveLength(0);
  });

  it('no eager item fetching: only searches loaded items from orderItemMap', () => {
    const spy = { called: false };
    const handler = new Proxy({}, {
      get: () => { spy.called = true; },
    });
    const orderItemMap = handler as unknown as Record<string, SourceOrderItem[]>;
    filterOrdersBySearch(orders, '', orderItemMap);
    expect(spy.called).toBe(false);
  });

  it('case insensitive search', () => {
    const result = filterOrdersBySearch(orders, 'so-100', {});
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o1');
  });
});

describe('filterOrdersByStatus', () => {
  const orders = [
    makeOrder({ orderId: 'o1' }),
    makeOrder({ orderId: 'o2' }),
    makeOrder({ orderId: 'o3' }),
    makeOrder({ orderId: 'o4' }),
  ];

  const items = (id: string) => [makeItem('i-' + id, id, 10)];

  it('returns all orders when filter is all', () => {
    const result = filterOrdersByStatus(orders, 'all', {}, []);
    expect(result).toHaveLength(4);
  });

  it('filters not_loaded orders', () => {
    const result = filterOrdersByStatus(orders, 'not_loaded', {}, []);
    expect(result).toHaveLength(4);
  });

  it('filters unassigned orders (loaded but no allocations)', () => {
    const orderItemMap = { 'o1': items('o1') };
    const result = filterOrdersByStatus(orders, 'unassigned', orderItemMap, []);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o1');
  });

  it('filters assigned orders', () => {
    const orderItemMap = { 'o2': items('o2') };
    const allocations = [makeAlloc('i-o2', 'wg-1', 10)];
    const result = filterOrdersByStatus(orders, 'assigned', orderItemMap, allocations);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o2');
  });

  it('filters partial orders', () => {
    const orderItemMap = { 'o3': items('o3') };
    const allocations = [makeAlloc('i-o3', 'wg-1', 4)];
    const result = filterOrdersByStatus(orders, 'partial', orderItemMap, allocations);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o3');
  });

  it('filters split orders', () => {
    const orderItemMap = { 'o4': items('o4') };
    const allocations = [makeAlloc('i-o4', 'wg-1', 4), makeAlloc('i-o4', 'wg-2', 6)];
    const result = filterOrdersByStatus(orders, 'split', orderItemMap, allocations);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o4');
  });
});
