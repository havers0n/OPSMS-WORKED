import type { FastifyInstance } from 'fastify';
import { ApiError } from '../errors.js';
import type { RouteDeps } from '../route-deps.js';
import {
  allocatePickStepsResponseSchema,
  executePickStepBodySchema,
  executePickStepResponseSchema,
  idResponseSchema,
  pickTaskDetailResponseSchema,
  pickTasksResponseSchema
} from '../schemas.js';
import { createOrdersRepo } from '../features/orders/repo.js';
import { mapPickingError } from '../features/picking/errors.js';
import { createPickReadRepo } from '../features/picking/pick-read-repo.js';
import { parseOrThrow } from '../validation.js';

type PickingExecutionRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase' | 'getPickingService'>;

export function registerPickingExecutionRoutes(app: FastifyInstance, deps: PickingExecutionRouteDeps): void {
  app.get('/api/orders/:orderId/execution', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const supabase = deps.getUserSupabase(auth);
    const ordersRepo = createOrdersRepo(supabase);
    const execution = await ordersRepo.listOrderExecutionPickTasks(orderId);

    return parseOrThrow(pickTasksResponseSchema, execution);
  });

  app.get('/api/pick-tasks/:taskId', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const taskId = parseOrThrow(
      idResponseSchema,
      { id: (request.params as { taskId: string }).taskId }
    ).id;
    const supabase = deps.getUserSupabase(auth);
    const pickReadRepo = createPickReadRepo(supabase);
    const detail = await pickReadRepo.findPickTaskDetail(taskId);

    if (!detail) {
      throw new ApiError(404, 'PICK_TASK_NOT_FOUND', `Pick task ${taskId} not found.`);
    }

    return parseOrThrow(pickTaskDetailResponseSchema, detail);
  });

  app.post('/api/pick-tasks/:taskId/allocate', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const taskId = parseOrThrow(
      idResponseSchema,
      { id: (request.params as { taskId: string }).taskId }
    ).id;
    const pickingService = deps.getPickingService(auth);

    try {
      const result = await pickingService.allocatePickSteps({ taskId });
      return parseOrThrow(allocatePickStepsResponseSchema, result);
    } catch (error) {
      throw mapPickingError(error) ?? error;
    }
  });

  app.post('/api/pick-steps/:stepId/execute', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const stepId = parseOrThrow(
      idResponseSchema,
      { id: (request.params as { stepId: string }).stepId }
    ).id;
    const body = parseOrThrow(executePickStepBodySchema, request.body);
    const pickingService = deps.getPickingService(auth);

    try {
      const result = await pickingService.executePickStep({
        stepId,
        qtyActual: body.qtyActual,
        pickContainerId: body.pickContainerId,
        actorId: auth.user.id
      });
      return parseOrThrow(executePickStepResponseSchema, result);
    } catch (error) {
      throw mapPickingError(error) ?? error;
    }
  });
}
