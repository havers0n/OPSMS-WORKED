import { Group, Rect } from 'react-konva';
import type { RackFace } from '@wos/domain';
import { getSectionWidths, type CanvasRackGeometry } from '../../lib/canvas-geometry';

const MIN_CELL_W = 5;
const MIN_CELL_H = 4;

const CELL_FILL_A = '#e0f2fe';
const CELL_FILL_B = '#ede9fe';
const CELL_STROKE = '#bae6fd';
const CELL_STROKE_B = '#ddd6fe';
const CELL_FILL_SELECTED = '#fef3c7';
const CELL_STROKE_SELECTED = '#f59e0b';

type FaceProps = {
  face: RackFace;
  rackId: string;
  totalWidth: number;
  bandY: number;
  bandH: number;
  cellFill: string;
  cellStroke: string;
  isInteractive: boolean;
  selectedCellId: string | null;
  onCellClick: (cellId: string) => void;
};

function FaceCells({
  face,
  rackId,
  totalWidth,
  bandY,
  bandH,
  cellFill,
  cellStroke,
  isInteractive,
  selectedCellId,
  onCellClick
}: FaceProps) {
  if (!face.sections.length) return null;
  const sectionOffsets = getSectionWidths(totalWidth, face.sections);

  const inset = 4;
  const cellH = bandH - inset * 2;
  if (cellH < MIN_CELL_H) return null;

  return (
    <Group listening={isInteractive}>
      {face.sections.map((sec, si) => {
        const secX = sectionOffsets[si];
        const secW = sectionOffsets[si + 1] - secX;
        if (secW < MIN_CELL_W * 2) return null;

        const slotCount = sec.levels.length > 0 ? sec.levels[0].slotCount : 0;
        if (!slotCount) return null;

        const slotW = secW / slotCount;
        if (slotW < MIN_CELL_W) return null;

        const isRtl = face.slotNumberingDirection === 'rtl';

        return Array.from({ length: slotCount }, (_, idx) => {
          const slotLabel = isRtl ? slotCount - idx : idx + 1;
          const cellId = `${rackId}:${sec.id}:${slotLabel}`;
          const isSelected = isInteractive && selectedCellId === cellId;

          const cellX = secX + idx * slotW;
          const cellW = slotW - 1;
          const fill = isSelected ? CELL_FILL_SELECTED : cellFill;
          const stroke = isSelected ? CELL_STROKE_SELECTED : cellStroke;

          return (
            <Group key={`${sec.id}-slot-${idx}`}>
              <Rect
                x={cellX + 0.5}
                y={bandY + inset}
                width={Math.max(1, cellW)}
                height={Math.max(1, cellH)}
                cornerRadius={1}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected ? 1 : 0.5}
                onClick={isInteractive ? (e) => {
                  e.cancelBubble = true;
                  onCellClick(cellId);
                } : undefined}
              />
            </Group>
          );
        });
      })}
    </Group>
  );
}

type Props = {
  geometry: CanvasRackGeometry;
  rackId: string;
  faceA: RackFace;
  faceB: RackFace | null;
  isSelected: boolean;
  isInteractive?: boolean;
  selectedCellId?: string | null;
  onCellClick?: (cellId: string) => void;
};

const noop = () => {};

export function RackCells({
  geometry,
  rackId,
  faceA,
  faceB,
  isSelected: _isSelected,
  isInteractive = false,
  selectedCellId = null,
  onCellClick = noop
}: Props) {
  const { faceAWidth, faceBWidth, height, isPaired, spineY } = geometry;
  const faceABandH = isPaired ? spineY : height;

  return (
    <Group listening={isInteractive}>
      <FaceCells
        face={faceA}
        rackId={rackId}
        totalWidth={faceAWidth}
        bandY={0}
        bandH={faceABandH}
        cellFill={CELL_FILL_A}
        cellStroke={CELL_STROKE}
        isInteractive={isInteractive}
        selectedCellId={selectedCellId}
        onCellClick={onCellClick}
      />
      {isPaired && faceB && (
        <FaceCells
          face={faceB}
          rackId={rackId}
          totalWidth={faceBWidth}
          bandY={spineY}
          bandH={height - spineY}
          cellFill={CELL_FILL_B}
          cellStroke={CELL_STROKE_B}
          isInteractive={isInteractive}
          selectedCellId={selectedCellId}
          onCellClick={onCellClick}
        />
      )}
    </Group>
  );
}
