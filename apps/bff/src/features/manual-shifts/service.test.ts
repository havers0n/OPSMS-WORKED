import { describe, expect, it, vi } from 'vitest';
import type {
  ManualShiftLineSummary,
  ManualShiftOrder,
  ManualShiftOrderError,
  ManualShiftSession
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
  actor: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
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
    checkerName: null,
    lineCount: 12,
    size: 'L',
    status: 'queued',
    startedAt: null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: '2026-05-26T05:10:00.000Z',
    updatedAt: '2026-05-26T05:10:00.000Z',
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
        created_at: '2026-05-26T05:05:00.000Z'
      },
      {
        id: ids.lineTwo,
        tenant_id: ids.tenant,
        shift_id: ids.shift,
        name: 'Kav B',
        sort_order: 2,
        created_at: '2026-05-26T05:06:00.000Z'
      }
    ],
    orders: [] as ManualShiftOrder[],
    events: [] as Array<Record<string, unknown>>,
    errors: [] as ManualShiftOrderError[]
  };

  let eventCounter = 0;
  let errorCounter = 0;
  let lineCounter = 0;
  let orderCounter = 0;

  const repo: ManualShiftsRepo = {
    findActiveShiftByDate: vi.fn(async (tenantId: string, date: string) => {
      return state.shifts.find((shift) => shift.tenantId === tenantId && shift.date === date && shift.status === 'active') ?? null;
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
      return state.lines.filter((line) => line.shift_id === shiftId) as never;
    }),
    listShiftLineSummaries: vi.fn(async (shiftId: string, tenantId: string) => {
      const lineRows = state.lines.filter(
        (line) => line.shift_id === shiftId && line.tenant_id === tenantId
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
            createdAt: row.created_at
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
        if (order.shiftId !== shiftId) continue;
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
        created_at: nowIso
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
      return line as never;
    }),
    listShiftOrders: vi.fn(async (shiftId: string) => {
      return state.orders.filter((order) => order.shiftId === shiftId);
    }),
    listLineOrders: vi.fn(async (lineId: string) => {
      return state.orders.filter((order) => order.lineId === lineId);
    }),
    findOrderById: vi.fn(async (orderId: string) => {
      return state.orders.find((order) => order.id === orderId) ?? null;
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
      if (patch.checkerName !== undefined) nextOrder.checkerName = patch.checkerName;
      if (patch.lineCount !== undefined) nextOrder.lineCount = patch.lineCount;
      if (patch.size !== undefined) nextOrder.size = patch.size;
      if (patch.comment !== undefined) nextOrder.comment = patch.comment;
      if (patch.status !== undefined) nextOrder.status = patch.status;
      if (patch.startedAt !== undefined) nextOrder.startedAt = patch.startedAt;
      if (patch.waitingCheckAt !== undefined) nextOrder.waitingCheckAt = patch.waitingCheckAt;
      if (patch.checkedAt !== undefined) nextOrder.checkedAt = patch.checkedAt;
      if (patch.finishedAt !== undefined) nextOrder.finishedAt = patch.finishedAt;
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
    listShiftErrors: vi.fn(async (shiftId: string) => {
      return state.errors.filter((error) => error.shiftId === shiftId);
    })
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
});
