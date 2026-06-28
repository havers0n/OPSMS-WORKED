import { z } from 'zod';
import { normalizeWorkbookDate } from './manual-shift-monthly-import';

export const demandImportBatchStatusSchema = z.enum(['draft', 'ready', 'archived', 'failed']);
export type DemandImportBatchStatus = z.infer<typeof demandImportBatchStatusSchema>;

export const rawDemandPlanningStatusSchema = z.enum(['unplanned', 'planned', 'excluded', 'special_flow', 'error']);
export type RawDemandPlanningStatus = z.infer<typeof rawDemandPlanningStatusSchema>;

export const rawDemandRouteFlowSchema = z.enum(['unassigned', 'pickup', 'return', 'credit', 'ashlama', 'chita', 'unknown']);
export type RawDemandRouteFlow = z.infer<typeof rawDemandRouteFlowSchema>;

export const rawDemandProductHandlingFlowSchema = z.enum([
  'regular',
  'cigarette',
  'e_cigarette',
  'booster',
  'cooler',
  'grill',
  'pool',
  'bed',
  'chair',
  'bulky',
  'unknown'
]);
export type RawDemandProductHandlingFlow = z.infer<typeof rawDemandProductHandlingFlowSchema>;

export const demandImportIssueSeveritySchema = z.enum(['info', 'warning', 'error']);
export type DemandImportIssueSeverity = z.infer<typeof demandImportIssueSeveritySchema>;

export const demandImportIssueSchema = z.object({
  severity: demandImportIssueSeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  field: z.string().min(1).nullable().optional()
});
export type DemandImportIssue = z.infer<typeof demandImportIssueSchema>;

export const demandImportIssueSummarySchema = z.object({
  severity: demandImportIssueSeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  count: z.number().int().min(0),
  rows: z.array(z.number().int().min(1)).optional()
});
export type DemandImportIssueSummary = z.infer<typeof demandImportIssueSummarySchema>;

export const noteDateHintSchema = z.object({
  raw: z.string().min(1),
  normalized: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
});
export type NoteDateHint = z.infer<typeof noteDateHintSchema>;

export const demandImportBatchSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sourceFile: z.string().min(1),
  sourceSheet: z.string().min(1),
  uploadedAt: z.string().datetime({ offset: true }),
  uploadedBy: z.string().uuid().nullable(),
  status: demandImportBatchStatusSchema,
  rowsCount: z.number().int().min(0),
  rawRowsCount: z.number().int().min(0),
  warningRowsCount: z.number().int().min(0),
  errorRowsCount: z.number().int().min(0),
  specialFlowRowsCount: z.number().int().min(0),
  distributionAreasCount: z.number().int().min(0),
  distinctOrdersCount: z.number().int().min(0),
  distinctSkuCount: z.number().int().min(0)
});
export type DemandImportBatch = z.infer<typeof demandImportBatchSchema>;

export const rawDemandRowStagingSchema = z.object({
  sourceSheet: z.string().min(1),
  sourceRowNumber: z.number().int().min(1),
  agent: z.string().nullable(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  customerName: z.string().nullable(),
  orderNumber: z.string().nullable(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  quantity: z.number().nullable(),
  cost: z.number().nullable(),
  notes: z.string().nullable(),
  distributionArea: z.string().nullable(),
  rawRouteLine: z.string().nullable(),
  plannedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  plannedRouteLine: z.string().nullable(),
  plannedWorkBucket: z.string().nullable(),
  planningStatus: rawDemandPlanningStatusSchema,
  routeFlow: rawDemandRouteFlowSchema,
  productHandlingFlow: rawDemandProductHandlingFlowSchema,
  noteDateHints: z.array(noteDateHintSchema),
  issues: z.array(demandImportIssueSchema)
});
export type RawDemandRowStaging = z.infer<typeof rawDemandRowStagingSchema>;

export const rawDemandRowSchema = rawDemandRowStagingSchema.extend({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  batchId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true })
});
export type RawDemandRow = z.infer<typeof rawDemandRowSchema>;

export const demandImportDistributionAreaSummarySchema = z.object({
  distributionArea: z.string().nullable(),
  rowsCount: z.number().int().min(0),
  ordersCount: z.number().int().min(0),
  skuCount: z.number().int().min(0),
  totalQty: z.number(),
  specialFlowRowsCount: z.number().int().min(0),
  errorRowsCount: z.number().int().min(0)
});
export type DemandImportDistributionAreaSummary = z.infer<typeof demandImportDistributionAreaSummarySchema>;

export const demandImportProductHandlingSummaryEntrySchema = z.object({
  productHandlingFlow: rawDemandProductHandlingFlowSchema,
  rowsCount: z.number().int().min(0),
  totalQty: z.number()
});
export type DemandImportProductHandlingSummaryEntry = z.infer<typeof demandImportProductHandlingSummaryEntrySchema>;

export const demandImportSpecialFlowSummaryEntrySchema = z.object({
  routeFlow: rawDemandRouteFlowSchema,
  rowsCount: z.number().int().min(0),
  totalQty: z.number()
});
export type DemandImportSpecialFlowSummaryEntry = z.infer<typeof demandImportSpecialFlowSummaryEntrySchema>;

export const demandImportDataSheetPreviewSchema = z.object({
  sourceFile: z.string().min(1),
  sourceSheet: z.literal('DataSheet'),
  rowsCount: z.number().int().min(0),
  rawRowsCount: z.number().int().min(0),
  warningRowsCount: z.number().int().min(0),
  errorRowsCount: z.number().int().min(0),
  specialFlowRowsCount: z.number().int().min(0),
  distributionAreasCount: z.number().int().min(0),
  distinctOrdersCount: z.number().int().min(0),
  distinctSkuCount: z.number().int().min(0),
  distributionAreaSummary: z.array(demandImportDistributionAreaSummarySchema),
  productHandlingSummary: z.array(demandImportProductHandlingSummaryEntrySchema),
  specialFlowSummary: z.array(demandImportSpecialFlowSummaryEntrySchema),
  sampleRows: z.array(rawDemandRowStagingSchema),
  issues: z.array(demandImportIssueSummarySchema),
  rows: z.array(rawDemandRowStagingSchema)
});
export type DemandImportDataSheetPreview = z.infer<typeof demandImportDataSheetPreviewSchema>;

export const demandImportDataSheetCreateResponseSchema = z.object({
  batch: demandImportBatchSchema,
  preview: demandImportDataSheetPreviewSchema
});
export type DemandImportDataSheetCreateResponse = z.infer<typeof demandImportDataSheetCreateResponseSchema>;

export const rawDemandPlanningPreviewBatchSchema = demandImportBatchSchema.pick({
  id: true,
  sourceFile: true,
  sourceSheet: true,
  uploadedAt: true,
  status: true,
  rowsCount: true,
  rawRowsCount: true,
  warningRowsCount: true,
  errorRowsCount: true,
  specialFlowRowsCount: true,
  distributionAreasCount: true,
  distinctOrdersCount: true,
  distinctSkuCount: true
});
export type RawDemandPlanningPreviewBatch = z.infer<typeof rawDemandPlanningPreviewBatchSchema>;

export const rawDemandPlanningPreviewSummarySchema = z.object({
  rowsCount: z.number().int().min(0),
  normalRowsCount: z.number().int().min(0),
  specialFlowRowsCount: z.number().int().min(0),
  errorRowsCount: z.number().int().min(0),
  distributionAreasCount: z.number().int().min(0),
  ordersCount: z.number().int().min(0),
  skuCount: z.number().int().min(0),
  totalQuantity: z.number()
});
export type RawDemandPlanningPreviewSummary = z.infer<typeof rawDemandPlanningPreviewSummarySchema>;

export const rawDemandPlanningPreviewOrderItemSchema = z.object({
  rawDemandRowId: z.string().uuid(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  quantity: z.number().nullable(),
  productHandlingFlow: rawDemandProductHandlingFlowSchema,
  planningStatus: rawDemandPlanningStatusSchema,
  issues: z.array(demandImportIssueSchema)
});
export type RawDemandPlanningPreviewOrderItem = z.infer<typeof rawDemandPlanningPreviewOrderItemSchema>;

export const rawDemandPlanningPreviewOrderSchema = z.object({
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  rowsCount: z.number().int().min(0),
  skuCount: z.number().int().min(0),
  totalQuantity: z.number(),
  productHandlingFlows: z.array(rawDemandProductHandlingFlowSchema),
  issues: z.array(demandImportIssueSummarySchema),
  items: z.array(rawDemandPlanningPreviewOrderItemSchema)
});
export type RawDemandPlanningPreviewOrder = z.infer<typeof rawDemandPlanningPreviewOrderSchema>;

export const rawDemandPlanningPreviewProductSummarySchema = z.object({
  sku: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  totalQuantity: z.number(),
  orderCount: z.number().int().min(0),
  productHandlingFlow: rawDemandProductHandlingFlowSchema
});
export type RawDemandPlanningPreviewProductSummary = z.infer<typeof rawDemandPlanningPreviewProductSummarySchema>;

export const rawDemandPlanningPreviewAreaSchema = z.object({
  distributionArea: z.string().nullable(),
  rowsCount: z.number().int().min(0),
  ordersCount: z.number().int().min(0),
  skuCount: z.number().int().min(0),
  totalQuantity: z.number(),
  specialFlowRowsCount: z.number().int().min(0),
  errorRowsCount: z.number().int().min(0),
  orders: z.array(rawDemandPlanningPreviewOrderSchema),
  productSummary: z.array(rawDemandPlanningPreviewProductSummarySchema),
  issues: z.array(demandImportIssueSummarySchema)
});
export type RawDemandPlanningPreviewArea = z.infer<typeof rawDemandPlanningPreviewAreaSchema>;

export const rawDemandPlanningPreviewSpecialFlowSampleSchema = z.object({
  sourceRowNumber: z.number().int().min(1),
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  sku: z.string().nullable(),
  distributionArea: z.string().nullable(),
  quantity: z.number().nullable(),
  issues: z.array(demandImportIssueSchema)
});
export type RawDemandPlanningPreviewSpecialFlowSample = z.infer<typeof rawDemandPlanningPreviewSpecialFlowSampleSchema>;

export const rawDemandPlanningPreviewSpecialFlowSchema = z.object({
  routeFlow: rawDemandRouteFlowSchema,
  rowsCount: z.number().int().min(0),
  ordersCount: z.number().int().min(0),
  totalQuantity: z.number(),
  sampleRows: z.array(rawDemandPlanningPreviewSpecialFlowSampleSchema)
});
export type RawDemandPlanningPreviewSpecialFlow = z.infer<typeof rawDemandPlanningPreviewSpecialFlowSchema>;

export const rawDemandPlanningPreviewErrorSchema = z.object({
  sourceRowNumber: z.number().int().min(1),
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  sku: z.string().nullable(),
  distributionArea: z.string().nullable(),
  issues: z.array(demandImportIssueSchema)
});
export type RawDemandPlanningPreviewError = z.infer<typeof rawDemandPlanningPreviewErrorSchema>;

export const rawDemandPlanningPreviewSchema = z.object({
  batch: rawDemandPlanningPreviewBatchSchema,
  summary: rawDemandPlanningPreviewSummarySchema,
  distributionAreas: z.array(rawDemandPlanningPreviewAreaSchema),
  specialFlows: z.array(rawDemandPlanningPreviewSpecialFlowSchema),
  errors: z.array(rawDemandPlanningPreviewErrorSchema)
});
export type RawDemandPlanningPreview = z.infer<typeof rawDemandPlanningPreviewSchema>;

// --- Demand Planning Draft schemas ---

export const demandPlanningSourceScopeSchema = z.enum(['all', 'remaining']);
export type DemandPlanningSourceScope = z.infer<typeof demandPlanningSourceScopeSchema>;

export const demandPlanningDraftStatusSchema = z.enum(['draft', 'ready', 'cancelled', 'applied']);
export type DemandPlanningDraftStatus = z.infer<typeof demandPlanningDraftStatusSchema>;

export const demandPlanningDraftSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  batchId: z.string().uuid(),
  status: demandPlanningDraftStatusSchema,
  sourceScope: demandPlanningSourceScopeSchema.optional(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true })
});
export type DemandPlanningDraft = z.infer<typeof demandPlanningDraftSchema>;

export const demandPlanningBucketSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  draftId: z.string().uuid(),
  batchId: z.string().uuid(),
  distributionArea: z.string().nullable(),
  planningLineName: z.string().min(1),
  bucketName: z.string().min(1),
  sortOrder: z.number().int().min(0),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true })
});
export type DemandPlanningBucket = z.infer<typeof demandPlanningBucketSchema>;

export const demandPlanningAllocationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  draftId: z.string().uuid(),
  batchId: z.string().uuid(),
  rawDemandRowId: z.string().uuid(),
  bucketId: z.string().uuid(),
  allocatedQuantity: z.number().min(0),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true })
});
export type DemandPlanningAllocation = z.infer<typeof demandPlanningAllocationSchema>;

export const demandPlanningDraftWithAssignmentsSchema = z.object({
  draft: demandPlanningDraftSchema,
  buckets: z.array(demandPlanningBucketSchema),
  allocations: z.array(demandPlanningAllocationSchema)
});
export type DemandPlanningDraftWithAssignments = z.infer<typeof demandPlanningDraftWithAssignmentsSchema>;

export const demandPlanningPreviewQuerySchema = z.object({
  scope: demandPlanningSourceScopeSchema.default('all')
});
export type DemandPlanningPreviewQuery = z.infer<typeof demandPlanningPreviewQuerySchema>;

export const demandPlanningCreateDraftRequestSchema = z.object({
  scope: demandPlanningSourceScopeSchema.default('all')
});
export type DemandPlanningCreateDraftRequest = z.infer<typeof demandPlanningCreateDraftRequestSchema>;

export const demandPlanningPutPlanBucketSchema = z.object({
  distributionArea: z.string().nullable(),
  planningLineName: z.string().min(1),
  bucketName: z.string().min(1)
});

export const demandPlanningPutPlanAllocationSchema = z.object({
  rawDemandRowId: z.string().uuid(),
  bucketKey: z.string().min(1),
  allocatedQuantity: z.number().min(0)
});

export const demandPlanningPutPlanRequestSchema = z.object({
  buckets: z.array(demandPlanningPutPlanBucketSchema),
  allocations: z.array(demandPlanningPutPlanAllocationSchema)
});
export type DemandPlanningPutPlanRequest = z.infer<typeof demandPlanningPutPlanRequestSchema>;

export const demandPlanningPublishToShiftRequestSchema = z.object({
  targetShiftId: z.string().uuid()
});
export type DemandPlanningPublishToShiftRequest = z.infer<typeof demandPlanningPublishToShiftRequestSchema>;

export const demandPlanningPublishToShiftResponseSchema = z.object({
  shiftId: z.string().uuid(),
  draftId: z.string().uuid(),
  createdLines: z.number().int().min(0),
  reusedLines: z.number().int().min(0),
  createdOrders: z.number().int().min(0),
  updatedOrders: z.number().int().min(0),
  createdItems: z.number().int().min(0),
  skippedRows: z.number().int().min(0),
  warnings: z.array(z.string())
});
export type DemandPlanningPublishToShiftResponse = z.infer<typeof demandPlanningPublishToShiftResponseSchema>;

export const demandImportDataSheetParsedRowSchema = z.object({
  sourceRowNumber: z.number().int().min(1),
  agent: z.string().nullable().optional(),
  orderDateRaw: z.union([z.string(), z.date()]).nullable().optional(),
  customerName: z.string().nullable().optional(),
  orderNumber: z.union([z.string(), z.number()]).nullable().optional(),
  sku: z.union([z.string(), z.number()]).nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  quantity: z.union([z.string(), z.number()]).nullable().optional(),
  cost: z.union([z.string(), z.number()]).nullable().optional(),
  rawRouteLine: z.string().nullable().optional(),
  plannedDeliveryDateRaw: z.union([z.string(), z.date()]).nullable().optional(),
  notes: z.string().nullable().optional(),
  distributionArea: z.string().nullable().optional()
});
export type DemandImportDataSheetParsedRow = z.infer<typeof demandImportDataSheetParsedRowSchema>;

export const parseDemandImportDataSheetPreviewInputSchema = z.object({
  sourceFile: z.string().min(1),
  sourceSheet: z.literal('DataSheet'),
  rows: z.array(demandImportDataSheetParsedRowSchema)
});
export type ParseDemandImportDataSheetPreviewInput = z.infer<typeof parseDemandImportDataSheetPreviewInputSchema>;

function normalizeTrimmedString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function parseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/,/g, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectRouteFlow(notes: string | null): RawDemandRouteFlow {
  if (!notes) return 'unassigned';
  const lower = notes.toLowerCase();
  if (lower.includes('איסוף') || lower.includes('pickup') || lower.includes('collection')) return 'pickup';
  if (lower.includes('החזר') || lower.includes('החזרה') || lower.includes('return')) return 'return';
  if (lower.includes('זיכוי') || lower.includes('credit')) return 'credit';
  if (lower.includes('השלמה') || lower.includes('אשלמה') || lower.includes('ashlama')) return 'ashlama';
  if (lower.includes("צ'יטה") || lower.includes('ציטה') || lower.includes('chita')) return 'chita';
  if (lower.includes('לא להפצה') || lower.includes('לא משויך') || lower.includes('לא מתוכנן')) return 'unknown';
  return 'unassigned';
}

function detectProductHandlingFlow(row: {
  sku: string | null;
  description: string | null;
  category: string | null;
  notes: string | null;
}): RawDemandProductHandlingFlow {
  const haystack = [
    row.sku,
    row.description,
    row.category,
    row.notes
  ]
    .filter((value): value is string => value !== null)
    .join(' ')
    .toLowerCase();

  if (!haystack) return 'unknown';
  if (haystack.includes('סיגר') || haystack.includes('cigarette')) return 'cigarette';
  if (haystack.includes('אייקוס') || haystack.includes('אלקטר') || haystack.includes('vape') || haystack.includes('e-cig')) return 'e_cigarette';
  if (haystack.includes('בוסטר') || haystack.includes('booster')) return 'booster';
  if (haystack.includes('צידנית') || haystack.includes('cooler')) return 'cooler';
  if (haystack.includes('מנגל') || haystack.includes('גריל') || haystack.includes('grill') || haystack.includes('bbq')) return 'grill';
  if (haystack.includes('בריכה') || haystack.includes('pool')) return 'pool';
  if (haystack.includes('מיטה') || haystack.includes('bed')) return 'bed';
  if (haystack.includes('כיסא') || haystack.includes('כסא') || haystack.includes('chair')) return 'chair';
  if (haystack.includes('מזרן') || haystack.includes('ספה') || haystack.includes('ארון') || haystack.includes('שולחן') || haystack.includes('bulky')) return 'bulky';
  return 'regular';
}

function extractNoteDateHints(notes: string | null): NoteDateHint[] {
  if (!notes) return [];

  const matches = notes.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g) ?? [];
  const deduped = Array.from(new Set(matches));
  return deduped.map((raw) => ({
    raw,
    normalized: normalizeWorkbookDate(raw.replace(/-/g, '.'))
  }));
}

function summarizeIssues(rows: RawDemandRowStaging[]): DemandImportIssueSummary[] {
  const groups = new Map<string, { severity: DemandImportIssueSeverity; code: string; message: string; rows: number[] }>();

  for (const row of rows) {
    for (const issue of row.issues) {
      const key = `${issue.severity}\u0001${issue.code}\u0001${issue.message}`;
      const entry = groups.get(key) ?? {
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        rows: []
      };
      entry.rows.push(row.sourceRowNumber);
      groups.set(key, entry);
    }
  }

  return Array.from(groups.values())
    .map((entry) => ({
      severity: entry.severity,
      code: entry.code,
      message: entry.message,
      count: entry.rows.length,
      rows: entry.rows.sort((a, b) => a - b)
    }))
    .sort((a, b) => (
      a.severity.localeCompare(b.severity) ||
      a.code.localeCompare(b.code) ||
      a.message.localeCompare(b.message)
    ));
}

function compareStrings(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b, 'he');
}

function summarizeIssueList(issues: DemandImportIssue[], sourceRowNumbers?: number[]): DemandImportIssueSummary[] {
  const groups = new Map<string, { severity: DemandImportIssueSeverity; code: string; message: string; rows: number[] }>();

  for (const [index, issue] of issues.entries()) {
    const key = `${issue.severity}\u0001${issue.code}\u0001${issue.message}`;
    const entry = groups.get(key) ?? {
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      rows: []
    };
    const sourceRowNumber = sourceRowNumbers?.[index];
    if (sourceRowNumber !== undefined) {
      entry.rows.push(sourceRowNumber);
    }
    groups.set(key, entry);
  }

  return Array.from(groups.values())
    .map((entry) => ({
      severity: entry.severity,
      code: entry.code,
      message: entry.message,
      count: entry.rows.length > 0 ? entry.rows.length : issues.filter(
        (issue) =>
          issue.severity === entry.severity &&
          issue.code === entry.code &&
          issue.message === entry.message
      ).length,
      ...(entry.rows.length > 0 ? { rows: Array.from(new Set(entry.rows)).sort((a, b) => a - b) } : {})
    }))
    .sort((a, b) => (
      a.severity.localeCompare(b.severity) ||
      a.code.localeCompare(b.code) ||
      a.message.localeCompare(b.message)
    ));
}

export function parseDemandImportDataSheetPreview(
  input: ParseDemandImportDataSheetPreviewInput
): DemandImportDataSheetPreview {
  const parsedInput = parseDemandImportDataSheetPreviewInputSchema.parse(input);

  const rows: RawDemandRowStaging[] = parsedInput.rows.map((row) => {
    const issues: DemandImportIssue[] = [];
    const agent = normalizeTrimmedString(row.agent);
    const orderDate = normalizeWorkbookDate(
      typeof row.orderDateRaw === 'string' || row.orderDateRaw instanceof Date ? row.orderDateRaw : null
    );
    const customerName = normalizeTrimmedString(row.customerName);
    const orderNumber = normalizeTrimmedString(row.orderNumber);
    const sku = normalizeTrimmedString(row.sku);
    const description = normalizeTrimmedString(row.description);
    const category = normalizeTrimmedString(row.category);
    const quantity = parseNumeric(row.quantity);
    const cost = parseNumeric(row.cost);
    const notes = normalizeTrimmedString(row.notes);
    const distributionArea = normalizeTrimmedString(row.distributionArea);
    const rawRouteLine = normalizeTrimmedString(row.rawRouteLine);
    const noteDateHints = extractNoteDateHints(notes);
    const routeFlow = detectRouteFlow(notes);
    const productHandlingFlow = detectProductHandlingFlow({ sku, description, category, notes });

    if (!orderNumber) {
      issues.push({
        severity: 'error',
        code: 'MISSING_ORDER_NUMBER',
        message: 'Order number is required for DataSheet staging.',
        field: 'orderNumber'
      });
    }

    if (!customerName) {
      issues.push({
        severity: 'error',
        code: 'MISSING_CUSTOMER_NAME',
        message: 'Customer name is required for DataSheet staging.',
        field: 'customerName'
      });
    }

    if (!sku) {
      issues.push({
        severity: 'error',
        code: 'MISSING_SKU',
        message: 'SKU is required for DataSheet staging.',
        field: 'sku'
      });
    }

    if (quantity === null) {
      issues.push({
        severity: 'error',
        code: 'MISSING_QUANTITY',
        message: 'Quantity is required for DataSheet staging.',
        field: 'quantity'
      });
    } else if (quantity === 0) {
      issues.push({
        severity: 'warning',
        code: 'ZERO_QUANTITY',
        message: 'Zero quantity rows are staged but require planning review.',
        field: 'quantity'
      });
    }

    if (!distributionArea) {
      issues.push({
        severity: 'error',
        code: 'MISSING_DISTRIBUTION_AREA',
        message: 'Distribution area is required for raw DataSheet planning.',
        field: 'distributionArea'
      });
    }

    let planningStatus: RawDemandPlanningStatus = 'unplanned';
    if (issues.some((issue) => issue.severity === 'error')) {
      planningStatus = 'error';
    } else if (routeFlow !== 'unassigned') {
      planningStatus = 'special_flow';
    }

    return rawDemandRowStagingSchema.parse({
      sourceSheet: 'DataSheet',
      sourceRowNumber: row.sourceRowNumber,
      agent,
      orderDate,
      customerName,
      orderNumber,
      sku,
      description,
      category,
      quantity,
      cost,
      notes,
      distributionArea,
      rawRouteLine,
      plannedDeliveryDate: null,
      plannedRouteLine: null,
      plannedWorkBucket: null,
      planningStatus,
      routeFlow,
      productHandlingFlow,
      noteDateHints,
      issues
    });
  });

  const distributionAreaSummary = Array.from(
    rows.reduce((acc, row) => {
      const key = row.distributionArea ?? '__missing__';
      const entry = acc.get(key) ?? {
        distributionArea: row.distributionArea,
        rowsCount: 0,
        orders: new Set<string>(),
        skus: new Set<string>(),
        totalQty: 0,
        specialFlowRowsCount: 0,
        errorRowsCount: 0
      };

      entry.rowsCount += 1;
      if (row.orderNumber) entry.orders.add(row.orderNumber);
      if (row.sku) entry.skus.add(row.sku);
      entry.totalQty += row.quantity ?? 0;
      if (row.planningStatus === 'special_flow') entry.specialFlowRowsCount += 1;
      if (row.planningStatus === 'error') entry.errorRowsCount += 1;
      acc.set(key, entry);
      return acc;
    }, new Map<string, {
      distributionArea: string | null;
      rowsCount: number;
      orders: Set<string>;
      skus: Set<string>;
      totalQty: number;
      specialFlowRowsCount: number;
      errorRowsCount: number;
    }>())
  .values())
    .map((entry) => ({
      distributionArea: entry.distributionArea,
      rowsCount: entry.rowsCount,
      ordersCount: entry.orders.size,
      skuCount: entry.skus.size,
      totalQty: entry.totalQty,
      specialFlowRowsCount: entry.specialFlowRowsCount,
      errorRowsCount: entry.errorRowsCount
    }))
    .sort((a, b) => compareStrings(a.distributionArea, b.distributionArea));

  const productHandlingSummary = Array.from(
    rows.reduce((acc, row) => {
      const entry = acc.get(row.productHandlingFlow) ?? { rowsCount: 0, totalQty: 0 };
      entry.rowsCount += 1;
      entry.totalQty += row.quantity ?? 0;
      acc.set(row.productHandlingFlow, entry);
      return acc;
    }, new Map<RawDemandProductHandlingFlow, { rowsCount: number; totalQty: number }>())
  .entries())
    .map(([productHandlingFlow, entry]) => ({
      productHandlingFlow,
      rowsCount: entry.rowsCount,
      totalQty: entry.totalQty
    }))
    .sort((a, b) => a.productHandlingFlow.localeCompare(b.productHandlingFlow));

  const specialFlowSummary = Array.from(
    rows
      .filter((row) => row.planningStatus === 'special_flow')
      .reduce((acc, row) => {
        const entry = acc.get(row.routeFlow) ?? { rowsCount: 0, totalQty: 0 };
        entry.rowsCount += 1;
        entry.totalQty += row.quantity ?? 0;
        acc.set(row.routeFlow, entry);
        return acc;
      }, new Map<RawDemandRouteFlow, { rowsCount: number; totalQty: number }>())
      .entries()
  )
    .map(([routeFlow, entry]) => ({
      routeFlow,
      rowsCount: entry.rowsCount,
      totalQty: entry.totalQty
    }))
    .sort((a, b) => a.routeFlow.localeCompare(b.routeFlow));

  const warningRowsCount = rows.filter((row) => row.issues.some((issue) => issue.severity === 'warning')).length;
  const errorRowsCount = rows.filter((row) => row.planningStatus === 'error').length;
  const specialFlowRowsCount = rows.filter((row) => row.planningStatus === 'special_flow').length;
  const rawRowsCount = rows.filter((row) => row.planningStatus === 'unplanned').length;
  const distributionAreasCount = new Set(
    rows
      .map((row) => row.distributionArea)
      .filter((value): value is string => value !== null)
  ).size;
  const distinctOrdersCount = new Set(
    rows
      .map((row) => row.orderNumber)
      .filter((value): value is string => value !== null)
  ).size;
  const distinctSkuCount = new Set(
    rows
      .map((row) => row.sku)
      .filter((value): value is string => value !== null)
  ).size;

  return demandImportDataSheetPreviewSchema.parse({
    sourceFile: parsedInput.sourceFile,
    sourceSheet: 'DataSheet',
    rowsCount: rows.length,
    rawRowsCount,
    warningRowsCount,
    errorRowsCount,
    specialFlowRowsCount,
    distributionAreasCount,
    distinctOrdersCount,
    distinctSkuCount,
    distributionAreaSummary,
    productHandlingSummary,
    specialFlowSummary,
    sampleRows: rows.slice(0, 20),
    issues: summarizeIssues(rows),
    rows
  });
}

export function buildRawDemandPlanningPreview(input: {
  batch: DemandImportBatch;
  rows: RawDemandRow[];
}): RawDemandPlanningPreview {
  const { batch, rows } = input;
  const normalRows = rows.filter((row) => row.planningStatus === 'unplanned');
  const specialFlowRows = rows.filter((row) => row.planningStatus === 'special_flow');
  const errorRows = rows.filter((row) => row.planningStatus === 'error');

  const distributionAreas = Array.from(
    rows.reduce((acc, row) => {
      const key = row.distributionArea ?? '__missing__';
      const entry = acc.get(key) ?? {
        distributionArea: row.distributionArea,
        rows: [] as RawDemandRow[],
        normalRows: [] as RawDemandRow[],
        issues: [] as DemandImportIssue[],
        issueRows: [] as number[]
      };
      entry.rows.push(row);
      if (row.planningStatus === 'unplanned') {
        entry.normalRows.push(row);
      }
      for (const issue of row.issues) {
        entry.issues.push(issue);
        entry.issueRows.push(row.sourceRowNumber);
      }
      acc.set(key, entry);
      return acc;
    }, new Map<string, {
      distributionArea: string | null;
      rows: RawDemandRow[];
      normalRows: RawDemandRow[];
      issues: DemandImportIssue[];
      issueRows: number[];
    }>())
  .values())
    .map((area) => {
      const orders = Array.from(
        area.normalRows.reduce((acc, row) => {
          const key = `${row.orderNumber ?? ''}\u0001${row.customerName ?? ''}`;
          const entry = acc.get(key) ?? {
            orderNumber: row.orderNumber,
            customerName: row.customerName,
            rowsCount: 0,
            skus: new Set<string>(),
            totalQuantity: 0,
            productHandlingFlows: new Set<RawDemandProductHandlingFlow>(),
            issues: [] as DemandImportIssue[],
            issueRows: [] as number[],
            rows: [] as RawDemandRow[]
          };

          entry.rowsCount += 1;
          entry.rows.push(row);
          if (row.sku) entry.skus.add(row.sku);
          entry.totalQuantity += row.quantity ?? 0;
          entry.productHandlingFlows.add(row.productHandlingFlow);
          for (const issue of row.issues) {
            entry.issues.push(issue);
            entry.issueRows.push(row.sourceRowNumber);
          }
          acc.set(key, entry);
          return acc;
        }, new Map<string, {
          orderNumber: string | null;
          customerName: string | null;
          rowsCount: number;
          skus: Set<string>;
          totalQuantity: number;
          productHandlingFlows: Set<RawDemandProductHandlingFlow>;
          issues: DemandImportIssue[];
          issueRows: number[];
          rows: RawDemandRow[];
        }>())
      .values())
        .map((order) => ({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          rowsCount: order.rowsCount,
          skuCount: order.skus.size,
          totalQuantity: order.totalQuantity,
          productHandlingFlows: Array.from(order.productHandlingFlows).sort((a, b) => a.localeCompare(b)),
          issues: summarizeIssueList(order.issues, order.issueRows),
          items: order.rows.map((row) => ({
            rawDemandRowId: row.id,
            sku: row.sku,
            description: row.description,
            category: row.category,
            quantity: row.quantity,
            productHandlingFlow: row.productHandlingFlow,
            planningStatus: row.planningStatus,
            issues: row.issues
          }))
        }))
        .sort((a, b) => (
          compareStrings(a.orderNumber, b.orderNumber) ||
          compareStrings(a.customerName, b.customerName)
        ));

      const productSummary = Array.from(
        area.normalRows.reduce((acc, row) => {
          const key = [
            row.sku ?? '',
            row.description ?? '',
            row.category ?? '',
            row.productHandlingFlow
          ].join('\u0001');
          const entry = acc.get(key) ?? {
            sku: row.sku,
            description: row.description,
            category: row.category,
            totalQuantity: 0,
            orders: new Set<string>(),
            productHandlingFlow: row.productHandlingFlow
          };
          entry.totalQuantity += row.quantity ?? 0;
          entry.orders.add(`${row.orderNumber ?? ''}\u0001${row.customerName ?? ''}`);
          acc.set(key, entry);
          return acc;
        }, new Map<string, {
          sku: string | null;
          description: string | null;
          category: string | null;
          totalQuantity: number;
          orders: Set<string>;
          productHandlingFlow: RawDemandProductHandlingFlow;
        }>())
      .values())
        .map((product) => ({
          sku: product.sku,
          description: product.description,
          category: product.category,
          totalQuantity: product.totalQuantity,
          orderCount: product.orders.size,
          productHandlingFlow: product.productHandlingFlow
        }))
        .sort((a, b) => (
          compareStrings(a.sku, b.sku) ||
          compareStrings(a.description, b.description) ||
          compareStrings(a.category, b.category)
        ));

      return {
        distributionArea: area.distributionArea,
        rowsCount: area.rows.length,
        ordersCount: new Set(
          area.normalRows
            .map((row) => `${row.orderNumber ?? ''}\u0001${row.customerName ?? ''}`)
        ).size,
        skuCount: new Set(
          area.normalRows
            .map((row) => row.sku)
            .filter((value): value is string => value !== null)
        ).size,
        totalQuantity: area.normalRows.reduce((sum, row) => sum + (row.quantity ?? 0), 0),
        specialFlowRowsCount: area.rows.filter((row) => row.planningStatus === 'special_flow').length,
        errorRowsCount: area.rows.filter((row) => row.planningStatus === 'error').length,
        orders,
        productSummary,
        issues: summarizeIssueList(area.issues, area.issueRows)
      };
    })
    .sort((a, b) => compareStrings(a.distributionArea, b.distributionArea));

  const specialFlows = Array.from(
    specialFlowRows.reduce((acc, row) => {
      const entry = acc.get(row.routeFlow) ?? {
        routeFlow: row.routeFlow,
        rows: [] as RawDemandRow[],
        orders: new Set<string>(),
        totalQuantity: 0
      };
      entry.rows.push(row);
      entry.orders.add(`${row.orderNumber ?? ''}\u0001${row.customerName ?? ''}`);
      entry.totalQuantity += row.quantity ?? 0;
      acc.set(row.routeFlow, entry);
      return acc;
    }, new Map<RawDemandRouteFlow, {
      routeFlow: RawDemandRouteFlow;
      rows: RawDemandRow[];
      orders: Set<string>;
      totalQuantity: number;
    }>())
  .values())
    .map((entry) => ({
      routeFlow: entry.routeFlow,
      rowsCount: entry.rows.length,
      ordersCount: entry.orders.size,
      totalQuantity: entry.totalQuantity,
      sampleRows: entry.rows.slice(0, 10).map((row) => ({
        sourceRowNumber: row.sourceRowNumber,
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        sku: row.sku,
        distributionArea: row.distributionArea,
        quantity: row.quantity,
        issues: row.issues
      }))
    }))
    .sort((a, b) => a.routeFlow.localeCompare(b.routeFlow));

  const errors = errorRows
    .map((row) => ({
      sourceRowNumber: row.sourceRowNumber,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      sku: row.sku,
      distributionArea: row.distributionArea,
      issues: row.issues
    }))
    .sort((a, b) => a.sourceRowNumber - b.sourceRowNumber);

  return rawDemandPlanningPreviewSchema.parse({
    batch: rawDemandPlanningPreviewBatchSchema.parse(batch),
    summary: {
      rowsCount: rows.length,
      normalRowsCount: normalRows.length,
      specialFlowRowsCount: specialFlowRows.length,
      errorRowsCount: errorRows.length,
      distributionAreasCount: new Set(
        rows
          .map((row) => row.distributionArea)
          .filter((value): value is string => value !== null)
      ).size,
      ordersCount: new Set(
        normalRows
          .map((row) => `${row.orderNumber ?? ''}\u0001${row.customerName ?? ''}`)
      ).size,
      skuCount: new Set(
        normalRows
          .map((row) => row.sku)
          .filter((value): value is string => value !== null)
      ).size,
      totalQuantity: normalRows.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
    },
    distributionAreas,
    specialFlows,
    errors
  });
}

// ──── Append diff: merge DataSheet into existing shift ─────────────────────

export const demandImportAppendClassificationSchema = z.enum([
  'new',
  'already_exists',
  'quantity_changed',
  'duplicate',
  'special_flow',
  'requires_review'
]);
export type DemandImportAppendClassification = z.infer<typeof demandImportAppendClassificationSchema>;

export const demandImportAppendExistingLineSchema = z.object({
  lineId: z.string().uuid(),
  lineName: z.string(),
  distributionArea: z.string().nullable(),
  status: z.string()
});
export type DemandImportAppendExistingLine = z.infer<typeof demandImportAppendExistingLineSchema>;

export const demandImportAppendExistingItemSchema = z.object({
  lineId: z.string().uuid(),
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  sku: z.string(),
  quantity: z.number(),
  distributionArea: z.string().nullable()
});
export type DemandImportAppendExistingItem = z.infer<typeof demandImportAppendExistingItemSchema>;

export const demandImportAppendDiffRowSchema = z.object({
  rawDemandRowId: z.string().uuid(),
  sourceRowNumber: z.number().int().min(1),
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  quantity: z.number().nullable(),
  distributionArea: z.string().nullable(),
  classification: demandImportAppendClassificationSchema,
  existingQuantity: z.number().nullable().optional(),
  duplicateOfRowId: z.string().uuid().nullable().optional(),
  suggestedLineId: z.string().uuid().nullable(),
  suggestedLineName: z.string().nullable()
});
export type DemandImportAppendDiffRow = z.infer<typeof demandImportAppendDiffRowSchema>;

export const demandImportAppendDiffOrderSchema = z.object({
  orderKey: z.string(),
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  distributionArea: z.string().nullable(),
  classification: demandImportAppendClassificationSchema,
  rows: z.array(demandImportAppendDiffRowSchema),
  suggestedLineId: z.string().uuid().nullable(),
  suggestedLineName: z.string().nullable(),
  totalQuantity: z.number()
});
export type DemandImportAppendDiffOrder = z.infer<typeof demandImportAppendDiffOrderSchema>;

export const demandImportAppendDiffSummarySchema = z.object({
  totalRows: z.number().int().min(0),
  newRows: z.number().int().min(0),
  alreadyExistsRows: z.number().int().min(0),
  quantityChangedRows: z.number().int().min(0),
  duplicateRows: z.number().int().min(0),
  specialFlowRows: z.number().int().min(0),
  requiresReviewRows: z.number().int().min(0),
  newOrders: z.number().int().min(0)
});
export type DemandImportAppendDiffSummary = z.infer<typeof demandImportAppendDiffSummarySchema>;

export const demandImportAppendDiffResponseSchema = z.object({
  batchId: z.string().uuid(),
  shiftId: z.string().uuid(),
  existingLines: z.array(demandImportAppendExistingLineSchema),
  summary: demandImportAppendDiffSummarySchema,
  newOrders: z.array(demandImportAppendDiffOrderSchema),
  alreadyExistsOrders: z.array(demandImportAppendDiffOrderSchema),
  quantityChangedOrders: z.array(demandImportAppendDiffOrderSchema),
  duplicateOrders: z.array(demandImportAppendDiffOrderSchema),
  specialFlowOrders: z.array(demandImportAppendDiffOrderSchema),
  requiresReviewOrders: z.array(demandImportAppendDiffOrderSchema)
});
export type DemandImportAppendDiffResponse = z.infer<typeof demandImportAppendDiffResponseSchema>;

const SEP = '::';

function buildExactKey(
  orderNumber: string | null,
  customerName: string | null,
  sku: string | null | undefined,
  distributionArea: string | null
): string {
  return `${orderNumber ?? ''}${SEP}${customerName ?? ''}${SEP}${sku ?? ''}${SEP}${distributionArea ?? ''}`;
}

function buildSkuKey(
  orderNumber: string | null,
  customerName: string | null,
  sku: string | null | undefined
): string {
  return `${orderNumber ?? ''}${SEP}${customerName ?? ''}${SEP}${sku ?? ''}`;
}

function buildOrderKey(
  orderNumber: string | null,
  customerName: string | null
): string {
  return `${orderNumber ?? ''}${SEP}${customerName ?? ''}`;
}

const APPEND_CLASSIFICATION_PRIORITY: DemandImportAppendClassification[] = [
  'requires_review',
  'duplicate',
  'quantity_changed',
  'new',
  'special_flow',
  'already_exists'
];

function getOrderClassification(
  classifications: DemandImportAppendClassification[]
): DemandImportAppendClassification {
  const set = new Set(classifications);
  for (const cls of APPEND_CLASSIFICATION_PRIORITY) {
    if (set.has(cls)) return cls;
  }
  return 'already_exists';
}

export function computeDemandImportAppendDiff(input: {
  batchId: string;
  shiftId: string;
  rows: RawDemandRow[];
  existingLines: DemandImportAppendExistingLine[];
  existingItems: DemandImportAppendExistingItem[];
}): DemandImportAppendDiffResponse {
  // ── Index existing items ────────────────────────────────────────────────
  const exactMap = new Map<string, { quantity: number; lineId: string }>();
  const skuMap = new Map<string, { distributionArea: string | null; quantity: number; lineId: string }>();
  const orderSet = new Set<string>();

  for (const item of input.existingItems) {
    const exactKey = buildExactKey(item.orderNumber, item.customerName, item.sku, item.distributionArea);
    const skuKey = buildSkuKey(item.orderNumber, item.customerName, item.sku);
    const orderKey = buildOrderKey(item.orderNumber, item.customerName);

    exactMap.set(exactKey, { quantity: item.quantity, lineId: item.lineId });
    if (!skuMap.has(skuKey)) {
      skuMap.set(skuKey, { distributionArea: item.distributionArea, quantity: item.quantity, lineId: item.lineId });
    }
    orderSet.add(orderKey);
  }

  // ── Index lines for suggestions ─────────────────────────────────────────
  const lineSuggestionMap = new Map<string, { lineId: string; lineName: string }>();
  for (const line of input.existingLines) {
    if (line.distributionArea && !lineSuggestionMap.has(line.distributionArea)) {
      lineSuggestionMap.set(line.distributionArea, { lineId: line.lineId, lineName: line.lineName });
    }
  }

  // ── Classify each row ───────────────────────────────────────────────────
  const diffRows: DemandImportAppendDiffRow[] = [];
  const batchKeysSeen = new Map<string, string>();

  for (const row of input.rows) {
    const exactKey = buildExactKey(row.orderNumber, row.customerName, row.sku, row.distributionArea);
    const suggestion = row.distributionArea ? lineSuggestionMap.get(row.distributionArea) : undefined;
    const suggestedLineId = suggestion?.lineId ?? null;
    const suggestedLineName = suggestion?.lineName ?? null;

    if (row.planningStatus === 'special_flow') {
      diffRows.push({
        rawDemandRowId: row.id,
        sourceRowNumber: row.sourceRowNumber,
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        sku: row.sku,
        description: row.description,
        quantity: row.quantity,
        distributionArea: row.distributionArea,
        classification: 'special_flow',
        suggestedLineId,
        suggestedLineName
      });
      continue;
    }

    if (batchKeysSeen.has(exactKey)) {
      const firstId = batchKeysSeen.get(exactKey) ?? null;
      diffRows.push({
        rawDemandRowId: row.id,
        sourceRowNumber: row.sourceRowNumber,
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        sku: row.sku,
        description: row.description,
        quantity: row.quantity,
        distributionArea: row.distributionArea,
        classification: 'duplicate',
        duplicateOfRowId: firstId,
        suggestedLineId,
        suggestedLineName
      });
      continue;
    }
    batchKeysSeen.set(exactKey, row.id);

    const exactMatch = exactMap.get(exactKey);
    if (exactMatch) {
      const sameQty = Math.abs(exactMatch.quantity - (row.quantity ?? 0)) < 0.001;
      if (sameQty) {
        diffRows.push({
          rawDemandRowId: row.id,
          sourceRowNumber: row.sourceRowNumber,
          orderNumber: row.orderNumber,
          customerName: row.customerName,
          sku: row.sku,
          description: row.description,
          quantity: row.quantity,
          distributionArea: row.distributionArea,
          classification: 'already_exists',
          suggestedLineId,
          suggestedLineName
        });
      } else {
        diffRows.push({
          rawDemandRowId: row.id,
          sourceRowNumber: row.sourceRowNumber,
          orderNumber: row.orderNumber,
          customerName: row.customerName,
          sku: row.sku,
          description: row.description,
          quantity: row.quantity,
          distributionArea: row.distributionArea,
          classification: 'quantity_changed',
          existingQuantity: exactMatch.quantity,
          suggestedLineId,
          suggestedLineName
        });
      }
      continue;
    }

    const skuKey = buildSkuKey(row.orderNumber, row.customerName, row.sku);
    if (row.sku && skuMap.has(skuKey)) {
      diffRows.push({
        rawDemandRowId: row.id,
        sourceRowNumber: row.sourceRowNumber,
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        sku: row.sku,
        description: row.description,
        quantity: row.quantity,
        distributionArea: row.distributionArea,
        classification: 'requires_review',
        suggestedLineId,
        suggestedLineName
      });
      continue;
    }

    const orderKey = buildOrderKey(row.orderNumber, row.customerName);
    if ((row.orderNumber || row.customerName) && orderSet.has(orderKey)) {
      diffRows.push({
        rawDemandRowId: row.id,
        sourceRowNumber: row.sourceRowNumber,
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        sku: row.sku,
        description: row.description,
        quantity: row.quantity,
        distributionArea: row.distributionArea,
        classification: 'requires_review',
        suggestedLineId,
        suggestedLineName
      });
      continue;
    }

    diffRows.push({
      rawDemandRowId: row.id,
      sourceRowNumber: row.sourceRowNumber,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      sku: row.sku,
      description: row.description,
      quantity: row.quantity,
      distributionArea: row.distributionArea,
      classification: 'new',
      suggestedLineId,
      suggestedLineName
    });
  }

  // ── Group diff rows into orders ─────────────────────────────────────────
  const orderGroupMap = new Map<string, {
    orderNumber: string | null;
    customerName: string | null;
    distributionArea: string | null;
    rows: DemandImportAppendDiffRow[];
    classifications: DemandImportAppendClassification[];
    totalQuantity: number;
  }>();

  for (const diffRow of diffRows) {
    const key = buildOrderKey(diffRow.orderNumber, diffRow.customerName);
    let group = orderGroupMap.get(key);
    if (!group) {
      group = {
        orderNumber: diffRow.orderNumber,
        customerName: diffRow.customerName,
        distributionArea: diffRow.distributionArea,
        rows: [],
        classifications: [],
        totalQuantity: 0
      };
      orderGroupMap.set(key, group);
    }
    group.rows.push(diffRow);
    group.classifications.push(diffRow.classification);
    group.totalQuantity += diffRow.quantity ?? 0;
    if (group.distributionArea === null && diffRow.distributionArea !== null) {
      group.distributionArea = diffRow.distributionArea;
    }
  }

  // ── Partition into buckets ──────────────────────────────────────────────
  const newOrders: DemandImportAppendDiffOrder[] = [];
  const alreadyExistsOrders: DemandImportAppendDiffOrder[] = [];
  const quantityChangedOrders: DemandImportAppendDiffOrder[] = [];
  const duplicateOrders: DemandImportAppendDiffOrder[] = [];
  const specialFlowOrders: DemandImportAppendDiffOrder[] = [];
  const requiresReviewOrders: DemandImportAppendDiffOrder[] = [];

  for (const [, group] of orderGroupMap) {
    const classification = getOrderClassification(group.classifications);
    const firstSuggestion = group.rows.find((r) => r.suggestedLineId);
    const order: DemandImportAppendDiffOrder = {
      orderKey: buildOrderKey(group.orderNumber, group.customerName),
      orderNumber: group.orderNumber,
      customerName: group.customerName,
      distributionArea: group.distributionArea,
      classification,
      rows: group.rows,
      suggestedLineId: firstSuggestion?.suggestedLineId ?? null,
      suggestedLineName: firstSuggestion?.suggestedLineName ?? null,
      totalQuantity: group.totalQuantity
    };

    switch (classification) {
      case 'new': newOrders.push(order); break;
      case 'already_exists': alreadyExistsOrders.push(order); break;
      case 'quantity_changed': quantityChangedOrders.push(order); break;
      case 'duplicate': duplicateOrders.push(order); break;
      case 'special_flow': specialFlowOrders.push(order); break;
      case 'requires_review': requiresReviewOrders.push(order); break;
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const summary: DemandImportAppendDiffSummary = {
    totalRows: diffRows.length,
    newRows: diffRows.filter((r) => r.classification === 'new').length,
    alreadyExistsRows: diffRows.filter((r) => r.classification === 'already_exists').length,
    quantityChangedRows: diffRows.filter((r) => r.classification === 'quantity_changed').length,
    duplicateRows: diffRows.filter((r) => r.classification === 'duplicate').length,
    specialFlowRows: diffRows.filter((r) => r.classification === 'special_flow').length,
    requiresReviewRows: diffRows.filter((r) => r.classification === 'requires_review').length,
    newOrders: newOrders.length
  };

  return {
    batchId: input.batchId,
    shiftId: input.shiftId,
    existingLines: input.existingLines,
    summary,
    newOrders,
    alreadyExistsOrders,
    quantityChangedOrders,
    duplicateOrders,
    specialFlowOrders,
    requiresReviewOrders
  };
}
