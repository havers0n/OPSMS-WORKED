import type {
  ManualShiftWorkHierarchyResponse,
  ManualShiftOrderItem
} from '@wos/domain';
import type {
  LineSchemeArea,
  LineSchemeBucket,
  LineSchemeData,
  LineSchemeItemRow,
  LineSchemeOrder,
  LineSchemeWorkLine,
  LocalAssignmentOverlay,
  OrderAssignmentStatus
} from './line-scheme-types';

function deriveAssignmentStatus(
  localAssignment: LocalAssignmentOverlay | null,
): OrderAssignmentStatus {
  if (!localAssignment) return 'unassigned';
  return 'assigned';
}

const NULL_BUCKET_PREFIX = '__null_bucket__';
const NULL_BUCKET_DISPLAY = 'קו ראשי';

function buildBucketKey(lineId: string, bucketName: string | null): string {
  if (bucketName === null) return `${lineId}::${NULL_BUCKET_PREFIX}`;
  return `${lineId}::${bucketName}`;
}

function adaptOrder(
  src: ManualShiftWorkHierarchyResponse['areas'][number]['lines'][number]['buckets'][number]['orders'][number],
  allOverlays: Map<string, LocalAssignmentOverlay>
): LineSchemeOrder {
  const localAssignment = allOverlays.get(src.orderId) ?? null;
  return {
    orderId: src.orderId,
    orderNumber: src.orderNumber,
    customerName: src.customerName,
    pointName: src.pointName,
    sourceZone: src.sourceZone ?? null,
    backendStatus: src.status,
    lineCount: src.lineCount,
    totalQuantity: src.totalQuantity,
    hasAshlama: src.hasAshlama,
    hasCheckUnits: src.hasCheckUnits,
    assignmentStatus: deriveAssignmentStatus(localAssignment),
    localAssignment
  };
}

function adaptBucket(
  src: ManualShiftWorkHierarchyResponse['areas'][number]['lines'][number]['buckets'][number],
  lineId: string,
  allOverlays: Map<string, LocalAssignmentOverlay>
): LineSchemeBucket {
  const bucketKey = buildBucketKey(lineId, src.bucketName);
  return {
    bucketKey,
    bucketName: src.bucketName,
    displayName: src.displayName,
    totalOrders: src.totalOrders,
    totalQuantity: src.totalQuantity,
    orders: src.orders.map(o => adaptOrder(o, allOverlays))
  };
}

function adaptLine(
  src: ManualShiftWorkHierarchyResponse['areas'][number]['lines'][number],
  allOverlays: Map<string, LocalAssignmentOverlay>
): LineSchemeWorkLine {
  return {
    lineId: src.lineId,
    areaLineKey: src.areaLineKey,
    lineGroupName: src.lineGroupName,
    distributionArea: src.distributionArea,
    lineKind: src.lineKind,
    totalOrders: src.totalOrders,
    totalQuantity: src.totalQuantity,
    itemLinesCount: src.itemLinesCount,
    buckets: src.buckets.map(b => adaptBucket(b, src.lineId, allOverlays))
  };
}

function adaptArea(
  src: ManualShiftWorkHierarchyResponse['areas'][number],
  allOverlays: Map<string, LocalAssignmentOverlay>
): LineSchemeArea {
  return {
    areaName: src.areaName,
    displayName: src.displayName,
    totalLines: src.totalLines,
    totalOrders: src.totalOrders,
    totalQuantity: src.totalQuantity,
    lines: src.lines.map(l => adaptLine(l, allOverlays))
  };
}

export function adaptWorkHierarchyToScheme(
  response: ManualShiftWorkHierarchyResponse,
  allOverlays: Map<string, LocalAssignmentOverlay> = new Map()
): LineSchemeData {
  return {
    shiftId: response.shiftId,
    areas: response.areas.map(a => adaptArea(a, allOverlays))
  };
}

export function adaptOrderItemsToSchemeRows(items: ManualShiftOrderItem[]): LineSchemeItemRow[] {
  return items.map(item => ({
    id: item.id,
    orderId: item.orderId,
    sku: item.sku,
    description: item.description,
    category: item.category,
    quantity: item.quantity,
    notes: item.notes,
    zone: item.zone,
    sourceRows: item.sourceRows,
    sourceFile: item.sourceFile
  }));
}

export function buildBucketKeyForStore(lineId: string, bucketName: string | null): string {
  return buildBucketKey(lineId, bucketName);
}

export function parseBucketKey(bucketKey: string): { lineId: string; bucketName: string | null } {
  const sepIndex = bucketKey.indexOf('::');
  if (sepIndex === -1) {
    return { lineId: bucketKey, bucketName: null };
  }
  const lineId = bucketKey.slice(0, sepIndex);
  const rawName = bucketKey.slice(sepIndex + 2);
  return {
    lineId,
    bucketName: rawName === NULL_BUCKET_PREFIX ? null : rawName
  };
}

export { NULL_BUCKET_PREFIX, NULL_BUCKET_DISPLAY };
