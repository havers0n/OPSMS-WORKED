import type Konva from 'konva';
import { Circle, Layer, Line, Text } from 'react-konva';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import type { RoutePoint, RouteSolveResult } from '../model/obstacle-types';

type ObstacleRouteLayerProps = {
  start: RoutePoint | null;
  end: RoutePoint | null;
  result: RouteSolveResult | null;
  onStartDragEnd: (point: RoutePoint) => void;
  onEndDragEnd: (point: RoutePoint) => void;
};

function toCanvasPoint(point: RoutePoint) {
  return {
    x: point.x * WORLD_SCALE,
    y: point.y * WORLD_SCALE
  };
}

function toWorldPointFromNode(node: Konva.Node): RoutePoint {
  return {
    x: Math.round((node.x() / WORLD_SCALE) * 10) / 10,
    y: Math.round((node.y() / WORLD_SCALE) * 10) / 10
  };
}

function routeLinePoints(points: RoutePoint[]) {
  return points.flatMap((point) => [point.x * WORLD_SCALE, point.y * WORLD_SCALE]);
}

function getStatusText(result: RouteSolveResult | null) {
  if (!result || result.status === 'ok') return null;

  const label =
    result.status === 'no_path'
      ? 'No path'
      : result.status === 'start_blocked'
        ? 'Start blocked'
        : 'End blocked';

  return result.debugReason ? `${label} (${result.debugReason})` : label;
}

function getStatusPosition(start: RoutePoint | null, end: RoutePoint | null) {
  const anchor = end ?? start ?? { x: 0, y: 0 };
  return {
    x: anchor.x * WORLD_SCALE + 12,
    y: anchor.y * WORLD_SCALE - 28
  };
}

export function ObstacleRouteLayer({
  start,
  end,
  result,
  onStartDragEnd,
  onEndDragEnd
}: ObstacleRouteLayerProps) {
  const startCanvas = start ? toCanvasPoint(start) : null;
  const endCanvas = end ? toCanvasPoint(end) : null;
  const statusText = getStatusText(result);
  const statusPosition = getStatusPosition(start, end);

  return (
    <Layer name="obstacle-route-layer" listening>
      {result?.status === 'ok' && result.points.length >= 2 && (
        <Line
          data-testid="obstacle-route-line"
          points={routeLinePoints(result.points)}
          stroke="#0f766e"
          strokeWidth={4}
          strokeScaleEnabled={false}
          lineCap="round"
          lineJoin="round"
          opacity={0.92}
        />
      )}

      {startCanvas && (
        <Circle
          data-testid="obstacle-route-start"
          x={startCanvas.x}
          y={startCanvas.y}
          radius={7}
          fill="#16a34a"
          stroke="#ffffff"
          strokeWidth={2}
          strokeScaleEnabled={false}
          draggable
          onMouseDown={(event) => {
            event.cancelBubble = true;
          }}
          onClick={(event) => {
            event.cancelBubble = true;
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true;
            onStartDragEnd(toWorldPointFromNode(event.target));
          }}
        />
      )}

      {endCanvas && (
        <Circle
          data-testid="obstacle-route-end"
          x={endCanvas.x}
          y={endCanvas.y}
          radius={7}
          fill="#dc2626"
          stroke="#ffffff"
          strokeWidth={2}
          strokeScaleEnabled={false}
          draggable
          onMouseDown={(event) => {
            event.cancelBubble = true;
          }}
          onClick={(event) => {
            event.cancelBubble = true;
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true;
            onEndDragEnd(toWorldPointFromNode(event.target));
          }}
        />
      )}

      {statusText && (
        <Text
          data-testid="obstacle-route-status"
          x={statusPosition.x}
          y={statusPosition.y}
          text={statusText}
          fontSize={13}
          fontStyle="bold"
          fill="#991b1b"
          stroke="#ffffff"
          strokeWidth={3}
          strokeScaleEnabled={false}
        />
      )}
    </Layer>
  );
}
