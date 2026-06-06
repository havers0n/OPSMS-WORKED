import { dedupePlanningWarnings, type PickingPlanningResult, type PlanningWarning, type RouteStep, type StorageLocationProjection, type WorkPackageDraft } from '@wos/domain';
import type { PlanningCoverage, UnresolvedPlanningLineSummary } from './diagnostics.js';
import type { UnresolvedPlanningLine } from './input-builder.js';

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
  locationId: string;
  addressLabel: string;
  cellId: string | null;
  productId: string | null;
  skuId: string;
  displayCode: string | null;
  barcode: string | null;
  productName: string | null;
  productImageUrl: string | null;
  qtyToPick: number;
  qtyEach: number | null;
  packagingLevels: Array<{
    id: string;
    code: string;
    name: string;
    qtyEach: number;
    sortOrder?: number;
  }>;
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

export type PlanningUnresolvedLineDto = {
  orderId: string;
  orderLineId: string;
  skuId?: string;
  productId?: string;
  qty: number;
  reason: string;
  message: string;
};

export type PlanningWarningDto = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  source?: string;
  details?: Record<string, unknown>;
};

type ResponseLocationProjectionInput = Partial<StorageLocationProjection> & {
  id: string;
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
  coverage?: PlanningCoverage;
  unresolvedSummary?: UnresolvedPlanningLineSummary;
  rootWorkPackage: PlanningWorkPackageDto;
  split: {
    wasSplit: boolean;
    reason: string;
    warnings: string[];
    packageIds: string[];
  };
  packages: PlanningPackageRouteDto[];
  locationsById: Record<string, StorageLocationProjection>;
  unresolved?: PlanningUnresolvedLineDto[];
  warnings: string[];
  warningDetails: PlanningWarningDto[];
};

function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings));
}

function mapWarningToDto(warning: PlanningWarning): PlanningWarningDto {
  return {
    code: warning.code,
    severity: warning.severity,
    message: warning.message,
    source: warning.source,
    details: warning.details ? { ...warning.details } : undefined
  };
}

function mapLocationsByIdToDto(
  locationsById: Record<string, ResponseLocationProjectionInput> | undefined
): Record<string, StorageLocationProjection> {
  if (!locationsById) return {};

  return Object.fromEntries(
    Object.entries(locationsById).map(([locationId, location]) => [
      locationId,
      {
        ...location,
        id: location.id,
        warehouseId: location.warehouseId ?? '',
        addressLabel: location.addressLabel ?? location.id
      }
    ])
  );
}

export function mapWorkPackageToDto(pkg: WorkPackageDraft): PlanningWorkPackageDto {
  return {
    id: pkg.id,
    code: pkg.code,
    method: pkg.method,
    strategyId: pkg.strategyId,
    taskCount: pkg.metadata.taskCount,
    orderCount: pkg.metadata.orderCount,
    uniqueSkuCount: pkg.metadata.uniqueSkuCount,
    uniqueLocationCount: pkg.metadata.uniqueLocationCount,
    uniqueZoneCount: pkg.metadata.uniqueZoneCount,
    uniqueAisleCount: pkg.metadata.uniqueAisleCount,
    totalWeightKg: pkg.totalWeightKg,
    totalVolumeLiters: pkg.totalVolumeLiters,
    estimatedTimeSec: pkg.estimatedTimeSec,
    estimatedDistanceMeters: pkg.estimatedDistanceMeters,
    complexity: {
      level: pkg.complexity.level,
      score: pkg.complexity.score,
      warnings: [...pkg.complexity.warnings],
      exceeds: { ...pkg.complexity.exceeds }
    },
    assignedPickerId: pkg.assignedPickerId,
    assignedZoneId: pkg.assignedZoneId,
    assignedCartId: pkg.assignedCartId,
    warnings: [...pkg.warnings]
  };
}

export function mapRouteStepToDto(
  step: RouteStep,
  args?: {
    taskById?: Map<string, WorkPackageDraft['tasks'][number]>;
    locationsById?: Record<string, StorageLocationProjection>;
  }
): PlanningRouteStepDto {
  const task = args?.taskById?.get(step.taskId);
  const location = args?.locationsById?.[step.fromLocationId];
  return {
    sequence: step.sequence,
    taskId: step.taskId,
    fromLocationId: step.fromLocationId,
    locationId: step.fromLocationId,
    addressLabel: location?.addressLabel ?? step.fromLocationId,
    cellId: location?.cellId ?? null,
    productId: task?.productId ?? null,
    skuId: step.skuId,
    displayCode: task?.displayCode ?? task?.skuId ?? step.skuId ?? null,
    barcode: task?.barcode ?? null,
    productName: task?.productName ?? null,
    productImageUrl: task?.productImageUrl ?? null,
    qtyToPick: step.qtyToPick,
    qtyEach: task?.qtyEach ?? null,
    packagingLevels: task?.packagingLevels?.map((level) => ({ ...level })) ?? [],
    allocations: step.allocations.map((allocation) => ({ ...allocation })),
    handlingInstruction: step.handlingInstruction
  };
}

export function mapPlanningPreviewToResponse(args: {
  kind: PickingPlanningPreviewKind;
  planning: PickingPlanningResult;
  input?: {
    orderIds?: string[];
    waveId?: string;
    strategyMethod?: string;
    routeMode?: string;
  };
  unresolved?: UnresolvedPlanningLine[];
  unresolvedSummary?: UnresolvedPlanningLineSummary;
  coverage?: PlanningCoverage;
  locationsById?: Record<string, ResponseLocationProjectionInput>;
  extraWarnings?: string[];
  extraWarningDetails?: PlanningWarning[];
}): PickingPlanningPreviewResponse {
  const warnings = dedupeWarnings([...(args.planning.warnings ?? []), ...(args.extraWarnings ?? [])]);
  const warningDetails = dedupePlanningWarnings([
    ...(args.planning.warningDetails ?? []),
    ...(args.extraWarningDetails ?? [])
  ]);

  return {
    kind: args.kind,
    input: {
      orderIds: args.input?.orderIds ? [...args.input.orderIds] : undefined,
      waveId: args.input?.waveId,
      strategyMethod: args.input?.strategyMethod,
      routeMode: args.input?.routeMode
    },
    strategy: {
      id: args.planning.strategy.id,
      code: args.planning.strategy.code,
      name: args.planning.strategy.name,
      method: args.planning.strategy.method,
      requiresPostSort: args.planning.strategy.requiresPostSort,
      requiresCartSlots: args.planning.strategy.requiresCartSlots,
      preserveOrderSeparation: args.planning.strategy.preserveOrderSeparation,
      aggregateSameSku: args.planning.strategy.aggregateSameSku,
      routePriorityMode: args.planning.strategy.routePriorityMode
    },
    summary: {
      packageCount: args.planning.metadata.packageCount,
      routeStepCount: args.planning.metadata.routeStepCount,
      taskCount: args.planning.metadata.taskCount,
      wasSplit: args.planning.metadata.wasSplit,
      splitReason: args.planning.metadata.splitReason,
      warningCount: warnings.length
    },
    coverage: args.coverage,
    unresolvedSummary: args.unresolvedSummary,
    rootWorkPackage: mapWorkPackageToDto(args.planning.rootPackage),
    split: {
      wasSplit: args.planning.split.wasSplit,
      reason: args.planning.split.reason,
      warnings: [...args.planning.split.warnings],
      packageIds: args.planning.split.packages.map((pkg) => pkg.id)
    },
    packages: args.planning.packages.map((plannedPackage) => {
      const taskById = new Map(plannedPackage.package.tasks.map((task) => [task.id, task]));
      return {
        workPackage: mapWorkPackageToDto(plannedPackage.package),
        route: {
          steps: plannedPackage.route.steps.map((step) =>
            mapRouteStepToDto(step, { taskById, locationsById: args.locationsById as Record<string, StorageLocationProjection> | undefined })
          ),
          warnings: [...plannedPackage.route.warnings],
          metadata: {
            mode: plannedPackage.route.metadata.mode,
            taskCount: plannedPackage.route.metadata.taskCount,
            sequencedCount: plannedPackage.route.metadata.sequencedCount,
            unknownLocationCount: plannedPackage.route.metadata.unknownLocationCount
          }
        }
      };
    }),
    locationsById: mapLocationsByIdToDto(args.locationsById),
    unresolved: args.unresolved?.map((line) => ({ ...line })),
    warnings,
    warningDetails: warningDetails.map(mapWarningToDto)
  };
}
