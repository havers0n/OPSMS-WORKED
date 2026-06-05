import { Arrow, Circle, Line, Rect, Text } from 'react-konva';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';
import type { RouteObstacle } from '@/features/obstacle-route-planning/model/obstacle-types';
import type {
  PickingRouteAnchor,
  PickingRouteSegmentDiagnostics,
  SolvedRouteSegment
} from '../model/route-step-geometry';

type PickingRouteOverlayLayerProps = {
  anchors: PickingRouteAnchor[];
  solvedSegments?: SolvedRouteSegment[];
  startCanvasPoint?: { x: number; y: number } | null;
  showDiagnostics?: boolean;
  diagnosticObstacles?: RouteObstacle[];
};

function toCanvasPointFromGridCell(
  diagnostics: PickingRouteSegmentDiagnostics,
  cell: { x: number; y: number }
) {
  if (!diagnostics.grid) return null;

  return {
    x:
      (diagnostics.grid.minX + cell.x * diagnostics.grid.resolutionM) * WORLD_SCALE,
    y:
      (diagnostics.grid.minY + cell.y * diagnostics.grid.resolutionM) * WORLD_SCALE
  };
}

function renderObstacle(obstacle: RouteObstacle) {
  if (obstacle.type === 'rack') {
    return (
      <Rect
        key={`diag-obstacle-${obstacle.id}`}
        x={obstacle.x * WORLD_SCALE}
        y={obstacle.y * WORLD_SCALE}
        width={obstacle.width * WORLD_SCALE}
        height={obstacle.height * WORLD_SCALE}
        fill="rgba(239,68,68,0.08)"
        stroke="rgba(239,68,68,0.28)"
        strokeWidth={1}
        strokeScaleEnabled={false}
      />
    );
  }

  return (
    <Line
      key={`diag-obstacle-${obstacle.id}`}
      points={[
        obstacle.x1 * WORLD_SCALE,
        obstacle.y1 * WORLD_SCALE,
        obstacle.x2 * WORLD_SCALE,
        obstacle.y2 * WORLD_SCALE
      ]}
      stroke="rgba(239,68,68,0.32)"
      strokeWidth={2}
      strokeScaleEnabled={false}
      dash={[4, 4]}
    />
  );
}

function renderSegmentDiagnostics(segment: SolvedRouteSegment) {
  const diagnostics = segment.diagnostics;
  if (!diagnostics) return null;

  const elements = [];

  if (diagnostics.solverBounds) {
    elements.push(
      <Rect
        key={`diag-bounds-${segment.fromStepId}-${segment.toStepId}`}
        x={diagnostics.solverBounds.minX * WORLD_SCALE}
        y={diagnostics.solverBounds.minY * WORLD_SCALE}
        width={
          (diagnostics.solverBounds.maxX - diagnostics.solverBounds.minX) * WORLD_SCALE
        }
        height={
          (diagnostics.solverBounds.maxY - diagnostics.solverBounds.minY) * WORLD_SCALE
        }
        stroke="rgba(14,165,233,0.35)"
        strokeWidth={1}
        strokeScaleEnabled={false}
        dash={[8, 4]}
      />
    );
  }

  if (diagnostics.grid) {
    for (const cell of diagnostics.blockedGridCells) {
      elements.push(
        <Rect
          key={`diag-blocked-${segment.fromStepId}-${segment.toStepId}-${cell.x}-${cell.y}`}
          x={
            (diagnostics.grid.minX +
              (cell.x - 0.5) * diagnostics.grid.resolutionM) *
            WORLD_SCALE
          }
          y={
            (diagnostics.grid.minY +
              (cell.y - 0.5) * diagnostics.grid.resolutionM) *
            WORLD_SCALE
          }
          width={diagnostics.grid.resolutionM * WORLD_SCALE}
          height={diagnostics.grid.resolutionM * WORLD_SCALE}
          fill="rgba(239,68,68,0.06)"
          stroke="rgba(239,68,68,0.12)"
          strokeWidth={0.5}
          strokeScaleEnabled={false}
        />
      );
    }
  }

  if (diagnostics.pathWorldPoints.length > 1) {
    elements.push(
      <Line
        key={`diag-path-${segment.fromStepId}-${segment.toStepId}`}
        points={diagnostics.pathWorldPoints.flatMap((point) => [
          point.x * WORLD_SCALE,
          point.y * WORLD_SCALE
        ])}
        stroke="rgba(16,185,129,0.5)"
        strokeWidth={1}
        strokeScaleEnabled={false}
        dash={[3, 3]}
        lineCap="round"
        lineJoin="round"
      />
    );
  }

  if (diagnostics.fromCanvasPoint) {
    elements.push(
      <Circle
        key={`diag-from-${segment.fromStepId}-${segment.toStepId}`}
        x={diagnostics.fromCanvasPoint.x}
        y={diagnostics.fromCanvasPoint.y}
        radius={4}
        fill="rgba(234,179,8,0.9)"
        stroke="white"
        strokeWidth={1}
        strokeScaleEnabled={false}
      />
    );
  }

  if (diagnostics.toCanvasPoint) {
    elements.push(
      <Circle
        key={`diag-to-${segment.fromStepId}-${segment.toStepId}`}
        x={diagnostics.toCanvasPoint.x}
        y={diagnostics.toCanvasPoint.y}
        radius={4}
        fill="rgba(249,115,22,0.9)"
        stroke="white"
        strokeWidth={1}
        strokeScaleEnabled={false}
      />
    );
  }

  for (const snappedCell of [
    diagnostics.snappedStartCell,
    diagnostics.snappedEndCell
  ].filter(Boolean)) {
    const snappedPoint = toCanvasPointFromGridCell(
      diagnostics,
      snappedCell as { x: number; y: number }
    );
    if (!snappedPoint) continue;
    elements.push(
      <Circle
        key={`diag-snap-${segment.fromStepId}-${segment.toStepId}-${snappedCell!.x}-${snappedCell!.y}`}
        x={snappedPoint.x}
        y={snappedPoint.y}
        radius={5}
        stroke="rgba(168,85,247,0.95)"
        strokeWidth={2}
        strokeScaleEnabled={false}
      />
    );
  }

  if (segment.status === 'unroutable' && segment.fromCanvasPoint && segment.toCanvasPoint) {
    const text = ['UNROUTABLE:', segment.solverStatus, segment.debugReason]
      .filter(Boolean)
      .join(' ');
    elements.push(
      <Text
        key={`diag-label-${segment.fromStepId}-${segment.toStepId}`}
        x={(segment.fromCanvasPoint.x + segment.toCanvasPoint.x) / 2 + 8}
        y={(segment.fromCanvasPoint.y + segment.toCanvasPoint.y) / 2 - 12}
        text={text}
        fontSize={11}
        fontStyle="bold"
        fill="rgba(185,28,28,0.95)"
        listening={false}
      />
    );
  }

  return elements;
}

export function PickingRouteOverlayLayer({
  anchors,
  solvedSegments,
  startCanvasPoint,
  showDiagnostics = false,
  diagnosticObstacles = []
}: PickingRouteOverlayLayerProps) {
  return (
    <>
      {showDiagnostics &&
        diagnosticObstacles.map((obstacle) => renderObstacle(obstacle))}
      {showDiagnostics &&
        solvedSegments?.flatMap((segment) => renderSegmentDiagnostics(segment) ?? [])}
      {startCanvasPoint && (
        <>
          <Circle
            x={startCanvasPoint.x}
            y={startCanvasPoint.y}
            radius={7}
            fill="rgba(22,163,74,0.92)"
            stroke="white"
            strokeWidth={2}
            strokeScaleEnabled={false}
          />
          <Text
            x={startCanvasPoint.x + 10}
            y={startCanvasPoint.y - 6}
            text="Start"
            fontSize={11}
            fontStyle="bold"
            fill="rgba(22,163,74,0.95)"
            listening={false}
          />
        </>
      )}
      {solvedSegments
        ? solvedSegments.map((seg) => {
            if (seg.status === 'ok') {
              return (
                <Line
                  key={`route-${seg.fromStepId}-${seg.toStepId}`}
                  points={seg.canvasPoints.flatMap((p) => [p.x, p.y])}
                  stroke="rgba(37,99,235,0.72)"
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                  lineCap="round"
                  lineJoin="round"
                />
              );
            }
            if (!seg.fromCanvasPoint || !seg.toCanvasPoint) return null;
            return (
              <Arrow
                key={`route-${seg.fromStepId}-${seg.toStepId}`}
                points={[
                  seg.fromCanvasPoint.x,
                  seg.fromCanvasPoint.y,
                  seg.toCanvasPoint.x,
                  seg.toCanvasPoint.y
                ]}
                pointerLength={10}
                pointerWidth={8}
                stroke="rgba(234,88,12,0.72)"
                fill="rgba(234,88,12,0.72)"
                strokeWidth={2}
                strokeScaleEnabled={false}
                dash={[6, 4]}
                lineCap="round"
                lineJoin="round"
              />
            );
          })
        : anchors.slice(1).map((anchor, index) => {
            const previous = anchors[index];
            if (anchor.status !== 'resolved' || previous?.status !== 'resolved') {
              return null;
            }
            return (
              <Arrow
                key={`line-${previous.stepId}-${anchor.stepId}`}
                points={[
                  previous.point.x,
                  previous.point.y,
                  anchor.point.x,
                  anchor.point.y
                ]}
                pointerLength={10}
                pointerWidth={8}
                stroke="rgba(37,99,235,0.72)"
                fill="rgba(37,99,235,0.72)"
                strokeWidth={2}
                strokeScaleEnabled={false}
                lineCap="round"
                lineJoin="round"
              />
            );
          })}
      {anchors.map((anchor) => {
        if (anchor.status !== 'resolved') return null;
        return (
          <Circle
            key={`marker-${anchor.stepId}`}
            x={anchor.point.x}
            y={anchor.point.y}
            radius={9}
            fill="rgba(37,99,235,0.88)"
            stroke="white"
            strokeWidth={2}
            strokeScaleEnabled={false}
          />
        );
      })}
      {anchors.map((anchor, index) => {
        if (anchor.status !== 'resolved') return null;
        return (
          <Text
            key={`label-${anchor.stepId}`}
            x={anchor.point.x - 4}
            y={anchor.point.y - 6}
            text={String(index + 1)}
            fontSize={10}
            fontStyle="bold"
            fill="white"
            listening={false}
            scaleX={1}
            scaleY={1}
          />
        );
      })}
    </>
  );
}
