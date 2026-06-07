import type { Cell, OperationsCellRuntime, Rack, RackFace } from '@wos/domain';
import { memo, useMemo } from 'react';
import { Group, Shape } from 'react-konva';

function isCoarsePointerDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

import {
  getRackGeometry,
  shouldRenderCanvasCell,
  type CanvasRackGeometry,
  type CanvasViewport
} from '@/entities/layout-version/lib/canvas-geometry';
import { collectRackSemanticLevels } from '@/warehouse/editor/model/storage-level-mapping';
import type { CanvasDiagnosticsFlags } from '../canvas-diagnostics';
import { recordCanvasCullingMetrics } from '../canvas-diagnostics';
import type { CanvasRenderMode } from '../canvas-render-mode';
import {
  collectRenderedFaceCellGeometries,
  getEffectiveRackFaceB,
  getRackGroupTransform,
  type RackCellRectGeometry
} from './rack-cell-geometry';
import { getWarehouseSemanticCellPalette } from './warehouse-semantic-canvas-palette';

export type StorageOccupancyOverlayStatus =
  | 'empty'
  | 'occupied'
  | 'stocked'
  | 'reserved'
  | 'pick_active'
  | 'quarantined';

export type StorageOccupancyOverlayCell = {
  cellId: string;
  rackId: string;
  status: StorageOccupancyOverlayStatus;
  hasRuntimeTruth: boolean;
  hasWarning?: boolean;
  geometry: RackCellRectGeometry;
};

export type StorageOccupancyOverlayLod =
  | 'hidden'
  | 'rack-summary'
  | 'cell-status'
  | 'cell-compact';

export type StorageOccupancyOverlayVariant =
  | 'on'
  | 'off'
  | 'summary-only';

type DiagnosticsViewport = {
  canvasOffset: { x: number; y: number };
  viewport: CanvasViewport;
  zoom: number;
};

const FAR_ZOOM_THRESHOLD = 0.18;
const OVERVIEW_ZOOM_THRESHOLD = 0.9;
const CELL_SURFACE_INSET_SCREEN_PX = 1.5;

// Storage overview visibility lives outside RackCells because RackCells is
// intentionally gated until deeper cell LOD in storage mode.
const EXCEPTIONAL_OVERLAY_STATUSES: ReadonlySet<string> = new Set([
  'pick_active',
  'reserved',
  'quarantined'
]);

export function resolveStatus(params: {
  cellId: string;
  occupiedCellIds: Set<string>;
  cellRuntimeById: Map<string, OperationsCellRuntime>;
}): Pick<
  StorageOccupancyOverlayCell,
  'status' | 'hasRuntimeTruth' | 'hasWarning'
> {
  const runtime = params.cellRuntimeById.get(params.cellId) ?? null;
  if (runtime && EXCEPTIONAL_OVERLAY_STATUSES.has(runtime.status)) {
    return {
      status: runtime.status,
      hasRuntimeTruth: true,
      hasWarning: runtime.status === 'quarantined'
    };
  }

  // Normal runtime states (stocked, empty) defer to physical occupancy data
  // so that Move/Remove/Add mutation results are reflected immediately.
  if (params.occupiedCellIds.has(params.cellId)) {
    return {
      status: 'occupied',
      hasRuntimeTruth: false
    };
  }

  return {
    status: 'empty',
    hasRuntimeTruth: false
  };
}

export function getStorageOccupancyOverlayLod({
  isStorageMode,
  renderMode,
  variant = 'on',
  zoom
}: {
  isStorageMode: boolean;
  renderMode: CanvasRenderMode;
  variant?: StorageOccupancyOverlayVariant;
  zoom: number;
}): StorageOccupancyOverlayLod {
  if (!isStorageMode || variant === 'off' || zoom < FAR_ZOOM_THRESHOLD) {
    return 'hidden';
  }

  if (
    variant === 'summary-only' ||
    renderMode === 'interaction-skeleton' ||
    renderMode === 'interaction-light' ||
    renderMode === 'restore-base'
  ) {
    return 'rack-summary';
  }

  if (zoom < OVERVIEW_ZOOM_THRESHOLD) {
    return 'cell-compact';
  }

  return 'cell-status';
}

function collectFaceOverlayCells({
  activeLevelIndex,
  bandH,
  bandY,
  cellRuntimeById,
  diagnosticsFlags,
  diagnosticsViewport,
  face,
  occupiedCellIds,
  publishedCellsByStructure,
  rackGeometry,
  rackId,
  rackRotationDeg,
  semanticLevels,
  totalWidth
}: {
  face: RackFace;
  rackId: string;
  totalWidth: number;
  bandY: number;
  bandH: number;
  activeLevelIndex: number | null;
  semanticLevels: number[];
  publishedCellsByStructure: Map<string, Cell>;
  occupiedCellIds: Set<string>;
  cellRuntimeById: Map<string, OperationsCellRuntime>;
  diagnosticsFlags: CanvasDiagnosticsFlags;
  diagnosticsViewport: DiagnosticsViewport;
  rackGeometry: CanvasRackGeometry;
  rackRotationDeg: Rack['rotationDeg'];
}) {
  const renderedCells = collectRenderedFaceCellGeometries({
    activeLevelIndex,
    bandH,
    bandY,
    face,
    publishedCellsByStructure,
    rackId,
    semanticLevels,
    totalWidth
  });
  const cullingEnabled =
    diagnosticsFlags.cells !== 'unculled' &&
    diagnosticsFlags.enableProductionCellCulling;
  const overlayCells: StorageOccupancyOverlayCell[] = [];
  let cellsRendered = 0;

  for (const renderedCell of renderedCells) {
    if (renderedCell.cellId === null) continue;

    if (
      cullingEnabled &&
      !shouldRenderCanvasCell({
        cellGeometry: renderedCell.geometry,
        canvasOffset: diagnosticsViewport.canvasOffset,
        rackGeometry,
        rackRotationDeg,
        viewport: diagnosticsViewport.viewport,
        zoom: diagnosticsViewport.zoom
      })
    ) {
      continue;
    }

    const status = resolveStatus({
      cellId: renderedCell.cellId,
      occupiedCellIds,
      cellRuntimeById
    });
    if (status.status === 'empty') continue;

    cellsRendered += 1;
    overlayCells.push({
      cellId: renderedCell.cellId,
      rackId,
      geometry: renderedCell.geometry,
      ...status
    });
  }

  recordCanvasCullingMetrics(`storage-occupancy-overlay:${rackId}:${face.id}`, {
    cellsTotal: renderedCells.length,
    cellsRendered
  });

  return overlayCells;
}

function collectRackOverlayCells({
  activeLevelIndex,
  cellRuntimeById,
  diagnosticsFlags,
  diagnosticsViewport,
  occupiedCellIds,
  publishedCellsByStructure,
  rack
}: {
  rack: Rack;
  activeLevelIndex: number | null;
  publishedCellsByStructure: Map<string, Cell>;
  occupiedCellIds: Set<string>;
  cellRuntimeById: Map<string, OperationsCellRuntime>;
  diagnosticsFlags: CanvasDiagnosticsFlags;
  diagnosticsViewport: DiagnosticsViewport;
}) {
  const geometry = getRackGeometry(rack);
  const faceA = rack.faces.find((face) => face.side === 'A') ?? null;
  if (!faceA) return [];

  const effectiveFaceB = getEffectiveRackFaceB(rack);
  const semanticLevels = collectRackSemanticLevels(rack);
  const faceABandH = geometry.isPaired ? geometry.spineY : geometry.height;

  const cells = collectFaceOverlayCells({
    activeLevelIndex,
    bandH: faceABandH,
    bandY: 0,
    cellRuntimeById,
    diagnosticsFlags,
    diagnosticsViewport,
    face: faceA,
    occupiedCellIds,
    publishedCellsByStructure,
    rackGeometry: geometry,
    rackId: rack.id,
    rackRotationDeg: rack.rotationDeg,
    semanticLevels,
    totalWidth: geometry.faceAWidth
  });

  if (geometry.isPaired && effectiveFaceB) {
    cells.push(
      ...collectFaceOverlayCells({
        activeLevelIndex,
        bandH: geometry.height - geometry.spineY,
        bandY: geometry.spineY,
        cellRuntimeById,
        diagnosticsFlags,
        diagnosticsViewport,
        face: effectiveFaceB,
        occupiedCellIds,
        publishedCellsByStructure,
        rackGeometry: geometry,
        rackId: rack.id,
        rackRotationDeg: rack.rotationDeg,
        semanticLevels,
        totalWidth: geometry.faceBWidth
      })
    );
  }

  return cells;
}

function getDominantStatus(cells: StorageOccupancyOverlayCell[]) {
  if (cells.some((cell) => cell.status === 'quarantined')) return 'quarantined';
  if (cells.some((cell) => cell.status === 'pick_active')) return 'pick_active';
  if (cells.some((cell) => cell.status === 'reserved')) return 'reserved';
  if (cells.some((cell) => cell.status === 'stocked')) return 'stocked';
  return 'occupied';
}

function getStatusPaint(status: StorageOccupancyOverlayStatus) {
  const palette = getWarehouseSemanticCellPalette();
  switch (status) {
    case 'quarantined':
      return {
        fill: palette.quarantinedFill,
        stroke: palette.quarantinedStroke
      };
    case 'pick_active':
      return {
        fill: palette.pickActiveFill,
        stroke: palette.pickActiveStroke
      };
    case 'reserved':
      return {
        fill: palette.reservedFill,
        stroke: palette.reservedStroke
      };
    case 'stocked':
      return {
        fill: palette.stockedFill,
        stroke: palette.stockedStroke
      };
    case 'occupied':
      return {
        fill: palette.occupiedFill,
        stroke: palette.occupiedStroke
      };
    default:
      return {
        fill: palette.emptyFill,
        stroke: palette.emptyStroke
      };
  }
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  rect: RackCellRectGeometry,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  context.beginPath();
  context.moveTo(rect.x + r, rect.y);
  context.lineTo(rect.x + rect.width - r, rect.y);
  context.quadraticCurveTo(
    rect.x + rect.width,
    rect.y,
    rect.x + rect.width,
    rect.y + r
  );
  context.lineTo(rect.x + rect.width, rect.y + rect.height - r);
  context.quadraticCurveTo(
    rect.x + rect.width,
    rect.y + rect.height,
    rect.x + rect.width - r,
    rect.y + rect.height
  );
  context.lineTo(rect.x + r, rect.y + rect.height);
  context.quadraticCurveTo(
    rect.x,
    rect.y + rect.height,
    rect.x,
    rect.y + rect.height - r
  );
  context.lineTo(rect.x, rect.y + r);
  context.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
  context.closePath();
}

export function getStorageOccupancyOverlaySurfaceRect({
  geometry,
  zoom
}: {
  geometry: RackCellRectGeometry;
  zoom: number;
}): RackCellRectGeometry {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const screenInset = CELL_SURFACE_INSET_SCREEN_PX / safeZoom;
  const maxInset = Math.max(0, Math.min(geometry.width, geometry.height) * 0.25);
  const inset = Math.min(screenInset, maxInset);

  return {
    x: geometry.x + inset,
    y: geometry.y + inset,
    width: Math.max(0, geometry.width - inset * 2),
    height: Math.max(0, geometry.height - inset * 2)
  };
}

function drawStatusAccent({
  cell,
  context,
  paint,
  rect,
  zoom
}: {
  context: CanvasRenderingContext2D;
  cell: StorageOccupancyOverlayCell;
  paint: ReturnType<typeof getStatusPaint>;
  rect: RackCellRectGeometry;
  zoom: number;
}) {
  if (
    cell.status !== 'pick_active' &&
    cell.status !== 'quarantined' &&
    cell.status !== 'reserved'
  ) {
    return;
  }

  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const minSide = Math.min(rect.width, rect.height);
  const inset = Math.min(minSide * 0.28, Math.max(2 / safeZoom, minSide * 0.16));

  context.strokeStyle = paint.stroke;
  context.lineWidth = Math.max(1 / safeZoom, Math.min(2.5 / safeZoom, minSide * 0.08));

  if (cell.status === 'pick_active') {
    context.beginPath();
    context.moveTo(rect.x + inset, rect.y + rect.height - inset);
    context.lineTo(rect.x + rect.width - inset, rect.y + inset);
    context.stroke();
  } else if (cell.status === 'quarantined') {
    context.beginPath();
    context.moveTo(rect.x + inset, rect.y + inset);
    context.lineTo(rect.x + rect.width - inset, rect.y + rect.height - inset);
    context.moveTo(rect.x + rect.width - inset, rect.y + inset);
    context.lineTo(rect.x + inset, rect.y + rect.height - inset);
    context.stroke();
  } else if (cell.status === 'reserved') {
    context.setLineDash([3 / safeZoom, 3 / safeZoom]);
    context.strokeRect(
      rect.x + inset,
      rect.y + inset,
      Math.max(1, rect.width - inset * 2),
      Math.max(1, rect.height - inset * 2)
    );
  }
}

function drawStatusMark(
  context: CanvasRenderingContext2D,
  cell: StorageOccupancyOverlayCell,
  lod: Extract<StorageOccupancyOverlayLod, 'cell-status' | 'cell-compact'>,
  zoom: number
) {
  const paint = getStatusPaint(cell.status);
  const rect = getStorageOccupancyOverlaySurfaceRect({
    geometry: cell.geometry,
    zoom
  });
  context.save();
  context.globalAlpha *= lod === 'cell-compact' ? 0.88 : 0.82;
  drawRoundedRect(context, rect, 2);
  context.fillStyle = paint.fill;
  context.fill();
  context.strokeStyle = paint.stroke;
  context.lineWidth = lod === 'cell-compact' ? 1.4 : 1;
  context.stroke();

  drawStatusAccent({ cell, context, paint, rect, zoom });

  context.restore();
}

function drawRackSummary(
  context: CanvasRenderingContext2D,
  geometry: CanvasRackGeometry,
  cells: StorageOccupancyOverlayCell[]
) {
  if (cells.length === 0) return;

  const status = getDominantStatus(cells);
  const paint = getStatusPaint(status);
  const size = Math.max(8, Math.min(geometry.width, geometry.height) * 0.22);
  const rect = {
    x: geometry.width - size - 6,
    y: 6,
    width: size,
    height: size
  };

  context.save();
  context.globalAlpha *= 0.95;
  drawRoundedRect(context, rect, 3);
  context.fillStyle = paint.fill;
  context.fill();
  context.strokeStyle = paint.stroke;
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
}

type RackOverlayModel = {
  rack: Rack;
  geometry: CanvasRackGeometry;
  cells: StorageOccupancyOverlayCell[];
};

type Props = {
  isStorageMode: boolean;
  racks: Rack[];
  primarySelectedRackId: string | null;
  selectedRackActiveLevel: number | null;
  publishedCellsByStructure: Map<string, Cell>;
  occupiedCellIds: Set<string>;
  cellRuntimeById: Map<string, OperationsCellRuntime>;
  diagnosticsFlags: CanvasDiagnosticsFlags;
  diagnosticsViewport: DiagnosticsViewport;
  renderMode: CanvasRenderMode;
  zoom: number;
};

export const StorageOccupancyOverlay = memo(function StorageOccupancyOverlay({
  isStorageMode,
  racks,
  primarySelectedRackId,
  selectedRackActiveLevel,
  publishedCellsByStructure,
  occupiedCellIds,
  cellRuntimeById,
  diagnosticsFlags,
  diagnosticsViewport,
  renderMode,
  zoom
}: Props) {
  const overlayLod = getStorageOccupancyOverlayLod({
    isStorageMode,
    renderMode,
    variant: diagnosticsFlags.storageOccupancyOverlay ?? 'on',
    zoom
  });

  const rackModels = useMemo<RackOverlayModel[]>(() => {
    if (overlayLod === 'hidden') return [];

    return racks
      .map((rack) => {
        const geometry = getRackGeometry(rack);
        return {
          rack,
          geometry,
          cells: collectRackOverlayCells({
            rack,
            activeLevelIndex:
              rack.id === primarySelectedRackId ? selectedRackActiveLevel : 0,
            publishedCellsByStructure,
            occupiedCellIds,
            cellRuntimeById,
            diagnosticsFlags,
            diagnosticsViewport
          })
        };
      })
      .filter((model) => model.cells.length > 0);
  }, [
    cellRuntimeById,
    diagnosticsFlags,
    diagnosticsViewport,
    occupiedCellIds,
    overlayLod,
    primarySelectedRackId,
    publishedCellsByStructure,
    racks,
    selectedRackActiveLevel
  ]);

  if (
    overlayLod === 'hidden' ||
    rackModels.length === 0 ||
    isCoarsePointerDevice()
  ) {
    return null;
  }

  return (
    <>
      {rackModels.map((model) => {
        const transform = getRackGroupTransform(
          model.geometry,
          model.rack.rotationDeg
        );

        return (
          <Group
            key={model.rack.id}
            {...transform}
            listening={false}
            name="storage-occupancy-rack-group"
          >
            <Shape
              listening={false}
              name={
                overlayLod === 'rack-summary'
                  ? 'storage-occupancy-rack-summary'
                  : 'storage-occupancy-cell-batch'
              }
              wosShapeRole="storage-occupancy-overlay"
              cells={model.cells}
              overlayLod={overlayLod}
              sceneFunc={(context) => {
                const canvasContext = (
                  context as unknown as {
                    _context?: CanvasRenderingContext2D;
                  }
                )._context;
                if (!canvasContext) return;

                if (overlayLod === 'rack-summary') {
                  drawRackSummary(canvasContext, model.geometry, model.cells);
                  return;
                }

                for (const cell of model.cells) {
                  drawStatusMark(canvasContext, cell, overlayLod, zoom);
                }
              }}
            />
          </Group>
        );
      })}
    </>
  );
});
