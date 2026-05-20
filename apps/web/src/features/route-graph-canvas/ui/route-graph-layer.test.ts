import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteGraph } from '@/entities/route-graph/model/types';
import {
  getRouteGraphCanvasSnapshot,
  routeGraphCanvasActions
} from '../model/route-graph-canvas-store';
import { RouteGraphLayer } from './route-graph-layer';

const createEdgeMutateAsync = vi.fn();
const patchNodeMutateAsync = vi.fn();

let graph: RouteGraph = { nodes: [], edges: [] };

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: graph })
}));

vi.mock('@/entities/route-graph/api/queries', () => ({
  routeGraphQueryOptions: (floorId: string) => ({
    queryKey: ['route-graph', 'by-floor', floorId]
  })
}));

vi.mock('@/entities/route-graph/api/mutations', () => ({
  useCreateRouteEdge: () => ({ mutateAsync: createEdgeMutateAsync }),
  usePatchRouteNode: () => ({ mutateAsync: patchNodeMutateAsync })
}));

vi.mock('react-konva', () => ({
  Circle: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Circle', props, children),
  Group: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Group', props, children),
  Layer: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Layer', props, children),
  Line: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Line', props, children),
  Text: ({ children, ...props }: { children?: React.ReactNode }) =>
    createElement('Text', props, children)
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderLayer() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RouteGraphLayer, { floorId: 'floor-1' })
    );
  });
  return renderer;
}

function findHostByTestId(
  renderer: TestRenderer.ReactTestRenderer,
  testId: string
) {
  return renderer.root.find(
    (node) => typeof node.type === 'string' && node.props['data-testid'] === testId
  );
}

describe('RouteGraphLayer', () => {
  beforeEach(() => {
    routeGraphCanvasActions.reset();
    createEdgeMutateAsync.mockReset();
    patchNodeMutateAsync.mockReset();
    createEdgeMutateAsync.mockResolvedValue({});
    patchNodeMutateAsync.mockResolvedValue({});
    graph = {
      nodes: [
        {
          id: 'node-a',
          floorId: 'floor-1',
          x: 1,
          y: 2,
          kind: 'walkway',
          label: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 'node-b',
          floorId: 'floor-1',
          x: 4,
          y: 6,
          kind: 'walkway',
          label: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      edges: [
        {
          id: 'edge-1',
          floorId: 'floor-1',
          sourceNodeId: 'node-a',
          targetNodeId: 'node-b',
          cost: 5,
          reverseCost: -1,
          points: [
            { x: 1, y: 2 },
            { x: 4, y: 6 }
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    };
  });

  it('renders nodes and edges in canvas pixels', () => {
    const renderer = renderLayer();

    expect(findHostByTestId(renderer, 'route-graph-node-node-a').props).toMatchObject({
      x: 40,
      y: 80
    });
    expect(findHostByTestId(renderer, 'route-graph-edge-edge-1').props.points).toEqual([
      40,
      80,
      160,
      240
    ]);
  });

  it('renders normal edge endpoints from current node positions instead of stale edge points', () => {
    graph = {
      ...graph,
      edges: [
        {
          ...graph.edges[0]!,
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 200 }
          ]
        }
      ]
    };

    const renderer = renderLayer();

    expect(findHostByTestId(renderer, 'route-graph-edge-edge-1').props.points).toEqual([
      40,
      80,
      160,
      240
    ]);
  });

  it('keeps custom intermediate edge points while using current node endpoints', () => {
    graph = {
      ...graph,
      edges: [
        {
          ...graph.edges[0]!,
          points: [
            { x: 100, y: 100 },
            { x: 2, y: 3 },
            { x: 200, y: 200 }
          ]
        }
      ]
    };

    const renderer = renderLayer();

    expect(findHostByTestId(renderer, 'route-graph-edge-edge-1').props.points).toEqual([
      40,
      80,
      80,
      120,
      160,
      240
    ]);
  });

  it('updates connected edges from live node positions during drag', () => {
    const renderer = renderLayer();
    const nodeA = findHostByTestId(renderer, 'route-graph-node-node-a');

    act(() => {
      nodeA.props.onDragMove({
        cancelBubble: false,
        target: {
          x: () => 200,
          y: () => 280
        }
      });
    });

    expect(findHostByTestId(renderer, 'route-graph-node-node-a').props).toMatchObject({
      x: 200,
      y: 280
    });
    expect(findHostByTestId(renderer, 'route-graph-edge-edge-1').props.points).toEqual([
      200,
      280,
      160,
      240
    ]);
  });

  it('creates an edge after clicking node A then node B', async () => {
    const renderer = renderLayer();
    const nodeA = findHostByTestId(renderer, 'route-graph-node-node-a');

    await act(async () => {
      await nodeA.props.onClick({ cancelBubble: false });
    });

    const nodeB = findHostByTestId(renderer, 'route-graph-node-node-b');

    await act(async () => {
      await nodeB.props.onClick({ cancelBubble: false });
    });

    expect(createEdgeMutateAsync).toHaveBeenCalledWith({
      sourceNodeId: 'node-a',
      targetNodeId: 'node-b',
      cost: 5,
      reverseCost: -1,
      points: [
        { x: 1, y: 2 },
        { x: 4, y: 6 }
      ]
    });
    expect(getRouteGraphCanvasSnapshot().pendingSourceNodeId).toBeNull();
  });

  it('does not create a self-edge when clicking the same pending node', async () => {
    const renderer = renderLayer();
    const nodeA = findHostByTestId(renderer, 'route-graph-node-node-a');

    await act(async () => {
      await nodeA.props.onClick({ cancelBubble: false });
      await nodeA.props.onClick({ cancelBubble: false });
    });

    expect(createEdgeMutateAsync).not.toHaveBeenCalled();
    expect(getRouteGraphCanvasSnapshot().pendingSourceNodeId).toBe('node-a');
  });

  it('patches node x/y as world metre coordinates on drag end', async () => {
    const renderer = renderLayer();
    const nodeA = findHostByTestId(renderer, 'route-graph-node-node-a');

    await act(async () => {
      await nodeA.props.onDragEnd({
        cancelBubble: false,
        target: {
          x: () => 82,
          y: () => 126
        }
      });
    });

    expect(patchNodeMutateAsync).toHaveBeenCalledWith({
      nodeId: 'node-a',
      body: { x: 2.1, y: 3.2 }
    });
  });

  it('selects an edge and clears pending source on edge click', () => {
    routeGraphCanvasActions.setPendingSourceNodeId('node-a');
    const renderer = renderLayer();
    const edge = findHostByTestId(renderer, 'route-graph-edge-edge-1');

    act(() => {
      edge.props.onClick({ cancelBubble: false });
    });

    expect(getRouteGraphCanvasSnapshot()).toEqual({
      selectedElement: { type: 'edge', id: 'edge-1' },
      pendingSourceNodeId: null
    });
  });
});
