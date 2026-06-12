import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from '../route-deps.js';
import {
  idResponseSchema,
  moveContainerToLocationRequestBodySchema,
  moveContainerToLocationResponseSchema,
  swapContainersRequestBodySchema,
  swapContainersResponseSchema
} from '../schemas.js';
import { createExecutionService } from '../features/execution/service.js';
import {
  mapExecutionLocationMoveError,
  mapExecutionSwapError
} from '../features/execution/errors.js';
import { parseOrThrow } from '../validation.js';

type ContainerMovementRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase'>;

export function registerContainerMovementRoutes(app: FastifyInstance, deps: ContainerMovementRouteDeps): void {
  app.post('/api/containers/:containerId/move-to-location', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(moveContainerToLocationRequestBodySchema, request.body);
    const supabase = deps.getUserSupabase(auth);
    const executionService = createExecutionService(supabase);

    try {
      const result = await executionService.moveContainerCanonical({
        containerId,
        targetLocationId: body.targetLocationId,
        actorId: auth.user.id
      });

      return parseOrThrow(moveContainerToLocationResponseSchema, result);
    } catch (error) {
      throw mapExecutionLocationMoveError(error) ?? error;
    }
  });

  app.post('/api/containers/:containerId/swap', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(swapContainersRequestBodySchema, request.body);
    const supabase = deps.getUserSupabase(auth);
    const executionService = createExecutionService(supabase);

    try {
      const result = await executionService.swapContainersCanonical({
        sourceContainerId: containerId,
        targetContainerId: body.targetContainerId,
        actorId: auth.user.id
      });

      return parseOrThrow(swapContainersResponseSchema, result);
    } catch (error) {
      throw mapExecutionSwapError(error) ?? error;
    }
  });
}
