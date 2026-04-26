import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildApp } from '../../app.js';
import type { AuthenticatedRequestContext } from '../../auth.js';

const authContext = {
  accessToken: 'token',
  user: {
    id: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d',
    email: 'operator@wos.local'
  },
  displayName: 'Local Operator',
  memberships: [
    {
      tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'tenant_admin' as const
    }
  ],
  currentTenant: {
    tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a',
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }
} as unknown as AuthenticatedRequestContext;

const baseRequest = {
  tasks: [
    {
      id: 'task-1',
      skuId: 'sku-1',
      fromLocationId: 'loc-1',
      qty: 2,
      orderRefs: [{ orderId: 'order-1', orderLineId: 'line-1', qty: 2 }],
      handlingClass: 'normal'
    },
    {
      id: 'task-2',
      skuId: 'sku-2',
      fromLocationId: 'loc-2',
      qty: 1,
      orderRefs: [{ orderId: 'order-2', orderLineId: 'line-2', qty: 1 }],
      handlingClass: 'fragile'
    }
  ],
  locationsById: {
    'loc-1': { id: 'loc-1', taskZoneId: 'zone-a', accessAisleId: 'aisle-1', positionAlongAisle: 1 },
    'loc-2': { id: 'loc-2', taskZoneId: 'zone-a', accessAisleId: 'aisle-1', positionAlongAisle: 2 }
  }
};

describe('POST /api/picking-planning/preview', () => {
  const app = buildApp({
    getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
    getPickingPlanningPreviewService: (() => ({
      previewPickingPlan: (input: any) => {
        const result = {
        strategy: { method: input.strategyMethod ?? 'single_order' },
        rootPackage: { id: 'wp-1', strategyId: 'strategy-1', method: input.strategyMethod ?? 'single_order', tasks: input.tasks },
        split: { wasSplit: input.tasks.length > 2, reason: input.tasks.length > 2 ? 'max_zones' : 'none' },
          packages: [{ id: 'wp-1', strategyId: 'strategy-1', method: input.strategyMethod ?? 'single_order', tasks: input.tasks, route: { steps: input.tasks.map((task: any, index: number) => ({ sequence: index + 1, taskId: task.id })) } }],
        warnings: input.routeMode === 'distance'
          ? ['Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.']
          : input.strategyMethod === 'batch'
            ? ['Strategy requires post-sort.']
            : [],
        metadata: { taskCount: input.tasks.length, packageCount: 1, routeStepCount: input.tasks.length, wasSplit: input.tasks.length > 2, splitReason: input.tasks.length > 2 ? 'max_zones' : 'none' }
        };
        return result as never;
      },
      previewPickingPlanFromOrders: async (input: any) => ({
        planning: {
          strategy: { method: 'single_order' },
          rootPackage: { id: 'wp-1', strategyId: 'strategy-1', method: 'single_order', tasks: [] },
          split: { wasSplit: false, reason: 'none' },
          packages: [],
          warnings: [],
          metadata: { taskCount: input.orderIds.length, packageCount: 1, routeStepCount: input.orderIds.length, wasSplit: false, splitReason: 'none' }
        },
        tasks: [],
        locationsById: {},
        unresolved: [],
        warnings: []
      }),
      previewPickingPlanFromWave: async (input: any) => ({
        waveId: input.waveId,
        orderIds: input.waveId === 'wave-empty' ? [] : ['order-1', 'order-2'],
        planning: {
          strategy: { method: input.strategyMethod ?? 'single_order' },
          rootPackage: { id: 'wp-wave-1', strategyId: 'strategy-1', method: input.strategyMethod ?? 'single_order', tasks: [] },
          split: { wasSplit: false, reason: 'none' },
          packages: [],
          warnings: [],
          metadata: { taskCount: input.waveId === 'wave-empty' ? 0 : 2, packageCount: 1, routeStepCount: 0, wasSplit: false, splitReason: 'none' }
        },
        tasks: [],
        locationsById: {},
        unresolved: [],
        unresolvedSummary: { total: 0, byReason: {} },
        coverage: {
          orderCount: input.waveId === 'wave-empty' ? 0 : 2,
          orderLineCount: 0,
          plannedLineCount: 0,
          unresolvedLineCount: 0,
          plannedQty: 0,
          unresolvedQty: 0,
          planningCoveragePct: 100
        },
        warnings: input.waveId === 'wave-empty' ? ['Wave contains no orders.'] : []
      })
    })) as never
  });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns planning preview metadata for a valid request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview',
      payload: baseRequest
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.metadata.taskCount).toBe(2);
    expect(payload.metadata.packageCount).toBeGreaterThan(0);
    expect(payload.packages[0].route.steps[0].sequence).toBe(1);
  });

  it('uses default strategy when strategyMethod is omitted', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/picking-planning/preview', payload: baseRequest });
    expect(response.statusCode).toBe(200);
    expect(response.json().strategy.method).toBe('single_order');
  });

  it('includes post-sort warning for batch strategy', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview',
      payload: { ...baseRequest, strategyMethod: 'batch' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().warnings).toContain('Strategy requires post-sort.');
  });

  it('propagates distance-mode fallback warning', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview',
      payload: { ...baseRequest, routeMode: 'distance' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().warnings).toContain(
      'Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.'
    );
  });

  it('splits work by zones when exceeding strategy maxZones', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview',
      payload: {
        ...baseRequest,
        tasks: [
          { ...baseRequest.tasks[0], id: 'task-z1', fromLocationId: 'loc-z1' },
          { ...baseRequest.tasks[0], id: 'task-z2', fromLocationId: 'loc-z2' },
          { ...baseRequest.tasks[0], id: 'task-z3', fromLocationId: 'loc-z3' }
        ],
        locationsById: {
          'loc-z1': { id: 'loc-z1', taskZoneId: 'zone-a' },
          'loc-z2': { id: 'loc-z2', taskZoneId: 'zone-b' },
          'loc-z3': { id: 'loc-z3', taskZoneId: 'zone-c' }
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().split).toMatchObject({ wasSplit: true, reason: 'max_zones' });
  });

  it('returns 400 for invalid strategyMethod', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview',
      payload: { ...baseRequest, strategyMethod: 'invalid' }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid routeMode', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview',
      payload: { ...baseRequest, routeMode: 'nearest' }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when task qty is not positive', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview',
      payload: {
        ...baseRequest,
        tasks: [{ ...baseRequest.tasks[0], qty: 0 }]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid handlingClass', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview',
      payload: {
        ...baseRequest,
        tasks: [{ ...baseRequest.tasks[0], handlingClass: 'radioactive' }]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
  });



  it('returns read-only orders-based preview payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/orders',
      payload: { orderIds: ['order-1', 'order-2'] }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().planning.metadata.taskCount).toBe(2);
    expect(Array.isArray(response.json().unresolved)).toBe(true);
  });

  it('returns 400 for invalid orderIds payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/orders',
      payload: { orderIds: [] }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
  });

  it('returns read-only wave-based preview payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/wave',
      payload: { waveId: 'wave-1' }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.waveId).toBe('wave-1');
    expect(payload.orderIds).toEqual(['order-1', 'order-2']);
    expect(payload.planning.metadata.taskCount).toBe(2);
    expect(payload.unresolvedSummary).toEqual({ total: 0, byReason: {} });
    expect(payload.coverage).toMatchObject({ orderCount: 2, planningCoveragePct: 100 });
  });

  it('returns wave-level validation errors', async () => {
    const invalidWave = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/wave',
      payload: {}
    });
    expect(invalidWave.statusCode).toBe(400);
    expect(invalidWave.json().code).toBe('VALIDATION_ERROR');

    const invalidRoute = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/wave',
      payload: { waveId: 'wave-1', routeMode: 'nearest' }
    });
    expect(invalidRoute.statusCode).toBe(400);
    expect(invalidRoute.json().code).toBe('VALIDATION_ERROR');
  });


  it('returns route steps with 1-based sequence numbers', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/picking-planning/preview', payload: baseRequest });
    expect(response.statusCode).toBe(200);

    const steps = response.json().packages[0].route.steps;
    expect(steps.map((step: { sequence: number }) => step.sequence)).toEqual([1, 2]);
  });
});
