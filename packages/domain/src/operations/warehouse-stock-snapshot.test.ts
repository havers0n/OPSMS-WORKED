import { describe, expect, it } from 'vitest';
import {
  buildWarehouseStockPreview,
  computeStockAvailableQty,
  type WarehouseStockSourceRow,
  type WarehouseStockSnapshotRow
} from './warehouse-stock-snapshot';

function sourceRow(overrides: Partial<WarehouseStockSourceRow> = {}): WarehouseStockSourceRow {
  return {
    rowNumber: 1,
    sku: 'SKU001',
    description: 'Test product',
    category: 'Cat A',
    warehouseQtyRaw: 100,
    sourceDemandQty: 50,
    ...overrides
  };
}

function expectValidRow(row: WarehouseStockSnapshotRow) {
  expect(row.sku).toBeTruthy();
  expect(row.availableQty).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(row.warehouseQtyRaw)).toBe(true);
  expect(row.sourceRowCount).toBeGreaterThanOrEqual(1);
}

// ── computeAvailableQty ────────────────────────────────────────────────────

describe('computeStockAvailableQty', () => {
  it('returns positive value as-is', () => {
    expect(computeStockAvailableQty(100)).toBe(100);
  });

  it('returns 0 for negative', () => {
    expect(computeStockAvailableQty(-10)).toBe(0);
  });

  it('returns 0 for zero', () => {
    expect(computeStockAvailableQty(0)).toBe(0);
  });
});

// ── buildWarehouseStockPreview ─────────────────────────────────────────────

describe('buildWarehouseStockPreview', () => {
  it('parses valid source rows into preview', () => {
    const rows = [
      sourceRow({ sku: 'SKU001', warehouseQtyRaw: 100 }),
      sourceRow({ rowNumber: 2, sku: 'SKU002', warehouseQtyRaw: 200 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.sourceSheetName).toBe('מלאי');
    expect(preview.rowCount).toBe(2);
    expect(preview.populatedSkuCount).toBe(2);
    expect(preview.uniqueSkuCount).toBe(2);
    expect(preview.rows).toHaveLength(2);
    expectValidRow(preview.rows[0]);
    expectValidRow(preview.rows[1]);
  });

  it('duplicate SKU rows do NOT sum warehouse stock', () => {
    const rows = [
      sourceRow({ sku: 'SKU001', warehouseQtyRaw: 100, sourceDemandQty: 10 }),
      sourceRow({ rowNumber: 2, sku: 'SKU001', warehouseQtyRaw: 100, sourceDemandQty: 20 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.uniqueSkuCount).toBe(1);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].sku).toBe('SKU001');
    // Stock should not be summed — should be unique value 100
    expect(preview.rows[0].warehouseQtyRaw).toBe(100);
    expect(preview.rows[0].sourceRowCount).toBe(2);
    // Source demand IS summed (debug only)
    expect(preview.rows[0].sourceDemandQty).toBe(30);
  });

  it('repeated same stock value per SKU is accepted without diagnostic', () => {
    const rows = [
      sourceRow({ sku: 'SKU001', warehouseQtyRaw: 100 }),
      sourceRow({ rowNumber: 2, sku: 'SKU001', warehouseQtyRaw: 100 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].warehouseQtyRaw).toBe(100);
    expect(preview.rows[0].diagnostics).not.toContain('conflicting_warehouse_qty_values');
  });

  it('conflicting stock values produce diagnostic', () => {
    const rows = [
      sourceRow({ sku: 'SKU001', warehouseQtyRaw: 100 }),
      sourceRow({ rowNumber: 2, sku: 'SKU001', warehouseQtyRaw: 200 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].warehouseQtyRaw).toBe(100); // first value
    expect(preview.rows[0].diagnostics).toContain('conflicting_warehouse_qty_values');
    expect(preview.conflictingStockSkuCount).toBe(1);
    expect(preview.diagnostics.some(d => d.code === 'conflicting_warehouse_qty_values')).toBe(true);
  });

  it('negative stock becomes availableQty = 0 and diagnostic', () => {
    const rows = [
      sourceRow({ sku: 'NEG001', warehouseQtyRaw: -50 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].warehouseQtyRaw).toBe(-50);
    expect(preview.rows[0].availableQty).toBe(0);
    expect(preview.rows[0].diagnostics).toContain('negative_stock');
    expect(preview.negativeStockRowsCount).toBe(1);
  });

  it('missing SKU rows excluded from aggregate', () => {
    const rows = [
      sourceRow({ sku: null }),
      sourceRow({ sku: 'SKU001', warehouseQtyRaw: 100 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.uniqueSkuCount).toBe(1);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].sku).toBe('SKU001');
    expect(preview.missingSkuRowsCount).toBe(1);
    expect(preview.diagnostics.some(d => d.code === 'missing_sku')).toBe(true);
  });

  it('empty SKU string treated as missing', () => {
    const rows = [
      sourceRow({ sku: '  ' }),
      sourceRow({ sku: 'SKU001', warehouseQtyRaw: 100 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.uniqueSkuCount).toBe(1);
    expect(preview.rows).toHaveLength(1);
    expect(preview.missingSkuRowsCount).toBe(1);
  });

  it('source demand is debug-only sum', () => {
    const rows = [
      sourceRow({ sku: 'SKU001', sourceDemandQty: 10 }),
      sourceRow({ rowNumber: 2, sku: 'SKU001', sourceDemandQty: 20 }),
      sourceRow({ rowNumber: 3, sku: 'SKU002', sourceDemandQty: 30 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.rows.find(r => r.sku === 'SKU001')!.sourceDemandQty).toBe(30);
    expect(preview.rows.find(r => r.sku === 'SKU002')!.sourceDemandQty).toBe(30);
  });

  it('missing warehouse qty produces diagnostic and uses 0', () => {
    const rows = [
      sourceRow({ sku: 'SKU001', warehouseQtyRaw: null })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].warehouseQtyRaw).toBe(0);
    expect(preview.rows[0].availableQty).toBe(0);
    expect(preview.rows[0].diagnostics).toContain('missing_warehouse_qty');
    expect(preview.diagnostics.some(d => d.code === 'missing_warehouse_qty')).toBe(true);
  });

  it('conflicting descriptions produce diagnostic', () => {
    const rows = [
      sourceRow({ sku: 'SKU001', description: 'Product A' }),
      sourceRow({ rowNumber: 2, sku: 'SKU001', description: 'Product B' })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.rows[0].description).toBe('Product A');
    expect(preview.rows[0].diagnostics).toContain('conflicting_description');
  });

  it('conflicting categories produce diagnostic', () => {
    const rows = [
      sourceRow({ sku: 'SKU001', category: 'Cat A' }),
      sourceRow({ rowNumber: 2, sku: 'SKU001', category: 'Cat B' })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.rows[0].category).toBe('Cat A');
    expect(preview.rows[0].diagnostics).toContain('conflicting_category');
  });

  it('empty source rows returns empty preview', () => {
    const preview = buildWarehouseStockPreview([]);

    expect(preview.rowCount).toBe(0);
    expect(preview.populatedSkuCount).toBe(0);
    expect(preview.uniqueSkuCount).toBe(0);
    expect(preview.rows).toHaveLength(0);
    expect(preview.diagnostics).toHaveLength(0);
  });

  it('SKU trimming works', () => {
    const rows = [
      sourceRow({ sku: '  SKU001  ', warehouseQtyRaw: 100 }),
      sourceRow({ rowNumber: 2, sku: 'SKU001', warehouseQtyRaw: 200 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.uniqueSkuCount).toBe(1);
    expect(preview.rows[0].sku).toBe('SKU001');
    // Conflicting because trimmed values differ (100 vs 200)
    expect(preview.rows[0].diagnostics).toContain('conflicting_warehouse_qty_values');
  });

  it('handles mixture of valid and invalid rows', () => {
    const rows = [
      sourceRow({ rowNumber: 1, sku: null, warehouseQtyRaw: 50 }),
      sourceRow({ rowNumber: 2, sku: 'VALID', warehouseQtyRaw: 100 }),
      sourceRow({ rowNumber: 3, sku: 'VALID', warehouseQtyRaw: -10 }),
      sourceRow({ rowNumber: 4, sku: 'GOOD', warehouseQtyRaw: 200 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.rowCount).toBe(4);
    expect(preview.missingSkuRowsCount).toBe(1);
    expect(preview.uniqueSkuCount).toBe(2);
    // VALID has conflicting values (100, -10); chosen first value 100 is not negative
    expect(preview.negativeStockRowsCount).toBe(0);

    const validRow = preview.rows.find(r => r.sku === 'VALID')!;
    expect(validRow.warehouseQtyRaw).toBe(100);
    expect(validRow.availableQty).toBe(100);
    expect(validRow.sourceRowCount).toBe(2);
  });

  it('negative stock count is correct across multiple SKUs', () => {
    const rows = [
      sourceRow({ sku: 'NEG1', warehouseQtyRaw: -10 }),
      sourceRow({ rowNumber: 2, sku: 'NEG2', warehouseQtyRaw: -20 }),
      sourceRow({ rowNumber: 3, sku: 'POS', warehouseQtyRaw: 30 })
    ];
    const preview = buildWarehouseStockPreview(rows);

    expect(preview.negativeStockRowsCount).toBe(2);
    expect(preview.rows.filter(r => r.diagnostics.includes('negative_stock'))).toHaveLength(2);
  });
});
