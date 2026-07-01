import type { DemandPlanningDraftWithAssignments, RawDemandRow } from '@wos/domain';
import type { DemandSourceData } from './demand-source-adapter';
import type { ItemAllocation, SourceArea, SourceOrder, SourceOrderItem } from './scheme-types';

export type RollingDraftAudit = {
  source: DemandSourceData;
  allocationQuantityByRowId: Map<string, number>;
  syntheticUnassignedByArea: Map<string, string>;
};

function areaKey(area: string | null) {
  return area ?? '__missing__';
}

export function auditAndAdaptRollingDraft(data: DemandPlanningDraftWithAssignments): RollingDraftAudit {
  if (!data.rows) throw new Error('טיוטת הביקוש אינה כוללת את שורות המקור הנדרשות.');

  const allocationByRowId = new Map<string, (typeof data.allocations)[number]>();
  for (const allocation of data.allocations) {
    if (allocationByRowId.has(allocation.rawDemandRowId)) {
      throw new Error(`Rolling draft contains more than one allocation for row ${allocation.rawDemandRowId}.`);
    }
    allocationByRowId.set(allocation.rawDemandRowId, allocation);
  }

  const rowsById = new Map(data.rows.map((row) => [row.id, row]));
  for (const rowId of allocationByRowId.keys()) {
    if (!rowsById.has(rowId)) throw new Error(`Missing source row for allocation ${rowId}.`);
  }

  const includedRows = data.rows.filter((row) => allocationByRowId.has(row.id));
  if (includedRows.length !== allocationByRowId.size) {
    throw new Error('Rolling draft source row details are incomplete.');
  }

  const bucketsById = new Map(data.buckets.map((bucket) => [bucket.id, bucket]));
  for (const allocation of allocationByRowId.values()) {
    if (!bucketsById.has(allocation.bucketId)) {
      throw new Error(`Missing planning bucket for allocation ${allocation.id}.`);
    }
  }

  const syntheticUnassignedByArea = new Map<string, string>();
  for (const row of includedRows) {
    const key = areaKey(row.distributionArea);
    const existing = data.buckets.find((bucket) => areaKey(bucket.distributionArea) === key && bucket.bucketName === 'unassigned');
    syntheticUnassignedByArea.set(key, existing?.id ?? `rolling-unassigned:${data.draft.id}:${key}`);
  }

  const grouped = new Map<string, RawDemandRow[]>();
  for (const row of includedRows) {
    const key = JSON.stringify([areaKey(row.distributionArea), row.orderNumber, row.customerName]);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const areasByName = new Map<string, SourceArea>();
  const orders: SourceOrder[] = [];
  const orderItemMap: Record<string, SourceOrderItem[]> = {};
  for (const [groupKey, rows] of grouped) {
    const first = rows[0];
    const key = areaKey(first.distributionArea);
    const orderId = `rolling:${data.draft.id}:${groupKey}`;
    const items = rows.map((row): SourceOrderItem => ({
      id: row.id,
      orderId,
      sku: row.sku ?? '',
      description: row.description,
      category: row.category,
      quantity: allocationByRowId.get(row.id)!.allocatedQuantity,
      notes: row.notes,
      zone: null,
      sourceRows: [row.sourceRowNumber],
      sourceFile: null,
      productHandlingFlow: row.productHandlingFlow,
      planningStatus: row.planningStatus,
      issues: row.issues.length ? row.issues : undefined,
    }));
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    orders.push({
      orderId,
      orderNumber: first.orderNumber,
      customerName: first.customerName,
      pointName: null,
      sourceZone: null,
      backendStatus: 'queued',
      totalQuantity,
      itemLinesCount: items.length,
      hasAshlama: false,
      hasCheckUnits: false,
      sourceDeliveryLine: null,
      areaName: key,
      areaDisplayName: first.distributionArea ?? '(no area)',
      deliveryPointId: null,
      deliveryPointName: null,
      deliveryPointMatchStatus: null,
      rawDestinationLabel: null,
    });
    orderItemMap[orderId] = items;
    const current = areasByName.get(key);
    areasByName.set(key, {
      areaName: key,
      displayName: first.distributionArea ?? '(no area)',
      totalOrders: (current?.totalOrders ?? 0) + 1,
      totalQuantity: (current?.totalQuantity ?? 0) + totalQuantity,
      itemLinesCount: (current?.itemLinesCount ?? 0) + items.length,
    });
  }

  return {
    source: { areas: [...areasByName.values()], orders, orderItemMap, specialFlowOrders: [], specialFlowItems: [], errorOrders: [], errorItems: [] },
    allocationQuantityByRowId: new Map([...allocationByRowId].map(([id, allocation]) => [id, allocation.allocatedQuantity])),
    syntheticUnassignedByArea,
  };
}

export function buildRollingPlanAllocations(input: {
  rows: RawDemandRow[];
  allocationQuantityByRowId: Map<string, number>;
  itemAllocations: ItemAllocation[];
  bucketKeyByWorkGroupId: Map<string, string>;
  unassignedByArea: Map<string, string>;
}) {
  const rowById = new Map(input.rows.map((row) => [row.id, row]));
  const allocationsByRowId = new Map<string, ItemAllocation[]>();

  for (const allocation of input.itemAllocations) {
    const existing = allocationsByRowId.get(allocation.itemRowId);
    if (existing) existing.push(allocation);
    else allocationsByRowId.set(allocation.itemRowId, [allocation]);
  }

  return [...input.allocationQuantityByRowId].map(([rowId, quantity]) => {
    const current = allocationsByRowId.get(rowId) ?? [];
    const workGroupIds = [...new Set(current.map((allocation) => allocation.workGroupId))];

    if (workGroupIds.length > 1) {
      throw new Error(`Rolling draft row ${rowId} cannot be split across multiple work groups.`);
    }

    let workGroupId: string | undefined = workGroupIds[0];
    let allocationQuantity = current.reduce((sum, allocation) => sum + allocation.qty, 0);

    if (!workGroupId) {
      const row = rowById.get(rowId);
      if (!row) throw new Error(`Missing source row ${rowId}.`);
      workGroupId = input.unassignedByArea.get(areaKey(row.distributionArea));
      allocationQuantity = quantity;
    }

    const bucketKey = workGroupId ? input.bucketKeyByWorkGroupId.get(workGroupId) : null;
    if (!bucketKey) throw new Error(`Missing target bucket for row ${rowId}.`);

    return { rawDemandRowId: rowId, bucketKey, allocatedQuantity: allocationQuantity };
  });
}
