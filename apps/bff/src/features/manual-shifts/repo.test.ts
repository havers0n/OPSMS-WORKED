import { describe, expect, it } from 'vitest';
import type {
  ManualShiftOrder,
  ManualShiftOrderCheckUnit,
  ManualShiftOrderAshlama,
  ManualShiftWorkHierarchyResponse
} from '@wos/domain';
import { buildShiftWorkHierarchy } from './repo.js';

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

describe('buildShiftWorkHierarchy', () => {
  it('groups orders by pointName (legacy) into work buckets within a line', () => {
    const lineRows = [makeLineRow()];
    const orders = [
      makeOrder({ id: ORDER_1, pointName: 'סלולר', orderNumber: 'SO-1', customerName: 'לקוח א' }),
      makeOrder({ id: ORDER_2, pointName: 'סלולר', orderNumber: 'SO-2', customerName: 'לקוח א' })
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
      makeOrder({ id: ORDER_1, pointName: 'סלולר', orderNumber: 'SO-1', customerName: 'פז השקמה' }),
      makeOrder({ id: ORDER_2, pointName: 'פז השקמה', orderNumber: 'SO-2', customerName: 'דלק' })
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
      makeOrder({ id: ORDER_1, pointName: 'סלולר', orderNumber: 'SO-1', customerName: 'לקוח א' }),
      makeOrder({ id: ORDER_2, pointName: 'פז השקמה', orderNumber: 'SO-1', customerName: 'לקוח א' })
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
      makeOrder({ id: ORDER_1, lineId: LINE_A, pointName: 'סלולר', orderNumber: 'SO-1' }),
      makeOrder({ id: ORDER_2, lineId: LINE_B, pointName: 'מרכז', orderNumber: 'SO-2' })
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
    const orders = [makeOrder()];
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
    expect(area.statusBreakdown).toEqual({ queued: 1, picking: 0, waitingCheck: 1, returned: 0, done: 1 });
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
      makeOrder({ id: ORDER_1, lineId: LINE_A, pointName: 'דבאח עין המפרץ', orderNumber: 'SO26014230', lineCount: null }),
      makeOrder({ id: ORDER_2, lineId: LINE_A, pointName: 'דבאח עין המפרץ', orderNumber: 'SO-OTHER', lineCount: null }),
      makeOrder({ id: ORDER_3, lineId: LINE_B, pointName: 'סלולר', orderNumber: 'SO-NORTH', lineCount: null })
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
});
