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
    expect(() => auditAndAdaptRollingDraft(data)).toThrow(/יותר מהקצאה אחת/);
  });

  it('blocks incomplete row detail', () => {
    const data = fixture();
    data.rows = [];
    expect(() => auditAndAdaptRollingDraft(data)).toThrow(/חסרה שורת מקור/);
  });

  it('serializes every canonical row exactly once and preserves unassigned rows', () => {
    const data = fixture();
    const audit = auditAndAdaptRollingDraft(data);
    const unassignedId = audit.syntheticUnassignedByArea.get('North')!;
    const allocations = buildRollingPlanAllocations({
      rows: data.rows!,
      allocationQuantityByRowId: audit.allocationQuantityByRowId,
      itemAllocations: [],
      bucketKeyByWorkGroupId: new Map([[unassignedId, 'North|default|unassigned']]),
      unassignedByArea: audit.syntheticUnassignedByArea,
    });
    expect(allocations).toEqual([{ rawDemandRowId: data.rows![0].id, bucketKey: 'North|default|unassigned', allocatedQuantity: 4 }]);
  });
});
