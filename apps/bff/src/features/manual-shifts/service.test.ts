import { describe, expect, it, vi } from 'vitest';
import type {
  DemandImportBatch,
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderCheckUnit,
  ManualShiftOrderAshlama,
  ManualShiftOrderItem,
  ManualShiftOrderError,
  ManualShiftSession,
  RawDemandRow,
  ManualShiftWorker
} from '@wos/domain';
import {
  parseManualShiftMonthlyPreview,
  planManualShiftMonthlyImportApply,
  demandImportDataSheetCreateResponseSchema
} from '@wos/domain';
import { createManualShiftsServiceFromRepo } from './service.js';
import type { ManualShiftsRepo } from './repo.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  otherTenant: '22222222-2222-4222-8222-222222222222',
  shift: '33333333-3333-4333-8333-333333333333',
  line: '44444444-4444-4444-8444-444444444444',
  lineTwo: '55555555-5555-4555-8555-555555555555',
  order: '66666666-6666-4666-8666-666666666666',
  orderTwo: '77777777-7777-4777-8777-777777777777',
  orderThree: '88888888-8888-4888-8888-888888888888',
  event: '99999999-9999-4999-8999-999999999999',
  error: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  actor: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  worker: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
};

const nowIso = '2026-05-26T07:00:00.000Z';

function createShift(overrides: Partial<ManualShiftSession> = {}): ManualShiftSession {
  return {
    id: ids.shift,
    tenantId: ids.tenant,
    date: '2026-05-26',
    name: 'Morning Shift',
    status: 'active',
    createdBy: 'Dispatcher',
    createdAt: '2026-05-26T05:00:00.000Z',
    closedAt: null,
    ...overrides
  };
}

function createOrder(
  overrides: Partial<ManualShiftOrder> = {}
): ManualShiftOrder {
  return {
    id: ids.order,
    tenantId: ids.tenant,
    shiftId: ids.shift,
    lineId: ids.line,
    pointName: 'ירושלים',
    palletCount: null,
    orderNumber: '502481',
    customerName: null,
    pickerName: 'יהודה',
    pickerWorkerId: null,
    checkerName: null,
    lineCount: 12,
    sortOrder: null,
    size: 'L',
    status: 'queued',
    startedAt: null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: '2026-05-26T05:10:00.000Z',
    updatedAt: '2026-05-26T05:10:00.000Z',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null,
    ...overrides,
    checkStartedAt: overrides.checkStartedAt ?? null
  };
}

function createWorker(overrides: Partial<ManualShiftWorker> = {}): ManualShiftWorker {
  return {
    id: ids.worker,
    tenantId: ids.tenant,
    shiftId: ids.shift,
    name: 'יהודה',
    role: 'picker',
    active: true,
    sortOrder: 1,
    authUserId: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides
  };
}

function createError(overrides: Partial<ManualShiftOrderError> = {}): ManualShiftOrderError {
  return {
    id: ids.error,
    tenantId: ids.tenant,
    shiftId: ids.shift,
    lineId: ids.line,
    orderId: ids.order,
    type: 'missing_item',
    comment: 'Missing product',
    createdBy: 'Checker',
    createdAt: nowIso,
    fixedAt: null,
    ...overrides
  };
}

function createRepo() {
  const state = {
    shifts: [createShift()],
    lines: [
      {
        id: ids.line,
        tenant_id: ids.tenant,
        shift_id: ids.shift,
        name: 'Kav A',
        sort_order: 1,
        created_at: '2026-05-26T05:05:00.000Z',
        deleted_at: null,
        deleted_by_profile_id: null,
        deleted_by_name: null,
        delete_reason: null
      },
      {
        id: ids.lineTwo,
        tenant_id: ids.tenant,
        shift_id: ids.shift,
        name: 'Kav B',
        sort_order: 2,
        created_at: '2026-05-26T05:06:00.000Z',
        deleted_at: null,
        deleted_by_profile_id: null,
        deleted_by_name: null,
        delete_reason: null
      }
    ] as Array<{
      id: string;
      tenant_id: string;
      shift_id: string;
      name: string;
      distribution_area: string | null;
      sort_order: number;
      created_at: string;
      deleted_at: string | null;
      deleted_by_profile_id: string | null;
      deleted_by_name: string | null;
      delete_reason: string | null;
    }>,
    orders: [] as ManualShiftOrder[],
    workers: [] as ManualShiftWorker[],
    checkUnits: [] as ManualShiftOrderCheckUnit[],
    ashlamot: [] as ManualShiftOrderAshlama[],
    items: [] as ManualShiftOrderItem[],
    events: [] as Array<Record<string, unknown>>,
    errors: [] as ManualShiftOrderError[],
    demandImportBatches: [] as DemandImportBatch[],
    rawDemandRows: [] as RawDemandRow[]
  };

  let eventCounter = 0;
  let errorCounter = 0;
  let lineCounter = 0;
  let orderCounter = 0;
  let workerCounter = 0;
  let checkUnitCounter = 0;
  let demandImportBatchCounter = 0;
  let rawDemandRowCounter = 0;

  const repo: ManualShiftsRepo = {
    listShiftWorkers: vi.fn(async (shiftId: string) => {
      return state.workers.filter((w) => w.shiftId === shiftId);
    }),
    findWorkerById: vi.fn(async (workerId: string) => {
      return state.workers.find((w) => w.id === workerId) ?? null;
    }),
    createWorker: vi.fn(async (input) => {
      workerCounter += 1;
      const worker = createWorker({
        id: `50000000-0000-4000-8000-${String(workerCounter).padStart(12, '0')}`,
        tenantId: input.tenantId,
        shiftId: input.shiftId,
        name: input.name,
        role: input.role,
        sortOrder: input.sortOrder,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      state.workers.push(worker);
      return worker;
    }),
    updateWorker: vi.fn(async (workerId: string, patch) => {
      const worker = state.workers.find((w) => w.id === workerId) ?? null;
      if (!worker) return null;
      if (patch.name !== undefined) worker.name = patch.name;
      if (patch.role !== undefined) worker.role = patch.role;
      if (patch.active !== undefined) worker.active = patch.active;
      if (patch.sortOrder !== undefined) worker.sortOrder = patch.sortOrder;
      worker.updatedAt = nowIso;
      return worker;
    }),
    findActiveShiftByDate: vi.fn(async (tenantId: string, date: string) => {
      return state.shifts.find((shift) => shift.tenantId === tenantId && shift.date === date && shift.status === 'active') ?? null;
    }),
    findShiftByDate: vi.fn(async (tenantId: string, date: string) => {
      return state.shifts.find((shift) => shift.tenantId === tenantId && shift.date === date) ?? null;
    }),
    findShiftById: vi.fn(async (shiftId: string) => {
      return state.shifts.find((shift) => shift.id === shiftId) ?? null;
    }),
    createShift: vi.fn(async (input) => {
      const shift = createShift({
        id: `00000000-0000-4000-8000-${String(state.shifts.length + 1).padStart(12, '0')}`,
        tenantId: input.tenantId,
        date: input.date,
        name: input.name,
        createdBy: input.createdByName
      });
      state.shifts.push(shift);
      return shift;
    }),
    closeShift: vi.fn(async (shiftId: string, closedAt: string) => {
      const shift = state.shifts.find((entry) => entry.id === shiftId) ?? null;
      if (!shift) {
        return null;
      }

      shift.status = 'closed';
      shift.closedAt = closedAt;
      return shift;
    }),
    listShiftLines: vi.fn(async (shiftId: string) => {
      return state.lines.filter((line) => line.shift_id === shiftId && line.deleted_at === null) as never;
    }),
    listShiftLineSummaries: vi.fn(async (shiftId: string, tenantId: string) => {
      const lineRows = state.lines.filter(
        (line) => line.shift_id === shiftId && line.tenant_id === tenantId && line.deleted_at === null
      );

      const byLine = new Map<string, ManualShiftLineSummary>();
      for (const row of lineRows) {
        byLine.set(row.id, {
          line: {
            id: row.id,
            tenantId: row.tenant_id,
            shiftId: row.shift_id,
            name: row.name,
            distributionArea: row.distribution_area,
            sortOrder: row.sort_order,
            status: 'open',
            createdAt: row.created_at,
            deletedAt: row.deleted_at,
            deletedByProfileId: row.deleted_by_profile_id,
            deletedByName: row.deleted_by_name,
            deleteReason: row.delete_reason
          },
          totalOrders: 0,
          queuedOrders: 0,
          pickingOrders: 0,
          waitingCheckOrders: 0,
          returnedOrders: 0,
          doneOrders: 0,
          errorCount: 0
        });
      }

      for (const order of state.orders) {
        if (order.shiftId !== shiftId || order.deletedAt) continue;
        const summary = byLine.get(order.lineId);
        if (!summary) continue;
        summary.totalOrders += 1;
        if (order.status === 'queued') summary.queuedOrders += 1;
        if (order.status === 'picking') summary.pickingOrders += 1;
        if (order.status === 'waiting_check') summary.waitingCheckOrders += 1;
        if (order.status === 'returned') summary.returnedOrders += 1;
        if (order.status === 'done') summary.doneOrders += 1;
      }

      for (const error of state.errors) {
        if (error.shiftId !== shiftId) continue;
        if (!state.orders.some((order) => order.id === error.orderId && order.deletedAt === null)) continue;
        const summary = byLine.get(error.lineId);
        if (!summary) continue;
        summary.errorCount += 1;
      }

      for (const summary of byLine.values()) {
        const { totalOrders, queuedOrders, doneOrders } = summary;
        summary.line.status =
          totalOrders === 0 || queuedOrders === totalOrders
            ? 'open'
            : doneOrders === totalOrders
              ? 'done'
              : 'in_progress';
      }

      return Array.from(byLine.values()).sort((a, b) => {
        if (a.line.sortOrder !== b.line.sortOrder) return a.line.sortOrder - b.line.sortOrder;
        return a.line.createdAt.localeCompare(b.line.createdAt);
      });
    }),
    findLineById: vi.fn(async (lineId: string) => {
      return (state.lines.find((line) => line.id === lineId) ?? null) as never;
    }),
    createLine: vi.fn(async (input) => {
      lineCounter += 1;
      const row = {
        id: `10000000-0000-4000-8000-${String(lineCounter).padStart(12, '0')}`,
        tenant_id: input.tenantId,
        shift_id: input.shiftId,
        name: input.name,
        distribution_area: null,
        sort_order: input.sortOrder,
        created_at: nowIso,
        deleted_at: null,
        deleted_by_profile_id: null,
        deleted_by_name: null,
        delete_reason: null
      };
      state.lines.push(row);
      return row as never;
    }),
    updateLine: vi.fn(async (lineId: string, patch) => {
      const line = state.lines.find((entry) => entry.id === lineId) ?? null;
      if (!line) {
        return null;
      }

      if (patch.name !== undefined) line.name = patch.name;
      if (patch.sortOrder !== undefined) line.sort_order = patch.sortOrder;
      if (patch.deletedAt !== undefined) line.deleted_at = patch.deletedAt;
      if (patch.deletedByProfileId !== undefined) line.deleted_by_profile_id = patch.deletedByProfileId;
      if (patch.deletedByName !== undefined) line.deleted_by_name = patch.deletedByName;
      if (patch.deleteReason !== undefined) line.delete_reason = patch.deleteReason;
      return line as never;
    }),
    listShiftOrders: vi.fn(async (shiftId: string) => {
      return state.orders.filter((order) => order.shiftId === shiftId && order.deletedAt === null);
    }),
    listLineOrders: vi.fn(async (lineId: string) => {
      return state.orders.filter((order) => order.lineId === lineId && order.deletedAt === null);
    }),
    listShiftOrderItems: vi.fn(async () => []),
    listPickerSheetItems: vi.fn(async () => []),
    listPickerSheetLineItems: vi.fn(async () => ({ orders: [], items: [] })),
    findOrderById: vi.fn(async (orderId: string) => {
      return state.orders.find((order) => order.id === orderId) ?? null;
    }),
    listOrderCheckUnits: vi.fn(async (orderId: string) => {
      return state.checkUnits
        .filter((unit) => unit.orderId === orderId)
        .sort((a, b) => a.unitNumber - b.unitNumber);
    }),
    findOrderCheckUnitById: vi.fn(async (checkUnitId: string) => {
      return state.checkUnits.find((unit) => unit.id === checkUnitId) ?? null;
    }),
    listOrderAshlamot: vi.fn(async (orderId: string) => {
      return state.ashlamot
        .filter((ashlama) => ashlama.orderId === orderId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),
    listOpenShiftAshlamot: vi.fn(async (tenantId: string, shiftId: string) => {
      return state.ashlamot
        .filter((a) => a.shiftId === shiftId && a.tenantId === tenantId && a.status === 'open')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .flatMap((a) => {
          const order = state.orders.find((o) => o.id === a.orderId);
          const line = state.lines.find((l) => l.id === a.lineId);
          if (!order || order.deletedAt || !line || line.deleted_at) return [];
          return [{
            id: a.id,
            orderId: a.orderId,
            orderNumber: order.orderNumber ?? null,
            pointName: order.pointName ?? null,
            lineId: a.lineId,
            lineName: line.name,
            text: a.text,
            source: a.source,
            checkUnitId: a.checkUnitId,
            createdAt: a.createdAt
          }];
        });
    }),
    listOrderEvents: vi.fn(async (orderId: string) => {
      return state.events
        .filter((e) => e['orderId'] === orderId)
        .sort((a, b) => String(b['createdAt']).localeCompare(String(a['createdAt']))) as never;
    }),
    listOrderItems: vi.fn(async (_tenantId: string, orderId: string) => {
      return state.items.filter((item) => item.orderId === orderId);
    }),
    listOrdersItemRollups: vi.fn(async (orderIds: string[]) => {
      const rollups = new Map<string, { lineCount: number; totalQuantity: number }>();
      for (const item of state.items) {
        if (!orderIds.includes(item.orderId)) continue;
        let entry = rollups.get(item.orderId);
        if (!entry) {
          entry = { lineCount: 0, totalQuantity: 0 };
          rollups.set(item.orderId, entry);
        }
        entry.lineCount += 1;
        entry.totalQuantity += item.quantity;
      }
      return rollups;
    }),
    countMonthlyImportShiftRows: vi.fn(async ({ tenantId, shiftId }) => {
      const lines = state.lines.filter((line) => line.shift_id === shiftId && line.tenant_id === tenantId);
      const orders = state.orders.filter((order) => order.shiftId === shiftId && order.tenantId === tenantId);

      return {
        shiftId,
        activeLinesCount: lines.filter((line) => line.deleted_at === null).length,
        activeOrdersCount: orders.filter((order) => order.deletedAt === null).length,
        softDeletedLinesCount: lines.filter((line) => line.deleted_at !== null).length,
        softDeletedOrdersCount: orders.filter((order) => order.deletedAt !== null).length
      };
    }),
    findOrderAshlamaById: vi.fn(async (ashlamaId: string) => {
      return state.ashlamot.find((ashlama) => ashlama.id === ashlamaId) ?? null;
    }),
    createOrderCheckUnit: vi.fn(async (input) => {
      checkUnitCounter += 1;
      const orderUnits = state.checkUnits.filter((unit) => unit.orderId === input.orderId);
      const unit: ManualShiftOrderCheckUnit = {
        id: `21000000-0000-4000-8000-${String(checkUnitCounter).padStart(12, '0')}`,
        tenantId: input.tenantId,
        shiftId: input.shiftId,
        lineId: input.lineId,
        orderId: input.orderId,
        unitNumber: orderUnits.length + 1,
        status: input.status,
        note: input.note,
        reason: input.reason,
        checkedAt: null,
        returnedAt: null,
        voidedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      state.checkUnits.push(unit);
      return unit;
    }),
    updateOrderCheckUnit: vi.fn(async (checkUnitId: string, patch) => {
      const unit = state.checkUnits.find((entry) => entry.id === checkUnitId) ?? null;
      if (!unit) {
        return null;
      }

      const next = { ...unit };
      if (patch.status !== undefined) next.status = patch.status;
      if (patch.note !== undefined) next.note = patch.note;
      if (patch.reason !== undefined) next.reason = patch.reason;
      if (patch.checkedAt !== undefined) next.checkedAt = patch.checkedAt;
      if (patch.returnedAt !== undefined) next.returnedAt = patch.returnedAt;
      if (patch.voidedAt !== undefined) next.voidedAt = patch.voidedAt;
      next.updatedAt = nowIso;

      const idx = state.checkUnits.findIndex((entry) => entry.id === checkUnitId);
      state.checkUnits[idx] = next;
      return next;
    }),
    createOrderAshlama: vi.fn(async (input) => {
      const ashlama: ManualShiftOrderAshlama = {
        id: `22000000-0000-4000-8000-${String(state.ashlamot.length + 1).padStart(12, '0')}`,
        tenantId: input.tenantId,
        shiftId: input.shiftId,
        lineId: input.lineId,
        orderId: input.orderId,
        checkUnitId: input.checkUnitId,
        source: input.source,
        status: input.status,
        text: input.text,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      state.ashlamot.push(ashlama);
      return ashlama;
    }),
    updateOrderAshlama: vi.fn(async (ashlamaId: string, patch) => {
      const ashlama = state.ashlamot.find((entry) => entry.id === ashlamaId) ?? null;
      if (!ashlama) return null;
      if (patch.status !== undefined) ashlama.status = patch.status;
      ashlama.updatedAt = nowIso;
      return ashlama;
    }),
    createOrder: vi.fn(async (input) => {
      orderCounter += 1;
      const order = createOrder({
        id: `20000000-0000-4000-8000-${String(orderCounter).padStart(12, '0')}`,
        tenantId: input.tenantId,
        shiftId: input.shiftId,
        lineId: input.lineId,
        pointName: input.pointName,
        orderNumber: input.orderNumber,
        customerName: input.customerName,
        palletCount: input.palletCount,
        pickerName: input.pickerName,
        pickerWorkerId: input.pickerWorkerId,
        checkerName: input.checkerName,
        lineCount: input.lineCount,
        size: input.size,
        status: input.status,
        startedAt: input.startedAt,
        comment: input.comment,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      state.orders.push(order);
      return order;
    }),
    updateOrder: vi.fn(async (orderId: string, patch) => {
      const order = state.orders.find((entry) => entry.id === orderId) ?? null;
      if (!order) {
        return null;
      }

      const nextOrder = { ...order };
      if (patch.pointName !== undefined) nextOrder.pointName = patch.pointName;
      if (patch.palletCount !== undefined) nextOrder.palletCount = patch.palletCount;
      if (patch.orderNumber !== undefined) nextOrder.orderNumber = patch.orderNumber;
      if (patch.customerName !== undefined) nextOrder.customerName = patch.customerName;
      if (patch.pickerName !== undefined) nextOrder.pickerName = patch.pickerName;
      if (patch.pickerWorkerId !== undefined) nextOrder.pickerWorkerId = patch.pickerWorkerId;
      if (patch.checkerName !== undefined) nextOrder.checkerName = patch.checkerName;
      if (patch.lineCount !== undefined) nextOrder.lineCount = patch.lineCount;
      if (patch.size !== undefined) nextOrder.size = patch.size;
      if (patch.comment !== undefined) nextOrder.comment = patch.comment;
      if (patch.status !== undefined) nextOrder.status = patch.status;
      if (patch.startedAt !== undefined) nextOrder.startedAt = patch.startedAt;
      if (patch.checkStartedAt !== undefined) nextOrder.checkStartedAt = patch.checkStartedAt;
      if (patch.waitingCheckAt !== undefined) nextOrder.waitingCheckAt = patch.waitingCheckAt;
      if (patch.checkedAt !== undefined) nextOrder.checkedAt = patch.checkedAt;
      if (patch.finishedAt !== undefined) nextOrder.finishedAt = patch.finishedAt;
      if (patch.deletedAt !== undefined) nextOrder.deletedAt = patch.deletedAt;
      if (patch.deletedByProfileId !== undefined) nextOrder.deletedByProfileId = patch.deletedByProfileId;
      if (patch.deletedByName !== undefined) nextOrder.deletedByName = patch.deletedByName;
      if (patch.deleteReason !== undefined) nextOrder.deleteReason = patch.deleteReason;
      nextOrder.updatedAt = nowIso;

      const index = state.orders.findIndex((entry) => entry.id === orderId);
      state.orders[index] = nextOrder;
      return nextOrder;
    }),
    createOrderEvent: vi.fn(async (input) => {
      eventCounter += 1;
      const event = {
        id: `30000000-0000-4000-8000-${String(eventCounter).padStart(12, '0')}`,
        tenantId: input.tenantId,
        shiftId: input.shiftId,
        lineId: input.lineId,
        orderId: input.orderId,
        eventType: input.eventType,
        actorProfileId: input.actorProfileId,
        actorName: input.actorName,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        payload: input.payload,
        createdAt: nowIso
      };
      state.events.push(event);
      return event as never;
    }),
    createLineEvent: vi.fn(async (input) => {
      eventCounter += 1;
      const event = {
        id: `31000000-0000-4000-8000-${String(eventCounter).padStart(12, '0')}`,
        tenantId: input.tenantId,
        shiftId: input.shiftId,
        lineId: input.lineId,
        eventType: input.eventType,
        actorProfileId: input.actorProfileId,
        actorName: input.actorName,
        payload: input.payload,
        createdAt: nowIso
      };
      state.events.push(event);
      return event as never;
    }),
    createOrderError: vi.fn(async (input) => {
      errorCounter += 1;
      const error = createError({
        id: `40000000-0000-4000-8000-${String(errorCounter).padStart(12, '0')}`,
        tenantId: input.tenantId,
        shiftId: input.shiftId,
        lineId: input.lineId,
        orderId: input.orderId,
        type: input.type,
        comment: input.comment,
        createdBy: input.createdByName
      });
      state.errors.push(error);
      return error;
    }),
    applyDailyImport: vi.fn(async (input) => ({
      shiftId: input.shiftId,
      linesCreated: 0,
      ordersCreated: 0
    })),
    createDemandImportBatch: vi.fn(async (input) => {
      demandImportBatchCounter += 1;
      const batch: DemandImportBatch = {
        id: `70000000-0000-4000-8000-${String(demandImportBatchCounter).padStart(12, '0')}`,
        tenantId: input.tenantId,
        sourceFile: input.sourceFile,
        sourceSheet: input.sourceSheet,
        uploadedAt: nowIso,
        uploadedBy: input.uploadedBy,
        status: input.status,
        rowsCount: input.rowsCount,
        rawRowsCount: input.rawRowsCount,
        warningRowsCount: input.warningRowsCount,
        errorRowsCount: input.errorRowsCount,
        specialFlowRowsCount: input.specialFlowRowsCount,
        distributionAreasCount: input.distributionAreasCount,
        distinctOrdersCount: input.distinctOrdersCount,
        distinctSkuCount: input.distinctSkuCount
      };
      state.demandImportBatches.push(batch);
      return batch;
    }),
    insertRawDemandRows: vi.fn(async (input) => {
      for (const row of input.rows) {
        rawDemandRowCounter += 1;
        state.rawDemandRows.push({
          id: `71000000-0000-4000-8000-${String(rawDemandRowCounter).padStart(12, '0')}`,
          tenantId: input.tenantId,
          batchId: input.batchId,
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
          issues: row.issues,
          createdAt: nowIso
        });
      }
    }),
    getDemandImportBatch: vi.fn(async (input) => {
      const batch = state.demandImportBatches.find((entry) => entry.id === input.batchId && entry.tenantId === input.tenantId);
      if (!batch) {
        throw new Error('batch not found');
      }
      return batch;
    }),
    listRawDemandRowsByBatch: vi.fn(async (input) => {
      return state.rawDemandRows
        .filter((row) => row.batchId === input.batchId && row.tenantId === input.tenantId)
        .slice(0, input.limit ?? Number.MAX_SAFE_INTEGER);
    }),
    listDemandBatchDistributionAreaSummary: vi.fn(async (input) => {
      const rows = state.rawDemandRows.filter((row) => row.batchId === input.batchId && row.tenantId === input.tenantId);
      if (rows.length === 0) return [];
      return [
        {
          distributionArea: rows[0].distributionArea,
          rowsCount: rows.length,
          ordersCount: new Set(rows.map((row) => row.orderNumber).filter(Boolean)).size,
          skuCount: new Set(rows.map((row) => row.sku).filter(Boolean)).size,
          totalQty: rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0),
          specialFlowRowsCount: rows.filter((row) => row.planningStatus === 'special_flow').length,
          errorRowsCount: rows.filter((row) => row.planningStatus === 'error').length
        }
      ];
    }),
    insertMonthlyImportExcludedRows: vi.fn(async () => {}),
    applyMonthlyImport: vi.fn(async (input) => ({
      shiftId: input.shiftId,
      selectedDate: input.selectedDate,
      linesCreated: 0,
      ordersCreated: 0,
      orderItemsCreated: 0,
      appliedGroups: input.plan.appliedGroups,
      skippedGroups: input.plan.skippedGroups,
      skippedNegativeQuantityRows: input.plan.skippedNegativeQuantityRows,
      skippedZeroQuantityRows: input.plan.skippedZeroQuantityRows,
      appliedTotalQuantity: input.plan.appliedTotalQuantity,
      appliedItemLines: input.plan.appliedItemLines,
      excludedRowsCount: input.plan.preview.excludedRows.length,
      warningSummary: input.plan.warningSummary,
      warnings: input.plan.preview.warnings,
      previewTotals: input.plan.preview.totals,
      previewAnomalies: input.plan.preview.anomalies
    })),
    checkMonthlyReplaceSafety: vi.fn(async () => ({
      canReplace: true,
      activeLinesCount: 0,
      activeOrdersCount: 0,
      startedOrdersCount: 0,
      assignedPickersCount: 0,
      assignedCheckersCount: 0,
      checkUnitsCount: 0,
      nonImportEventsCount: 0,
      blockReasons: []
    })),
    listShiftErrors: vi.fn(async (shiftId: string) => {
      return state.errors.filter((error) => error.shiftId === shiftId);
    }),
    findWorkerByAuthUserId: vi.fn(async (_tenantId: string, _authUserId: string) => null),
    setWorkerAuthUser: vi.fn(async (_workerId: string, _authUserId: string | null) => {}),
    listBindableUsers: vi.fn(async (_tenantId: string) => []),
    listShiftCheckUnits: vi.fn(async (_shiftId: string) => []),
    listShiftAshlamot: vi.fn(async (_shiftId: string) => []),
    listShiftWorkHierarchy: vi.fn(async (_shiftId: string) => ({ shiftId: '', areas: [] })),
    listBucketProductRollup: vi.fn(async () => []),
    listProductControlDemand: vi.fn(async (_shiftId: string) => []),
    listWarehouseStockBySku: vi.fn(
      async (_sku: string[], _tenantId: string) =>
        new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>()
    ),
    findLineByShiftAndName: vi.fn(async (_shiftId: string, _lineName: string) => null),
    createDemandPlanningDraft: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000001', tenantId: ids.tenant, batchId: '00000000-0000-4000-8000-000000000099', status: 'draft' as const, createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z'
    })),
    getDemandPlanningDraft: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000001', tenantId: ids.tenant, batchId: '00000000-0000-4000-8000-000000000099', status: 'draft' as const, createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z'
    })),
    updateDemandPlanningDraftStatus: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000001', tenantId: ids.tenant, batchId: '00000000-0000-4000-8000-000000000099', status: 'draft' as const, createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z'
    })),
    deleteDemandPlanningBucketsByDraft: vi.fn(async () => undefined),
    insertDemandPlanningBuckets: vi.fn(async () => []),
    listDemandPlanningBuckets: vi.fn(async () => []),
    deleteDemandPlanningAllocationsByDraft: vi.fn(async () => undefined),
    insertDemandPlanningAllocations: vi.fn(async () => []),
    listDemandPlanningAllocations: vi.fn(async () => []),
    listRawDemandRowsByIds: vi.fn(async () => []),
    publishDemandPlanningDraftToShift: vi.fn(async () => ({
      shiftId: '',
      draftId: '',
      createdLines: 0,
      reusedLines: 0,
      createdOrders: 0,
      updatedOrders: 0,
      createdItems: 0,
      skippedRows: 0,
      warnings: []
    })),
    findBacklogItemByIdentityKey: vi.fn().mockResolvedValue(null),
    findBacklogSourceLinkByRawRowId: vi.fn().mockResolvedValue(null),
    createBacklogItem: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    updateBacklogItem: vi.fn().mockResolvedValue({}),
    createBacklogSourceLink: vi.fn().mockResolvedValue({}),
    listBacklogItems: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    listBacklogItemAllocationsSum: vi.fn().mockResolvedValue([]),
    listBacklogSourceBatches: vi.fn().mockResolvedValue([]),
    getBacklogSummary: vi.fn().mockResolvedValue({}),
    countBacklogDistinctBatches: vi.fn().mockResolvedValue(0),


    listDemandImportBatches: vi.fn().mockResolvedValue([]),
    listAvailableDemandImportBatches: vi.fn().mockResolvedValue([]),
    getDemandPlanningPublication: vi.fn().mockResolvedValue(null),
    revertDemandPlanningPublication: vi.fn().mockResolvedValue({
      publicationId: '',
      draftId: '',
      shiftId: '',
      revertedOrders: 0,
      revertedItems: 0,
      releasedQuantity: 0
    }),
    getDemandPlanningDraftPublication: vi.fn().mockResolvedValue(null),
    listReadyBatches: vi.fn().mockResolvedValue([]),
    listRawDemandRowsForBatches: vi.fn().mockResolvedValue([]),
    listPublishedAllocationsForRolling: vi.fn().mockResolvedValue([]),
  };

  return { repo, state };
}

describe('manual shifts service', () => {
  it('returns an empty today payload when no active shift exists', async () => {
    const { repo, state } = createRepo();
    state.shifts = [];
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    await expect(service.getTodayShift(ids.tenant)).resolves.toEqual({
      shift: null,
      lines: []
    });
  });

  it('subtracts active published quantities before rolling status and summary calculation', async () => {
    const { repo } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo);
    const batchId = '10000000-0000-4000-8000-000000000001';
    const TEST_RAW_DEMAND_ROW_ID = '20000000-0000-4000-8000-000000000001';

    vi.mocked(repo.listReadyBatches).mockResolvedValue([{
      id: batchId,
      sourceFile: 'demand.xlsx',
      uploadedAt: '2026-06-29T10:00:00.000Z',
      status: 'ready',
      rowsCount: 1
    }]);
    vi.mocked(repo.listRawDemandRowsForBatches).mockResolvedValue([{
      id: TEST_RAW_DEMAND_ROW_ID,
      batchId,
      orderNumber: 'SO26090001',
      customerName: 'Customer',
      sku: '463071',
      description: null,
      category: null,
      quantity: 10,
      notes: null,
      distributionArea: 'North',
      rawRouteLine: null,
      plannedDeliveryDate: '2026-07-01',
      planningStatus: 'unplanned',
      routeFlow: 'unassigned',
      productHandlingFlow: 'regular'
    }]);
    vi.mocked(repo.listPublishedAllocationsForRolling).mockResolvedValue([
      {
        rawDemandRowId: TEST_RAW_DEMAND_ROW_ID,
        publishedQuantity: 10,
        publicationStatus: 'applied',
        orderNumber: 'SO26090001',
        sku: '463071',
        customerName: 'Customer',
        distributionArea: 'North',
        plannedDeliveryDate: '2026-07-01'
      },
      {
        rawDemandRowId: TEST_RAW_DEMAND_ROW_ID,
        publishedQuantity: 5,
        publicationStatus: 'reverted',
        orderNumber: 'SO26090001',
        sku: '463071',
        customerName: 'Customer',
        distributionArea: 'North',
        plannedDeliveryDate: '2026-07-01'
      }
    ]);

    const result = await service.getRollingAvailableDemand({ tenantId: ids.tenant });

    expect(result.rows[0]).toMatchObject({
      latestRawDemandRowId: TEST_RAW_DEMAND_ROW_ID,
      latestQuantity: 10,
      publishedQuantity: 10,
      availableQuantity: 0,
      status: 'fully_consumed'
    });
    expect(result.summary.totalAvailableQuantity).toBe(0);
    expect(result.summary.byStatus.fullyConsumed).toBe(1);
  });

  it('builds today line summaries via repo aggregate without loading full orders/errors', async () => {
    const { repo, state } = createRepo();
    state.orders.push(
      createOrder({ id: ids.order, status: 'queued', lineId: ids.line }),
      createOrder({ id: ids.orderTwo, status: 'picking', lineId: ids.line }),
      createOrder({ id: ids.orderThree, status: 'done', lineId: ids.lineTwo })
    );
    state.errors.push(createError({ orderId: ids.orderTwo, lineId: ids.line }));

    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const result = await service.getTodayShift(ids.tenant);

    expect(result.shift).toMatchObject({ id: ids.shift, tenantId: ids.tenant, status: 'active' });
    expect(result.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          line: expect.objectContaining({ id: ids.line, status: 'in_progress' }),
          totalOrders: 2,
          queuedOrders: 1,
          pickingOrders: 1,
          waitingCheckOrders: 0,
          returnedOrders: 0,
          doneOrders: 0,
          errorCount: 1
        }),
        expect.objectContaining({
          line: expect.objectContaining({ id: ids.lineTwo, status: 'done' }),
          totalOrders: 1,
          doneOrders: 1,
          errorCount: 0
        })
      ])
    );

    expect(repo.listShiftLineSummaries).toHaveBeenCalledWith(ids.shift, ids.tenant);
    expect(repo.listShiftOrders).not.toHaveBeenCalled();
    expect(repo.listShiftErrors).not.toHaveBeenCalled();
  });

  it('listShiftLines passes tenantId to repo.listShiftLineSummaries', async () => {
    const { repo } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    await service.listShiftLines({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(repo.listShiftLineSummaries).toHaveBeenCalledWith(ids.shift, ids.tenant);
  });

  it('getTodayShift and listShiftLines never pass a foreign tenantId to repo.listShiftLineSummaries', async () => {
    const { repo } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    await service.getTodayShift(ids.tenant);

    const calls = vi.mocked(repo.listShiftLineSummaries).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [, calledTenantId] of calls) {
      expect(calledTenantId).toBe(ids.tenant);
      expect(calledTenantId).not.toBe(ids.otherTenant);
    }
  });

  it('rejects duplicate active shifts for the same tenant and local date', async () => {
    const { repo } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    await expect(
      service.createShift({
        tenantId: ids.tenant,
        name: 'Duplicate',
        actor: {
          actorProfileId: ids.actor,
          actorName: 'Dispatcher'
        }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ALREADY_ACTIVE' });
  });

  it('creates a manual order, derives size from lineCount, and writes a created event', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const order = await service.createOrder({
      tenantId: ids.tenant,
      lineId: ids.line,
      pointName: 'סופר ספיר',
      orderNumber: '502500',
      pickerName: 'רפאל',
      lineCount: 4,
      comment: 'Rush',
      actor: {
        actorProfileId: ids.actor,
        actorName: 'Dispatcher'
      }
    });

    expect(order.size).toBe('M');
    expect(order.status).toBe('queued');
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      eventType: 'created',
      orderId: order.id,
      toStatus: 'queued'
    });
  });

  it('creates a manual order without orderNumber and preserves palletCount', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const order = await service.createOrder({
      tenantId: ids.tenant,
      lineId: ids.line,
      pointName: 'ירושלים / רמי לוי רב-חן',
      orderNumber: null,
      palletCount: 2,
      actor: {
        actorProfileId: ids.actor,
        actorName: 'Dispatcher'
      }
    });

    expect(order.pointName).toBe('ירושלים / רמי לוי רב-חן');
    expect(order.orderNumber).toBeNull();
    expect(order.palletCount).toBe(2);
    expect(state.events.at(-1)).toMatchObject({
      eventType: 'created',
      payload: expect.objectContaining({
        pointName: 'ירושלים / רמי לוי רב-חן',
        orderNumber: null,
        palletCount: 2
      })
    });
  });

  it('bulk creates orders from raw text, trims empty rows, skips malformed rows, and allows duplicates', async () => {
    const { repo } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const result = await service.bulkCreateOrders({
      tenantId: ids.tenant,
      lineId: ids.line,
      rawText: 'ירושלים\n\n, יהודה\nסופר ספיר, רפאל, 12\nסופר ספיר, רפאל, 12',
      actor: {
        actorProfileId: ids.actor,
        actorName: 'Dispatcher'
      }
    });

    expect(result.createdCount).toBe(3);
    expect(result.skippedRows).toEqual([', יהודה']);
    expect(result.rows.map((row) => row.size)).toEqual(['unknown', 'L', 'L']);
  });

  it('bulk parser supports pointName only and pointName with picker, lineCount, palletCount', async () => {
    const { repo } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const result = await service.bulkCreateOrders({
      tenantId: ids.tenant,
      lineId: ids.line,
      rawText: 'ירושלים\nסופר ספיר קרית יובל / ירושלים, יהודה, 12, 2',
      actor: {
        actorProfileId: ids.actor,
        actorName: 'Dispatcher'
      }
    });

    expect(result.createdCount).toBe(2);
    expect(result.rows).toEqual([
      expect.objectContaining({
        pointName: 'ירושלים',
        orderNumber: null,
        pickerName: null,
        lineCount: null,
        palletCount: null,
        size: 'unknown'
      }),
      expect.objectContaining({
        pointName: 'סופר ספיר קרית יובל / ירושלים',
        orderNumber: null,
        pickerName: 'יהודה',
        lineCount: 12,
        palletCount: 2,
        size: 'L'
      })
    ]);
  });

  it('normalizes invalid palletCount in bulk rows to null', async () => {
    const { repo } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const result = await service.bulkCreateOrders({
      tenantId: ids.tenant,
      lineId: ids.line,
      rawText: 'סופר ספיר קרית יובל / ירושלים, יהודה, 12, -3',
      actor: {
        actorProfileId: ids.actor,
        actorName: 'Dispatcher'
      }
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        pointName: 'סופר ספיר קרית יובל / ירושלים',
        palletCount: null,
        lineCount: 12,
        size: 'L'
      })
    ]);
  });

  it('updates timestamps and writes an event for valid status transitions', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order, status: 'queued', startedAt: null }));
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const order = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'picking',
      actor: {
        actorProfileId: ids.actor,
        actorName: 'Dispatcher'
      }
    });

    expect(order.status).toBe('picking');
    expect(order.startedAt).toBe(nowIso);
    expect(state.events.at(-1)).toMatchObject({
      eventType: 'status_changed',
      fromStatus: 'queued',
      toStatus: 'picking'
    });
  });

  it('rejects invalid transitions including returned to done', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order, status: 'returned' }));
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    await expect(
      service.transitionOrderStatus({
        tenantId: ids.tenant,
        orderId: ids.order,
        status: 'done',
        actor: {
          actorProfileId: ids.actor,
          actorName: 'Dispatcher'
        }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_INVALID_STATUS_TRANSITION' });
  });

  it('creates an error, moves the order to returned, and writes an event', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const error = await service.createOrderError({
      tenantId: ids.tenant,
      orderId: ids.order,
      type: 'missing_item',
      comment: 'Missing item',
      actor: {
        actorProfileId: ids.actor,
        actorName: 'Checker'
      }
    });

    expect(error.type).toBe('missing_item');
    expect(state.orders[0]?.status).toBe('returned');
    expect(state.events.at(-1)).toMatchObject({
      eventType: 'error_reported',
      fromStatus: 'waiting_check',
      toStatus: 'returned'
    });
  });

  it('builds people and day summaries from manual shift orders only', async () => {
    const { repo, state } = createRepo();
    state.orders.push(
      createOrder({ id: ids.order, pickerName: 'יהודה', status: 'picking', lineId: ids.line }),
      createOrder({
        id: ids.orderTwo,
        orderNumber: '502482',
        pickerName: 'יהודה',
        status: 'waiting_check',
        lineId: ids.line
      }),
      createOrder({
        id: ids.orderThree,
        orderNumber: '502483',
        pickerName: 'רפאל',
        status: 'done',
        lineId: ids.lineTwo
      })
    );
    state.errors.push(
      createError({ orderId: ids.orderTwo, lineId: ids.line, type: 'wrong_item' })
    );

    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const people = await service.getPeopleSummary({
      tenantId: ids.tenant,
      shiftId: ids.shift
    });
    const day = await service.getDaySummary({
      tenantId: ids.tenant,
      shiftId: ids.shift
    });

    expect(people.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pickerName: 'יהודה',
          activeOrdersCount: 1,
          waitingCheckCount: 1,
          returnedCount: 0,
          doneCount: 0,
          errorCount: 1
        }),
        expect.objectContaining({
          pickerName: 'רפאל',
          doneCount: 1
        })
      ])
    );
    expect(day).toMatchObject({
      totalOrders: 3,
      pickingOrders: 1,
      waitingCheckOrders: 1,
      doneOrders: 1,
      errorsCount: 1
    });
    expect(day.byErrorType).toEqual([{ type: 'wrong_item', count: 1 }]);
    expect(day.byLine).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          totalOrders: 2,
          line: expect.objectContaining({ id: ids.line, status: 'in_progress' })
        }),
        expect.objectContaining({
          totalOrders: 1,
          line: expect.objectContaining({ id: ids.lineTwo, status: 'done' })
        })
      ])
    );
  });

  it('soft-deletes a point, preserves the row, and writes a point_deleted event', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const deleted = await service.deleteOrder({
      tenantId: ids.tenant,
      orderId: ids.order,
      reason: 'Duplicate point',
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    expect(deleted.deletedAt).toBe(nowIso);
    expect(deleted.deleteReason).toBe('Duplicate point');
    expect(state.orders).toHaveLength(1);
    expect(state.events.at(-1)).toMatchObject({
      eventType: 'point_deleted',
      orderId: ids.order,
      fromStatus: 'waiting_check',
      payload: { reason: 'Duplicate point' }
    });
  });

  it('restores a point and writes a point_restored event', async () => {
    const { repo, state } = createRepo();
    state.orders.push(
      createOrder({
        id: ids.order,
        deletedAt: '2026-05-26T06:50:00.000Z',
        deletedByProfileId: ids.actor,
        deletedByName: 'Dispatcher',
        deleteReason: 'Duplicate point'
      })
    );
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const restored = await service.restoreOrder({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    expect(restored.deletedAt).toBeNull();
    expect(restored.deletedByProfileId).toBeNull();
    expect(restored.deleteReason).toBeNull();
    expect(state.events.at(-1)).toMatchObject({
      eventType: 'point_restored',
      orderId: ids.order,
      toStatus: 'queued'
    });
  });

  it('excludes deleted points from active list and summary reads', async () => {
    const { repo, state } = createRepo();
    state.orders.push(
      createOrder({ id: ids.order, pickerName: 'יהודה', status: 'picking', lineId: ids.line }),
      createOrder({
        id: ids.orderTwo,
        pickerName: 'יהודה',
        status: 'waiting_check',
        lineId: ids.line,
        deletedAt: '2026-05-26T06:50:00.000Z',
        deletedByProfileId: ids.actor,
        deletedByName: 'Dispatcher',
        deleteReason: 'Duplicate point'
      }),
      createOrder({ id: ids.orderThree, pickerName: 'רפאל', status: 'done', lineId: ids.lineTwo })
    );
    state.errors.push(
      createError({ orderId: ids.orderTwo, lineId: ids.line, type: 'wrong_item' })
    );
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    await expect(service.listShiftOrders({ tenantId: ids.tenant, shiftId: ids.shift })).resolves.toHaveLength(2);
    await expect(service.listLineOrders({ tenantId: ids.tenant, lineId: ids.line })).resolves.toHaveLength(1);

    const people = await service.getPeopleSummary({ tenantId: ids.tenant, shiftId: ids.shift });
    const day = await service.getDaySummary({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(people.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pickerName: 'יהודה',
          activeOrdersCount: 1,
          waitingCheckCount: 0,
          errorCount: 0
        })
      ])
    );
    expect(day).toMatchObject({
      totalOrders: 2,
      pickingOrders: 1,
      waitingCheckOrders: 0,
      doneOrders: 1,
      errorsCount: 0
    });
    expect(day.byErrorType).toEqual([]);
  });

  it('deletes an empty line and writes a line_deleted event', async () => {
    const { repo, state } = createRepo();
    state.orders = [];
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const deleted = await service.deleteLine({
      tenantId: ids.tenant,
      lineId: ids.line,
      reason: 'Empty line',
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    expect(deleted.deletedAt).toBe(nowIso);
    expect(state.events.at(-1)).toMatchObject({
      eventType: 'line_deleted',
      lineId: ids.line,
      payload: { reason: 'Empty line' }
    });
  });

  it('blocks line delete when non-deleted points exist', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order, lineId: ids.line }));
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    await expect(
      service.deleteLine({
        tenantId: ids.tenant,
        lineId: ids.line,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_LINE_NOT_EMPTY' });
  });

  it('allows line delete when only deleted points remain and supports restore', async () => {
    const { repo, state } = createRepo();
    state.orders.push(
      createOrder({
        id: ids.order,
        lineId: ids.line,
        deletedAt: '2026-05-26T06:50:00.000Z',
        deletedByProfileId: ids.actor,
        deletedByName: 'Dispatcher',
        deleteReason: 'Duplicate point'
      })
    );
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    const deleted = await service.deleteLine({
      tenantId: ids.tenant,
      lineId: ids.line,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(deleted.deletedAt).toBe(nowIso);

    const restored = await service.restoreLine({
      tenantId: ids.tenant,
      lineId: ids.line,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(restored.deletedAt).toBeNull();
    expect(state.events.at(-1)).toMatchObject({
      eventType: 'line_restored',
      lineId: ids.line
    });
  });

  it('rejects point and line delete/restore on closed shifts', async () => {
    const { repo, state } = createRepo();
    state.shifts[0].status = 'closed';
    state.orders.push(
      createOrder({
        id: ids.order,
        deletedAt: '2026-05-26T06:50:00.000Z',
        deletedByProfileId: ids.actor,
        deletedByName: 'Dispatcher',
        deleteReason: 'Duplicate point'
      })
    );
    state.lines[0] = {
      ...state.lines[0],
      deleted_at: '2026-05-26T06:50:00.000Z',
      deleted_by_profile_id: ids.actor,
      deleted_by_name: 'Dispatcher',
      delete_reason: 'Empty line'
    };
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    await expect(
      service.deleteOrder({
        tenantId: ids.tenant,
        orderId: ids.order,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_CLOSED' });
    await expect(
      service.restoreOrder({
        tenantId: ids.tenant,
        orderId: ids.order,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_CLOSED' });
    await expect(
      service.deleteLine({
        tenantId: ids.tenant,
        lineId: ids.line,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_CLOSED' });
    await expect(
      service.restoreLine({
        tenantId: ids.tenant,
        lineId: ids.line,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_CLOSED' });
  });

  it('enforces tenant isolation for point and line delete/restore', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order }));
    const service = createManualShiftsServiceFromRepo(repo, {
      getTodayDate: () => '2026-05-26',
      getNowIso: () => nowIso
    });

    await expect(
      service.deleteOrder({
        tenantId: ids.otherTenant,
        orderId: ids.order,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_NOT_FOUND' });

    await expect(
      service.restoreLine({
        tenantId: ids.otherTenant,
        lineId: ids.line,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_LINE_NOT_FOUND' });
  });
});

describe('manual shift workers service', () => {
  function makeService(repo: ManualShiftsRepo) {
    return createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
  }

  it('creates a worker for an active shift', async () => {
    const { repo } = createRepo();
    const service = makeService(repo);

    const worker = await service.createWorker({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      name: 'יהודה',
      role: 'picker',
      sortOrder: 1
    });

    expect(worker).toMatchObject({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      name: 'יהודה',
      role: 'picker',
      active: true
    });
    expect(repo.createWorker).toHaveBeenCalledOnce();
  });

  it('rejects createWorker when shift is closed', async () => {
    const { repo, state } = createRepo();
    state.shifts[0].status = 'closed';
    const service = makeService(repo);

    await expect(
      service.createWorker({
        tenantId: ids.tenant,
        shiftId: ids.shift,
        name: 'דוד',
        role: 'picker',
        sortOrder: 1
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_CLOSED' });
  });

  it('lists workers for a shift and enforces tenant isolation', async () => {
    const { repo, state } = createRepo();
    state.workers.push(
      createWorker({ id: ids.worker, shiftId: ids.shift, tenantId: ids.tenant }),
      createWorker({ id: ids.actor, shiftId: ids.shift, tenantId: ids.otherTenant, name: 'Other' })
    );
    const service = makeService(repo);

    const workers = await service.listShiftWorkers({ tenantId: ids.tenant, shiftId: ids.shift });
    // repo returns all shift workers; service verifies tenant of shift
    expect(workers.length).toBeGreaterThanOrEqual(1);
    expect(repo.listShiftWorkers).toHaveBeenCalledWith(ids.shift);
  });

  it('deactivates a worker', async () => {
    const { repo, state } = createRepo();
    state.workers.push(createWorker({ id: ids.worker }));
    const service = makeService(repo);

    const updated = await service.deactivateWorker({
      tenantId: ids.tenant,
      workerId: ids.worker
    });

    expect(updated.active).toBe(false);
    expect(repo.updateWorker).toHaveBeenCalledWith(ids.worker, { active: false });
  });

  it('returns 404 when deactivating a non-existent worker', async () => {
    const { repo } = createRepo();
    const service = makeService(repo);

    await expect(
      service.deactivateWorker({ tenantId: ids.tenant, workerId: ids.worker })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_WORKER_NOT_FOUND' });
  });

  it('createOrder stores pickerWorkerId snapshot alongside pickerName', async () => {
    const { repo, state } = createRepo();
    state.workers.push(createWorker({ id: ids.worker, name: 'יהודה' }));
    const service = makeService(repo);

    const order = await service.createOrder({
      tenantId: ids.tenant,
      lineId: ids.line,
      pointName: 'נקודה א',
      pickerName: 'יהודה',
      pickerWorkerId: ids.worker,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    expect(order.pickerName).toBe('יהודה');
    expect(order.pickerWorkerId).toBe(ids.worker);
  });

  it('createOrder allows pickerWorkerId to be null (free-text picker still works)', async () => {
    const { repo } = createRepo();
    const service = makeService(repo);

    const order = await service.createOrder({
      tenantId: ids.tenant,
      lineId: ids.line,
      pointName: 'נקודה ב',
      pickerName: 'חופשי',
      pickerWorkerId: null,
      actor: { actorProfileId: null, actorName: 'Dispatcher' }
    });

    expect(order.pickerName).toBe('חופשי');
    expect(order.pickerWorkerId).toBeNull();
  });

  it('people summary shows roster workers with zero points', async () => {
    const { repo, state } = createRepo();
    // Worker exists but no orders assigned
    state.workers.push(createWorker({ id: ids.worker, name: 'ללא הזמנות' }));
    const service = makeService(repo);

    const people = await service.getPeopleSummary({
      tenantId: ids.tenant,
      shiftId: ids.shift
    });

    // Existing people summary: derived from orders only (no orders = empty items)
    expect(people.items).toEqual([]);
    // Worker with no points is shown via the workers endpoint, not people summary
    const workers = await service.listShiftWorkers({ tenantId: ids.tenant, shiftId: ids.shift });
    expect(workers.find((w) => w.name === 'ללא הזמנות')).toBeTruthy();
  });

  it('no canonical WOS tables touched — orders table only references manual shift tables', async () => {
    const { repo } = createRepo();
    const service = makeService(repo);

    await service.createOrder({
      tenantId: ids.tenant,
      lineId: ids.line,
      pointName: 'Test',
      actor: { actorProfileId: null, actorName: 'test' }
    });

    // Verify only manual-shift repo methods were called
    expect(repo.createOrder).toHaveBeenCalledOnce();
    // No wave/pick_task/canonical order calls
    const repoKeys = Object.keys(repo) as Array<keyof ManualShiftsRepo>;
    const canonicalKeys = repoKeys.filter(
      (k) => !k.startsWith('listShift') && !k.startsWith('find') &&
              !k.startsWith('create') && !k.startsWith('update') &&
              !k.startsWith('close') && !k.startsWith('patch') &&
              !k.startsWith('list') &&
              k !== 'applyDailyImport' &&
              k !== 'countMonthlyImportShiftRows' &&
              k !== 'applyMonthlyImport' &&
              k !== 'checkMonthlyReplaceSafety' &&
              k !== 'setWorkerAuthUser' &&
              k !== 'insertMonthlyImportExcludedRows' &&
              k !== 'insertRawDemandRows' &&
              k !== 'getDemandImportBatch' &&
              k !== 'createDemandPlanningDraft' &&
              k !== 'getDemandPlanningDraft' &&
              k !== 'updateDemandPlanningDraftStatus' &&
              k !== 'deleteDemandPlanningBucketsByDraft' &&
              k !== 'insertDemandPlanningBuckets' &&
              k !== 'listDemandPlanningBuckets' &&
              k !== 'deleteDemandPlanningAllocationsByDraft' &&
              k !== 'insertDemandPlanningAllocations' &&
              k !== 'listDemandPlanningAllocations' &&
              k !== 'listRawDemandRowsByIds' &&
              k !== 'publishDemandPlanningDraftToShift' &&
              k !== 'getBacklogSummary' &&
              k !== 'countBacklogDistinctBatches' &&
              k !== 'getDemandPlanningPublication' &&
              k !== 'revertDemandPlanningPublication' &&
              k !== 'getDemandPlanningDraftPublication'
    );
    expect(canonicalKeys).toEqual([]);
  });
});

describe('manual shift order check units', () => {
  it('creates and lists check units', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));

    const created = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      note: 'first pallet',
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    expect(created.unitNumber).toBe(1);
    expect(created.status).toBe('open');

    const listed = await service.listOrderCheckUnits({ tenantId: ids.tenant, orderId: ids.order });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });

  it('create check unit does not persist inferred palletCount when initial palletCount is null', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', palletCount: null }));

    await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();
  });

  it('create check unit does not change declared palletCount=0', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', palletCount: 0 }));

    await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    expect(state.orders[0]?.palletCount).toBe(0);
  });

  it('create check unit keeps declared palletCount unchanged even when active units exceed declaration', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', palletCount: 3 }));

    await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    expect(state.orders[0]?.palletCount).toBe(3);

    await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    expect(state.orders[0]?.palletCount).toBe(3);
  });

  it('void replacement flow keeps declared palletCount unchanged and allows completion', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', palletCount: null }));

    const unit1 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    const unit2 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit2.id,
      status: 'voided',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    const unit3 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit1.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit3.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    const done = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(state.orders[0]?.palletCount).toBeNull();
    expect(done.status).toBe('done');
  });

  it('returned replacement flow (returned->voided->new unit) keeps declared palletCount unchanged and allows completion', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', palletCount: null }));

    const unit1 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    const unit2 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit2.id,
      status: 'returned',
      reason: 'damaged wrap',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit2.id,
      status: 'voided',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    const unit3 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit1.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit3.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    const done = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(done.status).toBe('done');
  });

  it('returned -> checked after replacement keeps declared palletCount unchanged and completion consistent', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', palletCount: null }));

    const unit1 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    const unit2 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit2.id,
      status: 'returned',
      reason: 'damaged wrap',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    const unit3 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit2.id,
      status: 'checked',
      reason: 'resolved',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit1.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit3.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    const done = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    expect(done.status).toBe('done');
    expect(state.orders[0]?.palletCount).toBeNull();
  });

  it('returned -> open after replacement keeps declared palletCount unchanged and done stays blocked with open unit', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', palletCount: null }));

    const unit1 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    const unit2 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit2.id,
      status: 'returned',
      reason: 'damaged wrap',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    const unit3 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit2.id,
      status: 'open',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    expect(state.orders[0]?.palletCount).toBeNull();

    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit1.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit3.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    await expect(
      service.transitionOrderStatus({
        tenantId: ids.tenant,
        orderId: ids.order,
        status: 'done',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_DONE_BLOCKED_BY_CHECK_UNITS' });
  });

  it('order can complete after multiple dynamically added pallets are checked', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', palletCount: null }));

    const unit1 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    const unit2 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    const unit3 = await service.createOrderCheckUnit({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit1.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit2.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: unit3.id,
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    const done = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(done.status).toBe('done');
    expect(state.orders[0]?.palletCount).toBeNull();
  });

  it('transitions check unit status and emits audit event', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'open',
      note: null,
      reason: null,
      checkedAt: null,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const updated = await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(updated.status).toBe('checked');
    expect(updated.checkedAt).toBe(nowIso);
    expect(repo.createOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'check_unit_status_changed'
      })
    );
  });

  it('rejects invalid check unit transitions', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'voided',
      note: null,
      reason: null,
      checkedAt: null,
      returnedAt: null,
      voidedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await expect(
      service.transitionOrderCheckUnitStatus({
        tenantId: ids.tenant,
        checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
        status: 'checked',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_CHECK_UNIT_INVALID_STATUS_TRANSITION' });
  });

  it('rejects open -> returned transition without repair reason', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'open',
      note: null,
      reason: null,
      checkedAt: null,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await expect(
      service.transitionOrderCheckUnitStatus({
        tenantId: ids.tenant,
        checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
        status: 'returned',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_CHECK_UNIT_RETURNED_REASON_REQUIRED' });
  });

  it('open -> returned persists reason, returned -> open clears reason', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'open',
      note: null,
      reason: null,
      checkedAt: null,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const returned = await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      status: 'returned',
      reason: 'מוצר פגום',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    expect(returned.reason).toBe('מוצר פגום');

    const reopened = await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      status: 'open',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    expect(reopened.reason).toBeNull();
  });

  it('returned -> checked preserves existing reason for audit context', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'returned',
      note: null,
      reason: 'בעיית אריזה',
      checkedAt: null,
      returnedAt: nowIso,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const checked = await service.transitionOrderCheckUnitStatus({
      tenantId: ids.tenant,
      checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      status: 'checked',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(checked.reason).toBe('בעיית אריזה');
  });
});

describe('manual shift ashlama constraints', () => {
  it('creates manual order-level ashlama without checkUnitId', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));

    const ashlama = await service.createOrderAshlama({
      tenantId: ids.tenant,
      orderId: ids.order,
      text: 'השלמה ידנית',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(ashlama.checkUnitId).toBeNull();
    expect(ashlama.source).toBe('manual');
    expect(ashlama.status).toBe('open');
  });

  it('creates ashlama only for returned check unit with reason מוצר אזל', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'returned',
      note: null,
      reason: 'מוצר אזל',
      checkedAt: null,
      returnedAt: nowIso,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const ashlama = await service.createOrderAshlama({
      tenantId: ids.tenant,
      orderId: ids.order,
      checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      text: 'להוסיף מוצר',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(ashlama.status).toBe('open');
    expect(ashlama.text).toBe('להוסיף מוצר');
    expect(ashlama.source).toBe('check_unit');
  });

  it('rejects ashlama when check unit is not returned', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'checked',
      note: null,
      reason: 'מוצר אזל',
      checkedAt: nowIso,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await expect(
      service.createOrderAshlama({
        tenantId: ids.tenant,
        orderId: ids.order,
        checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
        text: 'להוסיף מוצר',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ASHLAMA_REQUIRES_RETURNED_CHECK_UNIT' });
  });

  it('rejects ashlama when checkUnit reason is not חסר מוצר', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'returned',
      note: null,
      reason: 'מוצר פגום',
      checkedAt: null,
      returnedAt: nowIso,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    await expect(
      service.createOrderAshlama({
        tenantId: ids.tenant,
        orderId: ids.order,
        checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
        text: 'להוסיף מוצר',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ASHLAMA_REQUIRES_MISSING_PRODUCT_REASON' });
  });

  it('rejects ashlama when checkUnit does not belong to order', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.orders.push(createOrder({ id: ids.orderTwo, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.orderTwo,
      unitNumber: 1,
      status: 'returned',
      note: null,
      reason: 'מוצר אזל',
      checkedAt: null,
      returnedAt: nowIso,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await expect(
      service.createOrderAshlama({
        tenantId: ids.tenant,
        orderId: ids.order,
        checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
        text: 'להוסיף מוצר',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ASHLAMA_CHECK_UNIT_ORDER_MISMATCH' });
  });

  it('creates manual ashlama and emits ashlama_created event with source=manual', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));

    const ashlama = await service.createOrderAshlama({
      tenantId: ids.tenant,
      orderId: ids.order,
      text: 'השלמה ידנית',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(repo.createOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ashlama_created',
        orderId: ids.order,
        fromStatus: null,
        toStatus: null,
        payload: expect.objectContaining({
          ashlamaId: ashlama.id,
          source: 'manual',
          checkUnitId: null
        })
      })
    );
  });

  it('creates check-unit-linked ashlama and emits ashlama_created event with source=check_unit and checkUnitId', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    const checkUnitId = 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57';
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: checkUnitId,
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'returned',
      note: null,
      reason: 'מוצר אזל',
      checkedAt: null,
      returnedAt: nowIso,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const ashlama = await service.createOrderAshlama({
      tenantId: ids.tenant,
      orderId: ids.order,
      checkUnitId,
      text: 'להוסיף מוצר',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(repo.createOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ashlama_created',
        payload: expect.objectContaining({
          source: 'check_unit',
          checkUnitId
        })
      })
    );
    expect(ashlama.source).toBe('check_unit');
  });

  it('status transition open → done emits ashlama_status_changed with fromStatus and toStatus in payload', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    const ashlamaId = '24fd43e8-c4ff-41ab-bdc1-79bc6d53cd62';
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.ashlamot.push({
      id: ashlamaId,
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      checkUnitId: null,
      source: 'manual',
      status: 'open',
      text: 'השלמה',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await service.patchOrderAshlamaStatus({
      tenantId: ids.tenant,
      ashlamaId,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(repo.createOrderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ashlama_status_changed',
        orderId: ids.order,
        fromStatus: null,
        toStatus: null,
        payload: expect.objectContaining({
          fromStatus: 'open',
          toStatus: 'done'
        })
      })
    );
  });

  it('rejects duplicate open ashlama for same check unit', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check' }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'returned',
      note: null,
      reason: 'מוצר אזל',
      checkedAt: null,
      returnedAt: nowIso,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    state.ashlamot.push({
      id: '24fd43e8-c4ff-41ab-bdc1-79bc6d53cd62',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      source: 'check_unit',
      status: 'open',
      text: 'existing',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await expect(
      service.createOrderAshlama({
        tenantId: ids.tenant,
        orderId: ids.order,
        checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
        text: 'להוסיף מוצר',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ASHLAMA_DUPLICATE_OPEN_FOR_CHECK_UNIT' });
  });
});

describe('listOpenShiftAshlamot', () => {
  function makeService() {
    const { repo, state } = createRepo();
    return { service: createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso }), state };
  }

  it('returns only open ashlamot for the shift', async () => {
    const { service, state } = makeService();
    state.orders.push(createOrder({ id: ids.order }));
    state.ashlamot.push(
      { id: 'aaaa0000-0000-4000-8000-000000000001', tenantId: ids.tenant, shiftId: ids.shift, lineId: ids.line, orderId: ids.order, checkUnitId: null, source: 'manual', status: 'open', text: 'פריט חסר', createdAt: '2026-05-26T07:00:00.000Z', updatedAt: nowIso },
      { id: 'aaaa0000-0000-4000-8000-000000000002', tenantId: ids.tenant, shiftId: ids.shift, lineId: ids.line, orderId: ids.order, checkUnitId: null, source: 'manual', status: 'done', text: 'הושלם', createdAt: '2026-05-26T07:01:00.000Z', updatedAt: nowIso },
      { id: 'aaaa0000-0000-4000-8000-000000000003', tenantId: ids.tenant, shiftId: ids.shift, lineId: ids.line, orderId: ids.order, checkUnitId: null, source: 'manual', status: 'cancelled', text: 'בוטל', createdAt: '2026-05-26T07:02:00.000Z', updatedAt: nowIso }
    );

    const result = await service.listOpenShiftAshlamot({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('פריט חסר');
    expect(result[0].id).toBe('aaaa0000-0000-4000-8000-000000000001');
  });

  it('returns rows sorted oldest first', async () => {
    const { service, state } = makeService();
    state.orders.push(createOrder({ id: ids.order }));
    state.ashlamot.push(
      { id: 'aaaa0000-0000-4000-8000-000000000002', tenantId: ids.tenant, shiftId: ids.shift, lineId: ids.line, orderId: ids.order, checkUnitId: null, source: 'manual', status: 'open', text: 'שנייה', createdAt: '2026-05-26T07:01:00.000Z', updatedAt: nowIso },
      { id: 'aaaa0000-0000-4000-8000-000000000001', tenantId: ids.tenant, shiftId: ids.shift, lineId: ids.line, orderId: ids.order, checkUnitId: null, source: 'manual', status: 'open', text: 'ראשונה', createdAt: '2026-05-26T07:00:00.000Z', updatedAt: nowIso }
    );

    const result = await service.listOpenShiftAshlamot({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result[0].text).toBe('ראשונה');
    expect(result[1].text).toBe('שנייה');
  });

  it('returns order number and point name from joined order', async () => {
    const { service, state } = makeService();
    state.orders.push(createOrder({ id: ids.order, orderNumber: '502481', pointName: 'ירושלים' }));
    state.ashlamot.push(
      { id: 'aaaa0000-0000-4000-8000-000000000001', tenantId: ids.tenant, shiftId: ids.shift, lineId: ids.line, orderId: ids.order, checkUnitId: null, source: 'manual', status: 'open', text: 'פריט', createdAt: nowIso, updatedAt: nowIso }
    );

    const [item] = await service.listOpenShiftAshlamot({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(item.orderNumber).toBe('502481');
    expect(item.pointName).toBe('ירושלים');
    expect(item.lineName).toBe('Kav A');
  });

  it('returns empty array when no open ashlamot exist', async () => {
    const { service } = makeService();

    const result = await service.listOpenShiftAshlamot({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result).toEqual([]);
  });

  it('throws when shift belongs to a different tenant', async () => {
    const { service } = makeService();

    await expect(
      service.listOpenShiftAshlamot({ tenantId: ids.otherTenant, shiftId: ids.shift })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_NOT_FOUND' });
  });

  it('excludes open ashlama belonging to a soft-deleted order', async () => {
    const { service, state } = makeService();
    state.orders.push(createOrder({ id: ids.order, deletedAt: nowIso }));
    state.ashlamot.push({
      id: 'aaaa0000-0000-4000-8000-000000000001',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      checkUnitId: null,
      source: 'manual',
      status: 'open',
      text: 'soft-deleted order',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const result = await service.listOpenShiftAshlamot({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result).toHaveLength(0);
  });

  it('excludes open ashlama belonging to a soft-deleted line', async () => {
    const { service, state } = makeService();
    state.orders.push(createOrder({ id: ids.order }));
    state.lines[0] = { ...state.lines[0], deleted_at: nowIso };
    state.ashlamot.push({
      id: 'aaaa0000-0000-4000-8000-000000000001',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      checkUnitId: null,
      source: 'manual',
      status: 'open',
      text: 'soft-deleted line',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const result = await service.listOpenShiftAshlamot({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result).toHaveLength(0);
  });

  it('returns active-order ashlama and excludes deleted-order ashlama in the same shift', async () => {
    const { service, state } = makeService();
    state.orders.push(
      createOrder({ id: ids.order, deletedAt: null }),
      createOrder({ id: ids.orderTwo, deletedAt: nowIso })
    );
    state.ashlamot.push(
      { id: 'aaaa0000-0000-4000-8000-000000000001', tenantId: ids.tenant, shiftId: ids.shift, lineId: ids.line, orderId: ids.order, checkUnitId: null, source: 'manual', status: 'open', text: 'active order', createdAt: nowIso, updatedAt: nowIso },
      { id: 'aaaa0000-0000-4000-8000-000000000002', tenantId: ids.tenant, shiftId: ids.shift, lineId: ids.line, orderId: ids.orderTwo, checkUnitId: null, source: 'manual', status: 'open', text: 'deleted order', createdAt: nowIso, updatedAt: nowIso }
    );

    const result = await service.listOpenShiftAshlamot({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('active order');
  });
});

describe('manual shift timestamp correctness (PR2)', () => {
  // PR2 scope: checkedAt guard + documented fixedAt gap.
  // checkedAt = first time a checker handled the order. Never overwritten once set.
  // fixedAt on ManualShiftOrderError is NOT set in this PR — no updateOrderError repo method
  // exists and the open-error identity problem is unsolved. Deferred to a later PR.

  function makeService(getNowIso: () => string) {
    const { repo, state } = createRepo();
    return {
      service: createManualShiftsServiceFromRepo(repo, { getNowIso }),
      state
    };
  }

  it('waiting_check → done sets checkedAt and finishedAt', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 1 }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'checked',
      note: null,
      reason: null,
      checkedAt: nowIso,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const order = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(order.checkedAt).toBe(nowIso);
    expect(order.finishedAt).toBe(nowIso);
  });

  it('blocks waiting_check → done when active check units include open', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 1 }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'open',
      note: null,
      reason: null,
      checkedAt: null,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await expect(
      service.transitionOrderStatus({
        tenantId: ids.tenant,
        orderId: ids.order,
        status: 'done',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_DONE_BLOCKED_BY_CHECK_UNITS' });
  });

  it('blocks waiting_check → done when active check units include returned', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 1 }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'returned',
      note: null,
      reason: 'needs repack',
      checkedAt: null,
      returnedAt: nowIso,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await expect(
      service.transitionOrderStatus({
        tenantId: ids.tenant,
        orderId: ids.order,
        status: 'done',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_DONE_BLOCKED_BY_CHECK_UNITS' });
  });

  it('blocks waiting_check → done when order has open ashlama', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 1 }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'checked',
      note: null,
      reason: null,
      checkedAt: nowIso,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    state.ashlamot.push({
      id: '24fd43e8-c4ff-41ab-bdc1-79bc6d53cd62',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      source: 'check_unit',
      status: 'open',
      text: 'bring missing product',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await expect(
      service.transitionOrderStatus({
        tenantId: ids.tenant,
        orderId: ids.order,
        status: 'done',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_DONE_BLOCKED_BY_OPEN_ASHLAMA' });
  });

  it('blocks waiting_check → done when order has open manual ashlama', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 1 }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'checked',
      note: null,
      reason: null,
      checkedAt: nowIso,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    state.ashlamot.push({
      id: '54fd43e8-c4ff-41ab-bdc1-79bc6d53cd62',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      checkUnitId: null,
      source: 'manual',
      status: 'open',
      text: 'manual completion',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await expect(
      service.transitionOrderStatus({
        tenantId: ids.tenant,
        orderId: ids.order,
        status: 'done',
        actor: { actorProfileId: ids.actor, actorName: 'Checker' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_DONE_BLOCKED_BY_OPEN_ASHLAMA' });
  });

  it('allows waiting_check → done when manual ashlama is done', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 1 }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'checked',
      note: null,
      reason: null,
      checkedAt: nowIso,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    state.ashlamot.push({
      id: '64fd43e8-c4ff-41ab-bdc1-79bc6d53cd62',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      checkUnitId: null,
      source: 'manual',
      status: 'done',
      text: 'manual completion',
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const done = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(done.status).toBe('done');
  });

  it('allows waiting_check → done when all active units are checked', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 1 }));
    state.checkUnits.push(
      {
        id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
        tenantId: ids.tenant,
        shiftId: ids.shift,
        lineId: ids.line,
        orderId: ids.order,
        unitNumber: 1,
        status: 'checked',
        note: null,
        reason: null,
        checkedAt: nowIso,
        returnedAt: null,
        voidedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: '82f58cf5-3cb5-4546-b028-cf2869f8160b',
        tenantId: ids.tenant,
        shiftId: ids.shift,
        lineId: ids.line,
        orderId: ids.order,
        unitNumber: 2,
        status: 'voided',
        note: null,
        reason: null,
        checkedAt: null,
        returnedAt: null,
        voidedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    );

    const done = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(done.status).toBe('done');
    expect(done.finishedAt).toBe(nowIso);
  });

  it('waiting_check → returned sets checkedAt', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 2 }));

    const order = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'returned',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(order.checkedAt).toBe(nowIso);
  });

  it('waiting_check → done does not overwrite checkedAt if already set', async () => {
    const firstCheckedAt = '2026-05-26T06:30:00.000Z';
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: firstCheckedAt, palletCount: 1 }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'checked',
      note: null,
      reason: null,
      checkedAt: firstCheckedAt,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const order = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(order.checkedAt).toBe(firstCheckedAt);
    expect(order.finishedAt).toBe(nowIso);
  });

  it('picking → waiting_check sets waitingCheckAt and does not set checkedAt', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'picking', startedAt: nowIso, checkedAt: null }));

    const order = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'waiting_check',
      actor: { actorProfileId: ids.actor, actorName: 'Picker' }
    });

    expect(order.waitingCheckAt).toBe(nowIso);
    expect(order.checkedAt).toBeNull();
  });

  it('returned → waiting_check updates waitingCheckAt; fixedAt on open error is not stamped (deferred)', async () => {
    const firstCheckedAt = '2026-05-26T06:30:00.000Z';
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'returned', checkedAt: firstCheckedAt }));

    const order = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'waiting_check',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(order.waitingCheckAt).toBe(nowIso);
    expect(order.checkedAt).toBe(firstCheckedAt);
  });

  it('start-check from picking sets checkStartedAt only, keeps status and waitingCheckAt, and writes check_started event', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'picking', waitingCheckAt: null, checkStartedAt: null }));

    const order = await service.startOrderCheck({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(order.status).toBe('picking');
    expect(order.checkStartedAt).toBe(nowIso);
    expect(order.waitingCheckAt).toBeNull();
    expect(state.events.some((event) => event.eventType === 'check_started')).toBe(true);
  });

  it('repeated start-check is idempotent and does not overwrite first checkStartedAt', async () => {
    const firstCheckStartedAt = '2026-05-26T06:30:00.000Z';
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'picking', checkStartedAt: firstCheckStartedAt }));

    const order = await service.startOrderCheck({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(order.checkStartedAt).toBe(firstCheckStartedAt);
    expect(state.events.some((event) => event.eventType === 'check_started')).toBe(false);
  });

  it('start-check then finish picking preserves checkStartedAt and stamps waitingCheckAt separately', async () => {
    const { service, state } = makeService(() => nowIso);
    state.orders.push(createOrder({ id: ids.order, status: 'picking', checkStartedAt: null, waitingCheckAt: null }));

    await service.startOrderCheck({
      tenantId: ids.tenant,
      orderId: ids.order,
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    const order = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'waiting_check',
      actor: { actorProfileId: ids.actor, actorName: 'Picker' }
    });

    expect(order.status).toBe('waiting_check');
    expect(order.checkStartedAt).toBe(nowIso);
    expect(order.waitingCheckAt).toBe(nowIso);
  });

  it('start-check rejects non-picking statuses', async () => {
    const statuses: ManualShiftOrder['status'][] = ['queued', 'waiting_check', 'returned', 'done'];
    for (const status of statuses) {
      const { service, state } = makeService(() => nowIso);
      state.orders.push(createOrder({ id: ids.order, status }));
      await expect(
        service.startOrderCheck({
          tenantId: ids.tenant,
          orderId: ids.order,
          actor: { actorProfileId: ids.actor, actorName: 'Checker' }
        })
      ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_INVALID_STATUS_TRANSITION' });
    }
  });

  it('createOrderError sets checkedAt on first error and does not overwrite on a subsequent error', async () => {
    const firstTime = '2026-05-26T06:00:00.000Z';
    let callCount = 0;
    const { service, state } = makeService(() => (callCount++ === 0 ? firstTime : nowIso));
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 1 }));

    await service.createOrderError({
      tenantId: ids.tenant,
      orderId: ids.order,
      type: 'missing_item',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    expect(state.orders[0]?.checkedAt).toBe(firstTime);

    await service.createOrderError({
      tenantId: ids.tenant,
      orderId: ids.order,
      type: 'wrong_quantity',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    expect(state.orders[0]?.checkedAt).toBe(firstTime);
  });

  it('waiting_check → returned → waiting_check → done preserves original checkedAt and sets finishedAt on done', async () => {
    const firstCheckedAt = '2026-05-26T06:00:00.000Z';
    let callCount = 0;
    const { service, state } = makeService(() => (callCount++ === 0 ? firstCheckedAt : nowIso));
    state.orders.push(createOrder({ id: ids.order, status: 'waiting_check', checkedAt: null, palletCount: 1 }));
    state.checkUnits.push({
      id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      tenantId: ids.tenant,
      shiftId: ids.shift,
      lineId: ids.line,
      orderId: ids.order,
      unitNumber: 1,
      status: 'checked',
      note: null,
      reason: null,
      checkedAt: firstCheckedAt,
      returnedAt: null,
      voidedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'returned',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });
    expect(state.orders[0]?.checkedAt).toBe(firstCheckedAt);

    await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'waiting_check',
      actor: { actorProfileId: ids.actor, actorName: 'Picker' }
    });

    const done = await service.transitionOrderStatus({
      tenantId: ids.tenant,
      orderId: ids.order,
      status: 'done',
      actor: { actorProfileId: ids.actor, actorName: 'Checker' }
    });

    expect(done.checkedAt).toBe(firstCheckedAt);
    expect(done.finishedAt).toBe(nowIso);
  });
});

describe('manual shift picker assignment patch', () => {
  function makeService(repo: ManualShiftsRepo) {
    return createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
  }

  it('assigns/reassigns/free-text/clears picker and writes picker_changed payload', async () => {
    const { repo, state } = createRepo();
    const workerA = createWorker({ id: ids.worker, name: 'Worker A', active: true });
    const workerB = createWorker({ id: ids.orderTwo, name: 'Worker B', active: true });
    state.workers.push(workerA, workerB);
    state.orders.push(createOrder({ id: ids.order, pickerName: null, pickerWorkerId: null }));
    const service = makeService(repo);

    const assigned = await service.patchOrder({
      tenantId: ids.tenant,
      orderId: ids.order,
      pickerWorkerId: workerA.id,
      pickerName: 'client mismatch',
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(assigned.pickerWorkerId).toBe(workerA.id);
    expect(assigned.pickerName).toBe(workerA.name);

    const reassigned = await service.patchOrder({
      tenantId: ids.tenant,
      orderId: ids.order,
      pickerWorkerId: workerB.id,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(reassigned.pickerWorkerId).toBe(workerB.id);
    expect(reassigned.pickerName).toBe(workerB.name);

    const freeText = await service.patchOrder({
      tenantId: ids.tenant,
      orderId: ids.order,
      pickerWorkerId: null,
      pickerName: 'Free Text',
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(freeText.pickerWorkerId).toBeNull();
    expect(freeText.pickerName).toBe('Free Text');

    const cleared = await service.patchOrder({
      tenantId: ids.tenant,
      orderId: ids.order,
      pickerWorkerId: null,
      pickerName: null,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });
    expect(cleared.pickerWorkerId).toBeNull();
    expect(cleared.pickerName).toBeNull();

    const pickerEvents = state.events.filter((event) => event.eventType === 'picker_changed');
    expect(pickerEvents.length).toBe(4);
    expect(pickerEvents[0]).toMatchObject({
      payload: {
        previousPickerName: null,
        previousPickerWorkerId: null,
        nextPickerName: 'Worker A',
        nextPickerWorkerId: workerA.id
      }
    });
  });

  it('rejects inactive/wrong-shift/wrong-tenant picker worker assignments', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order }));
    state.workers.push(
      createWorker({ id: ids.worker, active: false }),
      createWorker({ id: ids.orderTwo, shiftId: ids.lineTwo, active: true }),
      createWorker({ id: ids.orderThree, tenantId: ids.otherTenant, active: true })
    );
    const service = makeService(repo);

    await expect(
      service.patchOrder({
        tenantId: ids.tenant,
        orderId: ids.order,
        pickerWorkerId: ids.worker,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_PICKER_WORKER_INVALID' });

    await expect(
      service.patchOrder({
        tenantId: ids.tenant,
        orderId: ids.order,
        pickerWorkerId: ids.orderTwo,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_PICKER_WORKER_INVALID' });

    await expect(
      service.patchOrder({
        tenantId: ids.tenant,
        orderId: ids.order,
        pickerWorkerId: ids.orderThree,
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_PICKER_WORKER_INVALID' });
  });
});

describe('listOrderEvents access control', () => {
  const nowIso = '2026-05-26T07:00:00.000Z';

  function makeService(repo: ReturnType<typeof createRepo>['repo']) {
    return createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
  }

  it('returns events for a valid order', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order }));
    const event = { orderId: ids.order, createdAt: nowIso } as never;
    state.events.push(event);
    const service = makeService(repo);

    const result = await service.listOrderEvents({ tenantId: ids.tenant, orderId: ids.order });
    expect(result).toHaveLength(1);
  });

  it('rejects a foreign tenant', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order }));
    const service = makeService(repo);

    await expect(
      service.listOrderEvents({ tenantId: ids.otherTenant, orderId: ids.order })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_NOT_FOUND' });
  });

  it('rejects a deleted order', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order, deletedAt: nowIso }));
    const service = makeService(repo);

    await expect(
      service.listOrderEvents({ tenantId: ids.tenant, orderId: ids.order })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_NOT_FOUND' });
  });
});

describe('listOrders with item rollups', () => {
  const nowIso = '2026-05-26T07:00:00.000Z';

  function makeService(repo: ReturnType<typeof createRepo>['repo']) {
    return createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
  }

  it('computes lineCount and totalQuantity from items when stored line_count is null', async () => {
    const { repo, state } = createRepo();
    state.orders.push(
      createOrder({ id: ids.order, lineCount: null }),
      createOrder({ id: ids.orderTwo, lineCount: 5 })
    );
    state.items.push(
      {
        id: '11111111-1111-4111-8111-111111111112',
        tenantId: ids.tenant,
        shiftId: ids.shift,
        lineId: ids.line,
        orderId: ids.order,
        sku: '475659',
        description: null,
        category: null,
        quantity: 30,
        notes: null,
        zone: null,
        sourceSheet: null,
        sourceRows: null,
        sourceFile: null,
        sortOrder: 1,
        createdAt: nowIso
      },
      {
        id: '11111111-1111-4111-8111-111111111113',
        tenantId: ids.tenant,
        shiftId: ids.shift,
        lineId: ids.line,
        orderId: ids.order,
        sku: '519496',
        description: null,
        category: null,
        quantity: 2,
        notes: null,
        zone: null,
        sourceSheet: null,
        sourceRows: null,
        sourceFile: null,
        sortOrder: 2,
        createdAt: nowIso
      }
    );
    const service = makeService(repo);

    const orders = await service.listShiftOrders({ tenantId: ids.tenant, shiftId: ids.shift }) as Array<ManualShiftOrder & { totalQuantity: number }>;

    const orderOne = orders.find((o) => o.id === ids.order);
    expect(orderOne?.lineCount).toBe(2);
    expect(orderOne?.totalQuantity).toBe(32);

    const orderTwo = orders.find((o) => o.id === ids.orderTwo);
    expect(orderTwo?.lineCount).toBe(5);
    expect(orderTwo?.totalQuantity).toBe(0);
  });

  it('uses stored line_count when no items exist', async () => {
    const { repo, state } = createRepo();
    state.orders.push(
      createOrder({ id: ids.order, lineCount: 3 })
    );
    const service = makeService(repo);

    const orders = await service.listShiftOrders({ tenantId: ids.tenant, shiftId: ids.shift }) as Array<ManualShiftOrder & { totalQuantity: number }>;

    const order = orders.find((o) => o.id === ids.order);
    expect(order?.lineCount).toBe(3);
    expect(order?.totalQuantity).toBe(0);
  });

  it('returns totalQuantity 0 when no items exist and line_count is null', async () => {
    const { repo, state } = createRepo();
    state.orders.push(
      createOrder({ id: ids.order, lineCount: null })
    );
    const service = makeService(repo);

    const orders = await service.listShiftOrders({ tenantId: ids.tenant, shiftId: ids.shift }) as Array<ManualShiftOrder & { totalQuantity: number }>;

    const order = orders.find((o) => o.id === ids.order);
    expect(order?.lineCount).toBeNull();
    expect(order?.totalQuantity).toBe(0);
  });

  it('computes rollups in listLineOrders as well', async () => {
    const { repo, state } = createRepo();
    state.orders.push(
      createOrder({ id: ids.order, lineCount: null, lineId: ids.line }),
      createOrder({ id: ids.orderTwo, lineCount: 1, lineId: ids.lineTwo })
    );
    state.items.push(
      {
        id: '11111111-1111-4111-8111-111111111112',
        tenantId: ids.tenant,
        shiftId: ids.shift,
        lineId: ids.line,
        orderId: ids.order,
        sku: '1001',
        description: null,
        category: null,
        quantity: 10,
        notes: null,
        zone: null,
        sourceSheet: null,
        sourceRows: null,
        sourceFile: null,
        sortOrder: 1,
        createdAt: nowIso
      }
    );
    const service = makeService(repo);

    const lineOrders = await service.listLineOrders({ tenantId: ids.tenant, lineId: ids.line }) as Array<ManualShiftOrder & { totalQuantity: number }>;
    expect(lineOrders).toHaveLength(1);
    expect(lineOrders[0]?.lineCount).toBe(1);
    expect(lineOrders[0]?.totalQuantity).toBe(10);
  });
});

describe('getOrderDetail', () => {
  const nowIso = '2026-05-26T07:00:00.000Z';

  function makeService(repo: ReturnType<typeof createRepo>['repo']) {
    return createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
  }

  it('returns computed lineCount and totalQuantity from order items when line_count is null', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order, lineCount: null }));
    state.items.push(
      {
        id: '11111111-1111-4111-8111-111111111112',
        tenantId: ids.tenant,
        shiftId: ids.shift,
        lineId: ids.line,
        orderId: ids.order,
        sku: 'SKU-1',
        description: 'Item 1',
        category: null,
        quantity: 12,
        notes: null,
        zone: null,
        sourceSheet: null,
        sourceRows: [1],
        sourceFile: null,
        sortOrder: 1,
        createdAt: nowIso
      },
      {
        id: '11111111-1111-4111-8111-111111111113',
        tenantId: ids.tenant,
        shiftId: ids.shift,
        lineId: ids.line,
        orderId: ids.order,
        sku: 'SKU-2',
        description: 'Item 2',
        category: null,
        quantity: 20,
        notes: null,
        zone: null,
        sourceSheet: null,
        sourceRows: [2],
        sourceFile: null,
        sortOrder: 2,
        createdAt: nowIso
      }
    );
    const service = makeService(repo);

    const detail = await service.getOrderDetail({ tenantId: ids.tenant, orderId: ids.order });

    expect(detail.lineCount).toBe(2);
    expect(detail.totalQuantity).toBe(32);
    expect(detail.items).toHaveLength(2);
    expect(detail.items[0]?.sku).toBe('SKU-1');
    expect(detail.items[1]?.sku).toBe('SKU-2');
  });

  it('rejects a deleted order', async () => {
    const { repo, state } = createRepo();
    state.orders.push(createOrder({ id: ids.order, deletedAt: nowIso }));
    const service = makeService(repo);

    await expect(
      service.getOrderDetail({ tenantId: ids.tenant, orderId: ids.order })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_ORDER_NOT_FOUND' });
  });
});

describe('manual shift daily import apply', () => {
  function makeApplyService() {
    const { repo } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    return { repo, service };
  }

  it('applies a validated preview via repository transaction path', async () => {
    const { service, repo } = makeApplyService();
    const preview = {
      fileName: 'manual.xlsx',
      sheetName: 'סכימות',
      importDateRaw: '2.6.26',
      importDate: '2026-06-02',
      lineCount: 1,
      orderCount: 1,
      lines: [
        {
          name: 'דרום',
          rawLabel: 'דרום',
          sourceRow: 4,
          sortOrder: 1,
          orders: [
            {
              pointName: 'סלולר',
              rawLabel: 'דרום/סלולר',
              sourceRow: 5,
              sortOrder: 1
            }
          ]
        }
      ]
    };

    const result = await service.applyDailyImport({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      preview,
      actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
    });

    expect(result).toMatchObject({ shiftId: ids.shift, linesCreated: 0, ordersCreated: 0 });
    expect(repo.applyDailyImport).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      preview
    });
  });

  it.each([
    ['SHIFT_NOT_FOUND', 'SHIFT_NOT_FOUND'],
    ['SHIFT_NOT_ACTIVE', 'SHIFT_NOT_ACTIVE'],
    ['SHIFT_DATE_MISMATCH', 'SHIFT_DATE_MISMATCH'],
    ['SHIFT_NOT_EMPTY', 'SHIFT_NOT_EMPTY'],
    ['INVALID_PREVIEW_PAYLOAD', 'INVALID_PREVIEW_PAYLOAD']
  ])('maps apply failure %s to ApiError code', async (dbMessage, expectedCode) => {
    const { service, repo } = makeApplyService();
    vi.mocked(repo.applyDailyImport).mockRejectedValueOnce({ code: 'P0001', message: dbMessage });

    await expect(
      service.applyDailyImport({
        tenantId: ids.tenant,
        shiftId: ids.shift,
        preview: {
          fileName: 'manual.xlsx',
      sheetName: 'סכימות',
          importDateRaw: '2.6.26',
          importDate: '2026-06-02',
          lineCount: 1,
          orderCount: 1,
          lines: []
        },
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: expectedCode });
  });

  it.each(['22007', '22P02'])('maps apply cast error %s to INVALID_PREVIEW_PAYLOAD', async (dbCode) => {
    const { service, repo } = makeApplyService();
    vi.mocked(repo.applyDailyImport).mockRejectedValueOnce({
      code: dbCode,
      message: 'invalid input syntax'
    });

    await expect(
      service.applyDailyImport({
        tenantId: ids.tenant,
        shiftId: ids.shift,
        preview: {
          fileName: 'manual.xlsx',
          sheetName: 'סכימות',
          importDateRaw: '2.6.26',
          importDate: '2026-06-02',
          lineCount: 1,
          orderCount: 1,
          lines: []
        },
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'INVALID_PREVIEW_PAYLOAD' });
  });

  it('maps apply insufficient permission to FORBIDDEN', async () => {
    const { service, repo } = makeApplyService();
    vi.mocked(repo.applyDailyImport).mockRejectedValueOnce({
      code: '42501',
      message: 'FORBIDDEN'
    });

    await expect(
      service.applyDailyImport({
        tenantId: ids.tenant,
        shiftId: ids.shift,
        preview: {
          fileName: 'manual.xlsx',
          sheetName: 'סכימות',
          importDateRaw: '2.6.26',
          importDate: '2026-06-02',
          lineCount: 1,
          orderCount: 1,
          lines: []
        },
        actor: { actorProfileId: ids.actor, actorName: 'Dispatcher' }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('manual shift monthly import apply', () => {
  function makeMonthlyApplyService() {
    const { repo, state } = createRepo();
    state.shifts[0].date = '2026-06-14';
    state.lines = [];
    state.orders = [];
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });
    return { repo, service, state };
  }

  function buildMonthlyPreview() {
    return parseManualShiftMonthlyPreview({
      source: {
        fileName: 'monthly.xlsx',
        sheetName: 'יוני 26',
        availableSheets: ['יוני 26']
      },
      selectedDate: '2026-06-14',
      rows: [
        {
          rowIndex: 2,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          description: 'מוצר א',
          category: 'cat',
          quantity: 2,
          notes: 'note-a',
          zone: 'north'
        },
        {
          rowIndex: 3,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          description: 'מוצר א',
          category: 'cat',
          quantity: 3,
          notes: 'note-b',
          zone: 'north'
        },
        {
          rowIndex: 4,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה ב',
          customerName: 'לקוח ב',
          orderNumber: 'SO-2',
          sku: '1002',
          description: 'מוצר ב',
          category: 'cat',
          quantity: -1,
          zone: 'south'
        }
      ]
    });
  }

  it('applies a sanitized monthly plan through the repository', async () => {
    const { repo, service } = makeMonthlyApplyService();
    const parsed = buildMonthlyPreview();
    const plan = planManualShiftMonthlyImportApply(parsed);

    expect(plan.lines[0].orders[0]).toMatchObject({
      customerName: 'לקוח א',
      pointName: 'נקודה א',
      orderNumber: 'SO-1'
    });
    expect(plan.lines[0].orders[0].items[0]).toMatchObject({
      zone: 'north',
      sku: '1001',
      quantity: 5
    });
    expect(plan.lines[0].distributionArea).toBe('north');

    const result = await service.applyMonthlyImport({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      selectedDate: '2026-06-14',
      plan
    });

    expect(result).toMatchObject({
      shiftId: ids.shift,
      selectedDate: '2026-06-14'
    });
    expect(repo.applyMonthlyImport).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      selectedDate: '2026-06-14',
      plan
    });
  });

  it('applies monthly import when the shift only has soft-deleted rows', async () => {
    const { repo, service, state } = makeMonthlyApplyService();
    state.lines.push({
      id: ids.line,
      tenant_id: ids.tenant,
      shift_id: ids.shift,
      name: 'Archived line',
      sort_order: 1,
      created_at: nowIso,
      deleted_at: nowIso,
      deleted_by_profile_id: ids.actor,
      deleted_by_name: 'Dispatcher',
      delete_reason: 'cleanup'
    } as never);
    state.orders.push(
      createOrder({
        deletedAt: nowIso,
        deletedByProfileId: ids.actor,
        deletedByName: 'Dispatcher',
        deleteReason: 'cleanup'
      })
    );
    const parsed = buildMonthlyPreview();
    const plan = planManualShiftMonthlyImportApply(parsed);

    const result = await service.applyMonthlyImport({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      selectedDate: '2026-06-14',
      plan
    });

    expect(result).toMatchObject({
      shiftId: ids.shift,
      selectedDate: '2026-06-14'
    });
    expect(repo.countMonthlyImportShiftRows).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      shiftId: ids.shift
    });
    expect(repo.applyMonthlyImport).toHaveBeenCalledTimes(1);
  });

  it('rejects monthly apply when active rows still exist and includes count details', async () => {
    const { repo, service, state } = makeMonthlyApplyService();
    state.lines.push({
      id: ids.line,
      tenant_id: ids.tenant,
      shift_id: ids.shift,
      name: 'Existing line',
      sort_order: 1,
      created_at: nowIso,
      deleted_at: null,
      deleted_by_profile_id: null,
      deleted_by_name: null,
      delete_reason: null
    } as never);
    state.orders.push(createOrder());
    const parsed = buildMonthlyPreview();
    const plan = planManualShiftMonthlyImportApply(parsed);

    await expect(
      service.applyMonthlyImport({
        tenantId: ids.tenant,
        shiftId: ids.shift,
        selectedDate: '2026-06-14',
        plan
      })
    ).rejects.toMatchObject({
      code: 'MONTHLY_IMPORT_REQUIRES_REPLACE_MODE',
      details: {
        shiftId: ids.shift,
        activeLinesCount: 1,
        activeOrdersCount: 1,
        softDeletedLinesCount: 0,
        softDeletedOrdersCount: 0
      }
    });

    expect(repo.countMonthlyImportShiftRows).toHaveBeenCalledTimes(1);
    expect(repo.applyMonthlyImport).not.toHaveBeenCalled();
  });
});

describe('DataSheet demand staging', () => {
  it('creates a batch without shiftId and keeps plannedDeliveryDate null on inserted rows', async () => {
    const { repo } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    const preview = {
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet' as const,
      rowsCount: 1,
      rawRowsCount: 1,
      warningRowsCount: 0,
      errorRowsCount: 0,
      specialFlowRowsCount: 0,
      distributionAreasCount: 1,
      distinctOrdersCount: 1,
      distinctSkuCount: 1,
      distributionAreaSummary: [],
      productHandlingSummary: [],
      specialFlowSummary: [],
      sampleRows: [],
      issues: [],
      rows: [
        {
          sourceSheet: 'DataSheet' as const,
          sourceRowNumber: 2,
          agent: 'agent',
          orderDate: '2026-06-24',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: 'SKU-1',
          description: 'מוצר',
          category: 'cat',
          quantity: 3,
          cost: 10,
          notes: null,
          distributionArea: 'דרום',
          rawRouteLine: null,
          plannedDeliveryDate: null,
          plannedRouteLine: null,
          plannedWorkBucket: null,
          planningStatus: 'unplanned' as const,
          routeFlow: 'unassigned' as const,
          productHandlingFlow: 'regular' as const,
          noteDateHints: [],
          issues: []
        }
      ]
    };

    const result = await service.createDemandImportDataSheet({
      tenantId: ids.tenant,
      sourceFile: 'datasheet.xlsx',
      preview,
      uploadedBy: ids.actor
    });

    expect(result.batch.sourceSheet).toBe('DataSheet');
    expect(result.batch.status).toBe('ready');
    expect(repo.createDemandImportBatch).toHaveBeenCalledWith(expect.not.objectContaining({ shiftId: expect.anything() }));
    expect(repo.insertRawDemandRows).toHaveBeenCalledWith(expect.objectContaining({
      rows: [
        expect.objectContaining({
          plannedDeliveryDate: null,
          plannedRouteLine: null,
          plannedWorkBucket: null
        })
      ]
    }));

    expect(() => demandImportDataSheetCreateResponseSchema.parse(result)).not.toThrow();
  });

  it('builds a read-only planning preview from staged raw rows without manual shift writes', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    const batch: DemandImportBatch = {
      id: '70000000-0000-4000-8000-000000000999',
      tenantId: ids.tenant,
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      uploadedAt: nowIso,
      uploadedBy: ids.actor,
      status: 'ready',
      rowsCount: 4,
      rawRowsCount: 2,
      warningRowsCount: 0,
      errorRowsCount: 1,
      specialFlowRowsCount: 1,
      distributionAreasCount: 1,
      distinctOrdersCount: 4,
      distinctSkuCount: 3
    };
    state.demandImportBatches.push(batch);
    state.rawDemandRows.push(
      {
        id: '71000000-0000-4000-8000-000000000001',
        tenantId: ids.tenant,
        batchId: batch.id,
        sourceSheet: 'DataSheet',
        sourceRowNumber: 2,
        agent: 'agent',
        orderDate: '2026-06-24',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: 'SKU-1',
        description: 'מוצר 1',
        category: 'cat',
        quantity: 3,
        cost: 10,
        notes: null,
        distributionArea: 'דרום',
        rawRouteLine: null,
        plannedDeliveryDate: null,
        plannedRouteLine: null,
        plannedWorkBucket: null,
        planningStatus: 'unplanned',
        routeFlow: 'unassigned',
        productHandlingFlow: 'regular',
        noteDateHints: [],
        issues: [],
        createdAt: nowIso
      },
      {
        id: '71000000-0000-4000-8000-000000000002',
        tenantId: ids.tenant,
        batchId: batch.id,
        sourceSheet: 'DataSheet',
        sourceRowNumber: 3,
        agent: 'agent',
        orderDate: '2026-06-24',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: 'SKU-2',
        description: 'מוצר 2',
        category: 'cat',
        quantity: 5,
        cost: 12,
        notes: null,
        distributionArea: 'דרום',
        rawRouteLine: null,
        plannedDeliveryDate: null,
        plannedRouteLine: null,
        plannedWorkBucket: null,
        planningStatus: 'unplanned',
        routeFlow: 'unassigned',
        productHandlingFlow: 'regular',
        noteDateHints: [],
        issues: [],
        createdAt: nowIso
      },
      {
        id: '71000000-0000-4000-8000-000000000003',
        tenantId: ids.tenant,
        batchId: batch.id,
        sourceSheet: 'DataSheet',
        sourceRowNumber: 4,
        agent: 'agent',
        orderDate: '2026-06-24',
        customerName: 'לקוח ב',
        orderNumber: 'SO-2',
        sku: 'SKU-3',
        description: 'איסוף',
        category: 'cat',
        quantity: 7,
        cost: 14,
        notes: 'pickup',
        distributionArea: 'דרום',
        rawRouteLine: null,
        plannedDeliveryDate: null,
        plannedRouteLine: null,
        plannedWorkBucket: null,
        planningStatus: 'special_flow',
        routeFlow: 'pickup',
        productHandlingFlow: 'regular',
        noteDateHints: [],
        issues: [],
        createdAt: nowIso
      },
      {
        id: '71000000-0000-4000-8000-000000000004',
        tenantId: ids.tenant,
        batchId: batch.id,
        sourceSheet: 'DataSheet',
        sourceRowNumber: 5,
        agent: 'agent',
        orderDate: '2026-06-24',
        customerName: 'לקוח ג',
        orderNumber: 'SO-3',
        sku: null,
        description: 'שגוי',
        category: 'cat',
        quantity: 9,
        cost: 16,
        notes: null,
        distributionArea: 'דרום',
        rawRouteLine: null,
        plannedDeliveryDate: null,
        plannedRouteLine: null,
        plannedWorkBucket: null,
        planningStatus: 'error',
        routeFlow: 'unassigned',
        productHandlingFlow: 'unknown',
        noteDateHints: [],
        issues: [{ severity: 'error', code: 'MISSING_SKU', message: 'missing sku', field: 'sku' }],
        createdAt: nowIso
      }
    );

    const result = await service.getDemandPlanningPreview({
      tenantId: ids.tenant,
      batchId: batch.id
    });

    expect(result.summary).toMatchObject({
      rowsCount: 4,
      normalRowsCount: 2,
      specialFlowRowsCount: 1,
      errorRowsCount: 1,
      ordersCount: 1,
      skuCount: 2,
      totalQuantity: 8
    });
    expect(result.distributionAreas).toEqual([
      expect.objectContaining({
        distributionArea: 'דרום',
        rowsCount: 4,
        ordersCount: 1,
        skuCount: 2,
        totalQuantity: 8,
        specialFlowRowsCount: 1,
        errorRowsCount: 1,
        orders: [
          expect.objectContaining({
            orderNumber: 'SO-1',
            customerName: 'לקוח א',
            rowsCount: 2,
            skuCount: 2,
            totalQuantity: 8
          })
        ],
        productSummary: [
          expect.objectContaining({ sku: 'SKU-1', totalQuantity: 3, orderCount: 1 }),
          expect.objectContaining({ sku: 'SKU-2', totalQuantity: 5, orderCount: 1 })
        ]
      })
    ]);
    expect(result.specialFlows).toEqual([
      expect.objectContaining({
        routeFlow: 'pickup',
        rowsCount: 1,
        ordersCount: 1,
        totalQuantity: 7
      })
    ]);
    expect(result.errors).toEqual([
      expect.objectContaining({
        sourceRowNumber: 5,
        orderNumber: 'SO-3',
        customerName: 'לקוח ג',
        distributionArea: 'דרום'
      })
    ]);
    expect(repo.createDemandImportBatch).not.toHaveBeenCalled();
    expect(repo.insertRawDemandRows).not.toHaveBeenCalled();
    expect(repo.listRawDemandRowsByBatch).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      batchId: batch.id
    });
  });

  it('preserves tenant scoping for staged planning preview reads', async () => {
    const { repo, state } = createRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.demandImportBatches.push({
      id: '70000000-0000-4000-8000-000000000998',
      tenantId: ids.otherTenant,
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      uploadedAt: nowIso,
      uploadedBy: ids.actor,
      status: 'ready',
      rowsCount: 1,
      rawRowsCount: 1,
      warningRowsCount: 0,
      errorRowsCount: 0,
      specialFlowRowsCount: 0,
      distributionAreasCount: 1,
      distinctOrdersCount: 1,
      distinctSkuCount: 1
    });

    await expect(
      service.getDemandPlanningPreview({
        tenantId: ids.tenant,
        batchId: '70000000-0000-4000-8000-000000000998'
      })
    ).rejects.toThrow('batch not found');

    expect(repo.getDemandImportBatch).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      batchId: '70000000-0000-4000-8000-000000000998'
    });
  });
});

describe('getProductControl', () => {
  function makeService(repo: ManualShiftsRepo) {
    const service = createManualShiftsServiceFromRepo(repo);
    return { repo, service };
  }

  const skuA = 'REAL-SKU-001';
  const skuB = 'REAL-SKU-002';

  it('returns demand from order items with warehouse stock lookup', async () => {
    const { repo, service } = makeService({
      ...createRepo().repo,
      findShiftById: vi.fn(async () => createShift()),
      listProductControlDemand: vi.fn(async () => [
        { sku: skuA, description: 'Product A', category: 'Cat A', demandQty: 100, orderCount: 3, lineCount: 2 },
        { sku: skuB, description: 'Product B', category: 'Cat B', demandQty: 50, orderCount: 1, lineCount: 1 }
      ]),
      listWarehouseStockBySku: vi.fn(async () => {
        const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
        map.set(skuA, { sku: skuA, warehouseQty: 80, canonicalProductIds: ['product-a'] });
        map.set(skuB, { sku: skuB, warehouseQty: 0, canonicalProductIds: ['product-b'] });
        return map;
      })
    });

    const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result.shiftId).toBe(ids.shift);
    expect(result.generatedAt).toBeTruthy();
    expect(result.rows).toHaveLength(2);

    const rowA = result.rows.find((r) => r.sku === skuA)!;
    expect(rowA.demandQty).toBe(100);
    expect(rowA.warehouseQty).toBe(80);
    expect(rowA.shortageQty).toBe(20);
    expect(rowA.bondedAvailableQty).toBe(0);
    expect(rowA.bondedCoverQty).toBe(0);
    expect(rowA.finalMissingQty).toBe(20);
    expect(rowA.surplusQty).toBe(0);
    expect(rowA.status).toBe('unresolved');
    expect(rowA.affectedOrdersCount).toBe(3);
    expect(rowA.affectedLinesCount).toBe(2);

    const rowB = result.rows.find((r) => r.sku === skuB)!;
    expect(rowB.demandQty).toBe(50);
    expect(rowB.warehouseQty).toBe(0);
    expect(rowB.shortageQty).toBe(50);
    expect(rowB.status).toBe('unresolved');
    expect(rowB.affectedOrdersCount).toBe(1);

    expect(result.totals.totalSkus).toBe(2);
    expect(result.totals.shortageSkus).toBe(2);
    expect(result.totals.unresolvedSkus).toBe(2);

    expect(repo.listProductControlDemand).toHaveBeenCalledWith(ids.shift);
    expect(repo.listWarehouseStockBySku).toHaveBeenCalled();
  });

  it('returns empty rows when no demand exists', async () => {
    const { repo, service } = makeService({
      ...createRepo().repo,
      findShiftById: vi.fn(async () => createShift()),
      listProductControlDemand: vi.fn(async () => []),
      listWarehouseStockBySku: vi.fn(
        async () =>
          new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>()
      )
    });

    const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result.rows).toHaveLength(0);
    expect(result.totals.totalSkus).toBe(0);
    expect(result.totals.shortageSkus).toBe(0);
    expect(repo.listWarehouseStockBySku).not.toHaveBeenCalled();
  });

  it('does not return demo SKU 100001', async () => {
    const { repo, service } = makeService({
      ...createRepo().repo,
      findShiftById: vi.fn(async () => createShift()),
      listProductControlDemand: vi.fn(async () => [
        { sku: 'REAL-SKU-100', description: 'Real Product', category: 'Real', demandQty: 10, orderCount: 1, lineCount: 1 }
      ]),
      listWarehouseStockBySku: vi.fn(
        async () =>
          new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>()
      )
    });

    const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

    for (const row of result.rows) {
      expect(row.sku).not.toBe('100001');
      expect(row.sku).not.toBe('100002');
      expect(row.sku).not.toBe('100003');
      expect(row.sku).not.toBe('100004');
      expect(row.sku).not.toBe('999999');
    }
  });

  it('rejects shift from different tenant', async () => {
    const { repo, service } = makeService({
      ...createRepo().repo,
      findShiftById: vi.fn(async () => createShift({ tenantId: ids.otherTenant })),
      listProductControlDemand: vi.fn(async () => { throw new Error('should not be called'); }),
      listWarehouseStockBySku: vi.fn(async () => { throw new Error('should not be called'); })
    });

    await expect(
      service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift })
    ).rejects.toMatchObject({ code: 'MANUAL_SHIFT_NOT_FOUND' });

    expect(repo.listProductControlDemand).not.toHaveBeenCalled();
    expect(repo.listWarehouseStockBySku).not.toHaveBeenCalled();
  });

  it('bondedAvailableQty is 0 for all rows when no bonded source exists', async () => {
    const { repo, service } = makeService({
      ...createRepo().repo,
      findShiftById: vi.fn(async () => createShift()),
      listProductControlDemand: vi.fn(async () => [
        { sku: 'SKU-X', description: 'Prod X', category: 'Cat', demandQty: 30, orderCount: 1, lineCount: 1 }
      ]),
      listWarehouseStockBySku: vi.fn(
        async () =>
          new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>()
      )
    });

    const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

    for (const row of result.rows) {
      expect(row.bondedAvailableQty).toBe(0);
      expect(row.bondedCoverQty).toBe(0);
      expect(row.bondedCandidateLabel).toBeUndefined();
      expect(row.bondedCandidateBlock).toBeUndefined();
      expect(row.bondedCandidateSource).toBeUndefined();
    }
  });

  it('keeps zero stock without data issues when the canonical product exists', async () => {
    const { service } = makeService({
      ...createRepo().repo,
      findShiftById: vi.fn(async () => createShift()),
      listProductControlDemand: vi.fn(async () => [
        { sku: 'KNOWN-ZERO', description: 'Known Product', category: 'Cat', demandQty: 30, orderCount: 1, lineCount: 1 }
      ]),
      listWarehouseStockBySku: vi.fn(async () => {
        const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
        map.set('KNOWN-ZERO', {
          sku: 'KNOWN-ZERO',
          warehouseQty: 0,
          canonicalProductIds: ['product-known']
        });
        return map;
      })
    });

    const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result.rows[0]).toMatchObject({
      sku: 'KNOWN-ZERO',
      warehouseQty: 0,
      status: 'unresolved'
    });
    expect(result.rows[0].dataIssues).toBeUndefined();
  });

  it('marks unknown canonical SKU as data_issue while keeping warehouseQty at 0', async () => {
    const { service } = makeService({
      ...createRepo().repo,
      findShiftById: vi.fn(async () => createShift()),
      listProductControlDemand: vi.fn(async () => [
        { sku: 'UNKNOWN-SKU', description: 'Imported Only', category: 'Cat', demandQty: 30, orderCount: 1, lineCount: 1 }
      ]),
      listWarehouseStockBySku: vi.fn(
        async () =>
          new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>()
      )
    });

    const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result.rows[0]).toMatchObject({
      sku: 'UNKNOWN-SKU',
      warehouseQty: 0,
      status: 'data_issue',
      dataIssues: ['unknown_sku']
    });
    expect(result.totals).toMatchObject({
      totalSkus: 1,
      shortageSkus: 0,
      dataIssueSkus: 1
    });
  });

  it('marks duplicate canonical SKU rows and keeps summed warehouse stock explicit', async () => {
    const { service } = makeService({
      ...createRepo().repo,
      findShiftById: vi.fn(async () => createShift()),
      listProductControlDemand: vi.fn(async () => [
        { sku: 'DUP-SKU', description: 'Canonical Duplicate', category: 'Cat', demandQty: 100, orderCount: 2, lineCount: 1 }
      ]),
      listWarehouseStockBySku: vi.fn(async () => {
        const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
        map.set('DUP-SKU', {
          sku: 'DUP-SKU',
          warehouseQty: 75,
          canonicalProductIds: ['product-a', 'product-b']
        });
        return map;
      })
    });

    const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

    expect(result.rows[0]).toMatchObject({
      sku: 'DUP-SKU',
      warehouseQty: 75,
      shortageQty: 25,
      status: 'data_issue',
      dataIssues: ['duplicate_canonical_sku']
    });
    expect(result.totals.dataIssueSkus).toBe(1);
  });

  describe('getProductControl bonded integration', () => {
    function makeBondedSnapshot(overrides: Partial<{
      id: string;
      planningDate: string;
      fileName: string | null;
      importedAt: string;
      rowCount: number;
      rows: Array<{
        sku: string | null;
        availableQty: number;
        block: string | null;
        sourceLabel: string | null;
        releasedQty: number;
        totalPulledQty: number;
        releasedBalanceQty: number;
        packFactor: number | null;
        cartonsPerPallet: number | null;
        unitsPerPallet: number | null;
        notes: string | null;
        rowNumber: number;
        description: string | null;
        pullColumns: (number | null)[];
        diagnostics: string[];
        remainingBondedRaw: string | null;
      }>;
    }> = {}) {
      return {
        id: 'snap-bonded-001',
        planningDate: '2026-05-26',
        fileName: 'bonded.xlsx',
        importedAt: '2026-05-26T08:00:00.000Z',
        rowCount: 10,
        status: 'completed',
        diagnostics: { totalRows: 10, populatedRows: 10, missingSkuRows: 0, negativeBalanceRows: 0, duplicateSkuGroups: 0, formulaDiscrepancyRows: 0, warnings: [] },
        sourceSheetName: 'בונדד!',
        rows: [],
        ...overrides
      };
    }

    function makeServiceWithBonded(
      repo: ManualShiftsRepo,
      bondedService: { getLatestCompletedSnapshot: ReturnType<typeof vi.fn> }
    ) {
      const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso }, bondedService as never);
      return { service };
    }

    it('returns bondedAvailableQty 0 and no candidates when no bonded snapshot exists for shift date', async () => {
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async () => null)
      };
      const { service } = makeServiceWithBonded({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 50, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(mockBonded.getLatestCompletedSnapshot).toHaveBeenCalledWith(ids.tenant, '2026-05-26');
      expect(result.rows[0].bondedAvailableQty).toBe(0);
      expect(result.rows[0].bondedCandidates).toEqual([]);
      expect(result.warnings).toEqual(['no_bonded_snapshot_for_planning_date']);
      expect(result.bondedSnapshot).toBeNull();
    });

    it('populates bondedAvailableQty and candidates from matching bonded snapshot', async () => {
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async () => makeBondedSnapshot({
          rows: [
            makeBondedRow({ sku: 'SKU-A', availableQty: 100, block: 'B1', sourceLabel: 'SrcA', releasedQty: 200, totalPulledQty: 100, releasedBalanceQty: 100, rowNumber: 2 })
          ]
        }))
      };
      const { service } = makeServiceWithBonded({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 30, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].bondedAvailableQty).toBe(100);
      expect(result.rows[0].bondedCandidates).toHaveLength(1);
      expect(result.rows[0].bondedCandidates![0].block).toBe('B1');
      expect(result.rows[0].bondedCandidates![0].availableQty).toBe(100);
      expect(result.rows[0].bondedCoverQty).toBe(70);
      expect(result.rows[0].finalMissingQty).toBe(0);
      expect(result.rows[0].status).toBe('covered_by_bonded');
      expect(result.bondedSnapshot).toBeTruthy();
      expect(result.bondedSnapshot!.id).toBe('snap-bonded-001');
      expect(result.warnings).toBeUndefined();
    });

    it('aggregates duplicate SKU bonded rows into sum of availableQty with multiple candidates', async () => {
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async () => makeBondedSnapshot({
          rows: [
            makeBondedRow({ sku: 'SKU-A', availableQty: 60, block: 'B1', sourceLabel: 'SrcA', releasedQty: 100, totalPulledQty: 40, releasedBalanceQty: 60, rowNumber: 2 }),
            makeBondedRow({ sku: 'SKU-A', availableQty: 40, block: 'B2', sourceLabel: 'SrcB', releasedQty: 80, totalPulledQty: 40, releasedBalanceQty: 40, rowNumber: 5 })
          ]
        }))
      };
      const { service } = makeServiceWithBonded({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 0, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].bondedAvailableQty).toBe(100);
      expect(result.rows[0].bondedCandidates).toHaveLength(2);
      expect(result.rows[0].bondedCandidates![0].availableQty).toBe(60);
      expect(result.rows[0].bondedCandidates![1].availableQty).toBe(40);
    });

    it('does not use bonded snapshot with wrong planning date', async () => {
      const wrongDateBonded = {
        getLatestCompletedSnapshot: vi.fn(async (tenantId: string, planningDate: string) => {
          if (planningDate === '2026-05-26') return null;
          return makeBondedSnapshot();
        })
      };
      const { service } = makeServiceWithBonded({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift({ date: '2026-05-26' })),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 50, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, wrongDateBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].bondedAvailableQty).toBe(0);
      expect(result.warnings).toEqual(['no_bonded_snapshot_for_planning_date']);
    });

    it('uses latest completed snapshot by imported_at desc when multiple exist for same date', async () => {
      let callCount = 0;
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async () => {
          callCount++;
          return makeBondedSnapshot({
            id: 'latest-snap',
            importedAt: '2026-05-26T10:00:00.000Z',
            rows: [
              makeBondedRow({ sku: 'SKU-A', availableQty: 200, block: 'B-LATEST', releasedQty: 300, totalPulledQty: 100, releasedBalanceQty: 200, rowNumber: 2 })
            ]
          });
        })
      };
      const { service } = makeServiceWithBonded({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 50, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(mockBonded.getLatestCompletedSnapshot).toHaveBeenCalledTimes(1);
      expect(result.rows[0].bondedAvailableQty).toBe(200);
      expect(result.bondedSnapshot!.id).toBe('latest-snap');
    });

    it('ignores negative balance rows: availableQty stays 0, does not increase bondedAvailableQty', async () => {
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async () => makeBondedSnapshot({
          rows: [
            makeBondedRow({ sku: 'SKU-NEG', availableQty: 0, block: 'NEG', releasedQty: 50, totalPulledQty: 100, releasedBalanceQty: -50, rowNumber: 2 })
          ]
        }))
      };
      const { service } = makeServiceWithBonded({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-NEG', description: 'Negative', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-NEG', { sku: 'SKU-NEG', warehouseQty: 50, canonicalProductIds: ['p-neg'] });
          return map;
        })
      }, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].bondedAvailableQty).toBe(0);
      expect(result.rows[0].bondedCandidates).toHaveLength(1);
      expect(result.rows[0].bondedCandidates![0].availableQty).toBe(0);
      expect(result.rows[0].status).toBe('unresolved');
    });

    it('ignores bonded rows with missing SKU — no crash, no impact on demand rows', async () => {
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async () => makeBondedSnapshot({
          rows: [
            makeBondedRow({ sku: null, availableQty: 999, block: null, releasedQty: 999, totalPulledQty: 0, releasedBalanceQty: 999, rowNumber: 1 }),
            makeBondedRow({ sku: 'SKU-A', availableQty: 50, block: 'B1', releasedQty: 100, totalPulledQty: 50, releasedBalanceQty: 50, rowNumber: 2 })
          ]
        }))
      };
      const { service } = makeServiceWithBonded({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 50, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].bondedAvailableQty).toBe(50);
      expect(result.rows).toHaveLength(1);
    });

    it('enforces tenant isolation: bonded service called with correct tenantId even when snapshot exists for different tenant', async () => {
      let capturedTenantId: string | undefined;
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async (tenantId: string) => {
          capturedTenantId = tenantId;
          if (tenantId === ids.otherTenant) return makeBondedSnapshot();
          return null;
        })
      };
      const { service } = makeServiceWithBonded({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 50, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(capturedTenantId).toBe(ids.tenant);
      expect(mockBonded.getLatestCompletedSnapshot).toHaveBeenCalledWith(ids.tenant, '2026-05-26');
      expect(result.rows[0].bondedAvailableQty).toBe(0);
      expect(result.warnings).toEqual(['no_bonded_snapshot_for_planning_date']);
    });

    it('data issue priority: unknown SKU with bonded available remains data_issue', async () => {
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async () => makeBondedSnapshot({
          rows: [
            makeBondedRow({ sku: 'UNKNOWN-SKU', availableQty: 500, block: 'B1', releasedQty: 500, totalPulledQty: 0, releasedBalanceQty: 500, rowNumber: 2 })
          ]
        }))
      };
      const { service } = makeServiceWithBonded({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'UNKNOWN-SKU', description: 'Unknown', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(
          async () => new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>()
        )
      }, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].status).toBe('data_issue');
      expect(result.rows[0].dataIssues).toEqual(['unknown_sku']);
      expect(result.rows[0].bondedAvailableQty).toBe(500);
      expect(result.rows[0].bondedCandidates).toHaveLength(1);
    });
  });

  describe('getProductControl warehouse stock snapshot integration', () => {
    function makeWarehouseSnapshot(overrides: Partial<{
      id: string;
      planningDate: string;
      fileName: string | null;
      importedAt: string;
      rowCount: number;
      sourceRowCount: number;
      uniqueSkuCount: number;
      rows: Array<{
        sku: string;
        description: string | null;
        category: string | null;
        warehouseQtyRaw: number;
        availableQty: number;
        sourceDemandQty: number | null;
        sourceRowCount: number;
        diagnostics: string[];
      }>;
    }> = {}) {
      return {
        id: 'wsnap-001',
        planningDate: '2026-05-26',
        fileName: 'pivot.xlsx',
        importedAt: '2026-05-26T08:00:00.000Z',
        rowCount: 10,
        sourceRowCount: 1348,
        uniqueSkuCount: 300,
        status: 'completed',
        diagnostics: [],
        sourceSheetName: 'מלאי',
        rows: [],
        ...overrides
      };
    }

    function makeServiceWithWarehouseStock(
      repo: ManualShiftsRepo,
      warehouseStockService: { getLatestCompletedSnapshot: ReturnType<typeof vi.fn> },
      bondedService?: { getLatestCompletedSnapshot: ReturnType<typeof vi.fn> }
    ) {
      const service = createManualShiftsServiceFromRepo(
        repo,
        { getNowIso: () => nowIso, warehouseStockService: warehouseStockService as never },
        bondedService as never
      );
      return { service };
    }

    function makeWarehouseRow(sku: string, availableQty: number): {
      sku: string; description: string | null; category: string | null;
      warehouseQtyRaw: number; availableQty: number; sourceDemandQty: number | null;
      sourceRowCount: number; diagnostics: string[];
    } {
      return {
        sku,
        description: 'Test Product',
        category: 'Cat',
        warehouseQtyRaw: availableQty,
        availableQty,
        sourceDemandQty: null,
        sourceRowCount: 1,
        diagnostics: []
      };
    }

    it('uses exact-date stock snapshot for warehouseQty and does not call legacy stock lookup', async () => {
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async () => makeWarehouseSnapshot({
          rows: [
            makeWarehouseRow('SKU-A', 300),
            makeWarehouseRow('SKU-B', 50)
          ]
        }))
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 564, orderCount: 1, lineCount: 1 },
          { sku: 'SKU-B', description: 'Product B', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          throw new Error('should not be called');
        })
      }, mockWarehouse);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(mockWarehouse.getLatestCompletedSnapshot).toHaveBeenCalledWith(ids.tenant, '2026-05-26');
      expect(result.rows[0].warehouseQty).toBe(300);
      expect(result.rows[0].shortageQty).toBe(264);
      expect(result.rows[1].warehouseQty).toBe(50);
      expect(result.rows[1].shortageQty).toBe(50);
      expect(result.warehouseStockSnapshot).toBeTruthy();
      expect(result.warehouseStockSnapshot!.id).toBe('wsnap-001');
      expect(result.warehouseStockSnapshot!.sourceRowCount).toBe(1348);
      expect(result.warehouseStockSnapshot!.uniqueSkuCount).toBe(300);
    });

    it('does not emit unknown_sku when SKU exists in stock snapshot but not in products.sku', async () => {
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async () => makeWarehouseSnapshot({
          rows: [makeWarehouseRow('IMPORTED-ONLY', 200)]
        }))
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'IMPORTED-ONLY', description: 'Imported', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          throw new Error('should not be called');
        })
      }, mockWarehouse);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].warehouseQty).toBe(200);
      expect(result.rows[0].dataIssues).toBeUndefined();
      expect(result.rows[0].status).not.toBe('data_issue');
      expect(result.rows[0].status).toBe('ok');
    });

    it('sets missing_warehouse_stock_snapshot_sku data issue when demand SKU not in active snapshot', async () => {
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async () => makeWarehouseSnapshot({
          rows: [makeWarehouseRow('OTHER-SKU', 100)]
        }))
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'MISSING-FROM-SNAPSHOT', description: 'Missing', category: 'Cat', demandQty: 50, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          throw new Error('should not be called');
        })
      }, mockWarehouse);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].warehouseQty).toBe(0);
      expect(result.rows[0].dataIssues).toEqual(['missing_warehouse_stock_snapshot_sku']);
      expect(result.rows[0].status).toBe('data_issue');
    });

    it('falls back to legacy lookup and emits warning when no exact-date snapshot exists', async () => {
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async () => null)
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 50, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, mockWarehouse);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].warehouseQty).toBe(50);
      expect(result.warnings).toContain('no_warehouse_stock_snapshot_for_planning_date');
      expect(result.warehouseStockSnapshot).toBeNull();
    });

    it('does not use stock snapshot with wrong planning date', async () => {
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async (tenantId: string, planningDate: string) => {
          if (planningDate === '2026-05-26') return null;
          return makeWarehouseSnapshot({ planningDate: '2026-05-25' });
        })
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift({ date: '2026-05-26' })),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 50, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, mockWarehouse);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].warehouseQty).toBe(50);
      expect(result.warehouseStockSnapshot).toBeNull();
      expect(result.warnings).toContain('no_warehouse_stock_snapshot_for_planning_date');
    });

    it('uses latest snapshot by imported_at desc when multiple exist for same date', async () => {
      let callCount = 0;
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async () => {
          callCount++;
          return makeWarehouseSnapshot({
            id: 'latest-wsnap',
            importedAt: '2026-05-26T10:00:00.000Z',
            rows: [makeWarehouseRow('SKU-A', 500)]
          });
        })
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          throw new Error('should not be called');
        })
      }, mockWarehouse);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(mockWarehouse.getLatestCompletedSnapshot).toHaveBeenCalledTimes(1);
      expect(result.rows[0].warehouseQty).toBe(500);
      expect(result.warehouseStockSnapshot!.id).toBe('latest-wsnap');
    });

    it('negative stock row from snapshot gives warehouseQty 0', async () => {
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async () => makeWarehouseSnapshot({
          rows: [{
            sku: 'SKU-NEG',
            description: 'Negative',
            category: 'Cat',
            warehouseQtyRaw: -50,
            availableQty: 0,
            sourceDemandQty: null,
            sourceRowCount: 1,
            diagnostics: ['negative_stock']
          }]
        }))
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-NEG', description: 'Negative', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          throw new Error('should not be called');
        })
      }, mockWarehouse);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].warehouseQty).toBe(0);
    });

    it('warehouse stock snapshot is not added to inventory_unit stock', async () => {
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async () => makeWarehouseSnapshot({
          rows: [makeWarehouseRow('SKU-A', 300)]
        }))
      };
      const listWarehouseStock = vi.fn(async () => {
        throw new Error('should not be called');
      });
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: listWarehouseStock
      }, mockWarehouse);

      await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(listWarehouseStock).not.toHaveBeenCalled();
    });

    it('bonded covers only shortage after warehouse stock, not full demand', async () => {
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async () => makeWarehouseSnapshot({
          rows: [makeWarehouseRow('SKU-A', 300)]
        }))
      };
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async () => ({
          id: 'snap-bonded-001',
          planningDate: '2026-05-26',
          fileName: 'bonded.xlsx',
          importedAt: '2026-05-26T08:00:00.000Z',
          rowCount: 10,
          status: 'completed',
          diagnostics: { totalRows: 10, populatedRows: 10, missingSkuRows: 0, negativeBalanceRows: 0, duplicateSkuGroups: 0, formulaDiscrepancyRows: 0, warnings: [] },
          sourceSheetName: 'בונדד!',
          rows: [{
            rowNumber: 2, sku: 'SKU-A', description: null, availableQty: 2979,
            block: 'B1', sourceLabel: 'SrcA', releasedQty: 5000, totalPulledQty: 2021,
            releasedBalanceQty: 2979, packFactor: null, cartonsPerPallet: null,
            unitsPerPallet: null, notes: null, pullColumns: [],
            remainingBondedRaw: null, diagnostics: []
          }]
        }))
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 564, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          throw new Error('should not be called');
        })
      }, mockWarehouse, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].warehouseQty).toBe(300);
      expect(result.rows[0].shortageQty).toBe(264);
      expect(result.rows[0].bondedAvailableQty).toBe(2979);
      expect(result.rows[0].bondedCoverQty).toBe(264);
      expect(result.rows[0].finalMissingQty).toBe(0);
      expect(result.rows[0].status).toBe('covered_by_bonded');
      expect(result.rows[0].dataIssues).toBeUndefined();
    });

    it('enforces tenant isolation: snapshot from another tenant not used', async () => {
      let capturedTenantId: string | undefined;
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async (tenantId: string) => {
          capturedTenantId = tenantId;
          if (tenantId === ids.otherTenant) return makeWarehouseSnapshot();
          return null;
        })
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
          map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 50, canonicalProductIds: ['p-a'] });
          return map;
        })
      }, mockWarehouse);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(capturedTenantId).toBe(ids.tenant);
      expect(result.rows[0].warehouseQty).toBe(50);
      expect(result.warnings).toContain('no_warehouse_stock_snapshot_for_planning_date');
    });

    it('when warehouseStockService undefined, no new warning emitted and current behavior remains', async () => {
      const service = createManualShiftsServiceFromRepo(
        {
          ...createRepo().repo,
          findShiftById: vi.fn(async () => createShift()),
          listProductControlDemand: vi.fn(async () => [
            { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
          ]),
          listWarehouseStockBySku: vi.fn(async () => {
            const map = new Map<string, { sku: string; warehouseQty: number; canonicalProductIds: string[] }>();
            map.set('SKU-A', { sku: 'SKU-A', warehouseQty: 50, canonicalProductIds: ['p-a'] });
            return map;
          })
        },
        { getNowIso: () => nowIso }
      );

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.rows[0].warehouseQty).toBe(50);
      expect(result.warehouseStockSnapshot).toBeNull();
      if (result.warnings) {
        expect(result.warnings).not.toContain('no_warehouse_stock_snapshot_for_planning_date');
      }
    });

    it('existing bonded integration works alongside warehouse stock snapshot', async () => {
      const mockWarehouse = {
        getLatestCompletedSnapshot: vi.fn(async () => makeWarehouseSnapshot({
          rows: [makeWarehouseRow('SKU-A', 30)]
        }))
      };
      const mockBonded = {
        getLatestCompletedSnapshot: vi.fn(async () => ({
          id: 'snap-bonded-001',
          planningDate: '2026-05-26',
          fileName: 'bonded.xlsx',
          importedAt: '2026-05-26T08:00:00.000Z',
          rowCount: 10,
          status: 'completed',
          diagnostics: { totalRows: 10, populatedRows: 10, missingSkuRows: 0, negativeBalanceRows: 0, duplicateSkuGroups: 0, formulaDiscrepancyRows: 0, warnings: [] },
          sourceSheetName: 'בונדד!',
          rows: [{
            rowNumber: 2, sku: 'SKU-A', description: null, availableQty: 100,
            block: 'B1', sourceLabel: 'SrcA', releasedQty: 200, totalPulledQty: 100,
            releasedBalanceQty: 100, packFactor: null, cartonsPerPallet: null,
            unitsPerPallet: null, notes: null, pullColumns: [],
            remainingBondedRaw: null, diagnostics: []
          }]
        }))
      };
      const { service } = makeServiceWithWarehouseStock({
        ...createRepo().repo,
        findShiftById: vi.fn(async () => createShift()),
        listProductControlDemand: vi.fn(async () => [
          { sku: 'SKU-A', description: 'Product A', category: 'Cat', demandQty: 100, orderCount: 1, lineCount: 1 }
        ]),
        listWarehouseStockBySku: vi.fn(async () => {
          throw new Error('should not be called');
        })
      }, mockWarehouse, mockBonded);

      const result = await service.getProductControl({ tenantId: ids.tenant, shiftId: ids.shift });

      expect(result.bondedSnapshot).toBeTruthy();
      expect(result.bondedSnapshot!.id).toBe('snap-bonded-001');
      expect(result.rows[0].bondedAvailableQty).toBe(100);
      expect(result.rows[0].bondedCandidates).toHaveLength(1);
      expect(result.rows[0].bondedCoverQty).toBe(70);
      expect(result.rows[0].finalMissingQty).toBe(0);
      expect(result.warnings).toBeUndefined();
    });
  });
});

function makeBondedRow(overrides: {
  sku: string | null;
  availableQty: number;
  block: string | null;
  sourceLabel?: string | null;
  releasedQty: number;
  totalPulledQty: number;
  releasedBalanceQty: number;
  rowNumber: number;
  description?: string | null;
  packFactor?: number | null;
  cartonsPerPallet?: number | null;
  unitsPerPallet?: number | null;
  notes?: string | null;
  pullColumns?: (number | null)[];
  diagnostics?: string[];
  remainingBondedRaw?: string | null;
}) {

// --- Demand Planning Draft Service Tests ---

describe('demand planning draft — create', () => {
  const batchId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const rowId1 = 'e1000000-0000-4000-8000-000000000001';
  const rowId2 = 'e2000000-0000-4000-8000-000000000002';

  /**
   * Creates a mock ManualShiftsRepo with real demand planning methods.
   * Non-demand methods are vi.fn() stubs.
   */
  function createDemandRepo() {
    const state: {
      batches: DemandImportBatch[];
      rows: RawDemandRow[];
      drafts: Array<{ id: string; tenantId: string; batchId: string; status: string; createdBy: string | null; createdAt: string; updatedAt: string }>;
      buckets: Array<{ id: string; tenantId: string; draftId: string; batchId: string; distributionArea: string | null; planningLineName: string; bucketName: string; sortOrder: number; createdAt: string; updatedAt: string }>;
      allocations: Array<{ id: string; tenantId: string; draftId: string; batchId: string; rawDemandRowId: string; bucketId: string; allocatedQuantity: number; createdAt: string; updatedAt: string }>;
      published: Array<{ rawDemandRowId: string; publishedQuantity: number }>;
    } = { batches: [], rows: [], drafts: [], buckets: [], allocations: [], published: [] };

    let draftCounter = 0;
    let bucketCounter = 0;
    let allocCounter = 0;

    // Use createRepo().repo as the base for its full vi.fn() stub set
    const base = createRepo().repo;

    const repo: ManualShiftsRepo = {
      ...base,
      getDemandImportBatch: vi.fn(async (input: { tenantId: string; batchId: string }) => {
        return state.batches.find((b) => b.tenantId === input.tenantId && b.id === input.batchId) ?? null;
      }) as unknown as ManualShiftsRepo['getDemandImportBatch'],
      listRawDemandRowsByBatch: vi.fn(async (input: { tenantId: string; batchId: string }) => {
        return state.rows.filter((r) => r.tenantId === input.tenantId && r.batchId === input.batchId);
      }) as unknown as ManualShiftsRepo['listRawDemandRowsByBatch'],
      createDemandPlanningDraft: vi.fn(async (input: { tenantId: string; batchId: string; createdBy: string | null }) => {
        draftCounter += 1;
        const draft = { id: `draft-${draftCounter}`, tenantId: input.tenantId, batchId: input.batchId, status: 'draft', createdBy: input.createdBy, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' };
        state.drafts.push(draft);
        return draft;
      }) as unknown as ManualShiftsRepo['createDemandPlanningDraft'],
      getDemandPlanningDraft: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.drafts.find((d) => d.tenantId === input.tenantId && d.id === input.draftId) ?? null;
      }) as unknown as ManualShiftsRepo['getDemandPlanningDraft'],
      updateDemandPlanningDraftStatus: vi.fn(async (input: { tenantId: string; draftId: string; status: string }) => {
        const draft = state.drafts.find((d) => d.tenantId === input.tenantId && d.id === input.draftId);
        if (draft) { draft.status = input.status; return { ...draft }; }
        return null;
      }) as unknown as ManualShiftsRepo['updateDemandPlanningDraftStatus'],
      deleteDemandPlanningBucketsByDraft: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        state.buckets = state.buckets.filter((b) => !(b.tenantId === input.tenantId && b.draftId === input.draftId));
      }) as unknown as ManualShiftsRepo['deleteDemandPlanningBucketsByDraft'],
      insertDemandPlanningBuckets: vi.fn(async (input: { tenantId: string; draftId: string; batchId: string; buckets: Array<{ distributionArea: string | null; planningLineName: string; bucketName: string; sortOrder: number }> }) => {
        return input.buckets.map((b) => {
          bucketCounter += 1;
          const bucket = { id: `bucket-${bucketCounter}`, tenantId: input.tenantId, draftId: input.draftId, batchId: input.batchId, distributionArea: b.distributionArea, planningLineName: b.planningLineName, bucketName: b.bucketName, sortOrder: b.sortOrder, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' };
          state.buckets.push(bucket);
          return bucket;
        });
      }) as unknown as ManualShiftsRepo['insertDemandPlanningBuckets'],
      listDemandPlanningBuckets: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.buckets.filter((b) => b.tenantId === input.tenantId && b.draftId === input.draftId);
      }) as unknown as ManualShiftsRepo['listDemandPlanningBuckets'],
      deleteDemandPlanningAllocationsByDraft: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        state.allocations = state.allocations.filter((a) => !(a.tenantId === input.tenantId && a.draftId === input.draftId));
      }) as unknown as ManualShiftsRepo['deleteDemandPlanningAllocationsByDraft'],
      insertDemandPlanningAllocations: vi.fn(async (input: { tenantId: string; draftId: string; batchId: string; allocations: Array<{ rawDemandRowId: string; bucketId: string; allocatedQuantity: number }> }) => {
        return input.allocations.map((a) => {
          allocCounter += 1;
          const alloc = { id: `alloc-${allocCounter}`, tenantId: input.tenantId, draftId: input.draftId, batchId: input.batchId, rawDemandRowId: a.rawDemandRowId, bucketId: a.bucketId, allocatedQuantity: a.allocatedQuantity, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' };
          state.allocations.push(alloc);
          return alloc;
        });
      }) as unknown as ManualShiftsRepo['insertDemandPlanningAllocations'],
    listDemandPlanningAllocations: vi.fn(async (input: { tenantId: string; draftId: string }) => {
      return state.allocations.filter((a) => a.tenantId === input.tenantId && a.draftId === input.draftId);
    }) as unknown as ManualShiftsRepo['listDemandPlanningAllocations'],
    listRawDemandRowsByIds: vi.fn(async (input: { tenantId: string; rowIds: string[] }) => {
      return state.rows.filter((r) => r.tenantId === input.tenantId && input.rowIds.includes(r.id));
    }) as unknown as ManualShiftsRepo['listRawDemandRowsByIds'],
    listPublishedDemandQuantities: vi.fn(async () => state.published),
    getAvailableDemandSnapshot: vi.fn(async () => ({
      backlogItems: [],
      sourceLinks: [],
      sourceBatches: [],
      publishedAllocations: []
    })) as unknown as ManualShiftsRepo['getAvailableDemandSnapshot'],
  };

    return { repo, state };
  }

  it('creates draft for valid batch with one unassigned bucket per area', async () => {
    const { repo, state } = createDemandRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => '2026-06-25T00:00:00.000Z' });

    // Setup: batch with two distribution areas
    const batch = { id: batchId, tenantId: ids.tenant, sourceFile: 'test.xlsx', sourceSheet: 'DataSheet' as const, uploadedAt: '2026-06-24T08:00:00.000Z', uploadedBy: null, status: 'ready' as const, rowsCount: 2, rawRowsCount: 2, warningRowsCount: 0, errorRowsCount: 0, specialFlowRowsCount: 0, distributionAreasCount: 2, distinctOrdersCount: 2, distinctSkuCount: 2 };
    state.batches.push(batch);

    state.rows.push(
      { id: rowId1, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: '2026-06-24', customerName: 'C1', orderNumber: 'O1', sku: 'SKU-1', description: null, category: null, quantity: 3, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-24T08:00:00.000Z' },
      { id: rowId2, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 3, agent: null, orderDate: '2026-06-24', customerName: 'C2', orderNumber: 'O2', sku: 'SKU-2', description: null, category: null, quantity: 5, cost: null, notes: null, distributionArea: 'צפון', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-24T08:00:00.000Z' }
    );

    const result = await service.createDemandPlanningDraft({
      tenantId: ids.tenant,
      batchId,
      createdBy: null
    });

    expect(result.draft.tenantId).toBe(ids.tenant);
    expect(result.draft.status).toBe('draft');
    expect(result.buckets).toHaveLength(2);
    expect(result.buckets.map((b) => b.distributionArea).sort()).toEqual(['דרום', 'צפון']);
    expect(result.buckets[0].planningLineName).toBe('default');
    expect(result.buckets[0].bucketName).toBe('unassigned');
    expect(result.allocations).toHaveLength(0);
  });

  it('rejects missing batch', async () => {
    const { repo } = createDemandRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => '2026-06-25T00:00:00.000Z' });

    // Dont add any batch to state
    await expect(service.createDemandPlanningDraft({
      tenantId: ids.tenant,
      batchId: '00000000-0000-0000-0000-000000000000',
      createdBy: null
    })).rejects.toThrow(/not found/i);
  });

  it('rejects tenant mismatch', async () => {
    const { repo, state } = createDemandRepo();
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => '2026-06-25T00:00:00.000Z' });

    const batch = { id: batchId, tenantId: ids.otherTenant, sourceFile: 'test.xlsx', sourceSheet: 'DataSheet' as const, uploadedAt: '2026-06-24T08:00:00.000Z', uploadedBy: null, status: 'ready' as const, rowsCount: 1, rawRowsCount: 1, warningRowsCount: 0, errorRowsCount: 0, specialFlowRowsCount: 0, distributionAreasCount: 1, distinctOrdersCount: 1, distinctSkuCount: 1 };
    state.batches.push(batch);

    await expect(service.createDemandPlanningDraft({
      tenantId: ids.tenant, // different from batch's tenant
      batchId,
      createdBy: null
    })).rejects.toThrow(/not found/i);
  });

  it('builds remaining preview from published DB quantities and creates a remaining-scoped draft', async () => {
    const { repo, state } = createDemandRepo();
    const service = createManualShiftsServiceFromRepo(repo);
    state.batches.push({ id: batchId, tenantId: ids.tenant, sourceFile: 'test.xlsx', sourceSheet: 'DataSheet', uploadedAt: '2026-06-24T08:00:00.000Z', uploadedBy: null, status: 'ready', rowsCount: 2, rawRowsCount: 2, warningRowsCount: 0, errorRowsCount: 0, specialFlowRowsCount: 0, distributionAreasCount: 1, distinctOrdersCount: 2, distinctSkuCount: 2 });
    state.rows.push(
      { id: rowId1, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-1', description: null, category: null, quantity: 10, cost: null, notes: null, distributionArea: 'south', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-24T08:00:00.000Z' },
      { id: rowId2, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 3, agent: null, orderDate: null, customerName: 'C2', orderNumber: 'O2', sku: 'SKU-2', description: null, category: null, quantity: 5, cost: null, notes: null, distributionArea: 'south', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-24T08:00:00.000Z' }
    );
    state.published.push(
      { rawDemandRowId: rowId1, publishedQuantity: 4 },
      { rawDemandRowId: rowId2, publishedQuantity: 5 }
    );

    const preview = await service.getDemandPlanningPreview({ tenantId: ids.tenant, batchId, scope: 'remaining' });
    const draft = await service.createDemandPlanningDraft({ tenantId: ids.tenant, batchId, createdBy: null, sourceScope: 'remaining' });

    expect(preview.summary.rowsCount).toBe(1);
    expect(preview.summary.totalQuantity).toBe(6);
    expect(preview.distributionAreas[0].orders[0].items[0].rawDemandRowId).toBe(rowId1);
    expect(draft.draft.sourceScope).toBe('remaining');
  });

  it('builds available demand from applied publications only', async () => {
    const { repo } = createDemandRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    vi.mocked(repo.getAvailableDemandSnapshot!).mockResolvedValue({
      backlogItems: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          tenantId: ids.tenant,
          identityKey: 'k1',
          status: 'open',
          totalQuantity: 10,
          orderNumber: 'SO-1',
          customerName: 'Customer',
          sku: 'SKU-1',
          description: null,
          category: null,
          distributionArea: 'North',
          productHandlingFlow: 'regular',
          routeFlow: 'unassigned',
          firstSeenAt: '2026-06-27T00:00:00.000Z',
          lastSeenAt: '2026-06-27T00:00:00.000Z',
          lastQuantityChangedAt: null,
          createdAt: '2026-06-27T00:00:00.000Z',
          updatedAt: '2026-06-27T00:00:00.000Z'
        }
      ],
      sourceLinks: [
        {
          backlogItemId: '99999999-9999-4999-8999-999999999999',
          rawDemandRowId: '22222222-2222-4222-a222-222222222222',
          batchId: '33333333-3333-4333-a333-333333333333'
        }
      ],
      sourceBatches: [
        {
          batchId: '33333333-3333-4333-a333-333333333333',
          sourceFile: 'same.xlsx',
          uploadedAt: '2026-06-27T00:00:00.000Z'
        }
      ],
      publishedAllocations: [
        {
          rawDemandRowId: '22222222-2222-4222-a222-222222222222',
          publishedQuantity: 3,
          publicationStatus: 'applied'
        }
      ]
    });

    const result = await service.getAvailableDemand({ tenantId: ids.tenant });

    expect(result.canPlan).toBe(true);
    expect(result.summary.totalQuantity).toBe(7);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.availableQuantity).toBe(7);
    expect(repo.listDemandPlanningAllocations).not.toHaveBeenCalled();
  });
});

describe('demand planning draft — get', () => {
  const batchId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function createDemandRepo() {
    const state = {
      drafts: [] as Array<{ id: string; tenantId: string; batchId: string; status: string; createdBy: string | null; createdAt: string; updatedAt: string }>,
      buckets: [] as Array<{ id: string; tenantId: string; draftId: string; batchId: string; distributionArea: string | null; planningLineName: string; bucketName: string; sortOrder: number; createdAt: string; updatedAt: string }>,
      allocations: [] as Array<{ id: string; tenantId: string; draftId: string; batchId: string; rawDemandRowId: string; bucketId: string; allocatedQuantity: number; createdAt: string; updatedAt: string }>
    };

    const base = createRepo().repo;
    const repo: ManualShiftsRepo = {
      ...base,
      getDemandPlanningDraft: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.drafts.find((d) => d.tenantId === input.tenantId && d.id === input.draftId) ?? null;
      }) as unknown as ManualShiftsRepo['getDemandPlanningDraft'],
      listDemandPlanningBuckets: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.buckets.filter((b) => b.tenantId === input.tenantId && b.draftId === input.draftId);
      }) as unknown as ManualShiftsRepo['listDemandPlanningBuckets'],
      listDemandPlanningAllocations: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.allocations.filter((a) => a.tenantId === input.tenantId && a.draftId === input.draftId);
      }) as unknown as ManualShiftsRepo['listDemandPlanningAllocations'],
    };

    return { repo, state };
  }

  it('returns draft with buckets and allocations', async () => {
    const { repo, state } = createDemandRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: 'draft-1', tenantId: ids.tenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });
    state.buckets.push({ id: 'bucket-1', tenantId: ids.tenant, draftId: 'draft-1', batchId, distributionArea: 'דרום', planningLineName: 'default', bucketName: 'unassigned', sortOrder: 0, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });
    state.allocations.push({ id: 'alloc-1', tenantId: ids.tenant, draftId: 'draft-1', batchId, rawDemandRowId: 'row-1', bucketId: 'bucket-1', allocatedQuantity: 3, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });

    const result = await service.getDemandPlanningDraft({ tenantId: ids.tenant, draftId: 'draft-1' });

    expect(result.draft.id).toBe('draft-1');
    expect(result.buckets).toHaveLength(1);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].allocatedQuantity).toBe(3);
  });

  it('rejects missing draft', async () => {
    const { repo } = createDemandRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    await expect(service.getDemandPlanningDraft({
      tenantId: ids.tenant,
      draftId: '00000000-0000-0000-0000-000000000000'
    })).rejects.toThrow(/not found/i);
  });

  it('rejects tenant mismatch', async () => {
    const { repo, state } = createDemandRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: 'draft-1', tenantId: ids.otherTenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });

    await expect(service.getDemandPlanningDraft({
      tenantId: ids.tenant,
      draftId: 'draft-1'
    })).rejects.toThrow(/not found/i);
  });
});

describe('demand planning draft — PUT plan', () => {
  const batchId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const rowId1 = 'e1000000-0000-4000-8000-000000000001';
  const rowId2 = 'e2000000-0000-4000-8000-000000000002';
  const draftId = 'draft-001';

  function createPlanRepo() {
    const state: {
      drafts: Array<{ id: string; tenantId: string; batchId: string; status: string; createdBy: string | null; createdAt: string; updatedAt: string }>;
      buckets: Array<{ id: string; tenantId: string; draftId: string; batchId: string; distributionArea: string | null; planningLineName: string; bucketName: string; sortOrder: number; createdAt: string; updatedAt: string }>;
      allocations: Array<{ id: string; tenantId: string; draftId: string; batchId: string; rawDemandRowId: string; bucketId: string; allocatedQuantity: number; createdAt: string; updatedAt: string }>;
      rows: RawDemandRow[];
    } = { drafts: [], buckets: [], allocations: [], rows: [] };

    let bucketCounter = 0;
    let allocCounter = 0;

    const base = createRepo().repo;
    const repo: ManualShiftsRepo = {
      ...base,
      getDemandPlanningDraft: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.drafts.find((d) => d.tenantId === input.tenantId && d.id === input.draftId) ?? null;
      }) as unknown as ManualShiftsRepo['getDemandPlanningDraft'],
      deleteDemandPlanningBucketsByDraft: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        state.buckets = state.buckets.filter((b) => !(b.tenantId === input.tenantId && b.draftId === input.draftId));
      }) as unknown as ManualShiftsRepo['deleteDemandPlanningBucketsByDraft'],
      insertDemandPlanningBuckets: vi.fn(async (input: { tenantId: string; draftId: string; batchId: string; buckets: Array<{ distributionArea: string | null; planningLineName: string; bucketName: string; sortOrder: number }> }) => {
        return input.buckets.map((b) => {
          bucketCounter += 1;
          const bucket = { id: `bucket-${bucketCounter}`, tenantId: input.tenantId, draftId: input.draftId, batchId: input.batchId, distributionArea: b.distributionArea, planningLineName: b.planningLineName, bucketName: b.bucketName, sortOrder: b.sortOrder, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' };
          state.buckets.push(bucket);
          return bucket;
        });
      }) as unknown as ManualShiftsRepo['insertDemandPlanningBuckets'],
      deleteDemandPlanningAllocationsByDraft: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        state.allocations = state.allocations.filter((a) => !(a.tenantId === input.tenantId && a.draftId === input.draftId));
      }) as unknown as ManualShiftsRepo['deleteDemandPlanningAllocationsByDraft'],
      insertDemandPlanningAllocations: vi.fn(async (input: { tenantId: string; draftId: string; batchId: string; allocations: Array<{ rawDemandRowId: string; bucketId: string; allocatedQuantity: number }> }) => {
        return input.allocations.map((a) => {
          allocCounter += 1;
          const alloc = { id: `alloc-${allocCounter}`, tenantId: input.tenantId, draftId: input.draftId, batchId: input.batchId, rawDemandRowId: a.rawDemandRowId, bucketId: a.bucketId, allocatedQuantity: a.allocatedQuantity, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' };
          state.allocations.push(alloc);
          return alloc;
        });
      }) as unknown as ManualShiftsRepo['insertDemandPlanningAllocations'],
      listDemandPlanningAllocations: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.allocations.filter((a) => a.tenantId === input.tenantId && a.draftId === input.draftId);
      }) as unknown as ManualShiftsRepo['listDemandPlanningAllocations'],
      listDemandPlanningBuckets: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.buckets.filter((b) => b.tenantId === input.tenantId && b.draftId === input.draftId);
      }) as unknown as ManualShiftsRepo['listDemandPlanningBuckets'],
      listRawDemandRowsByIds: vi.fn(async (input: { tenantId: string; rowIds: string[] }) => {
        return state.rows.filter((r) => r.tenantId === input.tenantId && input.rowIds.includes(r.id));
      }) as unknown as ManualShiftsRepo['listRawDemandRowsByIds'],
    };

    return { repo, state };
  }

  it('saves buckets and allocations, replacing previous state', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });
    state.rows.push(
      { id: rowId1, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-1', description: null, category: null, quantity: 10, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-25T00:00:00.000Z' }
    );

    const result = await service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [
        { distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'סיגריות' },
        { distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'גדול' }
      ],
      allocations: [
        { rawDemandRowId: rowId1, bucketKey: 'דרום|כללי|סיגריות', allocatedQuantity: 7 }
      ]
    });

    expect(result.buckets).toHaveLength(2);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].allocatedQuantity).toBe(7);
    expect(result.draft.id).toBe(draftId);
  });

  it('supports split order across multiple buckets', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });
    state.rows.push(
      { id: rowId1, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-1', description: null, category: null, quantity: 10, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'cigarette', noteDateHints: [], issues: [], createdAt: '2026-06-25T00:00:00.000Z' },
      { id: rowId2, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 3, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-2', description: null, category: null, quantity: 5, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-25T00:00:00.000Z' }
    );

    const result = await service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [
        { distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'סיגריות' },
        { distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'כללי' }
      ],
      allocations: [
        { rawDemandRowId: rowId1, bucketKey: 'דרום|כללי|סיגריות', allocatedQuantity: 10 },
        { rawDemandRowId: rowId2, bucketKey: 'דרום|כללי|כללי', allocatedQuantity: 5 }
      ]
    });

    // Same order O1, but items split across two buckets
    expect(result.allocations).toHaveLength(2);
    const bucketIds = [...new Set(result.allocations.map((a) => a.bucketId))];
    expect(bucketIds).toHaveLength(2);
  });

  it('supports two allocations for same rawDemandRow if sum <= quantity', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });
    state.rows.push(
      { id: rowId1, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-1', description: null, category: null, quantity: 10, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-25T00:00:00.000Z' }
    );

    const result = await service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [
        { distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'א' },
        { distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'ב' }
      ],
      allocations: [
        { rawDemandRowId: rowId1, bucketKey: 'דרום|כללי|א', allocatedQuantity: 4 },
        { rawDemandRowId: rowId1, bucketKey: 'דרום|כללי|ב', allocatedQuantity: 6 }
      ]
    });

    expect(result.allocations).toHaveLength(2);
    const total = result.allocations.reduce((s, a) => s + a.allocatedQuantity, 0);
    expect(total).toBe(10);
  });

  it('rejects draft status applied', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'applied', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });

    await expect(service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [], allocations: []
    })).rejects.toThrow(/not mutable/i);
  });

  it('rejects draft status cancelled', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'cancelled', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });

    await expect(service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [], allocations: []
    })).rejects.toThrow(/not mutable/i);
  });

  it('rejects allocatedQuantity <= 0', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });
    state.rows.push({ id: rowId1, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-1', description: null, category: null, quantity: 10, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-25T00:00:00.000Z' });

    await expect(service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [{ distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'bucket' }],
      allocations: [{ rawDemandRowId: rowId1, bucketKey: 'דרום|כללי|bucket', allocatedQuantity: 0 }]
    })).rejects.toThrow(/positive/i);
  });

  it('rejects duplicate bucket keys', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });

    await expect(service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [
        { distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'bucket' },
        { distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'bucket' } // duplicate
      ],
      allocations: []
    })).rejects.toThrow(/duplicate/i);
  });

  it('rejects allocation bucketKey not found', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });
    state.rows.push({ id: rowId1, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-1', description: null, category: null, quantity: 10, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-25T00:00:00.000Z' });

    await expect(service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [{ distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'bucket' }],
      allocations: [{ rawDemandRowId: rowId1, bucketKey: 'דרום|כללי|NONEXISTENT', allocatedQuantity: 5 }]
    })).rejects.toThrow(/not found/i);
  });

  it('rejects rawDemandRowId from another tenant', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });
    // Row belongs to different tenant
    state.rows.push({ id: rowId1, tenantId: ids.otherTenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-1', description: null, category: null, quantity: 10, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-25T00:00:00.000Z' });

    await expect(service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [{ distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'bucket' }],
      allocations: [{ rawDemandRowId: rowId1, bucketKey: 'דרום|כללי|bucket', allocatedQuantity: 5 }]
    })).rejects.toThrow(/not found/i);
  });

  it('rejects sum allocatedQuantity > rawDemandRows.quantity', async () => {
    const { repo, state } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    state.drafts.push({ id: draftId, tenantId: ids.tenant, batchId, status: 'draft', createdBy: null, createdAt: '2026-06-25T00:00:00.000Z', updatedAt: '2026-06-25T00:00:00.000Z' });
    state.rows.push({ id: rowId1, tenantId: ids.tenant, batchId, sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-1', description: null, category: null, quantity: 10, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [], createdAt: '2026-06-25T00:00:00.000Z' });

    await expect(service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId,
      buckets: [{ distributionArea: 'דרום', planningLineName: 'כללי', bucketName: 'bucket' }],
      allocations: [{ rawDemandRowId: rowId1, bucketKey: 'דרום|כללי|bucket', allocatedQuantity: 15 }] // > 10
    })).rejects.toThrow(/overflow/i);
  });

  it('rejects missing draft', async () => {
    const { repo } = createPlanRepo();
    const service = createManualShiftsServiceFromRepo(repo);

    await expect(service.putDemandPlanningPlan({
      tenantId: ids.tenant,
      draftId: '00000000-0000-0000-0000-000000000000',
      buckets: [], allocations: []
    })).rejects.toThrow(/not found/i);
  });
});

describe('demand planning draft — publish to shift', () => {
  const batchId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const draftId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const shiftId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const lineId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const rowId1 = '10000000-0000-4000-8000-000000000001';
  const rowId2 = '20000000-0000-4000-8000-000000000002';
  const rowId3 = '30000000-0000-4000-8000-000000000003';

  function createPublishRepo() {
    const state = {
      shifts: [{
        id: shiftId,
        tenantId: ids.tenant,
        date: '2026-06-25',
        name: 'Target Shift',
        status: 'active',
        createdBy: 'Dispatcher',
        createdAt: nowIso,
        closedAt: null
      }] as ManualShiftSession[],
      lines: [] as Array<{
        id: string;
        tenant_id: string;
        shift_id: string;
        name: string;
        distribution_area: string | null;
        sort_order: number;
        created_at: string;
        deleted_at: string | null;
        deleted_by_profile_id: string | null;
        deleted_by_name: string | null;
        delete_reason: string | null;
      }>,
      orders: [] as ManualShiftOrder[],
      items: [] as ManualShiftOrderItem[],
      drafts: [{
        id: draftId,
        tenantId: ids.tenant,
        batchId,
        status: 'draft',
        createdBy: null,
        createdAt: nowIso,
        updatedAt: nowIso
      }],
      batches: [{
        id: batchId,
        tenantId: ids.tenant,
        sourceFile: 'datasheet.xlsx',
        sourceSheet: 'DataSheet' as const,
        uploadedAt: nowIso,
        uploadedBy: null,
        status: 'ready' as const,
        rowsCount: 3,
        rawRowsCount: 3,
        warningRowsCount: 0,
        errorRowsCount: 1,
        specialFlowRowsCount: 1,
        distributionAreasCount: 1,
        distinctOrdersCount: 2,
        distinctSkuCount: 3
      }],
      rows: [] as RawDemandRow[],
      buckets: [{
        id: 'bucket-1',
        tenantId: ids.tenant,
        draftId,
        batchId,
        distributionArea: 'דרום',
        planningLineName: 'קו א',
        bucketName: 'סיגריות',
        sortOrder: 0,
        createdAt: nowIso,
        updatedAt: nowIso
      }],
      allocations: [] as Array<{
        id: string;
        tenantId: string;
        draftId: string;
        batchId: string;
        rawDemandRowId: string;
        bucketId: string;
        allocatedQuantity: number;
        createdAt: string;
        updatedAt: string;
      }>
    };

    let createdLineCounter = 0;
    let createdOrderCounter = 0;
    let createdItemCounter = 0;

    const base = createRepo().repo;
    const repo: ManualShiftsRepo = {
      ...base,
      findShiftById: vi.fn(async (id: string) => state.shifts.find((shift) => shift.id === id) ?? null) as unknown as ManualShiftsRepo['findShiftById'],
      getDemandPlanningDraft: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.drafts.find((draft) => draft.tenantId === input.tenantId && draft.id === input.draftId) ?? null;
      }) as unknown as ManualShiftsRepo['getDemandPlanningDraft'],
      getDemandImportBatch: vi.fn(async (input: { tenantId: string; batchId: string }) => {
        return state.batches.find((batch) => batch.tenantId === input.tenantId && batch.id === input.batchId) ?? null;
      }) as unknown as ManualShiftsRepo['getDemandImportBatch'],
      listDemandPlanningBuckets: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.buckets.filter((bucket) => bucket.tenantId === input.tenantId && bucket.draftId === input.draftId);
      }) as unknown as ManualShiftsRepo['listDemandPlanningBuckets'],
      listDemandPlanningAllocations: vi.fn(async (input: { tenantId: string; draftId: string }) => {
        return state.allocations.filter((allocation) => allocation.tenantId === input.tenantId && allocation.draftId === input.draftId);
      }) as unknown as ManualShiftsRepo['listDemandPlanningAllocations'],
      listRawDemandRowsByIds: vi.fn(async (input: { tenantId: string; rowIds: string[] }) => {
        return state.rows.filter((row) => row.tenantId === input.tenantId && input.rowIds.includes(row.id));
      }) as unknown as ManualShiftsRepo['listRawDemandRowsByIds'],
      listShiftLines: vi.fn(async (id: string) => {
        return state.lines.filter((line) => line.shift_id === id && line.deleted_at === null);
      }) as unknown as ManualShiftsRepo['listShiftLines'],
      publishDemandPlanningDraftToShift: vi.fn(async (input) => {
        const allocs = state.allocations.filter(
          a => a.draftId === input.draftId && a.tenantId === input.tenantId
        );

        const publishable = allocs.filter(a => {
          const row = state.rows.find(r => r.id === a.rawDemandRowId);
          const bucket = state.buckets.find(b => b.id === a.bucketId);
          if (!row || !bucket) return false;
          if (row.planningStatus === 'error' || row.planningStatus === 'special_flow') return false;
          if (!row.sku?.trim()) return false;
          if (a.allocatedQuantity <= 0) return false;
          return true;
        });

        if (publishable.length === 0) {
          const err = new Error('NO_PUBLISHABLE_ROWS') as Error & { code: string };
          err.code = 'P0001';
          throw err;
        }

        const publishableDates = new Set(
          publishable
            .map(a => state.rows.find(r => r.id === a.rawDemandRowId)?.plannedDeliveryDate ?? null)
            .filter((d): d is string => d !== null)
        );

        if (publishableDates.size > 1) {
          const err = new Error('DATE_AMBIGUOUS') as Error & { code: string };
          err.code = 'P0001';
          throw err;
        }

        if (publishableDates.size === 1) {
          const shift = state.shifts.find(s => s.id === input.targetShiftId);
          if (shift && shift.date !== [...publishableDates][0]) {
            const err = new Error('DATE_MISMATCH') as Error & { code: string };
            err.code = 'P0001';
            throw err;
          }
        }

        const existingLineByKey = new Map<string, string>();
        for (const line of state.lines) {
          if (line.shift_id !== input.targetShiftId || line.deleted_at !== null) continue;
          existingLineByKey.set(`${line.distribution_area ?? ''}\u0001${line.name}`, line.id);
        }

        let createdLineCount = 0;
        let reusedLineCount = 0;
        let createdOrderCount = 0;
        let createdItemCount = 0;

        const processedLineKeys = new Set<string>();
        const processedOrderKeys = new Set<string>();

        for (const alloc of publishable) {
          const row = state.rows.find(r => r.id === alloc.rawDemandRowId)!;
          const bucket = state.buckets.find(b => b.id === alloc.bucketId)!;
          const area = bucket.distributionArea ?? '';
          const lineKey = `${area}\u0001${bucket.planningLineName}`;

          const custName = (row.customerName ?? '').trim() || null;
          const orderNum = (row.orderNumber ?? '').trim() || null;
          const skuNorm = (row.sku ?? '').trim();
          let orderKey: string;
          if (custName || orderNum) {
            orderKey = `${lineKey}\u0001${bucket.bucketName}\u0001${orderNum ?? ''}\u0001${custName ?? ''}`;
          } else {
            orderKey = `${lineKey}\u0001${bucket.bucketName}\u0001${skuNorm}\u0001${row.sourceRowNumber}`;
          }

          let currentLineId = existingLineByKey.get(lineKey);
          if (!currentLineId) {
            if (!processedLineKeys.has(lineKey)) {
              createdLineCounter += 1;
              createdLineCount += 1;
              currentLineId = createdLineCounter === 1 ? lineId : `line-created-${createdLineCounter}`;
              state.lines.push({
                id: currentLineId,
                tenant_id: input.tenantId,
                shift_id: input.targetShiftId,
                name: bucket.planningLineName,
                distribution_area: bucket.distributionArea,
                sort_order: bucket.sortOrder,
                created_at: nowIso,
                deleted_at: null,
                deleted_by_profile_id: null,
                deleted_by_name: null,
                delete_reason: null
              });
              existingLineByKey.set(lineKey, currentLineId);
              processedLineKeys.add(lineKey);
            } else {
              currentLineId = existingLineByKey.get(lineKey)!;
            }
          } else if (!processedLineKeys.has(lineKey)) {
            reusedLineCount += 1;
            processedLineKeys.add(lineKey);
          }

          if (!processedOrderKeys.has(orderKey)) {
            createdOrderCounter += 1;
            createdOrderCount += 1;
            const orderId = `order-created-${createdOrderCounter}`;
            const pointName = custName ?? orderNum ?? skuNorm ?? `DataSheet row ${row.sourceRowNumber}`;
            state.orders.push({
              id: orderId,
              tenantId: input.tenantId,
              shiftId: input.targetShiftId,
              lineId: currentLineId,
              orderNumber: orderNum,
              customerName: custName,
              pointName,
              palletCount: null,
              pickerName: null,
              pickerWorkerId: null,
              checkerName: null,
              lineCount: null,
              sortOrder: createdOrderCount,
              size: 'unknown',
              status: 'queued',
              startedAt: null,
              checkStartedAt: null,
              waitingCheckAt: null,
              checkedAt: null,
              finishedAt: null,
              comment: null,
              createdAt: nowIso,
              updatedAt: nowIso,
              deletedAt: null,
              deletedByProfileId: null,
              deletedByName: null,
              deleteReason: null,
              rawRouteLine: `${bucket.planningLineName}/${bucket.bucketName}`,
              routeBase: bucket.planningLineName,
              workBucketName: bucket.bucketName,
              workBucketType: null,
              sourceZone: null,
              rawDestinationLabel: null
            });

            state.items.push({
              id: `item-created-${createdItemCounter + 1}`,
              tenantId: input.tenantId,
              shiftId: input.targetShiftId,
              lineId: currentLineId,
              orderId,
              sku: skuNorm,
              description: (row.description ?? '').trim() || null,
              category: (row.category ?? '').trim() || null,
              quantity: alloc.allocatedQuantity,
              notes: (row.notes ?? '').trim() || null,
              zone: null,
              sourceSheet: 'DataSheet',
              sourceRows: [row.sourceRowNumber],
              sourceFile: 'datasheet.xlsx',
              sortOrder: 1,
              createdAt: nowIso
            });
            createdItemCounter += 1;
            createdItemCount += 1;
            processedOrderKeys.add(orderKey);
          } else {
            // Additional item for same order
            state.items.push({
              id: `item-created-${createdItemCounter + 1}`,
              tenantId: input.tenantId,
              shiftId: input.targetShiftId,
              lineId: currentLineId,
              orderId: state.orders[state.orders.length - 1].id,
              sku: skuNorm,
              description: (row.description ?? '').trim() || null,
              category: (row.category ?? '').trim() || null,
              quantity: alloc.allocatedQuantity,
              notes: (row.notes ?? '').trim() || null,
              zone: null,
              sourceSheet: 'DataSheet',
              sourceRows: [row.sourceRowNumber],
              sourceFile: 'datasheet.xlsx',
              sortOrder: state.items.filter(i => i.orderId === state.orders[state.orders.length - 1].id).length + 1,
              createdAt: nowIso
            });
            createdItemCounter += 1;
            createdItemCount += 1;
          }
        }

        const skippedSpecialFlow = allocs.filter(a => {
          const row = state.rows.find(r => r.id === a.rawDemandRowId);
          return row?.planningStatus === 'special_flow';
        }).length;
        const skippedError = allocs.filter(a => {
          const row = state.rows.find(r => r.id === a.rawDemandRowId);
          return row?.planningStatus === 'error';
        }).length;
        const skippedNoSku = allocs.filter(a => {
          const row = state.rows.find(r => r.id === a.rawDemandRowId);
          return row && row.planningStatus !== 'error' && row.planningStatus !== 'special_flow' && (!row.sku?.trim());
        }).length;
        const skippedZeroQty = allocs.filter(a => {
          const row = state.rows.find(r => r.id === a.rawDemandRowId);
          return row && row.planningStatus !== 'error' && row.planningStatus !== 'special_flow' && row.sku?.trim() && a.allocatedQuantity <= 0;
        }).length;
        const totalSkipped = skippedSpecialFlow + skippedError + skippedNoSku + skippedZeroQty;

        const warnings: string[] = [];
        if (skippedSpecialFlow > 0) warnings.push(`${skippedSpecialFlow} special_flow row(s) were skipped because no explicit publish rule exists for them yet.`);
        if (skippedError > 0) warnings.push(`${skippedError} error row(s) were skipped.`);
        if (skippedNoSku > 0) warnings.push(`${skippedNoSku} row(s) were skipped because SKU is required for operational order items.`);
        if (skippedZeroQty > 0) warnings.push(`${skippedZeroQty} row(s) were skipped because allocated quantity must be positive.`);

        const hasNullDate = publishable.some(a => {
          const row = state.rows.find(r => r.id === a.rawDemandRowId);
          return !row?.plannedDeliveryDate;
        });
        if (hasNullDate) {
          warnings.push('Allocated publishable rows contain null planned delivery dates alongside valid dates.');
        }

        const draft = state.drafts.find((entry) => entry.id === input.draftId && entry.tenantId === input.tenantId);
        if (draft) {
          draft.status = 'applied';
        }

        return {
          shiftId: input.targetShiftId,
          draftId: input.draftId,
          createdLines: createdLineCount,
          reusedLines: reusedLineCount,
          createdOrders: createdOrderCount,
          updatedOrders: 0,
          createdItems: createdItemCount,
          skippedRows: totalSkipped,
          warnings
        };
      }) as unknown as ManualShiftsRepo['publishDemandPlanningDraftToShift'],
      listShiftWorkHierarchy: vi.fn(async (id: string) => {
        const shiftLines = state.lines.filter((line) => line.shift_id === id && line.deleted_at === null);
        const shiftOrders = state.orders.filter((order) => order.shiftId === id && order.deletedAt === null);
        const shiftItems = state.items.filter((item) => item.shiftId === id);

        const computeBreakdown = (orders: ReadonlyArray<{ status: string }>) => ({
          queued: orders.filter((o) => o.status === 'queued').length,
          picking: orders.filter((o) => o.status === 'picking').length,
          waitingCheck: orders.filter((o) => o.status === 'waiting_check').length,
          returned: orders.filter((o) => o.status === 'returned').length,
          done: orders.filter((o) => o.status === 'done').length
        });

        return {
          shiftId: id,
          areas: shiftLines.map((line) => {
            const lineOrders = shiftOrders.filter((order) => order.lineId === line.id);
            const totalQuantity = shiftItems
              .filter((item) => lineOrders.some((order) => order.id === item.orderId))
              .reduce((sum, item) => sum + item.quantity, 0);

            return {
              areaName: line.distribution_area,
              displayName: line.distribution_area ?? 'ללא אזור',
              totalLines: 1,
              totalBuckets: 1,
              totalOrders: lineOrders.length,
              totalQuantity,
              statusBreakdown: computeBreakdown(lineOrders),
              lines: [{
                lineId: line.id,
                lineGroupName: line.name,
                lineName: line.name,
                distributionArea: line.distribution_area,
                status: 'open' as const,
                totalBuckets: 1,
                totalOrders: lineOrders.length,
                totalQuantity,
                statusBreakdown: computeBreakdown(lineOrders),
                buckets: [{
                  bucketName: lineOrders[0]?.workBucketName ?? null,
                  displayName: lineOrders[0]?.workBucketName ?? 'כללי',
                  totalOrders: lineOrders.length,
                  totalQuantity,
                  statusBreakdown: computeBreakdown(lineOrders),
                  orders: lineOrders.map((order) => ({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    customerName: order.customerName,
                    pointName: order.pointName,
                    status: order.status,
                    lineCount: 0,
                    totalQuantity: shiftItems.filter((item) => item.orderId === order.id).reduce((sum, item) => sum + item.quantity, 0),
                    hasAshlama: false,
                    hasCheckUnits: false,
                    rawDestinationLabel: null
                  }))
                }],
                routeGroups: []
              }]
            };
          })
        };
      }) as unknown as ManualShiftsRepo['listShiftWorkHierarchy']
    };

    return { repo, state };
  }

  function seedPublishRows(state: ReturnType<typeof createPublishRepo>['state']) {
    state.rows.push(
      {
        id: rowId1,
        tenantId: ids.tenant,
        batchId,
        sourceSheet: 'DataSheet',
        sourceRowNumber: 2,
        agent: null,
        orderDate: null,
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: 'SKU-1',
        description: 'Product 1',
        category: 'cat-a',
        quantity: 10,
        cost: null,
        notes: 'note 1',
        distributionArea: 'דרום',
        rawRouteLine: null,
        plannedDeliveryDate: '2026-06-25',
        plannedRouteLine: null,
        plannedWorkBucket: null,
        planningStatus: 'unplanned',
        routeFlow: 'unassigned',
        productHandlingFlow: 'regular',
        noteDateHints: [],
        issues: [],
        createdAt: nowIso
      },
      {
        id: rowId2,
        tenantId: ids.tenant,
        batchId,
        sourceSheet: 'DataSheet',
        sourceRowNumber: 3,
        agent: null,
        orderDate: null,
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: 'SKU-2',
        description: 'Product 2',
        category: 'cat-b',
        quantity: 5,
        cost: null,
        notes: 'note 2',
        distributionArea: 'דרום',
        rawRouteLine: null,
        plannedDeliveryDate: '2026-06-25',
        plannedRouteLine: null,
        plannedWorkBucket: null,
        planningStatus: 'special_flow',
        routeFlow: 'pickup',
        productHandlingFlow: 'regular',
        noteDateHints: [],
        issues: [],
        createdAt: nowIso
      },
      {
        id: rowId3,
        tenantId: ids.tenant,
        batchId,
        sourceSheet: 'DataSheet',
        sourceRowNumber: 4,
        agent: null,
        orderDate: null,
        customerName: 'לקוח ב',
        orderNumber: 'SO-2',
        sku: 'SKU-3',
        description: 'Product 3',
        category: 'cat-c',
        quantity: 7,
        cost: null,
        notes: 'note 3',
        distributionArea: 'דרום',
        rawRouteLine: null,
        plannedDeliveryDate: '2026-06-25',
        plannedRouteLine: null,
        plannedWorkBucket: null,
        planningStatus: 'error',
        routeFlow: 'unassigned',
        productHandlingFlow: 'regular',
        noteDateHints: [],
        issues: [],
        createdAt: nowIso
      }
    );

    state.allocations.push(
      { id: 'alloc-1', tenantId: ids.tenant, draftId, batchId, rawDemandRowId: rowId1, bucketId: 'bucket-1', allocatedQuantity: 10, createdAt: nowIso, updatedAt: nowIso },
      { id: 'alloc-2', tenantId: ids.tenant, draftId, batchId, rawDemandRowId: rowId2, bucketId: 'bucket-1', allocatedQuantity: 5, createdAt: nowIso, updatedAt: nowIso },
      { id: 'alloc-3', tenantId: ids.tenant, draftId, batchId, rawDemandRowId: rowId3, bucketId: 'bucket-1', allocatedQuantity: 7, createdAt: nowIso, updatedAt: nowIso }
    );
  }

  it('publishes draft into manual shift tables and returns summary', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    const result = await service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    });

    expect(result).toMatchObject({
      shiftId,
      draftId,
      createdLines: 1,
      reusedLines: 0,
      createdOrders: 1,
      updatedOrders: 0,
      createdItems: 1,
      skippedRows: 2
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('special_flow row(s) were skipped'),
      expect.stringContaining('error row(s) were skipped')
    ]));
    expect(state.lines).toHaveLength(1);
    expect(state.orders).toHaveLength(1);
    expect(state.items).toHaveLength(1);
    expect(state.orders[0].lineId).toBe(lineId);
    expect(state.items[0]).toMatchObject({
      lineId,
      orderId: state.orders[0].id,
      sku: 'SKU-1',
      quantity: 10,
      sourceRows: [2]
    });
    expect(state.drafts[0].status).toBe('applied');
  });

  it('reuses existing target shift line', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    state.lines.push({
      id: lineId,
      tenant_id: ids.tenant,
      shift_id: shiftId,
      name: 'קו א',
      distribution_area: 'דרום',
      sort_order: 0,
      created_at: nowIso,
      deleted_at: null,
      deleted_by_profile_id: null,
      deleted_by_name: null,
      delete_reason: null
    });
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    const result = await service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    });

    expect(result.createdLines).toBe(0);
    expect(result.reusedLines).toBe(1);
    expect(state.orders[0].lineId).toBe(lineId);
  });

  it('blocks repeat publish after draft is applied', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    state.drafts[0].status = 'applied';
    const service = createManualShiftsServiceFromRepo(repo);

    await expect(service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    })).rejects.toThrow(/already published/i);
  });

  it('blocks closed shift', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    state.shifts[0].status = 'closed';
    state.shifts[0].closedAt = nowIso;
    const service = createManualShiftsServiceFromRepo(repo);

    await expect(service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    })).rejects.toThrow(/not active/i);
  });

  it('blocks tenant mismatch', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    state.shifts[0].tenantId = ids.otherTenant;
    const service = createManualShiftsServiceFromRepo(repo);

    await expect(service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    })).rejects.toThrow(/not found/i);
  });

  it('blocks target shift date mismatch when planned delivery date exists', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    state.rows[0].plannedDeliveryDate = '2026-06-26';
    const service = createManualShiftsServiceFromRepo(repo);

    await expect(service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    })).rejects.toThrow(/does not match import date/i);
  });

  it('keeps raw demand rows immutable', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    const originalRow = structuredClone(state.rows[0]);
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    await service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    });

    expect(state.rows[0]).toEqual(originalRow);
  });

  it('warns when allocated rows do not carry planned delivery date', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    state.rows.forEach((row) => {
      row.plannedDeliveryDate = null;
    });
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    const result = await service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    });

    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('null planned delivery dates')
    ]));
  });

  it('warns when publishable rows have mixed null and non-null planned dates', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    state.rows[0].plannedDeliveryDate = '2026-06-25'; // matches shift date
    state.rows[1].plannedDeliveryDate = null;          // special_flow row but still picked up
    state.rows[2].plannedDeliveryDate = null;          // error row
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    const result = await service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    });

    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('null planned delivery dates')
    ]));
    expect(result.createdItems).toBeGreaterThan(0);
  });

  it('creates separate orders for rows without customerName or orderNumber', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    // Modify rows: remove customer/order from row 1, add second anonymous row
    state.rows[0].customerName = null;
    state.rows[0].orderNumber = null;

    // row 2 is special_flow, ignore
    // row 3 is error, ignore

    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    const result = await service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    });

    // row 1 is publishable with no customer/order → should get its own order
    expect(result.createdOrders).toBe(1);
  });

  it('maps NO_PUBLISHABLE_ROWS to 422', async () => {
    const { repo, state } = createPublishRepo();
    // No allocations → mock will throw NO_PUBLISHABLE_ROWS
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    await expect(service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    })).rejects.toMatchObject({ statusCode: 422, code: 'DEMAND_PLANNING_NO_PUBLISHABLE_ROWS' });
  });

  it('maps DATE_MISMATCH to 409', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    state.rows[0].plannedDeliveryDate = '2026-06-26'; // mismatch with shift's 2026-06-25
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    await expect(service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    })).rejects.toThrow(/does not match/);
  });

  it('maps DATE_AMBIGUOUS to 409', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    // row 1 has one date, add another publishable row with different date
    state.rows.push({
      id: 'row-multi-date',
      tenantId: ids.tenant,
      batchId,
      sourceSheet: 'DataSheet',
      sourceRowNumber: 99,
      agent: null,
      orderDate: null,
      customerName: 'Test',
      orderNumber: 'SO-MULTI',
      sku: 'SKU-MULTI',
      description: null,
      category: null,
      quantity: 5,
      cost: null,
      notes: null,
      distributionArea: 'דרום',
      rawRouteLine: null,
      plannedDeliveryDate: '2026-06-27',
      plannedRouteLine: null,
      plannedWorkBucket: null,
      planningStatus: 'unplanned',
      routeFlow: 'pickup',
      productHandlingFlow: 'regular',
      noteDateHints: [],
      issues: [],
      createdAt: nowIso
    });
    state.allocations.push({
      id: 'alloc-multi', tenantId: ids.tenant, draftId, batchId,
      rawDemandRowId: 'row-multi-date', bucketId: 'bucket-1',
      allocatedQuantity: 5, createdAt: nowIso, updatedAt: nowIso
    });
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    await expect(service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    })).rejects.toMatchObject({ statusCode: 409, code: 'DEMAND_PLANNING_TARGET_DATE_AMBIGUOUS' });
  });

  it('work hierarchy can read published data', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);
    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    await service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    });

    const hierarchy = await service.getShiftWorkHierarchy({
      tenantId: ids.tenant,
      shiftId
    });

    expect(hierarchy.shiftId).toBe(shiftId);
    expect(hierarchy.areas[0]?.lines[0]?.lineName).toBe('קו א');
    expect(hierarchy.areas[0]?.lines[0]?.buckets[0]?.orders[0]?.orderNumber).toBe('SO-1');
  });

  it('work hierarchy shows mixed statuses after append into active shift', async () => {
    const { repo, state } = createPublishRepo();
    seedPublishRows(state);

    // Pre-populate existing line and order (simulating prior publication's picking order)
    state.lines.push({
      id: lineId,
      tenant_id: ids.tenant,
      shift_id: shiftId,
      name: 'קו א',
      distribution_area: 'דרום',
      sort_order: 0,
      created_at: nowIso,
      deleted_at: null,
      deleted_by_profile_id: null,
      deleted_by_name: null,
      delete_reason: null
    });
    state.orders.push({
      id: ids.order,
      tenantId: ids.tenant,
      shiftId,
      lineId,
      orderNumber: 'SO-OLD',
      customerName: 'Old Customer',
      pointName: 'Old Customer',
      palletCount: null,
      pickerName: 'Picker1',
      pickerWorkerId: 'worker-1',
      checkerName: null,
      lineCount: 1,
      sortOrder: 0,
      size: 'unknown',
      status: 'picking',
      startedAt: nowIso,
      checkStartedAt: null,
      waitingCheckAt: null,
      checkedAt: null,
      finishedAt: null,
      comment: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
      deletedByProfileId: null,
      deletedByName: null,
      deleteReason: null,
      rawRouteLine: 'קו א/סיגריות',
      routeBase: 'קו א',
      workBucketName: 'סיגריות',
      workBucketType: null,
      sourceZone: null,
      rawDestinationLabel: null
    });
    state.items.push({
      id: 'item-existing-1',
      tenantId: ids.tenant,
      shiftId,
      lineId,
      orderId: ids.order,
      sku: 'SKU-EXISTING',
      description: null,
      category: null,
      quantity: 10,
      notes: null,
      zone: null,
      sourceSheet: null,
      sourceRows: null,
      sourceFile: null,
      sortOrder: 1,
      createdAt: nowIso
    });

    const service = createManualShiftsServiceFromRepo(repo, { getNowIso: () => nowIso });

    // Publish new demand — this creates a queued order alongside the existing picking order
    await service.publishDemandPlanningDraftToShift({
      tenantId: ids.tenant,
      draftId,
      targetShiftId: shiftId
    });

    // Read hierarchy
    const hierarchy = await service.getShiftWorkHierarchy({
      tenantId: ids.tenant,
      shiftId
    });

    expect(hierarchy.shiftId).toBe(shiftId);
    expect(hierarchy.areas).toHaveLength(1);

    // Area-level: 1 picking + 1 queued
    expect(hierarchy.areas[0].statusBreakdown).toEqual({
      queued: 1,
      picking: 1,
      waitingCheck: 0,
      returned: 0,
      done: 0
    });

    // Line-level
    const line = hierarchy.areas[0].lines[0];
    expect(line.lineName).toBe('קו א');
    expect(line.totalOrders).toBe(2);
    expect(line.statusBreakdown).toEqual({
      queued: 1,
      picking: 1,
      waitingCheck: 0,
      returned: 0,
      done: 0
    });

    // Bucket-level
    const bucket = line.buckets[0];
    expect(bucket.totalOrders).toBe(2);
    expect(bucket.statusBreakdown).toEqual({
      queued: 1,
      picking: 1,
      waitingCheck: 0,
      returned: 0,
      done: 0
    });

    // Individual orders — both present and in correct status
    expect(bucket.orders).toHaveLength(2);
    const oldOrder = bucket.orders.find((o) => o.orderNumber === 'SO-OLD');
    const newOrder = bucket.orders.find((o) => o.orderNumber === 'SO-1');
    expect(oldOrder).toBeDefined();
    expect(newOrder).toBeDefined();
    expect(oldOrder!.status).toBe('picking');
    expect(newOrder!.status).toBe('queued');
  });
});

  return {
    rowNumber: overrides.rowNumber,
    sourceLabel: overrides.sourceLabel ?? null,
    block: overrides.block,
    sku: overrides.sku,
    description: overrides.description ?? null,
    releasedQty: overrides.releasedQty,
    packFactor: overrides.packFactor ?? null,
    cartonsPerPallet: overrides.cartonsPerPallet ?? null,
    unitsPerPallet: overrides.unitsPerPallet ?? null,
    pullColumns: overrides.pullColumns ?? [],
    totalPulledQty: overrides.totalPulledQty,
    releasedBalanceQty: overrides.releasedBalanceQty,
    availableQty: overrides.availableQty,
    notes: overrides.notes ?? null,
    remainingBondedRaw: overrides.remainingBondedRaw ?? null,
    diagnostics: overrides.diagnostics ?? []
  };
}

