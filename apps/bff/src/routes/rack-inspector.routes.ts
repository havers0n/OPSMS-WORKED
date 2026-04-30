import type { FastifyInstance } from 'fastify';
import { ApiError } from '../errors.js';
import { createRackInspectorRepo } from '../features/rack-inspector/rack-inspector-repo.js';
import type { RouteDeps } from '../route-deps.js';
import { idResponseSchema, rackInspectorPayloadSchema } from '../schemas.js';
import { parseOrThrow } from '../validation.js';

type RackInspectorRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase'>;

export function registerRackInspectorRoutes(app: FastifyInstance, deps: RackInspectorRouteDeps): void {
  app.get('/api/racks/:rackId/inspector', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const rackId = parseOrThrow(idResponseSchema, { id: (request.params as { rackId: string }).rackId }).id;
    const supabase = deps.getUserSupabase(auth);
    const rackInspectorRepo = createRackInspectorRepo(supabase);
    const payload = await rackInspectorRepo.getRackInspector(rackId);

    if (!payload) {
      throw new ApiError(404, 'RACK_NOT_FOUND', `Rack ${rackId} not found.`);
    }

    return parseOrThrow(rackInspectorPayloadSchema, payload);
  });
}
