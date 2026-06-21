import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────

const finiteNumber = z.number().finite();
const nonNegativeNumber = z.number().finite().min(0);
const nullableString = z.string().nullable().optional().default(null);

// ── Row schema ─────────────────────────────────────────────────────────────

export const bondedSnapshotDraftRowSchema = z.object({
  rowNumber: z.number().int().min(1),

  sourceLabel: z.string().nullable(),
  block: z.string().nullable(),
  sku: z.string().nullable(),
  description: z.string().nullable(),

  releasedQty: finiteNumber,
  packFactor: z.number().nullable(),
  cartonsPerPallet: z.number().nullable(),
  unitsPerPallet: z.number().nullable(),

  pullColumns: z.array(z.number().nullable()),
  totalPulledQty: finiteNumber,
  releasedBalanceQty: finiteNumber,
  availableQty: nonNegativeNumber,

  notes: z.string().nullable(),
  remainingBondedRaw: z.string().nullable(),

  diagnostics: z.array(z.string())
});
export type BondedSnapshotDraftRow = z.infer<typeof bondedSnapshotDraftRowSchema>;

// ── Diagnostics ───────────────────────────────────────────────────────────

export const bondedSnapshotDiagnosticsSchema = z.object({
  totalRows: z.number().int().min(0),
  populatedRows: z.number().int().min(0),
  missingSkuRows: z.number().int().min(0),
  negativeBalanceRows: z.number().int().min(0),
  duplicateSkuGroups: z.number().int().min(0),
  formulaDiscrepancyRows: z.number().int().min(0),
  warnings: z.array(z.string())
});
export type BondedSnapshotDiagnostics = z.infer<typeof bondedSnapshotDiagnosticsSchema>;

// ── Draft snapshot ────────────────────────────────────────────────────────

export const bondedSnapshotDraftSchema = z.object({
  sourceSheetName: z.string(),
  rowCount: z.number().int().min(0),
  rows: z.array(bondedSnapshotDraftRowSchema),
  diagnostics: bondedSnapshotDiagnosticsSchema
});
export type BondedSnapshotDraft = z.infer<typeof bondedSnapshotDraftSchema>;

// ── API-facing candidate DTO (not wired yet) ──────────────────────────────

export const productControlBondedCandidateSchema = z.object({
  block: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  availableQty: nonNegativeNumber,
  releasedQty: finiteNumber,
  totalPulledQty: finiteNumber,
  releasedBalanceQty: finiteNumber,
  packFactor: z.number().nullable(),
  cartonsPerPallet: z.number().nullable(),
  unitsPerPallet: z.number().nullable(),
  notes: z.string().nullable()
});
export type ProductControlBondedCandidate = z.infer<typeof productControlBondedCandidateSchema>;

// ── Aggregate output ──────────────────────────────────────────────────────

export const skuBondedAggregateSchema = z.object({
  sku: z.string(),
  bondedAvailableQty: nonNegativeNumber,
  candidates: z.array(productControlBondedCandidateSchema),
  sourceRowCount: z.number().int().min(1),
  diagnostics: z.array(z.string())
});
export type SkuBondedAggregate = z.infer<typeof skuBondedAggregateSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────

export function computeReleasedBalanceQty(releasedQty: number, totalPulledQty: number): number {
  return releasedQty - totalPulledQty;
}

export function computeAvailableQty(releasedBalanceQty: number): number {
  return Math.max(0, releasedBalanceQty);
}

export function buildBondedSnapshotDraftRow(input: {
  rowNumber: number;
  sourceLabel: string | null;
  block: string | null;
  sku: string | null;
  description: string | null;
  releasedQty: number;
  packFactor: number | null;
  cartonsPerPallet: number | null;
  unitsPerPallet: number | null;
  pullColumns: (number | null)[];
  totalPulledQty: number;
  notes: string | null;
  remainingBondedRaw: string | null;
  rawReleasedBalanceCellValue?: number | null;
}): BondedSnapshotDraftRow {
  const diagnostics: string[] = [];
  const releasedBalanceQty = computeReleasedBalanceQty(input.releasedQty, input.totalPulledQty);
  const availableQty = computeAvailableQty(releasedBalanceQty);

  if (input.sku === null || input.sku.trim() === '') {
    diagnostics.push('missing_sku');
  }

  if (releasedBalanceQty < 0) {
    diagnostics.push('negative_released_balance');
  }

  if (
    input.rawReleasedBalanceCellValue !== undefined &&
    input.rawReleasedBalanceCellValue !== null &&
    isFinite(input.rawReleasedBalanceCellValue) &&
    Math.abs(input.rawReleasedBalanceCellValue - releasedBalanceQty) > 0.001
  ) {
    diagnostics.push(
      `released_balance_mismatch: cached=${input.rawReleasedBalanceCellValue}, computed=${releasedBalanceQty}`
    );
  }

  return {
    rowNumber: input.rowNumber,
    sourceLabel: input.sourceLabel,
    block: input.block,
    sku: input.sku?.trim() || null,
    description: input.description,
    releasedQty: input.releasedQty,
    packFactor: input.packFactor,
    cartonsPerPallet: input.cartonsPerPallet,
    unitsPerPallet: input.unitsPerPallet,
    pullColumns: input.pullColumns,
    totalPulledQty: input.totalPulledQty,
    releasedBalanceQty,
    availableQty,
    notes: input.notes,
    remainingBondedRaw: input.remainingBondedRaw,
    diagnostics
  };
}

export function aggregateBondedAvailabilityBySku(
  rows: readonly BondedSnapshotDraftRow[]
): Map<string, SkuBondedAggregate> {
  const grouped = new Map<string, BondedSnapshotDraftRow[]>();

  for (const row of rows) {
    if (!row.sku) continue;
    const existing = grouped.get(row.sku);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(row.sku, [row]);
    }
  }

  const result = new Map<string, SkuBondedAggregate>();

  for (const [sku, skuRows] of grouped) {
    const bondedAvailableQty = skuRows.reduce((sum, r) => sum + r.availableQty, 0);

    const sorted = [...skuRows].sort((a, b) => {
      const aAvail = a.availableQty > 0 ? 1 : 0;
      const bAvail = b.availableQty > 0 ? 1 : 0;
      if (aAvail !== bAvail) return bAvail - aAvail;
      return a.rowNumber - b.rowNumber;
    });

    const candidates: ProductControlBondedCandidate[] = sorted.map(r => ({
      block: r.block,
      sourceLabel: r.sourceLabel,
      availableQty: r.availableQty,
      releasedQty: r.releasedQty,
      totalPulledQty: r.totalPulledQty,
      releasedBalanceQty: r.releasedBalanceQty,
      packFactor: r.packFactor,
      cartonsPerPallet: r.cartonsPerPallet,
      unitsPerPallet: r.unitsPerPallet,
      notes: r.notes
    }));

    const aggregateDiagnostics: string[] = [];
    const negativeCount = skuRows.filter(r => r.releasedBalanceQty < 0).length;
    if (negativeCount > 0) {
      aggregateDiagnostics.push(`${negativeCount} row(s) with negative released balance`);
    }

    result.set(sku, {
      sku,
      bondedAvailableQty,
      candidates,
      sourceRowCount: skuRows.length,
      diagnostics: aggregateDiagnostics
    });
  }

  return result;
}

export function buildSnapshotDiagnostics(
  rows: readonly BondedSnapshotDraftRow[]
): BondedSnapshotDiagnostics {
  const totalRows = rows.length;
  const populatedRows = rows.filter(r => r.sku !== null).length;
  const missingSkuRows = rows.filter(r => r.sku === null).length;
  const negativeBalanceRows = rows.filter(r => r.releasedBalanceQty < 0).length;

  const skuGroups = new Set(rows.filter(r => r.sku !== null).map(r => r.sku));
  const duplicateSkuGroups = rows.filter(r => r.sku !== null).length - skuGroups.size;
  const nonNullSkuCount = Math.max(rows.filter(r => r.sku !== null).length, 1);

  const formulaDiscrepancyRows = rows.filter(r =>
    r.diagnostics.some(d => d.startsWith('released_balance_mismatch'))
  ).length;

  const warnings: string[] = [];
  if (missingSkuRows > 0) {
    warnings.push(`${missingSkuRows} row(s) have missing SKU`);
  }
  if (negativeBalanceRows > 0) {
    warnings.push(`${negativeBalanceRows} row(s) have negative released balance`);
  }
  if (formulaDiscrepancyRows > 0) {
    warnings.push(`${formulaDiscrepancyRows} row(s) have released balance mismatch`);
  }
  if (duplicateSkuGroups > 0) {
    warnings.push(`${duplicateSkuGroups} SKU(s) have multiple bonded candidates`);
  }

  return {
    totalRows,
    populatedRows,
    missingSkuRows,
    negativeBalanceRows,
    duplicateSkuGroups: Math.max(0, duplicateSkuGroups),
    formulaDiscrepancyRows,
    warnings
  };
}
