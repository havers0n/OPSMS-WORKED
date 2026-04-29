import type { FastifyInstance } from 'fastify';
import { currentWorkspaceResponseSchema } from '../schemas.js';
import type { RouteDeps } from '../route-deps.js';

type MeRouteDeps = Pick<RouteDeps, 'getAuthContext'>;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerMeRoutes(app: FastifyInstance, deps: MeRouteDeps): void {
  app.get('/api/me', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    return parseOrThrow(currentWorkspaceResponseSchema, {
      user: {
        id: auth.user.id,
        email: auth.user.email ?? 'unknown@local.invalid',
        displayName: auth.displayName
      },
      currentTenantId: auth.currentTenant?.tenantId ?? null,
      memberships: auth.memberships
    });
  });
}
