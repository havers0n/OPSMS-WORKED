import { describe, expect, it } from 'vitest';
import {
  getDisplaySku,
  processCollisions,
  aggregatePickerItems,
  pickerPrintItemSchema,
  pickerSheetPrintDataSchema,
} from './manual-shift-print';
import type { PickerSheetPrintData, PickerPrintItem } from './manual-shift-print';
import type { ManualShiftOrderItem } from './manual-shift-control';

describe('getDisplaySku', () => {
  it('returns last 6 characters for SKU longer than 6 chars', () => {
    expect(getDisplaySku('PREM-ABC001')).toBe('ABC001');
    expect(getDisplaySku('SECO-ABC001')).toBe('ABC001');
    expect(getDisplaySku('EXTR-ABC001')).toBe('ABC001');
  });

  it('returns SKU unchanged when length is exactly 6', () => {
    expect(getDisplaySku('123456')).toBe('123456');
  });

  it('returns SKU unchanged when length is less than 6', () => {
    expect(getDisplaySku('12345')).toBe('12345');
    expect(getDisplaySku('A')).toBe('A');
    expect(getDisplaySku('')).toBe('');
  });

  it('returns last 6 characters for arbitrary SKUs', () => {
    expect(getDisplaySku('ABC-0000001')).toBe('000001');
    expect(getDisplaySku('1234567')).toBe('234567');
  });
});

describe('processCollisions', () => {
  it('marks different SKUs with same displaySku as collision', () => {
    const data: PickerSheetPrintData = {
      shift: 'test',
      scope: 'area',
      shiftDate: '',
      distributionArea: '',
      generatedAt: '',
      totals: { lines: 1, workGroups: 1, items: 2 },
      planningLines: [
        {
          name: 'Line 1',
          workGroups: [
            {
              name: 'WG 1',
              items: [
                { sku: 'PREM-ABC001', displaySku: 'ABC001', description: 'P1', quantity: 10 },
                { sku: 'SECO-ABC001', displaySku: 'ABC001', description: 'P2', quantity: 5 },
              ],
            },
          ],
        },
      ],
    };

    const result = processCollisions(data);
    expect(result.planningLines[0].workGroups[0].items[0].warning).toBe('sku_display_collision');
    expect(result.planningLines[0].workGroups[0].items[1].warning).toBe('sku_display_collision');
  });

  it('does not mark same SKU duplicates as collision', () => {
    const data: PickerSheetPrintData = {
      shift: 'test',
      scope: 'area',
      shiftDate: '',
      distributionArea: '',
      generatedAt: '',
      totals: { lines: 1, workGroups: 1, items: 2 },
      planningLines: [
        {
          name: 'Line 1',
          workGroups: [
            {
              name: 'WG 1',
              items: [
                { sku: 'PREM-ABC001', displaySku: 'ABC001', description: 'P1', quantity: 10 },
                { sku: 'PREM-ABC001', displaySku: 'ABC001', description: 'P1', quantity: 5 },
              ],
            },
          ],
        },
      ],
    };

    const result = processCollisions(data);
    expect(result.planningLines[0].workGroups[0].items[0].warning).toBeUndefined();
    expect(result.planningLines[0].workGroups[0].items[1].warning).toBeUndefined();
  });

  it('does not mark items with unique displaySku', () => {
    const data: PickerSheetPrintData = {
      shift: 'test',
      scope: 'area',
      shiftDate: '',
      distributionArea: '',
      generatedAt: '',
      totals: { lines: 1, workGroups: 1, items: 2 },
      planningLines: [
        {
          name: 'Line 1',
          workGroups: [
            {
              name: 'WG 1',
              items: [
                { sku: 'AAA-BBB001', displaySku: 'BB001', description: 'P1', quantity: 10 },
                { sku: 'CCC-DDD002', displaySku: 'DD002', description: 'P2', quantity: 5 },
              ],
            },
          ],
        },
      ],
    };

    const result = processCollisions(data);
    expect(result.planningLines[0].workGroups[0].items[0].warning).toBeUndefined();
    expect(result.planningLines[0].workGroups[0].items[1].warning).toBeUndefined();
  });

  it('detects collisions across different work groups and lines', () => {
    const data: PickerSheetPrintData = {
      shift: 'test',
      scope: 'area',
      shiftDate: '',
      distributionArea: '',
      generatedAt: '',
      totals: { lines: 2, workGroups: 2, items: 2 },
      planningLines: [
        {
          name: 'Line 1',
          workGroups: [
            {
              name: 'WG A',
              items: [
                { sku: 'PREM-ABC001', displaySku: 'ABC001', description: 'P1', quantity: 10 },
              ],
            },
          ],
        },
        {
          name: 'Line 2',
          workGroups: [
            {
              name: 'WG B',
              items: [
                { sku: 'SECO-ABC001', displaySku: 'ABC001', description: 'P2', quantity: 5 },
              ],
            },
          ],
        },
      ],
    };

    const result = processCollisions(data);
    expect(result.planningLines[0].workGroups[0].items[0].warning).toBe('sku_display_collision');
    expect(result.planningLines[1].workGroups[0].items[0].warning).toBe('sku_display_collision');
  });

  it('marks collided items with full SKU in collided rows', () => {
    const data: PickerSheetPrintData = {
      shift: 'test',
      scope: 'area',
      shiftDate: '',
      distributionArea: '',
      generatedAt: '',
      totals: { lines: 1, workGroups: 1, items: 2 },
      planningLines: [
        {
          name: 'Line 1',
          workGroups: [
            {
              name: 'WG 1',
              items: [
                { sku: 'PREM-ABC001', displaySku: 'ABC001', description: 'P1', quantity: 10 },
                { sku: 'SECO-ABC001', displaySku: 'ABC001', description: 'P2', quantity: 5 },
              ],
            },
          ],
        },
      ],
    };

    const result = processCollisions(data);
    const item = result.planningLines[0].workGroups[0].items[0];
    expect(item.displaySku).toBe('ABC001');
    expect(item.sku).toBe('PREM-ABC001');
    expect(item.warning).toBe('sku_display_collision');
  });
});

describe('aggregatePickerItems', () => {
  function makeItem(overrides: Partial<ManualShiftOrderItem> & { sku: string }): ManualShiftOrderItem {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      tenantId: '00000000-0000-0000-0000-000000000000',
      shiftId: '00000000-0000-0000-0000-000000000000',
      lineId: '00000000-0000-0000-0000-000000000000',
      orderId: '00000000-0000-0000-0000-000000000000',
      description: null,
      category: null,
      quantity: 1,
      notes: null,
      zone: null,
      sourceSheet: null,
      sourceRows: null,
      sourceFile: null,
      sortOrder: 0,
      createdAt: '',
      ...overrides,
    };
  }

  it('sums quantity for duplicate SKUs', () => {
    const items = [
      makeItem({ sku: 'SKU-001', description: 'Product A', quantity: 10 }),
      makeItem({ sku: 'SKU-001', description: 'Product A', quantity: 5 }),
    ];
    const result = aggregatePickerItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('SKU-001');
    expect(result[0].quantity).toBe(15);
  });

  it('preserves description and category from first occurrence', () => {
    const items = [
      makeItem({ sku: 'SKU-001', description: 'First', category: 'CatA', quantity: 5 }),
      makeItem({ sku: 'SKU-001', description: 'Second', category: null, quantity: 3 }),
    ];
    const result = aggregatePickerItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('First');
    expect(result[0].category).toBe('CatA');
  });

  it('creates separate entries for different SKUs', () => {
    const items = [
      makeItem({ sku: 'SKU-AAA', description: 'Product A', quantity: 10 }),
      makeItem({ sku: 'SKU-BBB', description: 'Product B', quantity: 5 }),
    ];
    const result = aggregatePickerItems(items);
    expect(result).toHaveLength(2);
  });

  it('applies getDisplaySku to each aggregated item', () => {
    const items = [
      makeItem({ sku: 'PREM-ABC001', description: 'Product', quantity: 1 }),
    ];
    const result = aggregatePickerItems(items);
    expect(result[0].displaySku).toBe('ABC001');
  });

  it('sorts items by SKU', () => {
    const items = [
      makeItem({ sku: 'SKU-ZZZ', description: 'Z', quantity: 1 }),
      makeItem({ sku: 'SKU-AAA', description: 'A', quantity: 1 }),
      makeItem({ sku: 'SKU-BBB', description: 'B', quantity: 1 }),
    ];
    const result = aggregatePickerItems(items);
    expect(result.map(r => r.sku)).toEqual(['SKU-AAA', 'SKU-BBB', 'SKU-ZZZ']);
  });

  it('handles empty input', () => {
    const result = aggregatePickerItems([]);
    expect(result).toEqual([]);
  });
});

describe('PickerSheetPrintData schema validation', () => {
  it('accepts a valid picker sheet print data object', () => {
    const data: PickerSheetPrintData = {
      shift: 'Morning shift',
      scope: 'workGroup',
      shiftDate: '22/06/2026',
      distributionArea: 'שפלה 2',
      generatedAt: '2026-06-22T10:00:00.000Z',
      totals: { lines: 1, workGroups: 1, items: 2 },
      planningLines: [
        {
          name: 'קו אריזה 1',
          workGroups: [
            {
              name: 'סיגריות-מנטה',
              items: [
                { sku: 'SKU-001', displaySku: 'U-001', description: 'Product A', quantity: 10 },
              ],
            },
          ],
        },
      ],
    };
    const parsed = pickerSheetPrintDataSchema.parse(data);
    expect(parsed.shift).toBe('Morning shift');
  });

  it('rejects invalid scope', () => {
    expect(() =>
      pickerSheetPrintDataSchema.parse({
        shift: 'test',
        scope: 'invalid',
        shiftDate: '',
        distributionArea: '',
        generatedAt: '',
        totals: { lines: 0, workGroups: 0, items: 0 },
        planningLines: [],
      })
    ).toThrow();
  });
});
