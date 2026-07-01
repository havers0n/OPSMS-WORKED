import type { PlanningLine, WorkGroup, ItemAllocation, SourceOrder, SourceOrderItem, DemandPlanningPublishUiMode } from './scheme-types';
import { getVisiblePlanningLines, getVisibleWorkGroups, isTechnicalPlanningLine, isTechnicalWorkGroup } from './scheme-display-utils';

export type PlanReadinessStatus = 'empty' | 'blocked' | 'partial' | 'ready';

export interface PlanReadiness {
  status: PlanReadinessStatus;
  canPublish: boolean;
  blockers: string[];
  warnings: string[];
  counts: {
    userPlanningLines: number;
    userWorkGroups: number;
    technicalPlanningLines: number;
    technicalWorkGroups: number;
    orders: number;
    totalRows: number;
    assignedRows: number;
    partialRows: number;
    unassignedRows: number;
  };
}

export interface PlanReadinessInput {
  orders: SourceOrder[];
  orderItemMap: Record<string, SourceOrderItem[]>;
  planningLines: PlanningLine[];
  workGroups: WorkGroup[];
  itemAllocations: ItemAllocation[];
  publishUiMode: DemandPlanningPublishUiMode;
}

export function getPlanReadiness(input: PlanReadinessInput): PlanReadiness {
  const { orders, orderItemMap, planningLines, workGroups, itemAllocations, publishUiMode } = input;

  const totalRows = Object.values(orderItemMap).reduce((acc, items) => acc + items.length, 0);
  const userPlanningLines = getVisiblePlanningLines(planningLines);
  const userWorkGroups = getVisibleWorkGroups(workGroups);
  const techPlanningLines = planningLines.filter((pl) => isTechnicalPlanningLine(pl));
  const techWorkGroups = workGroups.filter((wg) => isTechnicalWorkGroup(wg));
  const techWgIds = new Set(techWorkGroups.map((wg) => wg.id));

  function makeCounts(overrides?: {
    userPlanningLines?: number;
    userWorkGroups?: number;
    assignedRows?: number;
    partialRows?: number;
    unassignedRows?: number;
  }) {
    return {
      userPlanningLines: overrides?.userPlanningLines ?? userPlanningLines.length,
      userWorkGroups: overrides?.userWorkGroups ?? userWorkGroups.length,
      technicalPlanningLines: techPlanningLines.length,
      technicalWorkGroups: techWorkGroups.length,
      orders: orders.length,
      totalRows,
      assignedRows: overrides?.assignedRows ?? 0,
      partialRows: overrides?.partialRows ?? 0,
      unassignedRows: overrides?.unassignedRows ?? totalRows,
    };
  }

  if (orders.length === 0 || totalRows === 0) {
    return { status: 'empty', canPublish: false, blockers: [], warnings: [], counts: makeCounts() };
  }

  const itemById = new Map<string, SourceOrderItem>();
  for (const items of Object.values(orderItemMap)) {
    for (const item of items) {
      itemById.set(item.id, item);
    }
  }

  let assignedRows = 0;
  let partialRows = 0;
  let unassignedRows = 0;
  let hasAnyPublishableAllocation = false;

  for (const [itemRowId, item] of itemById) {
    const rowAllocs = itemAllocations.filter((a) => a.itemRowId === itemRowId);
    const userAllocs = rowAllocs.filter((a) => !techWgIds.has(a.workGroupId));
    const userAssignedQty = userAllocs.reduce((sum, a) => sum + a.qty, 0);

    if (userAllocs.some((a) => a.qty > 0)) {
      hasAnyPublishableAllocation = true;
    }

    if (userAssignedQty === 0) {
      unassignedRows++;
    } else if (userAssignedQty < item.quantity) {
      partialRows++;
    } else {
      assignedRows++;
    }
  }

  const blockers: string[] = [];

  if (userPlanningLines.length === 0) {
    blockers.push('לא נוצרו קווי עבודה');
  }

  if (userPlanningLines.length > 0 && userWorkGroups.length === 0) {
    blockers.push('לא נוצרו קבוצות עבודה');
  }

  if (userPlanningLines.length > 0 && userWorkGroups.length > 0 && !hasAnyPublishableAllocation) {
    blockers.push('אין שורות לפרסום');
  }

  if (publishUiMode === 'noTargetShift') {
    blockers.push('לא נבחרה משמרת יעד');
  }

  if (blockers.length > 0) {
    return {
      status: 'blocked',
      canPublish: false,
      blockers,
      warnings: [],
      counts: makeCounts({
        userPlanningLines: userPlanningLines.length,
        userWorkGroups: userWorkGroups.length,
        assignedRows,
        partialRows,
        unassignedRows,
      }),
    };
  }

  const warnings: string[] = [];
  if (unassignedRows > 0) {
    warnings.push(`${unassignedRows} שורות לא שובצו ולא יפורסמו`);
  }
  if (partialRows > 0) {
    warnings.push(`${partialRows} שורות שובצו חלקית — היתרה תישאר זמינה לתכנון הבא`);
  }

  if (warnings.length > 0) {
    return {
      status: 'partial',
      canPublish: true,
      blockers: [],
      warnings,
      counts: makeCounts({
        userPlanningLines: userPlanningLines.length,
        userWorkGroups: userWorkGroups.length,
        assignedRows,
        partialRows,
        unassignedRows,
      }),
    };
  }

  return {
    status: 'ready',
    canPublish: true,
    blockers: [],
    warnings: [],
    counts: makeCounts({
      userPlanningLines: userPlanningLines.length,
      userWorkGroups: userWorkGroups.length,
      assignedRows,
      partialRows,
      unassignedRows,
    }),
  };
}
