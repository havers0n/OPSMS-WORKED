import type {
  ManualShiftBulkAddInputRow,
  ManualShiftBulkAddResult,
  ManualShiftDaySummary,
  ManualShiftLine,
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderError,
  ManualShiftOrderEvent,
  ManualShiftOrderStatus,
  ManualShiftOrderSize,
  ManualShiftPeopleSummary,
  ManualShiftSession,
  ManualShiftTodayResponse
} from '@wos/domain';
import {
  calculateSizeFromLineCount,
  canTransitionManualShiftOrderStatus,
  deriveManualShiftLineStatus,
  manualShiftBulkAddInputRowSchema
} from '@wos/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  invalidManualShiftOrderCreateStatus,
  invalidManualShiftOrderTransition,
  manualShiftAlreadyActive,
  manualShiftClosed,
  manualShiftLineNotFound,
  manualShiftNotFound,
  manualShiftOrderNotFound
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
  getTodayShift(tenantId: string): Promise<ManualShiftTodayResponse>;
  createShift(input: { tenantId: string; date?: string; name: string; actor: ActorContext }): Promise<ManualShiftSession>;
  closeShift(input: { tenantId: string; shiftId: string }): Promise<ManualShiftSession>;
  listShiftLines(input: { tenantId: string; shiftId: string }): Promise<ManualShiftLineSummary[]>;
  createLine(input: { tenantId: string; shiftId: string; name: string; sortOrder: number }): Promise<ManualShiftLine>;
  patchLine(input: { tenantId: string; lineId: string; name?: string; sortOrder?: number }): Promise<ManualShiftLine>;
  listShiftOrders(input: { tenantId: string; shiftId: string }): Promise<ManualShiftOrder[]>;
  listLineOrders(input: { tenantId: string; lineId: string }): Promise<ManualShiftOrder[]>;
  createOrder(input: {
    tenantId: string;
    lineId: string;
    orderNumber?: string | null;
    customerName?: string | null;
    pickerName?: string | null;
    checkerName?: string | null;
    lineCount?: number | null;
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
      orderNumber: string;
      pickerName: string | null;
      lineCount: number | null;
      size?: ManualShiftOrderSize;
    }>;
    actor: ActorContext;
  }): Promise<ManualShiftBulkAddResult>;
  patchOrder(input: {
    tenantId: string;
    orderId: string;
    orderNumber?: string | null;
    customerName?: string | null;
    pickerName?: string | null;
    checkerName?: string | null;
    lineCount?: number | null;
    size?: ManualShiftOrderSize;
    comment?: string | null;
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
  return lines.map<ManualShiftLineSummary>((line) => {
    const lineOrders = orders.filter((order) => order.lineId === line.id);
    const lineErrors = errors.filter((error) => error.lineId === line.id);

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
    const orderNumber = parts[0] ?? '';
    const pickerName = parts[1] ? parts[1] : null;
    const maybeLineCount = parts[2] ? Number(parts[2]) : null;

    if (!orderNumber) {
      skippedRows.push(raw);
      continue;
    }

    const lineCount =
      maybeLineCount !== null && Number.isInteger(maybeLineCount) && maybeLineCount > 0
        ? maybeLineCount
        : null;

    rows.push(
      manualShiftBulkAddInputRowSchema.parse({
        raw,
        orderNumber,
        pickerName,
        lineCount,
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

  async function buildShiftLines(shiftId: string) {
    const lineRows = await repo.listShiftLines(shiftId);
    const orders = await repo.listShiftOrders(shiftId);
    const errors = await repo.listShiftErrors(shiftId);
    const lines = lineRows.map((lineRow) =>
      mapManualShiftLineRowToDomain(lineRow, deriveManualShiftLineStatus(orders.filter((order) => order.lineId === lineRow.id)))
    );

    return buildLineSummaries(lines, orders, errors);
  }

  return {
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
        lines: await buildShiftLines(shift.id)
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

      return buildShiftLines(input.shiftId);
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
      if (line.tenant_id !== input.tenantId) {
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

    async listShiftOrders(input) {
      const shift = await requireShift(input.shiftId);
      if (shift.tenantId !== input.tenantId) {
        throw manualShiftNotFound(input.shiftId);
      }

      return repo.listShiftOrders(input.shiftId);
    },

    async listLineOrders(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId) {
        throw manualShiftLineNotFound(input.lineId);
      }

      return repo.listLineOrders(input.lineId);
    },

    async createOrder(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId) {
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
        orderNumber: input.orderNumber ?? null,
        customerName: input.customerName ?? null,
        pickerName: input.pickerName ?? null,
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
          orderNumber: order.orderNumber,
          lineCount: order.lineCount,
          size: order.size
        }
      });

      return order;
    },

    async bulkCreateOrders(input) {
      const line = await requireLine(input.lineId);
      if (line.tenant_id !== input.tenantId) {
        throw manualShiftLineNotFound(input.lineId);
      }

      await requireActiveShift(line.shift_id);

      const parsed = input.rows
        ? {
            createdCount: 0,
            rows: input.rows.map((row) =>
              manualShiftBulkAddInputRowSchema.parse({
                raw: row.raw,
                orderNumber: row.orderNumber,
                pickerName: row.pickerName,
                lineCount: row.lineCount,
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
          orderNumber: row.orderNumber,
          customerName: null,
          pickerName: row.pickerName,
          checkerName: null,
          lineCount: row.lineCount,
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
      if (order.tenantId !== input.tenantId) {
        throw manualShiftOrderNotFound(input.orderId);
      }

      await requireActiveShift(order.shiftId);

      const updated = await repo.updateOrder(input.orderId, {
        orderNumber: input.orderNumber,
        customerName: input.customerName,
        pickerName: input.pickerName,
        checkerName: input.checkerName,
        lineCount: input.lineCount,
        size: deriveOrderSize(input.lineCount, input.size, order.size),
        comment: input.comment
      });

      if (!updated) {
        throw manualShiftOrderNotFound(input.orderId);
      }

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
          orderNumber: updated.orderNumber,
          pickerName: updated.pickerName,
          checkerName: updated.checkerName,
          lineCount: updated.lineCount,
          size: updated.size,
          comment: updated.comment
        }
      });

      return updated;
    },

    async transitionOrderStatus(input) {
      const order = await requireOrder(input.orderId);
      if (order.tenantId !== input.tenantId) {
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
        patch.checkedAt = nowIso;
        patch.finishedAt = nowIso;
      }

      if (order.status === 'waiting_check' && input.status === 'returned') {
        patch.checkedAt = nowIso;
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
      if (order.tenantId !== input.tenantId) {
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
        checkedAt: getNowIso()
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
            errorCount: errors.filter((error) => pickerOrderIds.has(error.orderId)).length,
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
        errorCount: errors.filter((error) =>
          orders.some((order) => order.id === error.orderId && order.pickerName === pickerName)
        ).length
      }));

      const errorCountByType = new Map<ManualShiftOrderError['type'], number>();
      for (const error of errors) {
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
        errorsCount: errors.length,
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
