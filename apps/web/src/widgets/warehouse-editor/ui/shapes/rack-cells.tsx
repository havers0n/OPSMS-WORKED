import { Group, Rect } from 'react-konva';
import { buildCellStructureKey, type Cell, type RackFace } from '@wos/domain';
import { getSectionWidths, type CanvasRackGeometry } from '../../lib/canvas-geometry';

const MIN_CELL_W = 5;
const MIN_CELL_H = 4;

const CELL_FILL_A = '#e0f2fe';
const CELL_FILL_B = '#ede9fe';
const CELL_STROKE = '#bae6fd';
const CELL_STROKE_B = '#ddd6fe';
const CELL_FILL_A_RACK_SELECTED = '#c7e7fb';
const CELL_FILL_B_RACK_SELECTED = '#ddd0fb';
const CELL_STROKE_A_RACK_SELECTED = '#38bdf8';
const CELL_STROKE_B_RACK_SELECTED = '#a78bfa';
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
  isRackSelected: boolean;
  publishedCellsByStructure: Map<string, Cell>;
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
  isRackSelected,
  publishedCellsByStructure,
  isInteractive,
  selectedCellId,
  onCellClick
}: FaceProps) {
  if (!face.sections.length) return null;
  const isRtl = face.slotNumberingDirection === 'rtl';
  const orderedSections = isRtl ? [...face.sections].reverse() : face.sections;
  const sectionOffsets = getSectionWidths(totalWidth, orderedSections);

  const inset = 4;
  const cellH = bandH - inset * 2;
  if (cellH < MIN_CELL_H) return null;

  return (
    <Group listening={isInteractive}>
      {orderedSections.map((sec, si) => {
        const secX = sectionOffsets[si];
        const secW = sectionOffsets[si + 1] - secX;
        if (secW < MIN_CELL_W * 2) return null;

        const levels = [...sec.levels].sort((left, right) => right.ordinal - left.ordinal);
        const slotCount = levels.length > 0 ? levels[0].slotCount : 0;
        if (!slotCount) return null;

        const slotW = secW / slotCount;
        if (slotW < MIN_CELL_W) return null;
        const levelH = cellH / levels.length;
        if (levelH < MIN_CELL_H) return null;

        return levels.flatMap((level, levelIndex) =>
          Array.from({ length: slotCount }, (_, slotIndex) => {
            const slotLabel = isRtl ? slotCount - slotIndex : slotIndex + 1;
            const cell = publishedCellsByStructure.get(
              buildCellStructureKey({
                rackId,
                rackFaceId: face.id,
                rackSectionId: sec.id,
                rackLevelId: level.id,
                slotNo: slotLabel
              })
            );
            const isSelected = isInteractive && selectedCellId === cell?.id;

            const cellX = secX + slotIndex * slotW;
            const cellY = bandY + inset + levelIndex * levelH;
            const cellW = slotW - 1;
            const fill = isSelected ? CELL_FILL_SELECTED : cellFill;
            const stroke = isSelected ? CELL_STROKE_SELECTED : cellStroke;

            return (
              <Group key={`${sec.id}-${level.id}-slot-${slotLabel}`}>
                <Rect
                  x={cellX + 0.5}
                  y={cellY + 0.5}
                  width={Math.max(1, cellW)}
                  height={Math.max(1, levelH - 1)}
                  cornerRadius={1}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 1.2 : isRackSelected ? 0.9 : 0.5}
                  opacity={cell ? (isRackSelected ? 0.98 : 0.78) : 0.25}
                  onClick={isInteractive && cell ? (event) => {
                    event.cancelBubble = true;
                    onCellClick(cell.id);
                  } : undefined}
                />
              </Group>
            );
          })
        );
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
  publishedCellsByStructure: Map<string, Cell>;
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
  isSelected,
  publishedCellsByStructure,
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
        cellFill={isSelected ? CELL_FILL_A_RACK_SELECTED : CELL_FILL_A}
        cellStroke={isSelected ? CELL_STROKE_A_RACK_SELECTED : CELL_STROKE}
        isRackSelected={isSelected}
        publishedCellsByStructure={publishedCellsByStructure}
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
          cellFill={isSelected ? CELL_FILL_B_RACK_SELECTED : CELL_FILL_B}
          cellStroke={isSelected ? CELL_STROKE_B_RACK_SELECTED : CELL_STROKE_B}
          isRackSelected={isSelected}
          publishedCellsByStructure={publishedCellsByStructure}
          isInteractive={isInteractive}
          selectedCellId={selectedCellId}
          onCellClick={onCellClick}
        />
      )}
    </Group>
  );
}
