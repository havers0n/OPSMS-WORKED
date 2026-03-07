/**
 * RackCells  (LOD 2)
 *
 * Renders individual cell slots as a grid inside each face.
 * Each section is divided into columns (one per level-slot combo).
 *
 * Layout per face:
 *   - Section divided into level rows
 *   - Each level row divided into slots (horizontal columns within the section)
 *
 * We draw a thin rectangle for each slot cell.
 * When there are too many cells to label, we omit text and rely on colour only.
 */
import { Group, Rect, Text } from 'react-konva';
import type { RackFace } from '@wos/domain';
import { getSectionWidths, type CanvasRackGeometry } from '../../lib/canvas-geometry';

// Minimum pixel dimensions to bother drawing a cell
const MIN_CELL_W = 6;
const MIN_CELL_H = 5;
// Minimum pixel dimensions to add a slot label
const LABEL_MIN_W = 18;
const LABEL_MIN_H = 12;

const CELL_FILL_A     = '#e0f2fe';   // sky-100
const CELL_FILL_B     = '#ede9fe';   // violet-100
const CELL_STROKE     = '#bae6fd';   // sky-200
const CELL_STROKE_B   = '#ddd6fe';   // violet-200
const CELL_TEXT       = '#0369a1';   // sky-700
const CELL_TEXT_B     = '#5b21b6';   // violet-800

type FaceProps = {
  face: RackFace;
  totalWidth: number;
  bandY: number;       // top y of this face band
  bandH: number;       // height available for this face
  isSelected: boolean;
  cellFill: string;
  cellStroke: string;
  cellText: string;
};

function FaceCells({ face, totalWidth, bandY, bandH, cellFill, cellStroke, cellText }: FaceProps) {
  if (!face.sections.length) return null;
  const sectionOffsets = getSectionWidths(totalWidth, face.sections);

  return (
    <Group listening={false}>
      {face.sections.map((sec, si) => {
        const secX = sectionOffsets[si];
        const secW = sectionOffsets[si + 1] - secX;
        if (secW < MIN_CELL_W * 2) return null;

        const levelCount = sec.levels.length;
        if (!levelCount) return null;

        // Each level occupies an equal horizontal band
        const levelH = bandH / levelCount;
        if (levelH < MIN_CELL_H) return null;

        return sec.levels.map((level, li) => {
          const levelY = bandY + li * levelH;
          const slotW  = secW / level.slotCount;

          return Array.from({ length: level.slotCount }, (_, slotIdx) => {
            const cellX = secX + slotIdx * slotW;
            const cellW = slotW - 1;       // 1 px gap between slots
            const cellH = levelH - 1;      // 1 px gap between levels
            const showLabel = cellW >= LABEL_MIN_W && cellH >= LABEL_MIN_H;

            return (
              <Group key={`${sec.id}-${level.id}-${slotIdx}`}>
                <Rect
                  x={cellX + 0.5}
                  y={levelY + 0.5}
                  width={Math.max(1, cellW)}
                  height={Math.max(1, cellH)}
                  cornerRadius={1}
                  fill={cellFill}
                  stroke={cellStroke}
                  strokeWidth={0.5}
                />
                {showLabel && (
                  <Text
                    x={cellX + cellW / 2 - 6}
                    y={levelY + cellH / 2 - 4}
                    text={String(slotIdx + 1)}
                    fontSize={7}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fill={cellText}
                    opacity={0.7}
                  />
                )}
              </Group>
            );
          });
        });
      })}
    </Group>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────
type Props = {
  geometry: CanvasRackGeometry;
  faceA: RackFace;
  faceB: RackFace | null;
  isSelected: boolean;
};

export function RackCells({ geometry, faceA, faceB, isSelected }: Props) {
  const { width, height, isPaired, spineY } = geometry;

  const faceAHeight = isPaired ? spineY : height;
  // Add small inset so cells don't overlap the body stroke/stripe
  const inset = 4;

  return (
    <Group listening={false}>
      <FaceCells
        face={faceA}
        totalWidth={width}
        bandY={inset}
        bandH={faceAHeight - inset * 2}
        isSelected={isSelected}
        cellFill={CELL_FILL_A}
        cellStroke={CELL_STROKE}
        cellText={CELL_TEXT}
      />
      {isPaired && faceB && (
        <FaceCells
          face={faceB}
          totalWidth={width}
          bandY={spineY + inset}
          bandH={height - spineY - inset * 2}
          isSelected={isSelected}
          cellFill={CELL_FILL_B}
          cellStroke={CELL_STROKE_B}
          cellText={CELL_TEXT_B}
        />
      )}
    </Group>
  );
}
