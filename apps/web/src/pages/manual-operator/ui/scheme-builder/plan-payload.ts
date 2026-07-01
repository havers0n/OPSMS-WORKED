import type { DemandPlanningPutPlanRequest, RawDemandRow } from '@wos/domain';
import type { ItemAllocation, PlanningLine, WorkGroup } from './scheme-types';
import { buildRollingPlanAllocations, type RollingDraftAudit } from './rolling-source-adapter';

type BuildPlanPayloadInput = {
  sourceKind: 'batch' | 'rolling' | undefined;
  planningLines: PlanningLine[];
  workGroups: WorkGroup[];
  itemAllocations: ItemAllocation[];
  rollingDraftAudit: RollingDraftAudit | null;
  draftRows: RawDemandRow[] | undefined;
};

export function buildPlanPayload(input: BuildPlanPayloadInput): DemandPlanningPutPlanRequest {
  const planningLineById = new Map(input.planningLines.map((line) => [line.id, line]));
  const buckets = input.workGroups.map((workGroup) => ({
    distributionArea: workGroup.areaName === '__missing__' ? null : workGroup.areaName,
    planningLineName: planningLineById.get(workGroup.planningLineId)?.name ?? 'default',
    bucketName: workGroup.name,
  }));

  const bucketKeyByWorkGroupId = new Map<string, string>();
  for (const workGroup of input.workGroups) {
    const planningLine = planningLineById.get(workGroup.planningLineId);
    bucketKeyByWorkGroupId.set(
      workGroup.id,
      `${workGroup.areaName === '__missing__' ? '' : workGroup.areaName}|${planningLine?.name ?? 'default'}|${workGroup.name}`,
    );
  }

  if (input.sourceKind === 'rolling') {
    if (!input.rollingDraftAudit || !input.draftRows) {
      throw new Error('לא ניתן לשמור טיוטה מתגלגלת: נתוני הביקורת או שורות המקור חסרים. רענן את הטיוטה ונסה שוב.');
    }

    return {
      buckets,
      allocations: buildRollingPlanAllocations({
        rows: input.draftRows,
        allocationQuantityByRowId: input.rollingDraftAudit.allocationQuantityByRowId,
        itemAllocations: input.itemAllocations,
        bucketKeyByWorkGroupId,
        unassignedByArea: input.rollingDraftAudit.syntheticUnassignedByArea,
      }),
    };
  }

  const allocations = input.itemAllocations.flatMap((allocation) => {
    const bucketKey = bucketKeyByWorkGroupId.get(allocation.workGroupId);
    return bucketKey
      ? [{ rawDemandRowId: allocation.itemRowId, bucketKey, allocatedQuantity: allocation.qty }]
      : [];
  });

  return { buckets, allocations };
}
