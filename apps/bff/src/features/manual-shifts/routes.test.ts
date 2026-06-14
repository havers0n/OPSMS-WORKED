import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import * as XLSX from 'xlsx';
import type {
  ApplyDailyManualShiftImportResponse,
  BindableUser,
  DailyManualShiftImportPreview,
  ManualShiftBulkAddResult,
  ManualShiftDaySummary,
  ManualShiftLine,
  ManualShiftOrder,
  ManualShiftOrderAshlama,
  ManualShiftOrderCheckUnit,
  ManualShiftOrderError,
  ManualShiftOrderEvent,
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
    sortOrder: null,
    size: 'L',
    status,
    startedAt: status === 'picking' ? '2026-05-26T07:20:00.000Z' : null,
    checkStartedAt: null,
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
    authUserId: null,
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

function createCheckUnit(status: ManualShiftOrderCheckUnit['status'] = 'open'): ManualShiftOrderCheckUnit {
  return {
    id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
    tenantId: ids.tenant,
    shiftId: ids.shift,
    lineId: ids.line,
    orderId: ids.order,
    unitNumber: 1,
    status,
    note: null,
    reason: null,
    checkedAt: status === 'checked' ? '2026-05-26T07:30:00.000Z' : null,
    returnedAt: status === 'returned' ? '2026-05-26T07:30:00.000Z' : null,
    voidedAt: status === 'voided' ? '2026-05-26T07:30:00.000Z' : null,
    createdAt: '2026-05-26T07:00:00.000Z',
    updatedAt: '2026-05-26T07:30:00.000Z'
  };
}

function createEvent() {
  return {
    id: 'e9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
    tenantId: ids.tenant,
    shiftId: ids.shift,
    lineId: ids.line,
    orderId: ids.order,
    eventType: 'created' as const,
    actorName: 'Shift Dispatcher',
    actorProfileId: ids.user,
    fromStatus: null,
    toStatus: null,
    payload: null,
    createdAt: '2026-05-26T07:15:00.000Z'
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
  const ashlama: ManualShiftOrderAshlama = {
    id: 'a9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
    tenantId: ids.tenant,
    shiftId: ids.shift,
    lineId: ids.line,
    orderId: ids.order,
    checkUnitId: createCheckUnit().id,
    source: 'check_unit',
    status: 'open',
    text: 'missing item',
    createdAt: '2026-05-26T07:00:00.000Z',
    updatedAt: '2026-05-26T07:30:00.000Z'
  };
  const applyResponse: ApplyDailyManualShiftImportResponse = {
    shiftId: ids.shift,
    linesCreated: 1,
    ordersCreated: 2
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
    listOrderCheckUnits: vi.fn(async () => [createCheckUnit()]),
    listOrderAshlamot: vi.fn(async () => [ashlama]),
    listOpenShiftAshlamot: vi.fn(async () => []),
    listOrderEvents: vi.fn(async () => [createEvent()]),
    listOrderItems: vi.fn(async () => []),
    createOrderAshlama: vi.fn(async () => ashlama),
    patchOrderAshlamaStatus: vi.fn(async () => ({ ...ashlama, status: 'done' as const })),
    createOrderCheckUnit: vi.fn(async () => createCheckUnit()),
    patchOrderCheckUnit: vi.fn(async () => ({ ...createCheckUnit(), note: 'updated' })),
    transitionOrderCheckUnitStatus: vi.fn(async () => createCheckUnit('checked')),
    createOrder: vi.fn(async () => createOrder('queued')),
    bulkCreateOrders: vi.fn(async () => bulkResult),
    applyDailyImport: vi.fn(async () => applyResponse),
    patchOrder: vi.fn(async () => ({ ...createOrder('queued'), comment: 'Updated' })),
    startOrderCheck: vi.fn(async () => ({ ...createOrder('picking'), checkStartedAt: '2026-05-26T07:25:00.000Z' })),
    deleteOrder: vi.fn(async () => ({ ...createOrder('queued'), deletedAt: '2026-05-26T08:00:00.000Z', deletedByProfileId: ids.user, deletedByName: 'Shift Dispatcher', deleteReason: 'cleanup' })),
    restoreOrder: vi.fn(async () => createOrder('queued')),
    transitionOrderStatus: vi.fn(async () => createOrder('picking')),
    createOrderError: vi.fn(async () => createOrderError()),
    getPeopleSummary: vi.fn(async () => peopleSummary),
    getDaySummary: vi.fn(async () => daySummary),
    listBindableUsers: vi.fn(async () => [] as BindableUser[]),
    ...overrides
  };
}

async function buildTestApp(service: ManualShiftsService, auth: AuthenticatedRequestContext | null = authContext) {
  const app = Fastify({ logger: false });
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 5 * 1024 * 1024
    }
  });

  registerManualShiftsRoutes(app, {
    getAuthContext: async (_request: FastifyRequest, reply: FastifyReply) => {
      if (!auth) {
        await reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Missing bearer token.' });
        return null;
      }
      return auth;
    },
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

function buildWorkbookBuffer(withTargetSheet: boolean): Buffer {
  const workbook = XLSX.utils.book_new();
  if (withTargetSheet) {
    const sheet = XLSX.utils.aoa_to_sheet([
      [null, 'תאריך הפצה', '2.6.26'],
      [],
      [null, 'קו הפצה'],
      [null, 'דרום'],
      [null, 'דרום/סלולר']
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'סכימות');
  } else {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['x']]), 'Other');
  }
  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

function buildRepresentativeWorkbookBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [null, 'תאריך הפצה', '2.6.26'],
    [],
    [null, 'קו הפצה'],
    [null, 'דרום'],
    [null, 'דרום/סלולר'],
    [null, 'דרום/רכב-פז ב\'\'ש מרכז'],
    [null, ''],
    [null, 'חיפה'],
    [null, 'חיפה / לאסט פרייס'],
    [null, 'חיפה/קטגוריה/פנימית']
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'סכימות');
  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

function buildMonthlyPreviewWorkbookBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['תאריך הזמנה', 'שם לקוח', 'הזמנה', "מק''ט", 'תיאור', 'קטגוריה', 'כמות', 'קו הפצה', 'תאריך הפצה', 'הערות', 'איזור הפצה'],
    ['27.5.26', 'לקוח א', 'SO-1', '1001', 'מוצר א', 'cat', 2, 'עמקים/נקודה א', '14.6.26', 'איסוף', 'north'],
    ['27.5.26', 'לקוח ב', 'SO-1', '1001', 'מוצר א', 'cat', '3', 'עמקים/נקודה א', '14.06.26', 'איסוף', 'north'],
    ['27.5.26', 'לקוח fallback', 'תעודה קיימת', '1002', 'מוצר ב', 'cat', -1, 'עמקים', '14.6.26', 'השלמה', 'north'],
    ['27.5.26', 'לקוח ג', 'SO-3', '1003', 'מוצר ג', 'cat', 1, 'קו דרום/נקודה ג', '5.6.26', null, 'south']
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'יוני 26');
  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

function buildMultipartBody(fieldName: string, fileName: string, contentType: string, fileBuffer: Buffer) {
  const boundary = '----wos-manual-shift-boundary';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, fileBuffer, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

function buildMultipartBodies(parts: Array<{ fieldName: string; fileName: string; contentType: string; fileBuffer: Buffer }>) {
  const boundary = '----wos-manual-shift-boundary-multi';
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${part.fieldName}"; filename="${part.fileName}"\r\n` +
      `Content-Type: ${part.contentType}\r\n\r\n`
    ));
    chunks.push(part.fileBuffer);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

function buildMultipartFileWithFields(
  fieldName: string,
  fileName: string,
  contentType: string,
  fileBuffer: Buffer,
  fields: Record<string, string>
) {
  const boundary = '----wos-manual-shift-boundary-fields';
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
      `${value}\r\n`
    ));
  }
  chunks.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  ));
  chunks.push(fileBuffer);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
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

  it('lists order check units', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: `/api/manual-shift-orders/${ids.order}/check-units`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([
      { orderId: ids.order, unitNumber: 1, status: 'open' }
    ]);
    expect(service.listOrderCheckUnits).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      orderId: ids.order
    });

    await app.close();
  });

  it('lists order events', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: `/api/manual-shift-orders/${ids.order}/events`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([
      { orderId: ids.order, eventType: 'created', actorName: 'Shift Dispatcher' }
    ]);
    expect(service.listOrderEvents).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      orderId: ids.order
    });

    await app.close();
  });

  it('creates order check unit', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: `/api/manual-shift-orders/${ids.order}/check-units`,
      payload: { note: 'first pallet', reason: null }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ orderId: ids.order, status: 'open' });
    expect(service.createOrderCheckUnit).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      orderId: ids.order,
      note: 'first pallet',
      reason: null,
      actor: {
        actorProfileId: ids.user,
        actorName: 'Shift Dispatcher'
      }
    });

    await app.close();
  });

  it('transitions order check unit status', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/manual-shift-check-units/f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57/status',
      payload: { status: 'checked', reason: 'ok' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'checked' });
    expect(service.transitionOrderCheckUnitStatus).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      checkUnitId: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      status: 'checked',
      reason: 'ok',
      note: undefined,
      actor: {
        actorProfileId: ids.user,
        actorName: 'Shift Dispatcher'
      }
    });

    await app.close();
  });

  it('rejects returned status transition without reason', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/manual-shift-check-units/f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57/status',
      payload: { status: 'returned' }
    });

    expect(response.statusCode).toBe(400);
    expect(service.transitionOrderCheckUnitStatus).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns open shift ashlamot board', async () => {
    const boardItem = {
      id: 'a9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
      orderId: ids.order,
      orderNumber: '502481',
      pointName: 'ירושלים',
      lineId: ids.line,
      lineName: 'Kav A',
      text: 'פריט חסר',
      source: 'manual' as const,
      checkUnitId: null,
      createdAt: '2026-05-26T07:00:00.000Z'
    };
    const service = createServiceMock({
      listOpenShiftAshlamot: vi.fn(async () => [boardItem])
    });
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: `/api/manual-shifts/${ids.shift}/open-ashlamot`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([
      { id: boardItem.id, orderId: ids.order, lineName: 'Kav A', text: 'פריט חסר', source: 'manual' }
    ]);
    expect(service.listOpenShiftAshlamot).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      shiftId: ids.shift
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

  it('returns preview for representative .xlsx upload', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartBody(
      'file',
      'manual.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildRepresentativeWorkbookBuffer()
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      preview: {
        fileName: 'manual.xlsx',
        sheetName: 'סכימות',
        importDateRaw: '2.6.26',
        importDate: '2026-06-02',
        lineCount: 2,
        orderCount: 4,
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
              },
              {
                pointName: 'רכב-פז ב\'\'ש מרכז',
                rawLabel: 'דרום/רכב-פז ב\'\'ש מרכז',
                sourceRow: 6,
                sortOrder: 2
              }
            ]
          },
          {
            name: 'חיפה',
            rawLabel: 'חיפה',
            sourceRow: 8,
            sortOrder: 2,
            orders: [
              {
                pointName: 'לאסט פרייס',
                rawLabel: 'חיפה / לאסט פרייס',
                sourceRow: 9,
                sortOrder: 1
              },
              {
                pointName: 'קטגוריה/פנימית',
                rawLabel: 'חיפה/קטגוריה/פנימית',
                sourceRow: 10,
                sortOrder: 2
              }
            ]
          }
        ]
      }
    });
    expect(service.createShift).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns MISSING_FILE for missing multipart file', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/preview',
      headers: {
        'content-type': 'multipart/form-data; boundary=----wos-empty'
      },
      payload: '------wos-empty--\r\n'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'MISSING_FILE' });

    await app.close();
  });

  it('returns UNSUPPORTED_FILE_TYPE for non-xlsx upload', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartBody('file', 'manual.csv', 'text/csv', Buffer.from('x,y\n1,2'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });

    await app.close();
  });

  it('returns UNSUPPORTED_FILE_TYPE for unexpected multipart field name', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartBody(
      'not_file',
      'manual.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildWorkbookBuffer(true)
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });

    await app.close();
  });

  it('returns UNSUPPORTED_FILE_TYPE for duplicate uploaded files', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartBodies([
      {
        fieldName: 'file',
        fileName: 'first.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileBuffer: buildWorkbookBuffer(true)
      },
      {
        fieldName: 'file',
        fileName: 'second.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileBuffer: buildWorkbookBuffer(true)
      }
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });

    await app.close();
  });

  it('returns INVALID_WORKBOOK for renamed non-xlsx content', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartBody(
      'file',
      'manual.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      Buffer.from('not a workbook')
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_WORKBOOK' });

    await app.close();
  });

  it('returns FILE_TOO_LARGE for file above 5MB', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 65);
    const multipartPayload = buildMultipartBody(
      'file',
      'manual.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      oversizedBuffer
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'FILE_TOO_LARGE' });

    await app.close();
  });

  it('returns validation error for invalid workbook structure', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartBody(
      'file',
      'manual.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildWorkbookBuffer(false)
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'MISSING_SHEET' });

    await app.close();
  });

  it('returns monthly preview for selected date with metrics and warnings', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartFileWithFields(
      'file',
      'monthly.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildMonthlyPreviewWorkbookBuffer(),
      { selectedDate: '2026-06-14' }
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/monthly-preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      preview: {
        source: {
          fileName: 'monthly.xlsx',
          sheetName: 'יוני 26'
        },
        selectedDate: {
          raw: '14.06.26',
          normalized: '2026-06-14'
        },
        dateSummary: {
          totalRows: 4,
          matchingRows: 3,
          skippedOtherDateRows: 1,
          availableDates: [
            { raw: '5.6.26', normalized: '2026-06-05', rows: 1 },
            { raw: '14.06.26', normalized: '2026-06-14', rows: 3 }
          ]
        },
        totals: {
          lines: 1,
          rawDistributionValues: 2,
          derivedPoints: 2,
          uniqueOrderNumbers: 2,
          orderGroups: 2,
          skuRows: 3,
          aggregatedSkuGroups: 2,
          uniqueSkus: 2,
          totalQuantity: 4
        },
        anomalies: {
          negativeQuantityRows: 1,
          nonSoOrderRows: 1,
          rowsWithoutDistributionSlash: 1,
          pointFallbackRows: 1,
          pickupNoteRows: 2,
          ashlamaNoteRows: 1,
          missingRequiredFields: []
        },
        lines: [
          {
            lineName: 'עמקים',
            points: 2,
            uniqueOrderNumbers: 2,
            orderGroups: 2,
            itemRows: 2,
            uniqueSkus: 2,
            totalQuantity: 4,
            negativeQuantityRows: 1,
            anomalyCount: 7,
            warnings: [
              {
                severity: 'warning',
                code: 'NEGATIVE_QUANTITY_ROWS',
                message: 'Line contains rows with negative quantity values.',
                count: 1
              },
              {
                severity: 'warning',
                code: 'LINE_ANOMALIES',
                message: 'Line contains preview anomalies that require review.',
                count: 3,
                rows: [2, 3, 4]
              }
            ]
          }
        ],
        warnings: [
          {
            severity: 'warning',
            code: 'NEGATIVE_QUANTITY_ROWS',
            message: 'Negative quantity rows are present in the preview and require manual handling later.',
            count: 1
          },
          {
            severity: 'warning',
            code: 'NON_SO_ORDER_ROWS',
            message: 'Order values not starting with SO are present in the preview.',
            count: 1
          },
          {
            severity: 'warning',
            code: 'POINT_FALLBACK_ROWS',
            message: 'Some rows used customer name as the derived point because the distribution value had no slash.',
            count: 1
          }
        ]
      }
    });
    expect(service.applyDailyImport).not.toHaveBeenCalled();
    expect(service.createLine).not.toHaveBeenCalled();
    expect(service.createOrder).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns blocking warning with zero matching groups when selected date is absent', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartFileWithFields(
      'file',
      'monthly.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildMonthlyPreviewWorkbookBuffer(),
      { selectedDate: '2026-06-20' }
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/monthly-preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      preview: {
        selectedDate: {
          raw: null,
          normalized: '2026-06-20'
        },
        dateSummary: {
          matchingRows: 0,
          skippedOtherDateRows: 4
        },
        totals: {
          orderGroups: 0,
          skuRows: 0,
          aggregatedSkuGroups: 0
        },
        warnings: [
          expect.objectContaining({
            severity: 'blocking',
            code: 'SELECTED_DATE_NOT_FOUND'
          })
        ]
      }
    });

    await app.close();
  });

  it('returns INVALID_DATE for missing selected date field on monthly preview', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartBody(
      'file',
      'monthly.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildMonthlyPreviewWorkbookBuffer()
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/monthly-preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_DATE' });

    await app.close();
  });

  it('applies validated import preview into an existing shift', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const preview: DailyManualShiftImportPreview = {
      fileName: 'manual.xlsx',
      sheetName: 'ЧЎЧ›Ч™ЧћЧ•ЧЄ',
      importDateRaw: '2.6.26',
      importDate: '2026-06-02',
      lineCount: 1,
      orderCount: 1,
      lines: [
        {
          name: 'Ч“ЧЁЧ•Чќ',
          rawLabel: 'Ч“ЧЁЧ•Чќ',
          sourceRow: 4,
          sortOrder: 1,
          orders: [
            {
              pointName: 'ЧЎЧњЧ•ЧњЧЁ',
              rawLabel: 'Ч“ЧЁЧ•Чќ/ЧЎЧњЧ•ЧњЧЁ',
              sourceRow: 5,
              sortOrder: 1
            }
          ]
        }
      ]
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/apply',
      payload: {
        shiftId: ids.shift,
        preview
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      shiftId: ids.shift,
      linesCreated: 1,
      ordersCreated: 2
    });
    expect(service.applyDailyImport).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      preview,
      actor: {
        actorProfileId: ids.user,
        actorName: 'Shift Dispatcher'
      }
    });

    await app.close();
  });

  it('rejects tampered import apply payload', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/apply',
      payload: {
        shiftId: ids.shift,
        preview: {
          fileName: 'manual.xlsx',
          sheetName: 'ЧЎЧ›Ч™ЧћЧ•ЧЄ',
          importDateRaw: '2.6.26',
          importDate: '2026-06-02',
          lineCount: 1,
          orderCount: 1,
          lines: [
            {
              name: '',
              rawLabel: 'bad',
              sourceRow: 4,
              sortOrder: 1,
              orders: []
            }
          ]
        }
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(service.applyDailyImport).not.toHaveBeenCalled();

    await app.close();
  });

  it.each([
    ['SHIFT_NOT_FOUND', 404],
    ['SHIFT_NOT_ACTIVE', 409],
    ['SHIFT_DATE_MISMATCH', 409],
    ['SHIFT_NOT_EMPTY', 409]
  ])('propagates apply error %s', async (code, statusCode) => {
    const service = createServiceMock({
      applyDailyImport: vi.fn(async () => {
        throw new ApiError(statusCode, code, code);
      })
    });
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/apply',
      payload: {
        shiftId: ids.shift,
        preview: {
          fileName: 'manual.xlsx',
          sheetName: 'ЧЎЧ›Ч™ЧћЧ•ЧЄ',
          importDateRaw: '2.6.26',
          importDate: '2026-06-02',
          lineCount: 1,
          orderCount: 0,
          lines: []
        }
      }
    });

    expect(response.statusCode).toBe(statusCode);
    expect(response.json()).toMatchObject({ code });

    await app.close();
  });

  describe('worker-bindable-users', () => {
    const bindableUsers: BindableUser[] = [
      { userId: ids.user, displayName: 'Test User', email: 'test@wos.local', boundWorkerId: null },
      { userId: '99999999-9999-4999-8999-999999999999', displayName: 'Bound User', email: 'bound@wos.local', boundWorkerId: ids.worker }
    ];

    it('returns bindable users for current tenant', async () => {
      const service = createServiceMock({ listBindableUsers: vi.fn(async () => bindableUsers) });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: '/api/manual-shifts/worker-bindable-users'
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({ userId: ids.user, boundWorkerId: null });
      expect(body[1].boundWorkerId).toBe(ids.worker);

      await app.close();
    });

    it('returns 401 when unauthenticated', async () => {
      const service = createServiceMock();
      const app = await buildTestApp(service, null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/manual-shifts/worker-bindable-users'
      });

      expect(response.statusCode).toBe(401);

      await app.close();
    });

    it('returns 403 for operator role', async () => {
      const service = createServiceMock();
      const operatorAuth = {
        ...authContext,
        currentTenant: { ...authContext.currentTenant!, role: 'operator' as const }
      };
      const app = await buildTestApp(service, operatorAuth);

      const response = await app.inject({
        method: 'GET',
        url: '/api/manual-shifts/worker-bindable-users'
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });

      await app.close();
    });
  });

  describe('patch worker auth binding', () => {
    it('rejects operator role from PATCH authUserId', async () => {
      const service = createServiceMock();
      const operatorAuth = {
        ...authContext,
        currentTenant: { ...authContext.currentTenant!, role: 'operator' as const }
      };
      const app = await buildTestApp(service, operatorAuth);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/manual-shift-workers/${ids.worker}`,
        payload: { authUserId: ids.user }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });

      await app.close();
    });

    it('allows tenant_admin to PATCH authUserId', async () => {
      const service = createServiceMock({ patchWorker: vi.fn(async () => createWorker()) });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/manual-shift-workers/${ids.worker}`,
        payload: { authUserId: ids.user }
      });

      expect(response.statusCode).toBe(200);

      await app.close();
    });

    it('allows platform_admin to PATCH authUserId', async () => {
      const service = createServiceMock({ patchWorker: vi.fn(async () => createWorker()) });
      const platformAuth = {
        ...authContext,
        currentTenant: { ...authContext.currentTenant!, role: 'platform_admin' as const }
      };
      const app = await buildTestApp(service, platformAuth);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/manual-shift-workers/${ids.worker}`,
        payload: { authUserId: ids.user }
      });

      expect(response.statusCode).toBe(200);

      await app.close();
    });
  });
});
