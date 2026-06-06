import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildApp } from '../../app.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { ApiError } from '../../errors.js';

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

const OWN_ORDER_ID = '11111111-1111-4111-8111-111111111111';
const OWN_ORDER_ID_2 = '22222222-2222-4222-8222-222222222222';
const FOREIGN_ORDER_ID = '33333333-3333-4333-8333-333333333333';
const OWN_WAVE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

function makePlanning(input: any) {
  const tasks = input.tasks ?? [];
  const routeWarningDetails = input.routeMode === 'distance'
    ? [{ code: 'DISTANCE_MODE_FALLBACK', severity: 'info', message: 'Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.', source: 'route' }]
    : [];
  const packageWarningDetails = input.strategyMethod === 'batch'
    ? [{ code: 'POST_SORT_REQUIRED', severity: 'info', message: 'Strategy requires post-sort.', source: 'domain' }]
    : [];
  return {
    strategy: {
      id: 'strategy-1',
      code: 'SINGLE_ORDER',
      name: 'Single order',
      method: input.strategyMethod ?? 'single_order',
      requiresPostSort: input.strategyMethod === 'batch',
      requiresCartSlots: false,
      preserveOrderSeparation: true,
      aggregateSameSku: false,
      routePriorityMode: input.routeMode ?? 'hybrid',
      splitPolicy: {}
    },
    rootPackage: {
      id: 'wp-1',
      strategyId: 'strategy-1',
      strategy: {
        id: 'strategy-1',
        code: 'SINGLE_ORDER',
        name: 'Single order',
        method: input.strategyMethod ?? 'single_order',
        requiresPostSort: input.strategyMethod === 'batch',
        requiresCartSlots: false,
        preserveOrderSeparation: true,
        aggregateSameSku: false,
        routePriorityMode: input.routeMode ?? 'hybrid',
        splitPolicy: {}
      },
      method: input.strategyMethod ?? 'single_order',
      tasks,
      complexity: {
        level: 'low',
        score: 10,
        pickLines: tasks.length,
        uniqueSkuCount: tasks.length,
        uniqueLocationCount: tasks.length,
        uniqueZoneCount: 1,
        uniqueAisleCount: 1,
        totalWeightKg: 0,
        totalVolumeLiters: 0,
        heavyTaskCount: 0,
        bulkyTaskCount: 0,
        fragileTaskCount: 0,
        coldTaskCount: 0,
        hazmatTaskCount: 0,
        unknownWeightCount: 0,
        unknownVolumeCount: 0,
        unknownLocationCount: 0,
        exceeds: {
          maxPickLines: false,
          maxWeightKg: false,
          maxVolumeLiters: false,
          maxUniqueLocations: false,
          maxZones: false
        },
        warnings: [],
        warningDetails: []
      },
      warnings: input.strategyMethod === 'batch' ? ['Strategy requires post-sort.'] : [],
      warningDetails: packageWarningDetails,
      metadata: {
        source: 'domain_planner',
        taskCount: tasks.length,
        orderCount: tasks.length,
        uniqueSkuCount: tasks.length,
        uniqueLocationCount: tasks.length,
        uniqueZoneCount: 1,
        uniqueAisleCount: 1
      }
    },
    split: {
      wasSplit: tasks.length > 2,
      reason: tasks.length > 2 ? 'max_zones' : 'none',
      packages: [{ id: 'wp-1' }],
      warnings: [],
      warningDetails: []
    },
    packages: [
      {
        package: {
          id: 'wp-1',
          strategyId: 'strategy-1',
          strategy: {
            id: 'strategy-1',
            code: 'SINGLE_ORDER',
            name: 'Single order',
            method: input.strategyMethod ?? 'single_order',
            requiresPostSort: input.strategyMethod === 'batch',
            requiresCartSlots: false,
            preserveOrderSeparation: true,
            aggregateSameSku: false,
            routePriorityMode: input.routeMode ?? 'hybrid',
            splitPolicy: {}
          },
          method: input.strategyMethod ?? 'single_order',
          tasks,
          complexity: {
            level: 'low',
            score: 10,
            pickLines: tasks.length,
            uniqueSkuCount: tasks.length,
            uniqueLocationCount: tasks.length,
            uniqueZoneCount: 1,
            uniqueAisleCount: 1,
            totalWeightKg: 0,
            totalVolumeLiters: 0,
            heavyTaskCount: 0,
            bulkyTaskCount: 0,
            fragileTaskCount: 0,
            coldTaskCount: 0,
            hazmatTaskCount: 0,
            unknownWeightCount: 0,
            unknownVolumeCount: 0,
            unknownLocationCount: 0,
            exceeds: {
              maxPickLines: false,
              maxWeightKg: false,
              maxVolumeLiters: false,
              maxUniqueLocations: false,
              maxZones: false
            },
            warnings: [],
            warningDetails: []
          },
          warnings: [],
          warningDetails: [],
          metadata: {
            source: 'domain_planner',
            taskCount: tasks.length,
            orderCount: tasks.length,
            uniqueSkuCount: tasks.length,
            uniqueLocationCount: tasks.length,
            uniqueZoneCount: 1,
            uniqueAisleCount: 1
          }
        },
        route: { steps: tasks.map((task: any, index: number) => ({ sequence: index + 1, taskId: task.id, fromLocationId: task.fromLocationId, skuId: task.skuId, qtyToPick: task.qty, allocations: task.orderRefs })), warnings: input.routeMode === 'distance' ? ['Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.'] : [], warningDetails: routeWarningDetails, metadata: { mode: input.routeMode === 'distance' ? 'hybrid' : (input.routeMode ?? 'hybrid'), taskCount: tasks.length, sequencedCount: tasks.length, unknownLocationCount: 0 } }
      }
    ],
    warnings: [
      ...(input.routeMode === 'distance'
        ? ['Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.']
        : []),
      ...(input.strategyMethod === 'batch' ? ['Strategy requires post-sort.'] : [])
    ],
    warningDetails: [...routeWarningDetails, ...packageWarningDetails],
    metadata: { taskCount: tasks.length, packageCount: 1, routeStepCount: tasks.length, wasSplit: tasks.length > 2, splitReason: tasks.length > 2 ? 'max_zones' : 'none' }
  };
}

describe('POST /api/picking-planning/preview', () => {
  const app = buildApp({
    getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
    getPickingPlanningPreviewService: (() => ({
      previewPickingPlan: (input: any) => makePlanning(input) as never,
      previewPickingPlanFromOrders: async (input: any) => ({
        planning: makePlanning({ tasks: input.orderIds.map((id: string, i: number) => ({ id: `task-${i + 1}`, skuId: `sku-${i + 1}`, fromLocationId: `loc-${i + 1}`, qty: 1, orderRefs: [{ orderId: id, orderLineId: `line-${i + 1}`, qty: 1 }] })) }),
        orderIds: input.orderIds,
        tasks: [],
        locationsById: {},
        unresolved: [],
        unresolvedSummary: { total: 0, byReason: {} },
        coverage: {
          orderCount: input.orderIds.length,
          orderLineCount: 0,
          plannedLineCount: 0,
          unresolvedLineCount: 0,
          plannedQty: 0,
          unresolvedQty: 0,
          planningCoveragePct: 100
        },
        warnings: [],
        warningDetails: []
      }),
      previewPickingPlanFromWave: async (input: any) => ({
        waveId: input.waveId,
        orderIds: input.waveId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' ? [OWN_ORDER_ID, OWN_ORDER_ID_2] : [],
        planning: makePlanning({ tasks: [] }),
        tasks: [],
        locationsById: {},
        unresolved: [],
        unresolvedSummary: { total: 0, byReason: {} },
        coverage: {
          orderCount: input.waveId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' ? 2 : 0,
          orderLineCount: 0,
          plannedLineCount: 0,
          unresolvedLineCount: 0,
          plannedQty: 0,
          unresolvedQty: 0,
          planningCoveragePct: 100
        },
        warnings: input.waveId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' ? [] : ['Wave contains no orders.'],
        warningDetails: input.waveId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' ? [] : [{ code: 'EMPTY_WAVE', severity: 'warning', message: 'Wave contains no orders.', source: 'wave' }]
      })
    })) as never
  });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns stable explicit preview response', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/picking-planning/preview', payload: baseRequest });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.kind).toBe('explicit');
    expect(payload.summary.taskCount).toBe(2);
    expect(payload.summary.packageCount).toBeGreaterThan(0);
    expect(payload.packages[0].route.steps[0].sequence).toBe(1);
    expect(payload.packages[0].route.steps[0]).toMatchObject({
      locationId: 'loc-1',
      addressLabel: 'loc-1',
      cellId: null,
      productId: null,
      displayCode: 'sku-1',
      barcode: null,
      productName: null,
      productImageUrl: null,
      qtyToPick: 2,
      qtyEach: 2,
      packagingLevels: []
    });
    expect(payload.rootWorkPackage.id).toBe('wp-1');
  });

  it('includes post-sort warning for batch strategy', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview',
      payload: { ...baseRequest, strategyMethod: 'batch' }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.warnings).toContain('Strategy requires post-sort.');
    expect(payload.warningDetails).toContainEqual(
      expect.objectContaining({ code: 'POST_SORT_REQUIRED', severity: 'info', message: 'Strategy requires post-sort.' })
    );
  });

  it('propagates distance-mode fallback warning', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/picking-planning/preview', payload: { ...baseRequest, routeMode: 'distance' } });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.warnings).toContain('Distance mode requested, but graph routing is not implemented. Falling back to hybrid sequencing.');
    expect(payload.warningDetails).toContainEqual(
      expect.objectContaining({ code: 'DISTANCE_MODE_FALLBACK', severity: 'info' })
    );
  });

  it('returns kind=orders response with coverage and unresolvedSummary', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/orders',
      payload: { orderIds: [OWN_ORDER_ID, OWN_ORDER_ID_2] }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.kind).toBe('orders');
    expect(payload.input.orderIds).toEqual([OWN_ORDER_ID, OWN_ORDER_ID_2]);
    expect(payload.unresolvedSummary).toEqual({ total: 0, byReason: {} });
    expect(payload.coverage).toMatchObject({ orderCount: 2, planningCoveragePct: 100 });
    expect(payload.warningDetails).toEqual([]);
  });

  it('returns kind=wave response with waveId, orderIds, coverage and unresolvedSummary', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/wave',
      payload: { waveId: OWN_WAVE_ID }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.kind).toBe('wave');
    expect(payload.input.waveId).toBe(OWN_WAVE_ID);
    expect(payload.input.orderIds).toEqual([OWN_ORDER_ID, OWN_ORDER_ID_2]);
    expect(payload.unresolvedSummary).toEqual({ total: 0, byReason: {} });
    expect(payload.coverage).toMatchObject({ orderCount: 2, planningCoveragePct: 100 });
  });

  it('returns 400 for malformed order IDs', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/orders',
      payload: { orderIds: ['not-a-uuid'] }
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for malformed wave ID', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/wave',
      payload: { waveId: 'not-a-uuid' }
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 validation errors for invalid request payloads', async () => {
    const invalidStrategy = await app.inject({ method: 'POST', url: '/api/picking-planning/preview', payload: { ...baseRequest, strategyMethod: 'invalid' } });
    expect(invalidStrategy.statusCode).toBe(400);

    const invalidOrders = await app.inject({ method: 'POST', url: '/api/picking-planning/preview/orders', payload: { orderIds: [] } });
    expect(invalidOrders.statusCode).toBe(400);

    const invalidWave = await app.inject({ method: 'POST', url: '/api/picking-planning/preview/wave', payload: {} });
    expect(invalidWave.statusCode).toBe(400);
  });
});

describe('POST /api/picking-planning/preview/orders - tenant isolation 404', () => {
  const app = buildApp({
    getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
    getPickingPlanningPreviewService: (() => ({
      previewPickingPlan: () => { throw new ApiError(404, 'NOT_FOUND', 'Order not found'); },
      previewPickingPlanFromOrders: async () => { throw new ApiError(404, 'NOT_FOUND', 'Order not found'); },
      previewPickingPlanFromWave: async () => { throw new ApiError(404, 'NOT_FOUND', 'Wave not found'); }
    })) as never
  });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 404 with generic message for foreign order ID', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/orders',
      payload: { orderIds: [FOREIGN_ORDER_ID] }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe('Order not found');
  });

  it('returns 404 with generic message for foreign wave ID', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/wave',
      payload: { waveId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe('Wave not found');
  });

  it('does not reveal whether a foreign or missing resource caused the 404', async () => {
    const foreignOrderResp = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/orders',
      payload: { orderIds: [FOREIGN_ORDER_ID] }
    });

    const missingOrderResp = await app.inject({
      method: 'POST',
      url: '/api/picking-planning/preview/orders',
      payload: { orderIds: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'] }
    });

    expect(foreignOrderResp.statusCode).toBe(404);
    expect(missingOrderResp.statusCode).toBe(404);
    expect(foreignOrderResp.json().code).toBe('NOT_FOUND');
    expect(missingOrderResp.json().code).toBe('NOT_FOUND');
  });
});
