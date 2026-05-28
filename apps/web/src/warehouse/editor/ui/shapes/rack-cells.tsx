import { Group } from 'react-konva';
import { isRackFaceMirrored, type Cell, type RackFace } from '@wos/domain';
import type { OperationsCellRuntime } from '@wos/domain';
import {
  shouldRenderCanvasCell,
  type CanvasRackGeometry,
  type CanvasViewport
} from '@/entities/layout-version/lib/canvas-geometry';
import { collectFaceSemanticLevels } from '@/warehouse/editor/model/storage-level-mapping';
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
  CELL_INSET,
  collectRenderedFaceCellGeometries,
  MIN_CELL_H
} from './rack-cell-geometry';
import {
  isCanvasRenderPipelineDiagnosticsEnabled,
  recordCanvasComponentRender,
  recordCanvasCullingMetrics,
  recordCanvasCounter,
  recordCanvasTiming,
  type CanvasDiagnosticsFlags
} from '../canvas-diagnostics';
import type { CanvasRenderMode } from '../canvas-render-mode';

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
  isActivelyPanning: boolean;
  renderMode: CanvasRenderMode;
  forceRenderAllCells: boolean;
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
  isActivelyPanning,
  renderMode,
  forceRenderAllCells,
  onCellClick
}: FaceProps) {
  const isInteractionLight = renderMode === 'interaction-light';
  const isInteractionSkeleton = renderMode === 'interaction-skeleton';
  const isRestoreBase = renderMode === 'restore-base';
  const labelsEnabled = renderMode === 'full';
  const detailsEnabled = !isInteractionLight && !isRestoreBase;
  const metricSourceId = `${rackId}:${face.id}`;
  if (isInteractionSkeleton) {
    recordCanvasCullingMetrics(metricSourceId, {
      cellsTotal: 0,
      cellsRendered: 0
    });
    return null;
  }

  const focusedAddressLabels: FocusedAddressLabel[] = [];
  const renderedCells: RenderedCell[] = [];
  let cellsRendered = 0;

  const inset = CELL_INSET;
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
  const cellOverlaysMode =
    isInteractionLight || isRestoreBase ? 'off' : diagnosticsFlags.cellOverlays;
  const cellOverlaysOff = cellOverlaysMode === 'off';

  const diagnosticsEnabled = isCanvasRenderPipelineDiagnosticsEnabled();
  const geometryStartedAt = diagnosticsEnabled
    ? typeof performance !== 'undefined'
      ? performance.now()
      : Date.now()
    : 0;
  const faceCellGeometries = collectRenderedFaceCellGeometries({
    activeLevelIndex,
    bandH,
    bandY,
    face,
    publishedCellsByStructure,
    rackId,
    semanticLevels,
    totalWidth
  });
  if (diagnosticsEnabled) {
    recordCanvasTiming(
      'cell-geometry-calculation-ms',
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
        geometryStartedAt
    );
  }

  const cullingStartedAt = diagnosticsEnabled
    ? typeof performance !== 'undefined'
      ? performance.now()
      : Date.now()
    : 0;
  faceCellGeometries.forEach((faceCellGeometry) => {
    const {
      cell,
      cellId,
      geometry: cellGeometry,
      slotLabel
    } = faceCellGeometry;
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
    if (
      cullingEnabled &&
      !shouldRenderCanvasCell({
        cellGeometry,
        canvasOffset: diagnosticsViewport.canvasOffset,
        forceVisible: forceRenderAllCells || isLocateTarget || isWorkflowSource,
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
    if (labelsEnabled && shouldRevealAddress && addressText) {
      focusedAddressLabels.push({
        key: faceCellGeometry.key,
        addressText,
        geometry: cellGeometry
      });
    }

    renderedCells.push({
      key: faceCellGeometry.key,
      cellId,
      slotLabel,
      geometry: cellGeometry,
      visualState
    });
  });
  if (diagnosticsEnabled) {
    recordCanvasTiming(
      'cell-culling-ms',
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
        cullingStartedAt
    );
  }
  recordCanvasCullingMetrics(metricSourceId, {
    cellsTotal: faceCellGeometries.length,
    cellsRendered
  });
  recordCanvasCounter('cell-overlay-rendered-cells', renderedCells.length);

  return (
    <Group listening={detailsEnabled && isInteractive}>
      <BatchedCellBaseShape
        cells={renderedCells}
        disableStroke={cellOverlaysOff || isRestoreBase}
      />
      {renderedCells.map((renderedCell) => (
        <Group key={renderedCell.key}>
          {detailsEnabled && (
            <CellSurfacePatternVisual
              geometry={renderedCell.geometry}
              visualState={renderedCell.visualState}
            />
          )}
          {cellOverlaysMode === 'normal' && (
            <>
              <CellTruthMarkerOverlay
                geometry={renderedCell.geometry}
                visualState={renderedCell.visualState}
              />
              <CellOutlineOverlay
                geometry={renderedCell.geometry}
                visualState={renderedCell.visualState}
                isActivelyPanning={isActivelyPanning}
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
          {detailsEnabled && (
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
          )}
          {labelsEnabled && showCellNumbers && (
            <CellInteriorSlotLabel
              slotNumber={renderedCell.slotLabel}
              geometry={renderedCell.geometry}
              prominence={cellNumberProminence}
              counterRotationDeg={rackRotationDeg}
            />
          )}
        </Group>
      ))}
      {labelsEnabled && (
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
      )}
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
  isActivelyPanning?: boolean;
  renderMode?: CanvasRenderMode;
  forceRenderAllCells?: boolean;
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
  grid: 'normal',
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

function getFirstCellId(cellIds: Set<string>): string | null {
  for (const cellId of cellIds) {
    return cellId;
  }
  return null;
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
  isActivelyPanning = false,
  renderMode = 'full',
  forceRenderAllCells = false,
  showCellNumbers = true,
  cellNumberProminence = 'dominant',
  showFocusedFullAddress = true
}: Props) {
  const { faceAWidth, faceBWidth, height, isPaired, spineY } = geometry;
  const faceABandH = isPaired ? spineY : height;
  const effectiveFaceB =
    faceB && isRackFaceMirrored(faceB) && faceB.mirrorSourceFaceId === faceA.id
      ? {
          ...faceB,
          slotNumberingDirection: faceA.slotNumberingDirection,
          sections: faceA.sections
        }
      : faceB;
  const normalizedSemanticLevels =
    semanticLevels ??
    collectFaceSemanticLevels([
      faceA,
      ...(effectiveFaceB ? [effectiveFaceB] : [])
    ]);
  const firstHighlightedCellId = getFirstCellId(highlightedCellIds);

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
      'isActivelyPanning',
      'renderMode',
      'forceRenderAllCells',
      'canvasOffsetX',
      'canvasOffsetY',
      'viewportWidth',
      'viewportHeight',
      'zoom',
      'highlightedCellCount',
      'firstHighlightedCellId'
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
      isActivelyPanning,
      renderMode,
      forceRenderAllCells,
      canvasOffsetX: diagnosticsViewport.canvasOffset.x,
      canvasOffsetY: diagnosticsViewport.canvasOffset.y,
      viewportWidth: diagnosticsViewport.viewport.width,
      viewportHeight: diagnosticsViewport.viewport.height,
      zoom: diagnosticsViewport.zoom,
      highlightedCellCount: highlightedCellIds.size,
      firstHighlightedCellId
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
        isActivelyPanning={isActivelyPanning}
        renderMode={renderMode}
        forceRenderAllCells={forceRenderAllCells}
        onCellClick={onCellClick}
      />
      {isPaired && effectiveFaceB && (
        <FaceCells
          face={effectiveFaceB}
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
          isActivelyPanning={isActivelyPanning}
          renderMode={renderMode}
          forceRenderAllCells={forceRenderAllCells}
          onCellClick={onCellClick}
        />
      )}
    </Group>
  );
}
