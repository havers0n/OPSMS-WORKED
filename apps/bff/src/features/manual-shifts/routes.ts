import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ManualShiftImportError,
  parseDailyManualShiftImport,
  parseManualShiftMonthlyPreview,
  planManualShiftMonthlyImportApply
} from '@wos/domain';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { ManualShiftsService } from './service.js';
import { ApiError, sendApiError } from '../../errors.js';
import { parseManualShiftImportWorkbook } from './import-adapter.js';
import { parseManualShiftMonthlyImportWorkbook } from './monthly-import-adapter.js';
import { manualShiftMonthlyImportBlockingWarnings } from './errors.js';
import {
  bulkCreateManualShiftOrdersBodySchema,
  createManualShiftBodySchema,
  createManualShiftLineBodySchema,
  createManualShiftOrderBodySchema,
  createManualShiftOrderCheckUnitBodySchema,
  createManualShiftOrderAshlamaBodySchema,
  createManualShiftOrderErrorBodySchema,
  createManualShiftWorkerBodySchema,
  idResponseSchema,
  manualShiftDaySummaryResponseSchema,
  manualShiftLineResponseSchema,
  manualShiftLineSummaryResponseSchema,
  manualShiftOrderErrorResponseSchema,
  manualShiftOrderCheckUnitResponseSchema,
  manualShiftOrderCheckUnitsResponseSchema,
  manualShiftOrderAshlamaResponseSchema,
  manualShiftOrderAshlamotResponseSchema,
  manualShiftOrderEventsResponseSchema,
  manualShiftOrderItemResponseSchema,
  manualShiftOrderItemsResponseSchema,
  manualShiftOrderResponseSchema,
  manualShiftOrdersResponseSchema,
  manualShiftPeopleSummaryResponseSchema,
  manualShiftSessionResponseSchema,
  manualShiftTodayResponseSchema,
  manualShiftBulkAddResponseSchema,
  manualShiftImportPreviewResponseSchema,
  manualShiftMonthlyImportPreviewResponseSchema,
  manualShiftMonthlyApplyResponseSchema,
  applyManualShiftImportRequestSchema,
  applyManualShiftImportResponseSchema,
  manualShiftDeleteRestoreBodySchema,
  manualShiftWorkerResponseSchema,
  manualShiftWorkersResponseSchema,
  bindableUsersResponseSchema,
  patchManualShiftLineBodySchema,
  patchManualShiftOrderBodySchema,
  patchManualShiftOrderCheckUnitBodySchema,
  patchManualShiftOrderAshlamaBodySchema,
  patchManualShiftWorkerBodySchema,
  transitionManualShiftOrderCheckUnitStatusBodySchema,
  transitionManualShiftOrderStatusBodySchema,
  pickTaskDetailResponseSchema,
  openAshlamaBoardResponseSchema
} from '../../schemas.js';
import { parseOrThrow } from '../../validation.js';
import { createPickBridgeServiceFromSupabase } from './pick-bridge-service.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetManualShiftsService = (context: AuthenticatedRequestContext) => ManualShiftsService;
type GetUserSupabase = (context: AuthenticatedRequestContext) => SupabaseClient;

type MultipartFilePart = {
  type: 'file' | 'field';
  fieldname?: string;
  filename?: string;
  mimetype?: string;
  file?: { resume: () => void };
  toBuffer?: () => Promise<Buffer>;
  value?: string;
};

type MultipartSingleFile = {
  filename?: string;
  mimetype?: string;
  truncated?: boolean;
  toBuffer: () => Promise<Buffer>;
};

const MANUAL_SHIFT_IMPORT_FILE_SIZE_LIMIT_BYTES = 20 * 1024 * 1024;

function requireTenant(auth: AuthenticatedRequestContext) {
  if (!auth.currentTenant) {
    throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
  }

  return auth.currentTenant.tenantId;
}

function actorFromAuth(auth: AuthenticatedRequestContext, actorNameOverride?: string) {
  return {
    actorProfileId: auth.user.id ?? null,
    actorName: actorNameOverride ?? auth.displayName ?? auth.user.email ?? 'system'
  };
}

function mapMultipartError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: string }).code;
  switch (code) {
    case 'FST_REQ_FILE_TOO_LARGE':
      return new ApiError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the 20MB limit.');
    case 'FST_FILES_LIMIT':
    case 'FST_FIELDS_LIMIT':
    case 'FST_PARTS_LIMIT':
      return new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Multipart upload contains unexpected parts.');
    case 'FST_INVALID_MULTIPART_CONTENT_TYPE':
      return new ApiError(400, 'INVALID_MULTIPART_REQUEST', 'Request must use multipart/form-data.');
    default:
      return null;
  }
}

function mapManualShiftImportError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  const multipartError = mapMultipartError(error);
  if (multipartError) {
    return multipartError;
  }

  if (error instanceof ManualShiftImportError) {
    switch (error.code) {
      case 'MISSING_DATE':
        return new ApiError(400, error.code, error.message);
      case 'MISSING_SHEET':
      case 'INVALID_DATE':
      case 'EMPTY_IMPORT':
      case 'EMPTY_LINE_NAME':
      case 'EMPTY_ORDER_POINT_NAME':
      case 'ORPHAN_CHILD_ROW':
      case 'LINE_PREFIX_MISMATCH':
      case 'DUPLICATE_LINE':
      case 'DUPLICATE_CHILD_WITHIN_LINE':
        return new ApiError(422, error.code, error.message);
      default:
        return new ApiError(422, error.code, error.message);
    }
  }

  return new ApiError(500, 'INTERNAL_IMPORT_ERROR', error instanceof Error ? error.message : 'Unexpected import error');
}

function logImportStage(
  request: FastifyRequest,
  route: string,
  stage: string,
  data: Record<string, unknown> = {}
) {
  request.log.info(
    {
      route,
      stage,
      ...data
    },
    `manual shift import ${stage}`
  );
}

async function readDebugUploadFile(request: FastifyRequest, route: string) {
  const multipartRequest = request as FastifyRequest & {
    file: () => Promise<MultipartSingleFile | undefined>;
  };

  logImportStage(request, route, 'request_file_started');
  const file = await multipartRequest.file();
  logImportStage(request, route, 'request_file_resolved', {
    fileName: file?.filename ?? null,
    mimetype: file?.mimetype ?? null,
    truncated: (file as { truncated?: boolean } | undefined)?.truncated ?? null
  });

  if (!file || !file.filename) {
    throw new ApiError(400, 'MISSING_FILE', 'Multipart file field "file" is required.');
  }

  logImportStage(request, route, 'file_to_buffer_started', {
    fileName: file.filename
  });
  const buffer = await file.toBuffer();
  logImportStage(request, route, 'file_to_buffer_done', {
    fileName: file.filename,
    size: buffer.length
  });

  return {
    fileName: file.filename,
    mimetype: file.mimetype ?? null,
    fileBuffer: buffer
  };
}

async function handleManualShiftImportRoute<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  route: string,
  handler: () => Promise<T>
) {
  logImportStage(request, route, 'route_entered');
  try {
    const result = await handler();
    logImportStage(request, route, 'response_sent');
    return result;
  } catch (error) {
    const apiError = mapManualShiftImportError(error);
    request.log.error(
      {
        err: error,
        route,
        statusCode: apiError.statusCode,
        errorCode: apiError.code
      },
      'manual shift import route failed'
    );
    return sendApiError(reply, apiError, request.id);
  }
}

async function readMultipartUpload(
  request: FastifyRequest,
  options?: { allowedFieldNames?: string[]; route?: string }
) {
  const allowedFieldNames = new Set(options?.allowedFieldNames ?? []);
  const multipartRequest = request as FastifyRequest & {
    parts: () => AsyncIterable<MultipartFilePart>;
  };

  let fileName: string | null = null;
  let fileBuffer: Buffer | null = null;
  const fields = new Map<string, string>();

  try {
    logImportStage(request, options?.route ?? 'manual_shift_import', 'multipart_read_started', {
      allowedFieldNames: Array.from(allowedFieldNames)
    });
    for await (const part of multipartRequest.parts()) {
      if (part.type === 'field') {
        if (!part.fieldname || !allowedFieldNames.has(part.fieldname)) {
          throw new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Unexpected multipart field.');
        }
        fields.set(part.fieldname, String(part.value ?? ''));
        continue;
      }

      if (part.fieldname !== 'file' || !part.filename || !part.toBuffer) {
        part.file?.resume();
        throw new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Unexpected multipart file field.');
      }
      if (fileBuffer !== null) {
        part.file?.resume();
        throw new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Exactly one file upload is allowed.');
      }
      logImportStage(request, options?.route ?? 'manual_shift_import', 'request_file_resolved', {
        fieldName: part.fieldname,
        fileName: part.filename,
        mimetype: part.mimetype ?? null
      });
      fileName = part.filename;
      logImportStage(request, options?.route ?? 'manual_shift_import', 'file_to_buffer_started', {
        fieldName: part.fieldname,
        fileName: part.filename,
        mimetype: part.mimetype ?? null
      });
      logImportStage(request, options?.route ?? 'manual_shift_import', 'file_to_buffer_started', {
        fileName: part.filename
      });
      fileBuffer = await part.toBuffer();
      logImportStage(request, options?.route ?? 'manual_shift_import', 'file_to_buffer_done', {
        fileName: part.filename,
        size: fileBuffer.length
      });
    }
  } catch (error) {
    throw mapManualShiftImportError(error);
  }

  if (!fileName || !fileBuffer) {
    throw new ApiError(400, 'MISSING_FILE', 'Multipart file field "file" is required.');
  }
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    throw new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Only .xlsx files are supported.');
  }

  logImportStage(request, options?.route ?? 'manual_shift_import', 'multipart_complete', {
    fileName,
    size: fileBuffer.length,
    fields: Array.from(fields.keys())
  });

  return { fileName, fileBuffer, fields };
}

export function registerManualShiftsRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getManualShiftsService: GetManualShiftsService;
    getUserSupabase: GetUserSupabase;
  }
) {
  const { getAuthContext, getManualShiftsService, getUserSupabase } = deps;

  app.get('/api/manual-shifts/today', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const response = await getManualShiftsService(auth).getTodayShift(tenantId);
    return parseOrThrow(manualShiftTodayResponseSchema, response);
  });

  app.get('/api/manual-shifts/by-date', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const { date } = request.query as { date?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ApiError(400, 'INVALID_DATE', 'Query param "date" must be in YYYY-MM-DD format.');
    }

    const response = await getManualShiftsService(auth).getShiftByDate(tenantId, date);
    return parseOrThrow(manualShiftTodayResponseSchema, response);
  });

  app.post('/api/manual-shifts', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const body = parseOrThrow(createManualShiftBodySchema, request.body);
    const shift = await getManualShiftsService(auth).createShift({
      tenantId,
      date: body.date,
      name: body.name,
      actor: actorFromAuth(auth)
    });

    void reply.code(201);
    return parseOrThrow(manualShiftSessionResponseSchema, shift);
  });

  app.patch('/api/manual-shifts/:shiftId/close', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const shiftId = parseOrThrow(idResponseSchema, {
      id: (request.params as { shiftId: string }).shiftId
    }).id;
    const shift = await getManualShiftsService(auth).closeShift({ tenantId, shiftId });
    return parseOrThrow(manualShiftSessionResponseSchema, shift);
  });

  app.get('/api/manual-shifts/:shiftId/lines', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const shiftId = parseOrThrow(idResponseSchema, {
      id: (request.params as { shiftId: string }).shiftId
    }).id;
    const lines = await getManualShiftsService(auth).listShiftLines({ tenantId, shiftId });
    return parseOrThrow(manualShiftLineSummaryResponseSchema, lines);
  });

  app.post('/api/manual-shifts/:shiftId/lines', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const shiftId = parseOrThrow(idResponseSchema, {
      id: (request.params as { shiftId: string }).shiftId
    }).id;
    const body = parseOrThrow(createManualShiftLineBodySchema, request.body);
    const line = await getManualShiftsService(auth).createLine({
      tenantId,
      shiftId,
      name: body.name,
      sortOrder: body.sortOrder
    });

    void reply.code(201);
    return parseOrThrow(manualShiftLineResponseSchema, line);
  });

  app.patch('/api/manual-shift-lines/:lineId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const lineId = parseOrThrow(idResponseSchema, {
      id: (request.params as { lineId: string }).lineId
    }).id;
    const body = parseOrThrow(patchManualShiftLineBodySchema, request.body);
    const line = await getManualShiftsService(auth).patchLine({
      tenantId,
      lineId,
      name: body.name,
      sortOrder: body.sortOrder
    });

    return parseOrThrow(manualShiftLineResponseSchema, line);
  });

  app.patch('/api/manual-shift-lines/:lineId/delete', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const lineId = parseOrThrow(idResponseSchema, {
      id: (request.params as { lineId: string }).lineId
    }).id;
    const body = parseOrThrow(manualShiftDeleteRestoreBodySchema, request.body ?? {});
    const line = await getManualShiftsService(auth).deleteLine({
      tenantId,
      lineId,
      reason: body.reason,
      actor: actorFromAuth(auth, body.actorName)
    });

    return parseOrThrow(manualShiftLineResponseSchema, line);
  });

  app.patch('/api/manual-shift-lines/:lineId/restore', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const lineId = parseOrThrow(idResponseSchema, {
      id: (request.params as { lineId: string }).lineId
    }).id;
    const body = parseOrThrow(manualShiftDeleteRestoreBodySchema, request.body ?? {});
    const line = await getManualShiftsService(auth).restoreLine({
      tenantId,
      lineId,
      reason: body.reason,
      actor: actorFromAuth(auth, body.actorName)
    });

    return parseOrThrow(manualShiftLineResponseSchema, line);
  });

  app.get('/api/manual-shifts/:shiftId/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const shiftId = parseOrThrow(idResponseSchema, {
      id: (request.params as { shiftId: string }).shiftId
    }).id;
    const orders = await getManualShiftsService(auth).listShiftOrders({ tenantId, shiftId });
    return parseOrThrow(manualShiftOrdersResponseSchema, orders);
  });

  app.get('/api/manual-shift-lines/:lineId/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const lineId = parseOrThrow(idResponseSchema, {
      id: (request.params as { lineId: string }).lineId
    }).id;
    const orders = await getManualShiftsService(auth).listLineOrders({ tenantId, lineId });
    return parseOrThrow(manualShiftOrdersResponseSchema, orders);
  });

  app.get('/api/manual-shift-orders/:orderId/check-units', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const checkUnits = await getManualShiftsService(auth).listOrderCheckUnits({ tenantId, orderId });
    return parseOrThrow(manualShiftOrderCheckUnitsResponseSchema, checkUnits);
  });

  app.get('/api/manual-shift-orders/:orderId/ashlamot', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const ashlamot = await getManualShiftsService(auth).listOrderAshlamot({ tenantId, orderId });
    return parseOrThrow(manualShiftOrderAshlamotResponseSchema, ashlamot);
  });

  app.get('/api/manual-shift-orders/:orderId/events', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const events = await getManualShiftsService(auth).listOrderEvents({ tenantId, orderId });
    return parseOrThrow(manualShiftOrderEventsResponseSchema, events);
  });

  app.get('/api/manual-shift-orders/:orderId/items', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const items = await getManualShiftsService(auth).listOrderItems({ tenantId, orderId });
    return parseOrThrow(manualShiftOrderItemsResponseSchema, items);
  });

  app.post('/api/manual-shift-lines/:lineId/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const lineId = parseOrThrow(idResponseSchema, {
      id: (request.params as { lineId: string }).lineId
    }).id;
    const body = parseOrThrow(createManualShiftOrderBodySchema, request.body);
    const order = await getManualShiftsService(auth).createOrder({
      tenantId,
      lineId,
      pointName: body.pointName,
      orderNumber: body.orderNumber,
      customerName: body.customerName,
      pickerName: body.pickerName,
      pickerWorkerId: body.pickerWorkerId,
      checkerName: body.checkerName,
      lineCount: body.lineCount,
      palletCount: body.palletCount,
      size: body.size,
      status: body.status,
      comment: body.comment,
      actor: actorFromAuth(auth)
    });

    void reply.code(201);
    return parseOrThrow(manualShiftOrderResponseSchema, order);
  });

  app.post('/api/manual-shift-lines/:lineId/orders/bulk', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const lineId = parseOrThrow(idResponseSchema, {
      id: (request.params as { lineId: string }).lineId
    }).id;
    const body = parseOrThrow(bulkCreateManualShiftOrdersBodySchema, request.body);
    const result = await getManualShiftsService(auth).bulkCreateOrders({
      tenantId,
      lineId,
      rawText: body.rawText,
      rows: body.rows,
      actor: actorFromAuth(auth)
    });

    void reply.code(201);
    return parseOrThrow(manualShiftBulkAddResponseSchema, result);
  });

  app.patch('/api/manual-shift-orders/:orderId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const body = parseOrThrow(patchManualShiftOrderBodySchema, request.body);
    const order = await getManualShiftsService(auth).patchOrder({
      tenantId,
      orderId,
      pointName: body.pointName,
      orderNumber: body.orderNumber,
      customerName: body.customerName,
      pickerName: body.pickerName,
      pickerWorkerId: body.pickerWorkerId,
      checkerName: body.checkerName,
      lineCount: body.lineCount,
      palletCount: body.palletCount,
      size: body.size,
      comment: body.comment,
      startedAt: body.startedAt,
      finishedAt: body.finishedAt,
      checkedAt: body.checkedAt,
      actor: actorFromAuth(auth)
    });

    return parseOrThrow(manualShiftOrderResponseSchema, order);
  });

  app.post('/api/manual-shift-orders/:orderId/check-units', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const body = parseOrThrow(createManualShiftOrderCheckUnitBodySchema, request.body ?? {});
    const checkUnit = await getManualShiftsService(auth).createOrderCheckUnit({
      tenantId,
      orderId,
      note: body.note,
      reason: body.reason,
      actor: actorFromAuth(auth)
    });

    void reply.code(201);
    return parseOrThrow(manualShiftOrderCheckUnitResponseSchema, checkUnit);
  });

  app.post('/api/manual-shifts/import/preview', async (request, reply) => {
    return handleManualShiftImportRoute(request, reply, '/api/manual-shifts/import/preview', async () => {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      logImportStage(request, '/api/manual-shifts/import/preview', 'auth_resolved', {
        userId: auth.user.id ?? null,
        tenantId: auth.currentTenant?.tenantId ?? null
      });

      const tenantId = requireTenant(auth);
      logImportStage(request, '/api/manual-shifts/import/preview', 'tenant_resolved', { tenantId });

      const { fileName, fileBuffer } = await readMultipartUpload(request, {
        route: '/api/manual-shifts/import/preview'
      });

      const workbook = parseManualShiftImportWorkbook({
        fileName,
        buffer: fileBuffer,
        logger: request.log
      });
      logImportStage(request, '/api/manual-shifts/import/preview', 'workbook_parse_done', {
        fileName,
        sheetName: workbook.sheetName,
        rowCount: workbook.rows.length
      });

      const preview = parseDailyManualShiftImport(workbook);
      logImportStage(request, '/api/manual-shifts/import/preview', 'preview_result', {
        fileName: preview.fileName,
        lineCount: preview.lineCount,
        orderCount: preview.orderCount
      });

      return parseOrThrow(manualShiftImportPreviewResponseSchema, { preview });
    });
  });

  app.post('/api/manual-shifts/import/monthly-preview', async (request, reply) => {
    return handleManualShiftImportRoute(request, reply, '/api/manual-shifts/import/monthly-preview', async () => {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      logImportStage(request, '/api/manual-shifts/import/monthly-preview', 'auth_resolved', {
        userId: auth.user.id ?? null,
        tenantId: auth.currentTenant?.tenantId ?? null
      });

      const tenantId = requireTenant(auth);
      logImportStage(request, '/api/manual-shifts/import/monthly-preview', 'tenant_resolved', { tenantId });

      const { fileName, fileBuffer, fields } = await readMultipartUpload(request, {
        allowedFieldNames: ['selectedDate'],
        route: '/api/manual-shifts/import/monthly-preview'
      });
      const selectedDate = fields.get('selectedDate')?.trim() ?? '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        throw new ApiError(400, 'INVALID_DATE', 'Multipart field "selectedDate" must be in YYYY-MM-DD format.');
      }
      logImportStage(request, '/api/manual-shifts/import/monthly-preview', 'selected_date_resolved', {
        selectedDate
      });

      const workbook = parseManualShiftMonthlyImportWorkbook({
        fileName,
        buffer: fileBuffer,
        selectedDate,
        logger: request.log
      });
      logImportStage(request, '/api/manual-shifts/import/monthly-preview', 'workbook_parse_done', {
        fileName,
        sheetName: workbook.source.sheetName,
        rowCount: workbook.rows.length
      });

      const parsed = parseManualShiftMonthlyPreview({
        ...workbook,
        selectedDate
      });
      logImportStage(request, '/api/manual-shifts/import/monthly-preview', 'preview_result', {
        fileName: parsed.preview.source.fileName,
        lineCount: parsed.preview.lines.length,
        warningCount: parsed.preview.warnings.length
      });

      return parseOrThrow(manualShiftMonthlyImportPreviewResponseSchema, {
        preview: parsed.preview
      });
    });
  });

  app.post('/api/manual-shifts/import/monthly-apply', async (request, reply) => {
    return handleManualShiftImportRoute(request, reply, '/api/manual-shifts/import/monthly-apply', async () => {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      logImportStage(request, '/api/manual-shifts/import/monthly-apply', 'auth_resolved', {
        userId: auth.user.id ?? null,
        tenantId: auth.currentTenant?.tenantId ?? null
      });

      const tenantId = requireTenant(auth);
      logImportStage(request, '/api/manual-shifts/import/monthly-apply', 'tenant_resolved', { tenantId });

      const { fileName, fileBuffer, fields } = await readMultipartUpload(request, {
        allowedFieldNames: ['selectedDate', 'shiftId'],
        route: '/api/manual-shifts/import/monthly-apply'
      });
      const selectedDate = fields.get('selectedDate')?.trim() ?? '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        throw new ApiError(400, 'INVALID_DATE', 'Multipart field "selectedDate" must be in YYYY-MM-DD format.');
      }
      const shiftId = parseOrThrow(idResponseSchema, {
        id: fields.get('shiftId')?.trim() ?? ''
      }).id;
      logImportStage(request, '/api/manual-shifts/import/monthly-apply', 'selected_date_resolved', {
        selectedDate,
        shiftId
      });

      const workbook = parseManualShiftMonthlyImportWorkbook({
        fileName,
        buffer: fileBuffer,
        selectedDate,
        logger: request.log
      });
      logImportStage(request, '/api/manual-shifts/import/monthly-apply', 'workbook_parse_done', {
        fileName,
        sheetName: workbook.source.sheetName,
        rowCount: workbook.rows.length
      });

      const parsed = parseManualShiftMonthlyPreview({
        ...workbook,
        selectedDate
      });
      const plan = planManualShiftMonthlyImportApply(parsed);
      logImportStage(request, '/api/manual-shifts/import/monthly-apply', 'preview_result', {
        fileName: parsed.preview.source.fileName,
        lineCount: parsed.preview.lines.length,
        warningCount: parsed.preview.warnings.length,
        blockingWarningCount: plan.blockingWarnings.length
      });

      if (plan.blockingWarnings.length > 0) {
        throw manualShiftMonthlyImportBlockingWarnings({
          preview: parsed.preview,
          warnings: plan.blockingWarnings
        });
      }

      const result = await getManualShiftsService(auth).applyMonthlyImport({
        tenantId,
        shiftId,
        selectedDate,
        plan
      });

      logImportStage(request, '/api/manual-shifts/import/monthly-apply', 'service_result', {
        shiftId,
        selectedDate,
        linesCreated: result.linesCreated,
        ordersCreated: result.ordersCreated
      });

      return parseOrThrow(manualShiftMonthlyApplyResponseSchema, result);
    });
  });

  app.post('/api/debug/upload', async (request, reply) => {
    return handleManualShiftImportRoute(request, reply, '/api/debug/upload', async () => {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      logImportStage(request, '/api/debug/upload', 'auth_resolved', {
        userId: auth.user.id ?? null,
        tenantId: auth.currentTenant?.tenantId ?? null
      });

      const tenantId = requireTenant(auth);
      logImportStage(request, '/api/debug/upload', 'tenant_resolved', { tenantId });

      if (process.env.NODE_ENV === 'production') {
        throw new ApiError(404, 'NOT_FOUND', 'Not found.');
      }

      const file = await readDebugUploadFile(request, '/api/debug/upload');
      void reply.code(200);
      return {
        fileName: file.fileName,
        mimetype: file.mimetype,
        size: file.fileBuffer.length
      };
    });
  });

  app.post('/api/manual-shifts/import/apply', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;
    const tenantId = requireTenant(auth);

    const body = parseOrThrow(applyManualShiftImportRequestSchema, request.body);
    const result = await getManualShiftsService(auth).applyDailyImport({
      tenantId,
      shiftId: body.shiftId,
      preview: body.preview,
      actor: actorFromAuth(auth)
    });

    return parseOrThrow(applyManualShiftImportResponseSchema, result);
  });

  app.post('/api/manual-shift-orders/:orderId/start-check', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;

    const order = await getManualShiftsService(auth).startOrderCheck({
      tenantId,
      orderId,
      actor: actorFromAuth(auth)
    });

    return parseOrThrow(manualShiftOrderResponseSchema, order);
  });

  app.post('/api/manual-shift-orders/:orderId/ashlamot', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const body = parseOrThrow(createManualShiftOrderAshlamaBodySchema, request.body);
    const ashlama = await getManualShiftsService(auth).createOrderAshlama({
      tenantId,
      orderId,
      checkUnitId: body.checkUnitId,
      text: body.text,
      actor: actorFromAuth(auth)
    });
    void reply.code(201);
    return parseOrThrow(manualShiftOrderAshlamaResponseSchema, ashlama);
  });

  app.patch('/api/manual-shift-ashlamot/:ashlamaId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const ashlamaId = parseOrThrow(idResponseSchema, {
      id: (request.params as { ashlamaId: string }).ashlamaId
    }).id;
    const body = parseOrThrow(patchManualShiftOrderAshlamaBodySchema, request.body);
    const ashlama = await getManualShiftsService(auth).patchOrderAshlamaStatus({
      tenantId,
      ashlamaId,
      status: body.status,
      actor: actorFromAuth(auth)
    });
    return parseOrThrow(manualShiftOrderAshlamaResponseSchema, ashlama);
  });

  app.patch('/api/manual-shift-check-units/:checkUnitId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const checkUnitId = parseOrThrow(idResponseSchema, {
      id: (request.params as { checkUnitId: string }).checkUnitId
    }).id;
    const body = parseOrThrow(patchManualShiftOrderCheckUnitBodySchema, request.body ?? {});
    const checkUnit = await getManualShiftsService(auth).patchOrderCheckUnit({
      tenantId,
      checkUnitId,
      note: body.note,
      reason: body.reason,
      actor: actorFromAuth(auth)
    });

    return parseOrThrow(manualShiftOrderCheckUnitResponseSchema, checkUnit);
  });

  app.patch('/api/manual-shift-check-units/:checkUnitId/status', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const checkUnitId = parseOrThrow(idResponseSchema, {
      id: (request.params as { checkUnitId: string }).checkUnitId
    }).id;
    const body = parseOrThrow(transitionManualShiftOrderCheckUnitStatusBodySchema, request.body);
    const checkUnit = await getManualShiftsService(auth).transitionOrderCheckUnitStatus({
      tenantId,
      checkUnitId,
      status: body.status,
      reason: body.reason,
      note: body.note,
      actor: actorFromAuth(auth)
    });

    return parseOrThrow(manualShiftOrderCheckUnitResponseSchema, checkUnit);
  });

  app.patch('/api/manual-shift-orders/:orderId/delete', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const body = parseOrThrow(manualShiftDeleteRestoreBodySchema, request.body ?? {});
    const order = await getManualShiftsService(auth).deleteOrder({
      tenantId,
      orderId,
      reason: body.reason,
      actor: actorFromAuth(auth, body.actorName)
    });

    return parseOrThrow(manualShiftOrderResponseSchema, order);
  });

  app.patch('/api/manual-shift-orders/:orderId/restore', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const body = parseOrThrow(manualShiftDeleteRestoreBodySchema, request.body ?? {});
    const order = await getManualShiftsService(auth).restoreOrder({
      tenantId,
      orderId,
      reason: body.reason,
      actor: actorFromAuth(auth, body.actorName)
    });

    return parseOrThrow(manualShiftOrderResponseSchema, order);
  });

  app.patch('/api/manual-shift-orders/:orderId/status', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const body = parseOrThrow(transitionManualShiftOrderStatusBodySchema, request.body);
    const order = await getManualShiftsService(auth).transitionOrderStatus({
      tenantId,
      orderId,
      status: body.status,
      actor: actorFromAuth(auth)
    });

    return parseOrThrow(manualShiftOrderResponseSchema, order);
  });

  app.post('/api/manual-shift-orders/:orderId/errors', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const body = parseOrThrow(createManualShiftOrderErrorBodySchema, request.body);
    const error = await getManualShiftsService(auth).createOrderError({
      tenantId,
      orderId,
      type: body.type,
      comment: body.comment,
      actor: actorFromAuth(auth)
    });

    void reply.code(201);
    return parseOrThrow(manualShiftOrderErrorResponseSchema, error);
  });

  app.get('/api/manual-shifts/:shiftId/workers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const shiftId = parseOrThrow(idResponseSchema, {
      id: (request.params as { shiftId: string }).shiftId
    }).id;
    const workers = await getManualShiftsService(auth).listShiftWorkers({ tenantId, shiftId });
    return parseOrThrow(manualShiftWorkersResponseSchema, workers);
  });

  app.post('/api/manual-shifts/:shiftId/workers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const shiftId = parseOrThrow(idResponseSchema, {
      id: (request.params as { shiftId: string }).shiftId
    }).id;
    const body = parseOrThrow(createManualShiftWorkerBodySchema, request.body);
    const worker = await getManualShiftsService(auth).createWorker({
      tenantId,
      shiftId,
      name: body.name,
      role: body.role,
      sortOrder: body.sortOrder,
      authUserId: body.authUserId
    });

    void reply.code(201);
    return parseOrThrow(manualShiftWorkerResponseSchema, worker);
  });

  app.patch('/api/manual-shift-workers/:workerId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    if (auth.currentTenant?.role !== 'tenant_admin' && auth.currentTenant?.role !== 'platform_admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Operator or admin access required.');
    }
    const workerId = parseOrThrow(idResponseSchema, {
      id: (request.params as { workerId: string }).workerId
    }).id;
    const body = parseOrThrow(patchManualShiftWorkerBodySchema, request.body);
    const worker = await getManualShiftsService(auth).patchWorker({
      tenantId,
      workerId,
      name: body.name,
      role: body.role,
      active: body.active,
      sortOrder: body.sortOrder,
      authUserId: body.authUserId
    });
    return parseOrThrow(manualShiftWorkerResponseSchema, worker);
  });

  app.patch('/api/manual-shift-workers/:workerId/deactivate', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const workerId = parseOrThrow(idResponseSchema, {
      id: (request.params as { workerId: string }).workerId
    }).id;
    const worker = await getManualShiftsService(auth).deactivateWorker({ tenantId, workerId });
    return parseOrThrow(manualShiftWorkerResponseSchema, worker);
  });

  app.get('/api/manual-shifts/worker-bindable-users', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    if (!auth.currentTenant || (auth.currentTenant.role !== 'tenant_admin' && auth.currentTenant.role !== 'platform_admin')) {
      throw new ApiError(403, 'FORBIDDEN', 'Operator or admin access required.');
    }

    const users = await getManualShiftsService(auth).listBindableUsers(tenantId);
    return parseOrThrow(bindableUsersResponseSchema, users);
  });

  app.get('/api/manual-shifts/:shiftId/people-summary', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const shiftId = parseOrThrow(idResponseSchema, {
      id: (request.params as { shiftId: string }).shiftId
    }).id;
    const summary = await getManualShiftsService(auth).getPeopleSummary({ tenantId, shiftId });
    return parseOrThrow(manualShiftPeopleSummaryResponseSchema, summary);
  });

  app.get('/api/manual-shifts/:shiftId/day-summary', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const shiftId = parseOrThrow(idResponseSchema, {
      id: (request.params as { shiftId: string }).shiftId
    }).id;
    const summary = await getManualShiftsService(auth).getDaySummary({ tenantId, shiftId });
    return parseOrThrow(manualShiftDaySummaryResponseSchema, summary);
  });

  app.get('/api/manual-shifts/:shiftId/open-ashlamot', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const shiftId = parseOrThrow(idResponseSchema, {
      id: (request.params as { shiftId: string }).shiftId
    }).id;
    const items = await getManualShiftsService(auth).listOpenShiftAshlamot({ tenantId, shiftId });
    return parseOrThrow(openAshlamaBoardResponseSchema, items);
  });

  // ── Pick bridge ──────────────────────────────────────────────────────────────

  app.post('/api/manual-shifts/orders/:orderId/start-picking', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;

    const supabase = getUserSupabase(auth);
    const bridgeService = createPickBridgeServiceFromSupabase(supabase);
    const detail = await bridgeService.startPicking({
      tenantId,
      orderId,
      actor: actorFromAuth(auth)
    });

    return parseOrThrow(pickTaskDetailResponseSchema, detail);
  });
}
