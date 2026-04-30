import type { FastifyInstance } from 'fastify';
import { createLocationReadRepo } from '../features/location-read/location-read-repo.js';
import type { RouteDeps } from '../route-deps.js';
import { idResponseSchema, patchLocationGeometryBodySchema } from '../schemas.js';
import { parseOrThrow } from '../validation.js';

type LocationMutationsRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase'>;

export function registerLocationMutationsRoutes(app: FastifyInstance, deps: LocationMutationsRouteDeps): void {
  app.patch('/api/locations/:locationId/geometry', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const locationId = parseOrThrow(idResponseSchema, {
      id: (request.params as { locationId: string }).locationId
    }).id;
    const body = parseOrThrow(patchLocationGeometryBodySchema, request.body);
    const supabase = deps.getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const row = await locationReadRepo.updateLocationGeometry(locationId, body.floorX, body.floorY);

    if (!row) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Location not found or is a rack slot' });
    }

    return {
      id: row.id,
      code: row.code,
      locationType: row.location_type,
      floorX: row.floor_x,
      floorY: row.floor_y,
      status: row.status
    };
  });
}
