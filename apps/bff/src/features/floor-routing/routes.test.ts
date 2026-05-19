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
  edge: '66666666-6666-4666-8666-666666666666',
  node: '77777777-7777-4777-8777-777777777777'
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

const graphNode = {
  id: ids.node,
  floorId: ids.floor,
  x: 1,
  y: 2,
  kind: 'walkway' as const,
  label: 'A',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const graphEdge = {
  id: ids.edge,
  floorId: ids.floor,
  sourceNodeId: ids.startNode,
  targetNodeId: ids.endNode,
  cost: 4,
  reverseCost: -1 as const,
  points: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

function createService() {
  return {
    getGraph: vi.fn(async () => ({ nodes: [graphNode], edges: [graphEdge] })),
    createNode: vi.fn(async () => graphNode),
    patchNode: vi.fn(async () => ({ ...graphNode, label: 'B' })),
    deleteNode: vi.fn(async () => undefined),
    createEdge: vi.fn(async () => graphEdge),
    patchEdge: vi.fn(async () => ({ ...graphEdge, cost: 5 })),
    deleteEdge: vi.fn(async () => undefined),
    getShortestPath: vi.fn(async () => ({
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
    }))
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

  it('returns route graph nodes and edges', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/floors/${ids.floor}/routing/graph`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ nodes: [graphNode], edges: [graphEdge] });
    expect(service.getGraph).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      floorId: ids.floor
    });
  });

  it('creates a route graph node with scoped tenant and floor ids', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/floors/${ids.floor}/routing/nodes`,
      payload: {
        x: 1,
        y: 2,
        kind: 'walkway',
        label: 'A'
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(graphNode);
    expect(service.createNode).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      floorId: ids.floor,
      body: {
        x: 1,
        y: 2,
        kind: 'walkway',
        label: 'A'
      }
    });
  });

  it('patches a route graph node', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/floors/${ids.floor}/routing/nodes/${ids.node}`,
      payload: {
        label: 'B'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: ids.node, label: 'B' });
    expect(service.patchNode).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      floorId: ids.floor,
      nodeId: ids.node,
      body: {
        label: 'B'
      }
    });
  });

  it('deletes a route graph node', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/floors/${ids.floor}/routing/nodes/${ids.node}`
    });

    expect(response.statusCode).toBe(204);
    expect(service.deleteNode).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      floorId: ids.floor,
      nodeId: ids.node
    });
  });

  it('creates a route graph edge with scoped tenant and floor ids', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/floors/${ids.floor}/routing/edges`,
      payload: {
        sourceNodeId: ids.startNode,
        targetNodeId: ids.endNode,
        cost: 4,
        reverseCost: -1,
        points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(graphEdge);
    expect(service.createEdge).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      floorId: ids.floor,
      body: {
        sourceNodeId: ids.startNode,
        targetNodeId: ids.endNode,
        cost: 4,
        reverseCost: -1,
        points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
      }
    });
  });

  it('patches a route graph edge', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/floors/${ids.floor}/routing/edges/${ids.edge}`,
      payload: {
        cost: 5
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: ids.edge, cost: 5 });
    expect(service.patchEdge).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      floorId: ids.floor,
      edgeId: ids.edge,
      body: {
        cost: 5
      }
    });
  });

  it('deletes a route graph edge', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/floors/${ids.floor}/routing/edges/${ids.edge}`
    });

    expect(response.statusCode).toBe(204);
    expect(service.deleteEdge).toHaveBeenCalledWith({
      tenantId: ids.tenant,
      floorId: ids.floor,
      edgeId: ids.edge
    });
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
    { label: 'floorId for graph', method: 'GET', url: '/api/floors/not-a-uuid/routing/graph', serviceMethod: 'getGraph' },
    { label: 'floorId for node create', method: 'POST', url: '/api/floors/not-a-uuid/routing/nodes', payload: { x: 1, y: 2 }, serviceMethod: 'createNode' },
    { label: 'nodeId', method: 'PATCH', url: `/api/floors/${ids.floor}/routing/nodes/not-a-uuid`, payload: { x: 1 }, serviceMethod: 'patchNode' },
    { label: 'edgeId', method: 'DELETE', url: `/api/floors/${ids.floor}/routing/edges/not-a-uuid`, serviceMethod: 'deleteEdge' },
    { label: 'floorId', method: 'POST', url: '/api/floors/not-a-uuid/routing/shortest-path', payload: { startNodeId: ids.startNode, endNodeId: ids.endNode }, serviceMethod: 'getShortestPath' },
    { label: 'startNodeId', method: 'POST', url: `/api/floors/${ids.floor}/routing/shortest-path`, payload: { startNodeId: 'not-a-uuid', endNodeId: ids.endNode }, serviceMethod: 'getShortestPath' },
    { label: 'endNodeId', method: 'POST', url: `/api/floors/${ids.floor}/routing/shortest-path`, payload: { startNodeId: ids.startNode, endNodeId: 'not-a-uuid' }, serviceMethod: 'getShortestPath' }
  ] as const)('returns 400 for invalid $label before calling the service', async ({ method, url, payload, serviceMethod }) => {
    vi.mocked(service[serviceMethod]).mockClear();

    const response = await app.inject({
      method,
      url,
      payload: payload as object | undefined
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(service[serviceMethod]).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'node coordinate', method: 'POST', url: `/api/floors/${ids.floor}/routing/nodes`, payload: { x: 'bad', y: 2 }, serviceMethod: 'createNode' },
    { label: 'empty node patch', method: 'PATCH', url: `/api/floors/${ids.floor}/routing/nodes/${ids.node}`, payload: {}, serviceMethod: 'patchNode' },
    { label: 'edge cost', method: 'POST', url: `/api/floors/${ids.floor}/routing/edges`, payload: { sourceNodeId: ids.startNode, targetNodeId: ids.endNode, cost: 0 }, serviceMethod: 'createEdge' },
    { label: 'edge reverse cost', method: 'POST', url: `/api/floors/${ids.floor}/routing/edges`, payload: { sourceNodeId: ids.startNode, targetNodeId: ids.endNode, cost: 1, reverseCost: 0 }, serviceMethod: 'createEdge' },
    { label: 'edge point', method: 'POST', url: `/api/floors/${ids.floor}/routing/edges`, payload: { sourceNodeId: ids.startNode, targetNodeId: ids.endNode, cost: 1, points: [{ x: 1, y: 'bad' }] }, serviceMethod: 'createEdge' },
    { label: 'self edge', method: 'POST', url: `/api/floors/${ids.floor}/routing/edges`, payload: { sourceNodeId: ids.startNode, targetNodeId: ids.startNode, cost: 1 }, serviceMethod: 'createEdge' }
  ] as const)('returns 400 for invalid $label body before calling the service', async ({ method, url, payload, serviceMethod }) => {
    vi.mocked(service[serviceMethod]).mockClear();

    const response = await app.inject({
      method,
      url,
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(service[serviceMethod]).not.toHaveBeenCalled();
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

  it('rejects non-manager graph mutations before calling the service', async () => {
    const operatorService = createService();
    const operatorApp = buildApp({
      getAuthContext: async () =>
        ({
          ...authContext,
          currentTenant: {
            ...authContext.currentTenant,
            role: 'operator'
          }
        }) as AuthenticatedRequestContext,
      getFloorRoutingService: () => operatorService
    });
    await operatorApp.ready();

    const response = await operatorApp.inject({
      method: 'POST',
      url: `/api/floors/${ids.floor}/routing/nodes`,
      payload: {
        x: 1,
        y: 2
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });
    expect(operatorService.createNode).not.toHaveBeenCalled();
    await operatorApp.close();
  });
});
