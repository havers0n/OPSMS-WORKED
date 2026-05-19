import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createFloorRoutingService, type FloorRoutingService } from './service.js';
import type { FloorRoutingRepo } from './repo.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  floor: '33333333-3333-4333-8333-333333333333',
  startNode: '44444444-4444-4444-8444-444444444444',
  middleNode: '55555555-5555-4555-8555-555555555555',
  endNode: '66666666-6666-4666-8666-666666666666',
  edgeA: '77777777-7777-4777-8777-777777777777',
  edgeB: '88888888-8888-4888-8888-888888888888'
};

function createRepo(overrides: Partial<FloorRoutingRepo> = {}): FloorRoutingRepo {
  return {
    listExistingNodeIds: vi.fn(async () => [ids.startNode, ids.endNode]),
    getShortestFloorPath: vi.fn(async () => []),
    ...overrides
  };
}

const input = {
  tenantId: ids.tenant,
  floorId: ids.floor,
  startNodeId: ids.startNode,
  endNodeId: ids.endNode
};

const validRows = [
  {
    seq: 1,
    path_seq: 1,
    edge_id: ids.edgeA,
    source_node_id: ids.startNode,
    target_node_id: ids.middleNode,
    cost: 4,
    agg_cost: 0,
    points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
  },
  {
    seq: 2,
    path_seq: 2,
    edge_id: ids.edgeB,
    source_node_id: ids.middleNode,
    target_node_id: ids.endNode,
    cost: 5,
    agg_cost: 9,
    points: [{ x: 4, y: 0 }, { x: 9, y: 0 }]
  }
];

describe('floor routing service', () => {
  it('returns ok with zero cost for matching start and end without checking nodes or RPC', async () => {
    const repo = createRepo();
    const service = createFloorRoutingService(repo);

    await expect(
      service.getShortestPath({
        ...input,
        endNodeId: ids.startNode
      })
    ).resolves.toEqual({
      status: 'ok',
      totalCost: 0,
      segments: [],
      points: []
    });
    expect(repo.listExistingNodeIds).not.toHaveBeenCalled();
    expect(repo.getShortestFloorPath).not.toHaveBeenCalled();
  });

  it.each([
    ['missing start', [ids.endNode]],
    ['missing end', [ids.startNode]],
    ['both missing', []]
  ])('returns missing_node when %s', async (_label, existingNodeIds) => {
    const repo = createRepo({
      listExistingNodeIds: vi.fn(async () => existingNodeIds)
    });
    const service = createFloorRoutingService(repo);

    await expect(service.getShortestPath(input)).resolves.toMatchObject({
      status: 'missing_node',
      totalCost: 0,
      segments: [],
      points: []
    });
    expect(repo.getShortestFloorPath).not.toHaveBeenCalled();
  });

  it('returns no_path when both nodes exist and RPC returns empty rows', async () => {
    const repo = createRepo({
      getShortestFloorPath: vi.fn(async () => [])
    });
    const service = createFloorRoutingService(repo);

    await expect(service.getShortestPath(input)).resolves.toEqual({
      status: 'no_path',
      totalCost: 0,
      segments: [],
      points: []
    });
  });

  it('maps valid RPC rows, prefers last agg_cost, and removes adjacent duplicate points', async () => {
    const repo = createRepo({
      getShortestFloorPath: vi.fn(async () => validRows)
    });
    const service = createFloorRoutingService(repo);

    await expect(service.getShortestPath(input)).resolves.toEqual({
      status: 'ok',
      totalCost: 9,
      segments: [
        {
          edgeId: ids.edgeA,
          sourceNodeId: ids.startNode,
          targetNodeId: ids.middleNode,
          cost: 4,
          points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
        },
        {
          edgeId: ids.edgeB,
          sourceNodeId: ids.middleNode,
          targetNodeId: ids.endNode,
          cost: 5,
          points: [{ x: 4, y: 0 }, { x: 9, y: 0 }]
        }
      ],
      points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 9, y: 0 }]
    });
  });

  it('falls back to summed segment cost when the last aggregate cost is not finite', async () => {
    const repo = createRepo({
      getShortestFloorPath: vi.fn(async () => [
        validRows[0],
        {
          ...validRows[1],
          agg_cost: Number.NaN
        }
      ])
    });
    const service = createFloorRoutingService(repo);

    await expect(service.getShortestPath(input)).resolves.toMatchObject({
      status: 'ok',
      totalCost: 9
    });
  });

  it('returns graph_unavailable for known graph dependency failures', async () => {
    const repo = createRepo({
      getShortestFloorPath: vi.fn(async () => {
        throw {
          code: '42883',
          message: 'function public.get_shortest_floor_path(uuid, uuid, uuid, uuid) does not exist'
        };
      })
    });
    const service = createFloorRoutingService(repo);

    await expect(service.getShortestPath(input)).resolves.toEqual({
      status: 'graph_unavailable',
      totalCost: 0,
      segments: [],
      points: []
    });
  });

  it('returns graph_unavailable for malformed RPC rows or points', async () => {
    let malformedError: unknown;
    try {
      z.object({ points: z.array(z.object({ x: z.number().finite(), y: z.number().finite() })) }).parse({
        points: [{ x: Number.POSITIVE_INFINITY, y: 1 }]
      });
    } catch (error) {
      malformedError = error;
    }

    const repo = createRepo({
      getShortestFloorPath: vi.fn(async () => {
        throw malformedError;
      })
    });
    const service = createFloorRoutingService(repo);

    await expect(service.getShortestPath(input)).resolves.toMatchObject({
      status: 'graph_unavailable'
    });
  });

  it('does not convert unrelated permission or database failures to graph_unavailable', async () => {
    const permissionError = { code: '42501', message: 'permission denied for table floor_route_nodes' };
    const repo = createRepo({
      getShortestFloorPath: vi.fn(async () => {
        throw permissionError;
      })
    });
    const service: FloorRoutingService = createFloorRoutingService(repo);

    await expect(service.getShortestPath(input)).rejects.toBe(permissionError);
  });
});
