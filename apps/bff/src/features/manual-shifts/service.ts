import type {
  ApplyDailyManualShiftImportResponse,
  BindableUser,
  DailyManualShiftImportPreview,
  DemandImportDataSheetCreateResponse,
  DemandImportDataSheetPreview,
  ManualShiftMonthlyApplyPlan,
  ManualShiftMonthlyApplyResponse,
  ManualShiftMonthlyExcludedRow,
  ManualShiftMonthlyReplaceSafety,
  ManualShiftBulkAddInputRow,
  ManualShiftBulkAddResult,
  ManualShiftDaySummary,
  ManualShiftLine,
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderCheckUnit,
  ManualShiftOrderAshlama,
  ManualShiftOrderAshlamaStatus,
  ManualShiftOrderCheckUnitStatus,
  ManualShiftOrderError,
  ManualShiftOrderEvent,
  ManualShiftOrderItem,
  ManualShiftOrderDetail,
  ManualShiftOrderStatus,
  ManualShiftOrderSize,
  ManualShiftPeopleSummary,
  ManualShiftSession,
  ManualShiftTodayResponse,
  ManualShiftWorker,
  ManualShiftWorkerRole,
  ManualShiftWorkHierarchyResponse,
  OpenAshlamaBoardItem,
  BucketProductRollupResponse,
  ProductControlResponse,
  PickerSheetPrintData,
  PickerSheetWorkGroup,
  RawDemandRow,
  RawDemandPlanningPreview,
  DemandPlanningDraftWithAssignments,
  DemandPlanningPublishToShiftResponse,
  DemandPlanningRevertPublicationResponse,
  DemandImportAppendDiffResponse,
  DemandImportAppendExistingLine,
  DemandImportAvailableBatchCard,
  DemandImportAppendExistingItem,
  DemandBacklogItem,
  DemandBacklogItemResponse,
  DemandAvailableDemandResponse,
  DemandBacklogItemStatus,
  DemandBacklogListResponse,
  DemandBacklogSummaryResponse,
  BacklogMergeRowInput,
  DemandBacklogMergeAction,
  DemandAvailableDemandSnapshot,
  RollingAvailableDemandResponse
} from '@wos/domain';
import { buildAvailableDemandResponse, resolveRollingAvailableDemandV1 } from '@wos/domain';
import {
  buildProductControlRow,
  buildRawDemandPlanningPreview,
  calculateSizeFromLineCount,
  canTransitionManualShiftOrderToDoneWithCheckUnits,
  canTransitionManualShiftOrderStatus,
  computeProductControlTotals,
  computeDemandImportAppendDiff,
  deriveManualShiftLineStatus,
  getEffectiveExpectedCheckUnitsCount,
  manualShiftBulkAddInputRowSchema,
  aggregateBondedAvailabilityBySku,
  aggregatePickerItems,
  processCollisions,
  getDisplaySku,
  computeBacklogMergeAction,
  computeBacklogItemStatus,
  computeOpenQuantity,
  type SkuBondedAggregate
} from '@wos/domain';
import { computeDemandBacklogIdentityKey } from './demand-backlog-crypto.js';
import type { BondedService } from '../bonded/bonded-service.js';
import type { WarehouseStockService } from '../warehouse-stock/warehouse-stock-service.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DeliveryPointAliasMatchResult,
  DeliveryPointAliasMatchingService
} from '../delivery-points/delivery-point-matching-service.js';
import { normalizeDeliveryPointAliasText } from '@wos/domain';
import {
  invalidManualShiftOrderCreateStatus,
  invalidManualShiftOrderCheckUnitTransition,
  invalidManualShiftOrderTransition,
  manualShiftAlreadyActive,
  manualShiftClosed,
  manualShiftLineDeleteBlocked,
  manualShiftLineNotFound,
  manualShiftLineNotFoundByName,
  manualShiftLineAreaMismatch,
  manualShiftNotFound,
  manualShiftOrderNotFound,
  manualShiftOrderCheckUnitNotFound,
  manualShiftOrderDoneBlockedByCheckUnits,
  manualShiftOrderDoneBlockedByOpenAshlama,
  manualShiftOrderCheckUnitNumberConflict,
  manualShiftOrderCheckUnitReturnedReasonRequired,
  manualShiftAshlamaRequiresReturnedCheckUnit,
  manualShiftAshlamaRequiresMissingProductReason,
  manualShiftAshlamaDuplicateOpenForCheckUnit,
  manualShiftAshlamaCheckUnitOrderMismatch,
  manualShiftPickerWorkerInvalid,
  manualShiftWorkerNotFound,
  manualShiftWorkerAuthUserNotInTenant,
  manualShiftWorkerAuthUserAlreadyBound,
  manualShiftWorkerAuthUserForbidden,
  manualShiftImportShiftDateMismatch,
  manualShiftImportShiftNotActive,
  manualShiftImportShiftNotEmpty,
  manualShiftImportShiftNotFound,
  manualShiftImportInvalidPreviewPayload,
  manualShiftImportForbidden,
  manualShiftMonthlyImportRequiresReplaceMode,
  manualShiftMonthlyReplaceNotSafe,
  demandPlanningDraftNotFound,
  demandPlanningDraftNotMutable,
  demandPlanningDraftAlreadyApplied,
  demandPlanningRollingPublishNotSupported,
  demandPlanningRollingDraftNotSupported,
  demandPlanningNoRollingAvailableDemand,
  demandPlanningRollingAvailableDemandInvariantViolation,
  demandPlanningAllocationOverflow,
  demandPlanningRawDemandRowNotFound,
  demandPlanningBucketNotFound,
  demandPlanningTargetDateAmbiguous,
  demandPlanningExistingLineConflict,
  demandPlanningNoPublishableRows,
  demandPlanningPublicationNotFound,
  demandPlanningPublicationAlreadyReverted,
  demandPlanningDraftNotApplied,
  demandPlanningPublishedShiftHasActivity,
  demandPlanningPublicationOldNoLineage
} from './errors.js';
import { ApiError } from '../../errors.js';
import type { ManualShiftsRepo, MonthlyImportShiftCounts } from './repo.js';
import { createManualShiftsRepo } from './repo.js';
import { mapManualShiftLineRowToDomain } from './repo.js';

const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';

type ActorContext = {
  actorProfileId: string | null;
  actorName: string | null;
};

export type ManualShiftsService = {
  listShiftWorkers(input: { tenantId: string; shiftId: string }): Promise<ManualShiftWorker[]>;
  createWorker(input: {
    tenantId: string;
    shiftId: string;
    name: string;
    role: ManualShiftWorkerRole;
    sortOrder: number;
    authUserId?: string | null;
  }): Promise<ManualShiftWorker>;
  patchWorker(input: {
    tenantId: string;
    workerId: string;
    name?: string;
    role?: ManualShiftWorkerRole;
    active?: boolean;
    sortOrder?: number;
    authUserId?: string | null;
  }): Promise<ManualShiftWorker>;
  deactivateWorker(input: { tenantId: string; workerId: string }): Promise<ManualShiftWorker>;
  listBindableUsers(tenantId: string): Promise<BindableUser[]>;
  getTodayShift(tenantId: string): Promise<ManualShiftTodayResponse>;
  getShiftByDate(tenantId: string, date: string): Promise<ManualShiftTodayResponse>;
  getShiftById(tenantId: string, shiftId: string): Promise<ManualShiftTodayResponse>;
  createShift(input: { tenantId: string; date?: string; name: string; actor: ActorContext }): Promise<ManualShiftSession>;
  closeShift(input: { tenantId: string; shiftId: string }): Promise<ManualShiftSession>;
  listShiftLines(input: { tenantId: string; shiftId: string }): Promise<ManualShiftLineSummary[]>;
  createLine(input: { tenantId: string; shiftId: string; name: string; sortOrder: number }): Promise<ManualShiftLine>;
  patchLine(input: { tenantId: string; lineId: string; name?: string; sortOrder?: number }): Promise<ManualShiftLine>;
  deleteLine(input: {
    tenantId: string;
    lineId: string;
    reason?: string;
    actor: ActorContext;
  }): Promise<ManualShiftLine>;
  restoreLine(input: {
    tenantId: string;
    lineId: string;
    reason?: string;
    actor: ActorContext;
  }): Promise<ManualShiftLine>;
  listShiftOrders(input: { tenantId: string; shiftId: string }): Promise<ManualShiftOrder[]>;
  listLineOrders(input: { tenantId: string; lineId: string }): Promise<ManualShiftOrder[]>;
  listOrderCheckUnits(input: { tenantId: string; orderId: string }): Promise<ManualShiftOrderCheckUnit[]>;
  listOrderAshlamot(input: { tenantId: string; orderId: string }): Promise<ManualShiftOrderAshlama[]>;
  listOpenShiftAshlamot(input: { tenantId: string; shiftId: string }): Promise<OpenAshlamaBoardItem[]>;
  listOrderEvents(input: { tenantId: string; orderId: string }): Promise<ManualShiftOrderEvent[]>;
  listOrderItems(input: { tenantId: string; orderId: string }): Promise<ManualShiftOrderItem[]>;
  getOrderDetail(input: { tenantId: string; orderId: string }): Promise<ManualShiftOrderDetail>;
  createOrderAshlama(input: {
    tenantId: string;
    orderId: string;
    checkUnitId?: string | null;
    text: string;
    actor: ActorContext;
  }): Promise<ManualShiftOrderAshlama>;
  patchOrderAshlamaStatus(input: {
    tenantId: string;
    ashlamaId: string;
    status: ManualShiftOrderAshlamaStatus;
    actor: ActorContext;
  }): Promise<ManualShiftOrderAshlama>;
  createOrderCheckUnit(input: {
    tenantId: string;
    orderId: string;
    note?: string | null;
    reason?: string | null;
    actor: ActorContext;
  }): Promise<ManualShiftOrderCheckUnit>;
  patchOrderCheckUnit(input: {
    tenantId: string;
    checkUnitId: string;
    note?: string | null;
    reason?: string | null;
    actor: ActorContext;
  }): Promise<ManualShiftOrderCheckUnit>;
  transitionOrderCheckUnitStatus(input: {
    tenantId: string;
    checkUnitId: string;
    status: ManualShiftOrderCheckUnitStatus;
    reason?: string | null;
    note?: string | null;
    actor: ActorContext;
  }): Promise<ManualShiftOrderCheckUnit>;
  createOrder(input: {
    tenantId: string;
    lineId: string;
    pointName: string;
    orderNumber?: string | null;
    customerName?: string | null;
    pickerName?: string | null;
    pickerWorkerId?: string | null;
    checkerName?: string | null;
    lineCount?: number | null;
    palletCount?: number | null;
    size?: ManualShiftOrderSize;
    status?: ManualShiftOrderStatus;
    comment?: string | null;
    actor: ActorContext;
  }): Promise<ManualShiftOrder>;
  bulkCreateOrders(input: {
    tenantId: string;
    lineId: string;
    rawText?: string;
    rows?: Array<{
      raw: string;
      pointName: string;
      orderNumber?: string | null;
      pickerName: string | null;
      lineCount: number | null;
      palletCount?: number | null;
      size?: ManualShiftOrderSize;
    }>;
    actor: ActorContext;
  }): Promise<ManualShiftBulkAddResult>;
  patchOrder(input: {
    tenantId: string;
    orderId: string;
    pointName?: string | null;
    orderNumber?: string | null;
    customerName?: string | null;
    pickerName?: string | null;
    pickerWorkerId?: string | null;
    checkerName?: string | null;
    lineCount?: number | null;
    palletCount?: number | null;
    size?: ManualShiftOrderSize;
    comment?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    checkedAt?: string | null;
    lineId?: string | null;
    actor: ActorContext;
  }): Promise<ManualShiftOrder>;
  startOrderCheck(input: {
    tenantId: string;
    orderId: string;
    actor: ActorContext;
  }): Promise<ManualShiftOrder>;
  deleteOrder(input: {
    tenantId: string;
    orderId: string;
    reason?: string;
    actor: ActorContext;
  }): Promise<ManualShiftOrder>;
  restoreOrder(input: {
    tenantId: string;
    orderId: string;
    reason?: string;
    actor: ActorContext;
  }): Promise<ManualShiftOrder>;
  transitionOrderStatus(input: {
    tenantId: string;
    orderId: string;
    status: ManualShiftOrderStatus;
    actor: ActorContext;
  }): Promise<ManualShiftOrder>;
  createOrderError(input: {
    tenantId: string;
    orderId: string;
    type: ManualShiftOrderError['type'];
    comment?: string | null;
    actor: ActorContext;
  }): Promise<ManualShiftOrderError>;
  getPeopleSummary(input: { tenantId: string; shiftId: string }): Promise<ManualShiftPeopleSummary>;
  getDaySummary(input: { tenantId: string; shiftId: string }): Promise<ManualShiftDaySummary>;
  applyDailyImport(input: {
    tenantId: string;
    shiftId: string;
    preview: DailyManualShiftImportPreview;
    actor: ActorContext;
  }): Promise<ApplyDailyManualShiftImportResponse>;
  previewDemandImportDataSheet(input: {
    preview: DemandImportDataSheetPreview;
  }): Promise<DemandImportDataSheetPreview>;
  createDemandImportDataSheet(input: {
    tenantId: string;
    sourceFile: string;
    preview: DemandImportDataSheetPreview;
    uploadedBy: string | null;
  }): Promise<DemandImportDataSheetCreateResponse>;
  getDemandPlanningPreview(input: {
    tenantId: string;
    batchId: string;
    scope?: 'all' | 'remaining';
  }): Promise<RawDemandPlanningPreview>;
  listAvailableDemandImportBatches(input: {
    tenantId: string;
  }): Promise<DemandImportAvailableBatchCard[]>;
  applyMonthlyImport(input: {
    tenantId: string;
    shiftId: string;
    selectedDate: string;
    plan: ManualShiftMonthlyApplyPlan;
    excludedRows?: ManualShiftMonthlyExcludedRow[];
    mode?: 'initial' | 'replace';
  }): Promise<ManualShiftMonthlyApplyResponse>;
  checkMonthlyReplaceSafety(input: {
    tenantId: string;
    shiftId: string;
  }): Promise<ManualShiftMonthlyReplaceSafety>;
  getShiftWorkHierarchy(input: {
    tenantId: string;
    shiftId: string;
  }): Promise<ManualShiftWorkHierarchyResponse>;
  getBucketProductRollup(input: {
    tenantId: string;
    shiftId: string;
    lineId: string;
    bucketName: string;
    distributionArea?: string;
    sourceZone?: string;
    workBucketName?: string;
    sourceLineName?: string;
  }): Promise<BucketProductRollupResponse>;
  getProductControl(input: { tenantId: string; shiftId: string }): Promise<ProductControlResponse>;
  computeDemandImportAppendDiff(input: {
    tenantId: string;
    batchId: string;
    shiftId: string;
  }): Promise<DemandImportAppendDiffResponse>;
  getPickerSheetWorkGroup(input: {
    tenantId: string;
    shiftId: string;
    distributionArea: string;
    planningLineName: string;
    workGroupName: string;
  }): Promise<PickerSheetPrintData>;
  getPickerSheetLine(input: {
    tenantId: string;
    shiftId: string;
    distributionArea: string;
    planningLineName: string;
  }): Promise<PickerSheetPrintData>;

  // Demand Planning Draft
  createDemandPlanningDraft(input: {
    tenantId: string;
    batchId: string;
    createdBy: string | null;
    sourceScope?: 'all' | 'remaining';
  }): Promise<DemandPlanningDraftWithAssignments>;
  createRollingDemandPlanningDraft(input: {
    tenantId: string;
    createdBy: string | null;
  }): Promise<DemandPlanningDraftWithAssignments>;
  getDemandPlanningDraft(input: {
    tenantId: string;
    draftId: string;
  }): Promise<DemandPlanningDraftWithAssignments>;
  putDemandPlanningPlan(input: {
    tenantId: string;
    draftId: string;
    buckets: Array<{
      distributionArea: string | null;
      planningLineName: string;
      bucketName: string;
    }>;
    allocations: Array<{
      rawDemandRowId: string;
      bucketKey: string;
      allocatedQuantity: number;
    }>;
  }): Promise<DemandPlanningDraftWithAssignments>;
  publishDemandPlanningDraftToShift(input: {
    tenantId: string;
    draftId: string;
    targetShiftId: string;
  }): Promise<DemandPlanningPublishToShiftResponse>;
  revertDemandPlanningPublication(input: {
    tenantId: string;
    publicationId: string;
  }): Promise<DemandPlanningRevertPublicationResponse>;

  // Demand Backlog
  mergeRowsIntoBacklog(input: {
    tenantId: string;
    batchId: string;
    rows: RawDemandRow[];
  }): Promise<void>;

  getDemandBacklog(input: {
    tenantId: string;
    status: 'open' | 'special_flow' | 'requires_review' | 'all';
    distributionArea?: string;
    search?: string;
    sourceBatchId?: string;
    page: number;
    limit: number;
  }): Promise<DemandBacklogListResponse>;

  getDemandBacklogSummary(input: {
    tenantId: string;
    status: 'open' | 'special_flow' | 'requires_review' | 'all';
    distributionArea?: string;
    search?: string;
    sourceBatchId?: string;
  }): Promise<DemandBacklogSummaryResponse>;

  getAvailableDemand(input: {
    tenantId: string;
  }): Promise<DemandAvailableDemandResponse>;

  getRollingAvailableDemand(input: {
    tenantId: string;
  }): Promise<RollingAvailableDemandResponse>;
};

function formatLocalDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function buildLineSummaries(lines: ManualShiftLine[], orders: ManualShiftOrder[], errors: ManualShiftOrderError[]) {
  const activeOrderIds = new Set(orders.map((order) => order.id));
  return lines.map<ManualShiftLineSummary>((line) => {
    const lineOrders = orders.filter((order) => order.lineId === line.id);
    const lineErrors = errors.filter(
      (error) => error.lineId === line.id && activeOrderIds.has(error.orderId)
    );

    return {
      line: {
        ...line,
        status: deriveManualShiftLineStatus(lineOrders)
      },
      totalOrders: lineOrders.length,
      queuedOrders: lineOrders.filter((order) => order.status === 'queued').length,
      pickingOrders: lineOrders.filter((order) => order.status === 'picking').length,
      waitingCheckOrders: lineOrders.filter((order) => order.status === 'waiting_check').length,
      returnedOrders: lineOrders.filter((order) => order.status === 'returned').length,
      doneOrders: lineOrders.filter((order) => order.status === 'done').length,
      errorCount: lineErrors.length
    };
  });
}

async function buildShiftLineSummariesLite(repo: ManualShiftsRepo, shiftId: string, tenantId: string) {
  return repo.listShiftLineSummaries(shiftId, tenantId);
}

function buildMonthlyImportShiftGuardDetails(counts: MonthlyImportShiftCounts): MonthlyImportShiftCounts {
  return {
    shiftId: counts.shiftId,
    activeLinesCount: counts.activeLinesCount,
    activeOrdersCount: counts.activeOrdersCount,
    softDeletedLinesCount: counts.softDeletedLinesCount,
    softDeletedOrdersCount: counts.softDeletedOrdersCount
  };
}

function deriveOrderSize(
  lineCount: number | null | undefined,
  explicitSize: ManualShiftOrderSize | undefined,
  fallbackSize: ManualShiftOrderSize = 'unknown'
) {
  if (lineCount !== undefined) {
    if (lineCount === null) {
      return explicitSize ?? 'unknown';
    }

    return calculateSizeFromLineCount(lineCount);
  }

  return explicitSize ?? fallbackSize;
}

function parseBulkRows(rawText: string): ManualShiftBulkAddResult {
  const rawRows = rawText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  const rows: ManualShiftBulkAddInputRow[] = [];
  const skippedRows: string[] = [];

  for (const raw of rawRows) {
    const parts = raw.split(',').map((part) => part.trim());
    const pointName = parts[0] ?? '';
    const pickerName = parts[1] ? parts[1] : null;
    const maybeLineCount = parts[2] ? Number(parts[2]) : null;
    const maybePalletCount = parts[3] ? Number(parts[3]) : null;

    if (!pointName) {
      skippedRows.push(raw);
      continue;
    }

    const lineCount =
      maybeLineCount !== null && Number.isInteger(maybeLineCount) && maybeLineCount > 0
        ? maybeLineCount
        : null;

    const palletCount =
      maybePalletCount !== null && !isNaN(maybePalletCount) && maybePalletCount >= 0
        ? maybePalletCount
        : null;

    rows.push(
      manualShiftBulkAddInputRowSchema.parse({
        raw,
        pointName,
        orderNumber: null,
        pickerName,
        lineCount,
        palletCount,
        size: calculateSizeFromLineCount(lineCount)
      })
    );
  }

  return {
    createdCount: 0,
    rows,
    skippedRows
  };
}

const allowedManualShiftOrderCheckUnitTransitions: Record<
  ManualShiftOrderCheckUnitStatus,
  readonly ManualShiftOrderCheckUnitStatus[]
> = {
  open: ['checked', 'returned', 'voided'],
  checked: ['voided'],
  returned: ['open', 'checked', 'voided'],
  voided: []
};

function canTransitionManualShiftOrderCheckUnitStatus(
  from: ManualShiftOrderCheckUnitStatus,
  to: ManualShiftOrderCheckUnitStatus
) {
  return allowedManualShiftOrderCheckUnitTransitions[from].includes(to);
}

export function createManualShiftsServiceFromRepo(
  repo: ManualShiftsRepo,
  options?: {
    getNowIso?: () => string;
    getTodayDate?: () => string;
    warehouseStockService?: WarehouseStockService;
    deliveryPointAliasMatchingService?: DeliveryPointAliasMatchingService;
  },
  bondedService?: BondedService
): ManualShiftsService {
  const getNowIso = options?.getNowIso ?? (() => new Date().toISOString());
  const getTodayDate = options?.getTodayDate ?? (() => formatLocalDate(new Date(), DEFAULT_TIME_ZONE));

  async function requireShift(shiftId: string) {
    const shift = await repo.findShiftById(shiftId);
    if (!shift) {
      throw manualShiftNotFound(shiftId);
    }

    return shift;
  }

  async function requireActiveShift(shiftId: string) {
    const shift = await requireShift(shiftId);
    if (shift.status !== 'active') {
      throw manualShiftClosed(shiftId);
    }

    return shift;
  }

  async function listScopedRawDemandRows(input: {
    tenantId: string;
    batchId: string;
    scope?: 'all' | 'remaining';
  }) {
    const rows = await repo.listRawDemandRowsByBatch({
      tenantId: input.tenantId,
      batchId: input.batchId
    });

    if (input.scope !== 'remaining') return rows;

    const published = repo.listPublishedDemandQuantities
      ? await repo.listPublishedDemandQuantities({
          tenantId: input.tenantId,
          batchId: input.batchId
        })
      : [];
    const publishedByRowId = new Map<string, number>();
    for (const entry of published) {
      publishedByRowId.set(
        entry.rawDemandRowId,
        (publishedByRowId.get(entry.rawDemandRowId) ?? 0) + entry.publishedQuantity
      );
    }

    return rows.flatMap((row) => {
      if (row.planningStatus !== 'unplanned') return [row];
      const remainingQuantity = Math.max(0, (row.quantity ?? 0) - (publishedByRowId.get(row.id) ?? 0));
      return remainingQuantity > 0 ? [{ ...row, quantity: remainingQuantity }] : [];
    });
  }

  async function requireLine(lineId: string) {
    const line = await repo.findLineById(lineId);
    if (!line) {
      throw manualShiftLineNotFound(lineId);
    }

    return line;
  }

  async function requireOrder(orderId: string) {
    const order = await repo.findOrderById(orderId);
    if (!order) {
      throw manualShiftOrderNotFound(orderId);
    }

    return order;
  }

  async function requireCheckUnit(checkUnitId: string) {
    const checkUnit = await repo.findOrderCheckUnitById(checkUnitId);
    if (!checkUnit) {
      throw manualShiftOrderCheckUnitNotFound(checkUnitId);
    }

    return checkUnit;
  }

  async function buildShiftLines(shiftId: string) {
    const [lineRows, orders, errors] = await Promise.all([
      repo.listShiftLines(shiftId),
      repo.listShiftOrders(shiftId),
      repo.listShiftErrors(shiftId)
    ]);
    const lines = lineRows.map((lineRow) =>
      mapManualShiftLineRowToDomain(lineRow, deriveManualShiftLineStatus(orders.filter((order) => order.lineId === lineRow.id)))
    );

    return buildLineSummaries(lines, orders, errors);
  }

  async function requireWorker(workerId: string) {
    const worker = await repo.findWorkerById(workerId);
    if (!worker) throw manualShiftWorkerNotFound(workerId);
    return worker;
  }

  function normalizeOptionalString(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  return {
    async getShiftById(tenantId, shiftId) {
      const shift = await requireShift(shiftId);
      if (shift.tenantId !== tenantId) throw manualShiftNotFound(shiftId);
      return {
        shift,
        lines: await buildShiftLineSummariesLite(repo, shift.id, tenantId)
      };
    },

    async listShiftWorkers(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) throw manualShiftNotFound(input.shiftId);
      return repo.listShiftWorkers(input.shiftId);
    },

    async createWorker(input) {
      const shift = await requireActiveShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) throw manualShiftNotFound(input.shiftId);
      return repo.createWorker({
        tenantId: input.tenantId,
        shiftId: input.shiftId,
        name: input.name,
        role: input.role,
        sortOrder: input.sortOrder,
        authUserId: input.authUserId
      });
    },

    async patchWorker(input) {
      const worker = await requireWorker(input.workerId);
      if (worker.tenantId !== input.tenantId) throw manualShiftWorkerNotFound(input.workerId);

      if (input.authUserId !== undefined) {
        try {
          await repo.setWorkerAuthUser(input.workerId, input.authUserId);
        } catch (err) {
          const pgErr = err as { code?: string; message?: string } | null;
          if (pgErr?.code === 'P0001') {
            switch (pgErr.message) {
              case 'WORKER_AUTH_USER_FORBIDDEN':
                throw manualShiftWorkerAuthUserNotInTenant(input.authUserId ?? 'unknown');
              case 'WORKER_AUTH_USER_ALREADY_BOUND':
                throw manualShiftWorkerAuthUserAlreadyBound(input.authUserId ?? 'unknown', 'unknown');
              case 'FORBIDDEN':
                throw manualShiftWorkerAuthUserForbidden(input.workerId);
              case 'WORKER_NOT_FOUND':
                throw manualShiftWorkerNotFound(input.workerId);
            }
          }
          throw err;
        }
      }

      const updated = await repo.updateWorker(input.workerId, {
        name: input.name,
        role: input.role,
        active: input.active,
        sortOrder: input.sortOrder,
        authUserId: input.authUserId
      });
      if (!updated) throw manualShiftWorkerNotFound(input.workerId);
      return updated;
    },

    async deactivateWorker(input) {
      const worker = await requireWorker(input.workerId);
      if (worker.tenantId !== input.tenantId) throw manualShiftWorkerNotFound(input.workerId);
      const updated = await repo.updateWorker(input.workerId, { active: false });
      if (!updated) throw manualShiftWorkerNotFound(input.workerId);
      return updated;
    },

    async listBindableUsers(tenantId) {
      return repo.listBindableUsers(tenantId);
    },

    async getTodayShift(tenantId) {
      const date = getTodayDate();
      const shift = await repo.findActiveShiftByDate(tenantId, date);

      if (!shift) {
        return {
          shift: null,
          lines: []
        };
      }

      return {
        shift,
        lines: await buildShiftLineSummariesLite(repo, shift.id, tenantId)
      };
    },

    async getShiftByDate(tenantId, date) {
      const shift = await repo.findShiftByDate(tenantId, date);

      if (!shift) {
        return {
          shift: null,
          lines: []
        };
      }

      return {
        shift,
        lines: await buildShiftLineSummariesLite(repo, shift.id, tenantId)
      };
    },

    async createShift(input) {
      const date = input.date ?? getTodayDate();
      const existing = await repo.findActiveShiftByDate(input.tenantId, date);
      if (existing) {
        throw manualShiftAlreadyActive(date);
      }

      return repo.createShift({
        tenantId: input.tenantId,
        date,
        name: input.name,
        createdByProfileId: input.actor.actorProfileId,
        createdByName: input.actor.actorName
      });
    },

    async closeShift(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      if (shift.status === 'closed') {
        return shift;
      }

      const updated = await repo.closeShift(input.shiftId, getNowIso());
      if (!updated) {
        throw manualShiftNotFound(input.shiftId);
      }

      return updated;
    },

    async listShiftLines(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      return buildShiftLineSummariesLite(repo, input.shiftId, input.tenantId);
    },

    async createLine(input) {
      const shift = await requireActiveShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      const lineRow = await repo.createLine(input);
      return mapManualShiftLineRowToDomain(lineRow, 'open');
    },

    async patchLine(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId || line.deleted_at) {
        throw manualShiftLineNotFound(input.lineId);
      }

      await requireActiveShift(line.shift_id);

      const updated = await repo.updateLine(input.lineId, {
        name: input.name,
        sortOrder: input.sortOrder
      });

      if (!updated) {
        throw manualShiftLineNotFound(input.lineId);
      }

      const orders = await repo.listLineOrders(input.lineId);
      return mapManualShiftLineRowToDomain(updated, deriveManualShiftLineStatus(orders));
    },

    async deleteLine(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId) {
        throw manualShiftLineNotFound(input.lineId);
      }

      await requireActiveShift(line.shift_id);

      if (line.deleted_at) {
        return mapManualShiftLineRowToDomain(line, 'open');
      }

      const activeOrders = await repo.listLineOrders(input.lineId);
      if (activeOrders.length > 0) {
        throw manualShiftLineDeleteBlocked();
      }

      const updated = await repo.updateLine(input.lineId, {
        deletedAt: getNowIso(),
        deletedByProfileId: input.actor.actorProfileId,
        deletedByName: input.actor.actorName,
        deleteReason: input.reason ?? null
      });

      if (!updated) {
        throw manualShiftLineNotFound(input.lineId);
      }

      await repo.createLineEvent({
        tenantId: input.tenantId,
        shiftId: updated.shift_id,
        lineId: updated.id,
        eventType: 'line_deleted',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        payload: input.reason ? { reason: input.reason } : null
      });

      return mapManualShiftLineRowToDomain(updated, 'open');
    },

    async restoreLine(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId) {
        throw manualShiftLineNotFound(input.lineId);
      }

      await requireActiveShift(line.shift_id);

      if (!line.deleted_at) {
        const orders = await repo.listLineOrders(input.lineId);
        return mapManualShiftLineRowToDomain(line, deriveManualShiftLineStatus(orders));
      }

      const updated = await repo.updateLine(input.lineId, {
        deletedAt: null,
        deletedByProfileId: null,
        deletedByName: null,
        deleteReason: null
      });

      if (!updated) {
        throw manualShiftLineNotFound(input.lineId);
      }

      await repo.createLineEvent({
        tenantId: input.tenantId,
        shiftId: updated.shift_id,
        lineId: updated.id,
        eventType: 'line_restored',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        payload: input.reason ? { reason: input.reason } : null
      });

      const orders = await repo.listLineOrders(input.lineId);
      return mapManualShiftLineRowToDomain(updated, deriveManualShiftLineStatus(orders));
    },

    async listShiftOrders(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      const orders = await repo.listShiftOrders(input.shiftId);
      const rollups = await repo.listOrdersItemRollups(orders.map((o) => o.id));
      return orders.map((order) => {
        const rollup = rollups.get(order.id);
        if (rollup) {
          return { ...order, lineCount: rollup.lineCount, totalQuantity: rollup.totalQuantity } as ManualShiftOrder;
        }
        return { ...order, totalQuantity: 0 } as ManualShiftOrder;
      });
    },

    async listLineOrders(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId || line.deleted_at) {
        throw manualShiftLineNotFound(input.lineId);
      }

      const orders = await repo.listLineOrders(input.lineId);
      const rollups = await repo.listOrdersItemRollups(orders.map((o) => o.id));
      return orders.map((order) => {
        const rollup = rollups.get(order.id);
        if (rollup) {
          return { ...order, lineCount: rollup.lineCount, totalQuantity: rollup.totalQuantity } as ManualShiftOrder;
        }
        return { ...order, totalQuantity: 0 } as ManualShiftOrder;
      });
    },

    async listOrderCheckUnits(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      return repo.listOrderCheckUnits(input.orderId);
    },

    async listOrderAshlamot(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }
      return repo.listOrderAshlamot(input.orderId);
    },

    async listOpenShiftAshlamot(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }
      return repo.listOpenShiftAshlamot(input.tenantId, input.shiftId);
    },

    async listOrderEvents(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }
      return repo.listOrderEvents(input.orderId);
    },

    async listOrderItems(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }
      return repo.listOrderItems(input.tenantId, input.orderId);
    },

    async getOrderDetail(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      const items = await repo.listOrderItems(input.tenantId, input.orderId);
      const lineCount = items.length > 0 ? items.length : order.lineCount ?? 0;
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      return {
        ...order,
        lineCount,
        totalQuantity,
        items
      };
    },

    async createOrderAshlama(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }
      await requireActiveShift(order.shiftId);
      const normalizedCheckUnitId = input.checkUnitId ?? null;
      let source: ManualShiftOrderAshlama['source'] = 'manual';

      if (normalizedCheckUnitId) {
        const checkUnit = await requireCheckUnit(normalizedCheckUnitId);
        if (checkUnit.tenantId !== input.tenantId) {
          throw manualShiftOrderCheckUnitNotFound(normalizedCheckUnitId);
        }
        if (checkUnit.orderId !== order.id) {
          throw manualShiftAshlamaCheckUnitOrderMismatch(normalizedCheckUnitId, order.id);
        }
        if (checkUnit.status !== 'returned') {
          throw manualShiftAshlamaRequiresReturnedCheckUnit(normalizedCheckUnitId);
        }
        const ashlamaEligibleReasons = ['מוצר אזל', 'שכח לשים'];
        if (!ashlamaEligibleReasons.includes((checkUnit.reason ?? '').trim())) {
          throw manualShiftAshlamaRequiresMissingProductReason(normalizedCheckUnitId);
        }
        const existing = await repo.listOrderAshlamot(order.id);
        if (
          existing.some(
            (ashlama) =>
              ashlama.status === 'open' &&
              ashlama.source === 'check_unit' &&
              ashlama.checkUnitId === checkUnit.id
          )
        ) {
          throw manualShiftAshlamaDuplicateOpenForCheckUnit(checkUnit.id);
        }
        source = 'check_unit';
      }

      const created = await repo.createOrderAshlama({
        tenantId: order.tenantId,
        shiftId: order.shiftId,
        lineId: order.lineId,
        orderId: order.id,
        checkUnitId: normalizedCheckUnitId,
        source,
        status: 'open',
        text: input.text.trim(),
        createdByProfileId: input.actor.actorProfileId,
        createdByName: input.actor.actorName
      });

      await repo.createOrderEvent({
        tenantId: order.tenantId,
        shiftId: order.shiftId,
        lineId: order.lineId,
        orderId: order.id,
        eventType: 'ashlama_created',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: null,
        toStatus: null,
        payload: {
          ashlamaId: created.id,
          source: created.source,
          checkUnitId: created.checkUnitId,
          status: created.status,
          text: created.text
        }
      });

      return created;
    },

    async patchOrderAshlamaStatus(input) {
      const ashlama = await repo.findOrderAshlamaById(input.ashlamaId);
      if (!ashlama || ashlama.tenantId !== input.tenantId) {
        throw manualShiftOrderNotFound(input.ashlamaId);
      }
      await requireActiveShift(ashlama.shiftId);
      const previousStatus = ashlama.status;
      const updated = await repo.updateOrderAshlama(input.ashlamaId, {
        status: input.status,
        updatedByProfileId: input.actor.actorProfileId,
        updatedByName: input.actor.actorName
      });
      if (!updated) {
        throw manualShiftOrderNotFound(input.ashlamaId);
      }

      await repo.createOrderEvent({
        tenantId: ashlama.tenantId,
        shiftId: ashlama.shiftId,
        lineId: ashlama.lineId,
        orderId: ashlama.orderId,
        eventType: 'ashlama_status_changed',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: null,
        toStatus: null,
        payload: {
          ashlamaId: updated.id,
          source: updated.source,
          checkUnitId: updated.checkUnitId,
          fromStatus: previousStatus,
          toStatus: updated.status
        }
      });

      return updated;
    },

    async createOrderCheckUnit(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await requireActiveShift(order.shiftId);

      let created: ManualShiftOrderCheckUnit;
      try {
        created = await repo.createOrderCheckUnit({
          tenantId: order.tenantId,
          shiftId: order.shiftId,
          lineId: order.lineId,
          orderId: order.id,
          status: 'open',
          note: input.note ?? null,
          reason: input.reason ?? null,
          createdByProfileId: input.actor.actorProfileId,
          createdByName: input.actor.actorName
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'MANUAL_SHIFT_ORDER_CHECK_UNIT_NUMBER_CONFLICT'
        ) {
          throw manualShiftOrderCheckUnitNumberConflict(order.id);
        }
        throw error;
      }

      await repo.createOrderEvent({
        tenantId: order.tenantId,
        shiftId: order.shiftId,
        lineId: order.lineId,
        orderId: order.id,
        eventType: 'check_unit_created',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: null,
        toStatus: null,
        payload: {
          checkUnitId: created.id,
          unitNumber: created.unitNumber,
          status: created.status,
          note: created.note,
          reason: created.reason
        }
      });

      return created;
    },

    async patchOrderCheckUnit(input) {
      const checkUnit = await requireCheckUnit(input.checkUnitId);
      if (checkUnit.tenantId !== input.tenantId) {
        throw manualShiftOrderCheckUnitNotFound(input.checkUnitId);
      }

      const order = await requireOrder(checkUnit.orderId);
      if (order.deletedAt) {
        throw manualShiftOrderNotFound(order.id);
      }

      await requireActiveShift(order.shiftId);

      const updated = await repo.updateOrderCheckUnit(checkUnit.id, {
        note: input.note,
        reason: input.reason,
        updatedByProfileId: input.actor.actorProfileId,
        updatedByName: input.actor.actorName
      });

      if (!updated) {
        throw manualShiftOrderCheckUnitNotFound(input.checkUnitId);
      }

      await repo.createOrderEvent({
        tenantId: order.tenantId,
        shiftId: order.shiftId,
        lineId: order.lineId,
        orderId: order.id,
        eventType: 'check_unit_note_changed',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: null,
        toStatus: null,
        payload: {
          checkUnitId: updated.id,
          unitNumber: updated.unitNumber,
          note: updated.note,
          reason: updated.reason
        }
      });

      return updated;
    },

    async transitionOrderCheckUnitStatus(input) {
      const checkUnit = await requireCheckUnit(input.checkUnitId);
      if (checkUnit.tenantId !== input.tenantId) {
        throw manualShiftOrderCheckUnitNotFound(input.checkUnitId);
      }

      const order = await requireOrder(checkUnit.orderId);
      if (order.deletedAt) {
        throw manualShiftOrderNotFound(order.id);
      }

      await requireActiveShift(order.shiftId);

      if (!canTransitionManualShiftOrderCheckUnitStatus(checkUnit.status, input.status)) {
        throw invalidManualShiftOrderCheckUnitTransition(checkUnit.status, input.status);
      }

      const nowIso = getNowIso();
      const normalizedReason = input.reason?.trim() ?? null;
      if (input.status === 'returned' && !normalizedReason) {
        throw manualShiftOrderCheckUnitReturnedReasonRequired(input.checkUnitId);
      }
      const patch: Parameters<ManualShiftsRepo['updateOrderCheckUnit']>[1] = {
        status: input.status,
        note: input.note,
        reason:
          input.status === 'returned' || input.status === 'checked' || input.status === 'voided'
            ? (normalizedReason ?? checkUnit.reason)
            : input.status === 'open'
              ? null
              : checkUnit.reason,
        updatedByProfileId: input.actor.actorProfileId,
        updatedByName: input.actor.actorName
      };

      if (input.status === 'checked') {
        patch.checkedAt = nowIso;
      }
      if (input.status === 'returned') {
        patch.returnedAt = nowIso;
      }
      if (input.status === 'voided') {
        patch.voidedAt = nowIso;
      }
      if (input.status === 'open') {
        patch.checkedAt = null;
        patch.returnedAt = null;
      }

      const updated = await repo.updateOrderCheckUnit(checkUnit.id, patch);
      if (!updated) {
        throw manualShiftOrderCheckUnitNotFound(input.checkUnitId);
      }

      await repo.createOrderEvent({
        tenantId: order.tenantId,
        shiftId: order.shiftId,
        lineId: order.lineId,
        orderId: order.id,
        eventType: 'check_unit_status_changed',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: null,
        toStatus: null,
        payload: {
          checkUnitId: updated.id,
          unitNumber: updated.unitNumber,
          fromStatus: checkUnit.status,
          toStatus: updated.status,
          note: updated.note,
          reason: updated.reason
        }
      });

      return updated;
    },

    async createOrder(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId || line.deleted_at) {
        throw manualShiftLineNotFound(input.lineId);
      }

      const shift = await requireActiveShift(line.shift_id);
      const status = input.status ?? 'queued';
      if (status !== 'queued' && status !== 'picking') {
        throw invalidManualShiftOrderCreateStatus(status);
      }

      const order = await repo.createOrder({
        tenantId: input.tenantId,
        shiftId: line.shift_id,
        lineId: line.id,
        pointName: input.pointName,
        orderNumber: input.orderNumber ?? null,
        customerName: input.customerName ?? null,
        palletCount: input.palletCount ?? null,
        pickerName: input.pickerName ?? null,
        pickerWorkerId: input.pickerWorkerId ?? null,
        checkerName: input.checkerName ?? null,
        lineCount: input.lineCount ?? null,
        size: deriveOrderSize(input.lineCount, input.size),
        status,
        startedAt: status === 'picking' ? getNowIso() : null,
        comment: input.comment ?? null
      });

      await repo.createOrderEvent({
        tenantId: input.tenantId,
        shiftId: shift.id,
        lineId: line.id,
        orderId: order.id,
        eventType: 'created',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: null,
        toStatus: order.status,
        payload: {
          pointName: order.pointName,
          orderNumber: order.orderNumber,
          palletCount: order.palletCount,
          lineCount: order.lineCount,
          size: order.size
        }
      });

      return order;
    },

    async bulkCreateOrders(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId || line.deleted_at) {
        throw manualShiftLineNotFound(input.lineId);
      }

      await requireActiveShift(line.shift_id);

      const parsed = input.rows
        ? {
            createdCount: 0,
            rows: input.rows.map((row) =>
              manualShiftBulkAddInputRowSchema.parse({
                raw: row.raw,
                pointName: row.pointName,
                orderNumber: row.orderNumber ?? null,
                pickerName: row.pickerName,
                lineCount: row.lineCount,
                palletCount: row.palletCount ?? null,
                size: calculateSizeFromLineCount(row.lineCount)
              })
            ),
            skippedRows: [] as string[]
          }
        : parseBulkRows(input.rawText ?? '');

      let createdCount = 0;

      for (const row of parsed.rows) {
        const order = await repo.createOrder({
          tenantId: input.tenantId,
          shiftId: line.shift_id,
          lineId: line.id,
          pointName: row.pointName,
          orderNumber: row.orderNumber,
          customerName: null,
          pickerName: row.pickerName,
          pickerWorkerId: null,
          checkerName: null,
          lineCount: row.lineCount,
          palletCount: row.palletCount,
          size: row.size,
          status: 'queued',
          startedAt: null,
          comment: null
        });

        createdCount += 1;

        await repo.createOrderEvent({
          tenantId: input.tenantId,
          shiftId: line.shift_id,
          lineId: line.id,
          orderId: order.id,
          eventType: 'bulk_imported',
          actorProfileId: input.actor.actorProfileId,
          actorName: input.actor.actorName,
          fromStatus: null,
          toStatus: order.status,
          payload: {
            raw: row.raw
          }
        });
      }

      return {
        createdCount,
        rows: parsed.rows,
        skippedRows: parsed.skippedRows
      };
    },

    async applyDailyImport(input) {
      try {
        return await repo.applyDailyImport({
          tenantId: input.tenantId,
          shiftId: input.shiftId,
          preview: input.preview
        });
      } catch (error) {
        const dbError = error as { code?: string; message?: string };
        if (dbError?.code === 'P0001') {
          if (dbError.message === 'SHIFT_NOT_FOUND') {
            throw manualShiftImportShiftNotFound(input.shiftId);
          }
          if (dbError.message === 'SHIFT_NOT_ACTIVE') {
            throw manualShiftImportShiftNotActive(input.shiftId);
          }
          if (dbError.message === 'SHIFT_DATE_MISMATCH') {
            throw manualShiftImportShiftDateMismatch(
              input.shiftId,
              'unknown',
              input.preview.importDate
            );
          }
          if (dbError.message === 'SHIFT_NOT_EMPTY') {
            throw manualShiftImportShiftNotEmpty(input.shiftId);
          }
          if (dbError.message === 'INVALID_PREVIEW_PAYLOAD') {
            throw manualShiftImportInvalidPreviewPayload();
          }
        }
        if (dbError?.code === '22007' || dbError?.code === '22P02') {
          throw manualShiftImportInvalidPreviewPayload();
        }
        if (dbError?.code === '42501') {
          throw manualShiftImportForbidden();
        }
        throw error;
      }
    },

    async previewDemandImportDataSheet(input) {
      return input.preview;
    },

    async createDemandImportDataSheet(input) {
      const batch = await repo.createDemandImportBatch({
        tenantId: input.tenantId,
        sourceFile: input.sourceFile,
        sourceSheet: input.preview.sourceSheet,
        uploadedBy: input.uploadedBy,
        status: 'ready',
        rowsCount: input.preview.rowsCount,
        rawRowsCount: input.preview.rawRowsCount,
        warningRowsCount: input.preview.warningRowsCount,
        errorRowsCount: input.preview.errorRowsCount,
        specialFlowRowsCount: input.preview.specialFlowRowsCount,
        distributionAreasCount: input.preview.distributionAreasCount,
        distinctOrdersCount: input.preview.distinctOrdersCount,
        distinctSkuCount: input.preview.distinctSkuCount
      });

      await repo.insertRawDemandRows({
        tenantId: input.tenantId,
        batchId: batch.id,
        sourceSheet: input.preview.sourceSheet,
        rows: input.preview.rows
      });

      const [persistedBatch, distributionAreaSummary, allRows, sampleRows] = await Promise.all([
        repo.getDemandImportBatch({
          tenantId: input.tenantId,
          batchId: batch.id
        }),
        repo.listDemandBatchDistributionAreaSummary({
          tenantId: input.tenantId,
          batchId: batch.id
        }),
        repo.listRawDemandRowsByBatch({
          tenantId: input.tenantId,
          batchId: batch.id
        }),
        repo.listRawDemandRowsByBatch({
          tenantId: input.tenantId,
          batchId: batch.id,
          limit: 20
        })
      ]);

      // Merge non-error rows into global backlog (using persisted rows with IDs)
      await this.mergeRowsIntoBacklog({
        tenantId: input.tenantId,
        batchId: batch.id,
        rows: allRows
      });

      return {
        batch: persistedBatch,
        preview: {
          ...input.preview,
          distributionAreaSummary,
          sampleRows: sampleRows.map((row) => ({
            sourceSheet: row.sourceSheet,
            sourceRowNumber: row.sourceRowNumber,
            agent: row.agent,
            orderDate: row.orderDate,
            customerName: row.customerName,
            orderNumber: row.orderNumber,
            sku: row.sku,
            description: row.description,
            category: row.category,
            quantity: row.quantity,
            cost: row.cost,
            notes: row.notes,
            distributionArea: row.distributionArea,
            rawRouteLine: row.rawRouteLine,
            plannedDeliveryDate: row.plannedDeliveryDate,
            plannedRouteLine: row.plannedRouteLine,
            plannedWorkBucket: row.plannedWorkBucket,
            planningStatus: row.planningStatus,
            routeFlow: row.routeFlow,
            productHandlingFlow: row.productHandlingFlow,
            noteDateHints: row.noteDateHints,
            issues: row.issues
          }))
        }
      };
    },

    async getDemandPlanningPreview(input) {
      const [batch, rows] = await Promise.all([
        repo.getDemandImportBatch({
          tenantId: input.tenantId,
          batchId: input.batchId
        }),
        listScopedRawDemandRows(input)
      ]);

      return buildRawDemandPlanningPreview({
        batch,
        rows
      });
    },

    async listAvailableDemandImportBatches(input) {
      return repo.listAvailableDemandImportBatches({ tenantId: input.tenantId });
    },

    async computeDemandImportAppendDiff(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      const [batch, rows, lines, orders, orderItems] = await Promise.all([
        repo.getDemandImportBatch({ tenantId: input.tenantId, batchId: input.batchId }),
        repo.listRawDemandRowsByBatch({ tenantId: input.tenantId, batchId: input.batchId }),
        repo.listShiftLines(input.shiftId),
        repo.listShiftOrders(input.shiftId),
        repo.listShiftOrderItems(input.shiftId)
      ]);

      if (!batch) {
        throw new ApiError(404, 'BATCH_NOT_FOUND', 'Demand import batch not found.');
      }

      const existingLines: DemandImportAppendExistingLine[] = lines
        .filter((l) => l.deleted_at === null)
        .map((l) => ({
          lineId: l.id,
          lineName: l.name,
          distributionArea: l.distribution_area,
          status: 'open'
        }));

      const orderMap = new Map(orders.map((o) => [o.id, o]));

      const existingItems: DemandImportAppendExistingItem[] = [];
      for (const item of orderItems) {
        const order = orderMap.get(item.orderId);
        if (!order) continue;
        const line = existingLines.find((l) => l.lineId === item.lineId);
        if (!line) continue;
        existingItems.push({
          lineId: item.lineId,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          sku: item.sku,
          quantity: item.quantity,
          distributionArea: line.distributionArea
        });
      }

      return computeDemandImportAppendDiff({
        batchId: input.batchId,
        shiftId: input.shiftId,
        rows,
        existingLines,
        existingItems
      });

      return computeDemandImportAppendDiff({
        batchId: input.batchId,
        shiftId: input.shiftId,
        rows,
        existingLines,
        existingItems
      });
    },

    async applyMonthlyImport(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      if (shift.status !== 'active') {
        throw manualShiftImportShiftNotActive(input.shiftId);
      }

      if (shift.date !== input.selectedDate) {
        throw manualShiftImportShiftDateMismatch(input.shiftId, shift.date, input.selectedDate);
      }

      const monthlyImportShiftCounts = await repo.countMonthlyImportShiftRows({
        tenantId: input.tenantId,
        shiftId: input.shiftId
      });
      const hasWork = monthlyImportShiftCounts.activeLinesCount > 0 || monthlyImportShiftCounts.activeOrdersCount > 0;

      if (hasWork && input.mode !== 'replace') {
        throw manualShiftMonthlyImportRequiresReplaceMode(
          input.shiftId,
          buildMonthlyImportShiftGuardDetails(monthlyImportShiftCounts)
        );
      }

      if (input.plan.blockingWarnings.length > 0) {
        throw manualShiftImportInvalidPreviewPayload();
      }

      try {
        const result = await repo.applyMonthlyImport({
          tenantId: input.tenantId,
          shiftId: input.shiftId,
          selectedDate: input.selectedDate,
          plan: input.plan,
          mode: input.mode
        });

        if (input.excludedRows && input.excludedRows.length > 0) {
          await repo.insertMonthlyImportExcludedRows({
            tenantId: input.tenantId,
            shiftId: input.shiftId,
            sourceFile: input.plan.preview.source.fileName,
            sourceSheet: input.plan.preview.source.sheetName,
            rows: input.excludedRows.map((row) => ({
              sourceRowNumber: row.sourceRowNumber,
              exclusionReason: row.exclusionReason,
              orderNumber: row.orderNumber,
              customerName: row.customerName,
              sku: row.sku,
              description: row.description,
              category: row.category,
              quantity: row.quantity,
              rawRouteLine: row.rawRouteLine,
              deliveryDate: row.deliveryDate,
              notes: row.notes
            }))
          });
        }

        // ── DeliveryPoint alias matching for non-Chita orders ──────────
        if (options?.deliveryPointAliasMatchingService) {
          try {
            const matchService = options.deliveryPointAliasMatchingService;
            const allOrders = await repo.listShiftOrders(input.shiftId);
            const lines = await repo.listShiftLines(input.shiftId);
            const isChitaLine = new Map(
              lines.map((l) => [l.id, l.name.trim().toLowerCase().startsWith("צ'יטה")])
            );

            // Build per-order match data: rawDestinationLabel + skip Chita
            const matchRequests: Array<{ orderId: string; label: string | null; skip: boolean }> = [];
            for (const order of allOrders) {
              const isChita = isChitaLine.get(order.lineId) ?? false;
              const sourceZone = order.sourceZone ?? null;

              // For Chita lines, skip matching when pointName equals sourceZone
              const skip = isChita && (order.pointName === sourceZone || !order.pointName);

              const rawDestinationLabel = order.pointName ?? order.customerName ?? null;
              matchRequests.push({ orderId: order.id, label: rawDestinationLabel, skip });
            }

            // Batch-match unique non-skipped labels
            const uniqueLabels = [...new Set(
              matchRequests
                .filter((r) => !r.skip && r.label)
                .map((r) => r.label as string)
            )];

            if (uniqueLabels.length > 0) {
              const matchResults = await matchService.matchAliasesExact(uniqueLabels);
              const resultByLabel = new Map<string, DeliveryPointAliasMatchResult>();
              for (const r of matchResults) {
                resultByLabel.set(r.normalizedInput, r);
              }

              // Update each order with matching result or 'not_attempted'
              for (const req of matchRequests) {
                if (req.skip || !req.label) {
                  await repo.updateOrder(req.orderId, {
                    rawDestinationLabel: req.label,
                    deliveryPointMatchStatus: 'not_attempted'
                  });
                  continue;
                }

                const normalized = normalizeDeliveryPointAliasText(req.label);
                const matchResult = resultByLabel.get(normalized);

                if (!matchResult) {
                  await repo.updateOrder(req.orderId, {
                    rawDestinationLabel: req.label,
                    deliveryPointMatchStatus: 'not_attempted'
                  });
                  continue;
                }

                switch (matchResult.status) {
                  case 'matched':
                    await repo.updateOrder(req.orderId, {
                      rawDestinationLabel: req.label,
                      deliveryPointId: matchResult.deliveryPoint.id,
                      deliveryPointName: matchResult.deliveryPoint.displayName,
                      deliveryPointMatchStatus: 'matched',
                      deliveryPointAliasText: matchResult.normalizedInput,
                      deliveryPointAliasId: undefined
                    });
                    break;
                  case 'unmatched':
                    await repo.updateOrder(req.orderId, {
                      rawDestinationLabel: req.label,
                      deliveryPointMatchStatus: 'unmatched',
                      deliveryPointAliasText: matchResult.normalizedInput
                    });
                    break;
                  case 'ambiguous':
                    await repo.updateOrder(req.orderId, {
                      rawDestinationLabel: req.label,
                      deliveryPointMatchStatus: 'ambiguous',
                      deliveryPointAliasText: matchResult.normalizedInput
                    });
                    break;
                }
              }
            } else {
              // All orders skipped — set rawDestinationLabel but skip matching
              for (const req of matchRequests) {
                if (req.label) {
                  await repo.updateOrder(req.orderId, {
                    rawDestinationLabel: req.label,
                    deliveryPointMatchStatus: 'not_attempted'
                  });
                }
              }
            }
          } catch (matchError) {
            // Do not fail the import on matching failure; gracefully fallback
            console.warn('[DeliveryPoint] Alias matching failed during monthly import apply:', matchError);
          }
        }

        return result;
      } catch (error) {
        const dbError = error as { code?: string; message?: string; hint?: string };
        if (dbError?.code === 'P0001') {
          if (dbError.message === 'SHIFT_NOT_FOUND') {
            throw manualShiftImportShiftNotFound(input.shiftId);
          }
          if (dbError.message === 'SHIFT_NOT_ACTIVE') {
            throw manualShiftImportShiftNotActive(input.shiftId);
          }
          if (dbError.message === 'SHIFT_DATE_MISMATCH') {
            throw manualShiftImportShiftDateMismatch(input.shiftId, shift.date, input.selectedDate);
          }
          if (dbError.message === 'SHIFT_NOT_EMPTY') {
            throw manualShiftMonthlyImportRequiresReplaceMode(
              input.shiftId,
              buildMonthlyImportShiftGuardDetails(monthlyImportShiftCounts)
            );
          }
          if (dbError.message === 'MONTHLY_REPLACE_NOT_SAFE') {
            const reasons = dbError.hint ? [dbError.hint] : [];
            throw manualShiftMonthlyReplaceNotSafe(input.shiftId, reasons);
          }
          if (dbError.message === 'INVALID_PREVIEW_PAYLOAD') {
            throw manualShiftImportInvalidPreviewPayload();
          }
        }
        if (dbError?.code === '22007' || dbError?.code === '22P02') {
          throw manualShiftImportInvalidPreviewPayload();
        }
        if (dbError?.code === '42501') {
          throw manualShiftImportForbidden();
        }
        throw error;
      }
    },

    async checkMonthlyReplaceSafety(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }
      return repo.checkMonthlyReplaceSafety({
        tenantId: input.tenantId,
        shiftId: input.shiftId
      });
    },

    async patchOrder(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await requireActiveShift(order.shiftId);

      if (input.lineId !== undefined) {
        if (input.lineId !== null) {
          const targetLine = await requireLine(input.lineId);
          if (targetLine.tenant_id !== input.tenantId) {
            throw manualShiftLineNotFound(input.lineId);
          }
          if (targetLine.shift_id !== order.shiftId) {
            throw manualShiftLineNotFound(input.lineId);
          }
        }
      }

      const hasPickerPatch =
        input.pickerWorkerId !== undefined || input.pickerName !== undefined;
      let nextPickerWorkerId = order.pickerWorkerId;
      let nextPickerName = order.pickerName;

      if (hasPickerPatch) {
        if (input.pickerWorkerId !== undefined && input.pickerWorkerId !== null) {
          const worker = await repo.findWorkerById(input.pickerWorkerId);
          if (!worker) {
            throw manualShiftWorkerNotFound(input.pickerWorkerId);
          }
          if (worker.tenantId !== input.tenantId) {
            throw manualShiftPickerWorkerInvalid(worker.id, 'WRONG_TENANT');
          }
          if (worker.shiftId !== order.shiftId) {
            throw manualShiftPickerWorkerInvalid(worker.id, 'WRONG_SHIFT');
          }
          if (!worker.active) {
            throw manualShiftPickerWorkerInvalid(worker.id, 'INACTIVE');
          }
          nextPickerWorkerId = worker.id;
          nextPickerName = worker.name;
        } else if (
          input.pickerWorkerId === null &&
          input.pickerName !== undefined &&
          input.pickerName !== null
        ) {
          nextPickerWorkerId = null;
          nextPickerName = input.pickerName;
        } else if (input.pickerWorkerId === null && input.pickerName === null) {
          nextPickerWorkerId = null;
          nextPickerName = null;
        } else if (
          input.pickerWorkerId === undefined &&
          input.pickerName !== undefined
        ) {
          nextPickerWorkerId = null;
          nextPickerName = input.pickerName;
        } else if (input.pickerWorkerId === null && input.pickerName === undefined) {
          nextPickerWorkerId = null;
          nextPickerName = order.pickerName;
        }
      }

      const updated = await repo.updateOrder(input.orderId, {
        pointName: input.pointName,
        orderNumber: input.orderNumber,
        customerName: input.customerName,
        pickerName: hasPickerPatch ? nextPickerName : input.pickerName,
        pickerWorkerId: hasPickerPatch ? nextPickerWorkerId : input.pickerWorkerId,
        checkerName: input.checkerName,
        lineCount: input.lineCount,
        palletCount: input.palletCount,
        size: deriveOrderSize(input.lineCount, input.size, order.size),
        comment: input.comment,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        checkedAt: input.checkedAt,
        lineId: input.lineId
      });

      if (!updated) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      const pickerChanged =
        order.pickerWorkerId !== updated.pickerWorkerId || order.pickerName !== updated.pickerName;

      if (pickerChanged) {
        await repo.createOrderEvent({
          tenantId: input.tenantId,
          shiftId: updated.shiftId,
          lineId: updated.lineId,
          orderId: updated.id,
          eventType: 'picker_changed',
          actorProfileId: input.actor.actorProfileId,
          actorName: input.actor.actorName,
          fromStatus: null,
          toStatus: null,
          payload: {
            previousPickerName: order.pickerName,
            previousPickerWorkerId: order.pickerWorkerId,
            nextPickerName: updated.pickerName,
            nextPickerWorkerId: updated.pickerWorkerId
          }
        });
      }

      const hadNonPickerPatch =
        input.pointName !== undefined ||
        input.orderNumber !== undefined ||
        input.customerName !== undefined ||
        input.checkerName !== undefined ||
        input.lineCount !== undefined ||
        input.palletCount !== undefined ||
        input.size !== undefined ||
        input.comment !== undefined ||
        input.startedAt !== undefined ||
        input.finishedAt !== undefined ||
        input.checkedAt !== undefined;

      if (hadNonPickerPatch) {
        await repo.createOrderEvent({
          tenantId: input.tenantId,
          shiftId: updated.shiftId,
          lineId: updated.lineId,
          orderId: updated.id,
          eventType: 'updated',
          actorProfileId: input.actor.actorProfileId,
          actorName: input.actor.actorName,
          fromStatus: null,
          toStatus: null,
          payload: {
            pointName: updated.pointName,
            orderNumber: updated.orderNumber,
            pickerName: updated.pickerName,
            checkerName: updated.checkerName,
            lineCount: updated.lineCount,
            palletCount: updated.palletCount,
            size: updated.size,
            comment: updated.comment
          }
        });
      }

      return updated;
    },

    async startOrderCheck(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await requireActiveShift(order.shiftId);

      if (order.status !== 'picking') {
        throw invalidManualShiftOrderTransition(order.status, 'waiting_check');
      }

      if (order.checkStartedAt) {
        return order;
      }

      const nowIso = getNowIso();
      const updated = await repo.updateOrder(input.orderId, {
        checkStartedAt: nowIso
      });

      if (!updated) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await repo.createOrderEvent({
        tenantId: input.tenantId,
        shiftId: updated.shiftId,
        lineId: updated.lineId,
        orderId: updated.id,
        eventType: 'check_started',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: null,
        toStatus: null,
        payload: null
      });

      return updated;
    },

    async deleteOrder(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await requireActiveShift(order.shiftId);

      if (order.deletedAt) {
        return order;
      }

      const updated = await repo.updateOrder(input.orderId, {
        deletedAt: getNowIso(),
        deletedByProfileId: input.actor.actorProfileId,
        deletedByName: input.actor.actorName,
        deleteReason: input.reason ?? null
      });

      if (!updated) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await repo.createOrderEvent({
        tenantId: input.tenantId,
        shiftId: updated.shiftId,
        lineId: updated.lineId,
        orderId: updated.id,
        eventType: 'point_deleted',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: order.status,
        toStatus: null,
        payload: input.reason ? { reason: input.reason } : null
      });

      return updated;
    },

    async restoreOrder(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await requireActiveShift(order.shiftId);

      if (!order.deletedAt) {
        return order;
      }

      const updated = await repo.updateOrder(input.orderId, {
        deletedAt: null,
        deletedByProfileId: null,
        deletedByName: null,
        deleteReason: null
      });

      if (!updated) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await repo.createOrderEvent({
        tenantId: input.tenantId,
        shiftId: updated.shiftId,
        lineId: updated.lineId,
        orderId: updated.id,
        eventType: 'point_restored',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: null,
        toStatus: updated.status,
        payload: input.reason ? { reason: input.reason } : null
      });

      return updated;
    },

    async transitionOrderStatus(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await requireActiveShift(order.shiftId);

      if (!canTransitionManualShiftOrderStatus(order.status, input.status)) {
        throw invalidManualShiftOrderTransition(order.status, input.status);
      }

      const nowIso = getNowIso();
      const patch: Parameters<ManualShiftsRepo['updateOrder']>[1] = {
        status: input.status
      };

      if (order.status === 'queued' && input.status === 'picking' && !order.startedAt) {
        patch.startedAt = nowIso;
      }

      if (order.status === 'picking' && input.status === 'waiting_check') {
        patch.waitingCheckAt = nowIso;
      }

      if (order.status === 'waiting_check' && input.status === 'done') {
        const checkUnits = await repo.listOrderCheckUnits(order.id);
        const effectiveExpectedUnitsCount = getEffectiveExpectedCheckUnitsCount({
          declaredPalletCount: order.palletCount,
          units: checkUnits
        });
        if (!canTransitionManualShiftOrderToDoneWithCheckUnits(checkUnits, effectiveExpectedUnitsCount)) {
          throw manualShiftOrderDoneBlockedByCheckUnits(order.id);
        }
        const ashlamot = await repo.listOrderAshlamot(order.id);
        if (ashlamot.some((ashlama) => ashlama.status === 'open')) {
          throw manualShiftOrderDoneBlockedByOpenAshlama(order.id);
        }
        if (!order.checkedAt) patch.checkedAt = nowIso;
        patch.finishedAt = nowIso;
      }

      if (order.status === 'waiting_check' && input.status === 'returned') {
        if (!order.checkedAt) patch.checkedAt = nowIso;
      }

      if (order.status === 'returned' && input.status === 'waiting_check') {
        patch.waitingCheckAt = nowIso;
      }

      const updated = await repo.updateOrder(input.orderId, patch);
      if (!updated) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await repo.createOrderEvent({
        tenantId: input.tenantId,
        shiftId: updated.shiftId,
        lineId: updated.lineId,
        orderId: updated.id,
        eventType: 'status_changed',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: order.status,
        toStatus: updated.status,
        payload: null
      });

      return updated;
    },

    async createOrderError(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await requireActiveShift(order.shiftId);

      const error = await repo.createOrderError({
        tenantId: input.tenantId,
        shiftId: order.shiftId,
        lineId: order.lineId,
        orderId: order.id,
        type: input.type,
        comment: input.comment ?? null,
        createdByProfileId: input.actor.actorProfileId,
        createdByName: input.actor.actorName
      });

      await repo.updateOrder(order.id, {
        status: 'returned',
        ...(!order.checkedAt ? { checkedAt: getNowIso() } : {})
      });

      await repo.createOrderEvent({
        tenantId: input.tenantId,
        shiftId: order.shiftId,
        lineId: order.lineId,
        orderId: order.id,
        eventType: 'error_reported',
        actorProfileId: input.actor.actorProfileId,
        actorName: input.actor.actorName,
        fromStatus: order.status,
        toStatus: 'returned',
        payload: {
          type: input.type,
          comment: input.comment ?? null
        }
      });

      return error;
    },

    async getPeopleSummary(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      const orders = await repo.listShiftOrders(input.shiftId);
      const errors = await repo.listShiftErrors(input.shiftId);
      const activeOrderIds = new Set(orders.map((order) => order.id));
      const pickerNames = Array.from(
        new Set(orders.map((order) => order.pickerName).filter((name): name is string => Boolean(name)))
      );

      return {
        shiftId: shift.id,
        items: pickerNames.map((pickerName) => {
          const pickerOrders = orders.filter((order) => order.pickerName === pickerName);
          const pickerOrderIds = new Set(pickerOrders.map((order) => order.id));
          const currentActiveOrder =
            pickerOrders.find((order) => order.status === 'picking') ?? null;

          return {
            pickerName,
            activeOrdersCount: pickerOrders.filter((order) => order.status === 'picking').length,
            waitingCheckCount: pickerOrders.filter((order) => order.status === 'waiting_check').length,
            returnedCount: pickerOrders.filter((order) => order.status === 'returned').length,
            doneCount: pickerOrders.filter((order) => order.status === 'done').length,
            errorCount: errors.filter(
              (error) => activeOrderIds.has(error.orderId) && pickerOrderIds.has(error.orderId)
            ).length,
            currentActiveOrder
          };
        })
      };
    },

    async getDaySummary(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      const orders = await repo.listShiftOrders(input.shiftId);
      const errors = await repo.listShiftErrors(input.shiftId);
      const activeOrderIds = new Set(orders.map((order) => order.id));
      const activeErrors = errors.filter((error) => activeOrderIds.has(error.orderId));
      const lineSummaries = await buildShiftLines(input.shiftId);
      const pickerNames = Array.from(
        new Set(orders.map((order) => order.pickerName).filter((name): name is string => Boolean(name)))
      );
      const byPicker = pickerNames.map((pickerName) => ({
        pickerName,
        totalOrders: orders.filter((order) => order.pickerName === pickerName).length,
        queuedOrders: orders.filter((order) => order.pickerName === pickerName && order.status === 'queued').length,
        pickingOrders: orders.filter((order) => order.pickerName === pickerName && order.status === 'picking').length,
        waitingCheckOrders: orders.filter((order) => order.pickerName === pickerName && order.status === 'waiting_check').length,
        returnedOrders: orders.filter((order) => order.pickerName === pickerName && order.status === 'returned').length,
        doneOrders: orders.filter((order) => order.pickerName === pickerName && order.status === 'done').length,
        errorCount: activeErrors.filter((error) =>
          orders.some((order) => order.id === error.orderId && order.pickerName === pickerName)
        ).length
      }));

      const errorCountByType = new Map<ManualShiftOrderError['type'], number>();
      for (const error of activeErrors) {
        errorCountByType.set(error.type, (errorCountByType.get(error.type) ?? 0) + 1);
      }

      return {
        shiftId: shift.id,
        totalOrders: orders.length,
        queuedOrders: orders.filter((order) => order.status === 'queued').length,
        pickingOrders: orders.filter((order) => order.status === 'picking').length,
        waitingCheckOrders: orders.filter((order) => order.status === 'waiting_check').length,
        returnedOrders: orders.filter((order) => order.status === 'returned').length,
        doneOrders: orders.filter((order) => order.status === 'done').length,
        errorsCount: activeErrors.length,
        byErrorType: Array.from(errorCountByType.entries()).map(([type, count]) => ({
          type,
          count
        })),
        byLine: lineSummaries,
        byPicker
      };
    },

    async getShiftWorkHierarchy(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      return repo.listShiftWorkHierarchy(input.shiftId);
    },

    async getBucketProductRollup(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      const products = await repo.listBucketProductRollup({
        shiftId: input.shiftId,
        lineId: input.lineId,
        bucketName: input.bucketName,
        distributionArea: input.distributionArea,
        sourceZone: input.sourceZone,
        workBucketName: input.workBucketName,
        sourceLineName: input.sourceLineName
      });

      return {
        shiftId: input.shiftId,
        lineId: input.lineId,
        bucketName: input.bucketName,
        distributionArea: input.distributionArea ?? null,
        sourceZone: input.sourceZone ?? null,
        workBucketName: input.workBucketName ?? null,
        sourceLineName: input.sourceLineName ?? null,
        products
      };
    },

    async getProductControl(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      const demandRows = await repo.listProductControlDemand(input.shiftId);
      if (demandRows.length === 0) {
        return {
          shiftId: input.shiftId,
          generatedAt: new Date().toISOString(),
          rows: [],
          totals: { totalSkus: 0, shortageSkus: 0, coveredByBondedSkus: 0, partialBondedSkus: 0, unresolvedSkus: 0, dataIssueSkus: 0 }
        };
      }

      const planningDate = shift.date;
      const warehouseStockService = options?.warehouseStockService;
      let warehouseSnapshotInfo: {
        id: string;
        planningDate: string;
        importedAt: string;
        fileName: string | null;
        sourceRowCount: number;
        uniqueSkuCount: number;
      } | null = null;
      const warnings: string[] = [];

      // ── Warehouse stock snapshot ────────────────────────────────────
      let warehouseStockBySku: Map<string, { sku: string; availableQty: number }> | null = null;
      let useWarehouseSnapshot = false;

      if (warehouseStockService) {
        const snapshot = await warehouseStockService.getLatestCompletedSnapshot(input.tenantId, planningDate);
        if (snapshot) {
          useWarehouseSnapshot = true;
          warehouseSnapshotInfo = {
            id: snapshot.id,
            planningDate: snapshot.planningDate,
            importedAt: snapshot.importedAt,
            fileName: snapshot.fileName,
            sourceRowCount: snapshot.sourceRowCount,
            uniqueSkuCount: snapshot.uniqueSkuCount
          };
          warehouseStockBySku = new Map(
            snapshot.rows
              .filter((row) => row.sku)
              .map((row) => [row.sku, { sku: row.sku, availableQty: row.availableQty }])
          );
        } else if (warehouseStockService) {
          warnings.push('no_warehouse_stock_snapshot_for_planning_date');
        }
      }

      // ── Bonded snapshot ────────────────────────────────────────────
      let bondedBySku = new Map<string, SkuBondedAggregate>();
      let bondedSnapshotInfo: {
        id: string;
        planningDate: string;
        importedAt: string;
        fileName: string | null;
        rowCount: number;
      } | null = null;

      if (bondedService) {
        const snapshot = await bondedService.getLatestCompletedSnapshot(input.tenantId, planningDate);
        if (snapshot) {
          bondedBySku = aggregateBondedAvailabilityBySku(snapshot.rows);
          bondedSnapshotInfo = {
            id: snapshot.id,
            planningDate: snapshot.planningDate,
            importedAt: snapshot.importedAt,
            fileName: snapshot.fileName,
            rowCount: snapshot.rowCount
          };
        } else {
          warnings.push('no_bonded_snapshot_for_planning_date');
        }
      }

      // ── Build rows ─────────────────────────────────────────────────
      let rows: ProductControlResponse['rows'];

      if (useWarehouseSnapshot) {
        rows = demandRows.map((demand) => {
          const snapshotRow = warehouseStockBySku!.get(demand.sku);
          const dataIssues: Array<'missing_warehouse_stock_snapshot_sku'> = [];

          if (!snapshotRow) {
            dataIssues.push('missing_warehouse_stock_snapshot_sku');
          }

          const bondedAgg = bondedBySku.get(demand.sku);
          const bondedAvailableQty = bondedAgg?.bondedAvailableQty ?? 0;
          const bondedCandidates = bondedAgg?.candidates ?? [];

          return buildProductControlRow({
            sku: demand.sku,
            description: demand.description ?? '',
            category: demand.category ?? '',
            demandQty: demand.demandQty,
            warehouseQty: snapshotRow?.availableQty ?? 0,
            bondedAvailableQty,
            status: dataIssues.length > 0 ? 'data_issue' : undefined,
            affectedOrdersCount: demand.orderCount,
            affectedLinesCount: demand.lineCount,
            dataIssues: dataIssues.length > 0 ? dataIssues : undefined,
            bondedCandidates
          });
        });
      } else {
        const skus = demandRows.map((r) => r.sku);
        const stockBySku = await repo.listWarehouseStockBySku(skus, input.tenantId);

        rows = demandRows.map((demand) => {
          const stock = stockBySku.get(demand.sku);
          const dataIssues: Array<'unknown_sku' | 'duplicate_canonical_sku'> = [];

          if (!stock) {
            dataIssues.push('unknown_sku');
          } else if (stock.canonicalProductIds.length > 1) {
            dataIssues.push('duplicate_canonical_sku');
          }

          const bondedAgg = bondedBySku.get(demand.sku);
          const bondedAvailableQty = bondedAgg?.bondedAvailableQty ?? 0;
          const bondedCandidates = bondedAgg?.candidates ?? [];

          return buildProductControlRow({
            sku: demand.sku,
            description: demand.description ?? '',
            category: demand.category ?? '',
            demandQty: demand.demandQty,
            warehouseQty: stock?.warehouseQty ?? 0,
            bondedAvailableQty,
            status: dataIssues.length > 0 ? 'data_issue' : undefined,
            affectedOrdersCount: demand.orderCount,
            affectedLinesCount: demand.lineCount,
            dataIssues: dataIssues.length > 0 ? dataIssues : undefined,
            bondedCandidates
          });
        });
      }

      const totals = computeProductControlTotals(rows);

      return {
        shiftId: input.shiftId,
        generatedAt: new Date().toISOString(),
        rows,
        totals,
        bondedSnapshot: bondedSnapshotInfo,
        warehouseStockSnapshot: warehouseSnapshotInfo,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    },

    async getPickerSheetWorkGroup(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      const lineRow = await repo.findLineByShiftAndName(input.shiftId, input.planningLineName);
      if (!lineRow) {
        throw manualShiftLineNotFoundByName(input.planningLineName);
      }

      const line = mapManualShiftLineRowToDomain(lineRow, 'open');

      if (line.distributionArea !== input.distributionArea) {
        throw manualShiftLineAreaMismatch(input.planningLineName, input.distributionArea);
      }

      const items = await repo.listPickerSheetItems(line.id, input.workGroupName);
      const aggregated = aggregatePickerItems(items);

      const data: PickerSheetPrintData = {
        shift: shift.name,
        scope: 'workGroup',
        shiftDate: shift.date,
        distributionArea: input.distributionArea,
        generatedAt: new Date().toISOString(),
        totals: {
          lines: 1,
          workGroups: 1,
          items: aggregated.length,
        },
        planningLines: [
          {
            name: line.name,
            workGroups: [
              {
                name: input.workGroupName,
                items: aggregated,
              },
            ],
          },
        ],
      };

      return processCollisions(data);
    },

    async getPickerSheetLine(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      const lineRow = await repo.findLineByShiftAndName(input.shiftId, input.planningLineName);
      if (!lineRow) {
        throw manualShiftLineNotFoundByName(input.planningLineName);
      }

      const line = mapManualShiftLineRowToDomain(lineRow, 'open');

      if (line.distributionArea !== input.distributionArea) {
        throw manualShiftLineAreaMismatch(input.planningLineName, input.distributionArea);
      }

      const { orders, items } = await repo.listPickerSheetLineItems(line.id);

      const itemsByOrderId = new Map<string, typeof items>();
      for (const item of items) {
        const list = itemsByOrderId.get(item.orderId) ?? [];
        list.push(item);
        itemsByOrderId.set(item.orderId, list);
      }

      const groups = new Map<string, string[]>();

      function normalizeOptionalString(value: string | null | undefined): string | null {
        if (value === null || value === undefined) return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      }

      for (const order of orders) {
        const bucketName = normalizeOptionalString(order.workBucketName);
        const groupName = (bucketName === null || bucketName === 'כללי') ? 'כללי' : bucketName;
        const ids = groups.get(groupName) ?? [];
        ids.push(order.id);
        groups.set(groupName, ids);
      }

      const workGroups: PickerSheetWorkGroup[] = [];

      for (const [name, orderIds] of groups) {
        const groupItems: ManualShiftOrderItem[] = [];
        for (const oid of orderIds) {
          const orderItems = itemsByOrderId.get(oid);
          if (orderItems) {
            for (const oi of orderItems) {
              groupItems.push(oi);
            }
          }
        }

        const aggregated = aggregatePickerItems(groupItems);
        if (aggregated.length === 0) continue;

        workGroups.push({ name, items: aggregated });
      }

      const totalItems = workGroups.reduce((s, wg) => s + wg.items.length, 0);

      const data: PickerSheetPrintData = {
        shift: shift.name,
        scope: 'line',
        shiftDate: shift.date,
        distributionArea: input.distributionArea,
        generatedAt: new Date().toISOString(),
        totals: {
          lines: 1,
          workGroups: workGroups.length,
          items: totalItems,
        },
        planningLines: [
          {
            name: line.name,
            workGroups,
          },
        ],
      };

      return processCollisions(data);
    },

    // --- Demand Planning Draft methods ---

    async createDemandPlanningDraft(input) {
      const [batch, rows] = await Promise.all([
        repo.getDemandImportBatch({
          tenantId: input.tenantId,
          batchId: input.batchId
        }),
        listScopedRawDemandRows({
          tenantId: input.tenantId,
          batchId: input.batchId,
          scope: input.sourceScope
        })
      ]);

      const preview = buildRawDemandPlanningPreview({ batch, rows });

      const draft = await repo.createDemandPlanningDraft({
        tenantId: input.tenantId,
        batchId: input.batchId,
        createdBy: input.createdBy,
        sourceScope: input.sourceScope
      });

      // Create initial bucket per area (one default "unassigned" bucket per area)
      const initialBuckets = preview.distributionAreas.map((area, i) => ({
        distributionArea: area.distributionArea,
        planningLineName: 'default',
        bucketName: 'unassigned',
        sortOrder: i
      }));

      const buckets = await repo.insertDemandPlanningBuckets({
        tenantId: input.tenantId,
        draftId: draft.id,
        batchId: input.batchId,
        buckets: initialBuckets
      });

      // Build bucket key map: bucketKey = `${distributionArea}|${planningLineName}|${bucketName}`
      const bucketByKey = new Map<string, typeof buckets[0]>();
      for (const bucket of buckets) {
        const key = [bucket.distributionArea ?? '', bucket.planningLineName, bucket.bucketName].join('|');
        bucketByKey.set(key, bucket);
      }

      return {
        draft,
        buckets,
        allocations: []
      };
    },

    async createRollingDemandPlanningDraft(input) {
      const rollingDemand = await this.getRollingAvailableDemand({ tenantId: input.tenantId });

      const availableRows = rollingDemand.rows.filter(r => r.status === 'available');

      if (availableRows.length === 0) {
        throw demandPlanningNoRollingAvailableDemand();
      }

      for (const row of availableRows) {
        if (!row.latestRawDemandRowId) {
          throw demandPlanningRollingAvailableDemandInvariantViolation(
            `Row with fallbackKey ${row.fallbackKeyFingerprint} has null latestRawDemandRowId`
          );
        }
        if (!row.latestBatchId) {
          throw demandPlanningRollingAvailableDemandInvariantViolation(
            `Row with fallbackKey ${row.fallbackKeyFingerprint} has null latestBatchId`
          );
        }
        if (row.availableQuantity <= 0) {
          throw demandPlanningRollingAvailableDemandInvariantViolation(
            `Row with fallbackKey ${row.fallbackKeyFingerprint} has non-positive availableQuantity ${row.availableQuantity}`
          );
        }
      }

      const draft = await repo.createRollingDemandPlanningDraft({
        tenantId: input.tenantId,
        createdBy: input.createdBy
      });

      // Group by distributionArea, using sentinel for null
      const areaGroups = new Map<string, typeof availableRows>();
      for (const row of availableRows) {
        const key = row.distributionArea ?? '__NULL_DISTRIBUTION_AREA__';
        const group = areaGroups.get(key) ?? [];
        group.push(row);
        areaGroups.set(key, group);
      }

      const bucketInputs = [...areaGroups.entries()].map(([areaKey, groupRows], i) => ({
        distributionArea: groupRows[0].distributionArea,
        planningLineName: 'default' as const,
        bucketName: 'unassigned' as const,
        sortOrder: i
      }));

      const buckets = await repo.insertDemandPlanningBuckets({
        tenantId: input.tenantId,
        draftId: draft.id,
        batchId: null,
        buckets: bucketInputs
      });

      // Build bucket key map using sentinel
      const bucketByKey = new Map<string, typeof buckets[0]>();
      for (const bucket of buckets) {
        const key = [bucket.distributionArea ?? '__NULL_DISTRIBUTION_AREA__', bucket.planningLineName, bucket.bucketName].join('|');
        bucketByKey.set(key, bucket);
      }

      const allocationInputs = availableRows.map(row => {
        const areaKey = row.distributionArea ?? '__NULL_DISTRIBUTION_AREA__';
        const bucketKey = [areaKey, 'default', 'unassigned'].join('|');
        const bucket = bucketByKey.get(bucketKey);
        if (!bucket) {
          throw new Error(`Bucket not found for distribution area ${row.distributionArea}`);
        }
        return {
          rawDemandRowId: row.latestRawDemandRowId!,
          bucketId: bucket.id,
          allocatedQuantity: row.availableQuantity,
          batchId: row.latestBatchId
        };
      });

      const allocations = await repo.insertDemandPlanningAllocations({
        tenantId: input.tenantId,
        draftId: draft.id,
        batchId: availableRows[0].latestBatchId,
        allocations: allocationInputs
      });

      return { draft, buckets, allocations };
    },

    async getDemandPlanningDraft(input) {
      const draft = await repo.getDemandPlanningDraft({
        tenantId: input.tenantId,
        draftId: input.draftId
      });

      if (!draft) {
        throw demandPlanningDraftNotFound(input.draftId);
      }

      const [buckets, allocations] = await Promise.all([
        repo.listDemandPlanningBuckets({
          tenantId: input.tenantId,
          draftId: input.draftId
        }),
        repo.listDemandPlanningAllocations({
          tenantId: input.tenantId,
          draftId: input.draftId
        })
      ]);

      const result: DemandPlanningDraftWithAssignments = { draft, buckets, allocations };

      // Attach publication info for applied drafts
      if (draft.status === 'applied') {
        const publication = await repo.getDemandPlanningDraftPublication({
          tenantId: input.tenantId,
          draftId: input.draftId
        });

        if (publication) {
          result.publication = publication;
          result.canRevert = true;
          result.revertBlockedReason = null;
        } else {
          // Old publication without lineage data
          result.publication = null;
          result.canRevert = false;
          result.revertBlockedReason = 'old_no_lineage';
        }
      }

      return result;
    },

    async putDemandPlanningPlan(input) {
      const draft = await repo.getDemandPlanningDraft({
        tenantId: input.tenantId,
        draftId: input.draftId
      });

      if (!draft) {
        throw demandPlanningDraftNotFound(input.draftId);
      }

      if (draft.status === 'applied' || draft.status === 'cancelled') {
        throw demandPlanningDraftNotMutable(input.draftId, draft.status);
      }

      if (draft.sourceKind === 'rolling') {
        throw demandPlanningRollingDraftNotSupported(input.draftId);
      }

      // Validate rawDemandRowIds belong to this tenant/batch
      const rowIds = [...new Set(input.allocations.map((a) => a.rawDemandRowId))];
      const rows = rowIds.length > 0
        ? await repo.listRawDemandRowsByIds({
            tenantId: input.tenantId,
            rowIds
          })
        : [];

      const rowsById = new Map(rows.map((r) => [r.id, r]));

      for (const alloc of input.allocations) {
        const row = rowsById.get(alloc.rawDemandRowId);
        if (!row || row.batchId !== draft.batchId) {
          throw demandPlanningRawDemandRowNotFound(alloc.rawDemandRowId);
        }
      }

      // Validate bucket keys are unique and well-formed
      const bucketKeySet = new Set(input.buckets.map((b) =>
        [b.distributionArea ?? '', b.planningLineName, b.bucketName].join('|')
      ));
      if (bucketKeySet.size !== input.buckets.length) {
        throw new ApiError(422, 'DEMAND_PLANNING_DUPLICATE_BUCKET', 'Duplicate bucket keys in plan.');
      }

      // Execute in transaction: delete old, insert new
      await repo.deleteDemandPlanningAllocationsByDraft({
        tenantId: input.tenantId,
        draftId: input.draftId
      });

      await repo.deleteDemandPlanningBucketsByDraft({
        tenantId: input.tenantId,
        draftId: input.draftId
      });

      const buckets = await repo.insertDemandPlanningBuckets({
        tenantId: input.tenantId,
        draftId: input.draftId,
        batchId: draft.batchId!,
        buckets: input.buckets.map((b, i) => ({
          distributionArea: b.distributionArea,
          planningLineName: b.planningLineName,
          bucketName: b.bucketName,
          sortOrder: i
        }))
      });

      // Build bucket key to ID map
      const bucketByKey = new Map<string, string>();
      for (const bucket of buckets) {
        const key = [bucket.distributionArea ?? '', bucket.planningLineName, bucket.bucketName].join('|');
        bucketByKey.set(key, bucket.id);
      }

      // Build allocations with validated quantities
      const allocationInputs: Array<{
        rawDemandRowId: string;
        bucketId: string;
        allocatedQuantity: number;
      }> = [];

      const perRowAllocated = new Map<string, number>();

      for (const alloc of input.allocations) {
        const bucketId = bucketByKey.get(alloc.bucketKey);
        if (!bucketId) {
          throw demandPlanningBucketNotFound(alloc.bucketKey);
        }

        if (alloc.allocatedQuantity <= 0) {
          throw new ApiError(422, 'DEMAND_PLANNING_INVALID_QUANTITY',
            `Allocated quantity must be positive.`);
        }

        const row = rowsById.get(alloc.rawDemandRowId)!;
        const rowQty = row.quantity ?? 0;
        const currentAllocated = perRowAllocated.get(alloc.rawDemandRowId) ?? 0;
        const newTotal = currentAllocated + alloc.allocatedQuantity;

        if (newTotal > rowQty) {
          throw demandPlanningAllocationOverflow(
            alloc.rawDemandRowId,
            newTotal,
            rowQty - currentAllocated
          );
        }

        perRowAllocated.set(alloc.rawDemandRowId, newTotal);
        allocationInputs.push({
          rawDemandRowId: alloc.rawDemandRowId,
          bucketId,
          allocatedQuantity: alloc.allocatedQuantity
        });
      }

      const allocations = await repo.insertDemandPlanningAllocations({
        tenantId: input.tenantId,
        draftId: input.draftId,
        batchId: draft.batchId!,
        allocations: allocationInputs
      });

      return { draft, buckets, allocations };
    },

    async publishDemandPlanningDraftToShift(input) {
      const [draft, shift] = await Promise.all([
        repo.getDemandPlanningDraft({
          tenantId: input.tenantId,
          draftId: input.draftId
        }),
        repo.findShiftById(input.targetShiftId)
      ]);

      if (!draft) {
        throw demandPlanningDraftNotFound(input.draftId);
      }

      if (draft.sourceKind === 'rolling') {
        throw demandPlanningRollingPublishNotSupported(input.draftId);
      }

      if (draft.status === 'applied') {
        throw demandPlanningDraftAlreadyApplied(input.draftId);
      }

      if (draft.status === 'cancelled') {
        throw demandPlanningDraftNotMutable(input.draftId, draft.status);
      }

      if (!shift || shift.tenantId !== input.tenantId) {
        throw manualShiftImportShiftNotFound(input.targetShiftId);
      }

      if (shift.status !== 'active') {
        throw manualShiftImportShiftNotActive(input.targetShiftId);
      }

      try {
        return await repo.publishDemandPlanningDraftToShift({
          tenantId: input.tenantId,
          draftId: input.draftId,
          targetShiftId: input.targetShiftId
        });
      } catch (error) {
        const pgError = error as { code?: string; message?: string; detail?: string } | null;
        if (pgError?.code === 'P0001') {
          switch (pgError.message) {
            case 'DEMAND_PLANNING_DRAFT_NOT_FOUND':
              throw demandPlanningDraftNotFound(input.draftId);
            case 'DEMAND_PLANNING_DRAFT_NOT_MUTABLE':
              throw demandPlanningDraftAlreadyApplied(input.draftId);
            case 'SHIFT_NOT_FOUND':
              throw manualShiftImportShiftNotFound(input.targetShiftId);
            case 'SHIFT_NOT_ACTIVE':
              throw manualShiftImportShiftNotActive(input.targetShiftId);
            case 'DATE_MISMATCH':
              throw manualShiftImportShiftDateMismatch(input.targetShiftId, shift.date, 'unknown');
            case 'DATE_AMBIGUOUS':
              throw demandPlanningTargetDateAmbiguous(input.draftId, []);
            case 'NO_PUBLISHABLE_ROWS':
              throw demandPlanningNoPublishableRows(input.draftId);
            case 'DEMAND_PLANNING_DEMAND_ALREADY_CONSUMED':
              throw new ApiError(409, 'DEMAND_PLANNING_DEMAND_ALREADY_CONSUMED', 'Raw demand quantity was already published by another draft.');
            case 'DEMAND_PLANNING_DRAFT_SOURCE_MISMATCH':
              throw new ApiError(422, 'DEMAND_PLANNING_DRAFT_SOURCE_MISMATCH', 'Draft allocations must belong to the draft source batch.');
            case 'FORBIDDEN':
              throw new ApiError(403, 'FORBIDDEN', 'You are not authorized to perform this action.');
            default:
              throw new ApiError(500, 'INTERNAL_PUBLISH_ERROR', 'An unexpected error occurred during publish.');
          }
        }
        throw new ApiError(500, 'INTERNAL_PUBLISH_ERROR', 'An unexpected error occurred during publish.');
      }
    },

    async revertDemandPlanningPublication(input) {
      const publication = await repo.getDemandPlanningPublication({
        tenantId: input.tenantId,
        publicationId: input.publicationId
      });

      if (!publication) {
        throw demandPlanningPublicationNotFound(input.publicationId);
      }

      if (publication.status === 'reverted') {
        throw demandPlanningPublicationAlreadyReverted(input.publicationId);
      }

      if (publication.tenantId !== input.tenantId) {
        throw demandPlanningPublicationNotFound(input.publicationId);
      }

      try {
        return await repo.revertDemandPlanningPublication({
          tenantId: input.tenantId,
          publicationId: input.publicationId
        });
      } catch (error) {
        const pgError = error as { code?: string; message?: string; detail?: string } | null;
        if (pgError?.code === 'P0001') {
          switch (pgError.message) {
            case 'DEMAND_PLANNING_PUBLICATION_NOT_FOUND':
              throw demandPlanningPublicationNotFound(input.publicationId);
            case 'DEMAND_PLANNING_PUBLICATION_ALREADY_REVERTED':
              throw demandPlanningPublicationAlreadyReverted(input.publicationId);
            case 'DEMAND_PLANNING_DRAFT_NOT_FOUND':
              throw demandPlanningDraftNotFound(publication.draftId);
            case 'DEMAND_PLANNING_DRAFT_NOT_APPLIED':
              throw demandPlanningDraftNotApplied(publication.draftId);
            case 'DEMAND_PLANNING_PUBLISHED_SHIFT_HAS_ACTIVITY': {
              let reasons: string[] = [];
              try {
                reasons = JSON.parse(pgError.detail ?? '[]');
              } catch { /* ignore parse error */ }
              throw demandPlanningPublishedShiftHasActivity(publication.targetShiftId, reasons);
            }
            case 'DEMAND_PLANNING_PUBLICATION_OLD_NO_LINEAGE':
              throw demandPlanningPublicationOldNoLineage(publication.draftId);
            case 'FORBIDDEN':
              throw new ApiError(403, 'FORBIDDEN', 'You are not authorized to perform this action.');
            default:
              throw new ApiError(500, 'INTERNAL_REVERT_ERROR', 'An unexpected error occurred during revert.');
          }
        }
        throw new ApiError(500, 'INTERNAL_REVERT_ERROR', 'An unexpected error occurred during revert.');
      }
    },

    // --- Demand Backlog implementations ---

    async mergeRowsIntoBacklog(input: {
      tenantId: string;
      batchId: string;
      rows: RawDemandRow[];
    }): Promise<void> {
      for (const row of input.rows) {
        if (row.planningStatus === 'error') continue;

        const identityKey = await computeDemandBacklogIdentityKey(
          row.orderNumber, row.customerName, row.sku, row.distributionArea
        );

        const existingItem = await repo.findBacklogItemByIdentityKey({
          tenantId: input.tenantId,
          identityKey
        });

        const existingSourceLink = await repo.findBacklogSourceLinkByRawRowId({
          tenantId: input.tenantId,
          rawDemandRowId: row.id
        });

        // Idempotent: skip if this raw row is already linked
        if (existingSourceLink) continue;

        const mergeInput: BacklogMergeRowInput = {
          id: row.id,
          tenantId: input.tenantId,
          batchId: input.batchId,
          orderNumber: row.orderNumber,
          customerName: row.customerName,
          sku: row.sku,
          description: row.description,
          category: row.category,
          quantity: row.quantity,
          distributionArea: row.distributionArea,
          planningStatus: row.planningStatus,
          routeFlow: row.routeFlow,
          productHandlingFlow: row.productHandlingFlow
        };

        const result = await computeBacklogMergeAction(mergeInput, existingItem, 0);

        if (result.isNew) {
          const newItem = await repo.createBacklogItem({
            tenantId: input.tenantId,
            identityKey,
            status: row.planningStatus === 'special_flow' ? 'special_flow' : 'open',
            totalQuantity: row.quantity ?? 0,
            orderNumber: row.orderNumber,
            customerName: row.customerName,
            sku: row.sku,
            description: row.description,
            category: row.category,
            distributionArea: row.distributionArea,
            productHandlingFlow: row.productHandlingFlow,
            routeFlow: row.routeFlow
          });

          await repo.createBacklogSourceLink({
            tenantId: input.tenantId,
            backlogItemId: newItem.id,
            rawDemandRowId: row.id,
            batchId: input.batchId,
            mergeAction: result.mergeAction,
            previousQuantity: result.previousQuantity,
            newQuantity: result.newQuantity,
            quantityDelta: result.newQuantity !== null && result.previousQuantity !== null
              ? result.newQuantity - result.previousQuantity
              : null
          });
        } else {
          // Update existing backlog item
          const now = new Date().toISOString();
          const patch: {
            totalQuantity?: number;
            status?: DemandBacklogItemStatus;
            description?: string | null;
            category?: string | null;
            lastSeenAt?: string;
            lastQuantityChangedAt?: string | null;
          } = {
            lastSeenAt: now
          };

          if (result.mergeAction === 'quantity_changed' && result.newQuantity !== null) {
            patch.totalQuantity = result.newQuantity;
            patch.lastQuantityChangedAt = now;

            const allocs = await repo.listBacklogItemAllocationsSum({
              tenantId: input.tenantId,
              backlogItemIds: [existingItem!.id]
            });
            const allocatedQty = allocs.length > 0 ? allocs[0].allocatedQuantity : 0;
            patch.status = computeBacklogItemStatus(result.newQuantity, allocatedQty);
          }

          if (row.description !== null) patch.description = row.description;
          if (row.category !== null) patch.category = row.category;

          await repo.updateBacklogItem({
            tenantId: input.tenantId,
            backlogItemId: existingItem!.id,
            patch
          });

          await repo.createBacklogSourceLink({
            tenantId: input.tenantId,
            backlogItemId: existingItem!.id,
            rawDemandRowId: row.id,
            batchId: input.batchId,
            mergeAction: result.mergeAction,
            previousQuantity: result.previousQuantity,
            newQuantity: result.newQuantity,
            quantityDelta: result.newQuantity !== null && result.previousQuantity !== null
              ? result.newQuantity - result.previousQuantity
              : null
          });
        }
      }
    },

    async getDemandBacklog(input) {
      const { items: backlogItems, total } = await repo.listBacklogItems({
        tenantId: input.tenantId,
        status: input.status,
        distributionArea: input.distributionArea,
        search: input.search,
        sourceBatchId: input.sourceBatchId,
        page: input.page,
        limit: input.limit
      });

      if (backlogItems.length === 0) {
        return { items: [], pagination: { page: input.page, limit: input.limit, total: 0 } };
      }

      const backlogItemIds = backlogItems.map(i => i.id);

      const [allocSums, sourceBatchesData] = await Promise.all([
        repo.listBacklogItemAllocationsSum({
          tenantId: input.tenantId,
          backlogItemIds
        }),
        repo.listBacklogSourceBatches({
          tenantId: input.tenantId,
          backlogItemIds
        })
      ]);

      const allocByItemId = new Map(allocSums.map(a => [a.backlogItemId, a.allocatedQuantity]));

      // Group source batches by backlog item id
      const sourceBatchesByItemId = new Map<string, typeof sourceBatchesData>();
      for (const sb of sourceBatchesData) {
        const list = sourceBatchesByItemId.get(sb.backlogItemId) ?? [];
        list.push(sb);
        sourceBatchesByItemId.set(sb.backlogItemId, list);
      }

      const items: DemandBacklogItemResponse[] = backlogItems.map(item => {
        const allocatedQuantity = allocByItemId.get(item.id) ?? 0;
        const openQuantity = computeOpenQuantity(item.totalQuantity, allocatedQuantity);
        const sourceBatches = (sourceBatchesByItemId.get(item.id) ?? []).map(sb => ({
          batchId: sb.batchId,
          sourceFile: sb.sourceFile,
          uploadedAt: sb.uploadedAt,
          mergeAction: sb.mergeAction as DemandBacklogMergeAction,
          quantityAtImport: sb.quantityAtImport,
          previousQuantity: sb.previousQuantity,
          newQuantity: sb.newQuantity,
          quantityDelta: sb.quantityDelta
        }));

        return {
          ...item,
          allocatedQuantity,
          openQuantity,
          sourceBatches
        };
      });

      return { items, pagination: { page: input.page, limit: input.limit, total } };
    },

    async getDemandBacklogSummary(input) {
      const summaryData = await repo.getBacklogSummary({
        tenantId: input.tenantId,
        status: input.status,
        distributionArea: input.distributionArea,
        search: input.search,
        sourceBatchId: input.sourceBatchId
      });

      const totalSourceBatches = await repo.countBacklogDistinctBatches({
        tenantId: input.tenantId
      });

      return {
        ...summaryData,
        totalSourceBatches
      };
    },

    async getAvailableDemand(input) {
      const getAvailableDemandSnapshot = repo.getAvailableDemandSnapshot;
      if (!getAvailableDemandSnapshot) {
        throw new Error('Available demand snapshot is not implemented by this repository.');
      }

      const snapshot = await getAvailableDemandSnapshot({
        tenantId: input.tenantId
      });

      return buildAvailableDemandResponse(snapshot);
    },

    async getRollingAvailableDemand(input) {
      const batches = await repo.listReadyBatches({
        tenantId: input.tenantId
      });

      if (batches.length === 0) {
        return {
          summary: {
            totalRows: 0,
            totalAvailableQuantity: 0,
            byStatus: {
              available: 0,
              fullyConsumed: 0,
              duplicateConflict: 0,
              overPublished: 0,
              requiresReview: 0,
              excludedNonSo: 0
            }
          },
          rows: [],
          warnings: [],
          diagnostics: {
            totalBatches: 0,
            totalRawRows: 0,
            totalFallbackKeys: 0,
            batchesAnalyzed: []
          }
        };
      }

      const batchIds = batches.map(b => b.id);

      const [rows, allocations] = await Promise.all([
        repo.listRawDemandRowsForBatches({
          tenantId: input.tenantId,
          batchIds
        }),
        repo.listPublishedAllocationsForRolling({
          tenantId: input.tenantId
        })
      ]);

      return resolveRollingAvailableDemandV1(batches, rows, allocations);
    },
  };
}

export function createManualShiftsService(
  supabase: SupabaseClient,
  bondedService?: BondedService,
  warehouseStockService?: WarehouseStockService,
  deliveryPointAliasMatchingService?: DeliveryPointAliasMatchingService
) {
  return createManualShiftsServiceFromRepo(
    createManualShiftsRepo(supabase),
    { warehouseStockService, deliveryPointAliasMatchingService },
    bondedService
  );
}
