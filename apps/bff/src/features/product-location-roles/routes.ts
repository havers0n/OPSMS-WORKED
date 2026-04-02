import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiError, mapSupabaseError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { ProductLocationRolesService } from './service.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetProductLocationRolesService = (
  context: AuthenticatedRequestContext
) => ProductLocationRolesService;

const uuidSchema = z.string().uuid();

const createBodySchema = z.object({
  locationId: z.string().uuid(),
  productId: z.string().uuid(),
  role: z.enum(['primary_pick', 'reserve'])
});

export function registerProductLocationRolesRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getProductLocationRolesService: GetProductLocationRolesService;
  }
): void {
  const { getAuthContext, getProductLocationRolesService } = deps;

  // GET /api/locations/:locationId/product-assignments
  app.get('/api/locations/:locationId/product-assignments', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = auth.currentTenant?.tenantId;
    if (!tenantId) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace.');
    }

    const locationId = uuidSchema.parse(
      (request.params as { locationId: string }).locationId
    );

    const assignments = await getProductLocationRolesService(auth).listByLocationId(
      tenantId,
      locationId
    );
    return assignments;
  });

  // POST /api/product-location-roles
  app.post('/api/product-location-roles', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = auth.currentTenant?.tenantId;
    if (!tenantId) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace.');
    }

    const body = createBodySchema.parse(request.body);

    try {
      const assignment = await getProductLocationRolesService(auth).create({
        tenantId,
        productId: body.productId,
        locationId: body.locationId,
        role: body.role
      });
      return reply.code(201).send(assignment);
    } catch (error) {
      const apiError = mapSupabaseError(error);
      if (apiError) throw apiError;
      throw error;
    }
  });

  // DELETE /api/product-location-roles/:roleId
  app.delete('/api/product-location-roles/:roleId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = auth.currentTenant?.tenantId;
    if (!tenantId) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace.');
    }

    const roleId = uuidSchema.parse(
      (request.params as { roleId: string }).roleId
    );

    try {
      await getProductLocationRolesService(auth).delete(tenantId, roleId);
    } catch (error) {
      const apiError = mapSupabaseError(error);
      if (apiError) throw apiError;
      throw error;
    }

    return reply.code(204).send();
  });
}
