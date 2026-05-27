import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type {
  ManualShiftBulkAddResult,
  ManualShiftDaySummary,
  ManualShiftLine,
  ManualShiftOrder,
  ManualShiftOrderError,
  ManualShiftPeopleSummary,
  ManualShiftSession,
  ManualShiftTodayResponse,
  ManualShiftWorker
} from '@wos/domain';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { ApiError } from '../../errors.js';
import { registerManualShiftsRoutes } from './routes.js';
import type { ManualShiftsService } from './service.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  user: '22222222-2222-4222-8222-222222222222',
  shift: '33333333-3333-4333-8333-333333333333',
  line: '44444444-4444-4444-8444-444444444444',
  order: '55555555-5555-4555-8555-555555555555',
  worker: '66666666-6666-4666-8666-666666666666'
};

const authContext = {
  accessToken: 'token',
  user: {
    id: ids.user,
    email: 'dispatcher@wos.local'
  },
  displayName: 'Shift Dispatcher',
  memberships: [
    {
      tenantId: ids.tenant,
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'tenant_admin' as const
    }
  ],
  currentTenant: {
    tenantId: ids.tenant,
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }
} as unknown as AuthenticatedRequestContext;

function createSession(status: ManualShiftSession['status']): ManualShiftSession {
  return {
    id: ids.shift,
    tenantId: ids.tenant,
    date: '2026-05-26',
    name: 'Morning Shift',
    status,
    createdBy: 'Shift Dispatcher',
    createdAt: '2026-05-26T07:00:00.000Z',
    closedAt: status === 'closed' ? '2026-05-26T08:00:00.000Z' : null
  };
}

function createLine(): ManualShiftLine {
  return {
    id: ids.line,
    tenantId: ids.tenant,
    shiftId: ids.shift,
    name: 'Kav A',
    sortOrder: 1,
    status: 'open',
    createdAt: '2026-05-26T07:10:00.000Z',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null
  };
}

function createOrder(status: ManualShiftOrder['status']): ManualShiftOrder {
  return {
    id: ids.order,
    tenantId: ids.tenant,
    shiftId: ids.shift,
    lineId: ids.line,
    orderNumber: '502481',
    customerName: null,
    pointName: 'ירושלים',
    palletCount: null,
    pickerName: 'יהודה',
    pickerWorkerId: null,
    checkerName: null,
    lineCount: 12,
    size: 'L',
    status,
    startedAt: status === 'picking' ? '2026-05-26T07:20:00.000Z' : null,
    waitingCheckAt: null,
    checkedAt: null,
    finishedAt: null,
    comment: null,
    createdAt: '2026-05-26T07:15:00.000Z',
    updatedAt: '2026-05-26T07:20:00.000Z',
    deletedAt: null,
    deletedByProfileId: null,
    deletedByName: null,
    deleteReason: null
  };
}

function createWorker(): ManualShiftWorker {
  return {
    id: ids.worker,
    tenantId: ids.tenant,
    shiftId: ids.shift,
    name: 'יהודה',
    role: 'picker',
    active: true,
    sortOrder: 1,
    createdAt: '2026-05-26T07:00:00.000Z',
    updatedAt: '2026-05-26T07:00:00.000Z'
  };
}

function createOrderError(): ManualShiftOrderError {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    tenantId: ids.tenant,
    shiftId: ids.shift,
    lineId: ids.line,
    orderId: ids.order,
    type: 'missing_item',
    comment: 'Missing item',
    createdBy: 'Shift Dispatcher',
    createdAt: '2026-05-26T07:30:00.000Z',
    fixedAt: null
  };
}

function createServiceMock(overrides: Partial<ManualShiftsService> = {}): ManualShiftsService {
  const todayResponse: ManualShiftTodayResponse = {
    shift: null,
    lines: []
  };
  const bulkResult: ManualShiftBulkAddResult = {
    createdCount: 2,
    rows: [
      { raw: '502481', pointName: 'ירושלים', orderNumber: '502481', pickerName: null, lineCount: null, palletCount: null, size: 'unknown' },
      { raw: '502482, יהודה, 12', pointName: 'סופר ספיר', orderNumber: '502482', pickerName: 'יהודה', lineCount: 12, palletCount: null, size: 'L' }
    ],
    skippedRows: []
  };
  const peopleSummary: ManualShiftPeopleSummary = {
    shiftId: ids.shift,
    items: []
  };
  const daySummary: ManualShiftDaySummary = {
    shiftId: ids.shift,
    totalOrders: 0,
    queuedOrders: 0,
    pickingOrders: 0,
    waitingCheckOrders: 0,
    returnedOrders: 0,
    doneOrders: 0,
    errorsCount: 0,
    byErrorType: [],
    byLine: [],
    byPicker: []
  };

  return {
    listShiftWorkers: vi.fn(async () => [createWorker()]),
    createWorker: vi.fn(async () => createWorker()),
    patchWorker: vi.fn(async () => createWorker()),
    deactivateWorker: vi.fn(async () => ({ ...createWorker(), active: false })),
    getTodayShift: vi.fn(async () => todayResponse),
    getShiftByDate: vi.fn(async () => todayResponse),
    createShift: vi.fn(async () => createSession('active')),
    closeShift: vi.fn(async () => createSession('closed')),
    listShiftLines: vi.fn(async () => []),
    createLine: vi.fn(async () => createLine()),
    patchLine: vi.fn(async () => ({ ...createLine(), name: 'Kav A+', sortOrder: 2 })),
    deleteLine: vi.fn(async () => ({ ...createLine(), deletedAt: '2026-05-26T08:00:00.000Z', deletedByProfileId: ids.user, deletedByName: 'Shift Dispatcher', deleteReason: 'cleanup' })),
    restoreLine: vi.fn(async () => createLine()),
    listShiftOrders: vi.fn(async () => []),
    listLineOrders: vi.fn(async () => []),
    createOrder: vi.fn(async () => createOrder('queued')),
    bulkCreateOrders: vi.fn(async () => bulkResult),
    patchOrder: vi.fn(async () => ({ ...createOrder('queued'), comment: 'Updated' })),
    deleteOrder: vi.fn(async () => ({ ...createOrder('queued'), deletedAt: '2026-05-26T08:00:00.000Z', deletedByProfileId: ids.user, deletedByName: 'Shift Dispatcher', deleteReason: 'cleanup' })),
    restoreOrder: vi.fn(async () => createOrder('queued')),
    transitionOrderStatus: vi.fn(async () => createOrder('picking')),
    createOrderError: vi.fn(async () => createOrderError()),
    getPeopleSummary: vi.fn(async () => peopleSummary),
    getDaySummary: vi.fn(async () => daySummary),
    ...overrides
  };
}

async function buildTestApp(service: ManualShiftsService, auth: AuthenticatedRequestContext | null = authContext) {
  const app = Fastify({ logger: false });

  registerManualShiftsRoutes(app, {
    getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => auth,
    getManualShiftsService: () => service,
    getUserSupabase: () => ({} as never)
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ code: 'VALIDATION_ERROR', message: error.message });
    }

    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ code: error.code, message: error.message });
    }

    return reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected test error'
    });
  });

  await app.ready();
  return app;
}

describe('manual shifts routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns today shift response for the current tenant', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/api/manual-shifts/today'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ shift: null, lines: [] });
    expect(service.getTodayShift).toHaveBeenCalledWith(ids.tenant);

    await app.close();
  }, 15000);

  it('creates a shift and forwards actor audit data from auth context', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts',
      payload: {
        name: 'Morning Shift',
        date: '2026-05-26'
      }
    });

    expect(response.statusCode).toBe(201);
    expect(service.createShift).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      date: '2026-05-26',
      name: 'Morning Shift',
      actor: {
        actorProfileId: ids.user,
        actorName: 'Shift Dispatcher'
      }
    });

    await app.close();
  });

  it('bulk-creates manual orders from raw text', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: `/api/manual-shift-lines/${ids.line}/orders/bulk`,
      payload: {
        rawText: '502481\n502482, יהודה, 12'
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      createdCount: 2,
      skippedRows: []
    });
    expect(service.bulkCreateOrders).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      lineId: ids.line,
      rawText: '502481\n502482, יהודה, 12',
      rows: undefined,
      actor: {
        actorProfileId: ids.user,
        actorName: 'Shift Dispatcher'
      }
    });

    await app.close();
  });

  it('returns ApiError status and code for invalid status transitions', async () => {
    const service = createServiceMock({
      transitionOrderStatus: vi.fn(async () => {
        throw new ApiError(
          409,
          'MANUAL_SHIFT_INVALID_STATUS_TRANSITION',
          'Manual shift order transition returned -> done is not allowed.'
        );
      })
    });
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/manual-shift-orders/${ids.order}/status`,
      payload: {
        status: 'done'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'MANUAL_SHIFT_INVALID_STATUS_TRANSITION'
    });

    await app.close();
  });

  it('deletes a manual point and forwards optional actorName/reason', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/manual-shift-orders/${ids.order}/delete`,
      payload: {
        reason: 'Duplicate point',
        actorName: 'Override Actor'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(service.deleteOrder).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      orderId: ids.order,
      reason: 'Duplicate point',
      actor: {
        actorProfileId: ids.user,
        actorName: 'Override Actor'
      }
    });

    await app.close();
  });

  it('restores a manual line and forwards auth actor when actorName is omitted', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/manual-shift-lines/${ids.line}/restore`,
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(service.restoreLine).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      lineId: ids.line,
      reason: undefined,
      actor: {
        actorProfileId: ids.user,
        actorName: 'Shift Dispatcher'
      }
    });

    await app.close();
  });

  it('rejects requests when no tenant context is available', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service, {
      ...authContext,
      currentTenant: null
    } as AuthenticatedRequestContext);

    const response = await app.inject({
      method: 'GET',
      url: '/api/manual-shifts/today'
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'NO_TENANT' });

    await app.close();
  });
});
