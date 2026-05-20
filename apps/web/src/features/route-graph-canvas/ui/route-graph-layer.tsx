import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Circle, Group, Layer, Line, Text } from 'react-konva';
import type Konva from 'konva';
import {
  routeGraphQueryOptions
} from '@/entities/route-graph/api/queries';
import {
  useCreateRouteEdge,
  usePatchRouteNode
} from '@/entities/route-graph/api/mutations';
import type {
  RouteGraphEdge,
  RouteGraphNode,
  RouteGraphPoint
} from '@/entities/route-graph/model/types';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import {
  useRouteGraphPendingSourceNodeId,
  useRouteGraphSelectedElement,
  useSetRouteGraphPendingSourceNodeId,
  useSetRouteGraphSelectedElement
} from '../model/route-graph-canvas-store';

type RouteGraphLayerProps = {
  floorId: string;
};

function toCanvasPoint(point: RouteGraphPoint) {
  return {
    x: point.x * WORLD_SCALE,
    y: point.y * WORLD_SCALE
  };
}

function roundWorldCoordinate(value: number) {
  return Math.round(value * 10) / 10;
}

function getEdgeCanvasPoints(
  edge: RouteGraphEdge,
  nodesById: Map<string, RouteGraphNode>
) {
  const points =
    edge.points.length >= 2
      ? edge.points
      : [
          nodesById.get(edge.sourceNodeId),
          nodesById.get(edge.targetNodeId)
        ].flatMap((node) => (node ? [{ x: node.x, y: node.y }] : []));

  return points.flatMap((point) => {
    const canvasPoint = toCanvasPoint(point);
    return [canvasPoint.x, canvasPoint.y];
  });
}

function getDefaultEdgeBody(
  source: RouteGraphNode,
  target: RouteGraphNode
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy);

  return {
    sourceNodeId: source.id,
    targetNodeId: target.id,
    cost: distance > 0 ? roundWorldCoordinate(distance) : 1,
    reverseCost: -1,
    points: [
      { x: source.x, y: source.y },
      { x: target.x, y: target.y }
    ]
  };
}

export function RouteGraphLayer({ floorId }: RouteGraphLayerProps) {
  const { data: graph = { nodes: [], edges: [] } } = useQuery(
    routeGraphQueryOptions(floorId)
  );
  const selectedElement = useRouteGraphSelectedElement();
  const pendingSourceNodeId = useRouteGraphPendingSourceNodeId();
  const setSelectedElement = useSetRouteGraphSelectedElement();
  const setPendingSourceNodeId = useSetRouteGraphPendingSourceNodeId();
  const createRouteEdgeMutation = useCreateRouteEdge(floorId);
  const patchRouteNodeMutation = usePatchRouteNode(floorId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nodesById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes]
  );

  const handleNodeClick = useCallback(
    async (
      event: Konva.KonvaEventObject<MouseEvent>,
      node: RouteGraphNode
    ) => {
      event.cancelBubble = true;
      setSelectedElement({ type: 'node', id: node.id });

      if (pendingSourceNodeId === null) {
        setPendingSourceNodeId(node.id);
        return;
      }

      if (pendingSourceNodeId === node.id) {
        return;
      }

      const sourceNode = nodesById.get(pendingSourceNodeId);
      if (!sourceNode) {
        setPendingSourceNodeId(null);
        return;
      }

      try {
        setErrorMessage(null);
        await createRouteEdgeMutation.mutateAsync(
          getDefaultEdgeBody(sourceNode, node)
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to create route edge.'
        );
      } finally {
        setPendingSourceNodeId(null);
      }
    },
    [
      createRouteEdgeMutation,
      nodesById,
      pendingSourceNodeId,
      setPendingSourceNodeId,
      setSelectedElement
    ]
  );

  const handleEdgeClick = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>, edge: RouteGraphEdge) => {
      event.cancelBubble = true;
      setSelectedElement({ type: 'edge', id: edge.id });
      setPendingSourceNodeId(null);
    },
    [setPendingSourceNodeId, setSelectedElement]
  );

  const handleNodeDragEnd = useCallback(
    async (
      event: Konva.KonvaEventObject<DragEvent>,
      node: RouteGraphNode
    ) => {
      event.cancelBubble = true;
      try {
        setErrorMessage(null);
        await patchRouteNodeMutation.mutateAsync({
          nodeId: node.id,
          body: {
            x: roundWorldCoordinate(event.target.x() / WORLD_SCALE),
            y: roundWorldCoordinate(event.target.y() / WORLD_SCALE)
          }
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to update route node.'
        );
      }
    },
    [patchRouteNodeMutation]
  );

  return (
    <Layer name="route-graph-layer">
      {graph.edges.map((edge) => {
        const points = getEdgeCanvasPoints(edge, nodesById);
        if (points.length < 4) return null;
        const isSelected =
          selectedElement?.type === 'edge' && selectedElement.id === edge.id;

        return (
          <Group key={edge.id}>
            <Line
              data-testid={`route-graph-edge-hit-${edge.id}`}
              points={points}
              stroke="rgba(0,0,0,0)"
              strokeWidth={16}
              strokeScaleEnabled={false}
              onClick={(event) => void handleEdgeClick(event, edge)}
            />
            <Line
              data-testid={`route-graph-edge-${edge.id}`}
              points={points}
              stroke={isSelected ? '#2563eb' : '#0f766e'}
              strokeWidth={isSelected ? 3 : 2}
              strokeScaleEnabled={false}
              opacity={0.82}
              onClick={(event) => void handleEdgeClick(event, edge)}
            />
          </Group>
        );
      })}

      {graph.nodes.map((node) => {
        const isSelected =
          selectedElement?.type === 'node' && selectedElement.id === node.id;
        const isPending = pendingSourceNodeId === node.id;
        const radius = isSelected || isPending ? 7 : 5;

        return (
          <Group
            key={node.id}
            data-testid={`route-graph-node-${node.id}`}
            x={node.x * WORLD_SCALE}
            y={node.y * WORLD_SCALE}
            draggable
            onClick={(event) => void handleNodeClick(event, node)}
            onDragEnd={(event) => void handleNodeDragEnd(event, node)}
          >
            <Circle
              radius={radius}
              fill={isPending ? '#f59e0b' : '#14b8a6'}
              stroke={isSelected ? '#1d4ed8' : '#0f766e'}
              strokeWidth={isSelected ? 3 : 2}
              strokeScaleEnabled={false}
            />
            {node.label && (
              <Text
                text={node.label}
                x={9}
                y={-8}
                fontSize={11}
                fill="#0f172a"
                listening={false}
              />
            )}
          </Group>
        );
      })}

      {errorMessage && (
        <Text
          data-testid="route-graph-error"
          text={errorMessage}
          x={16}
          y={16}
          fontSize={12}
          fill="#b91c1c"
          listening={false}
        />
      )}
    </Layer>
  );
}
