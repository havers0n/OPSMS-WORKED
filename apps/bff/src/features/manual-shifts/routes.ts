import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { ManualShiftsService } from './service.js';
import { ApiError } from '../../errors.js';
import {
  bulkCreateManualShiftOrdersBodySchema,
  createManualShiftBodySchema,
  createManualShiftLineBodySchema,
  createManualShiftOrderBodySchema,
  createManualShiftOrderErrorBodySchema,
  idResponseSchema,
  manualShiftDaySummaryResponseSchema,
  manualShiftLineResponseSchema,
  manualShiftLineSummaryResponseSchema,
  manualShiftOrderErrorResponseSchema,
  manualShiftOrderResponseSchema,
  manualShiftOrdersResponseSchema,
  manualShiftPeopleSummaryResponseSchema,
  manualShiftSessionResponseSchema,
  manualShiftTodayResponseSchema,
  manualShiftBulkAddResponseSchema,
  patchManualShiftLineBodySchema,
  patchManualShiftOrderBodySchema,
  transitionManualShiftOrderStatusBodySchema
} from '../../schemas.js';
import { parseOrThrow } from '../../validation.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetManualShiftsService = (context: AuthenticatedRequestContext) => ManualShiftsService;

function requireTenant(auth: AuthenticatedRequestContext) {
  if (!auth.currentTenant) {
    throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
  }

  return auth.currentTenant.tenantId;
}

function actorFromAuth(auth: AuthenticatedRequestContext) {
  return {
    actorProfileId: auth.user.id ?? null,
    actorName: auth.displayName ?? auth.user.email ?? 'system'
  };
}

export function registerManualShiftsRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getManualShiftsService: GetManualShiftsService;
  }
) {
  const { getAuthContext, getManualShiftsService } = deps;

  app.get('/api/manual-shifts/today', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenant(auth);
    const response = await getManualShiftsService(auth).getTodayShift(tenantId);
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
      orderNumber: body.orderNumber,
      customerName: body.customerName,
      pickerName: body.pickerName,
      checkerName: body.checkerName,
      lineCount: body.lineCount,
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
      orderNumber: body.orderNumber,
      customerName: body.customerName,
      pickerName: body.pickerName,
      checkerName: body.checkerName,
      lineCount: body.lineCount,
      size: body.size,
      comment: body.comment,
      actor: actorFromAuth(auth)
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
}
