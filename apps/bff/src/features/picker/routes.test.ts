import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { registerPickerRoutes } from './routes.js';
import type { PickerService } from './service.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  authUser: '88888888-8888-4888-8888-888888888888',
  workerA: '22222222-2222-4222-8222-222222222222',
  workerB: '33333333-3333-4333-8333-333333333333',
  taskA: '44444444-4444-4444-8444-444444444444',
  taskB: '55555555-5555-4555-8555-555555555555',
  stepA: '66666666-6666-4666-8666-666666666666',
  stepB: '77777777-7777-4777-8777-777777777777'
};

function makeAuth(overrides: Partial<{ userId: string; tenantId: string }> = {}): AuthenticatedRequestContext {
  return {
    accessToken: 'token',
    user: {
      id: overrides.userId ?? ids.authUser,
      email: 'picker@wos.local'
    },
    displayName: 'Picker User',
    memberships: [
      {
        tenantId: overrides.tenantId ?? ids.tenant,
        tenantCode: 'default',
        tenantName: 'Default Tenant',
        role: 'tenant_admin' as const
      }
    ],
    currentTenant: {
      tenantId: overrides.tenantId ?? ids.tenant,
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'tenant_admin' as const
    }
  } as unknown as AuthenticatedRequestContext;
}

function taskSummary(taskId: string, workerId: string) {
  return {
    id: taskId,
    taskNumber: `PT-${taskId.slice(0, 4)}`,
    tenantId: ids.tenant,
    sourceType: 'manual_shift_order' as const,
    sourceId: '99999999-9999-4999-8999-999999999999',
    status: 'assigned' as const,
    assignedTo: null,
    assignedWorkerId: workerId,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-05-27T10:00:00.000Z',
    totalSteps: 2,
    completedSteps: 0,
    exceptionSteps: 0
  };
}

function taskDetail(taskId: string, workerId: string, overrides: Partial<{ status: 'assigned' | 'in_progress' | 'completed'; completedSteps: number; totalSteps: number }> = {}) {
  const totalSteps = overrides.totalSteps ?? 2;
  const completedSteps = overrides.completedSteps ?? 0;
  const firstStepStatus: 'pending' | 'picked' = completedSteps > 0 ? 'picked' : 'pending';
  const secondStepStatus: 'pending' | 'picked' = overrides.status === 'completed' ? 'picked' : 'pending';
  return {
    id: taskId,
    taskNumber: `PT-${taskId.slice(0, 4)}`,
    tenantId: ids.tenant,
    sourceType: 'manual_shift_order' as const,
    sourceId: '99999999-9999-4999-8999-999999999999',
    status: overrides.status ?? 'assigned',
    assignedTo: null,
    assignedWorkerId: workerId,
    startedAt: null,
    completedAt: overrides.status === 'completed' ? '2026-05-27T10:30:00.000Z' : null,
    createdAt: '2026-05-27T10:00:00.000Z',
    totalSteps,
    completedSteps,
    steps: [
      {
        id: ids.stepA,
        taskId,
        tenantId: ids.tenant,
        orderId: null,
        orderLineId: null,
        sequenceNo: 1,
        sku: 'A',
        itemName: 'Item A',
        qtyRequired: 2,
        qtyPicked: completedSteps > 0 ? 2 : 0,
        status: firstStepStatus,
        sourceLocationId: null,
        sourceCellId: null,
        sourceContainerId: null,
        inventoryUnitId: null,
        pickContainerId: null,
        executedAt: completedSteps > 0 ? '2026-05-27T10:20:00.000Z' : null,
        executedBy: null,
        sourceLocationCode: null,
        sourceCellAddress: null,
        sourceContainerCode: null,
        sourceFloorId: null,
        imageUrl: null,
        orderNumber: null
      },
      {
        id: ids.stepB,
        taskId,
        tenantId: ids.tenant,
        orderId: null,
        orderLineId: null,
        sequenceNo: 2,
        sku: 'B',
        itemName: 'Item B',
        qtyRequired: 1,
        qtyPicked: overrides.status === 'completed' ? 1 : 0,
        status: secondStepStatus,
        sourceLocationId: null,
        sourceCellId: null,
        sourceContainerId: null,
        inventoryUnitId: null,
        pickContainerId: null,
        executedAt: overrides.status === 'completed' ? '2026-05-27T10:25:00.000Z' : null,
        executedBy: null,
        sourceLocationCode: null,
        sourceCellAddress: null,
        sourceContainerCode: null,
        sourceFloorId: null,
        imageUrl: null,
        orderNumber: null
      }
    ].slice(0, totalSteps)
  };
}

const serviceMocks = vi.hoisted(() => {
  return {
    resolveWorker: vi.fn<PickerService['resolveWorker']>(),
    listTasks: vi.fn<PickerService['listTasks']>(),
    getTaskDetail: vi.fn<PickerService['getTaskDetail']>(),
    confirmStep: vi.fn<PickerService['confirmStep']>()
  };
});

vi.mock('./service.js', () => ({
  createPickerServiceFromSupabase: () => serviceMocks
}));

async function buildTestApp(auth: AuthenticatedRequestContext | null = makeAuth()) {
  const app = Fastify({ logger: false });

  registerPickerRoutes(app, {
    getAuthContext: async (_request: FastifyRequest, reply: FastifyReply) => {
      if (!auth) {
        await reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Missing bearer token.' });
        return null;
      }
      return auth;
    },
    getUserSupabase: () => ({} as never)
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ code: error.code, message: error.message });
    }

    return reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected test error'
    });
  });

  await app.ready();
  return app;
}

describe('picker routes — auth-based worker resolution', () => {
  beforeEach(() => {
    serviceMocks.resolveWorker.mockReset();
    serviceMocks.listTasks.mockReset();
    serviceMocks.getTaskDetail.mockReset();
    serviceMocks.confirmStep.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('unauthenticated', () => {
    it('GET /api/picker/tasks returns 401', async () => {
      const app = await buildTestApp(null);
      const response = await app.inject({ method: 'GET', url: '/api/picker/tasks' });
      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('GET /api/picker/tasks/:taskId returns 401', async () => {
      const app = await buildTestApp(null);
      const response = await app.inject({ method: 'GET', url: `/api/picker/tasks/${ids.taskA}` });
      expect(response.statusCode).toBe(401);
      await app.close();
    });

    it('POST confirm step returns 401', async () => {
      const app = await buildTestApp(null);
      const response = await app.inject({
        method: 'POST',
        url: `/api/picker/tasks/${ids.taskA}/steps/${ids.stepA}/confirm`,
        payload: { qtyPicked: 2 }
      });
      expect(response.statusCode).toBe(401);
      await app.close();
    });
  });

  describe('unbound account', () => {
    it('returns 403 PICKER_WORKER_NOT_BOUND when no worker is bound to auth user', async () => {
      serviceMocks.resolveWorker.mockRejectedValue(new ApiError(403, 'PICKER_WORKER_NOT_BOUND', 'not bound'));
      const app = await buildTestApp();

      const response = await app.inject({ method: 'GET', url: '/api/picker/tasks' });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'PICKER_WORKER_NOT_BOUND' });

      await app.close();
    });
  });

  describe('inactive worker', () => {
    it('returns 403 PICKER_WORKER_INACTIVE when worker is inactive', async () => {
      serviceMocks.resolveWorker.mockRejectedValue(new ApiError(403, 'PICKER_WORKER_INACTIVE', 'inactive'));
      const app = await buildTestApp();

      const response = await app.inject({ method: 'GET', url: '/api/picker/tasks' });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'PICKER_WORKER_INACTIVE' });

      await app.close();
    });
  });

  describe('bound active worker', () => {
    it('GET /api/picker/tasks returns only own tasks', async () => {
      serviceMocks.resolveWorker.mockResolvedValue({ workerId: ids.workerA });
      serviceMocks.listTasks.mockResolvedValue([taskSummary(ids.taskA, ids.workerA)]);
      const app = await buildTestApp();

      const response = await app.inject({ method: 'GET', url: '/api/picker/tasks' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(1);
      expect(serviceMocks.resolveWorker).toHaveBeenCalledWith(ids.tenant, ids.authUser);
      expect(serviceMocks.listTasks).toHaveBeenCalledWith({ tenantId: ids.tenant, workerId: ids.workerA });

      await app.close();
    });

    it('GET /api/picker/tasks/:taskId returns task detail', async () => {
      serviceMocks.resolveWorker.mockResolvedValue({ workerId: ids.workerA });
      serviceMocks.getTaskDetail.mockResolvedValue(taskDetail(ids.taskA, ids.workerA));
      const app = await buildTestApp();

      const response = await app.inject({ method: 'GET', url: `/api/picker/tasks/${ids.taskA}` });

      expect(response.statusCode).toBe(200);
      expect(serviceMocks.getTaskDetail).toHaveBeenCalledWith({
        tenantId: ids.tenant,
        workerId: ids.workerA,
        taskId: ids.taskA
      });

      await app.close();
    });

    it('confirm step calls confirmStep with resolved worker', async () => {
      serviceMocks.resolveWorker.mockResolvedValue({ workerId: ids.workerA });
      serviceMocks.confirmStep.mockResolvedValue(taskDetail(ids.taskA, ids.workerA));
      const app = await buildTestApp();

      const response = await app.inject({
        method: 'POST',
        url: `/api/picker/tasks/${ids.taskA}/steps/${ids.stepA}/confirm`,
        payload: { qtyPicked: 2 }
      });

      expect(response.statusCode).toBe(200);
      expect(serviceMocks.confirmStep).toHaveBeenCalledWith({
        tenantId: ids.tenant,
        workerId: ids.workerA,
        taskId: ids.taskA,
        stepId: ids.stepA,
        qtyPicked: 2
      });

      await app.close();
    });

    it('confirming final step marks task completed', async () => {
      serviceMocks.resolveWorker.mockResolvedValue({ workerId: ids.workerA });
      serviceMocks.confirmStep.mockResolvedValue(taskDetail(ids.taskA, ids.workerA, { status: 'completed', completedSteps: 2 }));
      const app = await buildTestApp();

      const response = await app.inject({
        method: 'POST',
        url: `/api/picker/tasks/${ids.taskA}/steps/${ids.stepB}/confirm`,
        payload: { qtyPicked: 1 }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: 'completed', completedSteps: 2, totalSteps: 2 });

      await app.close();
    });
  });

  describe('workerId query injection is ignored', () => {
    it('ignores ?workerId= query param and resolves from auth', async () => {
      serviceMocks.resolveWorker.mockResolvedValue({ workerId: ids.workerA });
      serviceMocks.listTasks.mockResolvedValue([taskSummary(ids.taskA, ids.workerA)]);
      const app = await buildTestApp();

      const response = await app.inject({
        method: 'GET',
        url: `/api/picker/tasks?workerId=${ids.workerB}`
      });

      expect(response.statusCode).toBe(200);
      expect(serviceMocks.listTasks).toHaveBeenCalledWith({ tenantId: ids.tenant, workerId: ids.workerA });

      await app.close();
    });
  });
});
