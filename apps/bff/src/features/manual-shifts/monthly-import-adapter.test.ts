import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseManualShiftMonthlyImportWorkbook } from './monthly-import-adapter.js';

function buildMonthlyWorkbookBuffer() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['תאריך הזמנה', 'שם לקוח', 'הזמנה', "מק''ט", 'תיאור', 'קטגוריה', 'כמות', 'קו הפצה', 'תאריך הפצה', 'הערות', 'איזור הפצה'],
    ['27.5.26', 'לקוח א', 'SO-1', '1001', 'מוצר א', 'cat', 2, 'עמקים/נקודה א', '14.6.26', 'איסוף', 'north'],
    ['27.5.26', 'לקוח ב', 'SO-2', '1002', 'מוצר ב', 'cat', '3', 'עמקים', '14.06.26', null, 'north'],
    [null, null, null, null, null, null, null, null, null, null, null],
    ['27.5.26', 'לקוח ג', 'SO-3', '1003', 'מוצר ג', 'cat', 1, 'קו דרום/נקודה ג', new Date(Date.UTC(2026, 5, 5)), 'השלמה', 'south']
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'יוני 26');
  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

describe('manual shift monthly import adapter', () => {
  it('reads header-based rows and excludes fully blank rows', () => {
    const parsed = parseManualShiftMonthlyImportWorkbook({
      fileName: 'monthly.xlsx',
      buffer: buildMonthlyWorkbookBuffer()
    });

    expect(parsed.source).toEqual({
      fileName: 'monthly.xlsx',
      sheetName: 'יוני 26'
    });
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toMatchObject({
      rowIndex: 2,
      distributionDateRaw: '14.6.26',
      rawDistributionValue: 'עמקים/נקודה א',
      customerName: 'לקוח א',
      orderNumber: 'SO-1',
      sku: '1001',
      quantity: 2,
      notes: 'איסוף'
    });
    expect(parsed.rows[2]).toMatchObject({
      rowIndex: 5,
      distributionDateRaw: expect.any(Date),
      distributionDateNormalized: '2026-06-05'
    });
  });

  it('rejects workbook without required monthly sheet', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output);

    expect(() => parseManualShiftMonthlyImportWorkbook({
      fileName: 'monthly.xlsx',
      buffer
    })).toThrowError(expect.objectContaining({ code: 'MISSING_SHEET' }));
  });

  it('rejects workbook without required headers', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['שם לקוח', 'הזמנה'],
      ['לקוח', 'SO-1']
    ]), 'יוני 26');
    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output);

    expect(() => parseManualShiftMonthlyImportWorkbook({
      fileName: 'monthly.xlsx',
      buffer
    })).toThrowError(expect.objectContaining({ code: 'MISSING_REQUIRED_HEADER' }));
  });
});
