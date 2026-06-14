import { describe, expect, it } from 'vitest';
import {
  manualShiftKeys,
  todayShiftQueryOptions,
  shiftOrdersQueryOptions,
  orderItemsQueryOptions,
  orderCheckUnitsQueryOptions,
  peopleSummaryQueryOptions,
  daySummaryQueryOptions,
  shiftOpenAshlamotQueryOptions
} from './queries';
import { bffRequest } from '@/shared/api/bff/client';
import { vi } from 'vitest';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn(async () => [])
}));

const SHIFT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SHIFT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('manualShiftKeys', () => {
  it('has stable root key', () => {
    expect(manualShiftKeys.all).toEqual(['manual-shift']);
  });

  it('today key is namespaced under all', () => {
    expect(manualShiftKeys.today()).toEqual(['manual-shift', 'today']);
  });

  it('lines key is scoped to shiftId', () => {
    expect(manualShiftKeys.lines(SHIFT_A)).toEqual(['manual-shift', 'lines', SHIFT_A]);
  });

  it('produces distinct line keys for different shift IDs', () => {
    expect(manualShiftKeys.lines(SHIFT_A)).not.toEqual(manualShiftKeys.lines(SHIFT_B));
  });

  it('shiftOrders key is scoped to shiftId', () => {
    expect(manualShiftKeys.shiftOrders(SHIFT_A)).toEqual([
      'manual-shift',
      'shift-orders',
      SHIFT_A
    ]);
  });

  it('orderItems key is scoped to orderId', () => {
    expect(manualShiftKeys.orderItems(SHIFT_A)).toEqual([
      'manual-shift',
      'order-items',
      SHIFT_A
    ]);
  });

  it('peopleSummary key is scoped to shiftId', () => {
    expect(manualShiftKeys.peopleSummary(SHIFT_A)).toEqual([
      'manual-shift',
      'people-summary',
      SHIFT_A
    ]);
  });

  it('orderCheckUnits key is scoped to orderId', () => {
    expect(manualShiftKeys.orderCheckUnits(SHIFT_A)).toEqual([
      'manual-shift',
      'order-check-units',
      SHIFT_A
    ]);
  });

  it('daySummary key is scoped to shiftId', () => {
    expect(manualShiftKeys.daySummary(SHIFT_A)).toEqual([
      'manual-shift',
      'day-summary',
      SHIFT_A
    ]);
  });

  it('all summary keys are distinct from each other', () => {
    const orders = manualShiftKeys.shiftOrders(SHIFT_A);
    const people = manualShiftKeys.peopleSummary(SHIFT_A);
    const day = manualShiftKeys.daySummary(SHIFT_A);
    expect(orders).not.toEqual(people);
    expect(orders).not.toEqual(day);
    expect(people).not.toEqual(day);
  });
});

describe('todayShiftQueryOptions', () => {
  it('uses the today query key', () => {
    expect(todayShiftQueryOptions().queryKey).toEqual(['manual-shift', 'today']);
  });

  it('has a queryFn defined', () => {
    expect(typeof todayShiftQueryOptions().queryFn).toBe('function');
  });
});

describe('shiftOrdersQueryOptions', () => {
  it('uses the shiftOrders query key', () => {
    expect(shiftOrdersQueryOptions(SHIFT_A).queryKey).toEqual([
      'manual-shift',
      'shift-orders',
      SHIFT_A
    ]);
  });

  it('is enabled when shiftId is non-empty', () => {
    expect(shiftOrdersQueryOptions(SHIFT_A).enabled).toBe(true);
  });

  it('is disabled when shiftId is empty', () => {
    expect(shiftOrdersQueryOptions('').enabled).toBe(false);
  });
});

describe('orderItemsQueryOptions', () => {
  it('uses the orderItems query key', () => {
    expect(orderItemsQueryOptions(SHIFT_A).queryKey).toEqual([
      'manual-shift',
      'order-items',
      SHIFT_A
    ]);
  });

  it('calls items endpoint in queryFn', async () => {
    const queryFn = orderItemsQueryOptions(SHIFT_A).queryFn;
    expect(queryFn).toBeTypeOf('function');
    await queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith(`/api/manual-shift-orders/${SHIFT_A}/items`);
  });

  it('is disabled when orderId is empty', () => {
    expect(orderItemsQueryOptions('').enabled).toBe(false);
  });
});

describe('peopleSummaryQueryOptions', () => {
  it('uses the peopleSummary query key', () => {
    expect(peopleSummaryQueryOptions(SHIFT_A).queryKey).toEqual([
      'manual-shift',
      'people-summary',
      SHIFT_A
    ]);
  });

  it('is disabled when shiftId is empty', () => {
    expect(peopleSummaryQueryOptions('').enabled).toBe(false);
  });
});

describe('orderCheckUnitsQueryOptions', () => {
  it('uses the orderCheckUnits query key', () => {
    expect(orderCheckUnitsQueryOptions(SHIFT_A).queryKey).toEqual([
      'manual-shift',
      'order-check-units',
      SHIFT_A
    ]);
  });

  it('calls check-units endpoint in queryFn', async () => {
    const queryFn = orderCheckUnitsQueryOptions(SHIFT_A).queryFn;
    expect(queryFn).toBeTypeOf('function');
    await queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith(`/api/manual-shift-orders/${SHIFT_A}/check-units`);
  });

  it('is disabled when orderId is empty', () => {
    expect(orderCheckUnitsQueryOptions('').enabled).toBe(false);
  });
});

describe('daySummaryQueryOptions', () => {
  it('uses the daySummary query key', () => {
    expect(daySummaryQueryOptions(SHIFT_A).queryKey).toEqual([
      'manual-shift',
      'day-summary',
      SHIFT_A
    ]);
  });

  it('is disabled when shiftId is empty', () => {
    expect(daySummaryQueryOptions('').enabled).toBe(false);
  });
});

describe('manualShiftKeys.shiftOpenAshlamot', () => {
  it('is scoped to shiftId', () => {
    expect(manualShiftKeys.shiftOpenAshlamot(SHIFT_A)).toEqual([
      'manual-shift',
      'shift-open-ashlamot',
      SHIFT_A
    ]);
  });

  it('produces distinct keys for different shift IDs', () => {
    expect(manualShiftKeys.shiftOpenAshlamot(SHIFT_A)).not.toEqual(
      manualShiftKeys.shiftOpenAshlamot(SHIFT_B)
    );
  });
});

describe('shiftOpenAshlamotQueryOptions', () => {
  it('uses the shiftOpenAshlamot query key', () => {
    expect(shiftOpenAshlamotQueryOptions(SHIFT_A).queryKey).toEqual([
      'manual-shift',
      'shift-open-ashlamot',
      SHIFT_A
    ]);
  });

  it('calls open-ashlamot endpoint in queryFn', async () => {
    const queryFn = shiftOpenAshlamotQueryOptions(SHIFT_A).queryFn;
    expect(queryFn).toBeTypeOf('function');
    await queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith(`/api/manual-shifts/${SHIFT_A}/open-ashlamot`);
  });

  it('is disabled when shiftId is empty', () => {
    expect(shiftOpenAshlamotQueryOptions('').enabled).toBe(false);
  });
});
