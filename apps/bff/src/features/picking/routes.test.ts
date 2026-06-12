import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { PickStepNotExecutableError, PickStepNotFoundError, PickTaskNotFoundError } from './errors.js';

const ids = {
  tenant: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
  user: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d',
  order: 'd1a2b3c4-0000-4000-8000-000000000001',
  task: 'e1a2b3c4-0000-4000-8000-000000000002',
  step: 'f1a2b3c4-0000-4000-8000-000000000003',
  container: 'a1a2b3c4-0000-4000-8000-000000000004'
};

const authContext = {
  accessToken: 'token',
  user: { id: ids.user, email: 'operator@wos.local' },
  displayName: 'Local Operator',
  memberships: [{
    tenantId: ids.tenant,
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }],
  currentTenant: {
    tenantId: ids.tenant,
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }
};

const pickTaskSummary = {
  id: ids.task,
  taskNumber: 'PT-0001',
  tenantId: ids.tenant,
  sourceType: 'order' as const,
  sourceId: ids.order,
  status: 'in_progress' as const,
  assignedTo: null,
  assignedWorkerId: null,
  startedAt: '2026-06-01T08:00:00.000Z',
  completedAt: null,
  createdAt: '2026-06-01T07:00:00.000Z',
  totalSteps: 3,
  completedSteps: 1,
  exceptionSteps: 0
};

const pickTaskDetail = {
  id: ids.task,
  taskNumber: 'PT-0001',
  tenantId: ids.tenant,
  sourceType: 'order' as const,
  sourceId: ids.order,
  status: 'in_progress' as const,
  assignedTo: null,
  assignedWorkerId: null,
  startedAt: '2026-06-01T08:00:00.000Z',
  completedAt: null,
  createdAt: '2026-06-01T07:00:00.000Z',
  totalSteps: 1,
  completedSteps: 0,
  steps: [{
    id: ids.step,
    taskId: ids.task,
    tenantId: ids.tenant,
    orderId: ids.order,
    orderLineId: null,
    sequenceNo: 1,
    sku: 'SKU-001',
    itemName: 'Test Item',
    qtyRequired: 5,
    qtyPicked: 0,
    status: 'pending' as const,
    sourceLocationId: null,
    sourceCellId: null,
    sourceContainerId: null,
    inventoryUnitId: null,
    pickContainerId: null,
    executedAt: null,
    executedBy: null,
    sourceLocationCode: null,
    sourceCellAddress: null,
    sourceContainerCode: null,
    sourceFloorId: null,
    imageUrl: null,
    orderNumber: null
  }]
};

const allocateResult = {
  taskId: ids.task,
  allocated: 3,
  needsReplenishment: 0
};

const executeResult = {
  stepId: ids.step,
  status: 'picked' as const,
  qtyPicked: 5,
  taskId: ids.task,
  taskStatus: 'in_progress' as const,
  orderStatus: null,
  waveStatus: null,
  movementId: null
};

const skipResult = {
  stepId: ids.step,
  status: 'skipped' as const,
  qtyPicked: 0,
  taskId: ids.task,
  taskStatus: 'in_progress' as const,
  orderStatus: null,
  waveStatus: null,
  movementId: null
};

// ── Module-level mocks ──────────────────────────────────────────────────────────

let mockOrdersRepo: { listOrderExecutionPickTasks: ReturnType<typeof vi.fn> };
let mockPickReadRepo: { findPickTaskDetail: ReturnType<typeof vi.fn> };

function createOrdersRepoMock() {
  mockOrdersRepo = {
    listOrderExecutionPickTasks: vi.fn()
  };
  return mockOrdersRepo;
}

function createPickReadRepoMock() {
  mockPickReadRepo = {
    findPickTaskDetail: vi.fn()
  };
  return mockPickReadRepo;
}

vi.mock('../orders/repo.js', () => ({
  createOrdersRepo: vi.fn(() => mockOrdersRepo)
}));

vi.mock('./pick-read-repo.js', () => ({
  createPickReadRepo: vi.fn(() => mockPickReadRepo)
}));

function mockPickingService(overrides: Record<string, ReturnType<typeof vi.fn>>) {
  return {
    allocatePickSteps: overrides.allocatePickSteps ?? vi.fn(),
    executePickStep: overrides.executePickStep ?? vi.fn(),
    skipPickStep: overrides.skipPickStep ?? vi.fn()
  };
}

describe('picking execution routes', () => {
  beforeEach(() => {
    createOrdersRepoMock();
    createPickReadRepoMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── A. GET /api/orders/:orderId/execution ─────────────────────────────────────

  describe('GET /api/orders/:orderId/execution', () => {
    it('authenticated happy path returns task summaries from OrdersRepo', async () => {
      mockOrdersRepo.listOrderExecutionPickTasks.mockResolvedValue([pickTaskSummary]);

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${ids.order}/execution`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([pickTaskSummary]);
      expect(mockOrdersRepo.listOrderExecutionPickTasks).toHaveBeenCalledWith(ids.order);

      await app.close();
    });

    it('authenticated request returns [] when no tasks exist', async () => {
      mockOrdersRepo.listOrderExecutionPickTasks.mockResolvedValue([]);

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${ids.order}/execution`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);

      await app.close();
    });

    it('invalid orderId returns existing validation error', async () => {
      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/not-a-uuid/execution'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockOrdersRepo.listOrderExecutionPickTasks).not.toHaveBeenCalled();

      await app.close();
    });

    it('unauthenticated request does not call getUserSupabase', async () => {
      const getUserSupabase = vi.fn();
      const app = buildApp({ getUserSupabase });

      const response = await app.inject({
        method: 'GET',
        url: `/api/orders/${ids.order}/execution`
      });

      expect(response.statusCode).toBe(401);
      expect(getUserSupabase).not.toHaveBeenCalled();

      await app.close();
    });
  });

  // ── B. GET /api/pick-tasks/:taskId ────────────────────────────────────────────

  describe('GET /api/pick-tasks/:taskId', () => {
    it('authenticated happy path returns enriched task detail', async () => {
      mockPickReadRepo.findPickTaskDetail.mockResolvedValue(pickTaskDetail);

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/pick-tasks/${ids.task}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(pickTaskDetail);
      expect(mockPickReadRepo.findPickTaskDetail).toHaveBeenCalledWith(ids.task);

      await app.close();
    });

    it('missing task returns existing 404 error and code', async () => {
      mockPickReadRepo.findPickTaskDetail.mockResolvedValue(null);

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/pick-tasks/${ids.task}`
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        code: 'PICK_TASK_NOT_FOUND',
        message: `Pick task ${ids.task} not found.`
      });

      await app.close();
    });

    it('invalid taskId returns existing validation error', async () => {
      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/pick-tasks/not-a-uuid'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockPickReadRepo.findPickTaskDetail).not.toHaveBeenCalled();

      await app.close();
    });

    it('unauthenticated request does not call getUserSupabase', async () => {
      const getUserSupabase = vi.fn();
      const app = buildApp({ getUserSupabase });

      const response = await app.inject({
        method: 'GET',
        url: `/api/pick-tasks/${ids.task}`
      });

      expect(response.statusCode).toBe(401);
      expect(getUserSupabase).not.toHaveBeenCalled();

      await app.close();
    });
  });

  // ── C. POST /api/pick-tasks/:taskId/allocate ──────────────────────────────────

  describe('POST /api/pick-tasks/:taskId/allocate', () => {
    it('authenticated happy path forwards taskId unchanged', async () => {
      const mockAllocate = vi.fn().mockResolvedValue(allocateResult);
      const getPickingService = vi.fn(() => mockPickingService({ allocatePickSteps: mockAllocate }));

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/pick-tasks/${ids.task}/allocate`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(allocateResult);
      expect(mockAllocate).toHaveBeenCalledWith({ taskId: ids.task });

      await app.close();
    });

    it('representative PICK_TASK_NOT_FOUND error preserves mapped status and code', async () => {
      const getPickingService = vi.fn(() => mockPickingService({
        allocatePickSteps: vi.fn().mockRejectedValue(new PickTaskNotFoundError(ids.task))
      }));

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/pick-tasks/${ids.task}/allocate`
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'PICK_TASK_NOT_FOUND' });

      await app.close();
    });

    it('invalid taskId returns existing validation error', async () => {
      const getPickingService = vi.fn();

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/pick-tasks/not-a-uuid/allocate'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(getPickingService).not.toHaveBeenCalled();

      await app.close();
    });

    it('unauthenticated request does not call getPickingService', async () => {
      const getPickingService = vi.fn();
      const app = buildApp({
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/pick-tasks/${ids.task}/allocate`
      });

      expect(response.statusCode).toBe(401);
      expect(getPickingService).not.toHaveBeenCalled();

      await app.close();
    });
  });

  // ── D. POST /api/pick-steps/:stepId/execute ───────────────────────────────────

  describe('POST /api/pick-steps/:stepId/execute', () => {
    it('authenticated happy path forwards stepId and body unchanged', async () => {
      const mockExecute = vi.fn().mockResolvedValue(executeResult);
      const getPickingService = vi.fn(() => mockPickingService({ executePickStep: mockExecute }));

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/pick-steps/${ids.step}/execute`,
        payload: { qtyActual: 5, pickContainerId: ids.container }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(executeResult);
      expect(mockExecute).toHaveBeenCalledWith({
        stepId: ids.step,
        qtyActual: 5,
        pickContainerId: ids.container,
        actorId: ids.user
      });

      await app.close();
    });

    it('PICK_STEP_NOT_FOUND preserves mapped status and code', async () => {
      const getPickingService = vi.fn(() => mockPickingService({
        executePickStep: vi.fn().mockRejectedValue(new PickStepNotFoundError(ids.step))
      }));

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/pick-steps/${ids.step}/execute`,
        payload: { qtyActual: 5, pickContainerId: ids.container }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'PICK_STEP_NOT_FOUND' });

      await app.close();
    });

    it('PICK_STEP_NOT_EXECUTABLE preserves mapped status and code', async () => {
      const getPickingService = vi.fn(() => mockPickingService({
        executePickStep: vi.fn().mockRejectedValue(new PickStepNotExecutableError(ids.step, 'already executed'))
      }));

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/pick-steps/${ids.step}/execute`,
        payload: { qtyActual: 5, pickContainerId: ids.container }
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: 'PICK_STEP_NOT_EXECUTABLE' });

      await app.close();
    });

    it('invalid body returns existing validation error', async () => {
      const mockExecute = vi.fn();
      const getPickingService = vi.fn(() => mockPickingService({ executePickStep: mockExecute }));

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/pick-steps/${ids.step}/execute`,
        payload: { qtyActual: -1, pickContainerId: ids.container }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockExecute).not.toHaveBeenCalled();

      await app.close();
    });
  });

  // ── E. POST /api/pick-steps/:stepId/skip ──────────────────────────────────────

  describe('POST /api/pick-steps/:stepId/skip', () => {
    it('authenticated happy path forwards stepId unchanged', async () => {
      const mockSkip = vi.fn().mockResolvedValue(skipResult);
      const getPickingService = vi.fn(() => mockPickingService({ skipPickStep: mockSkip }));

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/pick-steps/${ids.step}/skip`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(skipResult);
      expect(mockSkip).toHaveBeenCalledWith({
        stepId: ids.step,
        actorId: ids.user
      });

      await app.close();
    });

    it('PICK_STEP_NOT_FOUND preserves mapped status and code', async () => {
      const getPickingService = vi.fn(() => mockPickingService({
        skipPickStep: vi.fn().mockRejectedValue(new PickStepNotFoundError(ids.step))
      }));

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/pick-steps/${ids.step}/skip`
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'PICK_STEP_NOT_FOUND' });

      await app.close();
    });

    it('invalid stepId returns existing validation error', async () => {
      const mockSkip = vi.fn();
      const getPickingService = vi.fn(() => mockPickingService({ skipPickStep: mockSkip }));

      const app = buildApp({
        getAuthContext: async () => authContext as never,
        getUserSupabase: vi.fn() as never,
        getPickingService
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/pick-steps/not-a-uuid/skip'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockSkip).not.toHaveBeenCalled();

      await app.close();
    });
  });
});
