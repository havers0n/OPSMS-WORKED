import { Group, Rect } from 'react-konva';
import { buildCellStructureKey, type Cell, type RackFace } from '@wos/domain';
import type { OperationsCellRuntime } from '@wos/domain';
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
const CELL_FILL_OCCUPIED_A = '#bbf7d0';
const CELL_FILL_OCCUPIED_B = '#c4b5fd';
const CELL_STROKE_OCCUPIED_A = '#22c55e';
const CELL_STROKE_OCCUPIED_B = '#7c3aed';
const CELL_FILL_STOCKED = '#bbf7d0';
const CELL_STROKE_STOCKED = '#16a34a';
const CELL_FILL_PICK_ACTIVE = '#bfdbfe';
const CELL_STROKE_PICK_ACTIVE = '#2563eb';
const CELL_FILL_RESERVED = '#fde68a';
const CELL_STROKE_RESERVED = '#ca8a04';
const CELL_FILL_QUARANTINED = '#fecaca';
const CELL_STROKE_QUARANTINED = '#dc2626';
const CELL_FILL_EMPTY = '#e2e8f0';
const CELL_STROKE_EMPTY = '#94a3b8';
const CELL_STROKE_HIGHLIGHTED = '#f97316';

type FaceProps = {
  face: RackFace;
  rackId: string;
  totalWidth: number;
  bandY: number;
  bandH: number;
  cellFill: string;
  cellStroke: string;
  occupiedCellFill: string;
  occupiedCellStroke: string;
  isRackSelected: boolean;
  publishedCellsByStructure: Map<string, Cell>;
  occupiedCellIds: Set<string>;
  cellRuntimeById: Map<string, OperationsCellRuntime>;
  highlightedCellIds: Set<string>;
  isInteractive: boolean;
  selectedCellId: string | null;
  onCellClick: (cellId: string, anchor: { x: number; y: number }) => void;
};

function FaceCells({
  face,
  rackId,
  totalWidth,
  bandY,
  bandH,
  cellFill,
  cellStroke,
  occupiedCellFill,
  occupiedCellStroke,
  isRackSelected,
  publishedCellsByStructure,
  occupiedCellIds,
  cellRuntimeById,
  highlightedCellIds,
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
            const cellId = cell?.id ?? null;
            const isSelected = selectedCellId === cellId;
            const isHighlighted = cellId !== null && highlightedCellIds.has(cellId);
            const runtime = cellId ? cellRuntimeById.get(cellId) : null;
            const isOccupied = cellId !== null && occupiedCellIds.has(cellId) && !isSelected;

            const cellX = secX + slotIndex * slotW;
            const cellY = bandY + inset + levelIndex * levelH;
            const cellW = slotW - 1;
            const statusFillStroke = runtime
              ? runtime.status === 'quarantined'
                ? { fill: CELL_FILL_QUARANTINED, stroke: CELL_STROKE_QUARANTINED }
                : runtime.status === 'pick_active'
                  ? { fill: CELL_FILL_PICK_ACTIVE, stroke: CELL_STROKE_PICK_ACTIVE }
                  : runtime.status === 'reserved'
                    ? { fill: CELL_FILL_RESERVED, stroke: CELL_STROKE_RESERVED }
                    : runtime.status === 'stocked'
                      ? { fill: CELL_FILL_STOCKED, stroke: CELL_STROKE_STOCKED }
                      : { fill: CELL_FILL_EMPTY, stroke: CELL_STROKE_EMPTY }
              : null;

            const fill = isSelected
              ? CELL_FILL_SELECTED
              : statusFillStroke
                ? statusFillStroke.fill
                : isOccupied
                  ? occupiedCellFill
                  : cellFill;

            const stroke = isSelected
              ? CELL_STROKE_SELECTED
              : isHighlighted
                ? CELL_STROKE_HIGHLIGHTED
                : statusFillStroke
                  ? statusFillStroke.stroke
                  : isOccupied
                    ? occupiedCellStroke
                    : cellStroke;

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
                  strokeWidth={isSelected ? 1.4 : isHighlighted ? 1.2 : isOccupied ? 1 : isRackSelected ? 0.9 : 0.5}
                  opacity={cell ? isSelected || isHighlighted || isOccupied || runtime ? 0.98 : isRackSelected ? 0.98 : 0.78 : 0.25}
                  onClick={isInteractive && cellId ? (event) => {
                    event.cancelBubble = true;
                    onCellClick(cellId, { x: event.evt.clientX, y: event.evt.clientY });
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
  occupiedCellIds?: Set<string>;
  cellRuntimeById?: Map<string, OperationsCellRuntime>;
  highlightedCellIds?: Set<string>;
  isInteractive?: boolean;
  selectedCellId?: string | null;
  onCellClick?: (cellId: string, anchor: { x: number; y: number }) => void;
};

const noop = () => undefined;

export function RackCells({
  geometry,
  rackId,
  faceA,
  faceB,
  isSelected,
  publishedCellsByStructure,
  occupiedCellIds = new Set<string>(),
  cellRuntimeById = new Map<string, OperationsCellRuntime>(),
  highlightedCellIds = new Set<string>(),
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
        occupiedCellFill={CELL_FILL_OCCUPIED_A}
        occupiedCellStroke={CELL_STROKE_OCCUPIED_A}
        isRackSelected={isSelected}
        publishedCellsByStructure={publishedCellsByStructure}
        occupiedCellIds={occupiedCellIds}
        cellRuntimeById={cellRuntimeById}
        highlightedCellIds={highlightedCellIds}
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
          occupiedCellFill={CELL_FILL_OCCUPIED_B}
          occupiedCellStroke={CELL_STROKE_OCCUPIED_B}
          isRackSelected={isSelected}
          publishedCellsByStructure={publishedCellsByStructure}
          occupiedCellIds={occupiedCellIds}
          cellRuntimeById={cellRuntimeById}
          highlightedCellIds={highlightedCellIds}
          isInteractive={isInteractive}
          selectedCellId={selectedCellId}
          onCellClick={onCellClick}
        />
      )}
    </Group>
  );
}
