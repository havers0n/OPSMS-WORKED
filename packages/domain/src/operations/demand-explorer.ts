import { z } from 'zod';

export const demandExplorerOrderStatusSchema = z.enum([
  'unassigned',
  'partial',
  'assigned',
  'over_allocated'
]);
export type DemandExplorerOrderStatus = z.infer<typeof demandExplorerOrderStatusSchema>;

export const demandExplorerItemSchema = z.object({
  itemId: z.string().uuid(),
  sku: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  quantity: z.number().min(0),
  assignedQuantity: z.number().min(0),
  remainingQuantity: z.number().min(0),
  status: z.string()
});
export type DemandExplorerItem = z.infer<typeof demandExplorerItemSchema>;

export const demandExplorerOrderSchema = z.object({
  orderId: z.string().min(1),
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  distributionArea: z.string().nullable(),
  rowCount: z.number().int().min(0),
  skuCount: z.number().int().min(0),
  totalQuantity: z.number().min(0),
  assignedQuantity: z.number().min(0),
  remainingQuantity: z.number().min(0),
  publishedQuantity: z.number().min(0),
  status: demandExplorerOrderStatusSchema
});
export type DemandExplorerOrder = z.infer<typeof demandExplorerOrderSchema>;

export const demandExplorerQuerySchema = z.object({
  distributionArea: z.string().optional(),
  search: z.string().optional(),
  status: demandExplorerOrderStatusSchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});
export type DemandExplorerQuery = z.infer<typeof demandExplorerQuerySchema>;

export const demandExplorerPaginationSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0)
});
export type DemandExplorerPagination = z.infer<typeof demandExplorerPaginationSchema>;

export const demandExplorerSummarySchema = z.object({
  totalOrders: z.number().int().min(0),
  totalSkuCount: z.number().int().min(0),
  totalQuantity: z.number().min(0),
  totalAssignedQuantity: z.number().min(0),
  totalRemainingQuantity: z.number().min(0)
});
export type DemandExplorerSummary = z.infer<typeof demandExplorerSummarySchema>;

export const demandExplorerResponseSchema = z.object({
  orders: z.array(demandExplorerOrderSchema),
  pagination: demandExplorerPaginationSchema,
  summary: demandExplorerSummarySchema
});
export type DemandExplorerResponse = z.infer<typeof demandExplorerResponseSchema>;

export const demandExplorerItemsResponseSchema = z.object({
  orderId: z.string().min(1),
  items: z.array(demandExplorerItemSchema)
});
export type DemandExplorerItemsResponse = z.infer<typeof demandExplorerItemsResponseSchema>;

/**
 * Build a composite key that uniquely identifies a logical order group
 * within a frozen draft snapshot.
 */
export function computeOrderGroupKey(input: {
  distributionArea: string | null;
  orderNumber: string | null;
  customerName: string | null;
  plannedDeliveryDate: string | null;
}): string {
  const parts = [
    input.distributionArea ?? '',
    input.orderNumber ?? '',
    input.customerName ?? '',
    input.plannedDeliveryDate ?? '',
  ];
  return parts.join('|');
}

/**
 * Deterministic opaque hash for an order group key.
 */
export function hashOrderGroupKey(groupKey: string): string {
  let hash = 5381;
  for (let i = 0; i < groupKey.length; i++) {
    hash = ((hash << 5) + hash + groupKey.charCodeAt(i)) & 0x7fffffff;
  }
  return `exp_o_${hash.toString(36)}`;
}

export function isUserVisiblePlanningBucket(bucket: {
  planningLineName: string;
  bucketName: string;
}): boolean {
  // TODO (PR-2/PR-3): Replace legacy name-based technical bucket detection
  // with explicit bucketKind column on demand_planning_buckets.
  return bucket.planningLineName !== 'default' && bucket.bucketName !== 'unassigned';
}

export function computeExplorerOrderStatus(
  totalQuantity: number,
  assignedQuantity: number
): DemandExplorerOrderStatus {
  if (totalQuantity <= 0) return 'unassigned';
  if (assignedQuantity <= 0) return 'unassigned';
  if (assignedQuantity > totalQuantity) return 'over_allocated';
  if (assignedQuantity === totalQuantity) return 'assigned';
  return 'partial';
}

export function computeExplorerRemainingQuantity(
  totalQuantity: number,
  assignedQuantity: number
): number {
  return Math.max(totalQuantity - assignedQuantity, 0);
}

export function computeExplorerSkuCount(
  rows: Array<{ sku: string | null }>
): number {
  return new Set(rows.map((r) => r.sku).filter((s): s is string => s !== null)).size;
}
