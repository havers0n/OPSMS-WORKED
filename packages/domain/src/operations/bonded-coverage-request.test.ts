import { describe, expect, it } from 'vitest';
import {
  bondedCoverageRequestStatusSchema,
  bondedCoverageRequestSchema,
  bondedCoverageRequestItemSchema,
  bondedCoverageRequestDetailSchema,
  createBondedCoverageRequestInputSchema,
  addBondedCoverageRequestItemInputSchema,
  updateBondedCoverageRequestItemInputSchema,
  closeBondedCoverageRequestInputSchema,
  cancelBondedCoverageRequestInputSchema,
  listBondedCoverageRequestsInputSchema,
  type BondedCoverageRequest,
  type BondedCoverageRequestItem,
  type BondedCoverageRequestDetail
} from './bonded-coverage-request';

// ── Helpers ──────────────────────────────────────────────────────────────────

function validRequest(overrides: Partial<BondedCoverageRequest> = {}): BondedCoverageRequest {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000010',
    shiftId: '00000000-0000-0000-0000-000000000020',
    planningDate: '2026-06-23',
    status: 'open',
    title: 'Test Request',
    notes: null,
    bondedSnapshotId: null,
    warehouseStockSnapshotId: null,
    createdByProfileId: null,
    createdByName: 'Test User',
    createdAt: '2026-06-23T10:00:00.000Z',
    updatedAt: '2026-06-23T10:00:00.000Z',
    closedByProfileId: null,
    closedByName: null,
    closedAt: null,
    cancelledByProfileId: null,
    cancelledByName: null,
    cancelledAt: null,
    ...overrides
  };
}

function validItem(overrides: Partial<BondedCoverageRequestItem> = {}): BondedCoverageRequestItem {
  return {
    id: '00000000-0000-0000-0000-000000000100',
    requestId: '00000000-0000-0000-0000-000000000001',
    sku: '519526',
    description: 'Test product',
    category: 'Test category',
    requestedQty: 264,
    fulfilledQty: 0,
    demandQtyAtCreate: 564,
    warehouseQtyAtCreate: 300,
    shortageQtyAtCreate: 264,
    bondedAvailableQtyAtCreate: 2979,
    bondedCoverQtyAtCreate: 264,
    notes: null,
    createdAt: '2026-06-23T10:00:00.000Z',
    updatedAt: '2026-06-23T10:00:00.000Z',
    ...overrides
  };
}

// ── Status schema ────────────────────────────────────────────────────────────

describe('bondedCoverageRequestStatusSchema', () => {
  it('accepts open', () => {
    expect(bondedCoverageRequestStatusSchema.parse('open')).toBe('open');
  });

  it('accepts closed', () => {
    expect(bondedCoverageRequestStatusSchema.parse('closed')).toBe('closed');
  });

  it('accepts cancelled', () => {
    expect(bondedCoverageRequestStatusSchema.parse('cancelled')).toBe('cancelled');
  });

  it('rejects invalid status', () => {
    expect(() => bondedCoverageRequestStatusSchema.parse('draft')).toThrow();
    expect(() => bondedCoverageRequestStatusSchema.parse('fulfilled')).toThrow();
    expect(() => bondedCoverageRequestStatusSchema.parse('')).toThrow();
  });
});

// ── BondedCoverageRequest schema ─────────────────────────────────────────────

describe('bondedCoverageRequestSchema', () => {
  it('accepts valid open request', () => {
    const result = bondedCoverageRequestSchema.parse(validRequest());
    expect(result.status).toBe('open');
    expect(result.title).toBe('Test Request');
  });

  it('accepts closed request', () => {
    const result = bondedCoverageRequestSchema.parse(validRequest({
      status: 'closed',
      closedByProfileId: '00000000-0000-0000-0000-000000000030',
      closedByName: 'Operator',
      closedAt: '2026-06-23T12:00:00.000Z'
    }));
    expect(result.status).toBe('closed');
    expect(result.closedByName).toBe('Operator');
  });

  it('accepts cancelled request', () => {
    const result = bondedCoverageRequestSchema.parse(validRequest({
      status: 'cancelled',
      cancelledByProfileId: '00000000-0000-0000-0000-000000000030',
      cancelledByName: 'Operator',
      cancelledAt: '2026-06-23T12:00:00.000Z'
    }));
    expect(result.status).toBe('cancelled');
    expect(result.cancelledByName).toBe('Operator');
  });

  it('rejects invalid status', () => {
    const input = validRequest({ status: 'draft' as any });
    expect(() => bondedCoverageRequestSchema.parse(input)).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => bondedCoverageRequestSchema.parse({})).toThrow();
  });

  it('rejects negative requestedQty in item', () => {
    const item = validItem({ requestedQty: -1 });
    expect(() => bondedCoverageRequestItemSchema.parse(item)).toThrow();
  });

  it('accepts zero fulfilledQty', () => {
    const item = validItem({ fulfilledQty: 0 });
    const result = bondedCoverageRequestItemSchema.parse(item);
    expect(result.fulfilledQty).toBe(0);
  });

  it('accepts positive fulfilledQty', () => {
    const item = validItem({ fulfilledQty: 100 });
    const result = bondedCoverageRequestItemSchema.parse(item);
    expect(result.fulfilledQty).toBe(100);
  });

  it('rejects negative fulfilledQty', () => {
    const item = validItem({ fulfilledQty: -1 });
    expect(() => bondedCoverageRequestItemSchema.parse(item)).toThrow();
  });
});

// ── BondedCoverageRequestDetail schema ───────────────────────────────────────

describe('bondedCoverageRequestDetailSchema', () => {
  it('accepts request with items', () => {
    const detail: BondedCoverageRequestDetail = {
      ...validRequest(),
      items: [validItem(), validItem({ sku: '477318', requestedQty: 50 })]
    };
    const result = bondedCoverageRequestDetailSchema.parse(detail);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].sku).toBe('519526');
    expect(result.items[1].sku).toBe('477318');
  });

  it('accepts request with empty items', () => {
    const detail: BondedCoverageRequestDetail = {
      ...validRequest(),
      items: []
    };
    const result = bondedCoverageRequestDetailSchema.parse(detail);
    expect(result.items).toHaveLength(0);
  });
});

// ── Create input schema ──────────────────────────────────────────────────────

describe('createBondedCoverageRequestInputSchema', () => {
  it('accepts valid input without items', () => {
    const input = {
      planningDate: '2026-06-23',
      title: 'Test',
      notes: null
    };
    const result = createBondedCoverageRequestInputSchema.parse(input);
    expect(result.planningDate).toBe('2026-06-23');
    expect(result.items).toBeUndefined();
  });

  it('accepts valid input with items', () => {
    const input = {
      planningDate: '2026-06-23',
      items: [{
        sku: '519526',
        description: 'Test',
        category: 'Cat',
        requestedQty: 264,
        shortageQtyAtCreate: 264,
        bondedAvailableQtyAtCreate: 2979
      }]
    };
    const result = createBondedCoverageRequestInputSchema.parse(input);
    expect(result.items).toHaveLength(1);
    expect(result.items![0].requestedQty).toBe(264);
  });

  it('rejects missing planningDate', () => {
    expect(() => createBondedCoverageRequestInputSchema.parse({})).toThrow();
  });

  it('rejects zero requestedQty', () => {
    const input = {
      planningDate: '2026-06-23',
      items: [{ sku: 'SKU001', requestedQty: 0 }]
    };
    expect(() => createBondedCoverageRequestInputSchema.parse(input)).toThrow();
  });

  it('rejects negative requestedQty', () => {
    const input = {
      planningDate: '2026-06-23',
      items: [{ sku: 'SKU001', requestedQty: -5 }]
    };
    expect(() => createBondedCoverageRequestInputSchema.parse(input)).toThrow();
  });

  it('rejects empty sku', () => {
    const input = {
      planningDate: '2026-06-23',
      items: [{ sku: '', requestedQty: 10 }]
    };
    expect(() => createBondedCoverageRequestInputSchema.parse(input)).toThrow();
  });
});

// ── Add item input schema ────────────────────────────────────────────────────

describe('addBondedCoverageRequestItemInputSchema', () => {
  it('accepts valid input', () => {
    const input = {
      sku: '519526',
      requestedQty: 100,
      shortageQtyAtCreate: 264,
      bondedAvailableQtyAtCreate: 2979
    };
    const result = addBondedCoverageRequestItemInputSchema.parse(input);
    expect(result.sku).toBe('519526');
    expect(result.requestedQty).toBe(100);
  });

  it('rejects zero requestedQty', () => {
    expect(() => addBondedCoverageRequestItemInputSchema.parse({
      sku: 'SKU001', requestedQty: 0
    })).toThrow();
  });
});

// ── Update item input schema ─────────────────────────────────────────────────

describe('updateBondedCoverageRequestItemInputSchema', () => {
  it('accepts partial update', () => {
    const result = updateBondedCoverageRequestItemInputSchema.parse({ notes: 'Updated notes' });
    expect(result.notes).toBe('Updated notes');
    expect(result.requestedQty).toBeUndefined();
  });

  it('accepts requestedQty update', () => {
    const result = updateBondedCoverageRequestItemInputSchema.parse({ requestedQty: 150 });
    expect(result.requestedQty).toBe(150);
  });

  it('rejects zero requestedQty', () => {
    expect(() => updateBondedCoverageRequestItemInputSchema.parse({ requestedQty: 0 })).toThrow();
  });
});

// ── Close input schema ───────────────────────────────────────────────────────

describe('closeBondedCoverageRequestInputSchema', () => {
  it('accepts close without items', () => {
    const result = closeBondedCoverageRequestInputSchema.parse({ notes: 'Closed' });
    expect(result.notes).toBe('Closed');
    expect(result.items).toBeUndefined();
  });

  it('accepts close with fulfilled items', () => {
    const input = {
      notes: 'Closed',
      items: [{ itemId: '00000000-0000-0000-0000-000000000100', fulfilledQty: 264 }]
    };
    const result = closeBondedCoverageRequestInputSchema.parse(input);
    expect(result.items).toHaveLength(1);
    expect(result.items![0].fulfilledQty).toBe(264);
  });

  it('rejects negative fulfilledQty', () => {
    expect(() => closeBondedCoverageRequestInputSchema.parse({
      items: [{ itemId: '00000000-0000-0000-0000-000000000100', fulfilledQty: -1 }]
    })).toThrow();
  });

  it('rejects invalid itemId', () => {
    expect(() => closeBondedCoverageRequestInputSchema.parse({
      items: [{ itemId: 'not-a-uuid', fulfilledQty: 100 }]
    })).toThrow();
  });
});

// ── Cancel input schema ──────────────────────────────────────────────────────

describe('cancelBondedCoverageRequestInputSchema', () => {
  it('accepts cancel with notes', () => {
    const result = cancelBondedCoverageRequestInputSchema.parse({ notes: 'Cancelled' });
    expect(result.notes).toBe('Cancelled');
  });

  it('accepts cancel without notes', () => {
    const result = cancelBondedCoverageRequestInputSchema.parse({});
    expect(result.notes).toBeUndefined();
  });
});

// ── List input schema ────────────────────────────────────────────────────────

describe('listBondedCoverageRequestsInputSchema', () => {
  it('accepts empty query', () => {
    const result = listBondedCoverageRequestsInputSchema.parse({});
    expect(result.status).toBeUndefined();
  });

  it('accepts status filter', () => {
    const result = listBondedCoverageRequestsInputSchema.parse({ status: 'open' });
    expect(result.status).toBe('open');
  });

  it('rejects invalid status filter', () => {
    expect(() => listBondedCoverageRequestsInputSchema.parse({ status: 'invalid' })).toThrow();
  });
});
