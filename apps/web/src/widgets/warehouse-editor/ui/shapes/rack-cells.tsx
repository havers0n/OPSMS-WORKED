import { Group } from 'react-konva';
import { buildCellStructureKey, type Cell, type RackFace } from '@wos/domain';
import type { OperationsCellRuntime } from '@wos/domain';
import {
  getSectionWidths,
  shouldRenderCanvasCell,
  type CanvasRackGeometry,
  type CanvasViewport
} from '@/entities/layout-version/lib/canvas-geometry';
import {
  collectFaceSemanticLevels,
  resolveSemanticLevelForIndex
} from '@/widgets/warehouse-editor/model/storage-level-mapping';
import {
  resolveCellVisualState,
  type CellVisualPalette
} from './rack-cells-visual-state';
import {
  BatchedCellBaseShape,
  CellTruthMarkerOverlay,
  CellInteractionOverlay,
  CellOutlineOverlay,
  CellHaloOverlay,
  CellBadgeOverlay,
  CellSurfacePatternVisual
} from './rack-cell-overlays';
import type { LabelProminence } from './rack-label-reveal-policy';
import { shouldShowFocusedFullAddress } from './rack-label-reveal-policy';
import {
  CellInteriorSlotLabel,
  FocusedCellAddressOverlay
} from './rack-label-overlays';
import { getWarehouseSemanticCellPalette } from './warehouse-semantic-canvas-palette';
import {
  recordCanvasComponentRender,
  recordCanvasCullingMetrics,
  type CanvasDiagnosticsFlags
} from '../canvas-diagnostics';

const MIN_CELL_W = 5;
const MIN_CELL_H = 4;

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

type RenderedCell = {
  key: string;
  cellId: string | null;
  slotLabel: number;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visualState: ReturnType<typeof resolveCellVisualState>;
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
  const isRtl = face.slotNumberingDirection === 'rtl';
  const orderedSections = isRtl ? [...face.sections].reverse() : face.sections;
  const sectionOffsets = getSectionWidths(totalWidth, orderedSections);
  const focusedAddressLabels: FocusedAddressLabel[] = [];
  const renderedCells: RenderedCell[] = [];
  let cellsTotal = 0;
  let cellsRendered = 0;
  const metricSourceId = `${rackId}:${face.id}`;

  const inset = 4;
  const cellH = bandH - inset * 2;
  if (!face.sections.length || cellH < MIN_CELL_H) {
    recordCanvasCullingMetrics(metricSourceId, {
      cellsTotal: 0,
      cellsRendered: 0
    });
    return null;
  }

  const cullingEnabled =
    diagnosticsFlags.cells !== 'unculled' &&
    diagnosticsFlags.enableProductionCellCulling;
  const cellOverlaysOff = diagnosticsFlags.cellOverlays === 'off';

  orderedSections.forEach((sec, si) => {
    const secX = sectionOffsets[si];
    const secW = sectionOffsets[si + 1] - secX;
    if (secW < MIN_CELL_W * 2) return;

    const semanticLevel = resolveSemanticLevelForIndex(
      semanticLevels,
      activeLevelIndex
    );
    const level =
      semanticLevel === null
        ? null
        : (sec.levels.find(
            (sectionLevel) => sectionLevel.ordinal === semanticLevel
          ) ?? null);
    if (!level) return;
    const slotCount = level.slotCount;
    if (!slotCount) return;

    const slotW = secW / slotCount;
    if (slotW < MIN_CELL_W) return;
    if (cellH < MIN_CELL_H) return;

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
      const isFocused = isSelected && showFocusedFullAddress;
      const isLocateTarget =
        locateTargetCellId !== null && locateTargetCellId === cellId;
      const isWorkflowSource =
        workflowSourceCellId !== null && workflowSourceCellId === cellId;
      const isSearchHit = cellId !== null && highlightedCellIds.has(cellId);
      const shouldRevealAddress =
        showFocusedFullAddress &&
        shouldShowFocusedFullAddress({
          isSelected,
          isHighlighted: isSearchHit,
          isWorkflowSource
        });
      const cellX = secX + slotIndex * slotW;
      const cellY = bandY + inset;
      const cellW = slotW - 1;
      const cellGeometry = {
        x: cellX + 0.5,
        y: cellY + 0.5,
        width: Math.max(1, cellW),
        height: Math.max(1, cellH - 1)
      };
      cellsTotal += 1;
      if (
        cullingEnabled &&
        !shouldRenderCanvasCell({
          cellGeometry,
          canvasOffset: diagnosticsViewport.canvasOffset,
          forceVisible: isSelected || isLocateTarget || isWorkflowSource,
          rackGeometry,
          rackRotationDeg,
          viewport: diagnosticsViewport.viewport,
          zoom: diagnosticsViewport.zoom
        })
      ) {
        return null;
      }

      cellsRendered += 1;
      const addressText = cell?.address?.raw ?? null;
      const runtime = cellId ? cellRuntimeById.get(cellId) : null;
      const isOccupied = cellId !== null && occupiedCellIds.has(cellId);
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
      if (shouldRevealAddress && addressText) {
        focusedAddressLabels.push({
          key: `${sec.id}-${level.id}-slot-${slotLabel}`,
          addressText,
          geometry: cellGeometry
        });
      }

      renderedCells.push({
        key: `${sec.id}-${level.id}-slot-${slotLabel}`,
        cellId,
        slotLabel,
        geometry: cellGeometry,
        visualState
      });
    });
  });
  recordCanvasCullingMetrics(metricSourceId, { cellsTotal, cellsRendered });

  return (
    <Group listening={isInteractive}>
      <BatchedCellBaseShape
        cells={renderedCells}
        disableStroke={cellOverlaysOff}
      />
      {renderedCells.map((renderedCell) => (
        <Group key={renderedCell.key}>
          <CellSurfacePatternVisual
            geometry={renderedCell.geometry}
            visualState={renderedCell.visualState}
          />
          {diagnosticsFlags.cellOverlays === 'normal' && (
            <>
              <CellTruthMarkerOverlay
                geometry={renderedCell.geometry}
                visualState={renderedCell.visualState}
              />
              <CellOutlineOverlay
                geometry={renderedCell.geometry}
                visualState={renderedCell.visualState}
              />
              <CellHaloOverlay
                geometry={renderedCell.geometry}
                visualState={renderedCell.visualState}
              />
              <CellBadgeOverlay
                geometry={renderedCell.geometry}
                visualState={renderedCell.visualState}
              />
            </>
          )}
          <CellInteractionOverlay
            geometry={renderedCell.geometry}
            visualState={renderedCell.visualState}
            isClickable={renderedCell.visualState.isClickable}
            onCellClick={
              renderedCell.cellId !== null
                ? (anchor) => {
                    if (renderedCell.cellId !== null) {
                      onCellClick(renderedCell.cellId, anchor);
                    }
                  }
                : undefined
            }
          />
          {showCellNumbers && (
            <CellInteriorSlotLabel
              slotNumber={renderedCell.slotLabel}
              geometry={renderedCell.geometry}
              prominence={cellNumberProminence}
              counterRotationDeg={rackRotationDeg}
            />
          )}
        </Group>
      ))}
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
  viewport: CanvasViewport;
  zoom: number;
};

const DEFAULT_DIAGNOSTICS_FLAGS: CanvasDiagnosticsFlags = {
  labels: 'normal',
  hitTest: 'normal',
  cells: 'normal',
  cellOverlays: 'normal',
  enableProductionCellCulling: true,
  rackLayerRenderer: 'layer'
};

const DEFAULT_DIAGNOSTICS_VIEWPORT: DiagnosticsViewport = {
  canvasOffset: { x: 0, y: 0 },
  viewport: { width: 0, height: 0 },
  zoom: 1
};

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
    semanticLevels ??
    collectFaceSemanticLevels([faceA, ...(faceB ? [faceB] : [])]);

  recordCanvasComponentRender({
    component: 'RackCells',
    instanceId: rackId,
    propsKeys: [
      'geometryX',
      'geometryY',
      'geometryWidth',
      'geometryHeight',
      'activeLevelIndex',
      'isInteractive',
      'isSelected',
      'isWorkflowScope',
      'isPassive',
      'selectedCellId',
      'locateTargetCellId',
      'workflowSourceCellId',
      'showCellNumbers',
      'showFocusedFullAddress',
      'cellNumberProminence',
      'diagnosticsLabels',
      'diagnosticsHitTest',
      'diagnosticsCells',
      'diagnosticsCellOverlays',
      'diagnosticsCulling',
      'canvasOffsetX',
      'canvasOffsetY',
      'viewportWidth',
      'viewportHeight',
      'zoom',
      'highlightedCellCount'
    ],
    snapshot: {
      geometryX: geometry.x,
      geometryY: geometry.y,
      geometryWidth: geometry.width,
      geometryHeight: geometry.height,
      activeLevelIndex,
      isInteractive,
      isSelected,
      isWorkflowScope,
      isPassive,
      selectedCellId,
      locateTargetCellId,
      workflowSourceCellId,
      showCellNumbers,
      showFocusedFullAddress,
      cellNumberProminence,
      diagnosticsLabels: diagnosticsFlags.labels,
      diagnosticsHitTest: diagnosticsFlags.hitTest,
      diagnosticsCells: diagnosticsFlags.cells,
      diagnosticsCellOverlays: diagnosticsFlags.cellOverlays,
      diagnosticsCulling: diagnosticsFlags.enableProductionCellCulling,
      canvasOffsetX: diagnosticsViewport.canvasOffset.x,
      canvasOffsetY: diagnosticsViewport.canvasOffset.y,
      viewportWidth: diagnosticsViewport.viewport.width,
      viewportHeight: diagnosticsViewport.viewport.height,
      zoom: diagnosticsViewport.zoom,
      highlightedCellCount: highlightedCellIds.size
    }
  });

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
