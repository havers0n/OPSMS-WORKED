import { Group, Line, Rect } from 'react-konva';
import type { RackFace } from '@wos/domain';
import { getSectionWidths, type CanvasRackGeometry } from '@/entities/layout-version/lib/canvas-geometry';

type Props = {
  geometry: CanvasRackGeometry;
  faceA: RackFace;
  faceB: RackFace | null;
  isSelected: boolean;
  isPassive?: boolean;
};

const DIVIDER_STROKE = '#94a3b8';
const DIVIDER_STROKE_SEL = '#0f6a8e';
const SECTION_FILL_A_SEL = 'rgba(14, 165, 233, 0.12)';
const SECTION_FILL_B_SEL = 'rgba(124, 58, 237, 0.12)';

export function RackSections({ geometry, faceA, faceB, isSelected, isPassive = false }: Props) {
  const { faceAWidth, faceBWidth, height, isPaired, spineY } = geometry;
  const divider = isSelected ? DIVIDER_STROKE_SEL : DIVIDER_STROKE;

  const faceAOffsets = getSectionWidths(faceAWidth, faceA.sections);
  const faceBOffsets = faceB && faceB.sections.length > 0
    ? getSectionWidths(faceBWidth, faceB.sections)
    : getSectionWidths(faceAWidth, faceA.sections);

  const faceABottom = isPaired ? spineY : height;
  const faceBTop = spineY;

  return (
    <Group listening={false} opacity={isPassive && !isSelected ? 0.45 : 1}>
      {isSelected && faceA.sections.map((sec, i) => {
        const x0 = faceAOffsets[i];
        const x1 = faceAOffsets[i + 1];
        const sectionW = x1 - x0;
        if (sectionW < 8) return null;

        return (
          <Rect
            key={`sa-fill-${sec.id}`}
            x={x0 + 1}
            y={4}
            width={Math.max(1, sectionW - 2)}
            height={Math.max(1, faceABottom - 8)}
            fill={SECTION_FILL_A_SEL}
            cornerRadius={4}
          />
        );
      })}

      {faceAOffsets.slice(1, -1).map((x, i) => (
        <Line
          key={`sa-${i}`}
          points={[x, 4, x, faceABottom - 4]}
          stroke={divider}
          strokeWidth={isSelected ? 1.5 : 1}
          dash={[4, 3]}
          opacity={isSelected ? 0.9 : 0.5}
        />
      ))}

      {isSelected && isPaired && faceB && faceB.sections.map((sec, i) => {
        const x0 = faceBOffsets[i];
        const x1 = faceBOffsets[i + 1];
        const sectionW = x1 - x0;
        if (sectionW < 8) return null;

        return (
          <Rect
            key={`sb-fill-${sec.id}`}
            x={x0 + 1}
            y={faceBTop + 4}
            width={Math.max(1, sectionW - 2)}
            height={Math.max(1, height - faceBTop - 8)}
            fill={SECTION_FILL_B_SEL}
            cornerRadius={4}
          />
        );
      })}

      {isPaired && faceBOffsets.slice(1, -1).map((x, i) => (
        <Line
          key={`sb-${i}`}
          points={[x, faceBTop + 4, x, height - 4]}
          stroke={divider}
          strokeWidth={isSelected ? 1.5 : 1}
          dash={[4, 3]}
          opacity={isSelected ? 0.9 : 0.5}
        />
      ))}
    </Group>
  );
}
