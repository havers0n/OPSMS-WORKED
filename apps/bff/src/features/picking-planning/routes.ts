import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { type PickingPlanningPreviewService } from './service.js';
import { mapPlanningPreviewToResponse } from './response-mapper.js';
import {
  pickingPlanningPreviewOrdersRequestSchema,
  pickingPlanningPreviewRequestSchema,
  pickingPlanningPreviewWaveRequestSchema
} from './schema.js';
import { parseOrThrow } from '../../validation.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetPickingPlanningPreviewService = (
  context: AuthenticatedRequestContext
) => PickingPlanningPreviewService;

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
    const planning = getPickingPlanningPreviewService(auth).previewPickingPlan(body);

    return mapPlanningPreviewToResponse({
      kind: 'explicit',
      planning,
      input: {
        strategyMethod: body.strategyMethod,
        routeMode: body.routeMode
      },
      locationsById: body.locationsById
    });
  });

  app.post('/api/picking-planning/preview/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(pickingPlanningPreviewOrdersRequestSchema, request.body);
    const preview = await getPickingPlanningPreviewService(auth).previewPickingPlanFromOrders(body);

    return mapPlanningPreviewToResponse({
      kind: 'orders',
      planning: preview.planning,
      input: {
        orderIds: body.orderIds,
        strategyMethod: body.strategyMethod,
        routeMode: body.routeMode
      },
      unresolved: preview.unresolved,
      unresolvedSummary: preview.unresolvedSummary,
      coverage: preview.coverage,
      locationsById: preview.locationsById,
      extraWarnings: preview.warnings,
      extraWarningDetails: preview.warningDetails
    });
  });

  app.post('/api/picking-planning/preview/wave', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(pickingPlanningPreviewWaveRequestSchema, request.body);
    const preview = await getPickingPlanningPreviewService(auth).previewPickingPlanFromWave(body);

    return mapPlanningPreviewToResponse({
      kind: 'wave',
      planning: preview.planning,
      input: {
        waveId: preview.waveId,
        orderIds: preview.orderIds,
        strategyMethod: body.strategyMethod,
        routeMode: body.routeMode
      },
      unresolved: preview.unresolved,
      unresolvedSummary: preview.unresolvedSummary,
      coverage: preview.coverage,
      locationsById: preview.locationsById,
      extraWarnings: preview.warnings,
      extraWarningDetails: preview.warningDetails
    });
  });
}
