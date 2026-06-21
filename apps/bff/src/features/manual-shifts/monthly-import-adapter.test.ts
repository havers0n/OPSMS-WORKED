import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseManualShiftMonthlyImportWorkbook } from './monthly-import-adapter.js';

function buildMonthlyWorkbookBuffer(sheetName = 'יוני 26') {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['תאריך הזמנה', 'שם לקוח', 'הזמנה', "מק''ט", 'תיאור', 'קטגוריה', 'כמות', 'קו הפצה', 'תאריך הפצה', 'הערות', 'איזור הפצה'],
    ['27.5.26', 'לקוח א', 'SO-1', '1001', 'מוצר א', 'cat', 2, 'עמקים/נקודה א', '14.6.26', 'איסוף', 'north'],
    ['27.5.26', 'לקוח ב', 'SO-2', '1002', 'מוצר ב', 'cat', '3', 'עמקים', '14.06.26', null, 'north'],
    [null, null, null, null, null, null, null, null, null, null, null],
    ['27.5.26', 'לקוח ג', 'SO-3', '1003', 'מוצר ג', 'cat', 1, 'קו דרום/נקודה ג', new Date(Date.UTC(2026, 5, 5)), 'השלמה', 'south']
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

function parseBuffer(buffer: Buffer, opts?: { fileName?: string; selectedDate?: string }) {
  return parseManualShiftMonthlyImportWorkbook({
    fileName: opts?.fileName ?? 'monthly.xlsx',
    buffer,
    selectedDate: opts?.selectedDate,
  });
}

function workbookFromAoA(data: unknown[][], sheetName = 'יוני 26'): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), sheetName);
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

describe('manual shift monthly import adapter', () => {
  describe('basic row parsing', () => {
    it('reads header-based rows and excludes fully blank rows', () => {
      const parsed = parseBuffer(buildMonthlyWorkbookBuffer());

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

      expect(() => parseBuffer(buffer)).toThrowError(expect.objectContaining({ code: 'MISSING_SHEET' }));
    });
  });

  // ── PR G1: Hebrew header normalization ─────────────────────────────────────

  describe('header variant matching', () => {
    const BASE_DATA = [
      ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', null, 'כמות'],
      ['14.6.26', 'עמקים/נקודה א', 'לקוח', 'SO-1', '1001', 2],
    ];

    it.each([
      ["מק''ט", 'two single quotes'],
      ['מק"ט', 'double quote'],
      ['מק״ט', 'Hebrew gershayim'],
      ["מק'ט", 'single quote'],
      ['מקט', 'no quotes'],
    ])('accepts SKU header variant "%s" (%s)', (_variant, _label) => {
      const headerRow = [...BASE_DATA[0]];
      headerRow[4] = _variant;
      const buffer = workbookFromAoA([headerRow, BASE_DATA[1]]);
      const parsed = parseBuffer(buffer);
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].sku).toBe('1001');
    });

    it('maps all variants to SKU consistently', () => {
      const parsed1 = parseBuffer(workbookFromAoA([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.6.26', 'עמקים/א', 'לקוח', 'SO-1', '1001', 2],
      ]));
      const parsed2 = parseBuffer(workbookFromAoA([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', 'מק״ט', 'כמות'],
        ['14.6.26', 'עמקים/א', 'לקוח', 'SO-1', '2002', 3],
      ]));
      expect(parsed1.rows[0]).toMatchObject({ sku: '1001', quantity: 2 });
      expect(parsed2.rows[0]).toMatchObject({ sku: '2002', quantity: 3 });
    });
  });

  describe('reordered columns', () => {
    it('reads data by header name, not column index', () => {
      // Columns in a different order than canonical layout
      const buffer = workbookFromAoA([
        ['כמות', 'שם לקוח', 'תאריך הפצה', 'קו הפצה', 'הזמנה', "מק''ט"],
        [5, 'לקוח', '14.6.26', 'עמקים/נקודה א', 'SO-1', '9999'],
      ]);
      const parsed = parseBuffer(buffer);
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0]).toMatchObject({
        quantity: 5,
        customerName: 'לקוח',
        rawDistributionValue: 'עמקים/נקודה א',
        orderNumber: 'SO-1',
        sku: '9999',
      });
    });
  });

  describe('missing header diagnostics', () => {
    it('rejects workbook without required headers with structured error', () => {
      const buffer = workbookFromAoA([
        ['שם לקוח', 'הזמנה', 'כמות'],
        ['לקוח', 'SO-1', 2],
      ]);
      expect(() => parseBuffer(buffer)).toThrowError(
        expect.objectContaining({ code: 'MISSING_REQUIRED_HEADER' })
      );
    });

    it('includes available headers, missing fields, and aliases in error details', () => {
      const buffer = workbookFromAoA([
        ['שם לקוח', 'הזמנה', 'כמות'],
        ['לקוח', 'SO-1', 2],
      ]);
      try {
        parseBuffer(buffer);
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('MISSING_REQUIRED_HEADER');
        expect(err.details).toBeDefined();
        expect(err.details.missingFields).toEqual(
          expect.arrayContaining(['תאריך הפצה', 'קו הפצה', 'מק"ט'])
        );
        expect(err.details.availableHeaders).toEqual(['שם לקוח', 'הזמנה', 'כמות']);
        expect(err.details.acceptedAliases).toBeDefined();
        expect(err.details.acceptedAliases['מק"ט']).toBeDefined();
        expect(err.details.sheetName).toBe('יוני 26');
      }
    });
  });

  // ── PR G1: Sheet selection ────────────────────────────────────────────────

  // ── PR G2: Excel serial date parsing ─────────────────────────────────────

  describe('excel serial date parsing', () => {
    it('parses Excel serial number as date without timezone shift', () => {
      const buffer = workbookFromAoA([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        [46176, 'קו/נקודה', 'לקוח', 'SO-1', '1001', 2],
      ]);
      const parsed = parseBuffer(buffer, { selectedDate: '2026-06-03' });
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].distributionDateNormalized).toBe('2026-06-03');
    });

    it('parses another Excel serial date correctly', () => {
      const buffer = workbookFromAoA([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        [46173, 'קו/נקודה', 'לקוח', 'SO-1', '1001', 2],
      ], 'מאי 26');
      const parsed = parseBuffer(buffer, { selectedDate: '2026-05-31' });
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].distributionDateNormalized).toBe('2026-05-31');
    });

    it('parses serial date and matches to preview', () => {
      const buffer = workbookFromAoA([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        [46176, 'קו/נקודה', 'לקוח', 'SO-1', '1001', 2],
        [46177, 'קו/נקודה', 'לקוח', 'SO-2', '1002', 3],
      ]);
      const parsed = parseBuffer(buffer, { selectedDate: '2026-06-03' });
      expect(parsed.rows).toHaveLength(2);
      expect(parsed.rows[0].distributionDateNormalized).toBe('2026-06-03');
      expect(parsed.rows[1].distributionDateNormalized).toBe('2026-06-04');
    });
  });

  // ── PR G2: Full Hebrew month sheet selection ──────────────────────────────

  describe('sheet selection', () => {
    it('parseManualShiftMonthlyImportWorkbook_does_not_fallback_to_yuni_26_for_other_selected_month', () => {
      const buffer = workbookFromAoA([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.6.26', 'יוני/נקודה', 'לקוח', 'SO-1', '1001', 2],
      ], 'יוני 26');

      expect(() => parseBuffer(buffer, { selectedDate: '2026-07-14' })).toThrowError(
        expect.objectContaining({
          code: 'MISSING_SHEET',
          details: expect.objectContaining({
            selectedDate: '2026-07-14',
            expectedSheet: 'יולי 26',
            availableSheets: ['יוני 26']
          })
        })
      );
    });

    it('parseManualShiftMonthlyImportWorkbook_selects_yuni_26_when_selectedDate_is_june_2026', () => {
      const buffer = workbookFromAoA([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.6.26', 'יוני/נקודה', 'לקוח', 'SO-1', '1001', 2],
      ], 'יוני 26');

      const parsed = parseBuffer(buffer, { selectedDate: '2026-06-14' });
      expect(parsed.source.sheetName).toBe('יוני 26');
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].orderNumber).toBe('SO-1');
    });

    it('parseManualShiftMonthlyImportWorkbook_selects_matching_hebrew_month_sheet_only', () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.6.26', 'יוני/נקודה', 'לקוח', 'SO-1', '1001', 2],
      ]), 'יוני 26');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.7.26', 'יולי/נקודה', 'לקוח', 'SO-2', '1002', 3],
      ]), 'יולי 26');
      const output = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output);

      const parsed = parseBuffer(buffer, { selectedDate: '2026-07-14' });
      expect(parsed.source.sheetName).toBe('יולי 26');
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].orderNumber).toBe('SO-2');
    });

    it('prefers sheet matching selectedDate month/year', () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.5.26', 'מאי/נקודה', 'לקוח', 'SO-1', '1001', 2],
      ]), 'מאי 26');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.6.26', 'יוני/נקודה', 'לקוח', 'SO-2', '1002', 3],
      ]), 'יוני 26');
      const buf = Buffer.isBuffer(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
        ? XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        : Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      const parsed = parseBuffer(buf, { selectedDate: '2026-06-14' });
      expect(parsed.source.sheetName).toBe('יוני 26');
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].orderNumber).toBe('SO-2');
    });

    it('selects May sheet when selectedDate is in May', () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.5.26', 'מאי/נקודה', 'לקוח', 'SO-1', '1001', 2],
      ]), 'מאי 26');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.6.26', 'יוני/נקודה', 'לקוח', 'SO-2', '1002', 3],
      ]), 'יוני 26');
      const buf = Buffer.isBuffer(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
        ? XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        : Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      const parsed = parseBuffer(buf, { selectedDate: '2026-05-14' });
      expect(parsed.source.sheetName).toBe('מאי 26');
      expect(parsed.rows[0].orderNumber).toBe('SO-1');
    });

    it('rejects with structured error when date cannot match any sheet and multiple sheets exist', () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Sheet1');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Sheet2');
      const buf = Buffer.isBuffer(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
        ? XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        : Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      expect(() => parseBuffer(buf, { selectedDate: '2026-07-14' }))
        .toThrowError(expect.objectContaining({ code: 'MISSING_SHEET' }));
    });

    it('uses single sheet even if name is non-canonical', () => {
      const buffer = workbookFromAoA([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.6.26', 'עמקים/א', 'לקוח', 'SO-1', '1001', 2],
      ], 'My Data');
      const parsed = parseBuffer(buffer);
      expect(parsed.source.sheetName).toBe('My Data');
      expect(parsed.rows).toHaveLength(1);
    });

    it('rejects missing sheet with available sheet names in error', () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Sheet1');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Sheet2');
      const buf = Buffer.isBuffer(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
        ? XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        : Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      try {
        parseBuffer(buf, { selectedDate: '2026-06-14' });
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('MISSING_SHEET');
        expect(err.details.availableSheets).toEqual(['Sheet1', 'Sheet2']);
        expect(err.details.expectedSheet).toBe('יוני 26');
      }
    });

    it('includes expectedSheet derived from selectedDate in error details', () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'SomeSheet');
      const buf = Buffer.isBuffer(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
        ? XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        : Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      try {
        parseBuffer(buf, { selectedDate: '2026-06-14' });
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('MISSING_SHEET');
        expect(err.details.expectedSheet).toBe('יוני 26');
        expect(err.details.selectedDate).toBe('2026-06-14');
      }
    });

    // ── PR G2: Full Hebrew month sheet selection ───────────────────────────

    it('selects November sheet when selectedDate is in November', () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['19.11.26', 'נובמבר/נקודה', 'לקוח', 'SO-1', '1001', 2],
      ]), 'נובמבר 26');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.6.26', 'יוני/נקודה', 'לקוח', 'SO-2', '1002', 3],
      ]), 'יוני 26');
      const buf = Buffer.isBuffer(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
        ? XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        : Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      const parsed = parseBuffer(buf, { selectedDate: '2026-11-19' });
      expect(parsed.source.sheetName).toBe('נובמבר 26');
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0].orderNumber).toBe('SO-1');
    });

    it('selects January sheet for January date', () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['15.1.26', 'ינואר/נקודה', 'לקוח', 'SO-1', '1001', 2],
      ]), 'ינואר 26');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
        ['14.6.26', 'יוני/נקודה', 'לקוח', 'SO-2', '1002', 3],
      ]), 'יוני 26');
      const buf = Buffer.isBuffer(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
        ? XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        : Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      const parsed = parseBuffer(buf, { selectedDate: '2026-01-15' });
      expect(parsed.source.sheetName).toBe('ינואר 26');
    });

    it('selects correct sheet for each month across multiple Hebrew month sheets', () => {
      function multiMonthBuffer() {
        const wb = XLSX.utils.book_new();
        const sheets: [string, string, string][] = [
          ['מאי 26', '14.5.26', 'SO-1'],
          ['יוני 26', '14.6.26', 'SO-2'],
          ['יולי 26', '14.7.26', 'SO-3'],
          ['נובמבר 26', '19.11.26', 'SO-4'],
        ];
        for (const [sheetName, date, order] of sheets) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
            ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'],
            [date, 'קו/נקודה', 'לקוח', order, '1001', 2],
          ]), sheetName);
        }
        const buf = Buffer.isBuffer(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
          ? XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
          : Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
        return buf;
      }

      const buf = multiMonthBuffer();

      const may = parseBuffer(buf, { selectedDate: '2026-05-31' });
      expect(may.source.sheetName).toBe('מאי 26');
      expect(may.rows[0].orderNumber).toBe('SO-1');

      const jun = parseBuffer(buf, { selectedDate: '2026-06-03' });
      expect(jun.source.sheetName).toBe('יוני 26');
      expect(jun.rows[0].orderNumber).toBe('SO-2');

      const jul = parseBuffer(buf, { selectedDate: '2026-07-01' });
      expect(jul.source.sheetName).toBe('יולי 26');
      expect(jul.rows[0].orderNumber).toBe('SO-3');

      const nov = parseBuffer(buf, { selectedDate: '2026-11-19' });
      expect(nov.source.sheetName).toBe('נובמבר 26');
      expect(nov.rows[0].orderNumber).toBe('SO-4');
    });

    it('returns structured missing-sheet error when no matching month sheet exists across multiple sheets', () => {
      const wb = XLSX.utils.book_new();
      const headers = ['תאריך הפצה', 'קו הפצה', 'שם לקוח', 'הזמנה', "מק''ט", 'כמות'];
      // Use non-Hebrew-month sheet names so no fallback matches
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ['14.5.26', 'קו/א', 'ל', 'SO-1', '1001', 2]]), 'Sheet 1');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ['14.6.26', 'קו/ב', 'ל', 'SO-2', '1002', 3]]), 'Sheet 2');
      const buf = Buffer.isBuffer(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
        ? XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        : Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      try {
        parseBuffer(buf, { selectedDate: '2026-11-19' });
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('MISSING_SHEET');
        expect(err.details.expectedSheet).toBe('נובמבר 26');
        expect(err.details.availableSheets).toEqual(['Sheet 1', 'Sheet 2']);
        expect(err.details.selectedDate).toBe('2026-11-19');
      }
    });
  });
});
