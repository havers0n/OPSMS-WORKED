import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffRequest } from '@/shared/api/bff/client';
import {
  createRouteEdge,
  createRouteNode,
  deleteRouteEdge,
  deleteRouteNode,
  patchRouteEdge,
  patchRouteNode
} from './mutations';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('route graph mutation api', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
    vi.mocked(bffRequest).mockResolvedValue({} as never);
  });

  it('builds POST /api/floors/:floorId/routing/nodes', async () => {
    const body = { x: 1, y: 2, kind: 'walkway' as const, label: null };
    await createRouteNode('floor-1', body);

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/floors/floor-1/routing/nodes',
      { method: 'POST', body: JSON.stringify(body) }
    );
  });

  it('builds PATCH /api/floors/:floorId/routing/nodes/:nodeId', async () => {
    const body = { x: 3 };
    await patchRouteNode('floor-1', 'node-1', body);

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/floors/floor-1/routing/nodes/node-1',
      { method: 'PATCH', body: JSON.stringify(body) }
    );
  });

  it('builds DELETE /api/floors/:floorId/routing/nodes/:nodeId', async () => {
    await deleteRouteNode('floor-1', 'node-1');

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/floors/floor-1/routing/nodes/node-1',
      { method: 'DELETE' }
    );
  });

  it('builds POST /api/floors/:floorId/routing/edges', async () => {
    const body = {
      sourceNodeId: 'node-a',
      targetNodeId: 'node-b',
      cost: 1,
      reverseCost: -1,
      points: []
    };
    await createRouteEdge('floor-1', body);

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/floors/floor-1/routing/edges',
      { method: 'POST', body: JSON.stringify(body) }
    );
  });

  it('builds PATCH /api/floors/:floorId/routing/edges/:edgeId', async () => {
    const body = { cost: 2 };
    await patchRouteEdge('floor-1', 'edge-1', body);

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/floors/floor-1/routing/edges/edge-1',
      { method: 'PATCH', body: JSON.stringify(body) }
    );
  });

  it('builds DELETE /api/floors/:floorId/routing/edges/:edgeId', async () => {
    await deleteRouteEdge('floor-1', 'edge-1');

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/floors/floor-1/routing/edges/edge-1',
      { method: 'DELETE' }
    );
  });
});
