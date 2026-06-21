import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import * as XLSX from 'xlsx';
import * as importWorkbookAdapter from './import-adapter.js';
import * as monthlyImportWorkbookAdapter from './monthly-import-adapter.js';
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
  ManualShiftOrderItem,
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
    distributionArea: null,
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
    getOrderDetail: vi.fn(async () => ({
      ...createOrder('queued'),
      lineCount: 2,
      totalQuantity: 32,
      items: [
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
          createdAt: '2026-05-26T07:00:00.000Z'
        } as ManualShiftOrderItem,
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
          createdAt: '2026-05-26T07:01:00.000Z'
        } as ManualShiftOrderItem
      ]
    })),
    createOrderAshlama: vi.fn(async () => ashlama),
    patchOrderAshlamaStatus: vi.fn(async () => ({ ...ashlama, status: 'done' as const })),
    createOrderCheckUnit: vi.fn(async () => createCheckUnit()),
    patchOrderCheckUnit: vi.fn(async () => ({ ...createCheckUnit(), note: 'updated' })),
    transitionOrderCheckUnitStatus: vi.fn(async () => createCheckUnit('checked')),
    createOrder: vi.fn(async () => createOrder('queued')),
    bulkCreateOrders: vi.fn(async () => bulkResult),
    applyDailyImport: vi.fn(async () => applyResponse),
    applyMonthlyImport: vi.fn(async (input: Parameters<ManualShiftsService['applyMonthlyImport']>[0]) => ({
      shiftId: input.shiftId,
      selectedDate: input.selectedDate,
      linesCreated: input.plan.lines.length,
      ordersCreated: input.plan.lines.reduce<number>((sum, line) => sum + line.orders.length, 0),
      orderItemsCreated: input.plan.lines.reduce<number>(
        (sum, line) => sum + line.orders.reduce<number>((orderSum, order) => orderSum + order.items.length, 0),
        0
      ),
      appliedGroups: input.plan.appliedGroups,
      skippedGroups: input.plan.skippedGroups,
      skippedNegativeQuantityRows: input.plan.skippedNegativeQuantityRows,
      skippedZeroQuantityRows: input.plan.skippedZeroQuantityRows,
      appliedTotalQuantity: input.plan.appliedTotalQuantity,
      appliedItemLines: input.plan.appliedItemLines,
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
    patchOrder: vi.fn(async () => ({ ...createOrder('queued'), comment: 'Updated' })),
    startOrderCheck: vi.fn(async () => ({ ...createOrder('picking'), checkStartedAt: '2026-05-26T07:25:00.000Z' })),
    deleteOrder: vi.fn(async () => ({ ...createOrder('queued'), deletedAt: '2026-05-26T08:00:00.000Z', deletedByProfileId: ids.user, deletedByName: 'Shift Dispatcher', deleteReason: 'cleanup' })),
    restoreOrder: vi.fn(async () => createOrder('queued')),
    transitionOrderStatus: vi.fn(async () => createOrder('picking')),
    createOrderError: vi.fn(async () => createOrderError()),
    getPeopleSummary: vi.fn(async () => peopleSummary),
    getDaySummary: vi.fn(async () => daySummary),
    listBindableUsers: vi.fn(async () => [] as BindableUser[]),
    getShiftWorkHierarchy: vi.fn(async () => ({ shiftId: '', areas: [] })),
    getBucketProductRollup: vi.fn(async () => ({
      shiftId: ids.shift,
      lineId: ids.line,
      bucketName: '',
      sourceZone: null,
      products: []
    })),
    getProductControl: vi.fn(async () => ({
      shiftId: ids.shift,
      generatedAt: new Date().toISOString(),
      rows: [],
      totals: {
        totalSkus: 0,
        shortageSkus: 0,
        coveredByBondedSkus: 0,
        partialBondedSkus: 0,
        unresolvedSkus: 0,
        dataIssueSkus: 0
      }
    })),
    ...overrides
  };
}

async function buildTestApp(service: ManualShiftsService, auth: AuthenticatedRequestContext | null = authContext) {
  const app = Fastify({ logger: false });
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 20 * 1024 * 1024
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
    expect(response.json()).toMatchObject({ shift: null, lines: [] });
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

  it('returns shift orders list with lineCount and totalQuantity', async () => {
    const service = createServiceMock({
      listShiftOrders: vi.fn(async () => [
        { ...createOrder('queued'), lineCount: 2, totalQuantity: 32 },
        { ...createOrder('picking'), id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', lineCount: 5, totalQuantity: 0 }
      ] as unknown as ManualShiftOrder[])
    });
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: `/api/manual-shifts/${ids.shift}/orders`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      lineCount: 2,
      totalQuantity: 32
    });
    expect(body[1]).toMatchObject({
      lineCount: 5,
      totalQuantity: 0
    });

    await app.close();
  });

  it('returns line orders list with lineCount and totalQuantity', async () => {
    const service = createServiceMock({
      listLineOrders: vi.fn(async () => [
        { ...createOrder('queued'), lineCount: 1, totalQuantity: 10 }
      ] as unknown as ManualShiftOrder[])
    });
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: `/api/manual-shift-lines/${ids.line}/orders`
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      lineCount: 1,
      totalQuantity: 10
    });

    await app.close();
  });

  it('returns order detail with computed item totals when line_count is null', async () => {
    const service = createServiceMock({
      getOrderDetail: vi.fn(async () => ({
        ...createOrder('queued'),
        lineCount: 2,
        totalQuantity: 32,
        items: [
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
            createdAt: '2026-05-26T07:00:00.000Z'
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
            createdAt: '2026-05-26T07:01:00.000Z'
          }
        ]
      }))
    });
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: `/api/manual-shift-orders/${ids.order}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      orderNumber: '502481',
      lineCount: 2,
      totalQuantity: 32,
      items: [
        expect.objectContaining({ sku: 'SKU-1', quantity: 12 }),
        expect.objectContaining({ sku: 'SKU-2', quantity: 20 })
      ]
    });
    expect(service.getOrderDetail).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      orderId: ids.order
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

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'INVALID_WORKBOOK' });

    await app.close();
  });

  it('returns FILE_TOO_LARGE for file above 20MB', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const oversizedBuffer = Buffer.alloc(20 * 1024 * 1024 + 1, 65);
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

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ code: 'FILE_TOO_LARGE' });

    await app.close();
  });

  it('returns INVALID_WORKBOOK for empty .xlsx upload', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartBody(
      'file',
      'manual.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      Buffer.alloc(0)
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/preview',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'INVALID_WORKBOOK' });

    await app.close();
  });

  it('returns file metadata from debug upload for a valid xlsx file', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const workbookBuffer = buildWorkbookBuffer(true);
    const multipartPayload = buildMultipartBody(
      'file',
      'manual.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      workbookBuffer
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/debug/upload',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      fileName: 'manual.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: workbookBuffer.length
    });

    await app.close();
  });

  it('requires authentication for debug upload', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service, null);
    const workbookBuffer = buildWorkbookBuffer(true);
    const multipartPayload = buildMultipartBody(
      'file',
      'manual.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      workbookBuffer
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/debug/upload',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED' });

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

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'MISSING_SHEET',
      details: {
        expectedSheet: 'סכימות',
        availableSheets: expect.any(Array),
        importKind: 'daily',
        selectedDate: null
      }
    });

    await app.close();
  });

  it('returns JSON 500 when workbook parser throws unexpectedly', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const spy = vi.spyOn(importWorkbookAdapter, 'parseManualShiftImportWorkbook').mockImplementation(() => {
      throw new Error('unexpected workbook crash');
    });
    const multipartPayload = buildMultipartBody(
      'file',
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

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ code: 'INTERNAL_IMPORT_ERROR' });
    expect(spy).toHaveBeenCalledTimes(1);

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
    expect(response.json()).toMatchObject({
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
          pointFallbackRows: 0,
          pickupNoteRows: 2,
          ashlamaNoteRows: 1,
          invalidDistributionDateRows: [],
          missingRequiredFields: []
        },
        lines: [
          {
            lineName: 'עמקים',
            points: 2,
            uniqueOrderNumbers: 2,
            orderGroups: 2,
            itemRows: 3,
            aggregatedSkuGroups: 2,
            uniqueSkus: 2,
            totalQuantity: 4,
            negativeQuantityRows: 1,
            anomalyCount: 5,
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

  it('returns INVALID_DATE for malformed selected date on monthly preview', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartFileWithFields(
      'file',
      'monthly.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildMonthlyPreviewWorkbookBuffer(),
      { selectedDate: 'not-a-date' }
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

  it('returns MISSING_SHEET for monthly preview workbook without the expected sheet', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartFileWithFields(
      'file',
      'monthly.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildWorkbookBuffer(false),
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

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'MISSING_SHEET',
      details: {
        expectedSheet: 'יוני 26',
        availableSheets: expect.any(Array),
        importKind: 'monthly',
        selectedDate: '2026-06-14'
      }
    });

    await app.close();
  });

  it('returns JSON 500 when monthly workbook parser throws unexpectedly', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const spy = vi.spyOn(monthlyImportWorkbookAdapter, 'parseManualShiftMonthlyImportWorkbook').mockImplementation(() => {
      throw new Error('unexpected monthly workbook crash');
    });
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

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ code: 'INTERNAL_IMPORT_ERROR' });
    expect(spy).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('returns INVALID_DATE for missing selected date field on monthly apply', async () => {
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
      url: '/api/manual-shifts/import/monthly-apply',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_DATE' });

    await app.close();
  });

  it('returns MISSING_FILE for missing multipart file on monthly apply', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/monthly-apply',
      headers: {
        'content-type': 'multipart/form-data; boundary=----wos-empty'
      },
      payload: '------wos-empty--\r\n'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'MISSING_FILE' });

    await app.close();
  });

  it('rejects monthly apply when the target shift is not empty', async () => {
    const service = createServiceMock({
      applyMonthlyImport: vi.fn(async () => {
        throw new ApiError(409, 'MONTHLY_IMPORT_REQUIRES_EMPTY_SHIFT', 'Manual shift already has lines or orders.', {
          shiftId: ids.shift,
          activeLinesCount: 1,
          activeOrdersCount: 1,
          softDeletedLinesCount: 2,
          softDeletedOrdersCount: 3
        });
      })
    });
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartFileWithFields(
      'file',
      'monthly.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildMonthlyPreviewWorkbookBuffer(),
      { selectedDate: '2026-06-14', shiftId: ids.shift }
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/monthly-apply',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: 'MONTHLY_IMPORT_REQUIRES_EMPTY_SHIFT',
      details: {
        shiftId: ids.shift,
        activeLinesCount: 1,
        activeOrdersCount: 1,
        softDeletedLinesCount: 2,
        softDeletedOrdersCount: 3
      }
    });
    expect(service.applyMonthlyImport).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('rejects monthly apply when preview has blocking warnings', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartFileWithFields(
      'file',
      'monthly.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildMonthlyPreviewWorkbookBuffer(),
      { selectedDate: '2026-06-20', shiftId: ids.shift }
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/monthly-apply',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'MONTHLY_IMPORT_BLOCKED_BY_WARNINGS' });
    expect(service.applyMonthlyImport).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns JSON 500 when monthly apply service throws unexpectedly', async () => {
    const service = createServiceMock({
      applyMonthlyImport: vi.fn(async () => {
        throw new Error('monthly apply crash');
      })
    });
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartFileWithFields(
      'file',
      'monthly.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildMonthlyPreviewWorkbookBuffer(),
      { selectedDate: '2026-06-14', shiftId: ids.shift }
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/monthly-apply',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ code: 'INTERNAL_IMPORT_ERROR' });
    expect(service.applyMonthlyImport).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('applies sanitized monthly workbook into service with skipped negative groups', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const multipartPayload = buildMultipartFileWithFields(
      'file',
      'monthly.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buildMonthlyPreviewWorkbookBuffer(),
      { selectedDate: '2026-06-14', shiftId: ids.shift }
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/import/monthly-apply',
      headers: {
        'content-type': multipartPayload.contentType
      },
      payload: multipartPayload.body
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      shiftId: ids.shift,
      selectedDate: '2026-06-14',
      linesCreated: 1,
      ordersCreated: 1,
      orderItemsCreated: 1,
      appliedGroups: 1,
      skippedGroups: 1,
      skippedNegativeQuantityRows: 1,
      skippedZeroQuantityRows: 0
    });

    expect(service.applyMonthlyImport).toHaveBeenCalledTimes(1);
    const [call] = vi.mocked(service.applyMonthlyImport).mock.calls;
    expect(call?.[0]).toMatchObject({
      tenantId: ids.tenant,
      shiftId: ids.shift,
      selectedDate: '2026-06-14'
    });
    expect(call?.[0].plan).toMatchObject({
      appliedGroups: 1,
      skippedGroups: 1,
      skippedNegativeQuantityRows: 1,
      skippedZeroQuantityRows: 0
    });
    expect(call?.[0].plan.lines).toHaveLength(1);
    expect(call?.[0].plan.lines[0]).toMatchObject({
      orders: [
        expect.objectContaining({
          orderNumber: 'SO-1',
          totalQuantity: 5,
          items: [
            expect.objectContaining({
              sku: '1001',
              quantity: 5,
              sourceRows: [2, 3]
            })
          ]
        })
      ]
    });

    await app.close();
  });

  it('applies validated import preview into an existing shift', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);
    const preview: DailyManualShiftImportPreview = {
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
      sheetName: 'סכימות',
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
      sheetName: 'סכימות',
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

  describe('work-hierarchy', () => {
    it('returns work hierarchy for a valid shift', async () => {
      const hierarchy = {
        shiftId: ids.shift,
        areas: [
          {
            areaName: 'דרום' as const,
            displayName: 'דרום',
            totalLines: 1,
            totalBuckets: 2,
            totalOrders: 2,
            totalQuantity: 30,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
            lines: [
              {
                lineId: ids.line,
                lineGroupName: 'קו דרום',
                distributionArea: 'דרום',
                status: 'in_progress' as const,
                totalBuckets: 2,
                totalOrders: 2,
                totalQuantity: 30,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
                buckets: [
                  {
                    bucketName: 'סלולר',
                    displayName: 'סלולר',
                    totalOrders: 1,
                    totalQuantity: 10,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: ids.order,
                        orderNumber: 'SO-1',
                        customerName: null,
                        pointName: 'סלולר',
                        status: 'queued' as const,
                        lineCount: 2,
                        totalQuantity: 10,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  },
                  {
                    bucketName: 'פז השקמה',
                    displayName: 'פז השקמה',
                    totalOrders: 1,
                    totalQuantity: 20,
                    statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
                        orderNumber: 'SO-2',
                        customerName: 'לקוח ב',
                        pointName: 'פז השקמה',
                        status: 'waiting_check' as const,
                        lineCount: 5,
                        totalQuantity: 20,
                        hasAshlama: true,
                        hasCheckUnits: true
                      }
                  ]
                }
              ],
              routeGroups: []
            }
          ]
        }
      ]
    };
    const service = createServiceMock({
      getShiftWorkHierarchy: vi.fn(async () => hierarchy)
    });
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: `/api/manual-shifts/${ids.shift}/work-hierarchy`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      shiftId: ids.shift,
      areas: [
        {
          areaName: 'דרום',
          displayName: 'דרום',
          totalLines: 1,
          lines: [
            {
              lineId: ids.line,
              lineGroupName: 'קו דרום',
              distributionArea: 'דרום',
              buckets: [
                { bucketName: 'סלולר', displayName: 'סלולר', totalOrders: 1 },
                { bucketName: 'פז השקמה', displayName: 'פז השקמה', totalOrders: 1 }
              ],
              }
            ]
          }
        ]
      });
      expect(service.getShiftWorkHierarchy).toHaveBeenCalledWith({
        tenantId: ids.tenant,
        shiftId: ids.shift
      });

      await app.close();
    });

    it('handles null area and null bucket gracefully', async () => {
      const hierarchy = {
        shiftId: ids.shift,
        areas: [
          {
            areaName: null,
            displayName: 'ללא איזור',
            totalLines: 1,
            totalBuckets: 1,
            totalOrders: 1,
            totalQuantity: 5,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: [
              {
                lineId: ids.line,
                lineGroupName: 'מרכז',
                distributionArea: null,
                status: 'open' as const,
                totalBuckets: 1,
                totalOrders: 1,
                totalQuantity: 5,
                statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                buckets: [
                  {
                    bucketName: null,
                    displayName: 'קו ראשי',
                    totalOrders: 1,
                    totalQuantity: 5,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: ids.order,
                        orderNumber: null,
                        customerName: null,
                        pointName: null,
                        status: 'queued' as const,
                        lineCount: 1,
                        totalQuantity: 5,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  }
                ],
                routeGroups: []
              }
            ]
          }
        ]
      };
      const service = createServiceMock({
        getShiftWorkHierarchy: vi.fn(async () => hierarchy)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/work-hierarchy`
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.areas[0].areaName).toBeNull();
      expect(body.areas[0].displayName).toBe('ללא איזור');
      expect(body.areas[0].lines[0].buckets[0].bucketName).toBeNull();
      expect(body.areas[0].lines[0].buckets[0].displayName).toBe('קו ראשי');

      await app.close();
    });

    it('includes real lineCount from order items', async () => {
      const hierarchy = {
        shiftId: ids.shift,
        areas: [
          {
            areaName: 'צפון' as const,
            displayName: 'צפון',
            totalLines: 1,
            totalBuckets: 1,
            totalOrders: 2,
            totalQuantity: 110,
            statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: [
              {
                lineId: ids.line,
                lineGroupName: 'גליל',
                distributionArea: 'צפון',
                status: 'open' as const,
                totalBuckets: 1,
                totalOrders: 2,
                totalQuantity: 110,
                statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                buckets: [
                  {
                    bucketName: 'גליל',
                    displayName: 'גליל',
                    totalOrders: 2,
                    totalQuantity: 110,
                    statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
                        orderNumber: 'SO26013614',
                        customerName: 'לקוח א',
                        pointName: 'גליל',
                        status: 'queued' as const,
                        lineCount: 3,
                        totalQuantity: 6,
                        hasAshlama: false,
                        hasCheckUnits: false
                      },
                      {
                        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
                        orderNumber: 'SO26013615',
                        customerName: 'לקוח ב',
                        pointName: 'גליל',
                        status: 'queued' as const,
                        lineCount: 7,
                        totalQuantity: 104,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  }
                ],
                routeGroups: []
              }
            ]
          }
        ]
      };
      const service = createServiceMock({
        getShiftWorkHierarchy: vi.fn(async () => hierarchy)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/work-hierarchy`
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const orders = body.areas[0].lines[0].buckets[0].orders;
      expect(orders[0].lineCount).toBe(3);
      expect(orders[0].totalQuantity).toBe(6);
      expect(orders[1].lineCount).toBe(7);
      expect(orders[1].totalQuantity).toBe(104);

      await app.close();
    });

    it('keeps same orderNumber in multiple buckets as separate fragments', async () => {
      const hierarchy = {
        shiftId: ids.shift,
        areas: [
          {
            areaName: 'צפון' as const,
            displayName: 'צפון',
            totalLines: 1,
            totalBuckets: 3,
            totalOrders: 3,
            totalQuantity: 116,
            statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: [
              {
                lineId: ids.line,
                lineGroupName: 'גליל',
                distributionArea: 'צפון',
                status: 'open' as const,
                totalBuckets: 3,
                totalOrders: 3,
                totalQuantity: 116,
                statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                buckets: [
                  {
                    bucketName: 'גליל',
                    displayName: 'גליל',
                    totalOrders: 1,
                    totalQuantity: 6,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
                        orderNumber: 'SO26013614',
                        customerName: 'לקוח א',
                        pointName: 'גליל',
                        status: 'queued' as const,
                        lineCount: 3,
                        totalQuantity: 6,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  },
                  {
                    bucketName: 'סלולר',
                    displayName: 'סלולר',
                    totalOrders: 1,
                    totalQuantity: 4,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
                        orderNumber: 'SO26013614',
                        customerName: 'לקוח א',
                        pointName: 'סלולר',
                        status: 'queued' as const,
                        lineCount: 1,
                        totalQuantity: 4,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  },
                  {
                    bucketName: 'רכב-פז נהריה',
                    displayName: 'רכב-פז נהריה',
                    totalOrders: 1,
                    totalQuantity: 106,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
                        orderNumber: 'SO26013614',
                        customerName: 'לקוח א',
                        pointName: 'רכב-פז נהריה',
                        status: 'queued' as const,
                        lineCount: 9,
                        totalQuantity: 106,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  }
                ],
                routeGroups: []
              }
            ]
          }
        ]
      };
      const service = createServiceMock({
        getShiftWorkHierarchy: vi.fn(async () => hierarchy)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/work-hierarchy`
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const buckets = body.areas[0].lines[0].buckets;
      expect(buckets).toHaveLength(3);
      expect(buckets[0].orders[0].orderNumber).toBe('SO26013614');
      expect(buckets[1].orders[0].orderNumber).toBe('SO26013614');
      expect(buckets[2].orders[0].orderNumber).toBe('SO26013614');
      expect(buckets[0].orders[0].orderId).not.toBe(buckets[1].orders[0].orderId);
      expect(buckets[1].orders[0].orderId).not.toBe(buckets[2].orders[0].orderId);
      expect(body.areas[0].totalOrders).toBe(3);

      await app.close();
    });

    it('preserves correct totalQuantity per order and bucket', async () => {
      const hierarchy = {
        shiftId: ids.shift,
        areas: [
          {
            areaName: 'צפון' as const,
            displayName: 'צפון',
            totalLines: 1,
            totalBuckets: 2,
            totalOrders: 3,
            totalQuantity: 30,
            statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
            lines: [
              {
                lineId: ids.line,
                lineGroupName: 'שרון',
                distributionArea: 'צפון',
                status: 'open' as const,
                totalBuckets: 2,
                totalOrders: 3,
                totalQuantity: 30,
                statusBreakdown: { queued: 3, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                buckets: [
                  {
                    bucketName: 'נתניה',
                    displayName: 'נתניה',
                    totalOrders: 2,
                    totalQuantity: 18,
                    statusBreakdown: { queued: 2, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
                        orderNumber: 'SO-10',
                        customerName: null,
                        pointName: 'נתניה',
                        status: 'queued' as const,
                        lineCount: 2,
                        totalQuantity: 10,
                        hasAshlama: false,
                        hasCheckUnits: false
                      },
                      {
                        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
                        orderNumber: 'SO-11',
                        customerName: null,
                        pointName: 'נתניה',
                        status: 'queued' as const,
                        lineCount: 1,
                        totalQuantity: 8,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  },
                  {
                    bucketName: 'הרצליה',
                    displayName: 'הרצליה',
                    totalOrders: 1,
                    totalQuantity: 12,
                    statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
                    orders: [
                      {
                        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
                        orderNumber: 'SO-12',
                        customerName: null,
                        pointName: 'הרצליה',
                        status: 'queued' as const,
                        lineCount: 4,
                        totalQuantity: 12,
                        hasAshlama: false,
                        hasCheckUnits: false
                      }
                    ]
                  }
                ],
                routeGroups: []
              }
            ]
          }
        ]
      };
      const service = createServiceMock({
        getShiftWorkHierarchy: vi.fn(async () => hierarchy)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/work-hierarchy`
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const line = body.areas[0].lines[0];
      expect(line.totalQuantity).toBe(30);
      expect(line.buckets[0].totalQuantity).toBe(18);
      expect(line.buckets[1].totalQuantity).toBe(12);
      expect(line.buckets[0].orders[0].lineCount).toBe(2);
      expect(line.buckets[0].orders[0].totalQuantity).toBe(10);

      await app.close();
    });
  });

  describe('bucket-product-rollup', () => {
    it('returns product rollup for a valid shift+line+bucket', async () => {
      const rollup = {
        shiftId: ids.shift,
        lineId: ids.line,
        bucketName: 'סלולר',
        products: [
          { sku: 'SKU-1', description: 'מוצר א', category: 'cat-a', totalQuantity: 24, orderCount: 2 },
          { sku: 'SKU-2', description: 'מוצר ב', category: 'cat-b', totalQuantity: 10, orderCount: 1 }
        ]
      };
      const service = createServiceMock({
        getBucketProductRollup: vi.fn(async () => rollup)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/buckets/product-rollup?lineId=${ids.line}&bucketName=%D7%A1%D7%9C%D7%95%D7%9C%D7%A8`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        shiftId: ids.shift,
        lineId: ids.line,
        bucketName: 'סלולר',
        products: [
          { sku: 'SKU-1', description: 'מוצר א', category: 'cat-a', totalQuantity: 24, orderCount: 2 },
          { sku: 'SKU-2', description: 'מוצר ב', category: 'cat-b', totalQuantity: 10, orderCount: 1 }
        ]
      });
      expect(service.getBucketProductRollup).toHaveBeenCalledWith({
        tenantId: ids.tenant,
        shiftId: ids.shift,
        lineId: ids.line,
        bucketName: 'סלולר'
      });

      await app.close();
    });

    it('returns empty products array for empty bucket', async () => {
      const rollup = {
        shiftId: ids.shift,
        lineId: ids.line,
        bucketName: 'ריק',
        products: []
      };
      const service = createServiceMock({
        getBucketProductRollup: vi.fn(async () => rollup)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/buckets/product-rollup?lineId=${ids.line}&bucketName=%D7%A8%D7%99%D7%A7`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().products).toEqual([]);

      await app.close();
    });

    it('rejects missing lineId query param', async () => {
      const service = createServiceMock();
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/buckets/product-rollup`
      });

      expect(response.statusCode).toBe(400);

      await app.close();
    });

    it('rejects invalid lineId format', async () => {
      const service = createServiceMock();
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/buckets/product-rollup?lineId=not-a-uuid`
      });

      expect(response.statusCode).toBe(400);

      await app.close();
    });

    it('filters by sourceZone when provided', async () => {
      const rollup = {
        shiftId: ids.shift,
        lineId: ids.line,
        bucketName: 'סלולר',
        sourceZone: 'שפלה אמצעי',
        products: [
          { sku: '222', description: 'מוצר ב', category: null, totalQuantity: 5, orderCount: 1 }
        ]
      };
      const service = createServiceMock({
        getBucketProductRollup: vi.fn(async () => rollup)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/buckets/product-rollup?lineId=${ids.line}&bucketName=%D7%A1%D7%9C%D7%95%D7%9C%D7%A8&sourceZone=%D7%A9%D7%A4%D7%9C%D7%94+%D7%90%D7%9E%D7%A6%D7%A2%D7%99`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        shiftId: ids.shift,
        lineId: ids.line,
        bucketName: 'סלולר',
        sourceZone: 'שפלה אמצעי',
        products: [
          { sku: '222', description: 'מוצר ב', category: null, totalQuantity: 5, orderCount: 1 }
        ]
      });
      expect(service.getBucketProductRollup).toHaveBeenCalledWith(
        expect.objectContaining({ sourceZone: 'שפלה אמצעי' })
      );

      await app.close();
    });

    it('treats empty sourceZone as unknown zone filter', async () => {
      const rollup = {
        shiftId: ids.shift,
        lineId: ids.line,
        bucketName: 'כללי',
        sourceZone: null,
        products: []
      };
      const service = createServiceMock({
        getBucketProductRollup: vi.fn(async () => rollup)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/buckets/product-rollup?lineId=${ids.line}&bucketName=%D7%9B%D7%9C%D7%9C%D7%99&sourceZone=`
      });

      expect(response.statusCode).toBe(200);
      expect(service.getBucketProductRollup).toHaveBeenCalledWith(
        expect.objectContaining({ sourceZone: '' })
      );

      await app.close();
    });

    it('works without sourceZone param (backward compat)', async () => {
      const rollup = {
        shiftId: ids.shift,
        lineId: ids.line,
        bucketName: 'סלולר',
        sourceZone: null,
        products: [
          { sku: 'SKU-1', description: 'מוצר א', category: 'cat-a', totalQuantity: 24, orderCount: 2 },
          { sku: 'SKU-2', description: 'מוצר ב', category: 'cat-b', totalQuantity: 10, orderCount: 1 }
        ]
      };
      const service = createServiceMock({
        getBucketProductRollup: vi.fn(async () => rollup)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/buckets/product-rollup?lineId=${ids.line}&bucketName=%D7%A1%D7%9C%D7%95%D7%9C%D7%A8`
      });

      expect(response.statusCode).toBe(200);
      expect(service.getBucketProductRollup).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: ids.tenant,
          shiftId: ids.shift,
          lineId: ids.line,
          bucketName: 'סלולר'
        })
      );

      await app.close();
    });
  });

  describe('GET /api/manual-shifts/:shiftId/product-control', () => {
    it('returns 200 with shiftId, rows and totals', async () => {
      const mockRows = [
        {
          sku: 'SKU-001',
          description: 'Test Product',
          category: 'Test',
          demandQty: 500,
          warehouseQty: 500,
          shortageQty: 0,
          bondedAvailableQty: 0,
          bondedCoverQty: 0,
          finalMissingQty: 0,
          surplusQty: 0,
          status: 'ok' as const
        }
      ];
      const mockResponse = {
        shiftId: ids.shift,
        generatedAt: new Date().toISOString(),
        rows: mockRows,
        totals: {
          totalSkus: 1,
          shortageSkus: 0,
          coveredByBondedSkus: 0,
          partialBondedSkus: 0,
          unresolvedSkus: 0,
          dataIssueSkus: 0
        }
      };
      const service = createServiceMock({
        getProductControl: vi.fn(async () => mockResponse)
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/product-control`
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('shiftId', ids.shift);
      expect(body).toHaveProperty('generatedAt');
      expect(body).toHaveProperty('rows');
      expect(body).toHaveProperty('totals');
      expect(body.rows).toHaveLength(1);
      expect(body.rows[0].sku).toBe('SKU-001');
      expect(body.rows[0].status).toBe('ok');
      expect(body.totals.totalSkus).toBe(1);
      expect(service.getProductControl).toHaveBeenCalledWith({
        tenantId: ids.tenant,
        shiftId: ids.shift
      });

      await app.close();
    });

    it('returns rows with all five statuses from service', async () => {
      const mockRows = [
        { sku: 'A', description: '', category: '', demandQty: 100, warehouseQty: 100, shortageQty: 0, bondedAvailableQty: 0, bondedCoverQty: 0, finalMissingQty: 0, surplusQty: 0, status: 'ok' as const },
        { sku: 'B', description: '', category: '', demandQty: 200, warehouseQty: 50, shortageQty: 150, bondedAvailableQty: 200, bondedCoverQty: 150, finalMissingQty: 0, surplusQty: 0, status: 'covered_by_bonded' as const },
        { sku: 'C', description: '', category: '', demandQty: 300, warehouseQty: 100, shortageQty: 200, bondedAvailableQty: 100, bondedCoverQty: 100, finalMissingQty: 100, surplusQty: 0, status: 'partial_bonded' as const },
        { sku: 'D', description: '', category: '', demandQty: 400, warehouseQty: 80, shortageQty: 320, bondedAvailableQty: 0, bondedCoverQty: 0, finalMissingQty: 320, surplusQty: 0, status: 'unresolved' as const },
        { sku: 'E', description: '', category: '', demandQty: 0, warehouseQty: 9999, shortageQty: 0, bondedAvailableQty: 0, bondedCoverQty: 0, finalMissingQty: 0, surplusQty: 9999, status: 'data_issue' as const }
      ];
      const service = createServiceMock({
        getProductControl: vi.fn(async () => ({
          shiftId: ids.shift,
          generatedAt: new Date().toISOString(),
          rows: mockRows,
          totals: { totalSkus: 5, shortageSkus: 3, coveredByBondedSkus: 1, partialBondedSkus: 1, unresolvedSkus: 1, dataIssueSkus: 1 }
        }))
      });
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/product-control`
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.rows).toHaveLength(5);
      expect(body.rows.map((r: { status: string }) => r.status).sort()).toEqual([
        'covered_by_bonded', 'data_issue', 'ok', 'partial_bonded', 'unresolved'
      ]);
      expect(body.totals.shortageSkus).toBe(3);
      expect(body.totals.dataIssueSkus).toBe(1);

      await app.close();
    });

    it('rejects invalid shiftId format', async () => {
      const service = createServiceMock();
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'GET',
        url: '/api/manual-shifts/not-a-valid-id/product-control'
      });

      expect(response.statusCode).toBe(400);

      await app.close();
    });

    it('is read-only (GET request)', async () => {
      const service = createServiceMock();
      const app = await buildTestApp(service);

      const response = await app.inject({
        method: 'POST',
        url: `/api/manual-shifts/${ids.shift}/product-control`
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });

    it('returns 401 without auth', async () => {
      const service = createServiceMock();
      const app = await buildTestApp(service, null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/manual-shifts/${ids.shift}/product-control`
      });

      expect(response.statusCode).toBe(401);

      await app.close();
    });
  });
});


