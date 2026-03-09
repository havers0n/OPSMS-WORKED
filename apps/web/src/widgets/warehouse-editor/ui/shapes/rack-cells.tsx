/**
 * RackCells  (LOD 2)
 *
 * Renders individual slot cells visible from the top-down canvas view.
 *
 * Physical model reminder
 * ──────────────────────
 *  • The canvas shows the warehouse FLOOR PLAN (view from above).
 *  • Rack length  → horizontal axis (left-right on canvas)
 *  • Rack depth   → vertical axis  (paired rack: Face A top half, Face B bottom half)
 *  • Rack height  → NOT visible from top-down (levels stack upward physically)
 *
 * What we draw here
 * ─────────────────
 *  For each section, the section band is divided into SLOT COLUMNS along the
 *  length axis.  Levels are NOT rendered as rows — they are invisible from above.
 *  The number of slot columns shown comes from the first level's slotCount
 *  (ground-floor reference); a small "Ln" badge (from RackSections) already
 *  indicates how many levels exist.
 */
import { Group, Rect, Text } from 'react-konva';
import type { RackFace } from '@wos/domain';
import { getSectionWidths, type CanvasRackGeometry } from '../../lib/canvas-geometry';

// Minimum pixel dimensions to bother drawing a cell column
const MIN_CELL_W = 5;
const MIN_CELL_H = 4;
// Minimum pixel width to add a slot-index label
const LABEL_MIN_W = 16;
const LABEL_MIN_H = 10;

const CELL_FILL_A   = '#e0f2fe';   // sky-100
const CELL_FILL_B   = '#ede9fe';   // violet-100
const CELL_STROKE   = '#bae6fd';   // sky-200
const CELL_STROKE_B = '#ddd6fe';   // violet-200
const CELL_TEXT     = '#0369a1';   // sky-700
const CELL_TEXT_B   = '#5b21b6';   // violet-800

type FaceProps = {
  face: RackFace;
  totalWidth: number;
  bandY: number;   // top y of this face band inside the rack body
  bandH: number;   // available height for this face band
  cellFill: string;
  cellStroke: string;
  cellText: string;
};

/**
 * Renders slot columns for one face band (top-down perspective).
 *
 * Each section → N slot columns (N = first level's slotCount).
 * The full band height is used for each slot column — levels are NOT split
 * into separate rows because levels go upward (not visible from above).
 */
function FaceCells({ face, totalWidth, bandY, bandH, cellFill, cellStroke, cellText }: FaceProps) {
  if (!face.sections.length) return null;
  const sectionOffsets = getSectionWidths(totalWidth, face.sections);

  const INSET = 4; // vertical inset so cells don't overlap the stripe / spine
  const cellH = bandH - INSET * 2;
  if (cellH < MIN_CELL_H) return null;

  return (
    <Group listening={false}>
      {face.sections.map((sec, si) => {
        const secX = sectionOffsets[si];
        const secW = sectionOffsets[si + 1] - secX;
        if (secW < MIN_CELL_W * 2) return null;

        // Use the first level's slot count as the number of visible slot columns.
        // (Different levels may vary, but from above all slots share the same
        //  horizontal positions along the rack length.)
        const slotCount = sec.levels.length > 0 ? sec.levels[0].slotCount : 0;
        if (!slotCount) return null;

        const slotW = secW / slotCount;
        if (slotW < MIN_CELL_W) return null;

        return Array.from({ length: slotCount }, (_, idx) => {
          const cellX  = secX + idx * slotW;
          const cellW  = slotW - 1; // 1 px gap between adjacent slots
          const showLabel = cellW >= LABEL_MIN_W && cellH >= LABEL_MIN_H;

          return (
            <Group key={`${sec.id}-slot-${idx}`}>
              <Rect
                x={cellX + 0.5}
                y={bandY + INSET}
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
                  y={bandY + INSET + cellH / 2 - 4}
                  text={String(idx + 1)}
                  fontSize={7}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fill={cellText}
                  opacity={0.7}
                />
              )}
            </Group>
          );
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

export function RackCells({ geometry, faceA, faceB, isSelected: _isSelected }: Props) {
  const { faceAWidth, faceBWidth, height, isPaired, spineY } = geometry;

  const faceABandH = isPaired ? spineY : height;

  return (
    <Group listening={false}>
      <FaceCells
        face={faceA}
        totalWidth={faceAWidth}
        bandY={0}
        bandH={faceABandH}
        cellFill={CELL_FILL_A}
        cellStroke={CELL_STROKE}
        cellText={CELL_TEXT}
      />
      {isPaired && faceB && (
        <FaceCells
          face={faceB}
          totalWidth={faceBWidth}
          bandY={spineY}
          bandH={height - spineY}
          cellFill={CELL_FILL_B}
          cellStroke={CELL_STROKE_B}
          cellText={CELL_TEXT_B}
        />
      )}
    </Group>
  );
}
