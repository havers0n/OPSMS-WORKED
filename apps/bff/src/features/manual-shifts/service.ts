import type {
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
  ManualShiftOrderStatus,
  ManualShiftOrderSize,
  ManualShiftPeopleSummary,
  ManualShiftSession,
  ManualShiftTodayResponse,
  ManualShiftWorker,
  ManualShiftWorkerRole
} from '@wos/domain';
import {
  calculateSizeFromLineCount,
  canTransitionManualShiftOrderToDoneWithCheckUnits,
  canTransitionManualShiftOrderStatus,
  deriveManualShiftLineStatus,
  manualShiftBulkAddInputRowSchema
} from '@wos/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  invalidManualShiftOrderCreateStatus,
  invalidManualShiftOrderCheckUnitTransition,
  invalidManualShiftOrderTransition,
  manualShiftAlreadyActive,
  manualShiftClosed,
  manualShiftLineDeleteBlocked,
  manualShiftLineNotFound,
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
  manualShiftWorkerNotFound
} from './errors.js';
import type { ManualShiftsRepo } from './repo.js';
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
  }): Promise<ManualShiftWorker>;
  patchWorker(input: {
    tenantId: string;
    workerId: string;
    name?: string;
    role?: ManualShiftWorkerRole;
    active?: boolean;
    sortOrder?: number;
  }): Promise<ManualShiftWorker>;
  deactivateWorker(input: { tenantId: string; workerId: string }): Promise<ManualShiftWorker>;
  getTodayShift(tenantId: string): Promise<ManualShiftTodayResponse>;
  getShiftByDate(tenantId: string, date: string): Promise<ManualShiftTodayResponse>;
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
    waitingCheckAt?: string | null;
    finishedAt?: string | null;
    checkedAt?: string | null;
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
  }
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

  return {
    async listShiftWorkers(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) throw manualShiftNotFound(input.shiftId);
      return repo.listShiftWorkers(input.shiftId);
    },

    async createWorker(input) {
      const shift = await requireActiveShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) throw manualShiftNotFound(input.shiftId);
      return repo.createWorker(input);
    },

    async patchWorker(input) {
      const worker = await requireWorker(input.workerId);
      if (worker.tenantId !== input.tenantId) throw manualShiftWorkerNotFound(input.workerId);
      const updated = await repo.updateWorker(input.workerId, {
        name: input.name,
        role: input.role,
        active: input.active,
        sortOrder: input.sortOrder
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

      return repo.listShiftOrders(input.shiftId);
    },

    async listLineOrders(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId || line.deleted_at) {
        throw manualShiftLineNotFound(input.lineId);
      }

      return repo.listLineOrders(input.lineId);
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

      return repo.createOrderAshlama({
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
    },

    async patchOrderAshlamaStatus(input) {
      const ashlama = await repo.findOrderAshlamaById(input.ashlamaId);
      if (!ashlama || ashlama.tenantId !== input.tenantId) {
        throw manualShiftOrderNotFound(input.ashlamaId);
      }
      await requireActiveShift(ashlama.shiftId);
      const updated = await repo.updateOrderAshlama(input.ashlamaId, {
        status: input.status,
        updatedByProfileId: input.actor.actorProfileId,
        updatedByName: input.actor.actorName
      });
      if (!updated) {
        throw manualShiftOrderNotFound(input.ashlamaId);
      }
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

    async patchOrder(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId || order.deletedAt) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await requireActiveShift(order.shiftId);

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
        waitingCheckAt: input.waitingCheckAt,
        finishedAt: input.finishedAt,
        checkedAt: input.checkedAt
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
        input.waitingCheckAt !== undefined ||
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
        if (!canTransitionManualShiftOrderToDoneWithCheckUnits(checkUnits, order.palletCount)) {
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
    }
  };
}

export function createManualShiftsService(supabase: SupabaseClient) {
  return createManualShiftsServiceFromRepo(createManualShiftsRepo(supabase));
}
