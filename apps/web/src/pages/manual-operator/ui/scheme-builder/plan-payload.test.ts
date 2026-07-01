import { describe, expect, it } from 'vitest';
import type { RawDemandRow } from '@wos/domain';
import { buildPlanPayload } from './plan-payload';
import type { RollingDraftAudit } from './rolling-source-adapter';

const row = { id: 'row-1', distributionArea: 'Ч“ЧЁЧ•Чќ' } as RawDemandRow;
const rollingAudit = {
  source: { areas: [], orders: [], orderItemMap: {}, specialFlowOrders: [], specialFlowItems: [], errorOrders: [], errorItems: [] },
  allocationQuantityByRowId: new Map([['row-1', 10]]),
  syntheticUnassignedByArea: new Map([['Ч“ЧЁЧ•Чќ', 'unassigned-1']]),
} satisfies RollingDraftAudit;

describe('buildPlanPayload', () => {
  it('includes a newly created rolling bucket and points the allocation to it', () => {
    const payload = buildPlanPayload({
      sourceKind: 'rolling',
      planningLines: [{ id: 'line-1', areaName: 'Ч“ЧЁЧ•Чќ', name: 'ЧЁЧђЧ©Ч™', sortOrder: 0, createdAt: 1 }],
      workGroups: [{ id: 'group-1', planningLineId: 'line-1', areaName: 'Ч“ЧЁЧ•Чќ', name: 'Ч›ЧњЧњЧ™', createdAt: 1 }],
      itemAllocations: [{ id: 'allocation-1', itemRowId: 'row-1', workGroupId: 'group-1', qty: 10, createdAt: 1 }],
      rollingDraftAudit: rollingAudit,
      draftRows: [row],
    });

    expect(payload.buckets).toContainEqual({ distributionArea: 'Ч“ЧЁЧ•Чќ', planningLineName: 'ЧЁЧђЧ©Ч™', bucketName: 'Ч›ЧњЧњЧ™' });
    expect(payload.allocations).toEqual([{ rawDemandRowId: 'row-1', bucketKey: 'Ч“ЧЁЧ•Чќ|ЧЁЧђЧ©Ч™|Ч›ЧњЧњЧ™', allocatedQuantity: 10 }]);
  });

  it('refuses to serialize a rolling draft without its audit or source rows', () => {
    const base = { sourceKind: 'rolling' as const, planningLines: [], workGroups: [], itemAllocations: [], rollingDraftAudit: null, draftRows: undefined };
    expect(() => buildPlanPayload(base)).toThrow(/לא ניתן לשמור טיוטה מתגלגלת/);
  });

  it('preserves the batch payload behavior', () => {
    expect(buildPlanPayload({
      sourceKind: 'batch',
      planningLines: [{ id: 'line-1', areaName: '__missing__', name: 'Ч§Ч• Чђ', sortOrder: 0, createdAt: 1 }],
      workGroups: [{ id: 'group-1', planningLineId: 'line-1', areaName: '__missing__', name: 'Ч§Ч‘Ч•Ч¦Ч” Чђ', createdAt: 1 }],
      itemAllocations: [
        { id: 'allocation-1', itemRowId: 'row-1', workGroupId: 'group-1', qty: 3, createdAt: 1 },
        { id: 'allocation-2', itemRowId: 'row-2', workGroupId: 'missing-group', qty: 4, createdAt: 1 },
      ],
      rollingDraftAudit: null,
      draftRows: undefined,
    })).toEqual({
      buckets: [{ distributionArea: null, planningLineName: 'Ч§Ч• Чђ', bucketName: 'Ч§Ч‘Ч•Ч¦Ч” Чђ' }],
      allocations: [{ rawDemandRowId: 'row-1', bucketKey: '|Ч§Ч• Чђ|Ч§Ч‘Ч•Ч¦Ч” Чђ', allocatedQuantity: 3 }],
    });
  });
  it('keeps the rolling row-set valid while only moving selected rows to the chosen bucket', () => {
    const selectedRow = { id: 'row-selected', distributionArea: 'North' } as RawDemandRow;
    const untouchedRow = { id: 'row-untouched', distributionArea: 'North' } as RawDemandRow;
    const rollingAuditWithTwoRows = {
      source: { areas: [], orders: [], orderItemMap: {}, specialFlowOrders: [], specialFlowItems: [], errorOrders: [], errorItems: [] },
      allocationQuantityByRowId: new Map([
        ['row-selected', 3],
        ['row-untouched', 4],
      ]),
      syntheticUnassignedByArea: new Map([['North', 'unassigned-1']]),
    } satisfies RollingDraftAudit;

    const payload = buildPlanPayload({
      sourceKind: 'rolling',
      planningLines: [{ id: 'line-1', areaName: 'North', name: 'North', sortOrder: 0, createdAt: 1 }],
      workGroups: [
        { id: 'group-1', planningLineId: 'line-1', areaName: 'North', name: 'North', createdAt: 1 },
        { id: 'unassigned-1', planningLineId: 'line-1', areaName: 'North', name: 'unassigned', createdAt: 1 },
      ],
      itemAllocations: [{ id: 'allocation-1', itemRowId: 'row-selected', workGroupId: 'group-1', qty: 3, createdAt: 1 }],
      rollingDraftAudit: rollingAuditWithTwoRows,
      draftRows: [selectedRow, untouchedRow],
    });

    expect(payload.allocations).toEqual([
      { rawDemandRowId: 'row-selected', bucketKey: 'North|North|North', allocatedQuantity: 3 },
      { rawDemandRowId: 'row-untouched', bucketKey: 'North|North|unassigned', allocatedQuantity: 4 },
    ]);
  });

  it('keeps a rolling partial allocation at the entered quantity instead of the full source qty', () => {
    const partialRow = { id: 'row-partial', distributionArea: 'North' } as RawDemandRow;

    const payload = buildPlanPayload({
      sourceKind: 'rolling',
      planningLines: [{ id: 'line-1', areaName: 'North', name: 'North', sortOrder: 0, createdAt: 1 }],
      workGroups: [
        { id: 'group-1', planningLineId: 'line-1', areaName: 'North', name: 'North', createdAt: 1 },
        { id: 'unassigned-1', planningLineId: 'line-1', areaName: 'North', name: 'unassigned', createdAt: 1 },
      ],
      itemAllocations: [{ id: 'allocation-1', itemRowId: 'row-partial', workGroupId: 'group-1', qty: 6, createdAt: 1 }],
      rollingDraftAudit: {
        source: { areas: [], orders: [], orderItemMap: {}, specialFlowOrders: [], specialFlowItems: [], errorOrders: [], errorItems: [] },
        allocationQuantityByRowId: new Map([['row-partial', 12]]),
        syntheticUnassignedByArea: new Map([['North', 'unassigned-1']]),
      },
      draftRows: [partialRow],
    });

    expect(payload.allocations).toEqual([
      { rawDemandRowId: 'row-partial', bucketKey: 'North|North|North', allocatedQuantity: 6 },
    ]);
  });

});


