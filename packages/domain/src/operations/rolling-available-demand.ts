import { z } from 'zod';

// ──── Status ──────────────────────────────────────────────────────────────────

export const rollingAvailableDemandItemStatusSchema = z.enum([
  'available',
  'fully_consumed',
  'duplicate_conflict',
  'over_published',
  'requires_review',
  'excluded_non_so'
]);
export type RollingAvailableDemandItemStatus = z.infer<typeof rollingAvailableDemandItemStatusSchema>;

// ──── Warning codes ───────────────────────────────────────────────────────────

export const rollingAvailableDemandWarningSchema = z.enum([
  'missing_planned_delivery_date'
]);
export type RollingAvailableDemandWarning = z.infer<typeof rollingAvailableDemandWarningSchema>;

// ──── Fallback key V1 ─────────────────────────────────────────────────────────

const FALLBACK_KEY_V1_PREFIX = 'fallback-v1';
const FALLBACK_KEY_SEP = '\x00';

export type FallbackKeyV1 = [
  typeof FALLBACK_KEY_V1_PREFIX,
  string,
  string,
  string,
  string,
  string | null
];

export function computeFallbackKeyV1(
  orderNumber: string | null,
  sku: string | null,
  customerName: string | null,
  distributionArea: string | null,
  plannedDeliveryDate: string | null
): FallbackKeyV1 {
  return [
    FALLBACK_KEY_V1_PREFIX,
    (orderNumber ?? '').trim(),
    (sku ?? '').trim(),
    (customerName ?? '').trim(),
    (distributionArea ?? '').trim(),
    plannedDeliveryDate ?? null
  ];
}

export function fallbackKeyV1ToString(key: FallbackKeyV1): string {
  return key.join(FALLBACK_KEY_SEP);
}

export async function computeFallbackKeyV1Fingerprint(key: FallbackKeyV1): Promise<string> {
  const data = new TextEncoder().encode(fallbackKeyV1ToString(key));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ──── Diagnostics per item ────────────────────────────────────────────────────

export const rollingAvailableDemandItemDiagnosticsSchema = z.object({
  batchCount: z.number().int().min(0),
  batchIds: z.array(z.string().uuid()),
  hasMultipleBatches: z.boolean(),
  occurrenceCount: z.number().int().min(0)
});
export type RollingAvailableDemandItemDiagnostics = z.infer<typeof rollingAvailableDemandItemDiagnosticsSchema>;

// ──── Response row ────────────────────────────────────────────────────────────

export const rollingAvailableDemandItemSchema = z.object({
  fallbackKey: z.tuple([
    z.literal(FALLBACK_KEY_V1_PREFIX),
    z.string(),
    z.string(),
    z.string(),
    z.string(),
    z.string().nullable()
  ]),
  fallbackKeyFingerprint: z.string().min(1),
  status: rollingAvailableDemandItemStatusSchema,
  latestRawDemandRowId: z.string().uuid().nullable(),
  conflictingRawDemandRowIds: z.array(z.string().uuid()),
  latestBatchId: z.string().uuid(),
  latestBatchUploadedAt: z.string().datetime({ offset: true }),
  latestQuantity: z.number().nullable(),
  publishedQuantity: z.number().min(0),
  availableQuantity: z.number(),
  orderNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  sku: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  distributionArea: z.string().nullable(),
  rawRouteLine: z.string().nullable(),
  plannedDeliveryDate: z.string().nullable(),
  notes: z.string().nullable(),
  warnings: z.array(rollingAvailableDemandWarningSchema),
  diagnostics: rollingAvailableDemandItemDiagnosticsSchema
});
export type RollingAvailableDemandItem = z.infer<typeof rollingAvailableDemandItemSchema>;

// ──── Summary ─────────────────────────────────────────────────────────────────

export const rollingAvailableDemandSummarySchema = z.object({
  totalRows: z.number().int().min(0),
  totalAvailableQuantity: z.number().min(0),
  byStatus: z.object({
    available: z.number().int().min(0),
    fullyConsumed: z.number().int().min(0),
    duplicateConflict: z.number().int().min(0),
    overPublished: z.number().int().min(0),
    requiresReview: z.number().int().min(0),
    excludedNonSo: z.number().int().min(0)
  })
});
export type RollingAvailableDemandSummary = z.infer<typeof rollingAvailableDemandSummarySchema>;

// ──── Batch info for diagnostics ──────────────────────────────────────────────

export const rollingAvailableDemandBatchInfoSchema = z.object({
  batchId: z.string().uuid(),
  sourceFile: z.string().min(1),
  uploadedAt: z.string().datetime({ offset: true }),
  status: z.string().min(1),
  rowsInBatch: z.number().int().min(0)
});
export type RollingAvailableDemandBatchInfo = z.infer<typeof rollingAvailableDemandBatchInfoSchema>;

// ──── Top-level diagnostics ───────────────────────────────────────────────────

export const rollingAvailableDemandDiagnosticsSchema = z.object({
  totalBatches: z.number().int().min(0),
  totalRawRows: z.number().int().min(0),
  totalFallbackKeys: z.number().int().min(0),
  batchesAnalyzed: z.array(rollingAvailableDemandBatchInfoSchema)
});
export type RollingAvailableDemandDiagnostics = z.infer<typeof rollingAvailableDemandDiagnosticsSchema>;

// ──── Full response ───────────────────────────────────────────────────────────

export const rollingAvailableDemandResponseSchema = z.object({
  summary: rollingAvailableDemandSummarySchema,
  rows: z.array(rollingAvailableDemandItemSchema),
  warnings: z.array(z.string()),
  diagnostics: rollingAvailableDemandDiagnosticsSchema
});
export type RollingAvailableDemandResponse = z.infer<typeof rollingAvailableDemandResponseSchema>;

// ──── Input types for the resolver ───────────────────────────────────────────

export type RollingResolverBatch = {
  id: string;
  sourceFile: string;
  uploadedAt: string;
  status: string;
  rowsCount: number;
};

export type RollingResolverRawRow = {
  id: string;
  batchId: string;
  orderNumber: string | null;
  customerName: string | null;
  sku: string | null;
  description: string | null;
  category: string | null;
  quantity: number | null;
  notes: string | null;
  distributionArea: string | null;
  rawRouteLine: string | null;
  plannedDeliveryDate: string | null;
  planningStatus: string;
  routeFlow: string;
  productHandlingFlow: string;
};

export type RollingResolverPublishedAllocation = {
  rawDemandRowId: string;
  publishedQuantity: number;
  publicationStatus: 'applied' | 'reverted' | null;
  orderNumber: string | null;
  sku: string | null;
  customerName: string | null;
  distributionArea: string | null;
  plannedDeliveryDate: string | null;
};

// ──── Non-SO patterns ────────────────────────────────────────────────────────

const NON_SO_PATTERNS: readonly string[] = [
  'תעודה קיימת',
  'איסוף בלבד'
];

const SO_ORDER_REGEX = /^SO[0-9]+$/;

function isNonSoOrderNumber(orderNumber: string | null): boolean {
  if (!orderNumber || orderNumber.trim() === '') return true;
  const trimmed = orderNumber.trim();
  if (NON_SO_PATTERNS.includes(trimmed)) return true;
  if (!SO_ORDER_REGEX.test(trimmed)) return true;
  return false;
}

function isExcludedPlanningStatus(status: string): boolean {
  return status === 'error' || status === 'excluded' || status === 'special_flow';
}

function isInvalidQuantity(qty: number | null): boolean {
  return qty === null || qty < 0;
}

// ──── Main resolver ──────────────────────────────────────────────────────────

export type RawRowKeyPair = {
  key: FallbackKeyV1;
  row: RollingResolverRawRow;
};

export type BatchKeyRows = {
  batchId: string;
  uploadedAt: string;
  rows: RawRowKeyPair[];
};

export type KeyGroup = {
  key: FallbackKeyV1;
  batches: BatchKeyRows[];
};

export async function resolveRollingAvailableDemandV1(
  allBatches: RollingResolverBatch[],
  allRows: RollingResolverRawRow[],
  allPublishedAllocations: RollingResolverPublishedAllocation[]
): Promise<RollingAvailableDemandResponse> {
  const readyBatches = allBatches
    .filter(b => b.status === 'ready')
    .sort((a, b) => {
      const dateCmp = b.uploadedAt.localeCompare(a.uploadedAt);
      if (dateCmp !== 0) return dateCmp;
      return b.id.localeCompare(a.id);
    });
  const readyBatchIds = new Set(readyBatches.map(b => b.id));

  const batchMap = new Map<string, RollingResolverBatch>();
  for (const b of readyBatches) {
    batchMap.set(b.id, b);
  }

  const readyRows = allRows.filter(r => readyBatchIds.has(r.batchId));

  const batchesAnalyzed = readyBatches.map(b => {
    const cnt = readyRows.filter(r => r.batchId === b.id).length;
    return {
      batchId: b.id,
      sourceFile: b.sourceFile,
      uploadedAt: b.uploadedAt,
      status: b.status,
      rowsInBatch: cnt
    };
  });

  const keyedRows = readyRows.map(row => ({
    key: computeFallbackKeyV1(
      row.orderNumber,
      row.sku,
      row.customerName,
      row.distributionArea,
      row.plannedDeliveryDate
    ),
    row
  }));

  const keyFingerprintCache = new Map<string, string>();
  async function getFingerprint(key: FallbackKeyV1): Promise<string> {
    const str = fallbackKeyV1ToString(key);
    const cached = keyFingerprintCache.get(str);
    if (cached) return cached;
    const fp = await computeFallbackKeyV1Fingerprint(key);
    keyFingerprintCache.set(str, fp);
    return fp;
  }

  const groups = new Map<string, RawRowKeyPair[]>();
  for (const kr of keyedRows) {
    const keyStr = fallbackKeyV1ToString(kr.key);
    const list = groups.get(keyStr) ?? [];
    list.push(kr);
    groups.set(keyStr, list);
  }

  const keyGroups: KeyGroup[] = [];
  for (const [, members] of groups) {
    const batchGroups = new Map<string, { uploadedAt: string; rows: RawRowKeyPair[] }>();
    for (const m of members) {
      const bg = batchGroups.get(m.row.batchId) ?? { uploadedAt: batchMap.get(m.row.batchId)?.uploadedAt ?? '', rows: [] };
      bg.rows.push(m);
      batchGroups.set(m.row.batchId, bg);
    }
    const sortedBatches: BatchKeyRows[] = [...batchGroups.entries()]
      .map(([batchId, bg]) => ({
        batchId,
        uploadedAt: bg.uploadedAt,
        rows: bg.rows
      }))
      .sort((a, b) => {
        const dateCmp = b.uploadedAt.localeCompare(a.uploadedAt);
        if (dateCmp !== 0) return dateCmp;
        return b.batchId.localeCompare(a.batchId);
      });

    keyGroups.push({
      key: members[0].key,
      batches: sortedBatches
    });
  }

  // Published quantity per fallback key
  const publishedQtyByKey = new Map<string, number>();
  for (const alloc of allPublishedAllocations) {
    if (alloc.publicationStatus === 'reverted') continue;
    const allocKey = computeFallbackKeyV1(
      alloc.orderNumber,
      alloc.sku,
      alloc.customerName,
      alloc.distributionArea,
      alloc.plannedDeliveryDate
    );
    const keyStr = fallbackKeyV1ToString(allocKey);
    publishedQtyByKey.set(keyStr, (publishedQtyByKey.get(keyStr) ?? 0) + Number(alloc.publishedQuantity ?? 0));
  }

  const rows_out: RollingAvailableDemandItem[] = [];
  const globalWarnings = new Set<string>();

  for (const group of keyGroups) {
    const keyStr = fallbackKeyV1ToString(group.key);
    const fingerprint = await getFingerprint(group.key);
    const publishedQuantity = publishedQtyByKey.get(keyStr) ?? 0;

    const rowWarnings: RollingAvailableDemandWarning[] = [];
    const allOccurrences = group.batches.flatMap(b => b.rows.map(r => r.row));
    const occurrenceCount = allOccurrences.length;
    const batchIds = group.batches.map(b => b.batchId);
    const hasMultipleBatches = group.batches.length > 1;

    const newestBatch = group.batches[0];
    if (!newestBatch) continue;

    if (newestBatch.rows.length > 1) {
      // Duplicate conflict: multiple occurrences of same key in newest batch
      const sampleRow = newestBatch.rows[0].row;
      const conflictingIds = newestBatch.rows.map(r => r.row.id);
      rows_out.push({
        fallbackKey: group.key,
        fallbackKeyFingerprint: fingerprint,
        status: 'duplicate_conflict',
        latestRawDemandRowId: null,
        conflictingRawDemandRowIds: conflictingIds,
        latestBatchId: newestBatch.batchId,
        latestBatchUploadedAt: newestBatch.uploadedAt,
        latestQuantity: null,
        publishedQuantity,
        availableQuantity: -publishedQuantity,
        orderNumber: sampleRow.orderNumber,
        customerName: sampleRow.customerName,
        sku: sampleRow.sku,
        description: sampleRow.description,
        category: sampleRow.category,
        distributionArea: sampleRow.distributionArea,
        rawRouteLine: sampleRow.rawRouteLine,
        plannedDeliveryDate: sampleRow.plannedDeliveryDate,
        notes: sampleRow.notes,
        warnings: rowWarnings,
        diagnostics: {
          batchCount: group.batches.length,
          batchIds,
          hasMultipleBatches,
          occurrenceCount
        }
      });
      continue;
    }

    const latestRow = newestBatch.rows[0].row;

    // Check for missing planned delivery date
    if (!latestRow.plannedDeliveryDate) {
      rowWarnings.push('missing_planned_delivery_date');
    }

    // Check non-SO order number
    if (isNonSoOrderNumber(latestRow.orderNumber)) {
      rows_out.push({
        fallbackKey: group.key,
        fallbackKeyFingerprint: fingerprint,
        status: 'excluded_non_so',
        latestRawDemandRowId: latestRow.id,
        conflictingRawDemandRowIds: [],
        latestBatchId: newestBatch.batchId,
        latestBatchUploadedAt: newestBatch.uploadedAt,
        latestQuantity: latestRow.quantity,
        publishedQuantity,
        availableQuantity: (latestRow.quantity ?? 0) - publishedQuantity,
        orderNumber: latestRow.orderNumber,
        customerName: latestRow.customerName,
        sku: latestRow.sku,
        description: latestRow.description,
        category: latestRow.category,
        distributionArea: latestRow.distributionArea,
        rawRouteLine: latestRow.rawRouteLine,
        plannedDeliveryDate: latestRow.plannedDeliveryDate,
        notes: latestRow.notes,
        warnings: rowWarnings,
        diagnostics: {
          batchCount: group.batches.length,
          batchIds,
          hasMultipleBatches,
          occurrenceCount
        }
      });
      continue;
    }

    // Check excluded planning statuses
    if (isExcludedPlanningStatus(latestRow.planningStatus)) {
      rows_out.push({
        fallbackKey: group.key,
        fallbackKeyFingerprint: fingerprint,
        status: 'requires_review',
        latestRawDemandRowId: latestRow.id,
        conflictingRawDemandRowIds: [],
        latestBatchId: newestBatch.batchId,
        latestBatchUploadedAt: newestBatch.uploadedAt,
        latestQuantity: latestRow.quantity,
        publishedQuantity,
        availableQuantity: (latestRow.quantity ?? 0) - publishedQuantity,
        orderNumber: latestRow.orderNumber,
        customerName: latestRow.customerName,
        sku: latestRow.sku,
        description: latestRow.description,
        category: latestRow.category,
        distributionArea: latestRow.distributionArea,
        rawRouteLine: latestRow.rawRouteLine,
        plannedDeliveryDate: latestRow.plannedDeliveryDate,
        notes: latestRow.notes,
        warnings: rowWarnings,
        diagnostics: {
          batchCount: group.batches.length,
          batchIds,
          hasMultipleBatches,
          occurrenceCount
        }
      });
      continue;
    }

    // Check invalid quantity
    if (isInvalidQuantity(latestRow.quantity)) {
      rows_out.push({
        fallbackKey: group.key,
        fallbackKeyFingerprint: fingerprint,
        status: 'requires_review',
        latestRawDemandRowId: latestRow.id,
        conflictingRawDemandRowIds: [],
        latestBatchId: newestBatch.batchId,
        latestBatchUploadedAt: newestBatch.uploadedAt,
        latestQuantity: latestRow.quantity,
        publishedQuantity,
        availableQuantity: (latestRow.quantity ?? 0) - publishedQuantity,
        orderNumber: latestRow.orderNumber,
        customerName: latestRow.customerName,
        sku: latestRow.sku,
        description: latestRow.description,
        category: latestRow.category,
        distributionArea: latestRow.distributionArea,
        rawRouteLine: latestRow.rawRouteLine,
        plannedDeliveryDate: latestRow.plannedDeliveryDate,
        notes: latestRow.notes,
        warnings: rowWarnings,
        diagnostics: {
          batchCount: group.batches.length,
          batchIds,
          hasMultipleBatches,
          occurrenceCount
        }
      });
      continue;
    }

    // Check special route flows and product handling flows
    const nonOrdinaryFlows = ['ashlama', 'chita', 'return', 'credit'];
    if (nonOrdinaryFlows.includes(latestRow.routeFlow)) {
      rows_out.push({
        fallbackKey: group.key,
        fallbackKeyFingerprint: fingerprint,
        status: 'requires_review',
        latestRawDemandRowId: latestRow.id,
        conflictingRawDemandRowIds: [],
        latestBatchId: newestBatch.batchId,
        latestBatchUploadedAt: newestBatch.uploadedAt,
        latestQuantity: latestRow.quantity,
        publishedQuantity,
        availableQuantity: (latestRow.quantity ?? 0) - publishedQuantity,
        orderNumber: latestRow.orderNumber,
        customerName: latestRow.customerName,
        sku: latestRow.sku,
        description: latestRow.description,
        category: latestRow.category,
        distributionArea: latestRow.distributionArea,
        rawRouteLine: latestRow.rawRouteLine,
        plannedDeliveryDate: latestRow.plannedDeliveryDate,
        notes: latestRow.notes,
        warnings: rowWarnings,
        diagnostics: {
          batchCount: group.batches.length,
          batchIds,
          hasMultipleBatches,
          occurrenceCount
        }
      });
      continue;
    }

    if (latestRow.productHandlingFlow !== 'regular') {
      rows_out.push({
        fallbackKey: group.key,
        fallbackKeyFingerprint: fingerprint,
        status: 'requires_review',
        latestRawDemandRowId: latestRow.id,
        conflictingRawDemandRowIds: [],
        latestBatchId: newestBatch.batchId,
        latestBatchUploadedAt: newestBatch.uploadedAt,
        latestQuantity: latestRow.quantity,
        publishedQuantity,
        availableQuantity: (latestRow.quantity ?? 0) - publishedQuantity,
        orderNumber: latestRow.orderNumber,
        customerName: latestRow.customerName,
        sku: latestRow.sku,
        description: latestRow.description,
        category: latestRow.category,
        distributionArea: latestRow.distributionArea,
        rawRouteLine: latestRow.rawRouteLine,
        plannedDeliveryDate: latestRow.plannedDeliveryDate,
        notes: latestRow.notes,
        warnings: rowWarnings,
        diagnostics: {
          batchCount: group.batches.length,
          batchIds,
          hasMultipleBatches,
          occurrenceCount
        }
      });
      continue;
    }

    // Normal demand flow — check quantity against published
    const latestQuantity = latestRow.quantity ?? 0;
    const availableQuantity = latestQuantity - publishedQuantity;

    let status: RollingAvailableDemandItemStatus;
    if (availableQuantity > 0) {
      status = 'available';
    } else if (availableQuantity === 0) {
      status = 'fully_consumed';
    } else {
      status = 'over_published';
    }

    rows_out.push({
      fallbackKey: group.key,
      fallbackKeyFingerprint: fingerprint,
      status,
      latestRawDemandRowId: latestRow.id,
      conflictingRawDemandRowIds: [],
      latestBatchId: newestBatch.batchId,
      latestBatchUploadedAt: newestBatch.uploadedAt,
      latestQuantity: latestRow.quantity,
      publishedQuantity,
      availableQuantity,
      orderNumber: latestRow.orderNumber,
      customerName: latestRow.customerName,
      sku: latestRow.sku,
      description: latestRow.description,
      category: latestRow.category,
      distributionArea: latestRow.distributionArea,
      rawRouteLine: latestRow.rawRouteLine,
      plannedDeliveryDate: latestRow.plannedDeliveryDate,
      notes: latestRow.notes,
      warnings: rowWarnings,
      diagnostics: {
        batchCount: group.batches.length,
        batchIds,
        hasMultipleBatches,
        occurrenceCount
      }
    });
  }

  // Compute summary
  let availableCount = 0;
  let fullyConsumedCount = 0;
  let duplicateConflictCount = 0;
  let overPublishedCount = 0;
  let requiresReviewCount = 0;
  let excludedNonSoCount = 0;

  for (const row of rows_out) {
    switch (row.status) {
      case 'available': availableCount++; break;
      case 'fully_consumed': fullyConsumedCount++; break;
      case 'duplicate_conflict': duplicateConflictCount++; break;
      case 'over_published': overPublishedCount++; break;
      case 'requires_review': requiresReviewCount++; break;
      case 'excluded_non_so': excludedNonSoCount++; break;
    }
  }

  const byStatus = {
    available: availableCount,
    fullyConsumed: fullyConsumedCount,
    duplicateConflict: duplicateConflictCount,
    overPublished: overPublishedCount,
    requiresReview: requiresReviewCount,
    excludedNonSo: excludedNonSoCount
  };

  const totalAvailableQuantity = rows_out
    .filter(r => r.status === 'available')
    .reduce((sum, r) => sum + r.availableQuantity, 0);

  return {
    summary: {
      totalRows: rows_out.length,
      totalAvailableQuantity,
      byStatus
    },
    rows: rows_out,
    warnings: [...globalWarnings],
    diagnostics: {
      totalBatches: readyBatches.length,
      totalRawRows: readyRows.length,
      totalFallbackKeys: keyGroups.length,
      batchesAnalyzed
    }
  };
}

// ──── Available batch card ────────────────────────────────────────────────────

export type DemandImportAvailableBatchCard = {
  id: string;
  sourceFile: string;
  sourceSheet: string;
  uploadedAt: string;
  status: string;
  totalRows: number;
  totalOrders: number;
  remainingRows: number;
  remainingQuantity: number;
  canPlan: boolean;
};

// ──── Demand Planning Publication types ─────────────────────────────────────────

export const demandPlanningPublicationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  batchId: z.string().uuid().nullable(),
  draftId: z.string().uuid(),
  targetShiftId: z.string().uuid(),
  sourceKind: z.enum(['batch', 'rolling']).default('batch'),
  status: z.enum(['applied', 'reverted']),
  createdAt: z.string(),
  revertedAt: z.string().nullable(),
  revertedBy: z.string().uuid().nullable()
});
export type DemandPlanningPublication = z.infer<typeof demandPlanningPublicationSchema>;

export type DemandPlanningRevertPublicationResponse = {
  publicationId: string;
  draftId: string;
  shiftId: string;
  revertedOrders: number;
  revertedItems: number;
  releasedQuantity: number;
};

// ──── Rolling Publish Conflict types ──────────────────────────────────────────

export const rollingPublishConflictStatusSchema = z.enum([
  'available',
  'stale',
  'insufficient_quantity',
  'duplicate_conflict'
]);
export type RollingPublishConflictStatus = z.infer<typeof rollingPublishConflictStatusSchema>;

export const rollingPublishConflictSchema = z.object({
  allocationId: z.string().uuid(),
  rawDemandRowId: z.string().uuid(),
  sku: z.string().nullable(),
  orderNumber: z.string().nullable(),
  requestedQuantity: z.number(),
  availableQuantity: z.number(),
  status: rollingPublishConflictStatusSchema,
  reason: z.string()
});
export type RollingPublishConflict = z.infer<typeof rollingPublishConflictSchema>;

// ──── Rolling target-scoped request schemas ──────────────────────────────────

export const rollingAvailableDemandQuerySchema = z.object({
  targetShiftId: z.string().uuid()
});
export type RollingAvailableDemandQuery = z.infer<typeof rollingAvailableDemandQuerySchema>;

export const rollingCreateDraftRequestSchema = z.object({
  targetShiftId: z.string().uuid()
});
export type RollingCreateDraftRequest = z.infer<typeof rollingCreateDraftRequestSchema>;
