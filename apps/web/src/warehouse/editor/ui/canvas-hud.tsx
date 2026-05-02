import type { Cell, Rack, Wall, Zone } from '@wos/domain';
import { Minus, Plus, SlidersHorizontal } from 'lucide-react';
import type { RackSideFocus } from '@/warehouse/editor/model/editor-types';
import { faceAtViewportEdge } from '@/shared/lib/rack-face-labels';
import type { CanvasRect } from '@/entities/layout-version/lib/canvas-geometry';
import {
  ObjectLocalAffordanceBar,
  ObjectLocalAffordanceButton
} from './object-local-affordance-bar';

type CanvasHudProps = {
  viewport: { width: number; height: number };
  zoom: number;
  hintText: string;
  isLayoutDrawToolActive: boolean;
  isPlacing: boolean;
  isDrawingZone: boolean;
  isPlacementMoveMode: boolean;
  shouldShowLayoutRackGeometryBar: boolean;
  shouldShowLayoutRackSideHandles: boolean;
  shouldShowLayoutZoneBar: boolean;
  shouldShowLayoutWallBar: boolean;
  shouldShowStorageCellBar: boolean;
  selectedRack: Rack | null;
  selectedRackAnchorRect: CanvasRect | null;
  selectedRackSideFocus: RackSideFocus | null;
  selectedZone: Zone | null;
  selectedZoneAnchorRect: CanvasRect | null;
  selectedWall: Wall | null;
  selectedWallAnchorRect: CanvasRect | null;
  selectedStorageCell: Cell | null;
  selectedStorageCellAnchorRect: CanvasRect | null;
  onOpenInspector: () => void;
  onSelectRackSide: (side: RackSideFocus) => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomIn: () => void;
};

function getRackSideHandleStyle({
  side,
  anchorRect,
  viewport
}: {
  side: RackSideFocus;
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
}) {
  const viewportPadding = 8;
  const centerX = anchorRect.x + anchorRect.width / 2;
  const centerY = anchorRect.y + anchorRect.height / 2;
  const minX = viewportPadding;
  const maxX = Math.max(minX, viewport.width - viewportPadding);
  const minY = viewportPadding;
  const maxY = Math.max(minY, viewport.height - viewportPadding);

  const points: Record<RackSideFocus, { left: number; top: number; transform: string }> = {
    north: {
      left: Math.min(maxX, Math.max(minX, centerX)),
      top: Math.min(maxY, Math.max(minY, anchorRect.y)),
      transform: 'translate(-50%, -50%)'
    },
    east: {
      left: Math.min(maxX, Math.max(minX, anchorRect.x + anchorRect.width)),
      top: Math.min(maxY, Math.max(minY, centerY)),
      transform: 'translate(-50%, -50%)'
    },
    south: {
      left: Math.min(maxX, Math.max(minX, centerX)),
      top: Math.min(maxY, Math.max(minY, anchorRect.y + anchorRect.height)),
      transform: 'translate(-50%, -50%)'
    },
    west: {
      left: Math.min(maxX, Math.max(minX, anchorRect.x)),
      top: Math.min(maxY, Math.max(minY, centerY)),
      transform: 'translate(-50%, -50%)'
    }
  };

  return points[side];
}

function RackSideFocusHandles({
  anchorRect,
  viewport,
  activeSide,
  rotationDeg,
  onSelectSide
}: {
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
  activeSide: RackSideFocus | null;
  rotationDeg: number;
  onSelectSide: (side: RackSideFocus) => void;
}) {
  return (
    <>
      {(['north', 'east', 'south', 'west'] as RackSideFocus[]).map((side) => {
        const isActive = activeSide === side;
        const face = faceAtViewportEdge(rotationDeg, side);

        return (
          <button
            key={side}
            type="button"
            title={`Focus Face ${face}`}
            onClick={() => onSelectSide(side)}
            className="pointer-events-auto absolute z-20 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold shadow-md transition-colors"
            style={{
              ...getRackSideHandleStyle({ side, anchorRect, viewport }),
              background: isActive ? 'var(--accent)' : 'var(--surface-strong)',
              borderColor: isActive ? 'var(--accent)' : 'var(--border-muted)',
              color: isActive ? '#fff' : 'var(--text-primary)'
            }}
          >
            {face}
          </button>
        );
      })}
    </>
  );
}

type StorageCellAffordanceBarProps = {
  cell: Cell;
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
  onOpenInspector: () => void;
};

function StorageCellAffordanceBar({
  cell,
  anchorRect,
  viewport,
  onOpenInspector
}: StorageCellAffordanceBarProps) {
  return (
    <ObjectLocalAffordanceBar
      anchorRect={anchorRect}
      viewport={viewport}
      label={cell.address.raw}
    >
      <ObjectLocalAffordanceButton
        icon={SlidersHorizontal}
        label="Inspect"
        variant="accent"
        onClick={onOpenInspector}
      />
    </ObjectLocalAffordanceBar>
  );
}

type LayoutZoneAffordanceBarProps = {
  zone: Zone;
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
  onOpenInspector: () => void;
};

function LayoutZoneAffordanceBar({
  zone,
  anchorRect,
  viewport,
  onOpenInspector
}: LayoutZoneAffordanceBarProps) {
  return (
    <ObjectLocalAffordanceBar
      anchorRect={anchorRect}
      viewport={viewport}
      label={zone.name}
    >
      <ObjectLocalAffordanceButton
        icon={SlidersHorizontal}
        label="Inspect"
        variant="accent"
        onClick={onOpenInspector}
      />
    </ObjectLocalAffordanceBar>
  );
}

type LayoutWallAffordanceBarProps = {
  wall: Wall;
  anchorRect: CanvasRect;
  viewport: { width: number; height: number };
  onOpenInspector: () => void;
};

function LayoutWallAffordanceBar({
  wall,
  anchorRect,
  viewport,
  onOpenInspector
}: LayoutWallAffordanceBarProps) {
  return (
    <ObjectLocalAffordanceBar
      anchorRect={anchorRect}
      viewport={viewport}
      label={wall.code}
    >
      <ObjectLocalAffordanceButton
        icon={SlidersHorizontal}
        label="Inspect"
        variant="accent"
        onClick={onOpenInspector}
      />
    </ObjectLocalAffordanceBar>
  );
}

export function CanvasHud({
  viewport,
  zoom,
  hintText,
  isLayoutDrawToolActive,
  isPlacing,
  isDrawingZone,
  isPlacementMoveMode,
  shouldShowLayoutRackGeometryBar: _shouldShowLayoutRackGeometryBar,
  shouldShowLayoutRackSideHandles,
  shouldShowLayoutZoneBar,
  shouldShowLayoutWallBar,
  shouldShowStorageCellBar,
  selectedRack,
  selectedRackAnchorRect,
  selectedRackSideFocus,
  selectedZone,
  selectedZoneAnchorRect,
  selectedWall,
  selectedWallAnchorRect,
  selectedStorageCell,
  selectedStorageCellAnchorRect,
  onOpenInspector,
  onSelectRackSide,
  onZoomOut,
  onZoomReset,
  onZoomIn
}: CanvasHudProps) {
  return (
    <>
      {isPlacing && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-center justify-center">
          <div
            className="rounded-xl px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
            style={{
              background: 'rgba(15,24,42,0.88)',
              color: '#e2e8f0',
              border: '1px solid rgba(6,182,212,0.4)'
            }}
          >
            Click canvas to place rack · Press{' '}
            <kbd className="mx-1 rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px]">
              Esc
            </kbd>{' '}
            to cancel
          </div>
        </div>
      )}

      {isDrawingZone && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex items-center justify-center">
          <div
            className="rounded-xl px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
            style={{
              background: 'rgba(15,24,42,0.88)',
              color: '#e2e8f0',
              border: '1px solid rgba(34,197,94,0.4)'
            }}
          >
            Drag on empty canvas to draw zone · Press{' '}
            <kbd className="mx-1 rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px]">
              Esc
            </kbd>{' '}
            to cancel
          </div>
        </div>
      )}

      {isPlacementMoveMode && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex items-center justify-center">
          <div
            className="rounded-xl px-4 py-2 text-xs font-medium shadow-lg backdrop-blur"
            style={{
              background: 'rgba(15,24,42,0.88)',
              color: '#e2e8f0',
              border: '1px solid rgba(14,165,233,0.4)'
            }}
          >
            Move target selection active · Click a destination cell
          </div>
        </div>
      )}

      {shouldShowLayoutRackSideHandles && selectedRack && selectedRackAnchorRect && (
        <RackSideFocusHandles
          anchorRect={selectedRackAnchorRect}
          viewport={viewport}
          activeSide={selectedRackSideFocus}
          rotationDeg={selectedRack.rotationDeg}
          onSelectSide={onSelectRackSide}
        />
      )}

      {shouldShowLayoutZoneBar && selectedZone && selectedZoneAnchorRect && (
        <LayoutZoneAffordanceBar
          zone={selectedZone}
          anchorRect={selectedZoneAnchorRect}
          viewport={viewport}
          onOpenInspector={onOpenInspector}
        />
      )}

      {shouldShowLayoutWallBar && selectedWall && selectedWallAnchorRect && (
        <LayoutWallAffordanceBar
          wall={selectedWall}
          anchorRect={selectedWallAnchorRect}
          viewport={viewport}
          onOpenInspector={onOpenInspector}
        />
      )}

      {shouldShowStorageCellBar && selectedStorageCell && selectedStorageCellAnchorRect && (
        <StorageCellAffordanceBar
          cell={selectedStorageCell}
          anchorRect={selectedStorageCellAnchorRect}
          viewport={viewport}
          onOpenInspector={onOpenInspector}
        />
      )}

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
        {!isLayoutDrawToolActive && (
          <div
            className="rounded-xl px-3 py-2 text-[11px]"
            style={{
              background: 'rgba(15,24,42,0.72)',
              color: '#94a3b8',
              backdropFilter: 'blur(4px)'
            }}
          >
            {hintText}
          </div>
        )}

        <div
          className="pointer-events-auto flex items-center gap-1 rounded-xl px-2 py-1.5 shadow-md"
          style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--border-muted)'
          }}
        >
          <button
            type="button"
            onClick={onZoomOut}
            className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: 'var(--text-muted)' }}
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            className="min-w-[44px] rounded-lg px-2 py-0.5 text-center text-[11px] font-medium transition-colors hover:bg-slate-100"
            style={{ color: 'var(--text-primary)' }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: 'var(--text-muted)' }}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </>
  );
}
