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
): string {
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

export function computeBacklogMergeAction(
  row: BacklogMergeRowInput,
  existingItem: DemandBacklogItem | null,
  existingSourceCount: number
): BacklogMergeResult {
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
