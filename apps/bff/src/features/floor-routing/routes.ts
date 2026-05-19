import type { FastifyInstance } from 'fastify';
import { ApiError } from '../../errors.js';
import type { RouteDeps } from '../../route-deps.js';
import { idResponseSchema } from '../../schemas.js';
import { parseOrThrow } from '../../validation.js';
import { shortestFloorPathRequestSchema, shortestFloorPathResponseSchema } from './schema.js';

type FloorRoutingRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getFloorRoutingService'>;

export function registerFloorRoutingRoutes(app: FastifyInstance, deps: FloorRoutingRouteDeps): void {
  app.post('/api/floors/:floorId/routing/shortest-path', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for floor routing.');
    }

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const body = parseOrThrow(shortestFloorPathRequestSchema, request.body);

    const response = await deps.getFloorRoutingService(auth).getShortestPath({
      tenantId: auth.currentTenant.tenantId,
      floorId,
      startNodeId: body.startNodeId,
      endNodeId: body.endNodeId
    });

    return parseOrThrow(shortestFloorPathResponseSchema, response);
  });
}
