import { describe, expect, it } from 'vitest';
import { classifyRouteFragments, type RouteFragmentInput } from '@wos/domain';
import type {
  ManualShiftLine,
  ManualShiftOrder,
  ManualShiftOrderCheckUnit,
  ManualShiftOrderAshlama,
  ManualShiftOrderItem,
  ManualShiftWorkHierarchyResponse,
  BucketProductRollupRow
} from '@wos/domain';
import {
  buildManualShiftSourceZoneDiagnostics,
  buildShiftWorkHierarchy,
  inferManualShiftOrderSourceZone,
  createManualShiftsRepo
} from './repo.js';

type ManualShiftLineRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  name: string;
  distribution_area: string | null;
  sort_order: number;
  created_at: string;
  deleted_at: string | null;
  deleted_by_profile_id: string | null;
  deleted_by_name: string | null;
  delete_reason: string | null;
};

const SHIFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LINE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORDER_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ORDER_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function makeLineRow(
  overrides: Partial<ManualShiftLineRow> = {}
): ManualShiftLineRow {
  return {
    id: LINE_A,
    tenant_id: 't1',
    shift_id: SHIFT_ID,
    name: 'קו דרום',
    distribution_area: 'דרום',
    sort_order: 1,
    created_at: '2026-06-14T06:00:00.000Z',
    deleted_at: null,
    deleted_by_profile_id: null,
    deleted_by_name: null,
    delete_reason: null,
    ...overrides
  };
}

function makeOrder(overrides: Partial<ManualShiftOrder> = {}): ManualShiftOrder {
  return {
    id: ORDER_1,
    tenantId: 't1',
    shiftId: SHIFT_ID,
    lineId: LINE_A,
    orderNumber: 'SO-1',
    customerName: 'לקוח א',
    pointName: 'סלולר',
    palletCount: null,
    pickerName: null,
    pickerWorkerId: null,
    checkerName: null,
    lineCount: null,
    sortOrder: null,
    size: 'unknown',
    status: 'queued',
    startedAt: null,
    checkStartedAt: null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: '2026-06-14T06:00:00.000Z',
    updatedAt: '2026-06-14T06:00:00.000Z',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null,
    ...overrides
  };
}

function makeItem(overrides: Partial<ManualShiftOrderItem> & { id: string; orderId: string; lineId: string }): ManualShiftOrderItem {
  const { id, orderId, lineId, ...rest } = overrides;
  return {
    id,
    tenantId: 't1',
    shiftId: SHIFT_ID,
    lineId,
    orderId,
    sku: 'SKU-1',
    description: null,
    category: null,
    quantity: 1,
    notes: null,
    zone: null,
    sourceSheet: 'יוני 26',
    sourceRows: [2],
    sourceFile: 'monthly.xlsx',
    sortOrder: 1,
    createdAt: '2026-06-14T06:00:00.000Z',
    ...rest
  };
}

function makeLineEntity(overrides: Partial<ManualShiftLine> = {}): ManualShiftLine {
  return {
    id: LINE_A,
    tenantId: 't1',
    shiftId: SHIFT_ID,
    name: 'שפלה 2',
    distributionArea: 'שפלה אמצעי',
    sortOrder: 1,
    status: 'open',
    createdAt: '2026-06-14T06:00:00.000Z',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null,
    ...overrides
  };
}

describe('buildShiftWorkHierarchy', () => {
  it('groups orders by pointName (legacy) into work buckets within a line', () => {
    const lineRows = [makeLineRow()];
    const orders = [
      makeOrder({ id: ORDER_1, pointName: 'סלולר', orderNumber: 'SO-1', customerName: 'לקוח א', sourceZone: 'דרום' }),
      makeOrder({ id: ORDER_2, pointName: 'סלולר', orderNumber: 'SO-2', customerName: 'לקוח א', sourceZone: 'דרום' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 10 });
    rollups.set(ORDER_2, { lineCount: 0, totalQuantity: 5 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    expect(result.shiftId).toBe(SHIFT_ID);
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].areaName).toBe('דרום');
    expect(result.areas[0].lines).toHaveLength(1);
    expect(result.areas[0].lines[0].buckets).toHaveLength(1);
    expect(result.areas[0].lines[0].buckets[0].bucketName).toBe('סלולר');
    expect(result.areas[0].lines[0].buckets[0].totalOrders).toBe(2);
    expect(result.areas[0].lines[0].buckets[0].totalQuantity).toBe(15);
  });

  it('separates different pointNames into different work buckets', () => {
    const lineRows = [makeLineRow()];
    const orders = [
      makeOrder({ id: ORDER_1, pointName: 'סלולר', orderNumber: 'SO-1', customerName: 'פז השקמה', sourceZone: 'דרום' }),
      makeOrder({ id: ORDER_2, pointName: 'פז השקמה', orderNumber: 'SO-2', customerName: 'דלק', sourceZone: 'דרום' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 10 });
    rollups.set(ORDER_2, { lineCount: 0, totalQuantity: 20 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    expect(result.areas[0].lines[0].buckets).toHaveLength(2);
    const bucketNames = result.areas[0].lines[0].buckets.map((b) => b.bucketName).sort();
    expect(bucketNames).toEqual(['סלולר', 'פז השקמה']);
  });

  it('same orderNumber across different pointNames = separate bucket fragments', () => {
    const lineRows = [makeLineRow()];
    const orders = [
      makeOrder({ id: ORDER_1, pointName: 'סלולר', orderNumber: 'SO-1', customerName: 'לקוח א', sourceZone: 'דרום' }),
      makeOrder({ id: ORDER_2, pointName: 'פז השקמה', orderNumber: 'SO-1', customerName: 'לקוח א', sourceZone: 'דרום' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 10 });
    rollups.set(ORDER_2, { lineCount: 0, totalQuantity: 20 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    // One order number, but two bucket fragments
    expect(result.areas[0].lines[0].buckets).toHaveLength(2);
    expect(result.areas[0].lines[0].totalOrders).toBe(2);

    // Each fragment has the correct customerName and orderNumber
    const bucket1 = result.areas[0].lines[0].buckets.find((b) => b.bucketName === 'סלולר')!;
    expect(bucket1.orders[0].orderNumber).toBe('SO-1');
    expect(bucket1.orders[0].customerName).toBe('לקוח א');

    const bucket2 = result.areas[0].lines[0].buckets.find((b) => b.bucketName === 'פז השקמה')!;
    expect(bucket2.orders[0].orderNumber).toBe('SO-1');
    expect(bucket2.orders[0].customerName).toBe('לקוח א');
  });

  it('groups lines by distributionArea into areas', () => {
    const LINE_B = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const ORDER_3 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const lineRows = [
      makeLineRow({ id: LINE_A, name: 'קו דרום', distribution_area: 'דרום' }),
      makeLineRow({ id: LINE_B, name: 'קו צפון', distribution_area: 'צפון' })
    ];
    const orders = [
      makeOrder({ id: ORDER_1, lineId: LINE_A, pointName: 'סלולר', orderNumber: 'SO-1', sourceZone: 'דרום' }),
      makeOrder({ id: ORDER_2, lineId: LINE_B, pointName: 'מרכז', orderNumber: 'SO-2', sourceZone: 'צפון' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 5 });
    rollups.set(ORDER_2, { lineCount: 0, totalQuantity: 10 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    expect(result.areas).toHaveLength(2);
    const areaNames = result.areas.map((a) => a.areaName).sort();
    expect(areaNames).toEqual(['דרום', 'צפון']);
  });

  it('line with null distributionArea is grouped under "ללא איזור"', () => {
    const lineRows = [makeLineRow({ distribution_area: null })];
    const orders = [makeOrder({ sourceZone: null })];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 5 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].areaName).toBeNull();
    expect(result.areas[0].displayName).toBe('ללא איזור');
  });

  it('bucketName equals order.pointName (legacy storage — mapped to workBucketName)', () => {
    const lineRows = [makeLineRow()];
    const orders = [
      makeOrder({ pointName: 'סלולר' }),
      makeOrder({ id: ORDER_2, pointName: 'פז השקמה' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 5 });
    rollups.set(ORDER_2, { lineCount: 0, totalQuantity: 10 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    for (const bucket of result.areas[0].lines[0].buckets) {
      expect(bucket.bucketName).toBe(bucket.orders[0].pointName);
    }
  });

  it('computes statusBreakdown at bucket, line, and area levels', () => {
    const lineRows = [makeLineRow()];
    const ORDERS = [ORDER_1, ORDER_2];
    const ORDER_3 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const orders = [
      makeOrder({ id: ORDER_1, pointName: 'סלולר', status: 'queued' }),
      makeOrder({ id: ORDER_2, pointName: 'סלולר', status: 'waiting_check' }),
      makeOrder({ id: ORDER_3, pointName: 'פז השקמה', status: 'done' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    for (const o of orders) rollups.set(o.id, { lineCount: 0, totalQuantity: 5 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    const buckets = result.areas[0].lines[0].buckets;
    const bucket1 = buckets.find((b) => b.bucketName === 'סלולר')!;
    expect(bucket1.statusBreakdown).toEqual({ queued: 1, picking: 0, waitingCheck: 1, returned: 0, done: 0 });

    const line = result.areas[0].lines[0];
    expect(line.statusBreakdown).toEqual({ queued: 1, picking: 0, waitingCheck: 1, returned: 0, done: 1 });

    const area = result.areas[0];
    expect(area.statusBreakdown).toEqual({ queued: 1, picking: 0, waitingCheck: 1, returned: 0, done: 1, blocked: 0 });
  });

  it('rolls up totalQuantity from rollups map into each order and bucket', () => {
    const lineRows = [makeLineRow()];
    const orders = [
      makeOrder({ id: ORDER_1, pointName: 'סלולר' }),
      makeOrder({ id: ORDER_2, pointName: 'סלולר' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 7 });
    rollups.set(ORDER_2, { lineCount: 0, totalQuantity: 13 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    const bucket = result.areas[0].lines[0].buckets[0];
    expect(bucket.totalQuantity).toBe(20);
    expect(bucket.orders.find((o) => o.orderId === ORDER_1)?.totalQuantity).toBe(7);
    expect(bucket.orders.find((o) => o.orderId === ORDER_2)?.totalQuantity).toBe(13);
  });

  it('uses item-derived totalQuantity from rollups even when order-level lineCount is null', () => {
    const lineRows = [makeLineRow()];
    const orders = [
      makeOrder({ id: ORDER_1, pointName: 'סלולר', lineCount: null }),
      makeOrder({ id: ORDER_2, pointName: 'סלולר', lineCount: null })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 10 });
    rollups.set(ORDER_2, { lineCount: 0, totalQuantity: 5 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    const bucket = result.areas[0].lines[0].buckets[0];
    expect(bucket.totalQuantity).toBe(15);
    expect(result.areas[0].lines[0].totalQuantity).toBe(15);
    expect(result.areas[0].totalQuantity).toBe(15);
  });

  it('propagates item-derived totals through all hierarchy levels', () => {
    const LINE_B = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const ORDER_3 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const lineRows = [
      makeLineRow({ id: LINE_A, name: 'קו גליל', distribution_area: 'גליל' }),
      makeLineRow({ id: LINE_B, name: 'קו צפון', distribution_area: 'צפון' })
    ];
    const orders = [
      makeOrder({ id: ORDER_1, lineId: LINE_A, pointName: 'דבאח עין המפרץ', orderNumber: 'SO26014230', lineCount: null, sourceZone: 'גליל' }),
      makeOrder({ id: ORDER_2, lineId: LINE_A, pointName: 'דבאח עין המפרץ', orderNumber: 'SO-OTHER', lineCount: null, sourceZone: 'גליל' }),
      makeOrder({ id: ORDER_3, lineId: LINE_B, pointName: 'סלולר', orderNumber: 'SO-NORTH', lineCount: null, sourceZone: 'צפון' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 7, totalQuantity: 88 });
    rollups.set(ORDER_2, { lineCount: 3, totalQuantity: 12 });
    rollups.set(ORDER_3, { lineCount: 2, totalQuantity: 40 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    expect(result.areas).toHaveLength(2);

    const galilArea = result.areas.find((a) => a.areaName === 'גליל')!;
    expect(galilArea.totalOrders).toBe(2);
    expect(galilArea.totalQuantity).toBe(100);

    const galilLine = galilArea.lines[0];
    expect(galilLine.totalOrders).toBe(2);
    expect(galilLine.totalQuantity).toBe(100);

    const bucket = galilLine.buckets[0];
    expect(bucket.totalOrders).toBe(2);
    expect(bucket.totalQuantity).toBe(100);

    const order1 = bucket.orders.find((o) => o.orderId === ORDER_1)!;
    expect(order1.orderNumber).toBe('SO26014230');
    expect(order1.totalQuantity).toBe(88);
    expect(order1.lineCount).toBe(7);
  });

  it('splits same physical line into separate source-zone areas and scopes routeGroups and legacy buckets', () => {
    const lineRows = [
      makeLineRow({
        id: LINE_A,
        name: 'שפלה 2',
        distribution_area: 'שפלה אמצעי'
      })
    ];
    const orders = [
      makeOrder({
        id: 'o-shfela-1',
        lineId: LINE_A,
        orderNumber: 'SO-SH-1',
        pointName: 'שפלה 2',
        rawRouteLine: 'שפלה 2',
        routeBase: 'שפלה 2',
        workBucketName: null,
        sourceZone: 'שפלה 2'
      }),
      makeOrder({
        id: 'o-shfela-2',
        lineId: LINE_A,
        orderNumber: 'SO-SH-2',
        pointName: 'סלולר',
        rawRouteLine: 'שפלה 2/סלולר',
        routeBase: 'שפלה 2',
        workBucketName: 'סלולר',
        sourceZone: 'שפלה 2'
      }),
      makeOrder({
        id: 'o-shfela-3',
        lineId: LINE_A,
        orderNumber: 'SO-SH-3',
        pointName: 'כוורת חצור משפחות',
        rawRouteLine: 'שפלה 2/כוורת חצור משפחות',
        routeBase: 'שפלה 2',
        workBucketName: 'כוורת חצור משפחות',
        sourceZone: 'שפלה 2'
      }),
      makeOrder({
        id: 'o-shfela-4',
        lineId: LINE_A,
        orderNumber: 'SO-SH-4',
        pointName: 'מנטה מסמיה',
        rawRouteLine: 'שפלה 2/מנטה מסמיה',
        routeBase: 'שפלה 2',
        workBucketName: 'מנטה מסמיה',
        sourceZone: 'שפלה 2'
      }),
      makeOrder({
        id: 'o-shfela-5',
        lineId: LINE_A,
        orderNumber: 'SO-SH-5',
        pointName: 'פז ברורים',
        rawRouteLine: 'שפלה 2/פז ברורים',
        routeBase: 'שפלה 2',
        workBucketName: 'פז ברורים',
        sourceZone: 'שפלה 2'
      }),
      makeOrder({
        id: 'o-shfela-6',
        lineId: LINE_A,
        orderNumber: 'SO-SH-6',
        pointName: 'תפוז עד הלום',
        rawRouteLine: 'שפלה 2/תפוז עד הלום',
        routeBase: 'שפלה 2',
        workBucketName: 'תפוז עד הלום',
        sourceZone: 'שפלה 2'
      }),
      makeOrder({
        id: 'o-mid-1',
        lineId: LINE_A,
        orderNumber: 'SO-MID-1',
        pointName: 'דור אלון טל שחר',
        rawRouteLine: 'שפלה 2/דור אלון טל שחר',
        routeBase: 'שפלה 2',
        workBucketName: 'דור אלון טל שחר',
        sourceZone: 'שפלה אמצעי'
      }),
      makeOrder({
        id: 'o-mid-2',
        lineId: LINE_A,
        orderNumber: 'SO-MID-2',
        pointName: 'סדש גדרה',
        rawRouteLine: 'שפלה 2/סדש גדרה',
        routeBase: 'שפלה 2',
        workBucketName: 'סדש גדרה',
        sourceZone: 'שפלה אמצעי'
      }),
      makeOrder({
        id: 'o-mid-3',
        lineId: LINE_A,
        orderNumber: 'SO-MID-3',
        pointName: 'רכב-פז גדרה',
        rawRouteLine: 'שפלה 2/רכב-פז גדרה',
        routeBase: 'שפלה 2',
        workBucketName: 'רכב-פז גדרה',
        sourceZone: 'שפלה אמצעי'
      }),
      makeOrder({
        id: 'o-mid-4',
        lineId: LINE_A,
        orderNumber: 'SO-MID-4',
        pointName: 'סלולר',
        rawRouteLine: 'שפלה 2/סלולר',
        routeBase: 'שפלה 2',
        workBucketName: 'סלולר',
        sourceZone: 'שפלה אמצעי'
      }),
      makeOrder({
        id: 'o-mid-5',
        lineId: LINE_A,
        orderNumber: 'SO-MID-5',
        pointName: 'שפלה 2',
        rawRouteLine: 'שפלה 2',
        routeBase: 'שפלה 2',
        workBucketName: null,
        sourceZone: 'שפלה אמצעי'
      })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>([
      ['o-shfela-1', { lineCount: 1, totalQuantity: 5 }],
      ['o-shfela-2', { lineCount: 2, totalQuantity: 4 }],
      ['o-shfela-3', { lineCount: 3, totalQuantity: 3 }],
      ['o-shfela-4', { lineCount: 4, totalQuantity: 2 }],
      ['o-shfela-5', { lineCount: 1, totalQuantity: 6 }],
      ['o-shfela-6', { lineCount: 2, totalQuantity: 7 }],
      ['o-mid-1', { lineCount: 5, totalQuantity: 8 }],
      ['o-mid-2', { lineCount: 6, totalQuantity: 9 }],
      ['o-mid-3', { lineCount: 7, totalQuantity: 10 }],
      ['o-mid-4', { lineCount: 8, totalQuantity: 11 }],
      ['o-mid-5', { lineCount: 9, totalQuantity: 12 }]
    ]);

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);
    const areasByName = new Map(result.areas.map((area) => [area.areaName, area] as const));
    const shfelaMid = areasByName.get('שפלה אמצעי')!;

    expect(result.areas.map((area) => area.areaName)).toEqual(['שפלה אמצעי']);
    expect(shfelaMid.totalOrders).toBe(11);
    expect(shfelaMid.totalQuantity).toBe(77);
    expect(shfelaMid.lines).toHaveLength(1);
    expect(shfelaMid.lines[0].lineId).toBe(LINE_A);
    expect(shfelaMid.lines[0].areaLineKey).toBe(LINE_A);
    expect(shfelaMid.lines[0].sourceZone).toBeNull();
    expect(shfelaMid.lines[0].routeGroups).toBeDefined();
    expect(shfelaMid.lines[0].buckets.every((bucket) => bucket.orders.every((order) => order.sourceZone !== null))).toBe(true);
  });
});

describe('listWarehouseStockBySku', () => {
  function createStockSupabaseStub() {
    const products = [
      { id: 'product-1', sku: 'SKU-1' },
      { id: 'product-2', sku: 'SKU-DUP' },
      { id: 'product-3', sku: 'SKU-DUP' }
    ];
    const inventoryUnits = [
      { product_id: 'product-1', quantity: 0, tenant_id: 'tenant-1', status: 'available' },
      { product_id: 'product-2', quantity: 30, tenant_id: 'tenant-1', status: 'available' },
      { product_id: 'product-3', quantity: 45, tenant_id: 'tenant-1', status: 'available' },
      { product_id: 'product-3', quantity: 10, tenant_id: 'tenant-2', status: 'available' },
      { product_id: 'product-2', quantity: 5, tenant_id: 'tenant-1', status: 'damaged' }
    ];

    return {
      from(table: string) {
        if (table === 'products') {
          let filtered = [...products];
          return {
            select() {
              return this;
            },
            in(column: 'sku', values: string[]) {
              filtered = filtered.filter((row) => values.includes(row[column]));
              return this;
            },
            then(resolve: (value: { data: typeof filtered; error: null }) => void) {
              resolve({ data: filtered, error: null });
            }
          };
        }

        if (table === 'inventory_unit') {
          let filtered = [...inventoryUnits];
          return {
            select() {
              return this;
            },
            in(column: 'product_id', values: string[]) {
              filtered = filtered.filter((row) => values.includes(row[column]));
              return this;
            },
            eq(column: 'tenant_id' | 'status', value: string) {
              filtered = filtered.filter((row) => row[column] === value);
              return this;
            },
            gt(column: 'quantity', value: number) {
              filtered = filtered.filter((row) => row[column] > value);
              return this;
            },
            then(resolve: (value: { data: typeof filtered; error: null }) => void) {
              resolve({ data: filtered, error: null });
            }
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }
    };
  }

  it('returns canonical product ids and summed tenant stock for duplicate canonical SKUs', async () => {
    const repo = createManualShiftsRepo(createStockSupabaseStub() as never);

    const result = await repo.listWarehouseStockBySku(['SKU-1', 'SKU-DUP', 'UNKNOWN'], 'tenant-1');

    expect(result.get('SKU-1')).toEqual({
      sku: 'SKU-1',
      warehouseQty: 0,
      canonicalProductIds: ['product-1']
    });
    expect(result.get('SKU-DUP')).toEqual({
      sku: 'SKU-DUP',
      warehouseQty: 75,
      canonicalProductIds: ['product-2', 'product-3']
    });
    expect(result.has('UNKNOWN')).toBe(false);
  });
});

describe('work-hierarchy reprojection', () => {
  function makeProjectedHierarchyFixture() {
    const chitaZones = ['דרום', 'חיפה', 'שפלה 1', 'שפלה 2', 'שפלה אמצעי', 'עמקים אמצעי'] as const;
    const normalSpecs = [
      { id: 'line-n1', name: 'קו דרום', area: 'דרום', orderCount: 19, totalLineCount: 100 },
      { id: 'line-n2', name: 'קו חיפה', area: 'חיפה', orderCount: 19, totalLineCount: 100 },
      { id: 'line-n3', name: 'קו שפלה 1', area: 'שפלה 1', orderCount: 19, totalLineCount: 100 },
      { id: 'line-n4', name: 'קו שפלה 2', area: 'שפלה 2', orderCount: 19, totalLineCount: 100 },
      { id: 'line-n5', name: 'קו שפלה אמצעי', area: 'שפלה אמצעי', orderCount: 19, totalLineCount: 100 },
      { id: 'line-n6', name: 'קו עמקים אמצעי', area: 'עמקים אמצעי', orderCount: 19, totalLineCount: 100 },
      { id: 'line-n7', name: 'קו צפון', area: 'צפון', orderCount: 19, totalLineCount: 100 },
      { id: 'line-n8', name: 'קו מרכז', area: 'מרכז', orderCount: 15, totalLineCount: 100 }
    ] as const;

    const lineRows = [
      makeLineRow({ id: 'line-chita', name: "צ'יטה", distribution_area: 'שפלה 1', sort_order: 1 }),
      ...normalSpecs.map((spec, index) => makeLineRow({
        id: spec.id,
        name: spec.name,
        distribution_area: spec.area,
        sort_order: index + 2
      }))
    ];

    const orders: ManualShiftOrder[] = [];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    let orderIndex = 1;

    const addOrders = (input: {
      lineId: string;
      pointName: string;
      routeBase: string;
      sourceZone: string | null;
      orderCount: number;
      totalLineCount: number;
      chita?: boolean;
    }) => {
      const base = Math.floor(input.totalLineCount / input.orderCount);
      const remainder = input.totalLineCount % input.orderCount;

      for (let i = 0; i < input.orderCount; i += 1) {
        const orderId = `order-${orderIndex}`;
        const sourceZone = input.chita ? chitaZones[i % chitaZones.length] : input.sourceZone;
        const bucketName = input.chita ? sourceZone : null;
        const lineCount = base + (i < remainder ? 1 : 0);
        orders.push(makeOrder({
          id: orderId,
          lineId: input.lineId,
          orderNumber: `SO-${String(orderIndex).padStart(4, '0')}`,
          pointName: input.chita ? sourceZone : input.pointName,
          rawRouteLine: input.chita ? `צ'יטה/${sourceZone}` : input.routeBase,
          routeBase: input.routeBase,
          workBucketName: bucketName,
          sourceZone
        }));
        rollups.set(orderId, {
          lineCount,
          totalQuantity: lineCount * 2
        });
        orderIndex += 1;
      }
    };

    addOrders({
      lineId: 'line-chita',
      pointName: "צ'יטה",
      routeBase: "צ'יטה",
      sourceZone: null,
      orderCount: 6,
      totalLineCount: 162,
      chita: true
    });

    for (const spec of normalSpecs) {
      addOrders({
        lineId: spec.id,
        pointName: spec.name,
        routeBase: spec.name,
        sourceZone: spec.area,
        orderCount: spec.orderCount,
        totalLineCount: spec.totalLineCount
      });
    }

    return { lineRows, orders, rollups };
  }

  it('buildShiftWorkHierarchy_chita_uses_order_centric_buckets', () => {
    const lineRows = [
      makeLineRow({ id: LINE_A, name: "צ'יטה", distribution_area: 'שפלה 1' })
    ];
    const orders = [
      makeOrder({ id: 'o-chita-1', lineId: LINE_A, orderNumber: 'SO-CH-1', customerName: 'לקוח א', pointName: "צ'יטה", rawRouteLine: "צ'יטה/דרום", routeBase: "צ'יטה", workBucketName: 'דרום', sourceZone: 'דרום' }),
      makeOrder({ id: 'o-chita-2', lineId: LINE_A, orderNumber: 'SO-CH-2', customerName: 'לקוח ב', pointName: "צ'יטה", rawRouteLine: "צ'יטה/דרום", routeBase: "צ'יטה", workBucketName: 'דרום', sourceZone: 'דרום' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>([
      ['o-chita-1', { lineCount: 3, totalQuantity: 7 }],
      ['o-chita-2', { lineCount: 5, totalQuantity: 11 }]
    ]);

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);
    const chitaArea = result.areas.find((area) => area.areaName === "צ'יטה");

    expect(chitaArea).toBeDefined();
    expect(chitaArea?.lines).toHaveLength(1);

    const chitaLine = chitaArea!.lines[0];
    expect(chitaLine.lineGroupName).toBe("צ'יטה");
    expect(chitaLine.routeGroups).toEqual([]);
    expect(chitaLine.buckets).toHaveLength(2);
    expect(new Set(chitaLine.buckets.map((bucket) => bucket.bucketName)).size).toBe(2);
    expect(chitaLine.buckets.map((bucket) => bucket.bucketName)).toEqual(['o-chita-1', 'o-chita-2']);
    expect(chitaLine.buckets.map((bucket) => bucket.displayName)).toEqual(['SO-CH-1', 'SO-CH-2']);
    expect(chitaLine.buckets.every((bucket) => bucket.totalOrders === 1)).toBe(true);
    expect(chitaLine.buckets.every((bucket) => bucket.orders.every((order) => order.sourceZone !== null))).toBe(true);
    expect(chitaLine.buckets[0].orders.map((order) => order.orderId)).toEqual(['o-chita-1']);
    expect(chitaLine.buckets[1].orders.map((order) => order.orderId)).toEqual(['o-chita-2']);
  });

  it('buildShiftWorkHierarchy_chita_keeps_sourceZone_as_metadata_not_bucket_key', () => {
    const lineRows = [
      makeLineRow({ id: LINE_A, name: "צ'יטה", distribution_area: 'שפלה 1' })
    ];
    const orders = [
      makeOrder({ id: 'o-chita-1', lineId: LINE_A, orderNumber: 'SO-CH-1', pointName: "צ'יטה", rawRouteLine: "צ'יטה/דרום", routeBase: "צ'יטה", workBucketName: 'דרום', sourceZone: 'דרום' }),
      makeOrder({ id: 'o-chita-2', lineId: LINE_A, orderNumber: 'SO-CH-2', pointName: "צ'יטה", rawRouteLine: "צ'יטה/דרום", routeBase: "צ'יטה", workBucketName: 'דרום', sourceZone: 'דרום' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>([
      ['o-chita-1', { lineCount: 1, totalQuantity: 4 }],
      ['o-chita-2', { lineCount: 1, totalQuantity: 6 }]
    ]);

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);
    const buckets = result.areas.find((area) => area.areaName === "צ'יטה")!.lines[0].buckets;

    expect(buckets.map((bucket) => bucket.bucketName)).toEqual(['o-chita-1', 'o-chita-2']);
    expect(buckets.every((bucket) => bucket.bucketName !== 'דרום')).toBe(true);
    expect(buckets.every((bucket) => bucket.orders[0]?.sourceZone === 'דרום')).toBe(true);
  });

  it('buildShiftWorkHierarchy_chita_does_not_leak_into_regular_distribution_areas', () => {
    const lineRows = [
      makeLineRow({ id: LINE_A, name: "צ'יטה", distribution_area: 'שפלה 1', sort_order: 1 }),
      makeLineRow({ id: 'line-normal', name: 'קו דרום', distribution_area: 'דרום', sort_order: 2 })
    ];
    const orders = [
      makeOrder({ id: 'o-chita-1', lineId: LINE_A, orderNumber: 'SO-CH-1', pointName: "צ'יטה", rawRouteLine: "צ'יטה/דרום", routeBase: "צ'יטה", workBucketName: 'דרום', sourceZone: 'דרום' }),
      makeOrder({ id: 'o-normal-1', lineId: 'line-normal', orderNumber: 'SO-N-1', pointName: 'סלולר', rawRouteLine: 'קו דרום/סלולר', routeBase: 'קו דרום', workBucketName: 'סלולר', sourceZone: 'דרום' })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>([
      ['o-chita-1', { lineCount: 2, totalQuantity: 5 }],
      ['o-normal-1', { lineCount: 3, totalQuantity: 9 }]
    ]);

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);
    const chitaArea = result.areas.find((area) => area.areaName === "צ'יטה");
    const normalArea = result.areas.find((area) => area.areaName === 'דרום');

    expect(chitaArea).toBeDefined();
    expect(normalArea).toBeDefined();
    expect(chitaArea!.lines.flatMap((line) => line.buckets.flatMap((bucket) => bucket.orders.map((order) => order.orderId)))).toEqual(['o-chita-1']);
    expect(normalArea!.lines.flatMap((line) => line.buckets.flatMap((bucket) => bucket.orders.map((order) => order.orderId)))).toEqual(['o-normal-1']);
  });

  it('keeps every physical line and order unique while preserving totals for the imported shift fixture', () => {
    const { lineRows, orders, rollups } = makeProjectedHierarchyFixture();
    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    const lineIds = result.areas.flatMap((area) => area.lines.map((line) => line.lineId));
    const orderIds = result.areas.flatMap((area) =>
      area.lines.flatMap((line) =>
        line.buckets.flatMap((bucket) => bucket.orders.map((order) => order.orderId))
      )
    );

    expect(lineIds).toHaveLength(new Set(lineIds).size);
    expect(lineIds).toHaveLength(9);
    expect(orderIds).toHaveLength(new Set(orderIds).size);
    expect(result.areas.reduce((sum, area) => sum + area.totalOrders, 0)).toBe(154);
    expect(result.areas.reduce((sum, area) => sum + area.itemLinesCount!, 0)).toBe(962);

    const chitaArea = result.areas.find((area) => area.areaName === "צ'יטה");
    expect(chitaArea).toBeDefined();
    expect(chitaArea!.lines).toHaveLength(1);
    expect(chitaArea!.lines[0].lineGroupName).toBe("צ'יטה");
    expect(chitaArea!.lines[0].routeGroups).toEqual([]);
    expect(chitaArea!.lines[0].buckets).toHaveLength(6);
    expect(chitaArea!.lines[0].buckets.every((bucket) => bucket.totalOrders === 1)).toBe(true);
    expect(new Set(chitaArea!.lines[0].buckets.map((bucket) => bucket.bucketName)).size).toBe(6);
    expect(chitaArea!.lines[0].buckets.every((bucket) => bucket.orders.every((order) => order.sourceZone !== null))).toBe(true);
  });
});

describe('inferManualShiftOrderSourceZone', () => {
  it('returns null when there are no non-null zones', () => {
    expect(inferManualShiftOrderSourceZone([
      { zone: null },
      { zone: '   ' }
    ])).toBeNull();
  });

  it('returns the single zone when all item zones match', () => {
    expect(inferManualShiftOrderSourceZone([
      { zone: 'שפלה 2' },
      { zone: '  שפלה 2  ' }
    ])).toBe('שפלה 2');
  });

  it('returns null when item zones are mixed', () => {
    expect(inferManualShiftOrderSourceZone([
      { zone: 'שפלה 2' },
      { zone: 'שפלה אמצעי' }
    ])).toBeNull();
  });
});

describe('buildManualShiftSourceZoneDiagnostics', () => {
  it('reports שפלה 2 split zones across item rows', () => {
    const line = makeLineEntity({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'שפלה 2',
      distributionArea: 'שפלה אמצעי'
    });
    const fragments = [
      { id: '21111111-1111-4111-8111-111111111111', route: 'שפלה 2', pointName: 'שפלה 2', workBucketName: null, zone: 'שפלה 2' },
      { id: '21111111-1111-4111-8111-111111111112', route: 'שפלה 2/סלולר', pointName: 'סלולר', workBucketName: 'סלולר', zone: 'שפלה 2' },
      { id: '21111111-1111-4111-8111-111111111113', route: 'שפלה 2/רכב-פז גדרה', pointName: 'רכב-פז גדרה', workBucketName: 'רכב-פז גדרה', zone: 'שפלה אמצעי' },
      { id: '21111111-1111-4111-8111-111111111114', route: 'שפלה 2/דור אלון טל שחר', pointName: 'דור אלון טל שחר', workBucketName: 'דור אלון טל שחר', zone: 'שפלה אמצעי' },
      { id: '21111111-1111-4111-8111-111111111115', route: 'שפלה 2/סדש גדרה', pointName: 'סדש גדרה', workBucketName: 'סדש גדרה', zone: 'שפלה 2' },
      { id: '21111111-1111-4111-8111-111111111116', route: 'שפלה 2/כוורת חצור משפחות', pointName: 'כוורת חצור משפחות', workBucketName: 'כוורת חצור משפחות', zone: 'שפלה אמצעי' },
      { id: '21111111-1111-4111-8111-111111111117', route: 'שפלה 2/מנטה מסמיה', pointName: 'מנטה מסמיה', workBucketName: 'מנטה מסמיה', zone: 'שפלה 2' },
      { id: '21111111-1111-4111-8111-111111111118', route: 'שפלה 2/פז ברורים', pointName: 'פז ברורים', workBucketName: 'פז ברורים', zone: 'שפלה אמצעי' },
      { id: '21111111-1111-4111-8111-111111111119', route: 'שפלה 2/תפוז עד הלום', pointName: 'תפוז עד הלום', workBucketName: 'תפוז עד הלום', zone: 'שפלה 2' }
    ] as const;

    const orders = fragments.map((fragment, index) => makeOrder({
      id: fragment.id,
      lineId: line.id,
      orderNumber: `SO-SH-${index + 1}`,
      customerName: `לקוח ${index + 1}`,
      pointName: fragment.pointName,
      rawRouteLine: fragment.route,
      routeBase: 'שפלה 2',
      workBucketName: fragment.workBucketName,
      workBucketType: fragment.workBucketName === null ? null : 'unknown'
    }));
    const items = fragments.map((fragment, index) => makeItem({
      id: `31111111-1111-4111-8111-11111111111${index}`,
      lineId: line.id,
      orderId: orders[index].id,
      sku: `SKU-${index + 1}`,
      zone: fragment.zone,
      sourceRows: [index + 2]
    }));

    const result = buildManualShiftSourceZoneDiagnostics({ lines: [line], orders, items });
    const lineDiag = result.lines.find((entry) => entry.lineName === 'שפלה 2');

    expect(lineDiag).toMatchObject({
      lineName: 'שפלה 2',
      distributionArea: 'שפלה אמצעי',
      itemZones: ['שפלה 2', 'שפלה אמצעי'],
      hasMultipleItemZones: true,
      message: 'line שפלה 2 has multiple item zones: שפלה 2, שפלה אמצעי',
      distributionAreaMessage: 'line.distribution_area = שפלה אמצעי does not represent all orders/items'
    });
    expect(lineDiag?.orderNumbers).toHaveLength(9);
    expect(result.orders).toHaveLength(9);
    expect(result.mismatches).toHaveLength(5);
  });

  it('reports ירושלים split zones and coarse distribution area coverage', () => {
    const line = makeLineEntity({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'ירושלים',
      distributionArea: 'ירושלים אמצעי'
    });
    const fragments = [
      { id: '22111111-1111-4111-8111-111111111111', route: 'ירושלים 1', pointName: 'ירושלים 1', workBucketName: null, zone: 'ירושלים 1' },
      { id: '22111111-1111-4111-8111-111111111112', route: 'ירושלים 2', pointName: 'ירושלים 2', workBucketName: null, zone: 'ירושלים 2' },
      { id: '22111111-1111-4111-8111-111111111113', route: 'ירושלים אמצעי', pointName: 'ירושלים אמצעי', workBucketName: null, zone: 'ירושלים אמצעי' }
    ] as const;

    const orders = fragments.map((fragment, index) => makeOrder({
      id: fragment.id,
      lineId: line.id,
      orderNumber: `SO-J-${index + 1}`,
      customerName: `לקוח י-${index + 1}`,
      pointName: fragment.pointName,
      rawRouteLine: fragment.route,
      routeBase: 'ירושלים',
      workBucketName: fragment.workBucketName,
      workBucketType: null
    }));
    const items = fragments.map((fragment, index) => makeItem({
      id: `32111111-1111-4111-8111-11111111111${index}`,
      lineId: line.id,
      orderId: orders[index].id,
      sku: `J-SKU-${index + 1}`,
      zone: fragment.zone,
      sourceRows: [index + 10]
    }));

    const result = buildManualShiftSourceZoneDiagnostics({ lines: [line], orders, items });
    const lineDiag = result.lines.find((entry) => entry.lineName === 'ירושלים');

    expect(lineDiag).toMatchObject({
      lineName: 'ירושלים',
      distributionArea: 'ירושלים אמצעי',
      itemZones: ['ירושלים 1', 'ירושלים 2', 'ירושלים אמצעי'],
      hasMultipleItemZones: true,
      message: 'line ירושלים has multiple item zones: ירושלים 1, ירושלים 2, ירושלים אמצעי',
      distributionAreaMessage: 'line.distribution_area = ירושלים אמצעי does not represent all orders/items'
    });
    expect(result.orders).toHaveLength(3);
    expect(result.mismatches).toHaveLength(2);
  });

  it(`reports צ'יטה as a source-zone mismatch candidate rather than a normal geographic area`, () => {
    const line = makeLineEntity({
      id: '33333333-3333-4333-8333-333333333333',
      name: `צ'יטה`,
      distributionArea: `צ'יטה`
    });
    const order = makeOrder({
      id: '66666666-6666-4666-8666-666666666666',
      lineId: line.id,
      orderNumber: 'SO-CHITA-1',
      customerName: 'לקוח צ׳יטה',
      pointName: `צ'יטה`,
      rawRouteLine: `צ'יטה`,
      routeBase: `צ'יטה`,
      workBucketName: null,
      workBucketType: null
    });
    const items = [
      makeItem({
        id: '73111111-1111-4111-8111-111111111111',
        lineId: line.id,
        orderId: order.id,
        sku: 'CH-1',
        zone: 'שפלה 1',
        sourceRows: [20]
      })
    ];

    const result = buildManualShiftSourceZoneDiagnostics({ lines: [line], orders: [order], items });

    expect(result.orders[0]).toMatchObject({
      lineName: `צ'יטה`,
      orderNumber: 'SO-CHITA-1',
      routeBase: `צ'יטה`,
      itemZones: ['שפלה 1'],
      hasMixedItemZones: false,
      message: `routeBase צ'יטה can have source zone different from צ'יטה`
    });
    expect(result.lines[0]).toMatchObject({
      lineName: `צ'יטה`,
      distributionArea: `צ'יטה`,
      itemZones: ['שפלה 1'],
      message: `line צ'יטה has item zone: שפלה 1`,
      distributionAreaMessage: `צ'יטה should not be assumed to be a normal geographic אזור הפצה`
    });
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toMatchObject({
      lineName: `צ'יטה`,
      orderNumber: 'SO-CHITA-1',
      itemZone: 'שפלה 1',
      message: `routeBase צ'יטה can have source zone different from צ'יטה`
    });
  });
});

  it('projects exact Chita under a single area and line', () => {
    const lineRows = [makeLineRow({ name: "צ'יטה", distribution_area: 'שפלה 1' })];
    const orders = [makeOrder({ orderNumber: 'SO-CHITA-1', pointName: "צ'יטה", sourceZone: 'שפלה 1' })];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 5 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].areaName).toBe("צ'יטה");
    expect(result.areas[0].lines).toHaveLength(1);
    expect(result.areas[0].lines[0].lineGroupName).toBe("צ'יטה");
    expect(result.areas[0].lines[0].lineKind).toBe('delivery_channel');
    expect(result.areas[0].lines[0].routeGroups).toEqual([]);
    expect(result.areas[0].lines[0].buckets[0].bucketName).toBe(ORDER_1);
    expect(result.areas[0].lines[0].buckets[0].displayName).toBe('SO-CHITA-1');
    expect(result.areas[0].lines[0].buckets[0].orders[0].sourceZone).toBe('שפלה 1');
  });

  it('sets lineKind delivery_channel for Chita variant names', () => {
    const lineRows = [makeLineRow({ name: "צ'יטה מוכן", distribution_area: 'שפלה 1' })];
    const orders = [makeOrder({ sourceZone: 'שפלה 1' })];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 5 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    expect(result.areas[0].lines[0].lineKind).toBe('delivery_channel');
    expect(result.areas[0].lines[0].lineGroupName).toBe("צ'יטה מוכן");
  });

  it('sets lineKind route for normal geographic line', () => {
    const lineRows = [makeLineRow({ name: 'גליל', distribution_area: 'גליל' })];
    const orders = [makeOrder({ sourceZone: 'גליל' })];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 5 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    expect(result.areas[0].lines[0].lineKind).toBe('route');
    expect(result.areas[0].lines[0].lineGroupName).toBe('גליל');
  });

  describe('buildShiftWorkHierarchy — routeGroups (RG2)', () => {
  const SHIFT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const LINE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function makeLine(name: string, area = 'גליל'): ManualShiftLineRow {
    return {
      id: LINE, tenant_id: 't1', shift_id: SHIFT, name, distribution_area: area,
      sort_order: 1, created_at: '2026-06-14T06:00:00.000Z',
      deleted_at: null, deleted_by_profile_id: null, deleted_by_name: null, delete_reason: null
    };
  }

  function makeOrder(overrides: Partial<ManualShiftOrder> & { id: string; orderNumber: string }): ManualShiftOrder {
    return {
      tenantId: 't1', shiftId: SHIFT, lineId: LINE,
      customerName: null, pointName: null, palletCount: null,
      pickerName: null, pickerWorkerId: null, checkerName: null,
      lineCount: null, sortOrder: null, size: 'unknown' as const,
      status: 'queued' as const,
      startedAt: null, checkStartedAt: null, waitingCheckAt: null,
      checkedAt: null, finishedAt: null, comment: null,
      createdAt: '2026-06-14T06:00:00.000Z',
      updatedAt: '2026-06-14T06:00:00.000Z',
      deletedAt: null, deletedByProfileId: null, deletedByName: null,
      deleteReason: null,
      rawRouteLine: null, routeBase: null, workBucketName: null, workBucketType: null,
      ...overrides
    };
  }

  function rollup(id: string, lc: number, qty: number) {
    return [id, { lineCount: lc, totalQuantity: qty }] as const;
  }

  // ── Test 1: Base + category split ────────────────────────────────────────
  it('SO26013614: base + category suffixes → routeGroup גליל כללי with 3 work buckets', () => {
    const O1 = 'o1-base';     const O2 = 'o2-cat-slr'; const O3 = 'o3-cat-rkv';
    const lineRows = [makeLine('גליל')];
    const orders = [
      makeOrder({ id: O1, orderNumber: 'SO26013614', pointName: null, rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null }),
      makeOrder({ id: O2, orderNumber: 'SO26013614', pointName: 'סלולר', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר' }),
      makeOrder({ id: O3, orderNumber: 'SO26013614', pointName: 'רכב-פז נהריה', rawRouteLine: 'גליל/רכב-פז נהריה', routeBase: 'גליל', workBucketName: 'רכב-פז נהריה' }),
    ];
    const rollups = new Map([rollup(O1, 3, 15), rollup(O2, 1, 4), rollup(O3, 5, 30)]);

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const line = result.areas[0].lines[0];

    expect(line.routeGroups!).toHaveLength(1);
    const rg = line.routeGroups![0];
    expect(rg.routeGroupName).toBe('גליל כללי');
    expect(rg.routeGroupKind).toBe('general');
    expect(rg.classificationConfidence).toBe('high');
    expect(rg.workBuckets).toHaveLength(3);

    const generalWb = rg.workBuckets.find((w) => w.workBucketName === 'כללי')!;
    expect(generalWb).toBeDefined();
    expect(generalWb.workBucketKind).toBe('general');
    expect(generalWb.orders).toHaveLength(1);
    expect(generalWb.orders[0].orderId).toBe(O1);

    const cellWb = rg.workBuckets.find((w) => w.workBucketName === 'סלולר')!;
    expect(cellWb).toBeDefined();
    expect(cellWb.workBucketKind).toBe('category');
    expect(cellWb.orders[0].orderId).toBe(O2);

    const rkvWb = rg.workBuckets.find((w) => w.workBucketName === 'רכב-פז נהריה')!;
    expect(rkvWb).toBeDefined();
    expect(rkvWb.workBucketKind).toBe('category');
    expect(rkvWb.orders[0].orderId).toBe(O3);
  });

  // ── Test 2: Standalone group ─────────────────────────────────────────────
  it('SO26014230: standalone route group דבאח עין המפרץ with work bucket כללי', () => {
    const O1 = 'o1-standalone';
    const lineRows = [makeLine('גליל')];
    const orders = [
      makeOrder({ id: O1, orderNumber: 'SO26014230', pointName: 'דבאח עין המפרץ', rawRouteLine: 'גליל/דבאח עין המפרץ', routeBase: 'גליל', workBucketName: 'דבאח עין המפרץ' }),
    ];
    const rollups = new Map([rollup(O1, 3, 15)]);

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const line = result.areas[0].lines[0];

    expect(line.routeGroups!).toHaveLength(1);
    const rg = line.routeGroups![0];
    expect(rg.routeGroupName).toBe('דבאח עין המפרץ');
    expect(rg.routeGroupKind).toBe('standalone');
    expect(rg.workBuckets).toHaveLength(1);
    expect(rg.workBuckets[0].workBucketName).toBe('כללי');
    expect(rg.workBuckets[0].workBucketDisplayName).toBe('כללי');
    expect(rg.workBuckets[0].workBucketKind).toBe('standalone-general');
  });

  // ── Test 3: Slash-only mixed ─────────────────────────────────────────────
  it('SO26012206: slash-only mixed without bare base → group name = פז נהריה', () => {
    const O1 = 'o1-paz';   const O2 = 'o2-sig';  const O3 = 'o3-slr';  const O4 = 'o4-rkv';
    const lineRows = [makeLine('גליל')];
    const orders = [
      makeOrder({ id: O1, orderNumber: 'SO26012206', pointName: 'פז נהריה', rawRouteLine: 'גליל/פז נהריה', routeBase: 'גליל', workBucketName: 'פז נהריה' }),
      makeOrder({ id: O2, orderNumber: 'SO26012206', pointName: 'סיגריות-פז נהריה', rawRouteLine: 'גליל/סיגריות-פז נהריה', routeBase: 'גליל', workBucketName: 'סיגריות-פז נהריה' }),
      makeOrder({ id: O3, orderNumber: 'SO26012206', pointName: 'סלולר-פז נהריה', rawRouteLine: 'גליל/סלולר-פז נהריה', routeBase: 'גליל', workBucketName: 'סלולר-פז נהריה' }),
      makeOrder({ id: O4, orderNumber: 'SO26012206', pointName: 'רכב-פז נהריה', rawRouteLine: 'גליל/רכב-פז נהריה', routeBase: 'גליל', workBucketName: 'רכב-פז נהריה' }),
    ];
    const rollups = new Map([rollup(O1, 2, 10), rollup(O2, 3, 15), rollup(O3, 1, 5), rollup(O4, 4, 20)]);

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const line = result.areas[0].lines[0];

    expect(line.routeGroups!).toHaveLength(1);
    const rg = line.routeGroups![0];
    expect(rg.routeGroupName).toBe('פז נהריה');
    expect(rg.routeGroupKind).toBe('derived-from-non-category-suffix');
    expect(rg.workBuckets).toHaveLength(4);

    const generalWb = rg.workBuckets.find((w) => w.workBucketName === 'כללי')!;
    expect(generalWb).toBeDefined();
    expect(generalWb.orders[0].orderId).toBe(O1);

    const sigWb = rg.workBuckets.find((w) => w.workBucketName === 'סיגריות-פז נהריה')!;
    expect(sigWb).toBeDefined();
    expect(sigWb.workBucketKind).toBe('category');
  });

  // ── Test 4: Low-confidence category-only ─────────────────────────────────
  it('category-only suffix (no base/standalone context) → low confidence', () => {
    const O1 = 'o1-cat-only';
    const lineRows = [makeLine('גליל')];
    const orders = [
      makeOrder({ id: O1, orderNumber: 'SO-CAT', pointName: 'סלולר', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר' }),
    ];
    const rollups = new Map([rollup(O1, 1, 5)]);

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const line = result.areas[0].lines[0];

    expect(line.routeGroups!).toHaveLength(1);
    const rg = line.routeGroups![0];
    expect(rg.classificationConfidence).toBe('low');
    expect(rg.routeGroupKind).toBe('low-confidence');
    expect(rg.classificationReasons[0]).toContain('category-like suffix');
    expect(rg.workBuckets).toHaveLength(1);
    expect(rg.workBuckets[0].classificationConfidence).toBe('low');
    expect(rg.workBuckets[0].workBucketKind).toBe('unknown');
  });

  // ── Test 5: Backwards compatibility ──────────────────────────────────────
  it('legacy buckets still exist and have the same shape/content', () => {
    const O1 = 'o1-base'; const O2 = 'o2-slr'; const O3 = 'o3-mkt';
    const lineRows = [makeLine('קו דרום', 'דרום')];
    const orders = [
      makeOrder({ id: O1, orderNumber: 'SO-1', pointName: null, rawRouteLine: 'דרום', routeBase: 'דרום', workBucketName: null, status: 'queued' }),
      makeOrder({ id: O2, orderNumber: 'SO-1', pointName: 'סלולר', rawRouteLine: 'דרום/סלולר', routeBase: 'דרום', workBucketName: 'סלולר', status: 'waiting_check' }),
      makeOrder({ id: O3, orderNumber: 'SO-2', pointName: 'מרכז', rawRouteLine: 'דרום/מרכז', routeBase: 'דרום', workBucketName: 'מרכז', status: 'done' }),
    ];
    const rollups = new Map([rollup(O1, 2, 10), rollup(O2, 1, 5), rollup(O3, 3, 20)]);

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const line = result.areas[0].lines[0];

    // Legacy buckets must still exist
    expect(line.buckets).toBeDefined();
    expect(line.buckets.length).toBeGreaterThan(0);
    const bucketNames = line.buckets.map((b) => b.bucketName).sort();
    expect(bucketNames).toContain(null);
    expect(bucketNames).toContain('סלולר');
    expect(bucketNames).toContain('מרכז');

    // routeGroups is a separate field
    expect(line.routeGroups!).toBeDefined();
    expect(Array.isArray(line.routeGroups!)).toBe(true);
  });

  // ── Test 6: Metrics aggregation ──────────────────────────────────────────
  it('route group totals equal sum of their work buckets; line totals unchanged', () => {
    const O1 = 'o1-base'; const O2 = 'o2-slr';
    const lineRows = [makeLine('מרכז', 'מרכז')];
    const orders = [
      makeOrder({ id: O1, orderNumber: 'SO-10', pointName: null, rawRouteLine: 'מרכז', routeBase: 'מרכז', workBucketName: null }),
      makeOrder({ id: O2, orderNumber: 'SO-10', pointName: 'סלולר', rawRouteLine: 'מרכז/סלולר', routeBase: 'מרכז', workBucketName: 'סלולר' }),
    ];
    const rollups = new Map([rollup(O1, 3, 12), rollup(O2, 2, 8)]);

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const line = result.areas[0].lines[0];

    expect(line.routeGroups!).toHaveLength(1);
    const rg = line.routeGroups![0];
    const rgTotalOrders = rg.workBuckets.reduce((s, wb) => s + wb.orderCount, 0);
    const rgTotalQty = rg.workBuckets.reduce((s, wb) => s + wb.totalQuantity, 0);
    const rgTotalLines = rg.workBuckets.reduce((s, wb) => s + wb.itemLinesCount, 0);

    expect(rg.orderCount).toBe(rgTotalOrders);
    expect(rg.totalQuantity).toBe(rgTotalQty);
    expect(rg.itemLinesCount).toBe(rgTotalLines);

    // Work bucket totals match contained orders
    for (const wb of rg.workBuckets) {
      const wbOrderQty = wb.orders.reduce((s, o) => s + o.totalQuantity, 0);
      expect(wb.totalQuantity).toBe(wbOrderQty);
    }

    // Line totalQuantity unchanged from existing behavior
    expect(line.totalQuantity).toBe(20);
    expect(line.totalOrders).toBe(2);
  });

  // ── Test 7: No cross-line/order leakage ──────────────────────────────────
  it('same orderNumber under different routeBase classifies independently', () => {
    const LINE_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const O1 = 'o1-base'; const O2 = 'o2-standalone';
    const lineRows = [
      { ...makeLine('גליל', 'צפון'), id: LINE },
      { ...makeLine('צפון', 'צפון'), id: LINE_B },
    ];
    const orders = [
      makeOrder({ id: O1, orderNumber: 'SO-SAME', lineId: LINE, pointName: null, rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null }),
      makeOrder({ id: O2, orderNumber: 'SO-SAME', lineId: LINE_B, pointName: 'דבאח עכו', rawRouteLine: 'צפון/דבאח עכו', routeBase: 'צפון', workBucketName: 'דבאח עכו' }),
    ];
    const rollups = new Map([rollup(O1, 1, 5), rollup(O2, 2, 10)]);

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const area = result.areas[0];

    const galilLine = area.lines.find((l) => l.lineGroupName === 'גליל')!;
    const tzfonLine = area.lines.find((l) => l.lineGroupName === 'צפון')!;

    expect(galilLine.routeGroups![0].routeGroupName).toBe('גליל כללי');
    expect(tzfonLine.routeGroups![0].routeGroupName).toBe('דבאח עכו');
    expect(galilLine.routeGroups![0].routeGroupName).not.toBe(tzfonLine.routeGroups![0].routeGroupName);

    // Each line's totals are independent
    expect(galilLine.totalQuantity).toBe(5);
    expect(tzfonLine.totalQuantity).toBe(10);
  });

  // ── Test 8: Reordered input regression ───────────────────────────────────
  it('reordered input: standalone-before-base-before-category must not leak orders between work buckets', () => {
    // Deliberately put category before base in input order.
    // With index-based matching, this would cause the base classification
    // to be applied to a category order and vice-versa.
    const O1 = 'o1-cat'; const O2 = 'o2-base'; const O3 = 'o3-standalone';
    const lineRows = [makeLine('גליל')];
    const orders = [
      makeOrder({ id: O1, orderNumber: 'SO-REORDER', pointName: 'סלולר', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר' }),
      makeOrder({ id: O2, orderNumber: 'SO-REORDER', pointName: 'גליל', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null }),
      makeOrder({ id: O3, orderNumber: 'SO-REORDER', pointName: 'רכב-פז נהריה', rawRouteLine: 'גליל/רכב-פז נהריה', routeBase: 'גליל', workBucketName: 'רכב-פז נהריה' }),
    ];
    const rollups = new Map([rollup(O1, 1, 5), rollup(O2, 2, 10), rollup(O3, 1, 3)]);

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const line = result.areas[0].lines[0];

    expect(line.routeGroups!).toHaveLength(1);
    const rg = line.routeGroups![0];
    expect(rg.routeGroupName).toBe('גליל כללי');
    expect(rg.workBuckets).toHaveLength(3);

    // ── Bucket كلלי: must contain only the base order ──
    const generalWb = rg.workBuckets.find((w) => w.workBucketName === 'כללי')!;
    expect(generalWb).toBeDefined();
    expect(generalWb.orders).toHaveLength(1);
    expect(generalWb.orders[0].orderId).toBe(O2);   // base order
    expect(generalWb.orders[0].pointName).toBe('גליל');

    // ── Bucket סלולר: must contain only the category order ──
    const cellWb = rg.workBuckets.find((w) => w.workBucketName === 'סלולר')!;
    expect(cellWb).toBeDefined();
    expect(cellWb.orders).toHaveLength(1);
    expect(cellWb.orders[0].orderId).toBe(O1);      // cat order
    expect(cellWb.orders[0].pointName).toBe('סלולר');

    // ── Bucket רכב-פז נהריה: must contain only the standalone order ──
    const rkvWb = rg.workBuckets.find((w) => w.workBucketName === 'רכב-פז נהריה')!;
    expect(rkvWb).toBeDefined();
    expect(rkvWb.orders).toHaveLength(1);
    expect(rkvWb.orders[0].orderId).toBe(O3);       // standalone order
    expect(rkvWb.orders[0].pointName).toBe('רכב-פז נהריה');
  });

  // ── Test 9: Invariant — every order matches its container ─────────────────
  it('every routeGroups[].workBuckets[].orders[] re-classifies to its containing routeGroupKey and workBucketKey', () => {
    const orders: ManualShiftOrder[] = [
      makeOrder({ id: 'o-a1', orderNumber: 'SO-A', pointName: 'גליל', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null }),
      makeOrder({ id: 'o-a2', orderNumber: 'SO-A', pointName: 'סלולר-גליל', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר' }),
      makeOrder({ id: 'o-a3', orderNumber: 'SO-A', pointName: 'רכב-פז נהריה', rawRouteLine: 'גליל/רכב-פז נהריה', routeBase: 'גליל', workBucketName: 'רכב-פז נהריה' }),
      makeOrder({ id: 'o-b1', orderNumber: 'SO-B', pointName: 'דבאח עין המפרץ', rawRouteLine: 'גליל/דבאח עין המפרץ', routeBase: 'גליל', workBucketName: 'דבאח עין המפרץ' }),
      makeOrder({ id: 'o-c1', orderNumber: 'SO-C', pointName: 'פז לוחמי הגטאות', rawRouteLine: 'גליל/פז לוחמי הגטאות', routeBase: 'גליל', workBucketName: 'פז לוחמי הגטאות' }),
    ];
    const lineRows = [makeLine('גליל')];
    const rollups = new Map(orders.map((o) => [o.id, { lineCount: 1, totalQuantity: 10 }] as const));

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const line = result.areas[0].lines[0];

    // Assert the invariant: every order inside a work bucket, when re-classified
    // from its original fragment values, must produce the same routeGroupKey
    // and workBucketKey as the container it was placed in.
    for (const routeGroup of line.routeGroups!) {
      for (const workBucket of routeGroup.workBuckets) {
        for (const bucketOrder of workBucket.orders) {
          const original = orders.find((o) => o.id === bucketOrder.orderId)!;
          expect(original).toBeDefined();

          const fragment: RouteFragmentInput = {
            orderNumber: original.orderNumber ?? '',
            rawRouteLine: original.rawRouteLine ?? null,
            routeBase: original.routeBase ?? null,
            workBucketName: original.workBucketName ?? null,
            pointName: original.pointName,
          };

          const [classification] = classifyRouteFragments([fragment]);
          expect(classification).toBeDefined();
          expect(classification.routeGroupKey).toBe(routeGroup.routeGroupKey);
          expect(classification.workBucketKey).toBe(workBucket.workBucketKey);
        }
      }
    }
  });

  // ── Test 10: Unique pointName per work bucket (5 cases) ──────────────────
  it('each work bucket carries only orders with the expected single unique pointName', () => {
    const orders = [
      makeOrder({ id: 'o-a1', orderNumber: 'SO-A', pointName: 'גליל', rawRouteLine: 'גליל', routeBase: 'גליל', workBucketName: null }),
      makeOrder({ id: 'o-a2', orderNumber: 'SO-A', pointName: 'סלולר', rawRouteLine: 'גליל/סלולר', routeBase: 'גליל', workBucketName: 'סלולר' }),
      makeOrder({ id: 'o-a3', orderNumber: 'SO-A', pointName: 'רכב-פז נהריה', rawRouteLine: 'גליל/רכב-פז נהריה', routeBase: 'גליל', workBucketName: 'רכב-פז נהריה' }),
      makeOrder({ id: 'o-b1', orderNumber: 'SO-B', pointName: 'דבאח עין המפרץ', rawRouteLine: 'גליל/דבאח עין המפרץ', routeBase: 'גליל', workBucketName: 'דבאח עין המפרץ' }),
      makeOrder({ id: 'o-c1', orderNumber: 'SO-C', pointName: 'פז לוחמי הגטאות', rawRouteLine: 'גליל/פז לוחמי הגטאות', routeBase: 'גליל', workBucketName: 'פז לוחמי הגטאות' }),
    ];
    const lineRows = [makeLine('גליל')];
    const rollups = new Map(orders.map((o) => [o.id, { lineCount: 1, totalQuantity: 5 }] as const));

    const result = buildShiftWorkHierarchy(SHIFT, lineRows, orders, rollups, [], []);
    const line = result.areas[0].lines[0];

    function uniquePointNames(routeGroupName: string, workBucketName: string): string[] {
      const rg = line.routeGroups!.find((g) => g.routeGroupName === routeGroupName)!;
      expect(rg).toBeDefined();
      const wb = rg.workBuckets.find((b) => b.workBucketName === workBucketName)!;
      expect(wb).toBeDefined();
      return [...new Set(wb.orders.map((o) => o.pointName).filter((p): p is string => Boolean(p)))];
    }

    // Case 1 — גליל כללי > כללי → ["גליל"]
    expect(uniquePointNames('גליל כללי', 'כללי')).toEqual(['גליל']);

    // Case 2 — גליל כללי > סלולר → ["סלולר"]
    expect(uniquePointNames('גליל כללי', 'סלולר')).toEqual(['סלולר']);

    // Case 3 — גליל כללי > רכב-פז נהריה → ["רכב-פז נהריה"]
    expect(uniquePointNames('גליל כללי', 'רכב-פז נהריה')).toEqual(['רכב-פז נהריה']);

    // Case 4 — דבאח עין המפרץ > כללי → ["דבאח עין המפרץ"]
    expect(uniquePointNames('דבאח עין המפרץ', 'כללי')).toEqual(['דבאח עין המפרץ']);

    // Case 5 — פז לוחמי הגטאות > כללי → ["פז לוחמי הגטאות"]
    expect(uniquePointNames('פז לוחמי הגטאות', 'כללי')).toEqual(['פז לוחמי הגטאות']);
  });
});

// ── listBucketProductRollup sourceZone isolation ───────────────────────────

function fakeSupabase(
  orders: Array<Record<string, unknown>>,
  items: Array<Record<string, unknown>>,
  lines: Array<Record<string, unknown>> = []
) {
  function makeBuilder(rows: Array<Record<string, unknown>>) {
    let filtered = [...rows];
    const builder = {
      _select: '',
      select(cols: string) {
        builder._select = cols;
        return builder;
      },
      eq(col: string, val: unknown) {
        filtered = filtered.filter(r => r[col] === val);
        return builder;
      },
      is(col: string, val: unknown) {
        if (val === null) {
          filtered = filtered.filter(r => r[col] === null || r[col] === undefined);
        }
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filtered = filtered.filter(r => vals.includes(r[col]));
        return builder;
      },
      range(_offset: number, _limit: number) {
        return builder;
      },
      maybeSingle() {
        const out = filtered.length > 0 ? filtered[0] : null;
        return Promise.resolve({ data: out, error: null });
      },
      then(resolve: (result: { data: Array<Record<string, unknown>> | null; error: null }) => void) {
        const out = filtered.length > 0 ? filtered : null;
        resolve({ data: out, error: null });
      }
    };
    return builder;
  }

  const orderRows = [...orders];
  const itemRows = [...items];
  const lineRows = [...lines];

  return {
    from(table: string) {
      const sourceRows =
        table === 'manual_shift_orders' ? orderRows : table === 'manual_shift_lines' ? lineRows : itemRows;
      return { select(cols: string) { return makeBuilder(sourceRows); } };
    }
  };
}

describe('listBucketProductRollup sourceZone isolation', () => {
  const SHIFT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const LINE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const CHITA_LINE = 'dd825383-e1f1-48e9-bf6e-aa5065ccbd7e';

  const sharedOrders = [
    { id: 'o-1', shift_id: SHIFT, line_id: LINE, point_name: 'סלולר', source_zone: 'שפלה 2', deleted_at: null },
    { id: 'o-2', shift_id: SHIFT, line_id: LINE, point_name: 'סלולר', source_zone: 'שפלה אמצעי', deleted_at: null },
  ];

  const sharedItems = [
    { sku: '111', description: null, category: null, quantity: 10, order_id: 'o-1' },
    { sku: '222', description: null, category: null, quantity: 5, order_id: 'o-2' },
  ];

  it('listBucketProductRollup_filters_non_empty_sourceZone_exactly', async () => {
    const supabase = fakeSupabase(sharedOrders, sharedItems);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT, lineId: LINE, bucketName: 'סלולר', sourceZone: 'שפלה 2'
    });

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('111');
    expect(result[0].totalQuantity).toBe(10);
  });

  it('returns only SKU 222 for sourceZone=שפלה אמצעי', async () => {
    const supabase = fakeSupabase(sharedOrders, sharedItems);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT, lineId: LINE, bucketName: 'סלולר', sourceZone: 'שפלה אמצעי'
    });

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('222');
    expect(result[0].totalQuantity).toBe(5);
  });

  it('listBucketProductRollup_filters_source_zone_is_null_for_empty_sourceZone_sentinel', async () => {
    const orders = [
      { id: 'o-3', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: 'רכב-פז ירכא', deleted_at: null },
      { id: 'o-4', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: null, deleted_at: null },
      { id: 'o-5', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: 'סיגריות-מנטה עין המפרץ', deleted_at: null },
    ];
    const items = [
      { sku: '333', description: null, category: null, quantity: 7, order_id: 'o-3' },
      { sku: '444', description: null, category: null, quantity: 3, order_id: 'o-4' },
      { sku: '555', description: null, category: null, quantity: 11, order_id: 'o-5' },
    ];
    const supabase = fakeSupabase(orders, items);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT, lineId: LINE, bucketName: 'כללי', sourceZone: ''
    });

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('444');
    expect(result[0].totalQuantity).toBe(3);
  });

  it('listBucketProductRollup_omitted_sourceZone_does_not_apply_null_filter', async () => {
    const orders = [
      { id: 'o-3', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: 'רכב-פז ירכא', deleted_at: null },
      { id: 'o-4', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: null, deleted_at: null },
      { id: 'o-5', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: 'סיגריות-מנטה עין המפרץ', deleted_at: null },
    ];
    const items = [
      { sku: '333', description: null, category: null, quantity: 7, order_id: 'o-3' },
      { sku: '444', description: null, category: null, quantity: 3, order_id: 'o-4' },
      { sku: '555', description: null, category: null, quantity: 11, order_id: 'o-5' },
    ];
    const supabase = fakeSupabase(orders, items);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT, lineId: LINE, bucketName: 'כללי'
    });

    expect(result).toHaveLength(3);
    const skus = result.map((r: BucketProductRollupRow) => r.sku).sort();
    expect(skus).toEqual(['333', '444', '555']);
  });

  it('returns Chita products when sourceZone is provided even though point_name stays on the delivery channel', async () => {
    const orders = [
      {
        id: 'chita-order-1',
        shift_id: SHIFT,
        line_id: CHITA_LINE,
        point_name: "צ'יטה",
        source_zone: 'דרום',
        deleted_at: null
      }
    ];
    const items = [
      { sku: 'CH-1', description: null, category: null, quantity: 12, order_id: 'chita-order-1' },
      { sku: 'CH-2', description: null, category: null, quantity: 8, order_id: 'chita-order-1' }
    ];
    const supabase = fakeSupabase(orders, items);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT,
      lineId: CHITA_LINE,
      bucketName: 'דרום',
      sourceZone: 'דרום'
    });

    expect(result).toHaveLength(2);
    expect(result.map((r: BucketProductRollupRow) => r.sku).sort()).toEqual(['CH-1', 'CH-2']);
    expect(result.reduce((sum: number, row: BucketProductRollupRow) => sum + row.totalQuantity, 0)).toBe(20);
  });

  it('listBucketProductRollup_chita_scopes_products_to_selected_order_bucket', async () => {
    const orders = [
      {
        id: 'chita-order-1',
        shift_id: SHIFT,
        line_id: CHITA_LINE,
        point_name: "צ'יטה",
        route_base: "צ'יטה",
        work_bucket_name: 'דרום',
        source_zone: 'דרום',
        deleted_at: null
      },
      {
        id: 'chita-order-2',
        shift_id: SHIFT,
        line_id: CHITA_LINE,
        point_name: "צ'יטה",
        route_base: "צ'יטה",
        work_bucket_name: 'דרום',
        source_zone: 'דרום',
        deleted_at: null
      }
    ];
    const items = [
      { sku: 'CH-SHARED', description: null, category: null, quantity: 3, order_id: 'chita-order-1' },
      { sku: 'CH-SHARED', description: null, category: null, quantity: 9, order_id: 'chita-order-2' }
    ];
    const lines = [
      { id: CHITA_LINE, shift_id: SHIFT, name: "צ'יטה", distribution_area: 'דרום' }
    ];
    const supabase = fakeSupabase(orders, items, lines);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT,
      lineId: CHITA_LINE,
      bucketName: 'SO-CH-1',
      sourceZone: 'דרום',
      sourceLineName: "צ'יטה",
      workBucketName: 'chita-order-1'
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sku: 'CH-SHARED',
      totalQuantity: 3,
      orderCount: 1
    });
  });

  it('listBucketProductRollup_chita_same_order_multiple_rows_aggregates_by_sku', async () => {
    const orders = [
      {
        id: 'chita-order-1',
        shift_id: SHIFT,
        line_id: CHITA_LINE,
        point_name: "צ'יטה",
        route_base: "צ'יטה",
        work_bucket_name: 'דרום',
        source_zone: 'דרום',
        deleted_at: null
      },
      {
        id: 'chita-order-2',
        shift_id: SHIFT,
        line_id: CHITA_LINE,
        point_name: "צ'יטה",
        route_base: "צ'יטה",
        work_bucket_name: 'דרום',
        source_zone: 'דרום',
        deleted_at: null
      }
    ];
    const items = [
      { sku: 'CH-ONE', description: null, category: null, quantity: 2, order_id: 'chita-order-1' },
      { sku: 'CH-ONE', description: null, category: null, quantity: 5, order_id: 'chita-order-1' },
      { sku: 'CH-ONE', description: null, category: null, quantity: 11, order_id: 'chita-order-2' }
    ];
    const lines = [
      { id: CHITA_LINE, shift_id: SHIFT, name: "צ'יטה", distribution_area: 'דרום' }
    ];
    const supabase = fakeSupabase(orders, items, lines);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT,
      lineId: CHITA_LINE,
      bucketName: 'SO-CH-1',
      sourceZone: 'דרום',
      sourceLineName: "צ'יטה",
      workBucketName: 'chita-order-1'
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sku: 'CH-ONE',
      totalQuantity: 7,
      orderCount: 1
    });
  });

  it.each(['', '   '])('treats whitespace-only sourceZone %p as explicit unknown-zone scope', async (sourceZone) => {
    const orders = [
      { id: 'o-3', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: 'שפלה 2', deleted_at: null },
      { id: 'o-4', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: null, deleted_at: null }
    ];
    const items = [
      { sku: '333', description: null, category: null, quantity: 7, order_id: 'o-3' },
      { sku: '444', description: null, category: null, quantity: 3, order_id: 'o-4' }
    ];
    const supabase = fakeSupabase(orders, items);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT,
      lineId: LINE,
      bucketName: 'כללי',
      sourceZone
    });

    expect(result).toHaveLength(1);
    expect(result.map((r: BucketProductRollupRow) => r.sku)).toEqual(['444']);
    expect(result.reduce((sum: number, row: BucketProductRollupRow) => sum + row.totalQuantity, 0)).toBe(3);
  });

  it('aggregates same SKU across orders into one product row', async () => {
    const orders = [
      { id: 'o-agg-1', shift_id: SHIFT, line_id: LINE, point_name: 'סלולר', source_zone: null, deleted_at: null },
      { id: 'o-agg-2', shift_id: SHIFT, line_id: LINE, point_name: 'סלולר', source_zone: null, deleted_at: null }
    ];
    const items = [
      { sku: 'AGG-1', description: 'מוצר מצטבר', category: 'test', quantity: 5, order_id: 'o-agg-1' },
      { sku: 'AGG-1', description: 'מוצר מצטבר', category: 'test', quantity: 7, order_id: 'o-agg-2' }
    ];
    const supabase = fakeSupabase(orders, items);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT, lineId: LINE, bucketName: 'סלולר'
    });

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('AGG-1');
    expect(result[0].totalQuantity).toBe(12);
    expect(result[0].orderCount).toBe(2);
  });
});

describe('listBucketProductRollup work bucket scoping', () => {
  const SHIFT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const LINE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const LINE_ROWS = [
    {
      id: LINE,
      shift_id: SHIFT,
      distribution_area: 'גליל'
    }
  ];

  const orders = [
    {
      id: 'o-sig',
      shift_id: SHIFT,
      line_id: LINE,
      point_name: 'גליל',
      route_base: 'גליל',
      work_bucket_name: 'סיגריות-מנטה עין המפרץ',
      source_zone: 'גליל',
      deleted_at: null
    },
    {
      id: 'o-rav-1',
      shift_id: SHIFT,
      line_id: LINE,
      point_name: 'גליל',
      route_base: 'גליל',
      work_bucket_name: 'רכב-פז ירכא',
      source_zone: 'גליל',
      deleted_at: null
    },
    {
      id: 'o-rav-2',
      shift_id: SHIFT,
      line_id: LINE,
      point_name: 'גליל',
      route_base: 'גליל',
      work_bucket_name: 'רכב-פז ירכא',
      source_zone: 'גליל',
      deleted_at: null
    },
    {
      id: 'o-rav-3',
      shift_id: SHIFT,
      line_id: LINE,
      point_name: 'גליל',
      route_base: 'גליל',
      work_bucket_name: 'רכב-פז ירכא',
      source_zone: 'גליל',
      deleted_at: null
    },
    ...Array.from({ length: 26 }, (_, index) => ({
      id: `o-gen-${index + 1}`,
      shift_id: SHIFT,
      line_id: LINE,
      point_name: 'כללי',
      route_base: 'גליל',
      work_bucket_name: 'כללי',
      source_zone: 'גליל',
      deleted_at: null
    }))
  ];

  const items = [
    { sku: '114000', description: 'סיגריות-מנטה', category: 'טבק', quantity: 10, order_id: 'o-sig' },
    { sku: 'RAV-1', description: 'רכב 1', category: 'רכב', quantity: 10, order_id: 'o-rav-1' },
    { sku: 'RAV-2', description: 'רכב 2', category: 'רכב', quantity: 10, order_id: 'o-rav-2' },
    { sku: 'RAV-3', description: 'רכב 3', category: 'רכב', quantity: 10, order_id: 'o-rav-3' },
    ...Array.from({ length: 25 }, (_, index) => ({
      sku: `GEN-${index + 1}`,
      description: `כללי ${index + 1}`,
      category: 'כללי',
      quantity: 3,
      order_id: `o-gen-${index + 1}`
    })),
    {
      sku: 'GEN-26',
      description: 'כללי 26',
      category: 'כללי',
      quantity: 18,
      order_id: 'o-gen-26'
    }
  ];

  it('returns exactly one row for סיגריות-מנטה עין המפרץ', async () => {
    const supabase = fakeSupabase(orders, items, LINE_ROWS);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT,
      lineId: LINE,
      bucketName: 'סיגריות-מנטה עין המפרץ',
      sourceZone: 'גליל',
      sourceLineName: 'גליל',
      workBucketName: 'סיגריות-מנטה עין המפרץ'
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sku: '114000',
      totalQuantity: 10,
      orderCount: 1
    });
  });

  it('returns exactly three rows for רכב-פז ירכא', async () => {
    const supabase = fakeSupabase(orders, items, LINE_ROWS);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT,
      lineId: LINE,
      bucketName: 'רכב-פז ירכא',
      sourceZone: 'גליל',
      sourceLineName: 'גליל',
      workBucketName: 'רכב-פז ירכא'
    });

    expect(result).toHaveLength(3);
    expect(result.reduce((sum: number, row: BucketProductRollupRow) => sum + row.totalQuantity, 0)).toBe(30);
  });

  it('returns only כללי bucket products for גליל line scoping', async () => {
    const supabase = fakeSupabase(orders, items, LINE_ROWS);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT,
      lineId: LINE,
      bucketName: 'כללי',
      sourceZone: 'גליל',
      sourceLineName: 'גליל',
      workBucketName: 'כללי'
    });

    expect(result).toHaveLength(26);
    expect(result.reduce((sum: number, row: BucketProductRollupRow) => sum + row.totalQuantity, 0)).toBe(93);
  });
});
