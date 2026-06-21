import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { aggregateBondedAvailabilityBySku } from '@wos/domain';
import { parseBondedWorkbook } from './bonded-excel-parser.js';

// ── Workbook builder helpers ──────────────────────────────────────────────

function buildWorkbookBuffer(
  rows: unknown[][],
  sheetName = 'בונדד!'
): Buffer {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

function defaultHeaders(): string[] {
  return [
    'עמודה7', 'גוש', 'פריט', 'תיאור חדש', 'כמות משוחררת',
    'גורם אירוז', 'כמות קרטונים במשטח', "יח' במשטח",
    'עמודה1', 'עמודה2', 'עמודה3', 'עמודה4', 'עמודה5', 'עמודה6',
    'משיכה7', 'משיכה8', 'משיכה9',
    'סה"כ נמשך', 'יתרה משוחררת', 'הערות', 'נותר בונדד'
  ];
}

function defaultRow(overrides: Record<string, unknown> = {}): unknown[] {
  const cols: Record<string, unknown> = {
    'עמודה7': 'נעמן',
    'גוש': '7488/23',
    'פריט': '477318',
    'תיאור חדש': 'Product A',
    'כמות משוחררת': 200,
    'גורם אירוז': 20,
    'כמות קרטונים במשטח': 20,
    "יח' במשטח": 400,
    'עמודה1': 20,
    'עמודה2': 20,
    'עמודה3': 40,
    'עמודה4': 40,
    'עמודה5': 20,
    'עמודה6': null,
    'משיכה7': null,
    'משיכה8': null,
    'משיכה9': null,
    'סה"כ נמשך': 140,
    'יתרה משוחררת': 60,
    'הערות': null,
    'נותר בונדד': null,
    ...overrides
  };
  return defaultHeaders().map(h => cols[h]);
}

function parseBuffer(buffer: Buffer, fileName = 'bonded.xlsx') {
  return parseBondedWorkbook({ fileName, buffer });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('parseBondedWorkbook', () => {
  it('parses workbook with בונדד! sheet', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'פריט': '100001', 'כמות משוחררת': 100, 'סה"כ נמשך': 40, 'יתרה משוחררת': 60 }),
      defaultRow({ 'פריט': '100002', 'כמות משוחררת': 200, 'סה"כ נמשך': 100, 'יתרה משוחררת': 100 })
    ]);
    const result = parseBuffer(buffer);

    expect(result.sourceSheetName).toBe('בונדד!');
    expect(result.rowCount).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].sku).toBe('100001');
    expect(result.rows[1].sku).toBe('100002');
  });

  it('rejects workbook missing בונדד! sheet', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    expect(() => parseBuffer(buffer)).toThrowError(
      expect.objectContaining({ code: 'MISSING_SHEET' })
    );
  });

  it('ignores PIVOT! sheet but detects its presence', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'PIVOT!');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      defaultHeaders(),
      defaultRow({ 'פריט': '100001', 'כמות משוחררת': 100, 'סה"כ נמשך': 50, 'יתרה משוחררת': 50 })
    ]), 'בונדד!');
    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    const result = parseBuffer(buffer);
    expect(result.sourceSheetName).toBe('בונדד!');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sku).toBe('100001');
  });

  it('maps all Hebrew headers correctly', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({
        'עמודה7': 'Source A',
        'גוש': '100/1',
        'פריט': '500001',
        'תיאור חדש': 'Test Product',
        'כמות משוחררת': 150,
        'גורם אירוז': 10,
        'כמות קרטונים במשטח': 30,
        "יח' במשטח": 300,
        'עמודה1': 10,
        'עמודה2': 20,
        'עמודה3': 30,
        'עמודה4': 40,
        'עמודה5': 50,
        'עמודה6': 60,
        'משיכה7': 70,
        'משיכה8': 80,
        'משיכה9': 90,
        'סה"כ נמשך': 450,
        'יתרה משוחררת': -300,
        'הערות': 'Some note',
        'נותר בונדד': '1 test'
      })
    ]);
    const result = parseBuffer(buffer);
    const row = result.rows[0];

    expect(row.sourceLabel).toBe('Source A');
    expect(row.block).toBe('100/1');
    expect(row.sku).toBe('500001');
    expect(row.description).toBe('Test Product');
    expect(row.releasedQty).toBe(150);
    expect(row.packFactor).toBe(10);
    expect(row.cartonsPerPallet).toBe(30);
    expect(row.unitsPerPallet).toBe(300);
    expect(row.pullColumns).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect(row.totalPulledQty).toBe(450);
    expect(row.notes).toBe('Some note');
    expect(row.remainingBondedRaw).toBe('1 test');
  });

  it('computes releasedBalanceQty = releasedQty - totalPulledQty', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'כמות משוחררת': 200, 'סה"כ נמשך': 150, 'יתרה משוחררת': 999 })
    ]);
    const result = parseBuffer(buffer);
    expect(result.rows[0].releasedBalanceQty).toBe(50);
    expect(result.rows[0].availableQty).toBe(50);
  });

  it('adds released_balance_mismatch diagnostic when cached value differs from computed', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'כמות משוחררת': 200, 'סה"כ נמשך': 150, 'יתרה משוחררת': 30 })
    ]);
    const result = parseBuffer(buffer);
    expect(result.rows[0].releasedBalanceQty).toBe(50);
    expect(result.rows[0].availableQty).toBe(50);
    expect(result.rows[0].diagnostics).toContainEqual(
      expect.stringMatching(/released_balance_mismatch/)
    );
  });

  it('parses duplicate SKU blocks as separate rows', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'גוש': 'A/1', 'פריט': '100001', 'כמות משוחררת': 100, 'סה"כ נמשך': 50, 'יתרה משוחררת': 50 }),
      defaultRow({ 'גוש': 'B/2', 'פריט': '100001', 'כמות משוחררת': 200, 'סה"כ נמשך': 100, 'יתרה משוחררת': 100 }),
      defaultRow({ 'גוש': 'C/3', 'פריט': '100002', 'כמות משוחררת': 300, 'סה"כ נמשך': 150, 'יתרה משוחררת': 150 })
    ]);
    const result = parseBuffer(buffer);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].sku).toBe('100001');
    expect(result.rows[0].block).toBe('A/1');
    expect(result.rows[1].sku).toBe('100001');
    expect(result.rows[1].block).toBe('B/2');
    expect(result.rows[2].sku).toBe('100002');
    expect(result.rows[2].block).toBe('C/3');
  });

  it('parses negative released balance with diagnostic', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'כמות משוחררת': 50, 'סה"כ נמשך': 100, 'יתרה משוחררת': -50 })
    ]);
    const result = parseBuffer(buffer);
    const row = result.rows[0];
    expect(row.releasedBalanceQty).toBe(-50);
    expect(row.availableQty).toBe(0);
    expect(row.diagnostics).toContain('negative_released_balance');
  });

  it('parses missing SKU row with diagnostic', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'פריט': null, 'גוש': 'BLOCK/1', 'כמות משוחררת': 100, 'סה"כ נמשך': 50, 'יתרה משוחררת': 50 })
    ]);
    const result = parseBuffer(buffer);
    const row = result.rows[0];
    expect(row.sku).toBeNull();
    expect(row.diagnostics).toContain('missing_sku');
  });

  it('preserves נותר בונדד as raw text', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'נותר בונדד': '1 spare parts' }),
      defaultRow({ 'נותר בונדד': null }),
      defaultRow({ 'נותר בונדד': '1 example' })
    ]);
    const result = parseBuffer(buffer);
    expect(result.rows[0].remainingBondedRaw).toBe('1 spare parts');
    expect(result.rows[1].remainingBondedRaw).toBeNull();
    expect(result.rows[2].remainingBondedRaw).toBe('1 example');
  });

  it('skips completely empty rows', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'פריט': '100001' }),
      Array(21).fill(null),
      defaultRow({ 'פריט': '100002' })
    ]);
    const result = parseBuffer(buffer);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].sku).toBe('100001');
    expect(result.rows[1].sku).toBe('100002');
  });

  it('rejects invalid workbook buffer', () => {
    const buffer = Buffer.from('not-an-xlsx');
    expect(() => parseBuffer(buffer)).toThrowError(
      expect.objectContaining({ code: 'INVALID_WORKBOOK' })
    );
  });
});

// ── Aggregate helper integration tests ────────────────────────────────────

describe('aggregateBondedAvailabilityBySku (from parser output)', () => {
  it('aggregates parsed rows correctly', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'גוש': 'A/1', 'פריט': 'S001', 'כמות משוחררת': 100, 'סה"כ נמשך': 30, 'יתרה משוחררת': 70 }),
      defaultRow({ 'גוש': 'B/2', 'פריט': 'S001', 'כמות משוחררת': 200, 'סה"כ נמשך': 100, 'יתרה משוחררת': 100 }),
      defaultRow({ 'גוש': 'C/3', 'פריט': 'S002', 'כמות משוחררת': 50, 'סה"כ נמשך': 20, 'יתרה משוחררת': 30 })
    ]);
    const parsed = parseBuffer(buffer);
    const aggregated = aggregateBondedAvailabilityBySku(parsed.rows);

    expect(aggregated.size).toBe(2);
    expect(aggregated.get('S001')!.bondedAvailableQty).toBe(170);
    expect(aggregated.get('S001')!.candidates).toHaveLength(2);
    expect(aggregated.get('S002')!.bondedAvailableQty).toBe(30);
    expect(aggregated.get('S002')!.candidates).toHaveLength(1);
  });

  it('excludes rows with null SKU from aggregate', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'פריט': null, 'גוש': 'X/1', 'כמות משוחררת': 100, 'סה"כ נמשך': 50, 'יתרה משוחררת': 50 }),
      defaultRow({ 'פריט': 'S001', 'גוש': 'X/2', 'כמות משוחררת': 100, 'סה"כ נמשך': 50, 'יתרה משוחררת': 50 })
    ]);
    const parsed = parseBuffer(buffer);
    const aggregated = aggregateBondedAvailabilityBySku(parsed.rows);

    expect(aggregated.size).toBe(1);
    expect(aggregated.get('S001')!.bondedAvailableQty).toBe(50);
  });

  it('handles negative balance rows in aggregate', () => {
    const buffer = buildWorkbookBuffer([
      defaultHeaders(),
      defaultRow({ 'גוש': 'NEG/1', 'פריט': 'S001', 'כמות משוחררת': 30, 'סה"כ נמשך': 100, 'יתרה משוחררת': -70 }),
      defaultRow({ 'גוש': 'POS/2', 'פריט': 'S001', 'כמות משוחררת': 200, 'סה"כ נמשך': 50, 'יתרה משוחררת': 150 })
    ]);
    const parsed = parseBuffer(buffer);
    const aggregated = aggregateBondedAvailabilityBySku(parsed.rows);

    expect(aggregated.get('S001')!.bondedAvailableQty).toBe(150);
    expect(aggregated.get('S001')!.candidates).toHaveLength(2);
  });
});
