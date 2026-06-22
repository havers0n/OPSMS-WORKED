import { z } from 'zod';

// ── Diagnostic codes ──────────────────────────────────────────────────────

export type WarehouseStockSnapshotDiagnosticCode =
  | 'missing_sheet'
  | 'missing_required_header'
  | 'missing_sku'
  | 'missing_warehouse_qty'
  | 'negative_stock'
  | 'duplicate_sku_rows'
  | 'conflicting_warehouse_qty_values'
  | 'conflicting_description'
  | 'conflicting_category';

// ── Diagnostic entry ──────────────────────────────────────────────────────

export type WarehouseStockDiagnosticEntry = {
  code: WarehouseStockSnapshotDiagnosticCode;
  message: string;
  rowNumber?: number;
  sku?: string;
};

// ── Source row (one per Excel row, pre-aggregation) ──────────────────────

export type WarehouseStockSourceRow = {
  rowNumber: number;
  sku: string | null;
  description: string | null;
  category: string | null;
  warehouseQtyRaw: number | null;
  sourceDemandQty: number | null;
};

// ── Aggregated row (one per SKU) ──────────────────────────────────────────

export type WarehouseStockSnapshotRow = {
  sku: string;
  description: string | null;
  category: string | null;
  warehouseQtyRaw: number;
  availableQty: number;
  sourceDemandQty: number | null;
  sourceRowCount: number;
  diagnostics: WarehouseStockSnapshotDiagnosticCode[];
};

// ── Preview ────────────────────────────────────────────────────────────────

export type WarehouseStockSnapshotPreview = {
  sourceSheetName: 'מלאי';
  rowCount: number;
  populatedSkuCount: number;
  uniqueSkuCount: number;
  duplicateSkuRowsCount: number;
  missingSkuRowsCount: number;
  negativeStockRowsCount: number;
  conflictingStockSkuCount: number;
  diagnostics: WarehouseStockDiagnosticEntry[];
  rows: WarehouseStockSnapshotRow[];
};

// ── Zod schemas for runtime validation ─────────────────────────────────────

const diagnosticCodeSchema = z.string();

export const warehouseStockSnapshotRowSchema = z.object({
  sku: z.string().min(1),
  description: z.string().nullable(),
  category: z.string().nullable(),
  warehouseQtyRaw: z.number().finite(),
  availableQty: z.number().finite().min(0),
  sourceDemandQty: z.number().nullable(),
  sourceRowCount: z.number().int().min(1),
  diagnostics: z.array(diagnosticCodeSchema)
});
export type WarehouseStockSnapshotRowParsed = z.infer<typeof warehouseStockSnapshotRowSchema>;

export const warehouseStockSnapshotPreviewSchema = z.object({
  sourceSheetName: z.literal('מלאי'),
  rowCount: z.number().int().min(0),
  populatedSkuCount: z.number().int().min(0),
  uniqueSkuCount: z.number().int().min(0),
  duplicateSkuRowsCount: z.number().int().min(0),
  missingSkuRowsCount: z.number().int().min(0),
  negativeStockRowsCount: z.number().int().min(0),
  conflictingStockSkuCount: z.number().int().min(0),
  diagnostics: z.array(z.object({
    code: diagnosticCodeSchema,
    message: z.string(),
    rowNumber: z.number().int().optional(),
    sku: z.string().optional()
  })),
  rows: z.array(warehouseStockSnapshotRowSchema)
});
export type WarehouseStockSnapshotPreviewParsed = z.infer<typeof warehouseStockSnapshotPreviewSchema>;

// ── Helpers ────────────────────────────────────────────────────────────────

export function computeStockAvailableQty(warehouseQtyRaw: number): number {
  return Math.max(0, warehouseQtyRaw);
}

export function buildWarehouseStockPreview(
  sourceRows: WarehouseStockSourceRow[]
): WarehouseStockSnapshotPreview {
  const diagnostics: WarehouseStockDiagnosticEntry[] = [];

  // Filter out rows with missing/empty SKU
  const populatedRows = sourceRows.filter(r => r.sku !== null && r.sku.trim().length > 0);
  const missingSkuRowsCount = sourceRows.length - populatedRows.length;

  // Report missing SKU diagnostics for source rows
  for (const row of sourceRows) {
    if (row.sku === null || row.sku.trim().length === 0) {
      diagnostics.push({
        code: 'missing_sku',
        message: `Row ${row.rowNumber} has missing or empty SKU.`,
        rowNumber: row.rowNumber
      });
    }
    if (row.warehouseQtyRaw === null) {
      diagnostics.push({
        code: 'missing_warehouse_qty',
        message: `Row ${row.rowNumber} has missing warehouse quantity.`,
        rowNumber: row.rowNumber,
        sku: row.sku ?? undefined
      });
    }
  }

  // Group by SKU (trimmed)
  const grouped = new Map<string, WarehouseStockSourceRow[]>();
  for (const row of populatedRows) {
    const sku = row.sku!.trim();
    const existing = grouped.get(sku);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(sku, [row]);
    }
  }

  let duplicateSkuRowsCount = 0;
  let negativeStockRowsCount = 0;
  let conflictingStockSkuCount = 0;

  const rows: WarehouseStockSnapshotRow[] = [];

  for (const [sku, skuRows] of grouped) {
    const rowDiagnostics: WarehouseStockSnapshotDiagnosticCode[] = [];

    // Description — first non-null, detect conflict
    const descriptions = skuRows.map(r => r.description).filter((d): d is string => d !== null && d.trim().length > 0);
    const uniqueDescriptions = [...new Set(descriptions.map(d => d.trim()))];
    const description = uniqueDescriptions.length > 0 ? uniqueDescriptions[0] : null;
    if (uniqueDescriptions.length > 1) {
      rowDiagnostics.push('conflicting_description');
    }

    // Category — first non-null, detect conflict
    const categories = skuRows.map(r => r.category).filter((c): c is string => c !== null && c.trim().length > 0);
    const uniqueCategories = [...new Set(categories.map(c => c.trim()))];
    const category = uniqueCategories.length > 0 ? uniqueCategories[0] : null;
    if (uniqueCategories.length > 1) {
      rowDiagnostics.push('conflicting_category');
    }

    // Warehouse qty — unique values
    const qtyValues = skuRows
      .map(r => r.warehouseQtyRaw)
      .filter((q): q is number => q !== null && isFinite(q));

    const uniqueQtyValues = [...new Set(qtyValues)];
    let warehouseQtyRaw: number;

    if (uniqueQtyValues.length === 0) {
      warehouseQtyRaw = 0;
      rowDiagnostics.push('missing_warehouse_qty');
    } else if (uniqueQtyValues.length > 1) {
      warehouseQtyRaw = uniqueQtyValues[0];
      rowDiagnostics.push('conflicting_warehouse_qty_values');
      conflictingStockSkuCount++;
    } else {
      warehouseQtyRaw = uniqueQtyValues[0];
    }

    // Source demand — sum debug context only
    const sourceDemandQty = skuRows
      .map(r => r.sourceDemandQty)
      .filter((d): d is number => d !== null && isFinite(d))
      .reduce((sum, d) => sum + d, 0);

    // Available qty
    const availableQty = computeStockAvailableQty(warehouseQtyRaw);
    if (warehouseQtyRaw < 0) {
      rowDiagnostics.push('negative_stock');
      negativeStockRowsCount++;
    }

    // Duplicate tracking
    if (skuRows.length > 1) {
      rowDiagnostics.push('duplicate_sku_rows');
      duplicateSkuRowsCount++;
    }

    // Report conflicting stock diagnostic at preview level
    if (uniqueQtyValues.length > 1) {
      const uniqueValsStr = uniqueQtyValues.join(', ');
      diagnostics.push({
        code: 'conflicting_warehouse_qty_values',
        message: `SKU "${sku}" has conflicting warehouse qty values: ${uniqueValsStr}. Using first: ${warehouseQtyRaw}.`,
        sku
      });
    }

    rows.push({
      sku,
      description,
      category,
      warehouseQtyRaw,
      availableQty,
      sourceDemandQty: sourceDemandQty > 0 ? sourceDemandQty : null,
      sourceRowCount: skuRows.length,
      diagnostics: rowDiagnostics
    });
  }

  // Deduplicate duplicate_sku_rows diagnostic per SKU (we count SKUs, not rows)
  const skusWithDuplicates = new Set<string>();
  for (const [sku, skuRows] of grouped) {
    if (skuRows.length > 1) {
      skusWithDuplicates.add(sku);
    }
  }

  return {
    sourceSheetName: 'מלאי',
    rowCount: sourceRows.length,
    populatedSkuCount: populatedRows.length,
    uniqueSkuCount: grouped.size,
    duplicateSkuRowsCount: duplicateSkuRowsCount, // number of SKUs with duplicate rows
    missingSkuRowsCount,
    negativeStockRowsCount,
    conflictingStockSkuCount,
    diagnostics,
    rows
  };
}
