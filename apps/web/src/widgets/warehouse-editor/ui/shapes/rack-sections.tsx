import { Group, Line } from 'react-konva';
import type { RackFace } from '@wos/domain';
import { getSectionWidths, type CanvasRackGeometry } from '../../lib/canvas-geometry';

type Props = {
  geometry: CanvasRackGeometry;
  faceA: RackFace;
  faceB: RackFace | null;
  isSelected: boolean;
};

const DIVIDER_STROKE = '#94a3b8';
const DIVIDER_STROKE_SEL = '#0f6a8e';

export function RackSections({ geometry, faceA, faceB, isSelected }: Props) {
  const { faceAWidth, faceBWidth, height, isPaired, spineY } = geometry;
  const divider = isSelected ? DIVIDER_STROKE_SEL : DIVIDER_STROKE;

  const faceAOffsets = getSectionWidths(faceAWidth, faceA.sections);
  const faceBOffsets = faceB && faceB.sections.length > 0
    ? getSectionWidths(faceBWidth, faceB.sections)
    : getSectionWidths(faceAWidth, faceA.sections);

  const faceABottom = isPaired ? spineY : height;
  const faceBTop = spineY;

  return (
    <Group listening={false}>
      {faceAOffsets.slice(1, -1).map((x, i) => (
        <Line
          key={`sa-${i}`}
          points={[x, 4, x, faceABottom - 4]}
          stroke={divider}
          strokeWidth={1}
          dash={[4, 3]}
          opacity={0.5}
        />
      ))}

      {isPaired && faceBOffsets.slice(1, -1).map((x, i) => (
        <Line
          key={`sb-${i}`}
          points={[x, faceBTop + 4, x, height - 4]}
          stroke={divider}
          strokeWidth={1}
          dash={[4, 3]}
          opacity={0.5}
        />
      ))}
    </Group>
  );
}
