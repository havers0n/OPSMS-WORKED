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
  CellSurfaceVisual,
  CellTruthMarkerOverlay,
  CellInteractionOverlay,
  CellOutlineOverlay,
  CellHaloOverlay,
  CellBadgeOverlay
} from './rack-cell-overlays';
import type { LabelProminence } from './rack-label-reveal-policy';
import { shouldShowFocusedFullAddress } from './rack-label-reveal-policy';
import { CellInteriorSlotLabel, FocusedCellAddressOverlay } from './rack-label-overlays';
import { getWarehouseSemanticCellPalette } from './warehouse-semantic-canvas-palette';
import type { CanvasDiagnosticsFlags } from '../canvas-diagnostics';

const MIN_CELL_W = 5;
const MIN_CELL_H = 4;
const VISIBLE_CELL_OVERSCAN_PX = 160;

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
  activeLevelIndex: number | null;
  semanticLevels: number[];
  isWorkflowScope: boolean;
  isRackPassive: boolean;
  rackRotationDeg: 0 | 90 | 180 | 270;
  selectedCellId: string | null;
  locateTargetCellId: string | null;
  workflowSourceCellId: string | null;
  showCellNumbers: boolean;
  cellNumberProminence: LabelProminence;
  showFocusedFullAddress: boolean;
  visualPalette: CellVisualPalette;
  diagnosticsFlags: CanvasDiagnosticsFlags;
  diagnosticsViewport: DiagnosticsViewport;
  rackGeometry: CanvasRackGeometry;
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
  locateTargetCellId,
  workflowSourceCellId,
  showCellNumbers,
  cellNumberProminence,
  showFocusedFullAddress,
  visualPalette,
  diagnosticsFlags,
  diagnosticsViewport,
  rackGeometry,
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
          const isFocused = isSelected && showFocusedFullAddress;
          const isLocateTarget = locateTargetCellId !== null && locateTargetCellId === cellId;
          const isWorkflowSource = workflowSourceCellId !== null && workflowSourceCellId === cellId;
          const isSearchHit = cellId !== null && highlightedCellIds.has(cellId);
          const shouldRevealAddress =
            showFocusedFullAddress &&
            shouldShowFocusedFullAddress({
              isSelected,
              isHighlighted: isSearchHit,
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
              isFocused,
              isLocateTarget,
              isWorkflowSource,
              isSearchHit,
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
          if (
            diagnosticsFlags.cells === 'visible-only' &&
            !isLocalCellVisibleInViewport({
              cellGeometry,
              diagnosticsViewport,
              rackGeometry,
              rackRotationDeg
            })
          ) {
            return null;
          }
          if (shouldRevealAddress && addressText) {
            focusedAddressLabels.push({
              key: `${sec.id}-${level.id}-slot-${slotLabel}`,
              addressText,
              geometry: cellGeometry
            });
          }

          return (
            <Group key={`${sec.id}-${level.id}-slot-${slotLabel}`}>
              <CellSurfaceVisual
                geometry={cellGeometry}
                visualState={visualState}
              />
              {diagnosticsFlags.cellOverlays === 'normal' && (
                <>
                  <CellTruthMarkerOverlay
                    geometry={cellGeometry}
                    visualState={visualState}
                  />
                  <CellOutlineOverlay
                    geometry={cellGeometry}
                    visualState={visualState}
                  />
                  <CellHaloOverlay
                    geometry={cellGeometry}
                    visualState={visualState}
                  />
                  <CellBadgeOverlay
                    geometry={cellGeometry}
                    visualState={visualState}
                  />
                </>
              )}
              <CellInteractionOverlay
                geometry={cellGeometry}
                visualState={visualState}
                isClickable={visualState.isClickable}
                onCellClick={cellId !== null ? (anchor) => onCellClick(cellId, anchor) : undefined}
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
  activeLevelIndex: number | null;
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
  locateTargetCellId?: string | null;
  workflowSourceCellId?: string | null;
  onCellClick?: (cellId: string, anchor: { x: number; y: number }) => void;
  diagnosticsFlags?: CanvasDiagnosticsFlags;
  diagnosticsViewport?: DiagnosticsViewport;
  showCellNumbers?: boolean;
  cellNumberProminence?: LabelProminence;
  showFocusedFullAddress?: boolean;
};

const noop = () => undefined;
type DiagnosticsViewport = {
  canvasOffset: { x: number; y: number };
  viewport: { width: number; height: number };
  zoom: number;
};

const DEFAULT_DIAGNOSTICS_FLAGS: CanvasDiagnosticsFlags = {
  labels: 'normal',
  hitTest: 'normal',
  cells: 'normal',
  cellOverlays: 'normal'
};

const DEFAULT_DIAGNOSTICS_VIEWPORT: DiagnosticsViewport = {
  canvasOffset: { x: 0, y: 0 },
  viewport: { width: 0, height: 0 },
  zoom: 1
};

function rotatePoint(point: { x: number; y: number }, pivot: { x: number; y: number }, rotationDeg: number) {
  if (rotationDeg === 0) return point;
  const radians = (rotationDeg * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;

  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos
  };
}

function isLocalCellVisibleInViewport({
  cellGeometry,
  diagnosticsViewport,
  rackGeometry,
  rackRotationDeg
}: {
  cellGeometry: { x: number; y: number; width: number; height: number };
  diagnosticsViewport: DiagnosticsViewport;
  rackGeometry: CanvasRackGeometry;
  rackRotationDeg: 0 | 90 | 180 | 270;
}) {
  if (
    diagnosticsViewport.zoom <= 0 ||
    diagnosticsViewport.viewport.width <= 0 ||
    diagnosticsViewport.viewport.height <= 0
  ) {
    return true;
  }

  const visibleRect = {
    x: (-diagnosticsViewport.canvasOffset.x / diagnosticsViewport.zoom) - VISIBLE_CELL_OVERSCAN_PX,
    y: (-diagnosticsViewport.canvasOffset.y / diagnosticsViewport.zoom) - VISIBLE_CELL_OVERSCAN_PX,
    width: (diagnosticsViewport.viewport.width / diagnosticsViewport.zoom) + VISIBLE_CELL_OVERSCAN_PX * 2,
    height: (diagnosticsViewport.viewport.height / diagnosticsViewport.zoom) + VISIBLE_CELL_OVERSCAN_PX * 2
  };
  const pivot = {
    x: rackGeometry.centerX,
    y: rackGeometry.centerY
  };
  const localCorners = [
    { x: cellGeometry.x, y: cellGeometry.y },
    { x: cellGeometry.x + cellGeometry.width, y: cellGeometry.y },
    { x: cellGeometry.x + cellGeometry.width, y: cellGeometry.y + cellGeometry.height },
    { x: cellGeometry.x, y: cellGeometry.y + cellGeometry.height }
  ];
  const canvasCorners = localCorners.map((corner) => {
    const rotated = rotatePoint(corner, pivot, rackRotationDeg);
    return {
      x: rackGeometry.x + rotated.x,
      y: rackGeometry.y + rotated.y
    };
  });
  const minX = Math.min(...canvasCorners.map((point) => point.x));
  const maxX = Math.max(...canvasCorners.map((point) => point.x));
  const minY = Math.min(...canvasCorners.map((point) => point.y));
  const maxY = Math.max(...canvasCorners.map((point) => point.y));

  return (
    minX <= visibleRect.x + visibleRect.width &&
    maxX >= visibleRect.x &&
    minY <= visibleRect.y + visibleRect.height &&
    maxY >= visibleRect.y
  );
}

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
  locateTargetCellId = null,
  workflowSourceCellId = null,
  onCellClick = noop,
  diagnosticsFlags = DEFAULT_DIAGNOSTICS_FLAGS,
  diagnosticsViewport = DEFAULT_DIAGNOSTICS_VIEWPORT,
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
        locateTargetCellId={locateTargetCellId}
        workflowSourceCellId={workflowSourceCellId}
        showCellNumbers={showCellNumbers}
        cellNumberProminence={cellNumberProminence}
        showFocusedFullAddress={showFocusedFullAddress}
        visualPalette={getWarehouseSemanticCellPalette({
          rackSelected: isSelected,
          faceTone: 'primary'
        })}
        diagnosticsFlags={diagnosticsFlags}
        diagnosticsViewport={diagnosticsViewport}
        rackGeometry={geometry}
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
          locateTargetCellId={locateTargetCellId}
          workflowSourceCellId={workflowSourceCellId}
          showCellNumbers={showCellNumbers}
          cellNumberProminence={cellNumberProminence}
          showFocusedFullAddress={showFocusedFullAddress}
          visualPalette={getWarehouseSemanticCellPalette({
            rackSelected: isSelected,
            faceTone: 'secondary'
          })}
          diagnosticsFlags={diagnosticsFlags}
          diagnosticsViewport={diagnosticsViewport}
          rackGeometry={geometry}
          onCellClick={onCellClick}
        />
      )}
    </Group>
  );
}
