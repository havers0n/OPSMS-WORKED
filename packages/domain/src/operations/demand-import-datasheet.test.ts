import { describe, expect, it } from 'vitest';
import { parseDemandImportDataSheetPreview } from './demand-import-datasheet';

function buildRow(overrides: Partial<Parameters<typeof parseDemandImportDataSheetPreview>[0]['rows'][number]> = {}) {
  return {
    sourceRowNumber: 2,
    agent: 'agent-a',
    orderDateRaw: '2026-06-24',
    customerName: 'לקוח א',
    orderNumber: 'SO-1',
    sku: 'SKU-1',
    description: 'מוצר רגיל',
    category: 'רגיל',
    quantity: 3,
    cost: 12.5,
    rawRouteLine: null,
    plannedDeliveryDateRaw: null,
    notes: null,
    distributionArea: 'דרום',
    ...overrides
  };
}

describe('demand import DataSheet parser', () => {
  it('stages normal rows as unplanned with null planned delivery fields', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow()]
    });

    expect(result.rowsCount).toBe(1);
    expect(result.rawRowsCount).toBe(1);
    expect(result.warningRowsCount).toBe(0);
    expect(result.errorRowsCount).toBe(0);
    expect(result.specialFlowRowsCount).toBe(0);
    expect(result.rows[0]).toMatchObject({
      orderDate: '2026-06-24',
      distributionArea: 'דרום',
      planningStatus: 'unplanned',
      routeFlow: 'unassigned',
      plannedDeliveryDate: null,
      plannedRouteLine: null,
      plannedWorkBucket: null
    });
  });

  it('marks missing distribution area as error', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ distributionArea: null })]
    });

    expect(result.errorRowsCount).toBe(1);
    expect(result.rows[0].planningStatus).toBe('error');
    expect(result.rows[0].issues).toContainEqual(expect.objectContaining({
      code: 'MISSING_DISTRIBUTION_AREA',
      severity: 'error'
    }));
  });

  it('marks missing SKU as error', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ sku: null })]
    });

    expect(result.errorRowsCount).toBe(1);
    expect(result.rows[0].issues).toContainEqual(expect.objectContaining({
      code: 'MISSING_SKU',
      severity: 'error'
    }));
  });

  it('keeps zero quantity rows staged with warning', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ quantity: 0 })]
    });

    expect(result.rawRowsCount).toBe(1);
    expect(result.warningRowsCount).toBe(1);
    expect(result.rows[0].planningStatus).toBe('unplanned');
    expect(result.rows[0].issues).toContainEqual(expect.objectContaining({
      code: 'ZERO_QUANTITY',
      severity: 'warning'
    }));
  });

  it('classifies pickup rows as special flow', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ notes: 'איסוף עצמי מחר' })]
    });

    expect(result.specialFlowRowsCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      planningStatus: 'special_flow',
      routeFlow: 'pickup'
    });
  });

  it('classifies ashlama rows as special flow', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ notes: 'השלמה דחופה' })]
    });

    expect(result.rows[0]).toMatchObject({
      planningStatus: 'special_flow',
      routeFlow: 'ashlama'
    });
  });

  it('classifies obvious handling flows', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [
        buildRow({ sourceRowNumber: 2, description: 'סיגריות מנטה' }),
        buildRow({ sourceRowNumber: 3, description: 'בוסטר תוספת' }),
        buildRow({ sourceRowNumber: 4, description: 'צידנית קיץ' }),
        buildRow({ sourceRowNumber: 5, description: 'גריל פחמים' }),
        buildRow({ sourceRowNumber: 6, description: 'בריכה משפחתית' }),
        buildRow({ sourceRowNumber: 7, description: 'מיטה זוגית' }),
        buildRow({ sourceRowNumber: 8, description: 'כיסא פלסטיק' })
      ]
    });

    expect(result.rows.map((row) => row.productHandlingFlow)).toEqual([
      'cigarette',
      'booster',
      'cooler',
      'grill',
      'pool',
      'bed',
      'chair'
    ]);
  });

  it('extracts note date hints without affecting planning status', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ notes: 'לתאם 25.06.26 מול לקוח' })]
    });

    expect(result.rows[0].planningStatus).toBe('unplanned');
    expect(result.rows[0].noteDateHints).toEqual([
      { raw: '25.06.26', normalized: '2026-06-25' }
    ]);
    expect(result.rows[0].plannedDeliveryDate).toBeNull();
  });
});
