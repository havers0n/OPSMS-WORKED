import { describe, expect, it } from 'vitest';
import {
  normalizeDemandBacklogKey,
  computeBacklogMergeAction,
  computeBacklogItemStatus,
  computeOpenQuantity,
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

// ──── Identity normalization ─────────────────────────────────────────────────

describe('normalizeDemandBacklogKey', () => {
  it('produces deterministic keys for identical inputs', () => {
    const a = normalizeDemandBacklogKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    const b = normalizeDemandBacklogKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    expect(a).toBe(b);
  });

  it('is case-insensitive', () => {
    const a = normalizeDemandBacklogKey('SO-001', 'Client', 'SKU-100', 'North');
    const b = normalizeDemandBacklogKey('so-001', 'client', 'sku-100', 'north');
    expect(a).toBe(b);
  });

  it('trims whitespace', () => {
    const a = normalizeDemandBacklogKey('  SO-001 ', ' Client ', ' SKU-100  ', ' North ');
    const b = normalizeDemandBacklogKey('SO-001', 'Client', 'SKU-100', 'North');
    expect(a).toBe(b);
  });

  it('treats null and empty string identically', () => {
    const a = normalizeDemandBacklogKey(null, null, null, null);
    const b = normalizeDemandBacklogKey('', '', '', '');
    expect(a).toBe(b);
  });

  it('produces different keys when any field differs', () => {
    const a = normalizeDemandBacklogKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    const b = normalizeDemandBacklogKey('SO-002', 'לקוח א', 'SKU-100', 'דרום');
    expect(a).not.toBe(b);
  });

  it('produces different keys when distribution area differs', () => {
    const a = normalizeDemandBacklogKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    const b = normalizeDemandBacklogKey('SO-001', 'לקוח א', 'SKU-100', 'צפון');
    expect(a).not.toBe(b);
  });
});

// ──── computeBacklogMergeAction ────────────────────────────────────────────────

describe('computeBacklogMergeAction', () => {
  it('returns new for a non-existing item (unplanned)', () => {
    const row = makeRow({ planningStatus: 'unplanned' });
    const result = computeBacklogMergeAction(row, null, 0);
    expect(result.isNew).toBe(true);
    expect(result.mergeAction).toBe('new');
    expect(result.previousQuantity).toBeNull();
    expect(result.newQuantity).toBe(10);
  });

  it('returns special_flow action for new item with special_flow planning status', () => {
    const row = makeRow({ planningStatus: 'special_flow' });
    const result = computeBacklogMergeAction(row, null, 0);
    expect(result.isNew).toBe(true);
    expect(result.mergeAction).toBe('special_flow');
  });

  it('returns matched when quantity unchanged vs existing item', () => {
    const item = makeItem({ totalQuantity: 10, identityKey: 'any' });
    const row = makeRow({ quantity: 10 });
    const result = computeBacklogMergeAction(row, item, 1);
    expect(result.isNew).toBe(false);
    expect(result.mergeAction).toBe('matched');
    expect(result.previousQuantity).toBeNull();
    expect(result.newQuantity).toBeNull();
  });

  it('returns quantity_changed when quantity differs', () => {
    const item = makeItem({ totalQuantity: 5, identityKey: 'any' });
    const row = makeRow({ quantity: 10 });
    const result = computeBacklogMergeAction(row, item, 1);
    expect(result.isNew).toBe(false);
    expect(result.mergeAction).toBe('quantity_changed');
    expect(result.previousQuantity).toBe(5);
    expect(result.newQuantity).toBe(10);
  });

  it('treats null row quantity as 0 for comparison', () => {
    const item = makeItem({ totalQuantity: 5, identityKey: 'any' });
    const row = makeRow({ quantity: null });
    const result = computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('quantity_changed');
    expect(result.previousQuantity).toBe(5);
    expect(result.newQuantity).toBe(0);
  });

  it('throws when planningStatus is error', () => {
    const row = makeRow({ planningStatus: 'error' });
    expect(() => computeBacklogMergeAction(row, null, 0)).toThrow('Cannot merge error rows');
  });

  it('returns special_flow for existing item that was already in backlog', () => {
    const item = makeItem({ identityKey: 'any' });
    const row = makeRow({ planningStatus: 'special_flow' });
    const result = computeBacklogMergeAction(row, item, 1);
    expect(result.isNew).toBe(false);
    expect(result.mergeAction).toBe('special_flow');
    expect(result.previousQuantity).toBeNull();
    expect(result.newQuantity).toBeNull();
  });

  it('returns matched for tiny floating point differences below 0.001', () => {
    const item = makeItem({ totalQuantity: 10, identityKey: 'any' });
    const row = makeRow({ quantity: 10.0005 });
    const result = computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('matched');
  });

  it('returns quantity_changed for differences >= 0.001', () => {
    const item = makeItem({ totalQuantity: 10, identityKey: 'any' });
    const row = makeRow({ quantity: 11 });
    const result = computeBacklogMergeAction(row, item, 1);
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
  it('dedup across batches: same identity key, same quantity -> matched', () => {
    const key = normalizeDemandBacklogKey('SO-001', 'לקוח א', 'SKU-100', 'דרום');
    const item = makeItem({ identityKey: key, totalQuantity: 10 });
    const row = makeRow({ quantity: 10 });
    const result = computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('matched');
  });

  it('supersede quantity: existing 5, new 10 -> quantity_changed with new=10', () => {
    const item = makeItem({ totalQuantity: 5, identityKey: 'any' });
    const row = makeRow({ quantity: 10 });
    const result = computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('quantity_changed');
    expect(result.newQuantity).toBe(10);
    expect(result.previousQuantity).toBe(5);
  });

  it('repeated same upload does not inflate: row already linked, qty matches -> matched', () => {
    const item = makeItem({ totalQuantity: 10, identityKey: 'any' });
    const row = makeRow({ quantity: 10 });
    const result = computeBacklogMergeAction(row, item, 1);
    expect(result.mergeAction).toBe('matched');
  });

  it('quantity decrease below allocated -> requires_review status', () => {
    const status = computeBacklogItemStatus(3, 10);
    expect(status).toBe('requires_review');
  });

  it('special_flow row excluded from open backlog (status=special_flow)', () => {
    const row = makeRow({ planningStatus: 'special_flow' });
    const result = computeBacklogMergeAction(row, null, 0);
    expect(result.mergeAction).toBe('special_flow');
    expect(result.isNew).toBe(true);
  });

  it('error row excluded entirely (throws)', () => {
    const row = makeRow({ planningStatus: 'error' });
    expect(() => computeBacklogMergeAction(row, null, 0)).toThrow('Cannot merge error rows');
  });

  it('source link preserves merge metadata (previous, new, delta)', () => {
    const item = makeItem({ totalQuantity: 5 });
    const row = makeRow({ quantity: 8 });
    const result = computeBacklogMergeAction(row, item, 2);
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
