import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import {
  addOrderLineBodySchema,
  createOrderBodySchema,
  idResponseSchema,
  orderLineResponseSchema,
  orderResponseSchema,
  ordersResponseSchema,
  transitionOrderStatusBodySchema
} from '../../schemas.js';
import { orderNotFound } from './errors.js';
import { createOrdersRepo } from './repo.js';
import type { OrdersService } from './service.js';
import { parseOrThrow } from '../../validation.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetUserSupabase = (context: AuthenticatedRequestContext) => SupabaseClient;
type GetOrdersService = (context: AuthenticatedRequestContext) => OrdersService;

export function registerOrdersRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getUserSupabase: GetUserSupabase;
    getOrdersService: GetOrdersService;
  }
): void {
  const { getAuthContext, getUserSupabase, getOrdersService } = deps;

  app.get('/api/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const statusFilter = (request.query as { status?: string }).status ?? null;
    const ordersRepo = createOrdersRepo(getUserSupabase(auth));
    const summaries = await ordersRepo.listOrderSummaries(tenantId, statusFilter);

    return parseOrThrow(ordersResponseSchema, summaries);
  });

  app.post('/api/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const body = parseOrThrow(createOrderBodySchema, request.body);
    const order = await getOrdersService(auth).createOrder({
      tenantId,
      externalNumber: body.externalNumber,
      priority: body.priority,
      waveId: body.waveId
    });

    return parseOrThrow(orderResponseSchema, order);
  });

  app.get('/api/orders/:orderId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const ordersRepo = createOrdersRepo(getUserSupabase(auth));
    const order = await ordersRepo.findOrderResponse(orderId);

    if (!order) {
      throw orderNotFound(orderId);
    }

    return parseOrThrow(orderResponseSchema, order);
  });

  app.post('/api/orders/:orderId/lines', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const body = parseOrThrow(addOrderLineBodySchema, request.body);
    const line = await getOrdersService(auth).addOrderLine({
      tenantId,
      orderId,
      productId: body.productId,
      qtyRequired: body.qtyRequired
    });

    void reply.code(201);
    return parseOrThrow(orderLineResponseSchema, line);
  });

  app.delete('/api/orders/:orderId/lines/:lineId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const params = request.params as { orderId: string; lineId: string };
    const orderId = parseOrThrow(idResponseSchema, { id: params.orderId }).id;
    const lineId = parseOrThrow(idResponseSchema, { id: params.lineId }).id;
    await getOrdersService(auth).removeOrderLine({ orderId, lineId });

    void reply.code(204);
  });

  app.patch('/api/orders/:orderId/status', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const orderId = parseOrThrow(idResponseSchema, {
      id: (request.params as { orderId: string }).orderId
    }).id;
    const body = parseOrThrow(transitionOrderStatusBodySchema, request.body);
    const order = await getOrdersService(auth).transitionOrderStatus({
      orderId,
      status: body.status
    });

    return parseOrThrow(orderResponseSchema, order);
  });
}
