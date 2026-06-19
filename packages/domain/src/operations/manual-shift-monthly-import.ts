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
    totalQuantity: z.number()
  }),
  anomalies: z.object({
    negativeQuantityRows: z.number().int().min(0),
    nonSoOrderRows: z.number().int().min(0),
    rowsWithoutDistributionSlash: z.number().int().min(0),
    pointFallbackRows: z.number().int().min(0),
    pickupNoteRows: z.number().int().min(0),
    ashlamaNoteRows: z.number().int().min(0),
    invalidDistributionDateRows: z.array(z.number().int().min(1)),
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
  isPickupRow: z.boolean(),
  customerName: z.string().nullable().optional(),
  rawRouteLine: z.string().nullable(),
  routeBase: z.string().nullable(),
  workBucketName: z.string().nullable(),
  workBucketType: workBucketTypeSchema.nullable()
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
  const normalizedIsoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (normalizedIsoMatch) {
    return normalizeDateParts(
      Number(normalizedIsoMatch[3]),
      Number(normalizedIsoMatch[2]),
      Number(normalizedIsoMatch[1])
    );
  }

  const shortDateMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/.exec(trimmed);
  if (shortDateMatch) {
    return normalizeDateParts(
      Number(shortDateMatch[1]),
      Number(shortDateMatch[2]),
      2000 + Number(shortDateMatch[3])
    );
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

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, 'he');
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
  usedPointFallback: boolean;
  hadSlash: boolean;
  distributionArea: string | null;
  lineRawName: string | null;
  lineGroupName: string | null;
  lineBucketName: string | null;
  isPickupRow: boolean;
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
    usedPointFallback,
    hadSlash,
    distributionArea: normalizeTrimmedString(row.zone),
    lineRawName: rawDistributionValue,
    lineGroupName,
    lineBucketName,
    isPickupRow: (normalizeTrimmedString(row.notes)?.includes('איסוף')) ?? false,
    customerName,
    rawRouteLine,
    routeBase,
    workBucketName,
    workBucketType
  };
}

export function parseManualShiftMonthlyPreview(
  rawInput: ParseManualShiftMonthlyPreviewInput
): ManualShiftMonthlyParseResult {
  const input = parseManualShiftMonthlyPreviewInputSchema.parse(rawInput);
  const workingRows = input.rows.map(buildWorkingRow);

  const availableDates = new Map<string, { raws: Set<string>; rows: number }>();
  const invalidDistributionDateRows: number[] = [];
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
    if (row.quantity !== null && row.quantity < 0) {
      negativeQuantityRows += 1;
    }

    if (!row.lineName || !row.pointName || !row.orderNumber || !row.sku || row.quantity === null) {
      continue;
    }

    const groupKey = [
      row.normalizedDate,
      row.lineName,
      row.pointName,
      row.orderNumber,
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
        isPickupRow: row.isPickupRow,
        customerName: row.customerName,
        rawRouteLine: row.rawRouteLine,
        routeBase: row.routeBase,
        workBucketName: row.workBucketName,
        workBucketType: row.workBucketType
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
    lineEntry.orderGroups.add(`${row.pointName}\u0001${row.orderNumber}`);
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
        totalQuantity
      },
      anomalies: {
        negativeQuantityRows,
        nonSoOrderRows,
        rowsWithoutDistributionSlash,
        pointFallbackRows,
        pickupNoteRows,
        ashlamaNoteRows,
        invalidDistributionDateRows: invalidDistributionDateRows.sort((a, b) => a - b),
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
  let customerNameConflicts = 0;

  for (const group of parsed.groups) {
    const positiveRows = group.rows.filter((row) => row.quantity > 0);
    const negativeRows = group.rows.filter((row) => row.quantity < 0);
    const zeroRows = group.rows.filter((row) => row.quantity === 0);

    skippedNegativeQuantityRows += negativeRows.length;
    skippedZeroQuantityRows += zeroRows.length;

    if (positiveRows.length === 0) {
      skippedGroups += 1;
      continue;
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

    const orderKey = `${group.pointName}\u0001${group.orderNumber}`;
    const existingOrder = lineOrders.get(orderKey);
    const sourceRows = positiveRows.map((row) => row.rowIndex).sort((a, b) => a - b);
    const itemNotes = Array.from(
      new Set(positiveRows.flatMap((row) => (row.notes ? [row.notes] : [])))
    );
    const itemQuantity = positiveRows.reduce((sum, row) => sum + row.quantity, 0);
    const item = {
      sku: group.sku,
      description: group.description,
      category: group.category,
      quantity: itemQuantity,
      notes: itemNotes.length > 0 ? itemNotes.join('\n') : null,
      sourceRows,
      sortOrder: existingOrder ? existingOrder.items.length + 1 : 1,
      zone: group.distributionArea
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
      routeBase: group.routeBase
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

  return manualShiftMonthlyApplyPlanSchema.parse({
    preview: parsed.preview,
    lines,
    appliedGroups,
    skippedGroups,
    skippedNegativeQuantityRows,
    skippedZeroQuantityRows,
    warningSummary,
    blockingWarnings
  });
}
