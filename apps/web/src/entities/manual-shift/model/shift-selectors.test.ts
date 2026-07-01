import { describe, expect, it } from 'vitest';
import {
  selectShiftSummary,
  selectLineSummaries,
  selectPickerWorkloads,
  selectCheckQueue,
  selectActiveOrders,
  selectOrdersForLine,
  selectOrdersForPicker,
  selectLineDetail,
  selectPickerDetail,
  selectOrderDetail,
  summarizeManualShiftOrderCheckUnits,
  canCloseOrderFromCheckUnits,
  selectLineHierarchySummaries,
  selectWorkBucketSummaries,
  selectWorkHierarchyLineSummaries,
  selectWorkHierarchyBucketSummaries,
  selectWorkHierarchyAreaSummaries,
  selectWorkHierarchyLineSummariesByArea,
  selectLineDistributionGroupSummaries,
  selectLineRouteGroupSummaries,
  selectDistributionGroupWorkGroupSummaries,
  selectRouteGroupWorkBucketSummaries,
  NO_DISTRIBUTION_AREA_KEY,
  normalizePointName,
  NO_POINT_LABEL,
  NO_WORK_BUCKET_LABEL,
  type ShiftListOrder,
  type RouteGroupWorkBucketSummary
} from './shift-selectors';
import type {
  ManualShiftDaySummary,
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderCheckUnit,
  ManualShiftWorkHierarchyResponse
} from '@wos/domain';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SHIFT_ID = 'shift-0000-0000-0000-000000000000';
const TENANT_ID = 'tenant-000-0000-0000-000000000000';
const LINE_A = 'line-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LINE_B = 'line-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeOrder(overrides: Partial<ManualShiftOrder>): ManualShiftOrder {
  return {
    id: 'order-0000-0000-0000-000000000000',
    tenantId: TENANT_ID,
    shiftId: SHIFT_ID,
    lineId: LINE_A,
    orderNumber: null,
    customerName: null,
    pointName: null,
    palletCount: null,
    pickerName: null,
    pickerWorkerId: null,
    checkerName: null,
    lineCount: null,
    size: 'unknown',
    status: 'queued',
    startedAt: null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: '2026-05-27T08:00:00.000Z',
    updatedAt: '2026-05-27T08:00:00.000Z',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null,
    ...overrides,
    checkStartedAt: overrides.checkStartedAt ?? null
  };
}

function makeLineSummary(
  lineId: string,
  lineName: string,
  counts: Partial<{
    totalOrders: number;
    queuedOrders: number;
    pickingOrders: number;
    waitingCheckOrders: number;
    returnedOrders: number;
    doneOrders: number;
    errorCount: number;
  }> = {}
): ManualShiftLineSummary {
  return {
    line: {
      id: lineId,
      tenantId: TENANT_ID,
      shiftId: SHIFT_ID,
      name: lineName,
      distributionArea: null,
      sortOrder: 0,
      status: 'open',
      createdAt: '2026-05-27T08:00:00.000Z',
      deletedAt: null,
      deletedByProfileId: null,
      deletedByName: null,
      deleteReason: null
    },
    totalOrders: counts.totalOrders ?? 0,
    queuedOrders: counts.queuedOrders ?? 0,
    pickingOrders: counts.pickingOrders ?? 0,
    waitingCheckOrders: counts.waitingCheckOrders ?? 0,
    returnedOrders: counts.returnedOrders ?? 0,
    doneOrders: counts.doneOrders ?? 0,
    errorCount: counts.errorCount ?? 0
  };
}

function makeDaySummary(
  overrides: Partial<ManualShiftDaySummary> = {}
): ManualShiftDaySummary {
  return {
    shiftId: SHIFT_ID,
    totalOrders: 0,
    queuedOrders: 0,
    pickingOrders: 0,
    waitingCheckOrders: 0,
    returnedOrders: 0,
    doneOrders: 0,
    errorsCount: 0,
    byErrorType: [],
    byLine: [],
    byPicker: [],
    ...overrides
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// selectShiftSummary
// ─────────────────────────────────────────────────────────────────────────────

describe('selectShiftSummary', () => {
  it('maps all status counts correctly', () => {
    const summary = makeDaySummary({
      totalOrders: 10,
      queuedOrders: 2,
      pickingOrders: 3,
      waitingCheckOrders: 1,
      returnedOrders: 1,
      doneOrders: 3,
      errorsCount: 2
    });
    const result = selectShiftSummary(summary);
    expect(result).toEqual({
      totalOrders: 10,
      queued: 2,
      picking: 3,
      waitingCheck: 1,
      returned: 1,
      done: 3,
      errorsCount: 2,
      donePercent: 30,
      totalPalletCount: 0
    });
  });

  it('donePercent is 0 when totalOrders is 0', () => {
    const result = selectShiftSummary(makeDaySummary());
    expect(result.donePercent).toBe(0);
  });

  it('donePercent is 100 when all orders are done', () => {
    const result = selectShiftSummary(
      makeDaySummary({ totalOrders: 5, doneOrders: 5 })
    );
    expect(result.donePercent).toBe(100);
  });

  it('donePercent rounds to nearest integer (no floating noise)', () => {
    // 1/3 = 33.33... → 33
    const result = selectShiftSummary(
      makeDaySummary({ totalOrders: 3, doneOrders: 1 })
    );
    expect(result.donePercent).toBe(33);
    expect(Number.isInteger(result.donePercent)).toBe(true);
  });

  it('all zeros on empty summary', () => {
    const result = selectShiftSummary(makeDaySummary());
    expect(result.totalOrders).toBe(0);
    expect(result.queued).toBe(0);
    expect(result.picking).toBe(0);
    expect(result.waitingCheck).toBe(0);
    expect(result.returned).toBe(0);
    expect(result.done).toBe(0);
    expect(result.errorsCount).toBe(0);
    expect(result.donePercent).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectLineSummaries
// ─────────────────────────────────────────────────────────────────────────────

describe('selectLineSummaries', () => {
  it('aggregates lineCount and palletCount from raw orders', () => {
    const byLine = [makeLineSummary(LINE_A, 'Route A', { totalOrders: 2 })];
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, lineCount: 5, palletCount: 2 }),
      makeOrder({ id: 'o2', lineId: LINE_A, lineCount: 3, palletCount: 1 })
    ];
    const [line] = selectLineSummaries(byLine, orders);
    expect(line.totalLineCount).toBe(8);
    expect(line.totalPalletCount).toBe(3);
  });

  it('treats null lineCount and palletCount as 0', () => {
    const byLine = [makeLineSummary(LINE_A, 'Route A')];
    const orders = [makeOrder({ id: 'o1', lineId: LINE_A, lineCount: null, palletCount: null })];
    const [line] = selectLineSummaries(byLine, orders);
    expect(line.totalLineCount).toBe(0);
    expect(line.totalPalletCount).toBe(0);
  });

  it('derives status counts from raw orders', () => {
    const byLine = [makeLineSummary(LINE_A, 'Route A')];
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, status: 'queued' }),
      makeOrder({ id: 'o2', lineId: LINE_A, status: 'picking' }),
      makeOrder({ id: 'o3', lineId: LINE_A, status: 'waiting_check' }),
      makeOrder({ id: 'o4', lineId: LINE_A, status: 'returned' }),
      makeOrder({ id: 'o5', lineId: LINE_A, status: 'done' })
    ];
    const [line] = selectLineSummaries(byLine, orders);
    expect(line.queued).toBe(1);
    expect(line.picking).toBe(1);
    expect(line.waitingCheck).toBe(1);
    expect(line.returned).toBe(1);
    expect(line.done).toBe(1);
    expect(line.totalOrders).toBe(5);
  });

  it('donePercent is integer, 0 when no orders', () => {
    const byLine = [makeLineSummary(LINE_A, 'Route A')];
    const [line] = selectLineSummaries(byLine, []);
    expect(line.donePercent).toBe(0);
    expect(Number.isInteger(line.donePercent)).toBe(true);
  });

  it('donePercent is 100 when all done', () => {
    const byLine = [makeLineSummary(LINE_A, 'Route A')];
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, status: 'done' }),
      makeOrder({ id: 'o2', lineId: LINE_A, status: 'done' })
    ];
    const [line] = selectLineSummaries(byLine, orders);
    expect(line.donePercent).toBe(100);
  });

  it('wipCount is picking + waitingCheck + returned (excludes queued)', () => {
    const byLine = [makeLineSummary(LINE_A, 'Route A')];
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, status: 'queued' }),
      makeOrder({ id: 'o2', lineId: LINE_A, status: 'picking' }),
      makeOrder({ id: 'o3', lineId: LINE_A, status: 'waiting_check' }),
      makeOrder({ id: 'o4', lineId: LINE_A, status: 'returned' })
    ];
    const [line] = selectLineSummaries(byLine, orders);
    expect(line.wipCount).toBe(3);
    expect(line.queued).toBe(1);
  });

  it('preserves zero-order lines from byLine', () => {
    const byLine = [
      makeLineSummary(LINE_A, 'Route A', { totalOrders: 0 }),
      makeLineSummary(LINE_B, 'Route B', { totalOrders: 0 })
    ];
    const result = selectLineSummaries(byLine, []);
    expect(result).toHaveLength(2);
    expect(result[0].lineId).toBe(LINE_A);
    expect(result[1].lineId).toBe(LINE_B);
  });

  it('falls back to byLine counts when no raw orders exist for a line', () => {
    const byLine = [
      makeLineSummary(LINE_A, 'Route A', {
        totalOrders: 3,
        pickingOrders: 2,
        doneOrders: 1
      })
    ];
    const [line] = selectLineSummaries(byLine, []);
    expect(line.totalOrders).toBe(3);
    expect(line.picking).toBe(2);
    expect(line.done).toBe(1);
  });

  it('errorCount always comes from byLine', () => {
    const byLine = [makeLineSummary(LINE_A, 'Route A', { errorCount: 4 })];
    const orders = [makeOrder({ id: 'o1', lineId: LINE_A, status: 'done' })];
    const [line] = selectLineSummaries(byLine, orders);
    expect(line.errorCount).toBe(4);
  });

  it('identity fields come from byLine', () => {
    const byLine = [makeLineSummary(LINE_A, 'Route Alpha')];
    const [line] = selectLineSummaries(byLine, []);
    expect(line.lineId).toBe(LINE_A);
    expect(line.lineName).toBe('Route Alpha');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectPickerWorkloads
// ─────────────────────────────────────────────────────────────────────────────

describe('selectPickerWorkloads', () => {
  it('groups orders by pickerName into separate entries', () => {
    const orders = [
      makeOrder({ id: 'o1', pickerName: 'Alice', lineCount: 4 }),
      makeOrder({ id: 'o2', pickerName: 'Bob', lineCount: 6 }),
      makeOrder({ id: 'o3', pickerName: 'Alice', lineCount: 2 })
    ];
    const result = selectPickerWorkloads(orders);
    expect(result).toHaveLength(2);
    const alice = result.find((w) => w.pickerName === 'Alice')!;
    expect(alice.totalOrders).toBe(2);
    expect(alice.totalLineCount).toBe(6);
  });

  it('null pickerName goes into __unassigned__ bucket', () => {
    const orders = [
      makeOrder({ id: 'o1', pickerName: null, lineCount: 5 }),
      makeOrder({ id: 'o2', pickerName: null, lineCount: 3 })
    ];
    const result = selectPickerWorkloads(orders);
    expect(result).toHaveLength(1);
    expect(result[0].pickerKey).toBe('__unassigned__');
    expect(result[0].pickerName).toBeNull();
    expect(result[0].totalLineCount).toBe(8);
  });

  it('named pickers have pickerKey equal to pickerName', () => {
    const orders = [makeOrder({ id: 'o1', pickerName: 'Dana', lineCount: 3 })];
    const [w] = selectPickerWorkloads(orders);
    expect(w.pickerKey).toBe('Dana');
  });

  it('sorted descending by totalLineCount', () => {
    const orders = [
      makeOrder({ id: 'o1', pickerName: 'Low', lineCount: 2 }),
      makeOrder({ id: 'o2', pickerName: 'High', lineCount: 10 }),
      makeOrder({ id: 'o3', pickerName: 'Mid', lineCount: 5 })
    ];
    const result = selectPickerWorkloads(orders);
    expect(result.map((w) => w.pickerName)).toEqual(['High', 'Mid', 'Low']);
  });

  it('avgLinesPerOrder uses lineCount sum / order count, one decimal', () => {
    const orders = [
      makeOrder({ id: 'o1', pickerName: 'Alice', lineCount: 5 }),
      makeOrder({ id: 'o2', pickerName: 'Alice', lineCount: 4 }),
      makeOrder({ id: 'o3', pickerName: 'Alice', lineCount: 3 })
    ];
    const [w] = selectPickerWorkloads(orders);
    expect(w.avgLinesPerOrder).toBe(4); // 12/3 = 4.0
  });

  it('avgLinesPerOrder rounds to one decimal', () => {
    const orders = [
      makeOrder({ id: 'o1', pickerName: 'Alice', lineCount: 1 }),
      makeOrder({ id: 'o2', pickerName: 'Alice', lineCount: 2 }),
      makeOrder({ id: 'o3', pickerName: 'Alice', lineCount: 3 })
    ];
    const [w] = selectPickerWorkloads(orders);
    expect(w.avgLinesPerOrder).toBe(2); // 6/3 = 2.0
  });

  it('avgLinesPerOrder is null when totalOrders is 0', () => {
    const result = selectPickerWorkloads([]);
    expect(result).toHaveLength(0);
  });

  it('null lineCount treated as 0 in totals', () => {
    const orders = [
      makeOrder({ id: 'o1', pickerName: 'Alice', lineCount: null }),
      makeOrder({ id: 'o2', pickerName: 'Alice', lineCount: 6 })
    ];
    const [w] = selectPickerWorkloads(orders);
    expect(w.totalLineCount).toBe(6);
    expect(w.avgLinesPerOrder).toBe(3); // 6/2
  });

  it('wipCount is picking + waitingCheck + returned', () => {
    const orders = [
      makeOrder({ id: 'o1', pickerName: 'Alice', status: 'queued' }),
      makeOrder({ id: 'o2', pickerName: 'Alice', status: 'picking' }),
      makeOrder({ id: 'o3', pickerName: 'Alice', status: 'waiting_check' }),
      makeOrder({ id: 'o4', pickerName: 'Alice', status: 'returned' }),
      makeOrder({ id: 'o5', pickerName: 'Alice', status: 'done' })
    ];
    const [w] = selectPickerWorkloads(orders);
    expect(w.wipCount).toBe(3);
    expect(w.queued).toBe(1);
    expect(w.done).toBe(1);
  });

  it('returned orders are included in wipCount', () => {
    const orders = [
      makeOrder({ id: 'o1', pickerName: 'Alice', status: 'returned' }),
      makeOrder({ id: 'o2', pickerName: 'Alice', status: 'returned' })
    ];
    const [w] = selectPickerWorkloads(orders);
    expect(w.returned).toBe(2);
    expect(w.wipCount).toBe(2);
  });

  it('humanMinutes is null when no order has startedAt', () => {
    const orders = [makeOrder({ id: 'o1', pickerName: 'Alice', status: 'done', startedAt: null })];
    const [w] = selectPickerWorkloads(orders);
    expect(w.humanMinutes).toBeNull();
  });

  it('humanMinutes sums completed picking cycles (waitingCheckAt - startedAt)', () => {
    const start1 = '2024-01-01T08:00:00.000Z';
    const end1 = '2024-01-01T08:30:00.000Z'; // 30 min
    const start2 = '2024-01-01T09:00:00.000Z';
    const end2 = '2024-01-01T09:20:00.000Z'; // 20 min
    const orders = [
      makeOrder({ id: 'o1', pickerName: 'Alice', status: 'waiting_check', startedAt: start1, waitingCheckAt: end1 }),
      makeOrder({ id: 'o2', pickerName: 'Alice', status: 'done', startedAt: start2, waitingCheckAt: end2 })
    ];
    const [w] = selectPickerWorkloads(orders);
    expect(w.humanMinutes).toBe(50);
  });

  it('humanMinutes includes in-progress order elapsed time', () => {
    const start = '2024-01-01T10:00:00.000Z';
    const now = new Date('2024-01-01T10:45:00.000Z'); // 45 min in
    const orders = [
      makeOrder({ id: 'o1', pickerName: 'Alice', status: 'picking', startedAt: start, waitingCheckAt: null })
    ];
    const [w] = selectPickerWorkloads(orders, now);
    expect(w.humanMinutes).toBe(45);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectCheckQueue
// ─────────────────────────────────────────────────────────────────────────────

describe('selectCheckQueue', () => {
  it('filters to waiting_check orders only', () => {
    const orders = [
      makeOrder({ id: 'o1', status: 'queued' }),
      makeOrder({ id: 'o2', status: 'picking' }),
      makeOrder({ id: 'o3', status: 'waiting_check', waitingCheckAt: '2026-05-27T08:00:00.000Z' }),
      makeOrder({ id: 'o4', status: 'returned' }),
      makeOrder({ id: 'o5', status: 'done' })
    ];
    const result = selectCheckQueue(orders, new Date('2026-05-27T08:05:00.000Z'));
    expect(result.count).toBe(1);
    expect(result.orders[0].orderId).toBe('o3');
  });

  it('returns empty queue with null oldestOrder when no waiting orders', () => {
    const result = selectCheckQueue([], new Date());
    expect(result.count).toBe(0);
    expect(result.orders).toHaveLength(0);
    expect(result.oldestOrder).toBeNull();
  });

  it('sorted by waitingCheckAt ascending (oldest first)', () => {
    const orders = [
      makeOrder({
        id: 'newer',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T09:00:00.000Z'
      }),
      makeOrder({
        id: 'oldest',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T07:00:00.000Z'
      }),
      makeOrder({
        id: 'middle',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T08:00:00.000Z'
      })
    ];
    const result = selectCheckQueue(orders, new Date('2026-05-27T10:00:00.000Z'));
    expect(result.orders.map((e) => e.orderId)).toEqual(['oldest', 'middle', 'newer']);
  });

  it('null waitingCheckAt sorts last', () => {
    const orders = [
      makeOrder({
        id: 'with-ts',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T08:00:00.000Z'
      }),
      makeOrder({ id: 'no-ts', status: 'waiting_check', waitingCheckAt: null })
    ];
    const result = selectCheckQueue(orders, new Date('2026-05-27T09:00:00.000Z'));
    expect(result.orders[0].orderId).toBe('with-ts');
    expect(result.orders[1].orderId).toBe('no-ts');
  });

  it('waitingSeconds computed correctly', () => {
    const orders = [
      makeOrder({
        id: 'o1',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T08:00:00.000Z'
      })
    ];
    const now = new Date('2026-05-27T08:05:30.000Z');
    const result = selectCheckQueue(orders, now);
    expect(result.orders[0].waitingSeconds).toBe(330); // 5m 30s
  });

  it('waitingSeconds is null when waitingCheckAt is null', () => {
    const orders = [makeOrder({ id: 'o1', status: 'waiting_check', waitingCheckAt: null })];
    const result = selectCheckQueue(orders, new Date());
    expect(result.orders[0].waitingSeconds).toBeNull();
  });

  it('oldestOrder is the first entry after sort', () => {
    const orders = [
      makeOrder({
        id: 'newer',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T09:00:00.000Z'
      }),
      makeOrder({
        id: 'oldest',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T07:00:00.000Z'
      })
    ];
    const result = selectCheckQueue(orders, new Date('2026-05-27T10:00:00.000Z'));
    expect(result.oldestOrder?.orderId).toBe('oldest');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectActiveOrders
// ─────────────────────────────────────────────────────────────────────────────

describe('selectActiveOrders', () => {
  it('excludes done orders', () => {
    const orders = [
      makeOrder({ id: 'o1', status: 'queued' }),
      makeOrder({ id: 'o2', status: 'done' })
    ];
    const result = selectActiveOrders(orders, new Date());
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o1');
  });

  it('includes queued, picking, waiting_check, returned', () => {
    const now = new Date('2026-05-27T10:00:00.000Z');
    const orders = [
      makeOrder({ id: 'q', status: 'queued', createdAt: '2026-05-27T09:00:00.000Z' }),
      makeOrder({ id: 'p', status: 'picking', startedAt: '2026-05-27T09:30:00.000Z' }),
      makeOrder({
        id: 'w',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T09:45:00.000Z'
      }),
      makeOrder({ id: 'r', status: 'returned' })
    ];
    const result = selectActiveOrders(orders, now);
    expect(result).toHaveLength(4);
  });

  it('queued uses createdAt for ageSeconds', () => {
    const orders = [
      makeOrder({
        id: 'o1',
        status: 'queued',
        createdAt: '2026-05-27T09:00:00.000Z'
      })
    ];
    const now = new Date('2026-05-27T10:00:00.000Z');
    const [active] = selectActiveOrders(orders, now);
    expect(active.ageSeconds).toBe(3600);
  });

  it('picking uses startedAt for ageSeconds', () => {
    const orders = [
      makeOrder({
        id: 'o1',
        status: 'picking',
        startedAt: '2026-05-27T09:30:00.000Z',
        createdAt: '2026-05-27T09:00:00.000Z'
      })
    ];
    const now = new Date('2026-05-27T10:00:00.000Z');
    const [active] = selectActiveOrders(orders, now);
    expect(active.ageSeconds).toBe(1800); // 30 min, not 60
  });

  it('picking with null startedAt returns null ageSeconds (no createdAt fallback)', () => {
    const orders = [
      makeOrder({
        id: 'o1',
        status: 'picking',
        startedAt: null,
        createdAt: '2026-05-27T09:00:00.000Z'
      })
    ];
    const [active] = selectActiveOrders(orders, new Date());
    expect(active.ageSeconds).toBeNull();
  });

  it('waiting_check uses waitingCheckAt for ageSeconds', () => {
    const orders = [
      makeOrder({
        id: 'o1',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T09:50:00.000Z'
      })
    ];
    const now = new Date('2026-05-27T10:00:00.000Z');
    const [active] = selectActiveOrders(orders, now);
    expect(active.ageSeconds).toBe(600);
  });

  it('waiting_check with null waitingCheckAt returns null ageSeconds', () => {
    const orders = [makeOrder({ id: 'o1', status: 'waiting_check', waitingCheckAt: null })];
    const [active] = selectActiveOrders(orders, new Date());
    expect(active.ageSeconds).toBeNull();
  });

  it('returned always returns null ageSeconds (no returnedAt field)', () => {
    const orders = [
      makeOrder({
        id: 'o1',
        status: 'returned',
        createdAt: '2026-05-27T09:00:00.000Z',
        startedAt: '2026-05-27T09:10:00.000Z'
      })
    ];
    const [active] = selectActiveOrders(orders, new Date('2026-05-27T10:00:00.000Z'));
    expect(active.ageSeconds).toBeNull();
  });

  it('empty input returns empty array without crash', () => {
    expect(selectActiveOrders([], new Date())).toEqual([]);
  });

  it('status field preserved correctly on each active order', () => {
    const orders = [
      makeOrder({ id: 'q', status: 'queued' }),
      makeOrder({ id: 'p', status: 'picking', startedAt: '2026-05-27T09:00:00.000Z' }),
      makeOrder({
        id: 'w',
        status: 'waiting_check',
        waitingCheckAt: '2026-05-27T09:00:00.000Z'
      }),
      makeOrder({ id: 'r', status: 'returned' })
    ];
    const result = selectActiveOrders(orders, new Date('2026-05-27T10:00:00.000Z'));
    const statuses = result.map((o) => o.status);
    expect(statuses).toContain('queued');
    expect(statuses).toContain('picking');
    expect(statuses).toContain('waiting_check');
    expect(statuses).toContain('returned');
  });
});

describe('detail selectors', () => {
  it('selectOrdersForLine filters only selected line and sorts by attention priority', () => {
    const orders = [
      makeOrder({ id: 'd', lineId: LINE_A, status: 'done' }),
      makeOrder({ id: 'q', lineId: LINE_A, status: 'queued' }),
      makeOrder({ id: 'r', lineId: LINE_A, status: 'returned' }),
      makeOrder({ id: 'w', lineId: LINE_A, status: 'waiting_check' }),
      makeOrder({ id: 'p', lineId: LINE_A, status: 'picking' }),
      makeOrder({ id: 'other', lineId: LINE_B, status: 'returned' })
    ];
    const result = selectOrdersForLine(LINE_A, orders);
    expect(result.map((o) => o.id)).toEqual(['r', 'w', 'p', 'q', 'd']);
  });

  it('selectOrdersForPicker filters by same pickerKey semantics as picker workloads', () => {
    const orders = [
      makeOrder({ id: 'u1', pickerName: null }),
      makeOrder({ id: 'u2', pickerName: null }),
      makeOrder({ id: 'a1', pickerName: 'Alice' })
    ];
    const unassigned = selectOrdersForPicker('__unassigned__', orders);
    const alice = selectOrdersForPicker('Alice', orders);
    expect(unassigned.map((o) => o.id)).toEqual(['u1', 'u2']);
    expect(alice.map((o) => o.id)).toEqual(['a1']);
  });

  it('selectLineDetail returns stale-safe state when line is missing', () => {
    const detail = selectLineDetail('missing', [], [makeOrder({ id: 'o1' })]);
    expect(detail.summary).toBeNull();
    expect(detail.orders).toEqual([]);
  });

  it('selectLineDetail keeps returned age null and preserves nullable size', () => {
    const byLine = [makeLineSummary(LINE_A, 'Route A')];
    const lineSummaries = selectLineSummaries(byLine, [
      makeOrder({ id: 'r1', lineId: LINE_A, status: 'returned' })
    ]);
    const detail = selectLineDetail(
      LINE_A,
      lineSummaries,
      [makeOrder({ id: 'r1', lineId: LINE_A, status: 'returned' })],
      new Date('2026-05-27T10:00:00.000Z')
    );
    expect(detail.orders[0].ageSeconds).toBeNull();
    expect(detail.orders[0].size).toBe('unknown');
  });

  it('selectPickerDetail filters only selected picker bucket and returns line breakdown', () => {
    const orders = [
      makeOrder({ id: 'a1', pickerName: 'Alice', lineId: LINE_A, lineCount: 5, palletCount: 2 }),
      makeOrder({ id: 'a2', pickerName: 'Alice', lineId: LINE_B, lineCount: 3, palletCount: 1 }),
      makeOrder({ id: 'b1', pickerName: 'Bob', lineId: LINE_A, lineCount: 8, palletCount: 3 })
    ];
    const pickers = selectPickerWorkloads(orders);
    const lines = selectLineSummaries(
      [makeLineSummary(LINE_A, 'Route A'), makeLineSummary(LINE_B, 'Route B')],
      orders
    );
    const detail = selectPickerDetail('Alice', pickers, orders, lines);
    expect(detail.summary?.pickerName).toBe('Alice');
    expect(detail.orders.map((o) => o.orderId)).toEqual(['a1', 'a2']);
    expect(detail.lineBreakdown.map((l) => l.lineId)).toEqual([LINE_A, LINE_B]);
  });

  it('selectPickerDetail returns stale-safe state when picker bucket is missing', () => {
    const detail = selectPickerDetail('missing', [], [makeOrder({ id: 'o1' })], []);
    expect(detail.summary).toBeNull();
    expect(detail.orders).toEqual([]);
    expect(detail.lineBreakdown).toEqual([]);
  });

  it('selectOrderDetail returns null for stale order selection', () => {
    const detail = selectOrderDetail('missing', [], []);
    expect(detail).toBeNull();
  });

  it('selectOrderDetail maps line name and workload/status fields', () => {
    const order = makeOrder({
      id: 'o1',
      lineId: LINE_A,
      status: 'picking',
      pointName: 'Point A',
      customerName: 'Customer A',
      orderNumber: 'ORD-1',
      pickerName: 'Alice',
      checkerName: 'Bob',
      lineCount: 4,
      palletCount: 2,
      size: 'M',
      startedAt: '2026-05-27T09:00:00.000Z'
    });
    const lines = selectLineSummaries([makeLineSummary(LINE_A, 'Route A')], [order]);
    const detail = selectOrderDetail('o1', [order], lines, new Date('2026-05-27T10:00:00.000Z'));
    expect(detail?.lineName).toBe('Route A');
    expect(detail?.pickerName).toBe('Alice');
    expect(detail?.checkerName).toBe('Bob');
    expect(detail?.lineCount).toBe(4);
    expect(detail?.status).toBe('picking');
    expect(detail?.ageSeconds).toBe(3600);
  });

  it('selectOrderDetail keeps returned age null', () => {
    const order = makeOrder({
      id: 'r1',
      lineId: LINE_A,
      status: 'returned'
    });
    const lines = selectLineSummaries([makeLineSummary(LINE_A, 'Route A')], [order]);
    const detail = selectOrderDetail('r1', [order], lines, new Date('2026-05-27T10:00:00.000Z'));
    expect(detail?.ageSeconds).toBeNull();
  });
});

describe('manual shift order check unit aggregates', () => {
  function unit(status: ManualShiftOrderCheckUnit['status']): Pick<ManualShiftOrderCheckUnit, 'status'> {
    return { status };
  }

  it('no units', () => {
    const result = summarizeManualShiftOrderCheckUnits([]);
    expect(result.activeUnits).toBe(0);
    expect(result.openUnits).toBe(0);
    expect(result.checkedUnits).toBe(0);
    expect(result.returnedUnits).toBe(0);
    expect(result.voidedUnits).toBe(0);
    expect(result.partiallyChecked).toBe(false);
    expect(result.physicallyChecked).toBe(false);
    expect(canCloseOrderFromCheckUnits([], null)).toBe(false);
  });

  it('open only', () => {
    const result = summarizeManualShiftOrderCheckUnits([unit('open')]);
    expect(result.activeUnits).toBe(1);
    expect(result.openUnits).toBe(1);
    expect(result.checkedUnits).toBe(0);
    expect(result.partiallyChecked).toBe(false);
    expect(result.physicallyChecked).toBe(false);
  });

  it('checked + open => partially checked', () => {
    const result = summarizeManualShiftOrderCheckUnits([unit('checked'), unit('open')]);
    expect(result.partiallyChecked).toBe(true);
    expect(result.physicallyChecked).toBe(false);
  });

  it('all active checked => physically checked', () => {
    const result = summarizeManualShiftOrderCheckUnits([unit('checked'), unit('checked')]);
    expect(result.activeUnits).toBe(2);
    expect(result.physicallyChecked).toBe(true);
    expect(canCloseOrderFromCheckUnits([unit('checked')], 1)).toBe(true);
  });

  it('returned blocks physically checked', () => {
    const result = summarizeManualShiftOrderCheckUnits([unit('checked'), unit('returned')]);
    expect(result.returnedUnits).toBe(1);
    expect(result.physicallyChecked).toBe(false);
    expect(canCloseOrderFromCheckUnits([unit('checked'), unit('returned')], 2)).toBe(false);
  });

  it('voided excluded from active progress', () => {
    const result = summarizeManualShiftOrderCheckUnits([unit('checked'), unit('voided')]);
    expect(result.activeUnits).toBe(1);
    expect(result.voidedUnits).toBe(1);
    expect(result.physicallyChecked).toBe(true);
  });

  it('only voided does not count as physically checked', () => {
    const result = summarizeManualShiftOrderCheckUnits([unit('voided')]);
    expect(result.activeUnits).toBe(0);
    expect(result.voidedUnits).toBe(1);
    expect(result.physicallyChecked).toBe(false);
    expect(canCloseOrderFromCheckUnits([unit('voided')], 1)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizePointName
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizePointName', () => {
  it('returns NO_POINT_LABEL for null', () => {
    expect(normalizePointName(null)).toBe(NO_POINT_LABEL);
  });

  it('returns NO_POINT_LABEL for undefined', () => {
    expect(normalizePointName(undefined)).toBe(NO_POINT_LABEL);
  });

  it('returns NO_POINT_LABEL for empty string', () => {
    expect(normalizePointName('')).toBe(NO_POINT_LABEL);
  });

  it('returns NO_POINT_LABEL for whitespace-only string', () => {
    expect(normalizePointName('   ')).toBe(NO_POINT_LABEL);
  });

  it('returns trimmed non-empty string', () => {
    expect(normalizePointName('  ג.גפנר  ')).toBe('ג.גפנר');
  });

  it('returns the string when no trimming needed', () => {
    expect(normalizePointName('שרון')).toBe('שרון');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectLineHierarchySummaries
// ─────────────────────────────────────────────────────────────────────────────

describe('selectLineHierarchySummaries', () => {
  it('derives ordersCount and itemLinesCount from lineSummaries', () => {
    const lineSummaries = selectLineSummaries(
      [makeLineSummary(LINE_A, 'Route A', { totalOrders: 5 })],
      [makeOrder({ id: 'o1', lineId: LINE_A, lineCount: 3 })]
    );
    const result = selectLineHierarchySummaries(lineSummaries, [makeOrder({ id: 'o1', lineId: LINE_A, lineCount: 3, status: 'queued' })]);
    expect(result).toHaveLength(1);
    expect(result[0].ordersCount).toBe(1);
    expect(result[0].itemLinesCount).toBe(3);
  });

  it('sums totalQuantity from orders', () => {
    const lineSummaries = selectLineSummaries(
      [makeLineSummary(LINE_A, 'Route A')],
      [makeOrder({ id: 'o1', lineId: LINE_A, lineCount: 2 })]
    );
    const orders = [
      { ...makeOrder({ id: 'o1', lineId: LINE_A, lineCount: 2 }), totalQuantity: 10 },
      { ...makeOrder({ id: 'o2', lineId: LINE_A, lineCount: 3 }), totalQuantity: 22 }
    ] as ManualShiftOrder[] & { totalQuantity?: number }[];
    const result = selectLineHierarchySummaries(lineSummaries, orders as ShiftListOrder[]);
    expect(result[0].totalQuantity).toBe(32);
  });

  it('computes status breakdown from lineSummary data', () => {
    const lineSummaries = selectLineSummaries(
      [makeLineSummary(LINE_A, 'Route A')],
      [
        makeOrder({ id: 'o1', lineId: LINE_A, status: 'queued' }),
        makeOrder({ id: 'o2', lineId: LINE_A, status: 'picking' }),
        makeOrder({ id: 'o3', lineId: LINE_A, status: 'waiting_check' }),
        makeOrder({ id: 'o4', lineId: LINE_A, status: 'returned' }),
        makeOrder({ id: 'o5', lineId: LINE_A, status: 'done' })
      ]
    );
    const result = selectLineHierarchySummaries(lineSummaries, [
      makeOrder({ id: 'o1', lineId: LINE_A, status: 'queued' }),
      makeOrder({ id: 'o2', lineId: LINE_A, status: 'picking' }),
      makeOrder({ id: 'o3', lineId: LINE_A, status: 'waiting_check' }),
      makeOrder({ id: 'o4', lineId: LINE_A, status: 'returned' }),
      makeOrder({ id: 'o5', lineId: LINE_A, status: 'done' })
    ]);
    expect(result[0].statusBreakdown).toEqual({
      queued: 1, picking: 1, waitingCheck: 1, returned: 1, done: 1
    });
  });

  it('preserves zero-order lines from byLine', () => {
    const lineSummaries = selectLineSummaries(
      [makeLineSummary(LINE_A, 'Route A'), makeLineSummary(LINE_B, 'Route B')],
      []
    );
    const result = selectLineHierarchySummaries(lineSummaries, []);
    expect(result).toHaveLength(2);
    expect(result[0].lineId).toBe(LINE_A);
    expect(result[0].ordersCount).toBe(0);
    expect(result[1].lineId).toBe(LINE_B);
  });

  it('returns empty array for empty lineSummaries', () => {
    const result = selectLineHierarchySummaries([], []);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectWorkBucketSummaries
// ─────────────────────────────────────────────────────────────────────────────

describe('selectWorkBucketSummaries', () => {
  it('groups orders by pointName under a line', () => {
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, pointName: 'ג.גפנר', lineCount: 2 }),
      makeOrder({ id: 'o2', lineId: LINE_A, pointName: 'ג.גפנר', lineCount: 3 }),
      makeOrder({ id: 'o3', lineId: LINE_A, pointName: 'ירושלים', lineCount: 5 })
    ];
    const result = selectWorkBucketSummaries(LINE_A, orders);
    expect(result).toHaveLength(2);
    const gfenster = result.find((p) => p.workBucketName === 'ג.גפנר')!;
    const jerusalem = result.find((p) => p.workBucketName === 'ירושלים')!;
    expect(gfenster.ordersCount).toBe(2);
    expect(gfenster.itemLinesCount).toBe(5);
    expect(jerusalem.ordersCount).toBe(1);
    expect(jerusalem.itemLinesCount).toBe(5);
  });

  it('normalizes null pointName to ללא קבוצת עבודה', () => {
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, pointName: null }),
      makeOrder({ id: 'o2', lineId: LINE_A, pointName: '' })
    ];
    const result = selectWorkBucketSummaries(LINE_A, orders);
    expect(result).toHaveLength(1);
    expect(result[0].workBucketName).toBe(NO_WORK_BUCKET_LABEL);
    expect(result[0].ordersCount).toBe(2);
  });

  it('does not merge duplicate bucket names across different lines', () => {
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, pointName: 'תל אביב' }),
      makeOrder({ id: 'o2', lineId: LINE_B, pointName: 'תל אביב' })
    ];
    const resultA = selectWorkBucketSummaries(LINE_A, orders);
    const resultB = selectWorkBucketSummaries(LINE_B, orders);
    expect(resultA).toHaveLength(1);
    expect(resultA[0].workBucketName).toBe('תל אביב');
    expect(resultA[0].ordersCount).toBe(1);
    expect(resultB).toHaveLength(1);
    expect(resultB[0].workBucketName).toBe('תל אביב');
    expect(resultB[0].ordersCount).toBe(1);
  });

  it('computes ordersCount, itemLinesCount, totalQuantity for each work bucket', () => {
    const orders = [
      { ...makeOrder({ id: 'o1', lineId: LINE_A, pointName: 'שרון', lineCount: 2, status: 'picking' }), totalQuantity: 32 },
      { ...makeOrder({ id: 'o2', lineId: LINE_A, pointName: 'שרון', lineCount: 1, status: 'queued' }), totalQuantity: 10 }
    ] as ShiftListOrder[];
    const result = selectWorkBucketSummaries(LINE_A, orders);
    expect(result[0].ordersCount).toBe(2);
    expect(result[0].itemLinesCount).toBe(3);
    expect(result[0].totalQuantity).toBe(42);
  });

  it('computes status breakdown per work bucket', () => {
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, pointName: 'שרון', status: 'picking' }),
      makeOrder({ id: 'o2', lineId: LINE_A, pointName: 'שרון', status: 'queued' }),
      makeOrder({ id: 'o3', lineId: LINE_A, pointName: 'שרון', status: 'returned' })
    ];
    const result = selectWorkBucketSummaries(LINE_A, orders);
    expect(result[0].statusBreakdown).toEqual({
      queued: 1, picking: 1, waitingCheck: 0, returned: 1, done: 0
    });
  });

  it('includes orders array in each work bucket summary', () => {
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, pointName: 'שרון', orderNumber: 'SO-001' })
    ];
    const result = selectWorkBucketSummaries(LINE_A, orders);
    expect(result[0].orders).toHaveLength(1);
    expect(result[0].orders[0].orderId).toBe('o1');
    expect(result[0].orders[0].orderNumber).toBe('SO-001');
  });

  it('returns empty array when no orders match lineId', () => {
    const orders = [makeOrder({ id: 'o1', lineId: LINE_B })];
    const result = selectWorkBucketSummaries(LINE_A, orders);
    expect(result).toEqual([]);
  });

  it('sorts work buckets by ordersCount descending', () => {
    const orders = [
      makeOrder({ id: 'o1', lineId: LINE_A, pointName: 'קטן' }),
      makeOrder({ id: 'o2', lineId: LINE_A, pointName: 'גדול' }),
      makeOrder({ id: 'o3', lineId: LINE_A, pointName: 'גדול' }),
      makeOrder({ id: 'o4', lineId: LINE_A, pointName: 'גדול' })
    ];
    const result = selectWorkBucketSummaries(LINE_A, orders);
    expect(result[0].workBucketName).toBe('גדול');
    expect(result[0].ordersCount).toBe(3);
    expect(result[1].workBucketName).toBe('קטן');
    expect(result[1].ordersCount).toBe(1);
  });
});

  // ── Work hierarchy selector tests ──────────────────────────────────────────
  // These lock assumptions about the corrected model shape.

  describe('selectWorkHierarchyLineSummaries', () => {
    const ORDER_A_ID = 'order-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const ORDER_B_ID = 'order-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    function makeHierarchy(
      overrides: Partial<ManualShiftWorkHierarchyResponse> = {}
    ): ManualShiftWorkHierarchyResponse {
      return {
        shiftId: SHIFT_ID,
        areas: [
          {
            areaName: 'דרום',
            displayName: 'דרום',
            totalLines: 1,
            totalBuckets: 2,
            totalOrders: 2,
            totalQuantity: 30,
            statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: [
              {
                lineId: LINE_A,
                lineGroupName: 'קו דרום',
                distributionArea: 'דרום',
                status: 'open',
                totalBuckets: 2,
                totalOrders: 2,
                totalQuantity: 30,
                statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                buckets: [
                  {
                    bucketName: 'סלולר',
                    displayName: 'סלולר',
                    totalOrders: 1,
                    totalQuantity: 10,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [{
                      orderId: ORDER_A_ID,
                      orderNumber: 'SO-1',
                      customerName: 'לקוח א',
                      pointName: 'סלולר',
                      status: 'queued',
                      totalQuantity: 10,
                      hasAshlama: false,
                      hasCheckUnits: false,
                      lineCount: 0
                    }]
                  },
                  {
                    bucketName: 'פז השקמה',
                    displayName: 'פז השקמה',
                    totalOrders: 1,
                    totalQuantity: 20,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [{
                      orderId: ORDER_B_ID,
                      orderNumber: 'SO-1',
                      customerName: 'לקוח א',
                      pointName: 'פז השקמה',
                      status: 'queued',
                      totalQuantity: 20,
                      hasAshlama: false,
                      hasCheckUnits: false,
                      lineCount: 0
                    }]
                  }
                ]
              }
            ]
          }
        ],
        ...overrides
      };
    }

    it('flattens areas into line summaries', () => {
      const result = selectWorkHierarchyLineSummaries(makeHierarchy());
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        lineId: LINE_A,
        lineName: 'קו דרום',
        distributionArea: 'דרום'
      });
    });

    it('preserves distributionArea on each line summary', () => {
      const result = selectWorkHierarchyLineSummaries(makeHierarchy());
      expect(result[0].distributionArea).toBe('דרום');
    });

    it('returns empty array for undefined hierarchy', () => {
      expect(selectWorkHierarchyLineSummaries(undefined)).toEqual([]);
    });

    it('flattens lines from multiple areas', () => {
      const lineB = 'line-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const hierarchy = makeHierarchy({
        areas: [
          {
            areaName: 'דרום',
            displayName: 'דרום',
            totalLines: 1,
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 10,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: [{
              lineId: LINE_A,
              lineGroupName: 'קו דרום',
              distributionArea: 'דרום',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 10,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [{
                bucketName: 'סלולר',
                displayName: 'סלולר',
                totalOrders: 1,
                totalQuantity: 10,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: [{
                  orderId: ORDER_A_ID,
                  orderNumber: 'SO-1',
                  customerName: 'לקוח א',
                  pointName: 'סלולר',
                  status: 'queued',
                  totalQuantity: 10,
                  hasAshlama: false,
                  hasCheckUnits: false,
                  lineCount: 0
                }]
              }]
            }]
          },
          {
            areaName: 'צפון',
            displayName: 'צפון',
            totalLines: 1,
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 5,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: [{
              lineId: lineB,
              lineGroupName: 'קו צפון',
              distributionArea: 'צפון',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 5,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [{
                bucketName: 'מרכז',
                displayName: 'מרכז',
                totalOrders: 1,
                totalQuantity: 5,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: [{
                  orderId: ORDER_B_ID,
                  orderNumber: 'SO-2',
                  customerName: 'לקוח ב',
                  pointName: 'מרכז',
                  status: 'queued',
                  totalQuantity: 5,
                  hasAshlama: false,
                  hasCheckUnits: false,
                  lineCount: 0
                }]
              }]
            }]
          }
        ]
      });
      const result = selectWorkHierarchyLineSummaries(hierarchy);
      expect(result).toHaveLength(2);
      expect(result[0].distributionArea).toBe('דרום');
      expect(result[1].distributionArea).toBe('צפון');
    });
  });

  describe('selectWorkHierarchyBucketSummaries', () => {
    const ORDER_A_ID = 'order-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const ORDER_B_ID = 'order-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    function makeHierarchy(
      overrides: Partial<ManualShiftWorkHierarchyResponse> = {}
    ): ManualShiftWorkHierarchyResponse {
      return {
        shiftId: SHIFT_ID,
        areas: [
          {
            areaName: 'דרום',
            displayName: 'דרום',
            totalLines: 1,
            totalBuckets: 2,
            totalOrders: 2,
            totalQuantity: 30,
            statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: [
              {
                lineId: LINE_A,
                lineGroupName: 'קו דרום',
                distributionArea: 'דרום',
                status: 'open',
                totalBuckets: 2,
                totalOrders: 2,
                totalQuantity: 30,
                statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                buckets: [
                  {
                    bucketName: 'סלולר',
                    displayName: 'סלולר',
                    totalOrders: 1,
                    totalQuantity: 10,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [{
                      orderId: ORDER_A_ID,
                      orderNumber: 'SO-1',
                      customerName: 'לקוח א',
                      pointName: 'סלולר',
                      status: 'queued',
                      totalQuantity: 10,
                      hasAshlama: false,
                      hasCheckUnits: false,
                      lineCount: 0
                    }]
                  },
                  {
                    bucketName: 'פז השקמה',
                    displayName: 'פז השקמה',
                    totalOrders: 1,
                    totalQuantity: 20,
                    statusBreakdown: { queued: 0, picking: 1, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [{
                      orderId: ORDER_B_ID,
                      orderNumber: 'SO-1',
                      customerName: 'לקוח א',
                      pointName: 'פז השקמה',
                      status: 'picking',
                      totalQuantity: 20,
                      hasAshlama: true,
                      hasCheckUnits: false,
                      lineCount: 0
                    }]
                  }
                ]
              }
            ]
          }
        ],
        ...overrides
      };
    }

    it('returns buckets as work bucket summaries for matching lineId', () => {
      const result = selectWorkHierarchyBucketSummaries(makeHierarchy(), LINE_A);
      expect(result).toHaveLength(2);
      const bucketNames = result.map((p) => p.workBucketName).sort();
      expect(bucketNames).toEqual(['סלולר', 'פז השקמה']);
    });

    it('preserves customerName on each order in the work bucket summary', () => {
      const result = selectWorkHierarchyBucketSummaries(makeHierarchy(), LINE_A);
      const bucket = result.find((p) => p.workBucketName === 'פז השקמה')!;
      expect(bucket.orders[0].customerName).toBe('לקוח א');
      expect(bucket.orders[0].workBucketName).toBe('פז השקמה');
    });

    it('remaps bucket.displayName to workBucketName on summary', () => {
      const result = selectWorkHierarchyBucketSummaries(makeHierarchy(), LINE_A);
      const bucket = result.find((p) => p.workBucketName === 'סלולר')!;
      expect(bucket.workBucketName).toBe('סלולר');
      expect(bucket.ordersCount).toBe(1);
    });

    it('returns empty array for unknown lineId', () => {
      const result = selectWorkHierarchyBucketSummaries(makeHierarchy(), 'unknown-line');
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined hierarchy', () => {
      const result = selectWorkHierarchyBucketSummaries(undefined, LINE_A);
      expect(result).toEqual([]);
    });

    it('preserves statusBreakdown from bucket', () => {
      const result = selectWorkHierarchyBucketSummaries(makeHierarchy(), LINE_A);
      const pickingBucket = result.find((p) => p.workBucketName === 'פז השקמה')!;
      expect(pickingBucket.statusBreakdown).toEqual({ queued: 0, picking: 1, waitingCheck: 0, returned: 0, done: 0 });
    });
  });

// ─────────────────────────────────────────────────────────────────────────────
// selectWorkHierarchyLineSummaries
// ─────────────────────────────────────────────────────────────────────────────

function makeHierarchyResponse(
  overrides: Partial<ManualShiftWorkHierarchyResponse> = {}
): ManualShiftWorkHierarchyResponse {
  return {
    shiftId: SHIFT_ID,
    areas: [],
    ...overrides
  };
}

describe('selectWorkHierarchyLineSummaries', () => {
  it('returns empty array for undefined hierarchy', () => {
    expect(selectWorkHierarchyLineSummaries(undefined)).toEqual([]);
  });

  it('maps line fields from hierarchy', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 20,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'שרון',
              distributionArea: 'צפון',
              status: 'in_progress',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 20,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: 'תל אביב',
                  displayName: 'תל אביב',
                  totalOrders: 1,
                  totalQuantity: 20,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    {
                      orderId: 'order-0001',
                      orderNumber: 'SO-1',
                      customerName: null,
                      pointName: 'תל אביב',
                      status: 'queued',
                      lineCount: 5,
                      totalQuantity: 20,
                      hasAshlama: false,
                      hasCheckUnits: false
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    const result = selectWorkHierarchyLineSummaries(hierarchy);
    expect(result).toHaveLength(1);
    expect(result[0].lineId).toBe(LINE_A);
    expect(result[0].lineName).toBe('שרון');
    expect(result[0].lineStatus).toBe('in_progress');
    expect(result[0].ordersCount).toBe(1);
    expect(result[0].itemLinesCount).toBe(5);
    expect(result[0].totalQuantity).toBe(20);
  });

  it('computes itemLinesCount as sum of order lineCounts across buckets', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'דרום',
          displayName: 'דרום',
          totalLines: 1,
          totalBuckets: 2,
          totalOrders: 3,
          totalQuantity: 50,
          statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'דרום',
              distributionArea: 'דרום',
              status: 'open',
              totalBuckets: 2,
              totalOrders: 3,
              totalQuantity: 50,
              statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: 'באר שבע',
                  displayName: 'באר שבע',
                  totalOrders: 1,
                  totalQuantity: 18,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    {
                      orderId: 'order-0001',
                      orderNumber: 'SO-A',
                      customerName: null,
                      pointName: 'באר שבע',
                      status: 'queued',
                      lineCount: 3,
                      totalQuantity: 18,
                      hasAshlama: false,
                      hasCheckUnits: false
                    }
                  ]
                },
                {
                  bucketName: 'אילת',
                  displayName: 'אילת',
                  totalOrders: 2,
                  totalQuantity: 32,
                  statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    {
                      orderId: 'order-0002',
                      orderNumber: 'SO-B',
                      customerName: null,
                      pointName: 'אילת',
                      status: 'queued',
                      lineCount: 2,
                      totalQuantity: 12,
                      hasAshlama: false,
                      hasCheckUnits: false
                    },
                    {
                      orderId: 'order-0003',
                      orderNumber: 'SO-C',
                      customerName: null,
                      pointName: 'אילת',
                      status: 'queued',
                      lineCount: 4,
                      totalQuantity: 20,
                      hasAshlama: false,
                      hasCheckUnits: false
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    const result = selectWorkHierarchyLineSummaries(hierarchy);
    expect(result[0].itemLinesCount).toBe(9);
    expect(result[0].ordersCount).toBe(3);
  });

  it('handles zero lineCount per order', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: null,
          displayName: 'ללא איזור',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 5,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'מרכז',
              distributionArea: null,
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 5,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: null,
                  displayName: 'קו ראשי',
                  totalOrders: 1,
                  totalQuantity: 5,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    {
                      orderId: 'order-0001',
                      orderNumber: null,
                      customerName: null,
                      pointName: null,
                      status: 'queued',
                      lineCount: 0,
                      totalQuantity: 5,
                      hasAshlama: false,
                      hasCheckUnits: false
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    const result = selectWorkHierarchyLineSummaries(hierarchy);
    expect(result[0].itemLinesCount).toBe(0);
  });

  it('filters out lines with lineGroupName === "default"', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 2,
          totalBuckets: 2,
          totalOrders: 3,
          totalQuantity: 30,
          statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'default',
              distributionArea: 'צפון',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 10,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [{
                bucketName: 'unassigned', displayName: 'unassigned',
                totalOrders: 1, totalQuantity: 10,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: [{ orderId: 'order-d1', orderNumber: 'SO-D1', customerName: 'Cust D', pointName: 'unassigned', status: 'queued', totalQuantity: 10, hasAshlama: false, hasCheckUnits: false, lineCount: 0 }]
              }]
            },
            {
              lineId: LINE_B,
              lineGroupName: 'שרון',
              distributionArea: 'צפון',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 2,
              totalQuantity: 20,
              statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [{
                bucketName: 'תל אביב', displayName: 'תל אביב',
                totalOrders: 2, totalQuantity: 20,
                statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: [{ orderId: 'order-1', orderNumber: 'SO-1', customerName: null, pointName: 'תל אביב', status: 'queued', lineCount: 2, totalQuantity: 20, hasAshlama: false, hasCheckUnits: false }]
              }]
            }
          ]
        }
      ]
    });

    const result = selectWorkHierarchyLineSummaries(hierarchy);
    expect(result).toHaveLength(1);
    expect(result[0].lineId).toBe(LINE_B);
    expect(result[0].lineName).toBe('שרון');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectWorkHierarchyBucketSummaries (extended)
// ─────────────────────────────────────────────────────────────────────────────

describe('selectWorkHierarchyBucketSummaries', () => {
  it('returns empty array for undefined hierarchy', () => {
    expect(selectWorkHierarchyBucketSummaries(undefined, LINE_A)).toEqual([]);
  });

  it('returns empty array for falsy lineId', () => {
    const hierarchy = makeHierarchyResponse();
    expect(selectWorkHierarchyBucketSummaries(hierarchy, '')).toEqual([]);
  });

  it('returns empty array when line not found', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 10,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'שרון',
              distributionArea: 'צפון',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 10,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: []
            }
          ]
        }
      ]
    });
    const result = selectWorkHierarchyBucketSummaries(hierarchy, LINE_B);
    expect(result).toEqual([]);
  });

  it('maps order lineCount from work hierarchy', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 2,
          totalQuantity: 30,
          statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'שרון',
              distributionArea: 'צפון',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 2,
              totalQuantity: 30,
              statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: 'תל אביב',
                  displayName: 'תל אביב',
                  totalOrders: 2,
                  totalQuantity: 30,
                  statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    {
                      orderId: 'order-0001',
                      orderNumber: 'SO-1',
                      customerName: 'לקוח א',
                      pointName: 'תל אביב',
                      status: 'queued',
                      lineCount: 3,
                      totalQuantity: 10,
                      hasAshlama: false,
                      hasCheckUnits: false
                    },
                    {
                      orderId: 'order-0002',
                      orderNumber: 'SO-2',
                      customerName: 'לקוח ב',
                      pointName: 'תל אביב',
                      status: 'queued',
                      lineCount: 5,
                      totalQuantity: 20,
                      hasAshlama: false,
                      hasCheckUnits: false
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    const result = selectWorkHierarchyBucketSummaries(hierarchy, LINE_A);
    expect(result).toHaveLength(1);
    expect(result[0].orders).toHaveLength(2);
    expect(result[0].orders[0].lineCount).toBe(3);
    expect(result[0].orders[0].totalQuantity).toBe(10);
    expect(result[0].orders[1].lineCount).toBe(5);
    expect(result[0].orders[1].totalQuantity).toBe(20);
  });

  it('computes itemLinesCount as sum of child order lineCounts', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'דרום',
          displayName: 'דרום',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 3,
          totalQuantity: 40,
          statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'דרום',
              distributionArea: 'דרום',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 3,
              totalQuantity: 40,
              statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: 'באר שבע',
                  displayName: 'באר שבע',
                  totalOrders: 3,
                  totalQuantity: 40,
                  statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    {
                      orderId: 'order-0001',
                      orderNumber: 'SO-1',
                      customerName: null,
                      pointName: 'באר שבע',
                      status: 'queued',
                      lineCount: 2,
                      totalQuantity: 10,
                      hasAshlama: false,
                      hasCheckUnits: false
                    },
                    {
                      orderId: 'order-0002',
                      orderNumber: 'SO-2',
                      customerName: null,
                      pointName: 'באר שבע',
                      status: 'queued',
                      lineCount: 4,
                      totalQuantity: 12,
                      hasAshlama: false,
                      hasCheckUnits: false
                    },
                    {
                      orderId: 'order-0003',
                      orderNumber: 'SO-3',
                      customerName: null,
                      pointName: 'באר שבע',
                      status: 'queued',
                      lineCount: 1,
                      totalQuantity: 18,
                      hasAshlama: false,
                      hasCheckUnits: false
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    const result = selectWorkHierarchyBucketSummaries(hierarchy, LINE_A);
    expect(result[0].itemLinesCount).toBe(7);
    expect(result[0].ordersCount).toBe(3);
  });

  it('handles order with zero lineCount', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: null,
          displayName: 'ללא איזור',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 5,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'מרכז',
              distributionArea: null,
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 5,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: null,
                  displayName: 'קו ראשי',
                  totalOrders: 1,
                  totalQuantity: 5,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    {
                      orderId: 'order-0001',
                      orderNumber: null,
                      customerName: null,
                      pointName: null,
                      status: 'queued',
                      lineCount: 0,
                      totalQuantity: 5,
                      hasAshlama: false,
                      hasCheckUnits: false
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    const result = selectWorkHierarchyBucketSummaries(hierarchy, LINE_A);
    expect(result[0].itemLinesCount).toBe(0);
    expect(result[0].orders[0].lineCount).toBe(0);
  });

  it('returns empty array for technical line (lineGroupName === "default")', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 10,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'default',
              distributionArea: 'צפון',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 10,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [{
                bucketName: 'unassigned', displayName: 'unassigned',
                totalOrders: 1, totalQuantity: 10,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: [{ orderId: 'order-d1', orderNumber: 'SO-D1', customerName: 'Cust D', pointName: 'unassigned', status: 'queued', totalQuantity: 10, hasAshlama: false, hasCheckUnits: false, lineCount: 0 }]
              }]
            }
          ]
        }
      ]
    });

    const result = selectWorkHierarchyBucketSummaries(hierarchy, LINE_A);
    expect(result).toEqual([]);
  });

  it('filters out unassigned buckets from normal line', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 1,
          totalBuckets: 2,
          totalOrders: 2,
          totalQuantity: 20,
          statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'שרון',
              distributionArea: 'צפון',
              status: 'open',
              totalBuckets: 2,
              totalOrders: 2,
              totalQuantity: 20,
              statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: 'unassigned', displayName: 'unassigned',
                  totalOrders: 1, totalQuantity: 5,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [{ orderId: 'order-u1', orderNumber: 'SO-U1', customerName: 'Cust U', pointName: 'unassigned', status: 'queued', totalQuantity: 5, hasAshlama: false, hasCheckUnits: false, lineCount: 0 }]
                },
                {
                  bucketName: 'תל אביב', displayName: 'תל אביב',
                  totalOrders: 1, totalQuantity: 15,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [{ orderId: 'order-1', orderNumber: 'SO-1', customerName: null, pointName: 'תל אביב', status: 'queued', lineCount: 3, totalQuantity: 15, hasAshlama: false, hasCheckUnits: false }]
                }
              ]
            }
          ]
        }
      ]
    });

    const result = selectWorkHierarchyBucketSummaries(hierarchy, LINE_A);
    expect(result).toHaveLength(1);
    expect(result[0].workBucketName).toBe('תל אביב');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectWorkHierarchyAreaSummaries
// ─────────────────────────────────────────────────────────────────────────────

describe('selectWorkHierarchyAreaSummaries', () => {
  it('returns empty array for undefined hierarchy', () => {
    expect(selectWorkHierarchyAreaSummaries(undefined)).toEqual([]);
  });

  it('maps area fields from hierarchy', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 2,
          totalBuckets: 5,
          totalOrders: 12,
          totalQuantity: 150,
          statusBreakdown: { queued: 4, picking: 3, waitingCheck: 2, returned: 1, done: 2 },
          lines: []
        }
      ]
    });

    const result = selectWorkHierarchyAreaSummaries(hierarchy);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      areaKey: 'צפון',
      displayName: 'צפון',
      areaName: 'צפון',
      totalLines: 2,
      totalBuckets: 5,
      totalOrders: 12,
      totalQuantity: 150,
      statusBreakdown: { queued: 4, picking: 3, waitingCheck: 2, returned: 1, done: 2 }
    });
  });

  it('handles multiple areas', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 10,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: []
        },
        {
          areaName: 'דרום',
          displayName: 'דרום',
          totalLines: 2,
          totalBuckets: 3,
          totalOrders: 5,
          totalQuantity: 50,
          statusBreakdown: { queued: 2, picking: 1, waitingCheck: 1, returned: 0, done: 1 },
          lines: []
        }
      ]
    });

    const result = selectWorkHierarchyAreaSummaries(hierarchy);
    expect(result).toHaveLength(2);
    expect(result[0].areaKey).toBe('צפון');
    expect(result[1].areaKey).toBe('דרום');
  });

  it('handles null areaName with NO_DISTRIBUTION_AREA_KEY', () => {
    const hierarchy = makeHierarchyResponse({
      areas: [
        {
          areaName: null,
          displayName: 'ללא איזור',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 5,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: []
        }
      ]
    });

    const result = selectWorkHierarchyAreaSummaries(hierarchy);
    expect(result).toHaveLength(1);
    expect(result[0].areaName).toBeNull();
    expect(result[0].areaKey).toBe(NO_DISTRIBUTION_AREA_KEY);
    expect(result[0].displayName).toBe('ללא איזור');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectWorkHierarchyLineSummariesByArea
// ─────────────────────────────────────────────────────────────────────────────

describe('selectWorkHierarchyLineSummariesByArea', () => {
  const ORDER_A_ID = 'order-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  function makeHierarchyWithAreas(): ManualShiftWorkHierarchyResponse {
    return {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: 'דרום',
          displayName: 'דרום',
          totalLines: 1,
          totalBuckets: 2,
          totalOrders: 2,
          totalQuantity: 30,
          statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'קו דרום',
              distributionArea: 'דרום',
              status: 'open',
              totalBuckets: 2,
              totalOrders: 2,
              totalQuantity: 30,
              statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: 'סלולר',
                  displayName: 'סלולר',
                  totalOrders: 1,
                  totalQuantity: 10,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [{
                    orderId: ORDER_A_ID,
                    orderNumber: 'SO-1',
                    customerName: 'לקוח א',
                    pointName: 'סלולר',
                    status: 'queued',
                    totalQuantity: 10,
                    hasAshlama: false,
                    hasCheckUnits: false,
                    lineCount: 3
                  }]
                },
                {
                  bucketName: 'פז השקמה',
                  displayName: 'פז השקמה',
                  totalOrders: 1,
                  totalQuantity: 20,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [{
                    orderId: 'order-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                    orderNumber: 'SO-2',
                    customerName: 'לקוח ב',
                    pointName: 'פז השקמה',
                    status: 'queued',
                    totalQuantity: 20,
                    hasAshlama: false,
                    hasCheckUnits: false,
                    lineCount: 5
                  }]
                }
              ]
            }
          ]
        },
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 15,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_B,
              lineGroupName: 'קו צפון',
              distributionArea: 'צפון',
              status: 'in_progress',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 15,
              statusBreakdown: { queued: 0, picking: 1, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: 'מרכז',
                  displayName: 'מרכז',
                  totalOrders: 1,
                  totalQuantity: 15,
                  statusBreakdown: { queued: 0, picking: 1, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [{
                    orderId: 'order-cccc-cccc-cccc-cccccccccccc',
                    orderNumber: 'SO-3',
                    customerName: 'לקוח ג',
                    pointName: 'מרכז',
                    status: 'picking',
                    totalQuantity: 15,
                    hasAshlama: false,
                    hasCheckUnits: false,
                    lineCount: 4
                  }]
                }
              ]
            }
          ]
        }
      ]
    };
  }

  it('returns empty array for undefined hierarchy', () => {
    expect(selectWorkHierarchyLineSummariesByArea(undefined, 'דרום')).toEqual([]);
  });

  it('returns empty array for null selectedAreaKey', () => {
    expect(selectWorkHierarchyLineSummariesByArea(makeHierarchyWithAreas(), null)).toEqual([]);
  });

  it('returns lines filtered by selected area key', () => {
    const hierarchy = makeHierarchyWithAreas();
    const result = selectWorkHierarchyLineSummariesByArea(hierarchy, 'דרום');
    expect(result).toHaveLength(1);
    expect(result[0].lineId).toBe(LINE_A);
    expect(result[0].lineName).toBe('קו דרום');
    expect(result[0].distributionArea).toBe('דרום');
  });

  it('returns lines for different area key when selected', () => {
    const hierarchy = makeHierarchyWithAreas();
    const result = selectWorkHierarchyLineSummariesByArea(hierarchy, 'צפון');
    expect(result).toHaveLength(1);
    expect(result[0].lineId).toBe(LINE_B);
    expect(result[0].lineName).toBe('קו צפון');
  });

  it('returns empty array for non-matching area key', () => {
    const hierarchy = makeHierarchyWithAreas();
    const result = selectWorkHierarchyLineSummariesByArea(hierarchy, 'מרכז');
    expect(result).toEqual([]);
  });

  it('computes itemLinesCount correctly for filtered lines', () => {
    const hierarchy = makeHierarchyWithAreas();
    const result = selectWorkHierarchyLineSummariesByArea(hierarchy, 'דרום');
    expect(result).toHaveLength(1);
    expect(result[0].itemLinesCount).toBe(8);
    expect(result[0].totalQuantity).toBe(30);
  });

  it('filters by NO_DISTRIBUTION_AREA_KEY when areaName is null', () => {
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: null,
          displayName: 'ללא איזור',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 2,
          totalQuantity: 25,
          statusBreakdown: { queued: 1, picking: 1, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'קו כללי',
              distributionArea: null,
              status: 'in_progress',
              totalBuckets: 1,
              totalOrders: 2,
              totalQuantity: 25,
              statusBreakdown: { queued: 1, picking: 1, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [
                {
                  bucketName: 'כללי',
                  displayName: 'כללי',
                  totalOrders: 2,
                  totalQuantity: 25,
                  statusBreakdown: { queued: 1, picking: 1, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    {
                      orderId: ORDER_A_ID,
                      orderNumber: 'SO-1',
                      customerName: 'לקוח א',
                      pointName: 'כללי',
                      status: 'queued',
                      totalQuantity: 10,
                      hasAshlama: false,
                      hasCheckUnits: false,
                      lineCount: 3
                    },
                    {
                      orderId: 'order-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                      orderNumber: 'SO-2',
                      customerName: 'לקוח ב',
                      pointName: 'כללי',
                      status: 'picking',
                      totalQuantity: 15,
                      hasAshlama: false,
                      hasCheckUnits: false,
                      lineCount: 5
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const result = selectWorkHierarchyLineSummariesByArea(hierarchy, NO_DISTRIBUTION_AREA_KEY);
    expect(result).toHaveLength(1);
    expect(result[0].lineId).toBe(LINE_A);
    expect(result[0].lineName).toBe('קו כללי');
  });

  it('selecting an area with one line returns only that line', () => {
    const LINE_GALIL = 'line-galil-1111-1111-111111111111';
    const LINE_JERUSALEM = 'line-jeru-2222-2222-222222222222';
    const LINE_AMAKIM = 'line-amak-3333-3333-333333333333';
    const LINE_TZAFON = 'line-tzfn-5555-5555-555555555555';
    const LINE_SHFELA2 = 'line-shf2-6666-6666-666666666666';
    const LINE_SHFELA_DAROM = 'line-shfd-7777-7777-777777777777';
    const makeLine = (id: string, name: string, area: string) => ({
      lineId: id,
      lineGroupName: name,
      distributionArea: area,
      status: 'open' as const,
      totalBuckets: 1,
      totalOrders: 5,
      totalQuantity: 100,
      statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      buckets: [{ bucketName: 'נ׳צ', displayName: 'נ׳צ', totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, orders: [] }],
      routeGroups: []
    });
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [
        { areaName: 'גליל', displayName: 'גליל', totalLines: 1, totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, lines: [makeLine(LINE_GALIL, 'גליל', 'גליל')] },
        { areaName: 'ירושלים', displayName: 'ירושלים', totalLines: 1, totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, lines: [makeLine(LINE_JERUSALEM, 'ירושלים', 'ירושלים')] },
        { areaName: 'עמקים', displayName: 'עמקים', totalLines: 1, totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, lines: [makeLine(LINE_AMAKIM, 'עמקים', 'עמקים')] },
        { areaName: 'צפון', displayName: 'צפון', totalLines: 1, totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, lines: [makeLine(LINE_TZAFON, 'צפון', 'צפון')] },
        { areaName: 'שפלה 2', displayName: 'שפלה 2', totalLines: 1, totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, lines: [makeLine(LINE_SHFELA2, 'שפלה 2', 'שפלה 2')] },
        { areaName: 'שפלה דרומית', displayName: 'שפלה דרומית', totalLines: 1, totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, lines: [makeLine(LINE_SHFELA_DAROM, 'שפלה דרומית', 'שפלה דרומית')] },
      ]
    };

    const result = selectWorkHierarchyLineSummariesByArea(hierarchy, 'גליל');
    expect(result).toHaveLength(1);
    expect(result[0].lineId).toBe(LINE_GALIL);
    expect(result[0].lineName).toBe('גליל');
  });

  it('unrelated lines are not visible after selecting a specific area', () => {
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [
        { areaName: 'גליל', displayName: 'גליל', totalLines: 1, totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, lines: [{ lineId: 'line-galil', lineGroupName: 'גליל', distributionArea: 'גליל', status: 'open', totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, buckets: [{ bucketName: 'נ׳צ', displayName: 'נ׳צ', totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, orders: [] }], routeGroups: [] }] },
        { areaName: 'צפון', displayName: 'צפון', totalLines: 2, totalBuckets: 2, totalOrders: 10, totalQuantity: 200, statusBreakdown: { queued: 10, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, lines: [
          { lineId: 'line-tzafon', lineGroupName: 'צפון', distributionArea: 'צפון', status: 'open', totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, buckets: [{ bucketName: 'נ׳צ', displayName: 'נ׳צ', totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, orders: [] }], routeGroups: [] },
          { lineId: 'line-chita', lineGroupName: "צ'יטה", distributionArea: 'צפון', status: 'open', totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, buckets: [{ bucketName: 'נ׳צ', displayName: 'נ׳צ', totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, orders: [] }], routeGroups: [] }
        ]},
        { areaName: 'שפלה דרומית', displayName: 'שפלה דרומית', totalLines: 1, totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, lines: [{ lineId: 'line-shfela', lineGroupName: 'שפלה דרומית', distributionArea: 'שפלה דרומית', status: 'open', totalBuckets: 1, totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, buckets: [{ bucketName: 'נ׳צ', displayName: 'נ׳צ', totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, orders: [] }], routeGroups: [] }] }
      ]
    };

    const result = selectWorkHierarchyLineSummariesByArea(hierarchy, 'גליל');
    expect(result).toHaveLength(1);
    expect(result[0].lineName).toBe('גליל');

    const allLineNames = result.map((l) => l.lineName);
    expect(allLineNames).not.toContain('צפון');
    expect(allLineNames).not.toContain("צ'יטה");
    expect(allLineNames).not.toContain('שפלה דרומית');
  });

  it('filters out lines with lineGroupName === "default" when selecting area', () => {
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: 'צפון',
          displayName: 'צפון',
          totalLines: 2,
          totalBuckets: 2,
          totalOrders: 2,
          totalQuantity: 15,
          statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_A,
              lineGroupName: 'default',
              distributionArea: 'צפון',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 5,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [{ bucketName: 'unassigned', displayName: 'unassigned', totalOrders: 1, totalQuantity: 5, statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, orders: [] }]
            },
            {
              lineId: LINE_B,
              lineGroupName: 'שרון',
              distributionArea: 'צפון',
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 10,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [{ bucketName: 'תל אביב', displayName: 'תל אביב', totalOrders: 1, totalQuantity: 10, statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, orders: [] }]
            }
          ]
        }
      ]
    };

    const result = selectWorkHierarchyLineSummariesByArea(hierarchy, 'צפון');
    expect(result).toHaveLength(1);
    expect(result[0].lineId).toBe(LINE_B);
    expect(result[0].lineName).toBe('שרון');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectLineDistributionGroupSummaries
// ─────────────────────────────────────────────────────────────────────────────

describe('selectLineDistributionGroupSummaries', () => {
  const SHIFT_ID = 'shift-0000-0000-0000-000000000000';
  const LINE_GALIL = 'line-galil-1111-1111-111111111111';

  function makeRouteGroupFixture(): ManualShiftWorkHierarchyResponse {
    return {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: 'גליל',
          displayName: 'גליל',
          totalLines: 1,
          totalBuckets: 4,
          totalOrders: 8,
          totalQuantity: 200,
          statusBreakdown: { queued: 8, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_GALIL,
              lineGroupName: 'גליל',
              lineName: 'גליל',
              distributionArea: 'גליל',
              status: 'open',
              totalBuckets: 4,
              totalOrders: 8,
              totalQuantity: 200,
              statusBreakdown: { queued: 8, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [],
              routeGroups: [
                {
                  routeGroupKey: 'galil-general',
                  routeGroupName: 'גליל כללי',
                  routeGroupKind: 'general',
                  distributionGroupName: 'גליל כללי',
                  distributionGroupKind: 'general',
                  classificationConfidence: 'high',
                  classificationReasons: [],
                  orderCount: 4,
                  itemLinesCount: 10,
                  totalQuantity: 100,
                  statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  workBuckets: [
                    {
                      workBucketKey: 'wb-klali',
                      workBucketName: 'כללי',
                      workBucketDisplayName: 'כללי',
                      workBucketKind: 'general',
                      workGroupKey: 'wb-klali',
                      workGroupName: 'כללי',
                      workGroupDisplayName: 'כללי',
                      workGroupKind: 'general',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 1,
                      itemLinesCount: 2,
                      totalQuantity: 20,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: []
                    },
                    {
                      workBucketKey: 'wb-sellular',
                      workBucketName: 'סלולר',
                      workBucketDisplayName: 'סלולר',
                      workBucketKind: 'category',
                      workGroupKey: 'wb-sellular',
                      workGroupName: 'סלולר',
                      workGroupDisplayName: 'סלולר',
                      workGroupKind: 'category',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 1,
                      itemLinesCount: 3,
                      totalQuantity: 30,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: []
                    },
                    {
                      workBucketKey: 'wb-rechev-paz-nahariya',
                      workBucketName: 'רכב-פז נהריה',
                      workBucketDisplayName: 'רכב-פז נהריה',
                      workBucketKind: 'category',
                      workGroupKey: 'wb-rechev-paz-nahariya',
                      workGroupName: 'רכב-פז נהריה',
                      workGroupDisplayName: 'רכב-פז נהריה',
                      workGroupKind: 'category',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 1,
                      itemLinesCount: 3,
                      totalQuantity: 25,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: []
                    },
                    {
                      workBucketKey: 'wb-rechev-paz-maker',
                      workBucketName: 'רכב-פז מכר',
                      workBucketDisplayName: 'רכב-פז מכר',
                      workBucketKind: 'category',
                      workGroupKey: 'wb-rechev-paz-maker',
                      workGroupName: 'רכב-פז מכר',
                      workGroupDisplayName: 'רכב-פז מכר',
                      workGroupKind: 'category',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 1,
                      itemLinesCount: 2,
                      totalQuantity: 25,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: []
                    }
                  ]
                },
                {
                  routeGroupKey: 'dbeach',
                  routeGroupName: 'דבאח עין המפרץ',
                  routeGroupKind: 'standalone',
                  distributionGroupName: 'דבאח עין המפרץ',
                  distributionGroupKind: 'standalone',
                  classificationConfidence: 'high',
                  classificationReasons: [],
                  orderCount: 2,
                  itemLinesCount: 5,
                  totalQuantity: 50,
                  statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  workBuckets: [
                    {
                      workBucketKey: 'wb-klali-dbeach',
                      workBucketName: 'כללי',
                      workBucketDisplayName: 'כללי',
                      workBucketKind: 'standalone-general',
                      workGroupKey: 'wb-klali-dbeach',
                      workGroupName: 'כללי',
                      workGroupDisplayName: 'כללי',
                      workGroupKind: 'standalone-general',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 2,
                      itemLinesCount: 5,
                      totalQuantity: 50,
                      statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: []
                    }
                  ]
                },
                {
                  routeGroupKey: 'sonol',
                  routeGroupName: 'סונול צומת עדי',
                  routeGroupKind: 'standalone',
                  distributionGroupName: 'סונול צומת עדי',
                  distributionGroupKind: 'standalone',
                  classificationConfidence: 'medium',
                  classificationReasons: ['ambiguous-route-base'],
                  orderCount: 1,
                  itemLinesCount: 3,
                  totalQuantity: 30,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  workBuckets: [
                    {
                      workBucketKey: 'wb-klali-sonol',
                      workBucketName: 'כללי',
                      workBucketDisplayName: 'כללי',
                      workBucketKind: 'standalone-general',
                      workGroupKey: 'wb-klali-sonol',
                      workGroupName: 'כללי',
                      workGroupDisplayName: 'כללי',
                      workGroupKind: 'standalone-general',
                      classificationConfidence: 'medium',
                      classificationReasons: ['ambiguous-route-base'],
                      orderCount: 1,
                      itemLinesCount: 3,
                      totalQuantity: 30,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: []
                    }
                  ]
                },
                {
                  routeGroupKey: 'paz-lohamei',
                  routeGroupName: 'פז לוחמי הגטאות',
                  routeGroupKind: 'standalone',
                  distributionGroupName: 'פז לוחמי הגטאות',
                  distributionGroupKind: 'standalone',
                  classificationConfidence: 'high',
                  classificationReasons: [],
                  orderCount: 1,
                  itemLinesCount: 2,
                  totalQuantity: 20,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  workBuckets: [
                    {
                      workBucketKey: 'wb-klali-paz',
                      workBucketName: 'כללי',
                      workBucketDisplayName: 'כללי',
                      workBucketKind: 'standalone-general',
                      workGroupKey: 'wb-klali-paz',
                      workGroupName: 'כללי',
                      workGroupDisplayName: 'כללי',
                      workGroupKind: 'standalone-general',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 1,
                      itemLinesCount: 2,
                      totalQuantity: 20,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
  }

  it('routes through legacy alias selectLineRouteGroupSummaries unchanged', () => {
    const hierarchy = makeRouteGroupFixture();
    const newResult = selectLineDistributionGroupSummaries(hierarchy, LINE_GALIL);
    const legacyResult = selectLineRouteGroupSummaries(hierarchy, LINE_GALIL);
    expect(legacyResult).toEqual(newResult);
    expect(selectLineRouteGroupSummaries).toBe(selectLineDistributionGroupSummaries);
  });

  it('returns distribution group summaries when routeGroups present on line', () => {
    const hierarchy = makeRouteGroupFixture();
    const result = selectLineDistributionGroupSummaries(hierarchy, LINE_GALIL);
    expect(result).toHaveLength(4);
    expect(result[0].routeGroupName).toBe('גליל כללי');
    expect(result[1].routeGroupName).toBe('דבאח עין המפרץ');
    expect(result[2].routeGroupName).toBe('סונול צומת עדי');
    expect(result[3].routeGroupName).toBe('פז לוחמי הגטאות');
    // verify alias fields match old fields
    result.forEach((rg) => {
      expect(rg.distributionGroupName).toBe(rg.routeGroupName);
    });
  });

  it('returns correct summary metrics per route group', () => {
    const hierarchy = makeRouteGroupFixture();
    const result = selectLineDistributionGroupSummaries(hierarchy, LINE_GALIL);
    const galilGeneral = result.find((rg) => rg.routeGroupKey === 'galil-general')!;
    expect(galilGeneral.orderCount).toBe(4);
    expect(galilGeneral.itemLinesCount).toBe(10);
    expect(galilGeneral.totalQuantity).toBe(100);
    expect(galilGeneral.workBucketCount).toBe(4);
    expect(galilGeneral.classificationConfidence).toBe('high');
    expect(galilGeneral.distributionGroupName).toBe('גליל כללי');

    const dbeach = result.find((rg) => rg.routeGroupKey === 'dbeach')!;
    expect(dbeach.orderCount).toBe(2);
    expect(dbeach.workBucketCount).toBe(1);
    expect(dbeach.distributionGroupName).toBe('דבאח עין המפרץ');
  });

  it('preserves classificationConfidence on route group summary', () => {
    const hierarchy = makeRouteGroupFixture();
    const result = selectLineDistributionGroupSummaries(hierarchy, LINE_GALIL);
    const sonol = result.find((rg) => rg.routeGroupKey === 'sonol')!;
    expect(sonol.classificationConfidence).toBe('medium');
  });

  it('returns empty array when routeGroups is missing on line', () => {
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: 'גליל',
          displayName: 'גליל',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 5,
          totalQuantity: 100,
          statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [{
            lineId: LINE_GALIL,
            lineGroupName: 'גליל',
            distributionArea: 'גליל',
            status: 'open',
            totalBuckets: 1,
            totalOrders: 5,
            totalQuantity: 100,
            statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: [{ bucketName: 'נ׳צ', displayName: 'נ׳צ', totalOrders: 5, totalQuantity: 100, statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 }, orders: [] }]
          }]
        }
      ]
    };
    const result = selectLineDistributionGroupSummaries(hierarchy, LINE_GALIL);
    expect(result).toEqual([]);
  });

  it('returns empty array when routeGroups is empty array', () => {
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: 'גליל',
          displayName: 'גליל',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 5,
          totalQuantity: 100,
          statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [{
            lineId: LINE_GALIL,
            lineGroupName: 'גליל',
            distributionArea: 'גליל',
            status: 'open',
            totalBuckets: 1,
            totalOrders: 5,
            totalQuantity: 100,
            statusBreakdown: { queued: 5, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: [],
            routeGroups: []
          }]
        }
      ]
    };
    const result = selectLineDistributionGroupSummaries(hierarchy, LINE_GALIL);
    expect(result).toEqual([]);
  });

  it('returns empty array for unknown lineId', () => {
    const hierarchy = makeRouteGroupFixture();
    const result = selectLineDistributionGroupSummaries(hierarchy, 'unknown-line');
    expect(result).toEqual([]);
  });

  it('returns empty array for undefined hierarchy', () => {
    const result = selectLineDistributionGroupSummaries(undefined, LINE_GALIL);
    expect(result).toEqual([]);
  });

  it('returns empty array for technical line (lineGroupName === "default")', () => {
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: 'גליל',
          displayName: 'גליל',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 2,
          totalQuantity: 20,
          statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [{
            lineId: LINE_GALIL,
            lineGroupName: 'default',
            distributionArea: 'גליל',
            status: 'open',
            totalBuckets: 1,
            totalOrders: 2,
            totalQuantity: 20,
            statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: [],
            routeGroups: [{
              routeGroupKey: 'rg-tech',
              routeGroupName: 'טכני',
              routeGroupKind: 'general',
              classificationConfidence: 'high',
              classificationReasons: [],
              orderCount: 2,
              itemLinesCount: 3,
              totalQuantity: 20,
              statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              workBuckets: [{
                workBucketKey: 'wb-tech',
                workBucketName: 'unassigned',
                workBucketDisplayName: 'unassigned',
                workBucketKind: 'general',
                classificationConfidence: 'high',
                classificationReasons: [],
                orderCount: 2,
                itemLinesCount: 3,
                totalQuantity: 20,
                statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: []
              }]
            }]
          }]
        }
      ]
    };

    const result = selectLineDistributionGroupSummaries(hierarchy, LINE_GALIL);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectDistributionGroupWorkGroupSummaries
// ─────────────────────────────────────────────────────────────────────────────

describe('selectDistributionGroupWorkGroupSummaries', () => {
  const SHIFT_ID = 'shift-0000-0000-0000-000000000000';
  const LINE_GALIL = 'line-galil-1111-1111-111111111111';

  function makeHierarchyWithOrders(): ManualShiftWorkHierarchyResponse {
    return {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: 'גליל',
          displayName: 'גליל',
          totalLines: 1,
          totalBuckets: 4,
          totalOrders: 8,
          totalQuantity: 200,
          statusBreakdown: { queued: 8, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [
            {
              lineId: LINE_GALIL,
              lineGroupName: 'גליל',
              lineName: 'גליל',
              distributionArea: 'גליל',
              status: 'open',
              totalBuckets: 4,
              totalOrders: 8,
              totalQuantity: 200,
              statusBreakdown: { queued: 8, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              buckets: [],
              routeGroups: [
                {
                  routeGroupKey: 'galil-general',
                  routeGroupName: 'גליל כללי',
                  routeGroupKind: 'general',
                  distributionGroupName: 'גליל כללי',
                  distributionGroupKind: 'general',
                  classificationConfidence: 'high',
                  classificationReasons: [],
                  orderCount: 4,
                  itemLinesCount: 10,
                  totalQuantity: 100,
                  statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  workBuckets: [
                    {
                      workBucketKey: 'wb-klali',
                      workBucketName: 'כללי',
                      workBucketDisplayName: 'כללי',
                      workBucketKind: 'general',
                      workGroupKey: 'wb-klali',
                      workGroupName: 'כללי',
                      workGroupDisplayName: 'כללי',
                      workGroupKind: 'general',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 1,
                      itemLinesCount: 2,
                      totalQuantity: 20,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: [
                        { orderId: 'o-1', orderNumber: 'SO-1', customerName: 'לקוח א', pointName: 'גליל כללי', status: 'queued', lineCount: 2, totalQuantity: 20, hasAshlama: false, hasCheckUnits: false }
                      ]
                    },
                    {
                      workBucketKey: 'wb-sellular',
                      workBucketName: 'סלולר',
                      workBucketDisplayName: 'סלולר',
                      workBucketKind: 'category',
                      workGroupKey: 'wb-sellular',
                      workGroupName: 'סלולר',
                      workGroupDisplayName: 'סלולר',
                      workGroupKind: 'category',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 1,
                      itemLinesCount: 3,
                      totalQuantity: 30,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: [
                        { orderId: 'o-2', orderNumber: 'SO-2', customerName: 'לקוח ב', pointName: 'גליל כללי', status: 'queued', lineCount: 3, totalQuantity: 30, hasAshlama: false, hasCheckUnits: false }
                      ]
                    },
                    {
                      workBucketKey: 'wb-rechev-paz-nahariya',
                      workBucketName: 'רכב-פז נהריה',
                      workBucketDisplayName: 'רכב-פז נהריה',
                      workBucketKind: 'category',
                      workGroupKey: 'wb-rechev-paz-nahariya',
                      workGroupName: 'רכב-פז נהריה',
                      workGroupDisplayName: 'רכב-פז נהריה',
                      workGroupKind: 'category',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 1,
                      itemLinesCount: 3,
                      totalQuantity: 25,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: [
                        { orderId: 'o-3', orderNumber: 'SO-3', customerName: 'לקוח ג', pointName: 'גליל כללי', status: 'queued', lineCount: 3, totalQuantity: 25, hasAshlama: false, hasCheckUnits: false }
                      ]
                    },
                    {
                      workBucketKey: 'wb-rechev-paz-maker',
                      workBucketName: 'רכב-פז מכר',
                      workBucketDisplayName: 'רכב-פז מכר',
                      workBucketKind: 'category',
                      workGroupKey: 'wb-rechev-paz-maker',
                      workGroupName: 'רכב-פז מכר',
                      workGroupDisplayName: 'רכב-פז מכר',
                      workGroupKind: 'category',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 1,
                      itemLinesCount: 2,
                      totalQuantity: 25,
                      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: [
                        { orderId: 'o-4', orderNumber: 'SO-4', customerName: 'לקוח ד', pointName: 'גליל כללי', status: 'queued', lineCount: 2, totalQuantity: 25, hasAshlama: false, hasCheckUnits: false }
                      ]
                    }
                  ]
                },
                {
                  routeGroupKey: 'dbeach',
                  routeGroupName: 'דבאח עין המפרץ',
                  routeGroupKind: 'standalone',
                  distributionGroupName: 'דבאח עין המפרץ',
                  distributionGroupKind: 'standalone',
                  classificationConfidence: 'high',
                  classificationReasons: [],
                  orderCount: 2,
                  itemLinesCount: 5,
                  totalQuantity: 50,
                  statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  workBuckets: [
                    {
                      workBucketKey: 'wb-klali-dbeach',
                      workBucketName: 'כללי',
                      workBucketDisplayName: 'כללי',
                      workBucketKind: 'standalone-general',
                      workGroupKey: 'wb-klali-dbeach',
                      workGroupName: 'כללי',
                      workGroupDisplayName: 'כללי',
                      workGroupKind: 'standalone-general',
                      classificationConfidence: 'high',
                      classificationReasons: [],
                      orderCount: 2,
                      itemLinesCount: 5,
                      totalQuantity: 50,
                      statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                      orders: [
                        { orderId: 'o-5', orderNumber: 'SO-5', customerName: 'לקוח ה', pointName: 'דבאח עין המפרץ', status: 'queued', lineCount: 2, totalQuantity: 20, hasAshlama: false, hasCheckUnits: false },
                        { orderId: 'o-6', orderNumber: 'SO-6', customerName: 'לקוח ו', pointName: 'דבאח עין המפרץ', status: 'queued', lineCount: 3, totalQuantity: 30, hasAshlama: false, hasCheckUnits: false }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
  }

  it('routes through legacy alias selectRouteGroupWorkBucketSummaries unchanged', () => {
    const hierarchy = makeHierarchyWithOrders();
    const newResult = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'galil-general');
    const legacyResult = selectRouteGroupWorkBucketSummaries(hierarchy, LINE_GALIL, 'galil-general');
    expect(legacyResult).toEqual(newResult);
    expect(selectRouteGroupWorkBucketSummaries).toBe(selectDistributionGroupWorkGroupSummaries);
  });

  it('returns work bucket summaries for a given routeGroupKey', () => {
    const hierarchy = makeHierarchyWithOrders();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'galil-general');
    expect(result).toHaveLength(4);
    const names = result.map((wb) => wb.workBucketDisplayName);
    expect(names).toContain('כללי');
    expect(names).toContain('סלולר');
    expect(names).toContain('רכב-פז נהריה');
    expect(names).toContain('רכב-פז מכר');
    // verify alias fields match old fields
    result.forEach((wb) => {
      expect(wb.workGroupKey).toBe(wb.workBucketKey);
      expect(wb.workGroupName).toBe(wb.workBucketName);
      expect(wb.workGroupDisplayName).toBe(wb.workBucketDisplayName);
    });
  });

  it('גליל כללי contains work buckets כללי, סלולר, רכב-פז נהריה, רכב-פז מכר', () => {
    const hierarchy = makeHierarchyWithOrders();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'galil-general');
    expect(result).toHaveLength(4);
    expect(result[0].workBucketDisplayName).toBe('כללי');
    expect(result[0].workGroupDisplayName).toBe('כללי');
    expect(result[1].workBucketDisplayName).toBe('סלולר');
    expect(result[1].workGroupDisplayName).toBe('סלולר');
    expect(result[2].workBucketDisplayName).toBe('רכב-פז נהריה');
    expect(result[2].workGroupDisplayName).toBe('רכב-פז נהריה');
    expect(result[3].workBucketDisplayName).toBe('רכב-פז מכר');
    expect(result[3].workGroupDisplayName).toBe('רכב-פז מכר');
  });

  it('דבאח עין המפרץ contains work bucket כללי (standalone)', () => {
    const hierarchy = makeHierarchyWithOrders();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'dbeach');
    expect(result).toHaveLength(1);
    expect(result[0].workBucketDisplayName).toBe('כללי');
    expect(result[0].workGroupDisplayName).toBe('כללי');
    expect(result[0].orderCount).toBe(2);
    expect(result[0].itemLinesCount).toBe(5);
  });

  it('preserves pointName on each order', () => {
    const hierarchy = makeHierarchyWithOrders();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'dbeach');
    const wb = result[0];
    expect(wb.orders).toHaveLength(2);
    expect(wb.orders[0].pointName).toBe('דבאח עין המפרץ');
    expect(wb.orders[1].pointName).toBe('דבאח עין המפרץ');
  });

  it('returns empty array for unknown routeGroupKey', () => {
    const hierarchy = makeHierarchyWithOrders();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'nonexistent');
    expect(result).toEqual([]);
  });

  it('returns empty array for unknown lineId', () => {
    const hierarchy = makeHierarchyWithOrders();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, 'unknown-line', 'galil-general');
    expect(result).toEqual([]);
  });

  it('returns empty array for undefined hierarchy', () => {
    const result = selectDistributionGroupWorkGroupSummaries(undefined, LINE_GALIL, 'galil-general');
    expect(result).toEqual([]);
  });

  it('workBucketName maps to workBucketDisplayName on each work bucket', () => {
    const hierarchy = makeHierarchyWithOrders();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'galil-general');
    expect(result[0].workBucketName).toBe('כללי');
    expect(result[0].workBucketDisplayName).toBe('כללי');
  });

  it('sets workBucketName on each order to workBucketDisplayName', () => {
    const hierarchy = makeHierarchyWithOrders();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'galil-general');
    const wb = result[0];
    expect(wb.orders[0].workBucketName).toBe('כללי');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic: simulate the exact inline logic from manual-operator-work-section
// selectedWorkBucketRawName derivation — no production code changes
// ─────────────────────────────────────────────────────────────────────────────

describe('selectedWorkBucketRawName derivation (diagnostic — inline logic replica)', () => {
  const SHIFT_ID = 'shift-0000-0000-0000-000000000000';
  const LINE_GALIL = 'line-galil-1111-1111-111111111111';

  function deriveRawName(
    workBucketSummaries: RouteGroupWorkBucketSummary[],
    selectedWorkBucketName: string
  ): string {
    const wb = workBucketSummaries.find(
      (w) => w.workBucketDisplayName === selectedWorkBucketName || w.workBucketName === selectedWorkBucketName
    );
    if (!wb || wb.orders.length === 0) return '';
    const uniquePointNames = [...new Set(wb.orders.map((o) => o.pointName).filter((pointName): pointName is string => Boolean(pointName)))];
    if (uniquePointNames.length === 1) return uniquePointNames[0]!;
    return '';
  }

  function makeGalilFixture(): ManualShiftWorkHierarchyResponse {
    return {
      shiftId: SHIFT_ID,
      areas: [{
        areaName: 'גליל',
        displayName: 'גליל',
        totalLines: 1,
        totalBuckets: 4,
        totalOrders: 6,
        totalQuantity: 160,
        statusBreakdown: { queued: 6, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [{
          lineId: LINE_GALIL,
          lineGroupName: 'גליל',
          lineName: 'גליל',
          distributionArea: 'גליל',
          status: 'open',
          totalBuckets: 4,
          totalOrders: 6,
          totalQuantity: 160,
          statusBreakdown: { queued: 6, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          buckets: [],
          routeGroups: [
            {
              routeGroupKey: 'galil-general',
              routeGroupName: 'גליל כללי',
              routeGroupKind: 'general',
              distributionGroupName: 'גליל כללי',
              distributionGroupKind: 'general',
              classificationConfidence: 'high',
              classificationReasons: [],
              orderCount: 4,
              itemLinesCount: 10,
              totalQuantity: 100,
              statusBreakdown: { queued: 4, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              workBuckets: [
                {
                  workBucketKey: 'wb-klali',
                  workBucketName: 'כללי',
                  workBucketDisplayName: 'כללי',
                  workBucketKind: 'general',
                  workGroupKey: 'wb-klali',
                  workGroupName: 'כללי',
                  workGroupDisplayName: 'כללי',
                  workGroupKind: 'general',
                  classificationConfidence: 'high',
                  classificationReasons: [],
                  orderCount: 3,
                  itemLinesCount: 7,
                  totalQuantity: 60,
                  statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    { orderId: 'o-1', orderNumber: 'SO26013614', customerName: 'לקוח א', pointName: 'גליל', status: 'queued', lineCount: 2, totalQuantity: 20, hasAshlama: false, hasCheckUnits: false },
                    { orderId: 'o-2', orderNumber: 'SO26013629', customerName: 'לקוח ב', pointName: 'גליל', status: 'queued', lineCount: 3, totalQuantity: 20, hasAshlama: false, hasCheckUnits: false },
                    { orderId: 'o-3', orderNumber: 'SO26013663', customerName: 'לקוח ג', pointName: 'גליל', status: 'queued', lineCount: 2, totalQuantity: 20, hasAshlama: false, hasCheckUnits: false }
                  ]
                },
                {
                  workBucketKey: 'wb-sellular',
                  workBucketName: 'סלולר',
                  workBucketDisplayName: 'סלולר',
                  workBucketKind: 'category',
                  workGroupKey: 'wb-sellular',
                  workGroupName: 'סלולר',
                  workGroupDisplayName: 'סלולר',
                  workGroupKind: 'category',
                  classificationConfidence: 'high',
                  classificationReasons: [],
                  orderCount: 1,
                  itemLinesCount: 3,
                  totalQuantity: 40,
                  statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    { orderId: 'o-4', orderNumber: 'SO26013678', customerName: 'לקוח ד', pointName: 'סלולר', status: 'queued', lineCount: 3, totalQuantity: 40, hasAshlama: false, hasCheckUnits: false }
                  ]
                }
              ]
            },
            {
              routeGroupKey: 'dbeach',
              routeGroupName: 'דבאח עין המפרץ',
              routeGroupKind: 'standalone',
              distributionGroupName: 'דבאח עין המפרץ',
              distributionGroupKind: 'standalone',
              classificationConfidence: 'high',
              classificationReasons: [],
              orderCount: 2,
              itemLinesCount: 5,
              totalQuantity: 60,
              statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              workBuckets: [
                {
                  workBucketKey: 'wb-klali-dbeach',
                  workBucketName: 'כללי',
                  workBucketDisplayName: 'כללי',
                  workBucketKind: 'standalone-general',
                  workGroupKey: 'wb-klali-dbeach',
                  workGroupName: 'כללי',
                  workGroupDisplayName: 'כללי',
                  workGroupKind: 'standalone-general',
                  classificationConfidence: 'high',
                  classificationReasons: [],
                  orderCount: 2,
                  itemLinesCount: 5,
                  totalQuantity: 60,
                  statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                  orders: [
                    { orderId: 'o-5', orderNumber: 'SO26013686', customerName: 'לקוח ה', pointName: 'דבאח עין המפרץ', status: 'queued', lineCount: 2, totalQuantity: 30, hasAshlama: false, hasCheckUnits: false },
                    { orderId: 'o-6', orderNumber: 'SO26013699', customerName: 'לקוח ו', pointName: 'דבאח עין המפרץ', status: 'queued', lineCount: 3, totalQuantity: 30, hasAshlama: false, hasCheckUnits: false }
                  ]
                }
              ]
            }
          ]
        }]
      }]
    };
  }

  // ── Case 1: גליל כללי > כללי ───────────────────────────────────────────
  // Fixture: work bucket 'כללי' in 'galil-general' has 3 orders, all pointName='גליל'
  it('גליל כללי > כללי: derives pointName=גליל from work bucket orders, not semantic כללי', () => {
    const hierarchy = makeGalilFixture();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'galil-general');
    const rawName = deriveRawName(result, 'כללי');
    // All 3 orders share pointName='גליל' → should derive 'גליל'
    expect(rawName).toBe('גליל');
    // showProductRollupDeferred = !(hasRouteGroups && selectedRouteGroupKey && !rawName)
    // rawName is non-empty → deferred is FALSE
    expect(rawName).not.toBe('');
    // MUST NOT pass semantic 'כללי' as legacy pointName
    expect(rawName).not.toBe('כללי');
  });

  // ── Case 2: דבאח עין המפרץ > כללי ──────────────────────────────────────
  it('דבאח עין המפרץ > כללי: derives pointName=דבאח עין המפרץ from work bucket orders', () => {
    const hierarchy = makeGalilFixture();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'dbeach');
    const rawName = deriveRawName(result, 'כללי');
    // Both orders share pointName='דבאח עין המפרץ'
    expect(rawName).toBe('דבאח עין המפרץ');
    expect(rawName).not.toBe('');
    expect(rawName).not.toBe('כללי');
  });

  // ── Case 3: Multi-source work bucket → rawName = '' (deferred) ─────────
  it('multi-source work bucket returns empty string (product rollup deferred)', () => {
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: 'גליל',
          displayName: 'גליל',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 2,
          totalQuantity: 30,
          statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [{
            lineId: LINE_GALIL,
            lineGroupName: 'גליל',
            lineName: 'גליל',
            distributionArea: 'גליל',
            status: 'open',
            totalBuckets: 1,
            totalOrders: 2,
            totalQuantity: 30,
            statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: [],
            routeGroups: [{
              routeGroupKey: 'multi-source',
              routeGroupName: 'מעורב',
              routeGroupKind: 'general',
              distributionGroupName: 'מעורב',
              distributionGroupKind: 'general',
              classificationConfidence: 'high',
              classificationReasons: [],
              orderCount: 2,
              itemLinesCount: 5,
              totalQuantity: 30,
              statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              workBuckets: [{
                workBucketKey: 'wb-mixed',
                workBucketName: 'מעורב',
                workBucketDisplayName: 'מעורב',
                workBucketKind: 'general',
                workGroupKey: 'wb-mixed',
                workGroupName: 'מעורב',
                workGroupDisplayName: 'מעורב',
                workGroupKind: 'general',
                classificationConfidence: 'high',
                classificationReasons: [],
                orderCount: 2,
                itemLinesCount: 5,
                totalQuantity: 30,
                statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: [
                  { orderId: 'o-1', orderNumber: 'SO-1', customerName: 'לקוח א', pointName: 'גליל', status: 'queued', lineCount: 2, totalQuantity: 10, hasAshlama: false, hasCheckUnits: false },
                  { orderId: 'o-2', orderNumber: 'SO-2', customerName: 'לקוח ב', pointName: 'סלולר', status: 'queued', lineCount: 3, totalQuantity: 20, hasAshlama: false, hasCheckUnits: false }
                ]
              }]
            }]
          }]
        }
      ]
    };
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'multi-source');
    const rawName = deriveRawName(result, 'מעורב');
    // Two different pointNames → empty string
    expect(rawName).toBe('');
  });

  // ── Case 4: Zero orders → rawName = '' (deferred) ──────────────────────
  it('work bucket with zero orders returns empty string', () => {
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [{
        areaName: 'גליל',
        displayName: 'גליל',
        totalLines: 1,
        totalBuckets: 1,
        totalOrders: 0,
        totalQuantity: 0,
        statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [{
          lineId: LINE_GALIL,
          lineGroupName: 'גליל',
          lineName: 'גליל',
          distributionArea: 'גליל',
          status: 'open',
          totalBuckets: 1,
          totalOrders: 0,
          totalQuantity: 0,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          buckets: [],
          routeGroups: [{
            routeGroupKey: 'empty-wb',
            routeGroupName: 'ריק',
            routeGroupKind: 'general',
            classificationConfidence: 'high',
            classificationReasons: [],
            orderCount: 0,
            itemLinesCount: 0,
            totalQuantity: 0,
            statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            workBuckets: [{
              workBucketKey: 'wb-empty',
              workBucketName: 'ריק',
              workBucketDisplayName: 'ריק',
              workBucketKind: 'general',
              classificationConfidence: 'high',
              classificationReasons: [],
              orderCount: 0,
              itemLinesCount: 0,
              totalQuantity: 0,
              statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              orders: []
            }]
          }]
        }]
      }]
    };
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'empty-wb');
    const rawName = deriveRawName(result, 'ריק');
    expect(rawName).toBe('');
  });

  // ── Case 5: Work bucket not found → rawName = '' (shouldn't happen in normal flow) ──
  it('unknown work bucket name returns empty string', () => {
    const hierarchy = makeGalilFixture();
    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'galil-general');
    const rawName = deriveRawName(result, 'NONEXISTENT');
    expect(rawName).toBe('');
  });

  it('returns empty array for technical line (lineGroupName === "default")', () => {
    const hierarchy: ManualShiftWorkHierarchyResponse = {
      shiftId: SHIFT_ID,
      areas: [
        {
          areaName: 'גליל',
          displayName: 'גליל',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 2,
          totalQuantity: 20,
          statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          lines: [{
            lineId: LINE_GALIL,
            lineGroupName: 'default',
            distributionArea: 'גליל',
            status: 'open',
            totalBuckets: 1,
            totalOrders: 2,
            totalQuantity: 20,
            statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            buckets: [],
            routeGroups: [{
              routeGroupKey: 'rg-tech',
              routeGroupName: 'טכני',
              routeGroupKind: 'general',
              classificationConfidence: 'high',
              classificationReasons: [],
              orderCount: 2,
              itemLinesCount: 3,
              totalQuantity: 20,
              statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              workBuckets: [{
                workBucketKey: 'wb-tech',
                workBucketName: 'unassigned',
                workBucketDisplayName: 'unassigned',
                workBucketKind: 'general',
                classificationConfidence: 'high',
                classificationReasons: [],
                orderCount: 2,
                itemLinesCount: 3,
                totalQuantity: 20,
                statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                orders: []
              }]
            }]
          }]
        }
      ]
    };

    const result = selectDistributionGroupWorkGroupSummaries(hierarchy, LINE_GALIL, 'rg-tech');
    expect(result).toEqual([]);
  });
});
