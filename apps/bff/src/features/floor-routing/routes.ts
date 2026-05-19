import type { FastifyInstance } from 'fastify';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { RouteDeps } from '../../route-deps.js';
import { idResponseSchema } from '../../schemas.js';
import { parseOrThrow } from '../../validation.js';
import {
  createRouteGraphEdgeRequestSchema,
  createRouteGraphNodeRequestSchema,
  patchRouteGraphEdgeRequestSchema,
  patchRouteGraphNodeRequestSchema,
  routeGraphDtoSchema,
  routeGraphEdgeDtoSchema,
  routeGraphNodeDtoSchema,
  shortestFloorPathRequestSchema,
  shortestFloorPathResponseSchema
} from './schema.js';

type FloorRoutingRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getFloorRoutingService'>;

function parseRouteId(params: unknown, key: string): string {
  return parseOrThrow(idResponseSchema, {
    id: (params as Record<string, string>)[key]
  }).id;
}

function requireCurrentTenant(auth: AuthenticatedRequestContext) {
  if (!auth.currentTenant) {
    throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for floor routing.');
  }

  return auth.currentTenant;
}

function requireRouteGraphManager(auth: AuthenticatedRequestContext): void {
  const role = auth.currentTenant?.role;
  if (role !== 'tenant_admin' && role !== 'platform_admin') {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to manage floor routing.');
  }
}

export function registerFloorRoutingRoutes(app: FastifyInstance, deps: FloorRoutingRouteDeps): void {
  app.get('/api/floors/:floorId/routing/graph', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    const floorId = parseRouteId(request.params, 'floorId');

    const graph = await deps.getFloorRoutingService(auth).getGraph({
      tenantId: tenant.tenantId,
      floorId
    });

    return parseOrThrow(routeGraphDtoSchema, graph);
  });

  app.post('/api/floors/:floorId/routing/nodes', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    requireRouteGraphManager(auth);
    const floorId = parseRouteId(request.params, 'floorId');
    const body = parseOrThrow(createRouteGraphNodeRequestSchema, request.body);

    const node = await deps.getFloorRoutingService(auth).createNode({
      tenantId: tenant.tenantId,
      floorId,
      body
    });

    return reply.code(201).send(parseOrThrow(routeGraphNodeDtoSchema, node));
  });

  app.patch('/api/floors/:floorId/routing/nodes/:nodeId', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    requireRouteGraphManager(auth);
    const floorId = parseRouteId(request.params, 'floorId');
    const nodeId = parseRouteId(request.params, 'nodeId');
    const body = parseOrThrow(patchRouteGraphNodeRequestSchema, request.body);

    const node = await deps.getFloorRoutingService(auth).patchNode({
      tenantId: tenant.tenantId,
      floorId,
      nodeId,
      body
    });

    return parseOrThrow(routeGraphNodeDtoSchema, node);
  });

  app.delete('/api/floors/:floorId/routing/nodes/:nodeId', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    requireRouteGraphManager(auth);
    const floorId = parseRouteId(request.params, 'floorId');
    const nodeId = parseRouteId(request.params, 'nodeId');

    await deps.getFloorRoutingService(auth).deleteNode({
      tenantId: tenant.tenantId,
      floorId,
      nodeId
    });

    return reply.code(204).send();
  });

  app.post('/api/floors/:floorId/routing/edges', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    requireRouteGraphManager(auth);
    const floorId = parseRouteId(request.params, 'floorId');
    const body = parseOrThrow(createRouteGraphEdgeRequestSchema, request.body);

    const edge = await deps.getFloorRoutingService(auth).createEdge({
      tenantId: tenant.tenantId,
      floorId,
      body
    });

    return reply.code(201).send(parseOrThrow(routeGraphEdgeDtoSchema, edge));
  });

  app.patch('/api/floors/:floorId/routing/edges/:edgeId', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    requireRouteGraphManager(auth);
    const floorId = parseRouteId(request.params, 'floorId');
    const edgeId = parseRouteId(request.params, 'edgeId');
    const body = parseOrThrow(patchRouteGraphEdgeRequestSchema, request.body);

    const edge = await deps.getFloorRoutingService(auth).patchEdge({
      tenantId: tenant.tenantId,
      floorId,
      edgeId,
      body
    });

    return parseOrThrow(routeGraphEdgeDtoSchema, edge);
  });

  app.delete('/api/floors/:floorId/routing/edges/:edgeId', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    requireRouteGraphManager(auth);
    const floorId = parseRouteId(request.params, 'floorId');
    const edgeId = parseRouteId(request.params, 'edgeId');

    await deps.getFloorRoutingService(auth).deleteEdge({
      tenantId: tenant.tenantId,
      floorId,
      edgeId
    });

    return reply.code(204).send();
  });

  app.post('/api/floors/:floorId/routing/shortest-path', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);

    const floorId = parseRouteId(request.params, 'floorId');
    const body = parseOrThrow(shortestFloorPathRequestSchema, request.body);

    const response = await deps.getFloorRoutingService(auth).getShortestPath({
      tenantId: tenant.tenantId,
      floorId,
      startNodeId: body.startNodeId,
      endNodeId: body.endNodeId
    });

    return parseOrThrow(shortestFloorPathResponseSchema, response);
  });
}
