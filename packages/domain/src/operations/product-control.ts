import { z } from 'zod';
import {
  productControlBondedCandidateSchema,
  type ProductControlBondedCandidate
} from './bonded-snapshot.js';

export const productControlStatusSchema = z.enum([
  'ok',
  'covered_by_bonded',
  'partial_bonded',
  'unresolved',
  'data_issue'
]);
export type ProductControlStatus = z.infer<typeof productControlStatusSchema>;

export const productControlStatusLabels: Record<ProductControlStatus, string> = {
  ok: 'תקין',
  covered_by_bonded: 'כיסוי מלא',
  partial_bonded: 'כיסוי חלקי',
  unresolved: 'ללא כיסוי',
  data_issue: 'בעיית נתונים'
};

const nonNegativeNumber = z.number().finite().min(0);
const nonNegativeInt = z.number().int().finite().min(0);

export const productControlWorkLineSchema = z.object({
  name: z.string(),
  units: nonNegativeNumber,
  blockedOrders: nonNegativeInt
});
export type ProductControlWorkLine = z.infer<typeof productControlWorkLineSchema>;

export const productControlDataIssueSchema = z.enum([
  'unknown_sku',
  'duplicate_canonical_sku',
  'missing_warehouse_stock_snapshot_sku'
]);
export type ProductControlDataIssue = z.infer<typeof productControlDataIssueSchema>;

export const productControlRowSchema = z.object({
  sku: z.string(),
  description: z.string(),
  category: z.string(),
  demandQty: nonNegativeNumber,
  warehouseQty: nonNegativeNumber,
  shortageQty: nonNegativeNumber,
  bondedAvailableQty: nonNegativeNumber,
  bondedCoverQty: nonNegativeNumber,
  finalMissingQty: nonNegativeNumber,
  surplusQty: nonNegativeNumber,
  status: productControlStatusSchema,
  affectedLinesCount: nonNegativeInt.optional(),
  affectedOrdersCount: nonNegativeInt.optional(),
  bondedCandidateLabel: z.string().optional(),
  bondedCandidateBlock: z.string().optional(),
  bondedCandidateSource: z.string().optional(),
  bondedCandidateUnitsPerPallet: nonNegativeInt.optional(),
  bondedCandidateCartonsPerPallet: nonNegativeInt.optional(),
  bondedCandidatePackFactor: nonNegativeInt.optional(),
  bondedCandidateAlreadyPulled: nonNegativeInt.optional(),
  bondedCandidateAvailableBalance: nonNegativeNumber.optional(),
  workLines: z.array(productControlWorkLineSchema).optional(),
  dataIssues: z.array(productControlDataIssueSchema).optional(),
  notes: z.string().optional(),
  bondedCandidates: z.array(productControlBondedCandidateSchema).optional()
});
export type ProductControlRow = z.infer<typeof productControlRowSchema>;

export const productControlTotalsSchema = z.object({
  totalSkus: nonNegativeInt,
  shortageSkus: nonNegativeInt,
  coveredByBondedSkus: nonNegativeInt,
  partialBondedSkus: nonNegativeInt,
  unresolvedSkus: nonNegativeInt,
  dataIssueSkus: nonNegativeInt
});
export type ProductControlTotals = z.infer<typeof productControlTotalsSchema>;

export const productControlBondedSnapshotMetaSchema = z.object({
  id: z.string(),
  planningDate: z.string(),
  importedAt: z.string(),
  fileName: z.string().nullable(),
  rowCount: z.number().int().min(0)
});
export type ProductControlBondedSnapshotMeta = z.infer<typeof productControlBondedSnapshotMetaSchema>;

export const productControlWarehouseStockSnapshotMetaSchema = z.object({
  id: z.string(),
  planningDate: z.string(),
  importedAt: z.string(),
  fileName: z.string().nullable(),
  sourceRowCount: z.number().int().min(0),
  uniqueSkuCount: z.number().int().min(0)
});
export type ProductControlWarehouseStockSnapshotMeta = z.infer<typeof productControlWarehouseStockSnapshotMetaSchema>;

export const productControlResponseSchema = z.object({
  shiftId: z.string(),
  generatedAt: z.string(),
  rows: z.array(productControlRowSchema),
  totals: productControlTotalsSchema,
  bondedSnapshot: productControlBondedSnapshotMetaSchema.nullable().optional(),
  warehouseStockSnapshot: productControlWarehouseStockSnapshotMetaSchema.nullable().optional(),
  warnings: z.array(z.string()).optional()
});
export type ProductControlResponse = z.infer<typeof productControlResponseSchema>;

export function deriveShortageQty(demandQty: number, warehouseQty: number): number {
  return Math.max(0, demandQty - warehouseQty);
}

export function deriveBondedCoverQty(shortageQty: number, bondedAvailableQty: number): number {
  return Math.min(shortageQty, bondedAvailableQty);
}

export function deriveFinalMissingQty(shortageQty: number, bondedCoverQty: number): number {
  return Math.max(0, shortageQty - bondedCoverQty);
}

export function deriveSurplusQty(warehouseQty: number, demandQty: number): number {
  return Math.max(0, warehouseQty - demandQty);
}

export function deriveProductControlStatus(
  shortageQty: number,
  bondedCoverQty: number,
  bondedAvailableQty: number
): ProductControlStatus {
  if (shortageQty === 0) return 'ok';
  if (bondedCoverQty >= shortageQty) return 'covered_by_bonded';
  if (bondedCoverQty > 0) return 'partial_bonded';
  return 'unresolved';
}

export function computeProductControlTotals(
  rows: ReadonlyArray<Pick<ProductControlRow, 'status'>>
): ProductControlTotals {
  let totalSkus = 0;
  let shortageSkus = 0;
  let coveredByBondedSkus = 0;
  let partialBondedSkus = 0;
  let unresolvedSkus = 0;
  let dataIssueSkus = 0;

  for (const row of rows) {
    totalSkus++;
    switch (row.status) {
      case 'data_issue':
        dataIssueSkus++;
        break;
      case 'ok':
        break;
      case 'covered_by_bonded':
        coveredByBondedSkus++;
        shortageSkus++;
        break;
      case 'partial_bonded':
        partialBondedSkus++;
        shortageSkus++;
        break;
      case 'unresolved':
        unresolvedSkus++;
        shortageSkus++;
        break;
    }
  }

  return {
    totalSkus,
    shortageSkus,
    coveredByBondedSkus,
    partialBondedSkus,
    unresolvedSkus,
    dataIssueSkus
  };
}

export function buildProductControlRow(input: {
  sku: string;
  description: string;
  category: string;
  demandQty: number;
  warehouseQty: number;
  bondedAvailableQty: number;
  status?: ProductControlStatus;
  affectedLinesCount?: number;
  affectedOrdersCount?: number;
  bondedCandidateLabel?: string;
  bondedCandidateBlock?: string;
  bondedCandidateSource?: string;
  bondedCandidateUnitsPerPallet?: number;
  bondedCandidateCartonsPerPallet?: number;
  bondedCandidatePackFactor?: number;
  bondedCandidateAlreadyPulled?: number;
  bondedCandidateAvailableBalance?: number;
  workLines?: ProductControlWorkLine[];
  dataIssues?: ProductControlDataIssue[];
  notes?: string;
  bondedCandidates?: ProductControlBondedCandidate[];
}): ProductControlRow {
  const shortageQty = deriveShortageQty(input.demandQty, input.warehouseQty);
  const bondedCoverQty = deriveBondedCoverQty(shortageQty, input.bondedAvailableQty);
  const finalMissingQty = deriveFinalMissingQty(shortageQty, bondedCoverQty);
  const surplusQty = deriveSurplusQty(input.warehouseQty, input.demandQty);
  const status =
    input.status ?? deriveProductControlStatus(shortageQty, bondedCoverQty, input.bondedAvailableQty);

  return {
    sku: input.sku,
    description: input.description,
    category: input.category,
    demandQty: input.demandQty,
    warehouseQty: input.warehouseQty,
    shortageQty,
    bondedAvailableQty: input.bondedAvailableQty,
    bondedCoverQty,
    finalMissingQty,
    surplusQty,
    status,
    affectedLinesCount: input.affectedLinesCount,
    affectedOrdersCount: input.affectedOrdersCount,
    bondedCandidateLabel: input.bondedCandidateLabel,
    bondedCandidateBlock: input.bondedCandidateBlock,
    bondedCandidateSource: input.bondedCandidateSource,
    bondedCandidateUnitsPerPallet: input.bondedCandidateUnitsPerPallet,
    bondedCandidateCartonsPerPallet: input.bondedCandidateCartonsPerPallet,
    bondedCandidatePackFactor: input.bondedCandidatePackFactor,
    bondedCandidateAlreadyPulled: input.bondedCandidateAlreadyPulled,
    bondedCandidateAvailableBalance: input.bondedCandidateAvailableBalance,
    workLines: input.workLines,
    dataIssues: input.dataIssues,
    notes: input.notes,
    bondedCandidates: input.bondedCandidates
  };
}
