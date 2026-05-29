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
  canCloseOrderFromCheckUnits
} from './shift-selectors';
import type {
  ManualShiftDaySummary,
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderCheckUnit
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
    ...overrides
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
      donePercent: 30
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
    expect(canCloseOrderFromCheckUnits([])).toBe(true);
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
    expect(canCloseOrderFromCheckUnits([unit('checked')])).toBe(true);
  });

  it('returned blocks physically checked', () => {
    const result = summarizeManualShiftOrderCheckUnits([unit('checked'), unit('returned')]);
    expect(result.returnedUnits).toBe(1);
    expect(result.physicallyChecked).toBe(false);
    expect(canCloseOrderFromCheckUnits([unit('checked'), unit('returned')])).toBe(false);
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
    expect(canCloseOrderFromCheckUnits([unit('voided')])).toBe(false);
  });
});
