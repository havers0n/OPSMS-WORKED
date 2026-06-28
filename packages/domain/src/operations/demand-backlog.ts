import { z } from 'zod';
import {
  rawDemandProductHandlingFlowSchema,
  rawDemandRouteFlowSchema,
  rawDemandPlanningStatusSchema,
  type RawDemandRow,
  type RawDemandRowStaging
} from './demand-import-datasheet';

// ──── Identity key ──────────────────────────────────────────────────────────

const IDENTITY_KEY_SEP = '\x00';

export function normalizeDemandBacklogKey(
  orderNumber: string | null,
  customerName: string | null,
  sku: string | null,
  distributionArea: string | null
): Promise<string> {
  const parts = [
    (orderNumber ?? '').trim().toLowerCase(),
    (customerName ?? '').trim().toLowerCase(),
    (sku ?? '').trim().toLowerCase(),
    (distributionArea ?? '').trim().toLowerCase()
  ];
  return parts.join(IDENTITY_KEY_SEP);
}

// ──── Status ────────────────────────────────────────────────────────────────

export const demandBacklogItemStatusSchema = z.enum(['open', 'special_flow', 'requires_review']);
export type DemandBacklogItemStatus = z.infer<typeof demandBacklogItemStatusSchema>;

// ──── Source link merge action ──────────────────────────────────────────────

export const demandBacklogMergeActionSchema = z.enum([
  'new', 'matched', 'quantity_changed', 'duplicate', 'special_flow'
]);
export type DemandBacklogMergeAction = z.infer<typeof demandBacklogMergeActionSchema>;

// ──── Backlog Item ──────────────────────────────────────────────────────────

export const demandBacklogItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  identityKey: z.string().min(1),
  status: demandBacklogItemStatusSchema,
  totalQuantity: z.number().min(0),
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  distributionArea: z.string().nullable(),
  productHandlingFlow: rawDemandProductHandlingFlowSchema,
  routeFlow: rawDemandRouteFlowSchema,
  firstSeenAt: z.string().datetime({ offset: true }),
  lastSeenAt: z.string().datetime({ offset: true }),
  lastQuantityChangedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true })
});
export type DemandBacklogItem = z.infer<typeof demandBacklogItemSchema>;

// ──── Backlog Item with computed quantities (API response) ──────────────────

export const demandBacklogItemWithQuantitiesSchema = demandBacklogItemSchema.extend({
  totalQuantity: z.number().min(0),
  allocatedQuantity: z.number().min(0),
  openQuantity: z.number().min(0)
});
export type DemandBacklogItemWithQuantities = z.infer<typeof demandBacklogItemWithQuantitiesSchema>;

// ──── Source Batch info (for response sourceBatches array) ──────────────────

export const demandBacklogSourceBatchSchema = z.object({
  batchId: z.string().uuid(),
  sourceFile: z.string().min(1),
  uploadedAt: z.string().datetime({ offset: true }),
  mergeAction: demandBacklogMergeActionSchema,
  quantityAtImport: z.number().min(0),
  previousQuantity: z.number().nullable().optional(),
  newQuantity: z.number().nullable().optional(),
  quantityDelta: z.number().nullable().optional()
});
export type DemandBacklogSourceBatch = z.infer<typeof demandBacklogSourceBatchSchema>;

// ──── Backlog item with source batches (full API response item) ─────────────

export const demandBacklogItemResponseSchema = demandBacklogItemWithQuantitiesSchema.extend({
  sourceBatches: z.array(demandBacklogSourceBatchSchema)
});
export type DemandBacklogItemResponse = z.infer<typeof demandBacklogItemResponseSchema>;

// ──── List response ─────────────────────────────────────────────────────────

export const demandBacklogListResponseSchema = z.object({
  items: z.array(demandBacklogItemResponseSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(200),
    total: z.number().int().min(0)
  })
});
export type DemandBacklogListResponse = z.infer<typeof demandBacklogListResponseSchema>;

// ──── Summary response ──────────────────────────────────────────────────────

export const demandBacklogSummaryEntrySchema = z.object({
  label: z.string(),
  count: z.number().int().min(0)
});

export const demandBacklogAreaSummaryEntrySchema = z.object({
  distributionArea: z.string().nullable(),
  count: z.number().int().min(0),
  totalOpenQuantity: z.number().min(0)
});

export const demandBacklogSummaryResponseSchema = z.object({
  totalItems: z.number().int().min(0),
  totalOpenQuantity: z.number().min(0),
  totalAllocatedQuantity: z.number().min(0),
  totalSourceBatches: z.number().int().min(0),
  byStatus: z.array(demandBacklogSummaryEntrySchema),
  byDistributionArea: z.array(demandBacklogAreaSummaryEntrySchema),
  oldestItemSeenAt: z.string().datetime({ offset: true }).nullable(),
  newestItemSeenAt: z.string().datetime({ offset: true }).nullable()
});
export type DemandBacklogSummaryResponse = z.infer<typeof demandBacklogSummaryResponseSchema>;

// ──── Canonical available demand response ─────────────────────────────────

export const demandAvailableDemandSourceBatchSchema = z.object({
  batchId: z.string().uuid(),
  sourceFile: z.string().min(1),
  uploadedAt: z.string().datetime({ offset: true }),
  rowCount: z.number().int().min(0),
  backlogItemCount: z.number().int().min(0)
});
export type DemandAvailableDemandSourceBatch = z.infer<typeof demandAvailableDemandSourceBatchSchema>;

export const demandAvailableDemandGroupSchema = z.object({
  backlogItemId: z.string().uuid(),
  identityKey: z.string().min(1),
  status: demandBacklogItemStatusSchema,
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  sku: z.string().nullable(),
  distributionArea: z.string().nullable(),
  totalQuantity: z.number().min(0),
  consumedQuantity: z.number().min(0),
  availableQuantity: z.number().min(0),
  sourceBatchIds: z.array(z.string().uuid()),
  sourceRowCount: z.number().int().min(0),
  firstSeenAt: z.string().datetime({ offset: true }),
  lastSeenAt: z.string().datetime({ offset: true })
});
export type DemandAvailableDemandGroup = z.infer<typeof demandAvailableDemandGroupSchema>;

export const demandAvailableDemandSummarySchema = z.object({
  ordersCount: z.number().int().min(0),
  rowsCount: z.number().int().min(0),
  totalQuantity: z.number().min(0),
  distributionAreasCount: z.number().int().min(0)
});
export type DemandAvailableDemandSummary = z.infer<typeof demandAvailableDemandSummarySchema>;

export const demandAvailableDemandExcludedCountsSchema = z.object({
  specialFlowItems: z.number().int().min(0),
  fullyConsumedItems: z.number().int().min(0),
  duplicateSourceFiles: z.number().int().min(0)
});
export type DemandAvailableDemandExcludedCounts = z.infer<typeof demandAvailableDemandExcludedCountsSchema>;

export const demandAvailableDemandResponseSchema = z.object({
  summary: demandAvailableDemandSummarySchema,
  groups: z.array(demandAvailableDemandGroupSchema),
  sourceBatches: z.array(demandAvailableDemandSourceBatchSchema),
  excludedCounts: demandAvailableDemandExcludedCountsSchema,
  warnings: z.array(z.string()),
  canPlan: z.boolean()
});
export type DemandAvailableDemandResponse = z.infer<typeof demandAvailableDemandResponseSchema>;

export type DemandAvailableDemandSnapshot = {
  backlogItems: DemandBacklogItem[];
  sourceLinks: Array<{
    backlogItemId: string;
    rawDemandRowId: string;
    batchId: string;
  }>;
  sourceBatches: Array<{
    batchId: string;
    sourceFile: string;
    uploadedAt: string;
  }>;
  publishedAllocations: Array<{
    rawDemandRowId: string;
    publishedQuantity: number;
    publicationStatus: 'applied' | 'reverted' | null;
  }>;
};

export function buildAvailableDemandResponse(
  snapshot: DemandAvailableDemandSnapshot
): DemandAvailableDemandResponse {
  const publishedQuantityByRowId = new Map<string, number>();
  for (const allocation of snapshot.publishedAllocations) {
    if (allocation.publicationStatus !== 'applied') continue;
    publishedQuantityByRowId.set(
      allocation.rawDemandRowId,
      (publishedQuantityByRowId.get(allocation.rawDemandRowId) ?? 0) + Number(allocation.publishedQuantity ?? 0)
    );
  }

  const sourceLinksByBacklogItemId = new Map<string, Array<{ rawDemandRowId: string; batchId: string }>>();
  for (const link of snapshot.sourceLinks) {
    const list = sourceLinksByBacklogItemId.get(link.backlogItemId) ?? [];
    list.push({ rawDemandRowId: link.rawDemandRowId, batchId: link.batchId });
    sourceLinksByBacklogItemId.set(link.backlogItemId, list);
  }

  const sourceBatchUsageById = new Map<string, { rowCount: number; backlogItemIds: Set<string> }>();
  for (const link of snapshot.sourceLinks) {
    const entry = sourceBatchUsageById.get(link.batchId) ?? {
      rowCount: 0,
      backlogItemIds: new Set<string>()
    };
    entry.rowCount += 1;
    entry.backlogItemIds.add(link.backlogItemId);
    sourceBatchUsageById.set(link.batchId, entry);
  }

  const duplicateSourceFilesByName = new Map<string, Array<{ batchId: string; sourceFile: string; uploadedAt: string }>>();
  for (const batch of snapshot.sourceBatches) {
    const list = duplicateSourceFilesByName.get(batch.sourceFile) ?? [];
    list.push(batch);
    duplicateSourceFilesByName.set(batch.sourceFile, list);
  }

  const warnings: string[] = [];
  for (const [sourceFile, batches] of duplicateSourceFilesByName) {
    if (batches.length > 1) {
      warnings.push(`Source file "${sourceFile}" was uploaded ${batches.length} times.`);
    }
  }

  const groups: DemandAvailableDemandGroup[] = [];
  let specialFlowItems = 0;
  let fullyConsumedItems = 0;

  for (const item of snapshot.backlogItems) {
    if (item.status === 'special_flow') {
      specialFlowItems += 1;
      continue;
    }

    const links = sourceLinksByBacklogItemId.get(item.id) ?? [];
    const consumedQuantity = links.reduce(
      (sum, link) => sum + (publishedQuantityByRowId.get(link.rawDemandRowId) ?? 0),
      0
    );
    const availableQuantity = Math.max(Number(item.totalQuantity ?? 0) - consumedQuantity, 0);
    if (availableQuantity <= 0) {
      fullyConsumedItems += 1;
      continue;
    }

    groups.push({
      backlogItemId: item.id,
      identityKey: item.identityKey,
      status: item.status,
      orderNumber: item.orderNumber,
      customerName: item.customerName,
      sku: item.sku,
      distributionArea: item.distributionArea,
      totalQuantity: Number(item.totalQuantity ?? 0),
      consumedQuantity,
      availableQuantity,
      sourceBatchIds: [...new Set(links.map((link) => link.batchId))],
      sourceRowCount: links.length,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt
    });
  }

  const sourceBatches = snapshot.sourceBatches
    .map((batch) => {
      const usage = sourceBatchUsageById.get(batch.batchId);
      return {
        batchId: batch.batchId,
        sourceFile: batch.sourceFile,
        uploadedAt: batch.uploadedAt,
        rowCount: usage?.rowCount ?? 0,
        backlogItemCount: usage?.backlogItemIds.size ?? 0
      };
    })
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || a.batchId.localeCompare(b.batchId));

  const ordersCount = new Set(groups.map((group) => group.orderNumber).filter((value): value is string => value !== null)).size;
  const distributionAreasCount = new Set(
    groups.map((group) => group.distributionArea).filter((value): value is string => value !== null)
  ).size;
  const totalQuantity = groups.reduce((sum, group) => sum + group.availableQuantity, 0);
  const duplicateSourceFiles = [...duplicateSourceFilesByName.values()].reduce(
    (count, batches) => count + Math.max(batches.length - 1, 0),
    0
  );

  return {
    summary: {
      ordersCount,
      rowsCount: groups.length,
      totalQuantity,
      distributionAreasCount
    },
    groups: groups.sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || a.backlogItemId.localeCompare(b.backlogItemId)),
    sourceBatches,
    excludedCounts: {
      specialFlowItems,
      fullyConsumedItems,
      duplicateSourceFiles
    },
    warnings,
    canPlan: groups.length > 0
  };
}

// ──── Source row type (repo row, not exported in API) ───────────────────────

export const demandBacklogSourceRowSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  backlogItemId: z.string().uuid(),
  rawDemandRowId: z.string().uuid(),
  batchId: z.string().uuid(),
  mergeAction: demandBacklogMergeActionSchema,
  previousQuantity: z.number().nullable(),
  newQuantity: z.number().nullable(),
  quantityDelta: z.number().nullable(),
  createdAt: z.string().datetime({ offset: true })
});
export type DemandBacklogSourceRow = z.infer<typeof demandBacklogSourceRowSchema>;

// ──── Merge input types ────────────────────────────────────────────────────

export const backlogMergeRowInputSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  batchId: z.string().uuid(),
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  quantity: z.number().nullable(),
  distributionArea: z.string().nullable(),
  planningStatus: rawDemandPlanningStatusSchema,
  routeFlow: rawDemandRouteFlowSchema,
  productHandlingFlow: rawDemandProductHandlingFlowSchema
});
export type BacklogMergeRowInput = z.infer<typeof backlogMergeRowInputSchema>;

export const backlogMergeResultSchema = z.object({
  backlogItemId: z.string().uuid(),
  mergeAction: demandBacklogMergeActionSchema,
  isNew: z.boolean(),
  previousQuantity: z.number().nullable(),
  newQuantity: z.number().nullable()
});
export type BacklogMergeResult = z.infer<typeof backlogMergeResultSchema>;

// ──── Merge logic (pure domain function) ─────────────────────────────────────

export async function computeBacklogMergeAction(
  row: BacklogMergeRowInput,
  existingItem: DemandBacklogItem | null,
  existingSourceCount: number
): Promise<BacklogMergeResult> {
  if (row.planningStatus === 'error') {
    throw new Error('Cannot merge error rows into backlog. Filter before calling merge.');
  }

  if (!existingItem) {
    return {
      backlogItemId: '',
      mergeAction: row.planningStatus === 'special_flow' ? 'special_flow' : 'new',
      isNew: true,
      previousQuantity: null,
      newQuantity: row.quantity
    };
  }

  if (row.planningStatus === 'special_flow') {
    return {
      backlogItemId: existingItem.id,
      mergeAction: 'special_flow',
      isNew: false,
      previousQuantity: null,
      newQuantity: null
    };
  }

  const oldQty = existingItem.totalQuantity;
  const newQty = row.quantity ?? 0;

  if (Math.abs(newQty - oldQty) < 0.001) {
    return {
      backlogItemId: existingItem.id,
      mergeAction: 'matched',
      isNew: false,
      previousQuantity: null,
      newQuantity: null
    };
  }

  return {
    backlogItemId: existingItem.id,
    mergeAction: 'quantity_changed',
    isNew: false,
    previousQuantity: oldQty,
    newQuantity: newQty
  };
}

export function computeBacklogItemStatus(
  totalQuantity: number,
  allocatedQuantity: number
): DemandBacklogItemStatus {
  if (totalQuantity < allocatedQuantity) return 'requires_review';
  return 'open';
}

export function computeOpenQuantity(totalQuantity: number, allocatedQuantity: number): number {
  return Math.max(totalQuantity - allocatedQuantity, 0);
}

// ──── Query filter input ────────────────────────────────────────────────────

export const demandBacklogQuerySchema = z.object({
  status: z.enum(['open', 'special_flow', 'requires_review', 'all']).optional().default('open'),
  distributionArea: z.string().optional(),
  search: z.string().optional(),
  sourceBatchId: z.string().uuid().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(200).optional().default(50)
});
export type DemandBacklogQuery = z.infer<typeof demandBacklogQuerySchema>;
