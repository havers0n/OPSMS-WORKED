import type { StorageLocationProjection } from '@wos/domain';

export type PickingPlanningPreviewKind = 'explicit' | 'orders' | 'wave';

export type PlanningWorkPackageDto = {
  id: string;
  code?: string;
  method: string;
  strategyId: string;
  taskCount: number;
  orderCount: number;
  uniqueSkuCount: number;
  uniqueLocationCount: number;
  uniqueZoneCount: number;
  uniqueAisleCount: number;
  totalWeightKg?: number;
  totalVolumeLiters?: number;
  estimatedTimeSec?: number;
  estimatedDistanceMeters?: number;
  complexity: {
    level: string;
    score: number;
    warnings: string[];
    exceeds: Record<string, boolean>;
  };
  assignedPickerId?: string;
  assignedZoneId?: string;
  assignedCartId?: string;
  warnings: string[];
};

export type PlanningRouteStepDto = {
  sequence: number;
  taskId: string;
  fromLocationId: string;
  skuId: string;
  qtyToPick: number;
  allocations: Array<{
    orderId: string;
    orderLineId?: string;
    qty: number;
    cartSlotId?: string;
  }>;
  handlingInstruction?: string;
};

export type PlanningPackageRouteDto = {
  workPackage: PlanningWorkPackageDto;
  route: {
    steps: PlanningRouteStepDto[];
    warnings: string[];
    metadata: {
      mode: string;
      taskCount: number;
      sequencedCount: number;
      unknownLocationCount: number;
    };
  };
};

export type PlanningWarningDto = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  source?: string;
  details?: Record<string, unknown>;
};

export type PickingPlanningPreviewResponse = {
  kind: PickingPlanningPreviewKind;
  input: {
    orderIds?: string[];
    waveId?: string;
    strategyMethod?: string;
    routeMode?: string;
  };
  strategy: {
    id: string;
    code: string;
    name: string;
    method: string;
    requiresPostSort: boolean;
    requiresCartSlots: boolean;
    preserveOrderSeparation: boolean;
    aggregateSameSku: boolean;
    routePriorityMode: string;
  };
  summary: {
    packageCount: number;
    routeStepCount: number;
    taskCount: number;
    wasSplit: boolean;
    splitReason: string;
    warningCount: number;
  };
  coverage?: {
    orderCount: number;
    orderLineCount: number;
    plannedLineCount: number;
    unresolvedLineCount: number;
    plannedQty: number;
    unresolvedQty: number;
    planningCoveragePct: number;
  };
  unresolvedSummary?: {
    total: number;
    byReason: Record<string, number>;
  };
  rootWorkPackage: PlanningWorkPackageDto;
  split: {
    wasSplit: boolean;
    reason: string;
    warnings: string[];
    packageIds: string[];
  };
  packages: PlanningPackageRouteDto[];
  locationsById: Record<string, StorageLocationProjection>;
  unresolved?: Array<{
    orderId: string;
    orderLineId: string;
    skuId?: string;
    productId?: string;
    qty: number;
    reason: string;
    message: string;
  }>;
  warnings: string[];
  warningDetails: PlanningWarningDto[];
};

export type PickingPlanningPreviewBasePayload = {
  strategyMethod?: string;
  routeMode?: string;
  assignedPickerId?: string;
  assignedZoneId?: string;
  assignedCartId?: string;
  id?: string;
  code?: string;
};

export type PreviewPickingPlanFromOrdersPayload =
  PickingPlanningPreviewBasePayload & {
    orderIds: string[];
  };

export type PreviewPickingPlanFromWavePayload =
  PickingPlanningPreviewBasePayload & {
    waveId: string;
  };

export type PreviewExplicitPickingPlanPayload =
  PickingPlanningPreviewBasePayload & {
    tasks: Array<{
      id: string;
      skuId: string;
      fromLocationId: string;
      qty: number;
      orderRefs: Array<{
        orderId: string;
        orderLineId: string;
        qty: number;
      }>;
      weightKg?: number;
      volumeLiters?: number;
      handlingClass?: 'normal' | 'heavy' | 'bulky' | 'fragile' | 'cold' | 'frozen' | 'hazmat';
    }>;
    locationsById?: Record<string, StorageLocationProjection>;
  };

export type PickingPlanningOverlaySource =
  | { kind: 'none' }
  | { kind: 'orders'; orderIds: string[] }
  | { kind: 'wave'; waveId: string };
