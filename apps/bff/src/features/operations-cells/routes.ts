import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from '../../route-deps.js';
import { idResponseSchema, operationsCellsRuntimeResponseSchema } from '../../schemas.js';
import { listOperationsCellsRuntime } from './service.js';
import { parseOrThrow } from '../../validation.js';

type OperationsCellsRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase'>;

export function registerOperationsCellsRoutes(app: FastifyInstance, deps: OperationsCellsRouteDeps): void {
  app.get('/api/floors/:floorId/operations-cells', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;

    const response = await listOperationsCellsRuntime({ supabase: deps.getUserSupabase(auth) }, floorId);
    return parseOrThrow(operationsCellsRuntimeResponseSchema, response);
  });
}
