import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildApp } from '../../app.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { FloorRoutingService } from './service.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  user: '22222222-2222-4222-8222-222222222222',
  floor: '33333333-3333-4333-8333-333333333333',
  startNode: '44444444-4444-4444-8444-444444444444',
  endNode: '55555555-5555-4555-8555-555555555555',
  edge: '66666666-6666-4666-8666-666666666666'
};

const authContext = {
  accessToken: 'token',
  user: {
    id: ids.user,
    email: 'operator@wos.local'
  },
  displayName: 'Local Operator',
  memberships: [
    {
      tenantId: ids.tenant,
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'tenant_admin' as const
    }
  ],
  currentTenant: {
    tenantId: ids.tenant,
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }
} as unknown as AuthenticatedRequestContext;

function createService(response = {
  status: 'ok' as const,
  totalCost: 4,
  segments: [
    {
      edgeId: ids.edge,
      sourceNodeId: ids.startNode,
      targetNodeId: ids.endNode,
      cost: 4,
      points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
    }
  ],
  points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
}) {
  return {
    getShortestPath: vi.fn(async () => response)
  } satisfies FloorRoutingService;
}

describe('floor routing routes', () => {
  const service = createService();
  const app = buildApp({
    getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
    getFloorRoutingService: () => service
  });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns camelCase shortest path response and passes scoped ids to the service', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/floors/${ids.floor}/routing/shortest-path`,
      payload: {
        startNodeId: ids.startNode,
        endNodeId: ids.endNode
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      totalCost: 4,
      segments: [
        {
          edgeId: ids.edge,
          sourceNodeId: ids.startNode,
          targetNodeId: ids.endNode,
          cost: 4,
          points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
        }
      ],
      points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
    });
    expect(service.getShortestPath).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      floorId: ids.floor,
      startNodeId: ids.startNode,
      endNodeId: ids.endNode
    });
  });

  it.each([
    ['floorId', '/api/floors/not-a-uuid/routing/shortest-path', { startNodeId: ids.startNode, endNodeId: ids.endNode }],
    ['startNodeId', `/api/floors/${ids.floor}/routing/shortest-path`, { startNodeId: 'not-a-uuid', endNodeId: ids.endNode }],
    ['endNodeId', `/api/floors/${ids.floor}/routing/shortest-path`, { startNodeId: ids.startNode, endNodeId: 'not-a-uuid' }]
  ])('returns 400 for invalid %s before calling the service', async (_label, url, payload) => {
    service.getShortestPath.mockClear();

    const response = await app.inject({
      method: 'POST',
      url,
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(service.getShortestPath).not.toHaveBeenCalled();
  });

  it('returns workspace unavailable when no current tenant exists', async () => {
    const tenantlessApp = buildApp({
      getAuthContext: async () => ({ ...authContext, currentTenant: null }) as AuthenticatedRequestContext,
      getFloorRoutingService: () => service
    });
    await tenantlessApp.ready();

    const response = await tenantlessApp.inject({
      method: 'POST',
      url: `/api/floors/${ids.floor}/routing/shortest-path`,
      payload: {
        startNodeId: ids.startNode,
        endNodeId: ids.endNode
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'WORKSPACE_UNAVAILABLE' });
    await tenantlessApp.close();
  });
});
