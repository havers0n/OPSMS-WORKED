import { memo, useCallback, useMemo, useRef } from 'react';
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
  recordRackCellsFaceRender,
  recordFaceCellsMemoSkip,
  recordFaceCellsMemoRender,
  refId,
  type CanvasDiagnosticsFlags
} from '../canvas-diagnostics';

// Module-level ref-tracking for diagnostics (keyed by "rackId:faceId").
// Only written when render-pipeline diagnostics are enabled.
const _faceRenderCounts = new Map<string, number>();
const _facePrevRefIds = new Map<
  string,
  { pcs: number; occ: number; crt: number }
>();

const EMPTY_CELL_IDS_ARRAY: readonly string[] = [];
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
  /** Pre-computed cell IDs for this face, used by the memo comparator. */
  faceCellIds: readonly string[];
};

// ---------------------------------------------------------------------------
// FaceCells memo comparator
// ---------------------------------------------------------------------------

function geometryEqual(a: CanvasRackGeometry, b: CanvasRackGeometry): boolean {
  return a.x === b.x && a.y === b.y &&
    a.width === b.width && a.height === b.height &&
    a.centerX === b.centerX && a.centerY === b.centerY &&
    a.spineY === b.spineY && a.faceAWidth === b.faceAWidth &&
    a.faceBWidth === b.faceBWidth && a.isPaired === b.isPaired;
}

function viewportEqual(a: DiagnosticsViewport, b: DiagnosticsViewport): boolean {
  return a.zoom === b.zoom &&
    a.canvasOffset.x === b.canvasOffset.x &&
    a.canvasOffset.y === b.canvasOffset.y &&
    a.viewport.width === b.viewport.width &&
    a.viewport.height === b.viewport.height;
}

function semanticLevelsEqual(a: number[], b: number[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Compares only the RackFace fields consumed by collectRenderedFaceCellGeometries:
 *   id, enabled, slotNumberingDirection, and the structural identity of each
 *   section (id/ordinal/length) and level (id/ordinal/slotCount).
 *
 * Deliberately excluded — not used inside FaceCells:
 *   face.side          — faceTone is hardcoded per FaceCells instance in RackCells
 *   isMirrored / mirrorSourceFaceId / relationshipMode — resolved upstream in
 *                        effectiveFaceB; sections already encode the result
 *   face.faceLength    — affects upstream geometry; captured in totalWidth/rackGeometry
 *   level.structuralDefaultRole — layout metadata, never read by rendering
 */
function faceSemanticEqual(a: RackFace, b: RackFace): boolean {
  if (a === b) return true;
  if (a.id !== b.id) return false;
  if (a.enabled !== b.enabled) return false;
  if (a.slotNumberingDirection !== b.slotNumberingDirection) return false;
  if (a.sections.length !== b.sections.length) return false;
  for (let si = 0; si < a.sections.length; si++) {
    const sa = a.sections[si]!;
    const sb = b.sections[si]!;
    if (sa.id !== sb.id || sa.ordinal !== sb.ordinal || sa.length !== sb.length) return false;
    if (sa.levels.length !== sb.levels.length) return false;
    for (let li = 0; li < sa.levels.length; li++) {
      const la = sa.levels[li]!;
      const lb = sb.levels[li]!;
      if (la.id !== lb.id || la.ordinal !== lb.ordinal || la.slotCount !== lb.slotCount) return false;
    }
  }
  return true;
}

function faceCellsPropsEqual(prev: FaceProps, next: FaceProps): boolean {
  const memoKey = `${next.rackId}:${next.face.id}`;

  // --- Scalar / flag props ---
  if (prev.rackId !== next.rackId) { recordFaceCellsMemoRender(memoKey); return false; }
  if (!faceSemanticEqual(prev.face, next.face)) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.totalWidth !== next.totalWidth) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.bandY !== next.bandY) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.bandH !== next.bandH) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.activeLevelIndex !== next.activeLevelIndex) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.isRackSelected !== next.isRackSelected) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.isInteractive !== next.isInteractive) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.isWorkflowScope !== next.isWorkflowScope) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.isRackPassive !== next.isRackPassive) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.rackRotationDeg !== next.rackRotationDeg) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.selectedCellId !== next.selectedCellId) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.locateTargetCellId !== next.locateTargetCellId) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.workflowSourceCellId !== next.workflowSourceCellId) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.showCellNumbers !== next.showCellNumbers) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.cellNumberProminence !== next.cellNumberProminence) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.showFocusedFullAddress !== next.showFocusedFullAddress) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.isActivelyPanning !== next.isActivelyPanning) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.renderMode !== next.renderMode) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.forceRenderAllCells !== next.forceRenderAllCells) { recordFaceCellsMemoRender(memoKey); return false; }
  if (prev.diagnosticsFlags !== next.diagnosticsFlags) { recordFaceCellsMemoRender(memoKey); return false; }

  // --- Content-compared structural props ---
  if (!semanticLevelsEqual(prev.semanticLevels, next.semanticLevels)) {
    recordFaceCellsMemoRender(memoKey); return false;
  }
  if (!geometryEqual(prev.rackGeometry, next.rackGeometry)) {
    recordFaceCellsMemoRender(memoKey); return false;
  }
  if (!viewportEqual(prev.diagnosticsViewport, next.diagnosticsViewport)) {
    recordFaceCellsMemoRender(memoKey); return false;
  }

  // visualPalette: derived solely from isRackSelected (already compared) + faceTone
  // (faceTone is fixed per FaceCells instance). Safe to skip reference comparison.

  // onCellClick: stabilised via useRef+useCallback in RackCells.
  // Its semantic behaviour is captured by isInteractive/isWorkflowScope (already compared).

  // --- publishedCellsByStructure: conservative reference check ---
  if (prev.publishedCellsByStructure !== next.publishedCellsByStructure) {
    recordFaceCellsMemoRender(memoKey); return false;
  }

  // --- Per-face semantic state for volatile global Maps/Sets ---
  const needsSemanticCheck =
    prev.cellRuntimeById !== next.cellRuntimeById ||
    prev.occupiedCellIds !== next.occupiedCellIds ||
    prev.highlightedCellIds !== next.highlightedCellIds;

  if (needsSemanticCheck) {
    const cellIds = next.faceCellIds;
    for (const cellId of cellIds) {
      if (prev.cellRuntimeById.get(cellId)?.status !== next.cellRuntimeById.get(cellId)?.status) {
        recordFaceCellsMemoRender(memoKey); return false;
      }
      if (prev.occupiedCellIds.has(cellId) !== next.occupiedCellIds.has(cellId)) {
        recordFaceCellsMemoRender(memoKey); return false;
      }
      if (prev.highlightedCellIds.has(cellId) !== next.highlightedCellIds.has(cellId)) {
        recordFaceCellsMemoRender(memoKey); return false;
      }
    }
  }

  recordFaceCellsMemoSkip(memoKey);
  return true;
}

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

  // Per-render trigger flags: track which ref-identity props changed since last render.
  let _diagRenderIndex = 0;
  let _diagTriggerFlags = {
    publishedCellsByStructure_changed: false,
    occupiedCellIds_changed: false,
    cellRuntimeById_changed: false
  };
  if (diagnosticsEnabled) {
    const diagKey = `${rackId}:${face.id}`;
    const currRefs = {
      pcs: refId(publishedCellsByStructure),
      occ: refId(occupiedCellIds),
      crt: refId(cellRuntimeById)
    };
    const prevRefs = _facePrevRefIds.get(diagKey);
    _diagRenderIndex = (_faceRenderCounts.get(diagKey) ?? 0) + 1;
    _faceRenderCounts.set(diagKey, _diagRenderIndex);
    _facePrevRefIds.set(diagKey, currRefs);
    _diagTriggerFlags = {
      publishedCellsByStructure_changed: !prevRefs || prevRefs.pcs !== currRefs.pcs,
      occupiedCellIds_changed: !prevRefs || prevRefs.occ !== currRefs.occ,
      cellRuntimeById_changed: !prevRefs || prevRefs.crt !== currRefs.crt
    };
  }

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
  const geometryMs = diagnosticsEnabled
    ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) - geometryStartedAt
    : 0;
  if (diagnosticsEnabled) {
    recordCanvasTiming('cell-geometry-calculation-ms', geometryMs);
  }

  const loopStartedAt = diagnosticsEnabled
    ? typeof performance !== 'undefined'
      ? performance.now()
      : Date.now()
    : 0;
  let _diagVisualStateMs = 0;
  let _diagLookupMs = 0;

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
    const _lookupStart = diagnosticsEnabled
      ? typeof performance !== 'undefined' ? performance.now() : Date.now()
      : 0;
    const runtime = cellId ? cellRuntimeById.get(cellId) : null;
    const isOccupied = cellId !== null && occupiedCellIds.has(cellId);
    if (diagnosticsEnabled) {
      _diagLookupMs += (typeof performance !== 'undefined' ? performance.now() : Date.now()) - _lookupStart;
    }
    const _vsStart = diagnosticsEnabled
      ? typeof performance !== 'undefined' ? performance.now() : Date.now()
      : 0;
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
    if (diagnosticsEnabled) {
      _diagVisualStateMs += (typeof performance !== 'undefined' ? performance.now() : Date.now()) - _vsStart;
    }
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
  const loopMs = diagnosticsEnabled
    ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) - loopStartedAt
    : 0;
  if (diagnosticsEnabled) {
    // Keep existing 'cell-culling-ms' for backwards-compat with existing reports.
    recordCanvasTiming('cell-culling-ms', loopMs);
    recordCanvasTiming('rack-cells-loop-ms', loopMs);
    recordCanvasTiming('rack-cells-visual-state-ms', _diagVisualStateMs);
    recordCanvasTiming('rack-cells-lookup-ms', _diagLookupMs);
  }
  recordCanvasCullingMetrics(metricSourceId, {
    cellsTotal: faceCellGeometries.length,
    cellsRendered
  });
  recordCanvasCounter('cell-overlay-rendered-cells', renderedCells.length);

  if (diagnosticsEnabled) {
    recordRackCellsFaceRender({
      rackId,
      faceId: face.id,
      renderIndex: _diagRenderIndex,
      triggerFlags: _diagTriggerFlags,
      cellsGeometry: faceCellGeometries.length,
      cellsRendered,
      labelsCount: focusedAddressLabels.length,
      geometryMs,
      loopMs,
      visualStateMs: _diagVisualStateMs,
      lookupMs: _diagLookupMs
    });
  }

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

const MemoFaceCells = memo(FaceCells, faceCellsPropsEqual);

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

  // Stabilise derived values that would otherwise be new references every render.
  const effectiveFaceB = useMemo(
    () =>
      faceB && isRackFaceMirrored(faceB) && faceB.mirrorSourceFaceId === faceA.id
        ? { ...faceB, slotNumberingDirection: faceA.slotNumberingDirection, sections: faceA.sections }
        : faceB,
    [faceA, faceB]
  );

  const normalizedSemanticLevels = useMemo(
    () => semanticLevels ?? collectFaceSemanticLevels([faceA, ...(effectiveFaceB ? [effectiveFaceB] : [])]),
    [semanticLevels, faceA, effectiveFaceB]
  );

  // Stable onCellClick: the ref always holds the latest handler, but the
  // callback identity is constant so MemoFaceCells never re-renders for it.
  const onCellClickRef = useRef(onCellClick);
  onCellClickRef.current = onCellClick;
  const stableOnCellClick = useCallback(
    (cellId: string, anchor: { x: number; y: number }) => onCellClickRef.current(cellId, anchor),
    []
  );

  // Per-face cell ID lists for the memo comparator.
  // These are the cell IDs that actually exist for each face at the active level.
  // The memo comparator uses them to compare per-face runtime/occupancy/highlight
  // subsets without iterating the full global Maps.
  const faceACellIds = useMemo(
    () =>
      collectRenderedFaceCellGeometries({
        face: faceA,
        rackId,
        publishedCellsByStructure,
        activeLevelIndex,
        semanticLevels: normalizedSemanticLevels,
        totalWidth: faceAWidth,
        bandY: 0,
        bandH: faceABandH
      })
        .map((g) => g.cellId)
        .filter((id): id is string => id !== null),
    [faceA, rackId, publishedCellsByStructure, activeLevelIndex, normalizedSemanticLevels, faceAWidth, faceABandH]
  );

  const faceBCellIds = useMemo(() => {
    if (!isPaired || !effectiveFaceB) return EMPTY_CELL_IDS_ARRAY;
    return collectRenderedFaceCellGeometries({
      face: effectiveFaceB,
      rackId,
      publishedCellsByStructure,
      activeLevelIndex,
      semanticLevels: normalizedSemanticLevels,
      totalWidth: faceBWidth,
      bandY: spineY,
      bandH: height - spineY
    })
      .map((g) => g.cellId)
      .filter((id): id is string => id !== null);
  }, [effectiveFaceB, rackId, publishedCellsByStructure, activeLevelIndex, normalizedSemanticLevels, faceBWidth, spineY, height, isPaired]);

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
      <MemoFaceCells
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
        onCellClick={stableOnCellClick}
        faceCellIds={faceACellIds}
      />
      {isPaired && effectiveFaceB && (
        <MemoFaceCells
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
          onCellClick={stableOnCellClick}
          faceCellIds={faceBCellIds}
        />
      )}
    </Group>
  );
}
