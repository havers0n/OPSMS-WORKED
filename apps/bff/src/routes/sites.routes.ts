import type { FastifyInstance } from 'fastify';
import { ApiError } from '../errors.js';
import { createSiteBodySchema, idResponseSchema, sitesResponseSchema } from '../schemas.js';
import type { RouteDeps } from '../route-deps.js';

type SitesRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getSitesService'>;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerSitesRoutes(app: FastifyInstance, deps: SitesRouteDeps): void {
  app.get('/api/sites', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const sites = await deps.getSitesService(auth).listSites();
    return parseOrThrow(sitesResponseSchema, sites);
  });

  app.post('/api/sites', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createSiteBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for site creation.');
    }

    const id = await deps.getSitesService(auth).createSite({
      tenantId: auth.currentTenant.tenantId,
      code: body.code,
      name: body.name,
      timezone: body.timezone
    });
    return parseOrThrow(idResponseSchema, { id });
  });
}
