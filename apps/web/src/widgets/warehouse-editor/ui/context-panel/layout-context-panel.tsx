import { generatePreviewCells, getZonePlacementBehavior, validateLayoutDraft } from '@wos/domain';
import type { FloorWorkspace, LayoutValidationIssue, Rack, Wall, Zone } from '@wos/domain';
import {
  AlertTriangle,
  ArrowRightLeft,
  Box,
  CheckCircle2,
  Copy,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  XCircle
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ViewMode, RackSideFocus } from '@/widgets/warehouse-editor/model/editor-types';
import {
  useCreateWallFromRackSide,
  useDeleteRack,
  useDeleteWall,
  useDeleteZone,
  useDraftDirtyState,
  useDuplicateRack,
  useIsLayoutEditable,
  useRotateRack,
  useSelectedRackFocus,
  useSelectedRackId,
  useSelectedWallId,
  useSelectedZoneId,
  useSetEditorMode,
  useSetSelectedRackId
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useCachedLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { faceAtViewportEdge } from '@/shared/lib/rack-face-labels';
import { useWorkspaceLayout } from '../../lib/use-workspace-layout';
import type { ContextPanelIntent } from '../context-panel-logic';

function countRackSections(rack: Rack) {
  return rack.faces.reduce((total, face) => total + face.sections.length, 0);
}

function formatZoneCategory(category: Zone['category']) {
  if (!category) {
    return 'No category';
  }

  return `${category.slice(0, 1).toUpperCase()}${category.slice(1)}`;
}

function formatWallType(wallType: Wall['wallType']) {
  if (!wallType) {
    return 'No type';
  }

  return `${wallType.slice(0, 1).toUpperCase()}${wallType.slice(1)}`;
}

function filterRackIssues(rack: Rack, issues: LayoutValidationIssue[]) {
  return issues.filter(
    (issue) =>
      !issue.entityId ||
      issue.entityId === rack.id ||
      rack.faces.some((face) => face.id === issue.entityId)
  );
}

function getRackValidationSummary(issues: LayoutValidationIssue[]) {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  if (errorCount > 0) {
    return {
      icon: XCircle,
      label: `${errorCount} error${errorCount > 1 ? 's' : ''}`,
      style: {
        background: '#fef2f2',
        color: '#b91c1c'
      }
    };
  }

  if (warningCount > 0) {
    return {
      icon: AlertTriangle,
      label: `${warningCount} warning${warningCount > 1 ? 's' : ''}`,
      style: {
        background: '#fffbeb',
        color: '#b45309'
      }
    };
  }

  return {
    icon: CheckCircle2,
    label: 'Valid',
    style: {
      background: '#ecfdf5',
      color: '#047857'
    }
  };
}

function ViewRackLevelPanel({
  workspace
}: {
  workspace: FloorWorkspace | null;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedRackId = useSelectedRackId();
  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;

  if (!rack) {
    return <PlaceholderContent description="No rack selected." />;
  }

  return (
    <div className="px-3 py-3">
      <div className="mb-2 truncate px-0.5 text-sm font-semibold text-slate-900" title={rack.displayCode}>
        Rack {rack.displayCode}
      </div>
      <p className="text-[11px] text-slate-500">
        Rack-level storage overview is available in Storage mode.
      </p>
    </div>
  );
}

function RackContextPanel({
  workspace
}: {
  workspace: FloorWorkspace | null;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedRackId = useSelectedRackId();
  const isLayoutEditable = useIsLayoutEditable();
  const isDraftDirty = useDraftDirtyState();
  const rotateRack = useRotateRack();
  const duplicateRack = useDuplicateRack();
  const deleteRack = useDeleteRack();

  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;
  const persistedDraftValidation = useCachedLayoutValidation(layoutDraft?.layoutVersionId ?? null);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedRackId]);

  const cellCount = useMemo(() => {
    if (!layoutDraft || !rack) return 0;

    return generatePreviewCells({
      ...layoutDraft,
      rackIds: [rack.id],
      racks: { [rack.id]: rack }
    }).length;
  }, [layoutDraft, rack]);

  const rackIssues = useMemo(() => {
    if (!layoutDraft || !rack) return [];

    const clientPrecheck = validateLayoutDraft(layoutDraft);
    const activeValidationSummary =
      !isDraftDirty && persistedDraftValidation.data ? persistedDraftValidation.data : clientPrecheck;

    return filterRackIssues(rack, activeValidationSummary.issues);
  }, [persistedDraftValidation.data, isDraftDirty, layoutDraft, rack]);

  if (!rack) {
    return <PlaceholderContent description="Rack context is unavailable for the current selection." />;
  }

  const sectionCount = countRackSections(rack);
  const status = getRackValidationSummary(rackIssues);
  const StatusIcon = status.icon;

  return (
    <div className="px-3 py-3">
      <div className="mb-2.5 flex items-center gap-1.5 px-0.5">
        <span className="truncate text-sm font-semibold text-slate-900" title={rack.displayCode}>
          Rack {rack.displayCode}
        </span>
        <StatusIcon className="h-3.5 w-3.5 shrink-0" style={{ color: status.style.color }} />
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
          <span>{sectionCount} sec</span>
          <span className="text-slate-300">·</span>
          <span>{cellCount} cells</span>
        </span>
      </div>

      {isLayoutEditable && (
        !confirmingDelete ? (
          <div className="grid grid-cols-3 gap-1.5">
            <ContextActionButton
              label="Rotate"
              icon={RotateCcw}
              onClick={() => rotateRack(rack.id)}
            />
            <ContextActionButton
              label="Duplicate"
              icon={Copy}
              onClick={() => duplicateRack(rack.id)}
            />
            <ContextActionButton
              label="Delete"
              icon={Trash2}
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-red-200 bg-red-50 p-2">
            <div className="self-center px-1 text-[11px] font-medium text-red-600">
              Delete this rack?
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRack(rack.id);
                  setConfirmingDelete(false);
                }}
                className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function RackSideContextPanel({
  workspace
}: {
  workspace: FloorWorkspace | null;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedRackId = useSelectedRackId();
  const selectedRackFocus = useSelectedRackFocus();
  const isLayoutEditable = useIsLayoutEditable();
  const createWallFromRackSide = useCreateWallFromRackSide();
  const setEditorMode = useSetEditorMode();
  const setSelectedRackId = useSetSelectedRackId();

  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;
  const side = selectedRackFocus.type === 'side' ? selectedRackFocus.side : null;

  if (!rack || !side) {
    return <PlaceholderContent description="Rack side context is unavailable for the current selection." />;
  }

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl border border-[var(--border-muted)] bg-white p-3">
        <div className="text-sm font-semibold text-slate-900">Rack {rack.displayCode}</div>
        <div className="mt-1 text-xs font-medium text-[var(--accent)]">
          {`Face ${faceAtViewportEdge(rack.rotationDeg, side)}`}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Use this edge for adjacency and access launchers. Full rack structure stays in the inspector.
        </p>
        <button
          type="button"
          onClick={() => setSelectedRackId(rack.id)}
          className="mt-3 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          Back to rack body
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <ContextActionButton
          label="Add rack here"
          icon={Box}
          disabled={!isLayoutEditable}
          onClick={() => {
            setSelectedRackId(null);
            setEditorMode('place');
          }}
        />
        <ContextActionButton
          label="Add wall here"
          icon={Layers}
          disabled={!isLayoutEditable}
          onClick={() => createWallFromRackSide(rack.id, side)}
        />
        <ContextActionButton
          label="Mark aisle/access"
          icon={ArrowRightLeft}
          disabled
          onClick={() => undefined}
        />
      </div>
    </div>
  );
}

function WallContextPanel({
  workspace,
  onOpenInspector
}: {
  workspace: FloorWorkspace | null;
  onOpenInspector: () => void;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedWallId = useSelectedWallId();
  const deleteWall = useDeleteWall();
  const isLayoutEditable = useIsLayoutEditable();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const wall = layoutDraft && selectedWallId ? layoutDraft.walls[selectedWallId] : null;

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedWallId]);

  if (!wall) {
    return <PlaceholderContent description="Wall context is unavailable for the current selection." />;
  }

  const wallLength = Math.abs(wall.x2 - wall.x1) + Math.abs(wall.y2 - wall.y1);
  const orientation = wall.y1 === wall.y2 ? 'Horizontal' : 'Vertical';

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl border border-[var(--border-muted)] bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900" title={wall.name ?? wall.code}>
              {wall.name ?? wall.code}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {wall.code} | {formatWallType(wall.wallType)}
            </div>
          </div>

          <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
            {wall.blocksRackPlacement ? 'Blocking' : 'Non-blocking'}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: 'Length', value: `${wallLength.toFixed(1)} m` },
            { label: 'Axis', value: orientation }
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2"
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{value}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Drag the segment or its endpoints on the canvas. Stable metadata and coordinates stay in the inspector.
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <ContextActionButton
          label="Inspect wall"
          icon={SlidersHorizontal}
          onClick={onOpenInspector}
        />

        {isLayoutEditable && (
          !confirmingDelete ? (
            <ContextActionButton
              label="Delete wall"
              icon={Trash2}
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
            />
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-red-200 bg-red-50 p-2">
              <div className="self-center px-1 text-[11px] font-medium text-red-600">
                Delete this wall?
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteWall(wall.id);
                    setConfirmingDelete(false);
                  }}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ZoneContextPanel({
  workspace,
  onOpenInspector
}: {
  workspace: FloorWorkspace | null;
  onOpenInspector: () => void;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedZoneId = useSelectedZoneId();
  const deleteZone = useDeleteZone();
  const isLayoutEditable = useIsLayoutEditable();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const zone = layoutDraft && selectedZoneId ? layoutDraft.zones[selectedZoneId] : null;

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedZoneId]);

  if (!zone) {
    return <PlaceholderContent description="Zone context is unavailable for the current selection." />;
  }

  const behavior = getZonePlacementBehavior(zone.category);

  const behaviorBadge = {
    none: { label: 'Context only', className: 'bg-slate-100 text-slate-600' },
    children_only: { label: 'Via rack cells', className: 'bg-blue-50 text-blue-700' },
    direct: { label: 'Direct placement', className: 'bg-amber-50 text-amber-700' }
  }[behavior];

  const behaviorNote = {
    none: 'Operational area only — not a container placement target.',
    children_only: 'Containers are placed in rack cells inside this zone, not in the zone itself.',
    direct: 'Designed for direct staging placement. Floor-level locations are planned.'
  }[behavior];

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl border border-[var(--border-muted)] bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900" title={zone.name}>
              {zone.name}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {zone.code} | {formatZoneCategory(zone.category)}
            </div>
          </div>

          <span
            className="inline-flex h-6 w-6 shrink-0 rounded-full border border-white shadow-sm"
            style={{ background: zone.color }}
            title={zone.color}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: 'Size', value: `${Math.round(zone.width)} x ${Math.round(zone.height)}` },
            { label: 'Origin', value: `${Math.round(zone.x)}, ${Math.round(zone.y)}` }
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2"
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${behaviorBadge.className}`}
          >
            {behaviorBadge.label}
          </span>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {behaviorNote} Rename, recolor, and fine-tune geometry in the inspector.
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <ContextActionButton
          label="Inspect zone"
          icon={SlidersHorizontal}
          onClick={onOpenInspector}
        />

        {isLayoutEditable && (
          !confirmingDelete ? (
            <ContextActionButton
              label="Delete zone"
              icon={Trash2}
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
            />
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-red-200 bg-red-50 p-2">
              <div className="self-center px-1 text-[11px] font-medium text-red-600">
                Delete this zone?
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteZone(zone.id);
                    setConfirmingDelete(false);
                  }}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ContextActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  className = '',
  disabled = false
}: {
  icon: typeof RotateCcw;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  const buttonClassName =
    variant === 'danger'
      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
      : 'border-[var(--border-muted)] bg-white text-slate-600 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName} ${className}`.trim()}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function PlaceholderContent({ description }: { description: string }) {
  return (
    <div className="px-3 py-3">
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        {description}
      </p>
    </div>
  );
}

export function LayoutContextPanel({
  workspace,
  onOpenInspector,
  intent,
  viewMode
}: {
  workspace: FloorWorkspace | null;
  onOpenInspector: () => void;
  intent: ContextPanelIntent;
  viewMode: ViewMode;
}) {
  if (intent === 'rack-context' && viewMode === 'layout') {
    return <RackContextPanel workspace={workspace} />;
  }

  if (intent === 'rack-side-context' && viewMode === 'layout') {
    return <RackSideContextPanel workspace={workspace} />;
  }

  if (intent === 'zone-context' && viewMode === 'layout') {
    return (
      <ZoneContextPanel
        workspace={workspace}
        onOpenInspector={onOpenInspector}
      />
    );
  }

  if (intent === 'wall-context' && viewMode === 'layout') {
    return (
      <WallContextPanel
        workspace={workspace}
        onOpenInspector={onOpenInspector}
      />
    );
  }

  if (intent === 'rack-context' && viewMode === 'view') {
    return <ViewRackLevelPanel workspace={workspace} />;
  }

  if (intent === 'rack-context' && viewMode === 'storage') {
    return <PlaceholderContent description="Rack-level storage ownership is in the inspector." />;
  }

  return null;
}
