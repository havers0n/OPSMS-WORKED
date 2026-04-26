import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { type PickingPlanningPreviewService } from './service.js';
import {
  pickingPlanningPreviewOrdersRequestSchema,
  pickingPlanningPreviewRequestSchema
} from './schema.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetPickingPlanningPreviewService = (
  context: AuthenticatedRequestContext
) => PickingPlanningPreviewService;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerPickingPlanningPreviewRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getPickingPlanningPreviewService: GetPickingPlanningPreviewService;
  }
): void {
  const { getAuthContext, getPickingPlanningPreviewService } = deps;

  app.post('/api/picking-planning/preview', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(pickingPlanningPreviewRequestSchema, request.body);
    return getPickingPlanningPreviewService(auth).previewPickingPlan(body);
  });

  app.post('/api/picking-planning/preview/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(pickingPlanningPreviewOrdersRequestSchema, request.body);
    return getPickingPlanningPreviewService(auth).previewPickingPlanFromOrders(body);
  });
}
