import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from '../route-deps.js';
import {
  idResponseSchema,
  transferInventoryUnitRequestBodySchema,
  transferInventoryUnitResponseSchema,
  pickPartialInventoryUnitRequestBodySchema,
  pickPartialInventoryUnitResponseSchema
} from '../schemas.js';
import { createExecutionService } from '../features/execution/service.js';
import { mapExecutionTransferError } from '../features/execution/errors.js';

type InventoryMovementRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase'>;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerInventoryMovementRoutes(app: FastifyInstance, deps: InventoryMovementRouteDeps): void {
  app.post('/api/inventory/:inventoryUnitId/transfer', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const inventoryUnitId = parseOrThrow(idResponseSchema, { id: (request.params as { inventoryUnitId: string }).inventoryUnitId }).id;
    const body = parseOrThrow(transferInventoryUnitRequestBodySchema, request.body);
    const supabase = deps.getUserSupabase(auth);
    const executionService = createExecutionService(supabase);

    try {
      const result = await executionService.transferStock({
        inventoryUnitId,
        quantity: body.quantity,
        targetContainerId: body.targetContainerId,
        actorId: auth.user.id
      });

      return parseOrThrow(transferInventoryUnitResponseSchema, result);
    } catch (error) {
      throw mapExecutionTransferError(error) ?? error;
    }
  });

  app.post('/api/inventory/:inventoryUnitId/pick-partial', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const inventoryUnitId = parseOrThrow(idResponseSchema, { id: (request.params as { inventoryUnitId: string }).inventoryUnitId }).id;
    const body = parseOrThrow(pickPartialInventoryUnitRequestBodySchema, request.body);
    const supabase = deps.getUserSupabase(auth);
    const executionService = createExecutionService(supabase);

    try {
      const result = await executionService.pickPartial({
        inventoryUnitId,
        quantity: body.quantity,
        pickContainerId: body.pickContainerId,
        actorId: auth.user.id
      });

      return parseOrThrow(pickPartialInventoryUnitResponseSchema, result);
    } catch (error) {
      throw mapExecutionTransferError(error) ?? error;
    }
  });
}
