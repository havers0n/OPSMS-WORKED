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

function createBuilder(result: unknown) {
  const calls: QueryCall[] = [];
  const builder = {
    calls,
    select(...args: unknown[]) {
      calls.push({ op: 'select', args });
      return builder;
    },
    insert(...args: unknown[]) {
      calls.push({ op: 'insert', args });
      return builder;
    },
    update(...args: unknown[]) {
      calls.push({ op: 'update', args });
      return builder;
    },
    delete(...args: unknown[]) {
      calls.push({ op: 'delete', args });
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
    order(...args: unknown[]) {
      calls.push({ op: 'order', args });
      return builder;
    },
    single() {
      calls.push({ op: 'single', args: [] });
      return builder;
    },
    maybeSingle() {
      calls.push({ op: 'maybeSingle', args: [] });
      return builder;
    },
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    }
  };

  return builder;
}

const nodeRow = {
  id: ids.startNode,
  floor_id: ids.floor,
  x: 1,
  y: 2,
  kind: 'walkway',
  label: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

const edgeRow = {
  id: ids.edge,
  floor_id: ids.floor,
  source_node_id: ids.startNode,
  target_node_id: ids.endNode,
  cost: 4,
  reverse_cost: -1,
  points: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

describe('floor routing repo', () => {
  it('lists graph nodes and edges scoped by tenant_id and floor_id', async () => {
    const nodeBuilder = createBuilder({ data: [nodeRow], error: null });
    const edgeBuilder = createBuilder({ data: [edgeRow], error: null });
    const from = vi.fn((table: string) => {
      if (table === 'floor_route_nodes') return nodeBuilder;
      if (table === 'floor_route_edges') return edgeBuilder;
      throw new Error(`Unexpected table ${table}`);
    });
    const repo = createFloorRoutingRepo({ from } as never);

    await expect(repo.listGraph(ids.tenant, ids.floor)).resolves.toEqual({
      nodes: [
        {
          id: ids.startNode,
          floorId: ids.floor,
          x: 1,
          y: 2,
          kind: 'walkway',
          label: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      edges: [
        {
          id: ids.edge,
          floorId: ids.floor,
          sourceNodeId: ids.startNode,
          targetNodeId: ids.endNode,
          cost: 4,
          reverseCost: -1,
          points: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    });

    expect(from).toHaveBeenCalledWith('floor_route_nodes');
    expect(from).toHaveBeenCalledWith('floor_route_edges');
    expect(nodeBuilder.calls).toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });
    expect(nodeBuilder.calls).toContainEqual({ op: 'eq', args: ['floor_id', ids.floor] });
    expect(edgeBuilder.calls).toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });
    expect(edgeBuilder.calls).toContainEqual({ op: 'eq', args: ['floor_id', ids.floor] });
  });

  it('inserts a node with tenant_id and floor_id from the service scope', async () => {
    const builder = createBuilder({ data: nodeRow, error: null });
    const repo = createFloorRoutingRepo({ from: vi.fn(() => builder) } as never);

    await repo.createNode(ids.tenant, ids.floor, { x: 1, y: 2, label: null });

    expect(builder.calls).toContainEqual({
      op: 'insert',
      args: [
        {
          tenant_id: ids.tenant,
          floor_id: ids.floor,
          x: 1,
          y: 2,
          kind: 'walkway',
          label: null
        }
      ]
    });
  });

  it('updates a node by id, tenant_id, and floor_id', async () => {
    const builder = createBuilder({ data: { ...nodeRow, label: 'Updated' }, error: null });
    const repo = createFloorRoutingRepo({ from: vi.fn(() => builder) } as never);

    await repo.patchNode(ids.tenant, ids.floor, ids.startNode, { label: 'Updated' });

    expect(builder.calls).toContainEqual({ op: 'update', args: [{ label: 'Updated' }] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['id', ids.startNode] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['floor_id', ids.floor] });
  });

  it('deletes a node by id, tenant_id, and floor_id', async () => {
    const builder = createBuilder({ data: { id: ids.startNode }, error: null });
    const repo = createFloorRoutingRepo({ from: vi.fn(() => builder) } as never);

    await expect(repo.deleteNode(ids.tenant, ids.floor, ids.startNode)).resolves.toBe(true);

    expect(builder.calls).toContainEqual({ op: 'delete', args: [] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['id', ids.startNode] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['floor_id', ids.floor] });
  });

  it('inserts an edge with tenant_id, floor_id, reverse_cost, and points', async () => {
    const builder = createBuilder({ data: edgeRow, error: null });
    const repo = createFloorRoutingRepo({ from: vi.fn(() => builder) } as never);

    await repo.createEdge(ids.tenant, ids.floor, {
      sourceNodeId: ids.startNode,
      targetNodeId: ids.endNode,
      cost: 4,
      reverseCost: -1,
      points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
    });

    expect(builder.calls).toContainEqual({
      op: 'insert',
      args: [
        {
          tenant_id: ids.tenant,
          floor_id: ids.floor,
          source_node_id: ids.startNode,
          target_node_id: ids.endNode,
          cost: 4,
          reverse_cost: -1,
          points: [{ x: 0, y: 0 }, { x: 4, y: 0 }]
        }
      ]
    });
  });

  it('updates an edge by id, tenant_id, and floor_id while preserving reverse_cost and points', async () => {
    const builder = createBuilder({ data: { ...edgeRow, reverse_cost: 2 }, error: null });
    const repo = createFloorRoutingRepo({ from: vi.fn(() => builder) } as never);

    await repo.patchEdge(ids.tenant, ids.floor, ids.edge, {
      reverseCost: 2,
      points: [{ x: 1, y: 1 }]
    });

    expect(builder.calls).toContainEqual({
      op: 'update',
      args: [
        {
          reverse_cost: 2,
          points: [{ x: 1, y: 1 }]
        }
      ]
    });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['id', ids.edge] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['floor_id', ids.floor] });
  });

  it('deletes an edge by id, tenant_id, and floor_id', async () => {
    const builder = createBuilder({ data: { id: ids.edge }, error: null });
    const repo = createFloorRoutingRepo({ from: vi.fn(() => builder) } as never);

    await expect(repo.deleteEdge(ids.tenant, ids.floor, ids.edge)).resolves.toBe(true);

    expect(builder.calls).toContainEqual({ op: 'delete', args: [] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['id', ids.edge] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['floor_id', ids.floor] });
  });

  it('scopes node lookup by tenant_id and floor_id', async () => {
    const builder = createBuilder({ data: [{ id: ids.startNode }], error: null });
    const supabase = {
      from: vi.fn(() => builder)
    };
    const repo = createFloorRoutingRepo(supabase as never);

    await expect(
      repo.listExistingNodeIds(ids.tenant, ids.floor, [ids.startNode, ids.endNode])
    ).resolves.toEqual([ids.startNode]);

    expect(supabase.from).toHaveBeenCalledWith('floor_route_nodes');
    expect(builder.calls).toContainEqual({ op: 'select', args: ['id'] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });
    expect(builder.calls).toContainEqual({ op: 'eq', args: ['floor_id', ids.floor] });
    expect(builder.calls).toContainEqual({ op: 'in', args: ['id', [ids.startNode, ids.endNode]] });
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
