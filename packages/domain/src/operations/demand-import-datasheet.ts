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
  uploadedAt: z.string().datetime(),
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
  createdAt: z.string().datetime()
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
