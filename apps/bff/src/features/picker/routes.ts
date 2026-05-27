import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { RouteDeps } from '../../route-deps.js';
import { ApiError } from '../../errors.js';
import { parseOrThrow } from '../../validation.js';
import { idResponseSchema, pickTaskDetailResponseSchema, pickTasksResponseSchema } from '../../schemas.js';
import { pickerConfirmStepBodySchema, pickerWorkerQuerySchema } from './schemas.js';
import { createPickerServiceFromSupabase } from './service.js';

type PickerRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase'>;

export function registerPickerRoutes(app: FastifyInstance, deps: PickerRouteDeps): void {
  function requireTenantId(currentTenant: { tenantId: string } | null): string {
    if (!currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    return currentTenant.tenantId;
  }

  app.get('/api/picker/tasks', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenantId(auth.currentTenant);
    // TODO: replace workerId query with auth.uid() -> manual_shift_workers.auth_user_id resolution.
    const query = parseOrThrow(pickerWorkerQuerySchema, request.query ?? {});
    const pickerService = createPickerServiceFromSupabase(deps.getUserSupabase(auth));
    const tasks = await pickerService.listTasks({
      tenantId,
      workerId: query.workerId
    });

    return parseOrThrow(pickTasksResponseSchema, tasks);
  });

  app.get('/api/picker/tasks/:taskId', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenantId(auth.currentTenant);
    // TODO: replace workerId query with auth.uid() -> manual_shift_workers.auth_user_id resolution.
    const query = parseOrThrow(pickerWorkerQuerySchema, request.query ?? {});
    const taskId = parseOrThrow(
      idResponseSchema,
      { id: (request.params as { taskId: string }).taskId }
    ).id;
    const pickerService = createPickerServiceFromSupabase(deps.getUserSupabase(auth));

    const task = await pickerService.getTaskDetail({
      tenantId,
      workerId: query.workerId,
      taskId
    });

    return parseOrThrow(pickTaskDetailResponseSchema, task);
  });

  app.post('/api/picker/tasks/:taskId/steps/:stepId/confirm', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenantId = requireTenantId(auth.currentTenant);
    // TODO: replace workerId query with auth.uid() -> manual_shift_workers.auth_user_id resolution.
    const query = parseOrThrow(pickerWorkerQuerySchema, request.query ?? {});
    const params = parseOrThrow(
      z.object({
        taskId: z.string().uuid(),
        stepId: z.string().uuid()
      }),
      request.params
    );
    const body = parseOrThrow(pickerConfirmStepBodySchema, request.body);
    const pickerService = createPickerServiceFromSupabase(deps.getUserSupabase(auth));

    const task = await pickerService.confirmStep({
      tenantId,
      workerId: query.workerId,
      taskId: params.taskId,
      stepId: params.stepId,
      qtyPicked: body.qtyPicked
    });

    return parseOrThrow(pickTaskDetailResponseSchema, task);
  });
}
