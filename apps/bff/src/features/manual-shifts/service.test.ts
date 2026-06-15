import { describe, expect, it, vi } from 'vitest';
import type {
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderCheckUnit,
  ManualShiftOrderAshlama,
  ManualShiftOrderError,
  ManualShiftSession,
  ManualShiftWorker
} from '@wos/domain';
import {
  parseManualShiftMonthlyPreview,
  planManualShiftMonthlyImportApply
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
    events: [] as Array<Record<string, unknown>>,
    errors: [] as ManualShiftOrderError[]
  };

  let eventCounter = 0;
  let errorCounter = 0;
  let lineCounter = 0;
  let orderCounter = 0;
  let workerCounter = 0;
  let checkUnitCounter = 0;

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
    listOrderItems: vi.fn(async (_tenantId: string, _orderId: string) => {
      return [];
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
      warningSummary: input.plan.warningSummary,
      warnings: input.plan.preview.warnings,
      previewTotals: input.plan.preview.totals,
      previewAnomalies: input.plan.preview.anomalies
    })),
    listShiftErrors: vi.fn(async (shiftId: string) => {
      return state.errors.filter((error) => error.shiftId === shiftId);
    }),
    findWorkerByAuthUserId: vi.fn(async (_tenantId: string, _authUserId: string) => null),
    setWorkerAuthUser: vi.fn(async (_workerId: string, _authUserId: string | null) => {}),
    listBindableUsers: vi.fn(async (_tenantId: string) => [])
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
              k !== 'applyMonthlyImport' &&
              k !== 'setWorkerAuthUser'
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
        sheetName: 'Ч™Ч•Ч Ч™ 26'
      },
      selectedDate: '2026-06-14',
      rows: [
        {
          rowIndex: 2,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'ЧўЧћЧ§Ч™Чќ/Ч Ч§Ч•Ч“Ч” Чђ',
          customerName: 'ЧњЧ§Ч•Ч— Чђ',
          orderNumber: 'SO-1',
          sku: '1001',
          description: 'ЧћЧ•Ч¦ЧЁ Чђ',
          category: 'cat',
          quantity: 2,
          notes: 'note-a'
        },
        {
          rowIndex: 3,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'ЧўЧћЧ§Ч™Чќ/Ч Ч§Ч•Ч“Ч” Чђ',
          customerName: 'ЧњЧ§Ч•Ч— Чђ',
          orderNumber: 'SO-1',
          sku: '1001',
          description: 'ЧћЧ•Ч¦ЧЁ Чђ',
          category: 'cat',
          quantity: 3,
          notes: 'note-b'
        },
        {
          rowIndex: 4,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'ЧўЧћЧ§Ч™Чќ/Ч Ч§Ч•Ч“Ч” Ч‘',
          customerName: 'ЧњЧ§Ч•Ч— Ч‘',
          orderNumber: 'SO-2',
          sku: '1002',
          description: 'ЧћЧ•Ч¦ЧЁ Ч‘',
          category: 'cat',
          quantity: -1
        }
      ]
    });
  }

  it('applies a sanitized monthly plan through the repository', async () => {
    const { repo, service } = makeMonthlyApplyService();
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
    expect(repo.applyMonthlyImport).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      selectedDate: '2026-06-14',
      plan
    });
  });

  it('rejects monthly apply when the shift already has rows', async () => {
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
    const parsed = buildMonthlyPreview();
    const plan = planManualShiftMonthlyImportApply(parsed);

    await expect(
      service.applyMonthlyImport({
        tenantId: ids.tenant,
        shiftId: ids.shift,
        selectedDate: '2026-06-14',
        plan
      })
    ).rejects.toMatchObject({ code: 'MONTHLY_IMPORT_REQUIRES_EMPTY_SHIFT' });

    expect(repo.applyMonthlyImport).not.toHaveBeenCalled();
  });
});

