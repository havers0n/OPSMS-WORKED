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
    const shfela2 = areasByName.get('שפלה 2')!;
    const shfelaMid = areasByName.get('שפלה אמצעי')!;

    expect(result.areas.map((area) => area.areaName).sort()).toEqual(['שפלה 2', 'שפלה אמצעי']);
    expect(shfela2.totalOrders).toBe(6);
    expect(shfelaMid.totalOrders).toBe(5);
    expect(shfela2.totalQuantity).toBe(27);
    expect(shfelaMid.totalQuantity).toBe(50);
    expect(shfela2.lines).toHaveLength(1);
    expect(shfelaMid.lines).toHaveLength(1);
    expect(shfela2.lines[0].lineId).toBe(LINE_A);
    expect(shfelaMid.lines[0].lineId).toBe(LINE_A);
    expect(shfela2.lines[0].areaLineKey).not.toBe(shfelaMid.lines[0].areaLineKey);
    expect(shfela2.lines[0].sourceZone).toBe('שפלה 2');
    expect(shfelaMid.lines[0].sourceZone).toBe('שפלה אמצעי');

    for (const area of [shfela2, shfelaMid]) {
      for (const line of area.lines) {
        for (const bucket of line.buckets) {
          for (const order of bucket.orders) {
            expect(order.sourceZone).toBe(area.areaName);
          }
        }
        for (const routeGroup of line.routeGroups ?? []) {
          for (const workBucket of routeGroup.workBuckets) {
            for (const order of workBucket.orders) {
              expect(order.sourceZone).toBe(area.areaName);
            }
          }
        }
      }
    }

    expect(
      shfelaMid.lines[0].buckets.some((bucket) =>
        bucket.orders.some((order) => ['כוורת חצור משפחות', 'מנטה מסמיה', 'פז ברורים', 'תפוז עד הלום'].includes(order.pointName ?? ''))
      )
    ).toBe(false);
  });
});

describe('source-zone-aware hierarchy', () => {
  it('splits ??????? into separate source-zone areas for the same physical line', () => {
    const lineRows = [
      makeLineRow({
        id: LINE_A,
        name: '???????',
        distribution_area: '??????? ?????'
      })
    ];
    const orders = [
      makeOrder({
        id: 'o-jer-1',
        lineId: LINE_A,
        orderNumber: 'SO-J-1',
        pointName: '??????? 1',
        rawRouteLine: '???????/??????? 1',
        routeBase: '???????',
        workBucketName: '??????? 1',
        sourceZone: '??????? 1'
      }),
      makeOrder({
        id: 'o-jer-2',
        lineId: LINE_A,
        orderNumber: 'SO-J-2',
        pointName: '??????? 2',
        rawRouteLine: '???????/??????? 2',
        routeBase: '???????',
        workBucketName: '??????? 2',
        sourceZone: '??????? 2'
      }),
      makeOrder({
        id: 'o-jer-3',
        lineId: LINE_A,
        orderNumber: 'SO-J-3',
        pointName: '??????? ?????',
        rawRouteLine: '???????/??????? ?????',
        routeBase: '???????',
        workBucketName: '??????? ?????',
        sourceZone: '??????? ?????'
      })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>([
      ['o-jer-1', { lineCount: 2, totalQuantity: 10 }],
      ['o-jer-2', { lineCount: 3, totalQuantity: 20 }],
      ['o-jer-3', { lineCount: 4, totalQuantity: 30 }]
    ]);

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);
    expect(result.areas.map((area) => area.areaName).sort()).toEqual([
      '??????? 1',
      '??????? 2',
      '??????? ?????'
    ]);

    for (const area of result.areas) {
      expect(area.lines).toHaveLength(1);
      expect(area.lines[0].lineId).toBe(LINE_A);
      expect(area.lines[0].lineGroupName).toBe('???????');
      expect(area.lines[0].sourceZone).toBe(area.areaName);
    }
  });

  it(`routes "?'???" under a different source zone`, () => {
    const lineRows = [
      makeLineRow({
        id: LINE_A,
        name: `?'???`,
        distribution_area: `?'???`
      })
    ];
    const orders = [
      makeOrder({
        id: 'o-chita-1',
        lineId: LINE_A,
        orderNumber: 'SO-C-1',
        pointName: '???? ??? ?????',
        rawRouteLine: `?'???/???? ??? ?????`,
        routeBase: `?'???`,
        workBucketName: '???? ??? ?????',
        sourceZone: '???? 1'
      })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>([
      ['o-chita-1', { lineCount: 2, totalQuantity: 13 }]
    ]);

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);
    expect(result.areas.map((area) => area.areaName)).toEqual(['???? 1']);
    expect(result.areas[0].lines[0].lineGroupName).toBe(`?'???`);
    expect(result.areas[0].lines[0].sourceZone).toBe('???? 1');
  });

  it('falls back to a single item zone when order.sourceZone is missing', () => {
    const lineRows = [makeLineRow()];
    const orders = [
      makeOrder({
        id: 'o-legacy-1',
        lineId: LINE_A,
        orderNumber: 'SO-L-1',
        pointName: '?????',
        rawRouteLine: '???? 2/?????',
        routeBase: '???? 2',
        workBucketName: '?????',
        sourceZone: null
      }),
      makeOrder({
        id: 'o-legacy-2',
        lineId: LINE_A,
        orderNumber: 'SO-L-2',
        pointName: '???? 2',
        rawRouteLine: '???? 2',
        routeBase: '???? 2',
        workBucketName: null,
        sourceZone: null
      })
    ];
    const items = [
      makeItem({
        id: 'i-legacy-1',
        lineId: LINE_A,
        orderId: 'o-legacy-1',
        zone: '???? 2'
      }),
      makeItem({
        id: 'i-legacy-2',
        lineId: LINE_A,
        orderId: 'o-legacy-2',
        zone: '???? 2'
      })
    ];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>([
      ['o-legacy-1', { lineCount: 1, totalQuantity: 4 }],
      ['o-legacy-2', { lineCount: 1, totalQuantity: 6 }]
    ]);

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], [], items);
    expect(result.areas.map((area) => area.areaName)).toEqual(['???? 2']);
    expect(result.areas[0].lines[0].sourceZone).toBe('???? 2');
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

it('sets lineKind delivery_channel for route named צ\'יטה under geographic source zone', () => {
    const lineRows = [makeLineRow({ name: "צ'יטה", distribution_area: 'שפלה 1' })];
    const orders = [makeOrder({ sourceZone: 'שפלה 1' })];
    const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
    rollups.set(ORDER_1, { lineCount: 0, totalQuantity: 5 });

    const result = buildShiftWorkHierarchy(SHIFT_ID, lineRows, orders, rollups, [], []);

    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].areaName).toBe('שפלה 1');
    expect(result.areas[0].lines[0].lineGroupName).toBe("צ'יטה");
    expect(result.areas[0].lines[0].lineKind).toBe('delivery_channel');
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

function fakeSupabase(orders: Array<Record<string, unknown>>, items: Array<Record<string, unknown>>) {
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
      then(resolve: (result: { data: Array<Record<string, unknown>> | null; error: null }) => void) {
        const out = filtered.length > 0 ? filtered : null;
        resolve({ data: out, error: null });
      }
    };
    return builder;
  }

  const orderRows = [...orders];
  const itemRows = [...items];

  return {
    from(table: string) {
      const sourceRows = table === 'manual_shift_orders' ? orderRows : itemRows;
      return { select(cols: string) { return makeBuilder(sourceRows); } };
    }
  };
}

describe('listBucketProductRollup sourceZone isolation', () => {
  const SHIFT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const LINE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const sharedOrders = [
    { id: 'o-1', shift_id: SHIFT, line_id: LINE, point_name: 'סלולר', source_zone: 'שפלה 2', deleted_at: null },
    { id: 'o-2', shift_id: SHIFT, line_id: LINE, point_name: 'סלולר', source_zone: 'שפלה אמצעי', deleted_at: null },
  ];

  const sharedItems = [
    { sku: '111', description: null, category: null, quantity: 10, order_id: 'o-1' },
    { sku: '222', description: null, category: null, quantity: 5, order_id: 'o-2' },
  ];

  it('returns only SKU 111 for sourceZone=שפלה 2', async () => {
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

  it('filters source_zone IS NULL for empty sourceZone sentinel', async () => {
    const orders = [
      { id: 'o-3', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: 'שפלה 2', deleted_at: null },
      { id: 'o-4', shift_id: SHIFT, line_id: LINE, point_name: 'כללי', source_zone: null, deleted_at: null },
    ];
    const items = [
      { sku: '333', description: null, category: null, quantity: 7, order_id: 'o-3' },
      { sku: '444', description: null, category: null, quantity: 3, order_id: 'o-4' },
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

  it('returns all products when sourceZone is omitted (legacy compat)', async () => {
    const supabase = fakeSupabase(sharedOrders, sharedItems);
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.listBucketProductRollup({
      shiftId: SHIFT, lineId: LINE, bucketName: 'סלולר'
    });

    expect(result).toHaveLength(2);
    const skus = result.map((r: BucketProductRollupRow) => r.sku).sort();
    expect(skus).toEqual(['111', '222']);
  });
});
