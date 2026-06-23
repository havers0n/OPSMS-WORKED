import { z } from 'zod';

export const workBucketTypeSchema = z.enum(['unknown']);
export type WorkBucketType = z.infer<typeof workBucketTypeSchema>;

export const manualShiftMonthlyWarningSeveritySchema = z.enum(['info', 'warning', 'blocking']);
export type ManualShiftMonthlyWarningSeverity = z.infer<typeof manualShiftMonthlyWarningSeveritySchema>;

export const manualShiftMonthlyWarningSchema = z.object({
  severity: manualShiftMonthlyWarningSeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  count: z.number().int().min(0).optional(),
  rows: z.array(z.number().int().min(1)).optional()
});
export type ManualShiftMonthlyWarning = z.infer<typeof manualShiftMonthlyWarningSchema>;

export const manualShiftMonthlyMissingFieldSchema = z.object({
  rowIndex: z.number().int().min(1),
  fields: z.array(z.enum([
    'distributionDate',
    'line',
    'point',
    'orderNumber',
    'sku',
    'quantity'
  ])).min(1)
});
export type ManualShiftMonthlyMissingField = z.infer<typeof manualShiftMonthlyMissingFieldSchema>;

export const manualShiftMonthlyInvalidDateDetailSchema = z.object({
  rowIndex: z.number().int().min(1),
  rawValue: z.string().nullable(),
  fieldName: z.string(),
  reason: z.string()
});
export type ManualShiftMonthlyInvalidDateDetail = z.infer<typeof manualShiftMonthlyInvalidDateDetailSchema>;

export const manualShiftMonthlyAvailableDateSchema = z.object({
  raw: z.string().min(1),
  normalized: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.number().int().min(0)
});
export type ManualShiftMonthlyAvailableDate = z.infer<typeof manualShiftMonthlyAvailableDateSchema>;

export const manualShiftMonthlyPreviewLineSchema = z.object({
  lineName: z.string().min(1),
  distributionArea: z.string().nullable(),
  lineGroupName: z.string().nullable(),
  points: z.number().int().min(0),
  uniqueOrderNumbers: z.number().int().min(0),
  orderGroups: z.number().int().min(0),
  itemRows: z.number().int().min(0),
  aggregatedSkuGroups: z.number().int().min(0),
  uniqueSkus: z.number().int().min(0),
  totalQuantity: z.number(),
  negativeQuantityRows: z.number().int().min(0),
  anomalyCount: z.number().int().min(0),
  warnings: z.array(manualShiftMonthlyWarningSchema)
});
export type ManualShiftMonthlyPreviewLine = z.infer<typeof manualShiftMonthlyPreviewLineSchema>;

export const manualShiftMonthlyPreviewSchema = z.object({
  source: z.object({
    fileName: z.string().min(1),
    sheetName: z.string().min(1)
  }),
  selectedDate: z.object({
    raw: z.string().min(1).nullable(),
    normalized: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  }),
  dateSummary: z.object({
    totalRows: z.number().int().min(0),
    matchingRows: z.number().int().min(0),
    skippedOtherDateRows: z.number().int().min(0),
    availableDates: z.array(manualShiftMonthlyAvailableDateSchema)
  }),
  totals: z.object({
    lines: z.number().int().min(0),
    rawDistributionValues: z.number().int().min(0),
    derivedPoints: z.number().int().min(0),
    uniqueOrderNumbers: z.number().int().min(0),
    orderGroups: z.number().int().min(0),
    skuRows: z.number().int().min(0),
    aggregatedSkuGroups: z.number().int().min(0),
    uniqueSkus: z.number().int().min(0),
    totalQuantity: z.number(),
    rawTotalQuantity: z.number(),
    positiveTotalQuantity: z.number(),
    negativeTotalQuantity: z.number(),
    zeroQuantityRowsCount: z.number().int().min(0),
    negativeQuantityRowsCount: z.number().int().min(0),
    positiveQuantityRowsCount: z.number().int().min(0)
  }),
  anomalies: z.object({
    negativeQuantityRows: z.number().int().min(0),
    nonSoOrderRows: z.number().int().min(0),
    rowsWithoutDistributionSlash: z.number().int().min(0),
    pointFallbackRows: z.number().int().min(0),
    pickupNoteRows: z.number().int().min(0),
    ashlamaNoteRows: z.number().int().min(0),
    specialFlowRowCount: z.number().int().min(0),
    invalidDistributionDateRows: z.array(z.number().int().min(1)),
    invalidDateDetails: z.array(manualShiftMonthlyInvalidDateDetailSchema).optional(),
    missingRequiredFields: z.array(manualShiftMonthlyMissingFieldSchema)
  }),
  lines: z.array(manualShiftMonthlyPreviewLineSchema),
  warnings: z.array(manualShiftMonthlyWarningSchema)
});
export type ManualShiftMonthlyPreview = z.infer<typeof manualShiftMonthlyPreviewSchema>;

export const manualShiftMonthlyParsedRowSchema = z.object({
  rowIndex: z.number().int().min(2),
  distributionDateRaw: z.union([z.string(), z.date()]).nullable().optional(),
  distributionDateNormalized: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  rawDistributionValue: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  orderNumber: z.string().nullable().optional(),
  sku: z.union([z.string(), z.number()]).nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  quantity: z.union([z.string(), z.number()]).nullable().optional(),
  notes: z.string().nullable().optional(),
  zone: z.string().nullable().optional(),
  rawRouteLine: z.string().nullable().optional(),
  routeBase: z.string().nullable().optional(),
  workBucketName: z.string().nullable().optional(),
  workBucketType: workBucketTypeSchema.nullable().optional()
});
export type ManualShiftMonthlyParsedRow = z.infer<typeof manualShiftMonthlyParsedRowSchema>;

export const parseManualShiftMonthlyPreviewInputSchema = z.object({
  source: z.object({
    fileName: z.string().min(1),
    sheetName: z.string().min(1)
  }),
  selectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.array(manualShiftMonthlyParsedRowSchema)
});
export type ParseManualShiftMonthlyPreviewInput = z.infer<typeof parseManualShiftMonthlyPreviewInputSchema>;

export const manualShiftMonthlyAggregatedGroupSchema = z.object({
  normalizedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lineName: z.string().min(1),
  pointName: z.string().min(1),
  orderNumber: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().nullable(),
  category: z.string().nullable(),
  totalQuantity: z.number(),
  notes: z.array(z.string().min(1)),
  sourceRows: z.array(z.number().int().min(1)).min(1),
  rows: z.array(z.object({
    rowIndex: z.number().int().min(1),
    quantity: z.number(),
    notes: z.string().nullable()
  })).min(1),
  hasNegativeQuantity: z.boolean(),
  distributionArea: z.string().nullable(),
  lineRawName: z.string().nullable(),
  lineGroupName: z.string().nullable(),
  lineBucketName: z.string().nullable(),
  isNonDistributionRow: z.boolean(),
  customerName: z.string().nullable().optional(),
  rawRouteLine: z.string().nullable(),
  routeBase: z.string().nullable(),
  workBucketName: z.string().nullable(),
  workBucketType: workBucketTypeSchema.nullable(),
  sourceZone: z.string().nullable()
});
export type ManualShiftMonthlyAggregatedGroup = z.infer<typeof manualShiftMonthlyAggregatedGroupSchema>;

export const manualShiftMonthlyParseResultSchema = z.object({
  preview: manualShiftMonthlyPreviewSchema,
  groups: z.array(manualShiftMonthlyAggregatedGroupSchema)
});
export type ManualShiftMonthlyParseResult = z.infer<typeof manualShiftMonthlyParseResultSchema>;

export const manualShiftMonthlyApplyItemSchema = z.object({
  sku: z.string().min(1),
  description: z.string().nullable(),
  category: z.string().nullable(),
  quantity: z.number().positive(),
  notes: z.string().nullable(),
  sourceRows: z.array(z.number().int().min(1)).min(1),
  sortOrder: z.number().int().min(1),
  zone: z.string().nullable().optional()
});
export type ManualShiftMonthlyApplyItem = z.infer<typeof manualShiftMonthlyApplyItemSchema>;

export const manualShiftMonthlyApplyOrderSchema = z.object({
  pointName: z.string().min(1),
  customerName: z.string().nullable().optional(),
  orderNumber: z.string().min(1),
  sourceZone: z.string().nullable().optional(),
  totalQuantity: z.number().positive(),
  sourceRows: z.array(z.number().int().min(1)).min(1),
  sortOrder: z.number().int().min(1),
  items: z.array(manualShiftMonthlyApplyItemSchema).min(1),
  workBucketName: z.string().nullable(),
  workBucketType: workBucketTypeSchema.nullable(),
  rawRouteLine: z.string().nullable().optional(),
  routeBase: z.string().nullable().optional()
});
export type ManualShiftMonthlyApplyOrder = z.infer<typeof manualShiftMonthlyApplyOrderSchema>;

export const manualShiftMonthlyApplyLineSchema = z.object({
  lineName: z.string().min(1),
  distributionArea: z.string().nullable(),
  lineGroupName: z.string().nullable(),
  sortOrder: z.number().int().min(1),
  orders: z.array(manualShiftMonthlyApplyOrderSchema).min(1)
});
export type ManualShiftMonthlyApplyLine = z.infer<typeof manualShiftMonthlyApplyLineSchema>;

export const manualShiftMonthlyApplyPlanSchema = z.object({
  preview: manualShiftMonthlyPreviewSchema,
  lines: z.array(manualShiftMonthlyApplyLineSchema),
  appliedGroups: z.number().int().min(0),
  skippedGroups: z.number().int().min(0),
  skippedNegativeQuantityRows: z.number().int().min(0),
  skippedZeroQuantityRows: z.number().int().min(0),
  appliedTotalQuantity: z.number(),
  appliedItemLines: z.number().int().min(0),
  warningSummary: z.object({
    info: z.number().int().min(0),
    warning: z.number().int().min(0),
    blocking: z.number().int().min(0)
  }),
  blockingWarnings: z.array(manualShiftMonthlyWarningSchema)
});
export type ManualShiftMonthlyApplyPlan = z.infer<typeof manualShiftMonthlyApplyPlanSchema>;

export const manualShiftMonthlyApplyResponseSchema = z.object({
  shiftId: z.string().uuid(),
  selectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  linesCreated: z.number().int().min(0),
  ordersCreated: z.number().int().min(0),
  orderItemsCreated: z.number().int().min(0),
  replacedLines: z.number().int().min(0).optional(),
  replacedOrders: z.number().int().min(0).optional(),
  replacedItems: z.number().int().min(0).optional(),
  appliedGroups: z.number().int().min(0),
  skippedGroups: z.number().int().min(0),
  skippedNegativeQuantityRows: z.number().int().min(0),
  skippedZeroQuantityRows: z.number().int().min(0),
  appliedTotalQuantity: z.number(),
  appliedItemLines: z.number().int().min(0),
  warningSummary: z.object({
    info: z.number().int().min(0),
    warning: z.number().int().min(0),
    blocking: z.number().int().min(0)
  }),
  warnings: z.array(manualShiftMonthlyWarningSchema),
  previewTotals: manualShiftMonthlyPreviewSchema.shape.totals,
  previewAnomalies: manualShiftMonthlyPreviewSchema.shape.anomalies
});
export type ManualShiftMonthlyApplyResponse = z.infer<typeof manualShiftMonthlyApplyResponseSchema>;

export const manualShiftMonthlyReplaceSafetySchema = z.object({
  canReplace: z.boolean(),
  activeLinesCount: z.number().int().min(0),
  activeOrdersCount: z.number().int().min(0),
  startedOrdersCount: z.number().int().min(0),
  assignedPickersCount: z.number().int().min(0),
  assignedCheckersCount: z.number().int().min(0),
  checkUnitsCount: z.number().int().min(0),
  nonImportEventsCount: z.number().int().min(0),
  blockReasons: z.array(z.string())
});
export type ManualShiftMonthlyReplaceSafety = z.infer<typeof manualShiftMonthlyReplaceSafetySchema>;

function normalizeTrimmedString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDateParts(day: number, month: number, year: number): string | null {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day;

  if (!isValid) {
    return null;
  }

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * Two-digit year policy: 00-69 → 2000-2069, 70-99 → 1970-1999.
 */
function resolveTwoDigitYear(yy: number): number {
  return yy >= 70 ? 1900 + yy : 2000 + yy;
}

function normalizeWorkbookDate(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return normalizeDateParts(
      value.getUTCDate(),
      value.getUTCMonth() + 1,
      value.getUTCFullYear()
    );
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    return normalizeDateParts(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  // YYYY/MM/DD
  match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(trimmed);
  if (match) {
    return normalizeDateParts(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  // DD/MM/YYYY
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (match) {
    return normalizeDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  // DD.MM.YYYY
  match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (match) {
    return normalizeDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  // DD/MM/YY (two-digit year)
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(trimmed);
  if (match) {
    return normalizeDateParts(Number(match[1]), Number(match[2]), resolveTwoDigitYear(Number(match[3])));
  }

  // DD.MM.YY (two-digit year)
  match = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/.exec(trimmed);
  if (match) {
    return normalizeDateParts(Number(match[1]), Number(match[2]), resolveTwoDigitYear(Number(match[3])));
  }

  return null;
}

function parseQuantity(value: string | number | null | undefined): number | null {
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

export const SPECIAL_FLOW_PATTERNS = [
  'איסוף', 'איסופים', 'איסוף מלקוח',
  'החזרה', 'החזרות',
  'זיכוי', 'זיכויים',
  'השלמה', 'אשלמה',
  'לא להפצה', 'לא משויך',
  'pickup', 'collection', 'return',
  'сбор',
] as const;

export function matchesSpecialFlowNotes(notes: string | null | undefined): boolean {
  if (!notes) return false;
  const lower = notes.toLowerCase();
  return SPECIAL_FLOW_PATTERNS.some(pattern => lower.includes(pattern.toLowerCase()));
}

export function findSpecialFlowPattern(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const lower = notes.toLowerCase();
  for (const pattern of SPECIAL_FLOW_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }
  return null;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, 'he');
}

export function deriveManualShiftOrderSourceZone(
  itemZones: Array<string | null | undefined>
): string | null {
  const distinctZones = Array.from(
    new Set(
      itemZones
        .map((value) => normalizeTrimmedString(value))
        .filter((value): value is string => value !== null)
    )
  );

  if (distinctZones.length !== 1) {
    return null;
  }

  return distinctZones[0] ?? null;
}

type WorkingRow = {
  rowIndex: number;
  normalizedDate: string | null;
  rawDate: string | null;
  lineName: string | null;
  pointName: string | null;
  orderNumber: string | null;
  sku: string | null;
  description: string | null;
  category: string | null;
  quantity: number | null;
  notes: string | null;
  rawDistributionValue: string | null;
  sourceZone: string | null;
  usedPointFallback: boolean;
  hadSlash: boolean;
  distributionArea: string | null;
  lineRawName: string | null;
  lineGroupName: string | null;
  lineBucketName: string | null;
  flowType: 'normal_distribution' | 'special_flow';
  customerName: string | null;
  rawRouteLine: string | null;
  routeBase: string | null;
  workBucketName: string | null;
  workBucketType: WorkBucketType | null;
};

function buildWorkingRow(row: ManualShiftMonthlyParsedRow): WorkingRow {
  const rawDistributionValue = normalizeTrimmedString(row.rawDistributionValue);
  const customerName = normalizeTrimmedString(row.customerName);
  const rawDate = normalizeTrimmedString(
    typeof row.distributionDateRaw === 'string'
      ? row.distributionDateRaw
      : row.distributionDateRaw instanceof Date
        ? row.distributionDateRaw.toISOString().slice(0, 10)
        : null
  );
  const normalizedDate = row.distributionDateNormalized ?? normalizeWorkbookDate(row.distributionDateRaw);

  let lineName: string | null = null;
  let pointName: string | null = null;
  let hadSlash = false;
  let usedPointFallback = false;
  let lineGroupName: string | null = null;
  let lineBucketName: string | null = null;
  let rawRouteLine: string | null = null;
  let routeBase: string | null = null;
  let workBucketName: string | null = null;
  let workBucketType: WorkBucketType | null = null;

  if (rawDistributionValue) {
    rawRouteLine = rawDistributionValue;
    const slashIndex = rawDistributionValue.indexOf('/');
    if (slashIndex >= 0) {
      hadSlash = true;
      lineName = normalizeTrimmedString(rawDistributionValue.slice(0, slashIndex));
      pointName = normalizeTrimmedString(rawDistributionValue.slice(slashIndex + 1));
      lineGroupName = lineName;
      lineBucketName = pointName;
      routeBase = lineName;
      workBucketName = pointName;
      workBucketType = 'unknown';
    } else {
      lineName = rawDistributionValue;
      pointName = rawDistributionValue;
      lineGroupName = rawDistributionValue;
      lineBucketName = rawDistributionValue;
      routeBase = rawDistributionValue;
      workBucketName = null;
      workBucketType = null;
    }
  }

  return {
    rowIndex: row.rowIndex,
    normalizedDate,
    rawDate,
    lineName,
    pointName,
    orderNumber: normalizeTrimmedString(row.orderNumber),
    sku: row.sku === null || row.sku === undefined ? null : normalizeTrimmedString(String(row.sku)),
    description: normalizeTrimmedString(row.description),
    category: normalizeTrimmedString(row.category),
    quantity: parseQuantity(row.quantity),
    notes: normalizeTrimmedString(row.notes),
    rawDistributionValue,
    sourceZone: normalizeTrimmedString(row.zone),
    usedPointFallback,
    hadSlash,
    distributionArea: normalizeTrimmedString(row.zone),
    lineRawName: rawDistributionValue,
    lineGroupName,
    lineBucketName,
    flowType: matchesSpecialFlowNotes(row.notes) ? 'special_flow' : 'normal_distribution',
    customerName,
    rawRouteLine,
    routeBase,
    workBucketName,
    workBucketType
  };
}

export { normalizeWorkbookDate, resolveTwoDigitYear };

export function parseManualShiftMonthlyPreview(
  rawInput: ParseManualShiftMonthlyPreviewInput
): ManualShiftMonthlyParseResult {
  const input = parseManualShiftMonthlyPreviewInputSchema.parse(rawInput);
  const workingRows = input.rows.map(buildWorkingRow);

  const availableDates = new Map<string, { raws: Set<string>; rows: number }>();
  const invalidDistributionDateRows: number[] = [];
  const invalidDateDetails: ManualShiftMonthlyInvalidDateDetail[] = [];
  const missingRequiredFields: ManualShiftMonthlyMissingField[] = [];
  const groups = new Map<string, ManualShiftMonthlyAggregatedGroup>();
  const topWarnings: ManualShiftMonthlyWarning[] = [];
  const lines = new Map<string, {
    distributionArea: string | null;
    lineGroupName: string | null;
    pointNames: Set<string>;
    orderNumbers: Set<string>;
    orderGroups: Set<string>;
    skus: Set<string>;
    itemRows: number;
    totalQuantity: number;
    negativeQuantityRows: number;
    anomalyCount: number;
    warningRows: number[];
  }>();

  let matchingRows = 0;
  let skippedOtherDateRows = 0;
  let negativeQuantityRows = 0;
  let nonSoOrderRows = 0;
  let rowsWithoutDistributionSlash = 0;
  let pointFallbackRows = 0;
  let pickupNoteRows = 0;
  let ashlamaNoteRows = 0;
  let specialFlowRowCount = 0;
  let rawTotalQuantity = 0;
  let positiveTotalQuantity = 0;
  let negativeTotalQuantity = 0;
  let zeroQuantityRowsCount = 0;
  let positiveQuantityRowsCount = 0;
  const rawDistributionValues = new Set<string>();
  const derivedPoints = new Set<string>();
  const uniqueOrderNumbers = new Set<string>();
  const uniqueSkus = new Set<string>();

  for (const row of workingRows) {
    if (row.normalizedDate) {
      const entry = availableDates.get(row.normalizedDate) ?? { raws: new Set<string>(), rows: 0 };
      if (row.rawDate) {
        entry.raws.add(row.rawDate);
      }
      entry.rows += 1;
      availableDates.set(row.normalizedDate, entry);
    }

    if (row.normalizedDate === input.selectedDate) {
      matchingRows += 1;
    } else if (row.normalizedDate) {
      skippedOtherDateRows += 1;
    }

    if (!row.normalizedDate) {
      invalidDistributionDateRows.push(row.rowIndex);
      invalidDateDetails.push({
        rowIndex: row.rowIndex,
        rawValue: row.rawDate,
        fieldName: 'תאריך הפצה',
        reason: 'invalid date format'
      });
    }

    if (row.normalizedDate !== input.selectedDate) {
      continue;
    }

    const missingFields: ManualShiftMonthlyMissingField['fields'] = [];
    if (!row.lineName) missingFields.push('line');
    if (!row.pointName) missingFields.push('point');
    if (!row.orderNumber) missingFields.push('orderNumber');
    if (!row.sku) missingFields.push('sku');
    if (row.quantity === null) missingFields.push('quantity');

    if (missingFields.length > 0) {
      missingRequiredFields.push({ rowIndex: row.rowIndex, fields: missingFields });
    }

    if (row.rawDistributionValue) {
      rawDistributionValues.add(row.rawDistributionValue);
      if (!row.hadSlash) {
        rowsWithoutDistributionSlash += 1;
      }
    }
    if (row.pointName) {
      derivedPoints.add(row.pointName);
    }
    if (row.usedPointFallback) {
      pointFallbackRows += 1;
    }
    if (row.orderNumber) {
      uniqueOrderNumbers.add(row.orderNumber);
      if (!/^SO/i.test(row.orderNumber)) {
        nonSoOrderRows += 1;
      }
    }
    if (row.sku) {
      uniqueSkus.add(row.sku);
    }
    if (row.notes?.includes('איסוף')) {
      pickupNoteRows += 1;
    }
    if (row.notes?.includes('השלמה')) {
      ashlamaNoteRows += 1;
    }
    if (row.flowType === 'special_flow') {
      specialFlowRowCount += 1;
    }
    if (row.quantity !== null) {
      rawTotalQuantity += row.quantity;
      if (row.quantity > 0) {
        positiveTotalQuantity += row.quantity;
        positiveQuantityRowsCount += 1;
      } else if (row.quantity < 0) {
        negativeQuantityRows += 1;
        negativeTotalQuantity += row.quantity;
      } else {
        zeroQuantityRowsCount += 1;
      }
    }

    if (!row.lineName || !row.pointName || !row.orderNumber || !row.sku || row.quantity === null) {
      continue;
    }

    const groupKey = [
      row.normalizedDate,
      row.lineName,
      row.pointName,
      row.orderNumber,
      row.sourceZone ?? '',
      row.sku
    ].join('\u0001');

    const existingGroup = groups.get(groupKey);
    if (existingGroup) {
      existingGroup.totalQuantity += row.quantity;
      existingGroup.sourceRows.push(row.rowIndex);
      existingGroup.rows.push({
        rowIndex: row.rowIndex,
        quantity: row.quantity,
        notes: row.notes
      });
      if (row.notes) {
        existingGroup.notes.push(row.notes);
      }
      existingGroup.hasNegativeQuantity = existingGroup.hasNegativeQuantity || row.quantity < 0;
      existingGroup.isNonDistributionRow = existingGroup.isNonDistributionRow || row.flowType === 'special_flow';
    } else {
      groups.set(groupKey, {
        normalizedDate: row.normalizedDate,
        lineName: row.lineName,
        pointName: row.pointName,
        orderNumber: row.orderNumber,
        sku: row.sku,
        description: row.description,
        category: row.category,
        totalQuantity: row.quantity,
        notes: row.notes ? [row.notes] : [],
        sourceRows: [row.rowIndex],
        rows: [{
          rowIndex: row.rowIndex,
          quantity: row.quantity,
          notes: row.notes
        }],
        hasNegativeQuantity: row.quantity < 0,
        distributionArea: row.distributionArea,
        lineRawName: row.lineRawName,
        lineGroupName: row.lineGroupName,
        lineBucketName: row.lineBucketName,
        isNonDistributionRow: row.flowType === 'special_flow',
        customerName: row.customerName,
        rawRouteLine: row.rawRouteLine,
        routeBase: row.routeBase,
        workBucketName: row.workBucketName,
        workBucketType: row.workBucketType,
        sourceZone: row.sourceZone
      });
    }

    const lineEntry = lines.get(row.lineName) ?? {
      distributionArea: row.distributionArea,
      lineGroupName: row.lineGroupName,
      pointNames: new Set<string>(),
      orderNumbers: new Set<string>(),
      orderGroups: new Set<string>(),
      skus: new Set<string>(),
      itemRows: 0,
      totalQuantity: 0,
      negativeQuantityRows: 0,
      anomalyCount: 0,
      warningRows: []
    };
    lineEntry.distributionArea ??= row.distributionArea;
    lineEntry.lineGroupName ??= row.lineGroupName;

    lineEntry.itemRows += 1;
    lineEntry.pointNames.add(row.pointName);
    lineEntry.orderNumbers.add(row.orderNumber);
    lineEntry.orderGroups.add(`${row.sourceZone ?? ''}\u0001${row.pointName}\u0001${row.orderNumber}`);
    lineEntry.skus.add(row.sku);
    lineEntry.totalQuantity += row.quantity;

    let rowAnomalyCount = 0;
    if (row.quantity < 0) {
      lineEntry.negativeQuantityRows += 1;
      rowAnomalyCount += 1;
    }
    if (row.notes?.includes('איסוף')) rowAnomalyCount += 1;
    if (row.notes?.includes('השלמה')) rowAnomalyCount += 1;
    if (row.orderNumber && !/^SO/i.test(row.orderNumber)) rowAnomalyCount += 1;
    if (rowAnomalyCount > 0) {
      lineEntry.anomalyCount += rowAnomalyCount;
      lineEntry.warningRows.push(row.rowIndex);
    }

    lines.set(row.lineName, lineEntry);
  }

  const availableDateList = Array.from(availableDates.entries())
    .map(([normalized, entry]) => ({
      normalized,
      raw: Array.from(entry.raws).sort(compareStrings)[0] ?? normalized,
      rows: entry.rows
    }))
    .sort((a, b) => compareStrings(a.normalized, b.normalized));

  const selectedDateRaw = availableDateList.find((entry) => entry.normalized === input.selectedDate)?.raw ?? null;

  if (missingRequiredFields.length > 0) {
    topWarnings.push({
      severity: 'blocking',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'Selected-date rows with missing required fields were found in the workbook preview.',
      count: missingRequiredFields.length,
      rows: missingRequiredFields.map((entry) => entry.rowIndex).sort((a, b) => a - b)
    });
  }

  if (invalidDistributionDateRows.length > 0) {
    topWarnings.push({
      severity: 'blocking',
      code: 'INVALID_DISTRIBUTION_DATE_ROWS',
      message: 'Meaningful rows with missing or invalid distribution date could not be classified.',
      count: invalidDistributionDateRows.length,
      rows: invalidDistributionDateRows.slice().sort((a, b) => a - b)
    });
  }

  if (!selectedDateRaw) {
    topWarnings.push({
      severity: 'blocking',
      code: 'SELECTED_DATE_NOT_FOUND',
      message: `Selected date ${input.selectedDate} was not found in the workbook.`,
      count: 0
    });
  }

  if (negativeQuantityRows > 0) {
    topWarnings.push({
      severity: 'warning',
      code: 'NEGATIVE_QUANTITY_ROWS',
      message: 'Negative quantity rows are present in the preview and require manual handling later.',
      count: negativeQuantityRows
    });
  }

  if (nonSoOrderRows > 0) {
    topWarnings.push({
      severity: 'warning',
      code: 'NON_SO_ORDER_ROWS',
      message: 'Order values not starting with SO are present in the preview.',
      count: nonSoOrderRows
    });
  }

  if (specialFlowRowCount > 0) {
    topWarnings.push({
      severity: 'info',
      code: 'SPECIAL_FLOW_ROWS_DETECTED',
      message: `${specialFlowRowCount} special-flow row(s) detected (collection/pickup/return/ashlama). These will be excluded from normal distribution import.`,
      count: specialFlowRowCount
    });
  }

  const lineSummaries = Array.from(lines.entries())
    .map(([lineName, entry]) => {
      const warnings: ManualShiftMonthlyWarning[] = [];
      if (entry.negativeQuantityRows > 0) {
        warnings.push({
          severity: 'warning',
          code: 'NEGATIVE_QUANTITY_ROWS',
          message: 'Line contains rows with negative quantity values.',
          count: entry.negativeQuantityRows
        });
      }
      if (entry.warningRows.length > 0) {
        warnings.push({
          severity: 'warning',
          code: 'LINE_ANOMALIES',
          message: 'Line contains preview anomalies that require review.',
          count: entry.warningRows.length,
          rows: entry.warningRows.sort((a, b) => a - b)
        });
      }

      return {
        lineName,
        distributionArea: entry.distributionArea,
        lineGroupName: entry.lineGroupName,
        points: entry.pointNames.size,
        uniqueOrderNumbers: entry.orderNumbers.size,
        orderGroups: entry.orderGroups.size,
        itemRows: entry.itemRows,
        aggregatedSkuGroups: Array.from(groups.values()).filter((group) => group.lineName === lineName).length,
        uniqueSkus: entry.skus.size,
        totalQuantity: entry.totalQuantity,
        negativeQuantityRows: entry.negativeQuantityRows,
        anomalyCount: entry.anomalyCount,
        warnings
      };
    })
    .sort((a, b) => compareStrings(a.lineName, b.lineName));

  const groupList = Array.from(groups.values()).sort((a, b) => (
    compareStrings(a.normalizedDate, b.normalizedDate) ||
    compareStrings(a.lineName, b.lineName) ||
    compareStrings(a.pointName, b.pointName) ||
    compareStrings(a.orderNumber, b.orderNumber) ||
    compareStrings(a.sku, b.sku)
  ));

  const totalQuantity = groupList.reduce((sum, group) => sum + group.totalQuantity, 0);
  const orderGroups = new Set(groupList.map((group) => `${group.lineName}\u0001${group.pointName}\u0001${group.orderNumber}`));

  return manualShiftMonthlyParseResultSchema.parse({
    preview: {
      source: input.source,
      selectedDate: {
        raw: selectedDateRaw,
        normalized: input.selectedDate
      },
      dateSummary: {
        totalRows: input.rows.length,
        matchingRows,
        skippedOtherDateRows,
        availableDates: availableDateList
      },
      totals: {
        lines: lineSummaries.length,
        rawDistributionValues: rawDistributionValues.size,
        derivedPoints: derivedPoints.size,
        uniqueOrderNumbers: uniqueOrderNumbers.size,
        orderGroups: orderGroups.size,
        skuRows: matchingRows,
        aggregatedSkuGroups: groupList.length,
        uniqueSkus: uniqueSkus.size,
        totalQuantity,
        rawTotalQuantity,
        positiveTotalQuantity,
        negativeTotalQuantity,
        zeroQuantityRowsCount,
        negativeQuantityRowsCount: negativeQuantityRows,
        positiveQuantityRowsCount
      },
      anomalies: {
        negativeQuantityRows,
        nonSoOrderRows,
        rowsWithoutDistributionSlash,
        pointFallbackRows,
        pickupNoteRows,
        ashlamaNoteRows,
        specialFlowRowCount,
        invalidDistributionDateRows: invalidDistributionDateRows.sort((a, b) => a - b),
        invalidDateDetails,
        missingRequiredFields
      },
      lines: lineSummaries,
      warnings: topWarnings
    },
    groups: groupList.map((group) => ({
      ...group,
      notes: Array.from(new Set(group.notes)).sort(compareStrings),
      sourceRows: Array.from(new Set(group.sourceRows)).sort((a, b) => a - b)
    }))
  });
}

export function planManualShiftMonthlyImportApply(
  parsed: ManualShiftMonthlyParseResult
): ManualShiftMonthlyApplyPlan {
  const blockingWarnings = parsed.preview.warnings.filter((warning) => warning.severity === 'blocking');
  const warningSummary = {
    info: parsed.preview.warnings.filter((warning) => warning.severity === 'info').length,
    warning: parsed.preview.warnings.filter((warning) => warning.severity === 'warning').length,
    blocking: blockingWarnings.length
  };

  const byLine = new Map<string, {
    orders: Map<string, ManualShiftMonthlyApplyOrder>;
    distributionArea: string | null;
    lineGroupName: string | null;
  }>();
  let appliedGroups = 0;
  let skippedGroups = 0;
  let skippedNegativeQuantityRows = 0;
  let skippedZeroQuantityRows = 0;
  let appliedTotalQuantity = 0;
  let appliedItemLines = 0;
  let skusWithDuplicateRows = 0;
  let customerNameConflicts = 0;
  const excludedSpecialFlowRows: Array<{
    rowIndex: number;
    quantity: number;
    notes: string | null;
    orderNumber: string;
    customerName: string | null;
    sku: string;
    matchedMarker: string | null;
  }> = [];

  for (const group of parsed.groups) {
    const negativeRows = group.rows.filter((row) => row.quantity < 0);
    const zeroRows = group.rows.filter((row) => row.quantity === 0);
    const allPositiveRows = group.rows.filter((row) => row.quantity > 0);

    skippedNegativeQuantityRows += negativeRows.length;
    skippedZeroQuantityRows += zeroRows.length;

    const specialFlowPositiveRows = allPositiveRows.filter(row => matchesSpecialFlowNotes(row.notes));
    const normalPositiveRows = allPositiveRows.filter(row => !matchesSpecialFlowNotes(row.notes));

    for (const sfRow of specialFlowPositiveRows) {
      excludedSpecialFlowRows.push({
        rowIndex: sfRow.rowIndex,
        quantity: sfRow.quantity,
        notes: sfRow.notes,
        orderNumber: group.orderNumber,
        customerName: group.customerName ?? null,
        sku: group.sku,
        matchedMarker: findSpecialFlowPattern(sfRow.notes)
      });
    }

    if (normalPositiveRows.length === 0) {
      skippedGroups += 1;
      continue;
    }

    if (normalPositiveRows.length > 1) {
      skusWithDuplicateRows += 1;
    }

    appliedGroups += 1;
    let lineEntry = byLine.get(group.lineName);
    if (!lineEntry) {
      lineEntry = {
        orders: new Map<string, ManualShiftMonthlyApplyOrder>(),
        distributionArea: group.distributionArea,
        lineGroupName: group.lineGroupName
      };
      byLine.set(group.lineName, lineEntry);
    }
    const lineOrders = lineEntry.orders;

    const sourceZone = group.sourceZone ?? null;
    const orderKey = [
      sourceZone ?? '',
      group.routeBase ?? group.rawRouteLine ?? group.lineName,
      group.pointName,
      group.orderNumber
    ].join('\u0001');
    const existingOrder = lineOrders.get(orderKey);
    const sourceRows = normalPositiveRows.map((row) => row.rowIndex).sort((a, b) => a - b);
    const itemNotes = Array.from(
      new Set(normalPositiveRows.flatMap((row) => (row.notes ? [row.notes] : [])))
    );
    const itemQuantity = normalPositiveRows.reduce((sum, row) => sum + row.quantity, 0);
    appliedTotalQuantity += itemQuantity;
    appliedItemLines += 1;
    const item = {
      sku: group.sku,
      description: group.description,
      category: group.category,
      quantity: itemQuantity,
      notes: itemNotes.length > 0 ? itemNotes.join('\n') : null,
      sourceRows,
      sortOrder: existingOrder ? existingOrder.items.length + 1 : 1,
      zone: sourceZone
    };

    if (existingOrder) {
      const groupCust = group.customerName ?? null;
      const existingCust = existingOrder.customerName ?? null;
      if (groupCust && existingCust && groupCust !== existingCust) {
        existingOrder.customerName = null;
        customerNameConflicts += 1;
      }
      existingOrder.items.push(item);
      existingOrder.totalQuantity += itemQuantity;
      existingOrder.sourceRows = Array.from(
        new Set([...existingOrder.sourceRows, ...sourceRows])
      ).sort((a, b) => a - b);
      continue;
    }

    lineOrders.set(orderKey, {
      pointName: group.pointName,
      customerName: group.customerName ?? null,
      orderNumber: group.orderNumber,
      totalQuantity: itemQuantity,
      sourceRows,
      sortOrder: lineOrders.size + 1,
      items: [item],
      workBucketName: group.workBucketName,
      workBucketType: group.workBucketType,
      rawRouteLine: group.rawRouteLine,
      routeBase: group.routeBase,
      sourceZone
    });
  }

  const lines = Array.from(byLine.entries())
    .map(([lineName, lineEntry]) => ({
      lineName,
      distributionArea: lineEntry.distributionArea,
      lineGroupName: lineEntry.lineGroupName,
      sortOrder: 0,
      orders: Array.from(lineEntry.orders.values())
        .sort((a, b) =>
          compareStrings(a.pointName, b.pointName) ||
          compareStrings(a.orderNumber, b.orderNumber)
        )
        .map((order, orderIndex) => ({
          ...order,
          sortOrder: orderIndex + 1,
          sourceRows: Array.from(new Set(order.sourceRows)).sort((a, b) => a - b),
          items: order.items
            .slice()
            .sort((a, b) => compareStrings(a.sku, b.sku))
            .map((item, itemIndex) => ({
              ...item,
              sortOrder: itemIndex + 1,
              sourceRows: Array.from(new Set(item.sourceRows)).sort((a, b) => a - b)
            }))
        }))
    }))
    .sort((a, b) => compareStrings(a.lineName, b.lineName))
    .map((line, lineIndex) => ({
      ...line,
      sortOrder: lineIndex + 1
    }));

  if (customerNameConflicts > 0) {
    parsed.preview.warnings.push({
      severity: 'warning',
      code: 'CUSTOMER_NAME_CONFLICTS',
      message: `${customerNameConflicts} order(s) had conflicting customer names across grouped rows. Customer name will not be stored for those orders.`,
      count: customerNameConflicts
    });
    warningSummary.warning += 1;
  }

  if (skippedNegativeQuantityRows > 0) {
    parsed.preview.warnings.push({
      severity: 'info',
      code: 'NEGATIVE_QUANTITY_ROWS_SKIPPED_ON_APPLY',
      message: `${skippedNegativeQuantityRows} negative quantity row(s) will be skipped and not applied to the work hierarchy.`,
      count: skippedNegativeQuantityRows
    });
    warningSummary.info += 1;
  }

  if (skippedZeroQuantityRows > 0) {
    parsed.preview.warnings.push({
      severity: 'info',
      code: 'ZERO_QUANTITY_ROWS_SKIPPED_ON_APPLY',
      message: `${skippedZeroQuantityRows} zero quantity row(s) will be skipped and not applied to the work hierarchy.`,
      count: skippedZeroQuantityRows
    });
    warningSummary.info += 1;
  }

  if (skusWithDuplicateRows > 0) {
    parsed.preview.warnings.push({
      severity: 'info',
      code: 'DUPLICATE_SKU_ROWS_AGGREGATED',
      message: `${skusWithDuplicateRows} SKU(s) had duplicate rows that were aggregated into single item lines.`,
      count: skusWithDuplicateRows
    });
    warningSummary.info += 1;
  }

  if (excludedSpecialFlowRows.length > 0) {
    const affectedOrders = [...new Set(excludedSpecialFlowRows.map(r => r.orderNumber))];
    parsed.preview.warnings.push({
      severity: 'info',
      code: 'SPECIAL_FLOW_ROW_EXCLUDED_FROM_DISTRIBUTION_IMPORT',
      message: `${excludedSpecialFlowRows.length} special-flow row(s) excluded from normal distribution import. Affected orders: ${affectedOrders.join(', ')}. These rows contain collection/pickup/return/ashlama markers and will not create manual shift orders. Source rows: ${excludedSpecialFlowRows.map(r => `#${r.rowIndex} (order ${r.orderNumber}, SKU ${r.sku}, qty ${r.quantity}, marker: ${r.matchedMarker ?? 'unknown'})`).join('; ')}.`,
      count: excludedSpecialFlowRows.length,
      rows: excludedSpecialFlowRows.map(r => r.rowIndex).sort((a, b) => a - b)
    });
    warningSummary.info += 1;
  }

  const rawTotalQty = parsed.preview.totals.rawTotalQuantity;
  if (appliedTotalQuantity !== rawTotalQty) {
    parsed.preview.warnings.push({
      severity: 'info',
      code: 'APPLIED_TOTAL_DIFFERS_FROM_RAW_TOTAL',
      message: `Applied total quantity (${appliedTotalQuantity}) differs from raw Excel total (${rawTotalQty}). This is expected when negative or zero quantity rows are excluded.`,
      count: 0
    });
    warningSummary.info += 1;
  }

  return manualShiftMonthlyApplyPlanSchema.parse({
    preview: parsed.preview,
    lines,
    appliedGroups,
    skippedGroups,
    skippedNegativeQuantityRows,
    skippedZeroQuantityRows,
    appliedTotalQuantity,
    appliedItemLines,
    warningSummary,
    blockingWarnings
  });
}
