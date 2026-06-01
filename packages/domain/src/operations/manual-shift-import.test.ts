import { describe, expect, it } from 'vitest';
import {
  ManualShiftImportError,
  parseDailyManualShiftImport,
  type RawManualShiftImport
} from './manual-shift-import';

function baseRaw(rows: RawManualShiftImport['rows'], dateRaw: string | null = '2.6.26'): RawManualShiftImport {
  return {
    fileName: 'daily.xlsx',
    sheetName: 'סכימות',
    dateRaw,
    rows
  };
}

describe('manual shift import parser', () => {
  it('parses realistic workbook-like rows', () => {
    const parsed = parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום/סלולר' },
      { rowIndex: 6, value: 'דרום/רכב-פז ב\'\'ש מרכז' },
      { rowIndex: 7, value: 'חיפה' },
      { rowIndex: 8, value: 'חיפה/סלולר' }
    ]));

    expect(parsed.importDate).toBe('2026-06-02');
    expect(parsed.lineCount).toBe(2);
    expect(parsed.orderCount).toBe(3);
  });

  it('skips empty rows', () => {
    const parsed = parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: '' },
      { rowIndex: 6, value: '   ' },
      { rowIndex: 7, value: 'דרום/סלולר' }
    ]));
    expect(parsed.orderCount).toBe(1);
  });

  it('normalizes DD.MM.YY', () => {
    const parsed = parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום/סלולר' }
    ], '02.06.26'));
    expect(parsed.importDate).toBe('2026-06-02');
  });

  it('normalizes Excel numeric date serial when raw string is not parseable', () => {
    const parsed = parseDailyManualShiftImport({
      ...baseRaw([
        { rowIndex: 4, value: 'דרום' },
        { rowIndex: 5, value: 'דרום/סלולר' }
      ], '45810'),
      dateExcelSerial: 45810
    });
    expect(parsed.importDate).toBe('2025-06-02');
  });

  it('throws on missing date', () => {
    expect(() => parseDailyManualShiftImport(baseRaw([{ rowIndex: 4, value: 'דרום' }], null))).toThrowError(ManualShiftImportError);
    expect(() => parseDailyManualShiftImport(baseRaw([{ rowIndex: 4, value: 'דרום' }], null))).toThrowError(
      expect.objectContaining({ code: 'MISSING_DATE' })
    );
  });

  it('throws on invalid date', () => {
    expect(() => parseDailyManualShiftImport(baseRaw([{ rowIndex: 4, value: 'דרום' }], '33.1.26'))).toThrowError(
      expect.objectContaining({ code: 'INVALID_DATE' })
    );
  });

  it('throws on no data rows', () => {
    expect(() => parseDailyManualShiftImport(baseRaw([]))).toThrowError(
      expect.objectContaining({ code: 'EMPTY_IMPORT' })
    );
  });

  it('throws on orphan child before line', () => {
    expect(() => parseDailyManualShiftImport(baseRaw([{ rowIndex: 4, value: 'דרום/סלולר' }]))).toThrowError(
      expect.objectContaining({ code: 'ORPHAN_CHILD_ROW' })
    );
  });

  it('throws on prefix mismatch', () => {
    expect(() => parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'חיפה/סלולר' }
    ]))).toThrowError(expect.objectContaining({ code: 'LINE_PREFIX_MISMATCH' }));
  });

  it('throws on duplicate top-level line', () => {
    expect(() => parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום' }
    ]))).toThrowError(expect.objectContaining({ code: 'DUPLICATE_LINE' }));
  });

  it('throws on duplicate child inside line', () => {
    expect(() => parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום/סלולר' },
      { rowIndex: 6, value: 'דרום/סלולר' }
    ]))).toThrowError(expect.objectContaining({ code: 'DUPLICATE_CHILD_WITHIN_LINE' }));
  });

  it('throws on empty child after slash', () => {
    expect(() => parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום/  ' }
    ]))).toThrowError(expect.objectContaining({ code: 'EMPTY_ORDER_POINT_NAME' }));
  });

  it('handles spaces around slash', () => {
    const parsed = parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: ' דרום ' },
      { rowIndex: 5, value: ' דרום / סלולר ' }
    ]));
    expect(parsed.lines[0]?.name).toBe('דרום');
    expect(parsed.lines[0]?.orders[0]?.pointName).toBe('סלולר');
  });

  it('splits only on first slash', () => {
    const parsed = parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום/רכב-פז ב\'\'ש/מרכז' }
    ]));
    expect(parsed.lines[0]?.orders[0]?.pointName).toBe('רכב-פז ב\'\'ש/מרכז');
  });

  it('preserves raw row values', () => {
    const parsed = parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: ' דרום ' },
      { rowIndex: 5, value: ' דרום / סלולר ' }
    ]));
    expect(parsed.lines[0]?.rawLabel).toBe(' דרום ');
    expect(parsed.lines[0]?.orders[0]?.rawLabel).toBe(' דרום / סלולר ');
  });

  it('preserves line sort order', () => {
    const parsed = parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום/סלולר' },
      { rowIndex: 6, value: 'חיפה' },
      { rowIndex: 7, value: 'חיפה/סלולר' }
    ]));
    expect(parsed.lines.map((line) => line.sortOrder)).toEqual([1, 2]);
  });

  it('preserves child sort order', () => {
    const parsed = parseDailyManualShiftImport(baseRaw([
      { rowIndex: 4, value: 'דרום' },
      { rowIndex: 5, value: 'דרום/סלולר' },
      { rowIndex: 6, value: 'דרום/רכב-פז ב\'\'ש מרכז' }
    ]));
    expect(parsed.lines[0]?.orders.map((order) => order.sortOrder)).toEqual([1, 2]);
  });
});
