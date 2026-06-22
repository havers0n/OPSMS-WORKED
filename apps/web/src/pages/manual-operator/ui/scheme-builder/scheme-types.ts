import type { ManualShiftOrderStatus } from '@wos/domain';

export interface SourceDeliveryLine {
  lineId: string;
  lineGroupName: string;
  distributionArea: string | null;
  lineKind?: 'route' | 'delivery_channel';
}

export interface SourceOrder {
  orderId: string;
  orderNumber: string | null;
  customerName: string | null;
  pointName: string | null;
  sourceZone: string | null;
  backendStatus: ManualShiftOrderStatus;
  totalQuantity: number;
  itemLinesCount: number;
  hasAshlama: boolean;
  hasCheckUnits: boolean;
  sourceDeliveryLine: SourceDeliveryLine | null;
  areaName: string | null;
  areaDisplayName: string;
}

export interface SourceOrderItem {
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

export interface SourceArea {
  areaName: string | null;
  displayName: string;
  totalOrders: number;
  totalQuantity: number;
  itemLinesCount?: number;
}

export interface PlanningLine {
  id: string;
  areaName: string;
  name: string;
  sortOrder: number;
  createdAt: number;
}

export interface WorkGroup {
  id: string;
  planningLineId: string;
  areaName: string;
  name: string;
  createdAt: number;
}

export type DeleteResult =
  | { ok: true }
  | { ok: false; reason: 'has_work_groups' | 'has_assignments' };

export type OrderSplitStatus = 'unassigned' | 'assigned' | 'partial' | 'split';
