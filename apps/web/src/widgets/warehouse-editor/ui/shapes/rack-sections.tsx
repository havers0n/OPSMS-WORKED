/**
 * RackSections  (LOD 1)
 *
 * Draws vertical divider lines between rack sections inside the body.
 * For a paired rack each face half gets its own dividers (same x-positions).
 *
 * Does NOT draw the outer border (that is RackBody's job).
 */
import { Group, Line, Rect, Text } from 'react-konva';
import type { RackFace } from '@wos/domain';
import { getSectionWidths, type CanvasRackGeometry } from '../../lib/canvas-geometry';

type Props = {
  geometry: CanvasRackGeometry;
  faceA: RackFace;
  faceB: RackFace | null;   // null for single racks
  isSelected: boolean;
};

const DIVIDER_STROKE    = '#94a3b8';  // slate-400
const DIVIDER_STROKE_SEL = '#0f6a8e';
const LABEL_FILL        = '#475569';  // slate-600
const LABEL_FILL_SEL    = '#0f6a8e';

export function RackSections({ geometry, faceA, faceB, isSelected }: Props) {
  const { width, height, isPaired, spineY } = geometry;
  const divider = isSelected ? DIVIDER_STROKE_SEL : DIVIDER_STROKE;
  const labelFill = isSelected ? LABEL_FILL_SEL : LABEL_FILL;

  // x-offsets for each section boundary
  const faceAOffsets = getSectionWidths(width, faceA.sections);

  // Face B may have a different section layout if not mirrored
  const faceBOffsets = (faceB && faceB.sections.length > 0)
    ? getSectionWidths(width, faceB.sections)
    : faceAOffsets;

  const faceABottom = isPaired ? spineY : height;
  const faceBTop    = spineY;          // only used when isPaired

  const sectionLabelY = 6;

  return (
    <Group listening={false}>

      {/* ── Face A section dividers ─────────────────────────────── */}
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

      {/* ── Face A section ordinals ─────────────────────────────── */}
      {faceA.sections.map((sec, i) => {
        const x0 = faceAOffsets[i];
        const x1 = faceAOffsets[i + 1];
        const sectionW = x1 - x0;
        if (sectionW < 20) return null;
        return (
          <Text
            key={`la-${sec.id}`}
            x={x0 + sectionW / 2}
            y={sectionLabelY}
            offsetX={10}
            text={String(sec.ordinal)}
            fontSize={9}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fill={labelFill}
            opacity={0.65}
          />
        );
      })}

      {/* ── Face B section dividers (paired only) ───────────────── */}
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

      {/* ── Face B section ordinals (paired only) ───────────────── */}
      {isPaired && faceB && faceB.sections.map((sec, i) => {
        const x0 = faceBOffsets[i];
        const x1 = faceBOffsets[i + 1];
        const sectionW = x1 - x0;
        if (sectionW < 20) return null;
        return (
          <Text
            key={`lb-${sec.id}`}
            x={x0 + sectionW / 2}
            y={faceBTop + sectionLabelY}
            offsetX={10}
            text={String(sec.ordinal)}
            fontSize={9}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fill={labelFill}
            opacity={0.55}
          />
        );
      })}

      {/* ── Level count badge per section (Face A) ────────────────
          A tiny Rect + Text showing how many levels are configured.
          Appears only when width is large enough. */}
      {faceA.sections.map((sec, i) => {
        const x0 = faceAOffsets[i];
        const x1 = faceAOffsets[i + 1];
        const sectionW = x1 - x0;
        if (sectionW < 36 || sec.levels.length === 0) return null;
        const badgeX = x0 + sectionW - 18;
        const badgeY = faceABottom - 16;
        return (
          <Group key={`badge-a-${sec.id}`}>
            <Rect
              x={badgeX - 2} y={badgeY - 1}
              width={16} height={12}
              cornerRadius={3}
              fill="#e0f2fe"
              opacity={0.85}
            />
            <Text
              x={badgeX} y={badgeY + 1}
              text={`L${sec.levels.length}`}
              fontSize={8}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill="#0369a1"
            />
          </Group>
        );
      })}
    </Group>
  );
}
