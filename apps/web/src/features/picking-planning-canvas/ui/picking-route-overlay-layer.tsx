import { Arrow, Circle, Line, Text } from 'react-konva';
import type { PickingRouteAnchor, SolvedRouteSegment } from '../model/route-step-geometry';

type PickingRouteOverlayLayerProps = {
  anchors: PickingRouteAnchor[];
  solvedSegments?: SolvedRouteSegment[];
};

export function PickingRouteOverlayLayer({
  anchors,
  solvedSegments
}: PickingRouteOverlayLayerProps) {
  return (
    <>
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
