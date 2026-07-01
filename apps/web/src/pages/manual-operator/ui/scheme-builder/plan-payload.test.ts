import { describe, expect, it } from 'vitest';
import type { RawDemandRow } from '@wos/domain';
import { buildPlanPayload } from './plan-payload';
import type { RollingDraftAudit } from './rolling-source-adapter';

const row = { id: 'row-1', distributionArea: 'דרום' } as RawDemandRow;
const rollingAudit = {
  source: { areas: [], orders: [], orderItemMap: {}, specialFlowOrders: [], specialFlowItems: [], errorOrders: [], errorItems: [] },
  allocationQuantityByRowId: new Map([['row-1', 10]]),
  syntheticUnassignedByArea: new Map([['דרום', 'unassigned-1']]),
} satisfies RollingDraftAudit;

describe('buildPlanPayload', () => {
  it('includes a newly created rolling bucket and points the allocation to it', () => {
    const payload = buildPlanPayload({
      sourceKind: 'rolling',
      planningLines: [{ id: 'line-1', areaName: 'דרום', name: 'ראשי', sortOrder: 0, createdAt: 1 }],
      workGroups: [{ id: 'group-1', planningLineId: 'line-1', areaName: 'דרום', name: 'כללי', createdAt: 1 }],
      itemAllocations: [{ id: 'allocation-1', itemRowId: 'row-1', workGroupId: 'group-1', qty: 10, createdAt: 1 }],
      rollingDraftAudit: rollingAudit,
      draftRows: [row],
    });

    expect(payload.buckets).toContainEqual({ distributionArea: 'דרום', planningLineName: 'ראשי', bucketName: 'כללי' });
    expect(payload.allocations).toEqual([{ rawDemandRowId: 'row-1', bucketKey: 'דרום|ראשי|כללי', allocatedQuantity: 10 }]);
  });

  it('refuses to serialize a rolling draft without its audit or source rows', () => {
    const base = { sourceKind: 'rolling' as const, planningLines: [], workGroups: [], itemAllocations: [], rollingDraftAudit: null, draftRows: undefined };
    expect(() => buildPlanPayload(base)).toThrow('נתוני הביקורת או שורות המקור חסרים');
  });

  it('preserves the batch payload behavior', () => {
    expect(buildPlanPayload({
      sourceKind: 'batch',
      planningLines: [{ id: 'line-1', areaName: '__missing__', name: 'קו א', sortOrder: 0, createdAt: 1 }],
      workGroups: [{ id: 'group-1', planningLineId: 'line-1', areaName: '__missing__', name: 'קבוצה א', createdAt: 1 }],
      itemAllocations: [
        { id: 'allocation-1', itemRowId: 'row-1', workGroupId: 'group-1', qty: 3, createdAt: 1 },
        { id: 'allocation-2', itemRowId: 'row-2', workGroupId: 'missing-group', qty: 4, createdAt: 1 },
      ],
      rollingDraftAudit: null,
      draftRows: undefined,
    })).toEqual({
      buckets: [{ distributionArea: null, planningLineName: 'קו א', bucketName: 'קבוצה א' }],
      allocations: [{ rawDemandRowId: 'row-1', bucketKey: '|קו א|קבוצה א', allocatedQuantity: 3 }],
    });
  });
});
