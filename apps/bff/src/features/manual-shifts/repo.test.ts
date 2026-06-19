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
});
