import { describe, expect, it } from 'vitest';
import {
  manualShiftKeys,
  todayShiftQueryOptions,
  shiftOrdersQueryOptions,
  workHierarchyQueryOptions,
  orderCheckUnitsQueryOptions,
  peopleSummaryQueryOptions,
  daySummaryQueryOptions,
  shiftOpenAshlamotQueryOptions,
  bucketProductRollupQueryOptions
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

  it('workHierarchy key is scoped to shiftId', () => {
    expect(manualShiftKeys.workHierarchy(SHIFT_A)).toEqual([
      'manual-shift',
      'work-hierarchy',
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

describe('workHierarchyQueryOptions', () => {
  it('uses the workHierarchy query key', () => {
    expect(workHierarchyQueryOptions(SHIFT_A).queryKey).toEqual([
      'manual-shift',
      'work-hierarchy',
      SHIFT_A
    ]);
  });

  it('calls work-hierarchy endpoint in queryFn', async () => {
    const queryFn = workHierarchyQueryOptions(SHIFT_A).queryFn;
    expect(queryFn).toBeTypeOf('function');
    await queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith(`/api/manual-shifts/${SHIFT_A}/work-hierarchy`);
  });

  it('is disabled when shiftId is empty', () => {
    expect(workHierarchyQueryOptions('').enabled).toBe(false);
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

describe('bucketProductRollupQueryOptions', () => {
  const LINE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('uses the bucket product rollup query key', () => {
    const opts = bucketProductRollupQueryOptions(SHIFT_A, LINE_A, 'סלולר');
    expect(opts.queryKey).toEqual([
      'manual-shift',
      'bucket-product-rollup',
      SHIFT_A,
      LINE_A,
      'סלולר',
      '__no_distribution_area__',
      '__no_source_zone__',
      '__no_work_bucket__',
      '__no_source_line__'
    ]);
  });

  it('includes sourceZone in query key when provided', () => {
    const opts = bucketProductRollupQueryOptions(SHIFT_A, LINE_A, 'סלולר', undefined, 'שפלה אמצעי');
    expect(opts.queryKey).toEqual([
      'manual-shift',
      'bucket-product-rollup',
      SHIFT_A,
      LINE_A,
      'סלולר',
      '__no_distribution_area__',
      'שפלה אמצעי',
      '__no_work_bucket__',
      '__no_source_line__'
    ]);
  });

  it('includes empty sourceZone sentinel in query key for unknown zone', () => {
    const opts = bucketProductRollupQueryOptions(SHIFT_A, LINE_A, 'כללי', undefined, '');
    expect(opts.queryKey).toEqual([
      'manual-shift',
      'bucket-product-rollup',
      SHIFT_A,
      LINE_A,
      'כללי',
      '__no_distribution_area__',
      '',
      '__no_work_bucket__',
      '__no_source_line__'
    ]);
  });

  it('includes workBucketName and sourceLineName in query key when provided', () => {
    const opts = bucketProductRollupQueryOptions(
      SHIFT_A,
      LINE_A,
      'סיגריות-מנטה עין המפרץ',
      'גליל',
      'גליל',
      'סיגריות-מנטה עין המפרץ',
      'גליל'
    );
    expect(opts.queryKey).toEqual([
      'manual-shift',
      'bucket-product-rollup',
      SHIFT_A,
      LINE_A,
      'סיגריות-מנטה עין המפרץ',
      'גליל',
      'גליל',
      'סיגריות-מנטה עין המפרץ',
      'גליל'
    ]);
  });

  it('calls product-rollup endpoint in queryFn', async () => {
    const queryFn = bucketProductRollupQueryOptions(SHIFT_A, LINE_A, 'סלולר').queryFn;
    expect(queryFn).toBeTypeOf('function');
    await queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith(
      `/api/manual-shifts/${SHIFT_A}/buckets/product-rollup?lineId=${LINE_A}&bucketName=%D7%A1%D7%9C%D7%95%D7%9C%D7%A8`
    );
  });

  it('includes sourceZone in fetch URL when provided', async () => {
    const queryFn = bucketProductRollupQueryOptions(SHIFT_A, LINE_A, 'סלולר', undefined, 'שפלה אמצעי').queryFn;
    expect(queryFn).toBeTypeOf('function');
    await queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith(
      `/api/manual-shifts/${SHIFT_A}/buckets/product-rollup?lineId=${LINE_A}&bucketName=%D7%A1%D7%9C%D7%95%D7%9C%D7%A8&sourceZone=%D7%A9%D7%A4%D7%9C%D7%94+%D7%90%D7%9E%D7%A6%D7%A2%D7%99`
    );
  });

  it('includes workBucketName and sourceLineName in fetch URL when provided', async () => {
    const queryFn = bucketProductRollupQueryOptions(
      SHIFT_A,
      LINE_A,
      'סיגריות-מנטה עין המפרץ',
      'גליל',
      'גליל',
      'סיגריות-מנטה עין המפרץ',
      'גליל'
    ).queryFn;
    expect(queryFn).toBeTypeOf('function');
    await queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith(
      `/api/manual-shifts/${SHIFT_A}/buckets/product-rollup?lineId=${LINE_A}&bucketName=%D7%A1%D7%99%D7%92%D7%A8%D7%99%D7%95%D7%AA-%D7%9E%D7%A0%D7%98%D7%94+%D7%A2%D7%99%D7%9F+%D7%94%D7%9E%D7%A4%D7%A8%D7%A5&distributionArea=%D7%92%D7%9C%D7%99%D7%9C&sourceZone=%D7%92%D7%9C%D7%99%D7%9C&workBucketName=%D7%A1%D7%99%D7%92%D7%A8%D7%99%D7%95%D7%AA-%D7%9E%D7%A0%D7%98%D7%94+%D7%A2%D7%99%D7%9F+%D7%94%D7%9E%D7%A4%D7%A8%D7%A5&sourceLineName=%D7%92%D7%9C%D7%99%D7%9C`
    );
  });

  it('includes empty sourceZone in fetch URL when unknown', async () => {
    const queryFn = bucketProductRollupQueryOptions(SHIFT_A, LINE_A, 'כללי', undefined, '').queryFn;
    expect(queryFn).toBeTypeOf('function');
    await queryFn?.({} as never);
    expect(bffRequest).toHaveBeenCalledWith(
      `/api/manual-shifts/${SHIFT_A}/buckets/product-rollup?lineId=${LINE_A}&bucketName=%D7%9B%D7%9C%D7%9C%D7%99&sourceZone=`
    );
  });

  it('is disabled when shiftId is empty', () => {
    expect(bucketProductRollupQueryOptions('', LINE_A, '').enabled).toBe(false);
  });

  it('is disabled when lineId is empty', () => {
    expect(bucketProductRollupQueryOptions(SHIFT_A, '', '').enabled).toBe(false);
  });
});
