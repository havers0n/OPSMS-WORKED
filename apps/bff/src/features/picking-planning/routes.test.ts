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
    getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext
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

  it('returns route steps with 1-based sequence numbers', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/picking-planning/preview', payload: baseRequest });
    expect(response.statusCode).toBe(200);

    const steps = response.json().packages[0].route.steps;
    expect(steps.map((step: { sequence: number }) => step.sequence)).toEqual([1, 2]);
  });
});
