export type OrderAssignmentStatus = 'unassigned' | 'assigned' | 'partial' | 'split' | 'needs_review';

export interface LocalAssignmentOverlay {
  assignedLineId: string;
  assignedBucketKey: string;
  assignmentType: 'whole_order';
}

export interface LineSchemeOrder {
  orderId: string;
  orderNumber: string | null;
  customerName: string | null;
  pointName: string | null;
  sourceZone: string | null;
  backendStatus: string;
  lineCount: number;
  totalQuantity: number;
  hasAshlama: boolean;
  hasCheckUnits: boolean;
  assignmentStatus: OrderAssignmentStatus;
  localAssignment: LocalAssignmentOverlay | null;
}

export interface LineSchemeBucket {
  bucketKey: string;
  bucketName: string | null;
  displayName: string;
  totalOrders: number;
  totalQuantity: number;
  orders: LineSchemeOrder[];
}

export interface LineSchemeWorkLine {
  lineId: string;
  areaLineKey: string | undefined;
  lineGroupName: string;
  distributionArea: string | null;
  lineKind: 'route' | 'delivery_channel' | undefined;
  totalOrders: number;
  totalQuantity: number;
  itemLinesCount: number | undefined;
  buckets: LineSchemeBucket[];
}

export interface LineSchemeArea {
  areaName: string | null;
  displayName: string;
  totalLines: number;
  totalOrders: number;
  totalQuantity: number;
  lines: LineSchemeWorkLine[];
}

export interface LineSchemeData {
  shiftId: string;
  areas: LineSchemeArea[];
}

export interface LineSchemeItemRow {
  id: string;
  orderId: string;
  sku: string;
  description: string | null;
  category: string | null;
  quantity: number;
  notes: string | null;
  zone: string | null;
  sourceRows: number[] | null;
  sourceFile: string | null;
}
