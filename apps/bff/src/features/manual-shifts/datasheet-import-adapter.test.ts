import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseDemandImportDataSheetWorkbook } from './datasheet-import-adapter.js';

function workbookFromAoA(data: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'DataSheet');
  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return {
    workbook,
    sheet,
    buffer: Buffer.isBuffer(out) ? out : Buffer.from(out)
  };
}

function baseHeader() {
  return ['סוכן', 'תאריך הזמנה', 'שם לקוח', 'הזמנה', "מק''ט", 'תיאור', 'קטגוריה', 'כמות', 'שווי', 'קו הפצה', 'תאריך הפצה', 'הערות', 'איזור הפצה'];
}

describe('DataSheet import adapter', () => {
  it('accepts blank delivery date and blank route line', () => {
    const { buffer } = workbookFromAoA([
      baseHeader(),
      ['agent', '24.6.26', 'לקוח א', 'SO-1', 'SKU-1', 'מוצר', 'cat', 3, 10, null, null, 'הערה', 'דרום']
    ]);

    const result = parseDemandImportDataSheetWorkbook({ fileName: 'datasheet.xlsx', buffer });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      sourceRowNumber: 2,
      orderDateRaw: '24.6.26',
      rawRouteLine: null,
      plannedDeliveryDateRaw: null,
      distributionArea: 'דרום'
    });
  });

  it('maps order date and distribution area from the expected columns', () => {
    const { buffer } = workbookFromAoA([
      baseHeader(),
      ['agent', new Date(Date.UTC(2026, 5, 24)), 'לקוח א', 'SO-1', 'SKU-1', 'מוצר', 'cat', 3, 10, null, null, null, 'גליל']
    ]);

    const result = parseDemandImportDataSheetWorkbook({ fileName: 'datasheet.xlsx', buffer });
    expect(result.rows[0].orderDateRaw).toBeInstanceOf(Date);
    expect(result.rows[0].distributionArea).toBe('גליל');
  });

  it('reads rows beyond a stale filter range by using the real sheet range', () => {
    const { workbook, sheet } = workbookFromAoA([
      baseHeader(),
      ['agent', '24.6.26', 'לקוח א', 'SO-1', 'SKU-1', 'מוצר', 'cat', 3, 10, null, null, null, 'דרום'],
      ['agent', '24.6.26', 'לקוח ב', 'SO-2', 'SKU-2', 'מוצר', 'cat', 4, 20, null, null, null, 'צפון'],
      ['agent', '24.6.26', 'לקוח ג', 'SO-3', 'SKU-3', 'מוצר', 'cat', 5, 30, null, null, null, 'מרכז']
    ]);

    sheet['!autofilter'] = { ref: 'A1:M3' };
    const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    const result = parseDemandImportDataSheetWorkbook({ fileName: 'datasheet.xlsx', buffer });
    expect(result.rows).toHaveLength(3);
    expect(result.rows[2].sourceRowNumber).toBe(4);
    expect(result.rows[2].orderNumber).toBe('SO-3');
  });

  it('rejects workbook without DataSheet', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    expect(() => parseDemandImportDataSheetWorkbook({ fileName: 'datasheet.xlsx', buffer }))
      .toThrowError(expect.objectContaining({ code: 'MISSING_SHEET' }));
  });
});
