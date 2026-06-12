import type { FastifyInstance } from 'fastify';
import { createLayoutRepo } from '../../features/layout/repo.js';
import { ApiError } from '../../errors.js';
import { createAisleTopologyRepo } from '../../features/location-read/aisle-topology.js';
import {
  createFloorBodySchema,
  floorAisleTopologyResponseSchema,
  floorWorkspaceResponseSchema,
  floorsResponseSchema,
  idResponseSchema
} from '../../schemas.js';
import type { RouteDeps } from '../../route-deps.js';
import { parseOrThrow } from '../../validation.js';

type FloorsRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getFloorsService' | 'getSitesService' | 'getUserSupabase'>;

export function registerFloorsRoutes(app: FastifyInstance, deps: FloorsRouteDeps): void {
  app.get('/api/sites/:siteId/floors', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const siteId = parseOrThrow(idResponseSchema, { id: (request.params as { siteId: string }).siteId }).id;
    const floors = await deps.getSitesService(auth).listFloors(siteId);
    return parseOrThrow(floorsResponseSchema, floors);
  });

  app.post('/api/floors', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createFloorBodySchema, request.body);
    const id = await deps.getFloorsService(auth).createFloor(body);
    return parseOrThrow(idResponseSchema, { id });
  });

  app.get('/api/floors/:floorId/workspace', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = deps.getUserSupabase(auth);
    const layoutRepo = createLayoutRepo(supabase);
    const [activeDraft, latestPublished] = await Promise.all([
      layoutRepo.findActiveDraft(floorId),
      layoutRepo.findLatestPublished(floorId)
    ]);

    return parseOrThrow(floorWorkspaceResponseSchema, {
      floorId,
      activeDraft,
      latestPublished
    });
  });

  app.get('/api/floors/:floorId/aisle-topology', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for floor topology.');
    }

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = deps.getUserSupabase(auth);
    const topology = await createAisleTopologyRepo(supabase).getFloorAisleTopology(
      auth.currentTenant.tenantId,
      floorId
    );

    if (!topology) {
      throw new ApiError(404, 'FLOOR_NOT_FOUND', 'Floor was not found.');
    }

    return parseOrThrow(floorAisleTopologyResponseSchema, topology);
  });
}
