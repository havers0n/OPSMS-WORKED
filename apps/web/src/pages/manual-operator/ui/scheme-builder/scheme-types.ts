import type { DeliveryPointMatchStatus, ManualShiftOrderStatus, DemandImportIssue, RawDemandProductHandlingFlow, RawDemandPlanningStatus } from '@wos/domain';

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
  deliveryPointId: string | null;
  deliveryPointName: string | null;
  deliveryPointMatchStatus: DeliveryPointMatchStatus | null;
  rawDestinationLabel: string | null;
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
  productHandlingFlow?: RawDemandProductHandlingFlow;
  planningStatus?: RawDemandPlanningStatus;
  issues?: DemandImportIssue[];
  isSpecialFlow?: boolean;
  isError?: boolean;
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

export interface ItemAllocation {
  id: string;
  itemRowId: string;
  workGroupId: string;
  qty: number;
  createdAt: number;
}

export type DeleteResult =
  | { ok: true }
  | { ok: false; reason: 'has_work_groups' | 'has_assignments' };

export type AllocateResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_qty' | 'exceeds_remaining' | 'fully_allocated' | 'missing_item_qty' };

export type OrderSplitStatus = 'unassigned' | 'assigned' | 'partial' | 'split';

export type OrderBadgeStatus = 'not_loaded' | 'unassigned' | 'assigned' | 'partial' | 'split';

export interface SchemeBuilderCapabilities {
  canCreatePlanningLines: boolean;
  canCreateWorkGroups: boolean;
  canAssignOrders: boolean;
  canMoveOrders: boolean;
  canSaveDraft: boolean;
  canPublishToShift: boolean;
  canWriteManualShift: boolean;
  canPrint: boolean;
}

export type DemandPlanningDraftUiMode = 'planningDraft' | 'publishedDraft';

export type DemandPlanningPublishUiMode = 'noTargetShift' | 'readyToPublish';
