import { describe, expect, it } from 'vitest';
import { manualShiftKeys, todayShiftQueryOptions } from './queries';

describe('manualShiftKeys', () => {
  it('has stable root key', () => {
    expect(manualShiftKeys.all).toEqual(['manual-shift']);
  });

  it('today key is namespaced under all', () => {
    expect(manualShiftKeys.today()).toEqual(['manual-shift', 'today']);
  });

  it('lines key is scoped to shiftId', () => {
    const shiftId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(manualShiftKeys.lines(shiftId)).toEqual(['manual-shift', 'lines', shiftId]);
  });

  it('produces distinct line keys for different shift IDs', () => {
    const keyA = manualShiftKeys.lines('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const keyB = manualShiftKeys.lines('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(keyA).not.toEqual(keyB);
  });
});

describe('todayShiftQueryOptions', () => {
  it('uses the today query key', () => {
    const opts = todayShiftQueryOptions();
    expect(opts.queryKey).toEqual(['manual-shift', 'today']);
  });

  it('has a queryFn defined', () => {
    const opts = todayShiftQueryOptions();
    expect(typeof opts.queryFn).toBe('function');
  });
});
