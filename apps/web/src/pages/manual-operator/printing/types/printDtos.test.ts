import { describe, expect, it } from 'vitest';
import { getDemoPickerSheetData } from './printDtos';

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

  it('uses description field instead of productName', () => {
    const data = getDemoPickerSheetData('test', 'שפלה 2', 'area');
    const allItems = data.planningLines.flatMap(l => l.workGroups.flatMap(wg => wg.items));
    expect(allItems[0].description).toBe('מחברת A4 100 דפים');
    expect(allItems[0]).not.toHaveProperty('productName');
  });
});
