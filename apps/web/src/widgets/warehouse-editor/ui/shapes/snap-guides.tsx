import { Layer, Line } from 'react-konva';

type SnapGuide = { type: 'x' | 'y'; position: number };
type GridLines = { v: number[]; h: number[]; startX: number; endX: number; startY: number; endY: number };

export function SnapGuides({
  guides,
  gridLines
}: {
  guides: SnapGuide[];
  gridLines: GridLines;
}) {
  return (
    <Layer listening={false}>
      {guides.map((guide, idx) => {
        if (guide.type === 'x') {
          // Vertical snap guide (X-axis alignment)
          return (
            <Line
              key={`snap-x-${idx}`}
              points={[guide.position, gridLines.startY, guide.position, gridLines.endY]}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeScaleEnabled={false}
              dash={[5, 5]}
              opacity={0.8}
            />
          );
        } else {
          // Horizontal snap guide (Y-axis alignment)
          return (
            <Line
              key={`snap-y-${idx}`}
              points={[gridLines.startX, guide.position, gridLines.endX, guide.position]}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeScaleEnabled={false}
              dash={[5, 5]}
              opacity={0.8}
            />
          );
        }
      })}
    </Layer>
  );
}
