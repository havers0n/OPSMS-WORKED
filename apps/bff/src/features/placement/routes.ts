import type { FastifyInstance } from 'fastify';
import { ApiError } from '../../errors.js';
import type { RouteDeps } from '../../route-deps.js';
import { placementPlaceAtLocationBodySchema } from '../../schemas.js';
import { mapPlacementError } from './errors.js';
import { parseOrThrow } from '../../validation.js';

type PlacementRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getPlacementService'>;

export function registerPlacementRoutes(app: FastifyInstance, deps: PlacementRouteDeps): void {
  app.post('/api/placement/place-at-location', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for placement writes.');
    }

    const body = parseOrThrow(placementPlaceAtLocationBodySchema, request.body);
    const service = deps.getPlacementService(auth);

    try {
      const result = await service.placeContainerAtLocation({
        tenantId: auth.currentTenant.tenantId,
        containerId: body.containerId,
        locationId: body.locationId,
        actorId: auth.user.id
      });

      return result;
    } catch (error) {
      const apiError = mapPlacementError(error);
      if (apiError) {
        throw apiError;
      }

      throw error;
    }
  });
}
