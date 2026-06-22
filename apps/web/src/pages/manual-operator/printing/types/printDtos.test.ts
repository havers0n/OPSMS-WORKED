import { describe, expect, it } from 'vitest';
import { getDisplaySku, processCollisions, getDemoPickerSheetData } from './printDtos';
import type { PickerSheetPrintData } from './printDtos';

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
                { sku: 'PREM-ABC001', displaySku: 'ABC001', productName: 'P1', quantity: 10 },
                { sku: 'SECO-ABC001', displaySku: 'ABC001', productName: 'P2', quantity: 5 },
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
                { sku: 'PREM-ABC001', displaySku: 'ABC001', productName: 'P1', quantity: 10 },
                { sku: 'PREM-ABC001', displaySku: 'ABC001', productName: 'P1', quantity: 5 },
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
                { sku: 'AAA-BBB001', displaySku: 'BB001', productName: 'P1', quantity: 10 },
                { sku: 'CCC-DDD002', displaySku: 'DD002', productName: 'P2', quantity: 5 },
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
                { sku: 'PREM-ABC001', displaySku: 'ABC001', productName: 'P1', quantity: 10 },
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
                { sku: 'SECO-ABC001', displaySku: 'ABC001', productName: 'P2', quantity: 5 },
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
                { sku: 'PREM-ABC001', displaySku: 'ABC001', productName: 'P1', quantity: 10 },
                { sku: 'SECO-ABC001', displaySku: 'ABC001', productName: 'P2', quantity: 5 },
              ],
            },
          ],
        },
      ],
    };

    const result = processCollisions(data);
    const item = result.planningLines[0].workGroups[0].items[0];
    // For collided items, displaySku stays unchanged; consumer uses warning flag to decide what to render
    expect(item.displaySku).toBe('ABC001');
    expect(item.sku).toBe('PREM-ABC001');
    expect(item.warning).toBe('sku_display_collision');
  });
});

describe('getDemoPickerSheetData scope filtering', () => {
  it('returns all lines for area scope', () => {
    const data = getDemoPickerSheetData('test', 'שפלה 2', 'area');
    expect(data.planningLines.length).toBe(2);
  });

  it('filters to one line for line scope', () => {
    const data = getDemoPickerSheetData('test', 'שפלה 2', 'line', 'קו אריזה 1');
    expect(data.planningLines.length).toBe(1);
    expect(data.planningLines[0].name).toBe('קו אריזה 1');
  });

  it('filters to one work group for workGroup scope', () => {
    const data = getDemoPickerSheetData('test', 'שפלה 2', 'workGroup', 'קו אריזה 1', 'משמרת בוקר — קבוצה א');
    expect(data.planningLines.length).toBe(1);
    expect(data.planningLines[0].workGroups.length).toBe(1);
    expect(data.planningLines[0].workGroups[0].name).toBe('משמרת בוקר — קבוצה א');
  });

  it('demo data contains collision warnings for ABC001 displaySku', () => {
    const data = getDemoPickerSheetData('test', 'שפלה 2', 'area');
    const allItems = data.planningLines.flatMap(l => l.workGroups.flatMap(wg => wg.items));
    const collidedItems = allItems.filter(i => i.warning === 'sku_display_collision');
    const collidedSkus = collidedItems.map(i => i.sku).sort();
    expect(collidedSkus).toEqual(['EXTR-ABC001', 'PREM-ABC001', 'SECO-ABC001']);
  });
});
