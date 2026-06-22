import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWarehouseStockWorkbook } from './warehouse-stock-excel-parser.js';

// ── Workbook builder helpers ──────────────────────────────────────────────

function buildWorkbookBuffer(
  rows: unknown[][],
  sheetName = 'מלאי'
): Buffer {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

const HEADERS = ['מספר פריט', 'תאור פריט', 'קטגוריית מגוון', 'כמות בהזמנה', 'כמות במחסן'];

function defaultRow(overrides: Record<string, unknown> = {}): unknown[] {
  const cols: Record<string, unknown> = {
    'מספר פריט': 'SKU001',
    'תאור פריט': 'Test Product',
    'קטגוריית מגוון': 'Cat A',
    'כמות בהזמנה': 50,
    'כמות במחסן': 100,
    ...overrides
  };
  return HEADERS.map(h => cols[h]);
}

function parseBuffer(buffer: Buffer, fileName = 'warehouse-stock.xlsx') {
  return parseWarehouseStockWorkbook({ fileName, buffer });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('parseWarehouseStockWorkbook', () => {
  it('parses workbook with מלאי sheet', () => {
    const buffer = buildWorkbookBuffer([
      HEADERS,
      defaultRow({ 'מספר פריט': 'SKU001', 'כמות במחסן': 100 }),
      defaultRow({ 'מספר פריט': 'SKU002', 'כמות במחסן': 200 })
    ]);
    const result = parseBuffer(buffer);

    expect(result.preview.sourceSheetName).toBe('מלאי');
    expect(result.preview.rowCount).toBe(2);
    expect(result.preview.uniqueSkuCount).toBe(2);
    expect(result.preview.rows).toHaveLength(2);
    expect(result.preview.rows[0].sku).toBe('SKU001');
    expect(result.preview.rows[1].sku).toBe('SKU002');
    expect(result.fileName).toBe('warehouse-stock.xlsx');
  });

  it('rejects workbook missing מלאי sheet', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'PIVOT!');
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
      HEADERS,
      defaultRow({ 'מספר פריט': 'SKU001', 'כמות במחסן': 100 })
    ]), 'מלאי');
    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    const result = parseBuffer(buffer);
    expect(result.pivotSheetFound).toBe(true);
    expect(result.preview.sourceSheetName).toBe('מלאי');
    expect(result.preview.rows).toHaveLength(1);
    expect(result.preview.rows[0].sku).toBe('SKU001');
  });

  it('does not parse בונדד! sheet', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['פריט', 'כמות משוחררת']
    ]), 'בונדד!');
    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    expect(() => parseBuffer(buffer)).toThrowError(
      expect.objectContaining({ code: 'MISSING_SHEET' })
    );
  });

  it('rejects workbook missing required headers', () => {
    const buffer = buildWorkbookBuffer([
      ['מספר פריט', 'תאור פריט'],
      ['SKU001', 'Test']
    ]);
    expect(() => parseBuffer(buffer)).toThrowError(
      expect.objectContaining({ code: 'MISSING_REQUIRED_HEADER' })
    );
  });

  it('maps all Hebrew headers correctly', () => {
    const buffer = buildWorkbookBuffer([
      HEADERS,
      defaultRow({
        'מספר פריט': 'SKU001',
        'תאור פריט': 'Product A',
        'קטגוריית מגוון': 'Category X',
        'כמות בהזמנה': 30,
        'כמות במחסן': 150
      })
    ]);
    const result = parseBuffer(buffer);
    const row = result.preview.rows[0];

    expect(row.sku).toBe('SKU001');
    expect(row.description).toBe('Product A');
    expect(row.category).toBe('Category X');
    expect(row.sourceDemandQty).toBe(30);
    expect(row.warehouseQtyRaw).toBe(150);
  });

  it('handles null optional fields gracefully', () => {
    const buffer = buildWorkbookBuffer([
      HEADERS,
      defaultRow({
        'מספר פריט': 'SKU001',
        'תאור פריט': null,
        'קטגוריית מגוון': null,
        'כמות בהזמנה': null,
        'כמות במחסן': 100
      })
    ]);
    const result = parseBuffer(buffer);
    const row = result.preview.rows[0];

    expect(row.sku).toBe('SKU001');
    expect(row.description).toBeNull();
    expect(row.category).toBeNull();
    expect(row.sourceDemandQty).toBeNull();
  });

  it('skips completely empty rows', () => {
    const buffer = buildWorkbookBuffer([
      HEADERS,
      defaultRow({ 'מספר פריט': 'SKU001' }),
      [null, null, null, null, null],
      defaultRow({ 'מספר פריט': 'SKU002' })
    ]);
    const result = parseBuffer(buffer);

    expect(result.preview.rowCount).toBe(2);
    expect(result.preview.rows).toHaveLength(2);
    expect(result.preview.rows[0].sku).toBe('SKU001');
    expect(result.preview.rows[1].sku).toBe('SKU002');
  });

  it('aggregates duplicate SKU rows into one row', () => {
    const buffer = buildWorkbookBuffer([
      HEADERS,
      defaultRow({ 'מספר פריט': 'SKU001', 'כמות במחסן': 100 }),
      defaultRow({ 'מספר פריט': 'SKU001', 'כמות במחסן': 100 })
    ]);
    const result = parseBuffer(buffer);

    expect(result.preview.uniqueSkuCount).toBe(1);
    expect(result.preview.rows).toHaveLength(1);
    expect(result.preview.rows[0].warehouseQtyRaw).toBe(100);
    expect(result.preview.rows[0].sourceRowCount).toBe(2);
  });

  it('detects conflicting stock values across duplicate SKU rows', () => {
    const buffer = buildWorkbookBuffer([
      HEADERS,
      defaultRow({ 'מספר פריט': 'SKU001', 'כמות במחסן': 100 }),
      defaultRow({ 'מספר פריט': 'SKU001', 'כמות במחסן': 200 })
    ]);
    const result = parseBuffer(buffer);

    expect(result.preview.uniqueSkuCount).toBe(1);
    expect(result.preview.rows[0].diagnostics).toContain('conflicting_warehouse_qty_values');
    expect(result.preview.conflictingStockSkuCount).toBe(1);
  });

  it('negative stock becomes availableQty = 0', () => {
    const buffer = buildWorkbookBuffer([
      HEADERS,
      defaultRow({ 'מספר פריט': 'NEG001', 'כמות במחסן': -50 })
    ]);
    const result = parseBuffer(buffer);
    const row = result.preview.rows[0];

    expect(row.warehouseQtyRaw).toBe(-50);
    expect(row.availableQty).toBe(0);
    expect(row.diagnostics).toContain('negative_stock');
  });

  it('missing SKU rows excluded from aggregate', () => {
    const buffer = buildWorkbookBuffer([
      HEADERS,
      [null, 'No SKU', 'Cat', 10, 50],
      defaultRow({ 'מספר פריט': 'SKU001', 'כמות במחסן': 100 })
    ]);
    const result = parseBuffer(buffer);

    expect(result.preview.uniqueSkuCount).toBe(1);
    expect(result.preview.rows).toHaveLength(1);
    expect(result.preview.rows[0].sku).toBe('SKU001');
    expect(result.preview.missingSkuRowsCount).toBe(1);
  });

  it('rejects invalid buffer', () => {
    const buffer = Buffer.from('not-an-xlsx');
    expect(() => parseBuffer(buffer)).toThrowError(
      expect.objectContaining({ code: 'INVALID_WORKBOOK' })
    );
  });

  it('handles sheet with only headers (no data rows)', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS]), 'מלאי');
    const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out);

    const result = parseBuffer(buffer);
    expect(result.preview.rowCount).toBe(0);
    expect(result.preview.rows).toHaveLength(0);
    expect(result.preview.uniqueSkuCount).toBe(0);
  });
});
