import type { FloorWorkspace } from '@wos/domain';
import { getZonePlacementBehavior } from '@wos/domain';
import { MapPin, X } from 'lucide-react';
import {
  useEditorSelection,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { RackInspector } from './rack-inspector';
import { RackMultiInspector } from './rack-multi-inspector';
import { WallInspector } from './wall-inspector';
import { ZoneInspector } from './zone-inspector';
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

// ─── router component ─────────────────────────────────────────────────────────

type InspectorRouterProps = {
  workspace: FloorWorkspace | null;
  /** Called by layout-mode inspectors when the user clicks the close button. */
  onClose: () => void;
};

/**
 * InspectorRouter — selection-only entry point for inspector content.
 *
 * Reads viewMode and selection from the store, resolves the correct inspector
 * kind, and renders it. Task routing is handled by the layout shell and TaskSurface.
 *
 * Current routing table:
 *   layout  + rack(1, existing) → RackInspector (structural)
 *   layout  + rack(≥2)         → RackMultiInspector (spacing/alignment)
 *   view    + rack             → RackInspector (read-only)
 *   storage + rack             → RackInspector (read-only)
 *   view    + cell             → CellPlacementInspector (read-only)
 *   view    + container        → ContainerPlacementInspector (read-only)
 *   storage + cell             → CellPlacementInspector
 *   storage + container        → ContainerPlacementInspector
 *   view/storage + none        → PlacementModePanel
 */
export function InspectorRouter({ workspace, onClose }: InspectorRouterProps) {
  const viewMode = useViewMode();
  const selection = useEditorSelection();
  const kind = resolveInspectorKind(viewMode, selection);

  switch (kind) {
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

    case 'placement-cell':
      return <CellPlacementInspector workspace={workspace} />;

    case 'placement-container':
      return <ContainerPlacementInspector workspace={workspace} />;

    case 'placement-placeholder':
      return <PlacementModePanel />;

    case null:
      return null;
  }
}
