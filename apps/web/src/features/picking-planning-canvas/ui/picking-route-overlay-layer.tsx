import { Arrow, Circle, Layer, Text } from 'react-konva';
import type { PickingRouteAnchor } from '../model/route-step-geometry';

type PickingRouteOverlayLayerProps = {
  anchors: PickingRouteAnchor[];
};

export function PickingRouteOverlayLayer({
  anchors
}: PickingRouteOverlayLayerProps) {
  return (
    <Layer listening={false}>
      {anchors.slice(1).map((anchor, index) => {
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
      {anchors.map((anchor, index) => {
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
    </Layer>
  );
}
