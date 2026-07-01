import { describe, expect, it } from 'vitest';
import type { DemandPlanningDraftWithAssignments } from '@wos/domain';
import { auditAndAdaptRollingDraft, buildRollingPlanAllocations } from './rolling-source-adapter';

function fixture(): DemandPlanningDraftWithAssignments {
  return {
    draft: { id: '10000000-0000-4000-8000-000000000001', tenantId: '10000000-0000-4000-8000-000000000002', batchId: null, sourceKind: 'rolling', status: 'draft', targetDate: '2026-07-01', targetShiftId: '10000000-0000-4000-8000-000000000003', createdBy: null, createdAt: '2026-06-30T10:00:00.000Z', updatedAt: '2026-06-30T10:00:00.000Z' },
    buckets: [{ id: '20000000-0000-4000-8000-000000000001', tenantId: '10000000-0000-4000-8000-000000000002', draftId: '10000000-0000-4000-8000-000000000001', batchId: null, distributionArea: 'North', planningLineName: 'default', bucketName: 'assigned', sortOrder: 0, createdAt: '2026-06-30T10:00:00.000Z', updatedAt: '2026-06-30T10:00:00.000Z' }],
    allocations: [{ id: '30000000-0000-4000-8000-000000000001', tenantId: '10000000-0000-4000-8000-000000000002', draftId: '10000000-0000-4000-8000-000000000001', batchId: '40000000-0000-4000-8000-000000000001', rawDemandRowId: '50000000-0000-4000-8000-000000000001', bucketId: '20000000-0000-4000-8000-000000000001', allocatedQuantity: 4, createdAt: '2026-06-30T10:00:00.000Z', updatedAt: '2026-06-30T10:00:00.000Z' }],
    rows: [{ id: '50000000-0000-4000-8000-000000000001', tenantId: '10000000-0000-4000-8000-000000000002', batchId: '40000000-0000-4000-8000-000000000001', sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'Customer', orderNumber: 'SO1', sku: 'SKU1', description: 'Item', category: null, quantity: 10, cost: null, notes: null, distributionArea: 'North', rawRouteLine: null, plannedDeliveryDate: '2026-07-01', plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-30T10:00:00.000Z' }],
  };
}

describe('rolling source adapter', () => {
  it('uses allocation quantity and creates a stable unassigned destination when absent', () => {
    const result = auditAndAdaptRollingDraft(fixture());
    expect(result.source.orders[0].totalQuantity).toBe(4);
    expect(result.syntheticUnassignedByArea.get('North')).toBe('rolling-unassigned:10000000-0000-4000-8000-000000000001:North');
  });

  it('blocks duplicate raw demand row allocations', () => {
    const data = fixture();
    data.allocations.push({ ...data.allocations[0], id: '30000000-0000-4000-8000-000000000002' });
    expect(() => auditAndAdaptRollingDraft(data)).toThrow(/more than one allocation/i);
  });

  it('blocks incomplete row detail', () => {
    const data = fixture();
    data.rows = [];
    expect(() => auditAndAdaptRollingDraft(data)).toThrow(/Missing source row for allocation/i);
  });

  it('skips unassigned rows with no user-visible allocation', () => {
    const data = fixture();
    const audit = auditAndAdaptRollingDraft(data);
    const allocations = buildRollingPlanAllocations({
      allocationQuantityByRowId: audit.allocationQuantityByRowId,
      itemAllocations: [],
      bucketKeyByWorkGroupId: new Map(),
    });

    expect(allocations).toEqual([]);
  });

  it('serializes the actual partial quantity for an assigned rolling row', () => {
    const allocations = buildRollingPlanAllocations({
      allocationQuantityByRowId: new Map([['50000000-0000-4000-8000-000000000001', 12]]),
      itemAllocations: [
        { id: 'alloc-local-1', itemRowId: '50000000-0000-4000-8000-000000000001', workGroupId: 'wg-1', qty: 6, createdAt: 1 },
      ],
      bucketKeyByWorkGroupId: new Map([
        ['wg-1', 'North|Line A|Group A'],
      ]),
    });

    expect(allocations).toEqual([
      { rawDemandRowId: '50000000-0000-4000-8000-000000000001', bucketKey: 'North|Line A|Group A', allocatedQuantity: 6 },
    ]);
  });

  it('fails clearly when a rolling row is split across multiple work groups', () => {
    expect(() => buildRollingPlanAllocations({
      allocationQuantityByRowId: new Map([['50000000-0000-4000-8000-000000000001', 12]]),
      itemAllocations: [
        { id: 'alloc-local-1', itemRowId: '50000000-0000-4000-8000-000000000001', workGroupId: 'wg-1', qty: 6, createdAt: 1 },
        { id: 'alloc-local-2', itemRowId: '50000000-0000-4000-8000-000000000001', workGroupId: 'wg-2', qty: 6, createdAt: 2 },
      ],
      bucketKeyByWorkGroupId: new Map([
        ['wg-1', 'North|Line A|Group A'],
        ['wg-2', 'North|Line B|Group B'],
      ]),
    })).toThrow(/cannot be split across multiple work groups/i);
  });
});
