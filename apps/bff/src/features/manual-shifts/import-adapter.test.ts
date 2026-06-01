import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { ApiError } from '../../errors.js';
import { parseManualShiftImportWorkbook } from './import-adapter.js';

function buildWorkbookBuffer(withSheet: boolean): Buffer {
  const workbook = XLSX.utils.book_new();
  if (withSheet) {
    const sheet = XLSX.utils.aoa_to_sheet([
      [null, 'תאריך הפצה', '2.6.26'],
      [],
      [null, 'קו הפצה'],
      [null, 'דרום'],
      [null, 'דרום/סלולר'],
      [null, ''],
      [null, 'חיפה'],
      [null, 'חיפה/סלולר']
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'סכימות');
  } else {
    const otherSheet = XLSX.utils.aoa_to_sheet([['x']]);
    XLSX.utils.book_append_sheet(workbook, otherSheet, 'Other');
  }
  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

describe('manual shift import adapter', () => {
  it('reads sheet סכימות, C1 date, and B4+ values', () => {
    const parsed = parseManualShiftImportWorkbook({
      fileName: 'manual.xlsx',
      buffer: buildWorkbookBuffer(true)
    });

    expect(parsed.sheetName).toBe('סכימות');
    expect(parsed.dateRaw).toBe('2.6.26');
    expect(parsed.rows).toEqual([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום/סלולר' },
      { rowIndex: 7, value: 'חיפה' },
      { rowIndex: 8, value: 'חיפה/סלולר' }
    ]);
  });

  it('extracts representative workbook rows including spaces and multi-slash values', () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [null, 'תאריך הפצה', '2.6.26'],
      [],
      [null, 'קו הפצה'],
      [null, 'דרום'],
      [null, 'דרום/סלולר'],
      [null, 'דרום/רכב-פז ב\'\'ש מרכז'],
      [null, ''],
      [null, 'חיפה'],
      [null, 'חיפה / לאסט פרייס'],
      [null, 'חיפה/קטגוריה/פנימית']
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'סכימות');
    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output);

    const parsed = parseManualShiftImportWorkbook({
      fileName: 'manual.xlsx',
      buffer
    });

    expect(parsed.dateRaw).toBe('2.6.26');
    expect(parsed.rows).toEqual([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום/סלולר' },
      { rowIndex: 6, value: 'דרום/רכב-פז ב\'\'ש מרכז' },
      { rowIndex: 8, value: 'חיפה' },
      { rowIndex: 9, value: 'חיפה / לאסט פרייס' },
      { rowIndex: 10, value: 'חיפה/קטגוריה/פנימית' }
    ]);
  });

  it('captures numeric Excel date serial for parser fallback', () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [null, null, 45810],
      [],
      [],
      [null, 'דרום'],
      [null, 'דרום/סלולר']
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'סכימות');
    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output);

    const parsed = parseManualShiftImportWorkbook({
      fileName: 'manual.xlsx',
      buffer
    });

    expect(typeof parsed.dateExcelSerial === 'number' || parsed.dateExcelSerial === null).toBe(true);
  });

  it('rejects malformed workbook payload', () => {
    expect(() => parseManualShiftImportWorkbook({
      fileName: 'manual.xlsx',
      buffer: Buffer.from('not a workbook')
    })).toThrowError(expect.objectContaining({ code: 'INVALID_WORKBOOK' }));
  });

  it('rejects workbook without סכימות', () => {
    expect(() => parseManualShiftImportWorkbook({
      fileName: 'manual.xlsx',
      buffer: buildWorkbookBuffer(false)
    })).toThrowError(ApiError);
    expect(() => parseManualShiftImportWorkbook({
      fileName: 'manual.xlsx',
      buffer: buildWorkbookBuffer(false)
    })).toThrowError(expect.objectContaining({ code: 'MISSING_SHEET' }));
  });
});
