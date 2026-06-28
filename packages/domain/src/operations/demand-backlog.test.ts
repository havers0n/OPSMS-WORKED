import { describe, expect, it } from 'vitest';
import {
  computeDemandBacklogIdentityKey,
  computeBacklogMergeAction,
  computeBacklogItemStatus,
  computeOpenQuantity,
  buildAvailableDemandResponse,
  demandBacklogItemSchema,
  type BacklogMergeRowInput,
  type DemandBacklogItem
} from './demand-backlog';

function makeRow(overrides: Partial<BacklogMergeRowInput> = {}): BacklogMergeRowInput {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    tenantId: '00000000-0000-4000-a000-000000000010',
    batchId: '00000000-0000-4000-a000-000000000020',
    orderNumber: 'SO-001',
    customerName: 'לקוח א',
    sku: 'SKU-100',
    description: 'מוצר רגיל',
    category: 'רגיל',
    quantity: 10,
    distributionArea: 'דרום',
    planningStatus: 'unplanned',
    routeFlow: 'unassigned',
    productHandlingFlow: 'regular',
    ...overrides
  };
}

function makeItem(overrides: Partial<DemandBacklogItem> = {}): DemandBacklogItem {
  return {
    id: '11111111-1111-4111-a111-111111111111',
    tenantId: '00000000-0000-4000-a000-000000000010',
    identityKey: 'stub-key',
    status: 'open',
    totalQuantity: 10,
    orderNumber: 'SO-001',
    customerName: 'לקוח א',
    sku: 'SKU-100',
    description: 'מוצר רגיל',
    category: 'רגיל',
    distributionArea: 'דרום',
    productHandlingFlow: 'regular',
    routeFlow: 'unassigned',
    firstSeenAt: '2026-06-27T00:00:00.000Z',
    lastSeenAt: '2026-06-27T00:00:00.000Z',
    lastQuantityChangedAt: null,
    createdAt: '2026-06-27T00:00:00.000Z',
    updatedAt: '2026-06-27T00:00:00.000Z',
    ...overrides
  };
}

function makeAvailableSnapshot(overrides: {
  backlogItems?: Array<{
    id: string;
    tenantId?: string;
    identityKey: string;
    status?: DemandBacklogItem['status'];
    totalQuantity: number;
    orderNumber?: string | null;
    customerName?: string | null;
    sku?: string | null;
    distributionArea?: string | null;
    firstSeenAt?: string;
    lastSeenAt?: string;
  }>;
  sourceLinks?: Array<{
    backlogItemId: string;
    rawDemandRowId: string;
    batchId: string;
  }>;
  sourceBatches?: Array<{
    batchId: string;
    sourceFile: string;
    uploadedAt: string;
  }>;
  publishedAllocations?: Array<{
    rawDemandRowId: string;
    publishedQuantity: number;
    publicationStatus: 'applied' | 'reverted' | null;
  }>;
} = {}) {
  return {
    backlogItems:
      overrides.backlogItems?.map((item) => ({
        id: item.id,
        tenantId: item.tenantId ?? '00000000-0000-4000-a000-000000000010',
        identityKey: item.identityKey,
        status: item.status ?? 'open',
        totalQuantity: item.totalQuantity,
        orderNumber: item.orderNumber ?? 'SO-001',
        customerName: item.customerName ?? 'Customer',
        sku: item.sku ?? 'SKU-1',
        description: null,
        category: null,
        distributionArea: item.distributionArea ?? 'North',
        productHandlingFlow: 'regular' as const,
        routeFlow: 'unassigned' as const,
        firstSeenAt: item.firstSeenAt ?? '2026-06-27T00:00:00.000Z',
        lastSeenAt: item.lastSeenAt ?? '2026-06-27T00:00:00.000Z',
        lastQuantityChangedAt: null,
        createdAt: '2026-06-27T00:00:00.000Z',
        updatedAt: '2026-06-27T00:00:00.000Z'
      })) ?? [],
    sourceLinks: overrides.sourceLinks ?? [],
    sourceBatches: overrides.sourceBatches ?? [],
    publishedAllocations: overrides.publishedAllocations ?? []
  };
}

// ──── Identity normalization ─────────────────────────────────────────────────

describe('computeDemandBacklogIdentityKey', () => {
  it('produces deterministic keys for identical inputs', async () => {
    const a = await computeDemandBacklogIdentityKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    const b = await computeDemandBacklogIdentityKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    expect(a).toBe(b);
  });

  it('is case-insensitive', async () => {
    const a = await computeDemandBacklogIdentityKey('SO-001', 'Client', 'SKU-100', 'North');
    const b = await computeDemandBacklogIdentityKey('so-001', 'client', 'sku-100', 'north');
    expect(a).toBe(b);
  });

  it('trims whitespace', async () => {
    const a = await computeDemandBacklogIdentityKey('  SO-001 ', ' Client ', ' SKU-100  ', ' North ');
    const b = await computeDemandBacklogIdentityKey('SO-001', 'Client', 'SKU-100', 'North');
    expect(a).toBe(b);
  });

  it('treats null and empty string identically', async () => {
    const a = await computeDemandBacklogIdentityKey(null, null, null, null);
    const b = await computeDemandBacklogIdentityKey('', '', '', '');
    expect(a).toBe(b);
  });

  it('produces different keys when any field differs', async () => {
    const a = await computeDemandBacklogIdentityKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    const b = await computeDemandBacklogIdentityKey('SO-002', 'לקוח א', 'SKU-100', 'דרום');
    expect(a).not.toBe(b);
  });

  it('produces different keys when distribution area differs', async () => {
    const a = await computeDemandBacklogIdentityKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    const b = await computeDemandBacklogIdentityKey('SO-001', 'לקוח א', 'SKU-100', 'צפון');
    expect(a).not.toBe(b);
  });
});

// ──── computeBacklogMergeAction ────────────────────────────────────────────────

describe('computeBacklogMergeAction', () => {
  it('returns new for a non-existing item (unplanned)', async () => {
    const row = makeRow({ planningStatus: 'unplanned' });
    const result = await computeBacklogMergeAction(row, null, 0);
    expect(result.isNew).toBe(true);
    expect(result.mergeAction).toBe('new');
    expect(result.previousQuantity).toBeNull();
    expect(result.newQuantity).toBe(10);
  });

  it('returns special_flow action for new item with special_flow planning status', async () => {
    const row = makeRow({ planningStatus: 'special_flow' });
    const result = await computeBacklogMergeAction(row, null, 0);
    expect(result.isNew).toBe(true);
    expect(result.mergeAction).toBe('special_flow');
  });

  it('returns matched when quantity unchanged vs existing item', async () => {
    const item = makeItem({ totalQuantity: 10, identityKey: 'any' });
    const row = makeRow({ quantity: 10 });
    const result = await computeBacklogMergeAction(row, item, 1);
    expect(result.isNew).toBe(false);
    expect(result.mergeAction).toBe('matched');
    expect(result.previousQuantity).toBeNull();
    expect(result.newQuantity).toBeNull();
  });

  it('returns quantity_changed when quantity differs', async () => {
    const item = makeItem({ totalQuantity: 5, identityKey: 'any' });
    const row = makeRow({ quantity: 10 });
    const result = await computeBacklogMergeAction(row, item, 1);
    expect(result.isNew).toBe(false);
    expect(result.mergeAction).toBe('quantity_changed');
    expect(result.previousQuantity).toBe(5);
    expect(result.newQuantity).toBe(10);
  });

  it('treats null row quantity as 0 for comparison', async () => {
    const item = makeItem({ totalQuantity: 5, identityKey: 'any' });
    const row = makeRow({ quantity: null });
    const result = await computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('quantity_changed');
    expect(result.previousQuantity).toBe(5);
    expect(result.newQuantity).toBe(0);
  });

  it('throws when planningStatus is error', async () => {
    const row = makeRow({ planningStatus: 'error' });
    await expect(() => computeBacklogMergeAction(row, null, 0)).rejects.toThrow('Cannot merge error rows');
  });

  it('returns special_flow for existing item that was already in backlog', async () => {
    const item = makeItem({ identityKey: 'any' });
    const row = makeRow({ planningStatus: 'special_flow' });
    const result = await computeBacklogMergeAction(row, item, 1);
    expect(result.isNew).toBe(false);
    expect(result.mergeAction).toBe('special_flow');
    expect(result.previousQuantity).toBeNull();
    expect(result.newQuantity).toBeNull();
  });

  it('returns matched for tiny floating point differences below 0.001', async () => {
    const item = makeItem({ totalQuantity: 10, identityKey: 'any' });
    const row = makeRow({ quantity: 10.0005 });
    const result = await computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('matched');
  });

  it('returns quantity_changed for differences >= 0.001', async () => {
    const item = makeItem({ totalQuantity: 10, identityKey: 'any' });
    const row = makeRow({ quantity: 11 });
    const result = await computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('quantity_changed');
  });
});

// ──── computeBacklogItemStatus ────────────────────────────────────────────────

describe('computeBacklogItemStatus', () => {
  it('returns open when totalQuantity >= allocatedQuantity', () => {
    expect(computeBacklogItemStatus(10, 3)).toBe('open');
    expect(computeBacklogItemStatus(10, 10)).toBe('open');
    expect(computeBacklogItemStatus(0, 0)).toBe('open');
  });

  it('returns requires_review when totalQuantity < allocatedQuantity', () => {
    expect(computeBacklogItemStatus(5, 10)).toBe('requires_review');
    expect(computeBacklogItemStatus(0, 1)).toBe('requires_review');
  });
});

// ──── computeOpenQuantity ──────────────────────────────────────────────────────

describe('computeOpenQuantity', () => {
  it('returns total - allocated when total > allocated', () => {
    expect(computeOpenQuantity(10, 3)).toBe(7);
  });

  it('returns 0 when total <= allocated', () => {
    expect(computeOpenQuantity(10, 10)).toBe(0);
    expect(computeOpenQuantity(5, 10)).toBe(0);
  });

  it('returns 0 when both are 0', () => {
    expect(computeOpenQuantity(0, 0)).toBe(0);
  });
});

// ──── Cross-cutting scenarios (merge + status + open quantity) ────────────────

describe('backlog merge scenarios', () => {
  it('dedup across batches: same identity key, same quantity -> matched', async () => {
    const key = await computeDemandBacklogIdentityKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    const item = makeItem({ identityKey: key, totalQuantity: 10 });
    const row = makeRow({ quantity: 10 });
    const result = await computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('matched');
  });

  it('supersede quantity: existing 5, new 10 -> quantity_changed with new=10', async () => {
    const item = makeItem({ totalQuantity: 5, identityKey: 'any' });
    const row = makeRow({ quantity: 10 });
    const result = await computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('quantity_changed');
    expect(result.newQuantity).toBe(10);
    expect(result.previousQuantity).toBe(5);
  });

  it('repeated same upload does not inflate: row already linked, qty matches -> matched', async () => {
    const item = makeItem({ totalQuantity: 10, identityKey: 'any' });
    const row = makeRow({ quantity: 10 });
    const result = await computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('matched');
  });

  it('quantity decrease below allocated -> requires_review status', () => {
    const status = computeBacklogItemStatus(3, 10);
    expect(status).toBe('requires_review');
  });

  it('special_flow row excluded from open backlog (status=special_flow)', async () => {
    const row = makeRow({ planningStatus: 'special_flow' });
    const result = await computeBacklogMergeAction(row, null, 0);
    expect(result.mergeAction).toBe('special_flow');
    expect(result.isNew).toBe(true);
  });

  it('error row excluded entirely (throws)', async () => {
    const row = makeRow({ planningStatus: 'error' });
    await expect(() => computeBacklogMergeAction(row, null, 0)).rejects.toThrow('Cannot merge error rows');
  });

  it('source link preserves merge metadata (previous, new, delta)', async () => {
    const item = makeItem({ totalQuantity: 5 });
    const row = makeRow({ quantity: 8 });
    const result = await computeBacklogMergeAction(row, item, 2);
    expect(result.mergeAction).toBe('quantity_changed');
    expect(result.previousQuantity).toBe(5);
    expect(result.newQuantity).toBe(8);
  });

  it('openQuantity computed correctly with allocation', () => {
    const open = computeOpenQuantity(10, 3);
    expect(open).toBe(7);
  });

  it('openQuantity is 0 when fully allocated', () => {
    const open = computeOpenQuantity(10, 10);
    expect(open).toBe(0);
  });
});

// ──── Schema validation ──────────────────────────────────────────────────────

describe('demand backlog schema validation', () => {
  it('rejects backlog item with negative totalQuantity', () => {
    const payload = makeItem({ totalQuantity: -1 });
    const result = demandBacklogItemSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const payload = { ...makeItem(), status: 'invalid' };
    const result = demandBacklogItemSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe('buildAvailableDemandResponse', () => {
  it('keeps duplicate uploads as metadata without multiplying demand', () => {
    const response = buildAvailableDemandResponse(makeAvailableSnapshot({
      backlogItems: [
        { id: '11111111-1111-4111-a111-111111111111', identityKey: 'k1', totalQuantity: 10 }
      ],
      sourceLinks: [
        {
          backlogItemId: '11111111-1111-4111-a111-111111111111',
          rawDemandRowId: '22222222-2222-4222-a222-222222222222',
          batchId: '33333333-3333-4333-a333-333333333333'
        },
        {
          backlogItemId: '11111111-1111-4111-a111-111111111111',
          rawDemandRowId: '22222222-2222-4222-a222-222222222222',
          batchId: '44444444-4444-4444-a444-444444444444'
        }
      ],
      sourceBatches: [
        { batchId: '33333333-3333-4333-a333-333333333333', sourceFile: 'same.xlsx', uploadedAt: '2026-06-27T10:00:00.000Z' },
        { batchId: '44444444-4444-4444-a444-444444444444', sourceFile: 'same.xlsx', uploadedAt: '2026-06-27T11:00:00.000Z' }
      ]
    }));

    expect(response.summary.totalQuantity).toBe(10);
    expect(response.summary.rowsCount).toBe(1);
    expect(response.groups[0].availableQuantity).toBe(10);
    expect(response.excludedCounts.duplicateSourceFiles).toBe(1);
    expect(response.warnings[0]).toContain('same.xlsx');
  });

  it('subtracts only applied publications and ignores reverted ones', () => {
    const response = buildAvailableDemandResponse(makeAvailableSnapshot({
      backlogItems: [
        { id: '11111111-1111-4111-a111-111111111111', identityKey: 'k1', totalQuantity: 10 }
      ],
      sourceLinks: [
        {
          backlogItemId: '11111111-1111-4111-a111-111111111111',
          rawDemandRowId: '22222222-2222-4222-a222-222222222222',
          batchId: '33333333-3333-4333-a333-333333333333'
        }
      ],
      sourceBatches: [
        { batchId: '33333333-3333-4333-a333-333333333333', sourceFile: 'one.xlsx', uploadedAt: '2026-06-27T10:00:00.000Z' }
      ],
      publishedAllocations: [
        { rawDemandRowId: '22222222-2222-4222-a222-222222222222', publishedQuantity: 3, publicationStatus: 'applied' },
        { rawDemandRowId: '22222222-2222-4222-a222-222222222222', publishedQuantity: 4, publicationStatus: 'reverted' }
      ]
    }));

    expect(response.groups[0].consumedQuantity).toBe(3);
    expect(response.groups[0].availableQuantity).toBe(7);
  });

  it('returns canPlan=false when no available demand remains', () => {
    const response = buildAvailableDemandResponse(makeAvailableSnapshot({
      backlogItems: [],
      sourceLinks: [],
      sourceBatches: [],
      publishedAllocations: []
    }));

    expect(response.canPlan).toBe(false);
    expect(response.summary.rowsCount).toBe(0);
    expect(response.summary.totalQuantity).toBe(0);
  });
});
