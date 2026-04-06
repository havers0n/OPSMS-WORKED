import { useState } from 'react';
import type { FloorWorkspace, LocationType } from '@wos/domain';
import { getZonePlacementBehavior } from '@wos/domain';
import { MapPin, Package, X } from 'lucide-react';
import {
  useActiveStorageWorkflow,
  useCancelPlacementInteraction,
  useCreatingRackId,
  useEditorSelection,
  useStartPlaceLocationWorkflow,
  useViewMode
} from '@/entities/layout-version/model/editor-selectors';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import { useFloorNonRackLocations } from '@/entities/location/api/use-floor-non-rack-locations';
import { usePatchLocationGeometry } from '@/entities/location/api/mutations';
import { RackCreationWizard } from '@/features/rack-create/ui/rack-creation-wizard';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { RackInspector } from './rack-inspector';
import { RackMultiInspector } from './rack-multi-inspector';
import { WallInspector } from './wall-inspector';
import { ZoneInspector } from './zone-inspector';
import { LayoutEmptyPanel } from './mode-panels/layout-empty-panel';
import { PlacementModePanel } from './mode-panels/placement-mode-panel';
import { CellPlacementInspector } from './mode-panels/cell-placement-inspector';
import { ContainerPlacementInspector } from './mode-panels/container-placement-inspector';

// Pure routing logic lives in inspector-router-logic.ts (no React, testable in isolation).
import { resolveInspectorKind } from './inspector-router-logic';
export type { InspectorKind } from './inspector-router-logic';
export { resolveInspectorKind };

// ─── zone readonly panel ──────────────────────────────────────────────────────

const PLACEMENT_BEHAVIOR_LABELS = {
  none: { label: 'Context only', color: 'bg-slate-100 text-slate-600' },
  children_only: { label: 'Via rack cells', color: 'bg-blue-50 text-blue-700' },
  direct: { label: 'Direct placement', color: 'bg-amber-50 text-amber-700' }
} as const;

/**
 * Read-only zone panel shown in view/storage mode.
 * Communicates that the zone is a context area — not a placement target.
 */
function ZoneReadonlyPanel({
  workspace,
  onClose
}: {
  workspace: FloorWorkspace | null;
  onClose: () => void;
}) {
  const selection = useEditorSelection();
  const layoutDraft = useWorkspaceLayout(workspace);

  const zoneId = selection.type === 'zone' ? selection.zoneId : null;
  const zone = zoneId && layoutDraft ? (layoutDraft.zones[zoneId] ?? null) : null;

  if (!zone) {
    return (
      <aside className="flex h-full w-full flex-col bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Zone
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
          Select a zone to see its context.
        </div>
      </aside>
    );
  }

  const behavior = getZonePlacementBehavior(zone.category);
  const behaviorDisplay = PLACEMENT_BEHAVIOR_LABELS[behavior];

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Zone
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-800">{zone.code}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto px-5 py-4">
        <div className="rounded-xl border border-[var(--border-muted)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-800">{zone.name}</div>
              <div className="mt-1 text-[11px] text-slate-500">{zone.code}</div>
            </div>
            <span
              className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-white shadow-sm"
              style={{ background: zone.color }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Category
              </div>
              <div className="mt-0.5 text-xs font-semibold text-slate-700 capitalize">
                {zone.category ?? '—'}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Size
              </div>
              <div className="mt-0.5 text-xs font-semibold text-slate-700">
                {Math.round(zone.width)} × {Math.round(zone.height)} m
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-muted)] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Placement behavior
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${behaviorDisplay.color}`}
            >
              {behaviorDisplay.label}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {behavior === 'children_only' &&
              'Containers are placed in rack cells within this zone. Switch to Layout mode to edit the zone boundary.'}
            {behavior === 'direct' &&
              'This zone is designed for direct container placement. Floor-level locations are not yet shown on the map.'}
            {behavior === 'none' &&
              'This zone marks an operational area only. It is not a container placement target.'}
          </p>
        </div>
      </div>
    </aside>
  );
}

// ─── non-rack location detail panel ──────────────────────────────────────────

const LOCATION_TYPE_DISPLAY: Record<LocationType, { label: string; color: string }> = {
  rack_slot: { label: 'Rack slot', color: 'bg-slate-100 text-slate-600' },
  floor:     { label: 'Floor',     color: 'bg-green-50 text-green-700' },
  staging:   { label: 'Staging',   color: 'bg-amber-50 text-amber-700' },
  dock:      { label: 'Dock',      color: 'bg-blue-50 text-blue-700' },
  buffer:    { label: 'Buffer',    color: 'bg-purple-50 text-purple-700' }
};

function LocationDetailPanel({
  workspace,
  onClose
}: {
  workspace: FloorWorkspace | null;
  onClose: () => void;
}) {
  const selection = useEditorSelection();
  const locationId = selection.type === 'location' ? selection.locationId : null;
  const floorId = workspace?.floorId ?? null;

  const { data: occupancy = [] } = useFloorLocationOccupancy(floorId);
  const { data: nonRackLocations = [] } = useFloorNonRackLocations(floorId);
  const patchGeometry = usePatchLocationGeometry();
  const activeStorageWorkflow = useActiveStorageWorkflow();
  const startPlaceLocationWorkflow = useStartPlaceLocationWorkflow();
  const cancelPlacementInteraction = useCancelPlacementInteraction();

  const location = nonRackLocations.find((l) => l.id === locationId) ?? null;
  const rows = occupancy.filter((r) => r.locationId === locationId);

  const isAwaitingPlacement =
    activeStorageWorkflow?.kind === 'place-location' &&
    activeStorageWorkflow.locationId === locationId;

  const [xInput, setXInput] = useState<string>('');
  const [yInput, setYInput] = useState<string>('');
  const [isEditingPos, setIsEditingPos] = useState(false);

  if (!location) {
    return (
      <aside className="flex h-full w-full flex-col bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Location
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
          Location data not available.
        </div>
      </aside>
    );
  }

  const display = LOCATION_TYPE_DISPLAY[location.locationType] ?? LOCATION_TYPE_DISPLAY.floor;
  const hasPosition = location.floorX !== null && location.floorY !== null;

  function startEditingPos() {
    setXInput(location!.floorX !== null ? String(location!.floorX) : '');
    setYInput(location!.floorY !== null ? String(location!.floorY) : '');
    setIsEditingPos(true);
  }

  function savePosition() {
    const x = parseFloat(xInput);
    const y = parseFloat(yInput);
    if (Number.isFinite(x) && Number.isFinite(y) && floorId) {
      patchGeometry.mutate(
        { locationId: location!.id, floorX: x, floorY: y, floorId },
        { onSuccess: () => setIsEditingPos(false) }
      );
    }
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Location
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-800">{location.code}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto px-5 py-4">
        <div className="rounded-xl border border-[var(--border-muted)] p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">{location.code}</div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${display.color}`}>
              {display.label}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {rows.length} container{rows.length !== 1 ? 's' : ''} placed
          </div>
        </div>

        {/* Canvas position */}
        <div className="rounded-xl border border-[var(--border-muted)] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <MapPin className="h-3 w-3" />
            Canvas position
          </div>

          {isAwaitingPlacement ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-amber-700">
                Click anywhere on the canvas to place this location.
              </p>
              <button
                type="button"
                onClick={() => cancelPlacementInteraction()}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="mt-2 text-xs text-slate-600">
                {hasPosition
                  ? `X: ${location.floorX} m, Y: ${location.floorY} m`
                  : <span className="italic text-slate-400">Not positioned — marker hidden on canvas</span>}
              </div>
              <button
                type="button"
                onClick={() => startPlaceLocationWorkflow(location.id)}
                className="mt-2 w-full rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                {hasPosition ? 'Reposition on map' : 'Place on map'}
              </button>

              {/* Manual coordinate entry as secondary option */}
              {!isEditingPos && hasPosition && (
                <button
                  type="button"
                  onClick={startEditingPos}
                  className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  Edit coordinates manually
                </button>
              )}

              {isEditingPos && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[10px] text-slate-400">X (m)</span>
                      <input
                        type="number"
                        value={xInput}
                        onChange={(e) => setXInput(e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                        step="0.1"
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[10px] text-slate-400">Y (m)</span>
                      <input
                        type="number"
                        value={yInput}
                        onChange={(e) => setYInput(e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                        step="0.1"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={savePosition}
                      disabled={patchGeometry.isPending}
                      className="flex-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {patchGeometry.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPos(false)}
                      className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div className="rounded-xl border border-[var(--border-muted)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Containers
            </div>
            <ul className="mt-2 space-y-1.5">
              {rows.map((row) => (
                <li key={row.containerId} className="flex items-center justify-between rounded-lg bg-[var(--surface-secondary)] px-2.5 py-2">
                  <div className="text-xs font-semibold text-slate-700">
                    {row.externalCode ?? row.containerId.slice(0, 8)}
                  </div>
                  <div className="text-[10px] text-slate-400">{row.containerType}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── router component ─────────────────────────────────────────────────────────

type InspectorRouterProps = {
  workspace: FloorWorkspace | null;
  /** Called by layout-mode inspectors when the user clicks the close button. */
  onClose: () => void;
  /** Called by LayoutEmptyPanel to trigger rack placement mode. */
  onAddRack: () => void;
};

/**
 * InspectorRouter — the single entry point for the right-side panel.
 *
 * Reads viewMode and selection from the store, resolves the correct inspector
 * kind, and renders it. No other component should decide which inspector to show.
 *
 * Current routing table:
 *   layout  + rack (creating) → RackCreationWizard
 *   layout  + rack(1, existing) → RackInspector (structural)
 *   layout  + rack(≥2)         → RackMultiInspector (spacing/alignment)
 *   layout  + none             → LayoutEmptyPanel
 *   view    + rack             → RackInspector (read-only)
 *   storage + rack             → RackInspector (read-only)
 *   view    + cell             → CellPlacementInspector (read-only)
 *   view    + container        → ContainerPlacementInspector (read-only)
 *   storage + cell             → CellPlacementInspector
 *   storage + container        → ContainerPlacementInspector
 *   view/storage + none        → PlacementModePanel
 *   storage + location         → LocationDetailPanel (non-rack location detail)
 */
export function InspectorRouter({ workspace, onClose, onAddRack }: InspectorRouterProps) {
  const viewMode = useViewMode();
  const selection = useEditorSelection();
  const creatingRackId = useCreatingRackId();
  const layoutDraft = useWorkspaceLayout(workspace);

  const kind = resolveInspectorKind(viewMode, selection, creatingRackId);

  switch (kind) {
    case 'rack-creation-wizard': {
      const primaryId = selection.type === 'rack' ? selection.rackIds[0] : null;
      const rack = primaryId && layoutDraft ? layoutDraft.racks[primaryId] ?? null : null;
      // Guard: if the draft doesn't contain the rack yet (transient state), fall
      // back to the empty panel rather than crashing.
      if (!rack) return <LayoutEmptyPanel workspace={workspace} onAddRack={onAddRack} />;
      return <RackCreationWizard rack={rack} />;
    }

    case 'rack-structure':
      return <RackInspector workspace={workspace} onClose={onClose} />;

    case 'rack-multi':
      return <RackMultiInspector onClose={onClose} />;

    case 'zone-detail':
      return <ZoneInspector workspace={workspace} onClose={onClose} />;

    case 'zone-readonly':
      return <ZoneReadonlyPanel workspace={workspace} onClose={onClose} />;

    case 'wall-detail':
      return <WallInspector workspace={workspace} onClose={onClose} />;

    case 'layout-empty':
      return <LayoutEmptyPanel workspace={workspace} onAddRack={onAddRack} />;

    case 'placement-cell':
      return <CellPlacementInspector workspace={workspace} />;

    case 'placement-container':
      return <ContainerPlacementInspector workspace={workspace} />;

    case 'location-detail':
      return <LocationDetailPanel workspace={workspace} onClose={onClose} />;

    case 'placement-placeholder':
      return <PlacementModePanel />;
  }
}
