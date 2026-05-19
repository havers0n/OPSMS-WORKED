import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { createFloorRoutingRepo } from './repo.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  floor: '33333333-3333-4333-8333-333333333333',
  startNode: '44444444-4444-4444-8444-444444444444',
  endNode: '55555555-5555-4555-8555-555555555555',
  edge: '66666666-6666-4666-8666-666666666666'
};

type QueryCall = {
  op: string;
  args: unknown[];
};

function createQuerySupabase(rows: unknown[] = []) {
  const calls: QueryCall[] = [];
  const builder = {
    select(...args: unknown[]) {
      calls.push({ op: 'select', args });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ op: 'eq', args });
      return builder;
    },
    in(...args: unknown[]) {
      calls.push({ op: 'in', args });
      return builder;
    },
    then(resolve: (value: { data: unknown[]; error: null }) => void) {
      resolve({ data: rows, error: null });
    }
  };

  return {
    calls,
    supabase: {
      from: vi.fn(() => builder)
    }
  };
}

describe('floor routing repo', () => {
  it('scopes node lookup by tenant_id and floor_id', async () => {
    const { supabase, calls } = createQuerySupabase([{ id: ids.startNode }]);
    const repo = createFloorRoutingRepo(supabase as never);

    await expect(
      repo.listExistingNodeIds(ids.tenant, ids.floor, [ids.startNode, ids.endNode])
    ).resolves.toEqual([ids.startNode]);

    expect(supabase.from).toHaveBeenCalledWith('floor_route_nodes');
    expect(calls).toContainEqual({ op: 'select', args: ['id'] });
    expect(calls).toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });
    expect(calls).toContainEqual({ op: 'eq', args: ['floor_id', ids.floor] });
    expect(calls).toContainEqual({ op: 'in', args: ['id', [ids.startNode, ids.endNode]] });
  });

  it('calls shortest path RPC with exact p_* args and parses rows', async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          seq: 1,
          path_seq: 1,
          edge_id: ids.edge,
          source_node_id: ids.startNode,
          target_node_id: ids.endNode,
          cost: 4,
          agg_cost: 4,
          points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
        }
      ],
      error: null
    }));
    const repo = createFloorRoutingRepo({ rpc } as never);

    await expect(
      repo.getShortestFloorPath(ids.tenant, ids.floor, ids.startNode, ids.endNode)
    ).resolves.toHaveLength(1);

    expect(rpc).toHaveBeenCalledWith('get_shortest_floor_path', {
      p_tenant_id: ids.tenant,
      p_floor_id: ids.floor,
      p_start_node_id: ids.startNode,
      p_end_node_id: ids.endNode
    });
  });

  it('rejects invalid RPC row shape', async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          seq: 1,
          path_seq: 1,
          edge_id: ids.edge,
          source_node_id: ids.startNode,
          target_node_id: ids.endNode,
          cost: '4',
          agg_cost: 4,
          points: [{ x: 0, y: 0 }]
        }
      ],
      error: null
    }));
    const repo = createFloorRoutingRepo({ rpc } as never);

    await expect(
      repo.getShortestFloorPath(ids.tenant, ids.floor, ids.startNode, ids.endNode)
    ).rejects.toBeInstanceOf(ZodError);
  });
});
