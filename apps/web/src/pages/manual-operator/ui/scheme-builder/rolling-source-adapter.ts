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
      throw new Error(`טיוטת הביקוש כוללת יותר מהקצאה אחת לשורה ${allocation.rawDemandRowId}.`);
    }
    allocationByRowId.set(allocation.rawDemandRowId, allocation);
  }

  const rowsById = new Map(data.rows.map((row) => [row.id, row]));
  for (const rowId of allocationByRowId.keys()) {
    if (!rowsById.has(rowId)) throw new Error(`חסרה שורת מקור עבור הקצאה ${rowId}.`);
  }

  const includedRows = data.rows.filter((row) => allocationByRowId.has(row.id));
  if (includedRows.length !== allocationByRowId.size) {
    throw new Error('פרטי שורות המקור בטיוטה אינם שלמים.');
  }

  const bucketsById = new Map(data.buckets.map((bucket) => [bucket.id, bucket]));
  for (const allocation of allocationByRowId.values()) {
    if (!bucketsById.has(allocation.bucketId)) throw new Error(`חסר יעד תכנון עבור הקצאה ${allocation.id}.`);
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
      areaDisplayName: first.distributionArea ?? '(ללא אזור)',
      deliveryPointId: null,
      deliveryPointName: null,
      deliveryPointMatchStatus: null,
      rawDestinationLabel: null,
    });
    orderItemMap[orderId] = items;
    const current = areasByName.get(key);
    areasByName.set(key, {
      areaName: key,
      displayName: first.distributionArea ?? '(ללא אזור)',
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
  return [...input.allocationQuantityByRowId].map(([rowId, quantity]) => {
    const current = input.itemAllocations.filter((allocation) => allocation.itemRowId === rowId);
    if (current.length > 1) throw new Error(`לא ניתן לשמור יותר מיעד אחד לשורת ביקוש ${rowId}.`);
    let workGroupId: string | undefined = current[0]?.workGroupId;
    if (!workGroupId) {
      const row = rowById.get(rowId);
      if (!row) throw new Error(`חסרה שורת מקור ${rowId}.`);
      workGroupId = input.unassignedByArea.get(areaKey(row.distributionArea));
    }
    const bucketKey = workGroupId ? input.bucketKeyByWorkGroupId.get(workGroupId) : null;
    if (!bucketKey) throw new Error(`חסר יעד לא משויך עבור שורת ביקוש ${rowId}.`);
    return { rawDemandRowId: rowId, bucketKey, allocatedQuantity: quantity };
  });
}
