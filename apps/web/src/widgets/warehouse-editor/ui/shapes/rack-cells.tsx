import { Group } from 'react-konva';
import { buildCellStructureKey, type Cell, type RackFace } from '@wos/domain';
import type { OperationsCellRuntime } from '@wos/domain';
import { getSectionWidths, type CanvasRackGeometry } from '@/entities/layout-version/lib/canvas-geometry';
import {
  collectFaceSemanticLevels,
  resolveSemanticLevelForIndex
} from '@/widgets/warehouse-editor/model/storage-level-mapping';
import {
  resolveCellVisualState,
  type CellVisualPalette
} from './rack-cells-visual-state';
import {
  CellBaseVisual,
  CellRuntimeOverlay,
  CellInteractionOverlay,
  CellExceptionOverlay
} from './rack-cell-overlays';
import type { LabelProminence } from './rack-label-reveal-policy';
import { shouldShowFocusedFullAddress } from './rack-label-reveal-policy';
import { CellInteriorSlotLabel, FocusedCellAddressOverlay } from './rack-label-overlays';

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
const CELL_FILL_WORKFLOW_SOURCE = '#dbeafe';
const CELL_STROKE_WORKFLOW_SOURCE = '#2563eb';
const CELL_FILL_LOCKED = '#e2e8f0';
const CELL_STROKE_LOCKED = '#cbd5e1';
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

const CELL_VISUAL_PALETTE_A: CellVisualPalette = {
  baseFill: CELL_FILL_A,
  baseStroke: CELL_STROKE,
  occupiedFill: CELL_FILL_OCCUPIED_A,
  occupiedStroke: CELL_STROKE_OCCUPIED_A,
  selectedFill: CELL_FILL_SELECTED,
  selectedStroke: CELL_STROKE_SELECTED,
  workflowSourceFill: CELL_FILL_WORKFLOW_SOURCE,
  workflowSourceStroke: CELL_STROKE_WORKFLOW_SOURCE,
  highlightedStroke: CELL_STROKE_HIGHLIGHTED,
  lockedFill: CELL_FILL_LOCKED,
  lockedStroke: CELL_STROKE_LOCKED,
  stockedFill: CELL_FILL_STOCKED,
  stockedStroke: CELL_STROKE_STOCKED,
  pickActiveFill: CELL_FILL_PICK_ACTIVE,
  pickActiveStroke: CELL_STROKE_PICK_ACTIVE,
  reservedFill: CELL_FILL_RESERVED,
  reservedStroke: CELL_STROKE_RESERVED,
  quarantinedFill: CELL_FILL_QUARANTINED,
  quarantinedStroke: CELL_STROKE_QUARANTINED,
  emptyFill: CELL_FILL_EMPTY,
  emptyStroke: CELL_STROKE_EMPTY
};

const CELL_VISUAL_PALETTE_B: CellVisualPalette = {
  ...CELL_VISUAL_PALETTE_A,
  baseFill: CELL_FILL_B,
  baseStroke: CELL_STROKE_B,
  occupiedFill: CELL_FILL_OCCUPIED_B,
  occupiedStroke: CELL_STROKE_OCCUPIED_B
};

type FaceProps = {
  face: RackFace;
  rackId: string;
  totalWidth: number;
  bandY: number;
  bandH: number;
  isRackSelected: boolean;
  publishedCellsByStructure: Map<string, Cell>;
  occupiedCellIds: Set<string>;
  cellRuntimeById: Map<string, OperationsCellRuntime>;
  highlightedCellIds: Set<string>;
  isInteractive: boolean;
  activeLevelIndex: number;
  semanticLevels: number[];
  isWorkflowScope: boolean;
  isRackPassive: boolean;
  rackRotationDeg: 0 | 90 | 180 | 270;
  selectedCellId: string | null;
  workflowSourceCellId: string | null;
  showCellNumbers: boolean;
  cellNumberProminence: LabelProminence;
  showFocusedFullAddress: boolean;
  visualPalette: CellVisualPalette;
  onCellClick: (cellId: string, anchor: { x: number; y: number }) => void;
};

type FocusedAddressLabel = {
  key: string;
  addressText: string;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

function FaceCells({
  face,
  rackId,
  totalWidth,
  bandY,
  bandH,
  isRackSelected,
  publishedCellsByStructure,
  occupiedCellIds,
  cellRuntimeById,
  highlightedCellIds,
  isInteractive,
  activeLevelIndex,
  semanticLevels,
  isWorkflowScope,
  isRackPassive,
  rackRotationDeg,
  selectedCellId,
  workflowSourceCellId,
  showCellNumbers,
  cellNumberProminence,
  showFocusedFullAddress,
  visualPalette,
  onCellClick
}: FaceProps) {
  if (!face.sections.length) return null;
  const isRtl = face.slotNumberingDirection === 'rtl';
  const orderedSections = isRtl ? [...face.sections].reverse() : face.sections;
  const sectionOffsets = getSectionWidths(totalWidth, orderedSections);
  const focusedAddressLabels: FocusedAddressLabel[] = [];

  const inset = 4;
  const cellH = bandH - inset * 2;
  if (cellH < MIN_CELL_H) return null;

  return (
    <Group listening={isInteractive}>
      {orderedSections.map((sec, si) => {
        const secX = sectionOffsets[si];
        const secW = sectionOffsets[si + 1] - secX;
        if (secW < MIN_CELL_W * 2) return null;

        const semanticLevel = resolveSemanticLevelForIndex(semanticLevels, activeLevelIndex);
        const level =
          semanticLevel === null
            ? null
            : sec.levels.find((sectionLevel) => sectionLevel.ordinal === semanticLevel) ?? null;
        if (!level) return null;
        const slotCount = level.slotCount;
        if (!slotCount) return null;

        const slotW = secW / slotCount;
        if (slotW < MIN_CELL_W) return null;
        if (cellH < MIN_CELL_H) return null;

        return Array.from({ length: slotCount }, (_, slotIndex) => {
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
          const isWorkflowSource = workflowSourceCellId !== null && workflowSourceCellId === cellId;
          const isHighlighted = cellId !== null && highlightedCellIds.has(cellId);
          const shouldRevealAddress =
            showFocusedFullAddress &&
            shouldShowFocusedFullAddress({
              isSelected,
              isHighlighted,
              isWorkflowSource
            });
          const addressText = cell?.address?.raw ?? null;
          const runtime = cellId ? cellRuntimeById.get(cellId) : null;
          const isOccupied = cellId !== null && occupiedCellIds.has(cellId);

          const cellX = secX + slotIndex * slotW;
          const cellY = bandY + inset;
          const cellW = slotW - 1;
          const visualState = resolveCellVisualState(
            {
              isInteractive,
              isWorkflowScope,
              isRackPassive,
              isRackSelected,
              hasCellIdentity: cellId !== null,
              isSelected,
              isWorkflowSource,
              isHighlighted,
              isOccupiedByFallback: isOccupied,
              runtimeStatus: runtime?.status ?? null
            },
            visualPalette
          );
          const cellGeometry = {
            x: cellX + 0.5,
            y: cellY + 0.5,
            width: Math.max(1, cellW),
            height: Math.max(1, cellH - 1)
          };
          if (shouldRevealAddress && addressText) {
            focusedAddressLabels.push({
              key: `${sec.id}-${level.id}-slot-${slotLabel}`,
              addressText,
              geometry: cellGeometry
            });
          }

          return (
            <Group key={`${sec.id}-${level.id}-slot-${slotLabel}`}>
              <CellBaseVisual
                geometry={cellGeometry}
                visualState={visualState}
                isSelected={isSelected}
                isWorkflowSource={isWorkflowSource}
                isHighlighted={isHighlighted}
              />
              <CellRuntimeOverlay
                geometry={cellGeometry}
                visualState={visualState}
                isSelected={isSelected}
                isWorkflowSource={isWorkflowSource}
                isHighlighted={isHighlighted}
              />
              <CellInteractionOverlay
                geometry={cellGeometry}
                visualState={visualState}
                isSelected={isSelected}
                isWorkflowSource={isWorkflowSource}
                isHighlighted={isHighlighted}
                isClickable={visualState.isClickable}
                onCellClick={cellId !== null ? (anchor) => onCellClick(cellId, anchor) : undefined}
              />
              <CellExceptionOverlay
                geometry={cellGeometry}
                visualState={visualState}
                isHighlighted={isHighlighted}
              />
              {showCellNumbers && (
                <CellInteriorSlotLabel
                  slotNumber={slotLabel}
                  geometry={cellGeometry}
                  prominence={cellNumberProminence}
                  counterRotationDeg={rackRotationDeg}
                />
              )}
            </Group>
          );
        });
      })}
      <Group listening={false} name="focused-address-overlay-group">
        {focusedAddressLabels.map((overlay) => (
          <FocusedCellAddressOverlay
            key={overlay.key}
            addressText={overlay.addressText}
            geometry={overlay.geometry}
            rackRotationDeg={rackRotationDeg}
          />
        ))}
      </Group>
    </Group>
  );
}

type Props = {
  geometry: CanvasRackGeometry;
  rackId: string;
  faceA: RackFace;
  faceB: RackFace | null;
  isSelected: boolean;
  activeLevelIndex: number;
  semanticLevels?: number[];
  publishedCellsByStructure: Map<string, Cell>;
  occupiedCellIds?: Set<string>;
  cellRuntimeById?: Map<string, OperationsCellRuntime>;
  highlightedCellIds?: Set<string>;
  isInteractive?: boolean;
  isWorkflowScope?: boolean;
  isPassive?: boolean;
  rackRotationDeg?: 0 | 90 | 180 | 270;
  selectedCellId?: string | null;
  workflowSourceCellId?: string | null;
  onCellClick?: (cellId: string, anchor: { x: number; y: number }) => void;
  showCellNumbers?: boolean;
  cellNumberProminence?: LabelProminence;
  showFocusedFullAddress?: boolean;
};

const noop = () => undefined;

export function RackCells({
  geometry,
  rackId,
  faceA,
  faceB,
  isSelected,
  activeLevelIndex,
  semanticLevels,
  publishedCellsByStructure,
  occupiedCellIds = new Set<string>(),
  cellRuntimeById = new Map<string, OperationsCellRuntime>(),
  highlightedCellIds = new Set<string>(),
  isInteractive = false,
  isWorkflowScope = false,
  isPassive = false,
  rackRotationDeg = 0,
  selectedCellId = null,
  workflowSourceCellId = null,
  onCellClick = noop,
  showCellNumbers = true,
  cellNumberProminence = 'dominant',
  showFocusedFullAddress = true
}: Props) {
  const { faceAWidth, faceBWidth, height, isPaired, spineY } = geometry;
  const faceABandH = isPaired ? spineY : height;
  const normalizedSemanticLevels =
    semanticLevels ?? collectFaceSemanticLevels([faceA, ...(faceB ? [faceB] : [])]);

  return (
    <Group listening={isInteractive}>
      <FaceCells
        face={faceA}
        rackId={rackId}
        totalWidth={faceAWidth}
        bandY={0}
        bandH={faceABandH}
        isRackSelected={isSelected}
        publishedCellsByStructure={publishedCellsByStructure}
        occupiedCellIds={occupiedCellIds}
        cellRuntimeById={cellRuntimeById}
        highlightedCellIds={highlightedCellIds}
        isInteractive={isInteractive}
        activeLevelIndex={activeLevelIndex}
        semanticLevels={normalizedSemanticLevels}
        isWorkflowScope={isWorkflowScope}
        isRackPassive={isPassive}
        rackRotationDeg={rackRotationDeg}
        selectedCellId={selectedCellId}
        workflowSourceCellId={workflowSourceCellId}
        showCellNumbers={showCellNumbers}
        cellNumberProminence={cellNumberProminence}
        showFocusedFullAddress={showFocusedFullAddress}
        visualPalette={isSelected
          ? { ...CELL_VISUAL_PALETTE_A, baseFill: CELL_FILL_A_RACK_SELECTED, baseStroke: CELL_STROKE_A_RACK_SELECTED }
          : CELL_VISUAL_PALETTE_A}
        onCellClick={onCellClick}
      />
      {isPaired && faceB && (
        <FaceCells
          face={faceB}
          rackId={rackId}
          totalWidth={faceBWidth}
          bandY={spineY}
          bandH={height - spineY}
          isRackSelected={isSelected}
          publishedCellsByStructure={publishedCellsByStructure}
          occupiedCellIds={occupiedCellIds}
          cellRuntimeById={cellRuntimeById}
          highlightedCellIds={highlightedCellIds}
          isInteractive={isInteractive}
          activeLevelIndex={activeLevelIndex}
          semanticLevels={normalizedSemanticLevels}
          isWorkflowScope={isWorkflowScope}
          isRackPassive={isPassive}
          rackRotationDeg={rackRotationDeg}
          selectedCellId={selectedCellId}
          workflowSourceCellId={workflowSourceCellId}
          showCellNumbers={showCellNumbers}
          cellNumberProminence={cellNumberProminence}
          showFocusedFullAddress={showFocusedFullAddress}
          visualPalette={isSelected
            ? { ...CELL_VISUAL_PALETTE_B, baseFill: CELL_FILL_B_RACK_SELECTED, baseStroke: CELL_STROKE_B_RACK_SELECTED }
            : CELL_VISUAL_PALETTE_B}
          onCellClick={onCellClick}
        />
      )}
    </Group>
  );
}
