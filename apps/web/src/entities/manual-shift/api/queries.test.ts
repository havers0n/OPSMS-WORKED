import { describe, expect, it } from 'vitest';
import {
  manualShiftKeys,
  todayShiftQueryOptions,
  shiftOrdersQueryOptions,
  peopleSummaryQueryOptions,
  daySummaryQueryOptions
} from './queries';

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

  it('peopleSummary key is scoped to shiftId', () => {
    expect(manualShiftKeys.peopleSummary(SHIFT_A)).toEqual([
      'manual-shift',
      'people-summary',
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
